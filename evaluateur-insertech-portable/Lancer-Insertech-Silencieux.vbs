Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

WshShell.Environment("PROCESS")("NODE_ENV") = "production"
WshShell.Environment("PROCESS")("HOST") = "127.0.0.1"

' 1. Arrêter uniquement l'instance précédente de cette application si .server.pid existe
pidFile = scriptDir & "\.server.pid"
portFile = scriptDir & "\.server.port"

If fso.FileExists(pidFile) Then
  On Error Resume Next
  Set tsOld = fso.OpenTextFile(pidFile, 1)
  oldPid = Trim(tsOld.ReadAll)
  tsOld.Close
  If IsNumeric(oldPid) And Len(oldPid) > 0 Then
    WshShell.Run "taskkill /f /pid " & oldPid & " /t", 0, True
  End If
  fso.DeleteFile pidFile, True
  On Error GoTo 0
End If
If fso.FileExists(portFile) Then
  On Error Resume Next
  fso.DeleteFile portFile, True
  On Error GoTo 0
End If
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

' Attente active que le serveur soit prêt à répondre et détection dynamique du port
Dim http, ready, waitCount, targetPort
ready = False
waitCount = 0
targetPort = "3000"

Do While Not ready And waitCount < 60
  WScript.Sleep 500
  waitCount = waitCount + 1

  If fso.FileExists(portFile) Then
    On Error Resume Next
    Set tsPort = fso.OpenTextFile(portFile, 1)
    readPort = Trim(tsPort.ReadAll)
    tsPort.Close
    If IsNumeric(readPort) And Len(readPort) > 0 Then
      targetPort = readPort
    End If
    On Error GoTo 0
  End If

  On Error Resume Next
  Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  http.Open "GET", "http://127.0.0.1:" & targetPort & "/api/version", False
  http.setTimeouts 500, 500, 500, 500
  http.Send
  If Err.Number = 0 Then
    If http.Status = 200 Then
      ready = True
    End If
  End If
  On Error GoTo 0
Loop

Dim edge32, edge64, edgePath
edge32 = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Microsoft\Edge\Application\msedge.exe"
edge64 = WshShell.ExpandEnvironmentStrings("%ProgramFiles%") & "\Microsoft\Edge\Application\msedge.exe"

If fso.FileExists(edge32) Then
  edgePath = edge32
ElseIf fso.FileExists(edge64) Then
  edgePath = edge64
End If

Dim targetUrl
targetUrl = "http://127.0.0.1:" & targetPort

If edgePath <> "" Then
  WshShell.Run """" & edgePath & """ --app=""" & targetUrl & """ --disable-http-cache --disk-cache-size=1 --user-data-dir=""" & WshShell.ExpandEnvironmentStrings("%TEMP%") & "\InsertechApp""", 1, True
Else
  WshShell.Run """" & targetUrl & """", 1, True
End If

' À la fermeture de la fenêtre du navigateur : arrêt gracieux ciblé du PID du serveur
If fso.FileExists(pidFile) Then
  On Error Resume Next
  Set tsEnd = fso.OpenTextFile(pidFile, 1)
  curPid = Trim(tsEnd.ReadAll)
  tsEnd.Close
  If IsNumeric(curPid) And Len(curPid) > 0 Then
    WshShell.Run "taskkill /f /pid " & curPid & " /t", 0, True
  End If
  fso.DeleteFile pidFile, True
  On Error GoTo 0
End If
If fso.FileExists(portFile) Then
  On Error Resume Next
  fso.DeleteFile portFile, True
  On Error GoTo 0
End If
