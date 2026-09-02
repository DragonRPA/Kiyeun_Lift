import os
import pandas as pd
import sys
sys.stdout.reconfigure(encoding='utf-8')

base_dir = r"D:\OneDrive\Desktop\기연리프트자료_\자동업로드"

files = [
    "7월 기연리프트(엘제이서명).xlsx",
    "(주)기연 리프트 7월 거래내역(경기서명).xlsx",
    "기연 7월거래명세표(자인서명).xlsx"
]

# 혹시 파일명이 긴 경우를 대비해 디렉토리 내 파일 목록 검색
actual_files = os.listdir(base_dir)
print("=== 디렉토리 내 전체 파일 목록 ===")
for f in actual_files:
    print(f"  - {f}")

print("\n" + "="*50 + "\n")

for fname in actual_files:
    if "서명" in fname or "거래" in fname or "명세" in fname:
        fpath = os.path.join(base_dir, fname)
        print(f"📁 [분석 대상 파일]: {fname}")
        try:
            xl = pd.ExcelFile(fpath)
            print(f"  시트 목록: {xl.sheet_names}")
            for sheet in xl.sheet_names:
                df = xl.parse(sheet, header=None)
                print(f"  [{sheet}] Shape: {df.shape}")
                print(f"  --- 상위 10행 미리보기 ---")
                for r_idx in range(min(10, len(df))):
                    row_vals = [str(x) if pd.notna(x) else "" for x in df.iloc[r_idx].values]
                    # 빈 칸이 너무 많으면 축약
                    print(f"    행 {r_idx:2d}: {row_vals[:12]}")
                print()
        except Exception as e:
            print(f"  ❌ 파일 읽기 오류: {e}")
        print("-" * 50)
