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

## 3. 감사 검토 절차 권고안 (PM + 감사관 2중 감사 결과 반영)

> **2026-09-01 감사 판정: 불합격 (FAIL)**
> 완전성(Completeness)·정확성(Accuracy) 두 기준 모두에서 결함 확인.
> 아래 권고 절차로 교체 필요.

### 3-1. 이상적 9단계 절차 (완전성·의존성 충족)

| 단계 | 내용 | 선행 필수 조건 | 검증 게이트 |
|:---:|:---|:---|:---|
| Step 0 | 기존 DB 전체 초기화 (FK 역순 16개 테이블 DELETE) | 없음 | 16개 테이블 행 수 = 0 |
| Step 1 | 기초 마스터 등록 (직원/사용자 → 임차처 → 제품) | users 선행 | 51종 제품 등록 확인 |
| Step 2 | 고객 등록 (기초정보 → 현장 → 담당자) | Step 1 완료 | 고객 수 = 엑셀 거래처 수 |
| Step 3 | 자사 자산 등록 | 제품, 임차처 존재 | 자산 수 = 엑셀 보유자산 수 |
| Step 4 | 계약 헤더 등록 + 계약이력(INITIAL_START) | 고객, 현장, 직원 존재 | 계약 수 = 엑셀 계약 행 수 |
| Step 5 | 체결자산(contract_assets) + 전대(external_leases) 등록 | 계약, 자산 존재 | 체결자산 수 = 계약 행 수 |
| Step 6 | 배차(deliveries) + 출고검수(outbound_inspections) + 로그 생성 | 계약, 자산 존재 | RENTED 자산 수 확인 |
| Step 7 | 청구 생성 (소급 + 당월) + 매입청구(purchase_billings) | 계약, 체결자산 존재 | 청구 합계 = 엑셀 r[25] 합산 |
| Step 8 | 대사 검증 (ReconciliationReport) DB 저장 | Step 7 완료 | allPassed = true 확인 |
| Step 9 | 브라우저 캐시 동기화 (fullRefreshFromServer) | Step 8 완료 | 화면 데이터 정상 로드 확인 |

### 3-2. FK 의존성 DAG

```
users → vendors → products
  ↓         ↓         ↓
contracts ← assets ← customer_sites
  ↓
contract_assets → external_leases
  ↓
deliveries → outbound_inspections → asset_in_out_logs
  ↓
billings → billing_details
  ↓
purchase_billings → receivables
  ↓
reconciliation_reports
```

---

## 4. 감사 결과 (완전성 + 정확성 2중 기준)

### 4-1. 완전성(Completeness) 지적사항

| # | 지적 내용 | 코드 위치 | 심각도 |
|:--|:---|:---|:---:|
| C-01 | salespersonId = null 하드코딩 — 계약에 영업담당자 미연결 | migrationEngine.ts L937 | 🔴 HIGH |
| C-02 | inspectorId = 'SYSTEM_ADMIN' 리터럴 — users FK 미연결 | migrationEngine.ts L1031 | 🟡 MED |
| C-03 | reconciliation_reports 대사 리포트 생성 후 DB 미저장 | migrationEngine.ts Step 12 | 🔴 HIGH |
| C-04 | 청구 담당자 isPrimary: true 일괄 설정 — 세금계산서/명세 담당자 미구분 | migrationEngine.ts L646 | 🟡 MED |

### 4-2. 정확성(Accuracy) 지적사항

| # | 지적 내용 | 코드 위치 | 심각도 |
|:--|:---|:---|:---:|
| A-01 | purchase_billing_details.contractId = null — 전대 비용 계약 역추적 불가 | migrationEngine.ts L915 | 🔴 HIGH |
| A-02 | 소급 첫 달 일할 계산 시 30일 고정 — 실제 월 일수 미적용 → 대사 불일치 | migrationEngine.ts L1136 | 🔴 HIGH |
| A-03 | 외부임차 자산 종료 시 일괄 AVAILABLE 전환 — 실제 반납 여부 미확인 | migrationEngine.ts L997 | 🟡 MED |

### 4-3. PM 리스크 매트릭스

| 단계 | 실패 영향도 | 실패 시 대응 |
|:---|:---:|:---|
| Step 0 사전 초기화 | HIGH | FK 충돌. 전체 삭제 재실행으로 멱등성 확보 |
| Step 1~2 마스터 적재 | LOW | 전체 초기화 후 재실행 |
| Step 3~5 자산/계약 | MED | 엑셀 오타 고아 데이터 발생 가능. 대사 검증으로 감지 |
| Step 6~7 물류/청구 | HIGH | 재무 직결. 실패 즉시 Step 0 → 전체 재적재 필수 |
| Step 8~9 대사/캐시 | MED | 대사 실패 시 Step 7부터 재실행 |

---

## 5. 핵심 비즈니스 로직

