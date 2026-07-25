# 개발 요청 사항 (dev_temp.md)

[대기 중 요구사항]
(현재 대기 중인 요구사항 없음 - 전원 구현 및 배포 완료)

---
[반영완료 - v1.4.1.Build.00002 / 2026-07-26 00:22]
1. v1.4.1.Build.00002: SELECT 성공/INSERT 차단 RLS 상태 정밀 사전 감지 실시간 쓰기 테스트(upsert check) 및 엑셀 일괄 업로드 시 RLS 복구 가이드 자동 결합 (`DevDataUploader.tsx`)
2. v1.4.1.Build.00001: Supabase DB 스키마 정합성 검증 도구 내 RLS(new row violates row-level security policy) 위반 검증 및 자동 DDL 해제 쿼리 생성 보강 (`DevDataUploader.tsx`, `AGENTS.md`)
2. v1.4.1: 프로젝트 전반 체크박스 형태 입력 요소를 세련된 토글 버튼(Toggle Switch) 디자인으로 전면 개편 (`index.css`, `ToggleSwitch.tsx`)
2. v1.4.1: `TruckDispatch.tsx` [신규 수동 배차 요청 생성] 모달 및 배차 수정 모달 내 '고객 청구 여부 (billableToCustomer)' 체크박스를 토글 스위치 UI로 전환 개편.
3. v1.4.0.Build.00001: 소모품 구매신청 저장 오류 수정 및 전 스토리지/DB 데이터 저장 성공 검증 & 무음 실패 방지 정책 수립 (`AGENTS.md`, `Consumables.tsx`, `AppContext.tsx`)
4. v1.4.0: 배차 상하차지 입력, 공급가액 기준 월말 운송료 정산 대사, 최종 운송료 재수정/사유 기록, 지급 추적 및 PAID 마감 Lock / 지급요청 회수(재정산) 지원 (`TruckDispatch.tsx`)
5. v1.3.9: 운송 기사 마스터 스키마 확장(주민번호 7자리 마스킹, 주소, 차량색상) 및 운송사 계좌 1-Click 복사 (`TransportMaster.tsx`)
6. v1.3.8: 배차 차종/톤수(8종) 다중 대수 및 운반 장비 모델/대수 연동 & [+ 수동 배차 생성] 모달 구축 (`TruckDispatch.tsx`)
7. v1.3.7: 임차 자산 반납 및 회수/반납 배차 통합 동시 신청 지원 (`RentAssets.tsx`)
8. v1.3.6: 청구 매출 귀속월(billingYm) 기본값 YYYY-MM 동적 할당 및 수정 가능 개편 (`Billings.tsx`, `AssetAcquisitionDisposal.tsx`)
