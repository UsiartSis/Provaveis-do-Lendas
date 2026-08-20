// =========================================================================
// LENDAS CARTOLA SYNC — Content Script no site oficial do Cartola FC
// =========================================================================

console.log("[Lendas Cartola Sync] Conectado à sessão oficial do Cartola FC.");

// Escutar mensagens vindas do background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "PING_CARTOLA_SESSION") {
    sendResponse({ active: true, url: window.location.href });
    return true;
  }

  if (request.type === "GET_CARTOLA_TOKENS") {
    const tokens = extractTokensFromPage();
    sendResponse(tokens);
    return true;
  }

  if (request.type === "GET_CARTOLA_PROFILE_FROM_PAGE") {
    fetchProfileFromCartolaPage()
      .then(profile => sendResponse(profile))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.type === "EXECUTE_SALVAR_CARTOLA") {
    salvarNaAbaCartola(request.payload)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, message: "Erro: " + err.message }));
    return true;
  }
});

// Faz fetch dos dados do perfil autenticado diretamente da aba do Cartola (aproveita todos os cookies e sessões ativas)
async function fetchProfileFromCartolaPage() {
  try {
    const tokens = extractTokensFromPage();
    const token = tokens.accessToken || tokens.idToken || tokens.refreshToken || tokens.glbId;
    const headers = {
      "Accept": "application/json, text/plain, */*"
    };
    if (tokens.accessToken) headers["Authorization"] = `Bearer ${tokens.accessToken}`;
    if (token) headers["X-GLB-Token"] = token;

    let profile = {};

    // 1. /auth/time/info (Nome do time, dono, escudo)
    try {
      const respInfo = await fetch("https://api.cartola.globo.com/auth/time/info", { headers, credentials: "include" });
      if (respInfo.ok) {
        const d = await respInfo.json();
        if (d.time) profile = { ...profile, ...d.time };
      }
    } catch(e) {}

    // 2. /auth/time (Patrimônio real atualizado, pontos da rodada e do campeonato)
    try {
      const respAuth = await fetch("https://api.cartola.globo.com/auth/time", { headers, credentials: "include" });
      if (respAuth.ok) {
        const d = await respAuth.json();
        if (d.time) profile = { ...profile, ...d.time };
        if (d.patrimonio !== undefined) profile.patrimonio = d.patrimonio;
        if (d.pontos !== undefined) profile.pontos_ultima_rodada = d.pontos;
        if (d.pontos_campeonato !== undefined) profile.pontos_campeonato = d.pontos_campeonato;
      }
    } catch(e) {}

    // 3. /time/id/{time_id} se disponível
    if (profile.time_id || profile.id) {
      const tid = profile.time_id || profile.id;
      try {
        const respP = await fetch(`https://api.cartola.globo.com/time/id/${tid}`);
        if (respP.ok) {
          const d = await respP.json();
          if (d.time) profile = { ...d.time, ...profile };
          if (d.patrimonio !== undefined && (profile.patrimonio === undefined || profile.patrimonio === null)) {
            profile.patrimonio = d.patrimonio;
          }
          if (d.pontos !== undefined && profile.pontos_ultima_rodada === undefined) {
            profile.pontos_ultima_rodada = d.pontos;
          }
          if (d.pontos_campeonato !== undefined) {
            profile.pontos_campeonato = d.pontos_campeonato;
          }
        }
      } catch(e) {}
    }

    return { success: true, time: profile, patrimonio: profile.patrimonio };
  } catch(err) {
    return { success: false, error: err.message };
  }
}

// Extrai tokens de todas as fontes da página (localStorage, sessionStorage, cookies)
function extractTokensFromPage() {
  let accessToken = null;
  let idToken = null;
  let refreshToken = null;
  let glbId = null;

  // 1. Cookies
  try {
    const m = document.cookie.match(/(?:^|;\s*)GLBID=([^;]+)/i);
    if (m) glbId = decodeURIComponent(m[1]);
  } catch(e) {}

  // 2. Storage helper
  const scanStorage = (storage) => {
    try {
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        const val = storage.getItem(k);
        if (!val) continue;

        // Caso seja JSON do OIDC (ex: oidc.user:...)
        if (val.startsWith("{") && (val.includes("access_token") || val.includes("id_token") || val.includes("cartola"))) {
          try {
            const parsed = JSON.parse(val);
            if (parsed.access_token && !accessToken) accessToken = parsed.access_token;
            if (parsed.id_token && !idToken) idToken = parsed.id_token;
            if (parsed.refresh_token && !refreshToken) refreshToken = parsed.refresh_token;
          } catch(e) {}
        }

        // Caso o próprio valor seja um JWT
        if (val.startsWith("eyJ") && val.split(".").length === 3) {
          if (!accessToken) accessToken = val;
        }

        if (k && (k.toUpperCase().includes("GLBID") || k.toUpperCase().includes("GLB_ID")) && !glbId) {
          glbId = val;
        }
      }
    } catch(e) {}
  };

  scanStorage(window.sessionStorage);
  scanStorage(window.localStorage);

  return { accessToken, idToken, refreshToken, glbId };
}

// Faz o fetch para a API do Cartola usando os tokens e cookies da sessão
async function salvarNaAbaCartola(payload) {
  try {
    console.log("[Lendas Content Cartola] Enviando escalação...", payload);

    const tokens = extractTokensFromPage();
    const token = tokens.accessToken || tokens.idToken || tokens.refreshToken || tokens.glbId;

    const headers = {
      "Content-Type": "application/json;charset=UTF-8",
      "Accept": "application/json, text/plain, */*"
    };

    if (tokens.accessToken) {
      headers["Authorization"] = `Bearer ${tokens.accessToken}`;
    }
    if (token) {
      headers["X-GLB-Token"] = token;
    }

    const resp = await fetch("https://api.cartola.globo.com/auth/time/salvar", {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify(payload)
    });

    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    console.log("[Lendas Content Cartola] Resposta API:", resp.status, data);

    if (resp.ok) {
      showNotification("⚽ Escalação Lendas salva com sucesso no Cartola FC!", "success");
      const msg = data.mensagem
        || (data.time && data.time.nome ? `Time "${data.time.nome}" escalado!` : "Time escalado com sucesso!");
      return { success: true, message: msg, data };
    } else {
      let msg = data.mensagem || data.error
        || (Array.isArray(data.erros) ? data.erros.join(", ") : `Erro HTTP ${resp.status}`);
      if (resp.status === 401 || resp.status === 403) {
        msg = `Sessão expirada (${resp.status}). Confirme seu login em cartola.globo.com!`;
        showNotification("⚠️ " + msg, "error");
      }
      return { success: false, status: resp.status, message: msg, data };
    }
  } catch (err) {
    console.error("[Lendas Content Cartola] Erro no fetch:", err);
    return { success: false, message: "Falha de rede: " + err.message };
  }
}

function showNotification(text, type = "success") {
  try {
    const div = document.createElement("div");
    div.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 999999;
      background: ${type === "success" ? "#10b981" : "#ef4444"};
      color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-weight: 700; font-size: 14px; padding: 14px 20px; border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    `;
    div.textContent = text;
    document.body.appendChild(div);
    setTimeout(() => {
      div.style.opacity = "0";
      div.style.transition = "opacity 0.5s ease";
      setTimeout(() => div.remove(), 500);
    }, 4000);
  } catch (e) {}
}


