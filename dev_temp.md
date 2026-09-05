# 개발 요구사항 임시 기록 (dev_temp.md)

## [완료] 자산관리 대장 횡 스크롤 뷰포트 하단(요약 바 상단) 영구 고정 및 페이지 오버플로우 차단 (Build.177)
- **요구사항**:
  "자산관리 메뉴의 횡 스크롤을 이위치에 고정으로 두면 아주 좋겠는데. 개편하고 ㄹㅇ"
- **조치 내역**:
  1. **페이지 오버플로우 원천 차단 (`height: 'calc(100dvh - 85px)'`, `overflow: 'hidden'`)**:
     - `<main>`의 `overflow-y: auto`로 인해 미세 수직 오버플로우 발생 시 테이블 하단 횡 스크롤바가 화면 아래로 밀려나던 결함 근본 해결.
     - `Assets.tsx` 루트 컨테이너를 뷰포트에 정밀 클램핑하여 `<main>`의 스크롤을 0px로 고정.
  2. **18px 횡 스크롤바 요약 바 상단 영구 고정 (Fixed)**:
     - 1,272개 행이 내부에서 스크롤되더라도 횡 스크롤바는 언제나 현재 시야(하단 요약 바 바로 위)에 고정되어 즉시 조작 가능.
     - 테이블 래퍼에 `className="table-wrapper"`, `overflowX: 'scroll'`, `overflowY: 'auto'`, `minHeight: 0` 부여.
  3. **하단 요약 바 시각적 계층 강화 (`zIndex: 15`, `boxShadow: '0 -2px 6px rgba(0,0,0,0.08)'`)**:
     - 횡 스크롤바와 하단 요약 바 간의 시각적 경계감 확보.
  4. **빌드 무결성 검증**:
     - `cmd /c "npm run build"` 0 Error 무결점 통과 (`✓ built in 897ms`).

## [완료] 자산 취득·매각 도메인 및 워크벤치 스튜디오 전면 재편 & 계약·청구 유형 정규화 (Build.176)
- **요구사항**:
  "자산 취득 메뉴는 새 자산을 등록하는 기능이고, 자산 매각은 운영하던 자산을 매각 처분하는 기능이고, 이 두메뉴는 과거 취득이력, 매각이력을 조회할 필요가 전혀 없어. 자산관리 메뉴에 모두 나오잖아. 새 자산을 등록하는 업무에서의 목적과 편리함에 기준을 두어 기능 재편, 매각기능도 운영하던 자산을 매각처분하는 업무를 편리하게 하도록 메뉴 재편. 자산 매각은 여기에서 청구서도 만들고, 청구서 이메일도 보낼수 있어야 해. 렌탈계약이 아니고 매각계약을 만들 수 있어야 해. 근본적으로 계약의 유형이 새롭게 생겨나는것이네. DB 스키마에 영향이 발생하나? 렌탈계약 체결에도 계약의 유형으로써 영향이 발생하겠네. 연관해서 종합검토. 필요한 서브에이전트 전부 투입"
- **조치 내역**:
  1. **4대 전문 서브에이전트 합동 분석 및 감사 보고 완결**:
     - UI/UX 실무 편익 설계관, 렌탈·자산 PM, ERP 회계·세무 감사관, DB 아키텍트 전원 일치된 아키텍처 수립 및 `청구서_통합_아키텍처_및_실무편익_심층설계서.md` 및 `implementation_plan.md` 수립.
  2. **과거 단순 이력 조회 목록 100% 철거 (Zero-History Policy)**:
     - 26개 풀 컬럼 대장(`Assets.tsx`)과의 중복을 전면 제거하고, 업무의 본질에 충실한 순수 실행 워크벤치 스튜디오로 전면 재편.
  3. **[자산 취득 스튜디오] 구축 (`AssetAcquisitionDisposal.tsx` 탭 1)**:
     - 단건 등록 워크벤치: 모델 선택 시 제원 자동 상속, `KL-XXXX` 자동 추천 채번, IFRS 감가상각 시뮬레이터, 동일 모델 N대 일괄 등록 슬롯 완비.
     - 엑셀 일괄 등록 워크벤치: 템플릿 다운로드 및 드래그 앤 드롭 업로드 파이프라인.
     - 취득 완료 즉시 `AVAILABLE` 자동 입고 및 `assetInOutLogs`에 `ACQUISITION` 이벤트 영구 보존.
  4. **[자산 매각 스튜디오] 좌우 50:50 분할 워크벤치 구축 (`AssetAcquisitionDisposal.tsx` 탭 2)**:
     - 좌측 (50%): `AVAILABLE`(임대가능) 유휴 장비만 선택 가능한 바구니 (대여중 장비 오매각 원천 방어, 노후순/취득일순/장부가순 정렬, 취득가/감가누계/장부가 실시간 바구니).
     - 우측 (50%): 매수처(기존/신규) 지정, 자산별 매각단가 입력, 실시간 처분손익(🟢/🔴) 피드백, 매각 계약서/청구서 서식 실시간 듀얼 탭 미리보기, 이메일 발송 설정.
     - 우하단: `[매각 계약 체결 & 청구서 발행 & 이메일 전송]` 원클릭으로 5단계 논스톱 완결.
     - 최하단: Gutenberg Z-패턴 대차대조 항등식 검증 바 (`📄 매각총액 = 📉 장부가액 + 🟢 처분손익 | ⚖️ 대차 차액 ₩0`).
  5. **계약 유형(`contractType`) 및 청구 유형(`billingType`) 정규화 & 4중 격리 가드**:
     - `Contract.contractType: 'RENTAL' | 'SALE'`, `Billing.billingType: 'RENTAL' | 'REPAIR' | 'TRANSPORT' | 'ASSET_SALE'`.
     - `ContractAsset.salePrice` 및 `ContractHistory.changeType: 'ASSET_SOLD'` 영구 보존.
     - 월 정기 렌탈 청구 엔진, 소급 청구 엔진, 배차 파이프라인에서 매각 계약(`contractType === 'SALE'`) 100% 원천 배제.
  6. **계약 관리 대장(`Contracts.tsx`) 매각 계약 탭 및 전용 뷰 연동**:
     - 상단 계약 유형 탭(`[렌탈 계약]`, `[매각 계약]`, `[전체]`) 신설, 매각 계약 건 `[매각]` 퍼플 배지 및 매각액 표출.
     - 매각 계약 체결 자산 테이블에서 매각 공급가, 부가세 10%, 합계금액 전용 렌더링 및 계약 변경 모달 진입 안전 차단.
  7. **회계 정합성 복원 및 IFRS 엔진 결함 해소**:
     - `BankMatching.tsx`: 이메일 발송된 청구서(`b.status === 'REQUESTED'`) 수납 대사 누락 결함 수정.
     - `db.ts`: `calculateAssetDepreciation` 과거 결산일 조회 시 매각 자산 장부가액 조기 상각 결함 수정.
  8. **빌드 무결성 검증**:
     - `cmd /c "npm run build"` 0 Error 무결점 통과.
     - 헌장 8.3에 따라 `D:/01.AntiGravity/000.skelton/경험/2026-09_자산취득매각_도메인_스튜디오_재편.md` 기록 및 push 완료.

## [완료] 자산관리 대장 26개 풀 컬럼 횡 스크롤(Sticky 고정) 및 소유원사·구입처 도메인 논리 분리 (Build.175)
- **요구사항**:
  "자산관리 메뉴에서 자산테이블이 가지고 있는 정보가 굉장히 많아서 좌우 스크롤로 이동 해서라도, 자산의 정보를 모두 조회할수 있어야 함. 그리고 당사자산의 소유 원사(임차처)가 타회사인게 논리적으로 오류임. 초기DB 업로드 단계에서 자산을 등재할 때, 논리적 오류가 있은것 같아. 검토"
- **조치 내역**:
  1. **소유 원사(임차처) vs 구입/공급처 도메인 개념 및 헬퍼 100% 분리**:
     - 원인 분석: 초기 DB 적재는 한국시노붐을 정상적인 구입처(`supplier`)로 저장했으나, 화면 헬퍼(`getAssetRenterName`)가 소유구분(`ownerType`)을 검사하지 않고 무조건 `vendorId`/`supplier`를 소유원사(임차처)로 리턴하여 왜곡 발생.
     - `getAssetRenterName`: `a.ownerType !== 'RENTED'`(당사자산)인 경우 **무조건 `'-'`**를 반환하여 소유원사 왜곡 원천 차단.
     - `getAssetSupplierName` 신설: `a.ownerType === 'OWNED'`(당사자산)일 때만 구입처(`한국시노붐`, `JLG` 등)를 정확히 반환.
     - 테이블 컬럼을 **`소유 원사 (임차처)`**와 **`구입/공급처`** 2개로 분리.
  2. **전사 자산 26개 풀 컬럼 광활한 횡 스크롤(minWidth 2400px) 구축**:
     - 테이블 `minWidth: '2400px'` 및 `overflow: auto`로 브라우저 폭에 구애받지 않고 시원한 가로 스크롤 제공.
     - 좌측 `[상세]` (50px) 및 `[관리번호]` (90px) 컬럼을 `sticky`로 영구 고정하여, 스크롤 이동 중에도 장비 식별 완벽 보장.
     - 26개 컬럼: 상세, 관리번호, 모델명, 규격(피트), 제조사, S/N, 연식, 소유, 상태, 현재 고객사, 현장, 계약번호, 계약기간, 청구일, 월 렌탈료, 소유 원사, 구입/공급처, 취득/개시일, 취득원가, 감가누계액, 장부가치, 누적수익, 누적수리비, 기여순익, 정비점수, 비고.
  3. **엑셀 내보내기 및 상세 서랍 동기화**:
     - 26개 컬럼과 1:1로 일치하도록 `handleExport` 동기화 및 상세 서랍 구입처 명확화.
  4. **빌드 무결성 검증**:
     - `cmd /c "npm run build"` 0 Error 무결점 통과 (`✓ built in 908ms`).

