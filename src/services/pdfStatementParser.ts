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
 * PDF 거래명세서 파일(ArrayBuffer) 텍스트 추출 및 정밀 파싱 서비스
 * - 주식회사 현대렌탈 및 기타 PDF 거래명세서 지원
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
  } else if (fullText.includes('롯데렌탈')) {
    detectedVendor = '롯데렌탈(주)';
  } else if (fullText.includes('하이로드')) {
    detectedVendor = '(주)하이로드';
  } else if (fullText.includes('하은')) {
    detectedVendor = '하은(주)';
  } else if (fullText.includes('AJ네트웍스') || fullText.includes('에이엔네트웍스')) {
    detectedVendor = '(주)AJ네트웍스';
  }

  const rows: VendorStatementRow[] = [];
  let totalParsedAmount = 0;
  let totalParsedTax = 0;

  // 2. 주식회사 현대렌탈 및 일반 PDF 서식 라인 순회 파싱
  allLines.forEach((line, idx) => {
    // 하단 소계, 합계, 계좌번호 라인 무시
    if (
      line.includes('공급가액') && line.includes('부 가 세') ||
      line.includes('계좌번호') ||
      line.includes('국민은행') ||
      line.includes('기업은행') ||
      line.includes('등록번호') ||
      line.includes('주소') ||
      line.includes('1페이지 중') ||
      line.startsWith('거 래 명 세 표')
    ) {
      return;
    }

    // 현대렌탈 및 일반 장비 행 패턴 분석:
    // 예: "S1412AC+ (SH1403) 14M 26/07/01~26/07/31 장비사용료 1 달 700,000"
    // 예: "JCPT1008AC (D1531) 10M 26/07/01~26/07/31 장비사용료 1 달 350,000"
    // 예: "JCPT1614ACZ (D1650) 16M 26/07/01~26/07/31 장비사용료 1 달 1,200,000"
    
    // 괄호 속 관리번호 탐색: (SH1403), (D1531), (D1650), (SH1401) 등
    const assetMatch = line.match(/\(([A-Z0-9\-]{3,15})\)/i);
    // 날짜 기간 탐색: 26/07/01~26/07/31 또는 2026.07.01 ~ 2026.07.31
    const periodMatch = line.match(/(\d{2,4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,2}\s*~\s*\d{2,4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,2})/);
    // 라인 우측 끝 금액 탐색: 700,000 또는 1,200,000
    const moneyMatch = line.match(/([\d,]{4,12})\s*$/);

    if (assetMatch || periodMatch || moneyMatch) {
      const assetNo = assetMatch ? assetMatch[1].trim() : '';
      
      // 모델명: 괄호 앞부분 텍스트 (예: S1412AC+, JCPT1008AC)
      let modelName = '';
      if (assetMatch) {
        const parts = line.split(`(${assetMatch[1]})`);
        modelName = parts[0].trim();
      } else {
        const firstToken = line.split(' ')[0];
        modelName = firstToken;
      }

      // 날짜 파싱
      const rawPeriod = periodMatch ? periodMatch[1] : '';
      const dates = parsePeriodString(rawPeriod, selectedYm);

      // 금액 파싱
      let billedAmount = 0;
      if (moneyMatch) {
        billedAmount = parseInt(moneyMatch[1].replace(/,/g, ''), 10);
      } else {
        // 숫자 콤마 패턴 찾기
        const allNums = line.match(/[\d,]{5,10}/g);
        if (allNums && allNums.length > 0) {
          billedAmount = parseInt(allNums[allNums.length - 1].replace(/,/g, ''), 10);
        }
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
          memo: line,
          itemType: 'EQUIPMENT',
          rawItemName: line
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
