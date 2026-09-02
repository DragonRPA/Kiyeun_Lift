import os
import sys
sys.stdout.reconfigure(encoding='utf-8')

skelton_dir = r"D:\01.AntiGravity\000.skelton"
if os.path.exists(skelton_dir):
    print("Skelton directory exists:")
    for root, dirs, files in os.walk(skelton_dir):
        rel = os.path.relpath(root, skelton_dir)
        print(f"[{rel}]")
        for f in files:
            if not f.startswith('.git'):
                print(f"  - {f}")
else:
    print("Skelton directory NOT found!")
