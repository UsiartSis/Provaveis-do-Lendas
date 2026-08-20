# ⚽ Lendas do Cartola Prováveis 2026 — Guia de Deploy e Instalação

---

## ⚡ Opção 1: Deploy na Vercel (Gratuito)

O projeto já está configurado com `vercel.json` e Serverless Functions em Python (`api/index.py`).

### Como publicar na Vercel:

1. **Envie o projeto para o GitHub**:
   - Crie um repositório no seu GitHub e faça o upload/push desta pasta.
2. **Acesse a Vercel**:
   - Entre em [vercel.com](https://vercel.com) e faça login com sua conta do GitHub.
3. **Importar Projeto**:
   - Clique em **"Add New..."** → **"Project"**.
   - Selecione o repositório do Cartola.
   - Clique em **"Deploy"** (a Vercel detectará automaticamente o `vercel.json`).
4. **Pronto!** Em menos de 1 minuto seu site estará no ar com link `https://seu-projeto.vercel.app`.

> [!NOTE]
> **Como a Vercel funciona com Python:**
> - A Vercel roda o backend como **Serverless Functions** (executadas sob demanda).
> - Todas as consultas (`/api/atletas`, `/api/partidas`, `/api/mercado/status`, scouts, escalações) funcionam perfeitamente.
> - O sistema de arquivos da Vercel é somente-leitura (efêmero). Para salvar edições permanentes de admin (mover jogadores no campinho ou alterar fotos), as alterações locais devem ser enviadas via Git ou o sistema pode ser rodado no Render/Local.

---

## 🚀 Opção 2: Deploy no Render.com (Servidor Contínuo com Persistência)

1. Entre em [render.com](https://render.com) e crie uma conta gratuita.
2. Clique em **"New +"** → **"Web Service"** e conecte seu repositório do GitHub.
3. Configurações:
   - **Environment**: `Python`
   - **Start Command**: `python server/server.py`
4. Clique em **"Create Web Service"**.

---

## 💻 Opção 3: Rodar ou Distribuir para Qualquer Computador Windows (1-Clique)

Para rodar localmente ou enviar para outra pessoa usar no Windows:

1. Dê dois cliques em **`INSTALAR_E_RODAR.bat`**.
2. O script configura o Python automaticamente se necessário, cria o atalho na Área de Trabalho e abre o navegador em `http://localhost:8080`.

---

## 🔐 Credenciais de Acesso

- **Usuário Comum**: `Lendas1234` (sem senha)
- **Administrador**: `Lendas` / Senha: `458021` (Painel `/admin.html`)
