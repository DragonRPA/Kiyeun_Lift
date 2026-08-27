# 개발 지시 및 개편 완료 내역 (dev_temp.md)

## 🚀 [제품 및 출고 시스템] 53개 장비 모델 제원표 PDF 자동 파싱·DB 일괄 주입 및 미리보기 탑재 (v1.129.0.Build.254)

### 1. 사장님 지시사항 완벽 이행
- **지정 경로 순회 및 제원표 문서 전수 탐색**:
  - `D:\OneDrive\Desktop\기연리프트자료_\정규문서\00.제품별문서` 하위 폴더 전체 순회.
  - "제원표" 포함 PDF 총 **53개 파일** 전수 발견 및 판독 완료.
- **13대 제원 규격 정밀 추출**:
  - 작업높이, 발판높이, 장비중량, 적재중량, 장비크기, 플랫폼크기, 등판능력, 주행속도, 동력, A/S접수처, 확장 전/후 분배하중(본체/확장부), 최대허용풍속 100% 추출.
- **스키마 확장 및 DB 일괄 주입 준비**:
  - `products` 테이블 13대 제원 컬럼 신설 (`patch_v1_129_product_spec_schema.sql`).
  - 53개 모델 DB 일괄 Upsert 스크립트(`scripts/seed_products_spec_53.sql`) 및 `src/services/db.ts` 시드 데이터 생성 완료.
- **UI 뷰어 탑재**:
  - `Products.tsx` 화면에서 각 모델별 `[제원표]` 버튼 클릭 시 실물 서식과 100% 동일한 규격표/다이어그램 즉시 팝업 표출.

### 2. 주요 수정/신규 파일
- `src/services/db.ts`: `Product` 인터페이스 확장 및 53개 모델 시드 주입
- `src/pages/Products.tsx`: 제원표 입력 폼 및 실물 서식 팝업 뷰어 구현
- `schema.sql`, `scripts/supabase_patch.sql`: products 테이블 DDL 확장
- `scripts/patch_v1_129_product_spec_schema.sql`: 13대 컬럼 추가 패치 DDL
- `scripts/seed_products_spec_53.sql`: 53개 모델 일괄 주입 SQL

### 3. 빌드 및 검증
- TypeScript `npx tsc -b` 무결점 검증 완료 (오류 0건) ✅

---
**기록 일시**: 2026-08-27 16:14  
**작성 버전**: `v1.129.0.Build.254`




