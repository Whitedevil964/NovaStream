[Setup]
AppName=NovaStream
AppVersion=1.0.0
AppPublisher=NovaStream
AppPublisherURL=https://github.com/NovaStream
DefaultDirName={autopf}\NovaStream
DefaultGroupName=NovaStream
UninstallDisplayIcon={app}\NovaStream.exe
Compression=lzma2
SolidCompression=yes
OutputDir=.
OutputBaseFilename=NovaStream_Setup
SetupIconFile=static\img\logo.ico
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop icon"; GroupDescription: "Additional icons:"; Flags: unchecked

[Files]
Source: "dist\NovaStream.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "C:\Users\Zaid\AppData\Local\Microsoft\WinGet\Packages\DenoLand.Deno_Microsoft.Winget.Source_8wekyb3d8bbwe\deno.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\NovaStream"; Filename: "{app}\NovaStream.exe"
Name: "{autodesktop}\NovaStream"; Filename: "{app}\NovaStream.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\NovaStream.exe"; Description: "Launch NovaStream"; Flags: nowait postinstall skipifsilent
