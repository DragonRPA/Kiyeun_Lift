// d:\Kiyeun_Lift\src\services\excel.ts
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

export const exportToExcel = (data: any[], fileName: string, sheetName: string = 'Sheet1') => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

/**
 * 신규 표준 거래명세서 양식 파일(구글 드라이브 또는 public/)을 ExcelJS로 읽어서
 * 실제 청구 데이터를 셀 값만 채워넣고 다운로드.
 *
 * 신규 셀 주소 매핑 (2026-08 개편):
 * - 공급자: E9=계약담당자(영업사원명), L9=연락처(영업사원전화)
 * - 공급받는자: S5=등록번호, S6=상호, Z6=대표, S7=주소, S8=업태, Z8=종목
 *              S9=현장담당자, Z9=연락처, S10=계산서담당자, Z10=연락처, S11=계산서메일, S12=현장명
 * - 작성일자: E13
 * - 데이터 행 (row 16~25):
 *   B=순번, C=월, D=일, E=모델/높이, I=관리번호, K=현장투입일, M=사용기간, Q=청구구분, S=수량, U=단가, X=공급가액, AA=세액, AD=비고
 */
export const exportTransactionStatementExcel = async (
  billing: any,
  details: any[],
  customer: any,
  contract: any,
  site: any,
  salesperson?: any,
  fileName?: string,
  templateUrl?: string
) => {
  // 1. URL 변환 (구글 드라이브 공유링크 → 직접 다운로드 URL)
  let fetchUrl = '/거래명세서양식.xlsx';

  if (templateUrl) {
    if (templateUrl.includes('docs.google.com/spreadsheets')) {
      const fileIdMatch = templateUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
      if (fileIdMatch) {
        fetchUrl = `https://docs.google.com/spreadsheets/d/${fileIdMatch[1]}/export?format=xlsx`;
      }
    } else if (templateUrl.includes('drive.google.com')) {
      const fileIdMatch = templateUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
                          templateUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (fileIdMatch) {
        fetchUrl = `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
      }
    } else if (templateUrl.startsWith('http')) {
      fetchUrl = templateUrl;
    }
  }

  // 2. 양식 파일 fetch
  const response = await fetch(fetchUrl);
  if (!response.ok) throw new Error(`거래명세서 양식 파일 로드 실패 (${fetchUrl}): HTTP ${response.status}`);

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error(
      `거래명세서 양식 파일을 받지 못했습니다 (HTML 응답).\n` +
      `구글 드라이브 파일이 "링크 있는 모든 사용자" 공개로 설정되었는지 확인하세요.\n` +
      `(fetchUrl: ${fetchUrl})`
    );
  }

  const arrayBuffer = await response.arrayBuffer();

  // 3. ExcelJS로 워크북 로드 (이미지·도장·서식 100% 보존)
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('거래명세서 양식 파일에 시트가 없습니다.');

  // 헬퍼: 셀에 값만 설정 (스타일 건드리지 않음)
  const setVal = (addr: string, value: string | number | null) => {
    const cell = worksheet.getCell(addr);
    cell.value = value;
  };

  // 숫자 값 설정 (기존 numFmt 보존)
  const setNum = (addr: string, value: number) => {
    const cell = worksheet.getCell(addr);
    const existingFmt = (cell.numFmt as string) || '#,##0';
    cell.value = value;
    cell.numFmt = existingFmt;
  };

  const billingDate: string = billing?.billingDate || new Date().toISOString().split('T')[0];
  const parts = billingDate.split('-');
  const dateY = parts[0] || '';
  const dateM = parts[1] ? Number(parts[1]) : '';
  const dateD = parts[2] ? Number(parts[2]) : '';
  const formattedBillingDate = `${dateY}년 ${String(dateM).padStart(2, '0')}월 ${String(dateD).padStart(2, '0')}일`;

  // === 공급자 (당사) 영업담당자 정보 ===
  const spName = salesperson?.name || contract?.salespersonName || '';
  const spPhone = salesperson?.mobile || salesperson?.phone || '';
  if (spName) setVal('E9', spName);
  if (spPhone) setVal('L9', spPhone);

  // === 공급받는자 (고객사 및 현장) 정보 ===
  setVal('S5', customer?.bizRegNo || '');                                      // 등록번호
  setVal('S6', customer?.name || '');                                         // 상호
  setVal('Z6', customer?.representative || '');                               // 대표자
  setVal('S7', customer?.address || '');                                      // 주소
  if (customer?.bizType) setVal('S8', customer.bizType);                      // 업태
  if (customer?.bizItem) setVal('Z8', customer.bizItem);                      // 종목

  // 현장담당자, 계산서담당자, 계산서메일, 현장명
  setVal('S9', site?.managerName || site?.contactName || customer?.managerName || ''); // 현장담당자
  setVal('Z9', site?.managerPhone || site?.contactPhone || customer?.phone || '');    // 현장담당자 연락처
  setVal('S10', customer?.billingManagerName || customer?.managerName || '');         // 계산서담당자
  setVal('Z10', customer?.billingManagerPhone || customer?.phone || '');             // 계산서담당자 연락처
  setVal('S11', customer?.billingEmail || customer?.email || '');                     // 계산서메일
  setVal('S12', site?.name || (typeof site === 'string' ? site : '') || '');          // 현장명

  // 작성일자 (E13)
  setVal('E13', formattedBillingDate);

  // === 데이터 품목 행 (row 16~25, 최대 10행) ===
  const ITEM_START_ROW = 16;
  const ITEM_MAX = 10;

  for (let i = 0; i < ITEM_MAX; i++) {
    const d = details[i];
    const row = ITEM_START_ROW + i;

    if (d) {
      const unitPrice = d.unitPrice || 0;
      const qty = d.quantity || 1;
      const itemSupply = unitPrice * qty;
      const itemVat = Math.round(itemSupply * 0.1);

      // 모델 / 높이 (예: SJ1432 / 6.3M)
      const modelHeight = d.assetHeight ? `${d.itemName} / ${d.assetHeight}` : d.itemName;
      
      // 청구구분 (렌탈료 / 옵션 / 운송비 / 소모품 등)
      const category = d.billingCategory || d.itemType || (d.itemName?.includes('운송') ? '운송비' : d.itemName?.includes('옵션') ? '옵션' : '렌탈료');

      // 현장투입일
      const inputDate = d.siteInputDate || contract?.startDate || '';

      // 사용 기간 (정산 대상 기간)
      const servicePeriod = d.servicePeriod || (d.startDate && d.endDate ? `${d.startDate} ~ ${d.endDate}` : `${billing?.billingYm || ''} 정산`);

      setVal(`B${row}`, i + 1);                       // 순번
      setVal(`C${row}`, dateM);                       // 월
      setVal(`D${row}`, dateD);                       // 일
      setVal(`E${row}`, modelHeight);                 // 모델 / 높이
      setVal(`I${row}`, d.assetNo || '-');            // 관리번호
      setVal(`K${row}`, inputDate);                   // 현장투입일
      setVal(`M${row}`, servicePeriod);               // 사용 기간
      setVal(`Q${row}`, category);                    // 청구구분
      setVal(`S${row}`, qty);                         // 수량
      setNum(`U${row}`, unitPrice);                   // 단가
      setNum(`X${row}`, itemSupply);                  // 공급가액
      setNum(`AA${row}`, itemVat);                    // 세액
      setVal(`AD${row}`, d.memo || d.description || ''); // 비고
    } else {
      // 빈 행 초기화
      setVal(`B${row}`, null);
      setVal(`C${row}`, null);
      setVal(`D${row}`, null);
      setVal(`E${row}`, null);
      setVal(`I${row}`, null);
      setVal(`K${row}`, null);
      setVal(`M${row}`, null);
      setVal(`Q${row}`, null);
      setVal(`S${row}`, null);
    }
  }

  // 4. 파일 다운로드
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName || '거래명세서'}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * 거래명세서 양식에 데이터를 채운 Excel 워크북 Buffer만 반환 (다운로드 없음).
 * PDF 저장용 엑셀 파일 생성, 이메일 첨부 등 다운로드 외 용도에 사용.
 */
export const exportTransactionStatementExcelBuffer = async (
  billing: any,
  details: any[],
  customer: any,
  contract: any,
  site: any,
  salesperson?: any,
  templateUrl?: string
): Promise<ArrayBuffer> => {
  let fetchUrl = '/거래명세서양식.xlsx';
  if (templateUrl) {
    if (templateUrl.includes('docs.google.com/spreadsheets')) {
      const m = templateUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
      if (m) fetchUrl = `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=xlsx`;
    } else if (templateUrl.includes('drive.google.com')) {
      const m = templateUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || templateUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (m) fetchUrl = `https://drive.google.com/uc?export=download&id=${m[1]}`;
    } else if (templateUrl.startsWith('http')) {
      fetchUrl = templateUrl;
    }
  }

  const response = await fetch(fetchUrl);
  if (!response.ok) throw new Error(`거래명세서 양식 파일 로드 실패: HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error('거래명세서 양식 파일을 받지 못했습니다 (HTML 응답).\n구글 드라이브 파일이 "링크 있는 모든 사용자" 공개로 설정되었는지 확인하세요.');
  }

  const arrayBuffer = await response.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('거래명세서 양식 파일에 시트가 없습니다.');

  const setVal = (addr: string, value: string | number | null) => { worksheet.getCell(addr).value = value; };
  const setNum = (addr: string, value: number) => {
    const cell = worksheet.getCell(addr);
    const fmt = (cell.numFmt as string) || '#,##0';
    cell.value = value;
    cell.numFmt = fmt;
  };

  const billingDate: string = billing?.billingDate || new Date().toISOString().split('T')[0];
  const parts = billingDate.split('-');
  const dateY = parts[0] || '';
  const dateM = parts[1] ? Number(parts[1]) : '';
  const dateD = parts[2] ? Number(parts[2]) : '';
  const formattedBillingDate = `${dateY}년 ${String(dateM).padStart(2, '0')}월 ${String(dateD).padStart(2, '0')}일`;

  // === 공급자 영업담당자 정보 ===
  const spName = salesperson?.name || contract?.salespersonName || '';
  const spPhone = salesperson?.mobile || salesperson?.phone || '';
  if (spName) setVal('E9', spName);
  if (spPhone) setVal('L9', spPhone);

  // === 공급받는자 정보 ===
  setVal('S5', customer?.bizRegNo || '');
  setVal('S6', customer?.name || '');
  setVal('Z6', customer?.representative || '');
  setVal('S7', customer?.address || '');
  if (customer?.bizType) setVal('S8', customer.bizType);
  if (customer?.bizItem) setVal('Z8', customer.bizItem);

  setVal('S9', site?.managerName || site?.contactName || customer?.managerName || '');
  setVal('Z9', site?.managerPhone || site?.contactPhone || customer?.phone || '');
  setVal('S10', customer?.billingManagerName || customer?.managerName || '');
  setVal('Z10', customer?.billingManagerPhone || customer?.phone || '');
  setVal('S11', customer?.billingEmail || customer?.email || '');
  setVal('S12', site?.name || (typeof site === 'string' ? site : '') || '');

  setVal('E13', formattedBillingDate);

  const ITEM_START_ROW = 16;
  const ITEM_MAX = 10;

  for (let i = 0; i < ITEM_MAX; i++) {
    const d = details[i];
    const row = ITEM_START_ROW + i;
    if (d) {
      const unitPrice = d.unitPrice || 0;
      const qty = d.quantity || 1;
      const itemSupply = unitPrice * qty;
      const itemVat = Math.round(itemSupply * 0.1);
      const modelHeight = d.assetHeight ? `${d.itemName} / ${d.assetHeight}` : d.itemName;
      const category = d.billingCategory || d.itemType || (d.itemName?.includes('운송') ? '운송비' : d.itemName?.includes('옵션') ? '옵션' : '렌탈료');
      const inputDate = d.siteInputDate || contract?.startDate || '';
      const servicePeriod = d.servicePeriod || (d.startDate && d.endDate ? `${d.startDate} ~ ${d.endDate}` : `${billing?.billingYm || ''} 정산`);

      setVal(`B${row}`, i + 1);
      setVal(`C${row}`, dateM);
      setVal(`D${row}`, dateD);
      setVal(`E${row}`, modelHeight);
      setVal(`I${row}`, d.assetNo || '-');
      setVal(`K${row}`, inputDate);
      setVal(`M${row}`, servicePeriod);
      setVal(`Q${row}`, category);
      setVal(`S${row}`, qty);
      setNum(`U${row}`, unitPrice);
      setNum(`X${row}`, itemSupply);
      setNum(`AA${row}`, itemVat);
      setVal(`AD${row}`, d.memo || d.description || '');
    } else {
      setVal(`B${row}`, null);
      setVal(`C${row}`, null);
      setVal(`D${row}`, null);
      setVal(`E${row}`, null);
      setVal(`I${row}`, null);
      setVal(`K${row}`, null);
      setVal(`M${row}`, null);
      setVal(`Q${row}`, null);
      setVal(`S${row}`, null);
    }
  }

  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
};