## [완료] 제품 모델 상세 [제원표 그래픽] 및 [수정] 버튼 위치 재배치 (Build.174)
- **요구사항**:
  "제품관리 의 제품상세 에서 두개의 버튼 위치를 표시한 위치로 이동배치"
- **조치 내역**:
  1. **서랍 상단 헤더 버튼 제거**:
     - 상단 헤더 우측의 `[제원표 그래픽]` 및 `[수정]` 버튼을 상단 헤더에서 제거하고, 모델명/사용배지와 닫기(`X`) 버튼만 깔끔하게 보존.
  2. **`3. 상세 물리 제원 규격` 섹션 헤더 우측으로 이동 배치**:
     - `3. 상세 물리 제원 규격` 섹션 헤더를 Flex (`justify-content: space-between`) 구조로 변경.
     - 섹션 헤더 우측에 `[제원표 그래픽]`과 `[수정]` 버튼을 배치.
     - 편집 모드 시 `[저장]`과 `[취소]` 버튼 역시 동일한 위치에 깔끔하게 연동.
  3. **빌드 무결성 검증**:
     - `cmd /c "npm run build"` 0 Error 무결점 통과 (`✓ built in 905ms`).

## [완료] 외상미수금 대장(Receivables) UI 슬림 개편 및 날짜 기본값·빠른기간 칩 탑재 (Build.173)
- **요구사항**:
  "UI 개편. 기본틀(집계영역, 필터영역이 너무 크고, 중복된 개념들이 산재해서 표시되고 있어. 날짜 등의 필터는 기본값이 있으면 좋겠고."
- **조치 내역**:
  1. **거대 카드 4개 철거 및 상단 슬림 인라인 요약 뱃지 압축**:
     - 상단 거대 카드 4개(`조회 건수`, `외상 총액`, `기청구액`, `미청구 잔액`)가 세로 ~140px을 차지하고 하단 대차대조 바와 수치가 중복되던 문제 해결.
     - 타이틀 우측에 인라인 뱃지(`조회 N건`, `외상총액 ₩XXX`, `기청구 ₩XXX`, `미청구 ₩XXX`)로 고밀도 압축 배치.
  2. **날짜 필터 기본값 자동 설정 및 빠른 기간 선택 칩 탑재**:
     - 시작일을 당해 연도 1월 1일(`YYYY-01-01`), 종료일을 오늘(`YYYY-MM-DD`)로 기본 세팅.
     - 빠른 기간 선택 칩(`[당월]`, `[3개월]`, `[올해]`, `[전체]`) 신설 및 필터 초기화 시 당해 연도 기본값 복원.
  3. **고밀도 1행 컴팩트 필터 툴바화 (헌장 3.4 상하 스택 유지)**:
     - 2줄로 분산되어 있던 검색창과 세부 필터를 가로 1행 슬림 툴바로 통합.
     - 레이블-입력 상하 세로 스택(`flex-direction: column`, `gap: 3px`) 유지.
  4. **화면 세로 작업대 80~85% 확보 (헌장 3.6 유형 B 고밀도 대사 그리드)**:
     - 상단 헤더+필터 세로 높이를 ~240px에서 **~75px로 70% 축소**.
     - 테이블 `maxHeight: 'calc(100vh - 250px)'`로 작업대 극대화.
  5. **헌장 3.1 무수식어 건조 UI 준수**:
     - 감성적 부제목("렌탈료 외 부대비용...") 전면 배제.
  6. **빌드 무결성 검증**:
     - `cmd /c "npm run build"` 0 Error 무결점 통과 (`✓ built in 910ms`).

## [완료] 청구서 통합 좌우 52:48 2분할 워크벤치 스튜디오 구축 및 A4 11행 실시간 싱크 거래명세서 완비 (Build.172)
- **요구사항**:
  "청구서 통합 메뉴 관련, 메뉴의 본질목적과 사용자 편의성, 완전성과 정확성 통합된 청구서의 청구서번호 관리는 어떻게 되는가, 수리비/운반비 등 기타청구를 별도생성 했을경우, 렌탈료 청구서와 별도 추가로 청구서를 만들었을 때, 청구를 통합하려면 어떻게 작동해야 하는가, 모든 서브에이전트들 투입하여 심층설계. PM과 감사가 협의하여 설계안 승인. 글로벌 정책 준수. UIUX 가 상당히 복잡해질수도 있으니 주의요함. 실무자가 UI조작을 편리하게 할수 있도록 세심히 배려할 필요있음"
- **조치 내역**:
  1. **회계 감사관, 렌탈 PM, UI/UX 설계관 3대 전문 서브에이전트 투입 및 심층설계서 확립**:
     - `청구서_통합_아키텍처_및_실무편익_심층설계서.md` 아티팩트 작성 및 회계·도메인·UI 표준 승인 완료.
  2. **핵심 회계 엔진 보강 (`src/services/invoiceEngine.ts`)**:
     - 공급가액 10% 부가세(`vatAmount = Math.floor(totalAmount * 0.1)`) 자동 계산 누락 버그 해결 및 `grandTotal` 정합성 완비.
     - 수납 발생 건(`paidAmount > 0`) 통합 취소 차단 안전 가드 탑재.
     - `consolidateSelectedBillings` 함수 신설 (선택된 복수 청구서를 단일 `BillingInvoice`로 즉시 묶음 저장).
  3. **[좌우 52:48 2분할 워크벤치 스튜디오] 구축 (`src/components/BillingInvoiceTab.tsx`)**:
     - **좌측 (52%)**: 미통합 청구서 바구니 (품목 필터 `[전체/렌탈/수리/운반]`, `⚠️ 미청구 부가비용 감지 [동반 선택]` 원클릭 배너, 고밀도 체크리스트 테이블).
     - **우측 (48%)**: 통합 인보이스 작업대 & **공식 거래명세서 A4 11행 실시간 싱크 캔버스** (선택 즉시 실시간 렌더링).
     - **하단 고정 바**: Gutenberg Z-패턴 대차대조 검증 바 (`총 청구액 = 공급가 + 부가세 | 대차 차액 ₩0`) & 무팝업 3-클릭 완결 버튼군 (`[A4 명세서 인쇄]`, `[엑셀 다운로드]`, `[통합 인보이스 발행]`).
     - **발행 이력 대장 (HISTORY)**: 기발행 목록 조회, 원본 청구서 상세 분해, 안전가드 기반 원천 복원 `[통합취소]`.
  4. **빌드 무결성 검증**:
     - `cmd /c "npm run build"` 0 Error 무결점 통과.

## [완료] 과거 소급 청구 생성 1계약-다수자산 중복 발행 결함 해결 및 계약이력 무누락 연동 (Build.171)
- **요구사항**:
  "초기DB 업로드 메뉴에서 과거청구 소급 생성 했을 때, 표시된것처럼 왜 같은 월에 청구가 다수 발생하지 계약 된 자산수량만큼 청구생성되는건가? 오류같은데, 논리적으로 왜이렇게 오류인지 설명하고 원인제거, 또한 계약이력에 청구 생성한 이력이 안만들어졌음."
- **원인 분석**:
  1. **동일 월 동일 계약에 자산 수량(4대)만큼 청구서(Billing)가 4건으로 파편화된 원인**:
     - 엑셀 일괄 적재 파이프라인(`parseContractsDeliveriesExcel`)이 엑셀의 각 행(장비 1대)을 순회하는 내부 루프 안에서 매 행마다 독립적으로 `billings.push(...)`를 호출하여 개별 `BILL-HIST-NNNNNN`을 발급했기 때문.
     - ERP 정규화 표준은 **1계약 1월 = 단 1건의 청구서(Billing)**이며, 체결된 N대의 자산별 렌탈료는 **청구 상세(BillingDetail) N건**으로 하위 매핑되어야 함.
  2. **계약 이력(contractHistory)에 청구 생성 이력이 누락된 원인**:
     - 소급 청구 생성 로직(`parseContractsDeliveriesExcel` 및 `generateAndIngestHistoricalBillingsDirect`) 모두 `billings`와 `billingDetails`만 적재하고, `contractHistory` 테이블에는 `changeType: 'BILLING_CREATED'` 레코드를 단 한 줄도 생성/적재하지 않았기 때문.
