# 개발 지시 및 개편 완료 내역 (dev_temp.md)

## 📅 [완료] 임직원 연차 갱신/소진 관리 & OT 연장근무 메뉴 및 권한 체계 신설 (v1.21.0.Build.101)

### 1. 사장님 개편 지시 사항 반영
- **입사일(`joinDate`) 주기 연차 관리**: 임직원의 입사일을 기준으로 매 1년 단위 갱신 주기를 자동 계산.
- **1년 부여 연차 일수 갱신 모달**: 갱신 주기가 도래했을 때 "이번 1년 동안 부여될 연차 갯수"를 사용자에게 질문/입력받아 부여 일수 갱신.
- **연차 / 반차 차감**: 연차 (1.0일 차감) / 오전반차 (0.5일 차감) / 오후반차 (0.5일 차감) 단위로 소진 관리.
- **OT (연장근무) 발생 관리**: 개인별 시작 일시(`YYYY-MM-DD HH:mm`), OT 시간 수(`hours`: 예 2.5시간) 및 근무 상세 입력/누적 집계.
- **메뉴 권한 연동**: `leave_ot` (연차/OT 관리) 신규 메뉴 등록 및 `users_permissions.tsx` 권한 관리 연동.

### 2. 주요 개편 구현 내용

#### [신설] `src/pages/LeaveOtPage.tsx` (연차/OT 관리 화면)
- **탭 1: 임직원 연차 갱신/현장 대장**: 임직원별 입사일, 현재 1년 주기, 부여 연차, 소진 연차, 잔여 연차, 누적 OT시간 집계 및 `[연차 부여 갯수 갱신]` 모달 팝업 지원.
- **탭 2: 연차/반차 소진 신청 이력**: 연차(1일)/반차(0.5일) 구분 선택, 기간 지정 및 사유 등록 ➔ 잔여 연차 차감 및 이력 표출.
- **탭 3: OT 연장근무 관리**: 시작 일시, OT 시간 수, 근무 상세 입력 ➔ 개인별 누적 OT 시간 집계 및 이력 표출.
- **전사 UI/UX 표준 엄격 준수**: leftmost Column 1 액션 버튼, `white-space: nowrap` 줄바꿈 방지, 상하 세로 스택 구조 폼, 건조한 전문 용어만 사용.

#### [개편] `src/services/db.ts` & `src/context/AppContext.tsx`
- `User` 인터페이스에 `joinDate?: string;` (입사일 YYYY-MM-DD) 확장.
- `AnnualLeaveQuota`, `LeaveUsage`, `OvertimeRecord` 신규 스키마 및 CUD 전역 mutator 연동.

#### [개편] `src/config/menuConfig.ts`, `src/config/menu_config.ts`, `users_permissions.tsx`, `App.tsx`
- `leave_ot` 메뉴 및 권한 연동 완결.

### 3. 빌드 및 검증
- TypeScript `npx tsc -b` 컴파일 오류 없음 확인 ✅ (Exit code: 0)

---
**기록 일시**: 2026-08-09 13:15  
**작성 버전**: `v1.21.0.Build.101`
