@echo off
echo Lancement de ParleGPT...
echo Verification de Python...

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERREUR: Python n'est pas detecte !
    echo Veuillez installer Python depuis https://www.python.org/downloads/
    echo Cochez bien la case "Add Python to PATH" pendant l'installation.
    pause
    exit /b
)

echo Installation des dependances...
pip install -r requirements.txt

echo Demarrage du serveur...
start http://127.0.0.1:5000
python app.py
pause
