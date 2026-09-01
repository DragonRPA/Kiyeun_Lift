# 초기 DB 업로드 운영 원칙 및 상세 절차서

> **문서 버전**: v1.0 (2026-09-01 21:19 기준)  
> **최종 적용 빌드**: v0.7.1.Build.27  
> **대상 파일**: `src/services/migrationEngine.ts`, `src/pages/InitialDbUploader.tsx`

---

## 1. 목적 및 적용 범위

초기 DB 업로드는 ERP 신규 도입 시 **기존 엑셀 운영 데이터를 Supabase DB로 일괄 이행(Migration)** 하는 작업이다. 이 문서는 해당 기능의 설계 원칙, 엑셀 파일 구조, 파싱 로직, DB 적재 순서, 주요 예외 처리, 검증(Reconciliation) 방법론을 한 곳에 완전히 기록한다.

---

## 2. 입력 엑셀 파일 규격

### 2.1 파일 명칭 및 위치

- **파일명**: `초기DB현황1.xlsx` (고정 명칭 권장)
- **업로드 경로**: 바탕화면 `기연리프트자료_/자동업로드/` 또는 드래그앤드롭 업로드

### 2.2 필수 시트 구성 (5개 시트)

| 순서 | 시트명 (현행) | 구 시트명 | 헤더 위치 | 데이터 시작 행 | 설명 |
|------|-------------|---------|----------|-------------|------|
| 1 | `보유자산현황` | (동일) | Row 2 (동적 탐색) | 헤더 다음 행 | 자산 마스터 726건 |
| 2 | `보유장비 임대현황` | `26.08` | Row 2 (동적 탐색) | 헤더 다음 행 | 임대 가동 현황 |
| 3 | `거래처정보현황` | (동일) | Row 2 (`순번` 행) | Row 3 | 고객사 265건 |
| 4 | `업체별마감일자` | (동일) | Row 2 (`순번` 행) | Row 4 | 마감일/결제조건 189건 |
| 5 | `계약현황` | `202608` | Row 2 (0-indexed) | Row 3 | 계약/청구 대장 1,294건 |

> **⚠️ 시트명 변경 호환성**: `계약현황` 시트를 찾지 못하면 구 시트명 `202608`으로 fallback 탐색한다.
> ```typescript
> const wsMain = wb.Sheets['계약현황'] || wb.Sheets['202608'];
> ```

### 2.3 계약현황 시트 컬럼 구조 (33컬럼, 0-indexed)

```
[00] 업체명       [01] 순번         [02] 설치장소     [03] 최초개시일
[04] 개시일       [05] 종료일       [06] 일수         [07] 운반비
[08] 계약구분     [09] 장비명(당사) [10] 관리번호(당사)[11] 수량(당사)
[12] 장비명(전대) [13] 관리번호(전대)[14] 수량(전대)  [15] 임차업체
[16] 협착소유     [17] 공장입고일   [18] 임차개시일   [19] 반납일
[20] 임차단가     [21] 월렌탈료     [22] 당월렌탈료   [23] 당월기타청구
[24] 기타내역     [25] 당월청구합계 [26] 마감일       [27] 거래명세표
[28] 계산서       [29] 결재조건     [30] 결재일       [31] 결재금액
[32] (없음)
```

> **⚠️ 중복 헤더 존재**: `장비명` [09]·[12], `관리번호` [10]·[13], `수량` [11]·[14]가 당사/전대 영역에 각각 중복 존재.

### 2.4 업체별마감일자 시트 컬럼 구조 (6컬럼)

```
[00] 순번   [01] 업체명   [02] 마감일   [03] 결재일   [04] 비고   [05] 결재현황
```

> **⚠️ 구조 주의**: `[00]`이 `순번`(숫자)이고 `[01]`이 `업체명`임. `[00]`을 고객명으로 읽으면 유령 고객사 생성.

---

## 3. 핵심 파싱 원칙

### 3.1 buildHeaderMap — 동적 헤더 인덱스 맵 구성

