# 초기DB 업로드 전용 관리 문서

> **위치**: `메뉴 → 경영관리 → 초기DB 업로드`
> **대상 파일**: `src/pages/InitialDbUploader.tsx` · `src/services/migrationEngine.ts`
> **최종 갱신**: 2026-09-01 · v0.6.0.Build.18

---

## 1. 목적

기연리프트 ERP 최초 도입 시, 기존 엑셀 장부(5개 시트, ~6,450행)를 Supabase DB로
일괄 마이그레이션하는 단방향 업로드 기능.
운영 이후에는 DB 전체 초기화(리셋) + 재적재 용도로도 활용.

---

## 2. 입력 엑셀 파일 구조 (5개 시트)

| 시트명 | 행 수 | 주요 내용 |
|:---|:---:|:---|
| 보유자산현황 | ~726행 | 자산마스터, 취득가, 감가상각, 임차처 |
| 26.08 (현황) | ~726행 | 가동상태(임대/대기), 현장명, 계약연결 |
| 거래처정보현황 | ~265행 | 사업자번호, 대표자, 현장, 담당자, 청구담당자 |
| 업체별마감일자 | ~187행 | 청구마감일, 결제일(익월N일/NetTerms), 비고 |
| 202608 (계약대장) | ~2,936행 | 자사장비/전대장비 계약, 당월청구합계, 결재상태 |

### 2-1. 보유자산현황 시트 컬럼 인덱스 매핑

| 인덱스 | 내용 | 비고 |
|:---:|:---|:---|
| r[1] | 모델명 | productMap 등록 |
| r[3] | 시리얼 번호 | |
| r[4] | 자산 관리번호 | assetMap 키 |
| r[6] | 높이(feet) | |
| r[7] | 제조사 | inferMakerFromModel로 보완 |
| r[8] | 구입처(supplier) | vendorMap 등록 |
| r[9] | 취득일 | 엑셀 시리얼 → ISO |
| r[10] | 취득가 | 감가상각 기준 |
| r[16] | 메모 | |

### 2-2. 거래처정보현황 시트 컬럼 인덱스 매핑

| 인덱스 | 내용 | 비고 |
|:---:|:---|:---|
| r[2] | 사업자번호 | bizRegNo |
| r[3] | 대표자 | |
| r[4] | 주소 | |
| r[5] | 현장명 | customer_sites 등록 |
| r[7] | 담당자 | customer_contacts 등록 |
| r[8] | 연락처 | |
| r[9] | 이메일 | |

### 2-3. 업체별마감일자 시트 컬럼 인덱스 매핑

| 인덱스 | 내용 | 비고 |
|:---:|:---|:---|
| r[0] | 업체명 | 고객명 정규화 후 customerMap 매칭 |
| r[1] | 청구일 | `parseClosingDay()` → `billingDay` |
| r[2] | 결제일 | `parsePaymentDueTerm()` → `paymentDueDay` / `paymentTermDays` 분리 |
| r[3] | 비고 | memo 병합 |

### 2-4. 계약대장 시트 컬럼 인덱스 매핑

| 인덱스 | 내용 | 비고 |
|:---:|:---|:---|
| r[0] | 고객사명 | 정규화 처리 |
| r[1] | 현장명 | |
| r[2] | 모델명 | |
| r[3] | 자사 자산번호 | 있으면 자사 자산 |
| r[4] | 전대 자산번호 | 있으면 외부임차 |
| r[5] | 계약 시작일 | 엑셀 시리얼 → ISO |
| r[6] | 가동 일수 | 당월 청구서 일수 |
| r[7]~r[21] | 소급 렌탈료 (2025-01 ~ 2026-07) | 최대 20개월 소급 청구 |
| r[10] | 계약 종료 여부 | 'N' 또는 날짜 → isCompleted 판별 |
| r[13] | 자사 자산번호 | ownerType OWNED |
| r[14] | 전대 자산번호 | ownerType EXTERNAL |
| r[15] | 임차업체명 | vendorMap 등록 |
| r[16] | 임차단가(월) | external_leases.monthlyRentFee |
| r[17] | 전대 반납일 | external_leases.rentEnd |
| r[20] | 운반비 | receivables TRANSPORT |
| r[22] | 당월(2026-08) 렌탈료 | |
| r[23] | 기타요금 | billing_details 추가 항목 |
| r[24] | 기타요금 메모 | |
| r[25] | 당월 청구 합계 | 대사 검증 기준값 |

