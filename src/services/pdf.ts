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
  contract: any,
  site: any,
  salesperson: any,
  stampDataUrl: string
): string {
  const billingDate: string = billing?.billingDate || billing?.billingYm || new Date().toISOString().split('T')[0];
  const pts   = billingDate.split('-');
  const dateY = pts[0] || '';
  const dateM = pts[1] ? Number(pts[1]) : '';
  const dateD = pts[2] ? Number(pts[2]) : '';
  const formattedBillingDate = `${dateY}년 ${String(dateM).padStart(2, '0')}월 ${String(dateD).padStart(2, '0')}일`;

  const ITEM_MAX = 10;
  const BLUE = '#1B65A6';
  const dotted = `1px dotted ${BLUE}`;
  const solid  = `1px solid ${BLUE}`;
  const dbl    = `3px double ${BLUE}`;
  const outer  = `2px solid ${BLUE}`;
  const ROW_H  = 20;

  let itemRows = '';
  let supplyTotal = 0;
  let vatTotal    = 0;

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

      const modelHeight = d.assetHeight ? `${d.itemName} / ${d.assetHeight}` : d.itemName;
      const category = d.billingCategory || d.itemType || (d.itemName?.includes('운송') ? '운송비' : d.itemName?.includes('옵션') ? '옵션' : '렌탈료');
      const inputDate = d.siteInputDate || contract?.startDate || '';
      const servicePeriod = d.servicePeriod || (d.startDate && d.endDate ? `${d.startDate} ~ ${d.endDate}` : `${billing?.billingYm || ''} 정산`);

      itemRows += `
      <tr style="height:${ROW_H}px">
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:center">${i+1}</td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:center">${dateM}</td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:center">${dateD}</td>
        <td style="border-right:${dotted};border-bottom:${dotted};padding-left:4px;overflow:hidden;text-overflow:ellipsis">${esc(modelHeight)}</td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:center">${esc(d.assetNo || '-')}</td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:center">${esc(inputDate)}</td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:center;font-size:8px">${esc(servicePeriod)}</td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:center">${esc(category)}</td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:center">${d.quantity||1}</td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:right;padding-right:4px">${supply>0?(d.unitPrice||0).toLocaleString():''}</td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:right;padding-right:4px">${supply.toLocaleString()}</td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:right;padding-right:4px">${vat.toLocaleString()}</td>
        <td style="border-bottom:${dotted};padding-left:4px;overflow:hidden;text-overflow:ellipsis">${esc(d.memo || d.description || '')}</td>
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
        <td style="border-right:${dotted};border-bottom:${dotted}"></td>
        <td style="border-right:${dotted};border-bottom:${dotted}"></td>
        <td style="border-right:${dotted};border-bottom:${dotted}"></td>
        <td style="border-right:${dotted};border-bottom:${dotted}"></td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:right;padding-right:4px;color:#000">-</td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:right;padding-right:4px;color:#000">-</td>
        <td style="border-bottom:${dotted}"></td>
      </tr>`;
    }
  }

  const total = supplyTotal + vatTotal;
  const stampImg = stampDataUrl
    ? `<img src="${stampDataUrl}" style="position:absolute;right:4px;top:-6px;width:30px;height:30px;opacity:0.9;z-index:99">`
    : '';

  const billingNoStr = billing?.id || billing?.billingNo || '';
  const spName = salesperson?.name || contract?.salespersonName || '';
  const spPhone = salesperson?.mobile || salesperson?.phone || '';

  const siteManagerName = site?.managerName || site?.contactName || customer?.managerName || '';
  const siteManagerPhone = site?.managerPhone || site?.contactPhone || customer?.phone || '';
  const billingManagerName = customer?.billingManagerName || customer?.managerName || '';
  const billingManagerPhone = customer?.billingManagerPhone || customer?.phone || '';
  const billingEmail = customer?.billingEmail || customer?.email || '';
  const sName = site?.name || (typeof site === 'string' ? site : '') || '';

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
    font-size: 8.5px;
    color: #000;
  }
  * { box-sizing: border-box; }
  table {
    border-collapse: collapse;
    table-layout: fixed;
    width: 100%;
  }
  td, th {
    padding: 0 3px;
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
    padding-left: 3px;
  }
