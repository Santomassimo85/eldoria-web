@echo off
chcp 65001 >nul
REM ── Orecchio del Master: ascolta la sessione e apre le note in Obsidian. Doppio-click. ──
cd /d "%~dp0\.."
set "PATH=%PATH%;%ProgramFiles%\nodejs"
node tools\obsidian-ascolto.mjs
pause >nul
