# 초기 DB 업로드 운영 원칙 및 엔터프라이즈 상세 절차서 (SSOT)

> **문서 버전**: v2.0 (2026-09-02 기준)  
> **최종 적용 빌드**: v1.2.1.Build.56  
> **대상 핵심 파일**: `src/services/migrationEngine.ts`, `src/pages/InitialDbUploader.tsx`, `schema.sql`, `scripts/reorganize_tables_zero_loss.sql`

---

## 1. 목적 및 적용 범위

초기 DB 업로드는 ERP 신규 도입 및 시스템 리빌딩 시 **기존 엑셀 운영 데이터를 Supabase PostgreSQL DB로 무누락·무손실 일괄 이행(Migration)**하는 핵심 엔진이다. 본 문서는 시스템 구축 초기(`v0.7.1`)부터 현재 **전대(외부 임차) 자산 마스터, 타사 구상채권(`VENDOR_CLAIM`), 배차 체인, 6대 도메인 42대 테이블 스키마 재배치(`v1.2.1.Build.56`)**에 이르는 모든 변경 사항과 운영 원칙을 축약 없이 상세히 기록한다.

---

## 2. 입력 엑셀 파일 규격

### 2.1 파일 명칭 및 기본 경로
- **파일명**: `초기DB현황1.xlsx` (고정 명칭 권장)
- **업로드 경로**: 바탕화면 `기연리프트자료_/자동업로드/` 또는 브라우저 내 드래그앤드롭

### 2.2 필수 시트 구성 (5대 시트)

| 순서 | 시트명 (현행) | 구 시트명 (호환) | 헤더 위치 | 데이터 시작 행 | 설명 및 처리 데이터 |
|------|-------------|---------------|----------|-------------|-------------------|
| 1 | `보유자산현황` | (동일) | Row 2 (동적 탐색) | 헤더 다음 행 | 자산 마스터 726건 (취득가, 감가상각, S/N 등) |
| 2 | `보유장비 임대현황` | `26.08` | Row 2 (동적 탐색) | 헤더 다음 행 | 임대 가동 현황 및 자산 상태 교차 검증 |
| 3 | `거래처정보현황` | (동일) | Row 2 (`순번` 행) | Row 3 | 고객사 마스터 265건 (사업자번호, 대표자 등) |
| 4 | `업체별마감일자` | (동일) | Row 2 (`순번` 행) | Row 4 | 업체별 청구 마감일 및 결제조건 189건 |
| 5 | `계약현황` | `202608` | Row 2 (0-indexed) | Row 3 | 계약, 체결장비, 당월청구, 전대임차 대장 1,294건 |

> **⚠️ 시트명 변경 자동 호환성**: `계약현황` 시트를 찾지 못하면 구 시트명 `202608`로 fallback 탐색을 수행한다.
> ```typescript
> const wsMain = wb.Sheets['계약현황'] || wb.Sheets['202608'];
> ```

---

### 2.3 `계약현황` 시트 컬럼 구조 (33개 컬럼 상세 맵)

```
[00] 업체명       [01] 순번         [02] 설치장소     [03] 최초개시일
[04] 개시일       [05] 종료일       [06] 일수         [07] 운반비
[08] 계약구분     [09] 장비명(당사) [10] 관리번호(당사)[11] 수량(당사)
[12] 장비명(전대) [13] 관리번호(전대)[14] 수량(전대)  [15] 임차업체
[16] 협착소유     [17] 공장입고일   [18] 임차개시일   [19] 반납일
[20] 임차단가     [21] 월렌탈료     [22] 당월렌탈료   [23] 당월기타청구
[24] 기타내역     [25] 당월청구합계 [26] 마감일       [27] 거래명세표
[28] 계산서       [29] 결재조건     [30] 결재일       [31] 결재금액
[32] (공란)
```

> **⚠️ 중복 헤더 주의 사항**:
> - `장비명` [09](당사) / [12](전대)
> - `관리번호` [10](당사) / [13](전대)
> - `수량` [11](당사) / [14](전대)
> 
> 중복 헤더가 존재하므로 헤더명 기반 맵(`Map`) 검색 시 뒷자리 컬럼이 누락될 수 있어 **반드시 직접 배열 인덱스(`r[N]`) 방식으로 파싱**해야 한다.

---

### 2.4 `업체별마감일자` 시트 컬럼 구조 (6개 컬럼)