- **조치 내역**:
  1. **`src/services/migrationEngine.ts` 내 엑셀 소급 청구 생성 파이프라인 근본 개편**:
     - 엑셀 행 루프 내부에서 개별 청구서를 발행하던 결함 코드 전면 제거.
     - 엑셀 행 파싱 완료 후 정규화된 `contracts` 목록을 기반으로 계약별 체결 자산(`caList`)을 집계하여, 계약당 월 1건의 단일 청구서(`Billing`, 총액 합산) + 자산별 청구 상세(`BillingDetail`) 1:1 품목 매핑으로 정규화.
     - 계약의 `contractHistories`에 `changeType: 'BILLING_CREATED'` 이력을 1:1 무누락 생성하여 함께 적재.
     - 최초개시일(Col[3])을 계약(`_firstStartDate`) 및 체결자산(`firstStartDate`)에 온전히 보존하여 정확한 소급 시작월부터 가동일수를 일할 계산하도록 정밀화.
  2. **`generateAndIngestHistoricalBillingsDirect` (독립 소급 청구 생성 함수) 클린업 및 이력 연동**:
     - **기존 파편화 청구 데이터 사전 클린업**: 기존에 잘못 쪼개져 적재되었던 `BILL-HIST-` 청구서, 관련 `billing_details`, 소급 계약이력을 안전하게 일괄 삭제한 후 정규화 데이터로 교체 적재.
     - 계약 단위 단일 `Billing` + 자산별 `BillingDetail` + 계약별 `contractHistory` (`changeType: 'BILLING_CREATED'`) 3개 테이블을 동기 청킹 적재(`batchUpsertChunked`).
  3. **계약 상세 화면 (`Contracts.tsx`) 타임라인 시각화 보강**:
     - `activeTimeline` 타임라인에서 `h.changeType === 'BILLING_CREATED'` 이력을 감지하여 `🧾 정기 청구 발행` 타이틀과 상세 설명(`[소급 청구] 2026-03 정기 렌탈료 청구서 발행 (4대, ₩1,120,000원)`)이 계약 흐름에 정교하게 렌더링되도록 구현.
  4. **무결성 검증**:
     - 노드 검증 스크린샷 시뮬레이션: 1계약 4자산 체결 시 2개월 소급 청구 결과 단 2건의 청구서(각 1,120,000원) + 8건의 상세 + 2건의 계약이력 생성 완벽 검증 (100% PASS).
     - `cmd /c "npm run build"` 0 Error 무결점 통과.

- **요구사항**:
  "계약조회 에서 필터 변경 후 다시 조회할 "조회" 버튼이 없음. 표시 위치에 조회 버튼 추가."
- **조치 내역**:
  1. **계약 관리 (`Contracts.tsx`) 필터 패널 내 [조회] 버튼 신설**:
     - 사용자 스크린샷 지정 위치(`계약 종료일 (이전)` 우측)에 `btn-primary` 스타일의 `[🔍 조회]` 버튼 배치.
     - 상하 스택 레이아웃(헌장 3.4) 및 다른 필터 입력창들과 1픽셀 오차 없는 수평/수직 정렬 보장.
     - 클릭 시 `refreshAllData()` 동기 호출을 통한 서버/DB 최신 데이터 재동기화 및 필터링 즉각 재평가, 조회 완료 토스트 표출.
  2. **통합 검색 및 날짜 입력창 Enter 키 조회 연동**:
     - 상단 통합 검색창, 시작일, 종료일 입력창에서 `Enter` 입력 시 `[조회]`가 즉각 실행되도록 키보드 이벤트 핸들러 바인딩.
  3. **계약 시작일/종료일 다차원 필터링 정밀화**:
     - `matchesStartDate` (`c.startDate >= startDateFilter`) 및 `matchesEndDate` (`c.endDate <= endDateFilter`) 조건식 정밀화로 단일 날짜 입력 시에도 의도대로 정확한 필터링 작동 보장.
     - 필터 초기화 시 완전 공백 초기화 연동.
  4. **빌드 무결성 검증**:
     - `cmd /c "npm run build"` 0 Error 무결점 통과 (`✓ built in 918ms`).

## [완료] 법인차량 운행일지 및 주유영수증 관리 시스템 신설 (Build.169)
- **요구사항**:
  "법인이 관리하는 모든 차량에 대한 차량운행일지 메뉴를 경영관리 하위에 신설. PC 메뉴와 핸드폰메뉴 각각 필요. PC 메뉴는 관리부에서 전사 차량에 대한 운행기록 관리를 하는 메뉴이고, 핸드폰 메뉴는 계기판 사진을 찍어서 첨부하고,주유영수증도 사진을 찍어서 첨부. 주유 시점마다 유종, 주유용량(리터), 주유금액, 계기판 주행거리 기록. 법인차량 운행자 모두에게 해당됨. 이 메뉴를 어떻게 설계하고 어디에 배치해야 할까 계획 수립 후 적용"
- **조치 내역**:
  1. **PC 경영관리 (`grp_management`) 하위 신규 메뉴 탑재**:
     - `menuConfig.ts` & `menu_config.ts`: `leave_ot` 바로 다음 순서에 `{ id: 'vehicle_log', name: '차량운행일지' }` 등록.
     - `App.tsx`: `Car` 아이콘 및 `VehicleOperationLogPage.tsx` 라우팅 연결.
  2. **PC 관리부 전사 마스터 스튜디오 (`src/pages/VehicleOperationLogPage.tsx`)**:
     - **탭 1: 운행일지 대장**: 연월/차량/상태/키워드 필터, 출발/도착 계기판 사진 팝업, 승인 상태 원클릭 토글, 국세청 법인세법 시행규칙 별지 제29호의2 서식 엑셀 다운로드(`handleExportNtsExcel`), 최하단 Gutenberg Z-패턴 대차대조식 바(총 운행거리 = 업무용 + 출퇴근용 | 업무사용비율 100%).
     - **탭 2: 주유 영수증 대장**: 주유일시, 차량, 운행자, 유종, 주유량(L), 금액(₩), 리터당 단가, 계기판 거리, 계산연비(km/L), 계기판/영수증 사진 확대 팝업, 엑셀 다운로드, 최하단 증빙율 집계 바(주유금액 = 법인카드 + 개인경비 | 영수증 증빙율 100%).
     - **탭 3: 법인 차량 관리**: 4대 핵심 KPI(총 등록차량, 정상운행, 검사도래, 당월총주행), 차량 등록/수정 모달(상하 스택 레이아웃 헌장 3.4), 삭제 모달.
  3. **모바일 전사 운행자 전용 앱 (`src/mobile/pages/MobileVehicleLog.tsx`)**:
     - **탭 1: 주유 영수증**: 차량 선택, 유종 칩(휘발유, 경유, 고급휘발유, LPG, 전기), 주유 시 계기판 km, 주유량 L, 금액 ₩, 주유소명, 결제수단 칩, `CameraUploader` 연동(계기판 사진 & 영수증 사진), 52px 원터치 저장 버튼.
     - **탭 2: 운행일지 작성**: 차량 선택, 목적 칩(현장AS, 고객미팅, 장비회수/납품, 은행/관공서, 출퇴근, 일반업무), 출발지/도착지, 출발 계기판/도착 계기판 ➔ 주행거리 및 업무거리 자동 계산, 계기판 사진 촬영, 52px 원터치 저장 버튼.
     - **탭 3: 내 운행/주유 내역**: 최근 작성된 운행/주유 타임라인 카드 및 사진 확대 팝업.
  4. **모바일 네비게이션 전사 원터치 연동**:
     - 상단 헤더(`MobileHeader.tsx`): `[🚗 차량일지]` 퀵버튼을 탑바에 상시 노출하여 어떤 모바일 화면에서도 1초 접근 가능.
     - 홈 화면 카드 피드(`MobileHome.tsx`): 영업, 출고, AS 모든 직무 섹션에 `[🚗 차량운행일지 / 주유영수증]` 배너 배치.
     - 관리자/임원 홈(`MobileAdminHome.tsx`, `MobileExecutiveHome.tsx`): 피드 최하단에 차량운행일지 카드 탑재.
     - 하단 네비게이션(`MobileBottomNav.tsx`): 관리자 모드 `ADMIN` navItems에 `vehicle_log` 배치.
     - 라우팅(`MobileApp.tsx`): `activeTab === 'vehicle_log'` 시 `MobileVehicleLog` 렌더링.
  5. **DB 스키마 및 클라이언트 코어 엔진 완비**:
     - 3대 신규 테이블 DDL 추가: `corporate_vehicles`, `vehicle_operation_logs`, `vehicle_fuel_logs` (`schema.sql` 및 `scripts/patch_v1_4_0_schema_deficiencies.sql`).
     - `src/services/db.ts`: 모델 인터페이스, 시드 데이터, `ALL_DB_KEYS`, getters/setters, `mapToSupabaseTable`, `generateNextId` 완비.
     - `src/context/AppContext.tsx`: 상태 관리, 8대 비즈니스 뮤테이터(주행거리 자동 갱신 및 직전 주유 대비 연비 자동 계산 로직 내장) 구현.
  6. **빌드 무결성 검증**:
     - `cmd /c "npm run build"` (`tsc -b && vite build`) 0 Error 무결점 통과 (`✓ built in 896ms`).

