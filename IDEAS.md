# 💡 미구현 아이디어 목록 (IDEAS.md)

아이디어를 제안만 하고 아직 구현하지 않은 기능들을 기록합니다.
"미구현 아이디어 찾아줘" 라고 하면 이 파일을 기준으로 안내합니다.

---

## 1. DB 스키마 검증 도구 — 잉여 컬럼/테이블 DROP 기능

- **제안일**: 2026-07-27
- **상태**: ❌ 미구현 (아이디어만)
- **내용**:
  현재 DB 스키마 정합성 검증 도구는 `schema.sql`에 정의된 컬럼이 DB에 없으면 `ADD COLUMN` 자동 실행이 가능하지만,
  반대 방향(schema.sql에서 컬럼을 삭제했을 때 DB에 남아있는 잉여 컬럼)은 감지·처리하지 못함.

  **구현 시 요구사항**:
  - `extraCols = actualCols - schemaCols` 계산 로직 추가
  - 잉여 컬럼을 "⚠️ 잉여 컬럼" 섹션으로 검증 결과 테이블에 별도 표시
  - `ADD COLUMN` 자동 적용과 달리 **"DROP COLUMN 실행" 버튼을 별도**로 두고
  - **이중 확인 다이얼로그 필수** (DROP은 데이터 영구 삭제이므로)
  - 잉여 테이블(schema.sql에 없는 테이블) 감지 및 `DROP TABLE` 안내도 포함
  - **관련 파일**: `src/pages/DevDataUploader.tsx` — `runSchemaVerification` 함수

---

## 2. ID 생성 전략 — `crypto.randomUUID()` 로 교체 (옵션 A)

- **제안일**: 2026-07-27
- **상태**: ❌ 미구현 (아이디어만)
- **배경**: 현재 `generateNextId()`는 로컬 배열의 max 번호 + 1 방식으로 ID 생성. 같은 세션 내 재진입·타이밍 문제로 중복 ID 발생 가능. 현재는 B안(insert→upsert)으로 오류만 억제 중.
- **내용**:
  - `insertRow` 내부에서 `id = row.id || crypto.randomUUID()` 로 교체
  - `generateNextId()` 함수 완전 제거 또는 deprecated 처리
  - 모든 테이블의 id 컬럼이 `TEXT PRIMARY KEY` 이므로 UUID 문자열 저장 무관
- **단점**: `CONTR-0000003` 같은 가독성 있는 ID 포맷이 사라짐
- **관련 파일**: `src/services/db.ts` — `insertRow`, `generateNextId`

---

## 3. ID 생성 전략 — UUID + upsert 병행 적용 (옵션 C)

- **제안일**: 2026-07-27
- **상태**: ❌ 미구현 (아이디어만)
- **내용**: 옵션 A(UUID)와 현재 B안(upsert) 을 동시에 적용하는 가장 완전한 방식.
  - `crypto.randomUUID()`로 충돌 가능성 원천 제거
  - `upsert(onConflict: 'id')`는 방어막으로 유지
  - 신규 레코드는 UUID, 기존 레코드(시드 데이터)는 현재 포맷 유지 가능
- **선행조건**: 시드 데이터 및 하드코딩된 ID(`u-1`, `sys-admin` 등) 영향 없는지 전수 검토 필요
- **관련 파일**: `src/services/db.ts` — `insertRow`, `generateNextId`

---
