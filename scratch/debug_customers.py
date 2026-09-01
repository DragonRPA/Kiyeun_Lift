import pandas as pd
import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = r"D:\OneDrive\Desktop\기연리프트자료_\자동업로드\초기DB현황1.xlsx"
xl = pd.ExcelFile(filepath)
df = xl.parse('계약현황', header=None)

data = df.iloc[3:]  # Row 3부터 데이터

print("=== 계약현황 시트에서 업체명(Col[0]) 분석 ===\n")

# 업체명이 빈값/숫자/특수케이스인 행 조사
blank_count = 0
number_count = 0
normal_count = 0

blank_examples = []
number_examples = []

for idx, row in data.iterrows():
    col0 = row[0]
    col1 = row[1]  # 순번
    col2 = row[2]  # 설치장소
    col9 = row[9]  # 장비명
    
    is_blank = (str(col0) == 'nan' or str(col0).strip() == '')
    is_number = isinstance(col0, (int, float)) and not isinstance(col0, bool)
    
    if is_blank:
        blank_count += 1
        if len(blank_examples) < 5:
            blank_examples.append((idx, col0, col1, col2, col9))
    elif is_number:
        number_count += 1
        if len(number_examples) < 5:
            number_examples.append((idx, col0, col1, col2, col9))
    else:
        normal_count += 1

print(f"  정상 업체명: {normal_count}건")
print(f"  빈값(nan/blank): {blank_count}건")
print(f"  숫자형 업체명: {number_count}건")

if blank_examples:
    print(f"\n  빈값 행 예시 (업체명이 없음):")
    for ex in blank_examples:
        print(f"    Row {ex[0]}: col0={repr(ex[1])}, 순번={ex[2]}, 설치장소={ex[3]}, 장비명={ex[4]}")

if number_examples:
    print(f"\n  숫자형 업체명 행 예시:")
    for ex in number_examples:
        print(f"    Row {ex[0]}: col0={repr(ex[1])}, 순번={ex[2]}, 설치장소={ex[3]}, 장비명={ex[4]}")

# 거래처정보현황 시트 고객 수 확인
df2 = xl.parse('거래처정보현황', header=None)
print(f"\n=== 거래처정보현황 시트 ===")
print(f"  총 행수: {len(df2)}")
# 실제 데이터 행 (Row 2부터)
data2 = df2.iloc[2:]
valid_cust = data2[data2.iloc[:,2].notna() & (data2.iloc[:,2] != '') & (data2.iloc[:,2] != '거래처명')]
print(f"  유효 고객사 건수: {len(valid_cust)}")
