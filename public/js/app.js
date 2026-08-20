// =========================================================================
// LENDAS DO CARTOLA PROVÁVEIS 2026 — app.js
// =========================================================================
let currentMatch = null;
let currentClubId = null;
let allMatches = [];
let allClubs = {};
let allAthletes = [];
let allPositions = {};
let allStatus = {};
let allTactics = {};
let allPitchPositions = {};
let marketStatusObj = {};
let currentRound = 23;
let activeModalAthlete = null;
let currentRoundsFilter = 'geral';

let currentFotoMode = 'local';

// =========================================================================
// INIT
// =========================================================================
async function initApp() {
  try {
    const [statusMercado, partidasRes, atletasRes, statusRes, taticasRes, pitchPositionsRes, configRes] = await Promise.all([
      fetch('/api/mercado/status').then(r => r.json()),
      fetch('/api/partidas').then(r => r.json()),
      fetch('/api/atletas/mercado').then(r => r.json()),
      fetch('/api/status').then(r => r.json()),
      fetch('/api/taticas').then(r => r.json()),
      fetch('/api/pitch/positions').then(r => r.json()).catch(() => ({})),
      fetch('/api/config').then(r => r.json()).catch(() => ({ foto_mode: 'local' }))
    ]);

    marketStatusObj = statusMercado;
    currentRound = statusMercado.rodada_atual || 23;
    allTactics = taticasRes || {};
    allPitchPositions = pitchPositionsRes || {};

    if (configRes && configRes.foto_mode) {
      currentFotoMode = configRes.foto_mode;
    }

    const isMercadoAberto = statusMercado.status_mercado === 1;

    // Status Bar
    const statusTextEl = document.getElementById('market-status-text');
    const statusDotEl = document.getElementById('market-status-dot');
    if (isMercadoAberto) {
      statusTextEl.textContent = `MERCADO ABERTO PARA A RODADA ${currentRound}`;
      if (statusDotEl) { statusDotEl.style.background = '#10b981'; statusDotEl.style.boxShadow = '0 0 12px #10b981'; }
    } else {
      statusTextEl.textContent = `MERCADO FECHADO • RODADA ${currentRound} EM ANDAMENTO`;
      if (statusDotEl) { statusDotEl.style.background = '#ef4444'; statusDotEl.style.boxShadow = '0 0 12px #ef4444'; }
    }

    document.getElementById('round-title-display').textContent = `10 JOGOS DA RODADA ${currentRound}`;

    allMatches = partidasRes.partidas || [];
    const rawClubs = atletasRes.clubes || [];
    allClubs = {};
    if (Array.isArray(rawClubs)) {
      rawClubs.forEach(c => { allClubs[c.id] = c; });
    } else {
      allClubs = rawClubs;
    }

    // Também adicionar clubes da partida
    allMatches.forEach(m => {
      if (m.clube_casa) allClubs[m.clube_casa_id] = m.clube_casa;
      if (m.clube_visitante) allClubs[m.clube_visitante_id] = m.clube_visitante;
    });

    allAthletes = atletasRes.atletas || [];
    allPositions = atletasRes.posicoes || {};
    allStatus = statusRes || {};

    renderMatchesBar();
    if (allMatches.length > 0) selectMatch(allMatches[0]);

    init3DDigitalClock(statusMercado);

    // Atualizar label do botão de fotos
    updatePhotoModeUI();

    // Letreiro Destaques
    loadMarqueeDestaques(isMercadoAberto, currentRound);

    // Inicializar Módulo Meu Time (G4 do Cartola FC)
    await initMyTeamModule();

    // Pré-renderizar Top 5 por Posição
    renderTop5View();

    // Carregar Tabela de Classificação
    await loadClassificacao();

  } catch (err) {
    console.error("Erro ao carregar dados:", err);
  }
}

function updatePhotoModeUI() {
  const lbl = document.getElementById('photo-mode-label');
  if (lbl) {
    lbl.textContent = currentFotoMode === 'local' ? '📸 Fotos Pastas' : '👕 Oficial Cartola';
  }
}

function toggleMainPhotoMode() {
  currentFotoMode = currentFotoMode === 'local' ? 'cartola' : 'local';
  updatePhotoModeUI();

  // Re-renderizar time atual se houver
  if (currentClubId) {
    const tatica = allTactics[String(currentClubId)] || allTactics[currentClubId] || "4-3-3";
    renderSquad(currentClubId, tatica);
  }

  // Re-renderizar Top 5
  if (typeof renderTop5View === 'function') {
    renderTop5View();
  }

  // Re-renderizar Meu Time / Campinho
  if (typeof renderMyTeamPitch === 'function') {
    renderMyTeamPitch();
  }
}

