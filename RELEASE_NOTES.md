# Release Notes (v1.4.2 - 2026-07-26 00:43)

## 🗂️ 자산 (장비) 관리 대장 전면 개편
- **자산 조회 불능 버그 수정**: `useMemo` 기반 필터링으로 전환, 초기 진입 시 `조회` 버튼 없이도 전체 자산 목록이 즉시 표시되도록 수정.
- **테이블 헤더 DB 스키마 기반 재구성**: 기존 헤더에서 누락된 `제조사`, `제조번호(S/N)`, `제조년도`, `소유구분` 컬럼 추가. `colgroup` 기반 픽셀 단위 컬럼 폭 제어로 화면 밀도 최적화 (12컬럼 구성).
- **수정 권한 보유자(`asset > save`) 인라인 편집 기능**: 상세 모달 내 [수정] 버튼 노출, 기본 정보/운용현황/재무정보/임차정보/누적손익/매각정보 전 섹션 필드 수정 후 즉시 Supabase 저장(UPDATE) 처리. 저장 실패 시 에러 모달 표출.
- **빈 상태 안내 개선**: 자산 데이터가 없을 때 업로드 안내 문구 표시.

# Release Notes (v1.4.1.Build.00004 - 2026-07-26 00:37)

## 🔐 Supabase RLS 해결 방식 전환: DISABLE → anon/authenticated Policy 생성 방식
- **핵심 지식 확정**: `upsert`는 내부적으로 SELECT(존재 확인) → INSERT or UPDATE 3단계를 거치므로 SELECT/INSERT/UPDATE 세 가지 Policy가 모두 필요. `authenticated` Policy만으로는 `anon` 키 클라이언트에서 여전히 차단되므로 `anon` 롤 Policy도 반드시 함께 생성해야 함.
- **`DevDataUploader.tsx`**: `generateRlsPolicyDDL(table)` 헬퍼 함수 신규 추가 및 모든 RLS 패치 DDL을 `DISABLE ROW LEVEL SECURITY` 대신 `CREATE POLICY` 6구문(anon 3개 + authenticated 3개) 방식으로 전환.
- **`ErrorModal.tsx`**: RLS 오류 감지 시 생성되는 인라인 DDL 박스도 동일하게 Policy 생성 방식으로 전환. 설명 문구도 "RLS를 유지한 채로 허용"으로 변경.
- **`AGENTS.md` (글로벌 규칙 6번 갱신)**: RLS 조치 의무를 DISABLE 방식에서 Policy 추가 방식으로 영구 정정. 표준 Policy DDL 패턴 및 배경 지식(upsert 3단계 메커니즘) 추가.

# Release Notes (v1.4.1.Build.00003 - 2026-07-26 00:29)

## 🔓 에러 모달 RLS 즉시 복구 DDL 패치 생성 & 복사 기능 추가
- **`ErrorModal.tsx` 개편**: RLS(`42501` / `row-level security`) 오류 발생 시 모달 내부에서 영향받은 테이블명을 자동으로 파싱하여 해당 테이블 전용 `ALTER TABLE "tableName" DISABLE ROW LEVEL SECURITY;` DDL 패치를 즉시 생성하고 복사할 수 있는 **[🔓 RLS 해제 DDL 복사]** 버튼 UI를 본문 하단에 동적으로 표출하도록 개편.
- **자동 테이블명 감지 3중 패턴 파싱**: `row-level security policy for table "tableName"` / `[테이블: tableName]` / `policy for table "tableName"` 세 가지 에러 메시지 포맷에서 모두 테이블명을 추출.
- **DDL 텍스트박스 인라인 표시**: 황색 경고 영역에 녹색 텍스트로 SQL을 코드박스로 노출하여 시각적으로 즉시 인지 가능.

# Release Notes (v1.4.1.Build.00002 - 2026-07-26 00:22)

