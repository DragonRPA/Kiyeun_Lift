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

url = "https://wywgkikkjgbnlljkkmnz.supabase.co/rest/v1/transport_companies?limit=1"
req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        print("transport_companies query success!")
        if data:
            print("Columns:", list(data[0].keys()))
            print("Sample row:", data[0])
        else:
            print("Table exists but is empty.")
except urllib.error.HTTPError as e:
    print(f"HTTPError: {e.code} - {e.read().decode('utf-8')}")
except Exception as e:
    print("Error:", e)
