@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul 2>&1
title Servidor Lendas do Cartola FC 2026

echo ======================================================================
echo      SISTEMA LENDAS DO CARTOLA 2026 - API + WEB
echo ======================================================================
echo.

cd /d "%~dp0"

:: ---------- Detectar Python ----------
set "PYTHON_EXE="

where py >nul 2>nul
if %errorlevel% equ 0 (
    set "PYTHON_EXE=py"
    goto :FOUND
)

where python >nul 2>nul
if %errorlevel% equ 0 (
    set "PYTHON_EXE=python"
    goto :FOUND
)

where python3 >nul 2>nul
if %errorlevel% equ 0 (
    set "PYTHON_EXE=python3"
    goto :FOUND
)

if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    goto :FOUND
)
if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
    set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    goto :FOUND
)
if exist "%LOCALAPPDATA%\Programs\Python\Python310\python.exe" (
    set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
    goto :FOUND
)
if exist "C:\Python312\python.exe" (
    set "PYTHON_EXE=C:\Python312\python.exe"
    goto :FOUND
)
if exist "C:\Python311\python.exe" (
    set "PYTHON_EXE=C:\Python311\python.exe"
    goto :FOUND
)
if exist "C:\Python310\python.exe" (
    set "PYTHON_EXE=C:\Python310\python.exe"
    goto :FOUND
)

for %%V in (Python314 Python313 Python3140 Python3130 Python3120 Python3110) do (
    if exist "%LOCALAPPDATA%\Programs\Python\%%V\python.exe" (
        set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\%%V\python.exe"
        goto :FOUND
    )
)

echo [ERRO] Python nao encontrado!
echo.
echo Execute o arquivo INSTALAR_E_RODAR.bat para instalar automaticamente.
echo Ou baixe o Python em: https://www.python.org/downloads/
echo.
pause
exit /b 1

:FOUND
echo [OK] Python encontrado: !PYTHON_EXE!
echo [*] Iniciando servidor na porta 8080...
echo [*] Abrindo navegador em: http://localhost:8080
echo.
echo Para encerrar o servidor pressione CTRL+C
echo.
start "" http://localhost:8080
!PYTHON_EXE! server\server.py

pause