## [완료] 현장 AS '현장명 + 현장상세주소' 공존 표준화 및 AS팀 최대 편익 6대 기능 개편 (Build.168)
- **요구사항**:
  "현장 AS 를 로딩할 때, 현장명 대신에 현장 상세주소를 업로드 하라고 지시했는데, 현장상세주소를 업로드 하는것이 맞는지 확인. 현장 AS 테이블에는 현장명과 현장 상세주소를 모두 갖고있지 않다는 뜻이야? 그렇다면 스키마, UI 모두 개편하고, 현장명과 현장상세주소를 모두 표시하도록 개편. 그외에 AS팀이 업무를 편하게 하기 위해 더 조치해줄것이 있는지 함께 검토"
- **조치 내역**:
  1. **현장명 vs 현장상세주소 공존 표준 원칙 확립**:
     - 현장명(Site Name)과 현장상세주소(Site Address)는 양자택일이 아니며, 인지/소통(현장명)과 길안내/출동(도로명 상세주소)을 위해 1:1로 반드시 공존해야 함을 확립.
  2. **PC 대장 테이블 (`FieldAsManagement.tsx` LEDGER 탭)**:
     - `현장명` 컬럼 옆에 `현장 상세주소 (도로명)` 독립 컬럼 신설 (헌장 3.2 `white-space: nowrap` 준수).
     - 셀 내부: 도로명 주소 표기 + [📋 복사] 및 [📍 TMap] 원클릭 단축 버튼 탑재.
  3. **PC 스튜디오 카드 피드 (`FieldAsManagement.tsx` STUDIO 탭)**:
     - 좌측 AS 카드에 `🏢 {t.siteName}`과 함께 `📍 {cardResolvedAddress}` 상시 시각화 노출.
  4. **엑셀 입출력 양식 일원화**:
     - `FieldAsManagement.tsx` 엑셀 내보내기 시 `현장명` 바로 옆에 `현장상세주소` 컬럼 추가.
  5. **신규 AS 접수 모달 원터치 자동 추적**:
     - 관리번호(`newAssetNo`) 입력 시 활성 계약, 고객사, 현장 마스터를 역추적하여 고객사/현장명/도로명주소 100% 원터치 자동완성 (`handleAutoLookupByAssetNo`).
     - `[📍 마스터 주소 자동적용]` 버튼 탑재.
  6. **데이터 적재 파이프라인 무누락 연동 (`InitialDbUploader.tsx`, `migrationEngine.ts`)**:
     - 밴드 AS 파서에서 `주소:`/`상세주소:` 키워드 추출 및 `matchedSiteAddress` 자동 채번.
     - 밴드 이력 DB 적재 시 `siteAddress` 무누락 영구 저장.
     - 밴드 분석 프리뷰 테이블에 고객사/현장명/상세주소 3단 노출.
  7. **빌드 무결성 검증**:
     - `cmd /c "npm run build"` 0 Error 무결점 통과.

## [완료] 전사 메뉴 사용 예정 DB 스키마 결손 전수 색출 및 통합 DDL 패치 (Build.167)
- **요구사항**:
  "모든 메뉴가 사용하기로 예정된 DB 스키마의 부족분을 색출해서 DDL 패치 수행해"
- **조치 내역**:
  1. **전사 47개 컬렉션 / 63개 테이블 1:1 교차 대조 감사**:
     - 프론트엔드 전체 페이지(`src/pages/`, `src/mobile/`), TypeScript 인터페이스(`src/services/db.ts`), DDL 원본(`schema.sql`), Supabase 원격 DB 간 전수 대조.
     - 결손 테이블 6종 및 20개 테이블의 72개 결손 컬럼 실증 색출.
  2. **누락 테이블 6종 신설 및 정합성 보장**:
     - `legal_notice_logs`, `legal_notice_templates`, `external_leases`, `consumable_purchases`, `bank_initial_balances`, `asset_inout_logs`
  3. **20개 테이블 72개 결손 컬럼 및 CHECK 제약조건 보강**:
     - `users`, `customers`, `customer_contacts`, `customer_sites`, `assets`, `consumables`, `consumable_logs`, `contracts`, `contract_assets`, `deliveries`, `billings`, `annual_leave_quotas`, `overtime_records`, `payroll_closings`, `repairs`, `bank_transactions`, `google_configs`, `outbound_inspections`, `purchase_settlements`, `prepaid_transactions`, `delinquency_action_logs`, `asset_inout_logs`
  4. **독립 실행형 통합 DDL 패치 스크립트 작성**:
     - `scripts/patch_v1_4_0_schema_deficiencies.sql` (100% 멱등성 보장, RLS 비활성화 및 정책 자동화 내장)
  5. **전사 Master SSOT `schema.sql` 최신화 동기화**:
     - 전사 표준 단일 원본(`schema.sql`)에 신규 테이블 6종 및 누락 컬럼/제약조건 100% 통합 반영 완료.
  6. **클라이언트 코어 DB 엔진 (`src/services/db.ts`) 하위 호환 가드 완비**:
     - 구/신버전 테이블명 자동 상호 폴백(`fetchAllRowsFromSupabase`, `insertRow`, `updateRow`, `deleteRow`, `normalizeKey`).
  7. **빌드 무결성 검증**:
     - `cmd /c "npm run build"` (`tsc -b && vite build`) 0 Error 무결점 빌드 완료 (`✓ built in 872ms`).

## [완료] 모바일-PC 전수 메뉴 1:1 대조 감사 및 전사 정합성 무결성 개편 (Build.166)
- **요구사항**:
  "핸드폰 모드에서 입력하는 모든 업무처리가 PC화면에서 처리하는 업무와 완벽히 동일하게 작용하는지 모든 메뉴별로 대조 검사. 모든 서브에이전트 투입. 검수명세서 작성. 감사가 심판하여 오류보고 적발할것. 글로벌 정책 적용"
- **조치 내역**:
  1. **전사 5대 전문 도메인 서브에이전트 동시 투입 및 전수 대조 심판**:
     - 영업·스마트발주·계약, 배차·물류·운송, 출고·입고·자산·전대, AS·정비·소모품, 채권·연체·재무 전 도메인 모바일(14개 화면) vs PC(16개 화면) 1:1 대조 완료.
     - 종합 명세서 `검수항목_모바일_PC_전수대조_명세서_및_결함심판_기록부.md` 작성 및 아티팩트 발행.
     - 총 20개 비즈니스 불일치 및 헌장 위반 결함 적발 후 전수 코드 개편 완료.
  2. **코어 비즈니스 로직 및 컨텍스트 (`AppContext.tsx`)**:
     - `returnRentedAsset`: 대여중(`status === 'RENTED'`) 자산 반납 시 에러를 throw하여 호출부 허위 성공 토스트 방지 (결함 9).
     - `createFieldAsTicket`: 모바일 현장 AS 접수 시 업로드된 현장 사진(`faultImageUrl`, `evidenceImages`, `beforeImage`)의 DB 누락 복구 (결함 13).
     - `saveLegalNoticeLog`: 비동기 대기 순서 정정 (`await db.awaitPendingWrites()` 선행 후 `refreshAllData()`) (결함 20).
  3. **도메인 1 (영업·발주·계약 - `MobileCustomerManage`, `MobileDispatchOrderCreate`, `MobileMyContracts`, `Contracts.tsx`)**:
     - `MobileCustomerManage.tsx`: 기본명세서마감일(`defaultStatementClosingDay: 25`), 업태(`bizType`), 종목(`bizItem`), 폐업여부(`isClosed: false`) 필드 모바일 등록/수정 모달에 완비 (결함 1).
     - `MobileDispatchOrderCreate.tsx`: 대차(EXCHANGE) 발주 시 기존 `ContractAsset` 종료(`status: 'RETURNED'`) 및 신규 교체 슬롯 자동 생성(단가 100% 상속, 헌장 2.2), 불필요 확인창 제거, 빈 객체 타입 버그 수정 (결함 2, 3).
     - `MobileMyContracts.tsx`: `BLOCKED` 거래처 `[출고제한]` 레드 배지 표출, 계약 상세에 월/일 렌탈료 단가 표출, `billingDay || 30` 기본값 보정, 클립보드 복사 알림창 인라인화 (결함 4).
     - `Contracts.tsx`: 계약 목록 및 상세에 `[출고제한]` 배지 표출, `handleSaveExtend` 시 `BLOCKED` 거래처 기간 연장 원천 차단 가드 (결함 19).
  4. **도메인 2 (배차·물류·운송 - `MobileDispatchList`, `TruckDispatch.tsx`)**:
     - `MobileDispatchList.tsx`: 기사 배정 시 기존 영업/현장 메모 보존, 운송사 필드 오기입(`vehicleType` 대신 `transportCompany`) 수정, 차량 JSON 배열 동기화, 배차완료(`DELIVERED`) 시 `completeDelivery` 및 `completeInboundDelivery` 실호출로 자산 반납/출고 이력(`assetInOutLogs`) 정규화, 브라우저 `alert()` 퇴출, `CANCELLED` 취소 탭 필터 추가, 무수식어 건조 UI 표준화 (결함 5, 6, 7, 8).
     - `TruckDispatch.tsx`: `handleSaveDispatch` 및 `handleSaveManualDispatch`에 `BLOCKED` 거래처 출고/교환 배차 원천 차단 가드 추가, 배차 카드 및 인스펙터 패널에 `[출고제한]` 배지 및 경고 배너 표출 (결함 18).
  5. **도메인 3 (출고·입고·자산·전대 - `MobileSubleaseManage`, `MobileAssetSearch`, `MobileInspectionList`)**:
     - `MobileSubleaseManage.tsx`: 고객사 현장 대여중(`status === 'RENTED'`)인 전대 장비의 원사 직접 반납 원천 차단 가드 및 반납 버튼 비활성화(`[현장 대여중 (회수 필요)]` 배지 표출) (결함 9).
     - `MobileAssetSearch.tsx`: 하드코딩 3항 연산자 제거하고 SSOT `getAssetStatusLabel(a.status)` 및 `ASSET_STATUS_SSOT` 전사 단일 표준 적용 (결함 10).
     - `MobileInspectionList.tsx`: 검수 완료 페이로드 및 `assetInOutLogs` 기록 시 `deliveryId: activeInspection.deliveryId` 무누락 영구 보존 (결함 11).
  6. **도메인 4 (AS·정비·소모품 - `MobileAsCreate`, `MobileAsDetail`, `Repairs.tsx`)**:
     - `MobileAsCreate.tsx`: 브라우저 `alert()` 전면 퇴출, 방문 예정일(`visitDate`, 기본 오늘) 입력 필드 추가 (결함 15).
     - `MobileAsDetail.tsx`: 정비 부품 소모 시 타 정비사 차량 재고가 노출 및 차감되던 fallback 버그 제거, 본인 탑차 재고만 엄격 격리 (결함 14).
     - `Repairs.tsx`: 워크벤치 및 정비 등록/보류/외주 파이프라인에 `billableType`('FREE'|'BILLABLE') 및 `billableAmount` 입력창과 페이로드 추가하여 모바일 AS와 100% 대칭 일치 (결함 16).
  7. **도메인 5 (채권·연체·재무 - `MobileExecutiveHome`, `MobileDelinquencyManage`, `DelinquencyPage.tsx`)**:
     - `MobileExecutiveHome.tsx`: 경영진 긴급 수금지시 시 대표이사 본인이 아닌 해당 고객사 계약 전담 영업사원(`activeContract.salespersonId`)에게 ToDo 발행, `directiveTargetUserId` 및 `directiveDueDate` 무누락 감사 대장 기록 (결함 17).
     - `MobileDelinquencyManage.tsx`: 출고제한(BLOCKED) 토글 권한 가드(`isExecutive`) 추가 (결함 20).
     - `DelinquencyPage.tsx`: 거래처 출고제한 토글 시 `delinquencyActionLogs` 영구 감사 이력 기록, 5개 핸들러의 `await db.awaitPendingWrites()` 선행 순서 정합성 완비 (결함 20).
  8. **빌드 무결성 검증**: `cmd /c "npm run build"` (`tsc -b && vite build`) 0 Error 무결점 빌드 통과.

