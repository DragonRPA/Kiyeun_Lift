@echo off
chcp 65001 > nul
title [기연리프트] 사내 보안 인증서 원클릭 자동 등록기

echo ========================================================
echo  🏢 (주)기연리프트 전사 ERP 사내 코드서명 인증서 등록
echo ========================================================
echo.

cd /d "%~dp0"

if not exist "KiyeunLift_Root.cer" (
    echo ❌ KiyeunLift_Root.cer 파일을 찾을 수 없습니다.
    echo    배치 파일과 같은 폴더에 인증서 파일이 있어야 합니다.
    echo.
    pause
    exit /b 1
)

echo  🔏 [1/2] 신뢰할 수 있는 루트 인증 기관에 등록 중...
certutil -addstore -f "Root" "KiyeunLift_Root.cer" > nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️ 관리자 권한으로 다시 시도합니다...
    powershell -Command "Start-Process cmd -ArgumentList '/c cd /d %~dp0 && certutil -addstore -f Root KiyeunLift_Root.cer && certutil -addstore -f TrustedPublisher KiyeunLift_Root.cer' -Verb RunAs"
    goto finish
)

echo  🔏 [2/2] 신뢰할 수 있는 게시자에 등록 중...
certutil -addstore -f "TrustedPublisher" "KiyeunLift_Root.cer" > nul 2>&1

:finish
echo.
echo ========================================================
echo  ✅ (주)기연리프트 전사 보안 인증서가 성공적으로 등록되었습니다!
echo  이제 KiyeunAgent.exe 가 어떠한 보안 경고 없이 즉시 실행됩니다.
echo ========================================================
echo.
pause
