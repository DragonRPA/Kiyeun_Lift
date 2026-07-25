# 개발 요청 사항 (dev_temp.md)

[대기 중 요구사항 - v1.4.1]
1. 프로젝트 전체 체크박스 형태 입력 요소를 세련된 토글 버튼(Toggle Switch) 디자인으로 전면 개편.
2. 우선적으로 `TruckDispatch.tsx` [신규 수동 배차 요청 생성] 모달 내 '고객 청구 여부 (billableToCustomer)' 체크박스를 토글 버튼 UI로 변경.

---
[반영완료 - v1.4.0.Build.00000 / 2026-07-25 23:45]
1. v1.3.6: 청구 매출 귀속월(billingYm) 기본값 YYYY-MM 동적 할당 및 수정 가능 개편 (Billings.tsx, AssetAcquisitionDisposal.tsx)
2. v1.3.7: 임차 자산 반납 및 회수/반납 배차 통합 동시 신청 지원 (RentAssets.tsx)
3. v1.3.8: 배차 차종/톤수(8종) 다중 대수 및 운반 장비 모델/대수 연동 & [+ 수동 배차 생성] 모달 구축 (TruckDispatch.tsx)
4. v1.3.9: 운송 기사 마스터 스키마 확장(주민번호 7자리 마스킹, 주소, 차량색상) 및 운송사 계좌 1-Click 복사 (TransportMaster.tsx)
5. v1.4.0: 배차 상하차지 입력, 공급가액 기준 월말 운송료 정산 대사, 최종 운송료 재수정/사유 기록, 지급 추적 및 PAID 마감 Lock / 지급요청 회수(재정산) 지원 (TruckDispatch.tsx)
