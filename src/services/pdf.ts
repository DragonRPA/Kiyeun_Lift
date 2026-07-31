// d:\Kiyeun_Lift\src\services\pdf.ts
// 거래명세서 Excel 양식 데이터 → 시스템 PDF 변환 (html2canvas + jsPDF)
// 컨테이너 378px(70% 스케일), 내부 374px 기준 완벽 칸 맞춤, windowWidth:378 고정으로 오른쪽 잘림 영구 해결
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

/** HTML 특수문자 이스케이프 */
function escHtml(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 거래명세서 HTML 생성
 * ──────────────────────────────────────────────────────────────
 * 컨테이너: 378px  (이전 540px의 70%)
 * div border 2px×2 = 4px → 내부 실제폭: 374px
 *
 * [정보 테이블]  각 섹션 185px | 분리대 4px | 185px = 374px
 *   각 섹션 컬럼: 11+32+73+21+48 = 185px
 *
 * [날짜/입금 테이블]  38+124+38+174 = 374px
 *
 * [품목 테이블]  14+9+9+147+20+39+46+42+48 = 374px
 *
 * [합계 행]  21+8+77+21+8+56+17+8+56+70+32 = 374px
 * ──────────────────────────────────────────────────────────────
 */
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
  const blue   = '#1B65A6';
  const dotted = `1px dotted ${blue}`;
  const solid  = `1px solid ${blue}`;
  const dbl    = `3px double ${blue}`;
  const outer  = `2px solid ${blue}`;

  let itemRows = '';
  let supplyTotal = 0;
  let vatTotal    = 0;

  for (let i = 0; i < ITEM_MAX; i++) {
    const d = details[i];
    if (d) {
      const supply = (d.unitPrice || 0) * (d.quantity || 1);
      const vat    = Math.round(supply * 0.1);
      supplyTotal += supply;
      vatTotal    += vat;
      itemRows += `
        <tr style="height:14px;">
          <td style="border-right:${dotted};border-bottom:${dotted};text-align:center;">${i + 1}</td>
          <td style="border-right:${dotted};border-bottom:${dotted};text-align:center;">${dateM}</td>
          <td style="border-right:${dotted};border-bottom:${dotted};text-align:center;">${dateD}</td>
          <td style="border-right:${dotted};border-bottom:${dotted};padding-left:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(d.itemName)}</td>
          <td style="border-right:${dotted};border-bottom:${dotted};text-align:center;">${d.quantity || 1}</td>
          <td style="border-right:${dotted};border-bottom:${dotted};text-align:right;padding-right:3px;">${supply > 0 ? (d.unitPrice || 0).toLocaleString() : ''}</td>
          <td style="border-right:${dotted};border-bottom:${dotted};text-align:right;padding-right:3px;">${supply.toLocaleString()}</td>
          <td style="border-right:${dotted};border-bottom:${dotted};text-align:right;padding-right:3px;">${vat.toLocaleString()}</td>
          <td style="border-bottom:${dotted};padding-left:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(siteName)}</td>
        </tr>`;
    } else {
      itemRows += `
        <tr style="height:14px;">
          <td style="border-right:${dotted};border-bottom:${dotted};"></td>
          <td style="border-right:${dotted};border-bottom:${dotted};"></td>
          <td style="border-right:${dotted};border-bottom:${dotted};"></td>
          <td style="border-right:${dotted};border-bottom:${dotted};"></td>
          <td style="border-right:${dotted};border-bottom:${dotted};"></td>
          <td style="border-right:${dotted};border-bottom:${dotted};"></td>
          <td style="border-right:${dotted};border-bottom:${dotted};text-align:right;padding-right:3px;">-</td>
          <td style="border-right:${dotted};border-bottom:${dotted};text-align:right;padding-right:3px;">-</td>
          <td style="border-bottom:${dotted};"></td>
        </tr>`;
    }
  }

  const totalAmount = supplyTotal + vatTotal;

  const stampImg = stampDataUrl
    ? `<img src="${stampDataUrl}" style="position:absolute;right:2px;top:-5px;width:26px;height:26px;opacity:0.92;z-index:99;pointer-events:none;" />`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Malgun Gothic', '맑은 고딕', Arial, sans-serif; font-size: 7pt; color: #000; background: #fff; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  td, th { padding: 0 2px; vertical-align: middle; overflow: hidden; white-space: nowrap; height: 13px; }
  .lbl { color: ${blue}; font-weight: bold; text-align: center; font-size: 7pt; }
  .val { color: #000; padding-left: 3px; font-size: 7pt; }
</style>
</head>
<body>
<div style="width:378px;padding:4px 0;background:#fff;">

  <!-- 제목 -->
  <div style="text-align:center;margin-bottom:2px;">
    <span style="font-size:13pt;font-weight:bold;color:${blue};letter-spacing:6px;border-bottom:${dbl};padding-bottom:1px;display:inline-block;">거 래 명 세 표</span>
  </div>
  <div style="text-align:center;font-size:7pt;color:${blue};margin-bottom:4px;">(공급받는자 보관용)</div>

  <!-- 공급자 / 공급받는자 (내부 374px = 185+4+185) -->
  <div style="border:${outer};margin-bottom:3px;">
    <table>
      <colgroup>
        <col style="width:11px;"><!-- 공급자 세로 -->
        <col style="width:32px;"><!-- 레이블 -->
        <col style="width:73px;"><!-- 값 -->
        <col style="width:21px;"><!-- 대표 레이블 -->
        <col style="width:48px;"><!-- 이수용+도장 -->
        <col style="width:4px;"> <!-- 중앙 분리대 -->
        <col style="width:11px;"><!-- 공급받는자 세로 -->
        <col style="width:32px;"><!-- 레이블 -->
        <col style="width:73px;"><!-- 값 -->
        <col style="width:21px;"><!-- 대표 레이블 -->
        <col style="width:48px;"><!-- 대표자명 -->
      </colgroup>

      <tr><!-- 등록번호 -->
        <td rowspan="8" class="lbl" style="border-right:${solid};writing-mode:vertical-rl;letter-spacing:2px;font-size:7pt;">공&nbsp;급&nbsp;자</td>
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};font-size:6.5pt;">등록번호</td>
        <td colspan="3" class="val" style="border-bottom:${dotted};font-weight:bold;text-align:center;font-size:6.5pt;">138-81-83251</td>
        <td rowspan="8" style="border-right:${dbl};"></td>
        <td rowspan="8" class="lbl" style="border-right:${solid};writing-mode:vertical-rl;letter-spacing:1px;font-size:7pt;">공급받는자</td>
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};font-size:6.5pt;">등록번호</td>
        <td colspan="3" class="val" style="border-bottom:${dotted};font-size:6.5pt;">${escHtml(customer?.bizRegNo || '')}</td>
      </tr>
      <tr><!-- 상호/대표 -->
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};font-size:6.5pt;">상호</td>
        <td class="val" style="border-right:${dotted};border-bottom:${dotted};font-size:6pt;">주식회사 기연리프트</td>
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};font-size:6.5pt;">대표</td>
        <td class="val" style="position:relative;overflow:visible !important;border-bottom:${dotted};font-size:6.5pt;">이수용${stampImg}</td>
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};font-size:6.5pt;">상호</td>
        <td class="val" style="border-right:${dotted};border-bottom:${dotted};font-size:6pt;">${escHtml(customer?.name || '')}</td>
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};font-size:6.5pt;">대표</td>
        <td class="val" style="border-bottom:${dotted};font-size:6.5pt;">${escHtml(customer?.representative || '')}</td>
      </tr>
      <tr><!-- 주소 -->
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};font-size:6.5pt;">주소</td>
        <td colspan="3" class="val" style="border-bottom:${dotted};font-size:5.5pt;">경기도 용인시 처인구 모현읍 갈담로112번길 21-3</td>
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};font-size:6.5pt;">주소</td>
        <td colspan="3" class="val" style="border-bottom:${dotted};font-size:5.5pt;">${escHtml(customer?.address || '')}</td>
      </tr>
      <tr><!-- 업태/종목 -->
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};font-size:6.5pt;">업태</td>
        <td class="val" style="border-right:${dotted};border-bottom:${dotted};font-size:5.5pt;">사업지원 및 임대서비스업 외</td>
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};font-size:6.5pt;">종목</td>
        <td class="val" style="border-bottom:${dotted};font-size:5.5pt;">고소장비임대업 외</td>
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};font-size:6.5pt;">업태</td>
        <td class="val" style="border-right:${dotted};border-bottom:${dotted};"></td>
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};font-size:6.5pt;">종목</td>
        <td class="val" style="border-bottom:${dotted};"></td>
      </tr>
      <tr><!-- 계약담당자/연락처 -->
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};font-size:6.5pt;">계약담당자</td>
        <td class="val" style="border-right:${dotted};border-bottom:${dotted};"></td>
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};font-size:6.5pt;">연락처</td>
        <td class="val" style="border-bottom:${dotted};"></td>
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};font-size:6.5pt;">담당자</td>
        <td class="val" style="border-right:${dotted};border-bottom:${dotted};"></td>
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};font-size:6.5pt;">연락처</td>
        <td class="val" style="border-bottom:${dotted};"></td>
      </tr>
      <tr><!-- 계산서담당자/연락처 -->
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};font-size:6.5pt;">계산서담당자</td>
        <td class="val" style="border-right:${dotted};border-bottom:${dotted};"></td>
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};font-size:6.5pt;">연락처</td>
        <td class="val" style="border-bottom:${dotted};"></td>
        <td colspan="4" style="border-bottom:${dotted};"></td>
      </tr>
      <tr><!-- 이메일 -->
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};font-size:6.5pt;">이메일</td>
        <td colspan="3" class="val" style="border-bottom:${dotted};font-size:6.5pt;">giyeonlift@naver.com</td>
        <td colspan="4" style="border-bottom:${dotted};"></td>
      </tr>
      <tr><!-- 공급내역 -->
        <td class="lbl" style="border-right:${dotted};font-size:6.5pt;">공급내역</td>
        <td colspan="3" class="val"></td>
        <td colspan="4"></td>
      </tr>
    </table>
  </div>

  <!-- 작성일자/입금계좌 (374px = 38+124+38+174) -->
  <div style="border:${outer};margin-bottom:3px;">
    <table>
      <colgroup>
        <col style="width:38px;">
        <col style="width:124px;">
        <col style="width:38px;">
        <col style="width:174px;">
      </colgroup>
      <tr>
        <td class="lbl" style="border-right:${solid};font-size:6.5pt;">작성일자</td>
        <td class="val" style="border-right:${solid};padding-left:4px;">${billingDate}</td>
        <td class="lbl" style="border-right:${solid};font-size:6.5pt;">입금계좌</td>
        <td class="val" style="padding-left:4px;font-weight:bold;font-size:6pt;">신한은행 140-010-007060 , 주식회사 기연리프트</td>
      </tr>
    </table>
  </div>

  <!-- 품목 테이블 (374px = 14+9+9+147+20+39+46+42+48) -->
  <div style="border:${outer};">
    <table>
      <colgroup>
        <col style="width:14px;">
        <col style="width:9px;">
        <col style="width:9px;">
        <col style="width:147px;">
        <col style="width:20px;">
        <col style="width:39px;">
        <col style="width:46px;">
        <col style="width:42px;">
        <col style="width:48px;">
      </colgroup>
      <tr style="height:15px;">
        <th class="lbl" style="border-right:${solid};border-bottom:${solid};font-size:6.5pt;">순번</th>
        <th class="lbl" style="border-right:${solid};border-bottom:${solid};font-size:6.5pt;">월</th>
        <th class="lbl" style="border-right:${solid};border-bottom:${solid};font-size:6.5pt;">일</th>
        <th class="lbl" style="border-right:${solid};border-bottom:${solid};font-size:6.5pt;">품목</th>
        <th class="lbl" style="border-right:${solid};border-bottom:${solid};font-size:6.5pt;">수량</th>
        <th class="lbl" style="border-right:${solid};border-bottom:${solid};font-size:6.5pt;">단가</th>
        <th class="lbl" style="border-right:${solid};border-bottom:${solid};font-size:6.5pt;">공급가액</th>
        <th class="lbl" style="border-right:${solid};border-bottom:${solid};font-size:6.5pt;">부가세</th>
        <th class="lbl" style="border-bottom:${solid};font-size:6.5pt;">비고</th>
      </tr>
      ${itemRows}
    </table>

    <!-- 합계 행 (374px = 21+8+77+21+8+56+17+8+56+70+32) -->
    <table style="border-top:${solid};">
      <colgroup>
        <col style="width:21px;">
        <col style="width:8px;">
        <col style="width:77px;">
        <col style="width:21px;">
        <col style="width:8px;">
        <col style="width:56px;">
        <col style="width:17px;">
        <col style="width:8px;">
        <col style="width:56px;">
        <col style="width:70px;">
        <col style="width:32px;">
      </colgroup>
      <tr style="height:15px;font-weight:bold;">
        <td class="lbl" style="border-right:${dotted};font-size:6.5pt;">공급가</td>
        <td class="lbl" style="border-right:${dotted};font-size:6.5pt;">₩</td>
        <td style="border-right:${solid};text-align:right;padding-right:4px;font-size:6.5pt;">${supplyTotal.toLocaleString()}</td>
        <td class="lbl" style="border-right:${dotted};font-size:6.5pt;">부가세</td>
        <td class="lbl" style="border-right:${dotted};font-size:6.5pt;">₩</td>
        <td style="border-right:${solid};text-align:right;padding-right:4px;font-size:6.5pt;">${vatTotal.toLocaleString()}</td>
        <td class="lbl" style="border-right:${dotted};font-size:6.5pt;">합계</td>
        <td class="lbl" style="border-right:${dotted};font-size:6.5pt;">₩</td>
        <td style="border-right:${solid};text-align:right;padding-right:4px;font-size:6.5pt;">${totalAmount.toLocaleString()}</td>
        <td class="lbl" style="text-align:right;padding-right:4px;font-size:6.5pt;">인수자</td>
        <td class="lbl" style="text-align:center;font-size:6.5pt;">(인)</td>
      </tr>
    </table>
  </div>

  <div style="text-align:right;font-size:6pt;color:#555;margin-top:2px;">
    (주)기연리프트 | 사업자등록번호: 138-81-83251 | 대표: 이수용
  </div>
