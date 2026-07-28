# 개발 지시 및 개편 완료 내역 (dev_temp.md)

- [완료] 출고 검수 장비 교체 (`exchangeOutboundAsset`) 팝업 오류 완전 치유 수술
  1. 기존에 `contractAssetId` (계약 자산 슬롯 ID)를 받아야 할 첫 번째 매개변수에 `contractId` (계약 ID)가 잘못 전달되어 "교체 대상 장비 또는 계약 슬롯을 찾을 수 없습니다" 예외가 발생하던 인자 미스매치 버그 정밀 수정.
  2. `AppContext.tsx` 내 `exchangeOutboundAsset` 함수가 `contractAssetId` 또는 `contractId` 어떠한 ID값이 들어오더라도 해당 계약/장비의 슬롯을 2중 자가추적(Self-Healing Fallback)하도록 방어수술 완비.
