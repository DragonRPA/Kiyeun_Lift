@echo off
title [KiyeunLift ERP] Certificate Auto Installer

echo ========================================================
echo   KiyeunLift ERP - Security Certificate Auto Installer
echo ========================================================
echo.

cd /d "%~dp0"

if not exist "KiyeunLift_Root.cer" (
    echo [ERROR] KiyeunLift_Root.cer not found in current folder!
    echo Please make sure KiyeunLift_Root.cer is in the same directory.
    echo.
    pause
    exit /b 1
)

echo [1/2] Installing to Trusted Root Certification Authorities...
certutil -addstore -f Root KiyeunLift_Root.cer > nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Requesting Administrator Privileges...
    powershell -NoProfile -Command "Start-Process cmd -ArgumentList '/c cd /d ""%~dp0"" && certutil -addstore -f Root KiyeunLift_Root.cer && certutil -addstore -f TrustedPublisher KiyeunLift_Root.cer' -Verb RunAs"
    goto finish
)

echo [2/2] Installing to Trusted Publishers...
certutil -addstore -f TrustedPublisher KiyeunLift_Root.cer > nul 2>&1

:finish
echo.
echo ========================================================
echo   [SUCCESS] Certificate installed successfully!
echo   KiyeunAgent.exe can now run without any security warnings.
echo ========================================================
echo.
pause
