# 초기DB 업로드 전용 관리 문서

> **위치**: `메뉴 → 경영관리 → 초기DB 업로드`
> **대상 파일**: `src/pages/InitialDbUploader.tsx` · `src/services/migrationEngine.ts`
> **최종 갱신**: 2026-09-01 · v0.6.0.Build.9

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
| 업체별마감일자 | ~187행 | 청구마감일, 결제일, 비고 |
| 202608 (계약대장) | ~2,936행 | 자사장비/전대장비 계약, 당월청구합계, 결재상태 |

### 계약대장 시트 컬럼 인덱스 매핑

| 인덱스 | 내용 | 비고 |
|:---:|:---|:---|
| r[0] | 고객사명 | 정규화 처리 |
| r[1] | 현장명 | |
| r[2] | 모델명 | |
| r[3] | 자사 자산번호 | 있으면 자사 자산 |
| r[4] | 전대 자산번호 | 있으면 외부임차 |
| r[5] | 계약 시작일 | 엑셀 시리얼 → ISO 변환 |
| r[6] | 가동 일수 | 없으면 30일 기본 |
| r[7]~r[21] | 월별 렌탈료 (2025-01 ~ 2026-07) | 최대 20개월 소급 |
| r[22] | 당월(2026-08) 렌탈료 | |
| r[23] | 기타요금 | |
| r[24] | 기타요금 메모 | |
| r[25] | 당월 청구 합계 | 대사 검증 기준값 |

---

## 3. 13단계 DAG 처리 흐름 (ingestExcelInitialData)

| 단계 | 설명 | 대상 테이블 |
|:---:|:---|:---|
| Step 0 | 사전 정리 (Pre-Truncate) — FK 역순 16개 테이블 전체 DELETE | (16개 테이블) |
| Step 1 | 제품 모델 등록 (51종 프리셋 + 엑셀 신규) | products |
| Step 2 | 임차처(벤더) 등록 | vendors |
| Step 3 | 고객사 등록 | customers |
| Step 4 | 현장 + 담당자 등록 | customer_sites, customer_contacts |
| Step 5 | 자산 등록 (자사 + 외부임차) | assets |
| Step 6 | 계약 + 계약이력 등록 | contracts, contract_history |
| Step 7 | 체결자산 + 외부임차 등록 | contract_assets, external_leases |
| Step 8 | 배차 등록 (출고/입고) | deliveries |
| Step 9 | 출고검수 + 자산입출고 로그 | outbound_inspections, asset_in_out_logs |
| Step 10 | 청구서 + 청구상세 등록 (소급분 + 당월분) | billings, billing_details |
| Step 11 | 매입청구 + 수납채권 등록 | purchase_billings, receivables |
| Step 12 | 대사 검증 리포트 생성 | reconciliation_reports |
| Step 13 | localStorage 캐시 동기화 | (로컬스토리지) |

### Step 0 대상 16개 테이블 삭제 순서 (FK 역순)

```
reconciliation_reports → payment_deposit_links → payments
→ billing_details → billings → purchase_billing_details → purchase_billings
→ receivables → outbound_inspections → asset_in_out_logs
→ deliveries → contract_history → contract_assets → external_leases
→ contracts → assets
```

---

## 4. 핵심 비즈니스 로직

### 4.1 엑셀 날짜 처리
- 엑셀 시리얼(예: 45123) → new Date((serial - 25569) × 86400000) ISO 변환
- serial > 60 이면 1900-02-29 오차 보정 (-1일)

### 4.2 고객사명 정규화 (normalizeCustomerName)
- 괄호, 특수문자 제거 후 "(주)", "주식회사" 등 법인 유형 일관화
- 시트별 상이한 표기를 단일 고객사로 병합

### 4.3 미등록 자산 선제 등록 (FK 방어)
- 계약대장에는 있으나 자산마스터에 없는 자산번호 자동 생성
- ownerType: 자사번호 있으면 'OWNED' / 전대번호만 있으면 'EXTERNAL'