### 5.1 엑셀 날짜 처리
- 엑셀 시리얼(예: 45123) → new Date((serial - 25569) × 86400000) ISO 변환
- serial > 60 이면 1900-02-29 오차 보정 (-1일)

### 5.2 고객사명 정규화 (normalizeCustomerName)
- 괄호, 특수문자 제거 후 "(주)", "주식회사" 등 법인 유형 일관화

### 5.3 미등록 자산 선제 등록 (FK 방어)
- 계약대장에만 있고 자산마스터에 없는 자산번호 자동 생성
- ownerType: 자사번호 있으면 'OWNED' / 전대번호만 있으면 'EXTERNAL'

### 5.4 소급 청구 생성 — 기수(旣遂) 원칙 적용
```
r[7] ~ r[21] = 2025-01 ~ 2026-07 월별 렌탈료 (최대 20개월 소급)
각 월 billAmount = daysInPeriod === 30 ? monthlyFee : round(dailyFee × daysInPeriod)
→ cumRentalFee += billAmount  [기수 원칙: 실발행 청구 금액만 누적]

⚠️ 미해결(A-02): 첫 달 일할 시 30일 고정 사용 → 실월 일수 적용 필요
```

### 5.5 감가상각 자동계산
```
accumDepreciation = acquisitionPrice × (경과개월 / depreciationMonths)
bookValue = max(0, acquisitionPrice - accumDepreciation)
```

### 5.6 대사 검증 (ReconciliationReport)

| 검증 항목 | 기준 |
|:---|:---|
| 자산 수량 대사 | 엑셀 행 수 vs DB 적재 수 |
| 당월 청구 합계 | 엑셀 r[25] 합산 vs DB billing_details 합산 |
| 청구 헤더/상세 합계 | billings.totalAmount 합 vs billing_details.amount 합 |
| 전대 총액 | external_leases 합산 |
| 계약-배차 체인 | contracts vs outbound deliveries |
| 고아(Orphan) 데이터 | 계약 없는 자산, 자산 없는 계약 |

---

## 6. DB 화이트리스트 (TABLE_COLUMNS) — migrationEngine.ts L73~

INSERT 전 불필요한 필드 자동 제거. 총 19개 테이블.

---

## 7. Stale 캐시 차단

```
handleIngest 완료(성공/실패 양쪽) → await fullRefreshFromServer()
handleReset 완료              → await fullRefreshFromServer()
```

---

## 8. 알려진 제약사항

| # | 항목 | 내용 |
|:--|:---|:---|
| 1 | Supabase 청크 분할 | 대용량 INSERT 시 500건 단위 청크 분할 |
| 2 | 멱등성 보장 | Step 0 사전 정리로 재실행 가능 |
| 3 | 엑셀 셀 타입 | 수식 셀 → XLSX.utils.format_cell 값 추출 |
| 4 | 전대 자산 초기 상태 | ownerType: EXTERNAL, status: RENTED 적재 |
| 5 | 미래 계약 종료일 | 9999-12-31 = 무기한 계약 sentinel |

---

## 9. 수정 이력

| 버전 | 날짜 | 내용 |
|:---|:---|:---|
| v0.6.0.Build.5 | 2026-08-31 | Step 0 사전 정리 추가, 13단계 DAG 재편, stale 캐시 차단 |
| v0.6.0.Build.9 | 2026-08-31 | cumRentalFee 소급 누적 기수 원칙 주석 명시 |
| docs | 2026-09-01 | PM+감사관 2중 감사 결과 반영, 9단계 절차 권고, 4개 완전성/정확성 지적사항 추가 |

---

## 10. 미해결 코드 버그 (수정 대기)

| ID | 파일 | 라인 | 내용 | 심각도 |
|:--|:---|:---:|:---|:---:|
| C-01 | migrationEngine.ts | L937 | salespersonId = null 하드코딩 | 🔴 |
| C-02 | migrationEngine.ts | L1031 | inspectorId = SYSTEM_ADMIN 리터럴 | 🟡 |
| C-03 | migrationEngine.ts | Step 12 | reconciliation_reports DB 미저장 | 🔴 |
| A-01 | migrationEngine.ts | L915 | purchase_billing_details.contractId = null | 🔴 |
| A-02 | migrationEngine.ts | L1136 | 첫 달 일할 30일 고정 — 실월 일수 미적용 | 🔴 |

---

## 11. 향후 개선 검토 사항

- [ ] C-01: salespersonId 엑셀 담당자 컬럼 매핑 또는 ADMIN 대리 FK 주입
- [ ] C-03: reconciliation_reports batchUpsertChunked 호출 추가
- [ ] A-01: purchase_billing_details에 순회 중인 contractId 전달
- [ ] A-02: 첫 달 일할 계산 실월 일수(Date 객체) 적용
- [ ] 엑셀 시트명 동적 감지 (현재 하드코딩)
- [ ] 대사 리포트 UI 드릴다운 상세화
