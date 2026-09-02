import urllib.request
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5d2draWtramdibmxsamtrbW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjcxMzgsImV4cCI6MjA5OTk0MzEzOH0.gSftxhQjFmWUQzikx-Q5UsdgNKSZISZqJvUGeLBOCqU"
headers = {
    "apikey": anon_key,
    "Authorization": f"Bearer {anon_key}",
    "Accept": "application/json"
}

tables = [
    'products', 'vendors', 'customers', 'customer_sites', 'customer_contacts',
    'assets', 'contracts', 'contract_history', 'contract_assets', 'external_leases',
    'deliveries', 'outbound_inspections', 'asset_inout_logs',
    'billings', 'billing_details', 'purchase_billings', 'purchase_billing_details',
    'receivables', 'reconciliation_reports'
]

print("=== Supabase Real Table Column Audit ===\n")

for table in tables:
    url = f"https://wywgkikkjgbnlljkkmnz.supabase.co/rest/v1/{table}?limit=1"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data and len(data) > 0:
                cols = list(data[0].keys())
                print(f"[{table}] ({len(cols)} columns):")
                print(f"  {cols}\n")
            else:
                # 레코드가 없으면 빈 post로 컬럼 확인하거나 헤더 확인
                print(f"[{table}] (0 rows currently)\n")
    except Exception as e:
        print(f"[{table}] Error: {e}\n")
