// src/services/vendorStatementParser.ts
import * as XLSX from 'xlsx';

/**
 * 임차처 거래명세서 엑셀 파싱 단일 표준 레코드 인터페이스
 */
export interface VendorStatementRow {
  id: string;
  assetNo: string;        // 관리번호 (예: J0576, G8143 등 / 기타비용의 경우 "기타/수리비")
  serialNo?: string;      // 시리얼/제조번호
  modelName?: string;     // 모델명 (예: 1230ES, 1930ES / 기타비용의 경우 "기타/비용")
  rentStart: string;      // YYYY-MM-DD
  rentEnd: string;        // YYYY-MM-DD
  billedAmount: number;   // 공급가액 (청구금액)
  taxAmount?: number;     // 세액
  totalAmount?: number;   // 공급가액 + 세액 (합계)
  contractNo?: string;    // 원사 계약번호 (예: 롯데렌탈 2512001247)
  seq?: number;           // 순번 (예: 1, 2, 115)
  memo?: string;          // 비고 / 품목 상세명
  itemType: 'EQUIPMENT' | 'REPAIR' | 'OTHER_FEE'; // 장비 렌탈 vs 수리비 vs 기타 비용
  rawItemName?: string;   // 원본 셀 품목 텍스트
}

export interface ParseVendorStatementResult {
  rows: VendorStatementRow[];
  detectedVendor?: string;
  headerRowIndex: number;
  totalParsedAmount: number;
  totalParsedTax: number;
  totalParsedCount: number;
}

/**
 * 다양한 날짜/기간 문자열(예: "26.07.01 ~26.07.31", "2026.07.01~2026.07.14") 파싱 헬퍼
 */
export function parsePeriodString(periodStr: string, defaultYm: string): { rentStart: string; rentEnd: string } {
  const [defaultYear, defaultMonth] = defaultYm.split('-');
  const lastDay = new Date(parseInt(defaultYear, 10), parseInt(defaultMonth, 10), 0).getDate();
  const fallbackStart = `${defaultYm}-01`;
  const fallbackEnd = `${defaultYm}-${String(lastDay).padStart(2, '0')}`;

  if (!periodStr || typeof periodStr !== 'string') {
    return { rentStart: fallbackStart, rentEnd: fallbackEnd };
  }

  const clean = periodStr.trim();
  // 정규식: 26.07.01 ~26.07.31 또는 2026-07-01 ~ 2026-07-31
  const periodMatch = clean.match(/(\d{2,4})[\.\-\/](\d{1,2})[\.\-\/](\d{1,2})\s*~\s*(\d{2,4})[\.\-\/](\d{1,2})[\.\-\/](\d{1,2})/);
  
  if (periodMatch) {
    let y1 = periodMatch[1];
    let m1 = periodMatch[2].padStart(2, '0');
    let d1 = periodMatch[3].padStart(2, '0');
    let y2 = periodMatch[4];
    let m2 = periodMatch[5].padStart(2, '0');
    let d2 = periodMatch[6].padStart(2, '0');

    if (y1.length === 2) y1 = `20${y1}`;
    if (y2.length === 2) y2 = `20${y2}`;

    return {
      rentStart: `${y1}-${m1}-${d1}`,
      rentEnd: `${y2}-${m2}-${d2}`
    };
  }

  return { rentStart: fallbackStart, rentEnd: fallbackEnd };
}

/**
 * 셀 값을 숫자(금액)로 변환하는 헬퍼
 */
function parseNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const numStr = String(val).replace(/[^0-9\.-]/g, '');
  const parsed = parseFloat(numStr);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * 셀 값을 문자열로 변환하는 헬퍼
 */
