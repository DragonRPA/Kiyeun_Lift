# 대기 중인 개발 지시사항 목록 (Pending Instructions)

## [2026-07-21] Supabase 원격 DB와 코드베이스 내 DB 스키마 전수 비교 및 동기화 완전성 확보
- **목표**: 코드베이스(`db.ts`)가 Supabase 연동 시 사용하는 28개 테이블과 실제 Supabase 서버의 테이블을 전수 대조하여, 누락되거나 불일치하는 5대 테이블을 Supabase 및 스키마 정의(`schema.sql`)에 최종 동기화합니다.
- **세부 요구사항**:
  1. **누락 테이블 파악**: `consumable_purchases`, `transport_companies`, `transport_drivers`, `todos`, `google_configs` 5개 테이블이 원격 Supabase DB에 누락되어 조회 및 업서트 시 404 에러가 발생하는 현상 검증 완료.
  2. **스키마 정의 보완**: 로컬 `schema.sql` 파일에 누락된 5개 테이블의 CREATE TABLE 스펙 및 DROP TABLE IF EXISTS CASCADE 제약 조건을 반영.
  3. **원격 DB 반영 (완료 대기)**: 사용자가 Supabase SQL Editor를 통해 5개 누락 테이블 생성 DDL을 실행하여 원격 DB의 테이블 구조를 완전하게 보완.