헤더 행의 각 셀을 `(공백 제거 + 소문자)` 키로 변환하여 `Map<key, colIndex>`를 생성한다.

```typescript
function buildHeaderMap(row: any[]): Map<string, number> {
  // 중복 헤더 발생 시 첫 번째 컬럼만 등록 (if (!map.has(key)) 조건)
}
```

**⚠️ 결정적 제약**: 동일한 헤더명이 여러 컬럼에 존재할 경우, **첫 번째 컬럼 인덱스만 Map에 등록**된다. 이후 컬럼은 헤더명으로 접근 불가.

### 3.2 getCol — 안전한 값 추출 함수

```
우선순위 1: 키 목록에서 정확히(exact) 일치하는 헤더 → 해당 인덱스 값 반환
우선순위 2: 키 목록에서 부분(includes) 일치하는 헤더 → 해당 인덱스 값 반환
우선순위 3: 위 모두 실패 → fallbackIdx 위치의 값 직접 반환
```

**⚠️ 핵심 주의**: fallback 인덱스는 실제 엑셀 구조와 반드시 일치해야 한다. 중복 헤더가 존재하는 영역은 **반드시 직접 인덱스(r[N])로 파싱**해야 한다.

### 3.3 중복 헤더 컬럼 직접 인덱스 파싱 원칙 (필수)

계약현황 시트의 중복 헤더 컬럼 6개는 모두 직접 인덱스로 파싱한다:

```typescript
// ✅ 올바른 방법: 직접 인덱스 사용
const ownModelRaw   = (r[9]  && String(r[9]).trim()  !== 'nan') ? String(r[9]).trim()  : '';
const leaseModelRaw = (r[12] && String(r[12]).trim() !== 'nan') ? String(r[12]).trim() : '';
const rawModel      = ownModelRaw || leaseModelRaw;   // 당사 우선, 없으면 전대

const ownAssetNo    = (r[10] && String(r[10]).trim() !== 'nan') ? String(r[10]).trim().toUpperCase() : '';
const leaseAssetNo  = (r[13] && String(r[13]).trim() !== 'nan') ? String(r[13]).trim().toUpperCase() : '';

// 계약구분 (Col[8]): '연장', '종료', '가상' 판별
const contractStatusStr = (r[8] && String(r[8]).trim()) ? String(r[8]).trim() : '';
```

```typescript
// ❌ 잘못된 방법: getCol + 잘못된 fallback → 날짜 시리얼이 모델명으로 들어감
const rawModel = getCol(r, mainHeaderMap, ['모델', '기종', '장비명'], 3);
// → 전대 전용 행에서 Col[9]=빈값 → fallback Col[3]=최초개시일=45845(날짜시리얼)
```

### 3.4 날짜 시리얼 숫자 방어

엑셀 날짜 셀은 XLSX 라이브러리 기본 파싱 시 `number` 타입(예: 45845)으로 반환된다.

- 모델명: `sanitizeModelName()` 내부에서 숫자 → 빈문자열 처리
- 날짜 필드: `sanitizeExcelDate()` 함수로 시리얼 → `YYYY-MM-DD` 변환
- 높이 추론: `inferFeetFromModel()` 함수로 모델명 기반 추론 (날짜 시리얼을 높이값으로 사용 금지)

---

## 4. 행 유형 구분 원칙 (계약현황 시트)

| 행 유형 | Col[9] 당사장비 | Col[12] 전대장비 | 처리 방법 |
|---------|--------------|---------------|---------|
| **당사 장비 행** | GS1930, SJ3215 등 | 빈값 | `ownAssetNo = r[10]`, 자사 자산 매핑 |
| **전대 장비 행** | 빈값 | GS1930, ES1330L 등 | `leaseAssetNo = r[13]`, 외부 임차 자산 생성 |
| **혼재 행** | 값 있음 | 값 있음 | 당사 자산 우선 + 전대 임차 이력 병행 생성 |
| **빈 행** | 빈값 | 빈값 | 업체명+모델 모두 없으면 건너뜀 |

