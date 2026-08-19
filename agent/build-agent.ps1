# agent/build-agent.ps1
# (주)기연리프트 로컬 에이전트 원클릭 컴파일 & 서명 & 동기화 스크립트

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }
$rootDir = Split-Path -Parent $scriptDir

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  🏢 (주)기연리프트 로컬 에이전트(KiyeunAgent.exe) 컴파일" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. esbuild 번들링
Write-Host "1. esbuild 번들링 진행 중..." -ForegroundColor Yellow
cmd /c "npx esbuild `"$scriptDir\agent.js`" --bundle --platform=node --outfile=`"$scriptDir\agent-bundle.js`""

# 2. Node SEA Prep Blob 생성
Write-Host "2. Node.js SEA Blob 생성 중..." -ForegroundColor Yellow
cmd /c "node --experimental-sea-config `"$scriptDir\sea-config.json`""

# 3. node.exe 복제
Write-Host "3. node.exe 베이스 바이너리 복제 중..." -ForegroundColor Yellow
$nodeExe = (Get-Command node).Source
Copy-Item $nodeExe (Join-Path $scriptDir "KiyeunAgent.exe") -Force

# 4. postject SEA Blob 주입
Write-Host "4. postject 바이너리 주입 중..." -ForegroundColor Yellow
cmd /c "npx postject `"$scriptDir\KiyeunAgent.exe`" NODE_SEA_BLOB `"$scriptDir\sea-prep.blob`" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"

# 5. 디지털 서명 및 public/downloads 동기화
Write-Host "5. 디지털 서명 및 프로젝트 배포 폴더 동기화..." -ForegroundColor Yellow
powershell -ExecutionPolicy Bypass -File (Join-Path $scriptDir "sign-agent.ps1")

Write-Host "========================================================" -ForegroundColor Green
Write-Host "  ✅ 최신 KiyeunAgent.exe 컴파일 & 서명 & 동기화 완료!" -ForegroundColor Green
Write-Host "  📁 agent\KiyeunAgent.exe" -ForegroundColor White
Write-Host "  📁 public\downloads\KiyeunAgent.exe" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Green
