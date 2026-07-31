// d:\Kiyeun_Lift\src\services\pdf.ts
// 거래명세서 Excel 양식 데이터 → 시스템 PDF 변환 (html2canvas + jsPDF)
// 2번 원본 엑셀 양식 디자인 100% 픽셀 매칭 (도장 자름 방지, 세로선 단일화, 폰트 비율, A4 오른쪽 잘림 완벽 해결)
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

/** 거래명세서 HTML 생성 (700px 정밀 픽셀 레이아웃) */
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
  const blueColor = '#1B65A6'; // 엑셀 양식 시그니처 파란색
  const borderDotted = `1px dotted ${blueColor}`;
  const borderSolid = `1px solid ${blueColor}`;
  const borderDouble = `3px double ${blueColor}`;
  const borderOuter = `2px solid ${blueColor}`;

  // 품목행 HTML 생성 (11행)
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
          <td style="border-right:${borderDotted};border-bottom:${borderDotted};text-align:center;color:#000;">${i + 1}</td>
          <td style="border-right:${borderDotted};border-bottom:${borderDotted};text-align:center;color:#000;">${dateM}</td>
          <td style="border-right:${borderDotted};border-bottom:${borderDotted};text-align:center;color:#000;">${dateD}</td>
          <td style="border-right:${borderDotted};border-bottom:${borderDotted};text-align:left;padding-left:5px;color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(d.itemName)}</td>
          <td style="border-right:${borderDotted};border-bottom:${borderDotted};text-align:center;color:#000;">${d.quantity || 1}</td>
          <td style="border-right:${borderDotted};border-bottom:${borderDotted};text-align:right;padding-right:5px;color:#000;">${supply > 0 ? (d.unitPrice || 0).toLocaleString() : ''}</td>
          <td style="border-right:${borderDotted};border-bottom:${borderDotted};text-align:right;padding-right:5px;color:#000;">${supply.toLocaleString()}</td>
          <td style="border-right:${borderDotted};border-bottom:${borderDotted};text-align:right;padding-right:5px;color:#000;">${vat.toLocaleString()}</td>
          <td style="border-bottom:${borderDotted};text-align:left;padding-left:5px;color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(siteName)}</td>
        </tr>`;
    } else {
      itemRows += `
        <tr style="height:22px;">
          <td style="border-right:${borderDotted};border-bottom:${borderDotted};"></td>
          <td style="border-right:${borderDotted};border-bottom:${borderDotted};"></td>
          <td style="border-right:${borderDotted};border-bottom:${borderDotted};"></td>
          <td style="border-right:${borderDotted};border-bottom:${borderDotted};"></td>
          <td style="border-right:${borderDotted};border-bottom:${borderDotted};"></td>
          <td style="border-right:${borderDotted};border-bottom:${borderDotted};"></td>
          <td style="border-right:${borderDotted};border-bottom:${borderDotted};text-align:right;padding-right:5px;color:#000;">-</td>
          <td style="border-right:${borderDotted};border-bottom:${borderDotted};text-align:right;padding-right:5px;color:#000;">-</td>
          <td style="border-bottom:${borderDotted};"></td>
        </tr>`;
    }
  }

  const totalAmount = calcSupply + calcVat;

  // 도장 이미지: overflow 잘림 방지 위치 및 크기 조정
  const stampImg = stampDataUrl
    ? `<img src="${stampDataUrl}" style="position:absolute;right:0px;top:-10px;width:44px;height:44px;opacity:0.92;z-index:99;pointer-events:none;" />`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Malgun Gothic', '맑은 고딕', Arial, sans-serif; font-size: 8.5pt; background: white; color: #000; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  td, th { padding: 0 3px; vertical-align: middle; white-space: nowrap; overflow: hidden; height: 21px; }
  .blue-label { color: ${blueColor}; font-weight: bold; text-align: center; font-size: 8pt; }
  .val-text { color: #000; text-align: left; padding-left: 4px; font-size: 8.5pt; }
</style>
</head>
<body>
<div style="width:700px;padding:6px 0;background:white;margin:0 auto;">

  <!-- 1. 타이틀 영역 (거 래 명 세 표) -->
  <div style="text-align:center;margin-bottom:2px;">
    <span style="font-size:18pt;font-weight:bold;color:${blueColor};letter-spacing:10px;border-bottom:${borderDouble};padding-bottom:2px;display:inline-block;">
      거 래 명 세 표
    </span>
  </div>
  <div style="text-align:center;font-size:8pt;color:${blueColor};margin-bottom:6px;">
    (공급받는자 보관용)
  </div>

  <!-- 2. 공급자 / 공급받는자 상단 세부 테이블 (총 700px) -->
  <div style="border:${borderOuter};margin-bottom:4px;">
    <table>
      <colgroup>
        <col style="width:22px;">  <!-- 공 급 자 세로 -->
        <col style="width:65px;">  <!-- 레이블: 등록번호 등 -->
        <col style="width:120px;"> <!-- 값: 138-81-83251 -->
        <col style="width:38px;">  <!-- 대표 레이블 -->
        <col style="width:98px;">  <!-- 이수용 + 도장 -->
        <col style="width:4px;">   <!-- 중앙 이중선 분리대 -->
        <col style="width:22px;">  <!-- 공 급 받 는 자 세로 -->
        <col style="width:65px;">  <!-- 레이블: 등록번호 등 -->
        <col style="width:130px;"> <!-- 값: 고객 상호 -->
        <col style="width:38px;">  <!-- 대표 레이블 -->
        <col style="width:98px;">  <!-- 대표자명 -->
      </colgroup>

      <!-- Row 1: 등록번호 -->
      <tr>
        <td rowspan="8" class="blue-label" style="border-right:${borderSolid};writing-mode:vertical-rl;letter-spacing:4px;font-size:9pt;background:#fff;">공&nbsp;급&nbsp;자</td>
        <td class="blue-label" style="border-right:${borderDotted};border-bottom:${borderDotted};">등록번호</td>
        <td colspan="3" class="val-text" style="border-bottom:${borderDotted};font-weight:bold;text-align:center;">138-81-83251</td>
        <td rowspan="8" style="border-right:${borderDouble};background:#fff;padding:0;"></td>
        <td rowspan="8" class="blue-label" style="border-right:${borderSolid};writing-mode:vertical-rl;letter-spacing:2px;font-size:9pt;background:#fff;">공급받는자</td>
        <td class="blue-label" style="border-right:${borderDotted};border-bottom:${borderDotted};">등록번호</td>
        <td colspan="3" class="val-text" style="border-bottom:${borderDotted};">${escHtml(customer?.bizRegNo || '')}</td>
      </tr>

      <!-- Row 2: 상호 / 대표 (도장 잘림 방지 overflow:visible) -->
      <tr>
        <td class="blue-label" style="border-right:${borderDotted};border-bottom:${borderDotted};">상호</td>
        <td class="val-text" style="border-right:${borderDotted};border-bottom:${borderDotted};">주식회사 기연리프트</td>
        <td class="blue-label" style="border-right:${borderDotted};border-bottom:${borderDotted};">대표</td>
        <td class="val-text" style="position:relative;overflow:visible !important;border-bottom:${borderDotted};">이수용${stampImg}</td>
        <td class="blue-label" style="border-right:${borderDotted};border-bottom:${borderDotted};">상호</td>
        <td class="val-text" style="border-right:${borderDotted};border-bottom:${borderDotted};">${escHtml(customer?.name || '')}</td>
        <td class="blue-label" style="border-right:${borderDotted};border-bottom:${borderDotted};">대표</td>
        <td class="val-text" style="border-bottom:${borderDotted};">${escHtml(customer?.representative || '')}</td>
      </tr>

      <!-- Row 3: 주소 -->
      <tr>
        <td class="blue-label" style="border-right:${borderDotted};border-bottom:${borderDotted};">주소</td>
        <td colspan="3" class="val-text" style="border-bottom:${borderDotted};font-size:7.5pt;">경기도 용인시 처인구 모현읍 갈담로112번길 21-3</td>
        <td class="blue-label" style="border-right:${borderDotted};border-bottom:${borderDotted};">주소</td>
        <td colspan="3" class="val-text" style="border-bottom:${borderDotted};font-size:7.5pt;">${escHtml(customer?.address || '')}</td>
      </tr>

      <!-- Row 4: 업태 / 종목 -->
      <tr>
        <td class="blue-label" style="border-right:${borderDotted};border-bottom:${borderDotted};">업태</td>
        <td class="val-text" style="border-right:${borderDotted};border-bottom:${borderDotted};font-size:7pt;">사업지원 및 임대서비스업 외</td>
        <td class="blue-label" style="border-right:${borderDotted};border-bottom:${borderDotted};">종목</td>
        <td class="val-text" style="border-bottom:${borderDotted};font-size:7pt;">고소장비임대업 외</td>
        <td class="blue-label" style="border-right:${borderDotted};border-bottom:${borderDotted};">업태</td>
        <td class="val-text" style="border-right:${borderDotted};border-bottom:${borderDotted};"></td>
        <td class="blue-label" style="border-right:${borderDotted};border-bottom:${borderDotted};">종목</td>
        <td class="val-text" style="border-bottom:${borderDotted};"></td>
      </tr>

      <!-- Row 5: 계약담당자 / 연락처 -->
      <tr>
        <td class="blue-label" style="border-right:${borderDotted};border-bottom:${borderDotted};">계약담당자</td>
        <td class="val-text" style="border-right:${borderDotted};border-bottom:${borderDotted};"></td>
        <td class="blue-label" style="border-right:${borderDotted};border-bottom:${borderDotted};">연락처</td>
        <td class="val-text" style="border-bottom:${borderDotted};"></td>
        <td class="blue-label" style="border-right:${borderDotted};border-bottom:${borderDotted};">담당자</td>
        <td class="val-text" style="border-right:${borderDotted};border-bottom:${borderDotted};"></td>
        <td class="blue-label" style="border-right:${borderDotted};border-bottom:${borderDotted};">연락처</td>
        <td class="val-text" style="border-bottom:${borderDotted};"></td>
      </tr>

      <!-- Row 6: 계산서담당자 / 연락처 -->
      <tr>
        <td class="blue-label" style="border-right:${borderDotted};border-bottom:${borderDotted};">계산서담당자</td>
        <td class="val-text" style="border-right:${borderDotted};border-bottom:${borderDotted};"></td>
        <td class="blue-label" style="border-right:${borderDotted};border-bottom:${borderDotted};">연락처</td>
        <td class="val-text" style="border-bottom:${borderDotted};"></td>
        <td colspan="4" style="border-bottom:${borderDotted};"></td>
      </tr>

      <!-- Row 7: 이메일 -->
      <tr>
        <td class="blue-label" style="border-right:${borderDotted};border-bottom:${borderDotted};">이메일</td>
        <td colspan="3" class="val-text" style="border-bottom:${borderDotted};">giyeonlift@naver.com</td>
        <td colspan="4" style="border-bottom:${borderDotted};"></td>
      </tr>

      <!-- Row 8: 공급내역 -->
      <tr>
        <td class="blue-label" style="border-right:${borderDotted};">공급내역</td>
        <td colspan="3" class="val-text"></td>
        <td colspan="4"></td>
      </tr>
    </table>
  </div>

  <!-- 3. 작성일자 / 입금계좌 테이블 (총 700px) -->
  <div style="border:${borderOuter};margin-bottom:4px;">
    <table>
      <colgroup>
        <col style="width:65px;">
        <col style="width:215px;">
        <col style="width:65px;">
        <col style="width:355px;">
      </colgroup>
      <tr>
        <td class="blue-label" style="border-right:${borderSolid};">작성일자</td>
        <td class="val-text" style="border-right:${borderSolid};padding-left:8px;">${billingDate}</td>
        <td class="blue-label" style="border-right:${borderSolid};">입금계좌</td>
        <td class="val-text" style="padding-left:8px;font-weight:bold;">신한은행 140-010-007060 , 주식회사 기연리프트</td>
      </tr>
    </table>
  </div>

  <!-- 4. 품목 테이블 (총 700px: 헤더 + 11행 데이터) -->
  <div style="border:${borderOuter};">
    <table>
      <colgroup>
        <col style="width:26px;">  <!-- 순번 -->
        <col style="width:18px;">  <!-- 월 -->
        <col style="width:18px;">  <!-- 일 -->
        <col style="width:280px;"> <!-- 품목 -->
        <col style="width:36px;">  <!-- 수량 -->
        <col style="width:72px;">  <!-- 단가 -->
        <col style="width:82px;">  <!-- 공급가액 -->
        <col style="width:74px;">  <!-- 부가세 -->
        <col style="width:94px;">  <!-- 비고 -->
      </colgroup>

      <!-- 헤더 행 -->
      <tr style="height:23px;">
        <th class="blue-label" style="border-right:${borderSolid};border-bottom:${borderSolid};">순번</th>
        <th class="blue-label" style="border-right:${borderSolid};border-bottom:${borderSolid};">월</th>
        <th class="blue-label" style="border-right:${borderSolid};border-bottom:${borderSolid};">일</th>
        <th class="blue-label" style="border-right:${borderSolid};border-bottom:${borderSolid};">품목</th>
        <th class="blue-label" style="border-right:${borderSolid};border-bottom:${borderSolid};">수량</th>
        <th class="blue-label" style="border-right:${borderSolid};border-bottom:${borderSolid};">단가</th>
        <th class="blue-label" style="border-right:${borderSolid};border-bottom:${borderSolid};">공급가액</th>
        <th class="blue-label" style="border-right:${borderSolid};border-bottom:${borderSolid};">부가세</th>
        <th class="blue-label" style="border-bottom:${borderSolid};">비고</th>
      </tr>

      <!-- 데이터 11행 -->
      ${itemRows}
    </table>

    <!-- 5. 하단 합계행 (Row 27: 총 700px) -->
    <table style="border-top:${borderSolid};">
      <colgroup>
        <col style="width:42px;">  <!-- 공급가 -->
        <col style="width:16px;">  <!-- ₩ -->
        <col style="width:155px;"> <!-- 금액 -->
        <col style="width:42px;">  <!-- 부가세 -->
        <col style="width:16px;">  <!-- ₩ -->
        <col style="width:105px;"> <!-- 금액 -->
        <col style="width:32px;">  <!-- 합계 -->
        <col style="width:16px;">  <!-- ₩ -->
        <col style="width:110px;"> <!-- 금액 -->
        <col style="width:118px;"> <!-- 인수자 -->
        <col style="width:48px;">  <!-- (인) -->
      </colgroup>
      <tr style="height:24px;font-weight:bold;">
        <td class="blue-label" style="border-right:${borderDotted};">공급가</td>
        <td class="blue-label" style="border-right:${borderDotted};">₩</td>
        <td style="border-right:${borderSolid};text-align:right;padding-right:6px;color:#000;">${calcSupply.toLocaleString()}</td>
        <td class="blue-label" style="border-right:${borderDotted};">부가세</td>
        <td class="blue-label" style="border-right:${borderDotted};">₩</td>
        <td style="border-right:${borderSolid};text-align:right;padding-right:6px;color:#000;">${calcVat.toLocaleString()}</td>
        <td class="blue-label" style="border-right:${borderDotted};">합계</td>
        <td class="blue-label" style="border-right:${borderDotted};">₩</td>
        <td style="border-right:${borderSolid};text-align:right;padding-right:6px;color:#000;">${totalAmount.toLocaleString()}</td>
        <td class="blue-label" style="text-align:right;padding-right:8px;">인수자</td>
        <td class="blue-label" style="text-align:center;">(인)</td>
      </tr>
    </table>
  </div>

  <div style="text-align:right;font-size:7.5pt;color:#555;margin-top:3px;">
    (주)기연리프트 | 사업자등록번호: 138-81-83251 | 대표: 이수용
  </div>
</div>
</body>
</html>`;
}

