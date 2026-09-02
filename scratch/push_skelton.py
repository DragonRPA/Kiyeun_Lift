import subprocess
import os

skelton_dir = r"D:\01.AntiGravity\000.skelton"

def run(cmd_list):
    res = subprocess.run(cmd_list, cwd=skelton_dir, capture_output=True, encoding='utf-8', errors='replace')
    print(" ".join(cmd_list))
    print(res.stdout)
    if res.stderr:
        print("ERR:", res.stderr)

run(['git', 'add', '-A'])
run(['git', 'commit', '-m', '발상: 시선과 업무 동선 일치 Z패턴 UIUX 표준 (2026-09-02 19:12)'])
run(['git', 'push', 'origin', 'main'])