function parseString(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

/**
 * 임차처 거래명세서 엑셀 범용 파서 엔진
 * - 롯데렌탈(주), AJ네트웍스, 한국리프트 등 다중 양식 자동 감지 및 파싱
 * - 동적 헤더 행 자동 탐색
 * - 중간 기타 비용(수리비/세척비/도색비/운송비 등) 누락 없는 파싱
 * - 하단 합계 행('계', '합계', '입금계좌') 및 빈 행 자동 거름
 */
export function parseVendorStatementExcel(
  worksheet: XLSX.WorkSheet,
  selectedYm: string = new Date().toISOString().slice(0, 7)
): ParseVendorStatementResult {
  // 1. sheet를 2D 배열로 변환 ({ header: 1 })
  const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (!matrix || matrix.length === 0) {
    return { rows: [], headerRowIndex: -1, totalParsedAmount: 0, totalParsedTax: 0, totalParsedCount: 0 };
  }

  // 2. 공급자(원사) 자동 감지
  let detectedVendor: string | undefined = undefined;
  for (let r = 0; r < Math.min(20, matrix.length); r++) {
    const rowStr = matrix[r].map(cell => parseString(cell)).join(' ');
    if (rowStr.includes('롯데렌탈')) {
      detectedVendor = '롯데렌탈(주)';
      break;
    } else if (rowStr.includes('AJ네트웍스') || rowStr.includes('에이엔네트웍스')) {
      detectedVendor = '(주)AJ네트웍스';
      break;
    } else if (rowStr.includes('한국리프트')) {
      detectedVendor = '한국리프트';
      break;
    }
  }

  // 3. 헤더 행(Header Row Index) 동적 찾기
  let headerRowIndex = -1;
  let maxHeaderScore = 0;

  const headerKeywords = [
    '관리번호', '자산번호', '장비번호', '시리얼', '제조번호',
    '모델명', '기간', '월렌탈료', '공급가액', '청구금액', '세액', '순번', '계약번호', '일수'
  ];

  for (let r = 0; r < Math.min(40, matrix.length); r++) {
    const row = matrix[r];
    if (!Array.isArray(row)) continue;

    let score = 0;
    row.forEach(cell => {
      const cellText = parseString(cell);
      headerKeywords.forEach(kw => {
        if (cellText.includes(kw)) score++;
      });
    });

    if (score > maxHeaderScore && score >= 2) {
      maxHeaderScore = score;
      headerRowIndex = r;
    }
  }

  // 헤더 행을 못 찾은 경우 기본값 0 지정
  if (headerRowIndex === -1) {
    headerRowIndex = 0;
  }

  const headerRow = matrix[headerRowIndex] || [];
  
  // 4. 컬럼 인덱스 매핑
  let colAssetNo = -1;
  let colSerialNo = -1;
  let colModelName = -1;
  let colPeriod = -1;
  let colRentStart = -1;
  let colRentEnd = -1;
  let colSupplyAmount = -1;
  let colTaxAmount = -1;
  let colMonthlyRent = -1;
  let colSeq = -1;
  let colContractNo = -1;
  let colMemo = -1;
  let colMonth = -1;
  let colDay = -1;

  headerRow.forEach((cell, idx) => {
    const txt = parseString(cell).replace(/\s+/g, '');
    if (!txt) return;

    if (txt.includes('관리번호') || txt.includes('자산번호') || txt.includes('장비번호')) {
      colAssetNo = idx;
    } else if (txt.includes('시리얼') || txt.includes('제조번호')) {
      colSerialNo = idx;
    } else if (txt.includes('모델명') || txt.includes('모델')) {
      colModelName = idx;
    } else if (txt.includes('기간') || txt.includes('사용기간') || txt.includes('임차기간')) {
      colPeriod = idx;
    } else if (txt.includes('시작일') || txt.includes('임차시작')) {
      colRentStart = idx;
    } else if (txt.includes('종료일') || txt.includes('임차종료')) {
      colRentEnd = idx;
    } else if (txt === '공급가액' || txt === '청구금액' || txt === '임차료' || txt === '금액' || txt.includes('공급가')) {
      colSupplyAmount = idx;
    } else if (txt.includes('세액') || txt.includes('부가세')) {
      colTaxAmount = idx;
    } else if (txt.includes('월렌탈료') || txt.includes('월임대료')) {
      colMonthlyRent = idx;
    } else if (txt.includes('순번') || txt.includes('No') || txt.includes('NO')) {
      colSeq = idx;
    } else if (txt.includes('계약번호')) {
      colContractNo = idx;
    } else if (txt.includes('비고') || txt.includes('적요') || txt.includes('특이사항')) {
      colMemo = idx;
    } else if (txt === '월') {
      colMonth = idx;
    } else if (txt === '일') {
      colDay = idx;
    }
  });

  // 파싱 데이터 행 수집
  const rows: VendorStatementRow[] = [];
  let totalParsedAmount = 0;
  let totalParsedTax = 0;

  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const rowData = matrix[r];
    if (!Array.isArray(rowData)) continue;

    // 행 전체 텍스트 병합
    const rowFullText = rowData.map(c => parseString(c)).join(' ').trim();
    if (!rowFullText) continue; // 빈 행 무시 (Image 3/4 요구사항)

    // 하단 합계 행 및 계좌안내 무시 (Image 3/4 요구사항)
    const firstColStr = parseString(rowData[0]);
    if (
      rowFullText.startsWith('계 ') || 
      rowFullText.startsWith('계\t') || 
      rowFullText.includes('입금계좌') || 
      rowFullText.includes('합계') || 
      rowFullText.includes('소계') || 
      rowFullText.includes('공급자 보관용') ||
      firstColStr === '계' ||
      firstColStr === '합계'
    ) {
      // 합계행 이후는 무시하고 계속 진행 또는 종료
      continue;
    }

    // 각 필드 값 추출
    const rawAssetNo = colAssetNo !== -1 ? parseString(rowData[colAssetNo]) : '';
    const rawSerialNo = colSerialNo !== -1 ? parseString(rowData[colSerialNo]) : '';
    const rawModelName = colModelName !== -1 ? parseString(rowData[colModelName]) : '';
    const rawPeriod = colPeriod !== -1 ? parseString(rowData[colPeriod]) : '';
    const rawSupplyAmount = colSupplyAmount !== -1 ? parseNumber(rowData[colSupplyAmount]) : 0;
    const rawTaxAmount = colTaxAmount !== -1 ? parseNumber(rowData[colTaxAmount]) : 0;
    const rawContractNo = colContractNo !== -1 ? parseString(rowData[colContractNo]) : '';
    const rawSeq = colSeq !== -1 ? parseNumber(rowData[colSeq]) : undefined;
    const rawMemo = colMemo !== -1 ? parseString(rowData[colMemo]) : '';

    // 공급가액과 세액 모두 0이고, 관리번호/모델명도 없는 행 무시
    if (!rawAssetNo && !rawModelName && rawSupplyAmount === 0 && !rowFullText.match(/\d+/)) {
      continue;
    }

    // 헤더 행 재등장 무시
    if (rawAssetNo === '관리번호' || rawModelName === '모델명' || rawAssetNo === '자산번호') {
      continue;
    }

    // 날짜 파싱
    let rentStart = '';
    let rentEnd = '';

    if (colRentStart !== -1 && colRentEnd !== -1 && parseString(rowData[colRentStart])) {
      rentStart = parseString(rowData[colRentStart]);
      rentEnd = parseString(rowData[colRentEnd]);
    } else {
      const dates = parsePeriodString(rawPeriod, selectedYm);
      rentStart = dates.rentStart;
      rentEnd = dates.rentEnd;
    }

    // =========================================================
    // 이미지 2 지원: 장비 임대료가 아닌 기타 항목 (수리비/세척비/도색비 등) 판별
    // =========================================================
    let isOtherFee = false;
    let itemType: 'EQUIPMENT' | 'REPAIR' | 'OTHER_FEE' = 'EQUIPMENT';
    let finalAssetNo = rawAssetNo;
    let finalModelName = rawModelName;
    let finalMemo = rawMemo;

    // 관리번호는 없으나 수리비/세척비/도색비/운송비 등의 품목명과 금액이 있는 경우
    if (!rawAssetNo) {
      // 행 전체 텍스트 또는 모델명 셀에서 품목명 탐색
      const feeText = rawModelName || rawMemo || rowFullText;
      if (feeText.includes('수리') || feeText.includes('세척') || feeText.includes('도색') || feeText.includes('부품') || feeText.includes('운송') || rawSupplyAmount > 0) {
        isOtherFee = true;
        itemType = feeText.includes('수리') ? 'REPAIR' : 'OTHER_FEE';
        finalAssetNo = feeText.includes('수리') ? '기타/수리비' : '기타/비용';
        finalModelName = rawModelName || '기타비용';
        finalMemo = feeText;
      } else {
        // 관리번호도 없고 금액도 없으면 무시
        if (rawSupplyAmount === 0) continue;
      }
    }

    // 레코드 생성
    const rowRecord: VendorStatementRow = {
      id: `stmt-${r}-${Date.now()}`,
      assetNo: finalAssetNo || `R-${1000 + r}`,
      serialNo: rawSerialNo,
      modelName: finalModelName,
      rentStart,
      rentEnd,
      billedAmount: rawSupplyAmount,
      taxAmount: rawTaxAmount,
      totalAmount: rawSupplyAmount + rawTaxAmount,
      contractNo: rawContractNo,
      seq: rawSeq,
      memo: finalMemo,
      itemType,
      rawItemName: rawModelName || rowFullText
    };

    rows.push(rowRecord);
    totalParsedAmount += rawSupplyAmount;
    totalParsedTax += rawTaxAmount;
  }

  return {
    rows,
    detectedVendor,
    headerRowIndex,
    totalParsedAmount,
    totalParsedTax,
    totalParsedCount: rows.length
  };
}
