// d:\Kiyeun_Lift\src\services\pdf.ts
// PDF 거래명세서 출력 및 메일 첨부용 Base64 생성 서비스
import html2canvas from 'html2canvas';
import { jsPDF }    from 'jspdf';
import ExcelJS      from 'exceljs';

function resolveTemplateUrl(u?: string): string {
  if (!u) return '/거래명세서양식.xlsx';
  if (u.includes('docs.google.com/spreadsheets')) {
    const m = u.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=xlsx`;
  }
  if (u.includes('drive.google.com')) {
    const m = u.match(/\/d\/([a-zA-Z0-9_-]+)/) || u.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  }
  if (u.startsWith('http')) return u;
  return '/거래명세서양식.xlsx';
}

function bufferToDataUrl(buf: ArrayBuffer, ext: string): string {
  const a = new Uint8Array(buf);
  let s = '';
  a.forEach(b => (s += String.fromCharCode(b)));
  return `data:image/${ext};base64,${btoa(s)}`;
}

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildExactStatementHTML(
  billing: any,
  details: any[],
  customer: any,
  siteName: string,
  stampDataUrl: string
): string {
  const billingDate: string = billing?.billingDate || billing?.billingYm || '';
  const pts   = billingDate.split('-');
  const dateM = pts[1] ? Number(pts[1]) : '';
  const dateD = pts[2] ? Number(pts[2]) : '';

  const ITEM_MAX = 11;
  const BLUE = '#1B65A6';
  const dotted = `1px dotted ${BLUE}`;
  const solid  = `1px solid ${BLUE}`;
  const dbl    = `3px double ${BLUE}`;
  const outer  = `2px solid ${BLUE}`;
  const ROW_H  = 20;

  let itemRows = '';
  let supplyTotal = 0;
  let vatTotal    = 0;

  // 렌탈료 항목이 품목 목록 상단에 먼저 나오도록 정렬
  const sortedDetails = [...details].sort((a, b) => {
    const aIsRental = (a.contractAssetId || a.itemName?.includes('렌탈료')) ? 0 : 1;
    const bIsRental = (b.contractAssetId || b.itemName?.includes('렌탈료')) ? 0 : 1;
    return aIsRental - bIsRental;
  });

  for (let i = 0; i < ITEM_MAX; i++) {
    const d = sortedDetails[i];
    if (d) {
      const supply = (d.unitPrice || 0) * (d.quantity || 1);
      const vat    = Math.round(supply * 0.1);
      supplyTotal += supply;
      vatTotal    += vat;
      itemRows += `
      <tr style="height:${ROW_H}px">
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:center">${i+1}</td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:center">${dateM}</td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:center">${dateD}</td>
        <td style="border-right:${dotted};border-bottom:${dotted};padding-left:5px;overflow:hidden;text-overflow:ellipsis">${esc(d.itemName)}</td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:center">${d.quantity||1}</td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:right;padding-right:5px">${supply>0?(d.unitPrice||0).toLocaleString():''}</td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:right;padding-right:5px">${supply.toLocaleString()}</td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:right;padding-right:5px">${vat.toLocaleString()}</td>
        <td style="border-bottom:${dotted};padding-left:5px;overflow:hidden;text-overflow:ellipsis">${esc(siteName)}</td>
      </tr>`;
    } else {
      itemRows += `
      <tr style="height:${ROW_H}px">
        <td style="border-right:${dotted};border-bottom:${dotted}"></td>
        <td style="border-right:${dotted};border-bottom:${dotted}"></td>
        <td style="border-right:${dotted};border-bottom:${dotted}"></td>
        <td style="border-right:${dotted};border-bottom:${dotted}"></td>
        <td style="border-right:${dotted};border-bottom:${dotted}"></td>
        <td style="border-right:${dotted};border-bottom:${dotted}"></td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:right;padding-right:5px;color:#000">-</td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:right;padding-right:5px;color:#000">-</td>
        <td style="border-bottom:${dotted}"></td>
      </tr>`;
    }
  }

  const total = supplyTotal + vatTotal;
  const stampImg = stampDataUrl
    ? `<img src="${stampDataUrl}" style="position:absolute;right:4px;top:-6px;width:30px;height:30px;opacity:0.9;z-index:99">`
    : '';

  const billingNoStr = billing?.id || billing?.billingNo || '';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<style>
  html, body {
    margin: 0;
    padding: 0;
    width: 700px;
    background: #fff;
    font-family: 'Malgun Gothic', '맑은 고딕', Arial, sans-serif;
    font-size: 9px;
    color: #000;
  }
  * { box-sizing: border-box; }
  table {
    border-collapse: collapse;
    table-layout: fixed;
    width: 100%;
  }
  td, th {
    padding: 0 4px;
    vertical-align: middle;
    overflow: hidden;
    white-space: nowrap;
  }
  .L {
    color: ${BLUE};
    font-weight: bold;
    text-align: center;
  }
  .V {
    color: #000;
    padding-left: 4px;
  }
</style>
</head>
<body>
<div style="width: 700px; padding: 10px 0; background: #fff; position: relative;">

  <!-- ① 가장 왼쪽 상단 여백 청구번호 표시 -->
  <div style="position: absolute; top: 10px; left: 0; font-size: 8.5px; color: #1B65A6; font-weight: bold;">
    청구번호: ${esc(billingNoStr)}
  </div>

  <!-- ① 타이틀 -->
  <div style="text-align: center; margin-bottom: 4px;">
    <span style="font-size: 20px; font-weight: bold; color: ${BLUE}; letter-spacing: 10px; border-bottom: ${dbl}; padding-bottom: 3px; display: inline-block;">거 래 명 세 표</span>
  </div>
  <div style="text-align: center; font-size: 9px; color: ${BLUE}; margin-bottom: 8px;">(공급받는자 보관용)</div>

  <!-- ② 공급자 / 공급받는자 / 작성일자 / 입금계좌 (단일 테두리 박스) -->
  <div style="border: ${outer}; margin-bottom: 6px;">

    <!-- 상단 8행: 공급자 vs 공급받는자 정보 (총 696px) -->
    <table>
      <colgroup>
        <col style="width: 24px;"> <!-- 1: 공급자 세로 -->
        <col style="width: 76px;"> <!-- 2: 레이블 -->
        <col style="width: 130px;"><!-- 3: 값 -->
        <col style="width: 40px;"> <!-- 4: 대표 레이블 -->
        <col style="width: 76px;"> <!-- 5: 대표자+도장 -->
        <col style="width: 4px;">  <!-- 6: 중앙 이중 구분선 -->
        <col style="width: 24px;"> <!-- 7: 공급받는자 세로 -->
        <col style="width: 76px;"> <!-- 8: 레이블 -->
        <col style="width: 130px;"><!-- 9: 값 -->
        <col style="width: 40px;"> <!-- 10: 대표 레이블 -->
        <col style="width: 76px;"> <!-- 11: 대표자명 -->
      </colgroup>

      <!-- 1행: 등록번호 -->
      <tr style="height: 20px;">
        <td rowspan="8" class="L" style="border-right: ${solid}; writing-mode: vertical-rl; letter-spacing: 4px; font-size: 10px;">공&nbsp;급&nbsp;자</td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">등록번호</td>
        <td colspan="3" class="V" style="border-bottom: ${dotted}; font-weight: bold; text-align: center; letter-spacing: 1px;">138-81-83251</td>
        <td rowspan="8" style="border-right: ${dbl};"></td>
        <td rowspan="8" class="L" style="border-right: ${solid}; writing-mode: vertical-rl; letter-spacing: 2px; font-size: 10px;">공급받는자</td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">등록번호</td>
        <td colspan="3" class="V" style="border-bottom: ${dotted}; font-size: 9px;">${esc(customer?.bizRegNo || '')}</td>
      </tr>

      <!-- 2행: 상호 / 대표 -->
      <tr style="height: 20px;">
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">상호</td>
        <td class="V" style="border-right: ${dotted}; border-bottom: ${dotted}; font-size: 8.5px;">주식회사 기연리프트</td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">대표</td>
        <td class="V" style="position: relative; overflow: visible !important; border-bottom: ${dotted}; font-size: 9px;">이수용${stampImg}</td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">상호</td>
        <td class="V" style="border-right: ${dotted}; border-bottom: ${dotted}; font-size: 8.5px;">${esc(customer?.name || '')}</td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">대표</td>
        <td class="V" style="border-bottom: ${dotted}; font-size: 9px;">${esc(customer?.representative || '')}</td>
      </tr>

      <!-- 3행: 주소 -->
      <tr style="height: 20px;">
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">주소</td>
        <td colspan="3" class="V" style="border-bottom: ${dotted}; font-size: 8px;">경기도 용인시 처인구 모현읍 갈담로112번길 21-3</td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">주소</td>
        <td colspan="3" class="V" style="border-bottom: ${dotted}; font-size: 8px;">${esc(customer?.address || '')}</td>
      </tr>

      <!-- 4행: 업태 / 종목 -->
      <tr style="height: 20px;">
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">업태</td>
        <td class="V" style="border-right: ${dotted}; border-bottom: ${dotted}; font-size: 7.5px;">사업지원 및 임대서비스업 외</td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">종목</td>
        <td class="V" style="border-bottom: ${dotted}; font-size: 7.5px;">고소장비임대업 외</td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">업태</td>
        <td class="V" style="border-right: ${dotted}; border-bottom: ${dotted};"></td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">종목</td>
        <td class="V" style="border-bottom: ${dotted};"></td>
      </tr>

      <!-- 5행: 담당자 / 연락처 -->
      <tr style="height: 20px;">
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">계약담당자</td>
        <td class="V" style="border-right: ${dotted}; border-bottom: ${dotted};"></td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">연락처</td>
        <td class="V" style="border-bottom: ${dotted};"></td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">담당자</td>
        <td class="V" style="border-right: ${dotted}; border-bottom: ${dotted};"></td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">연락처</td>
        <td class="V" style="border-bottom: ${dotted};"></td>
      </tr>

      <!-- 6행: 계산서담당자 / 연락처 -->
      <tr style="height: 20px;">
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">계산서담당자</td>
        <td class="V" style="border-right: ${dotted}; border-bottom: ${dotted};"></td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">연락처</td>
        <td class="V" style="border-bottom: ${dotted};"></td>
        <td colspan="4" style="border-bottom: ${dotted};"></td>
      </tr>

      <!-- 7행: 이메일 -->
      <tr style="height: 20px;">
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">이메일</td>
        <td colspan="3" class="V" style="border-bottom: ${dotted}; font-size: 8.5px;">giyeonlift@naver.com</td>
        <td colspan="4" style="border-bottom: ${dotted};"></td>
      </tr>

      <!-- 8행: 공급내역 -->
      <tr style="height: 20px;">
        <td class="L" style="border-right: ${dotted};">공급내역</td>
        <td colspan="3" class="V"></td>
        <td colspan="4"></td>
      </tr>
    </table>

    <!-- 하단 1행: 작성일자 & 입금계좌 (단일 이중선 100% 매칭: 696px) -->
    <table style="border-top: ${solid};">
      <colgroup>
        <col style="width: 100px;"> <!-- 작성일자 레이블 (24+76) -->
        <col style="width: 246px;"> <!-- 작성일자 값 (130+40+76) -->
        <col style="width: 4px;">   <!-- 중앙 이중 구분선 (4) -->
        <col style="width: 100px;"> <!-- 입금계좌 레이블 (24+76) -->
        <col style="width: 246px;"> <!-- 입금계좌 값 (130+40+76) -->
      </colgroup>
      <tr style="height: 22px;">
        <td class="L" style="border-right: ${solid}; font-size: 9px;">작성일자</td>
        <td class="V" style="padding-left: 8px; font-size: 9px;">${billingDate}</td>
        <td style="border-right: ${dbl};"></td>
        <td class="L" style="border-right: ${solid}; font-size: 9px;">입금계좌</td>
        <td class="V" style="padding-left: 8px; font-weight: bold; font-size: 8.5px;">신한은행 140-010-007060 , 주식회사 기연리프트</td>
      </tr>
    </table>

  </div>

  <!-- ③ 품목 및 금액 테이블 -->
  <div style="border: ${outer};">
    <table>
      <colgroup>
        <col style="width: 28px;">
        <col style="width: 22px;">
        <col style="width: 22px;">
        <col style="width: 274px;">
        <col style="width: 35px;">
        <col style="width: 75px;">
        <col style="width: 80px;">
        <col style="width: 75px;">
        <col style="width: 85px;">
      </colgroup>

      <!-- 품목 헤더 -->
      <tr style="height: 22px;">
        <th class="L" style="border-right: ${solid}; border-bottom: ${solid};">순번</th>
        <th class="L" style="border-right: ${solid}; border-bottom: ${solid};">월</th>
        <th class="L" style="border-right: ${solid}; border-bottom: ${solid};">일</th>
        <th class="L" style="border-right: ${solid}; border-bottom: ${solid};">품목</th>
        <th class="L" style="border-right: ${solid}; border-bottom: ${solid};">수량</th>
        <th class="L" style="border-right: ${solid}; border-bottom: ${solid};">단가</th>
        <th class="L" style="border-right: ${solid}; border-bottom: ${solid};">공급가액</th>
        <th class="L" style="border-right: ${solid}; border-bottom: ${solid};">부가세</th>
        <th class="L" style="border-bottom: ${solid};">비고</th>
      </tr>

      <!-- 품목 목록 (11행 고정) -->
      ${itemRows}
    </table>

    <!-- ④ 하단 합계 행 -->
    <table style="border-top: ${solid};">
      <colgroup>
        <col style="width: 50px;">
        <col style="width: 20px;">
        <col style="width: 100px;">
        <col style="width: 50px;">
        <col style="width: 20px;">
        <col style="width: 90px;">
        <col style="width: 40px;">
        <col style="width: 20px;">
        <col style="width: 100px;">
        <col style="width: 110px;">
        <col style="width: 96px;">
      </colgroup>
      <tr style="height: 22px; font-weight: bold;">
        <td class="L" style="border-right: ${dotted};">공급가</td>
        <td class="L" style="border-right: ${dotted};">₩</td>
        <td style="border-right: ${solid}; text-align: right; padding-right: 6px;">${supplyTotal.toLocaleString()}</td>
        <td class="L" style="border-right: ${dotted};">부가세</td>
        <td class="L" style="border-right: ${dotted};">₩</td>
        <td style="border-right: ${solid}; text-align: right; padding-right: 6px;">${vatTotal.toLocaleString()}</td>
        <td class="L" style="border-right: ${dotted};">합계</td>
        <td class="L" style="border-right: ${dotted};">₩</td>
        <td style="border-right: ${solid}; text-align: right; padding-right: 6px;">${total.toLocaleString()}</td>
        <td class="L" style="text-align: right; padding-right: 6px;">인수자</td>
        <td class="L">(인)</td>
      </tr>
    </table>
  </div>

</div>
</body>
</html>`;
}

// ──────────────────────────────────────────────────────────────────────────────
// 공통 jsPDF 생성 내부 함수
// ──────────────────────────────────────────────────────────────────────────────
async function generateStatementJsPDF(
  billing:   any,
  details:   any[],
  customer:  any,
  _contract: any,
  siteName:  string,
  templateUrl?: string,
  isCompressForEmail: boolean = false
): Promise<{ pdf: jsPDF; fileName: string }> {

  let stampDataUrl = '';
  try {
    const url  = resolveTemplateUrl(templateUrl);
    const resp = await fetch(url);
    if (resp.ok && !(resp.headers.get('content-type') || '').includes('text/html')) {
      const ab = await resp.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(ab);
      const ws     = wb.worksheets[0];
      const images = ws.getImages();
      if (images.length > 0) {
        const img = wb.getImage(images[0].imageId as unknown as number);
        if (img?.buffer) stampDataUrl = bufferToDataUrl(img.buffer as ArrayBuffer, img.extension || 'png');
      }
    }
  } catch (_) { /* 도장 로드 실패 시 무시 */ }

  const html = buildExactStatementHTML(billing, details, customer, siteName, stampDataUrl);

  const iframe = document.createElement('iframe');
  iframe.style.cssText =
    'position:absolute;top:-9999px;left:0;width:700px;height:950px;border:none;visibility:hidden;';
  document.body.appendChild(iframe);

  try {
    const iDoc = iframe.contentDocument ?? iframe.contentWindow!.document;
    iDoc.open();
    iDoc.write(html);
    iDoc.close();

    await new Promise<void>(resolve => {
      if (iDoc.readyState === 'complete') return resolve();
      iframe.addEventListener('load', () => resolve(), { once: true });
      setTimeout(resolve, 800);
    });

    await new Promise(r => setTimeout(r, 300));

    const iBody = iDoc.body;
    iBody.style.margin   = '0';
    iBody.style.padding  = '0';
    iBody.style.width    = '700px';
    iBody.style.overflow = 'hidden';

    // 메일 첨부용일 경우 scale: 1.6 및 JPEG 82% 압축으로 200KB 내외 경량화
    const canvasScale = isCompressForEmail ? 1.6 : 2.0;
    const canvas = await html2canvas(iBody, {
      scale:           canvasScale,
      useCORS:         true,
      allowTaint:      true,
      logging:         false,
      backgroundColor: '#ffffff',
      width:           700,
      windowWidth:     700,
    });

    const imgFormat = isCompressForEmail ? 'JPEG' : 'PNG';
    const imgData   = isCompressForEmail ? canvas.toDataURL('image/jpeg', 0.82) : canvas.toDataURL('image/png');
    const pdf       = new jsPDF('p', 'mm', 'a4');
    const pageW     = pdf.internal.pageSize.getWidth();  // 210mm
    
    const mx      = 15;
    const my      = 15;
    const printW  = pageW - mx * 2; // 180mm
    const printH  = (canvas.height * printW) / canvas.width;

    pdf.addImage(imgData, imgFormat, mx, my, printW, printH);

    const custName = customer?.name || '고객사';
    const ym       = billing?.billingYm || '';
    const fileName = `거래명세서_${custName}_${siteName}_${ym}.pdf`;

    return { pdf, fileName };

  } finally {
    document.body.removeChild(iframe);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 브라우저 PDF 다운로드 메인
// ──────────────────────────────────────────────────────────────────────────────
export const downloadTransactionStatementPDF = async (
  billing:     any,
  details:     any[],
  customer:    any,
  contract:    any,
  siteName:    string,
  templateUrl?: string,
  customFileName?: string
): Promise<void> => {
  const { pdf, fileName } = await generateStatementJsPDF(billing, details, customer, contract, siteName, templateUrl);
  pdf.save(customFileName ? `${customFileName}.pdf` : fileName);
};

// ──────────────────────────────────────────────────────────────────────────────
// 메일 첨부용 Base64 생성 함수 (순수 base64 반환)
// ──────────────────────────────────────────────────────────────────────────────
export const generateTransactionStatementPdfBase64 = async (
  billing:     any,
  details:     any[],
  customer:    any,
  contract:    any,
  siteName:    string,
  templateUrl?: string
): Promise<{ filename: string; base64: string }> => {
  const { pdf, fileName } = await generateStatementJsPDF(billing, details, customer, contract, siteName, templateUrl, true);
  
  // pure base64 string (data:application/pdf;base64, 접두사 제외)
  const dataUri = pdf.output('datauristring');
  const base64  = dataUri.split(',')[1] || '';

  return { filename: fileName, base64 };
};
