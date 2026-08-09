# 개발 지시 및 개편 완료 내역 (dev_temp.md)

## 🐛 [완료] 월말 매입정산 지급 처리 bankTransactionId 스키마 캐시 오류 수정 (v1.42.0.Build.127)

### 1. 사장님 오류 보고 및 즉각 원인 분석
- **오류 증상**: 월말 매입정산 메뉴에서 통장 출금 내역 대사 매칭 후 지급 승인 시 `❌ 지급 처리 실패: Could not find the 'bankTransactionId' column of 'purchase_settlements' in the schema cache` 팝업 표출.
- **근본 원인**: `AppContext.tsx`에서 지급 처리 시 `db.updateRow<PurchaseSettlement>('purchaseSettlements', ...)`를 수행하며 `bankTransactionId` 속성을 함께 넘김. Supabase `purchase_settlements` DB 스키마에는 해당 컬럼이 없어 API 파라미터 400 거부 발생 (대사 Audit Log는 `settlement_payment_logs`에 1:N 저장됨).

### 2. 조치 사항
- **`services/db.ts` `sanitizeSupabasePayload` 예외 필터 추가**: `tableName === 'purchase_settlements' && key === 'bankTransactionId'` 속성을 Supabase 전송 Payload에서 자동 제거(continue)하여 API 호출 오염 원천 차단.
- **`schema.sql` DDL 보완**: `purchase_settlements` 테이블에 `"bankTransactionId" TEXT` 컬럼 추가하여 스키마 정합성 보장.

### 3. 주요 수정 파일
- `services/db.ts`, `schema.sql`

### 4. 빌드 및 검증
- TypeScript `npx tsc -b` 컴파일 오류 없음 확인 ✅ (Exit code: 0)

---
**기록 일시**: 2026-08-09 16:47  
**작성 버전**: `v1.42.0.Build.127`
