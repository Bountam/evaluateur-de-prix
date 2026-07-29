Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Définir le répertoire de travail courant sur le dossier du script
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

WshShell.Environment("PROCESS")("NODE_ENV") = "production"
WshShell.Environment("PROCESS")("HOST") = "127.0.0.1"

' 0. Nettoyer et libérer le port 3000 avant démarrage
On Error Resume Next
WshShell.Run "taskkill /f /im node.exe", 0, True
On Error GoTo 0
WScript.Sleep 500

If fso.FileExists(scriptDir & "\chromium\chrome.exe") Then
  WshShell.Environment("PROCESS")("CHROMIUM_PATH") = scriptDir & "\chromium\chrome.exe"
End If

' Recherche intelligente de l'exécutable node.exe
Dim nodeCmd
nodeCmd = ""

If fso.FileExists(scriptDir & "\node.exe") Then
  nodeCmd = """" & scriptDir & "\node.exe"""
ElseIf fso.FileExists(scriptDir & "\node\node.exe") Then
  nodeCmd = """" & scriptDir & "\node\node.exe"""
Else
  Dim pFiles, pFilesX86, localAppData
  pFiles = WshShell.ExpandEnvironmentStrings("%ProgramFiles%")
  pFilesX86 = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%")
  localAppData = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%")

  If fso.FileExists(pFiles & "\nodejs\node.exe") Then
    nodeCmd = """" & pFiles & "\nodejs\node.exe"""
  ElseIf fso.FileExists(pFilesX86 & "\nodejs\node.exe") Then
    nodeCmd = """" & pFilesX86 & "\nodejs\node.exe"""
  ElseIf fso.FileExists(localAppData & "\Programs\node\node.exe") Then
    nodeCmd = """" & localAppData & "\Programs\node\node.exe"""
  Else
    nodeCmd = "node"
  End If
End If

' 1. Démarrer le serveur local en tâche de fond (0 = masqué, zéro fenêtre de console)
On Error Resume Next
WshShell.Run nodeCmd & " """ & scriptDir & "\dist\server.js""", 0, False
If Err.Number <> 0 Then
  MsgBox "Impossible de démarrer le serveur d'évaluation Insertech." & vbCrLf & vbCrLf & _
         "Raison : L'exécutable Node.js est introuvable." & vbCrLf & _
         "Veuillez copier 'node.exe' dans ce dossier portable ou installer Node.js sur le poste.", 16, "Évaluateur Insertech - Erreur Démarrage"
  WScript.Quit 1
End If
On Error GoTo 0

' Attendre activement que le serveur Node.js réponde sur http://127.0.0.1:3000
Dim xmlHttp, isReady, tryCount
Set xmlHttp = CreateObject("MSXML2.ServerXMLHTTP")
isReady = False
tryCount = 0

Do While tryCount < 40 And Not isReady
  On Error Resume Next
  xmlHttp.open "GET", "http://127.0.0.1:3000/api/sources", False
  xmlHttp.send ""
  If Err.Number = 0 Then
    isReady = True
  Else
    Err.Clear
    WScript.Sleep 250
  End If
  On Error GoTo 0
  tryCount = tryCount + 1
Loop

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
  WshShell.Run """" & edgePath & """ --app=http://127.0.0.1:3000 --disable-http-cache --disk-cache-size=1 --user-data-dir=""" & WshShell.ExpandEnvironmentStrings("%TEMP%") & "\InsertechApp""", 1, True
Else
  WshShell.Run "http://127.0.0.1:3000", 1, True
End If

' 3. Dès que l'utilisateur ferme la fenêtre GUI ➔ Arrêter immédiatement le service Node local !
On Error Resume Next
WshShell.Run "taskkill /f /im node.exe", 0, True
On Error GoTo 0
