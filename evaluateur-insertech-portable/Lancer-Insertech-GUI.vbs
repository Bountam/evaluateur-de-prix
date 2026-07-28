Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

WshShell.Environment("PROCESS")("NODE_ENV") = "production"
WshShell.Environment("PROCESS")("HOST") = "127.0.0.1"

If fso.FileExists(WshShell.CurrentDirectory & "\chromium\chrome.exe") Then
  WshShell.Environment("PROCESS")("CHROMIUM_PATH") = WshShell.CurrentDirectory & "\chromium\chrome.exe"
End If

' 1. Démarrer le serveur local en tâche de fond (0 = masqué, zéro fenêtre de console)
WshShell.Run "node dist/server.js", 0, False
WScript.Sleep 1800

' 2. Lancer la fenêtre d'application GUI dédiée et attendre la fermeture par l'utilisateur
Dim edge32, edge64, edgePath
edge32 = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Microsoft\Edge\Application\msedge.exe"
edge64 = WshShell.ExpandEnvironmentStrings("%ProgramFiles%") & "\Microsoft\Edge\Application\msedge.exe"

If fso.FileExists(edge32) Then
  edgePath = edge32
ElseIf fso.FileExists(edge64) Then
  edgePath = edge64
End If

If edgePath <> "" Then
  ' Le paramètre True demande à VBScript d'attendre la fermeture de la fenêtre par l'utilisateur
  WshShell.Run """" & edgePath & """ --app=http://127.0.0.1:3000 --user-data-dir=""" & WshShell.ExpandEnvironmentStrings("%TEMP%") & "\InsertechApp""", 1, True
Else
  WshShell.Run "http://127.0.0.1:3000", 1, True
End If

' 3. Dès que l'utilisateur ferme la fenêtre GUI ➔ Arrêter immédiatement le service Node local !
WshShell.Run "taskkill /f /im node.exe", 0, True
