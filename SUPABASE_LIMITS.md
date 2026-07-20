# Supabase SQL Editor 실행 제약 및 대량 데이터 적재 정책

Supabase Studio(웹 콘솔) 대시보드의 SQL Editor는 웹 기반 편의 도구로서 브라우저 및 게이트웨이 프록시의 특정 리소스 제한을 받습니다. 본 문서는 대규모 데이터 시딩 및 스키마 변경 시 발생할 수 있는 오류를 사전에 방지하기 위한 공식 제약 및 글로벌 설계 정책을 정리합니다.

---

## 1. 주요 시스템 제약 조건 (Key Limitations)

### ① 웹 게이트웨이 페이로드 용량 제한 (Request Body Size Limit)
* **제약**: SQL Editor는 내부 API 게이트웨이(`/api/pg-meta`)를 경유해 SQL 명령어를 전송합니다. 이 프록시 서버의 최대 요청 바디(Payload) 크기는 **1MB ~ 5MB 수준**으로 제한됩니다.
* **증상**: 1MB를 초과하는 SQL 스크립트(대규모 `INSERT` 문 등)를 실행할 경우, 아래와 같은 웹 서버 레벨 오류가 발생하며 쿼리가 전송되지 않습니다.
  > `Error: Query is too large to be run via the SQL Editor. Run this query by connecting to your database directly.`

### ② 브라우저 스크립트 렌더링 한계 (Browser DOM Bottleneck)
* **증상**: 수만 줄에 달하는 원문 텍스트를 웹 에디터 에디트 창에 붙여넣을 경우, 브라우저 프로세스의 메모리 점유율이 급증하여 탭이 멈추거나(Freeze) 강제 종료되는 현상이 발생합니다.

### ③ 기본 실행 시간 제한 (Statement Timeout Limit)
* **제약**: Supabase 웹 콘솔을 통한 개별 쿼리의 실행 시간 초과 제한(Statement Timeout)은 기본적으로 **3초 ~ 10초 내외**로 타이트하게 설정되어 있습니다. 무거운 벌크 연산이 이 시간 내에 완료되지 않으면 강제로 중단(Abort) 처리됩니다.

---

## 2. 글로벌 개발 및 대량 데이터 적재 정책 (Global Policies)

본 프로젝트 내에서 대량 모의 데이터 또는 마이그레이션 스크립트를 작성하여 DB에 시딩할 때는 다음 수칙을 강제 준수해야 합니다.

### 정책 A: 비즈니스 시간축 기준의 N단계 순차 분할 (Sequential Multi-Part Seeding)
* 단일 스크립트로 대용량을 적재하지 말고, **개별 SQL 파일 크기가 500KB 이하(또는 1,500행 이하)**가 되도록 논리적 시퀀스에 맞춰 분할합니다.
* **데이터 정합성 및 선결 의존성 순서**:
  1. 기초 기준 정보 (Products, Assets, Customers, Contacts, Sites, Consumables 등)
  2. 계약 및 물류 관계 (Contracts, Contract Assets, Deliveries)
  3. 청구, 정산, 지출 및 결제 수납 (Billings, Payments, Bank Transactions, Repairs)

### 정책 B: 트랜잭션 원자성 유지 (`BEGIN; ... COMMIT;` 래핑)
* 분할된 각 파트 스크립트는 반드시 단일 트랜잭션 블록 내에서 처리되도록 `BEGIN;`과 `COMMIT;` 구문으로 감쌉니다.
* 연산 중 예외 발생 시 해당 파트 전체가 롤백(Rollback)되어 찌꺼기 데이터 적재를 방지해야 합니다.

### 정책 C: 초고용량 데이터 업로드 시 CLI / psql 직접 연결 활용 권장
* 10MB 이상의 대용량 덤프 데이터의 경우 웹 에디터를 배제하고, 로컬 터미널에서 Supabase Database Connection String을 통해 `psql` 유틸리티를 호출하여 직접 실행하도록 가이드합니다.
  ```bash
  psql -h aws-0-ap-northeast-2.pooler.supabase.com -p 5432 -d postgres -U postgres -f script.sql
  ```
