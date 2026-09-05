# 개발 요구사항 임시 기록 (dev_temp.md)

## [완료] 모바일 모드 좌상단 실시간 날씨 위젯 탑재 (Build.157)
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
