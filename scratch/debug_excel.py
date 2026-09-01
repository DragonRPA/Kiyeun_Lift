import pandas as pd
import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = r"D:\OneDrive\Desktop\기연리프트자료_\자동업로드\초기DB현황1.xlsx"
xl = pd.ExcelFile(filepath)

# 계약현황 시트 읽기 (헤더 없이 raw 읽기)
df = xl.parse('계약현황', header=None)

print("=== 계약현황 시트 전체 컬럼 수:", df.shape[1])
print("\n=== 1~4행 raw 데이터 (헤더 구조 파악용):")
for i in range(min(4, len(df))):
    row = df.iloc[i].tolist()
    print(f"  Row {i}: {row}")

print("\n=== 5번째 행 (첫 데이터행) 전체 컬럼별 값:")
if len(df) >= 3:
    data_row = df.iloc[2]
    for col_idx, val in enumerate(data_row):
        print(f"  Col[{col_idx}] = {repr(val)}")
