import os

with open(r'd:\01.AntiGravity\Kiyuen_Lift\RELEASE_NOTES.md', 'a', encoding='utf-8') as f:
    f.write("\n### v0.7.1.Build.21 (2026-09-01 19:42)\n- **개편사항**: 12개 메뉴 엑셀 다운로드 포맷을 화면 UI와 완벽히 1:1 동기화.\n- **수정사항**: 이전 배포(Build.19~20)에서 발생한 Vercel TypeScript 컴파일 에러를 원천 해결하여 빌드 보장.\n")

os.system('git add -A')
os.system('git commit -m "fix: 엑셀 UI 1:1 동기화 완료 (Build.21)"')
os.system('git push origin main')
