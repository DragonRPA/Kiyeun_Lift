# 개발 지시 및 개편 완료 내역 (dev_temp.md)

## 🎨 [완료] 라이트 모드 카드/입력창/버튼 둥근 테두리 시인성 강화 (v1.39.0.Build.124)

### 1. 사장님 지시사항
- 밝은 화면 모드의 카드, 입력창, 버튼 등 둥근 모서리 사각형 테두리가 배경과 거의 구분이 안 됨 → 시인성 개선

### 2. 수정 내용
- `--border-color: #cbd5e1` (Slate-300) → **`#94a3b8` (Slate-400)** 으로 짙게 보강
  - 전 메뉴의 카드(.card), 입력창(input, select, textarea), 버튼(.btn-secondary), 테이블 컨테이너 등 `var(--border-color)`를 사용하는 모든 테두리가 일괄 강화됨.
- `--shadow-sm/md/lg`: 불투명도 0.05→0.10으로 그림자 강화

### 3. 주요 수정 파일
- `index.css`: `--border-color` 값 변경

### 4. 빌드 및 검증
- TypeScript `npx tsc -b` 컴파일 오류 없음 확인 ✅ (Exit code: 0)

---
**기록 일시**: 2026-08-09 16:31
**작성 버전**: `v1.39.0.Build.124`
