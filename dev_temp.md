# 개발 지시 및 개편 완료 내역 (dev_temp.md)

## 🎨 [완료] 다크 모드 그룹박스/카드 내부 하드코딩 배경색 전사 CSS 변수 통일 (v1.41.0.Build.126)

### 1. 사장님 지시사항
- 다크 모드에서 카드 내부의 그룹박스(필터 영역, 알림 박스, 선택 항목 등)가 흰색/밝은 배경으로 나타나는 불일치 현상 전사 점검 및 수정

### 2. 전수 점검 결과 및 수정 파일

| 파일 | 위치 | 기존 하드코딩값 | 변경값 |
|---|---|---|---|
| `Billings.tsx` | 청구월 셀렉트 입력창 | `#fff` | `var(--bg-card)` |
| `Billings.tsx` | 2행 필터 그룹박스 | `#f8fafc` / `#e2e8f0` | `var(--bg-app)` / `var(--border-color)` |
| `Contracts.tsx` | 교체 경고 박스 | `#fff7ed` / `#fed7aa` | `var(--warning-light)` / `var(--warning)` |
| `Contracts.tsx` | 시간대 셀렉트 | `#fff` | `var(--bg-card)` |
| `Contracts.tsx` | 장바구니 태그 아이템 | `#fff` | `var(--primary-light)` |
| `Contracts.tsx` | 정보 알림 박스 | `#eff6ff` / `#bfdbfe` | `var(--info-light)` / `var(--info)` |
| `asset_assignment.tsx` | 대차할당대기 알림 박스 | `#fff7ed` / `#f97316` | `var(--warning-light)` / `var(--warning)` |
| `asset_assignment.tsx` | 검색 필터 헤더 | `#f8fafc` | `var(--bg-app)` |
| `asset_assignment.tsx` | 검색 입력창 | `#fff` | `var(--primary-light)` |
| `asset_assignment.tsx` | 진행률 바 트랙 | `#e5e7eb` | `var(--border-color)` |

- `smart_dispatch.tsx`, `Consumables.tsx`의 인쇄 시트 내부 흰색 배경은 **실물 인쇄용 문서**이므로 의도적으로 유지.

### 3. 빌드 및 검증
- TypeScript `npx tsc -b` 컴파일 오류 없음 확인 ✅ (Exit code: 0)

---
**기록 일시**: 2026-08-09 16:40
**작성 버전**: `v1.41.0.Build.126`
