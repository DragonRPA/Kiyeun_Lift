import pandas as pd
import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = r"D:\OneDrive\Desktop\기연리프트자료_\자동업로드\초기DB현황1.xlsx"
xl = pd.ExcelFile(filepath)
df = xl.parse('계약현황', header=None)

data = df.iloc[3:]  # Row 3부터 데이터

print("=== 계약현황 계약 개시일(Col[4]) 분석 ===\n")

before_2026_08 = 0    # 과거 소급 대상 (2026-08-01 이전 개시)
on_or_after = 0       # 당월 이후 개시
no_date = 0
date_errors = 0

import datetime

def excel_serial_to_date(val):
    """Excel 시리얼 숫자 -> datetime"""
    try:
        if isinstance(val, (int, float)):
            return datetime.datetime(1899, 12, 30) + datetime.timedelta(days=int(val))
        elif isinstance(val, datetime.datetime):
            return val
        elif isinstance(val, str):
            return datetime.datetime.strptime(val[:10].replace('.', '-'), '%Y-%m-%d')
    except:
        return None

cutoff = datetime.datetime(2026, 8, 1)

sample_before = []
sample_after = []

for idx, row in data.iterrows():
    col4 = row[4]   # 개시일
    col3 = row[3]   # 최초개시일
    col9 = row[9]   # 당사 장비명
    col12 = row[12] # 전대 장비명
    
    # 장비 없는 행 건너뜀
    has_asset = (str(col9) != 'nan' and str(col9).strip() != '') or \
                (str(col12) != 'nan' and str(col12).strip() != '')
    if not has_asset:
        continue
    
    dt = excel_serial_to_date(col4)
    
    if dt is None:
        no_date += 1
        continue
    
    if dt < cutoff:
        before_2026_08 += 1
        if len(sample_before) < 5:
            months = (cutoff.year - dt.year) * 12 + (cutoff.month - dt.month)
            sample_before.append((idx, dt.strftime('%Y-%m-%d'), months, col9, col12))
    else:
        on_or_after += 1
        if len(sample_after) < 3:
            sample_after.append((idx, dt.strftime('%Y-%m-%d'), col9, col12))

print(f"  개시일 < 2026-08-01 (소급 대상): {before_2026_08}건")
print(f"  개시일 >= 2026-08-01 (당월 이후): {on_or_after}건")
print(f"  개시일 없음: {no_date}건")

print(f"\n  소급 대상 예시 (최대 5건):")
for s in sample_before:
    print(f"    Row {s[0]}: 개시일={s[1]}, 소급월수={s[2]}개월, 장비={s[3] if str(s[3])!='nan' else s[4]}")

# 실제 소급 빌링 건수 추정: 각 행이 몇 달치를 생성하는지
total_expected_billings = 0
for idx, row in data.iterrows():
    col4 = row[4]
    col9 = row[9]
    col12 = row[12]
    
    has_asset = (str(col9) != 'nan' and str(col9).strip() != '') or \
                (str(col12) != 'nan' and str(col12).strip() != '')
    if not has_asset:
        continue
    
    dt = excel_serial_to_date(col4)
    if dt is None or dt >= cutoff:
        continue
    
    months = (cutoff.year - dt.year) * 12 + (cutoff.month - dt.month)
    total_expected_billings += months  # 각 행이 생성하는 청구서 건수

print(f"\n  이론적 예상 소급 청구서 건수: {total_expected_billings:,}건")
print(f"  실제 생성된 소급 청구서: 12건")
print(f"\n  → 12건이 나오는 이유를 분석합니다...")

# 가설: contractGroupKey로 묶어서 계약 단위로 1건씩만 생성하는 것인가?
# 아니면 deduplication이 있는가?
print("\n=== 개시일 분포 ===")
from collections import Counter
month_dist = Counter()
for idx, row in data.iterrows():
    col4 = row[4]
    col9 = row[9]
    col12 = row[12]
    has_asset = (str(col9) != 'nan' and str(col9).strip() != '') or \
                (str(col12) != 'nan' and str(col12).strip() != '')
    if not has_asset:
        continue
    dt = excel_serial_to_date(col4)
    if dt and dt < cutoff:
        ym = dt.strftime('%Y-%m')
        month_dist[ym] += 1

for ym, cnt in sorted(month_dist.items())[-12:]:
    print(f"  {ym}: {cnt}건")