## [완료] 무전기 자정 소거 정책 정립 및 UTC-KST 9시간 시차 송수신 차단 결함 해결 (Build.165)
- **요구사항**:
  "쌓이는 무전기 대화음성은 매일 자정에 소거되는거야? 자정 즈음에는 무전기 사용이 안되던데, 소거와 재사용 가능은 어떻게 작동되는건지 알려줘"
- **조치 내역**:
  1. **무전기 자정 소거 정책 확인 및 원리**:
     - 무전기 대화음성은 당일 휘발성 PTT 소통 채널로 브라우저 로컬 스토리지(`walkie_today_history`, 5MB 한도)에 당일분만 임시 보관.
     - 중앙 DB에는 개인 음성 파일을 영구 적재하지 않으며, Supabase Realtime을 통한 실시간 전파 후 매일 자정(00:00 KST)에 전일 대화 기록 자동 소거.
     - 당일 대화가 20건을 초과하면 최신 20건만 음성(Base64)을 유지하고 나머지는 텍스트 자막만 남겨 브라우저 부하 방지.
  2. **자정 즈음 무전기 불통 버그 원인 규명 및 해결**:
     - 원인: 메시지 생성 시 UTC 기준(`toISOString()`, KST 대비 -9시간)으로 날짜가 기록되나, 소거 가드 `getTodayDateStr()`은 한국시간(KST)을 기준으로 판단.
     - 이로 인해 자정(00:00 KST)부터 아침 09:00 KST까지 9시간 동안 생성된 모든 메시지가 "어제 메시지"로 오판되어 로컬 피드 추가가 무음 드롭(`m.createdAt?.slice(0, 10) !== today`)되는 치명적 타임존 버그 발생.
     - 해결: `getLocalDateStr(dateStr)` 헬퍼를 신설하여 ISO UTC 문자열을 사용자의 로컬 타임존(KST)으로 변환 후 오늘 날짜와 일치 여부를 검증하도록 `constructor`, `purgeOldHistoryIfNeeded()`, `addHistory()` 4개 위치 전면 수정.
     - 결과: 자정 소거 직후 새벽 00:01분부터 24시간 언제든 정상 송수신 및 화면 피드 표출 완벽 보장.

## [완료] PC 모드 오류개편 사항에 대한 전수 재검토 및 완결성 보강 개편 (Build.164)
- **요구사항**:
  "PC 모드 오류개편 사항에 대한 전수 재검토 수행. 완결성 확인"
- **조치 내역**:
  1. **5대 전문 도메인 서브에이전트 재투입 심층 감사 결과 21개 결함/개선사항 도출 및 전수 개편**:
     - **코어 컨텍스트 (`AppContext.tsx`)**:
       - `completeInboundDelivery`: `EXCHANGE` 배차 완료 시 계약이 임의로 `COMPLETED`로 종료되거나 전체 자산이 반납 처리되는 오류 수정 (계약 `ACTIVE` 보존, 회수 장비만 `RETURNED`, 일반 회수 시 잔여 체결 자산 없을 때만 계약 종료).
       - `unmatchTransaction`: `paymentDepositLinks` 1:N 양방향 연결 체계 완전 롤백(연결된 PDL 삭제, 수납 전표 및 Billing 잔액 정밀 롤백, 수납 상태 `UNPAID`/`PARTIAL` 복구, 고객 선수금 원복) 구현.
       - `executeMatch`: 수납 전표 생성 시 `PaymentDepositLink`를 동시 발행하여 실시간 링크 정합성 보장.
       - `createContract`, `completeDelivery`, `approveBilling`, `cancelBilling`: `await db.awaitPendingWrites()` 동기 대기 추가 및 비동기 인터페이스 규격화 (헌장 5.2).
       - `completeDelivery`: 출고 검수 승인 완료 건에 대한 `assetInOutLogs`(`OUTBOUND`) 중복 생성 방어 가드 추가.
       - `succeedContract`: 인수 고객사의 `transactionStatus === 'BLOCKED'` 시 계약 승계 차단, 승계일자의 기존 계약 종료일 초과 방지 가드, `statementClosingDay`, `paymentDueDay`, `lateInterestRate` 계약 속성 100% 자동 상속 (헌장 2.2).
       - `generateBillingForSingleContract`: 계약의 `billingDay` 미지정 시 하드코딩 25일 대신 고객사 `defaultBillingDay` 우선 상속.
     - **도메인 1 (영업·계약 - `Customers.tsx`, `Contracts.tsx`)**:
       - `Customers.tsx`: 거래처 수정 모달에 `거래 상태 (출고)` (`ALLOWED` / `BLOCKED`) 선택 필드 추가로 PC에서 직접 출고차단 설정 가능.
       - `Contracts.tsx`: 계약 상세 뷰 및 엑셀 내보내기에 `납기일`(`paymentDueDay`) 명시, `handleExchangeSubmit`에 계약 기간 범위(`startDate` ~ `endDate`) 검증 추가, `handleSaveExtend` 시 `contractAssets` 및 `assets.contractEnd` 만료일자 완벽 동기화.
     - **도메인 2 (배차·물류 - `TruckDispatch.tsx`, `Deliveries.tsx`, `TransportMaster.tsx`)**:
       - `TruckDispatch.tsx`: 수동 배차 모달 state에 `'교환'` 타입 추가 및 생성 시 `type: 'EXCHANGE'` 1:1 매핑 (헌장 2.3), `setClosingMemo(d.closingMemo || '')` 수정 및 메모 무한 중복 연결 루프 제거, 기사 선택 시 `handleVehicleFieldChange` 단일 원자 호출 및 함수형 상태 갱신으로 stale closure 경합 해결, 탭 2 대사 4대 조치 함수(`handleApproveMismatch`, `handleApproveAllMismatches`, `handleCreateDeliveryFromExcel`, `handleExecuteBundlePaymentRequest`)에 `await db.awaitPendingWrites()` 동기 대기 완비.
       - `Deliveries.tsx`: `deliveryCost ?? ''` 적용으로 0원 운임료 유지, `(d.deliveryCost || 0).toLocaleString()`, `(d.memo || '').includes(...)` 및 `.substring(...)` 널 세이프 가드 적용으로 런타임 TypeError 원천 차단.
       - `TransportMaster.tsx`: 브라우저 `window.confirm` 전면 퇴출 및 전용 `confirmModal` UI 컴포넌트 탑재 (헌장 5.2).
     - **도메인 3 (출고·자산 - `rent_assets.tsx`, `asset_history.tsx`)**:
       - `rent_assets.tsx`: 브라우저 `alert()` 3건을 `showToast`로 전면 교체, 상단 전대 요약 바 필터에 `a.status !== 'RENTED_RETURNED'` 추가로 반납 장비 누수 차단.
       - `asset_history.tsx`: 입고 취소 롤백 시 브라우저 `window.prompt` 전면 퇴출 및 전용 `cancelModal` UI 컴포넌트 탑재 (헌장 5.2).
     - **도메인 4 (AS·소모품 - `Consumables.tsx`, `FieldAsManagement.tsx`)**:
       - `Consumables.tsx`: 본사 반납 실행 시 차량 보유 재고(`maxStock`) 한도 `max` 속성 및 `onChange` 클램핑 방어.
       - `FieldAsManagement.tsx`: 무수식어 건조 UI 표준화 (헌장 3.1) 이행 (`실시간` 등 부사/수식어 및 불필요 부연설명 제거).
     - **도메인 5 (재무·채권 - `Billings.tsx`, `CashFlowPage.tsx`, `BankMatching.tsx`)**:
       - `Billings.tsx`: `handleBulkGenerateWizard` 내 잔존 `alert()`을 `showErrorModal`로 교체, 위저드 계약 카드 헤더에 `[출고제한]` 레드 배지 연동, `approveBilling`/`cancelBilling` 비동기 처리.
       - `CashFlowPage.tsx`: 임차 고소장비 대금 정산 시 하드코딩된 목업값(845만원) 대신 실제 가동 중인 전대 자산 임차료(`monthlyLeaseExpense`)로 동적 반영.
       - `BankMatching.tsx`: 하단 구텐베르크 Z-패턴 대차대조식 바를 현재 필터링된 거래내역(`filteredTransactions`) 스코프로 동적 집계하고, 출금 정산 모드(`appliedTypeFilter === 'WITHDRAW'`)일 때 출금 총액, 정산 반영액, 미정산 잔액, 지급 매칭률로 상황별 정밀 표출.
  2. **빌드 무결성 검증**: `cmd /c "npm run build"` (`tsc -b && vite build`) 0 Type Error 무결점 통과.

