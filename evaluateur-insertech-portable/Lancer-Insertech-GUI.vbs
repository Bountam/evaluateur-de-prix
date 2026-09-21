Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

WshShell.Environment("PROCESS")("NODE_ENV") = "production"
WshShell.Environment("PROCESS")("HOST") = "127.0.0.1"

On Error Resume Next
WshShell.Run "taskkill /f /im node.exe", 0, True
On Error GoTo 0
WScript.Sleep 500

If fso.FileExists(scriptDir & "\chromium\chrome.exe") Then
  WshShell.Environment("PROCESS")("CHROMIUM_PATH") = scriptDir & "\chromium\chrome.exe"
End If

Dim nodeCmd
nodeCmd = ""

If fso.FileExists(scriptDir & "\node.exe") Then
  nodeCmd = """" & scriptDir & "\node.exe"""
Else
  nodeCmd = "node"
End If

On Error Resume Next
WshShell.Run nodeCmd & " """ & scriptDir & "\dist\server.js""", 0, False
If Err.Number <> 0 Then
  MsgBox "Impossible de démarrer le serveur d'évaluation Insertech." & vbCrLf & vbCrLf & _
         "Raison : L'exécutable Node.js est introuvable." & vbCrLf & _
         "Veuillez copier 'node.exe' dans ce dossier portable ou installer Node.js sur le poste.", 16, "Évaluateur Insertech - Erreur Démarrage"
  WScript.Quit 1
End If
WScript.Sleep 800

Dim edge32, edge64, edgePath
edge32 = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Microsoft\Edge\Application\msedge.exe"
edge64 = WshShell.ExpandEnvironmentStrings("%ProgramFiles%") & "\Microsoft\Edge\Application\msedge.exe"

If fso.FileExists(edge32) Then
  edgePath = edge32
ElseIf fso.FileExists(edge64) Then
  edgePath = edge64
End If

Dim targetUrl
targetUrl = "http://127.0.0.1:3000"

If edgePath <> "" Then
  WshShell.Run """" & edgePath & """ --app=""" & targetUrl & """ --disable-http-cache --disk-cache-size=1 --user-data-dir=""" & WshShell.ExpandEnvironmentStrings("%TEMP%") & "\InsertechApp""", 1, True
Else
  WshShell.Run """" & targetUrl & """", 1, True
End If

On Error Resume Next
WshShell.Run "taskkill /f /im node.exe", 0, True
On Error GoTo 0