### 4.1 계약 그룹핑 원칙

같은 현장에 복수 장비가 배치된 경우 동일 계약으로 묶는다:

```
계약 그룹 키 = `${customerId}_${siteId}_${startDate}_${endDate}`
```

동일 키 행이 여러 번 나오면 `contract_assets` 레코드만 추가하고, `contracts`는 신규 생성하지 않는다.

---

## 5. DB 적재 순서 (DAG — FK 의존성 기준)

```
단계 1:  products        ← FK 없음 (장비 모델 마스터)
단계 2:  vendors         ← FK 없음 (임차업체 마스터)
단계 3:  customers       ← FK 없음 (고객사 마스터)
단계 4:  customer_sites  ← FK: customers
         customer_contacts ← FK: customers
단계 5:  assets          ← FK: products (모델명 참조)
단계 6:  contracts       ← FK: customers, customer_sites
         contract_history ← FK: contracts
단계 7:  contract_assets  ← FK: contracts, assets
         external_leases  ← FK: vendors, contracts, contract_assets
단계 8:  billings        ← FK: customers, contracts
         billing_details  ← FK: billings, contract_assets
단계 9:  purchase_billings         ← FK: vendors
         purchase_billing_details  ← FK: purchase_billings
단계 10: receivables     ← FK: contracts, customers
단계 11: reconciliation_reports  ← 최종 대사 보고서
```

> **미생성 테이블**: `deliveries`, `outbound_inspections`, `asset_inout_logs`는 생성하지 않는다.
> 배차 정보(배차일, 차량, 기사)는 엑셀에 없으므로 도입 후 수동 입력.

---

## 6. 배치 업서트(Batch Upsert) 청크 사이즈 기준

| 테이블 | 청크 사이즈 | 근거 |
|--------|-----------|------|
| products | 100 | 소량 + 스펙 텍스트 필드 많음 |
| vendors | 100 | 소량 |
| customers | 100 | 200~400건 예상 |
| customer_sites / contacts | 100 | customers의 1:N |
| assets | 100 | 726건, 필드 많음 |
| contracts | 200 | 중간 크기 |
| contract_history | 200 | contracts 당 1건 이상 |
| contract_assets | 200 | 행 단위 = 계약 × 자산 수 |
| external_leases | 100 | 전대 자산만 해당 |
| billings | 200 | 월별 × 고객 수 |
| billing_details | 200 | billings의 1:N |
| purchase_billings | 100 | 임차업체 수 기준 |
| purchase_billing_details | 200 | purchase_billings의 1:N |
| receivables | 100 | 운반비 등 미수금 |

---

## 7. 자산 상태 부여 원칙

| 조건 | 부여 상태 | 코드 |
|------|---------|------|
| 계약현황에서 현재 임대 중 (계약구분='연장', 종료일이 미래) | 대여중 | `RENTED` |
| 종료된 계약에 연결된 당사 자산 | 임대가능 | `AVAILABLE` |
| 전대(임차) 자산이며 반납일이 지남 | 반납완료 | `RENTED_RETURNED` |
| 보유자산현황에만 있고 계약 미연결 | 임대가능 | `AVAILABLE` |

> **원칙**: 마이그레이션에서 배차/검수 이력을 생성하지 않으므로, `RENTED` 상태는 계약 매핑을 통해서만 부여한다. 정상 운용 시의 `출고 검수 승인` 트리거(카테고리 1.3)와는 별개 예외 처리임.

---

## 8. 주요 파싱 함수별 로직

### 8.1 `parseClosingDay(dayStr)` — 마감일 파싱

| 입력 | 결과 |
|------|------|
| `'말일'`, `'말'` | `30` |
| `'15일'` | `15` |
| `20` (숫자) | `20` |
| null / 빈값 | `30` (기본값) |

### 8.2 `parsePaymentDueTerm(rawStr)` — 결제 조건 파싱

