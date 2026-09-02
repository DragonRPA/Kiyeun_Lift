import os
import pandas as pd
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

def safe_int(val):
    if val is None or pd.isna(val): return 0
    cleaned = re.sub(r'[^0-9.-]', '', str(val))
    try:
        return int(float(cleaned))
    except:
        return 0

base_dir = r"D:\OneDrive\Desktop\기연리프트자료_\자동업로드"

# 기연 배차현황 원장 로드 (26년7월)
dispatch_file = os.path.join(base_dir, "배차현황(new) (1).xlsx")
df_disp = pd.read_excel(dispatch_file, sheet_name="26년7월", header=None)
disp_rows = []

for idx, r in df_disp.iloc[1:].iterrows():
    model = str(r[4]).strip() if pd.notna(r[4]) and str(r[4]) != 'nan' else ''
    if not model or model.startswith('(') or re.match(r'^\d{4,}$', model):
        continue
    day_m = re.match(r'^(\d{1,2})일', str(r[0])) if pd.notna(r[0]) else None
    day = int(day_m.group(1)) if day_m else 31
    
    cost = 0
    try:
        if pd.notna(r[3]):
            raw_c = float(str(r[3]).replace(',', ''))
            if raw_c <= 200: cost = int(raw_c * 10000)
    except: pass
    
    disp_rows.append({
        'id': f'DEL-2607-{idx+1:03d}',
        'day': day,
        'cost': cost,
        'customer': str(r[6]).strip() if pd.notna(r[6]) else '',
        'site': str(r[7]).strip() if pd.notna(r[7]) else '',
        'transport': str(r[11]).strip() if pd.notna(r[11]) else '',
        'vehicle': str(r[2]).strip() if pd.notna(r[2]) else '',
        'matched': False
    })

# 1. 경기
f_g = os.path.join(base_dir, "(주)기연 리프트 7월 거래내역(경기서명)..xlsx")
df_g = pd.read_excel(f_g, sheet_name="26년7월", header=None)
g_list = []
for idx, r in df_g.iloc[10:].iterrows():
    if pd.notna(r[0]) and str(r[0]).strip() and not str(r[0]).startswith('합'):
        d_val = str(r[0]).strip()
        if d_val == '"' and g_list: d_val = g_list[-1]['date']
        tot = safe_int(r[6])
        if tot <= 0: continue
        day = int(d_val.split(' ')[0].split('-')[-1]) if '-' in d_val else None
        g_list.append({
            'date': d_val, 'day': day, 'origin': str(r[1]).strip() if pd.notna(r[1]) else '',
            'dest': str(r[2]).strip() if pd.notna(r[2]) else '',
            'total': tot, 'matched': False, 'cost_diff': 0
        })

# 2. 엘제이
f_lj = os.path.join(base_dir, "7월 기연리프트(엘제이서명).xlsx")
df_lj = pd.read_excel(f_lj, sheet_name="거래명세표", header=None)
lj_list = []
for idx, r in df_lj.iloc[14:].iterrows():
    tot = safe_int(r[29])
    if tot <= 0: continue
    d_val = str(r[9]).strip() if pd.notna(r[9]) else ''
    day = int(d_val.split('/')[-1]) if '/' in d_val else (int(d_val.split('-')[-1]) if '-' in d_val else None)
    lj_list.append({
        'date': d_val, 'day': day, 'model': str(r[0]).strip() if pd.notna(r[0]) else '',
        'site': str(r[15]).strip() if pd.notna(r[15]) else '',
        'total': tot, 'matched': False, 'cost_diff': 0
    })

# 3. 자인
f_z = os.path.join(base_dir, "기연 7월거래명세표(자인서명).xlsx")
df_z = pd.read_excel(f_z, sheet_name="Sheet1", header=None)
z_list = []
for idx, r in df_z.iloc[13:].iterrows():
    tot = safe_int(r[5])
    if tot <= 0: continue
    d_val = str(r[1]).strip() if pd.notna(r[1]) else ''
    day = int(d_val.split(' ')[0].split('-')[-1]) if '-' in d_val else None
    z_list.append({
        'date': d_val, 'day': day, 'site': str(r[6]).strip() if pd.notna(r[6]) else '',
        'cust': str(r[7]).strip() if pd.notna(r[7]) else '',
        'total': tot, 'matched': False, 'cost_diff': 0
    })

