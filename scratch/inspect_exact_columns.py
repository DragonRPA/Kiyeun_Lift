import os
import pandas as pd
import sys
sys.stdout.reconfigure(encoding='utf-8')

base_dir = r"D:\OneDrive\Desktop\기연리프트자료_\자동업로드"

# 1. 엘제이 명세서 컬럼 정확 분석
f_lj = os.path.join(base_dir, "7월 기연리프트(엘제이서명).xlsx")
df_lj = pd.read_excel(f_lj, sheet_name="거래명세표", header=None)
print("=== 엘제이 명세서 상위 데이터 행 13~18 ===")
for r_idx in range(13, 19):
    print(f"행 {r_idx}:")
    for c_idx, val in enumerate(df_lj.iloc[r_idx]):
        if pd.notna(val) and str(val).strip():
            print(f"  Col[{c_idx}]: {val}")

# 2. 자인 명세서 상위 데이터 행 12~17
f_z = os.path.join(base_dir, "기연 7월거래명세표(자인서명).xlsx")
df_z = pd.read_excel(f_z, sheet_name="Sheet1", header=None)
print("\n=== 자인 명세서 상위 데이터 행 12~16 ===")
for r_idx in range(12, 17):
    print(f"행 {r_idx}:")
    for c_idx, val in enumerate(df_z.iloc[r_idx]):
        if pd.notna(val) and str(val).strip():
            print(f"  Col[{c_idx}]: {val}")
