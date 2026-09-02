import os
import pandas as pd
import sys
sys.stdout.reconfigure(encoding='utf-8')

base_dir = r"D:\OneDrive\Desktop\기연리프트자료_\자동업로드"

# 1. 경기 파일 분석
f_gyeonggi = os.path.join(base_dir, "(주)기연 리프트 7월 거래내역(경기서명)..xlsx")
df_g = pd.read_excel(f_gyeonggi, sheet_name="26년7월", header=None)
print("=== 1. 경기 (주)기연 리프트 7월 거래내역 ===")
# 헤더는 행 9
g_headers = df_g.iloc[9].values
print(f"헤더: {g_headers}")
g_rows = df_g.iloc[10:]
print(f"총 행 수: {len(g_rows)}")
valid_g = []
for idx, r in g_rows.iterrows():
    if pd.notna(r[0]) and str(r[0]).strip() and not str(r[0]).startswith('합'):
        valid_g.append({
            'date': str(r[0]).strip(),
            'origin': str(r[1]).strip() if pd.notna(r[1]) else '',
            'dest': str(r[2]).strip() if pd.notna(r[2]) else '',
            'vehicle': str(r[3]).strip() if pd.notna(r[3]) else '',
            'unit_price': r[4],
            'qty': r[5],
            'total': r[6],
            'memo': str(r[7]).strip() if pd.notna(r[7]) else ''
        })
print(f"유효 청구 행: {len(valid_g)}건")
if valid_g:
    print(f"샘플 3건: {valid_g[:3]}")
    total_g_amt = sum([float(x['total']) for x in valid_g if pd.notna(x['total']) and str(x['total']).replace('.','',1).isdigit()])
    print(f"경기 청구 총액: ₩{int(total_g_amt):,}")

print("\n" + "="*50 + "\n")

# 2. 엘제이 파일 분석
f_lj = os.path.join(base_dir, "7월 기연리프트(엘제이서명).xlsx")
df_lj = pd.read_excel(f_lj, sheet_name="거래명세표", header=None)
print("=== 2. 엘제이 7월 거래명세표 ===")
print("행 10~25 출력:")
for r_idx in range(10, min(30, len(df_lj))):
    vals = [str(x) if pd.notna(x) else "" for x in df_lj.iloc[r_idx].values]
    non_empty = [v for v in vals if v]
    print(f"  행 {r_idx:2d}: {non_empty}")

print("\n" + "="*50 + "\n")

# 3. 자인 파일 분석
f_zain = os.path.join(base_dir, "기연 7월거래명세표(자인서명).xlsx")
df_z = pd.read_excel(f_zain, sheet_name="Sheet1", header=None)
print("=== 3. 자인 (엠제이로지스) 7월 거래명세표 ===")
print("행 10~30 출력:")
for r_idx in range(10, min(35, len(df_z))):
    vals = [str(x) if pd.notna(x) else "" for x in df_z.iloc[r_idx].values]
    non_empty = [v for v in vals if v]
    print(f"  행 {r_idx:2d}: {non_empty}")