print("=== 3개 운송사 명세서 데이터 파싱 집계 ===")
print(f"1. 경기: {len(g_list)}건 / 청구총액 ₩{sum(x['total'] for x in g_list):,}")
print(f"2. 엘제이: {len(lj_list)}건 / 청구총액 ₩{sum(x['total'] for x in lj_list):,}")
print(f"3. 자인 (엠제이): {len(z_list)}건 / 청구총액 ₩{sum(x['total'] for x in z_list):,}")
print(f"총 청구 합계: {len(g_list)+len(lj_list)+len(z_list)}건 / ₩{sum(x['total'] for x in g_list)+sum(x['total'] for x in lj_list)+sum(x['total'] for x in z_list):,}\n")

# 매칭 테스트
# 1) 경기 대사
g_exact_cnt = 0
g_diff_cnt = 0
for inv in g_list:
    cands = [r for r in disp_rows if r['transport'] == '경기' and not r['matched'] and (inv['day'] is None or abs(r['day'] - inv['day']) <= 1)]
    exact = [r for r in cands if r['cost'] == inv['total']]
    if exact:
        exact[0]['matched'] = True
        inv['matched'] = True
        g_exact_cnt += 1
    elif cands:
        cands[0]['matched'] = True
        inv['matched'] = True
        inv['cost_diff'] = cands[0]['cost'] - inv['total']
        g_diff_cnt += 1

# 2) 엘제이 대사
lj_exact_cnt = 0
lj_diff_cnt = 0
for inv in lj_list:
    cands = [r for r in disp_rows if r['transport'] == '엘제이' and not r['matched'] and (inv['day'] is None or abs(r['day'] - inv['day']) <= 1)]
    exact = [r for r in cands if r['cost'] == inv['total']]
    if exact:
        exact[0]['matched'] = True
        inv['matched'] = True
        lj_exact_cnt += 1
    elif cands:
        cands[0]['matched'] = True
        inv['matched'] = True
        inv['cost_diff'] = cands[0]['cost'] - inv['total']
        lj_diff_cnt += 1

# 3) 자인 대사
z_exact_cnt = 0
z_diff_cnt = 0
for inv in z_list:
    cands = [r for r in disp_rows if ('자인' in r['transport']) and not r['matched'] and (inv['day'] is None or abs(r['day'] - inv['day']) <= 1)]
    exact = [r for r in cands if r['cost'] == inv['total']]
    if exact:
        exact[0]['matched'] = True
        inv['matched'] = True
        z_exact_cnt += 1
    elif cands:
        cands[0]['matched'] = True
        inv['matched'] = True
        inv['cost_diff'] = cands[0]['cost'] - inv['total']
        z_diff_cnt += 1

print("=== 자동 대사(Reconciliation) 시뮬레이션 결과 ===")
print(f"1. 경기: 총 {len(g_list)}건 중 매칭 {g_exact_cnt + g_diff_cnt}건 (완전일치 {g_exact_cnt}건, 금액불일치 {g_diff_cnt}건, 미매핑 {len(g_list)-(g_exact_cnt+g_diff_cnt)}건)")
print(f"2. 엘제이: 총 {len(lj_list)}건 중 매칭 {lj_exact_cnt + lj_diff_cnt}건 (완전일치 {lj_exact_cnt}건, 금액불일치 {lj_diff_cnt}건, 미매핑 {len(lj_list)-(lj_exact_cnt+lj_diff_cnt)}건)")
print(f"3. 자인: 총 {len(z_list)}건 중 매칭 {z_exact_cnt + z_diff_cnt}건 (완전일치 {z_exact_cnt}건, 금액불일치 {z_diff_cnt}건, 미매핑 {len(z_list)-(z_exact_cnt+z_diff_cnt)}건)")
