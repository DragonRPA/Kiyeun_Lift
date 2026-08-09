// src/services/pdfStatementParser.ts
import * as pdfjsLib from 'pdfjs-dist';
import { VendorStatementRow, parseSingleDateString, parsePeriodString } from './vendorStatementParser';

// PDFjs worker 설정
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface ParsePdfStatementResult {
  rows: VendorStatementRow[];
  detectedVendor?: string;
  totalParsedAmount: number;
  totalParsedTax: number;
  totalParsedCount: number;
  rawTextLines: string[];
}

/**
 * PDF 거래명세서 파일(ArrayBuffer) 텍스트 추출 및 정밀 범용 파서 엔진
 * - 주식회사 현대렌탈, 주식회사 라이즈리프트, (주)AJ네트웍스, 주식회사 포스렌탈, (주)유앤네트웍스 등 지원
 * - 다중 페이지 서식(페이지별 헤더 재등장 & 하단 소계/합계) 정밀 무시 처리
 * - (SH1403), (R2653), (P10012), (4510010) 형태 괄호 속 관리번호 정밀 추출
 * - 렌탈료 외 소모품비용, 수리비, 청소비, 운송비 등 항목 보존
 */
export async function parsePdfStatement(
  arrayBuffer: ArrayBuffer,
  selectedYm: string = new Date().toISOString().slice(0, 7)
): Promise<ParsePdfStatementResult> {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;

  const allLines: string[] = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Y좌표 기준으로 라인 정렬
    const items = textContent.items as any[];
    if (!items || items.length === 0) continue;

    // Y좌표 반올림하여 동일 라인의 텍스트 묶기
    const lineMap = new Map<number, { x: number; text: string }[]>();

    items.forEach(item => {
      const transform = item.transform;
      const x = Math.round(transform[4]);
      const y = Math.round(transform[5]);

      // 유사 y좌표 묶기 (y 오차 3px 허용)
      let foundY = Array.from(lineMap.keys()).find(k => Math.abs(k - y) <= 3);
      if (foundY === undefined) {
        foundY = y;
        lineMap.set(foundY, []);
      }
      lineMap.get(foundY)!.push({ x, text: item.str });
    });

    // Y 좌표 내림차순(위에서 아래로) 정렬 후 라인 구성
    const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);

    sortedY.forEach(y => {
      const rowItems = lineMap.get(y)!.sort((a, b) => a.x - b.x);
      const lineText = rowItems.map(i => i.text).join(' ').replace(/\s+/g, ' ').trim();
      if (lineText) {
        allLines.push(lineText);
      }
    });
  }

  // 1. 원사(공급자) 자동 감지
  let detectedVendor: string | undefined = undefined;
  const fullText = allLines.join(' ');

  if (fullText.includes('현대렌탈')) {
    detectedVendor = '주식회사 현대렌탈';
  } else if (fullText.includes('라이즈리프트')) {
    detectedVendor = '주식회사 라이즈리프트';
  } else if (fullText.includes('AJ네트웍스') || fullText.includes('에이엔네트웍스')) {
    detectedVendor = '(주)AJ네트웍스';
  } else if (fullText.includes('포스렌탈')) {
    detectedVendor = '주식회사 포스렌탈';
  } else if (fullText.includes('유앤네트웍스')) {
    detectedVendor = '(주)유앤네트웍스';
  } else if (fullText.includes('롯데렌탈')) {
    detectedVendor = '롯데렌탈(주)';
  } else if (fullText.includes('하이로드')) {
    detectedVendor = '(주)하이로드';
  } else if (fullText.includes('하은')) {
    detectedVendor = '하은(주)';
  } else if (fullText.includes('중부렌탈')) {
    detectedVendor = '(주)중부렌탈';
  }

  const rows: VendorStatementRow[] = [];
  let totalParsedAmount = 0;
  let totalParsedTax = 0;

  // 2. 라인 단위 정밀 순회 파싱
  allLines.forEach((line, idx) => {
    const cleanLine = line.replace(/\s+/g, ' ');

    // 하단 소계, 합계, 계좌번호, 페이지 번호, 서명/문구 라인 무시
    if (
      cleanLine.includes('공급가액') && cleanLine.includes('부 가 세') ||
      cleanLine.includes('공급가') && cleanLine.includes('합 계') ||
      cleanLine.includes('계좌번호') ||
      cleanLine.includes('국민은행') ||
      cleanLine.includes('기업은행') ||
      cleanLine.includes('하나은행') ||
      cleanLine.includes('농협은행') ||
      cleanLine.includes('등록번호') ||
      cleanLine.includes('사업장') && cleanLine.includes('주소') ||
      cleanLine.match(/\d+페이지\s*중\s*\d+페이지/i) ||
      cleanLine.startsWith('거 래 명 세 표') ||
      cleanLine.startsWith('거 래 명 세 서') ||
      cleanLine.includes('고객 정보 변경 시에는') ||
      cleanLine.includes('세금계산서 매입 누락') ||
      cleanLine.replace(/\s+/g, '').includes('장비명높이사 용기 간') ||
      cleanLine.replace(/\s+/g, '').includes('NO.월일모델관리번호')
    ) {
      return;
    }

    // =========================================================================
    // 패턴 1: AJ네트웍스 양식
    // 예: "31 S0808E BNLF000099 2026-07-01 2026-07-31 렌탈료 1 310,000 310,000 31,000 주식회사 기연리프트"
    // 예: "31 (감지봉) 4개설치 10151046 2026-07-10 2026-07-31 소모품비용 1 10,000 10,000 1,000 주식회사 기연리프트"
    // =========================================================================
    const datesMatchAJ = cleanLine.match(/(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})/);
    if (datesMatchAJ) {
      const parts = cleanLine.split(/\s+/);
      const rentStart = datesMatchAJ[1];
      const rentEnd = datesMatchAJ[2];

      // 금액 및 세액 파싱 (뒤에서 텍스트 수집)
      const numMatches = cleanLine.match(/[\d,]{4,12}/g);
      let supplyAmount = 0;
      let taxAmount = 0;

      if (numMatches && numMatches.length >= 2) {
        taxAmount = parseInt(numMatches[numMatches.length - 1].replace(/,/g, ''), 10);
        supplyAmount = parseInt(numMatches[numMatches.length - 2].replace(/,/g, ''), 10);
      } else if (numMatches && numMatches.length === 1) {
        supplyAmount = parseInt(numMatches[0].replace(/,/g, ''), 10);
        taxAmount = Math.round(supplyAmount * 0.1);
      }

      // 관리번호 및 모델명 추출 (날짜 앞쪽 토큰들)
      const dateIndex = cleanLine.indexOf(rentStart);
      const prefixText = cleanLine.substring(0, dateIndex).trim();
      const prefixTokens = prefixText.split(/\s+/);

      let assetNo = '';
      let modelName = '';
      let itemType: 'EQUIPMENT' | 'REPAIR' | 'OTHER_FEE' = 'EQUIPMENT';

      if (prefixTokens.length >= 2) {
        // 마지막 토큰이 보통 관리번호 (예: BNLF000099, 10151046)
        const possibleAssetNo = prefixTokens[prefixTokens.length - 1];
        if (possibleAssetNo.match(/^[A-Z0-9]{6,15}$/i)) {
          assetNo = possibleAssetNo;
          modelName = prefixTokens.slice(1, prefixTokens.length - 1).join(' ') || prefixTokens[0];
        } else {
          assetNo = `AJ-${idx}`;
          modelName = prefixTokens.slice(1).join(' ');
        }
      } else {
        assetNo = `AJ-${idx}`;
        modelName = prefixText;
      }

      if (cleanLine.includes('소모품비용') || cleanLine.includes('감지봉') || cleanLine.includes('수리')) {
        itemType = cleanLine.includes('수리') ? 'REPAIR' : 'OTHER_FEE';
      }

      if (supplyAmount > 0) {
        const rowRecord: VendorStatementRow = {
          id: `pdf-aj-${idx}-${Date.now()}`,
          assetNo: assetNo || `AJ-${idx}`,
          modelName: modelName || '장비임대료',
          rentStart,
          rentEnd,
          billedAmount: supplyAmount,
          taxAmount,
          totalAmount: supplyAmount + taxAmount,
          memo: cleanLine,
          itemType,
          rawItemName: cleanLine
        };

        rows.push(rowRecord);
        totalParsedAmount += supplyAmount;
        totalParsedTax += taxAmount;
        return;
      }
    }

    // =========================================================================
    // 패턴 2: 현대렌탈, 라이즈리프트, 포스렌탈, 유앤네트웍스 괄호 속 관리번호 서식
    // 예: "S1412AC+ (SH1403) 14M 26/07/01~26/07/31 장비사용료 1 달 700,000"
    // 예: "GS2646E (R2653) 10M 26/07/01~26/07/31 재임대 1 달 350,000 350,000"
    // 예: "JCPT1008AC (P10012) 10M 26/07/01~26/07/31 재임대 1 달 350,000 350,000"
    // 예: "Z45 (4510010) 15.7M 26/07/01~26/07/31 재임대(용인하이닉스) 1 달 1,400,000 1,400,000"
    // =========================================================================
    const assetMatch = cleanLine.match(/\(([A-Z0-9\-]{3,15})\)/i);
    const periodMatch = cleanLine.match(/(\d{2,4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,2}\s*~\s*\d{2,4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,2})/);
    const moneyMatch = cleanLine.match(/([\d,]{4,12})\s*$/);

    if (assetMatch || periodMatch || moneyMatch) {
      const assetNo = assetMatch ? assetMatch[1].trim() : '';

      // 모델명 추출
      let modelName = '';
      if (assetMatch) {
        const parts = cleanLine.split(`(${assetMatch[1]})`);
        modelName = parts[0].replace(/^[\d\s]+/, '').trim();
      } else {
        const firstToken = cleanLine.split(' ')[0];
        modelName = firstToken;
      }

      // 기간 추출
      const rawPeriod = periodMatch ? periodMatch[1] : '';
      const dates = parsePeriodString(rawPeriod, selectedYm);

      // 금액 파싱
      let billedAmount = 0;
      if (moneyMatch) {
        billedAmount = parseInt(moneyMatch[1].replace(/,/g, ''), 10);
      } else {
        const allNums = cleanLine.match(/[\d,]{5,10}/g);
        if (allNums && allNums.length > 0) {
          billedAmount = parseInt(allNums[allNums.length - 1].replace(/,/g, ''), 10);
        }
      }

      // 비장비 / 기타 비용 항목 판단
      let itemType: 'EQUIPMENT' | 'REPAIR' | 'OTHER_FEE' = 'EQUIPMENT';
      if (cleanLine.includes('청소') || cleanLine.includes('수리') || cleanLine.includes('세척') || cleanLine.includes('도색') || cleanLine.includes('운송') || cleanLine.includes('소모품')) {
        itemType = cleanLine.includes('수리') ? 'REPAIR' : 'OTHER_FEE';
      }

      if (billedAmount > 0 || assetNo) {
        const taxAmount = Math.round(billedAmount * 0.1);
        const rowRecord: VendorStatementRow = {
          id: `pdf-stmt-${idx}-${Date.now()}`,
          assetNo: assetNo || `PDF-R-${1000 + idx}`,
          modelName: modelName || '장비임대료',
          rentStart: dates.rentStart,
          rentEnd: dates.rentEnd,
          billedAmount,
          taxAmount,
          totalAmount: billedAmount + taxAmount,
          memo: cleanLine,
          itemType,
          rawItemName: cleanLine
        };

        rows.push(rowRecord);
        totalParsedAmount += billedAmount;
        totalParsedTax += taxAmount;
      }
    }
  });

  return {
    rows,
    detectedVendor,
    totalParsedAmount,
    totalParsedTax,
    totalParsedCount: rows.length,
    rawTextLines: allLines
  };
}
