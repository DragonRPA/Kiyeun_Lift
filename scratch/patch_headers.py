import re

def patch_migration_engine():
    with open('src/services/migrationEngine.ts', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Insert helper functions after import
    helpers_code = """
// ── 유틸리티 함수: 동적 헤더 매핑 ──
function buildHeaderMap(row: any[]): Map<string, number> {
  const map = new Map<string, number>();
  if (!row || !Array.isArray(row)) return map;
  row.forEach((col, idx) => {
    if (col && typeof col === 'string') {
      const key = col.replace(/\\s+/g, '');
      if (!map.has(key)) map.set(key, idx);
    }
  });
  return map;
}

function getCol(row: any[], map: Map<string, number>, keys: string[], fallbackIdx: number): any {
  for (const k of keys) {
    const idx = map.get(k);
    if (idx !== undefined && row[idx] !== null && row[idx] !== undefined) {
      return row[idx];
    }
  }
  return row[fallbackIdx];
}
"""
    if "function buildHeaderMap" not in content:
        content = content.replace("export function parseInitialExcelWorkbook", helpers_code + "\nexport function parseInitialExcelWorkbook")

    # 2. Patch wsAsset
    wsAsset_old = """  const wsAsset = wb.Sheets['보유자산현황'];
  const rawAssetRows = wsAsset ? XLSX.utils.sheet_to_json(wsAsset, { header: 1, defval: null }).slice(4) : [];
  
  const assetMap = new Map<string, any>();
  let assetSeq = 1;

  rawAssetRows.forEach((r: any) => {
    if (!r) return;
    const rawModel = r[1];
    const rawAssetNo = r[4];"""
    
    wsAsset_new = """  const wsAsset = wb.Sheets['보유자산현황'];
  const allAssetRows = wsAsset ? XLSX.utils.sheet_to_json(wsAsset, { header: 1, defval: null }) : [];
  let assetHeaderMap = new Map<string, number>();
  let assetDataStartIndex = 4;
  for (let i = 0; i < Math.min(10, allAssetRows.length); i++) {
    const row = allAssetRows[i] as any[];
    if (row && (row.includes('관리번호') || row.includes('취득가액'))) {
      assetHeaderMap = buildHeaderMap(row);
      assetDataStartIndex = i + 1;
      break;
    }
  }
  const rawAssetRows = allAssetRows.slice(assetDataStartIndex);
  
  const assetMap = new Map<string, any>();
  let assetSeq = 1;

  rawAssetRows.forEach((r: any) => {
    if (!r) return;
    const rawModel = getCol(r, assetHeaderMap, ['자산마스터명', '모델', '장비명'], 1);
    const rawAssetNo = getCol(r, assetHeaderMap, ['관리번호', '자산번호'], 4);"""
    
    if "assetHeaderMap" not in content:
        content = content.replace(wsAsset_old, wsAsset_new)
        content = content.replace("const maker = r[7]", "const maker = getCol(r, assetHeaderMap, ['제조사', '제조업체'], 7)")
        content = content.replace("const supplier = r[8]", "const supplier = getCol(r, assetHeaderMap, ['공급처', '구입처'], 8)")
        content = content.replace("const heightM = typeof r[6] === 'number' ? r[6] : parseFloat(String(r[6] || '5.8')) || 5.8;", 
                                  "const rawHeight = getCol(r, assetHeaderMap, ['작업높이', '규격'], 6);\n    const heightM = typeof rawHeight === 'number' ? rawHeight : parseFloat(String(rawHeight || '5.8')) || 5.8;")
        content = content.replace("const acqDate = sanitizeExcelDate(r[9])", "const acqDate = sanitizeExcelDate(getCol(r, assetHeaderMap, ['취득일자', '구입일'], 9))")
        content = content.replace("const acqPrice = sanitizeNumber(r[10])", "const acqPrice = sanitizeNumber(getCol(r, assetHeaderMap, ['취득가액', '구입가액'], 10))")
        content = content.replace("const memo = r[16]", "const memo = getCol(r, assetHeaderMap, ['리스비고', '비고'], 16)")
        content = content.replace("serialNo: r[3] ? String(r[3]).trim() : ''", "serialNo: getCol(r, assetHeaderMap, ['시리얼번호', 'S/N'], 3) ? String(getCol(r, assetHeaderMap, ['시리얼번호', 'S/N'], 3)).trim() : ''")
        content = content.replace("manufactureYear: r[5] ? String(r[5]).trim() : '2025년'", "manufactureYear: getCol(r, assetHeaderMap, ['연식', '제조년월'], 5) ? String(getCol(r, assetHeaderMap, ['연식', '제조년월'], 5)).trim() : '2025년'")

    # 3. Patch wsCust
    wsCust_old = """  const wsCust = wb.Sheets['거래처정보현황'];
  const rawCustRows = wsCust ? XLSX.utils.sheet_to_json(wsCust, { header: 1, defval: null }).slice(2) : [];
  
  let custSeq = 1;
  let siteSeq = 1;
  let contactSeq = 1;

  rawCustRows.forEach((r: any) => {
    if (!r) return;
    const rawBizRegNo = r[1] ? String(r[1]).trim() : '';
    const rawCustName = r[2] ? String(r[2]).trim() : '';"""

    wsCust_new = """  const wsCust = wb.Sheets['거래처정보현황'];
  const allCustRows = wsCust ? XLSX.utils.sheet_to_json(wsCust, { header: 1, defval: null }) : [];
  let custHeaderMap = new Map<string, number>();
  let custDataStartIndex = 2;
  for (let i = 0; i < Math.min(10, allCustRows.length); i++) {
    const row = allCustRows[i] as any[];
    if (row && (row.includes('거래처명') || row.includes('사업자번호'))) {
      custHeaderMap = buildHeaderMap(row);
      custDataStartIndex = i + 1;
      break;
    }
  }
  const rawCustRows = allCustRows.slice(custDataStartIndex);
  
  let custSeq = 1;
  let siteSeq = 1;
  let contactSeq = 1;

  rawCustRows.forEach((r: any) => {
    if (!r) return;
    const rawBizRegNo = getCol(r, custHeaderMap, ['사업자번호', '사업자등록번호'], 1) ? String(getCol(r, custHeaderMap, ['사업자번호', '사업자등록번호'], 1)).trim() : '';
    const rawCustName = getCol(r, custHeaderMap, ['거래처명', '고객사명', '업체명'], 2) ? String(getCol(r, custHeaderMap, ['거래처명', '고객사명', '업체명'], 2)).trim() : '';"""
    
    if "custHeaderMap" not in content:
        content = content.replace(wsCust_old, wsCust_new)
        content = content.replace("representative: r[3] ? String(r[3]).trim() : ''", "representative: getCol(r, custHeaderMap, ['대표자', '대표자명'], 3) ? String(getCol(r, custHeaderMap, ['대표자', '대표자명'], 3)).trim() : ''")
        content = content.replace("repContact: r[7]", "repContact: getCol(r, custHeaderMap, ['현장명'], 7)")
        content = content.replace("repEmail: r[8]", "repEmail: getCol(r, custHeaderMap, ['현장주소'], 8)")
        content = content.replace("address: r[4] ? String(r[4]).trim() : ''", "address: getCol(r, custHeaderMap, ['사업장주소', '주소'], 4) ? String(getCol(r, custHeaderMap, ['사업장주소', '주소'], 4)).trim() : ''")
        content = content.replace("const rawSite = r[7] ? String(r[7]).trim() : ''", "const rawSite = getCol(r, custHeaderMap, ['현장명', '현장'], 7) ? String(getCol(r, custHeaderMap, ['현장명', '현장'], 7)).trim() : ''")
        content = content.replace("address: r[8] ? String(r[8]).trim() : ''", "address: getCol(r, custHeaderMap, ['연락처', '현장주소', '비고'], 8) ? String(getCol(r, custHeaderMap, ['연락처', '현장주소', '비고'], 8)).trim() : ''")
        content = content.replace("contactName: r[9] ? String(r[9]).trim() : ''", "contactName: getCol(r, custHeaderMap, ['현장담당자'], 9) ? String(getCol(r, custHeaderMap, ['현장담당자'], 9)).trim() : ''")
        content = content.replace("contact: r[10] ? String(r[10]).trim() : ''", "contact: getCol(r, custHeaderMap, ['청구담당자'], 10) ? String(getCol(r, custHeaderMap, ['청구담당자'], 10)).trim() : ''")
        content = content.replace("email: r[11] ? String(r[11]).trim() : ''", "email: getCol(r, custHeaderMap, ['이메일', 'email'], 11) ? String(getCol(r, custHeaderMap, ['이메일', 'email'], 11)).trim() : ''")
        content = content.replace("const rawContact = r[9] ? String(r[9]).trim() : ''", "const rawContact = getCol(r, custHeaderMap, ['현장담당자', '담당자'], 9) ? String(getCol(r, custHeaderMap, ['현장담당자', '담당자'], 9)).trim() : ''")

    # 4. Patch wsClosing
    wsClosing_old = """  const wsClosing = wb.Sheets['업체별마감일자'];
  const rawClosingRows = wsClosing ? XLSX.utils.sheet_to_json(wsClosing, { header: 1, defval: null }).slice(2) : [];
  
  rawClosingRows.forEach((r: any) => {
    if (!r || !r[0]) return;
    const custName = normalizeCustomerName(String(r[0]));"""

    wsClosing_new = """  const wsClosing = wb.Sheets['업체별마감일자'];
  const allClosingRows = wsClosing ? XLSX.utils.sheet_to_json(wsClosing, { header: 1, defval: null }) : [];
  let closingHeaderMap = new Map<string, number>();
  let closingDataStartIndex = 2;
  for (let i = 0; i < Math.min(10, allClosingRows.length); i++) {
    const row = allClosingRows[i] as any[];
    if (row && (row.includes('거래처명') || row.includes('마감일자'))) {
      closingHeaderMap = buildHeaderMap(row);
      closingDataStartIndex = i + 1;
      break;
    }
  }
  const rawClosingRows = allClosingRows.slice(closingDataStartIndex);
  
  rawClosingRows.forEach((r: any) => {
    const rawCust = getCol(r, closingHeaderMap, ['거래처명', '고객사명', '업체명'], 0);
    if (!r || !rawCust) return;
    const custName = normalizeCustomerName(String(rawCust));"""
    
    if "closingHeaderMap" not in content:
        content = content.replace(wsClosing_old, wsClosing_new)
        content = content.replace("const closingDay = parseClosingDay(r[1])", "const closingDay = parseClosingDay(getCol(r, closingHeaderMap, ['마감일자', '마감일'], 1))")
        content = content.replace("const paymentTerm = parsePaymentDueTerm(r[2])", "const paymentTerm = parsePaymentDueTerm(getCol(r, closingHeaderMap, ['결제일', '결재일', '결제조건'], 2))")
        content = content.replace("const memo = r[3] ? String(r[3]).trim() : ''", "const memo = getCol(r, closingHeaderMap, ['비고', '메모'], 3) ? String(getCol(r, closingHeaderMap, ['비고', '메모'], 3)).trim() : ''")

    # 5. Patch wsMain
    wsMain_old = """  const wsMain = wb.Sheets['202608'] || wb.Sheets['26.08'] || wb.Sheets['계약현황'];
  const rawMainRows = wsMain ? XLSX.utils.sheet_to_json(wsMain, { header: 1, defval: null }).slice(3) : [];

  const contractAssets: ContractAsset[] = [];
  const contracts: Contract[] = [];"""

    wsMain_new = """  const wsMain = wb.Sheets['202608'] || wb.Sheets['26.08'] || wb.Sheets['계약현황'];
  const allMainRows = wsMain ? XLSX.utils.sheet_to_json(wsMain, { header: 1, defval: null }) : [];
  let mainHeaderMap = new Map<string, number>();
  let mainDataStartIndex = 3;
  for (let i = 0; i < Math.min(10, allMainRows.length); i++) {
    const row = allMainRows[i] as any[];
    if (row && (row.includes('업체명') || row.includes('현장명'))) {
      mainHeaderMap = buildHeaderMap(row);
      mainDataStartIndex = i + 1;
      break;
    }
  }
  const rawMainRows = allMainRows.slice(mainDataStartIndex);

  const contractAssets: ContractAsset[] = [];
  const contracts: Contract[] = [];"""
    
    if "mainHeaderMap" not in content:
        content = content.replace(wsMain_old, wsMain_new)
        content = content.replace("const rawCustName = r[0];", "const rawCustName = getCol(r, mainHeaderMap, ['업체명', '거래처명', '고객명'], 0);")
        content = content.replace("const rawModel = r[3];", "const rawModel = getCol(r, mainHeaderMap, ['모델명', '규격', '장비명'], 3);")
        content = content.replace("const rawSite = r[2] ? String(r[2]).trim() : '';", "const rawSite = getCol(r, mainHeaderMap, ['현장명'], 2) ? String(getCol(r, mainHeaderMap, ['현장명'], 2)).trim() : '';")
        
        # In wsMain, we had `heightM` from `r[3]`. We'll replace the line:
        old_height = "const heightM = typeof r[3] === 'number' ? r[3] : parseFloat(String(r[3] || '5.8')) || 5.8;"
        new_height = """const rawHeight = getCol(r, mainHeaderMap, ['규격', '모델명', '장비명'], 3);
    const heightM = typeof rawHeight === 'number' ? rawHeight : parseFloat(String(rawHeight || '5.8')) || 5.8;"""
        content = content.replace(old_height, new_height)

        # Asset nos
        content = content.replace("const ownAssetNo = r[13] ? String(r[13]).trim().toUpperCase() : ''", "const ownAssetNo = getCol(r, mainHeaderMap, ['자사장비', '자산번호', '장비번호'], 13) ? String(getCol(r, mainHeaderMap, ['자사장비', '자산번호', '장비번호'], 13)).trim().toUpperCase() : ''")
        content = content.replace("const leaseAssetNo = r[14] ? String(r[14]).trim().toUpperCase() : ''", "const leaseAssetNo = getCol(r, mainHeaderMap, ['전대장비', '임차장비'], 14) ? String(getCol(r, mainHeaderMap, ['전대장비', '임차장비'], 14)).trim().toUpperCase() : ''")
        content = content.replace("const leaseVendorName = r[15] ? String(r[15]).trim() : ''", "const leaseVendorName = getCol(r, mainHeaderMap, ['임차업체', '매입처'], 15) ? String(getCol(r, mainHeaderMap, ['임차업체', '매입처'], 15)).trim() : ''")
        content = content.replace("const leasePrice = sanitizeNumber(r[16])", "const leasePrice = sanitizeNumber(getCol(r, mainHeaderMap, ['임차단가', '매입단가'], 16))")
        content = content.replace("const leaseReturnDate = sanitizeExcelDate(r[17])", "const leaseReturnDate = sanitizeExcelDate(getCol(r, mainHeaderMap, ['전대반납일', '반납일'], 17))")

        # Dates & fees
        content = content.replace("const rowStartDate = sanitizeExcelDate(r[4]) || '2026-08-01'", "const rowStartDate = sanitizeExcelDate(getCol(r, mainHeaderMap, ['계약시작일', '시작일', '출고일'], 4)) || '2026-08-01'")
        content = content.replace("const rowEndDate = sanitizeExcelDate(r[5]) || '9999-12-31'", "const rowEndDate = sanitizeExcelDate(getCol(r, mainHeaderMap, ['계약종료일', '종료일'], 5)) || '9999-12-31'")
        
        # Transport fee
        content = content.replace("const transportFee = sanitizeNumber(r[20])", "const transportFee = sanitizeNumber(getCol(r, mainHeaderMap, ['운반비', '왕복운반비'], 20))")
        
        # Monthly fee
        content = content.replace("const rowMonthlyFee = sanitizeNumber(r[22]) || (sanitizeNumber(r[25]) > 0 ? sanitizeNumber(r[25]) : 300000)", "const rowMonthlyFee = sanitizeNumber(getCol(r, mainHeaderMap, ['월렌탈료', '렌탈료', '단가'], 22)) || (sanitizeNumber(getCol(r, mainHeaderMap, ['당월청구액', '청구합계'], 25)) > 0 ? sanitizeNumber(getCol(r, mainHeaderMap, ['당월청구액', '청구합계'], 25)) : 300000)")
        
        # Status
        content = content.replace("const contractStatusStr = r[10] ? String(r[10]).trim() : ''", "const contractStatusStr = getCol(r, mainHeaderMap, ['상태', '결재상태'], 10) ? String(getCol(r, mainHeaderMap, ['상태', '결재상태'], 10)).trim() : ''")

    with open('src/services/migrationEngine.ts', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    patch_migration_engine()
    print('Patched migrationEngine.ts')
