# 개발 지시 및 개편 완료 내역 (dev_temp.md)

## 🎨 [완료] 850px 고정 높이 → 100dvh 동적 뷰포트 근본 수정 + 하단 5px 여백 (v1.38.0.Build.123)

### 1. 근본 원인 확인 및 수정
- **진짜 원인 발견**: `App.tsx`의 최상위 루트 div에 `height: '850px', maxHeight: '850px'`로 픽셀 고정값이 하드코딩되어 있었음.
  - 어떤 모니터 해상도여도 850px이 상한선이므로, 내부의 flex fill / calc(100vh - N) 등 모든 수식이 무의미했음.
- **수정**: `height: '100dvh', maxHeight: '100dvh'` — 100% 동적 뷰포트 높이로 변경.
- **사이드바+메인 래퍼 div**: `height: 'calc(850px - 64px)'` 고정 제거 → `flex: 1, minHeight: 0`으로 변경.
- **main 하단 여백**: `padding: '16px 20px 5px 20px'` — 하단 5px 여백 확보.

### 2. 주요 수정 파일
- `App.tsx`: 루트 div `height: 850px` → `100dvh`, 사이드바 래퍼 `calc(850px-64px)` → `flex:1 minHeight:0`, main paddingBottom 5px 적용.

### 3. 빌드 및 검증
- TypeScript `npx tsc -b` 컴파일 오류 없음 확인 ✅ (Exit code: 0)

---
**기록 일시**: 2026-08-09 16:24  
**작성 버전**: `v1.38.0.Build.123`