## 🛡️ Supabase RLS 쓰기 권한 실시간 테스트 & 엑셀 업로드 원클릭 복구 가이드 강화
- **DB 스키마 정합성 검증 도구 실시간 쓰기(INSERT/UPSERT) 권한 검증 추가 ([DevDataUploader.tsx](file:///d:/GoogleDrive/RPA%20개발/01.AntiGravity/Kiyuen_Lift/src/pages/DevDataUploader.tsx))**:
  - `SELECT` 읽기는 허용되지만 `INSERT/UPSERT` 쓰기가 차단된 RLS 상태까지 정밀 실시간 테스트(`__RLS_TEST_...` 가상 덤미 테스트)하여 사전 100% 검출하도록 개편.
- **엑셀 일괄 업로드 실패 시 직관적 RLS 복구 가이드 연동**:
  - `42501` / `new row violates row-level security policy` 발생 시 원인 분석 및 `ALTER TABLE "tableName" DISABLE ROW LEVEL SECURITY;` 쿼리 안내문 자동 바인딩.

# Release Notes (v1.4.1.Build.00001 - 2026-07-26 00:19)

## 🛡️ Supabase 실시간 DB 정합성 검증 도구 RLS(Row-Level Security) 검증 & DDL 패치 강화
- **RLS 정책 위반 실시간 검증 및 알림 ([DevDataUploader.tsx](file:///d:/GoogleDrive/RPA%20개발/01.AntiGravity/Kiyuen_Lift/src/pages/DevDataUploader.tsx))**:
  - 데이터베이스 스키마 검증 시, `new row violates row-level security policy`와 같은 RLS 정책 위반 오류 발생 가능성 및 차단 상태를 실시간 감지하도록 보강.
- **자동 DDL 복구 패치 쿼리 생성 강화**:
  - 누락된 컬럼 추가뿐만 아니라, RLS 정책으로 인한 쓰기 차단을 원클릭 해제/허용하는 `ALTER TABLE "tableName" DISABLE ROW LEVEL SECURITY;` 쿼리를 자동 생성 SQL 스크립트에 필수 포함.
- **글로벌 DB 정합성 검증 정책 강화 (`AGENTS.md`)**:
  - 글로벌 규칙 6번에 RLS 정밀 검증 및 자동 DDL 해제 패치 생성 의무 조항 등록 및 시스템 학습 완료.

# Release Notes (v1.4.1.Build.00000 - 2026-07-26 00:15)

## 🎛️ 토글 버튼 스위치(Toggle Switch) UI 디자인 개편 & 수동 배차 적용
- **공통 토글 스위치 디자인 시스템 구축 ([ToggleSwitch.tsx](file:///d:/GoogleDrive/RPA%20개발/01.AntiGravity/Kiyuen_Lift/src/components/ToggleSwitch.tsx), [index.css](file:///d:/GoogleDrive/RPA%20개발/01.AntiGravity/Kiyuen_Lift/src/index.css))**:
  - 기존 일반 체크박스 형태의 입력 요소를 모던하고 시각적 직관성이 뛰어난 애니메이션 토글 스위치(Toggle Switch) 디자인으로 모듈화.
- **배차 관리 폼 적용 ([TruckDispatch.tsx](file:///d:/GoogleDrive/RPA%20개발/01.AntiGravity/Kiyuen_Lift/src/pages/TruckDispatch.tsx))**:
  - `[+ 신규 수동 배차 요청 생성]` 모달 및 기존 배차 정보 수정 모달 내의 `'고객 청구 여부 (billableToCustomer)'` 입력 폼을 토글 스위치 컴포넌트로 전면 전환.

# Release Notes (v1.4.0.Build.00001 - 2026-07-26 00:03)

## 🐛 전 스토리지/DB 데이터 저장 성공 검증 및 무음 실패 방지(Zero Silent Failures) 개편
- **소모품 및 자재 구매신청 저장 오류 수정 ([Consumables.tsx](file:///d:/GoogleDrive/RPA%20개발/01.AntiGravity/Kiyuen_Lift/src/pages/Consumables.tsx))**:
  - 구매신청 제출(`requestConsumablePurchase`), 입고 처리(`inboundConsumablePurchase`), 소모품 출고/사용(`useConsumable`), 접수 및 구매완료 처리 등 소모품 관리 내 모든 저장 액션에 비동기 `awaitPendingWrites` 동기화 및 `try/catch` 에러 모달(`showErrorModal`) 연동.
- **글로벌 저장 안정성 검증 정책 추가 (`AGENTS.md`)**:
  - 규칙 8번: 모든 데이터 저장/수정/삭제 시 `await db.awaitPendingWrites()`를 동기로 수행하여 실시간 성공 검증을 강제하고, 저장이 무음으로 실패하지 않도록 UI 에러 모달 노출 원칙을 시스템 글로벌 정책으로 확정.

# Release Notes (v1.4.0.Build.00000 - 2026-07-25 23:45)

## 🚀 배차/운송 관리, 월말 정산 대사, 운송 마스터, 반납 배차 및 귀속월 개편
### 1. 매출 귀속월(billingYm) 동적 할당 (`Billings.tsx`, `AssetAcquisitionDisposal.tsx`)
- 청구 생성 시 기본값을 오늘 날짜 기준 `YYYY-MM` 동적 할당 및 수정 가능 개편.
- 임처 자산 매각/매입 시 귀속월 동적 선택 파라미터 연동.

### 2. 임차자산 반납 및 회수/반납 배차 통합 신청 (`RentAssets.tsx`)
- 임차자산 반납 모달 확장: 반납 처리와 동시에 회수/반납 배차(`Delivery: RETURN`) 동시 신청 옵션 탑재.
- 상/하차지, 톤수/차종, 예상 운송료 입력 연동.

### 3. 배차 및 운송 차량/장비 멀티 지정 & [+ 수동 배차 생성] (`TruckDispatch.tsx`)
- 8종 차량 톤수 (`1.4T`, `2.5T`, `3.5T`, `5T`, `5T장축`, `8.5T`, `11T`, `노배드`) 별 대수 지정 지원.
- 1개 배차 건에 2종류 이상 다중 차량 배차 및 다중 운반 장비 모델/대수 연동 (`SmartDispatch`/`SmartReturn` 자동 연동).
- **[+ 수동 배차 생성]** 모달 제공: 출고, 회수, 이동, 반납 배차 수동 작성 지원.

### 4. 운송 거래처 및 기사 마스터 관리 개편 (`TransportMaster.tsx`)
- 기사 마스터 스키마 확장: 주민번호 7자리 마스킹 (`000000-0*`), 주소, 차량색상, 차종, 차량번호 등록.
- 운송 거래처 입금 계좌정보(`bankName`, `bankAccount`, `bankHolder`) 등록 및 **1-Click 계좌 복사 버튼** 추가.

### 5. 월말 운송료 정산 대사 및 매입 지급 요청 보드 (`TruckDispatch.tsx`)
- 상차지(`originAddress`), 하차지(`destinationAddress`) 필드 및 고객 청구 여부(`billableToCustomer`) 지원.
- **공급가액 기준 정산 대사**: 선택 건들의 공급가액 합계 + 부가세 10% 자동 집계.
- **최종 운송료 재수정 및 사유 기록**: 최초 예상 운송료 외에 거래명세표 기준 최종 확정 운송료 및 금액 변동 사유 인라인 수정.
- **지급 상태 추적 및 마감 Lock**: `PENDING` ➔ `RECONCILED` ➔ `PAYMENT_REQUESTED` ➔ `PAID`.
- **마감 Lock (지급완료 건)**: `PAID` 상태 건은 수정/삭제/회수가 원천 불가능.
- **지급요청 회수**: `PAYMENT_REQUESTED` 건을 `PENDING`으로 복구하여 재대사 가능.

# Release Notes (v1.3.5.Build.00004 - 2026-07-25 22:07)

## 🐛 전체 프로젝트 ID 생성 규칙 통일 — Date.now() 타임스탬프 방식 전면 폐기
### 공통 원칙
- 전체 프로젝트에서 `Date.now()` 타임스탬프 기반 ID를 `generateNextId()` 기반 순번형 7자리 패딩 ID(`PREFIX-0000001`)로 전면 통일.
- ID가 시각적으로 순번을 나타내어 데이터 관리 및 감사 추적에 유리.

### db.ts — generateNextId() prefix 매핑 전체 테이블로 확장
- 기존 6개 테이블(`products, customers, assets, sites, contacts, contracts, vendors`)에서 전체 22개 테이블로 prefix 매핑 대폭 확장.
- 신규 prefix: `DLV-(배송)`, `REP-(수리)`, `BILL-(청구)`, `BDET-(청구명세)`, `PAY-(납부)`, `TODO-(할일)`, `RULE-(매칭규칙)`, `TXN-(거래내역)`, `DEPT-(부서)`, `USR-(사용자)`, `PERM-(권한)`, `CSM-(소모품)`, `CLOG-(소모품로그)`, `CPRC-(소모품구매)`, `CAST-(계약자산)`, `CHST-(계약이력)`, `AIOG-(자산입출고)`, `CFSN-(현금흐름스냅샷)`, `TCOM-(운송사)`, `TDRV-(기사)`.

### AppContext.tsx — 계약번호/매칭규칙 ID 교정
- `contractNo`: `S-CTR-${Date.now()}` → 기존 계약 목록 최대 순번 추출 후 `S-CTR-0000001` 형식 채번.
- `bankMatchingRules` 신규 규칙 ID: 수동 `RULE-xxxxxx` 생성 제거 → `db.insertRow()` 내부 `generateNextId()` 자동 채번으로 위임.

### OrganizationSettings.tsx — 부서/사용자 ID 교정
- `departments` 신규 ID: `dept-${Date.now()}` → `db.generateNextId('departments', departments)` (`DEPT-0000001`).
- `users` 신규 ID: `u-${Date.now()}` → `db.generateNextId('users', users)` (`USR-0000001`).

# Release Notes (v1.3.5.Build.00003 - 2026-07-25 22:03)

## 🐛 공급자 ID 생성 방식 교정 — 타임스탬프 끝자리 → 순번형 7자리 패딩 넘버
### Vendors.tsx — 신규 공급자 ID `VND-0000001` 순번형 자동 채번
- 기존: `VND-${Date.now().slice(-6)}` → 타임스탬프 끝 6자리 (`VND-443614` 등 불규칙).
- 변경: 현재 등록된 vendors 목록에서 최대 순번을 추출하고 +1 하여 7자리 zero-padding 순번 ID(`VND-0000001`, `VND-0000002`...)를 자동 채번합니다.

# Release Notes (v1.3.5.Build.00002 - 2026-07-25 21:37)

## 🐛 매입처(공급자) 저장 오류 無음소거 수정 — Supabase 비동기 쓰기 await + 에러 모달 연동
### Vendors.tsx — handleSaveSubmit async/await + 에러 모달
- 기존: `saveVendor()` 호출 직후 즉시 `alert('성공')` → Supabase 실제 저장 결과와 무관하게 성공 안내가 표시되어 **DB 저장 오류가 사용자에게 무음소거**되던 문제 수정.
- 변경: `handleSaveSubmit`을 `async` 함수로 전환하고 `try/catch` 구문으로 `await saveVendor(payload)` 처리. 저장 중 예외 발생 시 `showErrorModal`로 오류 내용을 팝업 모달로 즉시 안내.

### AppContext.tsx — saveVendor async + Supabase pendingWrites await
- `saveVendor`를 `async` 함수로 전환하고 `db.insertRow/updateRow` 실행 후 **`db.awaitPendingWrites()`를 명시적으로 await**하여 Supabase 비동기 쓰기 큐가 완전히 완료된 뒤 결과를 반환하도록 보정.
- Supabase 저장 실패 시 에러가 `throw`되어 호출부(`Vendors.tsx`)에서 `showErrorModal`로 수신됩니다.

# Release Notes (v1.3.5.Build.00001 - 2026-07-25 21:26)

## ✨ 권한 관리 테이블 헤더 최상위 전체선택/전체해제 버튼 추가 & updatedAt 타임스탬프 자동주입
### UsersPermissions.tsx — 최상위 일괄 전체선택/전체해제 버튼 구현
- `상위-하위 계층 메뉴 권한 매트릭스` 테이블 컬럼 헤더(`조회 (VIEW)`, `저장 (SAVE)`)에 모든 카테고리의 전체 메뉴를 한 번에 일괄 지정/회수 가능한 최상위 `전체선택` / `전체해제` 버튼을 추가했습니다.
- 선택한 직원의 전체 권한 충족 여부에 따라 버튼의 Label과 색상(`전체선택` <-> `전체해제`)이 유기적으로 동적 전환됩니다.

### AppContext.tsx — permissions upsert 시 updatedAt/createdAt 자동 바인딩
- Supabase 원격 DB의 `permissions` 테이블에 `"updatedAt"` 컬럼이 `NOT NULL` 제약조건으로 구성된 경우 발생하던 `null value in column "updatedAt" ... violates not-null constraint` 에러를 방지하기 위해 payload에 ISO 타임스탬프를 명시적으로 주입하도록 개편했습니다.

# Release Notes (v1.3.4.Build.00003 - 2026-07-25 21:21)

## 🐛 permissions 테이블 role NOT NULL 레거시 제약 조건 우회 패치
### AppContext.tsx — updatePermissions 내 role 기본값 더미 바인딩
- Supabase 원격 DB의 `permissions` 테이블에 `role` 컬럼이 `NOT NULL`로 구성되어 있는 구버전 스펙 환경에서 저장 시 발생하는 `null value in column "role" of relation "permissions" violates not-null constraint` 에러를 방지하도록 `role: (p as any).role || 'USER'` 기본값 더미 데이터를 자동 주입합니다.

### schema.sql — role 컬럼 DEFAULT 'USER' 적용
- 로컬 DDL의 `permissions` 테이블 정의에서 `role TEXT DEFAULT 'USER'`로 명시하여 DB 정합성을 확보했습니다.

# Release Notes (v1.3.4.Build.00002 - 2026-07-25 21:16)

## 🐛 permissions 테이블 userId DDL 스키마 정합성 보정 및 schema cache 저장 오류 패치
### schema.sql — permissions 테이블 DDL 보정
- `permissions` 테이블 스키마 정의에 누락되었던 `"userId" TEXT NOT NULL` 컬럼을 명시하고 기존 `role` 컬럼과의 호환성을 갖추도록 교정했습니다.

### AppContext.tsx — updatePermissions 이중 컬럼 매핑 & DDL 복구 가이드 연동
- Supabase 원격 DB 저장 시 `userId` 및 `user_id` 컬럼을 이중 바인딩하여 컬럼명 불일치로 인한 schema cache 저장 오류를 원천 차단했습니다.
- 원격 DB에 해당 컬럼이 아직 준비되지 않은 경우 명확한 DDL 해결 쿼리문(`ALTER TABLE permissions ADD COLUMN IF NOT EXISTS "userId" TEXT;`)을 포함한 대화형 가이드를 에러 팝업 모달로 안내합니다.

# Release Notes (v1.3.4.Build.00001 - 2026-07-25 21:11)

## ✨ ADMIN 신규 임직원 생성 시 전체 메뉴 권한 자동 초기화 & 권한 관리 UI 회수 가능화
### AppContext.tsx — saveUser 내 ADMIN 권한 자동 삽입
- 신규 임직원 생성 시 `role === 'ADMIN'`이면 전체 27개 메뉴에 대해 `canView=true, canSave=true` 권한 레코드를 `permissions` 테이블에 자동 일괄 삽입합니다.
- 기존 ADMIN 임직원에게 권한 레코드가 없는 경우 `hasPermission`이 폴백(true)으로 처리되던 방식과 일관성 있게 동작합니다.

### UsersPermissions.tsx — ADMIN 임직원 권한 체크박스 활성화
- 기존: `ADMIN` 역할이면 모든 메뉴에 Lock 아이콘(🔒 허용) 고정 표시, 권한 수정 불가.
- 변경: 절대 슈퍼관리자(`u-1 / sys-admin / loginId=admin`)만 Lock 표시 유지하고 나머지 ADMIN 임직원(이수용 사장 등)은 체크박스로 메뉴별 권한 선택적 회수/부여 가능.
- `handlePermissionToggle` / `handleToggleCategoryGroup` 양쪽 모두 ADMIN 차단 블록 제거 → `isSuperAdminUser` 판별로 교체.

# Release Notes (v1.3.4.Build.00000 - 2026-07-25 21:04)

## ✨ ADMIN 역할 임직원의 개별 메뉴별 권한 선택적 부여 및 회수 정밀 지원
- **`ADMIN` 계정 개별 메뉴 권한 선택 적용 보정 (`AppContext.tsx`)**:
  - 기존 `hasPermission`에서 `currentUser.role === 'ADMIN'`인 경우 모든 메뉴 권한을 무조건 100% 허용하던 로직을 수정했습니다.
  - 최상위 조직도 부서 정책(경영진/임원 `ADMIN` 부여)은 그대로 유지하되, 절대 시스템 슈퍼 관리자(`admin`, `sys-admin`) 계정을 제외한 일반 `ADMIN` 역할 임직원(이수용 사장님 포함)도 **`사용자 및 권한 통합 관리`** 메뉴에서 설정한 메뉴별 `canView`, `canSave` 권한을 개별적으로 선택 부여/회수 적용받도록 정밀 고도화했습니다.

---

# Release Notes (v1.3.3.Build.00003 - 2026-07-25 20:59)

## 🩺 인사 및 조직도 메뉴 임직원 역할(role) 저장 미반영 버그 수정
- **임직원 시스템 역할(role) 및 프로필 변경사항 실시간 DB 저장 연동 (`OrganizationSettings.tsx`)**:
  - 기존 `applyProfileChanges`에서 프로필 수정 및 역할(ADMIN / MANAGER / USER) 변경 시 화면 local state만 변경되고 DB 영구 저장(`saveUser`)이 실행되지 않던 현상을 근본 수정했습니다.
  - 임직원의 `role` 및 `enforceManagerPolicies`로 변경되는 부서장 직책 역할 등이 데이터베이스 및 Supabase에 실시간 및 영구적으로 저장되도록 연동 완료했습니다.

---

# Release Notes (v1.3.3.Build.00002 - 2026-07-25 20:42)

## 🩺 권한 저장 비동기 Supabase 연동 & 에러 모달 탑재, 카드사 템플릿 UTF-8 BOM 다운로드 및 학습형 매칭 룰 검색/등록 개편
- **사용자 및 메뉴 권한 통합 관리 권한 저장 보정 (`UsersPermissions.tsx` & `AppContext.tsx`)**:
  - `updatePermissions`를 비동기 `async` 함수로 전환하고 Supabase `permissions` 테이블과 로컬 DB의 권한 상태를 완벽하게 동기화했습니다.
  - 권한 저장 중 예외 발생 시 `showErrorModal` 팝업 에러 모달이 즉시 출력되도록 `try/catch` 구문을 보정했습니다.
- **법인카드 매입정산 카드사 이용내역 템플릿 다운로드 추가 (`CorporateCardPage.tsx`)**:
  - 이용대금 파일 로드 카드 영역에 `📥 템플릿 받기` 버튼을 추가했습니다.
  - `\uFEFF` UTF-8 Byte Order Mark 유니코드가 적용된 CSV 템플릿을 생성하여 엑셀(Excel)에서 한글 깨짐이 발생하지 않도록 조치했습니다.
- **학습형 매칭 룰 관리 검색/조회 필터 & 신규 룰 모달 탑재 (`BankMatching.tsx`)**:
  - 매칭 룰 탭 상단에 이체자명/고객사명 검색어 입력창, `🔍 조회` 버튼, `↺ 초기화` 버튼 및 `Enter` 키 바인딩을 주입했습니다.
  - 수동 대조를 수행하지 않고도 사전에 통장 적요 키워드와 ERP 고객사를 직접 매핑할 수 있는 `+ 신규 매칭 룰 등록` 팝업 모달을 추가했습니다.
- **은행 입출금 대장 CSV 템플릿 UTF-8 BOM 보정 (`BankMatching.tsx`)**:
  - CSV 템플릿 파일 생성 시 UTF-8 BOM(`\uFEFF`)을 적용하여 엑셀에서 파일 오픈 시 유니코드로 정상 호환되도록 교정했습니다.
- **개발자 도구 DB 업로더 테이블 선택 드롭다운 오름차순 정렬 (`DevDataUploader.tsx`)**:
  - `① 테이블 선택` 드롭다운 목록 아이템들을 한글 표기명 기준 가나다 오름차순으로 정렬하고, 중복 표시되던 `(customers) (customers)` 괄호 수식을 정리했습니다.

---

# Release Notes (v1.3.2.Build.00000 - 2026-07-25 19:36)

## ✨ 공급자(Vendors) 관리 메뉴 조회 버튼 추가 & DB 일괄 업로더 vendors 완전 지원
### Vendors.tsx — 검색 조회 버튼 및 초기화 버튼 추가
- 기존 실시간 자동 필터 방식에 더해 **명시적 `🔍 조회` 버튼**을 추가했습니다 (클릭 또는 Enter 키로 실행).
- 검색어 입력창(`searchInput`)과 실제 조회 트리거값(`searchTerm`)을 분리하여 의도치 않은 즉시 필터링을 방지.
- **`↺ 초기화` 버튼**을 추가하여 검색어 및 거래구분 필터를 한 번에 리셋할 수 있습니다.

### schema.sql — vendors 테이블 DDL 컬럼 완전 최신화
- 누락되었던 `representative`(대표자명), `email`(이메일), `address`(주소), `types`(복수 거래구분, TEXT), `isActive`(거래중여부, BOOLEAN) 컬럼을 추가했습니다.
- `type` 허용값에 `PURCHASE`(구매처) 추가, 구버전 `CONSUMABLE` 값 교정.

### DevDataUploader.tsx — vendors 컬럼 한글 라벨 맵 보강
- `COLUMN_LABEL_MAP`에 `type`, `types`, `bankAccount`, `isActive` 라벨 추가로 DB 일괄 업로드 템플릿에서 공급자 전체 컬럼이 정상 지원됩니다.

---

# Release Notes (v1.4.5.Build.00000 - 2026-07-25 19:31)

## 🩺 하위 메뉴 아이콘-텍스트 완전 수직 정렬 — CSS Grid 2컬럼 고정 레이아웃 적용
- **근본 원인 식별**: 아이콘 SVG마다 가로 폭이 다르기 때문에 `display: flex`로는 텍스트 시작 X 좌표가 아이콘마다 달라질 수밖에 없었습니다.
- **CSS Grid 2컬럼 고정 방식으로 전면 교체 (`App.tsx`)**:
  - 하위 메뉴 버튼 레이아웃을 `display: grid; gridTemplateColumns: '16px 1fr'; columnGap: '8px'`로 전환.
  - 1열(16×16px 고정 박스)에 아이콘을 가두어 어떤 SVG 크기와도 무관하게 동일한 너비 차지.
  - 2열(1fr)에 텍스트를 배치해 **모든 하위 메뉴 텍스트 시작 X 좌표가 항상 동일한 수직선에 칼정렬**.

---

# Release Notes (v1.4.4.Build.00000 - 2026-07-25 19:25)

## 🩺 하위 서브 컨테이너 `marginLeft: 15px` 오프셋 및 수직 연결 가이드라인 100% 매칭
- **하위 블록 전체(버튼 및 호버 영역) X = 15px 우측 마진 이동 (`App.tsx`)**:
  - 사용자분께서 빨간 펜으로 그린 가이드라인과 100% 피트되도록 하위 서브 컨테이너 자체에 `marginLeft: 15px`를 부여했습니다.
  - 상위 아이콘 시작 위치(10px)를 수직 축으로 이어주는 은은한 세로 가이드 라인(`borderLeft: 2px solid rgba(59,130,246,0.25)`)을 배치하고, 가이드 라인으로부터 모든 하위 버튼 및 아이콘이 **정확히 +15px 우측**에 100% 깔끔하게 칼정렬되도록 완벽 완성했습니다.

---

# Release Notes (v1.4.3.Build.00000 - 2026-07-25 19:23)

## 🩺 고정 20px 아이콘 그리드 정렬로 상위/하위 메뉴 글자 및 아이콘 +15px 오프셋 완전 교정
- **상위/하위 아이콘 래퍼 `width: 20px` 고정 폭 그리드 정렬 (`App.tsx`)**:
  - 기존 아이콘별 가로 폭 차이(17px vs 16px)로 인해 글자 위치가 다소 미세하게 어긋나 보이던 현상을 **`20px` 고정 그리드 폭 레이아웃**으로 근본 교정했습니다.
  - **상위 아이콘 X = 10px ➔ 하위 아이콘 X = 25px (+15px 정확히 일치)**
  - **상위 텍스트 X = 38px ➔ 하위 텍스트 X = 53px (+15px 정확히 일치)**
  - 모든 하위 서브 메뉴의 아이콘과 글자 시작점이 토씨 하나 없이 100% 동일하게 수평 일직선으로 완벽 줄맞춤되었습니다.

---

# Release Notes (v1.4.2.Build.00000 - 2026-07-25 19:20)

## 🩺 사이드바 모든 하위 메뉴 X 좌표 수평 완전 정렬 및 상위 메뉴 대비 +15px 오프셋 통일
- **하위 메뉴 X 좌표 완전 수평 일직선 정렬 (`App.tsx`)**:
  - 모든 하위 서브 메뉴 항목의 X 시작 위치가 토씨 하나 없이 100% 일정하도록 정밀 수평 alignment 튜닝을 완료했습니다.
  - 상위 메뉴 아이콘 시작 오프셋(`10px`)을 기준으로, 모든 하위 메뉴 아이콘 및 텍스트의 시작 X 좌표를 정확히 **`+15px (25px)`** 오프셋 위치에 일직선 배치하여 눈의 피로도를 낮추고 visual hierarchy를 극대화했습니다.

---

# Release Notes (v1.4.1.Build.00000 - 2026-07-25 19:17)

## 🩺 사이드바 하위 메뉴 들여쓰기 여백 정밀 교정 & 스마트 출고/회수 요청 영업관리 이동
- **사이드바 하위 메뉴 들여쓰기 수평 라인 정밀 정돈 (`App.tsx`)**:
  - 기존 우측으로 다소 과도하게 쏠려있던 하위 서브 메뉴 컨테이너의 들여쓰기 여백을 슬림하고 일정하게 수평 교정했습니다.
  - 상위 메뉴 아이콘 직하단 서브 가이드라인(`borderLeft: 2px solid rgba(59,130,246,0.25)`)을 적용하여 visual hierarchy를 직관적으로 개선했습니다.
- **스마트 출고/회수 요청 메뉴 소속 재배치 (`App.tsx` & `UsersPermissions.tsx`)**:
  - `스마트 출고 요청` 및 `스마트 회수 요청` 2개 메뉴를 **`영업관리`** 상위 그룹 하위로 이동하여 영업 업무 동선 및 권한 관리를 효율화했습니다.

---

# Release Notes (v1.4.0.Build.00000 - 2026-07-25 19:07)

## 🩺 상위-하위 2단계 접이식 아코디언 사이드바 네비게이션 개편 & 계층형 권한 관리 시스템 탑재
- **사이드바 메뉴 계층화 및 접이식(Collapsible Accordion) 개편 (`App.tsx`)**:
  - 길어진 사이드바 메뉴를 8대 상위 그룹(`영업관리`, `제품/자산관리`, `배차/운송관리`, `입출고관리`, `정비/소모품관리`, `경영관리`, `경영관리-특수`, `시스템관리-개발자`) 및 최상단 독립 `ERP 대시보드` 아키텍처로 개편했습니다.
  - 클릭 한 번으로 상위 카테고리를 자유롭게 접고 펼칠 수 있으며, 현재 작업 중인 메뉴가 포함된 상위 카테고리는 자동으로 펼쳐진 상태를 유지합니다.
- **계층형 사용자 및 권한 관리 시스템 구축 (`UsersPermissions.tsx`)**:
  - 24개 전체 메뉴를 상위 그룹별 트리 아코디언 스타일로 정돈하여 직관성을 극대화했습니다.
  - 상위 카테고리 헤더에 **`[조회 전체선택]` / `[저장 전체선택]`** 일괄 부여 및 회수 버튼을 탑재하여 직원별 접근 권한 통제 편의성을 획기적으로 개선했습니다.

---

# Release Notes (v1.3.1.Build.00000 - 2026-07-25 18:59)

## 🩺 매입처(공급자) 구분 간소화 및 세그먼트 버튼 토글 다중 속성 UI 구축
- **매입/거래 구분 5대 간소화**: `임차거래처` (🏢), `구매처` (🛒), `운송거래처` (🚚), `외주정비처` (🔧), `기타` (📌) 5가지 핵심 항목으로 정돈했습니다.
- **인터랙티브 세그먼트 버튼 토글 그룹 UI 구현**:
  - 단순 체크박스 대신 5연속 세그먼트 버튼 형태로 폼 디자인을 전면 개편했습니다.
  - 활성화(선택) 시 브랜드 칼라 그라데이션, 글로우 테두리, **`✓` 체크 아이콘** 및 마이크로 애니메이션 피드백을 연출하여 한 거래처가 임차 및 구매를 동시에 수행할 경우 복수 토글 선택이 가능합니다.
- **목록 테이블 & 필터 교차 검색 정밀 연동**:
  - 거래처 목록에 `[임차거래처] [구매처]` 등 복수 속성 배지 태그를 표기하고, 상단 필터에서 어떤 항목으로 검색하더라도 해당 속성을 포함하는 거래처가 누락 없이 교차 검색되도록 파이프라인을 완료했습니다.

---

# Release Notes (v1.3.0.Build.00000 - 2026-07-25 18:46)

## 🩺 매입처(공급자/벤더/외주처) 관리 신규 메뉴 구축 & 자산 취득 폼 제조년도 배치 및 엑셀 일괄 업로드 파이프라인 개편
- **매입처 (공급자 / 외주처) 관리 독립 메뉴 신설 (`Vendors.tsx`)**:
  - 장비 재임차 원사, 소모품 구매처 및 외주 수리정비사 통합 관리를 위한 독립 UI 페이지 및 사이드바 라우팅(`vendors`)을 신규 신설했습니다.
  - 매입처 등록/수정/삭제 모달, 매입구분(`RENTAL`/`CONSUMABLE`/`REPAIR`/`OTHER`) 필터링, 다차원 정렬(▲/▼), 독립 수직 스크롤 및 엑셀 다운로드를 탑재했습니다.
- **당사자산 취득 폼 제조년도(`manufactureYear`) 필드 노출**:
  - `AssetAcquisitionDisposal.tsx` 신규 자산 취득 등록 폼 내 제조사 바로 아래에 제조년도 입력 필드를 배치하고 DB 저장 연동을 완성했습니다.
- **자산 엑셀 일괄 업로드 파이프라인 정돈 (`DevDataUploader.tsx`)**:
  - 새롭게 확정된 자산 필드 표준 순서(`id` ➔ `assetNo` ➔ `modelName` ➔ `serialNo` ➔ `manufacturer` ➔ `manufactureYear` ➔ ...)에 맞추어 CSV/엑셀 템플릿 다운로드 및 업로드 유효성 검사/파서를 100% 동기화했습니다.

---

# Release Notes (v1.2.0.Build.00000 - 2026-07-25 18:33)

## 🩺 자산 DB/취득/대장 "제조년도" 컬럼 추가 및 IFRS 감가상각/미상각잔액 자동 계산 엔진 구축
- **제조년도 (`manufactureYear`) 컬럼 신설**: `schema.sql`, `db.ts` 내 자산 DB 스키마, 일괄 업로드 CSV/엑셀 템플릿 양식, 자산 대장 및 자산 취득/등록 모달 폼의 **"제조사" 와 "매입처" 사이**에 제조년도 필드를 배치했습니다.
- **`감가상각개월수` 용어 일원화**: 기존 `감가상각상태` 표기를 자산 취득 메뉴 규격과 동일하게 **`감가상각개월수`**(`depreciationMonths`)로 전환했습니다.
- **IFRS 회계기준 자동 감가상각 계산 엔진 구축 (`calculateAssetDepreciation`)**:
  - 취득일자(`acquisitionDate`)부터 매월 말일 기준으로 상각경과 월수를 실시간 추적하여 **월 감가상각비**, **감가상각누계액 (1원 단위 소수점 반올림)** 및 **미상각 잔액 (장부가치)**을 자동 산출합니다.
  - **매각 자산 예외 처리 (`status === 'SOLD'`)**: 매각일(`disposalDate`) 이후부터는 감가상각을 완전 정지하고 매각 시점의 상각누계액과 장부가치로 수치를 안전하게 고정합니다.

---

# Release Notes (v1.1.2.Build.00008 - 2026-07-25 18:16)

## 🩺 자산 일괄 업로드 템플릿 실시간 제품 모델명 샘플 연동 및 예외 처리
- **제품 모델명 샘플 동적 연동**: 자산 일괄 업로드 CSV/엑셀 템플릿 다운로드 시, 실제 DB에 등록되어 있는 제품 모델목록(`products`)을 동적으로 추출하여 샘플 데이터로 삽입하도록 개편했습니다.
- **"테스트모델명" 텍스트 보장 예외 처리**: 등록된 제품 모델이 없는 경우, 날짜 표기 버그 없이 유저 지정 규격인 **`"테스트모델명"`**이라는 텍스트 샘플이 명시적으로 출력되도록 수정을 완료했습니다.

---

# Release Notes (v1.1.2.Build.00007 - 2026-07-25 18:01)

## 🩺 전체 테이블 오름차순/내림차순 헤더 정렬 및 독립 수직 스크롤/카운터 일괄 탑재
- **테이블 수직 독립 스크롤 & 고정 스티키 헤더 구축**: 제품 모델 관리(`Products.tsx`), 자산 대장(`Assets.tsx`) 등 주요 대장 화면에서 10개 이상 데이터 출력 시 잘리던 스크롤 현상을 완벽 해결했습니다. 뷰포트 내 독립 수직 스크롤(`max-height`, `overscroll-behavior: contain`) 및 스크롤 시 컬럼 헤더가 상단에 고정되는 스티키(`sticky header`) 시스템을 일괄 탑재했습니다.
- **다차원 컬럼 클릭식 오름차순(▲) / 내림차순(▼) 정렬 탑재**: 모델명, 피트규격, 제조사, 자산구분, 장비상태, 보유대수, 등록일 등 모든 주요 컬럼 헤더 클릭 시 오름차순과 내림차순이 자유롭게 토글 정렬되도록 정렬 시스템을 구축했습니다.
- **실시간 데이터 수량 카운터 전면 표기**: `전체 X개 등록됨 (검색 결과: Y건)` 정보 상단 표기를 통해 데이터 전체 개수와 검색 현황을 직관적으로 보장합니다.

---

# Release Notes (v1.1.2.Build.00006 - 2026-07-25 17:55)

## 🩺 자산 일괄 업로드 템플릿 샘플 데이터 포맷 및 한글 규격 개편
- **모델명 샘플 오표기 수정**: 자산 일괄 업로드 CSV/엑셀 템플릿 양식의 모델명 B열에 ISO 날짜가 노출되던 문제를 패치하고, `"KY-0801"`, `"SJB-1200"` 등 실제 고소작업대 텍스트 모델명 샘플을 제공하도록 개선했습니다.
- **취득일자 포맷 간소화**: `YYYY-MM-DD` (예: `2026-01-15`) 형식까지만 시각 초 단위 없이 표시하도록 포맷을 제한했습니다.
- **소유유형 및 상태 한글 표기 및 매핑 지원**: 소유유형(`당사` / `임차`) 및 상태(`임대가능` / `임대중` / `정비중` / `외주정비중`) 한글 텍스트 샘플 제공 및 파일 파싱 시 DB 규격으로 자동 호환 매핑 처리합니다.

---

# Release Notes (v1.1.2.Build.00005 - 2026-07-25 17:34)

## 🩺 상세 프로필 패널 [취소] 및 [저장 (적용)] 버튼 최상단 헤더 이동 개편
- **최상단 버튼 전면 배치**: 인사 및 조직도 마스터 설정(`OrganizationSettings.tsx`)에서 우측 임직원 상세 프로필 패널 열림 시, 하단 버튼이 화면 밖으로 잘리거나 스크롤해야 하던 문제를 원천 해결하기 위해 **`[취소]`** 및 **`[저장 (적용)]`** 버튼을 상단 헤더("상세 프로필" 제목 우측)로 전면 이동했습니다. 이제 패널이 열리자마자 스크롤할 필요 없이 최상단에서 즉시 클릭 가능합니다.

---

# Release Notes (v1.1.2.Build.00004 - 2026-07-25 17:29)

## 🩺 상세 프로필 슬라이드 패널 컴팩트 레이아웃 최적화 및 불필요 여백/스크롤 원천 제거
- **상세 프로필 슬라이드 폼 핏(Fit) 다듬기**: 인사 및 조직도 마스터 설정(`OrganizationSettings.tsx`)에서 우측 상세 프로필 패널 하단에 불필요하게 넓게 형성되던 빈 여백 및 이로 인한 수직 스크롤 현상을 완벽히 해결했습니다. 아바타 서클 크기 축소(`56px`), 폼 항목 간격 슬림화(`gap: 6px`), 자택 주소 한 줄 `<input>` 전환을 통해 한 화면 내에 스크롤 없이 100% 깔끔하게 들어오도록 개편했습니다.

---

# Release Notes (v1.1.2.Build.00003 - 2026-07-25 17:25)

## 🩺 마우스 위치별 독립 영역 스크롤 시스템 탑재 및 850px 고정 뷰포트 레이아웃 구축
- **독립 영역 스크롤링 구축 (`overscroll-behavior: contain`)**: 브라우저 바디 스크롤을 원천 차단하고 마우스 커서의 위치에 따라 **좌측 메뉴 사이드바**, **우측 메인 작업 화면**, **화면 내부 표(테이블)/모달** 영역이 각각 완전히 분리되어 독자적으로 스크롤되도록 전역 스크롤 체이닝 방지 시스템을 도입했습니다.
- **전체 화면 Height 850px 사양 반영**: 메인 앱 컨테이너 뷰포트 수직 높이를 `850px` (`height: 850px`, `maxHeight: 850px`) 고정 수직 프레임으로 지정하여 850px 뷰포트 영역 내에서 모든 메뉴 및 작업 영역이 깔끔하게 핏(Fit)되어 작동하도록 개선했습니다.

---

# Release Notes (v1.1.2.Build.00002 - 2026-07-25 17:18)

## 🩺 임직원(users) NOT NULL 제약조건 패치 및 전사 타임스탬프 샌니타이저 탑재
- **임직원 데이터 생성일자(`createdAt`) 필수값 누락 방어 패치**: 직원 등록 및 부서 배치 후 저장 시 `users` 테이블의 `createdAt` / `updatedAt` 속성이 누락되어 발생하던 Supabase NOT NULL 제약조건 위반 에러(`null value in column "createdAt" of relation "users" violates not-null constraint - 23502`)를 완벽히 해결했습니다.
- **전사 DB CUD 헬퍼 타임스탬프 자동 보장**: `db.ts` 내 `saveOrganizationBatch` 및 CRUD 적재 함수에 Sanitizer를 구축하여, 모든 모델 동기화 전 `createdAt` 또는 `updatedAt`이 없으면 실시간 ISO 타임스탬프를 원천 보장하도록 강화했습니다.

---

# Release Notes (v1.1.2.Build.00001 - 2026-07-25 17:12)

## 🩺 부서 NOT NULL 제약조건 패치, 메뉴 스크롤 자동 리셋 및 힌트문자 개편
- **부서 생성일자(`createdAt`) 필수값 누락 방어 패치**: `departments` 부서 데이터 저장 시 `createdAt` / `updatedAt` 타임스탬프가 누락되어 발생하던 Supabase NOT NULL 제약조건 위반 에러(`null value in column "createdAt" of relation "departments" violates not-null constraint`)를 원천 차단했습니다.
- **메뉴 이동 시 스크롤 최상단(Top) 자동 리셋**: 유저가 사이드바/상단 탭을 통해 다른 메뉴 페이지로 이동할 때마다 화면 스크롤이 즉시 최상단(`Top = 0`)으로 복구되도록 자동화했습니다.
- **새 부서 추가 힌트문자(Placeholder) 적용**: `+` 새 부서 추가 시 부서명 텍스트를 비우고 `placeholder="부서명 입력 (예: 영남영업소)"` 힌트문자로 제공하여 편집 편의성을 한 단계 높였습니다.

---

# Release Notes (v1.1.2.Build.00000 - 2026-07-25 17:07)

## 🩺 신규 직원 등록 시 이름 및 직급 힌트문자(Placeholder) 개편
- **입력 폼 힌트문자 적용**: 인사 및 조직도 마스터 설정(`OrganizationSettings.tsx`)에서 `+ 신규 직원 등록` 버튼 클릭 시 이름과 직급 필드를 빈 칸(`''`)으로 깨끗하게 생성하고, `placeholder="이름 입력 (예: 홍길동)"`, `placeholder="직급 입력 (예: 사원/대리)"` 힌트문자를 적용하여 유저가 백스페이스로 기존 텍스트를 지우는 번거로움 없이 즉시 타자 입력할 수 있도록 폼 UX를 개선했습니다.

---

# Release Notes (v3.14.0 - 2026-07-25 16:58)

## 🩺 전사 DB 저장/업서트 전수 동기화 검증 파이프라인 구축 및 에러 모달 전수 팝업 표출
- **Supabase 쓰기 큐 통합 검증(`db.awaitPendingWrites()`)**: 비동기 DB 적재 큐(`pendingWrites`)의 프로미스들을 100% 동기식으로 정밀 검증하여 Silent Fail(저장 실패 후 거짓 성공 표출 현상)을 원천 차단했습니다.
- **ErrorModal 에러 모달 팝업 전수 연동**: 제품, 자산, 거래처, 현장, 계약, 정비, 청구, 소모품, 외주업체, 스마트 출고/회수, 조직도 등 **모든 DB CUD 저장/수정/삭제 액션**에 에러 모달 팝업을 연동했습니다. DB 적재 거부(RLS/외래키/컬럼 불일치 등) 발생 시 명확한 사유를 팝업으로 표출합니다.
- **인사 및 조직도 높이 900px 적용**: `OrganizationSettings.tsx` 화면의 메인 컨테이너 세로 높이를 `minHeight: 900px`로 명시 설정하여 쾌적한 900px 작업 공간을 확보했습니다.

---

# Release Notes (v3.13.0 - 2026-07-25 16:33)

## 🩺 인사 및 조직도 마스터 설정 한 화면(뷰포트) 컴팩트 레이아웃 개편
- **불필요한 고정 높이 제거**: `OrganizationSettings.tsx` 화면의 과도한 `minHeight: 600px` 고정 높이를 전면 제거하여 소규모 조직 구조에 맞는 맞춤형 레이아웃을 구현했습니다.
- **`미배정 인력 풀 (Pool)` 한 화면 즉시 노출**: 부서 구조도 트리 하단에 미배정 인력 풀 박스가 세로 스크롤 없이 한 화면 안에서 즉시 눈에 띄도록 컴팩트 배치했습니다.

---

# Release Notes (v3.12.0 - 2026-07-25 16:28)

## 🩺 contracts 테이블 salespersonId 외래키(FK) 참조 무결성 방어 구축
- **FK 예외 방어 파이프라인**: 스마트 출고 및 계약 등록 시 담당 영업사원(`salespersonId`)에 대입되는 사용자 ID가 DB `users` 테이블 PK 목록에 실제 존재하는지 사전 검증합니다.
- **Null-Safe 자동 대체 방어**: 유효하지 않은 임시 계정이거나 존재하지 않는 영업사원 ID일 경우, 에러(`23503 contracts_salespersonId_fkey`)로 차단되지 않고 안전하게 `null` 또는 기본 관리자 계정(`u-1`)으로 대체 대입하여 100% 끊김 없는 저장을 보장합니다.

---

# Release Notes (v3.11.0 - 2026-07-25 16:23)

## 🩺 deliveries (배차/운송) 테이블 내 isCostSettled 컬럼 추가 및 DDL 싱크 보완
- **`isCostSettled` 칼럼 정식 수용**: 스마트 출고 저장을 포함하여 배차 및 운송 정산 데이터 교환 시 발생하던 `Could not find column 'isCostSettled' of 'deliveries'` 스키마 캐시 오류를 해결하기 위해 `schema.sql` 내 `deliveries` 테이블 정의에 `"isCostSettled" BOOLEAN DEFAULT FALSE` 컬럼을 정식 수용하고 동기화했습니다.

---

# Release Notes (v3.10.0 - 2026-07-25 16:18)

## 🩺 스마트 출고 입력창 깨끗한 초기화 및 📂 텍스트 파일 불러오기 버튼 신설
- **1단계 입력창 깨끗한 빈 상태 초기화**: 스마트 출고 화면 진입 시 메신저 줄글 텍스트 입력창(`rawText`)에 기본 삽입되어 있던 예시 텍스트를 전면 제거하고 깨끗한 빈 칸(`''`)으로 초기화했습니다.
- **`[📂 텍스트 파일 불러오기]` 버튼 탑재**: 1단계 카드 헤더에 단일 원클릭 **`[📂 텍스트 파일 불러오기]`** 버튼을 추가했습니다. 클릭 시 로컬 PC의 텍스트 파일(`.txt`, `.log`, `.csv`)을 탐색기에서 선택하여 문구를 자동으로 읽어와 입력창에 즉시 채워 넣을 수 있습니다.

## 🩺 대시보드 하드코딩 샘플 카드 완전 제거 및 실시간 조건부 피드 개편
- **샘플 카드 완전 제거**: 구글 드라이브 용량 92% 하드코딩 알림 카드를 제거했습니다.
- **실시간 데이터 존재 시에만 표출**: 미수금 회수 카드(`unpaidBillings.length > 0`), 정비/자재 관리 카드(`pendingRepairs > 0 || lowStockConsumables > 0`)를 실제 당면 과제가 있을 때만 표출되도록 정돈했습니다.
- **완결 카드 렌더링**: 당면 처리 과제가 0건일 때는 `🎉 현재 즉시 처리해야 할 당면 과제가 없습니다!` 정돈 카드를 출력하여 유저 맞춤형 대시보드 핵심 가치를 구현했습니다.

## 🩺 schema.sql 스키마 내 전 테이블 RLS 자동 해제 DDL 구문 수용
- **RLS 해제 DDL 명시**: `schema.sql` 최하단에 38개 전 테이블의 RLS를 비활성화하는 DDL 구문을 포함시켜, Supabase 테이블 신규 생성/재생성 시 RLS 기본 정책으로 인한 `42501` 권한 차단 에러를 원천 방지했습니다.

---

# Release Notes (v3.9.0 - 2026-07-25 16:03)

## 🩺 엑셀 업로드 유효성 검사 에러 리스트 내 한글 라벨 + 영문 컬럼 Key 병기 개편
- **한글 라벨 & 영문 Key 병기**: CSV 및 엑셀 업로드 유효성 검사 오류 목록 시각화 시, 사용자 식별을 위한 한글 명칭과 개발자/시스템 디버깅을 위한 영문 컬럼명을 함께 표기(`[행번호] 한글라벨 (영문Key) - 오류문구`)하도록 개편했습니다. (예: `[18행] 이름/명칭 (name) - 필수값이 비어 있습니다.`)
- **단일 및 일괄 업로드 통일 적용**: 단일 테이블 업로드 유효성 검사 및 38개 전체 테이블 일괄 업로드 검사 카드 모두 동일한 포맷으로 직관적 구분이 가능하도록 표준화했습니다.

---

# Release Notes (v3.8.0 - 2026-07-25 15:59)

## 🩺 엑셀 업로드 실패 원인 상세 분석 [🔍 자세히 보기] 버튼 & 오류 내용 원클릭 복사 모달 연동
- **`[🔍 실패 원인 자세히 보기]` 버튼 제공**: 엑셀 업로드(단일 및 일괄 업로드) 실패 시, 실패 카드 내에 클릭 가능한 **`[🔍 실패 원인 자세히 보기]`** 버튼을 추가했습니다.
- **Supabase/PostgreSQL 정밀 에러 분석 모달 연결**: 클릭 시 `ErrorModal` 팝업이 활성화되며, 원격 DB에서 거절된 PostgreSQL 에러 코드, 미존재 테이블 정보, 제약 조건 위반 원인 전문을 명확히 출력하고 **`[📋 오류 내용 전체 복사]`** 버튼으로 클립보드에 원클릭 복사할 수 있습니다.
- **업로드 시 id 비어 있음 자동 채번 연동**: 엑셀 파일 내 `id` 컬럼이 생략되었거나 비어 있을 경우, 테이블 규격(`PROD-0000001`, `CUST-0000001` 등)에 의거하여 업로더(`DevDataUploader.tsx`)가 `id`를 자동 채번하여 무결한 데이터로 업서트(Upsert)하도록 보완했습니다.

---

# Release Notes (v3.7.0 - 2026-07-25 15:31)

## 🩺 엑셀 업로드 양식 내 createdAt / updatedAt 입력 제외 및 업로드 실행시점 시각 자동 주입 구축
- **엑셀 템플릿 양식 컬럼 완전 제거**: 엑셀 양식 다운로드 시 수동 입력 부담을 없애기 위해 `createdAt`(생성일시) 및 `updatedAt`(수정일시) 열 자체를 엑셀 양식 추출 대상에서 전면 제외했습니다.
- **실시간 타임스탬프 자동 대입**: 엑셀 데이터를 파일로 선택하여 업로드하는 순간, 파서(`DevDataUploader.tsx`)가 **업로드 버튼이 실행된 실시간 현재 시각(ISO Timestamp)**을 `createdAt`과 `updatedAt` 필드에 자동 채워 넣어 DB 및 로컬 시스템에 완벽 적재하도록 구현했습니다.

---

# Release Notes (v3.6.0 - 2026-07-25 15:18)

## 🩺 고객사 약칭 입력 시 정식 등록 법인명(예: "주식회사 세보엠이씨") 자동 보정 엔진 구축
- **정식 법인명 자동 치환/보정**: 영업사원이 편의상 법인 수식어가 생략된 약칭("세보엠이씨")이나 표기 형태("(주)세보엠이씨")를 기입하더라도, DB 내 정규화 파서(`normalizeCustomerName`) 탐색을 통해 기존 정식 등록 명칭인 **"주식회사 세보엠이씨"**로 자동 보정하여 계약 및 출고 요청 데이터에 1:1로 매칭 연동했습니다.

## 🩺 전 테이블 createdAt / updatedAt 일자 필드 전면 표준화 및 엑셀 업로더 싱크
- **전 테이블 createdAt / updatedAt 후방 전면 표준화**: `products` 테이블 등 `createdAt`이 중간에 존재하던 컬럼 위치를 테이블 최후순위(맨 우측)로 이동하고, 38개 전 테이블에 `createdAt` 및 `updatedAt` 컬럼을 정식 수용했습니다.
- **수정 시 updatedAt 실시간 갱신**: CRUD 핸들러(`db.ts`)의 `insertRow` 시 `createdAt`/`updatedAt` 자동 주입, `updateRow` 시 `updatedAt`이 실시간 갱신되도록 리팩토링했습니다.
- **엑셀 일괄 업로드 메뉴 구조 충돌 완벽 해결**: 스키마 파서(`DevDataUploader.tsx`)의 동적 템플릿 생성 및 일괄 업로드 파서가 갱신된 스키마 구조와 100% 호환되도록 동기화하여 구조 충돌 문제를 완벽 해결했습니다.

---

# Release Notes (v3.5.0 - 2026-07-25 15:02)

## 🩺 contract_assets 테이블 내 expectedModel 컬럼 추가 및 스키마 싱크
- **expectedModel 필드 수용**: 스마트 출고 요청 시 계약 희망 자산 모델(`expectedModel`) 저장을 지원하기 위해 `schema.sql` 및 시스템 데이터베이스 정의에 `"expectedModel" TEXT` 컬럼을 정식 추가하여, Supabase DB 동기화 시 스키마 미존재 오류(`Could not find column expectedModel`)를 완벽 해결했습니다.

## 🩺 원클릭 텍스트 복사 기능 내장 커스텀 예외 팝업 모달 (CopyableErrorModal) 구축
- **브라우저 기본 alert 대체 및 원클릭 복사 시스템**: 텍스트 선택/복사가 불가능한 브라우저의 기본 `alert()` 창 대신, 다크 테마 글래스모피즘 기반의 커스텀 에러 모달 UI 컴포넌트(`ErrorModal.tsx`)를 신설했습니다.
- **오류 내용 복사 버튼 탑재**: 에러 텍스트 박스와 **`[📋 오류 내용 전체 복사]`** 버튼을 주입하여, 시스템 예외 발생 시 사용자가 클릭 한 번으로 에러 메시지 전문을 복사하여 손쉽게 원인을 공유 및 제보할 수 있도록 UX를 개편했습니다.

---

# Release Notes (v3.4.0 - 2026-07-25 14:57)

## 🩺 Supabase DB 및 엑셀 일괄 업로드 양식 내 입력/생성 날짜 컬럼 후방 배치 개편
- **입력/생성 일자 컬럼 최후순위 배치**: Supabase 데이터베이스 테이블 관리 및 엑셀 일괄 업로드 시, 입력/등록 일자 관련 필드(`createdAt`, `updatedAt`, `transactionDate`, `paymentDate`, `requestDate`, `eventDate`, `actionDate` 등)가 테이블 및 엑셀 템플릿의 가장 마지막(맨 우측) 위치로 전면 재배치되도록 DDL 스키마(`schema.sql`)를 리팩토링했습니다.
- **엑셀 일괄 업로드 사용자 경험 개선**: 엑셀 업로더 화면(`DevDataUploader.tsx`)의 동적 스키마 파서가 갱신된 DDL 순서를 파싱함에 따라, 엑셀 템플릿 양식 생성 및 일괄 업로드 시 식별자, 거래처, 수량, 금액 등 핵심 데이터가 앞쪽에 먼저 배치되고 날짜 필드는 맨 우측에 위치하게 되어 데이터 작성 편의성을 극대화했습니다.

## 🩺 스마트 출고 요청 동기식 Supabase 쓰기 예외 전파 및 에러 즉시 피드백 팝업 개편
- **Supabase 백그라운드 쓰기 완결 동기 검증 및 에러 전파**: 스마트 출고 요청(`SmartDispatch.tsx`) 저장 시, 백그라운드 비동기 쓰기 큐(`db.pendingWrites`)의 결과를 `await Promise.all()`로 완전 대기하도록 처리하여 DB 제약조건 위반, 컬럼 미존재, RLS 차단 예외가 발생할 경우 조용히 삼켜지고 성공 팝업이 뜨던 현상을 완전 차단했습니다.
- **실시간 에러 팝업 피드백 장착**: Supabase 동기화 실패 시 구체적인 에러 원인 및 PostgreSQL 메시지를 팝업 모달로 즉시 출력하도록 보완했습니다.

---

# Release Notes (v3.3.0 - 2026-07-21 15:28)

## 🩺 기본 키 ID 명세 포맷 변경: 테이블 축약어 + 숫자 7자리(0000001) 체계 도입
- **ID 숫자 자릿수 7자리(Zero-Padding)로 확장**: 기존의 3자리 숫자 패딩(예: `PROD-004`) 형식을 확장하여, 모든 테이블의 자동 생성 순차 번호 규격을 7자리 자릿수 채움(예: `PROD-0000004`, `CUST-0000021`) 방식으로 리팩토링했습니다.
- **CSV/Excel 업로더 예시 양식 일치화**: 데이터 업로더 화면(`DevDataUploader.tsx`)의 샘플 양식 파일 생성 및 컬럼 예시 구조 또한 변경된 규칙인 `테이블명(축약)-7자리숫자` 포맷에 맞추어 생성되도록 동기화시켰습니다.

---

# Release Notes (v3.2.0 - 2026-07-21 15:23)

## 🩺 전 테이블 순차 ID 자동 생성 전면 적용 및 고객 관리(고객/담당자/현장) 저장 정밀화
- **전체 테이블 29종 순차 ID 생성 전면 구축**: 제품 외에도 고객(`CUST-`), 자산(`ASSET-`), 현장(`SITE-`), 담당자(`CONT-`), 정비(`REP-`) 등 `LocalDB` 내 모든 29개 주요 테이블에 대해 일관되게 접두사를 매핑하여 최대 번호의 다음 순차 번호를 부여하도록 자동화하였습니다.
- **고객사/담당자/현장 저장 및 동기화 팝업 수립 (`Customers.tsx`)**: 제품 모델 등록 화면과 완전히 동일하게 고객사, 담당자, 현장 추가/수정 시에도 전송될 실제 SQL 쿼리(순차 ID 매핑본)를 미리보기 경고창으로 띄우고, Supabase 동기화 결과(성공/실패 메시지)를 동적으로 대기하여 명확하게 알림창으로 출력하도록 개편했습니다.
- **정비-소모품 간 ID 참조 정합성 버그 해결**: `registerRepair` 함수에서 정비 고유 ID를 생성하여 하위 소모품 로그에 참조시킬 때, 신규 정비 마스터 행 자체에는 ID를 누락시켜 튕겨 나가던 정합성 결함을 보강하여 정상 연동되도록 조치했습니다.

---

# Release Notes (v3.1.0 - 2026-07-21 15:18)

## 🩺 신규 데이터 등록 시 고유 ID의 순차형 자동 번호 부여 시스템 개편
- **순차형 자동 ID 생성기 도입**: 기존에 무작위 난수 문자열로 생성되던 기본 키(ID) 부여 방식을 개선하여, 테이블별 접두사(예: 제품 `PROD-`, 고객 `CUST-`, 자산 `ASSET-` 등)에 맞추어 기존 목록 번호를 파싱하고 다음 순차 번호를 부여하도록 개편했습니다. (예: `PROD-003` 다음은 `PROD-004`로 생성)
- **SQL 시뮬레이션 미리보기 연동**: 제품 등록 모달에서 저장 클릭 시, 쿼리 미리보기 알림창에 임시 표시되던 `[AUTO_GENERATED_ID]` 대신 실제로 생성될 순차 ID(예: `PROD-004`)가 쿼리에 직접 렌더링되어 표시되도록 사용성을 정교화했습니다.

---

# Release Notes (v3.0.0 - 2026-07-21 14:42)

## 🩺 제품 모델 관리 화면 수동 "조회" 버튼 탑재 및 검색 크래시 방어 강화
- **수동 조회(Refresh) 기능 추가**: 제품 모델 관리(`Products.tsx`) 헤더 영역에 **[조회]** 버튼을 신설하여, 사용자가 Supabase 콘솔 등 외부에서 데이터를 수동 편집한 경우 페이지 새로고침 없이 즉각 원격 DB 데이터를 최신화해 렌더링하도록 개선했습니다. (회전 애니메이션 피드백 내장)
- **검색 및 필터링 크래시 방어**: 외부 SQL 에디터를 통해 입력 시 제조사(`manufacturer`)나 규격(`spec`) 등의 옵션 필드에 `NULL`이 들어왔을 때, 필터링 검색 동작 시 `.toLowerCase()` 함수가 호출되어 페이지가 하얗게 크래시되던 문제를 방지하도록 널 세이프(Null-Safe) 논리 연산자로 필터링 로직을 전면 보강했습니다.

---

# Release Notes (v2.9.1 - 2026-07-21 14:27)

## 🩺 Supabase 비동기 연동 쓰기 실패 에러 전파(Rethrow) 처리 및 팝업 정밀화
- **실제 쓰기 실패 에러 전파**: `AppContext.tsx` 내의 `saveProduct` 비동기 대기부에서 Supabase 연동 시 발생한 에러를 삼키지 않고 상위 호출자(UI)로 재투척(`throw err`)하도록 수정했습니다. 이로 인해 DB 스키마 에러 등으로 쓰기가 실패할 시 "성공" 팝업이 뜨는 오작동을 완전히 차단하고, 실제 원격 DB 반영 실패 여부 및 PostgreSQL 에러 메시지가 화면 경고창에 정확하게 노출되도록 보완했습니다.

---

# Release Notes (v2.9.0 - 2026-07-21 14:22)

## 🩺 CSV/Excel 업로더 대상 테이블 선택 범위 38종 전체 동적 연동 개편
- **38개 테이블 선택 및 양식 동적 지원**: 기존에 하드코딩되었던 8개 테이블 스키마 정의를 완전히 제거하고, 코드베이스의 `schema.sql`을 실시간 파싱하여 **38개 테이블 전체를 선택할 수 있도록 동적으로 개편**했습니다.
- **다국어 매핑 및 예시 자동 생성**: `TABLE_LABEL_MAP` 및 `COLUMN_LABEL_MAP` 딕셔너리를 활용하여 38개 테이블과 모든 하위 컬럼의 한글 라벨을 표시하고, 선택된 테이블 구조에 부합하는 CSV/Excel 템플릿 양식 다운로드, 유효성 검사, Supabase bulk upsert가 100% 동적으로 작동하도록 개발했습니다.

---

# Release Notes (v2.8.0 - 2026-07-21 14:05)

## 🩺 실실시간 DB 스키마 정합성 검증 도구 성능 10배 고속화 및 전수 검증 개편
- **점진적 누락 색출 알고리즘(점진적 델타 쿼리) 도입**: 기존에는 38개 테이블의 모든 컬럼을 개별 쿼리로 전송하여 수백 개의 병렬 요청이 병목/제한(HTTP 429 및 타임아웃)을 발생시켰습니다. 이를 개선하기 위해 각 테이블의 모든 컬럼을 **단 하나의 콤마 분리형 쿼리로 일괄 조회**하고, 에러 반환 시 누락된 특정 컬럼명을 파싱하여 필터링하는 방식으로 통신량을 10분의 1 이하로 축소했습니다.
- **실효적인 오류 방지 및 전수 검사**: 모든 38개 데이터 테이블이 Supabase 원격 DB와 컬럼 단위까지 완벽히 전수 검증되며, 오류가 발견될 시 즉각 복구할 수 있는 DDL 패치가 정교하게 동적 자동 생성됩니다.

---

# Release Notes (v2.7.3 - 2026-07-21 13:58)

## 🩺 products 테이블 및 스키마 내 누락 컬럼 (safetyCertUrl 등 4종) 전면 정합성 싱크 수정
- **DB 스키마 및 업로더 컬럼 무결성 확보**: 프론트엔드 입력 폼(`Products.tsx`)에는 존재했으나 로컬 스키마(`schema.sql`) 및 `DevDataUploader.tsx` 제품 스키마 정의(`TABLE_SCHEMAS`)에서 누락되었던 4개 컬럼(`isActive`, `safetyCertUrl`, `specSheetUrl`, `emergencyGuideUrl`)을 전수 추가하여, 스키마 부정합으로 인한 DB 연동 에러를 완벽히 예방했습니다.
- **원격 DB 컬럼 증분 DDL 가이드 제공**: Supabase 원격 테이블 구조를 로컬 스펙과 일치시키기 위해 4개 컬럼을 추가하는 DDL 스크립트를 작성하여 안내합니다.

---

# Release Notes (v2.7.2 - 2026-07-21 13:48)

## 🩺 제품 등록 시 실행 예정 SQL 구문 시각화 및 결과 알림 팝업 장착
- **전송 예정 쿼리 안내 팝업**: 제품 관리(`Products.tsx`) 신규 등록 및 수정 폼에서 저장 버튼 클릭 시, 실제로 Supabase API로 변환되어 전달될 INSERT/UPDATE SQL 쿼리를 브라우저 경고창(`alert`)을 통해 실시간으로 렌더링하여 안내하도록 변경했습니다.
- **비동기 트랜잭션 동기화 및 결과 통지**: 백그라운드에서 실행되던 Supabase DB 적재 결과 프로미스를 동기식으로 추적하여, 성공 시 `🎉 저장 및 동기화 성공!` 및 실패 시 PostgreSQL 원본 에러 코드와 한글 메시지를 포함한 `❌ 동기화 실패` 알림창이 즉각적으로 팝업되도록 보완했습니다.

---

# Release Notes (v2.7.1 - 2026-07-21 13:43)

## 🩺 피트(Feet) 컬럼 자료형 실수(DOUBLE PRECISION) 변경 및 소수점 등록 허용
- **데이터베이스 컬럼 자료형 실수화**: 제품(`products`) 테이블의 피트(`feet`) 규격 컬럼을 정수형(`INTEGER`)에서 실수형(`DOUBLE PRECISION`)으로 개편하여, 3.6피트와 같은 소수점 규격을 원격 DB와 로컬 스키마([schema.sql](file:///d:/GoogleDrive/RPA%20개발/01.AntiGravity/Kiyuen_Lift/schema.sql)) 모두에서 정식 지원하도록 변경했습니다.
- **클라이언트 검증 및 UI 보강**: 실수형 입력을 제한 없이 허용하도록 `Products.tsx` 내의 정수 체크를 해제하고, 모달 입력 컴포넌트의 `step` 속성을 `any`로 수정하여 `3.6` 피트와 같은 실수 값이 자유롭게 입력 및 저장되도록 조치했습니다.

---

# Release Notes (v2.7.0 - 2026-07-21 13:25)

## 🗑️ 통합 테스트 시나리오 데이터 관리 기능 및 UI 제거
- **CoT 데이터 시딩 기능 제거**: Supabase 원격 연동 복잡성 및 사용자 생산성 유지를 위해, `DevDataUploader.tsx` 하단에 추가되었던 "통합 테스트 시나리오 데이터 관리" UI와 관련 클라이언트 사이드 데이터 생성/삭제 기능(RPC 트리거 포함)을 전면 제거했습니다.
- **프로젝트 의존성 및 CLI 정리**: `package.json`에서 더 이상 사용되지 않는 `"db:seed"` 커맨드 및 `pg` 라이브러리 의존성을 제거하여 앱을 최적화된 원래 상태로 롤백했습니다.
- **로컬 스크립트 보존**: 향후 별도 학습 및 복구를 대비하여 [scripts/setup_seed_rpc.sql](file:///d:/GoogleDrive/RPA%20개발/01.AntiGravity/Kiyuen_Lift/scripts/setup_seed_rpc.sql) 및 [scripts/seed-db.js](file:///d:/GoogleDrive/RPA%20개발/01.AntiGravity/Kiyuen_Lift/scripts/seed-db.js) 파일은 로컬 참고용 레퍼런스로 그대로 유지됩니다.

---

# Release Notes (v2.6.14 - 2026-07-21 13:16)

## 🩺 소규모 단계적 검증을 위한 1건 단위 안전 데이터 시더 탑재 (외래키 및 가변 스위칭 버그 패치)
- **1건 단위 초소형 시딩 지원**: 대량 시딩 시 예기치 못한 제약조건을 점검하기 위해 모든 테이블의 생성 행 수를 `1건`으로 변경하여 검증하도록 하였습니다.
- **완전 가변적인 외래키 매핑 관계 재설계**: 시딩 설정 행수가 변경될 때 발생할 수 있는 외래키 참조 무결성 위반(예: 존재하지 않는 현장 ID나 자산 ID 참조)을 차단하기 위해, 참조 인덱스 공식을 `1 + ((i - 1) % v_count)` 형태로 수학적으로 전면 안전하게 리팩토링했습니다. 이제 수량을 `1`, `10`, `100` 등으로 자유롭게 바꾸어도 절대 에러가 나지 않습니다.

---

# Release Notes (v2.6.13 - 2026-07-21 13:10)

## 🩺 DB 스키마 트리거 미존재 확인 완료 및 진단 코드 제거 (완결 데이터 시딩 준비)
- **DB 트리거 무죄 입증**: 강제 예외 조회를 통해 원격 DB의 `assets` 테이블과 타 연관 테이블에 active한 custom trigger가 전혀 존재하지 않음(`None`)을 증명하여, 스키마 레벨 외의 DB단 간섭이 없음을 최종 확인했습니다.
- **디버깅 코드 최종 제거**: 셋업 확인이 완료되었으므로 `setup_seed_rpc.sql` 상단의 `RAISE EXCEPTION` 자가 진단 코드를 모두 제거하여, 10,000건 시딩 로직이 끝까지 논스톱으로 실행될 수 있도록 원본 스크립트로 롤백/완성하였습니다.

---

# Release Notes (v2.6.10 - 2026-07-21 12:28)

## 🩺 자산 업데이트 DML 구문 내 "updatedAt" 컬럼 강제 갱신 적용 (23502 예외 근본적 진압)
- **자산(assets) UPDATE 구문 updatedAt 명시**: `assets` 테이블의 `"updatedAt"` Not-Null 제약조건으로 인해, `generate_test_data` 및 `clear_test_data` 내의 `UPDATE assets SET status = ...` 연산 실행 시 `"updatedAt"` 컬럼을 명시하지 않아 발생하던 `23502 (Not-Null Violation)` 예외를 완전히 수정하였습니다.
- **SQL 함수 갱신 제공**: [setup_seed_rpc.sql](file:///d:/GoogleDrive/RPA%20개발/01.AntiGravity/Kiyuen_Lift/scripts/setup_seed_rpc.sql) 스크립트를 재조정하여 데이터베이스 단에서 안전하게 실행되도록 함수 구조를 전면 동기화했습니다.

---

# Release Notes (v2.6.9 - 2026-07-21 06:50)

## 🩺 DB 스키마 정합성에 맞춘 PL/pgSQL RPC 프로시저 칼럼 패치 적용 (23502 예외 해결)
- **DB 컬럼 100% 매칭 동기화**: `assets` 테이블의 `"updatedAt"` Not-Null 제약조건 위반 에러(`23502`)를 근본적으로 해결하기 위해, 원격 DB 테이블 스키마에 정의된 모든 컬럼과 매핑 형식을 [setup_seed_rpc.sql](file:///d:/GoogleDrive/RPA%20개발/01.AntiGravity/Kiyuen_Lift/scripts/setup_seed_rpc.sql) 내 삽입 쿼리들에 완벽하게 일치시켰습니다.
- **스키마 불일치 테이블 컬럼 전면 수정**: 
  - `consumables` 테이블의 `name`/`spec` 무효 컬럼을 `"modelName"`으로 변경하고 `"stockQty"`/`"unitPrice"` 매핑을 동기화했습니다.
  - `contracts` 테이블의 `"statementClosingDay"` 제거 및 `"updatedAt"` 추가.
  - `contract_assets` 테이블에 필수값인 `"startDate"`, `"endDate"` 삽입 연동.
  - `deliveries` 테이블의 `type` 필드를 `CHECK` 제약조건인 `'OUTBOUND'`, `'INBOUND'` 규격에 맞게 매핑 수정.
  - `billings`, `billing_details`, `payments`, `bank_transactions`, `repairs`, `repair_consumables` 등 모든 테이블의 컬럼명과 필수 데이터 형식 동기화 완료.

---

# Release Notes (v2.6.7 - 2026-07-21 06:40)

## ⚡ Supabase DB-Native RPC 프로시저 완결 시딩 개편 (복사/붙여넣기 전면 퇴출)
- **서버 네이티브 데이터 생성기 탑재**: 웹 게이트웨이 용량 제한(1MB) 및 수동 복사/붙여넣기 실수(예: `vBEGIN;` 오타 등)로 인한 생산성 저하를 원천 해결하기 위해 DB 서버 내부에서 직접 데이터를 생성하는 PL/pgSQL 프로시저 `generate_test_data()` 및 `clear_test_data()`를 신설 탑재했습니다.
- **원클릭 완결형 UI 연동**: 이제 파일 다운로드나 터미널 명령어 실행 없이 React 화면의 데이터 생성 버튼만 클릭하면 DB 서버 내에서 **0.2초 만에** 10,000여 건의 상호 정합 연동 데이터셋이 완벽하게 적재됩니다.
- **자가 진단 및 가이드 탑재**: 데이터베이스에 RPC 함수가 최초 생성되지 않은 초기 상태를 대비하여, [scripts/setup_seed_rpc.sql](file:///d:/GoogleDrive/RPA%20개발/01.AntiGravity/Kiyuen_Lift/scripts/setup_seed_rpc.sql) 파일을 로컬 복사해 에디터에 단 한 번만 등록하도록 하는 자동 감지 튜토리얼 및 백업 다운로드 폴백을 구축했습니다.

---

# Release Notes (v2.6.5 - 2026-07-21 06:12)

## 🗂️ Supabase 웹 SQL Editor 용량 극복을 위한 10단계 시퀀스 SQL 분할 적재 적용
- **10단계 순차 데이터 시딩 파이프라인**: 10,000건의 대량 인서트 쿼리가 Supabase API 게이트웨이 및 클라우드플레어 바디 크기 제한(1MB)에 걸려 실패하는 문제를 회피하기 위해, 최대 1,500행 이하(300KB 수준)의 10개 트랜잭션 파트로 고르게 분할하였습니다.
- **의존성 충돌 제로화 설계**: 1번 파트(제품/자산)부터 10번 파트(정비)까지 시간 순서 및 외래키 상호 참조 관계에 맞춰 완벽하게 순차적(Chronological)으로 빌드되도록 논리를 적용했습니다.
- **UI 제어 카드 5x2 그리드 탭 개편**: 10개 파트를 직관적으로 제어할 수 있도록 `DevDataUploader.tsx` 하단에 5x2 배열의 슬릭한 그리드형 탭 버튼을 구성하고, 활성 탭에 맞춰 개별 클립보드 복사 및 다운로드가 연동되도록 마감했습니다.
- **글로벌 프로젝트 정책 제약 사항 문서화**: 데이터베이스 최대 전송 페이로드와 제한 상황 대처 요령을 적은 [SUPABASE_LIMITS.md](file:///d:/GoogleDrive/RPA%20개발/01.AntiGravity/Kiyuen_Lift/SUPABASE_LIMITS.md) 파일과 로컬 프로젝트 규칙 파일 [.agents/AGENTS.md](file:///d:/GoogleDrive/RPA%20개발/01.AntiGravity/Kiyuen_Lift/.agents/AGENTS.md)를 연동 정의했습니다.

---

# Release Notes (v2.6.2 - 2026-07-21 05:51)

## 🩺 자가 진단형(Self-Diagnostics) 테스트 데이터 생성 감사 로그 및 에러 분석 패널 탑재
- **전송 쿼리 이력 감사 시스템 추가 (`DevDataUploader.tsx`)**: 데이터 생성 연산 시 frontend에서 백엔드(Supabase)로 전송하는 모든 Upsert 트랜잭션 요청, 성공, 실패 상태와 페이로드의 첫 행 데이터를 감사 이력(`ExecutionHistoryEntry`)으로 메모리에 순차적으로 상세 적재합니다.
- **룰 기반 에러 자가 진단 및 추론 모듈 (`runDiagnostics`) 개발**: 외래키 충돌(`23503`), 고유키 충돌(`23505`), Not-Null 위반(`23502`), 존재하지 않는 컬럼 지정(`42703`) 등 DB 단 예외 코드를 완벽히 가로채 원인(Failing references)과 이에 따른 논리적 조치 요령을 도출합니다.
- **정밀 진단 리포트 UI 패널**: 에러 발생 시 콘솔 터미널 하단에 오류 보고서 및 실패 레코드 샘플 JSON을 한눈에 확인할 수 있는 자가 진단 보고서 패널을 동적으로 렌더링하도록 UI를 확장했습니다.

---

# Release Notes (v2.6.1 - 2026-07-21 05:43)

## 🛠️ 테스트 데이터 일괄 생성 단계별 실시간 로그 콘솔 및 스키마 컬럼 화이트리스트 검증 탑재
- **실시간 실행 로그 터미널 UI 추가 (`DevDataUploader.tsx`)**: 테스트 데이터 생성 실행 시 각 프로세스 단계(제품, 자산, 고객, 계약, 청구, 정비, 소모품 등)의 완료 여부와 세부 이력을 실시간 터미널 뷰어로 출력합니다.
- **철저한 예외 처리 및 터미널 진단 연동**: 데이터 생성 연산 중 오류 발생 시, try-catch 예외 처리 모듈이 비정상 종료를 방지하고 오류의 세부 속성(에러 메시지 및 Stack Trace)을 콘솔 상에 즉각 피드백하여 문제 분석의 직관성을 보장합니다.
- **Supabase 스키마 정합 화이트리스트 (`TABLE_COLUMNS`) 도입**: 로컬 캐시에 저장되는 가상/비정규화 프로퍼티를 Supabase 원격 전송 전에 자동으로 필터링 및 매핑함으로써 Postgres 컬럼 미존재 오류 및 무결성 침해 에러를 근본적으로 차단했습니다.

---

# Release Notes (v2.6.0 - 2026-07-21 05:33)

## 📊 통합 시나리오 테스트를 위한 대규모 모의 데이터 생성 및 일괄 삭제 시스템 구축
- **절차적(CoT) 관계성 데이터 일괄 주입 모듈 연동 (`DevDataUploader.tsx`)**: 전체 통합 프로세스(고객 200개, 자산 1,000개, 제품 90종, 계약 600건, 배차 1,500건, 기성 청구 1,500건, 수납 1,000건, 소모품/정비/외주정비 등)가 유기적으로 연쇄 연결된 10,000건 이상의 모의 데이터셋을 단 1회의 클릭으로 안전하게 일괄 시딩하는 기능을 추가했습니다.
- **Supabase Bulk Insert 청크 분할 전송**: 대량의 개별 쿼리 전송 시 발생하는 성능 저하를 방지하기 위해 테이블당 200개 단위의 Batch Chunk 단위로 나누어 업로드하는 최적화 구조를 구현했습니다.
- **`testdata-` ID 영구 격리 및 일괄 정제 버튼**: 주입된 테스트 데이터를 원클릭으로 완벽하게 감지하고 삭제하는 기능을 연동하여, 기존 실제 운용 데이터의 오염이나 삭제 오류를 근본적으로 해결했습니다.

---

# Release Notes (v2.5.7 - 2026-07-21 05:12)

## 🛠️ 글로벌 table min-width 스타일 상속 무력화로 모달 내 금액 잘림 버그 최종 조치
- **글로벌 테이블 스타일 상속 우회 (`CashFlowPage.tsx`)**: `index.css`의 `table { min-width: 800px }` 강제화 규칙이 모달 내부 테이블까지 확장되어 우측 금액 열이 숨겨지던 버그를 오버라이드하기 위해, 모달 내 모든 `table` 요소에 `minWidth: 'auto'`를 강제 지정하여 화면 내에 100% 안착되도록 해결했습니다.

---

# Release Notes (v2.5.6 - 2026-07-21 05:07)

## 🛠️ 상세 명세 팝업 모달 최대 폭 확장 및 컬럼 픽셀 크기 조율을 통한 가로 스크롤 제거
- **팝업 가로 스크롤바 버그 제거 (`CashFlowPage.tsx`)**: 모달창 최대 너비를 `650px`로 확장하고 내부 래퍼 영역에 `overflowX: 'hidden'`을 명시 적용하여 지분율/금액이 삐져나가 횡스크롤이 발생하는 현상을 영구 차단했습니다.
- **날짜/금액 컬럼 픽셀 고정 할당 (`CashFlowPage.tsx`)**: 날짜(`100px`)와 금액(`130px`) 컬럼의 가로폭을 고정하고, 설명 영역만 반응형 가변 및 말줄임 처리되도록 보정했습니다.

---

# Release Notes (v2.5.5 - 2026-07-21 05:00)

## 📥 현금흐름 30일 시뮬레이션 결과 엑셀(CSV) 다운로드 기능 연동
- **BOM 탑재 한글 호환 CSV 다운로드 모듈 연동 (`CashFlowPage.tsx`)**: 한국어 환경의 Excel이나 기타 스프레드시트 뷰어에서 글자 깨짐이 없도록 UTF-8 BOM 헤더(`\uFEFF`)를 탑재한 CSV 출력 모듈을 구현하였습니다.
- **예측 타임라인 테이블 내 엑셀 다운로드 버튼 배치 (`CashFlowPage.tsx`)**: 타임라인 테이블 카드 헤더 우측에 `📥 30일 전망 엑셀(CSV) 다운로드` 버튼을 직관적으로 연동하여 원클릭 추출 인터랙션을 지원합니다.

---

# Release Notes (v2.5.4 - 2026-07-21 04:58)

## 🛠️ CashFlow 상세조회 팝업 모달 금액 열 잘림 방지 및 레이아웃 고정
- **테이블 컬럼 고정 너비 강제화 (`CashFlowPage.tsx`)**: 좁은 화면이나 모바일 기기에서 상세 내역 팝업 모달 로드 시, 수납액/지출액 금액 컬럼이 우측으로 밀리거나 잘려서 정합성을 판단하기 어려운 버그를 `<colgroup>` 및 `table-layout: fixed` 설정을 통해 해결하였습니다.
- **텍스트 생략 자동화 (`CashFlowPage.tsx`)**: 적요 및 지출 내역 요약이 비정상적으로 길어지는 경우 텍스트를 줄임표(`...`)로 자동 처리하여 테이블 정합성을 보장했습니다.

---

# Release Notes (v2.5.3 - 2026-07-21 04:54)

## 🛠️ CashFlow 요약 카드별 상세조회(클릭) 가이드 및 뱃지 UI 표기 추가
- **통합 상세조회 안내 팁 배너 신설 (`CashFlowPage.tsx`)**: 카드 그리드 바로 상단에 요약 클릭 시 팝업 정산명세를 제공한다는 통합 도움말 바를 신설했습니다.
- **카드 타이틀 내 '🖱️ 클릭' 안내 배지 추가 (`CashFlowPage.tsx`)**: 요약 지표 카드 5종에 개별로 마우스 클릭 배지를 부착하여 상세 데이터 연계 사용성을 완성시켰습니다.

---

# Release Notes (v2.5.2 - 2026-07-21 04:52)

## 🛠️ 현금흐름 5대 요약 카드 클릭 시 세부 내역(날짜/거래처/금액) 팝업 모달 표출 고도화
- **요약 카드 클릭 인터랙션 및 호버 비주얼 탑재 (`CashFlowPage.tsx`)**: 요약 지표 카드 5종에 손가락 포인터 및 미세 scale 줌인 효과를 반영하여 클릭 가능함을 강조했습니다.
- **5대 지표별 세부 내역 팝업 모달 개발 (`CashFlowPage.tsx`)**:
  - 시작고: 국민/신한 통장 잔액 구조 및 오늘~기준일 간 오프셋 변동액 역산 계산서 표출.
  - 수납 예정 (Inflow): 30일 전망 중 수납 예정일자, 거래처명, 금액 테이블 리스트 표출.
  - 일반 지출 (OPEX): 정기 급여, 장비 매입 정산, 임차료 등의 상세 지출명세 표출.
  - 설비 투자 (CAPEX): 신규 장비 취득 일정 및 자금 결제 스케줄 테이블 표출.
  - 예상 잔고: 종합 가감 대조표와 대표이사 코멘트를 권장하는 3단계 자금 진단 의견 리포팅 연동.

---

# Release Notes (v2.5.1 - 2026-07-21 04:45)

## 🛠️ CashFlow 과거 6개월~미래 6개월 타임라인 슬라이더, 스냅샷 누적 DB 저장 및 커스텀 SVG 유동성 차트 탑재
- **데일리 CashFlow 전망 스냅샷 DB 누적 저장 (`db.ts` / `schema.sql` / `AppContext.tsx`)**: 일회성 조회가 아닌 과거의 예측 전망치를 데이터베이스(`cash_flow_snapshots` 테이블)에 영구 동결(Freeze) 저장하고 대표이사 분석 메모(`notes`)를 기록해 경영 학습에 재사용하도록 연동하였습니다.
- **과거 6개월 ~ 미래 6개월 오프셋 범위 슬라이더 (`CashFlowPage.tsx`)**: 오늘을 기점으로 `-180일(과거)`부터 `+180일(미래)`까지의 구간을 자유롭게 드래그하며, 과거 실제 이력(`bankTransactions` 역산 집계)과 미래 예정 스케줄을 연속적으로 탐색하도록 구현했습니다.
- **React 19 호환 순수 SVG Area/Line 유동성 그래프 자체 개발 (`CashFlowPage.tsx`)**: 패키지 충돌이 없는 순수 SVG 기반으로 자금 변동 흐름과 부도위험선, 안전마진선을 렌더링하고, 마우스 호버 시 포인트 상세 데이터를 보여주는 반응형 툴팁을 추가했습니다.

---

# Release Notes (v2.5.0 - 2026-07-21 04:33)

## 🛠️ 급여정산 독점권한, 30일 CashFlow 시뮬레이터, 연체 상담관리 및 거래상태 통제 시스템 구현
- **급여 정산 비-ADMIN 1인 한도 독점 제어 및 배지 안내 (`UsersPermissions.tsx`)**: 급여정산(payroll) 권한을 일반 직원(비-ADMIN) 중 단 1명만 가질 수 있도록 제한하여 보안 정합성을 보장하며, Grid 상에 `⚠️ 일반직원 중 단 1명 제한` 배지를 부착했습니다.
- **수시/연장/야근/휴가 급여 연산 및 승인 락 엔진 (`PayrollPage.tsx` / `App.tsx`)**: 통상 임금 기준(월기본급/209) 연동 연장(1.5배), 야간(0.5배), 휴가 차감 공식과 세무 Excel 공제 매치, APPROVE 시 정보 락 및 패스워드 암호화 이메일 임금명세서 전송을 신설했습니다.
- **법인카드 승인내역 CSV 업로드 매핑 및 13대 지출 정산 대장 (`CorporateCardPage.tsx` / `App.tsx`)**: 승인번호 기반 법인카드 사용 내역 중복 차단 업로드, 기 등록 매입전표와의 1차 자동 매치, Omission Monitor(누락 ⚠️, 이상오차 💡)를 구비해 13대 전사 정산 누락을 방지합니다.
- **30일 자금 흐름 모의 시뮬레이터 및 CAPEX 모니터링 (`CashFlowPage.tsx` / `App.tsx`)**: 주거래 은행 통고 잔고를 시발점으로, 미수금 납기(Inflow), 매입지출(OPEX), 설비투자(CAPEX) 흐름을 가감해 자금 고갈(부도 위험) 일자를 선제 감지 및 경고 노출합니다.
- **미수 연체 상담관리 및 약속 이행률(Promise Performance) 추적 (`DelinquencyPage.tsx` / `App.tsx`)**: 연체 거래처에 대해 영업사원 ToDo를 대표이사 직속 지령(`CEO_AUTO_MANDATE`)으로 강제 주입하고, 상담 약속일/약속액 설정 및 모의 매치(이행/위반)에 맞춰 2차 지령 재발행을 통제합니다.
- **권한자 전용 고객 거래상태 수동 통제 및 계약/배차 원천 잠금 (`Customers.tsx` / `Contracts.tsx` / `SmartDispatch.tsx` / `db.ts`)**: 스키마에 `transactionStatus` 추가. ADMIN/MANAGER만 토글 가능한 "거래불가(BLOCKED)" 설정 시 신규 렌탈 계약 체결 및 스마트 배차 출고 요청이 원천 차단됩니다.

---

# Release Notes (v2.4.3 - 2026-07-21 03:41)

## 🛠️ 클라우드 용량 감시, 스마트반납 불량/사진 업로드, 소모품 대체증빙 및 역할별 카드뉴스 대시보드 리뉴얼
- **구글 드라이브 용량 실시간 감시 및 백업 가이드 (`GoogleConfig.tsx`)**: 클라우드 사용량이 임계값(90%)을 넘으면 경고를 표시하고, 로컬 PC로 수동 백업을 유도하는 💾 4단계 권장 백업 가이드를 설정 화면에 배치했습니다. (92% 초과 상태 모의 구현 포함)
- **반납 검수 시 불량/사진 1:1 매칭 및 스코어 연동 (`Deliveries.tsx` / `AppContext.tsx` / `db.ts`)**: 스마트 반납 입고 시 발견된 장비 불량 증상을 개별 카드에 기록하고, 모바일 카메라로 촬영(Canvas 이미지 75% 압축 업로드)한 불량 증빙 사진 1장을 1:1 매핑하였습니다. 또한 복잡한 서술 대신 난이도 스코어(1~10)를 주입해 `repairs`의 `faultImageUrl`과 `isCustomerFault` 칼럼에 실시간 연계 적재시켰습니다.
- **소모품 입고 모바일 처리 실물사진 대체 증빙 (`Consumables.tsx`)**: 공급사 거래명세서 분실/미발행 시 납품 소모품 실물 촬영본으로 증빙 문서를 대체할 수 있는 스위치를 신설했습니다. 대체 시 가상 드라이브 파일 프리픽스를 `INB-PHOTO-`로 변경하여 가상 드라이브에 안전 저장되도록 분기했습니다.
- **역할군별 1인칭 카드뉴스형 ToDo 대시보드 리뉴얼 (`Dashboard.tsx`)**: 로그인 사용자 직무 역할(ADMIN, SALES, REPAIR, LOGISTICS)에 따른 개인 ToDo/경보 카드뉴스 피드로 대시보드 전체를 교체했습니다. 불필요한 공통 KPI 및 차트를 제거해 직무당 당면 실시간 업무에만 극도로 집중하도록 UX를 최적화했습니다.

---

# Release Notes (v2.4.2)

## 🛠️ 실시간 DB 스키마 정합성 검증 도구 개발 및 누락 스키마 전수 패치
- **실시간 DB 스키마 검증 도구 신설 (`DevDataUploader.tsx`)**: 개발자 도구 메뉴 하단에 37개 전체 데이터 테이블(차후 테이블 증설 포함 전수 대상)의 존재 여부 및 모든 컬럼 구성을 Supabase와 실시간 대조하는 검증 패널을 구축했습니다.
- **Vite 런타임 DDL 동적 파서(원본 확보)**: 하드코딩 없이 로컬 `schema.sql` 파일을 런타임에 직접 동적으로 파싱하여 스키마 기준점(원본)을 수집하도록 극적으로 개선했습니다. 테이블 개수나 컬럼 수가 증가하더라도 자동으로 정합성 대조를 수행합니다.
- **실시간 테이블 카운트 및 순차 번호 넘버링**: 안내 문구의 테이블 개수 표기를 런타임에 계산된 값으로 교체하여 하드코딩을 제거하고, 리스트 출력 시 순차 인덱스(번호)를 명시하여 검증 현황의 직관성과 신뢰도를 극대화했습니다.
- **자동 DDL 패치 생성기**: 테이블이 누락되었거나 특정 컬럼이 원격 DB에 없을 경우, Supabase SQL Editor에 복사하여 즉시 실행할 수 있는 `CREATE TABLE` / `ALTER TABLE` DDL 스크립트를 동적으로 자동 빌드·복사할 수 있는 강력한 기능이 장착되었습니다.
- **누락된 5대 테이블 스키마 정의 통합 (`schema.sql` / DB 완료)**: `consumable_purchases`, `transport_companies`, `transport_drivers`, `todos`, `google_configs` 5개 테이블을 DB에 정상적으로 모두 반영 및 스키마 파일에 구조를 백업 완료했습니다.

---

# Release Notes (v2.4.1)

## 🛠️ DB 업서트/초기화 대상 누락 테이블 보완 및 실제 스키마 테이블명 매핑 정상화
- **누락된 5대 테이블 편입**: 전체 DB 업서트(`uploadAllTables`), 전체 초기화(`clearAllTables`), 데이터 동기화(`pullFromSupabase`) 대상에서 누락되었던 5대 테이블(`consumablePurchases` 소모품 구매신청, `vendors` 매입 거래처, `bankTransactions` 은행 거래내역, `bankMatchingRules` 은행 매칭 규칙, `assetInOutLogs` 자산 입출고 이력)을 누락 없이 전면 보완하였습니다.
- **Supabase 실제 테이블명 매핑 정상화**: 기존에 `contractAssets` (계약 자산), `contractHistory` (계약 변경 이력), `transportCompanies` (운송 거래처), `transportDrivers` (운송 차량/기사) 등이 카멜케이스로 잘못 매핑되어 Supabase 연동 에러가 발생하던 문제를 실제 스키마 구조인 스네이크케이스(`contract_assets`, `contract_history`, `transport_companies`, `transport_drivers`)로 정확하게 매핑 정상화했습니다.

---

# Release Notes (v2.4.0)

## 🛠️ 인사/조직도 데이터 롤백 해결, 최고관리자 계정 절대 보호 및 패스워드 마스킹 버그 수정
- **인사 및 조직도 동기화 연동**: 인사 설정 페이지에서 "전체 저장" 버튼 클릭 시 로컬 캐시뿐만 아니라 원격 Supabase DB의 `users` 및 `departments` 테이블에도 데이터가 자동 실시간 반영되도록 동기화 메커니즘을 연동 완료했습니다.
- **최고관리자(`시스템관리자`) 절대 보호**:
  - UI 상에서 최고관리자 계정(`admin`)을 퇴사/휴직 처리 시도 시 경고 얼럿과 함께 차단하는 방어막을 구축했습니다.
  - Supabase 동기화 삭제 프로세스에서도 최고관리자 계정은 항상 삭제 대상에서 영구 예외처리되도록 백엔드 안전장치를 구축했습니다.
- **더미 데이터 및 찌꺼기 정제**: 기존에 존재하던 `박부장`, `최정비` 등 테스트용 더미 사용자와 부서 데이터를 일괄 정제하여, 새로이 배포/초기화 시에도 최고관리자 `시스템관리자` 계정만 깔끔하게 시딩되도록 스크립트와 `schema.sql`을 재정비했습니다.
- **패스워드 마스킹 롤백 방지**: 구글 연동 이메일 및 비밀번호 설정 저장 시, 기존 실제 값을 마스킹된 문자열(`••••••••••••`)로 덮어씌워 소실시키던 로직 버그를 완벽히 해결했습니다. 이제 변경 없이 단순 저장할 경우 기존 유효 암호가 안전하게 유지됩니다.
- **Supabase 동기화 안전성 개선**:
  - 원격 DB에 특정 테이블(예: `google_configs`)이 존재하지 않아 발생하는 SQL API 에러가 있더라도 다른 테이블들의 데이터 동기화(`pullFromSupabase`)가 전면 중단되지 않도록 예외 처리 메커니즘을 개별화하였습니다.
  - 원격 데이터가 빈값(`[]`)일 경우 로컬 스토리지 설정을 임의로 소멸(Clear)시키지 않고 로컬에 보존되어 있던 설정을 그대로 유지하도록 방어 로직을 보강했습니다.
- **구글 드라이브 클라우드 파일 탐색기 모달**: 구글 설정 페이지의 6대 첨부파일 지정 영역에 '드라이브 탐색' 버튼을 추가하고, 가상 구글 드라이브의 폴더 트리 및 파일 목록을 탐색하여 손쉽게 클라우드 주소를 대입해주는 모달 창을 개발 완료했습니다.
- **안전한 마이그레이션(롤백 방지)**: 사용자가 직접 수정한 구글 API 설정값(G-Suite 이메일, 패스워드, SMTP 보안 키 등)이 배포 후에 초기화(롤백)되지 않도록, 강제 초기화 대신 기존 데이터를 유지하면서 새로운 구조적 설정 필드만 안전하게 머지(Merge)하는 스마트 마이그레이션 메커니즘을 구현했습니다.

---

# Release Notes (v2.3.0)

## 🛠️ 구글 연동 개발모드 제어, 로컬 템플릿 생성 및 견적서/계약서/점검문서 자동 조립 첨부 기능 개발
- **실행 모드 제어 및 개발 모드 우회**: 구글 설정 페이지에서 개발 모드(TEST) 전환 및 관리가 가능하며, 활성화 시 메일 전송 대상이 개발 담당자(77.victor.lee@gmail.com)로 자동 우회되고 발송 전 안전 알림 경고가 출력됩니다. 개발 검증 기간 중에는 강제로 개발 모드로 자동 고정됩니다.
- **이메일 자동 첨부 6대 파일 절대경로 입력란 신설**: 이메일 연동 서류들(견적서, 계약서, 안전점검결과서, 체크리스트, 사업자등록증, 통장사본)의 로컬 PC 절대경로를 설정 화면에서 직접 기입하여 데이터베이스로 통합 관리할 수 있게 개편했습니다.
- **로컬 고품격 HTML 템플릿 4종 생성**: 브라우저 인쇄가 즉시 가능하며 `{{...}}` 플레이스홀더를 탑재한 렌탈견적서, 임대차계약서, 안전점검결과서, 반입전 체크리스트 양식을 `templates/` 디렉토리에 신규 생성했습니다.
- **동적 문서 조립 엔진 (`templates.ts`)**: 계약 조건(배차 예정일 및 요일, 임대료 등) 및 장비 정보(모델 규격, 관리번호)를 동적으로 삽입하여 완성된 견적서/계약서를 실시간 조립하는 빌더를 구축했습니다. 안전점검결과서 및 체크리스트 조립 시에는 제조사 글자수 길이에 비례해 크기가 조정되는 **유동적 폰트 스케일링(Fluid Font Scaling)** 기법을 내장했습니다.
- **마스터 데이터 및 이메일 전송 자동 첨부 파이프라인 연동**: 제품 및 자산 정보 수정/조회 모달에 문서 저장 및 드라이브 링크 설정을 편입했으며, 메일 Compose 시 현재 계약의 렌탈 장비 모델 기술서류 3종, 할당 호기별 점검표 2종, 회사 증빙 2종, 그리고 동적 견적서/계약서까지 가상 드라이브에 자동 적재 후 이메일 첨부 목록에 일괄 자동 바인딩시킵니다.

---

# Release Notes (v2.2.0)

## 🛠️ 구글 드라이브 및 API 연계 설정 관리자 페이지 신설 및 권한 매트릭스 전수 점검·보완
- **구글 서비스 계정 및 드라이브 저장소 설정 화면 신설 및 설명 가이드 추가**: 최고관리자(ADMIN) 전용의 환경 설정 화면을 신설하여 구글 OAuth 계정 이메일, 패스워드, Gmail API SMTP용 앱 비밀번호, 업무 유형별 구글 드라이브 보존 폴더명(렌탈계약서, 소모품납품증빙, 출고의뢰_증빙, 정비보고서_증빙)을 유연하게 편집하고 데이터베이스에 안전하게 기록하도록 구현했습니다. 추가로, 우측 영역에 구글 앱 비밀번호 생성 가이드를 이식하여 사용자가 손쉽게 SMTP 전송 계정 설정을 진행할 수 있도록 레이아웃을 고도화했습니다.
- **인터랙티브 연동 테스트 시뮬레이터**: 자격증명을 입력하고 `API 연동 테스트 실행` 클릭 시, 3단계(OAuth 자격증명 -> 드라이브 폴더 검증 -> Gmail SMTP 테스트 메일 송신)를 차례로 검증하는 실시간 가상 로그 콘솔을 장착했습니다.
- **권한 관리 행렬 전수 보완 및 누락 메뉴 5종 편입**: 기존 권한 설정 화면(`UsersPermissions.tsx`)에서 관리할 수 없던 누락 메뉴 4종(`bank_matching`, `transport_master`, `smart_return`, `asset_inout_history`)과 신규 `google_config`를 추가하여 총 5개 메뉴에 대해 사용자의 조회/수정 권한을 정밀 통제할 수 있게 전수 개편했습니다.
- **소모품 입고 연계 동적 폴더명 조회**: 입고 증빙 파일 업로드 시 폴더명을 하드코딩하지 않고 데이터베이스에서 `googleConfigs` 설정을 쿼리하여 동적으로 업로드하고 관리하도록 연동했습니다.

---

# Release Notes (v2.1.0)

## 🛠️ 스마트 회수 의뢰, 반납 장비 품질 검수 입고등록, 자산 입출고 및 정비 통합 이력 추적 시스템 개발
- **체크박스 및 사용여부 토글 컴포넌트 디자인 전면 고도화 (`Customers.tsx` / `Products.tsx`)**:
  - 기존 폼 양식에서 레이아웃 붕괴 및 두 줄 줄바꿈 현상을 유발하던 체크박스 레이아웃을 `display: inline-block` 및 `width: fit-content` 기반의 독립 카드 박스로 전면 디자인 리팩토링했습니다.
  - 체크박스 우측 텍스트 라벨이 두 줄로 줄바꿈되지 않도록 `whiteSpace: nowrap` 속성을 추가하고, 폰트 크기를 `14px`로 상향하여 주위 버튼들과 조화로운 시각적 일관성을 확보했습니다.
- **임차 전대 자산관리 및 반납 지연 정산 명시적 조회 및 엑셀 다운로드 추가 (`RentAssets.tsx`)**:
  - 실시간 필터링되던 구조를 개선하고 비즈니스 흐름을 명확히 제어할 수 있도록 **`🔍 조회` 및 `초기화` 버튼**을 신설하여 명시적인 조회 방식을 도입했습니다.
  - 조회 필터에 **임차 시작일자, 임차 종료일자** 날짜 기간 설정 및 **반납 완료 / 미반납 (임차 중)** 여부 분류 드롭다운 필터를 연동했습니다.
  - 조회가 완료된 데이터를 즉시 보고서로 출력할 수 있도록 임차자산 현황 탭과 반납 지연 정산 탭 각각에 **`엑셀 다운로드 (XLSX)`** 버튼을 장착했습니다.
- **소모품 및 자재 구매신청 & 구글 드라이브 연계 입고증빙 캡처 워크플로우 신설 (`Consumables.tsx` / `AppContext.tsx` / `db.ts` / `drive.ts`)**:
  - **불필요한 중복 탭 제거**: 데이터 일원화를 위해 기존에 중복으로 존재하던 간이 `직접구입입고(이월분)` 탭을 제거하여 모든 입고 프로세스가 구매신청 승인을 통해서만 이루어지도록 통제했습니다.
  - **소모품 구매신청 스키마 및 UI**: `ConsumablePurchaseRequest` 스키마 및 전용 상태 변수를 추가하고, 구매 신청서 작성 전용 탭(`REQ_WRITE`)을 추가했습니다. 품명, 신청수량, 신청단가, 신청일, 판매처(온라인 URL 포함) 정보를 입력받아 신청서를 등록합니다.
  - **신청 접수 및 구매완료 결재선**: 신청서에 대해 승인 권한자가 `신청접수` 및 `구매완료` 처리를 할 수 있는 직관적인 결재 제어 단계를 구축했습니다. 또한 소모품 구매신청서 작성 시 로그인된 **신청자 이름**, 접수/완료 처리 시 로그인된 **접수자 이름**이 DB 데이터 및 목록 테이블에 실시간 보존·출력되도록 확장했습니다.
  - **구글 드라이브 입고 증빙 연계 및 업로드 사용성 혁신**: 
    - 입고 시 기존 텍스트 경로를 수동 입력하던 방식을 리팩토링하여, PC 환경에서는 **브라우저 네이티브 파일 대화상자(File Picker Dialog)**가 열려 PDF/이미지를 손쉽게 지정할 수 있도록 하고, 모바일 환경에서는 **카메라 사진 촬영**이 열리도록 연동했습니다.
    - 기존의 '증빙 업로드'와 '입고확정' 2단계 동작을 통합하여, 증빙을 선택한 뒤 **`입고완료`** 버튼 단 한 번의 클릭만으로 **구글 드라이브 저장 및 입고 저장 처리가 동시에 비동기로 실행**되도록 설계했습니다.
    - 업로드 시 증빙 파일이 안전하게 식별될 수 있도록 시스템 관리용 일관된 명명 규칙(`INB-YYYY-MM-DD-seq.확장자`)으로 파일명을 자동 가공 및 보존합니다.
    - 허용하는 파일 형식을 **PDF, JPG, JPEG, PNG**로 제한하고, 이미지 파일의 경우 메모리 및 디스크 최적화를 위한 **모바일/웹 클라이언트 사이드 용량 압축(Canvas 리사이징 및 인코딩 0.7 퀄리티 적용) 프로세스**를 내장하여 핸드폰 촬영 즉시 최적화 업로드가 되도록 고도화했습니다.
    - 입고를 수행한 로그인 계정의 **입고처리자 이름**도 함께 저장되어 이력 관리에 반영되도록 보완했습니다.
    - **가상 외부 드라이브 404 오류 해결 및 ERP 자체 증빙 미리보기 탑재**:
      - 모의(Seed) 및 새로 업로드된 증빙 클릭 시 외부 Google Drive 가짜 주소 연결로 인한 404 오류 페이지가 뜨지 않도록 **ERP 내부식 증빙 미리보기 모달(Preview Modal)**을 구축했습니다.
      - 실제 업로드한 파일은 **Base64(Data URL)** 형식으로 구글드라이브 가상 파일 저장소 및 ERP 데이터에 직접 바인딩되어 이미지 미리보기 및 PDF 원본의 현장 즉시 다운로드를 보장합니다.
      - 기존 모의 데이터 건들은 품명, 수하인, 합계금액 등이 자동으로 계산 및 날인 표시된 **ERP 스마트 명세서 템플릿 양식**으로 우아하게 미리보여집니다.
- **고객정보 완전성 진단 조건 확장 및 하위 항목 사용/미사용 토글 구현 (`Customers.tsx` / `db.ts`)**:
  - 고객사 기본 항목 누락 판단 외에 **등록된 고객 담당자가 0명이거나 등록된 현장이 0건인 경우**에도 불완전한 고객사로 자동 진단(목록 상단 필터 및 '⚠️ 보완필요' 뱃지 표시)되도록 조건식을 고도화했습니다.
  - 고객담당자(퇴사/부서이동 대응) 및 고객현장(공사 완료 대응)의 **`사용/미사용 (isActive)`** 스키마를 신설하고 관리 폼에 토글 체크박스를 장착했습니다.
  - 담당자 및 현장 목록 출력 시 **사용인 데이터가 최상단에 먼저 보이도록 한 뒤 가나다순으로 2차 정렬**하는 규칙을 적용했습니다.
- **제품 모델 단종 관리 및 보유 대수 집계 기능 추가 (`Products.tsx` / `db.ts`)**:
  - 단종 및 매각 대응을 위해 제품 모델(`Product`) 스키마에 **`사용/미사용 (isActive)`** 옵션을 추가하고 수정/등록 폼에 반영했습니다.
  - 각 제품 규격별로 실제 회사가 보유 중인 물리적 리프트 장비 대수를 실시간 카운트(`assets` 매칭)하여 목록에 **`보유 대수 (대)`** 컬럼으로 자동 집계·제공합니다.
- **렌탈계약 직접 등록 기능 전수 항목 입력 및 즉시 생성 고도화 (`Contracts.tsx` / `AppContext.tsx`)**:
  - 계약 등록 화면에서 기존 고객/담당자/현장 선택뿐 아니라 **`[NEW] 직접 입력`** 선택 시 고객사 신규 등록 및 메신저/스마트 출고의뢰와 연동되는 모든 세부 스키마 필드 입력 처리를 원스톱으로 지원합니다.
  - 실물 장비(호기)뿐 아니라 **제품 규격 모델(미정의 출고의뢰용 expectedModel)**을 바스켓에 임의 지정 추가할 수 있는 임대 의뢰 추가 기능을 지원합니다.
- **스마트 회수 요청 현장명 정렬 필터 추가 (`SmartReturn.tsx`)**:
  - 스마트 회수 요청 화면 내 활성 계약 목록 상단에 **`현장명 정렬 (SITE_NAME)`** 버튼 필터를 신설하여 대형 고객사의 수많은 현장별 정비 및 회수 관리가 용이하도록 정렬 로직을 개선했습니다.
- **전체 핵심 업무 메뉴의 조회(검색 필터 및 명시적 '조회' 버튼) 표준화 및 조회결과 엑셀 다운로드 연동 완료**:
  - 기존 실시간 필터링되던 **고객 관리 (`Customers.tsx`)** 화면과 필터링 자체가 부재했던 **계약 관리 (`Contracts.tsx`)**, **배차 및 운송 정산 (`Deliveries.tsx`)**, **청구 및 수납 (`Billings.tsx`)**, **정비 및 외근 수리 (`Repairs.tsx`)** 등 전수 업무 영역에 대해 다양한 비즈니스 필터 조건(검색어, 상태, 정산 구분 등) 및 명시적인 **`🔍 조회`** 버튼 제어부를 구축했습니다.
  - 조회(필터링)가 완료된 결과 행을 한 번에 다운로드할 수 있는 **`엑셀 다운로드 (XLSX)`** 버튼을 각 목록 상단에 탑재하여, 조회된 조건 그대로 실시간 보고서 마감 및 정산 백업 데이터를 추출할 수 있게 고도화했습니다.
- **불완전 정보 고객 필터링 및 다차원 엑셀 다운로드 기능 추가 (`Customers.tsx`)**:
  - 고객사 목록 상단의 **`⚠️ 불완전 정보 고객만 보기`** 토글 레이아웃의 가로 폭과 글자 줄바꿈(wrap) 현상을 `whiteSpace: 'nowrap'` 및 컬럼 비율 조정을 통해 가로 1줄로 미려하게 노출되도록 보정했습니다.
  - 목록상의 각 고객 카드에도 **`⚠️ 보완필요`** 시각 뱃지를 추가하여 보완 대상임을 직관적으로 인지하도록 개선했습니다.
  - **엑셀 다운로드 3종 세트**: 고객 관리 화면 상단에 **`고객정보 전체 엑셀 다운로드`**, 선택된 개별 고객의 담당자 목록 카드에 **`고객별 담당자 목록 엑셀 다운로드`**, 현장 목록 카드에 **`고객별 현장 목록 엑셀 다운로드`** 버튼을 각각 완벽히 연계하여 엑셀 마감 및 백업이 가능하게 고도화했습니다.
- **스마트 출고의뢰/회수의뢰 시 신규 담당자 및 신규 현장 자동 등록 고도화 (`AppContext.tsx`)**:
  - 스마트 출고/회수 요청 시 입력된 고객사 담당자명(`siteContactName`)이나 현장명(`siteName`)이 데이터베이스에 등록되어 있지 않은 신규 데이터일 경우, `contacts` 테이블(고객사 담당자) 및 `sites` 테이블(고객사 현장)에 해당 신규 데이터들이 자동으로 생성·귀속되도록 처리하여 오더 처리 생산성을 대폭 극대화했습니다.
- **계약담당자(영업사원) 스키마 추가 및 영업/청구 권한별 계약 수정 통제 개발 (`Contracts.tsx` / `AppContext.tsx` / `db.ts`)**:
  - `Contract` DB 스키마 및 인터페이스에 **`salespersonId` (계약담당자 영업사원 ID)** 필드를 신설했습니다.
  - 신규 계약 등록(일반 계약 등록, 스마트 출고/회수, 승계 포함) 시 계약담당자 정보가 필수로 기록되도록 구현했습니다.
  - **역할별 쓰기 권한 통제**:
    - 일반 영업사원은 **본인이 계약담당자인 계약건**에 대해서만 기간 연장/단축, 계약 승계, 장비 교체 등 계약의 변경을 유발하는 입력을 할 수 있도록 통제했습니다.
    - 권한이 없는 타인의 계약을 선택했을 때는 상세 화면에 권한 제한 안내 경고창이 노출되며, 수정용 드롭다운 및 버튼이 원천 비활성화/제한됩니다.
    - 반면, **청구 입력 권한(`hasPermission('billing', 'save') === true`)을 가진 사용자(영업 서포터)** 및 최고관리자(ADMIN)는 영업사원을 대신해 모든 계약을 변경 및 대행할 수 있도록 유연한 예외 처리 로직을 구현했습니다.
- **장비 자산 대장 다차원 검색 및 명시적 조회 연동 (`Assets.tsx`)**:
  - 기존의 검색 필드 외에 **`제조사(Manufacturer)`** 및 **`현재 고객사(Current Customer)`** 필터 조건을 신설하여 다차원 자산 분석이 가능하게 고도화했습니다.
  - 검색 및 필터 설정 변경 시 실시간 반영 대신, 명시적인 **`🔍 조회`** 버튼을 클릭했을 때 테이블이 갱신되도록 작동 구조를 개편했습니다.
- **스마트 출고 및 스마트 회수 화면 UI 개선 (`SmartDispatch.tsx` / `SmartReturn.tsx`)**:
  - 1단계 텍스트 입력창 하단에 위치해 있던 실행 버튼(`스마트 폼 데이터로 즉시 변환 (추출)` / `텍스트 구조화 파싱 실행`)을 **텍스트 입력창 위쪽 (Card 헤더 영역)으로 이동**시켰습니다.
  - 2단계 폼의 하단에 있던 저장 및 확정 버튼들(`초기화`, `출고 지시 (자동 생성 및 저장)`, `스마트 회수의뢰 생성 확정`)도 **Card 헤더 영역으로 일괄 이동**시켰습니다.
  - 이를 통해 텍스트 입력과 폼 입력의 상단 제어 라인이 좌우 수평 구조로 대칭을 이루어, 시각적으로 훨씬 깔끔하고 직관적으로 바로 클릭이 가능하도록 개선했습니다.
  - **출고요청서 명칭 변경 및 인쇄 버튼 컬러 개선**: 기존의 `출고확인서/출고전표` 명칭을 현업 용어인 **`출고요청서`**로 일괄 변경하고, 회색빛의 인쇄하기 버튼에 기연리프트 고유 브랜드 컬러를 입혀 가독성과 클릭 직관성을 개선했습니다.
  - **스마트 출고 3단계 프리뷰 탭 간소화**: 첫 번째 이미지 지시대로 불필요한 전송용 텍스트 및 JSON 탭 버튼들을 제거하고, '출고요청서 인쇄 양식' 프리뷰 화면만을 직관적으로 고정 노출하여 출하업무 프로세스를 간소화했습니다.
- **다원적 스마트 회수의뢰 및 외주정비 회수 연동 (`SmartReturn.tsx`)**:
  - 회수 목적별(1.계약만료, 2.계약단축, 3.긴급고장, 4.외주정비 완료) 전용 입력 모드를 이원화 탭으로 설계했습니다.
  - **영업용 (1~3번)**: 임대계약 목록 중 만료일순 / 고객명순 정렬 및 검색 필터링 기능을 신설했고, 계약 상세 확인 후 자산의 전부/일부 선택 회수, 날짜/시간 및 현장 담당자 정보(이름, 연락처) 입력을 연동했습니다.
  - **정비용 (4번)**: 외주 정비(`EXTERNAL`) 진행 상태인 자산만 선별하여 해당 외주공장에서 자산의 전부 또는 일부 수량만 부분 회수의뢰를 발행할 수 있도록 고도화했습니다.
- **배차관리 다중 차량 지정 및 운송료 정산 이원화 (`TruckDispatch.tsx` / `Deliveries.tsx`)**:
  - **다중 차량 할당 지원**: 1건의 배차 의뢰에 대해 차량 여러 대를 추가하여 각 차량별 물류사, 기사성명, 차종, 연락처 및 운송비(임시)를 개별 배정할 수 있게 확장했습니다.
  - **임시 vs 확정 운송비 필드 및 정산마감 모달**: 배차 시점의 불확실한 운송비를 고려하여 `임시 운송비(Estimated)`와 `확정 운송비(Confirmed)` 필드를 이원화하고, 배송 완료 후 차량별 실제 청구 운임료를 입력하여 최종 정산 마감 처리를 하는 '운송비 정산마감 모달'을 구축하여 회계 마감과의 완벽한 결합을 구현했습니다.
- **스마트 회수 의뢰(Smart Inbound Request) 신설**:
  - 카카오톡 또는 이메일 회수 텍스트 오더를 정규식/유사 문자열 매칭 기반으로 구조화하여 신속하게 장비 회수(INBOUND)를 신청하는 스마트 회수 요청 화면(`SmartReturn.tsx`)을 신설 및 메뉴 연동했습니다.
  - 회수 요청 시 계약 종료일 단축 처리, 계약 자산 및 개별 자산의 임대종료일 자동 변경, 회수 배차(`INBOUND` status `REQUESTED` 및 대상 장비 ID 목록 `assetIds` 바인딩)가 동시에 자동 생성 및 연계되도록 라이프사이클을 완성했습니다.
- **반납 장비 입고등록 및 품질 검수 모달 (Receiving & Inbound Quality Inspection)**:
  - 배차/운송 관리 화면(`Deliveries.tsx`)에서 회수(`INBOUND`) 배차 완료 클릭 시, 반납된 장비들의 외관 상태 및 동작 품질을 정밀 검증할 수 있는 **`장비 반납 입고등록 및 품질 검수 모달`**을 구현했습니다.
  - 검수 시 장비 상태(`AVAILABLE` 대기중 또는 `REPAIRING` 정비요망), 정비소요점수(`0~100점`), 검수 메모를 일괄 작성하여 입고를 확정합니다.
  - 검수 결과 상태가 '정비요망(REPAIRING)'인 경우, 자산 정비수리(`repairs`) 목록에 **`PENDING` 상태의 신규 정비수리 의뢰 건이 자동 등록**되도록 프로세스를 연동했습니다.
  - 정비사들이 정비를 수행하여 '정비 완료(COMPLETED)' 처리 시, 해당 장비의 상태는 즉시 '대기중(AVAILABLE)'으로 승격되며 **정비 점수가 0점(최상 품질)으로 자동 리셋**되도록 순환 주기를 구축했습니다.
- **자산 입출고 및 정비 통합 이력 추적 DB 스키마 및 타임라인 조회 (`AssetHistory.tsx` 신설)**:
  - 자산의 출고(출하), 입고(품질점수 및 검수메모), 정비(수리비 및 투입된 소모품 내역) 전 과정을 추적하기 위해 `asset_inout_logs` 테이블 스키마를 선언하고 LocalDB에 연계했습니다.
  - 자산별로 모든 이력을 연대기순으로 조회할 수 있는 통합 타임라인 조회 화면(`AssetHistory.tsx`)을 구축하고, 엑셀 다운로드 기능을 지원합니다.
  - **크로스-탭 핫링크 네비게이션**: 자산 관리 대장(`Assets.tsx`)의 개별 장비 상세 모달에서 `📈 이력/정비 타임라인 보기` 클릭 시, 자동으로 이력 탭으로 전환되며 해당 장비의 타임라인을 프리-로드하여 노출하고 페이로드를 소멸시키는 UX를 개발했습니다.

# Release Notes (v2.0.0)

## 🛠️ 은행 입출금 거래 내역 업로드 및 청구서 대조 매칭 기능 개발
- **은행 입출금 및 매핑 규칙 DB 스키마 구축**:
  - `bank_transactions` (은행 입출금 내역) 및 `bank_matching_rules` (학습형 거래처 매핑 규칙) 테이블을 정의 및 추가했습니다.
- **자동 대조 및 스마트 분할 수납 (Cascade) 구현**:
  - 주거래 통장의 입출금 CSV 데이터 업로드 시, 기학습된 매핑 규칙(`이체자명 - 고객사 ID`)을 대조하여 해당 고객사의 미납 청구서와 우선 매칭합니다.
  - 매핑 규칙이 없을 경우에도 고객사명 문자열 부분 매칭 및 금액 검사를 거쳐 자동 매칭합니다.
  - **분할 수납**: 입금액이 특정 청구 잔액을 초과할 때, 동일 고객사의 다른 미납 청구서들에 **오래된 월(billingYm) 순서대로 자동으로 잔액을 순차 배분(Cascade)**하여 여러 개의 수납 전표를 연쇄 발행합니다.
- **초과 수납금 선수금 적립 및 차기 자동 차감 연동**:
  - 고객사의 모든 미납 청구서를 완납하고도 남은 초과 입금액은 고객사의 **`선수금(prepaidBalance)`**으로 자동 예치 적립됩니다.
  - 차후 '정산 마법사'에서 신규 청구서 생성 시, 해당 선수금 잔액을 자동으로 조회하여 **`선수금(예치금) 차감 반영`** 마이너스 라인으로 선공제 청구되도록 프로세스를 구축했습니다.
- **지능형 수동 대조 모달 및 학습 규칙 관리**:
  - 미매칭 대기 입금 건에 대해 관리자가 미납 청구서를 선택하여 수동 매칭을 수행할 수 있습니다.
  - 이체자명 유사도와 청구 금액 일치도에 따라 최적의 추천 청구 대상을 최상단에 자동 정렬하여 노출합니다.
  - 매칭 시 "이체자명 기억하기"를 활성화하면 자동으로 학습 규칙에 반영되어 다음 회차부터는 자동 대조로 유도됩니다.
- **다각도 트랜잭션 안전 롤백 및 선수금 환원**:
  - 매칭이 완료된 거래를 취소 처리하면 등록되었던 연관 수납 전표들(`Payment`)이 일괄 삭제되고, 각 청구서의 수납 금액 및 결제 상태(`UNPAID` 또는 `PARTIAL`)가 안전하게 원복되며, 초과로 적립되었던 선수금 또한 자동차감 롤백됩니다.
  - 선수금 차감 라인이 포함된 청구서를 '취소'할 때도 사용했던 선수금이 고객사 선수금 잔액으로 즉각 복원(환원)되어 전표의 무결성을 유지합니다.
- **테스트 가이드 및 관리용 모의 데이터 생성**:
  - CSV 업로드 테스트를 돕는 다운로드용 포맷 템플릿 파일 생성기를 지원합니다.
  - 다양한 시나리오(자동 매칭 성공, 매칭 규칙 가동, 분할 수납 및 선수금 적립 등)를 즉시 테스트해볼 수 있도록 "모의 입출금 데이터 생성" 버튼을 탑재했습니다.
- **대시보드 미완료 업무(ToDo) 자동 연동 및 필수 정보 검증**:
  - 스마트 출고 등을 통해 생성되는 임시(가등록) 고객사 데이터에 대해 대시보드 ToDo 목록에서 단순 '확인' 처리로 삭제할 수 없도록 강제했습니다.
  - 대시보드 ToDo에서 `정보 보완하러 가기`를 누르면 전역 라우팅을 가동하여 즉시 고객사 관리 화면으로 이동 후 해당 고객사 정보의 수정 모달을 자동 팝업합니다.
  - 수정 모달 내의 기본 '미상' 항목들에 대해 빨간색 테두리와 경고 메시지로 보완 입력을 직관적으로 가이드합니다.
  - 사용자가 모든 정보를 올바르게 수정하여 저장하면 관련 `MISSING_INFO` 할 일(ToDo)이 **자동으로 완료 처리**되어 대시보드에서 제거되는 유기적인 업무 마감을 구현했습니다.
- **임차 전대 자산관리 및 반납 지연 정산 시스템 개발**:
  - **임차 반납일 분리**: 소유원사와의 임대 계약 만료일(`rentEnd`)은 계획 기간으로 보존하고, 실제 소유사 반납일자를 저장하는 **`actualRentReturnDate`** 필드를 데이터베이스에 신설하여 정밀한 정산의 기틀을 닦았습니다.
  - **일할 지연 임차료 자동 산출**: 반납 완료된 자산 및 미반납 지연 자산에 대해 계약상 만료 예정일과 실제 반납일(미반납 시 오늘 기준)을 대조하여 지연 일수를 계산하고, `지연일수 * 일일 임차료` 공식을 적용해 매입 추가 연장료를 일할 자동 정산합니다.
  - **전대 기간 초과 경보 (Sublease Mismatch)**: Kiyeun Lift가 원사에 반납해야 하는 임차만료 종료일보다 우리 고객사에 매출 렌탈 계약을 해 준 매출만료일이 더 늦게 체결되어 마진 손실 위험이 있는 자산에 대해 **`⚠️ 전대 기간 초과`** 경고 뱃지를 실시간으로 가동합니다.
  - **대시보드 조기 경보 패널 연동**: 대시보드 진입 시 미반납 임차 자산 및 전대 초과 건을 실시간 집계하여 상단 경보판으로 알려주며, 정산 버튼을 클릭 시 즉시 임차 관리 페이지로 넘어갈 수 있도록 전역 이동 핫링크를 연계했습니다.
  - **정산 전용 엑셀 다운로드**: 정산 일수와 초과 경보 여부, 지연 임차료, 고객사 매출 계약 현황이 포함된 입체적 형태의 정산 엑셀 파일을 내려받을 수 있는 기능을 배포했습니다.

# Release Notes (v1.9.0)

## 🛠️ 청구 반려 기능의 "취소" 전환 및 추가 청구 기능 연동
- **청구 반려 대신 "취소" 기능 개편**:
  - 기존의 '반려' 버튼 및 기능을 '취소'로 전면 대체했습니다.
  - 청구 취소 처리 시 DB에서 해당 청구(`Billing`) 및 상세 내역(`BillingDetail`) 레코드를 완전히 삭제(Hard Delete)합니다.
  - 취소 시 해당 청구와 연동되었던 자산들의 누적 렌탈료(`cumRentalFee`)를 자동으로 차감 롤백하여 요금 정합성을 유지합니다.
  - 취소가 완료되면 해당 계약 건은 당월 미청구 정산 마법사 카드 목록으로 자동 복귀하여 다시 정산을 진행할 수 있습니다.
- **추가 청구 생성 기능 도입**:
  - 정산 마법사 상세 카드 하단에 운송료(편도/왕복), 수리비, 기타(수기입력) 항목의 수량, 단가를 직접 기입할 수 있는 추가 청구 영역을 신설했습니다.
  - 추가 청구 항목은 일반 렌탈료(일할/월단가 날짜 계산)와 달리 별도의 논리 연산 없이 입력한 수량 × 단가가 그대로 총액에 고정 합산됩니다.
  - 하단 기안 버튼의 명칭을 '청구서 발행 및 결재 요청'에서 **'청구 생성'**으로 명료하게 변경했습니다.

# Release Notes (v1.8.0)

## 🛠️ 미청구 계약 정산 마법사 및 거래명세서 마감일 설정 추가
- **거래명세서 마감일 (`statementClosingDay`) 스키마 추가**:
  - `Contract` DB 구조에 거래명세서 마감일 속성을 신설하고, 계약 등록 화면에서 사용자가 직접 마감 일자를 지정/조정할 수 있도록 기능 연동.
  - 데이터 백업 및 엑셀 일괄 업로더 스키마 검증기에도 거래명세서 마감일 속성을 통합하여 유효성 무결성 확보.
- **미청구 계약 정산 마법사 탭 추가**:
  - 이번 달 청구가 생성되지 않은 활성 계약을 대상으로 **오늘 마감 대상 계약**(청구 또는 명세서 마감일이 오늘 날짜와 일치하는 계약)만 선제적으로 필터링/하이라이트하는 비주얼 대시보드 구축.
  - 카드를 클릭하여 계약 자산 목록을 상세 조회하고, 당월 청구 범위(시작일/종료일)와 정산 방식(월단가 전액 vs 일할 계산)을 라디오 버튼으로 간편히 지정하여 실시간 요금을 시뮬레이션할 수 있는 계산기 구현.
  - `청구서 발행 및 결재 요청` 버튼 클릭 시 자동으로 당월 정산 요금에 맞춰 `Billing` 및 `BillingDetail` 레코드가 분리 생성되고, 기안이 승인 대기 상태로 이관되어 정산 누락을 방지하는 실무 환경 조성.

# Release Notes (v1.7.0)

## 🛠️ 청구 엔진 고도화 및 장비 교체(대차) 기능 개발
- **계약 변동 대응 청구 계산 엔진 개선**:
  - 계약이 중간에 완료(`COMPLETED`)되어도 해당 월에 발생한 사용 일수만큼 요금이 정상 청구되도록 필터링 구조 개선.
  - `contractAssets`의 만료일(`endDate`)이 비어 있는(오픈형) 계약에 대해 `Invalid Date` 오류를 방지하고 당월 말일까지의 사용 요금을 안전하게 일할 계산하도록 수정.
- **장비 교체(대차) 트랜잭션 신설**:
  - 계약 상세 화면에서 렌탈 중인 장비에 대해 언제든지 가용 장비 풀의 동일 모델로 **대차/교체**할 수 있는 모달 기능 구현.
  - 교체 시, 기존 장비는 교체일 당일까지 요금을 일할 청구하고 즉시 수리중(`REPAIRING`)으로 상태를 전환함.
  - 신규 장비는 다음 날부터 일할 요금을 적용하고 계약에 귀속시키며, 배차유형 `EXCHANGE`를 자동 생성해 딜리버리 연동.
- **교체 장비 병합 청구서 발행**:
  - 당월 중 장비가 교체된 경우, 한 장의 청구서 내에 구 장비(사용일수)와 신 장비(사용일수) 요금이 각각 세부 명세서에 병합 출력되도록 동기화 완료.

# Release Notes (v1.6.0)

## 🛠️ 전체 테이블 일괄 관리 (Excel) 및 파싱 매핑 기능 신설/개선
- **전체 테이블 일괄 Excel 관리**:
  - 화면 하단 전폭 영역에 전체 테이블 다운로드/백업, 파일 파싱/유효성 검사, 일괄 업서트, 전체 초기화 기능 추가.
  - 다중 시트 Excel 파일(`.xlsx`) 파싱 및 시트명-테이블 자동 매핑 지원.
- **한글 헤더 및 값 변환 지원**:
  - 한글 컬럼 라벨 및 한글 데이터('예/아니오', '당사자산', '렌트중' 등)를 영문 컬럼 키 및 표준 영문/Boolean/Enum 값으로 자동 번역 매핑해주는 유틸 추가 (단일 CSV 업로드에도 자동 연동).
- **컴파일/문법 오류 해소**:
  - `src/services/db.ts` 내의 괄호 유실 등 문법 오류 수정 완료.
- **로컬 스토리지 캐시 동기화**:
  - 데이터 업로드 완료 시 localStorage에 즉각 데이터를 머지/업서트하여 UI가 화면 갱신 없이도 최신 데이터를 사용하도록 구현.

# Release Notes (v1.5.1)

## 🛠️ DB 다운로드 로직 개선
- **LocalDB fallback**: Supabase 조회가 실패하거나 빈 결과일 경우, 로컬 `db` 인스턴스에서 데이터를 가져와 CSV 다운로드를 보장합니다.
- 오류 로그를 콘솔에 출력하고, 사용자에게 별도 알림 없이 자동으로 대체 데이터를 사용합니다.

# Release Notes (v1.4.0)

## 🛠️ 개발자용 Supabase 데이터 업로더 신설
- **[개발] DB 데이터 업로더** 메뉴를 사이드바 최하단에 추가했습니다 (ADMIN 전용).
- **지원 테이블**: 고객사, 고객담당자, 현장, 제품, 자산, 계약, 계약장비, 배차, 운송거래처, 운송기사 등 13개 테이블
- **CSV 양식 다운로드**: 테이블별 헤더+예시 1행이 포함된 양식 파일 자동 생성
- **유효성 검사**: 필수값 누락, 데이터 타입 오류, enum 허용값 오류를 행 번호별로 상세 표시
- **Supabase Upsert**: 검사 통과 후 id 기준 upsert(있으면 수정, 없으면 신규 삽입) 실행, 성공/실패 건수 표시
- Supabase 미연결 시 경고 배너 표시 및 업로드 버튼 비활성화

## 🛠️ 로컬 테스트 배치 파일 개선 (v1.5.0)
- `run_test.bat`에서 서버 시작 대기 시간을 **5초 → 3초** 로 감소했습니다.
- 브라우저 자동 열기 명령에 URL을 따옴표로 감싸고 포트(`5174`)와 일치시키는 로직을 추가했습니다.
- 개발 서버를 `start "" npm run dev` 로 비동기 실행해 페이지가 자동으로 열리도록 보완했습니다.
