# 개발 지시 및 개편 완료 내역 (dev_temp.md)

## 🎨 [완료] 메뉴명 [정비항목관리] 변경, [정비/소모품관리] 그룹 이동 & CHK-0000001 코드 체계 적용 (v1.59.0.Build.144)

### 1. 사장님 지시사항 완벽 이행
- **메뉴 명칭 변경**: `입고 검수 항목 관리` ➔ `정비항목관리`
- **메뉴 그룹 위치 이동**: `제품 / 자산관리` ➔ **`정비 / 소모품관리`** (`grp_maintenance`) 그룹 이동.
- **항목 코드 단순화 및 7자리 채번 체계 적용**:
  - 기존 `DEFECT_A` ➔ `CHK-0000001`
  - 기존 `DEFECT_B` ➔ `CHK-0000002`
  - 기존 `DEFECT_OIL_LEAK` ➔ `CHK-0000003`
  - 기존 `DEFECT_WIRE_CUT` ➔ `CHK-0000004`
  - 기존 `DEFECT_TIRE_DAMAGED` ➔ `CHK-0000005`
  - 신규 등록 시 `CHK-000000X` 7자리 숫자로 자동 채번 연동.

### 2. 주요 수정 파일
- `inspection_checklist_manage.tsx`, `db.ts`, `menuConfig.ts`, `menu_config.ts`, `App.tsx`

### 3. 빌드 및 검증
- TypeScript `npx tsc -b` 컴파일 오류 없음 확인 ✅ (Exit code: 0)

---
**기록 일시**: 2026-08-09 18:24  
**작성 버전**: `v1.59.0.Build.144`