## [완료] 모바일 모드 연계 PC 보드 5대 전문 도메인 전수검토 및 무결성 개편 (Build.163)
- **요구사항**:
  "핸드폰 모드 개편에 따른 PC 보드에서의 변화사항 전수검토. 모든 서브에이전트 투입. 무결성 확인. 검수항목 전체 명세서 작성하고 무결성 검수결과 기록. 오류발견시 전수 개편."
- **조치 내역**:
  1. **검수항목 전체 명세서 및 무결성 검수결과 기록부 작성**:
     - `검수항목_전체_명세서_및_무결성_검수결과_기록부.md` 작성 및 `skelton` 경험(`경험/2026-09_핸드폰모드_개편_연계_PC보드_전수검토_및_무결성_검수결과.md`) 영구 동기화.
     - 5대 전문 도메인 38개 항목 전수 검수 및 31건 결함 도출 및 전수 개편 완료.
  2. **코어 비즈니스 & 모델 계층 (`db.ts`, `AppContext.tsx`)**:
     - `OutboundInspection` 모델에 `deliveryId` 필드 정규화.
     - `AppContext.tsx`: 안전한 결제일/마감일 파싱 fallback, `paymentDueDay` 25일 자동 설정, 대차 교체 시 신규 장비 상태를 `ASSIGNED`로 보존(출고 검수 승인 시점 `RENTED` 전환 헌장 1.3 준수), 대차 시 조기 OUTBOUND 로그 생성 제거, `registerRepair` 모바일 8대 필드 누락 없는 통합 처리, 중앙 소모품 음수/초과 출고 원천 차단.
  3. **도메인 1 (영업·계약 - `Customers.tsx`, `Contracts.tsx`, `smart_dispatch.tsx`, `smart_return.tsx`)**:
     - `Customers.tsx`: 결제일(`paymentDueDay: 25`) 모달/테이블/상세/엑셀 반영, 무수식어 건조 UI 표준화.
     - `Contracts.tsx`: `BLOCKED` 거래처 출고제한 배지 누락 수정, 기본 장비 바스켓을 모델 단위로 기본화하여 부서 R&R 준수, 계약 연장/단축/승계 일자 역전 방어.
     - `smart_dispatch.tsx`: 고객사 결제일/마감일 자동 상속 파이프라인 및 건조 UI 표준화.
     - `smart_return.tsx`: 계약 시작일 이전 반납일자 역전 방지 가드 및 `async/await` 동기 대기 보강.
  4. **도메인 2 (배차·물류 - `TruckDispatch.tsx`, `Deliveries.tsx`, `TransportMaster.tsx`)**:
     - `TruckDispatch.tsx`: 배차 구분 드롭다운 및 수동 모달에 `교환`(`EXCHANGE`) 옵션 정규 추가 (헌장 2.3), 배차 마감 시 `selectedDelivery.memo` 보존, 기사 선택 시 차량번호(`vehicleNo`) 자동 기입 및 수정 컬럼 추가, 배차 확정 시 실시간 알림(`broadcastWorkNotification`) 발행 연동, 하단 구텐베르크 Z-패턴 터미널 액션 바 탑재.
     - `Deliveries.tsx`: 모든 운송료 입력창에 `Math.max(0, parseInt(...))` 음수 방어, 회수 검수 시 `EXCHANGE` 배차 지원, 정비점수 0~10 클램핑 및 AVAILABLE 상태 시 0점 리셋, `alert()` 제거 및 `showToast`/`showErrorModal` 교체, `await db.awaitPendingWrites()` 보강.
     - `TransportMaster.tsx`: `alert()`/`confirm()` 전면 제거, `white-space: nowrap` 적용 및 동기 쓰기 대기 보강.
  5. **도메인 3 (출고·자산 - `rent_assets.tsx`, `outbound_inspections.tsx`, `Assets.tsx`, `asset_history.tsx`)**:
     - `rent_assets.tsx`: 대여중(`status === 'RENTED'`) 자산의 원사 직접 반납 원천 차단 가드 및 반납 버튼 비활성화, 동기 검증 대기.
     - `outbound_inspections.tsx`: 검수 완료 페이로드에 `specsJson` 및 `deliveryId` 연동, `InspectionGroup` 타입 정규화.
     - `Assets.tsx`: `rentedOpCount` 대여 장비 중복 집계 버그 수정 (`assets.filter(a => a.status === 'RENTED').length`).
     - `asset_history.tsx`: 입고 등록 시 실제 업로드 사진 URL 및 정비점수 정상 전달, `alert()` 전면 퇴출.
  6. **도메인 4 (AS·소모품 - `FieldAsManagement.tsx`, `Repairs.tsx`, `Consumables.tsx`)**:
     - `FieldAsManagement.tsx`: 백지화(WSOD) 결함이었던 `CALENDAR`(월간 일정표 및 일별 티켓 상세) 및 `ANALYTICS`(기간 필터, 4대 핵심 KPI, 고장 유형별 분석, 엔지니어별 실적) 뷰 완벽 신규 구현, 대장 테이블 및 엑셀에 점검코드/노후도 표기, 하단 구텐베르크 유상AS 정산 대차대조 바 탑재.
     - `Repairs.tsx`: 정비 부품 추가 시 본사 중앙 창고 가용 재고 실시간 검증 가드, 완료/보류/외주 정비 저장 시 `await db.awaitPendingWrites()` 동기 검증, 수리대장/상세/엑셀에 점검코드, 노후도, 유무상구분, 청구액 4대 필드 완벽 노출.
     - `Consumables.tsx`: 입출고/이동/반납 수량 1개 이상 및 최대 가용 재고 한도 클램핑(`Math.max(1, ...)`, `max={stock}`).
  7. **도메인 5 (재무·채권 - `DelinquencyPage.tsx`, `Billings.tsx`, `Receivables.tsx`, `BankMatching.tsx`, `CashFlowPage.tsx`)**:
     - `DelinquencyPage.tsx`: 거래 차단 고객(`transactionStatus === 'BLOCKED'`)에 대해 목록 테이블 및 우측 상세 패널에 `[출고제한]` 레드 배지 표출.
     - `Billings.tsx`: 거래 차단 고객에 대해 청구 목록 및 상세 패널에 `[출고제한]` 배지 표출, `getDueContractsForBilling`에서 고객사 약정 마감일(`defaultBillingDay`) 및 명세서 마감일(`defaultStatementClosingDay`) 자동 연동.
     - `Receivables.tsx`: 핵심 액션 컬럼(`[단독 청구]`)을 테이블 맨 첫 번째(가장 왼쪽) 컬럼으로 이동 (헌장 3.2), `[출고제한]` 배지 표출, 모든 `alert()` 제거 및 `showToast`/`showErrorModal` 대체, 하단 구텐베르크 Z-패턴 대차대조식(`총 외상채권 = 기청구액 + 미청구 잔액 | ⚖️ 대차 차액 ₩0`) 및 종결 액션 바 탑재.
     - `BankMatching.tsx`: 0원 및 음수 거래내역 업로드 원천 차단 가드, 7개 `alert()` 전면 퇴출, 오매칭 복구를 위한 `[해제]`(`unmatchTransaction`) 버튼 탑재, 하단 구텐베르크 수지 균형 대차대조식(`입금총액 = 확정수납액 + 미수납잔액 | ⚖️ 대차 차액 ₩0`) 탑재.
     - `CashFlowPage.tsx`: 일 20일 임차 장비 대금 정산 시 고정 목업값(845만원) 대신 실제 가동 중인 전대 자산(`assets.filter(a => a.ownerType === 'RENTED')`)의 약정 월 임차료(`monthlyRentFee` / `monthlyRentalFee`)를 실시간 동적 집계하여 시뮬레이션에 반영.
  8. **0 Type Error 빌드 무결성 검증 완료**: `cmd /c "npm run build"` (`tsc -b && vite build`) 0 Error 무결점 통과.

