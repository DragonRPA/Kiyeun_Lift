import urllib.request
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5d2draWtramdibmxsamtrbW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjcxMzgsImV4cCI6MjA5OTk0MzEzOH0.gSftxhQjFmWUQzikx-Q5UsdgNKSZISZqJvUGeLBOCqU"
headers = {
    "apikey": anon_key,
    "Authorization": f"Bearer {anon_key}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

# type 후보군 테스트
types = ['OUTBOUND', 'INBOUND', 'EXCHANGE', 'RETURN', 'MOVEMENT']

for t in types:
    rec = [{
        "id": "DEL-TEST-TYPE-001",
        "type": t,
        "status": "COMPLETED",
        "requestDate": "2026-09-02",
        "loadingDate": "2026-09-02",
        "unloadingDate": "2026-09-02",
        "deliveryCost": 10000,
        "isCostSettled": False,
        "dispatchCategory": "출고",
        "createdAt": "2026-09-02T18:24:00.000Z",
        "updatedAt": "2026-09-02T18:24:00.000Z"
    }]
    
    url = "https://wywgkikkjgbnlljkkmnz.supabase.co/rest/v1/deliveries"
    req = urllib.request.Request(url, data=json.dumps(rec).encode('utf-8'), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"type='{t}': SUCCESS ({resp.status})")
            del_url = "https://wywgkikkjgbnlljkkmnz.supabase.co/rest/v1/deliveries?id=eq.DEL-TEST-TYPE-001"
            del_req = urllib.request.Request(del_url, headers=headers, method='DELETE')
            urllib.request.urlopen(del_req)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        print(f"type='{t}': FAILED ({e.code}) -> {err_body}")
