import pandas as pd
import sys
sys.stdout.reconfigure(encoding='utf-8')
import re

filepath = r"D:\OneDrive\Desktop\기연리프트자료_\자동업로드\배차현황(new) (1).xlsx"
xl = pd.ExcelFile(filepath)

# === 파싱 규칙 재현 ===

def parse_sheet_ym(sheet_name):
    m26 = re.match(r'^26년\s*(\d{1,2})월', sheet_name)
    if m26: return (2026, int(m26.group(1)))
    m25 = re.match(r'^(\d{1,2})월', sheet_name)
    if m25: return (2025, int(m25.group(1)))
    return None

def parse_day(raw):
    if not raw: return None
    m = re.match(r'^(\d{1,2})일', str(raw))
    return int(m.group(1)) if m else None

def build_date(year, month, day):
    import calendar
    last_day = calendar.monthrange(year, month)[1]
    d = day if day and 1 <= day <= last_day else last_day
    return f"{year}-{month:02d}-{d:02d}"

def normalize_name(name):
    if not name: return ''
    name = str(name).strip()
    # 공백/특수문자 정규화
    return re.sub(r'[\s\(\)\[\]·•,./]', '', name).upper()

def normalize_model(name):
    if not name: return ''
    return re.sub(r'[\s\-_]', '', str(name)).upper()

rows = []
seq = 1
type_counter = {'OUTBOUND': 0, 'INBOUND': 0, 'RETURN': 0, 'EXCHANGE': 0}
skip_count = 0
date_fail = 0

for sheet in xl.sheet_names:
    ym = parse_sheet_ym(sheet)
    if not ym:
        print(f"  스킵(연월 파싱 실패): '{sheet}'")
        continue
    year, month = ym
    df = xl.parse(sheet, header=None)
    data = df.iloc[1:]  # 헤더 제외

    for idx, row in data.iterrows():
        model_raw = str(row[4]).strip() if row[4] is not None and str(row[4]) != 'nan' else ''
        if not model_raw or model_raw == 'nan':
            skip_count += 1
            continue

        load_day = parse_day(row[0])
        unload_day = parse_day(row[1])
        loading_date = build_date(year, month, load_day)
        unloading_date = build_date(year, month, unload_day)

        if load_day is None:
            date_fail += 1

        delivery_cost = 0
        try:
            v = row[3]
            if v is not None and str(v) != 'nan':
                delivery_cost = float(str(v).replace(',', '')) * 10000
        except: pass

        qty = 1
        try:
            v = row[5]
            if v is not None and str(v) != 'nan':
                qty = int(float(str(v)))
        except: pass

        customer_raw = str(row[6]).strip() if row[6] is not None and str(row[6]) != 'nan' else ''
        site_name = str(row[7]).strip() if row[7] is not None and str(row[7]) != 'nan' else ''
        address = str(row[8]).strip() if row[8] is not None and str(row[8]) != 'nan' else ''
        dest = site_name + (f' ({address})' if address else '')

        dispatch_status = str(row[9]).strip() if row[9] is not None and str(row[9]) != 'nan' else ''
        status = 'COMPLETED' if dispatch_status == '완료' else 'PENDING'

        inout = str(row[10]).strip() if row[10] is not None and str(row[10]) != 'nan' else ''
        note = str(row[12]).strip() if row[12] is not None and str(row[12]) != 'nan' else ''

        if '왕복' in note:
            dtype = 'EXCHANGE'
        elif inout == '출고':
            dtype = 'OUTBOUND'
        elif inout == '입고':
            dtype = 'INBOUND'
        elif inout == '반납':
            dtype = 'RETURN'
        else:
            dtype = 'OUTBOUND'

        type_counter[dtype] += 1

        transport = str(row[11]).strip() if row[11] is not None and str(row[11]) != 'nan' else ''
        vehicle = str(row[2]).strip() if row[2] is not None and str(row[2]) != 'nan' else ''

        notes_parts = []
        if qty > 1: notes_parts.append(f'수량: {qty}대')
        if note: notes_parts.append(note)
        special_notes = ' / '.join(notes_parts)

        rows.append({
            'id': f'DEL-HIST-{seq:06d}',
            'type': dtype,
            'status': status,
            'loading_date': loading_date,
            'unloading_date': unloading_date,
            'customer_raw': customer_raw,
            'dest': dest,
            'transport': transport,
            'vehicle_type': vehicle,
            'delivery_cost': int(delivery_cost),
            'special_notes': special_notes,
            'sheet': sheet
        })
        seq += 1

print(f"\n=== 파싱 결과 ===")
print(f"  총 파싱 건수: {len(rows)}건")
print(f"  스킵 (장비명 없음): {skip_count}건")
print(f"  날짜 파싱 실패 (말일 처리): {date_fail}건")
print(f"\n  배차 유형 분포:")
for k, v in type_counter.items():
    print(f"    {k}: {v}건")
print(f"\n  완료 건수: {sum(1 for r in rows if r['status']=='COMPLETED')}건")
print(f"  PENDING 건수: {sum(1 for r in rows if r['status']=='PENDING')}건")

# 비용 통계
costs = [r['delivery_cost'] for r in rows]
print(f"\n  운반비 통계:")
print(f"    최소: {min(costs):,}원")
print(f"    최대: {max(costs):,}원")
print(f"    평균: {int(sum(costs)/len(costs)):,}원")
print(f"    0원(운반비 없음): {sum(1 for c in costs if c==0)}건")

# 고객명 미매핑 (빈값) 통계
no_cust = [r for r in rows if not r['customer_raw']]
print(f"\n  고객명 빈값: {len(no_cust)}건")

# 샘플 5건
print(f"\n=== 샘플 5건 ===")
for r in rows[:5]:
    print(f"  [{r['id']}] {r['type']} | {r['loading_date']} | {r['customer_raw']} | {r['dest'][:30]} | {r['delivery_cost']:,}원 | {r['special_notes'][:20]}")
