import os
import pandas as pd
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

base_dir = r"D:\OneDrive\Desktop\기연리프트자료_\자동업로드"

# 1. 기연 배차현황 26년7월 파싱
dispatch_file = os.path.join(base_dir, "배차현황(new) (1).xlsx")
df_disp = pd.read_excel(dispatch_file, sheet_name="26년7월", header=None)
disp_rows = []

for idx, r in df_disp.iloc[1:].iterrows():
    model = str(r[4]).strip() if pd.notna(r[4]) and str(r[4]) != 'nan' else ''
    if not model or model.startswith('(') or re.match(r'^\d{4,}$', model):
        continue
    
    # 상차일
    day_m = re.match(r'^(\d{1,2})일', str(r[0])) if pd.notna(r[0]) else None
    day = int(day_m.group(1)) if day_m else 31
    date_str = f"2026-07-{day:02d}"
    
    cost = 0
    try:
        if pd.notna(r[3]):
            raw_c = float(str(r[3]).replace(',', ''))
            if raw_c <= 200:
                cost = int(raw_c * 10000)
    except: pass
    
    customer = str(r[6]).strip() if pd.notna(r[6]) else ''
    site = str(r[7]).strip() if pd.notna(r[7]) else ''
    addr = str(r[8]).strip() if pd.notna(r[8]) else ''
    transport = str(r[11]).strip() if pd.notna(r[11]) else ''
    vehicle = str(r[2]).strip() if pd.notna(r[2]) else ''
    inout = str(r[10]).strip() if pd.notna(r[10]) else ''
    memo = str(r[12]).strip() if pd.notna(r[12]) else ''
    
    disp_rows.append({
        'row_no': idx + 1,
        'date': date_str,
        'day': day,
        'cost': cost,
        'customer': customer,
        'site': site,
        'addr': addr,
        'transport': transport,
        'vehicle': vehicle,
        'inout': inout,
        'memo': memo,
        'matched': False
    })

print(f"=== 기연 2026년 7월 배차 원장 ===")
print(f"총 배차 건수: {len(disp_rows)}건")
print(f"총 예상 운반비: ₩{sum(r['cost'] for r in disp_rows):,}")

# 운송사별 집계
t_stats = {}
for r in disp_rows:
    t = r['transport'] or '(미기재)'
    t_stats[t] = t_stats.get(t, 0) + 1
print(f"운송사별 건수: {t_stats}\n")

print("="*60 + "\n")

# ── 1. 경기 자동 대사 테스트 ──
f_g = os.path.join(base_dir, "(주)기연 리프트 7월 거래내역(경기서명)..xlsx")
df_g = pd.read_excel(f_g, sheet_name="26년7월", header=None)
g_invoices = []
for idx, r in df_g.iloc[10:].iterrows():
    if pd.notna(r[0]) and str(r[0]).strip() and not str(r[0]).startswith('합'):
        d_val = str(r[0]).strip()
        # 따옴표(")는 직전 일자 상속
        if d_val == '"' and g_invoices:
            d_val = g_invoices[-1]['date']
        elif ' ' in d_val:
            d_val = d_val.split(' ')[0]
        
        tot = 0
        try:
            tot = int(float(str(r[6]).replace(',', '')))
        except: pass
        
        g_invoices.append({
            'inv_row': idx + 1,
            'date': d_val,
            'origin': str(r[1]).strip() if pd.notna(r[1]) else '',
            'dest': str(r[2]).strip() if pd.notna(r[2]) else '',
            'vehicle': str(r[3]).strip() if pd.notna(r[3]) else '',
            'total': tot,
            'memo': str(r[7]).strip() if pd.notna(r[7]) else '',
            'matched': False
        })

print(f"🚛 [1. 경기] 청구서 {len(g_invoices)}건 vs 기연 원장 '경기' {t_stats.get('경기',0)}건")
g_matched = 0
g_cost_diff = 0
for inv in g_invoices:
    inv_day = None
    try:
        inv_day = int(inv['date'].split('-')[2])
    except: pass
    
    # 매칭 후보: 운송사='경기', 일자 일치 (±1일 허용), 금액 일치 또는 현장 유사
    candidates = [
        r for r in disp_rows 
        if r['transport'] == '경기' and not r['matched'] and (inv_day is None or abs(r['day'] - inv_day) <= 1)
    ]
    
    # 1순위: 금액 + 일자 완벽 일치
    exact = [r for r in candidates if r['cost'] == inv['total']]
    if exact:
        exact[0]['matched'] = True
        inv['matched'] = True
        g_matched += 1
    elif candidates:
        # 2순위: 금액 차이 기록
        candidates[0]['matched'] = True
        inv['matched'] = True
        g_matched += 1
        g_cost_diff += abs(candidates[0]['cost'] - inv['total'])

