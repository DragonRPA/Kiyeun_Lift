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
 * 공식 거래명세서 양식 파일(구글 드라이브 또는 public/)을 ExcelJS로 읽어서
 * 실제 청구 데이터를 셀 값만 채워넣고 다운로드.
 *
 * ExcelJS 사용 이유:
 * - 무료 xlsx 라이브러리는 embedded 이미지(도장)를 완전히 드롭하고 셀 스타일도 손실됨.
 * - ExcelJS는 이미지 포함 전체 워크북 구조를 그대로 보존하면서 셀 값만 교체 가능.
 *
 * templateUrl: google_configs.transactionStatementTemplateUrl (Supabase 저장값)
 *   - docs.google.com/spreadsheets/d/FILE_ID/edit → /export?format=xlsx 변환
 *   - drive.google.com/file/d/FILE_ID/view → /uc?export=download&id=FILE_ID 변환
 *   - fallback: /거래명세서양식.xlsx (public 폴더 복사본)
 *
 * 양식 셀 맵:
 * - 공급받는자 등록번호: N5   상호: N6   대표: R6   주소: N7
 * - 작성일자: E13
 * - 품목행 row16~26: B=순번, C=월, D=일, E=품목, L=수량, M=단가, O=공급가액, Q=부가세, T=비고
 * - 합계: E27=공급가, J27=부가세, O27=합계
 */
export const exportTransactionStatementExcel = async (
  billing: any,
  details: any[],
  customer: any,
  contract: any,
  siteName: string,
  fileName: string,
  templateUrl?: string
) => {
  // 1. URL 변환 (구글 드라이브 공유링크 → 직접 다운로드 URL)
  let fetchUrl = '/거래명세서양식.xlsx'; // fallback: public 폴더 복사본

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
    // else: 로컬 경로(.html 등) → fallback 유지
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

  // 3. ExcelJS로 워크북 로드 (이미지·스타일 100% 보존)
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('거래명세서 양식 파일에 시트가 없습니다.');

  // 헬퍼: 셀에 값만 설정 (스타일은 건드리지 않음)
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

  const supplyTotal = Math.round((billing?.totalAmount || 0) / 1.1);
  const vatTotal = (billing?.totalAmount || 0) - supplyTotal;
  const totalAmount = billing?.totalAmount || 0;

  const billingDate: string = billing?.billingDate || '';
  const billingYm: string = billing?.billingYm || '';
  const parts = billingDate ? billingDate.split('-') : ['', '', ''];
  const dateM = parts[1] ? Number(parts[1]) : '';
  const dateD = parts[2] ? Number(parts[2]) : '';

  // === 공급받는자 정보 ===
  setVal('N5', customer?.bizRegNo || '');
  setVal('N6', customer?.name || '');
  setVal('R6', customer?.representative || '');
  setVal('N7', customer?.address || '');
  setVal('E13', billingDate || billingYm);

  // === 품목 행 (row 16~26, 최대 11행) ===
  const ITEM_START_ROW = 16;
  const ITEM_MAX = 11;

  for (let i = 0; i < ITEM_MAX; i++) {
    const d = details[i];
    const row = ITEM_START_ROW + i;

    if (d) {
      const itemSupply = Math.round(d.amount / 1.1);
      const itemVat = d.amount - itemSupply;

      setVal(`B${row}`, i + 1);
      setVal(`C${row}`, dateM);
      setVal(`D${row}`, dateD);
      setVal(`E${row}`, d.itemName + (d.description ? ` [${d.description}]` : ''));
      setVal(`L${row}`, d.quantity || 1);
      setNum(`M${row}`, d.unitPrice || itemSupply);
      setNum(`O${row}`, itemSupply);
      setNum(`Q${row}`, itemVat);
      setVal(`T${row}`, siteName || '');
    } else {
      // 빈 행 초기화
      setVal(`B${row}`, null);
      setNum(`O${row}`, 0);
      setNum(`Q${row}`, 0);
    }
  }

  // === 합계 행 (row 27) ===
  setNum('E27', supplyTotal);
  setNum('J27', vatTotal);
  setNum('O27', totalAmount);

  // 4. 파일 다운로드
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