| 입력 | paymentDueDay | paymentTermDays | 의미 |
|------|-------------|----------------|------|
| `'익월 15일'` | `15` | `null` | 다음달 15일 결제 |
| `'익익월 15일'` | `15` | `null` | 2달 뒤 15일 결제 |
| `'75일'` | `null` | `75` | Net 75 Terms |
| `'60일 전자'` | `null` | `60` | Net 60 Terms |
| `'익월말'` | `30` | `null` | 다음달 말일 |
| 빈값 | `30` | `null` | 기본값 |

### 8.3 `extractSiteNameAndMemo(rawSite)` — 현장명 파싱

```
입력:  '한화포레나천안아산역(7/18 하차)'
출력:
  cleanSiteName : '한화포레나천안아산역'  ← 괄호 내용 제거
  dispatchMemo  : '7/18 하차'             ← 괄호 내용 보존 (배차 메모용)
```

### 8.4 `sanitizeExcelDate(val)` — 날짜 파싱

```typescript
// 숫자 시리얼 (예: 45845) → 'YYYY-MM-DD'
const date = new Date(Math.round((val - 25569) * 86400 * 1000));
// 문자열 (예: '2026.8.1') → '2026-08-01'
const str = String(val).replace(/\./g, '-');
```

### 8.5 `inferMakerFromModel(m)` — 제조사 추론

| 모델 접두사 | 제조사 |
|---------|------|
| `ES`, `ES1330`, `2632ES` | JLG |
| `GS`, `Z-` | Genie |
| `SJ` | SKYJACK |
| `GTJZ`, `GTBZ`, `S08`~`S16`, `1414E` | SINOBOOM |
| `STAR`, `OPTIMUM` | Haulotte |
| `JCPT` | Dingli |

### 8.6 `inferFeetFromModel(m)` — 작업높이(ft) 추론

| 모델에 포함된 숫자 | ft |
|----------------|-----|
| 1930, 1330, 1432, 3215, 0608 | 19 |
| 2646, 2632, 0812, 0808, 3219 | 26 |
| 3246, 1012, 1008 | 32 |
| 4047, 4046, 1212 | 40 |
| 4655, 1412, 1414 | 46 |
| 1612, 1614 | 53 |

---

## 9. 유령 고객사 방지 원칙

### 9.1 업체별마감일자 시트 파싱 시

```typescript
// ✅ 올바른 방법: Col[1] 직접 읽기
const rawCust = (r[1] && String(r[1]).trim() !== 'nan') ? String(r[1]).trim() : null;
if (!rawCust) return;
if (typeof r[1] === 'number') return;  // 순번 숫자인 경우 건너뜀
```

### 9.2 공통 스킵 조건

```typescript
if (!rawCustName && !rawModel) return;      // 업체명+모델 모두 없음
if (typeof rawCustName === 'number') return; // 순번 숫자가 고객명으로 유입
if (!custName) return;                      // normalizeCustomerName 결과 빈값
if (custName === '거래처명' || custName === '업체명') return;  // 헤더 행 혼입
```

---

## 10. 대사 검증(ReconciliationReport) 6개 항목

업로드 완료 후 자동으로 6가지 대사를 수행하고 `reconciliation_reports` 테이블에 저장한다:

| 검증 항목 | 비교 기준 |
|---------|---------|
| 자산 수 대사 | 엑셀 자산 행 수 vs DB assets 건수 |
| 당월 청구 합계 대사 | 엑셀 `당월청구합계` 컬럼 합 vs DB billings 합 |
| 청구 명세 합계 대사 | billings 헤더 합계 vs billing_details 합계 |
| 전대 비용 대사 | 엑셀 임차단가 합 vs DB external_leases 합 |
| 라이프사이클 체인 | contracts 건수 vs 출고 의뢰 건수 |
| Orphan 체크 | 계약 없는 자산, 자산 없는 계약 수 |

---

