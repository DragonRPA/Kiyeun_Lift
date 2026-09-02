# 배차 이력 자동 업로드 로직 설계서

> **작성일**: 2026-09-02  
> **대상 파일**: `배차현황(new) (1).xlsx`  
> **적용 버전**: v0.7.1.Build.32 (예정)  
> **확정 인터뷰 기준**: 2026-09-02 사장님 답변 기반

---

## 1. 엑셀 파일 구조

### 1.1 시트 구성 (총 18개 시트, 1,684건)

| 시트명 | 연월 파싱 | 행 수 |
|--------|---------|------|
| `4월` | **2025-04** | 13건 |
| `5월` ~ `12월` | **2025-05 ~ 2025-12** | 각 81~122건 |
| `26년1월` ~ `26년9월` | **2026-01 ~ 2026-09** | 각 14~137건 |

> **연도 파싱 규칙**: 시트명에 `'26년'` 접두사가 있으면 2026년, 없으면 2025년으로 고정 처리.

### 1.2 컬럼 구조 (13컬럼, 0-indexed)

```
[00] 상차일     ← '1일', '15일' (일 단위만, 연월은 시트명에서 파생)
[01] 하차일     ← 동일 형식
[02] 차량톤수   ← '1.4', '5', '3.5', '5톤축-2' 등 비정형
[03] 운반비     ← 만원 단위 숫자 (34 → 340,000원)
[04] 장비       ← 모델명 약칭 (GS1930, ES1330 등)
[05] 수량       ← 숫자 (1~11)
[06] 업체       ← 고객사명 (customer 테이블 매핑 기준)
[07] 현장명     ← delivery.destinationAddress로만 저장, siteId 미연결
[08] 주소       ← 시/도 단위 주소 (예: '경기 용인')
[09] 배차유무   ← '완료' (전건)
[10] 입출고     ← '출고', '입고', '반납'
[11] 운반업체   ← delivery.transportCompany
[12] 비고       ← delivery.specialNotes (특이사항/마감메모)
```

---

## 2. 핵심 파싱 규칙

### 2.1 날짜 파싱

```typescript
// 시트명에서 연월 추출
function parseSheetYearMonth(sheetName: string): { year: number; month: number } {
  const m26 = sheetName.match(/^26년(\d{1,2})월/);
  if (m26) return { year: 2026, month: parseInt(m26[1]) };
  
  const m25 = sheetName.match(/^(\d{1,2})월/);
  if (m25) return { year: 2025, month: parseInt(m25[1]) };
  
  throw new Error(`시트명 연월 파싱 실패: ${sheetName}`);
}

// 행의 날짜 파싱 (예: '2일오전' → day=2)
function parseDay(rawDay: string): number | null {
  const m = String(rawDay).match(/^(\d{1,2})일/);
  return m ? parseInt(m[1]) : null;
}
```

### 2.2 배차 유형 (delivery.type) 매핑

```
입출고 Col[10] + 비고 Col[12] → delivery.type

우선순위:
1. 비고에 '왕복' 또는 '왕복건' 키워드 포함 → EXCHANGE
2. 입출고 = '출고' → OUTBOUND
3. 입출고 = '입고' → INBOUND
4. 입출고 = '반납' → RETURN
```

### 2.3 운반비 변환

```typescript
// 만원 단위 → 원 단위 변환
const deliveryCost = sanitizeNumber(r[3]) * 10000;
// 예: 34 → 340,000
```

### 2.4 수량 처리 (핵심)

> **정책**: 수량 > 1이어도 **delivery 레코드 1건**만 생성.  
> 수량 정보는 `delivery.specialNotes`(비고란)에 문자열로 기록.

```typescript
const qty = sanitizeNumber(r[5]) || 1;
const modelName = String(r[4]).trim();
const specialNotes = [
  qty > 1 ? `수량: ${qty}대` : '',
  r[12] ? String(r[12]).trim() : ''
].filter(Boolean).join(' / ');
```

### 2.5 업체명 → customer 매핑

```typescript
// normalizeCustomerName() 함수로 정규화 후 매핑
// 매핑 실패 시 customerId = null (미연결로 저장)
const customer = findCustomerByName(customers, r[6]);
const customerId = customer?.id ?? null;
```

### 2.6 contract_assets 매핑 시도