## [완료] 전 부서 20회 고난도 WTT(Work-Through Test) 수행 및 양방향 오류 방어 가드 전면 개편 (Build.162)
- **요구사항**:
  "현재 수준에서 복잡도가 높은 WTT 를 20회 수행하여 각 메뉴의 목적을 위반하거나 목적 수준에 부족한 기능 색출하여 개편. 오류 발생 가능성에대한 포지티브테스트/네거티브테스트 양방향 수행/ 수량 등의 경우 0, 음수 테스트. 날짜, 시간등에 대한 형식오류 테스트. 편의성 제공을 위한 기본값 적용 객체등도 검토. 적발 된 모든 이슈 개편"
- **조치 내역**:
  1. **6대 도메인 20회 WTT 전수 수행 및 양방향 오류 가드 개편**:
     - **영업·스마트발주 (WTT-01 ~ WTT-04)**:
       - `voiceOrderDraftService.ts`: 음성인식 장비 수량 0/음수 방어 및 1대 이상 클램핑 (`Math.max(1, parseInt)`).
       - `MobileDispatchOrderCreate.tsx`: 과거 납기일 선택 차단, 품목 수량 1 이상 강제, 총 발주수량 0건 전송 차단, 고객사 기본 약정일(`closingDay`, `paymentDay`) 자동 상속.
       - `AppContext.tsx`: `saveSmartDispatch` 장비 수량 검증 가드 추가, 고객사 기본 마감/결제일 계약 자동 상속; `extendContract`, `shortenContract`, `succeedContract` 날짜 역전(`newEndDate < contract.startDate`) 방어 및 `await db.awaitPendingWrites()` 동기 검증.
     - **출고·검수 (WTT-05 ~ WTT-07)**:
       - `outbound_inspections.tsx`: 체크리스트 0개 승인 원천 차단 가드 및 출고 승인 시 `assetInOutLogs`(`type: 'OUTBOUND'`) 무누락 DB 저장 (헌장 1.2).
       - `Deliveries.tsx`: 입고 검수 정비점수 음수 입력 방어 (`Math.max(0, parseInt)`).
     - **배차·물류 (WTT-08 ~ WTT-10)**:
       - `TruckDispatch.tsx` & `MobileDispatchList.tsx`: 예상/확정/지급 운송료 음수 방어 및 0원 이상 클램핑.
       - `AppContext.tsx`: `exchangeAsset` 대차 시 신규 자산 상태를 `RENTED`가 아닌 `ASSIGNED`(배정/출고대기)로 유지하여 출고 검수 승인 시점에 `RENTED` 전환 원칙 준수 (헌장 1.3), `contractHistory.changeType = 'EXCHANGE'` 명시 (헌장 4.2), 단일 왕복 배차 의뢰 발행 (헌장 2.3), `await db.awaitPendingWrites()` 동기 검증.
     - **현장AS·소모품 (WTT-11 ~ WTT-14)**:
       - `MobileAsDetail.tsx`: 부품 사용 수량 1개 이상 클램핑 및 본인 차량 재고 초과 소모 차단, 유상/무상(`billableType`) 및 청구액(`billableAmount`) 정상 수신 연동.
       - `MobileVehicleStock.tsx`: 차량 실사 재고 보정(`ADJUST`) 시 0개 잔여 재고 조정 허용 (기존 0개 입력 불가 결함 개편).
       - `AppContext.tsx`: `completeFieldAsTicket` 부품 수량 1개 이상 검증 및 청구액 클램핑; `purchaseConsumable`, `useConsumable`, `transferConsumableToMechanic`, `returnConsumableToHq` 수량/단가 0 이하 및 음수 입력 차단.
     - **전대·임차 (WTT-15 ~ WTT-17)**:
       - `MobileSubleaseManage.tsx`: 주기장 유휴 누수 일수 음수 보정(`Math.max(0, idleDays)`), 원사 임차료 및 투입 렌탈료 음수 클램핑.
       - `AppContext.tsx`: `registerRentedAsset` 차입단가 음수 방어; `returnRentedAsset` 고객 현장 투입 중(`status === 'RENTED'`)인 자산의 원사 직접 반납 원천 차단(고객사 회수 선행 강제) 및 반납일 역전 방지.
     - **경영·채권·정산 (WTT-18 ~ WTT-20)**:
       - `MobileCustomerManage.tsx`: 약정 마감일(`defaultBillingDay`) 및 결제일(`paymentDueDay`) 1~31일 범위 클램핑.
       - `MobileDelinquencyManage.tsx`: 경영진 긴급 수금지시 시 처리기한 과거일자 차단(`directiveDueDate >= todayStr`) 및 필수 입력 검증.
       - `AppContext.tsx`: `receivePayment` 수납액 0 이하 입력 차단 및 `await db.awaitPendingWrites()`; `applyPrepaidBalanceForBilling`, `refundPrepaidBalance` 0 이하 금액 차단; `matchTransactionManual`, `unmatchTransaction` 동기 검증.
  2. **TypeScript & Vite Build 무결성**: `tsc -b && vite build` 0 Error 완벽 통과.

## [완료] 4대 핵심업무 발생즉시 1회 푸시알림·사운드진동 및 무전기 채널 삭제·나가기 체계 구축 (Build.161)
- **요구사항**:
  "푸시 알림이 가능하다면 발생즉시 1회만 푸시알림 발송하고, 5분간격 모니터링은 안해도 되겠어. 발생즉시 1회 작동만 구현. 무전기 새채널에 대한 나가기 및 채널삭제 로직 개편안도 승인. 두 기능 모두 구현."
- **조치 내역**:
  1. `src/services/walkieTalkieService.ts` & `src/mobile/components/MobileWalkieTalkieModal.tsx`:
     - 사용자 생성 채널의 수명주기(삭제 및 나가기) 완성.
     - 채널 생성자: `deleteChannel(channelId, userId)` -> Supabase Realtime `channel_deleted` 브로드캐스트 -> 전 참여자 공용 채널(`DISPATCH`) 자동 복귀.
     - 일반 참여자: `leaveChannel(channelId, userId)` -> 참여 목록 제거 후 공용 채널 자동 복귀.
     - 기본 4대 공용 채널 삭제/나가기 방어.
     - UI 서브헤더에 `[삭제]`, `[나가기]` 버튼 조건부 렌더링 및 확인 컨펌 연동.
  2. `public/sw.js` & `src/utils/workNotificationService.ts`:
     - Service Worker `push` 및 `notificationclick` 딥링크 핸들러 탑재 (잠금화면 알림 렌더링 및 터치 시 앱 즉시 활성화).
     - Web Audio API 2음계 딩동 차임벨 합성(`playWorkNotificationChime`: E5 659.25Hz -> A5 880Hz) 및 진동(`[200, 100, 200, 100, 300]`).
     - Supabase Realtime `work_notifications` 메타 채널 기반 전사 실시간 브로드캐스트 및 수신 리스너 구축.
     - 부서(영업/배차/출고/AS/관리/경영) 정밀 타겟팅 및 경영진 전원 수신 보장.
  3. 4대 핵심 업무 발생 즉시 1회 알림 발송 연동:
     - 출고의뢰: `AppContext.tsx` -> `saveSmartDispatch` (`OUTBOUND`)
     - 회수의뢰: `AppContext.tsx` -> `saveSmartReturn` (`RETURN`)
     - 대차교체: `MobileDispatchOrderCreate.tsx` & `AppContext.tsx` -> `completeFieldAsTicket` (`EXCHANGE`)
     - 현장AS: `AppContext.tsx` -> `createFieldAsTicket` (`AS`)
     - 배차배정: `MobileDispatchList.tsx` & `AppContext.tsx` -> `dispatchDelivery` (`DISPATCH`)
  4. 스켈톤 레포지터리 영구 기록 (`000.skelton`):
     - `발상/2026-09_모바일_무전기_사용자채널_수명주기_및_삭제나가기_체계.md` (`ae51471`)
     - `계획/2026-09_모바일_잠금화면_웹푸시_소리진동_및_5분리마인더_동작설계.md` (`47b965a`)
  5. `tsc -b && vite build` 0 Type Error 빌드 검증 완료.