</style>
</head>
<body>
<div style="width: 700px; padding: 10px 0; background: #fff; position: relative;">

  <!-- 청구번호 표시 -->
  <div style="position: absolute; top: 10px; left: 0; font-size: 8.5px; color: #1B65A6; font-weight: bold;">
    청구번호: ${esc(billingNoStr)}
  </div>

  <!-- ① 타이틀 -->
  <div style="text-align: center; margin-bottom: 4px;">
    <span style="font-size: 20px; font-weight: bold; color: ${BLUE}; letter-spacing: 10px; border-bottom: ${dbl}; padding-bottom: 3px; display: inline-block;">거 래 명 세 서</span>
  </div>
  <div style="text-align: center; font-size: 9px; color: ${BLUE}; margin-bottom: 8px;">(공급받는자 보관용)</div>

  <!-- ② 공급자 / 공급받는자 정보 박스 -->
  <div style="border: ${outer}; margin-bottom: 6px;">

    <table>
      <colgroup>
        <col style="width: 20px;"> <!-- 1: 공급자 세로 -->
        <col style="width: 65px;"> <!-- 2: 레이블 -->
        <col style="width: 120px;"><!-- 3: 값 -->
        <col style="width: 35px;"> <!-- 4: 대표 레이블 -->
        <col style="width: 108px;"><!-- 5: 대표자+도장 -->
        <col style="width: 4px;">   <!-- 6: 중앙 이중 구분선 -->
        <col style="width: 20px;"> <!-- 7: 공급받는자 세로 -->
        <col style="width: 65px;"> <!-- 8: 레이블 -->
        <col style="width: 120px;"><!-- 9: 값 -->
        <col style="width: 35px;"> <!-- 10: 대표 레이블 -->
        <col style="width: 108px;"><!-- 11: 대표자명 -->
      </colgroup>

      <!-- 1행: 등록번호 -->
      <tr style="height: 19px;">
        <td rowspan="8" class="L" style="border-right: ${solid}; writing-mode: vertical-rl; letter-spacing: 3px; font-size: 9.5px;">공&nbsp;급&nbsp;자</td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">등록번호</td>
        <td colspan="3" class="V" style="border-bottom: ${dotted}; font-weight: bold; text-align: center; letter-spacing: 1px;">138-81-83251</td>
        <td rowspan="8" style="border-right: ${dbl};"></td>
        <td rowspan="8" class="L" style="border-right: ${solid}; writing-mode: vertical-rl; letter-spacing: 2px; font-size: 9.5px;">공급받는자</td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">등록번호</td>
        <td colspan="3" class="V" style="border-bottom: ${dotted}; font-size: 8.5px;">${esc(customer?.bizRegNo || '')}</td>
      </tr>

      <!-- 2행: 상호 / 대표 -->
      <tr style="height: 19px;">
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">상호</td>
        <td class="V" style="border-right: ${dotted}; border-bottom: ${dotted}; font-size: 8.5px;">주식회사 기연리프트</td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">대표</td>
        <td class="V" style="position: relative; overflow: visible !important; border-bottom: ${dotted}; font-size: 8.5px;">이수용${stampImg}</td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">상호</td>
        <td class="V" style="border-right: ${dotted}; border-bottom: ${dotted}; font-size: 8.5px;">${esc(customer?.name || '')}</td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">대표</td>
        <td class="V" style="border-bottom: ${dotted}; font-size: 8.5px;">${esc(customer?.representative || '')}</td>
      </tr>

      <!-- 3행: 주소 -->
      <tr style="height: 19px;">
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">주소</td>
        <td colspan="3" class="V" style="border-bottom: ${dotted}; font-size: 8px;">경기도 용인시 처인구 모현읍 갈담로112번길 21-3</td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">주소</td>
        <td colspan="3" class="V" style="border-bottom: ${dotted}; font-size: 8px;">${esc(customer?.address || '')}</td>
      </tr>

      <!-- 4행: 업태 / 종목 -->
      <tr style="height: 19px;">
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">업태</td>
        <td class="V" style="border-right: ${dotted}; border-bottom: ${dotted}; font-size: 7.5px;">사업지원 및 임대서비스업 외</td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">종목</td>
        <td class="V" style="border-bottom: ${dotted}; font-size: 7.5px;">고소장비임대업 외</td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">업태</td>
        <td class="V" style="border-right: ${dotted}; border-bottom: ${dotted}; font-size: 7.5px;">${esc(customer?.bizType || '')}</td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">종목</td>
        <td class="V" style="border-bottom: ${dotted}; font-size: 7.5px;">${esc(customer?.bizItem || '')}</td>
      </tr>

      <!-- 5행: 계약담당자(영업사원) / 현장담당자 -->
      <tr style="height: 19px;">
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">계약담당자</td>
        <td class="V" style="border-right: ${dotted}; border-bottom: ${dotted}; font-weight: bold;">${esc(spName)}</td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">연락처</td>
        <td class="V" style="border-bottom: ${dotted};">${esc(spPhone)}</td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">현장담당자</td>
        <td class="V" style="border-right: ${dotted}; border-bottom: ${dotted};">${esc(siteManagerName)}</td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">연락처</td>
        <td class="V" style="border-bottom: ${dotted};">${esc(siteManagerPhone)}</td>
      </tr>

      <!-- 6행: 계산서담당자 / 연락처 -->
      <tr style="height: 19px;">
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">계산서담당자</td>
        <td class="V" style="border-right: ${dotted}; border-bottom: ${dotted};">정수아</td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">연락처</td>
        <td class="V" style="border-bottom: ${dotted};">031-334-5295</td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">계산서담당자</td>
        <td class="V" style="border-right: ${dotted}; border-bottom: ${dotted};">${esc(billingManagerName)}</td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">연락처</td>
        <td class="V" style="border-bottom: ${dotted};">${esc(billingManagerPhone)}</td>
      </tr>

      <!-- 7행: 이메일 / 계산서메일 -->
      <tr style="height: 19px;">
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">이메일</td>
        <td colspan="3" class="V" style="border-bottom: ${dotted}; font-size: 8.5px;">giyeonlift@naver.com</td>
        <td class="L" style="border-right: ${dotted}; border-bottom: ${dotted};">계산서메일</td>
        <td colspan="3" class="V" style="border-bottom: ${dotted}; font-size: 8.5px;">${esc(billingEmail)}</td>
      </tr>

      <!-- 8행: 공급내역 / 현장명 -->
      <tr style="height: 19px;">
        <td class="L" style="border-right: ${dotted};">공급내역</td>
        <td colspan="3" class="V">고소작업대 임대료 외</td>
        <td class="L" style="border-right: ${dotted};">현장명</td>
        <td colspan="3" class="V" style="font-weight: bold;">${esc(sName)}</td>
      </tr>
    </table>

    <!-- 작성일자 & 입금계좌 -->
    <table style="border-top: ${solid};">
      <colgroup>
        <col style="width: 85px;">
        <col style="width: 261px;">
        <col style="width: 4px;">
        <col style="width: 85px;">
        <col style="width: 261px;">
      </colgroup>
      <tr style="height: 20px;">
        <td class="L" style="border-right: ${solid}; font-size: 9px;">작성일자</td>
        <td class="V" style="padding-left: 6px; font-size: 9px;">${formattedBillingDate}</td>
        <td style="border-right: ${dbl};"></td>
        <td class="L" style="border-right: ${solid}; font-size: 9px;">입금계좌</td>
        <td class="V" style="padding-left: 6px; font-weight: bold; font-size: 8.5px;">신한은행 140-010-007060 , 주식회사 기연리프트</td>
      </tr>
    </table>

  </div>

  <!-- ③ 품목 및 금액 테이블 (신규 컬럼 구조) -->
  <div style="border: ${outer};">
    <table>
      <colgroup>
        <col style="width: 24px;">  <!-- 1. 순번 -->
        <col style="width: 18px;">  <!-- 2. 월 -->
        <col style="width: 18px;">  <!-- 3. 일 -->
        <col style="width: 105px;"> <!-- 4. 모델 / 높이 -->
        <col style="width: 55px;">  <!-- 5. 관리번호 -->
        <col style="width: 62px;">  <!-- 6. 현장투입일 -->
        <col style="width: 125px;"> <!-- 7. 사용 기간 -->
        <col style="width: 42px;">  <!-- 8. 청구구분 -->
        <col style="width: 28px;">  <!-- 9. 수량 -->
        <col style="width: 55px;">  <!-- 10. 단가 -->
        <col style="width: 60px;">  <!-- 11. 공급가액 -->
        <col style="width: 52px;">  <!-- 12. 세액 -->
        <col style="width: 56px;">  <!-- 13. 비고 -->
      </colgroup>

      <!-- 품목 헤더 -->
      <tr style="height: 21px; background-color: #f8fafc;">
        <th class="L" style="border-right: ${dotted}; border-bottom: ${solid};">순번</th>
        <th class="L" style="border-right: ${dotted}; border-bottom: ${solid};">월</th>
        <th class="L" style="border-right: ${dotted}; border-bottom: ${solid};">일</th>
        <th class="L" style="border-right: ${dotted}; border-bottom: ${solid};">모델 / 높이</th>
        <th class="L" style="border-right: ${dotted}; border-bottom: ${solid};">관리번호</th>
        <th class="L" style="border-right: ${dotted}; border-bottom: ${solid};">현장투입일</th>
        <th class="L" style="border-right: ${dotted}; border-bottom: ${solid};">사용 기간</th>
        <th class="L" style="border-right: ${dotted}; border-bottom: ${solid};">청구구분</th>
        <th class="L" style="border-right: ${dotted}; border-bottom: ${solid};">수량</th>
        <th class="L" style="border-right: ${dotted}; border-bottom: ${solid};">단가</th>
        <th class="L" style="border-right: ${dotted}; border-bottom: ${solid};">공급가액</th>
        <th class="L" style="border-right: ${dotted}; border-bottom: ${solid};">세액</th>
        <th class="L" style="border-bottom: ${solid};">비고</th>
      </tr>

      <!-- 품목 목록 (10행 고정) -->
      ${itemRows}
    </table>

    <!-- ④ 하단 합계 행 -->
    <table style="border-top: ${solid};">
      <colgroup>
        <col style="width: 50px;">
        <col style="width: 15px;">
        <col style="width: 95px;">
        <col style="width: 50px;">
        <col style="width: 15px;">
        <col style="width: 85px;">
        <col style="width: 40px;">
        <col style="width: 15px;">
        <col style="width: 95px;">
        <col style="width: 130px;">
        <col style="width: 110px;">
      </colgroup>
      <tr style="height: 21px; font-weight: bold;">
        <td class="L" style="border-right: ${dotted};">공급가</td>
        <td class="L" style="border-right: ${dotted};">₩</td>
        <td style="border-right: ${solid}; text-align: right; padding-right: 4px;">${supplyTotal.toLocaleString()}</td>
        <td class="L" style="border-right: ${dotted};">부가세</td>
        <td class="L" style="border-right: ${dotted};">₩</td>
        <td style="border-right: ${solid}; text-align: right; padding-right: 4px;">${vatTotal.toLocaleString()}</td>
        <td class="L" style="border-right: ${dotted};">합계</td>
        <td class="L" style="border-right: ${dotted};">₩</td>
        <td style="border-right: ${solid}; text-align: right; padding-right: 4px;">${total.toLocaleString()}</td>
        <td class="L" style="text-align: right; padding-right: 4px;">인수자</td>
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
  billing:     any,
  details:     any[],
  customer:    any,
  contract:    any,
  site:        any,
  salesperson: any,
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

  const html = buildExactStatementHTML(billing, details, customer, contract, site, salesperson, stampDataUrl);

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
    const sName    = site?.name || (typeof site === 'string' ? site : '') || '현장';
    const ym       = billing?.billingYm || '';
    const fileName = `거래명세서_${custName}_${sName}_${ym}.pdf`;

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
  site:        any,
  salesperson?: any,
  templateUrl?: string,
  customFileName?: string
): Promise<void> => {
  const { pdf, fileName } = await generateStatementJsPDF(billing, details, customer, contract, site, salesperson, templateUrl);
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
  site:        any,
  salesperson?: any,
  templateUrl?: string
): Promise<{ filename: string; base64: string }> => {
  const { pdf, fileName } = await generateStatementJsPDF(billing, details, customer, contract, site, salesperson, templateUrl, true);
  
  const dataUri = pdf.output('datauristring');
  const base64  = dataUri.split(',')[1] || '';

  return { filename: fileName, base64 };
};
