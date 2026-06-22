@echo off
chcp 65001 >nul
REM ── Sincronizza Obsidian con i dati del sito (Firestore). Doppio-click. ──
cd /d "%~dp0\.."
echo Avvio sync Obsidian...
node tools\obsidian-sync.mjs
echo.
echo Premi un tasto per chiudere.
pause >nul
