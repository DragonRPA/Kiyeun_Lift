import pandas as pd
import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = r"D:\OneDrive\Desktop\기연리프트자료_\자동업로드\배차현황(new) (1).xlsx"
xl = pd.ExcelFile(filepath)

print("=== 운반비 이상치(만원 × 10,000 후 > 2,000,000원) 탐색 ===\n")

for sheet in xl.sheet_names:
    df = xl.parse(sheet, header=None)
    data = df.iloc[1:]
    for idx, row in data.iterrows():
        model_raw = str(row[4]).strip() if row[4] is not None and str(row[4]) != 'nan' else ''
        if not model_raw or model_raw == 'nan':
            continue
        try:
            v = row[3]
            if v is not None and str(v) != 'nan':
                cost_raw = float(str(v).replace(',', ''))
                cost = cost_raw * 10000
                if cost > 2000000:  # 20만원 초과
                    print(f"  [{sheet}] 행{idx}: Col[3]='{row[3]}' ({cost:,.0f}원) | 업체={row[6]} | 장비={row[4]}")
        except: pass

print("\n=== PENDING(배차유무 != '완료') 행 목록 ===\n")
for sheet in xl.sheet_names:
    df = xl.parse(sheet, header=None)
    data = df.iloc[1:]
    for idx, row in data.iterrows():
        model_raw = str(row[4]).strip() if row[4] is not None and str(row[4]) != 'nan' else ''
        if not model_raw or model_raw == 'nan':
            continue
        status = str(row[9]).strip() if row[9] is not None and str(row[9]) != 'nan' else ''
        if status != '완료':
            print(f"  [{sheet}] 행{idx}: 배차유무='{status}' | {row[4]} | {row[6]} | {row[7]}")