## 11. 데이터 초기화 순서 (FK 역순 삭제)

재업로드 전 기존 데이터를 안전하게 삭제하는 순서:

```
document_jobs → agent_registry → payment_deposit_links → bank_matching_rules
→ bank_transactions → cash_flow_snapshots → collaboration_request_history
→ collaboration_requests → work_instructions → site_notices → calendar_events
→ activity_logs → tax_invoices → receivables → purchase_payments
→ purchase_billing_details → purchase_billings → payments → credit_card_claims
→ billing_details → billings → maintenance_cost_details → statutory_inspections
→ regular_inspection_items → regular_inspections → repair_history → maintenance_logs
→ asset_inout_logs → outbound_inspections → deliveries → external_leases
→ contract_assets → contract_history → contracts → contract_templates
→ consumable_logs → consumable_purchase_items → consumable_purchase_requests
→ consumables → assets → customer_contacts → customer_sites
→ customers → products → vendors
```

> **보존**: `users`, `departments`, `permissions` 등 시스템 사용자 정보는 삭제하지 않는다.

---

## 12. 운영 절차 (사용자 수행 7단계)

```
1단계: 최고관리자 계정으로 로그인
2단계: [최고관리자] → [초기 DB 업로드] 메뉴 진입
3단계: 엑셀 파일 드래그앤드롭 또는 파일 선택
4단계: [DB 업로드 시작] 버튼 클릭
5단계: 진행 상황 로그 모니터링 (실시간 단계별 메시지 출력)
6단계: 완료 후 대사 리포트(ReconciliationReport) 6개 항목 확인
7단계: 고객 관리, 자산 관리, 계약 관리 화면에서 데이터 정상 여부 육안 검증
```

---

## 13. 알려진 이슈 및 해결 이력 (Build.22~27)

| 빌드 | 이슈 | 원인 | 해결 방법 |
|------|------|------|---------|
| Build.22 | 자산번호 '미지정' | ownAssetNo fallback이 전대칸(13) 참조 | r[10] 직접 읽기로 수정 |
| Build.23 | 구 시트명 불인식 | `'202608'` 하드코딩 | `'계약현황' \|\| '202608'` fallback |
| Build.24 | 자산번호 여전히 미지정 | getCol 키가 헤더에 없어 fallback [13] 사용 | 직접 인덱스 방식으로 전면 교체 |
| Build.25 | contractStatusStr 오파싱 | `['상태','결재상태']` 키 없음→fallback r[10]=관리번호 | r[8](계약구분) 직접 읽기 |
| Build.26 | 전대 장비 모델명=45845 | 중복 헤더→Col[9]=빈값→fallback r[3]=날짜시리얼 | r[9]||r[12] 직접 인덱스 분리 |
| Build.27 | 유령 고객사 생성 | 마감일자 시트 빈 행에서 r[0]=순번→고객명 | r[1](업체명) 직접 읽기, 숫자 건너뜀 |

---

## 14. 향후 개선 과제 (Known Limitations)

| # | 한계 | 내용 | 권고 조치 |
|---|------|------|---------|
| 1 | 배차/검수 이력 미생성 | 과거 입출고 이력은 엑셀에 없어 생성 불가 | 도입 후 수동 입력 |
| 2 | 감가상각 누계액 초기화 | 취득일/취득가격 불완전으로 `accumDepreciation = 0` | 자산 관리 화면에서 수동 수정 |
| 3 | `보유장비 임대현황` 미활용 | 가동상태(임대/대기) 시트를 파싱에 반영 못함 | 추후 교차 검증 로직 추가 예정 |
| 4 | 직원/영업담당자 자동 매핑 불가 | 엑셀에 담당자 컬럼 없어 `salespersonId = null` | 도입 후 계약별 수동 지정 |
| 5 | 계약번호 신규 부번 | `C{YYMM}-{SEQ}` 형식으로 자동 부번, 수기 번호와 다를 수 있음 | 계약번호 수동 확인/수정 가능 |
