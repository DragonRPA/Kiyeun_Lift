import pandas as pd
import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = r"D:\OneDrive\Desktop\기연리프트자료_\자동업로드\초기DB현황1.xlsx"
xl = pd.ExcelFile(filepath)
df = xl.parse('계약현황', header=None)
data = df.iloc[3:]  # Row 3부터 데이터

# 보유자산현황 시트 - 관리번호 목록
df_assets = xl.parse('보유자산현황', header=None)
# 헤더 탐색
header_row = None
for i, row in df_assets.iterrows():
    if any('관리번호' in str(v) for v in row.values if str(v) != 'nan'):
        header_row = i
        break
print(f"보유자산현황 헤더 행: {header_row}")
if header_row is not None:
    headers_asset = df_assets.iloc[header_row].tolist()
    assetno_col = next((i for i, h in enumerate(headers_asset) if '관리번호' in str(h)), None)
    print(f"관리번호 컬럼: {assetno_col}")
    if assetno_col is not None:
        asset_rows = df_assets.iloc[header_row+1:]
        known_assetNos = set()
        for _, r in asset_rows.iterrows():
            v = r[assetno_col]
            if str(v) not in ('nan', '') and v is not None:
                known_assetNos.add(str(v).strip())
        print(f"보유자산현황 관리번호 수: {len(known_assetNos)}")

print("\n=== 계약현황 자산 매핑 가능 여부 분석 ===\n")
matched = 0
unmatched_own = 0
unmatched_lease = 0
virtual = 0  # 관리번호 없는 행

unmatched_samples = []

for idx, row in data.iterrows():
    col9 = str(row[9]).strip() if str(row[9]) != 'nan' else ''
    col12 = str(row[12]).strip() if str(row[12]) != 'nan' else ''
    
    has_own = bool(col9)
    has_lease = bool(col12)
    
    if not has_own and not has_lease:
        continue
    
    own_no_raw = str(row[10]).strip() if str(row[10]) != 'nan' else ''
    lease_no_raw = str(row[13]).strip() if str(row[13]) != 'nan' else ''
    
    cust = str(row[0]).strip() if str(row[0]) != 'nan' else ''
    
    if has_own:
        if not own_no_raw or own_no_raw == 'nan':
            virtual += 1
            if len(unmatched_samples) < 10:
                unmatched_samples.append({
                    'row': idx, 'type': '당사-관리번호없음', 'cust': cust,
                    'model': col9, 'assetno': own_no_raw
                })
        elif own_no_raw not in known_assetNos:
            unmatched_own += 1
            if len(unmatched_samples) < 10:
                unmatched_samples.append({
                    'row': idx, 'type': '당사-미등록', 'cust': cust,
                    'model': col9, 'assetno': own_no_raw
                })
        else:
            matched += 1
    
    if has_lease:
        # 전대는 별도 external_leases 테이블 → contract_assets.assetId = null
        lease_no_raw2 = lease_no_raw
        # 전대 자산은 assets 테이블에 없으므로 항상 미매핑 → 할당 대기
        unmatched_lease += 1

print(f"  자산 매핑 성공 (당사, 보유자산현황 일치): {matched}건 → contract_assets.assetId ≠ null")
print(f"  매핑 실패 (당사, 보유자산현황 미등록): {unmatched_own}건 → contract_assets.assetId = null → 출고 대기")
print(f"  매핑 불가 (당사, 관리번호 없음): {virtual}건 → contract_assets.assetId = null → 출고 대기")
print(f"  전대 자산 (assets 테이블에 없음): {unmatched_lease}건 → contract_assets.assetId = null → 출고 대기")
print(f"\n  합계 '출고 대기 요청' 예상: {unmatched_own + virtual + unmatched_lease}건")

print(f"\n=== 미매핑 샘플 (최대 10건) ===")
for s in unmatched_samples:
    print(f"  행{s['row']}: [{s['type']}] {s['cust']} / 모델={s['model']} / 관리번호={s['assetno']}")
