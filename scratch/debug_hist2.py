import pandas as pd
import sys, datetime
sys.stdout.reconfigure(encoding='utf-8')

filepath = r"D:\OneDrive\Desktop\기연리프트자료_\자동업로드\초기DB현황1.xlsx"
xl = pd.ExcelFile(filepath)
df = xl.parse('계약현황', header=None)

data = df.iloc[3:]
cutoff = datetime.datetime(2026, 8, 1)

def to_date(val):
    try:
        if isinstance(val, (int, float)):
            return datetime.datetime(1899, 12, 30) + datetime.timedelta(days=int(val))
        elif isinstance(val, datetime.datetime):
            return val
        elif isinstance(val, str):
            return datetime.datetime.strptime(val[:10].replace('.', '-'), '%Y-%m-%d')
    except:
        return None

print("=== Col[3] 최초개시일 vs Col[4] 개시일 비교 (장비 있는 행만) ===\n")

col3_before = 0
col4_before = 0
total = 0

expected_col3 = 0  # Col[3] 기준 소급 빌링 건수

for idx, row in data.iterrows():
    col9 = row[9]
    col12 = row[12]
    has_asset = (str(col9) != 'nan' and str(col9).strip() != '') or \
                (str(col12) != 'nan' and str(col12).strip() != '')
    if not has_asset:
        continue
    total += 1
    
    d3 = to_date(row[3])
    d4 = to_date(row[4])
    
    if d3 and d3 < cutoff:
        col3_before += 1
        months = (cutoff.year - d3.year) * 12 + (cutoff.month - d3.month)
        expected_col3 += months
    if d4 and d4 < cutoff:
        col4_before += 1

print(f"  전체 장비 행: {total}건")
print(f"  Col[3] 최초개시일 < 2026-08-01: {col3_before}건")
print(f"  Col[4] 개시일    < 2026-08-01: {col4_before}건")
print(f"\n  Col[3] 기준 예상 소급 청구서: {expected_col3:,}건")
print(f"  Col[4] 기준 현재 소급 청구서: 12건")

print("\n=== Col[3] 최초개시일 분포 (상위 15개월) ===")
from collections import Counter
dist = Counter()
for idx, row in data.iterrows():
    col9 = row[9]
    col12 = row[12]
    has_asset = (str(col9) != 'nan' and str(col9).strip() != '') or \
                (str(col12) != 'nan' and str(col12).strip() != '')
    if not has_asset:
        continue
    d3 = to_date(row[3])
    if d3 and d3 < cutoff:
        dist[d3.strftime('%Y-%m')] += 1

print(f"  소급 대상 연월 분포:")
for ym, cnt in sorted(dist.items()):
    print(f"    {ym}: {cnt}건")
    
print(f"\n  총 {sum(dist.values())}행이 소급 대상 (Col[3] 기준)")
