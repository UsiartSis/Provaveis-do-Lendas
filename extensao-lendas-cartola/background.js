// =========================================================================
// LENDAS CARTOLA SYNC — Background Service Worker
// =========================================================================

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Lendas Cartola Sync] Extensão instalada com sucesso.");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SALVAR_TIME_CARTOLA") {
    handleSaveTeam(request.payload)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, message: err.message || "Erro ao salvar time." }));
    return true; // Mantém o canal de mensagem aberto para resposta assíncrona
  }

  if (request.type === "CHECK_CARTOLA_AUTH") {
    checkCartolaAuth()
      .then(auth => sendResponse(auth))
      .catch(err => sendResponse({ loggedIn: false, error: err.message }));
    return true;
  }
});

// Extrai todos os cookies da Globo consultando todas as URLs e domínios possíveis
async function getAllGloboCookies() {
  const urls = [
    "https://globo.com",
    "https://cartola.globo.com",
    "https://login.globo.com",
    "https://api.cartola.globo.com",
    "https://minhaconta.globo.com",
    "https://ge.globo.com",
    "https://g1.globo.com"
  ];
  const domains = [
    "globo.com",
    ".globo.com",
    "cartola.globo.com",
    ".cartola.globo.com",
    "login.globo.com",
    ".login.globo.com"
  ];

  const cookieMap = new Map();

  for (const url of urls) {
    try {
      const list = await chrome.cookies.getAll({ url });
      list.forEach(c => cookieMap.set(`${c.domain}:${c.name}`, c));
    } catch (e) {}
  }

  for (const domain of domains) {
    try {
      const list = await chrome.cookies.getAll({ domain });
      list.forEach(c => cookieMap.set(`${c.domain}:${c.name}`, c));
    } catch (e) {}
  }

  try {
    const list = await chrome.cookies.getAll({});
    list.forEach(c => {
      if (c.domain && (c.domain.includes("globo") || c.domain.includes("cartola"))) {
        cookieMap.set(`${c.domain}:${c.name}`, c);
      }
    });
  } catch (e) {}

  return Array.from(cookieMap.values());
}

// Extrai todos os tokens da Globo (Cookies, Storage OIDC, JWT)
async function getGloboAuthTokens() {
  let accessToken = null;
  let refreshToken = null;
  let glbId = null;

  try {
    const allGloboCookies = await getAllGloboCookies();
    const glbIdCookie = allGloboCookies.find(c => c.name.toUpperCase() === "GLBID" && c.value);
    if (glbIdCookie && glbIdCookie.value) {
      glbId = glbIdCookie.value;
    }

    const candidateNames = ["_GLB_AUTH", "GLB_ID", "USER_TOKEN", "AUTH_TOKEN", "GLBTOKEN", "GLB_TOKEN", "SSO_TOKEN"];
    for (const name of candidateNames) {
      const found = allGloboCookies.find(c => c.name.toUpperCase() === name && c.value);
      if (found && found.value && !glbId) {
        glbId = found.value;
      }
    }

    // Extrair do localStorage e sessionStorage de qualquer aba da Globo aberta
    const tabs = await chrome.tabs.query({});
    const globoTab = tabs.find(t => t.url && (t.url.includes("cartola.globo.com") || t.url.includes("globo.com")));
    if (globoTab) {
      try {
        const scriptRes = await chrome.scripting.executeScript({
          target: { tabId: globoTab.id },
          func: () => {
            let at = null, rt = null, gid = null;
            const scan = (storage) => {
              for (let i = 0; i < storage.length; i++) {
                const k = storage.key(i);
                const v = storage.getItem(k);
                if (!v) continue;
                if (v.startsWith("{") && (v.includes("access_token") || v.includes("id_token") || v.includes("cartola"))) {
                  try {
                    const p = JSON.parse(v);
                    if (p.access_token && !at) at = p.access_token;
                    if (p.refresh_token && !rt) rt = p.refresh_token;
                  } catch(e) {}
                }
                if (v.startsWith("eyJ") && v.split(".").length === 3 && !at) at = v;
                if (k && k.toUpperCase().includes("GLBID") && !gid) gid = v;
              }
            };
            try { scan(window.sessionStorage); } catch(e) {}
            try { scan(window.localStorage); } catch(e) {}
            try {
              const m = document.cookie.match(/(?:^|;\s*)GLBID=([^;]+)/i);
              if (m && !gid) gid = decodeURIComponent(m[1]);
            } catch(e) {}
            return { accessToken: at, refreshToken: rt, glbId: gid };
          }
        });
        if (scriptRes && scriptRes[0] && scriptRes[0].result) {
          const res = scriptRes[0].result;
          if (res.accessToken) accessToken = res.accessToken;
          if (res.refreshToken) refreshToken = res.refreshToken;
          if (res.glbId && !glbId) glbId = res.glbId;
        }
      } catch(e) {}
    }
  } catch (e) {
    console.warn("[Background] Erro ao extrair tokens:", e);
  }

  return { accessToken, refreshToken, glbId };
}

