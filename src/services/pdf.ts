// d:\Kiyeun_Lift\src\services\pdf.ts
// 거래명세서 Excel 양식 데이터 → 시스템 PDF 변환 (html2canvas + jsPDF)
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import ExcelJS from 'exceljs';

/** 구글 드라이브 / 기타 URL → 직접 다운로드 URL 변환 */
function resolveTemplateUrl(templateUrl?: string): string {
  if (!templateUrl) return '/거래명세서양식.xlsx';
  if (templateUrl.includes('docs.google.com/spreadsheets')) {
    const m = templateUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=xlsx`;
  }
  if (templateUrl.includes('drive.google.com')) {
    const m = templateUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || templateUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  }
  if (templateUrl.startsWith('http')) return templateUrl;
  return '/거래명세서양식.xlsx';
}

/** ArrayBuffer → base64 data URL */
function bufferToDataUrl(buf: ArrayBuffer, ext: string): string {
  const uint8 = new Uint8Array(buf);
  let binary = '';
  uint8.forEach(b => (binary += String.fromCharCode(b)));
  return `data:image/${ext};base64,${btoa(binary)}`;
}

/** 거래명세서 HTML 생성 (Excel 템플릿 레이아웃 재현) */
function buildStatementHTML(
  billing: any,
  details: any[],
  customer: any,
  siteName: string,
  stampDataUrl: string
): string {
  const billingDate: string = billing?.billingDate || billing?.billingYm || '';
  const parts = billingDate.split('-');
  const dateM = parts[1] ? Number(parts[1]) : '';
  const dateD = parts[2] ? Number(parts[2]) : '';

  const ITEM_MAX = 11;
  const borderColor = '#2E75B6';
  const labelBg = '#D9E1F2';
  const headerBg = '#BDD7EE';
  const titleColor = '#1F5C8B';

  // 품목행 HTML 생성
  let itemRows = '';
  let calcSupply = 0;
  let calcVat = 0;
  for (let i = 0; i < ITEM_MAX; i++) {
    const d = details[i];
    if (d) {
      const supply = (d.unitPrice || 0) * (d.quantity || 1);
      const vat = Math.round(supply * 0.1);
      calcSupply += supply;
      calcVat += vat;
      itemRows += `
        <tr style="height:22px;">
          <td style="${cellStyle(borderColor)};text-align:center;">${i + 1}</td>
          <td style="${cellStyle(borderColor)};text-align:center;">${dateM}</td>
          <td style="${cellStyle(borderColor)};text-align:center;">${dateD}</td>
          <td style="${cellStyle(borderColor)};text-align:left;padding-left:4px;">${escHtml(d.itemName)}${d.description ? ` [${escHtml(d.description)}]` : ''}</td>
          <td style="${cellStyle(borderColor)};text-align:center;">${d.quantity || 1}</td>
          <td style="${cellStyle(borderColor)};text-align:right;padding-right:4px;">${supply > 0 ? (d.unitPrice || 0).toLocaleString() : ''}</td>
          <td style="${cellStyle(borderColor)};text-align:right;padding-right:4px;">${supply.toLocaleString()}</td>
          <td style="${cellStyle(borderColor)};text-align:right;padding-right:4px;">${vat.toLocaleString()}</td>
          <td style="${cellStyle(borderColor)};text-align:center;">${escHtml(siteName)}</td>
        </tr>`;
    } else {
      itemRows += `
        <tr style="height:22px;">
          <td style="${cellStyle(borderColor)}"></td>
          <td style="${cellStyle(borderColor)}"></td>
          <td style="${cellStyle(borderColor)}"></td>
          <td style="${cellStyle(borderColor)}"></td>
          <td style="${cellStyle(borderColor)}"></td>
          <td style="${cellStyle(borderColor)}"></td>
          <td style="${cellStyle(borderColor)};text-align:right;padding-right:4px;">-</td>
          <td style="${cellStyle(borderColor)};text-align:right;padding-right:4px;">-</td>
          <td style="${cellStyle(borderColor)}"></td>
        </tr>`;
    }
  }

  const totalAmount = calcSupply + calcVat;

  const stampImg = stampDataUrl
    ? `<img src="${stampDataUrl}" style="position:absolute;right:2px;top:2px;width:70px;height:70px;opacity:0.85;" />`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; font-size: 9pt; background: white; color: #000; }
  table { border-collapse: collapse; width: 100%; }
  td, th { padding: 2px 3px; vertical-align: middle; white-space: nowrap; }
</style>
</head>
<body>
<div style="width:780px;padding:10px 12px;background:white;">

  <!-- 제목 -->
  <div style="text-align:center;font-size:22pt;font-weight:bold;color:${titleColor};
    letter-spacing:8px;border:2px solid ${borderColor};padding:8px 0;margin-bottom:2px;">
    거  래  명  세  표
  </div>
  <div style="text-align:center;font-size:9pt;border:1px solid ${borderColor};
    border-top:none;padding:3px 0;margin-bottom:6px;">
    (공급받는자 보관용)
  </div>

  <!-- 공급자 / 공급받는자 -->
  <table style="border:1px solid ${borderColor};margin-bottom:4px;">
    <colgroup>
      <col style="width:30px"><col style="width:60px"><col style="width:150px">
      <col style="width:30px"><col style="width:100px">
      <col style="width:5px">
      <col style="width:30px"><col style="width:60px"><col style="width:150px">
      <col style="width:30px"><col style="width:100px">
    </colgroup>
    <!-- 타이틀 행 -->
    <tr style="height:20px;">
      <td rowspan="8" style="background:${labelBg};border:1px solid ${borderColor};
        text-align:center;font-weight:bold;writing-mode:vertical-rl;letter-spacing:4px;
        font-size:10pt;width:30px;">공&nbsp;&nbsp;&nbsp;급&nbsp;&nbsp;&nbsp;자</td>
      <td style="${labelCell(borderColor,labelBg)}">등록번호</td>
      <td colspan="3" style="${cellStyle(borderColor)}">138-81-83251</td>
      <td rowspan="8" style="border:1px solid ${borderColor};width:5px;background:${labelBg};"></td>
      <td rowspan="8" style="background:${labelBg};border:1px solid ${borderColor};
        text-align:center;font-weight:bold;writing-mode:vertical-rl;letter-spacing:2px;
        font-size:10pt;width:30px;">공&nbsp;급&nbsp;받&nbsp;는&nbsp;자</td>
      <td style="${labelCell(borderColor,labelBg)}">등록번호</td>
      <td colspan="3" style="${cellStyle(borderColor)}">${escHtml(customer?.bizRegNo || '')}</td>
    </tr>
    <tr style="height:28px;">
      <td style="${labelCell(borderColor,labelBg)}">상호</td>
      <td style="${cellStyle(borderColor)}">주식회사 기연리프트</td>
      <td style="${labelCell(borderColor,labelBg)}">대표</td>
      <td style="position:relative;${cellStyle(borderColor)}">이수용${stampImg}</td>
      <td style="${labelCell(borderColor,labelBg)}">상호</td>
      <td colspan="2" style="${cellStyle(borderColor)}">${escHtml(customer?.name || '')}</td>
      <td style="${labelCell(borderColor,labelBg)}">대표</td>
      <td style="${cellStyle(borderColor)}">${escHtml(customer?.representative || '')}</td>
    </tr>
    <tr style="height:20px;">
      <td style="${labelCell(borderColor,labelBg)}">주소</td>
      <td colspan="3" style="${cellStyle(borderColor)};font-size:7.5pt;">경기도 용인시 처인구 모현읍 갈담로112번길 21-3</td>
      <td style="${labelCell(borderColor,labelBg)}">주소</td>
      <td colspan="3" style="${cellStyle(borderColor)};font-size:8pt;">${escHtml(customer?.address || '')}</td>
    </tr>
    <tr style="height:20px;">
      <td style="${labelCell(borderColor,labelBg)}">업태</td>
      <td style="${cellStyle(borderColor)};font-size:7.5pt;">사업지원 및 임대서비스업 외</td>
      <td style="${labelCell(borderColor,labelBg)}">종목</td>
      <td style="${cellStyle(borderColor)};font-size:7.5pt;">고소장비임대업 외</td>
      <td style="${labelCell(borderColor,labelBg)}">업태</td>
      <td colspan="2" style="${cellStyle(borderColor)}"></td>
      <td style="${labelCell(borderColor,labelBg)}">종목</td>
      <td style="${cellStyle(borderColor)}"></td>
    </tr>
    <tr style="height:20px;">
      <td style="${labelCell(borderColor,labelBg)}">계약담당자</td>
      <td style="${cellStyle(borderColor)}"></td>
      <td style="${labelCell(borderColor,labelBg)}">연락처</td>
      <td style="${cellStyle(borderColor)}"></td>
      <td style="${labelCell(borderColor,labelBg)}">담당자</td>
      <td colspan="2" style="${cellStyle(borderColor)}"></td>
      <td style="${labelCell(borderColor,labelBg)}">연락처</td>
      <td style="${cellStyle(borderColor)}"></td>
    </tr>
    <tr style="height:20px;">
      <td style="${labelCell(borderColor,labelBg)}">계산서담당자</td>
      <td style="${cellStyle(borderColor)}"></td>
      <td style="${labelCell(borderColor,labelBg)}">연락처</td>
      <td style="${cellStyle(borderColor)}"></td>
      <td colspan="4" style="${cellStyle(borderColor)}"></td>
    </tr>
    <tr style="height:20px;">
      <td style="${labelCell(borderColor,labelBg)}">이메일</td>
      <td colspan="3" style="${cellStyle(borderColor)}">giyeonlift@naver.com</td>
      <td colspan="4" style="${cellStyle(borderColor)}"></td>
    </tr>
    <tr style="height:20px;">
      <td style="${labelCell(borderColor,labelBg)}">공급내역</td>
      <td colspan="3" style="${cellStyle(borderColor)}"></td>
      <td colspan="4" style="${cellStyle(borderColor)}"></td>
    </tr>
  </table>

  <!-- 작성일자 / 입금계좌 -->
  <table style="border:1px solid ${borderColor};margin-bottom:4px;">
    <tr style="height:22px;">
      <td style="${labelCell(borderColor,labelBg)};width:60px;">작성일자</td>
      <td style="${cellStyle(borderColor)};width:220px;">${billingDate}</td>
      <td style="${labelCell(borderColor,labelBg)};width:60px;">입금계좌</td>
      <td style="${cellStyle(borderColor)}">신한은행 140-010-007060 , 주식회사 기연리프트</td>
    </tr>
  </table>

  <!-- 품목 테이블 -->
  <table style="border:1px solid ${borderColor};margin-bottom:4px;">
    <colgroup>
      <col style="width:30px"><col style="width:22px"><col style="width:22px">
      <col style="width:240px"><col style="width:35px"><col style="width:70px">
      <col style="width:80px"><col style="width:70px"><col style="width:60px">
    </colgroup>
    <!-- 헤더 -->
    <tr style="height:24px;background:${headerBg};">
      <th style="${cellStyle(borderColor)};text-align:center;font-weight:bold;">순번</th>
      <th style="${cellStyle(borderColor)};text-align:center;font-weight:bold;">월</th>
      <th style="${cellStyle(borderColor)};text-align:center;font-weight:bold;">일</th>
      <th style="${cellStyle(borderColor)};text-align:center;font-weight:bold;">품목</th>
      <th style="${cellStyle(borderColor)};text-align:center;font-weight:bold;">수량</th>
      <th style="${cellStyle(borderColor)};text-align:center;font-weight:bold;">단가</th>
      <th style="${cellStyle(borderColor)};text-align:center;font-weight:bold;">공급가액</th>
      <th style="${cellStyle(borderColor)};text-align:center;font-weight:bold;">부가세</th>
      <th style="${cellStyle(borderColor)};text-align:center;font-weight:bold;">비고</th>
    </tr>
    ${itemRows}
    <!-- 합계 행 -->
    <tr style="height:26px;background:${labelBg};font-weight:bold;">
      <td colspan="2" style="${cellStyle(borderColor)};text-align:center;">공급가</td>
      <td style="${cellStyle(borderColor)};text-align:center;">￦</td>
      <td style="${cellStyle(borderColor)};text-align:right;padding-right:4px;">${calcSupply.toLocaleString()}</td>
      <td style="${cellStyle(borderColor)};text-align:center;">부가세</td>
      <td style="${cellStyle(borderColor)};text-align:center;">￦</td>
      <td style="${cellStyle(borderColor)};text-align:right;padding-right:4px;">${calcVat.toLocaleString()}</td>
      <td style="${cellStyle(borderColor)};text-align:center;">합계</td>
      <td style="${cellStyle(borderColor)};text-align:right;padding-right:4px;">${totalAmount.toLocaleString()}</td>
    </tr>
  </table>

  <div style="text-align:right;font-size:8pt;color:#555;margin-top:2px;">
    (주)기연리프트 | 사업자등록번호: 138-81-83251 | 대표: 이수용
  </div>
</div>
</body>
</html>`;
}

function cellStyle(border: string): string {
  return `border:1px solid ${border};`;
}
function labelCell(border: string, bg: string): string {
  return `border:1px solid ${border};background:${bg};font-weight:bold;text-align:center;white-space:nowrap;`;
}
function escHtml(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 거래명세서 PDF 직접 다운로드
 * ExcelJS로 양식 로드 → 도장 이미지 추출 → HTML 렌더링 → html2canvas → jsPDF
 */
export const downloadTransactionStatementPDF = async (
  billing: any,
  details: any[],
  customer: any,
  contract: any,
  siteName: string,
  templateUrl?: string,
  fileName?: string
): Promise<void> => {

  // 1. 도장 이미지 추출 (ExcelJS)
  let stampDataUrl = '';
  try {
    const fetchUrl = resolveTemplateUrl(templateUrl);
    const resp = await fetch(fetchUrl);
    if (resp.ok && !(resp.headers.get('content-type') || '').includes('text/html')) {
      const ab = await resp.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(ab);
      const ws = wb.worksheets[0];
      const images = ws.getImages();
      if (images.length > 0) {
        const img = wb.getImage(images[0].imageId as unknown as number);
        if (img?.buffer) {
          stampDataUrl = bufferToDataUrl(img.buffer as ArrayBuffer, img.extension || 'png');
        }
      }
    }
  } catch (_) {
    // 도장 추출 실패 시 무시하고 텍스트만으로 진행
  }

  // 2. HTML 생성
  const html = buildStatementHTML(billing, details, customer, siteName, stampDataUrl);

  // 3. 숨김 컨테이너에 렌더링
  const container = document.createElement('div');
  container.style.cssText =
    'position:fixed;top:-9999px;left:-9999px;width:794px;background:white;z-index:-9999;';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    // 4. html2canvas → jsPDF
    const canvas = await html2canvas(container.querySelector('div') as HTMLElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = (canvas.height * pdfW) / canvas.width;

    // A4를 초과하는 경우 다음 페이지
    const pageH = pdf.internal.pageSize.getHeight();
    if (pdfH <= pageH) {
      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
    } else {
      let y = 0;
      while (y < pdfH) {
        pdf.addImage(imgData, 'PNG', 0, -y, pdfW, pdfH);
        y += pageH;
        if (y < pdfH) pdf.addPage();
      }
    }

    const custName = customer?.name || '고객사';
    const ym = billing?.billingYm || '';
    pdf.save(`${fileName || `${custName}_${siteName}_${ym}`}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
};
