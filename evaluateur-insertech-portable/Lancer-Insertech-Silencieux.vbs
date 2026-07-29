Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Résolution dynamique du dossier d'exécution exact (résout l'erreur 80070002 si lancé depuis un raccourci ou sous-dossier)
Dim scriptDir
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

WshShell.Environment("PROCESS")("NODE_ENV") = "production"
WshShell.Environment("PROCESS")("HOST") = "127.0.0.1"

If fso.FileExists(scriptDir & "\chromium\chrome.exe") Then
  WshShell.Environment("PROCESS")("CHROMIUM_PATH") = scriptDir & "\chromium\chrome.exe"
End If

' 1. Recherche du serveur compilé dist\server.js
Dim serverJsPath
serverJsPath = scriptDir & "\dist\server.js"
If Not fso.FileExists(serverJsPath) Then
  MsgBox "Erreur d'initialisation : Le fichier compilé dist\server.js est introuvable." & vbCrLf & vbCrLf & "Veuillez vous assurer d'avoir téléchargé la version portable pré-compilée (evaluateur-insertech-portable.zip).", 16, "Évaluateur Insertech"
  WScript.Quit 1
End If

' 2. Détermination de la commande Node.js (Node local portable ou Node système)
Dim nodeCmd
If fso.FileExists(scriptDir & "\node.exe") Then
  nodeCmd = """" & scriptDir & "\node.exe"""
Else
  nodeCmd = "node"
End If

' 3. Démarrer le serveur local en arrière-plan (0 = masqué, zéro fenêtre de console)
On Error Resume Next
WshShell.Run nodeCmd & " """ & serverJsPath & """", 0, False
If Err.Number <> 0 Then
  MsgBox "Erreur lors du démarrage du serveur Node.js (" & Err.Description & ")." & vbCrLf & vbCrLf & "Veuillez vous assurer que Node.js est installé sur cet ordinateur ou inclus dans le dossier portable.", 16, "Évaluateur Insertech"
  WScript.Quit 1
End If
On Error GoTo 0

WScript.Sleep 2000

' 4. Lancer la fenêtre d'application GUI dédiée et attendre la fermeture par l'utilisateur
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

' 5. Dès que l'utilisateur ferme la fenêtre GUI ➔ Arrêter immédiatement le service Node local !
On Error Resume Next
WshShell.Run "taskkill /f /im node.exe", 0, True
On Error GoTo 0
