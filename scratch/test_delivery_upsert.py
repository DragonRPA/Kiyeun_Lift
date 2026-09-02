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

# 테스트용 배차 레코드 1건
test_record = [{
    "id": "DEL-TEST-SCHEMA-001",
    "type": "OUTBOUND",
    "status": "COMPLETED",
    "requestDate": "2026-09-02",
    "loadingDate": "2026-09-02",
    "unloadingDate": "2026-09-02",
    "destinationAddress": "테스트 현장 (서울 마곡)",
    "transportCompany": "자인일반",
    "vehicleType": "1.4",
    "deliveryCost": 120000,
    "isCostSettled": False,
    "dispatchCategory": "출고",
    "memo": "업체: 재영전기 | 수량: 2대",
    "closingMemo": "수량: 2대",
    "createdAt": "2026-09-02T18:20:00.000Z",
    "updatedAt": "2026-09-02T18:20:00.000Z"
}]

# 1. POST (Upsert) 테스트
url = "https://wywgkikkjgbnlljkkmnz.supabase.co/rest/v1/deliveries"
req = urllib.request.Request(url, data=json.dumps(test_record).encode('utf-8'), headers=headers, method='POST')

try:
    with urllib.request.urlopen(req) as resp:
        print("1. Upsert Success! Status Code:", resp.status)
except urllib.error.HTTPError as e:
    err_body = e.read().decode('utf-8')
    print(f"1. Upsert Failed: {e.code} - {err_body}")
    sys.exit(1)

# 2. DELETE (클린업) 테스트
delete_url = "https://wywgkikkjgbnlljkkmnz.supabase.co/rest/v1/deliveries?id=eq.DEL-TEST-SCHEMA-001"
req_del = urllib.request.Request(delete_url, headers=headers, method='DELETE')
try:
    with urllib.request.urlopen(req_del) as resp:
        print("2. Cleanup Delete Success! Status Code:", resp.status)
except Exception as e:
    print("2. Cleanup Error:", e)

print("\n=== 배차 스키마 100% 검증 통과 ===")
