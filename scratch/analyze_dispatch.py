import pandas as pd
import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = r"D:\OneDrive\Desktop\기연리프트자료_\자동업로드\배차현황(new) (1).xlsx"
xl = pd.ExcelFile(filepath)

print("=== 시트 목록 ===")
for i, name in enumerate(xl.sheet_names):
    print(f"  [{i}] {name}")

print("\n=== 각 시트 구조 분석 ===\n")
for sheet_name in xl.sheet_names:
    df = xl.parse(sheet_name, header=None)
    print(f"--- 시트: '{sheet_name}' ---")
    print(f"  행×열: {df.shape[0]} × {df.shape[1]}")
    print(f"  첫 5행:")
    for i in range(min(5, len(df))):
        row_vals = [str(v)[:20] if str(v) != 'nan' else '' for v in df.iloc[i].tolist()]
        non_empty = [(j, v) for j, v in enumerate(row_vals) if v]
        print(f"    Row{i}: {non_empty[:15]}")
    print()
