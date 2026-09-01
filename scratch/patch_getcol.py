import re

def patch_getcol():
    with open('src/services/migrationEngine.ts', 'r', encoding='utf-8') as f:
        content = f.read()

    # Modify buildHeaderMap to keep original keys but stripped
    old_build = """function buildHeaderMap(row: any[]): Map<string, number> {
  const map = new Map<string, number>();
  if (!row || !Array.isArray(row)) return map;
  row.forEach((col, idx) => {
    if (col && typeof col === 'string') {
      const key = col.replace(/\\s+/g, '');
      if (!map.has(key)) map.set(key, idx);
    }
  });
  return map;
}"""

    new_build = """function buildHeaderMap(row: any[]): Map<string, number> {
  const map = new Map<string, number>();
  if (!row || !Array.isArray(row)) return map;
  row.forEach((col, idx) => {
    if (col && typeof col === 'string') {
      const key = col.replace(/\\s+/g, '').toLowerCase();
      if (!map.has(key)) map.set(key, idx);
    }
  });
  return map;
}"""

    old_getcol = """function getCol(row: any[], map: Map<string, number>, keys: string[], fallbackIdx: number): any {
  for (const k of keys) {
    const idx = map.get(k);
    if (idx !== undefined && row[idx] !== null && row[idx] !== undefined) {
      return row[idx];
    }
  }
  return row[fallbackIdx];
}"""

    new_getcol = """function getCol(row: any[], map: Map<string, number>, keys: string[], fallbackIdx: number): any {
  for (const k of keys) {
    const searchKey = k.toLowerCase().replace(/\\s+/g, '');
    
    // 1. Exact match first
    if (map.has(searchKey)) {
      const idx = map.get(searchKey)!;
      if (row[idx] !== null && row[idx] !== undefined && String(row[idx]).trim() !== '') return row[idx];
    }
    // 2. Partial match (includes)
    for (const [headerKey, idx] of map.entries()) {
      if (headerKey.includes(searchKey)) {
        if (row[idx] !== null && row[idx] !== undefined && String(row[idx]).trim() !== '') return row[idx];
      }
    }
  }
  return row[fallbackIdx];
}"""

    if old_build in content:
        content = content.replace(old_build, new_build)
    if old_getcol in content:
        content = content.replace(old_getcol, new_getcol)
    
    # Also fix the ambiguous synonyms
    content = content.replace("['모델명', '규격', '장비명']", "['모델', '기종', '장비명']")
    content = content.replace("['자산마스터명', '모델', '장비명']", "['자산마스터명', '모델', '기종', '장비명']")
    content = content.replace("['규격', '모델명', '장비명']", "['규격', '모델', '기종', '장비명']")
    
    with open('src/services/migrationEngine.ts', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    patch_getcol()
