# Registers the PeterShip printer agent as a Task Scheduler task that starts at sign-in and restarts
# if it stops. Run from the printer-agent folder in PowerShell:  powershell -ExecutionPolicy Bypass -File install-windows.ps1
# Remove with:  powershell -ExecutionPolicy Bypass -File install-windows.ps1 -Uninstall
param([switch]$Uninstall)
$name = 'PeterShip printer agent'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
if ($Uninstall) { Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue; Write-Host "Removed $name"; exit }
$node = (Get-Command node -ErrorAction Stop).Source
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$node`" `"$here\agent.mjs`" >> `"$here\agent.log`" 2>&1" -WorkingDirectory $here
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 3650) -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $name
Write-Host "Installed and started '$name'. Log: $here\agent.log"