### 4.4 소급 청구 생성 — 기수(旣遂) 원칙 적용
```
r[7] ~ r[21] = 2025-01 ~ 2026-07 월별 렌탈료 (최대 20개월 소급)
각 월 billAmount = daysInPeriod === 30 ? monthlyFee : round(dailyFee × daysInPeriod)
→ cumRentalFee += billAmount  [기수 원칙: 실발행 청구 금액만 누적]
```

> **기수(旣遂) 원칙** (v0.6.0.Build.9 전사 글로벌 정책):
> cumRentalFee는 실제 청구서가 발행된 금액만 누적한다.
> 미래 기대기여(미수)는 절대 포함하지 않는다.

### 4.5 감가상각 자동계산
```
accumDepreciation = acquisitionPrice × (경과개월 / depreciationMonths)
bookValue = max(0, acquisitionPrice - accumDepreciation)
```

### 4.6 대사 검증 리포트 (ReconciliationReport)

| 검증 항목 | 기준 |
|:---|:---|
| 자산 수 일치 | 엑셀 행 수 vs DB 적재 수 |
| 당월 청구 합계 일치 | 엑셀 r[25] 합산 vs DB billing_details 합산 |
| 청구 헤더/상세 합계 일치 | billings.totalAmount 합 vs billing_details.amount 합 |
| 전대 총액 일치 | external_leases 합산 |
| 계약-배차 생애주기 체인 | contracts vs outbound deliveries |
| 고아(Orphan) 데이터 | 계약 없는 자산, 자산 없는 계약 |

---

## 5. DB 화이트리스트 (TABLE_COLUMNS) — migrationEngine.ts L73~

INSERT 전 불필요한 필드 자동 제거하여 PostgREST 컬럼 불일치 원천 방어.

총 19개 테이블:
products, vendors, customers, customer_sites, customer_contacts,
assets, contracts, contract_history, contract_assets, external_leases,
deliveries, outbound_inspections, asset_in_out_logs,
billings, billing_details, purchase_billings, purchase_billing_details,
receivables, reconciliation_reports

---

## 6. Stale 캐시 차단 메커니즘

```
handleIngest 완료(성공/실패 양쪽) → await fullRefreshFromServer()
handleReset 완료              → await fullRefreshFromServer()
```

fullRefreshFromServer()가 Supabase 전 테이블 재쿼리 후 localStorage 덮어씀.

---

## 7. 알려진 제약사항 및 주의사항

| # | 항목 | 내용 |
|:--|:---|:---|
| 1 | Supabase 청크 분할 | 대용량 INSERT 시 500건 단위 청크 분할 처리 |
| 2 | 멱등성 보장 | Step 0 사전 정리로 재실행 가능 |
| 3 | 엑셀 셀 타입 | 수식 셀 → XLSX.utils.format_cell 값 추출 |
| 4 | 전대 자산 초기 상태 | ownerType: EXTERNAL, status: RENTED 적재 |
| 5 | 자사 자산 상태 | 현황 시트 가동상태 기반 → RENTED / AVAILABLE |
| 6 | 미래 계약 종료일 | 9999-12-31 = 무기한 계약 sentinel 표기 |

---

## 8. 수정 이력

| 버전 | 날짜 | 내용 |
|:---|:---|:---|
| v0.6.0.Build.5 | 2026-08-31 | Step 0 사전 정리 추가, 13단계 DAG 재편, stale 캐시 차단 |
| v0.6.0.Build.9 | 2026-08-31 | cumRentalFee 소급 누적 라인에 기수 원칙 주석 명시 |

---

## 9. 향후 개선 검토 사항

- [ ] 엑셀 시트명 동적 감지 (현재 하드코딩)
- [ ] 대사 리포트 UI 상세화 (불일치 항목별 드릴다운)
- [ ] 분할 업로드 지원 (시트별 선택적 재적재)