```
[00] 순번   [01] 업체명   [02] 마감일   [03] 결재일   [04] 비고   [05] 결재현황
```

> **⚠️ 유령 고객사 방지**: `[00]` 컬럼은 숫자 `순번`이고 `[01]`이 실제 `업체명`이다. `[00]`을 고객명으로 오인 파싱하면 유령 고객사(1, 2, 3...)가 생성되므로 반드시 `[01]`을 읽어야 한다.

---

## 3. 핵심 파싱 원칙 및 방어 로직

### 3.1 동적 헤더 탐색 및 직접 인덱스 파싱 원칙
- 헤더명이 유일한 컬럼은 `getCol(row, headerMap, aliases, fallbackIdx)`을 사용하되,
- 중복 헤더(당사 장비 vs 전대 장비, 당사 관리번호 vs 전대 관리번호)는 아래와 같이 **직접 인덱스(`r[N]`)**로만 파싱한다:

```typescript
// ✅ 중복 헤더 직접 인덱스 분리 파싱
const ownModelRaw   = (r[9]  && String(r[9]).trim()  !== 'nan') ? String(r[9]).trim()  : '';
const leaseModelRaw = (r[12] && String(r[12]).trim() !== 'nan') ? String(r[12]).trim() : '';
const rawModel      = ownModelRaw || leaseModelRaw;

const ownAssetNo    = (r[10] && String(r[10]).trim() !== 'nan') ? String(r[10]).trim().toUpperCase() : '';
const leaseAssetNo  = (r[13] && String(r[13]).trim() !== 'nan') ? String(r[13]).trim().toUpperCase() : '';
const contractStatusStr = (r[8] && String(r[8]).trim()) ? String(r[8]).trim() : '';
```

### 3.2 엑셀 날짜 시리얼 숫자 방어 (Zero-Number-as-String)
- 엑셀의 날짜 셀(예: 45845)이 모델명이나 문자열 필드로 잘못 유입되지 않도록 `sanitizeModelName()` 내부에서 순수 숫자는 필터링한다.
- 날짜 필드는 `sanitizeExcelDate(val)`를 통해 `(val - 25569) * 86400 * 1000` 공식으로 `YYYY-MM-DD` 표준 포맷으로 변환한다.

---

## 4. 행 유형 구분 및 계약 그룹핑 원칙

### 4.1 행 유형 판별 기준

| 행 유형 | Col[9] 당사장비 | Col[12] 전대장비 | 처리 및 데이터 생성 로직 |
|---------|--------------|---------------|------------------------|
| **당사 장비 행** | 값 있음 (예: SJ3219) | 빈값 | `ownAssetNo=r[10]` ➔ 자사 자산(`ownerType: 'OWNED'`) 매핑 |
| **전대 장비 행** | 빈값 | 값 있음 (예: GS1930) | `leaseAssetNo=r[13]` ➔ 외부 임차 자산(`ownerType: 'RENTED'`) 생성, 원사 매핑 |
| **혼재 행** | 값 있음 | 값 있음 | 당사 자산 우선 체결 + 전대 임차 이력 병행 생성 |
| **빈 행** | 빈값 | 빈값 | 업체명과 모델명이 모두 없으면 스킵 |

### 4.2 계약 그룹핑 원칙 (단일 계약 다수 장비 바인딩)
동일 고객사의 동일 현장, 동일 계약 기간인 경우 단일 계약(`contracts`) 1건으로 묶고 `contract_assets`를 N건 생성한다:
```typescript
const contractGroupKey = `${customerId}_${siteId}_${startDate}_${endDate}`;
```

---

## 5. 전사 42대 테이블 스키마 체계 및 적재 DAG (FK 순서)

