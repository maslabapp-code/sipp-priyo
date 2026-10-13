Set objFSO = CreateObject("Scripting.FileSystemObject")
Set objShell = CreateObject("WScript.Shell")
strScriptDir = objFSO.GetParentFolderName(WScript.ScriptFullName)
strBat = objFSO.BuildPath(strScriptDir, "start-app.bat")
objShell.Run """" & strBat & """", 0, False
