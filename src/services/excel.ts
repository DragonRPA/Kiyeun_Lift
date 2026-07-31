// d:\Kiyeun_Lift\src\services\excel.ts
import * as XLSX from 'xlsx';

export const exportToExcel = (data: any[], fileName: string, sheetName: string = 'Sheet1') => {
  // 한글 컬럼 등으로 변환하고 싶을 때 유용하게 확장 가능
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

/**
 * 공식 거래명세서 양식 파일(구글 드라이브 또는 public/)을 fetch로 읽어서
 * 실제 청구 데이터를 셀에 직접 채워넣고 다운로드
 *
 * templateUrl: google_configs.transactionStatementTemplateUrl (Supabase 저장값)
 *   - 구글 드라이브 공유링크 형식: https://drive.google.com/file/d/FILE_ID/view
 *     → 자동으로 직접다운로드 URL로 변환: https://drive.google.com/uc?export=download&id=FILE_ID
 *   - fallback: /거래명세서양식.xlsx (public 폴더 복사본)
 *
 * 양식 셀 맵 (0-indexed row, 0-indexed col):
 * - 공급받는자 등록번호: N5(r4,c13)
 * - 공급받는자 상호:     N6(r5,c13)  대표: R6(r5,c17)
 * - 공급받는자 주소:     N7(r6,c13)
 * - 작성일자:           E13(r12,c4)
 * - 품목행(row16~26):   B=순번, C=월, D=일, E=품목(~K), L=수량, M=단가, O=공급가액, Q=부가세, T=비고
 * - 공급가 합계:        E27(r26,c4)
 * - 부가세 합계:        J27(r26,c9)
 * - 합계 금액:          O27(r26,c14)
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
  // 1. 구글 URL → 직접 다운로드 URL 변환
  //    케이스 A: docs.google.com/spreadsheets (Google Sheets)
  //      https://docs.google.com/spreadsheets/d/FILE_ID/edit?...
  //      → https://docs.google.com/spreadsheets/d/FILE_ID/export?format=xlsx
  //    케이스 B: drive.google.com/file/d/FILE_ID/view
  //      → https://drive.google.com/uc?export=download&id=FILE_ID
  //    케이스 C: drive.google.com/open?id=FILE_ID
  //      → https://drive.google.com/uc?export=download&id=FILE_ID
  //    그 외 http URL: 그대로 사용
  //    로컬 경로 또는 미설정: fallback (public 폴더 복사본)
  let fetchUrl = '/거래명세서양식.xlsx'; // fallback

  if (templateUrl) {
    if (templateUrl.includes('docs.google.com/spreadsheets')) {
      // Google Sheets → xlsx export
      const fileIdMatch = templateUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
      if (fileIdMatch) {
        fetchUrl = `https://docs.google.com/spreadsheets/d/${fileIdMatch[1]}/export?format=xlsx`;
      }
    } else if (templateUrl.includes('drive.google.com')) {
      // Google Drive 파일
      const fileIdMatch = templateUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
                          templateUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (fileIdMatch) {
        fetchUrl = `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
      }
    } else if (templateUrl.startsWith('http')) {
      fetchUrl = templateUrl; // 기타 직접 HTTP URL
    }
    // else: 로컬 경로(.html 등) → fallback 유지
  }

  // 2. 양식 파일 fetch
  const response = await fetch(fetchUrl);
  if (!response.ok) throw new Error(`거래명세서 양식 파일 로드 실패 (${fetchUrl}): HTTP ${response.status}`);

  // 응답 Content-Type 체크 - HTML이 반환된 경우 명확한 오류 표시
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error(
      `거래명세서 양식 파일을 받지 못했습니다 (HTML 응답).\n` +
      `구글 드라이브 파일이 "링크 있는 모든 사용자" 공개로 설정되었는지 확인하세요.\n` +
      `(fetchUrl: ${fetchUrl})`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellStyles: true });

  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  const setCell = (addr: string, value: any, numFmt?: string) => {
    if (!ws[addr]) ws[addr] = { t: typeof value === 'number' ? 'n' : 's', v: value };
    else ws[addr] = { ...ws[addr], v: value, t: typeof value === 'number' ? 'n' : 's' };
    if (numFmt) ws[addr].z = numFmt;
  };

  const supplyTotal = Math.round((billing?.totalAmount || 0) / 1.1);
  const vatTotal = (billing?.totalAmount || 0) - supplyTotal;
  const totalAmount = billing?.totalAmount || 0;

  // 발행 날짜 파싱
  const billingDate: string = billing?.billingDate || '';
  const billingYm: string = billing?.billingYm || '';
  const [dateY, dateM, dateD] = billingDate ? billingDate.split('-') : ['', '', ''];

  // === 공급받는자 정보 채우기 ===
  setCell('N5', customer?.bizRegNo || '');           // 등록번호
  setCell('N6', customer?.name || '');                // 상호
  setCell('R6', customer?.representative || '');      // 대표
  setCell('N7', customer?.address || '');             // 주소
  setCell('E13', billingDate || billingYm);           // 작성일자

  // === 품목 행 채우기 (row16~row26 = r15~r25, 최대 11행) ===
  const ITEM_START_ROW = 15; // 0-indexed (row 16)
  const ITEM_MAX = 11;

  for (let i = 0; i < ITEM_MAX; i++) {
    const d = details[i];
    const rowIdx = ITEM_START_ROW + i;
    const rB = XLSX.utils.encode_cell({ r: rowIdx, c: 1 }); // 순번 (B)
    const rC = XLSX.utils.encode_cell({ r: rowIdx, c: 2 }); // 월 (C)
    const rD = XLSX.utils.encode_cell({ r: rowIdx, c: 3 }); // 일 (D)
    const rE = XLSX.utils.encode_cell({ r: rowIdx, c: 4 }); // 품목 (E)
    const rL = XLSX.utils.encode_cell({ r: rowIdx, c: 11 }); // 수량 (L)
    const rM = XLSX.utils.encode_cell({ r: rowIdx, c: 12 }); // 단가 (M)
    const rO = XLSX.utils.encode_cell({ r: rowIdx, c: 14 }); // 공급가액 (O)
    const rQ = XLSX.utils.encode_cell({ r: rowIdx, c: 16 }); // 부가세 (Q)
    const rT = XLSX.utils.encode_cell({ r: rowIdx, c: 19 }); // 비고 (T)

    if (d) {
      const itemSupply = Math.round(d.amount / 1.1);
      const itemVat = d.amount - itemSupply;

      setCell(rB, i + 1, '0');
      setCell(rC, dateM ? Number(dateM) : '');
      setCell(rD, dateD ? Number(dateD) : '');
      setCell(rE, d.itemName + (d.description ? ` [${d.description}]` : ''));
      setCell(rL, d.quantity || 1, '0');
      setCell(rM, d.unitPrice || itemSupply, '#,##0');
      setCell(rO, itemSupply, '#,##0');
      setCell(rQ, itemVat, '#,##0');
      setCell(rT, siteName || '');
    } else {
      // 빈 행 초기화 (기존 더미값 제거)
      setCell(rB, '');
      setCell(rO, 0, '#,##0');
      setCell(rQ, 0, '#,##0');
    }
  }

  // === 합계 행 채우기 (row27 = r26) ===
  setCell('E27', supplyTotal, '#,##0');
  setCell('J27', vatTotal, '#,##0');
  setCell('O27', totalAmount, '#,##0');

  // 2. 파일 다운로드
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};
