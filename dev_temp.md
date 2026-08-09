# 개발 지시 및 개편 완료 내역 (dev_temp.md)

## 🎨 [완료] 월말 매입정산 메뉴 외주 정비비(EXTERNAL_REPAIR) 항목 추가 및 자동 정산/지급대사 구축 (v1.62.0.Build.147)

### 1. 사장님 지시사항 완벽 이행
- **매입 정산 구분에 외주 정비비 추가**:
  - `PurchaseSettlementType`: `'EXTERNAL_REPAIR'` 신설.
  - `PurchaseSettlementItem.sourceType`: `'REPAIR'` 연동.
- **외주 정비비 월말 일괄 자동 정산 파이프라인 구축**:
  - `generateMonthlyPurchaseSettlements(ym)` 실행 시, `repairs` 대장에서 외주 정비(`EXTERNAL`) 완료(`COMPLETED`) 건을 거래처(`vendorId`)별로 수집하여 **`EXTERNAL_REPAIR` 매입 정산서** 자동 발행.
  - `repairs.purchaseBillId` 1:1 연결 및 추적성(Audit Trail) 보장.
- **매입 정산 화면 UI 탭 및 명세 개편 (`PurchaseSettlementPage.tsx`)**:
  - 상단 정산 탭 및 명세 뷰에 **`외주 정비비 (EXTERNAL_REPAIR)`** 탭 추가.
  - 외주 정비건별 자산번호, 세부 정비 내역, 파손 및 견적서 증빙 파일 1:1 미리보기 표출.

### 2. 주요 수정 파일
- `PurchaseSettlementPage.tsx`, `AppContext.tsx`, `db.ts`

### 3. 빌드 및 검증
- TypeScript `npx tsc -b` 컴파일 오류 없음 확인 ✅ (Exit code: 0)

---
**기록 일시**: 2026-08-09 18:45  
**작성 버전**: `v1.62.0.Build.147`
