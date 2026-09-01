import pandas as pd
import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = r"D:\OneDrive\Desktop\기연리프트자료_\자동업로드\초기DB현황1.xlsx"
xl = pd.ExcelFile(filepath)

sheets_to_check = {
    '계약현황': 2,      # 실제 헤더가 있는 행 인덱스 (0-based)
    '보유자산현황': 2,
    '거래처정보현황': 1,
    '업체별마감일자': 1,
}

for sheet_name, header_row in sheets_to_check.items():
    if sheet_name not in xl.sheet_names:
        print(f"\n[!] Sheet '{sheet_name}' NOT FOUND in file!")
        continue
    df = xl.parse(sheet_name, header=None)
    if header_row >= len(df):
        print(f"\n[!] Sheet '{sheet_name}' has fewer than {header_row+1} rows!")
        continue
    header = df.iloc[header_row].tolist()
    print(f"\n=== '{sheet_name}' 헤더 (Row {header_row}) ===")
    for idx, col in enumerate(header):
        print(f"  [{idx:02d}] {col}")
    
    # 중복 헤더 체크
    seen = {}
    dupes = []
    for idx, col in enumerate(header):
        if col and str(col) != 'nan':
            key = str(col).replace(' ','').lower()
            if key in seen:
                dupes.append((key, seen[key], idx))
            else:
                seen[key] = idx
    if dupes:
        print(f"\n  ⚠️ 중복 헤더 발견:")
        for key, first_idx, dup_idx in dupes:
            print(f"    '{key}': Col[{first_idx}] vs Col[{dup_idx}] → Col[{dup_idx}]는 Map에서 무시됨!")
