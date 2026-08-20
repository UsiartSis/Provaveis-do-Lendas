document.addEventListener("DOMContentLoaded", () => {
  const authStatusEl = document.getElementById("auth-status");
  const timeNameEl = document.getElementById("time-name");
  const serverStatusEl = document.getElementById("server-status");
  const serverNoticeEl = document.getElementById("server-notice");
  const btnOpenCartola = document.getElementById("btn-open-cartola");
  const btnOpenApp = document.getElementById("btn-open-app");

  // 1. Checar autenticação com o Cartola
  chrome.runtime.sendMessage({ type: "CHECK_CARTOLA_AUTH" }, (res) => {
    if (res && res.loggedIn) {
      authStatusEl.innerHTML = '<span class="status-dot green"></span>Conectado';
      if (res.time && res.time.nome) {
        timeNameEl.textContent = res.time.nome;
      } else {
        timeNameEl.textContent = "Conta Globo Identificada ✔";
      }
    } else {
      authStatusEl.innerHTML = '<span class="status-dot red"></span>Não logado';
      timeNameEl.textContent = "Faça login no Cartola";
    }
  });

  // 2. Checar se o servidor local está ligado
  fetch("http://localhost:8080/api", { method: "GET" })
    .then(r => {
      if (r.ok) {
        serverStatusEl.innerHTML = '<span class="status-dot green"></span>Online (8080)';
        serverNoticeEl.style.display = "none";
      } else {
        throw new Error();
      }
    })
    .catch(() => {
      serverStatusEl.innerHTML = '<span class="status-dot yellow"></span>Desligado';
      serverNoticeEl.style.display = "block";
    });

  // URL Oficial da SPA do Cartola FC (evita erro 404 do nginx)
  btnOpenCartola.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://cartola.globo.com/" });
  });

  btnOpenApp.addEventListener("click", () => {
    chrome.tabs.create({ url: "http://localhost:8080" });
  });
});

