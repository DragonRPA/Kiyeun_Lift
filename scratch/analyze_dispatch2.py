import pandas as pd
import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = r"D:\OneDrive\Desktop\기연리프트자료_\자동업로드\배차현황(new) (1).xlsx"
xl = pd.ExcelFile(filepath)

print("=== 전체 시트 통계 ===\n")
total = 0
for sheet in xl.sheet_names:
    df = xl.parse(sheet, header=None)
    data_rows = df.iloc[1:]  # 헤더 제외
    # 장비가 있는 행만 카운트
    valid = data_rows[data_rows[4].notna() & (data_rows[4] != '')].shape[0]
    total += valid
    print(f"  '{sheet}': 전체 {df.shape[0]-1}행 / 장비있는행 {valid}행")
print(f"\n  합계: {total}건\n")

# 대표 시트로 상세 분석
print("=== '26년4월' 시트 상세 분석 ===\n")
df = xl.parse('26년4월', header=None)
headers = df.iloc[0].tolist()
print(f"  컬럼 헤더: {headers}\n")

data = df.iloc[1:]

# Col[9] 배차유무 값 분포
print("  Col[9] 배차유무 분포:")
for v, c in data[9].value_counts().items():
    print(f"    '{v}': {c}건")

# Col[10] 입출고 분포
print("\n  Col[10] 입출고 분포:")
for v, c in data[10].value_counts().items():
    print(f"    '{v}': {c}건")

# Col[3] 운반비 샘플
print("\n  Col[3] 운반비 샘플 (단위 추정):")
print("   ", list(data[3].dropna().unique()[:20]))

# Col[2] 차량톤수 샘플
print("\n  Col[2] 차량톤수 샘플:")
print("   ", list(data[2].dropna().unique()[:20]))

# Col[4] 장비명 분포
print("\n  Col[4] 장비명(모델) 분포 (상위 20):")
for v, c in data[4].value_counts().head(20).items():
    print(f"    '{v}': {c}건")

# Col[12] 비고 샘플
print("\n  Col[12] 비고 샘플:")
notes = data[12].dropna().unique()[:20]
print("   ", list(notes))

# 날짜 형식 분석
print("\n  Col[0] 상차 날짜 샘플 (전체):")
dates = data[0].dropna().unique()
print("   ", sorted(list(dates))[:30])

# Col[5] 수량 - 1보다 큰 경우
multi = data[data[5] > 1]
print(f"\n  수량 > 1인 행: {len(multi)}건 (1건 배차에 여러 대)")
print("  샘플:")
for _, r in multi.head(5).iterrows():
    print(f"    상차={r[0]}, 장비={r[4]}, 수량={r[5]}, 업체={r[6]}, 현장={r[7]}")
