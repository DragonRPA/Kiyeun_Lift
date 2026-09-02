import urllib.request
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

url = "https://wywgkikkjgbnlljkkmnz.supabase.co/rest/v1/deliveries?limit=1"
anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5d2draWtramdibmxsamtrbW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjcxMzgsImV4cCI6MjA5OTk0MzEzOH0.gSftxhQjFmWUQzikx-Q5UsdgNKSZISZqJvUGeLBOCqU"

headers = {
    "apikey": anon_key,
    "Authorization": f"Bearer {anon_key}",
    "Accept": "application/json"
}

req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        print("Response data sample:")
        if data and len(data) > 0:
            print("Columns in Supabase deliveries table:")
            for k in data[0].keys():
                print(f"  - {k}: {type(data[0][k]).__name__} (sample: {data[0][k]})")
        else:
            print("Table is currently empty. Fetching OpenAPI schema definition...")
except Exception as e:
    print("Error:", e)

# OpenAPI 스키마 엔드포인트에서 전체 정의 조회
openapi_url = "https://wywgkikkjgbnlljkkmnz.supabase.co/rest/v1/"
req2 = urllib.request.Request(openapi_url, headers=headers)
try:
    with urllib.request.urlopen(req2) as resp:
        schema = json.loads(resp.read().decode('utf-8'))
        definitions = schema.get('definitions', {})
        deliv_def = definitions.get('deliveries', {})
        print("\n=== OpenAPI Schema for 'deliveries' ===")
        props = deliv_def.get('properties', {})
        required = deliv_def.get('required', [])
        print(f"Required columns: {required}")
        print(f"All properties ({len(props)}):")
        for col_name, prop in props.items():
            req_mark = " [REQUIRED]" if col_name in required else ""
            print(f"  - {col_name}: {prop.get('type')} ({prop.get('format', '')}){req_mark}")
except Exception as e:
    print("OpenAPI Error:", e)