</div>
</body>
</html>`;
}

/**
 * 거래명세서 PDF 직접 다운로드
 * ExcelJS 도장 추출 → 378px HTML → html2canvas(scale:3, windowWidth:378) → jsPDF A4 full-width
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
  } catch (_) { /* 도장 실패 시 무시 */ }

  const html = buildStatementHTML(billing, details, customer, siteName, stampDataUrl);

  // 378px 컨테이너 렌더링 (windowWidth도 378로 고정하여 뷰포트 영향 완전 차단)
  const container = document.createElement('div');
  container.style.cssText =
    'position:fixed;top:-9999px;left:-9999px;width:378px;background:#fff;z-index:-9999;';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const target = container.querySelector('div') as HTMLElement;
    const canvas = await html2canvas(target, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: 378,
      height: target.scrollHeight,
      windowWidth: 378,       // 뷰포트 폭을 378px로 고정 → 컨테이너 밖으로 렌더 불가
      windowHeight: 2000,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();   // 210mm
    const pageH = pdf.internal.pageSize.getHeight();  // 297mm

    // 좌우 여백 10mm → printW 190mm (A4 210mm 딱 맞춤, 내용은 378px→190mm 스케일)
    const mx = 10;
    const my = 10;
    const printW = pageW - mx * 2;   // 190mm
    const printH = (canvas.height * printW) / canvas.width;

    if (printH <= pageH - my * 2) {
      pdf.addImage(imgData, 'PNG', mx, my, printW, printH);
    } else {
      let y = 0;
      while (y < printH) {
        pdf.addImage(imgData, 'PNG', mx, my - y, printW, printH);
        y += pageH - my * 2;
        if (y < printH) pdf.addPage();
      }
    }

    const custName = customer?.name || '고객사';
    const ym = billing?.billingYm || '';
    pdf.save(`${fileName || `${custName}_${siteName}_${ym}`}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
};