// Extrai o token prioritário para autenticação rápida
async function getGloboAuthToken() {
  const tokens = await getGloboAuthTokens();
  return tokens.accessToken || tokens.glbId || tokens.refreshToken || null;
}

// Verifica status de autenticação da Globo e retorna dados completos do time
async function checkCartolaAuth() {
  try {
    const tokens = await getGloboAuthTokens();
    const token = tokens.accessToken || tokens.glbId || tokens.refreshToken;

    const headers = {
      "Accept": "application/json, text/plain, */*",
      "Origin": "https://cartola.globo.com",
      "Referer": "https://cartola.globo.com/"
    };
    if (tokens.accessToken) headers["Authorization"] = `Bearer ${tokens.accessToken}`;
    if (token) headers["X-GLB-Token"] = token;

    // 1. Obter time/info (contém nome, nome_cartola, escudo, etc.)
    const respInfo = await fetch("https://api.cartola.globo.com/auth/time/info", {
      method: "GET",
      headers,
      credentials: "include"
    });

    let teamObj = {};
    if (respInfo.ok) {
      const dataInfo = await respInfo.json();
      teamObj = dataInfo.time || {};
    }

    // 2. Obter /auth/time (contém patrimonio em tempo real, saldo, pontuações)
    try {
      const respAuthTime = await fetch("https://api.cartola.globo.com/auth/time", {
        method: "GET",
        headers,
        credentials: "include"
      });
      if (respAuthTime.ok) {
        const dataAuth = await respAuthTime.json();
        if (dataAuth.time) {
          teamObj = { ...teamObj, ...dataAuth.time };
        }
        if (dataAuth.patrimonio !== undefined) teamObj.patrimonio = dataAuth.patrimonio;
        if (dataAuth.pontos !== undefined) teamObj.pontos_ultima_rodada = dataAuth.pontos;
        if (dataAuth.pontos_campeonato !== undefined) teamObj.pontos_campeonato = dataAuth.pontos_campeonato;
      }
    } catch(e) {}

    // 3. Se temos o time_id, buscar pontuação consolidada no endpoint público se faltar
    if (teamObj.time_id || teamObj.id) {
      const timeId = teamObj.time_id || teamObj.id;
      try {
        const respPontos = await fetch(`https://api.cartola.globo.com/time/id/${timeId}`);
        if (respPontos.ok) {
          const dataPontos = await respPontos.json();
          if (dataPontos.time) {
            teamObj = { ...dataPontos.time, ...teamObj };
          }
          if (dataPontos.patrimonio !== undefined && !teamObj.patrimonio) {
            teamObj.patrimonio = dataPontos.patrimonio;
          }
          if (dataPontos.pontos !== undefined && teamObj.pontos_ultima_rodada === undefined) {
            teamObj.pontos_ultima_rodada = dataPontos.pontos;
          }
          if (dataPontos.pontos_campeonato !== undefined) {
            teamObj.pontos_campeonato = dataPontos.pontos_campeonato;
          }
        }
      } catch(e) {}
    }

    // 4. Se ainda faltar patrimonio ou pontuação, tentar via content script da aba aberta do Cartola
    if (teamObj.patrimonio === undefined || teamObj.patrimonio === null || !teamObj.pontos_ultima_rodada) {
      try {
        const tabs = await chrome.tabs.query({});
        const cartolaTab = tabs.find(t => t.url && t.url.includes("cartola.globo.com"));
        if (cartolaTab && cartolaTab.id) {
          const tabProfile = await new Promise(res => {
            chrome.tabs.sendMessage(cartolaTab.id, { type: "GET_CARTOLA_PROFILE_FROM_PAGE" }, resp => {
              if (chrome.runtime.lastError || !resp || !resp.success) res(null);
              else res(resp.time);
            });
          });
          if (tabProfile) {
            teamObj = { ...teamObj, ...tabProfile };
            if (tabProfile.patrimonio !== undefined) teamObj.patrimonio = tabProfile.patrimonio;
          }
        }
      } catch(e) {}
    }

    if (Object.keys(teamObj).length > 0) {
      return { 
        loggedIn: true, 
        time: teamObj, 
        patrimonio: teamObj.patrimonio !== undefined ? teamObj.patrimonio : null, 
        tokenFound: true 
      };
    }

    return { loggedIn: Boolean(token), tokenFound: Boolean(token) };
  } catch (e) {
    const token = await getGloboAuthToken();
    return { loggedIn: Boolean(token), error: e.message, tokenFound: Boolean(token) };
  }
}