## [완료] 영업-배차 업무연계 기반 할일 목록(ToDo) 중심 배차관리 체계 구축 (Build.160)
- **요구사항**:
  "배차관리는, 단순이 배차 처리를 하는 것보다, 먼저 영업사원이 계약/출고를 생성하면 그에 따른 처리를 수행해야 하는데, 영업사원의 업무와 배차담당의 업무를 연계해보면, 배차담당이 할일 목록에 대해서 처리하는게 맞지 않나? 그외에 임의로 배차를 추가로 입력하는건 지금 기능과 동일하고" -> "ㄹㅇ"
- **조치 내역**:
  1. `src/pages/TruckDispatch.tsx`:
     - 상단에 `📋 영업 의뢰 배차 대기 ToDo` 카드뉴스 패널 신규 구축.
     - 영업사원이 발행한 출고/회수/교환 요청(`status: 'REQUESTED' | 'PENDING'`)을 실시간 큐로 자동 바인딩.
     - 각 ToDo 카드에 의뢰자(영업사원), 의뢰유형(출고/회수/교환), 고객사/현장, 납기일시, 요청장비 제원/수량, 특이메모, `[기사 배정 ➔]` 버튼 직결.
     - ToDo 카드 클릭 시 상세 패널 선택 및 기사 배정 즉시 연결 ➔ 기사 배정 확정 시 ToDo 자동 완결(차감).
     - 대기 0건 시 "현재 영업부에서 접수된 배차 대기 할일이 모두 완료되었습니다. (잔여 ToDo 0건)" 표출.
     - 기존 수동 임의 배차 추가(`[+ 신규 배차 등록]`) 기능 100% 정상 유지.
  2. `src/mobile/pages/MobileDispatchList.tsx`:
     - 배차 대기 탭 상단에 `📋 영업 의뢰 배차 대기 할일 (ToDo): N건` 배너 배치.
     - 각 배차 카드에 의뢰 영업사원(`의뢰: 홍길동`) 및 계약번호 컨텍스트 표출.
     - 대기 건 0건 시 완료 안내 엠프티 스테이트 제공.
  3. `000.skelton/발상/2026-09_영업_배차_업무연계_할일목록_기반_배차관리_체계.md` 영구 기록 및 커밋·푸시 완료 (`6f9ccf8`).
  4. `npm run build` 0 Type Error 무결성 통과.

## [완료] 화물 기사 배차 안내 스마트폰 기본 문자(sms:) 딥링크 발송 연동 (Build.159)
- **요구사항**:
  "배차 시 기사에게 문자메세지 발송 하는 기능을 만들었어? 핸드폰의 기본 문자메세지 기능을 이용하는건가?" -> "진행"
- **조치 내역**:
  1. `src/utils/nativeLauncher.ts`:
     - `DispatchSmsParams` 인터페이스 정의 및 배차 안내문 포맷터 `buildDispatchSmsText` 구현.
     - 출고/회수/교환(EXCHANGE, 헌장 2.3) 유형별 분기 및 왕복 상·하차 안내, 배차번호, 기사/차량, 확정운송료, 상차지(출발)/하차지(도착) 연락처, 적재 장비 제원, 특이사항 포맷팅.
     - 스마트폰 기본 문자메시지 앱 연동 `launchDispatchSms` 구현: iOS(`&body=`) 및 Android(`?body=`) 분기 지원, 브라우저 차단 대비 클립보드 선제 복사(`copyToClipboard`) 2중 안전망 탑재.
  2. `src/mobile/pages/MobileDispatchList.tsx`:
     - 배차 카드 내 배정된 기사 영역에 `[통화]` 버튼 옆 `[배차문자]` 원클릭 발송 버튼 탑재.
     - 기사 배정 모달에 `[배정 확정]` 및 `[기사 배정 확정 + 배차문자 즉시 발송]` 이원화 액션 버튼 제공.
  3. `src/pages/TruckDispatch.tsx`:
     - PC 우측 상세 검사 액션바에 `[기사 배차문자]` 버튼 탑재 (원클릭 문자앱 호출 및 클립보드 자동 복사).
  4. `000.skelton/계획/2026-09_화물기사_배차안내_기본문자앱_딥링크_발송체계.md` 영구 기록 및 커밋·푸시 완료.
  5. `npm run build` 0 Type Error 무결성 통과.

## [완료] 모바일 무전기 React Hook 불일치 백화현상(WSOD) 해소 및 ErrorBoundary 아키텍처 정립 (Build.158)
- **요구사항**:
  "핸드폰에서 무전기 켰더니 화면이 하얗게 변하고 아무것도 안보임"
- **조치 내역**:
  1. `src/mobile/components/MobileWalkieTalkieModal.tsx`:
     - 246행 조기 리턴(`if (!isOpen) return null;`) 제거 및 모든 Hook 선언 완료 후(JSX 직전 412행)로 이동.
     - 405행 채널 동적 전환 `useEffect` 내부에 `if (!isOpen) return;` 방어 가드 추가.
     - `isOpen` 여부와 무관하게 컴포넌트 내 39개 Hook이 항상 동일한 순서로 렌더링되도록 보장하여 React Invariant #310 크래시 원천 해소.
     - `formatSafeTime` 헬퍼 함수 도입 및 `localStorage` try-catch 방어막 적용.
     - `fallbackCh` 도입으로 `currentChInfo` undefined 참조 크래시 방지.
  2. `src/components/ErrorBoundary.tsx`:
     - 전사 표준 에러 바운더리 컴포넌트 신규 구축 ("화면 일시 오류 복구" 뷰, `[화면 새로고침]`, `[무전기 캐시 초기화 및 재접속]`).
  3. `src/main.tsx`, `src/mobile/MobileApp.tsx`, `src/App.tsx`:
     - 루트 `<App />` 및 `<MobileWalkieTalkieModal>`, `<MobileGemsAgentModal>` 에러 바운더리 래핑 적용.
  4. `npm run build` 0 Type Error 무결성 통과 및 SSR 가상 렌더링 라이프사이클 검증 완료.

- **요구사항**:
  "핸드폰모드 좌상단에 날씨위젯 추가"
- **조치 내역**:
  1. `src/components/WeatherWidget.tsx`:
     - `WeatherWidgetProps` 인터페이스 확장 (`compact?: boolean`, `style?: React.CSSProperties`).
     - 모바일 컴팩트 모드 지원: 슬림 패딩(`3.5px 8px`), 라운드(`8px`), 다크 배경(`#1e293b`), 테두리(`#334155`), 가로 폭 컴팩트 뱃지(`🌤️ 용인 24°C`).
     - 시간대별/주간 일기예보 모달 팝업 `zIndex: 99999`, 모바일 반응형 패딩 및 `maxWidth: 520px` 보강.
  2. `src/mobile/MobileHeader.tsx`:
     - `WeatherWidget` 임포트 및 상단 1행 좌측(좌상단)에 컴팩트 모드로 배치.
     - 모바일 헤더 2행 레이아웃 개편:
       - 1행: 좌상단 `<WeatherWidget compact />` + 우상단 `[새로고침] [무전ON] [AI비서] [로그아웃]` (`white-space: nowrap`, `flex-shrink: 0`).
       - 2행: 좌측 `[아이콘] 기연리프트 FIELD` + 사용자 정보 + 우측 `[PC모드]` 버튼.
       - 3행: 부서별 5대 탭 (`영업부`, `AS팀`, `출고팀`, `경영진`, `관리부`).
  3. `cmd /c "npm run build"` 0 Type Error 빌드 무결성 검증 완료.

## [완료] 모바일 전용 메뉴 하드코딩 목업 전면 삭제 및 실DB 1:1 연동 (Build.156)
- **요구사항**:
  "핸드폰 전용 메뉴에서 임시로 삽입한 데이터, 하드코딩되어 표시되고 있는 정보들 전부 삭제. 실제 DB 에서 올라오는 내용만 표시. 모든 메뉴 전수검사"
- **조치 내역**:
  1. `src/mobile/pages/MobileExecutiveHome.tsx`:
     - 가짜 결재 대기 큐 및 가짜 토스트 제거.
     - 실제 DB의 대기 건(`consumablePurchases`, `purchaseSettlements`, `payrollClosings`) 실시간 1:1 연동.
     - 승인 클릭 시 `db.updateRow` 및 `setPayrollClosingStatus` 실행 + `await db.awaitPendingWrites()` 동기 저장.
     - 대기 건 부재 시 "현재 경영진 최종 결재 대기 건이 없습니다." 정직한 Empty State 렌더링.
  2. `src/mobile/pages/MobileAdminHome.tsx`:
     - 하드코딩된 청구월 fallback `'2026-08'` 삭제 ➔ 실데이터 기준 추출.
     - 명세서 발송 버튼의 실데이터 검증(담당자 이메일 유무) 연동.
  3. `src/mobile/pages/MobileDispatchList.tsx`:
     - 기사 배정 모달 내 하드코딩 '테스트 예시 1' 임시 버튼 영구 삭제.
  4. 모바일 24개 파일 전수 스캔 및 0 Type Error 빌드 무결성 확보.
