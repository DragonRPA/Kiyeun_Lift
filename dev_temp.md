# 개발 요구사항 임시 기록 (dev_temp.md)

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
