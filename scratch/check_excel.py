import pandas as pd
import sys
import os

filepath = r"D:\OneDrive\Desktop\기연리프트자료_\자동업로드\초기DB현황1.xlsx"
if not os.path.exists(filepath):
    print(f"File not found: {filepath}")
    sys.exit(1)

try:
    xl = pd.ExcelFile(filepath)
    print("Sheets:", xl.sheet_names)
    for sheet in xl.sheet_names:
        df = xl.parse(sheet, nrows=5)
        print(f"\nSheet '{sheet}' headers ({len(df.columns)}):")
        print(list(df.columns))
        print(f"Rows count (approx): {xl.book[sheet].max_row}")
except Exception as e:
    print(f"Error: {e}")
