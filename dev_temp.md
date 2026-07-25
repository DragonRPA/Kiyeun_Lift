# 개발 요청 임시 기록 (dev_temp.md)

## 미반영 요구사항 목록

### [1] DDL 패치 42710 오류 근본 원인 수정 (DevDataUploader.tsx)
- 이슈 테이블이 sqlPatch+rlsPatch에 중복 출력되던 구조 수정
- OK 테이블만 rlsPatch에 추가, 이슈 테이블은 sqlPatch에만 포함
- 파일: src/pages/DevDataUploader.tsx
- 상태: 코드 수정 완료, 커밋 대기

### [2] 글로벌 정책 - ㄹㅇ 단축어 변경
- ㄹㅇ 실행 시 Vercel 배포 제외, 커밋+푸시만 실행
- 파일: C:\Users\이정용\.gemini\config\AGENTS.md
- 상태: 수정 완료, 커밋 대기

### [3] Vendors.tsx 토글 버튼 버그 수정 (handleOpenEditModal)
- 원인: v.types가 Supabase에서 문자열로 반환될 경우 String.length 체크가 통과되어
  selectedTypes에 원시 문자열이 set됨. includes()는 substring 검사로 전부 true가 되고
  filter()는 문자열에 없는 메서드라 RuntimeError 발생
- 수정: renderTypePills와 동일한 키워드 스캔 방식으로 selectedTypes 초기화
- 파일: src/pages/Vendors.tsx (handleOpenEditModal)
- 상태: 코드 수정 완료, 커밋 대기

마지막 업데이트: 2026-07-26 02:33
