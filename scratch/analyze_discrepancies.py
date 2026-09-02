import os
import pandas as pd
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

base_dir = r"D:\OneDrive\Desktop\기연리프트자료_\자동업로드"

# 경기 명세서 미매핑 및 금액 불일치 세부 분석
f_g = os.path.join(base_dir, "(주)기연 리프트 7월 거래내역(경기서명)..xlsx")
df_g = pd.read_excel(f_g, sheet_name="26년7월", header=None)

print("=== 경기 명세서 샘플 행 분석 ===")
for idx, r in df_g.iloc[10:25].iterrows():
    print(f"행 {idx+1}: 일자={r[0]}, 상차지={r[1]}, 하차지={r[2]}, 차종={r[3]}, 단가={r[4]}, 수량={r[5]}, 합계={r[6]}, 비고={r[7]}")

# 자인 명세서 비고 분석 (할증 사유 등)
f_z = os.path.join(base_dir, "기연 7월거래명세표(자인서명).xlsx")
df_z = pd.read_excel(f_z, sheet_name="Sheet1", header=None)
print("\n=== 자인 명세서 특이사항/비고 분석 ===")
for idx, r in df_z.iloc[13:].iterrows():
    note = str(r[8]).strip() if pd.notna(r[8]) and str(r[8]) != 'nan' else ''
    if note:
        print(f"행 {idx+1}: 일자={r[1]}, 현장={r[6]}, 업체={r[7]}, 운송비={r[5]}, 비고=[{note}]")
