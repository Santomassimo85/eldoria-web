' Avvia il sorvegliante Obsidian SENZA finestra (nascosto).
' Usato dal Task Scheduler al login di Windows.
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\KalEl\Desktop\PortfolioOrpheus\eldoria-web"
' 0 = finestra nascosta, False = non aspettare (parte e si stacca)
sh.Run "node tools\obsidian-watch.mjs", 0, False
