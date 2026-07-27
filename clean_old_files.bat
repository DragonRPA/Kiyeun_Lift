@echo off
chcp 65001 > nul
echo ========================================================
echo [기연리프트] Old 레거시 파일 10종 일괄 정리 스크립트
echo ========================================================
echo.
echo 삭제 대상:
echo  - src\config\menuConfig.ts
echo  - src\config\assetStatusConfig.ts
echo  - src\pages\UsersPermissions.tsx
echo  - src\pages\DepreciationExecution.tsx
echo  - src\pages\OutboundInspections.tsx
echo  - src\pages\SmartDispatch.tsx
echo  - src\pages\SmartReturn.tsx
echo  - src\pages\RentAssets.tsx
echo  - src\pages\AssetHistory.tsx
echo  - src\pages\AssetAssignment.tsx
echo.

if exist "src\config\menuConfig.ts" del /f /q "src\config\menuConfig.ts"
if exist "src\config\assetStatusConfig.ts" del /f /q "src\config\assetStatusConfig.ts"
if exist "src\pages\UsersPermissions.tsx" del /f /q "src\pages\UsersPermissions.tsx"
if exist "src\pages\DepreciationExecution.tsx" del /f /q "src\pages\DepreciationExecution.tsx"
if exist "src\pages\OutboundInspections.tsx" del /f /q "src\pages\OutboundInspections.tsx"
if exist "src\pages\SmartDispatch.tsx" del /f /q "src\pages\SmartDispatch.tsx"
if exist "src\pages\SmartReturn.tsx" del /f /q "src\pages\SmartReturn.tsx"
if exist "src\pages\RentAssets.tsx" del /f /q "src\pages\RentAssets.tsx"
if exist "src\pages\AssetHistory.tsx" del /f /q "src\pages\AssetHistory.tsx"
if exist "src\pages\AssetAssignment.tsx" del /f /q "src\pages\AssetAssignment.tsx"

echo.
echo [성공] 10개 Old 레거시 파일 삭제 완료!
echo 신규 언더바(_) 파일명만 유지됩니다.
echo.
pause
