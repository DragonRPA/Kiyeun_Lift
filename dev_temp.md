# 개발 지시 및 개편 완료 내역 (dev_temp.md)

## 🚀 [신규 기능] 청구 도래 계약 자동 감지·기본 청구 일괄 생성 및 개별 검토·완료·수정재생성 시스템 구축 (v1.128.0.Build.251)

### 1. 사장님 지시사항 완벽 이행
- **청구 도래 미생성 계약 자동 감지**:
  - `AppContext.tsx` 내 `getDueContractsForBilling(targetDate)` 구축: 오늘 날짜 기준으로 살아있는 계약 중, 고객 요청 청구기준일(`billingDay`/`statementClosingDay`)이 도래/경과했거나 전월 미청구된 계약을 실시간 자동 감지.
- **기본 청구 일괄/개별 생성 엔진**:
  - `generateDueBillings()`, `generateBillingForSingleContract()`: 헌장 4.1에 따른 자산별 정밀 일할 렌탈료 및 완료된 유료 AS 수리비 자동 합산, 선수금(예치금) 자동 상계 차감 반영하여 `REQUESTED` 결재대기 기본 청구서 생성.
- **개별 검토 / 완료(승인) / 취소·재생성 완결 체계**:
  - `Billings.tsx` 상단에 `[📢 오늘 기준 청구 도래 미생성: N건]` 알림 바 및 `[도래 계약 기본 청구 일괄 생성]` 원터치 버튼 배치.
  - 청구서 리스트 `관리` 열에 `[검토]`, `[완료(승인)]`, `[취소/재생성]`, `[취소]` 인터랙션 배치.
  - `Regenerate Modal`: 품목별 단가/수량/설명 수정, 추가 항목(운송료, 추가비용, 할인 등) 추가/삭제, 청구귀속월/발행일자 조정 후 기존 청구서 안전 취소(`REJECTED`) 및 새 청구서 즉시 발행.
- **정비 및 소모품 이동 관리 고도화**:
  - `MechanicConsumableStock` 차량 적재 재고 관리 및 AS 출장 정비 라이프사이클(`SCHEDULED` -> `IN_PROGRESS` -> `COMPLETED`/`UNRESOLVED`) 강화.

### 2. 주요 수정 파일
- `src/context/AppContext.tsx`
- `src/pages/Billings.tsx`
- `src/pages/Consumables.tsx`
- `src/pages/Repairs.tsx`
- `src/pages/smart_dispatch.tsx`
- `src/services/db.ts`
- `agent/agent.js`, `public/downloads/agent.js`

### 3. 빌드 및 검증
- TypeScript `npx tsc -b` 컴파일 오류 0건 무결점 통과 확인 ✅ (Exit code: 0)

---
**기록 일시**: 2026-08-23 05:10  
**작성 버전**: `v1.128.0.Build.251`