현재 ERP 데이터베이스는 **6대 비즈니스 도메인 총 42개 테이블**로 구성되며, 업로드 시 외래키(FK) 참조 무결성을 위해 아래의 DAG 순서로 일괄 적재된다:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [단계 1]  products                 ← 장비 제원 및 표준 카탈로그 (FK 없음)               │
│ [단계 2]  vendors                  ← 매입처 및 임차 원사 마스터 (FK 없음)               │
│ [단계 3]  customers                ← 고객사 마스터 (FK 없음)                             │
│ [단계 4]  customer_sites           ← 고객사 현장 목록 (FK: customers)                   │
│           customer_contacts        ← 고객사 담당자 목록 (FK: customers)                 │
│ [단계 5]  assets                   ← 자사/임차 자산 마스터 (FK: products, vendors)       │
│ [단계 6]  contracts                ← 임대 계약 마스터 (FK: customers, customer_sites)   │
│           contract_history         ← 계약 변경/승계 타임라인 (FK: contracts)             │
│ [단계 7]  contract_assets          ← 계약 체결 장비 (FK: contracts, assets)             │
│           external_leases          ← 전대 임차 원가 계약 (FK: vendors, contracts)       │
│ [단계 8]  billings                 ← 월별 매출 청구 마스터 (FK: customers, contracts)   │
│           billing_details          ← 청구 상세 내역 (FK: billings, contract_assets)     │
│ [단계 9]  receivables              ← 운반비/부대비용/타사구상금 (FK: contracts, customers)│
│ [단계 10] purchase_settlements     ← 매입 정산 마스터 (FK: vendors)                      │
│           purchase_settlement_items← 매입 정산 상세 내역 (FK: purchase_settlements)     │
│ [단계 11] reconciliation_reports   ← 최종 6대 대사 검증 보고서                          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

> **비고**: `deliveries`, `outbound_inspections`, `repairs` 등 현장 실시간 트랜잭션 테이블은 엑셀에 상세 데이터가 없으므로 과거 이력은 마이그레이션하지 않고 ERP 오픈 후 실시간 생성된다.

---

## 6. 자산 상태(`status`) 부여 및 라이프사이클 헌장 원칙

마이그레이션 시 자산 상태는 엑셀 `Col[8] 계약구분` 셀의 명시 값만을 기준으로 결정한다. **종료일 날짜가 과거라고 해서 임의로 자산을 반납/대여가능으로 전환하는 것을 엄격히 금지한다.**

| 조건 | 계약 `status` | 자산 `status` | 현장 바인딩 | 비고 |
|------|--------------|--------------|------------|------|
| Col[8] 값 없음, '연장', 기타 | `ACTIVE` | `RENTED` | ✅ 유지 | 현장 가동 중 |
| **Col[8]='연장' + 종료일 경과** | **`ACTIVE`** | **`RENTED`** | **✅ 유지** | **연장/반납 미결 상태** |
| Col[8]='종료' 명시 (자사 자산) | `COMPLETED` | `AVAILABLE` | ❌ 해제 | 당사 주기장 입고 완료 |
| Col[8]='종료' 명시 (전대 자산) | `COMPLETED` | `RENTED_RETURNED` | ❌ 해제 | 타사 원사 반납 완료 |

---

## 7. 전대(외부 임차) 자산 및 원천 손익 원장 고도화 (`v1.2.1` 반영)

### 7.1 장비 식별 & 재전대 라이프사이클 영속성
- **`vendorAssetNo` (원사 원래번호)**: 타사 장비의 실물 번호(예: `1004`)를 기연 관리번호(예: `R-001`)와 1:1 매핑하여 DB에 영속 저장.
- **재임차 시 상태 전환 원칙**: 타사에 반납했던 장비가 동일 번호로 재임차되는 경우, 새 자산번호를 채번하지 않고 기존 레코드의 상태를 `RENTED_RETURNED` ➔ `AVAILABLE`로 1-Click 재활성화하여 이력 연속성 유지.

### 7.2 대차대조 손익 원장 (Spread Margin) 체계 연동
- **매출 원천**: 확정 청구서(`billings`) 및 세금계산서.
- **원가 원천**: 원사 매입세금계산서(`purchase_settlements`) + 배차 운송비(`deliveries`).
- **대차대조 검증**: `[계약 확정 청구액] - [매입원가 + 직송운송비] = 🟢 순마진 (스프레드 마진율 %)`.

---

## 8. 부대비용 및 외상미수금 / 타사 구상채권 (`VENDOR_CLAIM`)

### 8.1 엑셀 운반비 자동 추출 제외 원칙 (Build.63 개정)
- **도메인 원칙**: 과거 엑셀의 `Col[7] 운반비`는 과거 계약 체결 시점의 참조값이거나 날짜 오입력 셀(시리얼 번호 `46086`)이므로, **초기 DB 업로드 시 현재 시점의 미청구 외상채권(`receivables`)으로 자동 생성하지 않는다.**
- **외상미수금 생성 조건**: 외상미수금은 오직 ERP 정식 가동 후 **"실제 배차가 완료되어 고객 청구(`billableToCustomer: true`)로 승인된 건"**이나 **"입고 검수/정비 시 고객 과실로 판정된 수리비 건"** 등 현장 이벤트에 의해서만 실시간 생성된다.

