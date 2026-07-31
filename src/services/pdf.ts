// d:\Kiyeun_Lift\src\services\pdf.ts
// 거래명세서 PDF 생성 — A4(190mm) 기준 역산 재설계 v2
//
// ▶ 원칙: 720px ≈ 190mm (96dpi 기준), 모든 컬럼을 mm→px 역산
// ▶ 렌더링: iframe 격리 문서 → html2canvas → jsPDF
// ▶ 공급자 356px : 분리대 4px : 공급받는자 356px = 716px (div border 2+2px 제외)
//
import html2canvas from 'html2canvas';
import { jsPDF }    from 'jspdf';
import ExcelJS      from 'exceljs';

// ──────────────────────────────────────────────────────────────────────────────
// 헬퍼
// ──────────────────────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────────────────────
// HTML 생성
//
// 레이아웃 기준 (px):
//   전체 폭: 720px = A4 190mm ÷ 25.4 × 96
//   div border 2px × 2 = 4px → 테이블 내부 폭: 716px
//
//   [정보 테이블] 716px = 356(공급자) + 4(분리대) + 356(공급받는자)
//     각 섹션 컬럼: 26(세로) + 110(레이블) + 150(값) + 40(서브레이블) + 30(서브값) = 356
//
//   [날짜/입금계좌] 716px = 88 + 270 + 88 + 270
//   [품목 테이블]  716px = 24+26+26+300+44+74+76+72+74
//   [합계 행]      716px = 54+24+108+54+24+96+42+24+96+86+108
// ──────────────────────────────────────────────────────────────────────────────
function buildHTML(
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
  const solid  = `1px solid  ${BLUE}`;
  const dbl    = `3px double ${BLUE}`;
  const outer  = `2px solid  ${BLUE}`;
  const ROW_H  = 21; // 품목 행 높이(px)

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
      <tr style="height:${ROW_H}px">
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:center">${i+1}</td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:center">${dateM}</td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:center">${dateD}</td>
        <td style="border-right:${dotted};border-bottom:${dotted};padding-left:4px;overflow:hidden;text-overflow:ellipsis">${esc(d.itemName)}</td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:center">${d.quantity||1}</td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:right;padding-right:4px">${supply>0?(d.unitPrice||0).toLocaleString():''}</td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:right;padding-right:4px">${supply.toLocaleString()}</td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:right;padding-right:4px">${vat.toLocaleString()}</td>
        <td style="border-bottom:${dotted};padding-left:4px;overflow:hidden;text-overflow:ellipsis">${esc(siteName)}</td>
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
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:right;padding-right:4px">-</td>
        <td style="border-right:${dotted};border-bottom:${dotted};text-align:right;padding-right:4px">-</td>
        <td style="border-bottom:${dotted}"></td>
      </tr>`;
    }
  }

  const total = supplyTotal + vatTotal;
  const stampImg = stampDataUrl
    ? `<img src="${stampDataUrl}" style="position:absolute;right:3px;top:-8px;width:42px;height:42px;opacity:0.92;z-index:99">`
    : '';

  // 각 섹션 컬럼 합: 26+110+150+40+30 = 356px  ← 양쪽 동일
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;width:720px;background:#fff;font-family:'Malgun Gothic','맑은 고딕',Arial,sans-serif;font-size:9px;color:#000}
  *{box-sizing:border-box}
  table{border-collapse:collapse;table-layout:fixed;width:100%}
  td,th{padding:0 3px;vertical-align:middle;overflow:hidden;white-space:nowrap}
  .L{color:${BLUE};font-weight:bold;text-align:center}
  .V{color:#000;padding-left:4px}
</style>
</head>
<body>
<div style="width:720px;padding:6px 0">

  <!-- ① 제목 -->
  <div style="text-align:center;margin-bottom:3px">
    <span style="font-size:20px;font-weight:bold;color:${BLUE};letter-spacing:10px;border-bottom:${dbl};padding-bottom:2px;display:inline-block">거 래 명 세 표</span>
  </div>
  <div style="text-align:center;font-size:9px;color:${BLUE};margin-bottom:5px">(공급받는자 보관용)</div>

  <!-- ② 공급자 / 공급받는자  716px = 356+4+356 -->
  <div style="border:${outer};margin-bottom:4px">
    <table>
      <colgroup>
        <col style="width:26px"> <!-- 공급자 세로 -->
        <col style="width:110px"><!-- 레이블 -->
        <col style="width:150px"><!-- 값 -->
        <col style="width:40px"> <!-- 대표 레이블 -->
        <col style="width:30px"> <!-- 대표자+도장 -->
        <col style="width:4px">  <!-- 이중선 분리대 -->
        <col style="width:26px"> <!-- 공급받는자 세로 -->
        <col style="width:110px"><!-- 레이블 -->
        <col style="width:150px"><!-- 값 -->
        <col style="width:40px"> <!-- 대표 레이블 -->
        <col style="width:30px"> <!-- 대표자명 -->
      </colgroup>

      <!-- 등록번호 -->
      <tr style="height:21px">
        <td rowspan="8" class="L" style="border-right:${solid};writing-mode:vertical-rl;letter-spacing:3px;font-size:10px">공&nbsp;급&nbsp;자</td>
        <td class="L" style="border-right:${dotted};border-bottom:${dotted}">등록번호</td>
        <td colspan="3" class="V" style="border-bottom:${dotted};font-weight:bold;text-align:center">138-81-83251</td>
        <td rowspan="8" style="border-right:${dbl}"></td>
        <td rowspan="8" class="L" style="border-right:${solid};writing-mode:vertical-rl;letter-spacing:1px;font-size:10px">공급받는자</td>
        <td class="L" style="border-right:${dotted};border-bottom:${dotted}">등록번호</td>
        <td colspan="3" class="V" style="border-bottom:${dotted}">${esc(customer?.bizRegNo||'')}</td>
      </tr>
      <!-- 상호/대표 -->
      <tr style="height:21px">
        <td class="L" style="border-right:${dotted};border-bottom:${dotted}">상호</td>
        <td class="V" style="border-right:${dotted};border-bottom:${dotted};font-size:8px">주식회사 기연리프트</td>
        <td class="L" style="border-right:${dotted};border-bottom:${dotted}">대표</td>
        <td class="V" style="position:relative;overflow:visible!important;border-bottom:${dotted}">이수용${stampImg}</td>
        <td class="L" style="border-right:${dotted};border-bottom:${dotted}">상호</td>
        <td class="V" style="border-right:${dotted};border-bottom:${dotted};font-size:8px">${esc(customer?.name||'')}</td>
        <td class="L" style="border-right:${dotted};border-bottom:${dotted}">대표</td>
        <td class="V" style="border-bottom:${dotted}">${esc(customer?.representative||'')}</td>
      </tr>
      <!-- 주소 -->
      <tr style="height:21px">
        <td class="L" style="border-right:${dotted};border-bottom:${dotted}">주소</td>
        <td colspan="3" class="V" style="border-bottom:${dotted};font-size:8px">경기도 용인시 처인구 모현읍 갈담로112번길 21-3</td>
        <td class="L" style="border-right:${dotted};border-bottom:${dotted}">주소</td>
        <td colspan="3" class="V" style="border-bottom:${dotted};font-size:8px">${esc(customer?.address||'')}</td>
      </tr>
      <!-- 업태/종목 -->
      <tr style="height:21px">
        <td class="L" style="border-right:${dotted};border-bottom:${dotted}">업태</td>
        <td class="V" style="border-right:${dotted};border-bottom:${dotted};font-size:7.5px">사업지원 및 임대서비스업 외</td>
        <td class="L" style="border-right:${dotted};border-bottom:${dotted}">종목</td>
        <td class="V" style="border-bottom:${dotted};font-size:7.5px">고소장비임대업 외</td>
        <td class="L" style="border-right:${dotted};border-bottom:${dotted}">업태</td>
        <td class="V" style="border-right:${dotted};border-bottom:${dotted}"></td>
        <td class="L" style="border-right:${dotted};border-bottom:${dotted}">종목</td>
        <td class="V" style="border-bottom:${dotted}"></td>
      </tr>
      <!-- 계약담당자 -->
      <tr style="height:21px">
        <td class="L" style="border-right:${dotted};border-bottom:${dotted}">계약담당자</td>
        <td class="V" style="border-right:${dotted};border-bottom:${dotted}"></td>
        <td class="L" style="border-right:${dotted};border-bottom:${dotted}">연락처</td>
        <td class="V" style="border-bottom:${dotted}"></td>
        <td class="L" style="border-right:${dotted};border-bottom:${dotted}">담당자</td>
        <td class="V" style="border-right:${dotted};border-bottom:${dotted}"></td>
        <td class="L" style="border-right:${dotted};border-bottom:${dotted}">연락처</td>
        <td class="V" style="border-bottom:${dotted}"></td>
      </tr>
      <!-- 계산서담당자 -->
      <tr style="height:21px">
        <td class="L" style="border-right:${dotted};border-bottom:${dotted}">계산서담당자</td>
        <td class="V" style="border-right:${dotted};border-bottom:${dotted}"></td>
        <td class="L" style="border-right:${dotted};border-bottom:${dotted}">연락처</td>
        <td class="V" style="border-bottom:${dotted}"></td>
        <td colspan="4" style="border-bottom:${dotted}"></td>
      </tr>
      <!-- 이메일 -->
      <tr style="height:21px">
        <td class="L" style="border-right:${dotted};border-bottom:${dotted}">이메일</td>
        <td colspan="3" class="V" style="border-bottom:${dotted}">giyeonlift@naver.com</td>
        <td colspan="4" style="border-bottom:${dotted}"></td>
      </tr>
      <!-- 공급내역 -->
      <tr style="height:21px">
        <td class="L" style="border-right:${dotted}">공급내역</td>
        <td colspan="3" class="V"></td>
        <td colspan="4"></td>
      </tr>
    </table>
  </div>

  <!-- ③ 작성일자/입금계좌  716px = 88+270+88+270 -->
  <div style="border:${outer};margin-bottom:4px">
    <table>
      <colgroup>
        <col style="width:88px"><col style="width:270px">
        <col style="width:88px"><col style="width:270px">
      </colgroup>
      <tr style="height:22px">
        <td class="L" style="border-right:${solid}">작성일자</td>
        <td class="V" style="border-right:${solid};padding-left:8px">${billingDate}</td>
        <td class="L" style="border-right:${solid}">입금계좌</td>
        <td class="V" style="padding-left:8px;font-weight:bold;font-size:8.5px">신한은행 140-010-007060 , 주식회사 기연리프트</td>
      </tr>
    </table>
  </div>

  <!-- ④ 품목 테이블  716px = 24+26+26+300+44+74+76+72+74 -->
  <div style="border:${outer}">
    <table>
      <colgroup>
        <col style="width:24px"><col style="width:26px"><col style="width:26px">
        <col style="width:300px"><col style="width:44px">
        <col style="width:74px"><col style="width:76px">
        <col style="width:72px"><col style="width:74px">
      </colgroup>
      <tr style="height:24px">
        <th class="L" style="border-right:${solid};border-bottom:${solid}">순번</th>
        <th class="L" style="border-right:${solid};border-bottom:${solid}">월</th>
        <th class="L" style="border-right:${solid};border-bottom:${solid}">일</th>
        <th class="L" style="border-right:${solid};border-bottom:${solid}">품목</th>
        <th class="L" style="border-right:${solid};border-bottom:${solid}">수량</th>
        <th class="L" style="border-right:${solid};border-bottom:${solid}">단가</th>
        <th class="L" style="border-right:${solid};border-bottom:${solid}">공급가액</th>
        <th class="L" style="border-right:${solid};border-bottom:${solid}">부가세</th>
        <th class="L" style="border-bottom:${solid}">비고</th>
      </tr>
      ${itemRows}
    </table>

    <!-- ⑤ 합계 행  716px = 54+24+108+54+24+96+42+24+96+86+108 -->
    <table style="border-top:${solid}">
      <colgroup>
        <col style="width:54px"><col style="width:24px"><col style="width:108px">
        <col style="width:54px"><col style="width:24px"><col style="width:96px">
        <col style="width:42px"><col style="width:24px"><col style="width:96px">
        <col style="width:86px"><col style="width:108px">
      </colgroup>
      <tr style="height:24px;font-weight:bold">
        <td class="L" style="border-right:${dotted}">공급가</td>
        <td class="L" style="border-right:${dotted}">₩</td>
        <td style="border-right:${solid};text-align:right;padding-right:6px">${supplyTotal.toLocaleString()}</td>
        <td class="L" style="border-right:${dotted}">부가세</td>
        <td class="L" style="border-right:${dotted}">₩</td>
        <td style="border-right:${solid};text-align:right;padding-right:6px">${vatTotal.toLocaleString()}</td>
        <td class="L" style="border-right:${dotted}">합계</td>
        <td class="L" style="border-right:${dotted}">₩</td>
        <td style="border-right:${solid};text-align:right;padding-right:6px">${total.toLocaleString()}</td>
        <td class="L" style="text-align:right;padding-right:6px">인수자</td>
        <td class="L">(인)</td>
      </tr>
    </table>
  </div>

  <div style="text-align:right;font-size:8px;color:#666;margin-top:3px">
    (주)기연리프트 | 사업자등록번호: 138-81-83251 | 대표: 이수용
  </div>
</div>
</body>
</html>`;
}

