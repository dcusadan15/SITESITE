@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -Command "$ErrorActionPreference='Stop'; $taskNode=(Get-Command node -ErrorAction SilentlyContinue).Source; if(!$taskNode){$taskNode=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'}; if(!(Test-Path -LiteralPath $taskNode)){Write-Host 'Node.js not found. Run this on the same PC as Codex, or install Node.js.'; exit 1}; $taskPreviousToken=$env:TELEGRAM_BOT_TOKEN; $taskSecret=Read-Host 'Paste token from BotFather (input hidden)' -AsSecureString; $taskPointer=[IntPtr]::Zero; $taskExit=1; try{$taskPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecret); $env:TELEGRAM_BOT_TOKEN=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPointer); [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPointer); $taskPointer=[IntPtr]::Zero; & $taskNode 'start-local.mjs'; $taskExit=$LASTEXITCODE}finally{if($taskPointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPointer)}; $env:TELEGRAM_BOT_TOKEN=$taskPreviousToken; $taskSecret.Dispose()}; exit $taskExit"
echo.
pause