/**
 * 거래명세서 PDF 직접 다운로드 (시스템 1:1 Excel-to-PDF 엔진)
 * ExcelJS로 양식 로드 → 도장 이미지 추출 → 정밀 700px HTML 렌더링 → html2canvas → jsPDF A4 출력
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
    // 도장 추출 실패 시 무시하고 진행
  }

  // 2. HTML 생성 (700px 폭)
  const html = buildStatementHTML(billing, details, customer, siteName, stampDataUrl);

  // 3. 숨김 컨테이너에 렌더링 (700px 폭)
  const container = document.createElement('div');
  container.style.cssText =
    'position:fixed;top:-9999px;left:-9999px;width:700px;background:white;z-index:-9999;';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    // 4. html2canvas → jsPDF (scale: 3 초고해상도)
    const canvas = await html2canvas(container.querySelector('div') as HTMLElement, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: 700,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();  // 210mm
    const pageH = pdf.internal.pageSize.getHeight(); // 297mm

    // 좌우 여백 5mm씩 포함하여 200mm 폭으로 렌더링 (오른쪽 잘림 100% 방지)
    const marginX = 5;
    const marginY = 8;
    const printW = pageW - (marginX * 2); // 200mm
    const printH = (canvas.height * printW) / canvas.width;

    if (printH <= (pageH - marginY * 2)) {
      pdf.addImage(imgData, 'PNG', marginX, marginY, printW, printH);
    } else {
      let y = 0;
      while (y < printH) {
        pdf.addImage(imgData, 'PNG', marginX, marginY - y, printW, printH);
        y += (pageH - marginY * 2);
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
