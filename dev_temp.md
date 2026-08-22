# 개발 지시 및 개편 완료 내역 (dev_temp.md)

## 🚀 [스키마 동기화] 정비사 차량 소모품 적재 재고 모델(DDL) 신설 및 DB 스키마·패치 스크립트 완결 (v1.128.1.Build.252)

### 1. 사장님 지시사항 완벽 이행
- **정비사 차량 소모품 적재 재고 (`mechanic_consumable_stocks`) DDL 신설**:
  - `schema.sql` 및 `scripts/supabase_patch.sql`, `scripts/patch_v1_128_schema.sql`에 신규 테이블 DDL 및 RLS 정책 반영.
  - `src/services/db.ts` 내 `ALL_DB_KEYS` 및 `mapToSupabaseTable`에 `mechanicConsumableStocks` 매핑 등록 완료.
- **소모품 및 정비 대장 스키마 확장**:
  - `consumable_logs`: `mechanicId`, `fromLocation`, `toLocation` 컬럼 및 `TRANSFER_TO_VEHICLE`, `RETURN_TO_HQ` CHECK 제약 확장.
  - `repairs`: `maintenanceType`, `scheduleDate`, `unresolvedReason`, `nextAction`, `evidenceImages`, `customerName`, `siteName` 컬럼 및 `SCHEDULED`, `UNRESOLVED` CHECK 제약 확장.
- **마이그레이션 SQL 패치 구축**:
  - 원격 Supabase DB 반영용 단독 패치 스크립트 `scripts/patch_v1_128_schema.sql` 및 통합 패치 `scripts/supabase_patch.sql` 갱신.

### 2. 주요 수정 파일
- `src/services/db.ts`
- `schema.sql`
- `scripts/supabase_patch.sql`
- `scripts/patch_v1_128_schema.sql`

### 3. 빌드 및 검증
- TypeScript `npx tsc -b` 컴파일 오류 0건 무결점 통과 확인 ✅ (Exit code: 0)

---
**기록 일시**: 2026-08-23 05:14  
**작성 버전**: `v1.128.1.Build.252`


