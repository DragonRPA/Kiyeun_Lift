# 개발 지시 및 개편 완료 내역 (dev_temp.md)

- [완료] 출고 검수 장비 교체 및 의뢰 반려 시 수리정비중(REPAIRING) 자산 상태 전환 여부 선택 토글 옵션 수술 (`outbound_inspections.tsx` & `AppContext.tsx`)
  1. 장비 교체 모달 내 🛠️ 기존 교체 대상 장비를 수리정비중(REPAIRING)으로 전환할지 선택 토글(ToggleSwitch) 수술 완료 (ON: 수리정비중 전환 / OFF: 임대가능 재고 유지).
  2. 의뢰 반려 모달 내 🛠️ 반려 대상 장비들을 수리정비중(REPAIRING)으로 전환할지 선택 토글(ToggleSwitch) 수술 완료 (ON: 수리정비중 전환 / OFF: 임대가능 재고 원복).
