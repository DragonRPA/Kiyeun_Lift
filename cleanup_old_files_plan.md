# [안내 및 이력] Old 파편화 파일 정리 계획서 (Cleanup Plan for Legacy Files)

## 1. 개요 및 목적
사용자 명명 규칙 글로벌 개발 정책 제10항(`DB/변수명 언더바 절대 금지 & 파일명 언더바 적극 사용`) 표준 적용에 따라, 기존 파일명(CamelCase/PasalCase)을 언더바(`_`) 기반 신규 파일명으로 복제하여 프로젝트 임포트 연결을 전면 전환하였습니다.

사용자 지침에 따라 **Old 파일은 임시 유지**하며, 수 차례의 테스트 후 불필요해졌을 때 사용자의 지시 1회만으로 원클릭 삭제할 수 있도록 준비 스크립트를 완비합니다.

---

## 2. 복제 및 전환 대상 10개 파일 목록

| 번호 | 기존 Old 파일명 (유지 중) | 신규 전환 파일명 (현재 소스 연결됨) | 위치 |
| :---: | :--- | :--- | :--- |
| 1 | `menuConfig.ts` | `menu_config.ts` | `src/config/` |
| 2 | `assetStatusConfig.ts` | `asset_status_config.ts` | `src/config/` |
| 3 | `UsersPermissions.tsx` | `users_permissions.tsx` | `src/pages/` |
| 4 | `DepreciationExecution.tsx` | `depreciation_execution.tsx` | `src/pages/` |
| 5 | `OutboundInspections.tsx` | `outbound_inspections.tsx` | `src/pages/` |
| 6 | `SmartDispatch.tsx` | `smart_dispatch.tsx` | `src/pages/` |
| 7 | `SmartReturn.tsx` | `smart_return.tsx` | `src/pages/` |
| 8 | `RentAssets.tsx` | `rent_assets.tsx` | `src/pages/` |
| 9 | `AssetHistory.tsx` | `asset_history.tsx` | `src/pages/` |
| 10 | `AssetAssignment.tsx` | `asset_assignment.tsx` | `src/pages/` |

---

## 3. 원클릭 실행 준비 완료 스크립트

사용자가 *"old 파일 정리해줘"* 또는 *"old 파일 삭제해줘"* 라고 지시하거나 프로젝트 루트의 배치 파일을 실행할 경우, 아래 스크립트가 즉각 동작하도록 준비되었습니다.

- **실행 배치 스크립트 파일**: `clean_old_files.bat`
- **배치 실행 내용**:
  - `src/config/menuConfig.ts` 삭제
  - `src/config/assetStatusConfig.ts` 삭제
  - `src/pages/UsersPermissions.tsx` 삭제
  - `src/pages/DepreciationExecution.tsx` 삭제
  - `src/pages/OutboundInspections.tsx` 삭제
  - `src/pages/SmartDispatch.tsx` 삭제
  - `src/pages/SmartReturn.tsx` 삭제
  - `src/pages/RentAssets.tsx` 삭제
  - `src/pages/AssetHistory.tsx` 삭제
  - `src/pages/AssetAssignment.tsx` 삭제
