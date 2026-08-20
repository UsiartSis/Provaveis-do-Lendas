@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul 2>&1
title Instalador - Lendas do Cartola FC 2026

echo ======================================================================
echo      INSTALADOR AUTOMATICO - LENDAS DO CARTOLA FC 2026
echo      Sistema de Escalacoes e Scouts do Brasileirao Serie A
echo ======================================================================
echo.

cd /d "%~dp0"

:: Verificar se o usuario executou de dentro do ZIP sem extrair
echo "%~dp0" | findstr /i "Temp" >nul 2>nul
if %errorlevel% equ 0 (
    echo [ATENCAO] Parece que voce abriu o arquivo direto de dentro do arquivo .ZIP!
    echo Para funcionar, voce precisa primeiro EXTRAIR (Descompactar) a pasta:
    echo  1. Clique com botao direito no arquivo .zip que voce baixou
    echo  2. Escolha "Extrair Tudo..."
    echo  3. Abra a pasta extraida e execute este arquivo novamente.
    echo.
    echo ======================================================================
    pause
    exit /b 1
)

echo Este instalador ira:
echo  [1] Verificar se o Python esta instalado
echo  [2] Baixar e instalar o Python automaticamente se nao tiver
echo  [3] Criar atalho na Area de Trabalho
echo  [4] Iniciar o sistema e abrir no seu navegador
echo.
echo Pressione qualquer tecla para comecar...
pause > nul
echo.

:: ---------- Detectar Python ----------
set "PYTHON_EXE="

echo [*] Verificando se o Python ja esta instalado no computador...

where py >nul 2>nul
if %errorlevel% equ 0 (
    set "PYTHON_EXE=py"
    goto :PYTHON_FOUND
)

where python >nul 2>nul
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('python --version 2^>^&1') do set "PYVER=%%i"
    echo [OK] !PYVER! detectado no sistema.
    set "PYTHON_EXE=python"
    goto :PYTHON_FOUND
)

where python3 >nul 2>nul
if %errorlevel% equ 0 (
    set "PYTHON_EXE=python3"
    goto :PYTHON_FOUND
)

if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    goto :PYTHON_FOUND
)
if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
    set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    goto :PYTHON_FOUND
)
if exist "%LOCALAPPDATA%\Programs\Python\Python310\python.exe" (
    set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
    goto :PYTHON_FOUND
)
if exist "C:\Python312\python.exe" (
    set "PYTHON_EXE=C:\Python312\python.exe"
    goto :PYTHON_FOUND
)
if exist "C:\Python311\python.exe" (
    set "PYTHON_EXE=C:\Python311\python.exe"
    goto :PYTHON_FOUND
)

for %%V in (Python314 Python313 Python3140 Python3130 Python3120 Python3110) do (
    if exist "%LOCALAPPDATA%\Programs\Python\%%V\python.exe" (
        set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\%%V\python.exe"
        goto :PYTHON_FOUND
    )
)

:: ---------- Python nao encontrado — Instalar automaticamente ----------
echo [!] Python nao encontrado. Iniciando instalacao automatica...
echo.

:: 1. Tentar via winget primeiro se disponivel
where winget >nul 2>nul
if %errorlevel% equ 0 (
    echo [*] Tentando instalar Python via Windows Package Manager (winget)...
    winget install --id Python.Python.3.12 -e --silent --accept-package-agreements --accept-source-agreements
    
    set "PATH=%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts;%PATH%"
    if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
        set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
        echo [OK] Python instalado com sucesso via winget!
        goto :PYTHON_FOUND
    )
)

:: 2. Fallback: baixar instalador oficial diretamente do python.org
echo [*] Baixando instalador oficial do Python 3.12 (aguarde alguns instantes)...
set "PYTHON_URL=https://www.python.org/ftp/python/3.12.9/python-3.12.9-amd64.exe"
set "PYTHON_INSTALLER=%TEMP%\python-installer-cartola.exe"

where curl >nul 2>nul
if %errorlevel% equ 0 (
    curl -L -s -o "%PYTHON_INSTALLER%" "%PYTHON_URL%"
)

if not exist "%PYTHON_INSTALLER%" (
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('%PYTHON_URL%', '%PYTHON_INSTALLER%')" 2>nul
)

if not exist "%PYTHON_INSTALLER%" (
    echo.
    echo [*] Abrindo o download oficial do Python no seu navegador...
    start "" "%PYTHON_URL%"
    echo.
    echo ======================================================================
    echo  INSTRUCAO SIMPLES:
    echo  1. Execute o instalador do Python que acabou de baixar no navegador.
    echo  2. MUITO IMPORTANTE: Marque a caixinha "Add python.exe to PATH"
    echo  3. Clique em "Install Now"
    echo  4. Apos terminar, feche esta janela e execute INSTALAR_E_RODAR.bat novamente!
    echo ======================================================================
    echo.
    pause
    exit /b 1
)

echo [*] Instalando o Python... (Aguarde a barra de progresso terminar)
start /wait "" "%PYTHON_INSTALLER%" /passive InstallAllUsers=0 PrependPath=1 SimpleInstall=1 Include_test=0 Include_pip=1

del "%PYTHON_INSTALLER%" 2>nul

:: Atualizar PATH na sessao
set "PATH=%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts;%PATH%"

if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    echo [OK] Python 3.12 instalado com sucesso!
    goto :PYTHON_FOUND
)

:: Testar comando python novamente
where python >nul 2>nul
if %errorlevel% equ 0 (
    set "PYTHON_EXE=python"
    goto :PYTHON_FOUND
)

echo.
echo [AVISO] O instalador do Python foi executado. 
echo Caso nao tenha finalizado, instale manualmente pelo site oficial:
echo https://www.python.org/downloads/ (Marque "Add python.exe to PATH")
echo.
pause
exit /b 1

:PYTHON_FOUND
echo.
echo [OK] Python pronto para uso!
echo.

:: ---------- Verificar arquivos do sistema ----------
if not exist "server\server.py" (
    echo [ERRO] O arquivo server\server.py nao foi encontrado nesta pasta.
    echo Verifique se voce extraiu todos os arquivos do sistema juntos.
    echo.
    pause
    exit /b 1
)

if not exist "server\data" (
    mkdir "server\data" 2>nul
)

:: ---------- Criar atalho na Area de Trabalho ----------
echo [*] Criando atalho na Area de Trabalho...
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\Lendas Cartola 2026.lnk"
set "BAT_PATH=%~dp0INICIAR_CARTOLA.bat"

powershell -Command "& {$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = '%BAT_PATH%'; $s.WorkingDirectory = '%~dp0'; $s.Description = 'Lendas do Cartola 2026'; $s.Save()}" 2>nul

if exist "%SHORTCUT_PATH%" (
    echo [OK] Atalho criado: "Lendas Cartola 2026" na sua Area de Trabalho!
)

echo.
echo ======================================================================
echo  TUDO PRONTO! O sistema vai iniciar agora.
echo  Ele abrira automaticamente no seu navegador em:
echo    http://localhost:8080
echo.
echo  Nas proximas vezes, basta clicar no atalho da Area de Trabalho!
echo ======================================================================
echo.

timeout /t 2 /nobreak > nul

start "" http://localhost:8080
!PYTHON_EXE! server\server.py

echo.
echo Servidor encerrado.
pause
