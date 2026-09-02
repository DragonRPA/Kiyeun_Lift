import pandas as pd
import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = r"D:\OneDrive\Desktop\기연리프트자료_\자동업로드\배차현황(new) (1).xlsx"
xl = pd.ExcelFile(filepath)

companies = {}
total_rows = 0
empty_rows = 0

for sheet in xl.sheet_names:
    df = xl.parse(sheet, header=None)
    data = df.iloc[1:]
    for idx, row in data.iterrows():
        model_raw = str(row[4]).strip() if row[4] is not None and str(row[4]) != 'nan' else ''
        if not model_raw or model_raw == 'nan' or model_raw.startswith('('):
            continue
        total_rows += 1
        
        # Col[11] = 운반업체
        c_raw = str(row[11]).strip() if row[11] is not None and str(row[11]) != 'nan' else ''
        if c_raw:
            companies[c_raw] = companies.get(c_raw, 0) + 1
        else:
            empty_rows += 1

print(f"=== 엑셀 배차현황 Col[11] 운반업체 전수 분석 ===")
print(f"총 유효 배차 행: {total_rows}건")
print(f"운반업체 기재 행: {total_rows - empty_rows}건 ({(total_rows - empty_rows)/total_rows*100:.1f}%)")
print(f"운반업체 미기재(빈칸): {empty_rows}건\n")

print(f"등장한 운반업체 종류 ({len(companies)}개 사):")
for name, cnt in sorted(companies.items(), key=lambda x: x[1], reverse=True):
    print(f"  - {name}: {cnt}건")
