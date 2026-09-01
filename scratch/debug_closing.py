import pandas as pd
import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = r"D:\OneDrive\Desktop\기연리프트자료_\자동업로드\초기DB현황1.xlsx"
xl = pd.ExcelFile(filepath)

# 업체별마감일자 시트 분석
df = xl.parse('업체별마감일자', header=None)
print("=== 업체별마감일자 시트 전체 구조 ===")
print(f"총 행수: {len(df)}, 총 컬럼수: {len(df.columns)}")
print("\n처음 10행:")
for i in range(min(10, len(df))):
    row = df.iloc[i].tolist()
    print(f"  Row {i}: {row}")

# 실제 데이터 행에서 업체명이 어떻게 되는지
print("\n\n=== 업체별마감일자 데이터 행 분석 (Row 2 이후) ===")
data = df.iloc[2:]
blank_count = 0
normal_count = 0

blank_examples = []
for idx, row in data.iterrows():
    col0 = row[0]  # 순번
    col1 = row[1]  # 업체명 (마감일자 시트에서)
    
    is_blank = (str(col1) == 'nan' or str(col1).strip() == '')
    
    if is_blank:
        blank_count += 1
        if len(blank_examples) < 3:
            blank_examples.append((idx, col0, col1, row.tolist()))
    else:
        normal_count += 1

print(f"  정상 업체명: {normal_count}건")
print(f"  빈값: {blank_count}건")
if blank_examples:
    print("\n  빈값 예시:")
    for ex in blank_examples:
        print(f"    Row {ex[0]}: 순번={ex[1]}, 업체명={repr(ex[2])}, 전체={ex[3]}")

# 거래처정보현황 시트도 상세 확인
print("\n\n=== 거래처정보현황 헤더 및 첫 데이터 ===")
df2 = xl.parse('거래처정보현황', header=None)
for i in range(min(4, len(df2))):
    print(f"  Row {i}: {df2.iloc[i].tolist()}")
