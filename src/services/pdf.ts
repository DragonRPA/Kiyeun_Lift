// d:\Kiyeun_Lift\src\services\pdf.ts
// 거래명세서 Excel 양식 데이터 → 시스템 PDF 변환 (html2canvas + jsPDF)
// 공급자/공급받는자 268px:268px 완벽 1:1 대칭, 540px 컨테이너, A4 오른쪽 잘림 100% 영구 해결
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
 * ─────────────────────────────────────────────────
 * 전체 컨테이너: 540px (border 없음)
 * 정보 테이블 div border(2px×2) 포함: 내부 536px
 * 각 섹션: 공급자 266px | 분리대 4px | 공급받는자 266px = 536px (1:1 완벽 대칭)
 * 품목 테이블: 540px
 * 합계 행: 540px
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
  const blue    = '#1B65A6';
  const dotted  = `1px dotted ${blue}`;
  const solid   = `1px solid ${blue}`;
  const dbl     = `3px double ${blue}`;
  const outer   = `2px solid ${blue}`;

  /* ── 품목 행 ── */
  let itemRows = '';
  let supplyTotal = 0;
  let vatTotal = 0;

  for (let i = 0; i < ITEM_MAX; i++) {
    const d = details[i];
    if (d) {
      const supply = (d.unitPrice || 0) * (d.quantity || 1);
      const vat    = Math.round(supply * 0.1);
      supplyTotal += supply;
      vatTotal    += vat;
      itemRows += `
        <tr style="height:20px;">
          <td style="border-right:${dotted};border-bottom:${dotted};text-align:center;">${i + 1}</td>
          <td style="border-right:${dotted};border-bottom:${dotted};text-align:center;">${dateM}</td>
          <td style="border-right:${dotted};border-bottom:${dotted};text-align:center;">${dateD}</td>
          <td style="border-right:${dotted};border-bottom:${dotted};padding-left:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(d.itemName)}</td>
          <td style="border-right:${dotted};border-bottom:${dotted};text-align:center;">${d.quantity || 1}</td>
          <td style="border-right:${dotted};border-bottom:${dotted};text-align:right;padding-right:4px;">${supply > 0 ? (d.unitPrice || 0).toLocaleString() : ''}</td>
          <td style="border-right:${dotted};border-bottom:${dotted};text-align:right;padding-right:4px;">${supply.toLocaleString()}</td>
          <td style="border-right:${dotted};border-bottom:${dotted};text-align:right;padding-right:4px;">${vat.toLocaleString()}</td>
          <td style="border-bottom:${dotted};padding-left:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(siteName)}</td>
        </tr>`;
    } else {
      itemRows += `
        <tr style="height:20px;">
          <td style="border-right:${dotted};border-bottom:${dotted};"></td>
          <td style="border-right:${dotted};border-bottom:${dotted};"></td>
          <td style="border-right:${dotted};border-bottom:${dotted};"></td>
          <td style="border-right:${dotted};border-bottom:${dotted};"></td>
          <td style="border-right:${dotted};border-bottom:${dotted};"></td>
          <td style="border-right:${dotted};border-bottom:${dotted};"></td>
          <td style="border-right:${dotted};border-bottom:${dotted};text-align:right;padding-right:4px;">-</td>
          <td style="border-right:${dotted};border-bottom:${dotted};text-align:right;padding-right:4px;">-</td>
          <td style="border-bottom:${dotted};"></td>
        </tr>`;
    }
  }

  const totalAmount = supplyTotal + vatTotal;

  const stampImg = stampDataUrl
    ? `<img src="${stampDataUrl}" style="position:absolute;right:2px;top:-6px;width:34px;height:34px;opacity:0.92;z-index:99;pointer-events:none;" />`
    : '';

  /* ─────────────────────────────────────────────
   * 컬럼 설계 (단위: px)
   *
   * [정보 테이블] outer div border 2+2=4px 포함
   *   div 내부 = 540 - 4 = 536px
   *   공급자:    16 + 46 + 104 + 30 + 70 = 266px
   *   분리대:    4px
   *   공급받는자: 16 + 46 + 104 + 30 + 70 = 266px
   *   합계 = 266 + 4 + 266 = 536px ✓
   *
   * [품목 테이블] outer div border 2+2=4px 포함
   *   div 내부 = 540 - 4 = 536px
   *   20+13+13+210+28+56+66+60+70 = 536px ✓
   *
   * [합계 테이블] border-top만 (좌우 border 없음, 이미 outer div 안)
   *   30+12+110+30+12+80+24+12+80+100+46 = 536px ✓
   * ───────────────────────────────────────────── */

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Malgun Gothic', '맑은 고딕', Arial, sans-serif; font-size: 7pt; color: #000; background: #fff; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  td, th { padding: 0 2px; vertical-align: middle; overflow: hidden; white-space: nowrap; height: 19px; }
  .lbl { color: ${blue}; font-weight: bold; text-align: center; font-size: 7pt; }
  .val { color: #000; padding-left: 3px; }
</style>
</head>
<body>
<div style="width:540px;padding:5px 0;background:#fff;">

  <!-- 제목 -->
  <div style="text-align:center;margin-bottom:2px;">
    <span style="font-size:16pt;font-weight:bold;color:${blue};letter-spacing:8px;border-bottom:${dbl};padding-bottom:1px;display:inline-block;">거 래 명 세 표</span>
  </div>
  <div style="text-align:center;font-size:7pt;color:${blue};margin-bottom:5px;">(공급받는자 보관용)</div>

  <!-- 공급자 / 공급받는자 (내부 총 536px = 266 + 4 + 266) -->
  <div style="border:${outer};margin-bottom:3px;">
    <table>
      <colgroup>
        <col style="width:16px;"><!-- 공 급 자 세로 -->
        <col style="width:46px;"><!-- 레이블 -->
        <col style="width:104px;"><!-- 값 -->
        <col style="width:30px;"><!-- 대표 레이블 -->
        <col style="width:70px;"><!-- 이수용 + 도장 -->
        <col style="width:4px;"> <!-- 중앙 분리대 이중선 -->
        <col style="width:16px;"><!-- 공급받는자 세로 -->
        <col style="width:46px;"><!-- 레이블 -->
        <col style="width:104px;"><!-- 값 -->
        <col style="width:30px;"><!-- 대표 레이블 -->
        <col style="width:70px;"><!-- 대표자명 -->
      </colgroup>

      <tr><!-- 등록번호 -->
        <td rowspan="8" class="lbl" style="border-right:${solid};writing-mode:vertical-rl;letter-spacing:3px;font-size:7.5pt;">공&nbsp;급&nbsp;자</td>
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};">등록번호</td>
        <td colspan="3" class="val" style="border-bottom:${dotted};font-weight:bold;text-align:center;">138-81-83251</td>
        <td rowspan="8" style="border-right:${dbl};"></td>
        <td rowspan="8" class="lbl" style="border-right:${solid};writing-mode:vertical-rl;letter-spacing:1px;font-size:7.5pt;">공급받는자</td>
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};">등록번호</td>
        <td colspan="3" class="val" style="border-bottom:${dotted};">${escHtml(customer?.bizRegNo || '')}</td>
      </tr>
      <tr><!-- 상호 / 대표 -->
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};">상호</td>
        <td class="val" style="border-right:${dotted};border-bottom:${dotted};font-size:6.5pt;">주식회사 기연리프트</td>
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};">대표</td>
        <td class="val" style="position:relative;overflow:visible !important;border-bottom:${dotted};">이수용${stampImg}</td>
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};">상호</td>
        <td class="val" style="border-right:${dotted};border-bottom:${dotted};">${escHtml(customer?.name || '')}</td>
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};">대표</td>
        <td class="val" style="border-bottom:${dotted};">${escHtml(customer?.representative || '')}</td>
      </tr>
      <tr><!-- 주소 -->
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};">주소</td>
        <td colspan="3" class="val" style="border-bottom:${dotted};font-size:6pt;">경기도 용인시 처인구 모현읍 갈담로112번길 21-3</td>
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};">주소</td>
        <td colspan="3" class="val" style="border-bottom:${dotted};font-size:6pt;">${escHtml(customer?.address || '')}</td>
      </tr>
      <tr><!-- 업태 / 종목 -->
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};">업태</td>
        <td class="val" style="border-right:${dotted};border-bottom:${dotted};font-size:6pt;">사업지원 및 임대서비스업 외</td>
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};">종목</td>
        <td class="val" style="border-bottom:${dotted};font-size:6pt;">고소장비임대업 외</td>
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};">업태</td>
        <td class="val" style="border-right:${dotted};border-bottom:${dotted};"></td>
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};">종목</td>
        <td class="val" style="border-bottom:${dotted};"></td>
      </tr>
      <tr><!-- 계약담당자 / 연락처 -->
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};">계약담당자</td>
        <td class="val" style="border-right:${dotted};border-bottom:${dotted};"></td>
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};">연락처</td>
        <td class="val" style="border-bottom:${dotted};"></td>
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};">담당자</td>
        <td class="val" style="border-right:${dotted};border-bottom:${dotted};"></td>
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};">연락처</td>
        <td class="val" style="border-bottom:${dotted};"></td>
      </tr>
      <tr><!-- 계산서담당자 / 연락처 -->
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};">계산서담당자</td>
        <td class="val" style="border-right:${dotted};border-bottom:${dotted};"></td>
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};">연락처</td>
        <td class="val" style="border-bottom:${dotted};"></td>
        <td colspan="4" style="border-bottom:${dotted};"></td>
      </tr>
      <tr><!-- 이메일 -->
        <td class="lbl" style="border-right:${dotted};border-bottom:${dotted};">이메일</td>
        <td colspan="3" class="val" style="border-bottom:${dotted};">giyeonlift@naver.com</td>
        <td colspan="4" style="border-bottom:${dotted};"></td>
      </tr>
      <tr><!-- 공급내역 -->
        <td class="lbl" style="border-right:${dotted};">공급내역</td>
        <td colspan="3" class="val"></td>
        <td colspan="4"></td>
      </tr>
    </table>
  </div>

  <!-- 작성일자 / 입금계좌 (내부 536px: 55+177+55+249=536) -->
  <div style="border:${outer};margin-bottom:3px;">
    <table>
      <colgroup>
        <col style="width:55px;">
        <col style="width:177px;">
        <col style="width:55px;">
        <col style="width:249px;">
      </colgroup>
      <tr>
        <td class="lbl" style="border-right:${solid};">작성일자</td>
        <td class="val" style="border-right:${solid};padding-left:6px;">${billingDate}</td>
        <td class="lbl" style="border-right:${solid};">입금계좌</td>
        <td class="val" style="padding-left:6px;font-weight:bold;font-size:6.5pt;">신한은행 140-010-007060 , 주식회사 기연리프트</td>
      </tr>
    </table>
  </div>

  <!-- 품목 테이블 (내부 536px: 20+13+13+210+28+56+66+60+70=536) -->
  <div style="border:${outer};">
    <table>
      <colgroup>
        <col style="width:20px;">
        <col style="width:13px;">
        <col style="width:13px;">
        <col style="width:210px;">
        <col style="width:28px;">
        <col style="width:56px;">
        <col style="width:66px;">
        <col style="width:60px;">
        <col style="width:70px;">
      </colgroup>
      <tr style="height:21px;">
        <th class="lbl" style="border-right:${solid};border-bottom:${solid};">순번</th>
        <th class="lbl" style="border-right:${solid};border-bottom:${solid};">월</th>
        <th class="lbl" style="border-right:${solid};border-bottom:${solid};">일</th>
        <th class="lbl" style="border-right:${solid};border-bottom:${solid};">품목</th>
        <th class="lbl" style="border-right:${solid};border-bottom:${solid};">수량</th>
        <th class="lbl" style="border-right:${solid};border-bottom:${solid};">단가</th>
        <th class="lbl" style="border-right:${solid};border-bottom:${solid};">공급가액</th>
        <th class="lbl" style="border-right:${solid};border-bottom:${solid};">부가세</th>
        <th class="lbl" style="border-bottom:${solid};">비고</th>
      </tr>
      ${itemRows}
    </table>

    <!-- 합계 행 (536px: 30+12+110+30+12+80+24+12+80+100+46=536) -->
    <table style="border-top:${solid};">
      <colgroup>
        <col style="width:30px;">
        <col style="width:12px;">
        <col style="width:110px;">
        <col style="width:30px;">
        <col style="width:12px;">
        <col style="width:80px;">
        <col style="width:24px;">
        <col style="width:12px;">
        <col style="width:80px;">
        <col style="width:100px;">
        <col style="width:46px;">
      </colgroup>
      <tr style="height:22px;font-weight:bold;">
        <td class="lbl" style="border-right:${dotted};">공급가</td>
        <td class="lbl" style="border-right:${dotted};">₩</td>
        <td style="border-right:${solid};text-align:right;padding-right:5px;">${supplyTotal.toLocaleString()}</td>
        <td class="lbl" style="border-right:${dotted};">부가세</td>
        <td class="lbl" style="border-right:${dotted};">₩</td>
        <td style="border-right:${solid};text-align:right;padding-right:5px;">${vatTotal.toLocaleString()}</td>
        <td class="lbl" style="border-right:${dotted};">합계</td>
        <td class="lbl" style="border-right:${dotted};">₩</td>
        <td style="border-right:${solid};text-align:right;padding-right:5px;">${totalAmount.toLocaleString()}</td>
        <td class="lbl" style="text-align:right;padding-right:6px;">인수자</td>
        <td class="lbl" style="text-align:center;">(인)</td>
      </tr>
    </table>
  </div>

  <div style="text-align:right;font-size:6.5pt;color:#555;margin-top:3px;">
    (주)기연리프트 | 사업자등록번호: 138-81-83251 | 대표: 이수용
  </div>
</div>
</body>
</html>`;
}

/**
 * 거래명세서 PDF 직접 다운로드
 * ExcelJS 도장 추출 → 540px 정밀 HTML → html2canvas(scale:3) → jsPDF A4
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

  // 540px 컨테이너 렌더링
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:540px;background:#fff;z-index:-9999;';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const target = container.querySelector('div') as HTMLElement;
    const canvas = await html2canvas(target, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: 540,
      windowWidth: 540,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();   // 210mm
    const pageH = pdf.internal.pageSize.getHeight();  // 297mm

    // 좌우 여백 10mm → printW = 190mm (A4 210mm 완전 수용)
    const mx = 10;
    const my = 10;
    const printW = pageW - mx * 2; // 190mm
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
