' Avvia il sorvegliante Obsidian SENZA finestra (nascosto).
' Usato dall'operazione pianificata al login di Windows (installa-obsidian-watch.ps1).
' Niente percorsi fissi: la cartella del progetto e' quella sopra a questo file.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
sh.CurrentDirectory = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
' node: quello installato di sistema, altrimenti quello nel PATH
nodeExe = sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe"
If Not fso.FileExists(nodeExe) Then nodeExe = "node"
' 0 = finestra nascosta, False = non aspettare (parte e si stacca)
sh.Run """" & nodeExe & """ tools\obsidian-watch.mjs", 0, False
