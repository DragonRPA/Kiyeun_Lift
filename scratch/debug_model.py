import pandas as pd
import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = r"D:\OneDrive\Desktop\기연리프트자료_\자동업로드\초기DB현황1.xlsx"
xl = pd.ExcelFile(filepath)
df = xl.parse('계약현황', header=None)

print("=== 전대 장비만 있는 행 (Col[9]=빈값, Col[12]=장비명) 상위 10건 ===")
# Row 3부터가 데이터
data = df.iloc[3:]

count = 0
for idx, row in data.iterrows():
    col9 = row[9]   # 당사 장비명
    col12 = row[12] # 전대 장비명
    col3 = row[3]   # 최초개시일
    col4 = row[4]   # 개시일
    
    is_col9_empty = (str(col9) == 'nan' or str(col9).strip() == '')
    is_col12_present = (str(col12) != 'nan' and str(col12).strip() != '')
    
    if is_col9_empty and is_col12_present and count < 10:
        print(f"\n  엑셀 Row {idx}:")
        print(f"    Col[3] 최초개시일 = {repr(col3)}  ← getCol fallback=3 이면 이 값이 모델명이 됨!")
        print(f"    Col[4] 개시일     = {repr(col4)}")
        print(f"    Col[9] 당사장비명 = {repr(col9)}  (빈값)")
        print(f"    Col[12] 전대장비명 = {repr(col12)}  ← 실제 원하는 값")
        print(f"    Col[13] 전대관리번호 = {repr(row[13])}")
        count += 1

print(f"\n총 {count}건 발견")

# 날짜 시리얼 숫자 예시 확인
print("\n=== Excel 날짜 시리얼 숫자 예시 ===")
print("  Excel에서 날짜 셀은 숫자로 저장됨 (xlsx 라이브러리 기본 파싱 시)")
import datetime
for serial in [45693, 45845, 46119, 46261]:
    # Excel serial to date: 1900-01-01 = 1
    try:
        dt = datetime.datetime(1899, 12, 30) + datetime.timedelta(days=serial)
        print(f"  {serial} → {dt.strftime('%Y-%m-%d')}")
    except:
        pass