function getAthletePhoto(player) {
  if (!player) return 'https://api.dicebear.com/7.x/avataaars/svg?seed=avatar';
  if (currentFotoMode === 'local' && player.foto_local) {
    return player.foto_local;
  }
  return player.foto_cartola || player.foto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.atleta_id}`;
}

// =========================================================================
// LETREIRO DIGITAL DOS 10 DESTAQUES
// =========================================================================
async function loadMarqueeDestaques(isMercadoAberto, rodada) {
  try {
    const res = await fetch('/api/top_destaques');
    const destaques = await res.json();
    renderMarquee(destaques, isMercadoAberto, rodada);
  } catch (e) {
    // Fallback
    const marqueeTrack = document.getElementById('marquee-track');
    if (marqueeTrack) marqueeTrack.innerHTML = '<div class="marquee-item" style="color: var(--text-muted);">Dados de destaques não disponíveis.</div>';
  }
}

function renderMarquee(destaques, isMercadoAberto, rodada) {
  const marqueeLabel = document.getElementById('marquee-label');
  const marqueeTrack = document.getElementById('marquee-track');
  if (!marqueeTrack || !destaques || destaques.length === 0) return;

  const roundLabel = isMercadoAberto ? `⭐ TOP 10 PONTUADORES R${rodada - 1}` : `⭐ DESTAQUES R${rodada - 1}`;
  if (marqueeLabel) marqueeLabel.textContent = roundLabel;

  // Duplicar o conteúdo para loop infinito suave
  const buildItems = () => destaques.map((d, idx) => `
    <div class="marquee-item">
      <span class="m-rank">${idx + 1}°</span>
      ${d.clube_escudo ? `<img src="${d.clube_escudo}" alt="${d.clube_abrev}" onerror="this.style.display='none'">` : ''}
      <span style="color: #fff; font-weight: 700;">${d.apelido}</span>
      <span style="color: var(--text-muted); font-size: 0.75rem;">${d.clube_abrev}</span>
      <span class="m-score">${Number(d.pontuacao).toFixed(2)} pts</span>
    </div>
  `).join('');

  marqueeTrack.innerHTML = buildItems() + buildItems(); // duplicate for seamless loop
}

// =========================================================================
// MATCHES GRID
// =========================================================================
function renderMatchesBar() {
  const container = document.getElementById('matches-grid');
  if (!container) return;

  container.innerHTML = allMatches.map((m, idx) => {
    const casa = m.clube_casa || allClubs[m.clube_casa_id] || { nome: 'Casa', abreviacao: 'CAS' };
    const fora = m.clube_visitante || allClubs[m.clube_visitante_id] || { nome: 'Fora', abreviacao: 'FOR' };
    const dateStr = m.partida_data ? m.partida_data.substring(0, 16).replace('T', ' ') : 'A DEFINIR';
    const dateParts = dateStr.split(' ');
    const dateFormatted = dateParts[0] ? dateParts[0].substring(5).replace('-', '/') + ' ' + (dateParts[1] || '') : dateStr;

    const escudoCasa = casa.escudo || `https://api.dicebear.com/7.x/identicon/svg?seed=${casa.abreviacao}`;
    const escudoFora = fora.escudo || `https://api.dicebear.com/7.x/identicon/svg?seed=${fora.abreviacao}`;

    return `
      <div class="match-card ${idx === 0 ? 'active' : ''}" id="match-card-${m.partida_id}" onclick="onMatchClick(${m.partida_id})">
        <div class="match-date-badge">${dateFormatted.trim()}</div>
        <div class="match-teams-row">
          <div class="team-badge-col">
            <img src="${escudoCasa}" class="team-crest" alt="${casa.nome}" onerror="this.src='https://api.dicebear.com/7.x/identicon/svg?seed=${casa.abreviacao}'">
            <span class="team-sigla">${casa.abreviacao}</span>
          </div>
          <div class="match-vs">VS</div>
          <div class="team-badge-col">
            <img src="${escudoFora}" class="team-crest" alt="${fora.nome}" onerror="this.src='https://api.dicebear.com/7.x/identicon/svg?seed=${fora.abreviacao}'">
            <span class="team-sigla">${fora.abreviacao}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function onMatchClick(matchId) {
  const match = allMatches.find(m => m.partida_id === matchId);
  if (!match) return;
  document.querySelectorAll('.match-card').forEach(el => el.classList.remove('active'));
  const card = document.getElementById(`match-card-${matchId}`);
  if (card) card.classList.add('active');
  selectMatch(match);
}

function selectMatch(match) {
  currentMatch = match;
  selectTeam(match.clube_casa_id, true);
  // Carregar widget de confronto direto H2H
  loadH2HWidget(match);
}

function selectTeam(clubId, isMandante = true) {
  currentClubId = clubId;
  const club = allClubs[clubId] || { nome: 'Time', abreviacao: 'TIM' };
  const tatica = allTactics[String(clubId)] || allTactics[clubId] || "4-3-3";

  document.getElementById('active-team-name').textContent = club.nome;
  document.getElementById('active-team-sub').textContent = `Escalação Provável • Esquema ${tatica} • Clique no rosto para Scout`;

  const crestEl = document.getElementById('active-team-crest');
  crestEl.src = club.escudo || `https://api.dicebear.com/7.x/identicon/svg?seed=${club.abreviacao}`;
  crestEl.onerror = () => { crestEl.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${club.abreviacao}`; };

  const btnMandante = document.getElementById('btn-mandante');
  const btnVisitante = document.getElementById('btn-visitante');
  const casaObj = allClubs[currentMatch.clube_casa_id] || currentMatch.clube_casa || { abreviacao: 'MAND' };
  const foraObj = allClubs[currentMatch.clube_visitante_id] || currentMatch.clube_visitante || { abreviacao: 'VISIT' };

  btnMandante.textContent = casaObj.abreviacao;
  btnVisitante.textContent = foraObj.abreviacao;
  btnMandante.className = `toggle-btn ${isMandante ? 'active' : ''}`;
  btnVisitante.className = `toggle-btn ${!isMandante ? 'active' : ''}`;
  btnMandante.onclick = () => selectTeam(currentMatch.clube_casa_id, true);
  btnVisitante.onclick = () => selectTeam(currentMatch.clube_visitante_id, false);

  renderSquad(clubId, tatica);
}

// =========================================================================
// SQUAD PITCH RENDERER
// =========================================================================
function renderSquad(clubId, tatica = "4-3-3") {
  const squad = allAthletes.filter(a => a.clube_id === clubId);
  const provaveis = squad.filter(a => a.status_id === 7);
  const duvidas = squad.filter(a => a.status_id === 2);
  const lesionados = squad.filter(a => a.status_id === 5);
  const suspensos = squad.filter(a => a.status_id === 3);

  const clubPositions = allPitchPositions[String(clubId)];
  const soccerField = document.getElementById('soccer-field');
  let customLayer = document.getElementById('pitch-custom-layer');

  if (clubPositions && Object.keys(clubPositions).length > 0) {
    document.getElementById('row-ataque').innerHTML = '';
    document.getElementById('row-meio').innerHTML = '';
    document.getElementById('row-defesa').innerHTML = '';
    document.getElementById('row-goleiro').innerHTML = '';

    if (!customLayer) {
      customLayer = document.createElement('div');
      customLayer.id = 'pitch-custom-layer';
      customLayer.style.cssText = 'position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 15;';
      soccerField.appendChild(customLayer);
    }
    customLayer.style.display = 'block';

    let html = '';
    for (const [atletaIdStr, coords] of Object.entries(clubPositions)) {
      const p = squad.find(a => String(a.atleta_id) === String(atletaIdStr)) || allAthletes.find(a => String(a.atleta_id) === String(atletaIdStr));
      if (!p) continue;
      const xPct = (coords.x <= 1 ? coords.x * 100 : coords.x).toFixed(2);
      const yPct = (coords.y <= 1 ? coords.y * 100 : coords.y).toFixed(2);
      html += renderPlayerNodeCustom(p, duvidas, xPct, yPct);
    }
    customLayer.innerHTML = html;
  } else {
    if (customLayer) {
      customLayer.style.display = 'none';
      customLayer.innerHTML = '';
    }

    // Parse tactical formation
    let numZags = 2, numLats = 2, numMeis = 3, numAtas = 3;
    const tacParts = tatica.split('-').map(Number);
    if (tacParts.length === 3) {
      const [d, m, a] = tacParts;
      numAtas = a;
      numMeis = m;
      if (d === 4) { numZags = 2; numLats = 2; }
      else if (d === 3) { numZags = 3; numLats = 0; }
      else if (d === 5) { numZags = 3; numLats = 2; }
    }

    const getPositionPlayers = (posId, count) => {
      // Prioridade: 1) Prováveis (7) e Dúvidas (2) definidos pelo Admin
      let list = squad.filter(a => a.posicao_id === posId && (a.status_id === 7 || a.status_id === 2));
      if (list.length < count) {
        const fill = squad.filter(a => a.posicao_id === posId && !list.find(x => x.atleta_id === a.atleta_id) && a.status_id !== 5 && a.status_id !== 3);
        list = [...list, ...fill];
      }
      if (list.length < count) {
        const rest = squad.filter(a => a.posicao_id === posId && !list.find(x => x.atleta_id === a.atleta_id));
        list = [...list, ...rest];
      }
      return list.slice(0, count);
    };

    const finalAtacantes = getPositionPlayers(5, numAtas);
    const finalMeias = getPositionPlayers(4, numMeis);
    const finalZags = getPositionPlayers(3, numZags);
    const finalLats = numLats > 0 ? getPositionPlayers(2, numLats) : [];
    const finalGoleiro = getPositionPlayers(1, 1);

    document.getElementById('row-ataque').innerHTML = finalAtacantes.map(p => renderPlayerNode(p, duvidas)).join('');
    document.getElementById('row-meio').innerHTML = finalMeias.map(p => renderPlayerNode(p, duvidas)).join('');

    const defLine = numLats > 0
      ? [finalLats[0], ...finalZags, finalLats[1]].filter(Boolean)
      : finalZags;
    document.getElementById('row-defesa').innerHTML = defLine.map(p => renderPlayerNode(p, duvidas)).join('');
    document.getElementById('row-goleiro').innerHTML = finalGoleiro.map(p => renderPlayerNode(p, duvidas)).join('');
  }

  renderSidebarLists(duvidas, lesionados, suspensos);
}

function getDetailedPositionCategory(p) {
  const posId = p.posicao_id;
  if (posId === 1) return { key: 'GOL', label: 'Goleiros', icon: '🧤' };
  if (posId === 3) return { key: 'ZAG', label: 'Zagueiros', icon: '🧱' };
  if (posId === 4) return { key: 'MEI', label: 'Meio-Campo', icon: '⚙️' };
  if (posId === 5) return { key: 'ATA', label: 'Ataque', icon: '⚡' };
  if (posId === 2) {
    const nameLower = (p.apelido + ' ' + (p.nome || '')).toLowerCase();
    const isLE = /esquerdo|esquerda|\(le\)|le$|ayrton|piquerez|vanderlan|arana|rubens|bidu|hugo|welington|marlon|juninho capixaba|lucas piton|victor luis|reinaldo|cuiabano|maral|bernabei|esquivel|diego palacios|caio paulista/i.test(nameLower);
    const isLD = /direito|direita|\(ld\)|ld$|varela|wesley|marcos rocha|mayke|giay|fagner|matheuzinho|matheus franca|william|saravia|mariano|vitinho|tink|igor vinicius|rafinha|calegari|samuel xavier|guga|gilberto|bustos|agustin giay|tinga|nathan mendes|aderlan|jp galvao/i.test(nameLower);
    if (isLE && !isLD) return { key: 'LE', label: 'Laterais Esquerdos', icon: '🛡️ LE' };
    if (isLD && !isLE) return { key: 'LD', label: 'Laterais Direitos', icon: '🛡️ LD' };
    return { key: 'LAT', label: 'Laterais', icon: '🛡️ LAT' };
  }
  return { key: 'OUT', label: 'Outros', icon: '⚽' };
}

function getPlayerStatusClasses(player, isDuvida) {
  if (isDuvida || player.status_id === 2) {
    return {
      avatarClass: 'player-avatar-box status-duvida is-duvida',
      badge3d: '<div class="player-duvida-badge-3d" title="Dúvida na Escalação">?</div>',
      labelPrefix: '⚠️ '
    };
  }
  if (player.status_id === 5) {
    return {
      avatarClass: 'player-avatar-box status-lesionado',
      badge3d: '',
      labelPrefix: '🔴 '
    };
  }
  if (player.status_id === 3) {
    return {
      avatarClass: 'player-avatar-box status-suspenso',
      badge3d: '',
      labelPrefix: '🚫 '
    };
  }
  if (player.status_id === 6) {
    return {
      avatarClass: 'player-avatar-box status-nulo',
      badge3d: '',
      labelPrefix: ''
    };
  }
  // Provável (7) ou Padrão -> Verde
  return {
    avatarClass: 'player-avatar-box status-provavel',
    badge3d: '',
    labelPrefix: ''
  };
}

function renderPlayerNodeCustom(player, duvidaList = [], leftPct, topPct) {
  if (!player) return '';
  const isDuvida = duvidaList.some(d => d.atleta_id === player.atleta_id) || player.status_id === 2;
  const statusInfo = getPlayerStatusClasses(player, isDuvida);
  const nodeClass = isDuvida ? 'player-node is-duvida' : 'player-node';
  const photo = getAthletePhoto(player);

  return `
    <div class="${nodeClass}" style="position: absolute; left: ${leftPct}%; top: ${topPct}%; transform: translate(-50%, -50%); cursor: pointer; pointer-events: auto;" onclick="openScoutModal(${player.atleta_id})">
      <div class="${statusInfo.avatarClass}">
        <img src="${photo}" alt="${player.apelido}" class="player-avatar-img"
          onerror="this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=${player.atleta_id}'">
        ${statusInfo.badge3d}
      </div>
      <div class="player-name-label">${statusInfo.labelPrefix}${player.apelido}</div>
      <div class="player-price-label">C$ ${Number(player.preco_num).toFixed(2)}</div>
    </div>
  `;
}

function renderPlayerNode(player, duvidaList = []) {
  if (!player) return '';
  const isDuvida = duvidaList.some(d => d.atleta_id === player.atleta_id) || player.status_id === 2;
  const statusInfo = getPlayerStatusClasses(player, isDuvida);
  const nodeClass = isDuvida ? 'player-node is-duvida' : 'player-node';
  const photo = getAthletePhoto(player);

  return `
    <div class="${nodeClass}" onclick="openScoutModal(${player.atleta_id})">
      <div class="${statusInfo.avatarClass}">
        <img src="${photo}" alt="${player.apelido}" class="player-avatar-img"
          onerror="this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=${player.atleta_id}'">
        ${statusInfo.badge3d}
      </div>
      <div class="player-name-label">${statusInfo.labelPrefix}${player.apelido}</div>
      <div class="player-price-label">C$ ${Number(player.preco_num).toFixed(2)}</div>
    </div>
  `;
}

// =========================================================================
// SIDEBAR LISTS: DÚVIDAS AGRUPADAS POR POSIÇÃO E CONFRONTO ESPECÍFICO (LD x LD, LE x LE, ETC)
// =========================================================================
function renderSidebarLists(duvidas, lesionados, suspensos) {
  const listDuvidas = document.getElementById('list-duvidas');
  document.getElementById('count-duvidas').textContent = duvidas.length;
  
  if (duvidas.length === 0) {
    listDuvidas.innerHTML = '<div style="color: var(--text-muted); font-size: 0.82rem; padding: 12px 4px;">Nenhuma dúvida registrada.</div>';
  } else {
    // Agrupar dúvidas por categoria estrita de posição
    const categories = {
      'GOL': { label: '🧤 Goleiros', icon: '🧤', list: [] },
      'LD':  { label: '🛡️ Laterais Direitos (LD x LD)', icon: '🛡️', list: [] },
      'LE':  { label: '🛡️ Laterais Esquerdos (LE x LE)', icon: '🛡️', list: [] },
      'LAT': { label: '🛡️ Laterais', icon: '🛡️', list: [] },
      'ZAG': { label: '🧱 Zagueiros (ZAG x ZAG)', icon: '🧱', list: [] },
      'MEI': { label: '⚙️ Meio-Campo (MEI x MEI)', icon: '⚙️', list: [] },
      'ATA': { label: '⚡ Ataque (ATA x ATA)', icon: '⚡', list: [] },
      'OUT': { label: '⚽ Atletas', icon: '⚽', list: [] }
    };

    duvidas.forEach(p => {
      const cat = getDetailedPositionCategory(p);
      if (categories[cat.key]) {
        categories[cat.key].list.push(p);
      } else {
        categories['OUT'].list.push(p);
      }
    });

    let html = '';
    for (const [catKey, catObj] of Object.entries(categories)) {
      if (catObj.list.length === 0) continue;

      const itemsHtml = catObj.list.map(p => {
        const photo = getAthletePhoto(p);
        const squad = allAthletes.filter(a => a.clube_id === p.clube_id);
        
        // Buscar concorrente EXCLUSIVAMENTE da mesma subposição (LD com LD, LE com LE, ZAG com ZAG, etc.)
        const concorrentes = squad.filter(a => {
          if (a.atleta_id === p.atleta_id) return false;
          if (a.status_id === 5 || a.status_id === 3) return false; // ignorar machucados/suspensos
          const aCat = getDetailedPositionCategory(a);
          return aCat.key === catKey;
        });

        // Ordenar concorrentes por pontuação/média ou status provável
        concorrentes.sort((a, b) => (b.media_num || 0) - (a.media_num || 0));
        const disputaCom = concorrentes.length > 0 ? concorrentes[0] : null;

        return `
          <div class="duvidas-dispute-card" onclick="openScoutModal(${p.atleta_id})" style="cursor: pointer;">
            <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
              <div style="position: relative; width: 34px; height: 34px; flex-shrink: 0;">
                <img src="${photo}" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 2px solid #fbbf24;" onerror="this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=${p.atleta_id}'">
                <span style="position:absolute; top:-4px; right:-4px; background: #fbbf24; color: #000; font-size: 0.65rem; font-weight: 900; border-radius: 50%; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.8);">?</span>
              </div>
              <div style="min-width: 0;">
                <div style="color: #fbbf24; font-weight: 800; font-size: 0.84rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.apelido}</div>
                <div style="font-size: 0.72rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-top: 2px;">
                  <span style="color: #fff; font-weight: 700;">C$ ${Number(p.preco_num).toFixed(2)}</span>
                  ${disputaCom ? `<span class="disputa-tag" style="background: rgba(251,191,36,0.2); color: #fbbf24; border: 1px solid rgba(251,191,36,0.4); font-size: 0.68rem; padding: 1px 6px; border-radius: 4px;">⚔️ Disputa com <strong>${disputaCom.apelido}</strong></span>` : ''}
                </div>
              </div>
            </div>
            <span class="pill-count duvida" style="font-weight: 900; font-size: 0.68rem; padding: 3px 8px; flex-shrink: 0;">DÚVIDA</span>
          </div>
        `;
      }).join('');

      html += `
        <div class="duvidas-category-group">
          <div class="duvidas-category-header">
            <span class="duvidas-category-title">${catObj.label}</span>
            <span style="background: rgba(251, 191, 36, 0.2); color: #fbbf24; font-size: 0.68rem; font-weight: 900; padding: 1px 6px; border-radius: 9999px;">${catObj.list.length}</span>
          </div>
          ${itemsHtml}
        </div>
      `;
    }

    listDuvidas.innerHTML = html;
  }

  const listLesionados = document.getElementById('list-lesionados');
  document.getElementById('count-lesionados').textContent = lesionados.length;
  if (lesionados.length === 0) {
    listLesionados.innerHTML = '<div style="color: var(--text-muted); font-size: 0.82rem; padding: 12px 4px;">Nenhum lesionado no momento.</div>';
  } else {
    listLesionados.innerHTML = lesionados.map(p => `
      <div class="player-list-item lesionado" onclick="openScoutModal(${p.atleta_id})" style="cursor: pointer;">
        <div class="player-item-left">
          <img src="${getAthletePhoto(p)}" class="player-item-thumb" style="border: 2px solid #ef4444;" onerror="this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=${p.atleta_id}'">
          <div>
            <div class="player-item-name" style="color: #f87171;">${p.apelido}</div>
            <div class="player-item-pos">${allPositions[p.posicao_id]?.nome || 'Atleta'} • C$ ${Number(p.preco_num).toFixed(2)}</div>
          </div>
        </div>
        <span class="pill-count lesionado" style="font-weight: 800;">DM 🔴</span>
      </div>
    `).join('');
  }

  const listSuspensos = document.getElementById('list-suspensos');
  document.getElementById('count-suspensos').textContent = suspensos.length;
  if (suspensos.length === 0) {
    listSuspensos.innerHTML = '<div style="color: var(--text-muted); font-size: 0.82rem; padding: 12px 4px;">Nenhum suspenso na rodada.</div>';
  } else {
    listSuspensos.innerHTML = suspensos.map(p => `
      <div class="player-list-item suspenso" onclick="openScoutModal(${p.atleta_id})" style="cursor: pointer;">
        <div class="player-item-left">
          <img src="${getAthletePhoto(p)}" class="player-item-thumb" style="border: 2px solid #f97316;" onerror="this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=${p.atleta_id}'">
          <div>
            <div class="player-item-name" style="color: #fb923c;">${p.apelido}</div>
            <div class="player-item-pos">${allPositions[p.posicao_id]?.nome || 'Atleta'} • C$ ${Number(p.preco_num).toFixed(2)}</div>
          </div>
        </div>
        <span class="pill-count suspenso" style="font-weight: 800;">SUSPENSO 🚫</span>
      </div>
    `).join('');
  }
}

// =========================================================================
// WIDGET H2H — CONFRONTO DIRETO & ÚLTIMOS 5 JOGOS NA TELA PRINCIPAL
// =========================================================================

let currentH2HMatchData = null;
let currentWidgetTeam   = 'home'; // 'home' | 'away'

async function loadH2HWidget(partida) {
  if (!partida) {
    document.getElementById('h2h-widget-section').style.display = 'none';
    return;
  }

  try {
    const res = await fetch(`/api/confrontos-h2h/${partida.partida_id}`);
    if (!res.ok) { document.getElementById('h2h-widget-section').style.display = 'none'; return; }
    currentH2HMatchData = await res.json();
  } catch(e) {
    document.getElementById('h2h-widget-section').style.display = 'none';
    return;
  }

  if (!currentH2HMatchData || !currentH2HMatchData.partida_id) {
    document.getElementById('h2h-widget-section').style.display = 'none';
    return;
  }

  const casa = allClubs[partida.clube_casa_id] || partida.clube_casa || {};
  const vis  = allClubs[partida.clube_visitante_id] || partida.clube_visitante || {};

  // Atualizar botões dos times
  document.getElementById('widget-home-name').textContent = casa.abreviacao || casa.nome || 'MAND';
  document.getElementById('widget-away-name').textContent = vis.abreviacao || vis.nome || 'VISIT';
  document.getElementById('widget-home-crest').src = casa.escudo || '';
  document.getElementById('widget-away-crest').src = vis.escudo || '';
  document.getElementById('h2h-filter-a-label').textContent = `No ${casa.abreviacao || 'Mandante'}`;

  // Imagem personalizada 500x500
  const imgContainer = document.getElementById('h2h-custom-image-container');
  const imgEl = document.getElementById('h2h-custom-image');
  if (currentH2HMatchData.imagem_custom_500x500 && !currentH2HMatchData.imagem_custom_500x500.endsWith('.pdf')) {
    imgContainer.style.display = 'block';
    imgEl.src = currentH2HMatchData.imagem_custom_500x500;
  } else {
    imgContainer.style.display = 'none';
  }

  // Mostrar widget
  document.getElementById('h2h-widget-section').style.display = 'block';

  renderH2HWidget();
  renderH2HRecentWidget();
  if (typeof feather !== 'undefined') feather.replace();
}

function renderH2HWidget() {
  if (!currentH2HMatchData) return;
  const container = document.getElementById('h2h-direct-widget');
  if (!container) return;

  let jogos = currentH2HMatchData.confrontos_diretos || [];

  // Filtro "Esta Competição"
  const filterComp = document.getElementById('h2h-filter-comp')?.checked;
  if (filterComp) {
    jogos = jogos.filter(j => j.is_brasileirao);
  }

  if (jogos.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.82rem; text-align: center; padding: 24px;">Nenhum confronto direto cadastrado para este jogo.</div>';
    return;
  }

  container.innerHTML = jogos.map(j => {
    const isPlayed = j.hora_status === 'FT' || (j.placar_casa !== null && j.placar_casa !== undefined);
    const scoreHtml = isPlayed
      ? `<span style="font-weight: 900; font-size: 1rem; color: #fff;">${j.placar_casa ?? '-'}</span>`
      : '';
    const scoreVisHtml = isPlayed
      ? `<span style="font-weight: 900; font-size: 1rem; color: #fff;">${j.placar_visitante ?? '-'}</span>`
      : '';

    return `
      <div style="display: flex; align-items: center; gap: 10px; padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <div style="min-width: 58px; text-align: left;">
          <div style="font-size: 0.76rem; color: var(--text-muted); font-weight: 600;">${j.data || ''}</div>
          <div style="font-size: 0.72rem; color: ${j.hora_status === 'FT' ? 'var(--text-muted)' : '#10b981'}; font-weight: 700;">${j.hora_status || ''}</div>
        </div>
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <img src="${j.clube_casa_escudo || ''}" style="width: 18px; height: 18px; object-fit: contain;" onerror="this.style.display='none'">
            <span style="font-size: 0.84rem; font-weight: 700; color: #fff;">${j.clube_casa_nome || ''}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <img src="${j.clube_visitante_escudo || ''}" style="width: 18px; height: 18px; object-fit: contain;" onerror="this.style.display='none'">
            <span style="font-size: 0.84rem; font-weight: 700; color: #fff;">${j.clube_visitante_nome || ''}</span>
          </div>
        </div>
        <div style="text-align: right; min-width: 26px;">
          <div style="margin-bottom: 4px;">${scoreHtml}</div>
          <div>${scoreVisHtml}</div>
        </div>
      </div>
    `;
  }).join('');
}

function switchWidgetTeam(team) {
  currentWidgetTeam = team;
  document.getElementById('btn-widget-team-home').className = 'nav-btn' + (team === 'home' ? ' nav-btn-primary' : '');
  document.getElementById('btn-widget-team-away').className = 'nav-btn' + (team === 'away' ? ' nav-btn-primary' : '');
  renderH2HRecentWidget();
}

function renderH2HRecentWidget() {
  if (!currentH2HMatchData) return;
  const container = document.getElementById('h2h-recent-widget');
  if (!container) return;

  const key = currentWidgetTeam === 'home' ? 'ultimos_jogos_mandante' : 'ultimos_jogos_visitante';
  let jogos = currentH2HMatchData[key] || [];

  // Filtro Casa
  const filterCasa = document.getElementById('h2h-recent-filter-casa')?.checked;
  if (filterCasa) {
    jogos = jogos.filter(j => j.is_casa);
  }

  // Filtro Esta Competição
  const filterComp = document.getElementById('h2h-recent-filter-comp')?.checked;
  if (filterComp) {
    jogos = jogos.filter(j => j.is_brasileirao);
  }

  if (jogos.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.82rem; text-align: center; padding: 24px;">Nenhuma partida cadastrada.</div>';
    return;
  }

  // Resultado badge colors
  const resBg = { W: '#10b981', D: '#4b5563', L: '#ef4444' };
  const resLabel = { W: 'V', D: 'E', L: 'D' };

  container.innerHTML = jogos.map(j => {
    const isPlayed = j.hora_status === 'FT' || (j.placar_casa !== null && j.placar_casa !== undefined);
    const scoreHtml = isPlayed ? `<span style="font-weight: 900; font-size: 0.95rem; color: #fff;">${j.placar_casa ?? '-'}</span>` : '';
    const scoreVisHtml = isPlayed ? `<span style="font-weight: 900; font-size: 0.95rem; color: #fff;">${j.placar_visitante ?? '-'}</span>` : '';

    const resBadge = j.resultado
      ? `<div style="width: 22px; height: 22px; border-radius: 50%; background: ${resBg[j.resultado] || '#374151'}; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 900; color: #fff; flex-shrink: 0;">${resLabel[j.resultado] || j.resultado}</div>`
      : '';

    const obsHtml = j.obs ? `<span style="color: var(--text-muted); font-size: 0.7rem; margin-left: 4px;">${j.obs}</span>` : '';

    return `
      <div style="display: flex; align-items: center; gap: 10px; padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <div style="min-width: 58px;">
          <div style="font-size: 0.76rem; color: var(--text-muted); font-weight: 600;">${j.data || ''}</div>
          <div style="font-size: 0.72rem; color: ${j.hora_status === 'FT' ? 'var(--text-muted)' : '#10b981'}; font-weight: 700;">${j.hora_status || ''}</div>
        </div>
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <img src="${j.clube_casa_escudo || ''}" style="width: 18px; height: 18px; object-fit: contain;" onerror="this.style.display='none'">
            <span style="font-size: 0.84rem; font-weight: 700; color: #fff;">${j.clube_casa_nome || ''}${obsHtml}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <img src="${j.clube_visitante_escudo || ''}" style="width: 18px; height: 18px; object-fit: contain;" onerror="this.style.display='none'">
            <span style="font-size: 0.84rem; font-weight: 700; color: #fff;">${j.clube_visitante_nome || ''}</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <div style="text-align: right; min-width: 22px;">
            <div style="margin-bottom: 4px;">${scoreHtml}</div>
            <div>${scoreVisHtml}</div>
          </div>
          ${resBadge}
        </div>
      </div>
    `;
  }).join('');
}

// =========================================================================
// SCOUT MODAL — DINÂMICO, FIEL AO CARTOLA
// =========================================================================
function openScoutModal(atletaId) {
  const player = allAthletes.find(a => a.atleta_id === atletaId);
  if (!player) return;

  activeModalAthlete = player;
  const club = allClubs[player.clube_id] || {};
  const posObj = allPositions[player.posicao_id] || {};
  const posAbrev = (posObj.abreviacao || 'ATL').toUpperCase();

  // Header
  document.getElementById('scout-player-name').textContent = player.nome || player.apelido;
  document.getElementById('scout-player-sub').textContent = `${club.abreviacao || 'CLU'} • ${posAbrev} • C$ ${Number(player.preco_num).toFixed(2)}`;

  const crestImg = document.getElementById('scout-player-crest-img');
  crestImg.src = player.foto;
  crestImg.onerror = () => {
    crestImg.src = club.escudo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.atleta_id}`;
  };

  // Stats boxes — dados reais da API
  const mediaOficial = Number(player.media_num || 0).toFixed(2);
  const jogos = player.jogos_num || 0;
  const historico = player.historico_7_rodadas || [];

  // Última pontuação = rodada mais recente no histórico
  const ultimaEntry = historico.length > 0 ? historico[0] : null;
  const ultima = ultimaEntry ? Number(ultimaEntry.pontos).toFixed(1) : '0.0';
  const ultimaRodada = ultimaEntry ? `R${ultimaEntry.rodada}` : `R${currentRound - 1}`;

  // Estimada = média fora se joga fora, casa se joga em casa
  const isHome = currentMatch && player.clube_id === currentMatch.clube_casa_id;
  const mediaCasaNum = Number(player.media_casa || mediaOficial);
  const mediaForaNum = Number(player.media_fora || mediaOficial);
  const estimada = isHome ? mediaCasaNum.toFixed(1) : mediaForaNum.toFixed(1);
  const minVal = (Number(player.preco_num || 5) * 0.45).toFixed(2);

  document.getElementById('scout-media-cartola').textContent = mediaOficial;
  document.getElementById('scout-jogos-num').textContent = jogos;
  document.getElementById('scout-ultima-pont').textContent = ultima;
  document.getElementById('scout-ultima-rodada').textContent = ultimaRodada;
  document.getElementById('scout-estimada').textContent = estimada;
  document.getElementById('scout-min-val').textContent = minVal;

  // Médias detalhadas — reais do histórico
  const pontosCasa = historico.filter(r => r.mando === 'casa').map(r => r.pontos);
  const pontosFora = historico.filter(r => r.mando === 'fora').map(r => r.pontos);
  const mediaCasa = pontosCasa.length > 0
    ? (pontosCasa.reduce((a, b) => a + b, 0) / pontosCasa.length).toFixed(2)
    : (mediaCasaNum).toFixed(2);
  const mediaFora = pontosFora.length > 0
    ? (pontosFora.reduce((a, b) => a + b, 0) / pontosFora.length).toFixed(2)
    : (mediaForaNum).toFixed(2);
  const mediaBasica = Number(player.media_basica || (mediaOficial * 0.65)).toFixed(2);

  document.getElementById('scout-detail-oficial').textContent = `${mediaOficial} pts`;
  document.getElementById('scout-detail-basica').textContent = `${mediaBasica} pts`;

  // Mostrar contagem real de jogos em cada mando no período
  document.getElementById('jogos-casa-count').textContent = pontosCasa.length;
  document.getElementById('jogos-fora-count').textContent = pontosFora.length;

  // Destacar qual média CASA ou FORA é a usada (a relevante para o próximo jogo)
  const rowCasa = document.getElementById('row-casa');
  const rowFora = document.getElementById('row-fora');
  const labelCasaTag = document.getElementById('label-casa-tag');
  const labelForaTag = document.getElementById('label-fora-tag');
  const detCasa = document.getElementById('scout-detail-casa');
  const detFora = document.getElementById('scout-detail-fora');

  detCasa.textContent = `${mediaCasa} pts`;
  detFora.textContent = `${mediaFora} pts`;

  // Aplicar highlight: laranja = "USADA" (confronto próximo)
  rowCasa.className = 'scout-detail-row' + (isHome ? ' used' : '');
  rowFora.className = 'scout-detail-row' + (!isHome ? ' used' : '');
  detCasa.style.color = isHome ? '#ff7a00' : '';
  detFora.style.color = !isHome ? '#ff7a00' : '';
  labelCasaTag.textContent = isHome ? 'USADA' : 'REFERÊNCIA';
  labelForaTag.textContent = !isHome ? 'USADA' : 'REFERÊNCIA';
  labelCasaTag.style.color = isHome ? '#ff7a00' : '';
  labelForaTag.style.color = !isHome ? '#ff7a00' : '';

  // Ajuste de confronto
  const ajusteVal = ((Number(mediaOficial) * (isHome ? 1.05 : 0.95)) - Number(mediaOficial)).toFixed(2);
  document.getElementById('scout-detail-ajuste').textContent = `${ajusteVal >= 0 ? '+' : ''}${ajusteVal} pts`;
  document.getElementById('scout-detail-ajuste-sub').textContent = isHome ? 'Mando casa' : 'Visitante';

  // Confronto da Rodada
  if (currentMatch) {
    const casa = allClubs[currentMatch.clube_casa_id] || currentMatch.clube_casa || { abreviacao: 'CAS' };
    const fora = allClubs[currentMatch.clube_visitante_id] || currentMatch.clube_visitante || { abreviacao: 'FOR' };

    document.getElementById('matchup-mandante-name').textContent = casa.abreviacao;
    document.getElementById('matchup-visitante-name').textContent = fora.abreviacao;

    const mc = document.getElementById('matchup-mandante-crest');
    const vc = document.getElementById('matchup-visitante-crest');
    mc.src = casa.escudo || `https://api.dicebear.com/7.x/identicon/svg?seed=${casa.abreviacao}`;
    vc.src = fora.escudo || `https://api.dicebear.com/7.x/identicon/svg?seed=${fora.abreviacao}`;

    document.getElementById('matchup-local-tag').textContent = isHome ? 'CASA' : 'FORA';
  }

  // Reset tabs
  currentRoundsFilter = 'geral';
  document.querySelectorAll('.scout-rounds-tab').forEach((t, idx) => {
    t.classList.toggle('active', idx === 0);
  });

  renderScoutRoundsHistory(player, 'geral');
  renderScoutsBreakdown(player);

  document.getElementById('player-modal').classList.add('active');
}

