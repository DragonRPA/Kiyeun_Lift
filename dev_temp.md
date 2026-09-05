# 개발 요구사항 임시 기록 (dev_temp.md)

## [완료] 모바일 전용 메뉴 하드코딩 목업 전면 삭제 및 실DB 1:1 연동 (Build.156)
- **요구사항**:
  "핸드폰 전용 메뉴에서 임시로 삽입한 데이터, 하드코딩되어 표시되고 있는 정보들 전부 삭제. 실제 DB 에서 올라오는 내용만 표시. 모든 메뉴 전수검사"
- **조치 내역**:
  1. `src/mobile/pages/MobileExecutiveHome.tsx`:
     - 가짜 결재 대기 큐(서희건설 4대 단가특약, 고압세척기 385만원 지출결의) 및 가짜 토스트 제거.
     - 실제 DB의 대기 건(`consumablePurchases.filter(p => p.status === 'REQUESTED')`, `purchaseSettlements.filter(s => s.status === 'PENDING')`, `payrollClosings.filter(pc => pc.status === 'DRAFT')`) 실시간 1:1 연동.
     - 승인 클릭 시 `db.updateRow(...)` 및 `setPayrollClosingStatus` 실행 + `await db.awaitPendingWrites()` 동기 저장.
     - 대기 건 부재 시 "현재 경영진 최종 결재 대기 건이 없습니다." 정직한 Empty State 렌더링.
  2. `src/mobile/pages/MobileAdminHome.tsx`:
     - 하드코딩된 청구월 fallback `'2026-08'` 삭제 ➔ 실데이터 기준 추출.
     - 명세서 발송 버튼의 실데이터 검증(담당자 이메일 유무) 연동.
  3. `src/mobile/pages/MobileDispatchList.tsx`:
     - 기사 배정 모달 내 하드코딩 '테스트 예시 1' (`경기88바1234 이기사...`) 임시 버튼 영구 삭제.
  4. 모바일 24개 파일 전수 스캔 및 0 Type Error 빌드 무결성 확보.
