import pandas as pd
import urllib.request
import json
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = r"D:\OneDrive\Desktop\기연리프트자료_\자동업로드\배차현황(new) (1).xlsx"
xl = pd.ExcelFile(filepath)

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

rows = []
seq = 1

for sheet in xl.sheet_names:
    ym = parse_sheet_ym(sheet)
    if not ym: continue
    year, month = ym
    df = xl.parse(sheet, header=None)
    data = df.iloc[1:]

    for idx, row in data.iterrows():
        model_raw = str(row[4]).strip() if row[4] is not None and str(row[4]) != 'nan' else ''
        if not model_raw or model_raw == 'nan': continue
        if model_raw.startswith('(') or re.match(r'^\d{4,}$', model_raw): continue

        load_day = parse_day(row[0])
        unload_day = parse_day(row[1])
        loading_date = build_date(year, month, load_day)
        unloading_date = build_date(year, month, unload_day)

        cost_val = 0
        try:
            v = row[3]
            if v is not None and str(v) != 'nan':
                raw_num = float(str(v).replace(',', ''))
                if raw_num <= 200:
                    cost_val = int(raw_num * 10000)
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
        status = 'COMPLETED' if dispatch_status.startswith('완') else 'PENDING'

        inout = str(row[10]).strip() if row[10] is not None and str(row[10]) != 'nan' else ''
        note = str(row[12]).strip() if row[12] is not None and str(row[12]) != 'nan' else ''

        # Supabase DB Check Constraint 준수:
        # type IN ('OUTBOUND', 'INBOUND')
        # dispatchCategory IN ('출고', '입고', '반납', '정비', '이동')
        if inout == '출고':
            dtype = 'OUTBOUND'
            dcat = '출고'
        elif inout == '반납':
            dtype = 'INBOUND'
            dcat = '반납'
        elif inout == '입고':
            dtype = 'INBOUND'
            dcat = '입고'
        else:
            dtype = 'OUTBOUND'
            dcat = '출고'

        transport = str(row[11]).strip() if row[11] is not None and str(row[11]) != 'nan' else ''
        vehicle = str(row[2]).strip() if row[2] is not None and str(row[2]) != 'nan' else ''

        notes_parts = []
        if qty > 1: notes_parts.append(f'수량: {qty}대')
        if '왕복' in note: notes_parts.append('왕복/교환')
        if note and '왕복' not in note: notes_parts.append(note)
        special_notes = ' / '.join(notes_parts)

        memo_parts = []
        if customer_raw: memo_parts.append(f"업체: {customer_raw}")
        if special_notes: memo_parts.append(special_notes)

        rows.append({
            'id': f'DEL-HIST-{seq:06d}',
            'type': dtype,
            'status': status,
            'requestDate': loading_date,
            'loadingDate': loading_date,
            'unloadingDate': unloading_date,
            'destinationAddress': dest if dest else None,
            'transportCompany': transport if transport else None,
            'vehicleType': vehicle if vehicle else None,
            'deliveryCost': cost_val,
            'isCostSettled': False,
            'dispatchCategory': dcat,
            'memo': ' | '.join(memo_parts),
            'closingMemo': special_notes if special_notes else None,
            'createdAt': '2026-09-02T18:25:00.000Z',
            'updatedAt': '2026-09-02T18:25:00.000Z'
        })
        seq += 1

print(f"Total parsed valid rows: {len(rows)}")

# Supabase에 100건 청크 1개만 테스트로 Upsert & Delete 시도
anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5d2draWtramdibmxsamtrbW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjcxMzgsImV4cCI6MjA5OTk0MzEzOH0.gSftxhQjFmWUQzikx-Q5UsdgNKSZISZqJvUGeLBOCqU"
headers = {
    "apikey": anon_key,
    "Authorization": f"Bearer {anon_key}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

chunk = rows[:100]
url = "https://wywgkikkjgbnlljkkmnz.supabase.co/rest/v1/deliveries"
req = urllib.request.Request(url, data=json.dumps(chunk).encode('utf-8'), headers=headers, method='POST')

try:
    with urllib.request.urlopen(req) as resp:
        print("Batch 100 rows Upsert SUCCESS! Status Code:", resp.status)
        # cleanup
        for r in chunk:
            del_url = f"https://wywgkikkjgbnlljkkmnz.supabase.co/rest/v1/deliveries?id=eq.{r['id']}"
            del_req = urllib.request.Request(del_url, headers=headers, method='DELETE')
            urllib.request.urlopen(del_req)
        print("Cleanup 100 rows SUCCESS!")
except urllib.error.HTTPError as e:
    err_body = e.read().decode('utf-8')
    print(f"Batch Upsert FAILED: {e.code} -> {err_body}")
