# 개발 지시 및 개편 완료 내역 (dev_temp.md)

## 🎨 [완료] 다크 모드 입력폼(input/select/textarea) 배경색 일관성 강제 통일 (v1.40.0.Build.125)

### 1. 사장님 지시사항
- 다크 모드에서 리스트박스, 콤보박스, 날짜입력창 등의 배경색이 흰색으로 튀어나와 일관성이 없음 → 다크 테마로 통일

### 2. 근본 원인
- 브라우저(Chrome 등)가 `input[type="date"]`, `input[type="month"]`, `select` 등의 특수 폼 요소에 **OS/브라우저 기본 흰색 배경을 강제로 적용**하여 CSS의 `background-color: var(--bg-card)`를 무시함.

### 3. 수정 내용 (`index.css`)
- `[data-theme='dark']` 선택자로 **모든 input/select/textarea 타입에 `!important` 강제 오버라이드** 적용.
- `color-scheme: dark` 속성을 다크 모드 입력 요소에 명시하여 **브라우저 날짜 피커 팝업 UI도 다크 테마**로 통일.
- 라이트 테마에는 `color-scheme: light` 명시.
- placeholder 색상도 `var(--text-muted)`로 통일.

### 4. 빌드 및 검증
- TypeScript `npx tsc -b` 컴파일 오류 없음 확인 ✅ (Exit code: 0)

---
**기록 일시**: 2026-08-09 16:35
**작성 버전**: `v1.40.0.Build.125`
