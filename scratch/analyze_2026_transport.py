import pandas as pd
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = r"D:\OneDrive\Desktop\기연리프트자료_\자동업로드\배차현황(new) (1).xlsx"
xl = pd.ExcelFile(filepath)

companies_2026 = {}
companies_2025 = {}

for sheet in xl.sheet_names:
    is_2026 = bool(re.match(r'^26년\s*(\d{1,2})월', sheet))
    df = xl.parse(sheet, header=None)
    data = df.iloc[1:]
    for idx, row in data.iterrows():
        model_raw = str(row[4]).strip() if row[4] is not None and str(row[4]) != 'nan' else ''
        if not model_raw or model_raw == 'nan' or model_raw.startswith('(') or re.match(r'^\d{4,}$', model_raw):
            continue
        
        c_raw = str(row[11]).strip() if row[11] is not None and str(row[11]) != 'nan' else ''
        if c_raw:
            if is_2026:
                companies_2026[c_raw] = companies_2026.get(c_raw, 0) + 1
            else:
                companies_2025[c_raw] = companies_2025.get(c_raw, 0) + 1

print("=== 2026년 이후 거래된 운송사 ===")
for name, cnt in sorted(companies_2026.items(), key=lambda x: x[1], reverse=True):
    print(f"  - {name}: {cnt}건")

print("\n=== 2025년 거래된 운송사 ===")
for name, cnt in sorted(companies_2025.items(), key=lambda x: x[1], reverse=True):
    print(f"  - {name}: {cnt}건")