```typescript
// 업체명 + 현장명 + 모델명 3중 매핑 시도
// 1. customerId로 contracts 필터
// 2. destinationAddress 유사 매핑 (포함 관계 허용)
// 3. expectedModel 유사 매핑 (normalizeModelKey 사용)
// → 매핑 성공 시 contractId, contractAssetId 연결
// → 매핑 실패 시 null로 저장 (담당자 추후 수동 연결)
```

### 2.7 배차유무 → status 매핑

```
Col[9] = '완료' → status = 'COMPLETED'
그 외 → status = 'PENDING'
```

---

## 3. delivery 레코드 생성 예시

### 엑셀 입력행 (26년4월, Row 3):
```
상차=1일  하차=1일  차량=1.4  운반비=12  장비=ES1330  수량=2
업체=재영전기  현장=LT그룹 마곡사옥현장  주소=서울 마곡
배차유무=완료  입출고=출고  운반업체=자인일반  비고=(없음)
```

### 생성되는 delivery 레코드:
```json
{
  "id": "DEL-HIST-000001",
  "type": "OUTBOUND",
  "status": "COMPLETED",
  "requestDate": "2026-04-01",
  "loadingDate": "2026-04-01",
  "unloadingDate": "2026-04-01",
  "customerId": "CUST-XXXX",         ← 재영전기 매핑
  "contractId": "CONT-XXXX",         ← 매핑 성공 시
  "contractAssetId": "CA-XXXX",      ← 매핑 성공 시
  "destinationAddress": "LT그룹 마곡사옥현장 (서울 마곡)",
  "transportCompany": "자인일반",
  "vehicleType": "1.4",
  "deliveryCost": 120000,            ← 12 × 10,000
  "specialNotes": "수량: 2대",
  "sourceSheet": "26년4월",
  "sourceMemo": ""
}
```

### 왕복(EXCHANGE) 예시 (비고='왕복건'):
```json
{
  "type": "EXCHANGE",
  "specialNotes": "수량: 4대 / 왕복건",
  ...
}
```

---

## 4. DB 적재 순서 (DAG)

```
1단계: 엑셀 전 시트 파싱 → delivery 레코드 배열 생성
2단계: customer 매핑 (normalizeCustomerName 기준)
3단계: contract/contract_asset 매핑 시도 (3중 조건)
4단계: Supabase deliveries 테이블 batchUpsert (100건 청크)
5단계: 적재 결과 리포트 (성공 N건 / 고객 미매핑 N건 / 계약 미매핑 N건)
```

---

## 5. UI 배치 — 초기DB 업로드 화면 내 신규 섹션

### 위치: 기존 '엑셀 파일 선택' 카드 하단에 탭 또는 별도 카드 추가

```
[ 초기DB 업로드 탭 ]
  ├─ 1. 계약/자산 엑셀 업로드  ← 기존
  ├─ 2. 소급 청구서 기간 설정  ← 기존
  └─ 3. 배차 이력 업로드 (NEW)
         [배차 엑셀 파일 선택]  배차현황(new) (1).xlsx
         파싱 결과 미리보기: 총 N건, 완료 N건, 고객미매핑 N건
         [배차 이력 일괄 적재 시작]
```

---

## 6. 적재 결과 리포트 항목

| 항목 | 설명 |
|------|------|
| 총 파싱 건수 | 전 시트 합산 |
| 적재 성공 건수 | Supabase insert 완료 |
| 고객명 미매핑 건수 | customerId=null인 건 |
| 계약 미매핑 건수 | contractId=null인 건 |
| EXCHANGE(왕복) 건수 | 비고='왕복' 포함 건 |

---

## 7. 주요 예외 처리

| 상황 | 처리 방법 |
|------|---------|
| Col[4] 장비명 없음 | 해당 행 스킵 |
| Col[3] 운반비 없음 | deliveryCost = 0 |
| 날짜 파싱 실패 (예: '말일') | requestDate = 시트연월의 마지막일 |
| 차량톤수 '5톤축-2' 등 비정형 | vehicleType에 원문 그대로 저장 |
| 중복 적재 방지 | sourceSheet + 행번호 기반 id 생성으로 멱등성 보장 |

---

## 8. 미결 사항 / 향후 과제

| # | 내용 |
|---|------|
| 1 | 관리번호 없는 배차행 → 향후 자산번호 수동 연결 UI 필요 |
| 2 | 입고/반납 행의 자산 상태 변경 연동 여부 (현재: 미연동) |
| 3 | 배차 이력 업로드 후 자산 현장 위치 자동 갱신 여부 |
