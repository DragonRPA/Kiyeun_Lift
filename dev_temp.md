# 개발 지시 및 개편 완료 내역 (dev_temp.md)

- [완료] 출고대기 장비 1-Click 즉시 교체 및 수리전환 트랜잭션 구현 (`outbound_inspections.tsx` & `AppContext.tsx`)
  1. 출고 진행 중 장비 교체 시 기존 장비 상태는 무조건 '수리정비중(REPAIRING)'으로 자동 전환.
  2. 출고 불가 원인 및 교체 사유를 기존 장비의 자산 비고(`memo1`/`note`) 및 입출고 이력(`assetInOutLogs`)에 명확히 영구 기록.
  3. 대체 장비(임대가능 `AVAILABLE` 장비)로 1초 만에 자동 스왑 및 '배차지정(ASSIGNED)' 전환.
  4. DB 동기화 실패 시 원복 스냅샷 자동 롤백 적용.