// ──────────────────────────────────────────────────────────────────────────────
// PDF 다운로드 메인
// ──────────────────────────────────────────────────────────────────────────────
export const downloadTransactionStatementPDF = async (
  billing:     any,
  details:     any[],
  customer:    any,
  _contract:   any,
  siteName:    string,
  templateUrl?: string,
  fileName?:   string
): Promise<void> => {

  // 도장 추출
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
  } catch (_) { /* 도장 실패 시 무시 */ }

  const html = buildHTML(billing, details, customer, siteName, stampDataUrl);

  // ── iframe 격리 렌더링 ────────────────────────────────────────────────────
  // 720px iframe → html2canvas → jsPDF (190mm)
  // iframe은 별도의 browsing context → CSS가 완전 격리 적용됨
  const iframe = document.createElement('iframe');
  iframe.style.cssText =
    'position:absolute;top:-9999px;left:0;width:720px;height:900px;border:none;visibility:hidden;';
  document.body.appendChild(iframe);

  try {
    const iDoc = iframe.contentDocument ?? iframe.contentWindow!.document;
    iDoc.open();
    iDoc.write(html);
    iDoc.close();

    // 렌더 완료 대기
    await new Promise<void>(resolve => {
      if (iDoc.readyState === 'complete') return resolve();
      iframe.addEventListener('load', () => resolve(), { once: true });
      setTimeout(resolve, 800); // fallback
    });

    // 추가 대기 (폰트/이미지 안정화)
    await new Promise(r => setTimeout(r, 300));

    // html2canvas 캡처 (720px, scale:2 = 1440px canvas → 190mm = ~193 DPI)
    const iBody = iDoc.body;
    iBody.style.margin  = '0';
    iBody.style.padding = '0';
    iBody.style.width   = '720px';
    iBody.style.overflow= 'hidden';

    const canvas = await html2canvas(iBody, {
      scale:           2,
      useCORS:         true,
      allowTaint:      true,
      logging:         false,
      backgroundColor: '#ffffff',
      width:           720,
      windowWidth:     720,
    });

    // jsPDF 출력
    const imgData = canvas.toDataURL('image/png');
    const pdf     = new jsPDF('p', 'mm', 'a4');
    const pageW   = pdf.internal.pageSize.getWidth();  // 210mm
    const pageH   = pdf.internal.pageSize.getHeight(); // 297mm

    // 좌우 여백 10mm → 190mm (A4 꽉 채움)
    const mx      = 10;
    const my      = 10;
    const printW  = pageW - mx * 2;                      // 190mm
    const printH  = (canvas.height * printW) / canvas.width;

    if (printH <= pageH - my) {
      pdf.addImage(imgData, 'PNG', mx, my, printW, printH);
    } else {
      // 페이지 넘침 시 다중 페이지
      let y = 0;
      const sliceH = pageH - my;
      while (y < printH) {
        pdf.addImage(imgData, 'PNG', mx, my - y, printW, printH);
        y += sliceH;
        if (y < printH) pdf.addPage();
      }
    }

    const custName = customer?.name || '고객사';
    const ym       = billing?.billingYm || '';
    pdf.save(`${fileName || `${custName}_${siteName}_${ym}`}.pdf`);

  } finally {
    document.body.removeChild(iframe);
  }
};
