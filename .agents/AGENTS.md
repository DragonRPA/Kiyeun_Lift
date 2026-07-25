# Project Rules & Guidelines

## Supabase 데이터베이스 용량 제약 사항 및 분할 적재 규칙
- Supabase SQL Editor의 1MB 내외 페이로드 용량 제한을 우회하기 위해, 1,000건 이상의 모의 데이터 또는 마이그레이션 스크립트를 작성하여 DB에 시딩할 때는 **500KB 이하(또는 1,500행 이하)**의 크기로 순차 분할해야 합니다.
- 분할 시 비즈니스 시간축 흐름에 의거하여 외래키 참조 무결성이 지켜지도록 순서(Part 1 -> Part 2 -> Part 3...)를 엄격히 강제 준수하십시오.
- 세부 사항은 [SUPABASE_LIMITS.md](file:///d:/GoogleDrive/RPA%20개발/01.AntiGravity/Kiyuen_Lift/SUPABASE_LIMITS.md) 문서를 참고하십시오.

## 사용자 정의 4단계 버전 넘버링 규칙 (Custom 4-part Versioning)
- **버전 형식**: `vX.Y.Z.Build.N` (예: `v1.1.1.Build.00000`)
- **버전 증가 규칙**:
  1. **X (Major / 첫번째 값)**: 초대형 메이저 플랫폼 개편 시 1 증가
  2. **Y (Minor / 두번째 값)**: **신규 메뉴 추가 또는 DB 스키마/테이블 증가 시** 1 증가
  3. **Z (Feature / 세번째 값)**: **기존 메뉴의 새 기능 추가, 폼/기능 확장 및 리팩토링 개편 시** 1 증가
  4. **Build.N (Build / 네번째 값)**: **모든 형태의 오류/버그 수정(Hotfix/Bugfix)**, 오타 수정, UI 단순 미세 조정 시 5자리 Build 번호 1 증가 (`Build.00001`, `Build.00002`...)
- 모든 Git 커밋 및 `RELEASE_NOTES.md` 작성 시 위 버전 표기 규칙과 배포 날짜/구체적 시간 정보(예: `2026-07-25 17:11`)를 예외 없이 상시 표기합니다.

## Vercel 배포 정책 (Deployment Policy)
- **main 브랜치 단독 배포 원칙**: Vercel 무료 플랜의 일일 배포 100회 한도 소진을 방지하기 위해, `feature/*` 브랜치 push는 Preview 배포를 트리거하지 않도록 설정한다. **Production 배포는 `main` 브랜치 push 시에만 트리거**된다.
- **커밋 일괄 처리 원칙**: UI 미세 조정, 오타 수정 등 기능에 영향 없는 소규모 변경사항은 로컬(`npm run dev`)에서 먼저 테스트한 뒤, **여러 건을 묶어 1회 커밋/푸시**한다. 수정마다 즉시 푸시하지 않는다.
- **push 명령 통일**: `git push origin feature/next-step:main` 방식으로 항상 `main`에 직접 반영하며, feature 브랜치 단독 push(`git push origin feature/next-step`)는 배포 한도를 낭비하므로 금지한다.
- **배포 한도 소진 시**: `npx vercel --prod --token <TOKEN> --yes` 로 수동 배포 재시도하며, 한도 초과(`api-deployments-free-per-day`) 오류 시 롤링 24시간 윈도우 해소를 기다린다.

## Supabase 배열 컬럼 파싱 안전 규칙 (Array Column Safety)
- Supabase `text[]` 배열 컬럼은 클라이언트에서 JS 배열, JSON 문자열(`["A","B"]`), PostgreSQL 배열 문자열(`{"A","B"}`) 등 **다양한 형식으로 반환될 수 있다**.
- 배열 컬럼을 렌더링할 때는 `Array.isArray` → `JSON.parse` → PostgreSQL `{}` 파싱 순으로 방어 처리하거나, **`JSON.stringify(rawData)`로 직렬화한 뒤 알려진 키워드를 스캔**하는 방식을 사용하여 어떤 형식이든 동작하도록 보장한다.
