// =========================================================================
// LENDAS CARTOLA SYNC — Content Script para a Plataforma Lendas
// =========================================================================

// Função para requisitar dados atualizados do time ao background.js e repassar à página
function syncCartolaProfileWithPage() {
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) {
    try {
      chrome.runtime.sendMessage({ type: "CHECK_CARTOLA_AUTH" }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response && response.loggedIn && response.time) {
          window.postMessage({
            type: "LENDAS_CARTOLA_PROFILE_SYNC",
            time: response.time,
            patrimonio: response.patrimonio
          }, "*");
        }
      });
    } catch(e) {}
  }
}

try {
  window.__LENDAS_EXTENSION_INSTALLED__ = true;
  window.postMessage({ type: "LENDAS_EXTENSION_AVAILABLE", version: "1.0.0" }, "*");
  syncCartolaProfileWithPage();
} catch (e) {}

// Escutar ordens de escalação ou pedidos de sincronização enviados pela plataforma web
window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  // Solicitação para sincronizar dados do time logado
  if (event.data && event.data.type === "LENDAS_REQUEST_PROFILE_SYNC") {
    syncCartolaProfileWithPage();
    return;
  }

  if (event.data && event.data.type === "LENDAS_ENVIAR_ESCALACAO") {
    const escalacaoData = event.data.payload;
    console.log("[Lendas Cartola Sync] Recebida escalação para envio:", escalacaoData);

    // Verificar se o runtime da extensão está ativo
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
      window.postMessage({
        type: "LENDAS_ESCALACAO_RESPOSTA",
        success: false,
        message: "A extensão foi recarregada. Por favor, dê F5 nesta página e clique novamente em Time Escalado!"
      }, "*");
      return;
    }

    try {
      chrome.runtime.sendMessage(
        { type: "SALVAR_TIME_CARTOLA", payload: escalacaoData },
        (response) => {
          const lastErr = chrome.runtime.lastError;
          if (lastErr) {
            console.warn("[Lendas Cartola Sync] Aviso de runtime:", lastErr.message);
            window.postMessage({
              type: "LENDAS_ESCALACAO_RESPOSTA",
              success: false,
              message: "Conexão com a extensão atualizada. Dê F5 nesta página e tente novamente!"
            }, "*");
            return;
          }

          console.log("[Lendas Cartola Sync] Resposta da API Cartola:", response);
          window.postMessage({
            type: "LENDAS_ESCALACAO_RESPOSTA",
            success: Boolean(response && response.success),
            message: response ? response.message : "Sem resposta da extensão.",
            data: response ? response.data : null
          }, "*");
        }
      );
    } catch (err) {
      console.warn("[Lendas Cartola Sync] Exceção tratada:", err);
      window.postMessage({
        type: "LENDAS_ESCALACAO_RESPOSTA",
        success: false,
        message: "Por favor, dê F5 nesta página e tente novamente."
      }, "*");
    }
  }
});

