# Project Rules & Guidelines

## Supabase 데이터베이스 용량 제약 사항 및 분할 적재 규칙
- Supabase SQL Editor의 1MB 내외 페이로드 용량 제한을 우회하기 위해, 1,000건 이상의 모의 데이터 또는 마이그레이션 스크립트를 작성하여 DB에 시딩할 때는 **500KB 이하(또는 1,500행 이하)**의 크기로 순차 분할해야 합니다.
- 분할 시 비즈니스 시간축 흐름에 의거하여 외래키 참조 무결성이 지켜지도록 순서(Part 1 -> Part 2 -> Part 3...)를 엄격히 강제 준수하십시오.
- 세부 사항은 [SUPABASE_LIMITS.md](file:///d:/GoogleDrive/RPA%20개발/01.AntiGravity/Kiyuen_Lift/SUPABASE_LIMITS.md) 문서를 참고하십시오.