---

## 3. 파싱 엔진 핵심 함수 (migrationEngine.ts)

### 3-1. 날짜 처리

```ts
sanitizeExcelDate(val: any): string | null
  → 엑셀 시리얼(예: 45123) → new Date((serial - 25569) × 86400000) ISO 변환
  → serial > 60: 1900-02-29 오차 보정 (-1일)
```

### 3-2. 고객사명 정규화

```ts
normalizeCustomerName(name: string): string
  → 괄호, 특수문자 제거
  → "(주)", "주식회사" 등 법인 유형 일관화
```

### 3-3. 청구일 파싱

```ts
parseClosingDay(dayStr: any): number
  → "말일" / "말" → 30
  → 숫자 추출 → Min(31, Max(1, n))
  → 기본값 30
```

### 3-4. 결제 조건 파싱 (범용화 — Build.18)

```ts
parsePaymentDueTerm(rawStr: any): { paymentDueDay: number|null, paymentTermDays: number|null }

판별 규칙:
  "익월N일" / "익익월N일"  →  paymentDueDay=N,  paymentTermDays=null  (익월 고정일)
  "익월말" / "말일"        →  paymentDueDay=30, paymentTermDays=null
  "N일" (N ≤ 31)          →  paymentDueDay=N,  paymentTermDays=null
  "N일" (N > 31)          →  paymentDueDay=null, paymentTermDays=N   ← Net Terms
  공백/null               →  paymentDueDay=30, paymentTermDays=null  (기본)
```

### 3-5. 결제 만기일 계산 (범용화 — Build.18)

```ts
calcDueDate(billingDateStr, paymentDueDay, paymentTermDays): string

단일 판별 규칙:
  paymentTermDays != null  →  dueDate = billingDate + paymentTermDays일  (Net Terms)
  paymentTermDays == null  →  dueDate = 익월 paymentDueDay일             (고정일)
```

### 3-6. 감가상각 자동계산 (Build.11 — 확정 단계 일괄 적용)

```ts
DEPRECIATION_BASE_DATE = '2026-08-31'

// 전 시트 파싱 완료 후, DB INSERT 전 단일 확정 단계에서 OWNED 자산 전수 재계산
elapsedMonths = (baseDate - acquisitionDate) 개월 수
accumDepreciation = acquisitionPrice × (elapsedMonths / depreciationMonths)
bookValue = max(0, acquisitionPrice × residualValueRate/100, acquisitionPrice - accumDepreciation)
```

### 3-7. 계약 그룹핑 로직 (Build.12)

```ts
// 동일 고객+현장+시작일+종료일 조합 → 1계약 N자산

contractGroupKey = `${customerId}_${siteId}_${startDate}_${endDate}`

contractGroupMap.has(key)
  → true: 기존 계약 재사용 + contract_assets만 추가
  → false: 신규 계약 생성 + 계약이력(INITIAL_START) 추가
```

### 3-8. 소급 청구 생성 — 기수(旣遂) 원칙 (Build.16 — 실월 일수 적용)

```ts
// 계약 개시월 ~ 2026-07 소급 청구 생성

lastDayOfCurMonth = new Date(curYear, curMonth, 0).getDate()  // 실제 월 일수
daysInPeriod = lastDayOfCurMonth

// 계약 개시월만: 개시일~말일
if (개시월):
  daysInPeriod = lastDayOfCurMonth - startDay + 1

isFullMonth = daysInPeriod === lastDayOfCurMonth
billAmount = isFullMonth ? monthlyFee : round(dailyFee × daysInPeriod)

// 기수 원칙: 실발행 청구 금액만 cumRentalFee에 누적
matchedAsset.cumRentalFee += billAmount
```

### 3-9. 마이그레이션 담당자 지정 (Build.15)

