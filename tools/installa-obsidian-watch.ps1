# Installa (o reinstalla) l'avvio automatico del sorvegliante Obsidian:
# operazione pianificata "Eldoria - Sorvegliante Obsidian" all'accesso a Windows,
# per l'utente corrente, senza diritti di amministratore. Lo avvia anche subito.
#   powershell -ExecutionPolicy Bypass -File tools\installa-obsidian-watch.ps1
$name = "Eldoria - Sorvegliante Obsidian"
$vbs = Join-Path $PSScriptRoot "start-watch-hidden.vbs"
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $name
Write-Host "Installato: '$name' parte a ogni accesso a Windows (ed e' gia' partito)."
