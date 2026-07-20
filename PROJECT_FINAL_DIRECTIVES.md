# 프로젝트 최종 지시사항 (Final Directives)

## 1. 프로젝트 전반 원칙
- 최소 입력 → 최대 효과 (중복 입력 금지)
- 최소 조작으로 프로세스 실행 및 데이터 기록
- 역할 기반 대시보드:
  - 최고관리자: 경영지표 시각화
  - 담당자: ToDo List 형태 업무 관리
- PC·모바일 반응형 UI, SNS 스타일 카드 뉴스 UI
- 프로세스 연결 상태 배지 표시 (완료: 색상 배지, 진행 중: 무색 배지)
- 직무별 할 일 관리 및 반려(Reject) 알림, 추가 보완 업무 가능
- 상세 조회(더블클릭/더블터치) 및 엑셀 다운로드 제공
- 모든 정산/지급 요청 시 증빙 문서 필수 첨부
- 대시보드 소통 기능: 공지사항, 지시, 요청 (각 권한 및 흐름 정의)

## 2. 직무·부서 별 원칙
### 영업
- 신규 고객 발굴·ERP 등록, 견적·계약, 렌탈료·청구·수납·연체 관리
- 계약 접수 시 필수 정보 자동 등록, 렌탈료 단가 비공개
- 외근정비 요청서 작성 가능

### 메카닉
- 자산 입고·출고·정비·소모품 구매·정비사유 청구 관리
- 출고지시 실시간 인지·처리, 담당자명 표시
- 자산 번호 할당 및 이메일 발송 자동화(예정)
- 입고 시 사진 첨부·불량 기록, 정비 이력 관리
- 외주정비 관리(업체·견적·완료 등) 및 소모품 구매·입고·증빙

### 배차·임차(전대) 관리
- 임차 물건 섭외·등록, 재고 반영, 임차 종료 시 반납 등록
- 정기 정산·지급 요청, 운송 거래처와 협의·운송료 정산
- 배차 협의(차량·운송단가·스케줄·기사 정보) 기록

### 관리부(영업지원)
- 매입·매출 거래명세서·세금계산서·은행 입출금 관리·현금흐름 보고
- 계약 기반 청구 자동 생성·청구·송장·세금계산서 발행·전송
- 고객 맞춤 청구 항목·금액(음수 가능) 수정 가능
- 매출·매입 청구 구분, 현금흐름·월간 보고서 작성·경영자 승인

### 경영자
- 경영지표·인사·노무 감시, 월간 보고서 승인
- 업무량·임차자산 필요수량 확인·지시 생성·승인

## 3. 데이터베이스 핵심 테이블 (요약)
- `users`, `permissions` (역할·메뉴 권한)
- `customers`, `customer_contacts`, `customer_sites`
- `products` (모델 마스터)
- `assets` (소유·대여 구분, 상태, 기본 정보, 현재 계약 정보 포함)
- `consumables`, `consumable_logs`
- `contracts`, `contract_assets`, `contract_history`
- `deliveries` (운송·배차 관리, 추가 `transportCompany` 등 필요 컬럼 포함)
- `billings`, `billing_details`
- `payments`
- `repairs`, `repair_consumables`
- (추가 예정) `rental_contracts`, `purchase_settlements`, `announcements`, `instructions`, `requests`, `org_hierarchy`

## 4. 주요 추가/수정 요구사항
- `deliveries` 테이블에 `transportCompany`(또는 `supplier`) 컬럼 추가
- 임대·대여 이력 관리용 별도 `rental_contracts` 테이블 도입
- 외주정비 관련 `vendor`, `transferDate`, `estimateFile`, `completionDate` 컬럼 추가
- `repairs`에 사진 URL 저장 컬럼(`photoUrls`) 추가
- 구매 요청 흐름을 위한 `purchase_requests` 테이블(상태·진행 단계·첨부 파일) 추가
- 재무 정산을 위한 `bank_transactions` 테이블(거래 매칭·정산 상태) 추가
- 공지·지시·요청 관리 테이블(`announcements`, `instructions`, `requests`) 및 알림/읽음 상태 컬럼 포함
- 조직도·계층 구조(`org_hierarchy`) 테이블 도입
