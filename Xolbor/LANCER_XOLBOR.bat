@echo off
setlocal
cd /d "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Installe Node.js 24 LTS puis relance ce fichier.
  pause
  exit /b 1
)
set "HOST=127.0.0.1"
set "PORT=5897"
set "NODE_ENV=development"
set "DATABASE_PATH=%~dp0runtime\xolbor.sqlite"
echo Ouvre http://127.0.0.1:5897 dans ton navigateur.
node server.js
pause
