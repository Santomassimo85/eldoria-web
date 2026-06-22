@echo off
chcp 65001 >nul
title Colora il grafo di Obsidian
echo ============================================================
echo  COLORA IL GRAFO DI OBSIDIAN
echo ============================================================
echo.
echo  Obsidian deve essere CHIUSO completamente (tutte le finestre),
echo  altrimenti sovrascrive i colori.
echo.
echo  Chiudi Obsidian, poi premi un tasto per continuare...
pause >nul

:waitloop
tasklist /fi "imagename eq Obsidian.exe" 2>nul | find /i "Obsidian.exe" >nul
if not errorlevel 1 (
  echo  [!] Obsidian e' ancora aperto. Chiudilo del tutto. Riprovo tra 3s...
  timeout /t 3 >nul
  goto waitloop
)

cd /d "%~dp0\.."
echo  Applico i gruppi di colore...
node tools\obsidian-sync.mjs --graph --no-ai
echo.
echo  FATTO. Ora riapri Obsidian e apri il grafo: i colori ci saranno.
echo.
pause >nul
