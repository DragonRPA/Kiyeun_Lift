import os

with open(r'd:\01.AntiGravity\Kiyuen_Lift\RELEASE_NOTES.md', 'a', encoding='utf-8') as f:
    f.write("\n### v0.7.1.Build.22 (2026-09-01 20:10)\n- **버그수정**: 초기DB 업로드(마이그레이션) 시 당사장비와 전대장비의 '관리번호' 엑셀 컬럼 인덱스 참조 오류로 인해 자산이 '미지정'으로 할당되던 치명적 결함 수정.\n")

os.system('git add -A')
os.system('git commit -m "fix: 초기DB 업로드 시 자산 미지정 버그 수정 (엑셀 컬럼 매핑 인덱스 교정)"')
os.system('git push origin main')
