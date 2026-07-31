// d:\Kiyeun_Lift\src\services\excel.ts
import * as XLSX from 'xlsx';

export const exportToExcel = (data: any[], fileName: string, sheetName: string = 'Sheet1') => {
  // 한글 컬럼 등으로 변환하고 싶을 때 유용하게 확장 가능
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportTransactionStatementExcel = (
  billing: any,
  details: any[],
  customer: any,
  contract: any,
  siteName: string,
  fileName: string
) => {
  const supplyTotal = Math.round((billing?.totalAmount || 0) / 1.1);
  const vatTotal = (billing?.totalAmount || 0) - supplyTotal;
  const totalAmount = billing?.totalAmount || 0;

  const aoaData: any[][] = [
    ['거 래 명 세 서 (공급받는자 보관용 - (주)기연리프트 표준 엑셀 양식)'],
    [''],
    ['[공급자 정보]', '', '', '', '[공급받는자 정보]'],
    ['상호(법인명)', '(주)기연리프트', '', '', '상호(법인명)', customer?.name || '-'],
    ['사업자등록번호', '138-81-83251', '', '', '사업자등록번호', customer?.bizRegNo || '-'],
    ['대표자명', '이수용', '', '', '대표자명', customer?.representative || '-'],
    ['사업장주소', '경기도 용인시 처인구 남사읍 성호로 81', '', '', '사업장주소', customer?.address || '-'],
    ['대표전화/팩스', '031-334-5296 / 031-335-5297', '', '', '작업현장', siteName || '-'],
    [''],
    ['청구귀속월', billing?.billingYm || '-', '발행일자', billing?.billingDate || '-', '계약번호', contract?.contractNo || '-'],
    [''],
    ['청구 총 금액', `₩${totalAmount.toLocaleString()} (공급가액: ₩${supplyTotal.toLocaleString()} / 부가세: ₩${vatTotal.toLocaleString()})`],
    [''],
    ['No', '품명 및 적용 기준', '수량', '단가', '공급가액', '부가가치세', '합계 금액']
  ];

  details.forEach((d, idx) => {
    const itemSupply = Math.round(d.amount / 1.1);
    const itemVat = d.amount - itemSupply;
    aoaData.push([
      idx + 1,
      `${d.itemName}${d.description ? ` (${d.description})` : ''}`,
      d.quantity || 1,
      d.unitPrice || itemSupply,
      itemSupply,
      itemVat,
      d.amount
    ]);
  });

  aoaData.push([
    '합계',
    '',
    '',
    '',
    supplyTotal,
    vatTotal,
    totalAmount
  ]);
  aoaData.push(['']);
  aoaData.push(['[입금 계좌 안내]', '기업은행 138-81-83251 (주)기연리프트']);

  const ws = XLSX.utils.aoa_to_sheet(aoaData);

  // 셀 넓이 지정
  ws['!cols'] = [
    { wch: 6 },
    { wch: 38 },
    { wch: 8 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '거래명세서');
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};
