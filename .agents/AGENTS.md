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
