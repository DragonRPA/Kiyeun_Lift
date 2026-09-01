import pandas as pd
import json
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

filepath = r"D:\OneDrive\Desktop\기연리프트자료_\자동업로드\초기DB현황1.xlsx"
if not os.path.exists(filepath):
    print(json.dumps({"error": f"File not found: {filepath}"}))
    sys.exit(1)

try:
    xl = pd.ExcelFile(filepath)
    result = {}
    for sheet in xl.sheet_names:
        df = xl.parse(sheet, nrows=5)
        headers = [str(x) for x in df.columns]
        first_rows = df.head(3).values.tolist()
        result[sheet] = {
            "headers": headers,
            "first_rows": [[str(v) for v in row] for row in first_rows]
        }
    print(json.dumps(result, ensure_ascii=False, indent=2))
except Exception as e:
    print(json.dumps({"error": str(e)}))