### 8.2 타사 구상채권 (`type: 'VENDOR_CLAIM'`) 통합 관리
- 원사가 기연에 청구한 파손 수리비/세척비/부대비용은 `Receivables`에 `type: 'VENDOR_CLAIM'`으로 적재되며, 고객사 정기 청구서 발행 시 1회 또는 수회에 걸쳐 분할 상계 처리.

---

## 9. 소급 청구서 생성 및 수납 정합성 원칙

### 9.1 기본 동작: 미선택 시 0건 (안전 모드)
- 초기 업로드 시 과거 소급 청구서는 **기본적으로 생성하지 않는다.**

### 9.2 소급 청구 기준일: `Col[3] 최초개시일`
- `Col[3] 최초개시일`: 실제 계약이 처음 체결된 일자 (소급 청구 기산일).
- `Col[4] 개시일`: 당월 청구 기산일 (소급 계산에 사용 금지).

### 9.3 소급 청구 데이터 상태
- `status: 'PAID'`, `paidAmount = totalAmount` (과거 청구는 수납 완료로 간주하여 기초 잔액 왜곡 방지).

---

## 10. 대사 검증(Reconciliation Report) 6대 무결성 검증식

업로드 완료 직후 자동으로 6가지 대차대조 검증을 수행하고 `reconciliation_reports` 테이블에 감사 로그로 저장한다:

```
① 자산 수 일치식      : 엑셀 자산 행 수 = DB assets 레코드 수
② 당월 청구 합계 일치식: 엑셀 [25] 당월청구합계 = DB billings 합계 (오차 ₩0)
③ 청구 헤더-상세 대사  : billings 공급가액 합계 = billing_details 합계 (오차 ₩0)
④ 전대 임차료 대사    : 엑셀 [20] 임차단가 합계 = DB external_leases 합계
⑤ 계약-배차 체인 검증 : contracts 건수 = 출고 의뢰 건수 (도입 후 연계)
⑥ 고아(Orphan) 검증   : 계약 없는 자산 수 = 0, 자산 없는 계약 수 = 0
```

---

## 11. 데이터 초기화 순서 (42개 테이블 FK 역순 CASCADE)

재업로드 전 기존 데이터를 안전하게 삭제하는 공식 역순:

```sql
settlement_payment_logs → purchase_settlement_items → purchase_settlements
→ payment_deposit_links → payments → receivables → billing_details
→ billing_invoices → billings → bank_matching_rules → bank_transactions
→ bank_account_initial_balances → cash_flow_snapshots → prepaid_transactions
→ delinquency_action_logs → depreciation_logs → outbound_inspections
→ inbound_defect_details → asset_in_out_logs → repair_timeline_events
→ repair_consumables → repairs → inspection_checklist_items → deliveries
→ transport_drivers → transport_companies → contract_history → contract_assets
→ contracts → mechanic_consumable_stocks → consumable_logs
→ consumable_purchase_items → consumable_purchase_requests → consumable_purchases
→ consumables → assets → products → customer_bank_accounts
→ customer_sites → customer_contacts → customers → vendors
→ payroll_closings → overtime_records → leave_usages → annual_leave_quotas
```

> **영구 보존**: `users`, `departments`, `permissions`, `todos`, `announcements`, `google_configs` 등 임직원 계정 및 시스템 설정 테이블은 초기화 대상에서 제외된다.

---

## 12. 사용자 운영 절차 (8단계 논스톱 가이드)

```
1단계: 최고관리자(ADMIN) 계정으로 ERP 로그인
2단계: [설정 / 마스터] → [초기 DB 업로드] 메뉴 진입
3단계: 엑셀 파일 선택 (초기DB현황1.xlsx 드래그앤드롭)
4단계: [과거 소급 청구서 생성] 옵션 선택 (기본: OFF, 필요 시 시작월~종료월 지정)
5단계: 엑셀 파싱 완료 팝업 확인 (자산 N건, 계약 N건, 거래처 N건)
6단계: [전체 데이터 일괄 적재 시작] 클릭 (청크 100~200건 단위 자동 분할 업서트)
7단계: 실시간 단계별 진행 로그 모니터링
8단계: 완료 후 [대사 리포트(Reconciliation Report)] 6개 항목 100% 녹색 확인
```