```ts
// users 배열에서 동적 조회
MIGRATION_SALESPERSON_ID = users.find(u => u.name.includes('김동우'))?.id  // 영업
MIGRATION_INSPECTOR_ID   = users.find(u => u.name.includes('김관주'))?.id  // 검수 승인

// Fallback: 미발견 시 salesperson=null, inspector='SYS-MIGRATED'
// ⚠ 반드시 로그인 후 users 로드된 상태에서 실행해야 함
```

### 3-10. 전대 계약 연결 (Build.14 — A-01 fix)

```ts
// 전대 leaseEntity를 push 시점에는 contractId=null로 등록
// 계약 그룹핑 확정 후 leaseEntity.contractId = contractId 사후 주입
```

### 3-11. 배차 데이터 — 현재 SKIP (Build.17)

```
deliveries, outbound_inspections, asset_inout_logs:
  → 배차 엑셀 양식 미입수 상태 → 생성 코드 전면 주석 처리
  → 배차 엑셀 입수 후 migrationEngine.ts Step 8~9 주석 3개 해제
```

### 3-12. 대사 검증 및 DB 저장 (Build.14 — C-03 fix)

```ts
// Step 12: 모든 INSERT 완료 후 대사 실행
report = runReconciliationAudit(parsed)
reportRecord = {
  asset_count_excel, asset_count_db, asset_count_match,
  billing_total_excel, billing_total_db, billing_total_diff, billing_total_match,
  details_header_sum, details_detail_sum, details_sum_match,
  lease_total_excel, lease_total_db, lease_total_match,
  lifecycle_contracts, lifecycle_deliveries, lifecycle_match,
  orphan_assets, orphan_contracts, orphan_count, all_passed
}
batchUpsertChunked('reconciliation_reports', [reportRecord], 1)
```

---

## 4. 13단계 DB INSERT 파이프라인

| Step | 대상 테이블 | 현재 상태 |
|:---:|:---|:---:|
| 0 | DB 전체 초기화 (FK 역순 삭제) | ✅ 활성 |
| 1 | products | ✅ 활성 |
| 2 | vendors | ✅ 활성 |
| 3 | customers | ✅ 활성 |
| 4 | customer_sites + customer_contacts | ✅ 활성 |
| 5 | assets | ✅ 활성 |
| 6 | contracts + contract_history | ✅ 활성 |
| 7 | contract_assets + external_leases | ✅ 활성 |
| 8 | deliveries | ⏸ SKIP (배차 엑셀 입수 후) |
| 9 | outbound_inspections + asset_inout_logs | ⏸ SKIP (배차 엑셀 입수 후) |
| 10 | billings + billing_details | ✅ 활성 |
| 11 | purchase_billings + purchase_billing_details + receivables | ✅ 활성 |
| 12 | reconciliation_reports | ✅ 활성 |
| 13 | localStorage 캐시 동기화 | ✅ 활성 |

---

## 5. FK 의존성 DAG

```
users → vendors → products
  ↓
customers → customer_sites → customer_contacts
  ↓
contracts → contract_history
  ↓
contract_assets → external_leases
  ↓
[배차 엑셀 입수 후] deliveries → outbound_inspections → asset_inout_logs
  ↓
billings → billing_details
purchase_billings → purchase_billing_details
receivables
  ↓
reconciliation_reports
```

---

## 6. DB 스키마 변경 이력 (DDL 패치)

| 날짜 | 테이블 | 변경 내용 | Build |
|:---|:---|:---|:---:|
| 2026-09-01 | reconciliation_reports | 신규 생성 (대사 결과 영구 저장) | Build.14 |
| 2026-09-01 | external_leases | contract_id 컬럼 추가 + 인덱스 | Build.14 |
| 2026-09-01 | customers | payment_term_days 컬럼 추가 (Net Terms) | Build.18 |

---

## 7. 감사 지적사항 전체 해결 현황