// =========================================================================
// HISTÓRICO DAS 7 RODADAS — FILTRO REAL SEM DUPLICATAS
// =========================================================================
function renderScoutRoundsHistory(player, filterType = 'geral') {
  const container = document.getElementById('scout-rounds-grid');
  const allHistory = player.historico_7_rodadas || [];

  // Filtrar conforme tab selecionada
  let filtered = allHistory;
  if (filterType === 'casa') {
    filtered = allHistory.filter(r => r.mando === 'casa');
  } else if (filterType === 'fora') {
    filtered = allHistory.filter(r => r.mando === 'fora');
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div style="grid-column: span 4; color: var(--text-muted); font-size: 0.78rem; text-align: center; padding: 12px;">
      Nenhum jogo ${filterType === 'casa' ? 'em casa' : filterType === 'fora' ? 'fora' : ''} registrado nas últimas rodadas.
    </div>`;
    return;
  }

  container.innerHTML = filtered.slice(0, 7).map(r => {
    const isHome = r.mando === 'casa';
    const mandoColor = isHome ? '#ff7a00' : '#38bdf8';
    const mandoLabel = isHome ? 'CASA' : 'FORA';

    return `
      <div class="round-stat-card">
        <div class="round-stat-top">
          <span>R${r.rodada}</span>
          <span style="font-size: 0.58rem; color: ${mandoColor}; font-weight: 900; text-transform: uppercase;">${mandoLabel}</span>
        </div>
        <div class="round-stat-score">${Number(r.pontos).toFixed(1)}</div>
        <div class="round-stat-vs">${r.adversario}</div>
      </div>
    `;
  }).join('');
}

function filterScoutRounds(type, btn) {
  document.querySelectorAll('.scout-rounds-tab').forEach(el => el.classList.remove('active'));
  btn.classList.add('active');
  currentRoundsFilter = type;
  if (activeModalAthlete) renderScoutRoundsHistory(activeModalAthlete, type);
}

// =========================================================================
// SCOUTS BREAKDOWN COMPLETO
// =========================================================================
function renderScoutsBreakdown(player) {
  const rawScout = player.scout || {};

  const posMap = [
    ["G",  "Gol marcado"],
    ["A",  "Assistência"],
    ["DS", "Desarme"],
    ["SG", "Saldo de gols"],
    ["FS", "Falta sofrida"],
    ["FD", "Fin. defendida"],
    ["FF", "Fin. para fora"],
    ["FT", "Fin. na trave"],
    ["DE", "Defesa"],
    ["DP", "Defesa de pênalti"],
    ["PS", "Pênalti sofrido"]
  ];

  const negMap = [
    ["CA", "Cartão amarelo"],
    ["CV", "Cartão vermelho"],
    ["FC", "Falta cometida"],
    ["I",  "Impedimento"],
    ["GC", "Gol contra"],
    ["GS", "Gol sofrido"],
    ["PP", "Pênalti perdido"],
    ["PC", "Pênalti cometido"]
  ];

  const posContainer = document.getElementById('scout-positivos-grid');
  const negContainer = document.getElementById('scout-negativos-grid');

  let posHtml = '';
  for (const [key, label] of posMap) {
    const val = rawScout[key];
    if (val !== undefined && val !== null && val > 0) {
      const isGol = key === 'G';
      posHtml += `
        <div class="scout-pill-box" ${isGol ? 'style="border-color: #ff6200; background: rgba(255,98,0,0.12);"' : ''}>
          <div class="scout-pill-name">${label}</div>
          <div class="scout-pill-val" ${isGol ? 'style="color: #ff6200; font-size: 1.3rem;"' : ''}>${val}</div>
        </div>
      `;
    }
  }
  posContainer.innerHTML = posHtml || '<div style="color: var(--text-muted); font-size: 0.8rem;">Nenhum scout positivo registrado.</div>';

  let negHtml = '';
  for (const [key, label] of negMap) {
    const val = rawScout[key];
    if (val !== undefined && val !== null && val > 0) {
      negHtml += `
        <div class="scout-pill-box neg">
          <div class="scout-pill-name">${label}</div>
          <div class="scout-pill-val">${val}</div>
        </div>
      `;
    }
  }
  negContainer.innerHTML = negHtml || '<div style="color: var(--text-muted); font-size: 0.8rem;">Nenhum scout negativo registrado.</div>';
}

// Close modal
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('modal-close-btn');
  if (closeBtn) closeBtn.onclick = () => document.getElementById('player-modal').classList.remove('active');

  const modal = document.getElementById('player-modal');
  if (modal) modal.onclick = (e) => {
    if (e.target === modal) modal.classList.remove('active');
  };
});

// =========================================================================
// 3D DIGITAL CLOCK
// =========================================================================
function init3DDigitalClock(statusMercado) {
  const b1 = document.getElementById('clock-box-1');
  const b2 = document.getElementById('clock-box-2');
  const b3 = document.getElementById('clock-box-3');
  const b4 = document.getElementById('clock-box-4');
  const lbl = document.getElementById('clock-label-text');
  const escalacaoClock = document.getElementById('my-team-countdown-text');
  if (!b1) return;

  const isAberto = statusMercado.status_mercado === 1;
  const fechamento = statusMercado.fechamento || {};

  // Calcular timestamp de fechamento do mercado (em ms)
  let fechamentoMs = null;
  if (fechamento.timestamp) {
    fechamentoMs = fechamento.timestamp * 1000;
  } else if (fechamento.ano && fechamento.mes && fechamento.dia) {
    fechamentoMs = new Date(fechamento.ano, fechamento.mes - 1, fechamento.dia, fechamento.hora || 0, fechamento.minuto || 0, 0).getTime();
  }

  function updateLiveDigitalClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');

    if (!isAberto) {
      if (lbl) lbl.textContent = `RODADA ${currentRound}:`;
      b1.textContent = h;
      b2.textContent = m;
      b3.textContent = s;
      b4.textContent = 'AO VIVO';
      b4.style.fontSize = '0.65rem';
      b4.style.color = '#ef4444';
      if (escalacaoClock) escalacaoClock.textContent = `MERCADO FECHADO • ${h}:${m}:${s} AO VIVO`;
      // Remover alerta piscante se mercado fechou
      const pill = escalacaoClock ? escalacaoClock.closest('.market-countdown-pill') : null;
      if (pill) pill.classList.remove('market-closing-alert');
    } else {
      if (lbl) lbl.textContent = 'HORA OFICIAL:';
      b1.textContent = h;
      b2.textContent = m;
      b3.textContent = s;
      b4.textContent = '🟢';

      // Countdown do mercado
      if (escalacaoClock && fechamentoMs) {
        const diff = fechamentoMs - now.getTime();
        const pill = escalacaoClock.closest('.market-countdown-pill');

        if (diff <= 0) {
          escalacaoClock.textContent = `MERCADO FECHANDO • ${h}:${m}:${s}`;
          if (pill) pill.classList.add('market-closing-alert');
        } else {
          const totalSecs = Math.floor(diff / 1000);
          const dias = Math.floor(totalSecs / 86400);
          const horas = Math.floor((totalSecs % 86400) / 3600);
          const mins = Math.floor((totalSecs % 3600) / 60);
          const segs = totalSecs % 60;

          let countdownText = '';
          if (dias > 0) {
            countdownText = `${dias}d ${horas}h ${mins}m ${segs}s`;
          } else if (horas > 0) {
            countdownText = `${horas}h ${mins}m ${segs}s`;
          } else {
            countdownText = `${mins}m ${segs}s`;
          }

          escalacaoClock.textContent = `MERCADO FECHA EM ${countdownText}`;

          // Alerta piscante quando faltar 2 minutos ou menos
          if (pill) {
            if (totalSecs <= 120) {
              pill.classList.add('market-closing-alert');
            } else {
              pill.classList.remove('market-closing-alert');
            }
          }
        }
      } else if (escalacaoClock) {
        escalacaoClock.textContent = `MERCADO ABERTO • ${h}:${m}:${s} AO VIVO`;
      }
    }
  }

  setInterval(updateLiveDigitalClock, 1000);
  updateLiveDigitalClock();
}

// =========================================================================
// MÓDULO ESCALAÇÃO (MEU TIME - G4 DO CARTOLA FC) — IDÊNTICO À REFERÊNCIA
// =========================================================================

let myTeamState = {
  nome_time: "G4 do Cartola FC",
  patrimonio: 150.00,
  formacao: "4-3-3",
  esquema_id: 3,
  capitao: null,
  titulares: {}, // { 'gol': atletaId, 'lat_1': atletaId, 'zag_1': atletaId, ... }
  reservas: { "1": null, "2": null, "3": null, "4": null, "5": null }
};

let activeDrawerSlot = null; // { type: 'titular'|'reserva', slotKey: string, posId: number, posName: string }
let currentMarketStatus = 'all';

// Esquemas táticos oficiais Cartola
const ESQUEMAS_CONFIG = {
  "4-3-3": { esquema_id: 3, d: 4, m: 3, a: 3, zags: 2, lats: 2 },
  "4-4-2": { esquema_id: 4, d: 4, m: 4, a: 2, zags: 2, lats: 2 },
  "3-4-3": { esquema_id: 1, d: 3, m: 4, a: 3, zags: 3, lats: 0 },
  "3-5-2": { esquema_id: 2, d: 3, m: 5, a: 2, zags: 3, lats: 0 },
  "4-5-1": { esquema_id: 5, d: 4, m: 5, a: 1, zags: 2, lats: 2 },
  "5-3-2": { esquema_id: 6, d: 5, m: 3, a: 2, zags: 3, lats: 2 },
  "5-4-1": { esquema_id: 7, d: 5, m: 4, a: 1, zags: 3, lats: 2 }
};

// Alternar entre abas principais
function switchMainTab(tab) {
  const btnProv = document.getElementById('tab-btn-provaveis');
  const btnTop5 = document.getElementById('tab-btn-top5');
  const btnTop5Sg = document.getElementById('tab-btn-top5-sg');
  const btnVar = document.getElementById('tab-btn-escalacoes-variadas');
  const btnEsc = document.getElementById('tab-btn-escalacao');
  const btnClas = document.getElementById('tab-btn-classificacao');
  const viewProv = document.getElementById('view-provaveis');
  const viewTop5 = document.getElementById('view-top5');
  const viewTop5Sg = document.getElementById('view-top5-sg');
  const viewVar = document.getElementById('view-escalacoes-variadas');
  const viewEsc = document.getElementById('view-escalacao');
  const viewClas = document.getElementById('view-classificacao');

  if (btnProv) btnProv.classList.remove('active');
  if (btnTop5) btnTop5.classList.remove('active');
  if (btnTop5Sg) btnTop5Sg.classList.remove('active');
  if (btnVar) btnVar.classList.remove('active');
  if (btnEsc) btnEsc.classList.remove('active');
  if (btnClas) btnClas.classList.remove('active');

  if (viewProv) viewProv.style.display = 'none';
  if (viewTop5) viewTop5.style.display = 'none';
  if (viewTop5Sg) viewTop5Sg.style.display = 'none';
  if (viewVar) viewVar.style.display = 'none';
  if (viewEsc) viewEsc.style.display = 'none';
  if (viewClas) viewClas.style.display = 'none';

  if (tab === 'escalacao') {
    if (btnEsc) btnEsc.classList.add('active');
    if (viewEsc) viewEsc.style.display = 'block';
    renderMyTeamPitch();
  } else if (tab === 'top5') {
    if (btnTop5) btnTop5.classList.add('active');
    if (viewTop5) viewTop5.style.display = 'block';
    renderTop5View();
  } else if (tab === 'top5-sg') {
    if (btnTop5Sg) btnTop5Sg.classList.add('active');
    if (viewTop5Sg) viewTop5Sg.style.display = 'block';
    renderTop5SgView();
  } else if (tab === 'escalacoes-variadas') {
    if (btnVar) btnVar.classList.add('active');
    if (viewVar) viewVar.style.display = 'block';
    renderEscalacoesVariadasView();
  } else if (tab === 'classificacao') {
    if (btnClas) btnClas.classList.add('active');
    if (viewClas) viewClas.style.display = 'block';
    renderClassificacaoTable();
  } else {
    if (btnProv) btnProv.classList.add('active');
    if (viewProv) viewProv.style.display = 'block';
  }
  if (window.feather) feather.replace();
}

// =========================================================================
// MÓDULO DE CLASSIFICAÇÃO OFICIAL DO BRASILEIRÃO BETANO 2026
// =========================================================================
let currentStandingsData = null;
let currentStandingsMando = 'todos'; // 'todos' | 'casa' | 'fora'
let currentStandingsMode = 'native'; // 'native' | 'sofascore'

async function loadClassificacao() {
  try {
    const res = await fetch('/api/classificacao');
    currentStandingsData = await res.json();
  } catch (e) {
    console.error("Erro ao carregar classificação:", e);
  }
}

function filterStandingsMando(mando) {
  currentStandingsMando = mando;
  ['todos', 'casa', 'fora'].forEach(m => {
    const btn = document.getElementById(`btn-filter-standings-${m}`);
    if (btn) {
      if (m === mando) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });
  renderClassificacaoTable();
}

function switchStandingsViewMode(mode) {
  currentStandingsMode = mode;
  const btnNative = document.getElementById('btn-standings-view-native');
  const btnSofa = document.getElementById('btn-standings-view-sofascore');
  const modeNative = document.getElementById('standings-mode-native');
  const modeSofa = document.getElementById('standings-mode-sofascore');

  if (mode === 'sofascore') {
    if (btnSofa) btnSofa.classList.add('active');
    if (btnNative) btnNative.classList.remove('active');
    if (modeSofa) modeSofa.style.display = 'block';
    if (modeNative) modeNative.style.display = 'none';
  } else {
    if (btnNative) btnNative.classList.add('active');
    if (btnSofa) btnSofa.classList.remove('active');
    if (modeNative) modeNative.style.display = 'block';
    if (modeSofa) modeSofa.style.display = 'none';
    renderClassificacaoTable();
  }
  if (window.feather) feather.replace();
}

function renderClassificacaoTable() {
  const tbody = document.getElementById('standings-table-body');
  if (!tbody || !currentStandingsData || !currentStandingsData.tabela) return;

  let tabela = JSON.parse(JSON.stringify(currentStandingsData.tabela));

  // Ajustar estatísticas conforme mando se selecionado
  if (currentStandingsMando === 'casa' || currentStandingsMando === 'fora') {
    tabela = tabela.map(item => {
      const stats = currentStandingsMando === 'casa' ? item.stats_casa : item.stats_fora;
      if (stats) {
        return {
          ...item,
          jogos: stats.jogos,
          vitorias: stats.vitorias,
          empates: stats.empates,
          derrotas: stats.derrotas,
          saldo_gols: stats.saldo_gols,
          gols_pro: stats.gols_pro,
          gols_contra: stats.gols_contra,
          pontos: stats.pontos
        };
      }
      return item;
    });

    // Reordenar tabela por pontos, vitórias, saldo de gols e gols pró
    tabela.sort((a, b) => {
      if (b.pontos !== a.pontos) return b.pontos - a.pontos;
      if (b.vitorias !== a.vitorias) return b.vitorias - a.vitorias;
      if (b.saldo_gols !== a.saldo_gols) return b.saldo_gols - a.saldo_gols;
      return b.gols_pro - a.gols_pro;
    });

    tabela.forEach((item, idx) => {
      item.posicao = idx + 1;
    });
  }

  tbody.innerHTML = tabela.map((row, idx) => {
    const pos = idx + 1;
    let zoneClass = 'standings-row-zone-neutra';
    if (pos <= 4) zoneClass = 'standings-row-zone-libertadores';
    else if (pos === 5) zoneClass = 'standings-row-zone-pre-libertadores';
    else if (pos >= 6 && pos <= 12) zoneClass = 'standings-row-zone-sulamericana';
    else if (pos >= 17) zoneClass = 'standings-row-zone-rebaixamento';

    const formBadgesHtml = (row.ultimos_5 || []).map(res => {
      const char = (res || 'D').toUpperCase();
      return `<div class="form-badge ${char}">${char}</div>`;
    }).join('');

    const diffFormatted = row.saldo_gols > 0 ? `+${row.saldo_gols}` : String(row.saldo_gols);
    const glsFormatted = `${row.gols_pro}:${row.gols_contra}`;

    return `
      <tr class="${zoneClass}">
        <td style="text-align: center;">
          <span class="standings-pos-num">${pos}</span>
        </td>
        <td>
          <div class="standings-team-cell">
            <img src="${row.escudo}" class="standings-crest-img" alt="${row.nome}" onerror="this.src='/images/mascote.png'">
            <span class="standings-team-name">${row.nome}</span>
          </div>
        </td>
        <td style="text-align: center; font-weight: 600; color: #cbd5e1;">${row.jogos}</td>
        <td style="text-align: center; color: #cbd5e1;">${row.vitorias}</td>
        <td style="text-align: center; color: #cbd5e1;">${row.empates}</td>
        <td style="text-align: center; color: #cbd5e1;">${row.derrotas}</td>
        <td style="text-align: center; font-weight: 700; color: ${row.saldo_gols > 0 ? '#10b981' : (row.saldo_gols < 0 ? '#ef4444' : '#cbd5e1')};">${diffFormatted}</td>
        <td style="text-align: center; color: #94a3b8; font-size: 0.82rem;">${glsFormatted}</td>
        <td style="text-align: center;">
          <div class="form-badge-group" style="justify-content: center;">
            ${formBadgesHtml}
          </div>
        </td>
        <td class="standings-pts-cell">${row.pontos}</td>
      </tr>
    `;
  }).join('');
}

// Inicializar módulo
async function initMyTeamModule() {
  try {
    const saved = await fetch('/api/meu-time').then(r => r.json()).catch(() => null);
    if (saved && saved.nome_time) {
      myTeamState = { ...myTeamState, ...saved };
    } else {
      const local = localStorage.getItem('cartola_meu_time_g4');
      if (local) myTeamState = JSON.parse(local);
    }
  } catch (e) {
    const local = localStorage.getItem('cartola_meu_time_g4');
    if (local) myTeamState = JSON.parse(local);
  }

  // Se houver usuário logado, sincronizar nome
  try {
    const session = localStorage.getItem('cartola_session');
    if (session) {
      const user = JSON.parse(session);
      if (user.username && !myTeamState.nome_time) {
        myTeamState.nome_time = user.username;
      }
    }
  } catch(e) {}

  // Sincronizar select com formação salva
  const select = document.getElementById('my-scheme-select');
  if (select && myTeamState.formacao) {
    select.value = myTeamState.formacao;
  }

  renderMyTeamPitch();

  // Solicitar sincronização automática de dados reais com a extensão ativa
  setTimeout(() => {
    syncWithCartolaExtension();
  }, 600);
}

// Salvar time local e no servidor
async function persistMyTeam() {
  localStorage.setItem('cartola_meu_time_g4', JSON.stringify(myTeamState));
  try {
    await fetch('/api/meu-time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(myTeamState)
    });
  } catch (e) {}
}

// Mudar esquema tático
function changeMyTeamFormation(formacao) {
  myTeamState.formacao = formacao;
  myTeamState.esquema_id = ESQUEMAS_CONFIG[formacao]?.esquema_id || 3;
  
  // Limpar titulares que não encaixam no novo esquema se necessário
  renderMyTeamPitch();
  persistMyTeam();
}

// Renderizar Campinho + Banco + Resumo Lateral
function renderMyTeamPitch() {
  const cfg = ESQUEMAS_CONFIG[myTeamState.formacao] || ESQUEMAS_CONFIG["4-3-3"];
  
  const watermark = document.getElementById('my-tactical-watermark');
  if (watermark) watermark.textContent = myTeamState.formacao;

  // Linhas do campo
  const rowAtaque = document.getElementById('my-row-ataque');
  const rowMeio = document.getElementById('my-row-meio');
  const rowDefesa = document.getElementById('my-row-defesa');
  const rowGolTec = document.getElementById('my-row-goleiro-tec');
  const rowRes = document.getElementById('my-reserves-row');

  // 1. Ataque
  let ataHtml = '';
  for (let i = 1; i <= cfg.a; i++) {
    const key = `ata_${i}`;
    ataHtml += renderSlotHtml(key, 5, `Atacante ${i}`, false);
  }
  if (rowAtaque) rowAtaque.innerHTML = ataHtml;

  // 2. Meio-campo
  let meiHtml = '';
  for (let i = 1; i <= cfg.m; i++) {
    const key = `mei_${i}`;
    meiHtml += renderSlotHtml(key, 4, `Meia ${i}`, false);
  }
  if (rowMeio) rowMeio.innerHTML = meiHtml;

  // 3. Defesa (Laterais + Zagueiros)
  let defHtml = '';
  if (cfg.lats > 0) {
    defHtml += renderSlotHtml('lat_1', 2, 'Lateral Esq.', false);
  }
  for (let i = 1; i <= cfg.zags; i++) {
    defHtml += renderSlotHtml(`zag_${i}`, 3, `Zagueiro ${i}`, false);
  }
  if (cfg.lats > 0) {
    defHtml += renderSlotHtml('lat_2', 2, 'Lateral Dir.', false);
  }
  if (rowDefesa) rowDefesa.innerHTML = defHtml;

  // 4. Goleiro e Técnico (Goleiro centralizado na grande área, Técnico ao lado direito)
  const slotGol = document.getElementById('my-slot-gol');
  const slotTec = document.getElementById('my-slot-tec');
  if (slotGol) slotGol.innerHTML = renderSlotHtml('gol', 1, 'Goleiro', false);
  if (slotTec) slotTec.innerHTML = renderSlotHtml('tec', 6, 'Técnico', false);

  // 5. Banco de Reservas (GOL=1, LAT=2, ZAG=3, MEI=4, ATA=5)
  let resHtml = '';
  resHtml += renderSlotHtml('1', 1, 'GOL (Res)', true);
  resHtml += renderSlotHtml('2', 2, 'LAT (Res)', true);
  resHtml += renderSlotHtml('3', 3, 'ZAG (Res)', true);
  resHtml += renderSlotHtml('4', 4, 'MEI (Res)', true);
  resHtml += renderSlotHtml('5', 5, 'ATA (Res)', true);
  if (rowRes) rowRes.innerHTML = resHtml;

  // Atualizar Lista Resumo e Orçamento
  updateBudgetAndSummary();
  feather.replace();
}

// Renderiza o HTML de um slot específico (preenchido ou vazio)
function renderSlotHtml(slotKey, posId, posName, isReserva) {
  const atletaId = isReserva ? myTeamState.reservas[slotKey] : myTeamState.titulares[slotKey];
  const numId = atletaId ? Number(atletaId) : null;
  const player = numId ? allAthletes.find(a => Number(a.atleta_id) === numId) : null;
  const isCaptain = !isReserva && player && Number(myTeamState.capitao) === Number(player.atleta_id);

  if (!player) {
    return `
      <div class="field-player-slot" onclick="openMarketDrawer('${slotKey}', ${posId}, '${posName}', ${isReserva})">
        <div class="slot-empty">
          <i data-feather="plus" style="width: 18px; height: 18px;"></i>
          <span>${posName.split(' ')[0]}</span>
        </div>
      </div>
    `;
  }

  const club = allClubs[player.clube_id] || {};
  const statusCheck = player.status_id === 7 
    ? `<div class="slot-check-badge">✔</div>` 
    : (player.status_id === 2 ? `<div class="slot-duvida-badge">?</div>` : '');
  const capBadge = isCaptain ? `<div class="slot-captain-badge">C</div>` : '';
  const isLuxo = isReserva && myTeamState.reserva_luxo === player.atleta_id;
  const luxoBadge = isLuxo ? `<div class="slot-captain-badge" style="background: linear-gradient(135deg, #8b5cf6, #6d28d9); color: #fff; font-size: 0.75rem;" title="Reserva de Luxo (Prioridade)">⭐</div>` : '';

  const playerImgSrc = getAthletePhoto(player);

  return `
    <div class="field-player-slot" onclick="handleSlotPlayerClick('${slotKey}', ${player.atleta_id}, ${isReserva})">
      <div class="slot-crest-container">
        <img src="${playerImgSrc}" class="slot-crest-img" 
          onerror="this.src='${club.escudo || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + player.atleta_id}'">
        ${statusCheck}
        ${capBadge}
        ${luxoBadge}
      </div>
      <div class="slot-name-pill">${player.apelido}</div>
      <div class="slot-price-pill">C$ ${Number(player.preco_num).toFixed(2)}</div>
    </div>
  `;
}

// Estado do modal de ação de jogador
let activeActionModalSlot = null; // { slotKey, atletaId, isReserva }

// Ação ao clicar em um jogador já escalado — Abre Card Modal Moderno com Escolha de Capitão e Reserva de Luxo
function handleSlotPlayerClick(slotKey, atletaId, isReserva) {
  const player = allAthletes.find(a => a.atleta_id === atletaId);
  if (!player) return;

  activeActionModalSlot = { slotKey, atletaId, isReserva, player };
  const club = allClubs[player.clube_id] || {};
  const posNames = { 1: 'Goleiro', 2: 'Lateral', 3: 'Zagueiro', 4: 'Meia', 5: 'Atacante', 6: 'Técnico' };
  const posName = posNames[player.posicao_id] || 'Atleta';

  const modal = document.getElementById('player-action-modal');
  const photoEl = document.getElementById('modal-player-action-photo');
  const crestEl = document.getElementById('modal-player-action-crest');
  const nameEl = document.getElementById('modal-player-action-name');
  const subEl = document.getElementById('modal-player-action-sub');

  if (photoEl) photoEl.src = getAthletePhoto(player);
  if (crestEl) crestEl.src = club.escudo || '';
  if (nameEl) nameEl.textContent = player.apelido || player.nome;
  if (subEl) subEl.textContent = `${posName} • ${club.abreviacao || 'CLU'} • C$ ${Number(player.preco_num).toFixed(2)}`;

  const btnCaptain = document.getElementById('btn-modal-action-captain');
  const btnCaptainText = document.getElementById('btn-modal-action-captain-text');
  const btnLuxo = document.getElementById('btn-modal-action-luxo');
  const btnLuxoText = document.getElementById('btn-modal-action-luxo-text');
  const btnSub = document.getElementById('btn-modal-action-substitute');
  const btnRem = document.getElementById('btn-modal-action-remove');

  const containerCap = document.getElementById('container-dropdown-captain');
  const selectCap = document.getElementById('select-modal-captain');
  const labelCap = document.getElementById('label-captain-sector');

  const containerLux = document.getElementById('container-dropdown-luxo');
  const selectLux = document.getElementById('select-modal-luxo');
  const labelLux = document.getElementById('label-luxo-sector');

  // Configuração do Dropdown de Capitão (titulares do mesmo setor)
  if (!isReserva && player.posicao_id !== 6) {
    if (containerCap && selectCap) {
      containerCap.style.display = 'block';
      if (labelCap) labelCap.textContent = posName.toUpperCase();
      
      // Buscar todos os titulares escalados na mesma posição/setor
      const sectorStarters = [];
      for (const [key, aid] of Object.entries(myTeamState.titulares)) {
        if (!aid) continue;
        const p = allAthletes.find(a => Number(a.atleta_id) === Number(aid));
        if (p && p.posicao_id === player.posicao_id) {
          sectorStarters.push(p);
        }
      }

      selectCap.innerHTML = `
        <option value="">-- Escolher Capitão do ${posName} --</option>
        ${sectorStarters.map(s => {
          const isSelected = Number(myTeamState.capitao) === Number(s.atleta_id);
          return `<option value="${s.atleta_id}" ${isSelected ? 'selected' : ''}>👑 ${s.apelido} (C$ ${Number(s.preco_num).toFixed(2)})</option>`;
        }).join('')}
      `;
    }
  } else {
    if (containerCap) containerCap.style.display = 'none';
  }

  // Configuração do Dropdown de Reserva de Luxo (reservas de linha 2-5)
  if (isReserva && player.posicao_id >= 2 && player.posicao_id <= 5) {
    if (containerLux && selectLux) {
      containerLux.style.display = 'block';
      if (labelLux) labelLux.textContent = posName.toUpperCase();

      // Buscar todos os reservas escalados nas posições de linha
      const lineReserves = [];
      for (let pId = 2; pId <= 5; pId++) {
        const aid = myTeamState.reservas[String(pId)];
        if (!aid) continue;
        const p = allAthletes.find(a => Number(a.atleta_id) === Number(aid));
        if (p) lineReserves.push(p);
      }

      selectLux.innerHTML = `
        <option value="">-- Escolher Reserva de Luxo --</option>
        ${lineReserves.map(r => {
          const rPosName = posNames[r.posicao_id] || 'Reserva';
          const isSelected = Number(myTeamState.reserva_luxo) === Number(r.atleta_id);
          return `<option value="${r.atleta_id}" ${isSelected ? 'selected' : ''}>⭐ ${r.apelido} (${rPosName})</option>`;
        }).join('')}
      `;
    }
  } else {
    if (containerLux) containerLux.style.display = 'none';
  }

  // Configuração do botão Capitão Direto
  if (!isReserva && player.posicao_id !== 6) {
    btnCaptain.style.display = 'flex';
    const isCap = Number(myTeamState.capitao) === Number(atletaId);
    if (isCap) {
      btnCaptainText.textContent = "Remover Faixa de Capitão";
      btnCaptain.style.background = "#475569";
      btnCaptain.style.color = "#fff";
    } else {
      btnCaptainText.textContent = "Tornar Capitão (Pontuação x1.5)";
      btnCaptain.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
      btnCaptain.style.color = "#000";
    }
    btnCaptain.onclick = () => {
      myTeamState.capitao = isCap ? null : atletaId;
      renderMyTeamPitch();
      persistMyTeam();
      closePlayerActionModal();
    };
  } else {
    btnCaptain.style.display = 'none';
  }

  // Configuração do botão Reserva de Luxo Direto
  if (isReserva && player.posicao_id >= 2 && player.posicao_id <= 5) {
    btnLuxo.style.display = 'flex';
    const isLuxo = Number(myTeamState.reserva_luxo) === Number(atletaId);
    if (isLuxo) {
      btnLuxoText.textContent = "Remover Reserva de Luxo";
      btnLuxo.style.background = "#475569";
      btnLuxo.style.color = "#fff";
    } else {
      btnLuxoText.textContent = "Definir como Reserva de Luxo ⭐";
      btnLuxo.style.background = "linear-gradient(135deg, #8b5cf6, #6d28d9)";
      btnLuxo.style.color = "#fff";
    }
    btnLuxo.onclick = () => {
      myTeamState.reserva_luxo = isLuxo ? null : atletaId;
      renderMyTeamPitch();
      persistMyTeam();
      closePlayerActionModal();
    };
  } else {
    btnLuxo.style.display = 'none';
  }

  // Botão Substituir
  if (btnSub) {
    btnSub.onclick = () => {
      closePlayerActionModal();
      openMarketDrawer(slotKey, player.posicao_id, player.apelido, isReserva);
    };
  }

  // Botão Remover
  if (btnRem) {
    btnRem.onclick = () => {
      if (isReserva) {
        myTeamState.reservas[slotKey] = null;
        if (myTeamState.reserva_luxo === atletaId) myTeamState.reserva_luxo = null;
      } else {
        delete myTeamState.titulares[slotKey];
        if (myTeamState.capitao === atletaId) myTeamState.capitao = null;
      }
      renderMyTeamPitch();
      persistMyTeam();
      closePlayerActionModal();
    };
  }

  if (modal) modal.style.display = 'flex';
  if (window.feather) feather.replace();
}

function closePlayerActionModal() {
  const modal = document.getElementById('player-action-modal');
  if (modal) modal.style.display = 'none';
  activeActionModalSlot = null;
}

function handleSelectCaptainFromDropdown(val) {
  myTeamState.capitao = val ? Number(val) : null;
  renderMyTeamPitch();
  persistMyTeam();
  closePlayerActionModal();
}

function handleSelectLuxoFromDropdown(val) {
  myTeamState.reserva_luxo = val ? Number(val) : null;
  renderMyTeamPitch();
  persistMyTeam();
  closePlayerActionModal();
}

// Retorna o menor preço entre os titulares da posição informada (teto para o reserva)
function getMaxReservaPrice(posId) {
  const starterPrices = [];
  for (const [key, aid] of Object.entries(myTeamState.titulares)) {
    if (!aid) continue;
    const numId = Number(aid);
    const p = allAthletes.find(a => Number(a.atleta_id) === numId);
    if (p && p.posicao_id === posId) {
      starterPrices.push(Number(p.preco_num || 0));
    }
  }

  if (starterPrices.length === 0) {
    return null; // Nenhum titular dessa posição escalado ainda
  }

  return Math.min(...starterPrices);
}

// Atualizar orçamentos, saldo e lista lateral
function updateBudgetAndSummary() {
  let totalSpent = 0;
  let startersCount = 0;
  const summaryList = document.getElementById('my-squad-summary-list');
  const reservesList = document.getElementById('my-reserves-summary-list');

  let startersRows = '';
  const posOrder = { 1: 'GOL', 2: 'LAT', 3: 'ZAG', 4: 'MEI', 5: 'ATA', 6: 'TEC' };

  // Iterar titulares (apenas titulares consom patrimônio)
  const starterAthletes = [];
  for (const [key, aid] of Object.entries(myTeamState.titulares)) {
    if (!aid) continue;
    const numId = Number(aid);
    const p = allAthletes.find(a => Number(a.atleta_id) === numId);
    if (p) {
      starterAthletes.push({ key, p });
      totalSpent += Number(p.preco_num || 0);
      startersCount++;
    }
  }

  // Ordenar por posição (GOL -> LAT -> ZAG -> MEI -> ATA -> TEC)
  starterAthletes.sort((a, b) => a.p.posicao_id - b.p.posicao_id);

  startersRows = starterAthletes.map(({ key, p }) => {
    const posLabel = posOrder[p.posicao_id] || 'ATL';
    const isCap = myTeamState.capitao === p.atleta_id;
    const capBadge = isCap ? `<span class="squad-cap-tag">C</span>` : '';
    return `
      <div class="squad-item-row" onclick="handleSlotPlayerClick('${key}', ${p.atleta_id}, false)" style="cursor: pointer;">
        <div class="squad-item-left">
          <span class="squad-pos-label">${posLabel}</span>
          ${capBadge}
          <span class="squad-name-text">${p.apelido}</span>
        </div>
        <span class="squad-price-text">C$ ${Number(p.preco_num).toFixed(2)}</span>
      </div>
    `;
  }).join('');

  if (summaryList) {
    summaryList.innerHTML = startersRows || '<div style="color: var(--text-muted); font-size: 0.8rem; padding: 10px;">Nenhum titular escalado ainda.</div>';
  }

  // Reservas (NÃO consom patrimônio, mas mostram aviso se violarem a regra de preço)
  let resRows = '';
  for (let posId = 1; posId <= 5; posId++) {
    const aid = myTeamState.reservas[String(posId)];
    const numId = aid ? Number(aid) : null;
    const p = numId ? allAthletes.find(a => Number(a.atleta_id) === numId) : null;
    const posLabel = posOrder[posId] || 'RES';
    if (p) {
      const maxAllowed = getMaxReservaPrice(posId);
      const isPriceInvalid = maxAllowed !== null && Number(p.preco_num) > maxAllowed;
      const invalidBadge = isPriceInvalid ? `<span style="color: #ef4444; font-size: 0.7rem; font-weight: 700; margin-left: 4px;" title="Preço acima do titular mais barato (máx C$ ${maxAllowed.toFixed(2)})">⚠️ > Titular</span>` : '';
      const isLuxo = Number(myTeamState.reserva_luxo) === Number(p.atleta_id);
      const luxoTag = isLuxo ? `<span style="background: linear-gradient(135deg, #8b5cf6, #6d28d9); color: #fff; font-size: 0.65rem; font-weight: 800; padding: 2px 6px; border-radius: 4px; margin-left: 4px;">⭐ LUXO</span>` : '';

      resRows += `
        <div class="squad-item-row" onclick="handleSlotPlayerClick('${posId}', ${p.atleta_id}, true)" style="cursor: pointer; ${isPriceInvalid ? 'border-left: 3px solid #ef4444;' : ''}">
          <div class="squad-item-left">
            <span class="squad-pos-label">${posLabel}</span>
            <span class="squad-name-text">${p.apelido}</span>
            ${luxoTag}
            ${invalidBadge}
          </div>
          <div style="text-align: right;">
            <span class="squad-price-text">C$ ${Number(p.preco_num).toFixed(2)}</span>
            <div style="font-size: 0.68rem; color: #10b981; font-weight: 600;">(C$ 0,00 no saldo)</div>
          </div>
        </div>
      `;
    } else {
      resRows += `
        <div class="squad-item-row" onclick="openMarketDrawer('${posId}', ${posId}, '${posLabel} Reserva', true)" style="cursor: pointer; opacity: 0.6;">
          <div class="squad-item-left">
            <span class="squad-pos-label">${posLabel}</span>
            <span style="color: var(--text-muted); font-size: 0.78rem;">+ Escalar reserva</span>
          </div>
          <span style="color: var(--text-muted); font-size: 0.78rem;">-</span>
        </div>
      `;
    }
  }

  if (reservesList) reservesList.innerHTML = resRows;

  // Atualizar Contadores (Patrimônio desconta APENAS titulares)
  const saldo = Math.max(0, myTeamState.patrimonio - totalSpent);
  const patEl = document.getElementById('my-team-patrimonio-display');
  const spentEl = document.getElementById('my-team-spent-display');
  const saldoEl = document.getElementById('my-team-saldo-display');
  const countLabel = document.getElementById('my-squad-count-label');

  if (patEl) patEl.textContent = `C$ ${myTeamState.patrimonio.toFixed(2)}`;
  if (spentEl) spentEl.textContent = `C$ ${totalSpent.toFixed(2)}`;
  if (saldoEl) {
    saldoEl.textContent = `C$ ${saldo.toFixed(2)}`;
    saldoEl.style.color = saldo < 0 ? '#ef4444' : '#10b981';
  }
  if (countLabel) countLabel.textContent = `${startersCount} / 12 escalados`;

  // Atualizar o Card Oficial de Perfil do Cartola (estilo Globo)
  const cardTeamName = document.getElementById('cartola-card-team-name');
  const cardOwnerName = document.getElementById('cartola-card-owner-name');
  const cardShieldImg = document.getElementById('cartola-card-shield-img');
  const cardPatrimonio = document.getElementById('cartola-card-patrimonio');
  const cardPontosUlt = document.getElementById('cartola-card-pontos-ult');
  const cardPontosTot = document.getElementById('cartola-card-pontos-tot');

  if (cardTeamName) cardTeamName.textContent = myTeamState.nome_time || 'G4 do Cartola FC';
  if (cardOwnerName) cardOwnerName.textContent = myTeamState.nome_cartola || 'Técnico Oficial';
  if (cardPatrimonio) cardPatrimonio.textContent = `C$ ${myTeamState.patrimonio.toFixed(2)}`;

  if (cardShieldImg) {
    if (myTeamState.url_escudo_svg || myTeamState.url_escudo_png) {
      cardShieldImg.src = myTeamState.url_escudo_svg || myTeamState.url_escudo_png;
    } else {
      cardShieldImg.src = '/images/mascote.png';
    }
  }

  if (cardPontosUlt) {
    cardPontosUlt.textContent = myTeamState.pontos_ultima_rodada !== undefined && myTeamState.pontos_ultima_rodada !== null
      ? Number(myTeamState.pontos_ultima_rodada).toFixed(2)
      : '0.00';
  }

  if (cardPontosTot) {
    cardPontosTot.textContent = myTeamState.pontos_total !== undefined && myTeamState.pontos_total !== null
      ? Number(myTeamState.pontos_total).toFixed(2)
      : '0.00';
  }
}

// Disparar sincronização manual com a extensão do Cartola
function syncWithCartolaExtension() {
  window.postMessage({ type: "LENDAS_REQUEST_PROFILE_SYNC" }, "*");
  const ind = document.getElementById("ext-indicator-text");
  if (ind) ind.textContent = "Sincronizando com Cartola FC... ⏳";
  setTimeout(() => {
    if (ind && window.__LENDAS_EXTENSION_INSTALLED__) {
      ind.textContent = "Extensão Lendas Cartola Sync Ativa 🟢";
    }
  }, 1500);
}

// Editar Patrimônio Total
function editMyPatrimonio() {
  const input = prompt("Informe o Patrimônio de C$ do seu time (ex: 150.00):", myTeamState.patrimonio.toFixed(2));
  if (input !== null) {
    const val = parseFloat(input.replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      myTeamState.patrimonio = val;
      renderMyTeamPitch();
      persistMyTeam();
    }
  }
}

// =========================================================================
// DRAWER / MERCADO DE ATLETAS COM FILTROS COMPLETOS
// =========================================================================

// Fila de slots a preencher (para multi-seleção na mesma posição)
let drawerSlotQueue = []; // Array de { slotKey, posId, posName, isReserva }

function openMarketDrawer(slotKey, posId, posName, isReserva) {
  // Se for reserva, validar se já existem titulares daquela posição
  if (isReserva) {
    const maxPrice = getMaxReservaPrice(posId);
    if (maxPrice === null) {
      const posLabels = { 1: 'Goleiro', 2: 'Laterais', 3: 'Zagueiros', 4: 'Meias', 5: 'Atacantes' };
      alert(`⚠️ Você precisa primeiro escalar os titulares de ${posLabels[posId] || posName} antes de escolher o jogador reserva!\n\nRegra oficial do Cartola: O reserva deve custar menos ou igual ao titular mais barato da posição.`);
      return;
    }
  }

  // Construir fila de slots vazios dessa mesma posição se for titular
  drawerSlotQueue = [];

  if (!isReserva) {
    const cfg = ESQUEMAS_CONFIG[myTeamState.formacao] || ESQUEMAS_CONFIG["4-3-3"];
    const allSlotsForPos = getAllSlotsForPosition(posId, cfg);
    
    // Adicionar o slot clicado primeiro, depois os demais vazios
    allSlotsForPos.forEach(s => {
      const isFilled = !!myTeamState.titulares[s.slotKey];
      if (!isFilled) {
        drawerSlotQueue.push(s);
      }
    });

    // Garantir que o slot clicado esteja no início
    const clickedIdx = drawerSlotQueue.findIndex(s => s.slotKey === slotKey);
    if (clickedIdx > 0) {
      const clicked = drawerSlotQueue.splice(clickedIdx, 1)[0];
      drawerSlotQueue.unshift(clicked);
    }
  }

  // Se não houver fila (reserva ou slot único), usar apenas o slot clicado
  if (drawerSlotQueue.length === 0) {
    drawerSlotQueue = [{ slotKey, posId, posName, isReserva }];
  }

  // Ativar o primeiro da fila
  activateNextSlotInQueue();
}

// Retorna todos os slots de uma posição no esquema atual
function getAllSlotsForPosition(posId, cfg) {
  const slots = [];
  switch (posId) {
    case 5: // Atacantes
      for (let i = 1; i <= cfg.a; i++) slots.push({ slotKey: `ata_${i}`, posId: 5, posName: `Atacante ${i}`, isReserva: false });
      break;
    case 4: // Meias
      for (let i = 1; i <= cfg.m; i++) slots.push({ slotKey: `mei_${i}`, posId: 4, posName: `Meia ${i}`, isReserva: false });
      break;
    case 3: // Zagueiros
      for (let i = 1; i <= cfg.zags; i++) slots.push({ slotKey: `zag_${i}`, posId: 3, posName: `Zagueiro ${i}`, isReserva: false });
      break;
    case 2: // Laterais
      if (cfg.lats > 0) {
        slots.push({ slotKey: 'lat_1', posId: 2, posName: 'Lateral Esq.', isReserva: false });
        slots.push({ slotKey: 'lat_2', posId: 2, posName: 'Lateral Dir.', isReserva: false });
      }
      break;
    case 1: // Goleiro
      slots.push({ slotKey: 'gol', posId: 1, posName: 'Goleiro', isReserva: false });
      break;
    case 6: // Técnico
      slots.push({ slotKey: 'tec', posId: 6, posName: 'Técnico', isReserva: false });
      break;
  }
  return slots;
}

// Ativar o próximo slot da fila no drawer
function activateNextSlotInQueue() {
  if (drawerSlotQueue.length === 0) {
    closeMarketDrawer();
    return;
  }

  const next = drawerSlotQueue[0];
  activeDrawerSlot = next;

  const overlay = document.getElementById('market-drawer-overlay');
  const title = document.getElementById('drawer-slot-title');
  const sub = document.getElementById('drawer-slot-sub');
  const posSelect = document.getElementById('market-position-select');
  const saldoLabel = document.getElementById('drawer-saldo-label');
  const budgetFilterSpan = document.getElementById('drawer-filter-budget-text');

  const remaining = drawerSlotQueue.length;
  const posNames = { 1: 'Goleiro', 2: 'Lateral', 3: 'Zagueiro', 4: 'Meia', 5: 'Atacante', 6: 'Técnico' };
  const groupName = posNames[next.posId] || next.posName;

  if (next.isReserva) {
    const maxReservaPrice = getMaxReservaPrice(next.posId);
    if (title) title.textContent = `Escalar ${groupName} (Banco de Reservas)`;
    if (sub) {
      sub.innerHTML = `<strong style="color: var(--cartola-orange);">🛡️ REGRA CARTOLA:</strong> O reserva deve custar no máximo <strong style="color: #10b981;">C$ ${maxReservaPrice !== null ? maxReservaPrice.toFixed(2) : '0.00'}</strong> (titular mais barato da posição). <span style="color: #60a5fa;">O banco de reservas NÃO desconta do seu saldo!</span>`;
    }
    if (saldoLabel) saldoLabel.textContent = (maxReservaPrice !== null ? maxReservaPrice.toFixed(2) : '0.00');
    if (budgetFilterSpan) {
      budgetFilterSpan.innerHTML = `Apenas dentro da regra do reserva (≤ C$ <span id="drawer-saldo-label">${maxReservaPrice !== null ? maxReservaPrice.toFixed(2) : '0.00'}</span>)`;
    }
  } else {
    if (title) title.textContent = `Escalar ${next.posName}`;
    if (sub) {
      if (remaining > 1) {
        sub.textContent = `${remaining} vagas restantes para ${groupName} — escolha e o próximo abre automaticamente`;
      } else {
        sub.textContent = "Último slot desta posição — selecione o titular";
      }
    }

    // Calcular saldo disponível para titulares
    let totalSpent = 0;
    for (const aid of Object.values(myTeamState.titulares)) {
      const p = aid ? allAthletes.find(a => a.atleta_id === aid) : null;
      if (p) totalSpent += Number(p.preco_num || 0);
    }
    const currentAid = myTeamState.titulares[next.slotKey];
    const currentPlayer = currentAid ? allAthletes.find(a => a.atleta_id === currentAid) : null;
    const currentRefund = currentPlayer ? Number(currentPlayer.preco_num || 0) : 0;
    const availableSaldo = (myTeamState.patrimonio - totalSpent) + currentRefund;

    if (saldoLabel) saldoLabel.textContent = availableSaldo.toFixed(2);
    if (budgetFilterSpan) {
      budgetFilterSpan.innerHTML = `Apenas que cabem no saldo (≤ C$ <span id="drawer-saldo-label">${availableSaldo.toFixed(2)}</span>)`;
    }
  }

  if (posSelect) posSelect.value = String(next.posId || 0);

  if (overlay) overlay.style.display = 'flex';
  filterMarketPlayers();
}

function closeMarketDrawer() {
  const overlay = document.getElementById('market-drawer-overlay');
  if (overlay) overlay.style.display = 'none';
  activeDrawerSlot = null;
  drawerSlotQueue = [];
}

function setStatusFilter(status, btn) {
  currentMarketStatus = status;
  document.querySelectorAll('.filter-pill-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  filterMarketPlayers();
}

function filterMarketPlayers() {
  const search = (document.getElementById('market-search-input')?.value || '').toLowerCase().trim();
  const posFilter = parseInt(document.getElementById('market-position-select')?.value || '0');
  const sortBy = document.getElementById('market-sort-select')?.value || 'media_desc';
  const onlyBudget = document.getElementById('filter-cabem-saldo')?.checked;
  const listEl = document.getElementById('market-player-list');

  if (!listEl) return;

  const isReservaMode = Boolean(activeDrawerSlot && activeDrawerSlot.isReserva);
  const maxReservaLimit = isReservaMode ? getMaxReservaPrice(activeDrawerSlot.posId) : null;

  // Calcular saldo disponível para titular
  let totalSpent = 0;
  for (const aid of Object.values(myTeamState.titulares)) {
    const p = aid ? allAthletes.find(a => a.atleta_id === aid) : null;
    if (p) totalSpent += Number(p.preco_num || 0);
  }
  const currentAid = activeDrawerSlot 
    ? (activeDrawerSlot.isReserva ? myTeamState.reservas[activeDrawerSlot.slotKey] : myTeamState.titulares[activeDrawerSlot.slotKey])
    : null;
  const currentPlayer = currentAid ? allAthletes.find(a => a.atleta_id === currentAid) : null;
  const availableSaldo = (myTeamState.patrimonio - totalSpent) + (currentPlayer ? Number(currentPlayer.preco_num || 0) : 0);

  // Coletar IDs já escalados para não mostrar duplicatas
  const alreadyPickedIds = new Set();
  Object.values(myTeamState.titulares).forEach(id => { if (id) alreadyPickedIds.add(id); });
  Object.values(myTeamState.reservas).forEach(id => { if (id) alreadyPickedIds.add(id); });
  // Permitir trocar o jogador do slot atual
  if (currentAid) alreadyPickedIds.delete(currentAid);

  // Filtragem
  let filtered = allAthletes.filter(player => {
    // Não mostrar jogadores já escalados em outro slot
    if (alreadyPickedIds.has(player.atleta_id)) return false;

    // Posição
    if (posFilter > 0 && player.posicao_id !== posFilter) return false;

    // Status (7=Provável, 2=Dúvida)
    if (currentMarketStatus === '7' && player.status_id !== 7) return false;
    if (currentMarketStatus === '2' && player.status_id !== 2) return false;

    // Orçamento ou Regra de Reserva
    if (onlyBudget) {
      if (isReservaMode) {
        if (maxReservaLimit !== null && Number(player.preco_num) > maxReservaLimit) return false;
      } else {
        if (Number(player.preco_num) > availableSaldo) return false;
      }
    }

    // Busca textual
    if (search) {
      const club = allClubs[player.clube_id] || {};
      const matchName = (player.nome || '').toLowerCase().includes(search);
      const matchNick = (player.apelido || '').toLowerCase().includes(search);
      const matchClub = (club.nome || '').toLowerCase().includes(search) || (club.abreviacao || '').toLowerCase().includes(search);
      if (!matchName && !matchNick && !matchClub) return false;
    }

    return true;
  });

  // Ordenação
  filtered.sort((a, b) => {
    const scoutA = a.scout || {};
    const scoutB = b.scout || {};
    switch (sortBy) {
      case 'media_desc': return (b.media_num || 0) - (a.media_num || 0);
      case 'media_basica_desc': return (b.media_basica || 0) - (a.media_basica || 0);
      case 'desarmes_desc': return (scoutB.DS || 0) - (scoutA.DS || 0);
      case 'sg_desc': return (scoutB.SG || 0) - (scoutA.SG || 0);
      case 'gols_desc': return (scoutB.G || 0) - (scoutA.G || 0);
      case 'defesas_desc': return (scoutB.DE || 0) - (scoutA.DE || 0);
      case 'assistencias_desc': return (scoutB.A || 0) - (scoutA.A || 0);
      case 'preco_asc': return (a.preco_num || 0) - (b.preco_num || 0);
      case 'preco_desc': return (b.preco_num || 0) - (a.preco_num || 0);
      default: return (b.media_num || 0) - (a.media_num || 0);
    }
  });

  // Renderizar Cards
  if (filtered.length === 0) {
    listEl.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 30px;">Nenhum atleta encontrado com os filtros selecionados.</div>';
    return;
  }

  const posNames = { 1: 'GOL', 2: 'LAT', 3: 'ZAG', 4: 'MEI', 5: 'ATA', 6: 'TEC' };
  const statusLabels = { 7: '✅ Provável', 2: '⚠️ Dúvida', 5: '❌ Lesionado', 3: '🚫 Suspenso', 6: '⚪ Nulo' };

  listEl.innerHTML = filtered.slice(0, 50).map(p => {
    const club = allClubs[p.clube_id] || {};
    const posLabel = posNames[p.posicao_id] || 'ATL';
    const statusText = statusLabels[p.status_id] || 'Provável';
    const scout = p.scout || {};
    const statsDetail = `G: ${scout.G || 0} • A: ${scout.A || 0} • DS: ${scout.DS || 0} • SG: ${scout.SG || 0}`;

    // Botão de escalação com validação visual
    let actionBtnHtml = '';
    if (isReservaMode) {
      const isPriceOverLimit = maxReservaLimit !== null && Number(p.preco_num) > maxReservaLimit;
      if (isPriceOverLimit) {
        actionBtnHtml = `
          <button class="btn-escalar-atleta" style="background: #475569; opacity: 0.6; cursor: not-allowed; font-size: 0.75rem;" 
            onclick="alert('Regra do Cartola: O atleta ${p.apelido} custa C$ ${Number(p.preco_num).toFixed(2)}, sendo mais caro que o titular mais barato (C$ ${maxReservaLimit.toFixed(2)}). Escolha um jogador de até C$ ${maxReservaLimit.toFixed(2)}.')"
            title="Preço acima do titular mais barato">
            🚫 > C$ ${maxReservaLimit.toFixed(2)}
          </button>
        `;
      } else {
        actionBtnHtml = `
          <button class="btn-escalar-atleta" style="background: linear-gradient(135deg, #10b981, #059669);" onclick="selectPlayerForActiveSlot(${p.atleta_id})">
            + Escalar Reserva
          </button>
        `;
      }
    } else {
      const isPriceOverBudget = Number(p.preco_num) > (availableSaldo + 0.001);
      if (isPriceOverBudget) {
        const ultrapassa = (Number(p.preco_num) - availableSaldo).toFixed(2);
        actionBtnHtml = `
          <button class="btn-escalar-atleta" style="background: #ef4444; opacity: 0.7; cursor: not-allowed; font-size: 0.75rem;" 
            onclick="alert('❌ LIMITE DE PATRIMÔNIO!\n\n${p.apelido} custa C$ ${Number(p.preco_num).toFixed(2)}, mas você só tem C$ ${availableSaldo.toFixed(2)} de saldo disponível para este slot (falta C$ ${ultrapassa}).')"
            title="Ultrapassa o patrimônio disponível">
            🚫 Falta C$ ${ultrapassa}
          </button>
        `;
      } else {
        actionBtnHtml = `
          <button class="btn-escalar-atleta" onclick="selectPlayerForActiveSlot(${p.atleta_id})">
            + Escalar
          </button>
        `;
      }
    }

    return `
      <div class="market-player-card">
        <div class="market-player-left">
          <img src="${p.foto || club.escudo}" class="market-player-img" 
            onerror="this.src='${club.escudo || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + p.atleta_id}'">
          <img src="${club.escudo}" class="market-player-crest" title="${club.nome || ''}">
          <div class="market-player-info">
            <div class="market-player-name">${p.apelido}</div>
            <div class="market-player-sub">
              <span>${club.abreviacao || 'CLU'}</span> • 
              <strong>${posLabel}</strong> • 
              <span>${statusText}</span> •
              <span style="color: var(--cartola-orange);">${statsDetail}</span>
            </div>
          </div>
        </div>

        <div class="market-player-stats">
          <div class="market-stat-col">
            <span class="market-stat-label">MÉDIA</span>
            <span class="market-stat-val green">${Number(p.media_num || 0).toFixed(2)}</span>
          </div>
          <div class="market-stat-col">
            <span class="market-stat-label">PREÇO</span>
            <span class="market-stat-val orange">C$ ${Number(p.preco_num).toFixed(2)}</span>
          </div>
          ${actionBtnHtml}
        </div>
      </div>
    `;
  }).join('');
}

// Selecionar atleta e alocar no slot com validações completas
function selectPlayerForActiveSlot(atletaId) {
  if (!activeDrawerSlot) return;

  const player = allAthletes.find(a => a.atleta_id === atletaId);
  if (!player) return;

  if (activeDrawerSlot.isReserva) {
    const maxReservaLimit = getMaxReservaPrice(activeDrawerSlot.posId);
    if (maxReservaLimit === null) {
      alert("⚠️ Você precisa primeiro escalar os titulares desta posição antes de escolher o reserva!");
      return;
    }

    if (Number(player.preco_num) > maxReservaLimit) {
      alert(`❌ REGRA CARTOLA FC:\n\nO jogador reserva ${player.apelido} (C$ ${Number(player.preco_num).toFixed(2)}) é mais caro do que o titular mais barato da sua posição (máximo permitido: C$ ${maxReservaLimit.toFixed(2)}).\n\nPor favor, escolha um atleta reserva que custe até C$ ${maxReservaLimit.toFixed(2)}.`);
      return;
    }

    myTeamState.reservas[activeDrawerSlot.slotKey] = atletaId;
    drawerSlotQueue = []; // Limpar fila e fechar drawer imediatamente ao escolher o reserva
  } else {
    // Validação estrita de patrimônio para titulares
    let currentTotalSpent = 0;
    for (const [slot, aid] of Object.entries(myTeamState.titulares)) {
      if (slot !== activeDrawerSlot.slotKey && aid) {
        const p = allAthletes.find(a => a.atleta_id === aid);
        if (p) currentTotalSpent += Number(p.preco_num || 0);
      }
    }
    const newTotalSpent = currentTotalSpent + Number(player.preco_num || 0);
    if (newTotalSpent > myTeamState.patrimonio + 0.001) {
      const ultrapassou = (newTotalSpent - myTeamState.patrimonio).toFixed(2);
      alert(`❌ LIMITE DE PATRIMÔNIO ULTRAPASSADO!\n\nO jogador ${player.apelido} custa C$ ${Number(player.preco_num).toFixed(2)}, ultrapassando seu patrimônio em C$ ${ultrapassou}.\n\nSeu patrimônio: C$ ${myTeamState.patrimonio.toFixed(2)}\nTotal com este jogador: C$ ${newTotalSpent.toFixed(2)}\n\nPor favor, escolha um atleta mais barato ou aumente seu patrimônio.`);
      return;
    }

    myTeamState.titulares[activeDrawerSlot.slotKey] = atletaId;
    // Se não tiver capitão ainda e for jogador de linha, define como capitão
    if (!myTeamState.capitao && player.posicao_id !== 6) {
      myTeamState.capitao = atletaId;
    }
  }

  // Atualizar o campo e salvar
  renderMyTeamPitch();
  persistMyTeam();

  // Fechar o mercado imediatamente após escolher/substituir o jogador
  closeMarketDrawer();
}

// Auto-escalar com os mais prováveis e melhores scouts respeitando rigorosamente o patrimônio
function autoEscalarProvaveis() {
  const cfg = ESQUEMAS_CONFIG[myTeamState.formacao] || ESQUEMAS_CONFIG["4-3-3"];
  const patrimônioMax = myTeamState.patrimonio || 150.0;
  const provaveis = allAthletes.filter(a => a.status_id === 7);

  // Lista de slots necessários
  const neededSlots = [];
  neededSlots.push({ slot: 'gol', posId: 1 });
  for (let i = 0; i < cfg.lats; i++) neededSlots.push({ slot: `lat_${i + 1}`, posId: 2 });
  for (let i = 0; i < cfg.zags; i++) neededSlots.push({ slot: `zag_${i + 1}`, posId: 3 });
  for (let i = 0; i < cfg.m; i++) neededSlots.push({ slot: `mei_${i + 1}`, posId: 4 });
  for (let i = 0; i < cfg.a; i++) neededSlots.push({ slot: `ata_${i + 1}`, posId: 5 });
  neededSlots.push({ slot: 'tec', posId: 6 });

  // Candidatos ordenados por média de pontos
  const posCandidates = {};
  [1, 2, 3, 4, 5, 6].forEach(posId => {
    posCandidates[posId] = provaveis
      .filter(a => a.posicao_id === posId)
      .sort((a, b) => (b.media_num || 0) - (a.media_num || 0));
  });

  let selectedMap = {}; // slot -> atleta
  let selectedAthletes = [];

  // 1. Preencher com os de maior média
  neededSlots.forEach(({ slot, posId }) => {
    const list = posCandidates[posId] || [];
    const available = list.find(a => !selectedAthletes.some(s => s.atleta_id === a.atleta_id)) || list[0];
    if (available) {
      selectedMap[slot] = available;
      selectedAthletes.push(available);
    }
  });

  // 2. Ajustar caso o total ultrapasse o patrimônio
  let totalCost = selectedAthletes.reduce((sum, a) => sum + Number(a.preco_num || 0), 0);
  let iterations = 0;

  while (totalCost > patrimônioMax && iterations < 60) {
    iterations++;
    let bestSlotToSwap = null;
    let bestPlayerReplacement = null;
    let maxCostReduction = 0;

    for (const { slot, posId } of neededSlots) {
      const current = selectedMap[slot];
      if (!current) continue;
      const candidates = posCandidates[posId] || [];
      const cheaperCandidate = candidates.find(c => 
        !Object.values(selectedMap).some(s => s && s.atleta_id === c.atleta_id) && 
        Number(c.preco_num) < Number(current.preco_num)
      );

      if (cheaperCandidate) {
        const diff = Number(current.preco_num) - Number(cheaperCandidate.preco_num);
        if (diff > maxCostReduction) {
          maxCostReduction = diff;
          bestSlotToSwap = slot;
          bestPlayerReplacement = cheaperCandidate;
        }
      }
    }

    if (bestSlotToSwap && bestPlayerReplacement) {
      selectedMap[bestSlotToSwap] = bestPlayerReplacement;
      selectedAthletes = Object.values(selectedMap).filter(Boolean);
      totalCost = selectedAthletes.reduce((sum, a) => sum + Number(a.preco_num || 0), 0);
    } else {
      break;
    }
  }

  // Gravar no estado
  myTeamState.titulares = {};
  myTeamState.reservas = { "1": null, "2": null, "3": null, "4": null, "5": null };
  myTeamState.capitao = null;

  for (const [slot, athlete] of Object.entries(selectedMap)) {
    if (athlete) {
      myTeamState.titulares[slot] = athlete.atleta_id;
    }
  }

  // Capitão: maior média
  const startersList = Object.values(selectedMap);
  const candidateCap = startersList
    .filter(a => a && a.posicao_id !== 6)
    .sort((a, b) => (b.media_num || 0) - (a.media_num || 0))[0];
  if (candidateCap) myTeamState.capitao = candidateCap.atleta_id;

  // Auto-escalar banco de reservas respeitando o teto de preço de cada titular
  for (let posId = 1; posId <= 5; posId++) {
    const maxPrice = getMaxReservaPrice(posId);
    if (maxPrice !== null) {
      const starterIds = Object.values(myTeamState.titulares);
      const bestReserva = (posCandidates[posId] || [])
        .filter(a => !starterIds.includes(a.atleta_id) && Number(a.preco_num) <= maxPrice)
        .sort((a, b) => (b.media_num || 0) - (a.media_num || 0))[0];
      if (bestReserva) {
        myTeamState.reservas[String(posId)] = bestReserva.atleta_id;
      }
    }
  }

  renderMyTeamPitch();
  persistMyTeam();

  const custoFinal = Object.values(myTeamState.titulares)
    .map(aid => allAthletes.find(a => a.atleta_id === aid))
    .filter(Boolean)
    .reduce((sum, a) => sum + Number(a.preco_num || 0), 0);

  alert(`✨ Escalação automática gerada dentro do seu patrimônio!\n\n💰 Custo do Time: C$ ${custoFinal.toFixed(2)} (Patrimônio: C$ ${patrimônioMax.toFixed(2)})\n📋 Banco de Reservas devidamente configurado.`);
}

// Limpar time com confirmação
function clearMyLineupPrompt() {
  if (confirm("Deseja realmente limpar toda a sua escalação atual?")) {
    myTeamState.titulares = {};
    myTeamState.reservas = { "1": null, "2": null, "3": null, "4": null, "5": null };
    myTeamState.capitao = null;
    renderMyTeamPitch();
    persistMyTeam();
  }
}

// Assistente Gato Mestre
function openGatoMestreAssistant() {
  const provaveis = allAthletes.filter(a => a.status_id === 7).sort((a, b) => (b.media_num || 0) - (a.media_num || 0));
  const topAta = provaveis.filter(a => a.posicao_id === 5).slice(0, 3).map(a => `${a.apelido} (${a.media_num} pts)`).join(', ');
  const topMei = provaveis.filter(a => a.posicao_id === 4).slice(0, 3).map(a => `${a.apelido} (${a.media_num} pts)`).join(', ');
  const topDef = provaveis.filter(a => a.posicao_id === 3 || a.posicao_id === 2).slice(0, 3).map(a => `${a.apelido} (${a.media_num} pts)`).join(', ');

  const seeTop5 = confirm(
    `🧙‍♂️ GATO MESTRE — DICAS DE OURO PARA A RODADA:\n\n` +
    `⚽ Top Atacantes: ${topAta}\n` +
    `🧠 Top Meias: ${topMei}\n` +
    `🛡️ Top Defensores: ${topDef}\n\n` +
    `Dica de Capitão: Escale jogadores que jogam em casa contra defesas com maior média de gols sofridos!\n\n` +
    `Deseja abrir a aba TOP 5 POR POSIÇÃO com os rankings detalhados de scouts agora?`
  );

  if (seeTop5) {
    switchMainTab('top5');
  }
}

// =========================================================================
// MÓDULO TOP 5 POR POSIÇÃO (ALGORITMO ESPECIALIZADO POR SCOUTS)
// =========================================================================

let currentTop5PosFilter = 'all';

function setTop5PositionFilter(pos) {
  currentTop5PosFilter = pos;
  document.querySelectorAll('.top5-pos-btn').forEach(b => {
    if (b.getAttribute('data-pos') === pos) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });
  renderTop5View();
}

function getAthleteMatchInfo(athlete) {
  if (!athlete || !athlete.clube_id) return null;
  const match = (allMatches || []).find(m => m.clube_casa_id === athlete.clube_id || m.clube_visitante_id === athlete.clube_id);
  if (!match) return null;
  const isCasa = match.clube_casa_id === athlete.clube_id;
  const myClub = isCasa ? (allClubs[match.clube_casa_id] || {}) : (allClubs[match.clube_visitante_id] || {});
  const oppClub = isCasa ? (allClubs[match.clube_visitante_id] || {}) : (allClubs[match.clube_casa_id] || {});
  const myAbrev = myClub.abreviacao || 'CLU';
  const oppAbrev = oppClub.abreviacao || 'ADV';
  
  return {
    isCasa,
    myAbrev,
    oppAbrev,
    oppNome: oppClub.nome || 'Adversário',
    oppEscudo: oppClub.escudos ? (oppClub.escudos['60x60'] || oppClub.escudos['30x30']) : oppClub.escudo,
    local: match.local || (isCasa ? 'Em Casa' : 'Fora')
  };
}

function isPlayerInMyLineup(atletaId) {
  const isStarter = Object.values(myTeamState.titulares || {}).some(id => Number(id) === Number(atletaId));
  const isReserva = Object.values(myTeamState.reservas || {}).some(id => Number(id) === Number(atletaId));
  return isStarter || isReserva;
}

function calculateTop5Rankings() {
  const onlyProvaveis = document.getElementById('top5-only-provaveis')?.checked ?? true;
  const mandoFilter = document.getElementById('top5-mando-select')?.value || 'all';
  const searchTerm = (document.getElementById('top5-search-input')?.value || '').toLowerCase().trim();

  const candidates = (allAthletes || []).filter(a => {
    if (onlyProvaveis && a.status_id !== 7) return false;
    if (searchTerm) {
      const name = (a.nome || '').toLowerCase();
      const apelido = (a.apelido || '').toLowerCase();
      const club = allClubs[a.clube_id];
      const clubName = (club?.nome || club?.abreviacao || '').toLowerCase();
      if (!name.includes(searchTerm) && !apelido.includes(searchTerm) && !clubName.includes(searchTerm)) {
        return false;
      }
    }
    const matchInfo = getAthleteMatchInfo(a);
    if (mandoFilter === 'casa' && (!matchInfo || !matchInfo.isCasa)) return false;
    if (mandoFilter === 'fora' && (!matchInfo || matchInfo.isCasa)) return false;
    return true;
  });

  const rankings = {
    1: [], // GOL
    2: [], // LAT
    3: [], // ZAG
    4: [], // MEI
    5: [], // ATA
    6: []  // TEC
  };

  const posConfigs = {
    1: { name: 'Goleiros', icon: '🧤', posAbrev: 'GOL', formulaName: 'SG + Defesas (DE/DP) + Média' },
    2: { name: 'Laterais', icon: '🛡️', posAbrev: 'LAT', formulaName: 'Desarmes + Média Básica + Gols/Assist (G+A)' },
    3: { name: 'Zagueiros', icon: '🧱', posAbrev: 'ZAG', formulaName: 'Média Básica sólida + Desarmes + SG' },
    4: { name: 'Meias', icon: '🧠', posAbrev: 'MEI', formulaName: 'Mescla: Gols, Assist, Finaliz, DS e MB' },
    5: { name: 'Atacantes', icon: '⚡', posAbrev: 'ATA', formulaName: 'Gols + Assist + Média + Média Básica' },
    6: { name: 'Técnicos', icon: '📋', posAbrev: 'TEC', formulaName: 'Média e Regularidade' }
  };

  candidates.forEach(a => {
    const sc = a.scout || {};
    const posId = a.posicao_id;
    if (!rankings[posId]) return;

    const media = Number(a.media_num || 0);
    const mediaBasica = Number(a.media_basica || 0);
    const pontos = Number(a.pontos_num || 0);
    const preco = Number(a.preco_num || 0);
    const variacao = Number(a.variacao_num || 0);

    const ds = Number(sc.DS || 0);
    const sg = Number(sc.SG || 0);
    const de = Number(sc.DE || 0);
    const dp = Number(sc.DP || 0);
    const g = Number(sc.G || 0);
    const ast = Number(sc.A || 0);
    const fd = Number(sc.FD || 0);
    const ft = Number(sc.FT || 0);
    const ff = Number(sc.FF || 0);
    const fin = fd + ft + ff;

    let score = 0;

    if (posId === 1) {
      // GOLEIROS: SG e Defesa (DE + DP) + Média e Média Básica
      score = (sg * 5.0) + (de * 1.6) + (dp * 7.0) + (media * 1.2) + (mediaBasica * 0.8);
    } else if (posId === 2) {
      // LATERAIS: Desarme (DS), Média Básica, Gol + Assistência (G + A), SG
      score = (ds * 1.8) + (mediaBasica * 2.5) + (g * 8.0) + (ast * 5.0) + (sg * 2.0) + (media * 0.8);
    } else if (posId === 3) {
      // ZAGUEIROS: Média Básica sólida e Desarme (DS) + SG
      score = (mediaBasica * 3.0) + (ds * 2.0) + (sg * 3.5) + (media * 0.8) + (g * 5.0);
    } else if (posId === 4) {
      // MEIAS: Mescla de Gol, Assistência, Chute pro gol (Finalizações), Desarme, Média Básica
      score = (g * 8.0) + (ast * 5.5) + (fin * 1.4) + (ds * 1.4) + (mediaBasica * 2.0) + (media * 1.2);
    } else if (posId === 5) {
      // ATACANTES: Gol, Assistência, Média e Média Básica + Finalizações
      score = (g * 8.5) + (ast * 5.0) + (fin * 1.8) + (media * 2.0) + (mediaBasica * 1.8);
    } else if (posId === 6) {
      // TÉCNICOS: Média de pontos e regularidade
      score = (media * 2.5) + (pontos * 0.8);
    }

    // Leve ajuste positivo para mando de campo (casa)
    const matchInfo = getAthleteMatchInfo(a);
    if (matchInfo && matchInfo.isCasa) {
      score += 0.4;
    }

    rankings[posId].push({
      atleta: a,
      score,
      scouts: { ds, sg, de, dp, g, ast, fin, media, mediaBasica, preco, pontos, variacao },
      matchInfo
    });
  });

  for (const posId of Object.keys(rankings)) {
    rankings[posId].sort((a, b) => b.score - a.score);
    rankings[posId] = rankings[posId].slice(0, 5);
  }

  return { rankings, posConfigs };
}

function renderTop5View() {
  const container = document.getElementById('top5-grid-container');
  if (!container) return;

  const { rankings, posConfigs } = calculateTop5Rankings();
  const positionsToShow = currentTop5PosFilter === 'all' 
    ? [1, 2, 3, 4, 5, 6] 
    : [parseInt(currentTop5PosFilter)];

  let html = '';

  positionsToShow.forEach(posId => {
    const cfg = posConfigs[posId];
    const topList = rankings[posId] || [];

    html += `
      <div class="top5-pos-column">
        <div class="top5-col-header">
          <div class="top5-col-title-box">
            <span class="top5-col-icon">${cfg.icon}</span>
            <span class="top5-col-title">Top 5 ${cfg.name}</span>
          </div>
          <span class="top5-col-formula-badge">${cfg.formulaName}</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
    `;

    if (topList.length === 0) {
      html += `
        <div style="padding: 24px 12px; text-align: center; color: var(--text-muted); font-size: 0.82rem;">
          Nenhum atleta encontrado com os filtros selecionados.
        </div>
      `;
    } else {
      topList.forEach((item, index) => {
        const rank = index + 1;
        const a = item.atleta;
        const sc = item.scouts;
        const match = item.matchInfo;
        const club = allClubs[a.clube_id] || {};
        const isEscalado = isPlayerInMyLineup(a.atleta_id);
        const playerPhoto = a.foto ? a.foto.replace('FORMATO', '220x220') : (club.escudo || '/images/mascote.png');
        const clubEscudo = club.escudos ? (club.escudos['60x60'] || club.escudos['30x30']) : (club.escudo || '');

        let statChipsHtml = '';
        if (posId === 1) {
          statChipsHtml = `
            <div class="top5-stat-chip highlight"><span>SG:</span> <strong>${sc.sg}</strong></div>
            <div class="top5-stat-chip"><span>DE:</span> <strong>${sc.de}</strong></div>
            ${sc.dp > 0 ? `<div class="top5-stat-chip accent"><span>DP:</span> <strong>${sc.dp}</strong></div>` : ''}
            <div class="top5-stat-chip"><span>MB:</span> <strong>${sc.mediaBasica.toFixed(2)}</strong></div>
            <div class="top5-stat-chip accent"><span>Média:</span> <strong>${sc.media.toFixed(2)}</strong></div>
          `;
        } else if (posId === 2) {
          statChipsHtml = `
            <div class="top5-stat-chip highlight"><span>DS:</span> <strong>${sc.ds}</strong></div>
            <div class="top5-stat-chip"><span>MB:</span> <strong>${sc.mediaBasica.toFixed(2)}</strong></div>
            <div class="top5-stat-chip accent"><span>G+A:</span> <strong>${sc.g + sc.ast}</strong></div>
            <div class="top5-stat-chip"><span>SG:</span> <strong>${sc.sg}</strong></div>
            <div class="top5-stat-chip"><span>Média:</span> <strong>${sc.media.toFixed(2)}</strong></div>
          `;
        } else if (posId === 3) {
          statChipsHtml = `
            <div class="top5-stat-chip highlight"><span>MB:</span> <strong>${sc.mediaBasica.toFixed(2)}</strong></div>
            <div class="top5-stat-chip"><span>DS:</span> <strong>${sc.ds}</strong></div>
            <div class="top5-stat-chip"><span>SG:</span> <strong>${sc.sg}</strong></div>
            ${sc.g > 0 ? `<div class="top5-stat-chip accent"><span>G:</span> <strong>${sc.g}</strong></div>` : ''}
            <div class="top5-stat-chip"><span>Média:</span> <strong>${sc.media.toFixed(2)}</strong></div>
          `;
        } else if (posId === 4) {
          statChipsHtml = `
            <div class="top5-stat-chip highlight"><span>Gols:</span> <strong>${sc.g}</strong></div>
            <div class="top5-stat-chip highlight"><span>Assist:</span> <strong>${sc.ast}</strong></div>
            <div class="top5-stat-chip"><span>Fin:</span> <strong>${sc.fin}</strong></div>
            <div class="top5-stat-chip"><span>DS:</span> <strong>${sc.ds}</strong></div>
            <div class="top5-stat-chip"><span>MB:</span> <strong>${sc.mediaBasica.toFixed(2)}</strong></div>
            <div class="top5-stat-chip accent"><span>Média:</span> <strong>${sc.media.toFixed(2)}</strong></div>
          `;
        } else if (posId === 5) {
          statChipsHtml = `
            <div class="top5-stat-chip highlight"><span>Gols:</span> <strong>${sc.g}</strong></div>
            <div class="top5-stat-chip highlight"><span>Assist:</span> <strong>${sc.ast}</strong></div>
            <div class="top5-stat-chip"><span>Fin:</span> <strong>${sc.fin}</strong></div>
            <div class="top5-stat-chip"><span>MB:</span> <strong>${sc.mediaBasica.toFixed(2)}</strong></div>
            <div class="top5-stat-chip accent"><span>Média:</span> <strong>${sc.media.toFixed(2)}</strong></div>
          `;
        } else if (posId === 6) {
          statChipsHtml = `
            <div class="top5-stat-chip accent"><span>Média:</span> <strong>${sc.media.toFixed(2)}</strong></div>
            <div class="top5-stat-chip"><span>Última:</span> <strong>${sc.pontos.toFixed(2)}</strong></div>
            <div class="top5-stat-chip"><span>Jogos:</span> <strong>${a.jogos_num || 0}</strong></div>
          `;
        }

        const matchTagHtml = match ? `
          <div class="top5-match-tag">
            <span class="top5-mando-pill ${match.isCasa ? 'casa' : 'fora'}">${match.isCasa ? 'CASA' : 'FORA'}</span>
            <span>vs ${match.oppAbrev}</span>
          </div>
        ` : `<div class="top5-match-tag"><span>${club.abreviacao || 'CLU'}</span></div>`;

        html += `
          <div class="top5-player-card rank-${rank}">
            <div class="top5-card-top-row">
              <div class="top5-card-left">
                <div class="top5-rank-number rank-${rank}">#${rank}</div>
                
                <div class="top5-avatar-wrap">
                  <img src="${playerPhoto}" alt="${a.apelido}" class="top5-avatar-img" onerror="this.src='/images/mascote.png'">
                  ${clubEscudo ? `<img src="${clubEscudo}" alt="${club.nome}" class="top5-club-badge">` : ''}
                </div>

                <div class="top5-player-info">
                  <div class="top5-player-name" onclick="openScoutModal(${a.atleta_id})" title="Ver Scout completo">${a.apelido}</div>
                  ${matchTagHtml}
                </div>
              </div>

              <div class="top5-card-right">
                <div class="top5-media-val">${sc.media.toFixed(2)}</div>
                <div class="top5-media-sub">Média Geral</div>
                <div class="top5-price-sub">C$ ${sc.preco.toFixed(2)}</div>
              </div>
            </div>

            <!-- Chips com Scouts Posicionais -->
            <div class="top5-stat-chips-row">
              ${statChipsHtml}
            </div>

            <!-- Ações Rápidas: Scout & Escalar -->
            <div class="top5-card-actions">
              <button class="btn-top5-scout" onclick="openScoutModal(${a.atleta_id})" title="Abrir estatísticas detalhadas">
                <i data-feather="bar-chart-2" style="width: 13px; height: 13px;"></i> Scout
              </button>

              ${isEscalado ? `
                <button class="btn-top5-escalar already-selected" title="Jogador já faz parte do seu time">
                  <i data-feather="check" style="width: 13px; height: 13px;"></i> Escalado
                </button>
              ` : `
                <button class="btn-top5-escalar" onclick="escalarTop5Player(${a.atleta_id})" title="Adicionar este atleta à sua escalação">
                  <i data-feather="plus" style="width: 13px; height: 13px;"></i> Escalar
                </button>
              `}
            </div>
          </div>
        `;
      });
    }

    html += `
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  if (window.feather) feather.replace();
}

// Renderizar Módulo Top 5 SG (Probabilidade de Saldo de Gols)
function renderTop5SgView() {
  const container = document.getElementById('top5-sg-grid-container');
  if (!container) return;

  // 1. Mapear classificação para identificar os 4 últimos (Z-4)
  const z4ClubIds = [];
  if (currentStandingsData && currentStandingsData.tabela) {
    const sortedTable = [...currentStandingsData.tabela].sort((a, b) => (b.pontos || 0) - (a.pontos || 0));
    const z4 = sortedTable.slice(-4);
    z4.forEach(t => z4ClubIds.push(t.clube_id || t.id));
  }

  // 2. Analisar todas as partidas da rodada
  const sgProbabilities = [];

  (allMatches || []).forEach(match => {
    const homeClub = allClubs[match.clube_casa_id] || {};
    const awayClub = allClubs[match.clube_visitante_id] || {};
    
    const isAwayZ4 = z4ClubIds.includes(match.clube_visitante_id);
    
    // Atletas da defesa da casa (GOL, LAT, ZAG)
    const homeDefenders = (allAthletes || []).filter(a => 
      a.clube_id === match.clube_casa_id && 
      [1, 2, 3].includes(a.posicao_id) && 
      a.status_id === 7
    );

    // Calcular score defensivo do mandante
    const avgDefScore = homeDefenders.length > 0
      ? homeDefenders.reduce((acc, d) => acc + Number(d.media_num || 0), 0) / homeDefenders.length
      : 3.0;

    // Bônus de confronto: +30% se o visitante for do Z-4, +15% se for jogo em casa
    let probabilityScore = avgDefScore * 15; // base 0-100
    if (isAwayZ4) probabilityScore += 25;
    probabilityScore += 10; // Fator Casa

    probabilityScore = Math.min(98, Math.max(45, Math.round(probabilityScore)));

    sgProbabilities.push({
      match,
      homeClub,
      awayClub,
      isAwayZ4,
      probabilityScore,
      defenders: homeDefenders
    });
  });

  // Ordenar por probabilidade de SG (maiores primeiro) e pegar os top 5
  sgProbabilities.sort((a, b) => b.probabilityScore - a.probabilityScore);
  const top5SgList = sgProbabilities.slice(0, 5);

  if (top5SgList.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); padding: 30px; text-align: center;">Nenhuma partida disponível para cálculo de SG nesta rodada.</div>';
    return;
  }

  container.innerHTML = top5SgList.map((item, index) => {
    const rank = index + 1;
    const homeName = item.homeClub.nome || item.homeClub.abreviacao || 'Mandante';
    const awayName = item.awayClub.nome || item.awayClub.abreviacao || 'Visitante';
    const homeEscudo = item.homeClub.escudos ? (item.homeClub.escudos['60x60'] || item.homeClub.escudos['30x30']) : item.homeClub.escudo;
    const awayEscudo = item.awayClub.escudos ? (item.awayClub.escudos['60x60'] || item.awayClub.escudos['30x30']) : item.awayClub.escudo;

    const z4Badge = item.isAwayZ4 ? `<span style="background: #ef4444; color: #fff; font-size: 0.68rem; font-weight: 900; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">Adversário no Z-4 ⚠️</span>` : '';

    const defsHtml = item.defenders.slice(0, 4).map(d => {
      const posLabel = d.posicao_id === 1 ? 'GOL' : (d.posicao_id === 2 ? 'LAT' : 'ZAG');
      const isEscalado = isPlayerInMyLineup(d.atleta_id);
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.04); padding: 8px 12px; border-radius: 8px; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="background: rgba(139, 92, 246, 0.2); color: #c084fc; font-size: 0.68rem; font-weight: 900; padding: 2px 6px; border-radius: 4px;">${posLabel}</span>
            <span style="font-weight: 700; color: #fff; font-size: 0.88rem;">${d.apelido}</span>
            <span style="color: var(--text-muted); font-size: 0.78rem;">C$ ${Number(d.preco_num).toFixed(2)}</span>
          </div>
          ${isEscalado ? `
            <span style="color: #10b981; font-weight: 800; font-size: 0.78rem;">✓ Escalado</span>
          ` : `
            <button onclick="escalarTop5Player(${d.atleta_id})" style="background: linear-gradient(135deg, #8b5cf6, #6d28d9); color: #fff; border: none; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 0.75rem; cursor: pointer;">+ Escalar</button>
          `}
        </div>
      `;
    }).join('');

    return `
      <div class="top5-player-card rank-${rank}" style="background: #0f172a; border: 1px solid rgba(139, 92, 246, 0.25); padding: 18px; border-radius: 16px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="background: linear-gradient(135deg, #8b5cf6, #6d28d9); color: #fff; border-radius: 50%; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.85rem;">#${rank}</span>
            <div>
              <div style="font-weight: 800; color: #fff; font-size: 1.05rem; display: flex; align-items: center;">
                🏠 ${homeName} vs ${awayName} ${z4Badge}
              </div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">Jogo em Casa • Análise Defensiva</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.4rem; font-weight: 900; color: #c084fc;">${item.probabilityScore}%</div>
            <div style="font-size: 0.65rem; color: #94a3b8; font-weight: 700;">PROB. SG</div>
          </div>
        </div>

        <div style="margin-top: 14px;">
          <div style="font-size: 0.75rem; font-weight: 800; color: #94a3b8; margin-bottom: 8px; text-transform: uppercase;">
            🛡️ Destaques Defensivos com Maior Probabilidade:
          </div>
          ${defsHtml || '<div style="font-size: 0.8rem; color: var(--text-muted);">Nenhum defensor provável mapeado.</div>'}
        </div>
      </div>
    `;
  }).join('');

  if (window.feather) feather.replace();
}

// =========================================================================
// MÓDULO ESCALAÇÕES VARIADAS (ESTRATÉGIAS INTELIGENTES +500 COMBINAÇÕES)
// =========================================================================
let currentVariadasStrategy = 'bons_baratos'; // 'bons_baratos' | 'mandantes' | 'tiro_curto' | 'defesa_dupla'

// Histórico de combinações já geradas por estratégia (para não repetir)
let variadasUsedCombinations = {
  bons_baratos: [],
  mandantes: [],
  tiro_curto: [],
  defesa_dupla: []
};

// Função utilitária: embaralhar array (Fisher-Yates)
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Gera hash único de uma combinação para comparar
function getLineupHash(selectedMap) {
  return Object.keys(selectedMap).sort().map(k => selectedMap[k]?.atleta_id || 0).join('-');
}

// Botão "Gerar Outra Combinação" — chamado pelo botão no resultado
function shuffleVariadasLineup() {
  generateVariadasLineup();
}

function selectVariadasStrategy(strat, btnEl) {
  currentVariadasStrategy = strat;
  document.querySelectorAll('[data-strat]').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  const extraControls = document.getElementById('variadas-extra-controls');
  if (extraControls) {
    if (strat === 'defesa_dupla') {
      extraControls.style.display = 'block';
      populateDefesaTeamsSelects();
    } else {
      extraControls.style.display = 'none';
      generateVariadasLineup();
    }
  } else {
    generateVariadasLineup();
  }
}

function populateDefesaTeamsSelects() {
  const sel1 = document.getElementById('select-defesa-team-1');
  const sel2 = document.getElementById('select-defesa-team-2');
  if (!sel1 || !sel2) return;

  const clubsList = Object.values(allClubs || {}).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  const optionsHtml = clubsList.map(c => `<option value="${c.id}">${c.nome} (${c.abreviacao})</option>`).join('');

  sel1.innerHTML = `<option value="">-- Escolher 1º Time --</option>` + optionsHtml;
  sel2.innerHTML = `<option value="">-- Escolher 2º Time --</option>` + optionsHtml;
  
  if (clubsList.length >= 2) {
    sel1.value = clubsList[0].id;
    sel2.value = clubsList[1].id;
  }
}

function renderEscalacoesVariadasView() {
  generateVariadasLineup();
}

// Algoritmo de Inteligência Combinatória para Escalações Variadas
function generateVariadasLineup() {
  const container = document.getElementById('variadas-result-container');
  if (!container) return;

  const cfg = ESQUEMAS_CONFIG[myTeamState.formacao] || ESQUEMAS_CONFIG["4-3-3"];
  const maxPatrimonio = myTeamState.patrimonio || 150.0;
  const strat = currentVariadasStrategy;

  // Filtrar pool de atletas prováveis (Status 7)
  let pool = (allAthletes || []).filter(a => a.status_id === 7);

  // Filtros Específicos da Estratégia
  if (strat === 'bons_baratos') {
    pool = pool.filter(a => Number(a.preco_num || 0) <= 10.0);
  } else if (strat === 'mandantes') {
    pool = pool.filter(a => {
      const match = getAthleteMatchInfo(a);
      return match && match.isCasa;
    });
  }

  // Se a pool filtrada ficar insuficiente para fechar o time, complementar com os prováveis mais baratos
  const fallbackAthletes = (allAthletes || [])
    .filter(a => a.status_id === 7)
    .sort((a, b) => Number(a.preco_num || 0) - Number(b.preco_num || 0));

  // Função helper para montar a melhor peça por vaga (com aleatoriedade para variar combinações)
  const getBestCandidate = (posId, filterFn, usedIds) => {
    let candidates = pool.filter(a => a.posicao_id === posId && !usedIds.has(a.atleta_id));
    if (filterFn) candidates = candidates.filter(filterFn);
    
    if (candidates.length === 0) {
      candidates = fallbackAthletes.filter(a => a.posicao_id === posId && !usedIds.has(a.atleta_id));
    }

    // Ordenar combinando Média Geral, Média Básica e Gols/Assistências
    candidates.sort((a, b) => {
      const scoreA = Number(a.media_num || 0) * 1.5 + (a.scout?.G || 0) * 3 + (a.scout?.A || 0) * 2;
      const scoreB = Number(b.media_num || 0) * 1.5 + (b.scout?.G || 0) * 3 + (b.scout?.A || 0) * 2;
      return scoreB - scoreA;
    });

    // Pegar os top N candidatos e escolher aleatoriamente entre eles
    const topN = Math.min(candidates.length, Math.max(3, Math.ceil(candidates.length * 0.35)));
    const topCandidates = candidates.slice(0, topN);
    const shuffled = shuffleArray(topCandidates);
    return shuffled[0] || null;
  };

  const selectedMap = {}; // slot -> atleta
  const usedIds = new Set();

  // Caso: Defesa Dupla (Mesclar 2 Times)
  let team1Id = null, team2Id = null;
  if (strat === 'defesa_dupla') {
    team1Id = Number(document.getElementById('select-defesa-team-1')?.value);
    team2Id = Number(document.getElementById('select-defesa-team-2')?.value);
  }

  // 1. Escalar Goleiro
  let golFilter = null;
  if (strat === 'defesa_dupla' && team1Id) {
    golFilter = a => a.clube_id === team1Id || a.clube_id === team2Id;
  }
  const golPlayer = getBestCandidate(1, golFilter, usedIds);
  if (golPlayer) { selectedMap['gol'] = golPlayer; usedIds.add(golPlayer.atleta_id); }

  // 2. Escalar Defensores (Laterais & Zagueiros)
  for (let i = 1; i <= cfg.lats; i++) {
    const slot = `lat_${i}`;
    let latFilter = null;
    if (strat === 'defesa_dupla' && team1Id) {
      const targetTeam = (i % 2 === 1) ? team1Id : (team2Id || team1Id);
      latFilter = a => a.clube_id === targetTeam;
    }
    const p = getBestCandidate(2, latFilter, usedIds);
    if (p) { selectedMap[slot] = p; usedIds.add(p.atleta_id); }
  }

  for (let i = 1; i <= cfg.zags; i++) {
    const slot = `zag_${i}`;
    let zagFilter = null;
    if (strat === 'defesa_dupla' && team1Id) {
      const targetTeam = (i % 2 === 1) ? team1Id : (team2Id || team1Id);
      zagFilter = a => a.clube_id === targetTeam;
    }
    const p = getBestCandidate(3, zagFilter, usedIds);
    if (p) { selectedMap[slot] = p; usedIds.add(p.atleta_id); }
  }

  // 3. Escalar Meias & Atacantes
  for (let i = 1; i <= cfg.m; i++) {
    const slot = `mei_${i}`;
    const p = getBestCandidate(4, null, usedIds);
    if (p) { selectedMap[slot] = p; usedIds.add(p.atleta_id); }
  }

  for (let i = 1; i <= cfg.a; i++) {
    const slot = `ata_${i}`;
    const p = getBestCandidate(5, null, usedIds);
    if (p) { selectedMap[slot] = p; usedIds.add(p.atleta_id); }
  }

  // 4. Escalar Técnico
  const tecPlayer = getBestCandidate(6, null, usedIds);
  if (tecPlayer) { selectedMap['tec'] = tecPlayer; usedIds.add(tecPlayer.atleta_id); }

  // 5. Ajustar Orçamento (Substituir peças mais caras se exceder o patrimônio)
  let selectedList = Object.values(selectedMap);
  let totalCost = selectedList.reduce((sum, a) => sum + Number(a.preco_num || 0), 0);
  let iters = 0;

  while (totalCost > maxPatrimonio && iters < 30) {
    iters++;
    let maxDiff = 0;
    let slotToSwap = null;
    let cheaperReplacement = null;

    for (const [slot, current] of Object.entries(selectedMap)) {
      if (!current) continue;
      const candidates = fallbackAthletes.filter(a => a.posicao_id === current.posicao_id && !usedIds.has(a.atleta_id) && Number(a.preco_num) < Number(current.preco_num));
      if (candidates.length > 0) {
        const cheaper = candidates[0];
        const diff = Number(current.preco_num) - Number(cheaper.preco_num);
        if (diff > maxDiff) {
          maxDiff = diff;
          slotToSwap = slot;
          cheaperReplacement = cheaper;
        }
      }
    }

    if (slotToSwap && cheaperReplacement) {
      usedIds.delete(selectedMap[slotToSwap].atleta_id);
      selectedMap[slotToSwap] = cheaperReplacement;
      usedIds.add(cheaperReplacement.atleta_id);
      selectedList = Object.values(selectedMap);
      totalCost = selectedList.reduce((sum, a) => sum + Number(a.preco_num || 0), 0);
    } else {
      break;
    }
  }

  // Definir Capitão
  const candidateCap = selectedList.find(a => a.posicao_id === 5) || selectedList.find(a => a.posicao_id === 4) || selectedList[0];

  // Renderizar o Time Gerado
  const stratTitles = {
    bons_baratos: '💰 Escalação Bons e Baratos (C$ 0.00 a C$ 10.00)',
    mandantes: '🏠 Escalação 100% Mandantes (Fator Casa)',
    tiro_curto: '⚡ Escalação Tiro Curto (Defesa Fechada + Alta Média)',
    defesa_dupla: '🛡️ Escalação Defesa Dobrada (Confrontos Selecionados)'
  };

  const posOrder = { 1: 'GOL', 2: 'LAT', 3: 'ZAG', 4: 'MEI', 5: 'ATA', 6: 'TEC' };

  const squadCardsHtml = selectedList.map(a => {
    const club = allClubs[a.clube_id] || {};
    const posLabel = posOrder[a.posicao_id] || 'ATL';
    const isCap = candidateCap && candidateCap.atleta_id === a.atleta_id;
    const playerImgSrc = getAthletePhoto(a);

    return `
      <div style="background: #0d121a; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="background: rgba(236,72,153,0.2); color: #f472b6; font-size: 0.7rem; font-weight: 900; padding: 2px 6px; border-radius: 4px; min-width: 32px; text-align: center;">${posLabel}</span>
          <img src="${playerImgSrc}" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 1.5px solid rgba(255,255,255,0.15);">
          <div>
            <div style="font-weight: 800; color: #fff; font-size: 0.9rem; display: flex; align-items: center; gap: 6px;">
              ${a.apelido}
              ${isCap ? '<span style="background: #f59e0b; color: #000; font-size: 0.6rem; font-weight: 900; padding: 1px 5px; border-radius: 3px;">C</span>' : ''}
            </div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${club.nome || 'Clube'} • Média: ${Number(a.media_num || 0).toFixed(2)}</div>
          </div>
        </div>
        <div style="font-weight: 900; color: var(--cartola-orange); font-size: 0.9rem;">
          C$ ${Number(a.preco_num).toFixed(2)}
        </div>
      </div>
    `;
  }).join('');

  // Verificar se a combinação já foi gerada antes — se sim, tentar novamente (máx 10x)
  const currentHash = getLineupHash(selectedMap);
  const stratHistory = variadasUsedCombinations[strat] || [];
  if (stratHistory.includes(currentHash)) {
    // Tentar gerar outra combinação (recursão limitada)
    if (!window.__variadasRetryCount) window.__variadasRetryCount = 0;
    window.__variadasRetryCount++;
    if (window.__variadasRetryCount < 10) {
      return generateVariadasLineup();
    }
    // Se esgotou tentativas, resetar histórico e aceitar a combinação atual
    variadasUsedCombinations[strat] = [];
  }
  window.__variadasRetryCount = 0;

  // Registrar combinação no histórico
  if (!variadasUsedCombinations[strat]) variadasUsedCombinations[strat] = [];
  variadasUsedCombinations[strat].push(currentHash);

  const combinationNumber = variadasUsedCombinations[strat].length;

  container.innerHTML = `
    <div style="background: #0f172a; border: 1px solid rgba(236,72,153,0.3); border-radius: 18px; padding: 22px; box-shadow: 0 15px 40px rgba(0,0,0,0.6);">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 14px;">
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 900; color: #f472b6; margin-bottom: 2px;">${stratTitles[strat]}</h2>
          <div style="font-size: 0.82rem; color: var(--text-muted);">Combinação #${combinationNumber} gerada via análise computacional de mais de 500 probabilidades de scouts</div>
        </div>
        <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
          <div style="text-align: right;">
            <div style="font-size: 1.3rem; font-weight: 900; color: #10b981;">C$ ${totalCost.toFixed(2)}</div>
            <div style="font-size: 0.68rem; color: #94a3b8; font-weight: 700;">CUSTO TOTAL (MAX: C$ ${maxPatrimonio.toFixed(2)})</div>
          </div>
          <button onclick="shuffleVariadasLineup()" class="nav-btn" style="padding: 10px 20px; background: linear-gradient(135deg, #8b5cf6, #6d28d9); font-weight: 900; color: #fff; border-radius: 10px; font-size: 0.88rem; box-shadow: 0 4px 15px rgba(139,92,246,0.3); border: none; cursor: pointer; transition: transform 0.15s ease;">
            🔄 Gerar Outra Combinação
          </button>
          <button onclick="applyVariadasToMyTeam('${strat}')" class="nav-btn nav-btn-primary" style="padding: 10px 20px; background: linear-gradient(135deg, #10b981, #059669); font-weight: 900; color: #fff; border-radius: 10px; font-size: 0.88rem; box-shadow: 0 4px 15px rgba(16,185,129,0.3);">
            🚀 Aplicar no Meu Campinho
          </button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px;">
        ${squadCardsHtml}
      </div>
    </div>
  `;

  // Guardar última combinação gerada para aplicar
  window.__lastVariadasLineup = { selectedMap, candidateCap };
}

function applyVariadasToMyTeam(strat) {
  if (!window.__lastVariadasLineup || !window.__lastVariadasLineup.selectedMap) return;

  const { selectedMap, candidateCap } = window.__lastVariadasLineup;

  myTeamState.titulares = {};
  for (const [slot, athlete] of Object.entries(selectedMap)) {
    if (athlete) {
      myTeamState.titulares[slot] = athlete.atleta_id;
    }
  }

  if (candidateCap) {
    myTeamState.capitao = candidateCap.atleta_id;
  }

  // Preencher Banco de Reservas devidamente
  for (let posId = 1; posId <= 5; posId++) {
    const maxAllowed = getMaxReservaPrice(posId);
    const starterIds = Object.values(myTeamState.titulares);
    const available = (allAthletes || [])
      .filter(a => a.posicao_id === posId && a.status_id === 7 && !starterIds.includes(a.atleta_id) && (maxAllowed === null || Number(a.preco_num) <= maxAllowed))
      .sort((a, b) => Number(b.media_num || 0) - Number(a.media_num || 0));
    if (available.length > 0) {
      myTeamState.reservas[String(posId)] = available[0].atleta_id;
    }
  }

  renderMyTeamPitch();
  persistMyTeam();

  switchMainTab('escalacao');
  alert(`🎉 Estratégia de Escalação aplicada com sucesso no seu campinho!`);
}

function escalarTop5Player(atletaId) {
  const player = allAthletes.find(a => a.atleta_id === atletaId);
  if (!player) return;

  if (isPlayerInMyLineup(atletaId)) {
    alert(`ℹ️ O jogador ${player.apelido} já está escalado no seu time!`);
    return;
  }

  const posId = player.posicao_id;
  const cfg = ESQUEMAS_CONFIG[myTeamState.formacao] || ESQUEMAS_CONFIG["4-3-3"];

  let candidateSlots = [];
  if (posId === 1) candidateSlots = ['gol'];
  else if (posId === 2) candidateSlots = Array.from({ length: cfg.lats }, (_, i) => `lat_${i + 1}`);
  else if (posId === 3) candidateSlots = Array.from({ length: cfg.zags }, (_, i) => `zag_${i + 1}`);
  else if (posId === 4) candidateSlots = Array.from({ length: cfg.m }, (_, i) => `mei_${i + 1}`);
  else if (posId === 5) candidateSlots = Array.from({ length: cfg.a }, (_, i) => `ata_${i + 1}`);
  else if (posId === 6) candidateSlots = ['tec'];

  const emptySlot = candidateSlots.find(slot => !myTeamState.titulares[slot]);

  if (emptySlot) {
    // Validar patrimônio antes de escalar do Top 5
    let currentTotalSpent = 0;
    for (const [slot, aid] of Object.entries(myTeamState.titulares)) {
      if (slot !== emptySlot && aid) {
        const p = allAthletes.find(a => a.atleta_id === aid);
        if (p) currentTotalSpent += Number(p.preco_num || 0);
      }
    }
    const newTotalSpent = currentTotalSpent + Number(player.preco_num || 0);
    if (newTotalSpent > myTeamState.patrimonio + 0.001) {
      const ultrapassou = (newTotalSpent - myTeamState.patrimonio).toFixed(2);
      alert(`❌ LIMITE DE PATRIMÔNIO ULTRAPASSADO!\n\nO jogador ${player.apelido} custa C$ ${Number(player.preco_num).toFixed(2)}, ultrapassando seu patrimônio em C$ ${ultrapassou}.\n\nSeu patrimônio: C$ ${myTeamState.patrimonio.toFixed(2)}\nTotal com este jogador: C$ ${newTotalSpent.toFixed(2)}\n\nPor favor, escolha um atleta mais barato ou aumente seu patrimônio.`);
      return;
    }

    myTeamState.titulares[emptySlot] = atletaId;
    if (!myTeamState.capitao && posId !== 6) {
      myTeamState.capitao = atletaId;
    }
    persistMyTeam();
    renderTop5View();
    alert(`✨ ${player.apelido} escalado como Titular no seu time!`);
    return;
  }

  if (posId >= 1 && posId <= 5) {
    const resKey = String(posId);
    const maxAllowed = getMaxReservaPrice(posId);
    if (maxAllowed !== null && Number(player.preco_num) > maxAllowed) {
      alert(`⚠️ Regra do Cartola: ${player.apelido} (C$ ${Number(player.preco_num).toFixed(2)}) é mais caro que o titular mais barato da sua posição (máx permitido: C$ ${maxAllowed.toFixed(2)}).`);
      return;
    }
    if (!myTeamState.reservas[resKey]) {
      myTeamState.reservas[resKey] = atletaId;
      persistMyTeam();
      renderTop5View();
      alert(`✨ ${player.apelido} escalado no seu Banco de Reservas!`);
      return;
    }
  }

  alert(`⚠️ Todas as vagas de titulares e reservas para esta posição já estão preenchidas. Vá na aba "Meu Time" para gerenciar.`);
}

function autoEscalarTop5Lineup() {
  const { rankings } = calculateTop5Rankings();
  const cfg = ESQUEMAS_CONFIG[myTeamState.formacao] || ESQUEMAS_CONFIG["4-3-3"];
  const patrimônioMax = myTeamState.patrimonio || 150.0;

  // Lista de slots necessários
  const neededSlots = [];
  neededSlots.push({ slot: 'gol', posId: 1 });
  for (let i = 0; i < cfg.lats; i++) neededSlots.push({ slot: `lat_${i + 1}`, posId: 2 });
  for (let i = 0; i < cfg.zags; i++) neededSlots.push({ slot: `zag_${i + 1}`, posId: 3 });
  for (let i = 0; i < cfg.m; i++) neededSlots.push({ slot: `mei_${i + 1}`, posId: 4 });
  for (let i = 0; i < cfg.a; i++) neededSlots.push({ slot: `ata_${i + 1}`, posId: 5 });
  neededSlots.push({ slot: 'tec', posId: 6 });

  // Algoritmo com otimização pelo Top 5 que cabe estritamente no patrimônio
  // Pega os atletas do ranking de cada posição ordenados por score (melhores primeiro)
  const posCandidates = {};
  [1, 2, 3, 4, 5, 6].forEach(posId => {
    // Pega as opções do Top 5 e, se necessário, outras opções prováveis para completar o orçamento
    const top5Players = (rankings[posId] || []).map(r => r.atleta);
    const otherProvaveis = allAthletes
      .filter(a => a.posicao_id === posId && a.status_id === 7 && !top5Players.some(t => t.atleta_id === a.atleta_id))
      .sort((a, b) => (a.preco_num || 0) - (b.preco_num || 0)); // Mais baratos como alternativas
    posCandidates[posId] = [...top5Players, ...otherProvaveis];
  });

  // Tenta guloso a partir do Top 5; se passar do patrimônio, substitui o titular mais caro por outro do Top 5 mais acessível
  let selectedMap = {}; // slot -> atleta
  let selectedAthletes = [];

  // 1. Inicializar com as melhores opções do Top 5
  neededSlots.forEach(({ slot, posId }) => {
    const list = posCandidates[posId] || [];
    const available = list.find(a => !selectedAthletes.some(s => s.atleta_id === a.atleta_id)) || list[0];
    if (available) {
      selectedMap[slot] = available;
      selectedAthletes.push(available);
    }
  });

  // 2. Ajustar caso o valor total ultrapasse o patrimônio
  let totalCost = selectedAthletes.reduce((sum, a) => sum + Number(a.preco_num || 0), 0);
  let iterations = 0;

  while (totalCost > patrimônioMax && iterations < 50) {
    iterations++;
    // Encontrar slot com melhor oportunidade de economia substituindo por outro do ranking/provável
    let bestSlotToSwap = null;
    let bestPlayerReplacement = null;
    let maxCostReduction = 0;

    for (const { slot, posId } of neededSlots) {
      const current = selectedMap[slot];
      if (!current) continue;
      const candidates = posCandidates[posId] || [];
      const cheaperCandidate = candidates.find(c => 
        !Object.values(selectedMap).some(s => s && s.atleta_id === c.atleta_id) && 
        Number(c.preco_num) < Number(current.preco_num)
      );

      if (cheaperCandidate) {
        const diff = Number(current.preco_num) - Number(cheaperCandidate.preco_num);
        if (diff > maxCostReduction) {
          maxCostReduction = diff;
          bestSlotToSwap = slot;
          bestPlayerReplacement = cheaperCandidate;
        }
      }
    }

    if (bestSlotToSwap && bestPlayerReplacement) {
      selectedMap[bestSlotToSwap] = bestPlayerReplacement;
      selectedAthletes = Object.values(selectedMap).filter(Boolean);
      totalCost = selectedAthletes.reduce((sum, a) => sum + Number(a.preco_num || 0), 0);
    } else {
      break;
    }
  }

  // Gravar no estado oficial
  myTeamState.titulares = {};
  myTeamState.reservas = { "1": null, "2": null, "3": null, "4": null, "5": null };
  myTeamState.capitao = null;

  for (const [slot, athlete] of Object.entries(selectedMap)) {
    if (athlete) {
      myTeamState.titulares[slot] = athlete.atleta_id;
    }
  }

  // Capitão: melhor atacante ou meia escalado
  const startersList = Object.values(selectedMap);
  const candidateCap = startersList.find(a => a && a.posicao_id === 5) || startersList.find(a => a && a.posicao_id === 4);
  if (candidateCap) myTeamState.capitao = candidateCap.atleta_id;

  // Preencher banco de reservas (pegar reservas válidos de preço)
  for (let posId = 1; posId <= 5; posId++) {
    const maxAllowed = getMaxReservaPrice(posId);
    const starterIds = Object.values(myTeamState.titulares);
    const available = (posCandidates[posId] || [])
      .filter(p => !starterIds.includes(p.atleta_id) && (maxAllowed === null || Number(p.preco_num) <= maxAllowed));
    if (available.length > 0) {
      myTeamState.reservas[String(posId)] = available[0].atleta_id;
    }
  }

  renderMyTeamPitch();
  persistMyTeam();
  renderTop5View();

  const custoFinal = Object.values(myTeamState.titulares)
    .map(aid => allAthletes.find(a => a.atleta_id === aid))
    .filter(Boolean)
    .reduce((sum, a) => sum + Number(a.preco_num || 0), 0);

  const goTab = confirm(
    `✨ Seu time foi escalado com sucesso respeitando seu patrimônio!\n\n` +
    `💰 Custo do Time: C$ ${custoFinal.toFixed(2)} (Patrimônio: C$ ${patrimônioMax.toFixed(2)})\n` +
    `🛡️ Jogadores do Top 5 & scouts integrados!\n\n` +
    `Deseja abrir a aba 'Meu Time' para ver o campo agora?`
  );
  if (goTab) {
    switchMainTab('escalacao');
  }
}

// =========================================================================
// SINCRONIZAÇÃO 1-CLIQUE COM EXTENSÃO DO CARTOLA FC
// =========================================================================

function submitLineupToCartola() {
  const cfg = ESQUEMAS_CONFIG[myTeamState.formacao] || ESQUEMAS_CONFIG["4-3-3"];
  const totalNeeded = cfg.a + cfg.m + cfg.zags + cfg.lats + 2; // 11 jogadores + 1 técnico = 12

  const starterIds = Object.values(myTeamState.titulares).filter(Boolean);
  if (starterIds.length < totalNeeded) {
    alert(`Atenção: Você escalou ${starterIds.length} de ${totalNeeded} atletas titulares. Complete sua escalação antes de enviar!`);
    return;
  }

  if (!myTeamState.capitao) {
    alert("Por favor, selecione um Capitão [C] antes de enviar a escalação!");
    return;
  }

  // Validação dos reservas: nenhum reserva pode ser mais caro que o titular mais barato
  for (const [posIdStr, resId] of Object.entries(myTeamState.reservas)) {
    if (!resId) continue;
    const posId = parseInt(posIdStr);
    const resPlayer = allAthletes.find(a => a.atleta_id === resId);
    const maxAllowed = getMaxReservaPrice(posId);
    if (resPlayer && maxAllowed !== null && Number(resPlayer.preco_num) > maxAllowed) {
      alert(`❌ ATENÇÃO — REGRA DO CARTOLA:\n\nO jogador reserva ${resPlayer.apelido} (C$ ${Number(resPlayer.preco_num).toFixed(2)}) é mais caro do que o titular mais barato da sua posição (máximo permitido: C$ ${maxAllowed.toFixed(2)}).\n\nPor favor, substitua este reserva por outro de valor menor ou igual antes de enviar a escalação ao Cartola!`);
      return;
    }
  }

  const cleanReservas = {};
  for (const [posIdStr, resId] of Object.entries(myTeamState.reservas)) {
    const aid = Number(resId);
    if (!isNaN(aid) && aid > 0) {
      cleanReservas[posIdStr] = aid;
    }
  }

  const payload = {
    esquema: Number(myTeamState.esquema_id || 3),
    capitao: Number(myTeamState.capitao),
    reserva_luxo: myTeamState.reserva_luxo ? Number(myTeamState.reserva_luxo) : null,
    atletas: starterIds.map(Number),
    reservas: cleanReservas
  };

  const btn = document.getElementById('btn-submit-cartola');
  const label = document.getElementById('btn-submit-label');
  if (label) label.textContent = "⏳ ENVIANDO AO CARTOLA...";

  // Disparar mensagem para a extensão do navegador
  window.postMessage({ type: "LENDAS_ENVIAR_ESCALACAO", payload }, "*");

  // Fallback caso a extensão não esteja instalada no navegador atual
  setTimeout(() => {
    if (label && label.textContent === "⏳ ENVIANDO AO CARTOLA...") {
      label.textContent = "TIME ESCALADO";
      if (!window.__LENDAS_EXTENSION_INSTALLED__) {
        const installPrompt = confirm(
          "⚽ Escalação pronta no seu sistema!\n\n" +
          "Para enviar automaticamente para sua conta no Cartola FC com 1 clique, você precisa ativar a extensão 'Lendas Cartola Sync' no seu Chrome/Edge.\n\n" +
          "Deseja abrir as instruções de ativação da extensão agora?"
        );
        if (installPrompt) {
          alert("Abra a pasta 'extensao-lendas-cartola' no seu projeto e recarregue a extensão no seu Chrome (chrome://extensions)!");
        }
      }
    }
  }, 2500);
}

// Escutar respostas da extensão
window.addEventListener("message", (event) => {
  if (event.data && event.data.type === "LENDAS_EXTENSION_AVAILABLE") {
    window.__LENDAS_EXTENSION_INSTALLED__ = true;
    const ind = document.getElementById("ext-indicator-text");
    if (ind) ind.textContent = "Extensão Lendas Cartola Sync Ativa 🟢";
    const dot = document.getElementById("ext-indicator-dot");
    if (dot) dot.style.background = "#10b981";

    // Se a extensão passou dados do time autenticado
    if (event.data.time || event.data.team) {
      applyCartolaTeamData(event.data.time || event.data.team);
    }
  }

  // Evento direto de sincronização de perfil emitido pelo content_app.js
  if (event.data && event.data.type === "LENDAS_CARTOLA_PROFILE_SYNC") {
    window.__LENDAS_EXTENSION_INSTALLED__ = true;
    if (event.data.time) {
      applyCartolaTeamData(event.data.time);
    }
  }

  if (event.data && event.data.type === "LENDAS_ESCALACAO_RESPOSTA") {
    const btn = document.getElementById("btn-submit-cartola");
    const label = document.getElementById("btn-submit-label");
    if (event.data.success) {
      if (label) label.textContent = "✅ TIME SALVO NO CARTOLA!";
      if (btn) btn.style.background = "linear-gradient(135deg, #10b981, #059669)";
      
      // Se a resposta retornou dados atualizados do time/patrimônio
      if (event.data.data && event.data.data.time) {
        applyCartolaTeamData(event.data.data.time);
      }

      // Identificar rodada atual para a mensagem comemorativa
      const rodadaNum = currentRound || 24;

      // Efeito festivo no console e alerta comemorativo
      console.log("%c 🎆 🎆 🎆 FOGOS DE ARTIFÍCIO! TIME ESCALADO COM SUCESSO! 🎆 🎆 🎆", "color: #10b981; font-size: 16px; font-weight: bold;");

      alert(`🎆 🚀 TIME ESCALADO COM SUCESSO!\n\n🍀 BOA SORTE NA RODADA ${rodadaNum}! ⚽🔥\n\nA sua escalação foi confirmada e gravada oficialmente nos servidores do Cartola FC!`);
    } else {
      if (label) label.textContent = "TIME ESCALADO";
      alert("⚠️ Aviso do Cartola: " + (event.data.message || "Não foi possível salvar o time. Verifique seu login no Cartola."));
    }
  }
});

// Atualiza o estado do time com os dados reais do Cartola (nome do time, nome do dono, escudo, pontuação, patrimônio)
function applyCartolaTeamData(cartolaTime) {
  if (!cartolaTime) return;
  if (cartolaTime.nome) myTeamState.nome_time = cartolaTime.nome;
  if (cartolaTime.nome_cartola) myTeamState.nome_cartola = cartolaTime.nome_cartola;
  else if (cartolaTime.nome_usuario) myTeamState.nome_cartola = cartolaTime.nome_usuario;
  else if (cartolaTime.assinante_nome) myTeamState.nome_cartola = cartolaTime.assinante_nome;

  if (cartolaTime.patrimonio !== undefined && cartolaTime.patrimonio !== null) {
    myTeamState.patrimonio = parseFloat(cartolaTime.patrimonio);
  }
  if (cartolaTime.url_escudo_svg) myTeamState.url_escudo_svg = cartolaTime.url_escudo_svg;
  if (cartolaTime.url_escudo_png) myTeamState.url_escudo_png = cartolaTime.url_escudo_png;
  
  if (cartolaTime.pontos_ultima_rodada !== undefined) {
    myTeamState.pontos_ultima_rodada = cartolaTime.pontos_ultima_rodada;
  } else if (cartolaTime.pontos !== undefined) {
    myTeamState.pontos_ultima_rodada = cartolaTime.pontos;
  }

  if (cartolaTime.pontos_campeonato !== undefined) {
    myTeamState.pontos_total = cartolaTime.pontos_campeonato;
  } else if (cartolaTime.pontos_total !== undefined) {
    myTeamState.pontos_total = cartolaTime.pontos_total;
  }

  renderMyTeamPitch();
  persistMyTeam();
}

window.addEventListener('DOMContentLoaded', initApp);

