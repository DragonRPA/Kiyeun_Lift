import pandas as pd
import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = r"D:\OneDrive\Desktop\기연리프트자료_\자동업로드\초기DB현황1.xlsx"
xl = pd.ExcelFile(filepath)

# 계약현황 시트 읽기 (헤더 없이 raw 읽기)
df = xl.parse('계약현황', header=None)

print("=== 첫 데이터 행 (Row 3) 당사/전대 관리번호 확인:")
# Row 0 = 날짜행, Row 1 = 카테고리행, Row 2 = 실제 헤더, Row 3 = 첫 데이터
data_rows = df.iloc[3:20]
print(f"  Col[10] (당사 관리번호): {[str(r) for r in data_rows.iloc[:,10].tolist()[:10]]}")
print(f"  Col[13] (전대 관리번호): {[str(r) for r in data_rows.iloc[:,13].tolist()[:10]]}")
print(f"  Col[15] (임차업체):    {[str(r) for r in data_rows.iloc[:,15].tolist()[:10]]}")
print(f"  Col[9] (장비명-당사):  {[str(r) for r in data_rows.iloc[:,9].tolist()[:10]]}")