---

## 13. 누적 이슈 및 해결 이력 (Build.22 ~ Build.56 전체 상세 이력표)

| 빌드 | 해결 이슈 및 기능 고도화 | 근본 원인 (Root Cause) | 적용된 엔지니어링 조치 |
|------|------------------------|----------------------|----------------------|
| **Build.22** | 자산번호 '미지정' 발생 | 당사 자산 fallback이 전대 컬럼(13) 참조 | `r[10]` 직접 읽기로 수정 |
| **Build.23** | 구 시트명 인식 불가 | `'202608'` 하드코딩 | `'계약현황' \|\| '202608'` 동적 fallback 구현 |
| **Build.24** | 헤더 누락 자산 미지정 | getCol 키 불일치로 fallback 오작동 | 직접 인덱스 파싱 방식으로 전면 교체 |
| **Build.25** | 계약 상태 오파싱 | 키 매핑 부재로 관리번호를 상태로 오인 | `r[8]`(계약구분) 직접 추출 |
| **Build.26** | 전대 장비 모델명=45845 | 중복 헤더로 인해 날짜 시리얼 유입 | `r[9] \|\| r[12]` 직접 인덱스 분리 및 날짜 시리얼 방어 |
| **Build.27** | 유령 고객사(1, 2, 3...) 생성 | 순번 숫자 컬럼(`r[0]`)을 고객명으로 파싱 | `r[1]`(업체명) 직접 추출 및 숫자 스킵 로직 적용 |
| **Build.28** | 운반비 컬럼 오류 | fallback 인덱스가 임차단가(20) 참조 | `r[7]`(운반비) 직접 읽기로 수정 |
| **Build.29** | 소급 청구서 12건 누락 | 소급 기준일로 당월 기산일(Col[4]) 사용 | `Col[3]`(최초개시일) 직접 파싱으로 수정 |
| **Build.30** | 소급 청구 자동 생성 부담 | 무조건 자동 생성으로 수납 대사 혼란 | 소급 생성 여부 선택 UI 탑재 및 기본값 OFF 전환 |
| **Build.31** | 만료 자산 자동 회수 처리 | 날짜 경과로 자산을 자동 AVAILABLE 처리 | 날짜 기준 자동 회수 영구 금지, `Col[8]='종료'` 명시 시에만 반영 |
| **Build.54** | 전대 자산 원천정보 손익원장 | 전대 장비 매입/매출/운송비 파편화 | `vendorAssetNo` 탑재, 계약별/자산별 대차대조 손익원장 신설 |
| **Build.55** | DB 스키마 6대 도메인 재정돈 | 잦은 패치로 물리적 컬럼 배치 누더기화 | 전사 42대 테이블 6단계 표준 논리적 배치 & 무손실 원자적 스왑 DDL 구축 |
| **Build.56** | 엑셀 내보내기 스키마 표준 동기화 | 화면별 엑셀 출력 컬럼 순서 불일치 | 전 화면 엑셀 내보내기를 스키마 재배치 표준과 100% 동기화 |

---

## 14. 스키마 재배치 및 무손실 테이블 스왑 연계 가이드

ERP DB 운영 중 컬럼 배치 조정이나 스키마 패치가 필요한 경우, 기존 데이터를 삭제하지 않고 아래 원자적 테이블 스왑 스크립트를 사용하여 **0.01초 단일 트랜잭션 내에 무손실 교체**를 수행한다:

```sql
-- 실행 파일: scripts/reorganize_tables_zero_loss.sql
BEGIN;
-- 1. 누락 컬럼 선제 방어 (ADD COLUMN IF NOT EXISTS)
-- 2. 새 표준 구조 테이블 생성 (assets_new, deliveries_new, receivables_new, repairs_new)
-- 3. 안전 데이터 복제 (COALESCE + 타입 변환)
-- 4. 원자적 테이블 교체 (DROP TABLE ... CASCADE && ALTER TABLE ..._new RENAME TO ...)
-- 5. RLS 보안 정책 및 권한 일괄 재연결
COMMIT;
```

---

> **시스템 무결성 보장 선언**:  
> 기연리프트 ERP의 초기 DB 업로드 엔진은 현장 라이프사이클과 회계 대차대조 무결성을 100% 보장하며, 전사 표준 헌장(카테고리 I~X)에 따라 단 1원의 오차나 데이터 유실 없이 운영된다.