| ID | 내용 | 해결 Build | 상태 |
|:--|:---|:---:|:---:|
| C-01 | salespersonId → 김동우 팀장 동적 주입 | Build.15 | ✅ |
| C-02 | inspectorId → 김관주 부장 동적 주입 | Build.15.1 | ✅ |
| C-03 | reconciliation_reports DB 저장 | Build.14 | ✅ |
| A-01 | external_leases.contractId 주입 | Build.14 | ✅ |
| A-02 | 소급 첫 달 일할 실월 일수 적용 | Build.16 | ✅ |

---

## 8. 결제 조건 범용화 설계 (Build.18)

| 엑셀 값 | paymentDueDay | paymentTermDays | 계산 방식 |
|:---|:---:|:---:|:---|
| 익월10일 | 10 | null | 익월 10일 |
| 익월15일 | 15 | null | 익월 15일 |
| 익월말 | 30 | null | 익월 말일 |
| 30일 | 30 | null | 익월 30일 |
| 75일 | null | 75 | 발행일+75일 |
| (공백) | 30 | null | 익월 말일 (기본) |

---

## 9. 배차 데이터 재활성화 가이드

배차 엑셀 입수 후 `migrationEngine.ts` 주석 해제:

```ts
// ingestExcelInitialData Step 8
await batchUpsertChunked('deliveries', parsed.deliveries, 200);

// ingestExcelInitialData Step 9
await batchUpsertChunked('outbound_inspections', parsed.outboundInspections, 200);
await batchUpsertChunked('asset_inout_logs', parsed.assetInOutLogs, 200);
```

배차 생성 파싱 코드 별도 작성 필요 (현재 L1055 주석 구간).

---

## 10. 알려진 제약사항

| # | 항목 | 내용 |
|:--|:---|:---|
| 1 | Supabase 청크 분할 | 200건 단위 청크 분할 (Payload limit 방어) |
| 2 | 멱등성 보장 | Step 0 사전 정리 → 재실행 가능 |
| 3 | 엑셀 셀 타입 | 수식 셀 → XLSX.utils.format_cell 값 추출 |
| 4 | 미래 계약 종료일 | 9999-12-31 = 무기한 계약 sentinel (계산에 사용 금지) |
| 5 | 배차 데이터 | 배차 엑셀 입수 전 미생성 (Step 8~9 SKIP) |
| 6 | 엑셀 시트명 | 현재 하드코딩 ('보유자산현황', '거래처정보현황', '업체별마감일자', '202608') |
| 7 | 담당자 미로드 | users 로드 전 실행 시 salesperson/inspector fallback 처리 |

---

## 11. 수정 이력

| 버전 | 날짜 | 내용 |
|:---|:---|:---|
| v0.6.0.Build.5 | 2026-08-31 | Step 0 사전 정리 추가, 13단계 DAG 재편, stale 캐시 차단 |
| v0.6.0.Build.9 | 2026-08-31 | cumRentalFee 소급 누적 기수 원칙 주석 명시 |
| docs | 2026-09-01 | PM+감사관 2중 감사 결과 반영, 9단계 절차 권고 |
| v0.6.0.Build.11 | 2026-09-01 | 감가상각 확정 단계 일괄 재계산 (인라인 제거) |
| v0.6.0.Build.12 | 2026-09-01 | 계약 그룹핑 로직 (동일조건 N자산 → 1계약) |
| v0.6.0.Build.13 | 2026-09-01 | 자산관리 화면 계약번호 컬럼 추가 |
| v0.6.0.Build.14 | 2026-09-01 | DDL 패치 후속 코드 반영 (A-01, C-03, TABLE_COLUMNS) |
| v0.6.0.Build.15 | 2026-09-01 | 마이그레이션 담당자 동적 조회 (김동우/김관주) |
| v0.6.0.Build.15.1 | 2026-09-01 | inspectorId = 김관주 부장 수정 |
| v0.6.0.Build.16 | 2026-09-01 | 소급 청구 일할계산 실월 일수 적용 (A-02) |
| v0.6.0.Build.17 | 2026-09-01 | 배차 데이터 생성 전면 제외 (Step 8~9 SKIP) |
| v0.6.0.Build.18 | 2026-09-01 | 결제조건 범용화 — paymentTermDays(Net Terms) 분리, calcDueDate 통합 |