print(f"  -> 대사 매칭 성공: {g_matched} / {len(g_invoices)}건 ({g_matched/len(g_invoices)*100:.1f}%)")
print(f"  -> 경기 청구총액: ₩{sum(x['total'] for x in g_invoices):,} | 원장 배차합계: ₩{sum(r['cost'] for r in disp_rows if r['transport']=='경기'):,}")
print()

# ── 2. 엘제이 자동 대사 테스트 ──
f_lj = os.path.join(base_dir, "7월 기연리프트(엘제이서명).xlsx")
df_lj = pd.read_excel(f_lj, sheet_name="거래명세표", header=None)
lj_invoices = []
for idx, r in df_lj.iloc[14:].iterrows():
    if pd.notna(r[6]) and str(r[6]).strip() and not str(r[0]).startswith('합'):
        tot = 0
        try:
            tot = int(float(str(r[6]).replace(',', '')))
        except: pass
        if tot <= 0: continue
        
        d_val = str(r[2]).strip() if pd.notna(r[2]) else ''
        # '2026.07/01' 형식 파싱
        day = None
        if '/' in d_val:
            try: day = int(d_val.split('/')[-1])
            except: pass
        elif '-' in d_val:
            try: day = int(d_val.split('-')[-1])
            except: pass
            
        lj_invoices.append({
            'inv_row': idx + 1,
            'day': day,
            'model': str(r[0]).strip() if pd.notna(r[0]) else '',
            'site': str(r[3]).strip() if pd.notna(r[3]) else '',
            'total': tot,
            'matched': False
        })

print(f"🚛 [2. 엘제이] 청구서 {len(lj_invoices)}건 vs 기연 원장 '엘제이' {t_stats.get('엘제이',0)}건")
lj_matched = 0
for inv in lj_invoices:
    candidates = [
        r for r in disp_rows 
        if r['transport'] == '엘제이' and not r['matched'] and (inv['day'] is None or abs(r['day'] - inv['day']) <= 1)
    ]
    exact = [r for r in candidates if r['cost'] == inv['total']]
    if exact:
        exact[0]['matched'] = True
        inv['matched'] = True
        lj_matched += 1
    elif candidates:
        candidates[0]['matched'] = True
        inv['matched'] = True
        lj_matched += 1

print(f"  -> 대사 매칭 성공: {lj_matched} / {len(lj_invoices)}건 ({lj_matched/len(lj_invoices)*100:.1f}%)")
print(f"  -> 엘제이 청구총액: ₩{sum(x['total'] for x in lj_invoices):,} | 원장 배차합계: ₩{sum(r['cost'] for r in disp_rows if r['transport']=='엘제이'):,}")
print()

# ── 3. 자인 (엠제이로지스) 자동 대사 테스트 ──
f_z = os.path.join(base_dir, "기연 7월거래명세표(자인서명).xlsx")
df_z = pd.read_excel(f_z, sheet_name="Sheet1", header=None)
z_invoices = []
for idx, r in df_z.iloc[13:].iterrows():
    if pd.notna(r[5]) and str(r[5]).strip() and not str(r[0]).startswith('합'):
        tot = 0
        try:
            tot = int(float(str(r[5]).replace(',', '')))
        except: pass
        if tot <= 0: continue
        
        d_val = str(r[1]).strip() if pd.notna(r[1]) else ''
        day = None
        try:
            day = int(d_val.split(' ')[0].split('-')[-1])
        except: pass
        
        z_invoices.append({
            'inv_row': idx + 1,
            'day': day,
            'site': str(r[6]).strip() if pd.notna(r[6]) else '',
            'cust': str(r[7]).strip() if pd.notna(r[7]) else '',
            'total': tot,
            'matched': False
        })

z_target_cnt = t_stats.get('자인일반',0) + t_stats.get('자인셀프',0) + t_stats.get('자인',0)
print(f"🚛 [3. 자인 (엠제이)] 청구서 {len(z_invoices)}건 vs 기연 원장 '자인(일반/셀프)' {z_target_cnt}건")
z_matched = 0
for inv in z_invoices:
    candidates = [
        r for r in disp_rows 
        if ('자인' in r['transport']) and not r['matched'] and (inv['day'] is None or abs(r['day'] - inv['day']) <= 1)
    ]
    exact = [r for r in candidates if r['cost'] == inv['total']]
    if exact:
        exact[0]['matched'] = True
        inv['matched'] = True
        z_matched += 1
    elif candidates:
        candidates[0]['matched'] = True
        inv['matched'] = True
        z_matched += 1

print(f"  -> 대사 매칭 성공: {z_matched} / {len(z_invoices)}건 ({z_matched/len(z_invoices)*100:.1f}%)")
print(f"  -> 자인 청구총액: ₩{sum(x['total'] for x in z_invoices):,} | 원장 배차합계: ₩{sum(r['cost'] for r in disp_rows if '자인' in r['transport']):,}")
