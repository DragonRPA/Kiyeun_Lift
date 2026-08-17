@echo off
chcp 65001 > nul
title [기연리프트] 로컬 사이드카 에이전트 데몬

echo ====================================================
echo  🏢 (주)기연리프트 전사 ERP 로컬 사이드카 에이전트
echo  📂 작동 표준 경로: C:\KiyeunAgent\
echo ====================================================
echo.

if not exist "C:\KiyeunAgent" mkdir "C:\KiyeunAgent"
if not exist "C:\KiyeunAgent\문서고" mkdir "C:\KiyeunAgent\문서고"

echo  📡 로그인 아이디를 입력하세요 (기본값: admin):
set /p AGENT_CALLSIGN="콜사인 [엔터 치면 admin]: "
if "%AGENT_CALLSIGN%"=="" set AGENT_CALLSIGN=admin

set PORT=5175
echo.
echo  🚀 에이전트 시작 중... (콜사인: %AGENT_CALLSIGN%, 포트: %PORT%)
echo  문서는 C:\KiyeunAgent\문서고\ 에 자동 보관됩니다.
echo  창을 닫지 마시고 최소화해 두시면 백그라운드에서 자동 가동됩니다.
echo.

node agent.js

pause
