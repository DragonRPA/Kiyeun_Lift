@echo off
title [KiyeunLift ERP] Stop Agent Daemon

echo ========================================================
echo   KiyeunLift ERP - Stop Local Sidecar Agent
echo ========================================================
echo.

echo [1/2] Terminating KiyeunAgent.exe processes...
powershell -NoProfile -Command "Get-Process -Name KiyeunAgent -ErrorAction SilentlyContinue | Stop-Process -Force"

echo [2/2] Releasing Port 5175...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5175 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo.
echo ========================================================
echo   [SUCCESS] KiyeunAgent daemon has been completely stopped.
echo ========================================================
echo.
pause
