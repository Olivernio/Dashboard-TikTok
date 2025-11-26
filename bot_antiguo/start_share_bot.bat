@echo off
echo ========================================
echo   Share Bot Experimental TikTok Live
echo ========================================
echo.

cd "%~dp0"

echo Usando el venv del proyecto...
"..\venv_project\Scripts\python.exe" share_capture_experimental.py

pause