// Envia o payload para o content_cartola.js via tabs.sendMessage
async function sendToCartolaContentScript(tabId, requestBody) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, { type: "EXECUTE_SALVAR_CARTOLA", payload: requestBody }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("[Background] sendMessage error:", chrome.runtime.lastError.message);
          resolve(null);
          return;
        }
        resolve(response);
      });
    } catch (err) {
      console.warn("[Background] sendToCartolaContentScript error:", err);
      resolve(null);
    }
  });
}

// Executa o salvamento do time via Estratégia Dupla (Background Fetch com host permissions + Content Script Fallback)
async function handleSaveTeam(payload) {
  try {
    console.log("[Background] Iniciando salvamento...", payload);

    // 1. Sanitizar payload
    const starterList = (Array.isArray(payload.atletas) ? payload.atletas : (payload.atleta || []))
      .map(Number).filter(id => !isNaN(id) && id > 0);

    const cleanReservas = {};
    if (payload.reservas && typeof payload.reservas === "object") {
      for (const [k, v] of Object.entries(payload.reservas)) {
        const aid = Number(v);
        if (!isNaN(aid) && aid > 0) cleanReservas[String(k)] = aid;
      }
    }

    const requestBody = {
      esquema: Number(payload.esquema || 3),
      capitao: Number(payload.capitao),
      atletas: starterList,
      reservas: cleanReservas
    };

    console.log("[Background] Payload formatado:", JSON.stringify(requestBody));

    // 2. Extrair tokens de autenticação
    const tokens = await getGloboAuthTokens();
    const token = tokens.accessToken || tokens.glbId || tokens.refreshToken;

    // 3. ESTRATÉGIA A: Fetch direto no Background Worker (com host_permissions, livre de CORS)
    try {
      const headers = {
        "Content-Type": "application/json;charset=UTF-8",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://cartola.globo.com",
        "Referer": "https://cartola.globo.com/"
      };
      if (tokens.accessToken) headers["Authorization"] = `Bearer ${tokens.accessToken}`;
      if (token) headers["X-GLB-Token"] = token;

      console.log("[Background Direct Fetch] Enviando request para api.cartola.globo.com...");
      const bgResp = await fetch("https://api.cartola.globo.com/auth/time/salvar", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(requestBody)
      });

      const text = await bgResp.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }

      console.log("[Background Direct Fetch] Resposta:", bgResp.status, data);

      if (bgResp.ok) {
        // Recarregar aba do Cartola se estiver aberta
        const allTabs = await chrome.tabs.query({});
        const cartolaTab = allTabs.find(t => t.url && t.url.includes("cartola.globo.com") && !t.url.includes("api."));
        if (cartolaTab) {
          setTimeout(() => chrome.tabs.reload(cartolaTab.id).catch(() => {}), 1000);
        }

        const msg = data.mensagem
          || (data.time && data.time.nome ? `Time "${data.time.nome}" escalado!` : "Time escalado com sucesso no Cartola FC!");
        return { success: true, message: msg, data };
      }

      // Se a resposta foi erro específico de autenticação ou regra do Cartola
      if (bgResp.status === 401 || bgResp.status === 403) {
        return {
          success: false,
          status: bgResp.status,
          message: "Sessão expirada (401). Abra cartola.globo.com, confirme seu login e tente novamente!"
        };
      }

      if (data && (data.mensagem || data.error || data.erros)) {
        const msg = data.mensagem || data.error || (Array.isArray(data.erros) ? data.erros.join(", ") : "Erro ao salvar time.");
        return { success: false, status: bgResp.status, message: msg, data };
      }

    } catch (bgErr) {
      console.warn("[Background Direct Fetch] Falhou, tentando fallback em aba...", bgErr);
    }

    // 4. ESTRATÉGIA B: Fallback via Content Script na aba cartola.globo.com
    const allTabs = await chrome.tabs.query({});
    let cartolaTab = allTabs.find(t => t.url && t.url.includes("cartola.globo.com") && !t.url.includes("api."));

    if (!cartolaTab) {
      console.log("[Background] Abrindo aba do Cartola para fallback...");
      cartolaTab = await chrome.tabs.create({ url: "https://cartola.globo.com/", active: true });
      await new Promise(resolve => {
        const listener = (tabId, changeInfo) => {
          if (tabId === cartolaTab.id && changeInfo.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);
            setTimeout(resolve, 1500);
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
        setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 10000);
      });
    }

    const result = await sendToCartolaContentScript(cartolaTab.id, requestBody);

    if (result && result.success) {
      setTimeout(() => chrome.tabs.reload(cartolaTab.id).catch(() => {}), 1500);
      return result;
    }

    if (result) return result;

    return {
      success: false,
      message: "Não foi possível sincronizar com o Cartola. Abra cartola.globo.com, confirme que está logado e recarregue a extensão no Chrome (chrome://extensions)."
    };

  } catch (error) {
    console.error("[Background] Erro em handleSaveTeam:", error);
    return { success: false, message: "Erro inesperado: " + error.message };
  }
}

