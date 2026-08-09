# 개발 지시 및 개편 완료 내역 (dev_temp.md)

## 🐛 [Hotfix] DDL 패치 도구 CREATE TABLE 중복 구문 오류 핫픽스 (v1.62.2.Build.149)

### 1. 사장님 제보 오류 완벽 수정
- **오류 내용**: DDL 패치 실행 시 `syntax error at or near "NOT"` (`CREATE TABLE IF NOT EXISTS IF NOT EXISTS ...` 구문 오류) 표출.
- **수정 이유**: `DevDataUploader.tsx`의 DDL 생성기가 `schema.sql` 파싱 중 `IF NOT EXISTS`를 중복 병합하던 버그.
- **해결 조치**:
  1. `schema.sql` 내 `inspection_checklist_items` 구문을 표준 `CREATE TABLE`로 정정.
  2. `DevDataUploader.tsx` 정규식 파서 중복 병합 차단 조치.

### 2. 주요 수정 파일
- `schema.sql`, `DevDataUploader.tsx`

### 3. 빌드 및 검증
- TypeScript `npx tsc -b` 컴파일 오류 없음 확인 ✅ (Exit code: 0)

---
**기록 일시**: 2026-08-09 18:57  
**작성 버전**: `v1.62.2.Build.149`
