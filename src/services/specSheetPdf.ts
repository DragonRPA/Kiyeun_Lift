// src/services/specSheetPdf.ts
// (주)기연리프트 장비 제원표 PDF 자동 생성 및 Cloudflare R2 업로드 엔진
//
// [이미지 주입 전략]
//   iframe 내 src="/images/..." 경로 방식은 브라우저가 off-screen iframe의
//   이미지를 lazy 처리하여 html2canvas 캡처 시 빈 영역이 발생함 (근본적 한계).
//   → 이미지를 먼저 fetch() → Data URL 변환 → HTML에 인라인 삽입하면
//     HTTP 요청 없음 = lazy 없음 = 100% 안정적 렌더링 보장.
//
// [다크모드 대응]
//   body에 color-scheme: light 명시 → OS 다크모드와 무관하게 흰 배경/검은 글씨 유지.

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Product, GoogleConfig } from './db';
import { createClient } from '@supabase/supabase-js';
import { LIFT_RETRACTED_IMG, LIFT_EXTENDED_IMG } from './specImages';

const supabaseUrl = 'https://wywgkikkjgbnlljkkmnz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5d2draWtramdibmxsamtrbW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjcxMzgsImV4cCI6MjA5OTk0MzEzOH0.gSftxhQjFmWUQzikx-Q5UsdgNKSZISZqJvUGeLBOCqU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * URL → Data URL 변환 헬퍼
 * fetch()로 이미지를 받아 FileReader로 Data URL(base64 인라인)로 변환.
 * 변환된 Data URL을 HTML에 inline으로 삽입하면 iframe 내 lazy loading 문제 없음.
 */
async function fetchAsDataUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`fetch ${url} failed: ${response.status}`);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn(`[specSheetPdf] 이미지 로드 실패: ${url}`, e);
    return ''; // 실패 시 빈 문자열 → img 태그에서 alt 표시
  }
}

/**
 * 장비 제원표 HTML 빌더
 * retractedDataUrl, extendedDataUrl: pre-fetch된 Data URL (인라인 삽입)
 * → iframe 내에서 추가 HTTP 요청 없이 즉시 렌더링됨
 */
export function buildSpecSheetHTML(
  product: Partial<Product>,
  retractedDataUrl: string,
  extendedDataUrl: string
): string {
  const modelName      = product.modelName          || '장비모델';
  const preExt         = product.capacityPreExt     || '227 kg';
  const postExtMain    = product.capacityPostExtMain || '114 kg';
  const postExtDeck    = product.capacityPostExtDeck || '113 kg';
  const maxWindSpeed   = product.maxWindSpeed        || '12.5 m/s 이내';
  const powerSource    = product.powerSource         || '배터리';
  const workingHeight  = product.workingHeight       || '-';
  const platformHeight = product.platformHeight      || '-';
  const weight         = product.weight              || '-';
  const machineDimensions  = product.machineDimensions  || '-';
  const gradeability       = product.gradeability       || '-';
  const platformDimensions = product.platformDimensions || '-';
  const speed          = product.speed               || '-';
  const asContact      = product.asContact           || '031-334-5296';

  const retractedSrc = retractedDataUrl
    ? `<img src="${retractedDataUrl}" alt="확장 전 리프트 형상" />`
    : '<div style="color:#9ca3af;font-size:11px">이미지 없음</div>';

  const extendedSrc = extendedDataUrl
    ? `<img src="${extendedDataUrl}" alt="확장 후 리프트 형상" />`
    : '<div style="color:#9ca3af;font-size:11px">이미지 없음</div>';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>장비제원표 - ${modelName}</title>
  <style>
    /* 다크모드 강제 무력화 — color-scheme: light 명시 */
    :root { color-scheme: light; }
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      margin: 0;
      padding: 30px 40px;
      font-family: "Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", sans-serif;
      background-color: #ffffff !important;
      color: #111827 !important;
      width: 794px;
      height: 1123px;
      color-scheme: light;
    }
    .main-title {
      text-align: center;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 1px;
      margin-top: 10px;
      margin-bottom: 8px;
      color: #111827;
    }
    .sub-title {
      text-align: center;
      font-size: 15px;
      font-weight: bold;
      color: #1e3a8a;
      margin-bottom: 25px;
    }
    .diagram-container {
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 16px;
      background-color: #fafafa;
      margin-bottom: 20px;
    }
    .diagram-flex {
      display: flex;
      justify-content: space-around;
      align-items: center;
      gap: 20px;
    }
    .diagram-card {
      flex: 1;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      background-color: #ffffff;
      padding: 12px;
      text-align: center;
    }
    .diagram-weight {
      font-size: 16px;
      font-weight: 800;
      color: #111827;
      margin-bottom: 4px;
    }
    .arrow-icon {
      font-size: 18px;
      color: #2563eb;
      font-weight: 900;
      margin-bottom: 4px;
    }
    .diagram-img-box {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 120px;
      margin: 6px 0;
    }
    .diagram-img-box img {
      max-height: 115px;
      max-width: 100%;
      object-fit: contain;
    }
    .diagram-label {
      font-size: 13px;
      font-weight: bold;
      color: #374151;
      background-color: #f3f4f6;
      padding: 6px 10px;
      border-radius: 4px;
    }
    .wind-banner-wrap {
      display: flex;
      justify-content: flex-end;
      margin-top: 14px;
    }
    .wind-banner {
      background-color: #dc2626;
      color: #ffffff;
      font-weight: 800;
      font-size: 13px;
      padding: 6px 16px;
      border-radius: 4px;
    }
    .spec-table-title {
      text-align: center;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 3px;
      margin: 24px 0 10px 0;
      color: #111827;
    }
    .spec-table {
      width: 100%;
      border-collapse: collapse;
      border: 2px solid #111827;
      font-size: 13.5px;
      text-align: center;
    }
    .spec-table th, .spec-table td {
      border: 1px solid #111827;
      padding: 10px 8px;
      color: #111827;
      background-color: #ffffff;
    }
    .spec-table .th-bg {
      background-color: #f3f4f6 !important;
      font-weight: bold;
      width: 20%;
    }
    .spec-table .td-val {
      width: 30%;
    }
    .as-cell {
      font-weight: bold;
      font-size: 15px;
      letter-spacing: 1px;
      color: #1e3a8a;
    }
  </style>
</head>
<body>
  <!-- 상단 제목 -->
  <div class="main-title">작업대 확장 전 / 후 적재중량</div>
  <div class="sub-title">장비 모델 : ${modelName}</div>

  <!-- 하중 분배 다이어그램 영역 -->
  <div class="diagram-container">
    <div class="diagram-flex">
      <!-- 1. 확장 전 -->
      <div class="diagram-card">
        <div class="diagram-weight">${preExt}</div>
        <div class="arrow-icon">▼</div>
        <div class="diagram-img-box">
          ${retractedSrc}
        </div>
        <div class="diagram-label">작업대 확장 전 (작업자 2인)</div>
      </div>

      <!-- 2. 확장 후 -->
      <div class="diagram-card">
        <div style="display: flex; justify-content: space-around; margin-bottom: 4px;">
          <div>
            <div class="diagram-weight">${postExtMain}</div>
            <div class="arrow-icon">▼</div>
            <div style="font-size: 11px; color: #6b7280; font-weight: bold;">본체</div>
          </div>
          <div>
            <div class="diagram-weight">${postExtDeck}</div>
            <div class="arrow-icon">▼</div>
            <div style="font-size: 11px; color: #6b7280; font-weight: bold;">확장부</div>
          </div>
        </div>
        <div class="diagram-img-box">
          ${extendedSrc}
        </div>
        <div class="diagram-label">작업대 확장 후 (각 1인)</div>
      </div>
    </div>

    <!-- 최대 풍속 경고 배너 -->
    <div class="wind-banner-wrap">
      <div class="wind-banner">
        최대풍속 : ${maxWindSpeed}
      </div>
    </div>
  </div>

  <!-- 하단: 장비 제원표 테이블 -->
  <div class="spec-table-title">장 비 제 원 표</div>
  <table class="spec-table">
    <tbody>
      <tr>
        <td class="th-bg">동력</td>
        <td class="td-val">${powerSource}</td>
        <td class="th-bg">작업 높이</td>
        <td class="td-val">${workingHeight}</td>
      </tr>
      <tr>
        <td class="th-bg">플랫폼 높이</td>
        <td class="td-val">${platformHeight}</td>
        <td class="th-bg">무게</td>
        <td class="td-val">${weight}</td>
      </tr>
      <tr>
        <td class="th-bg">적재 중량</td>
        <td class="td-val">${preExt}</td>
        <td class="th-bg">장비 크기</td>
        <td class="td-val">${machineDimensions}</td>
      </tr>
      <tr>
        <td class="th-bg">등판 능력</td>
        <td class="td-val">${gradeability}</td>
        <td class="th-bg">플랫폼 크기</td>
        <td class="td-val">${platformDimensions}</td>
      </tr>
      <tr>
        <td class="th-bg">주행 속도</td>
        <td class="td-val">${speed}</td>
        <td class="th-bg"></td>
        <td class="td-val"></td>
      </tr>
      <tr>
        <td class="th-bg">A/S 접수</td>
        <td colspan="3" class="as-cell">
          ${asContact}
        </td>
      </tr>
    </tbody>
  </table>
</body>
</html>
  `;
}

/**
 * 제원표 PDF 렌더링 (브라우저)
 *
 * [핵심 변경]
 * 1. 이미지를 iframe 생성 전에 fetch() → Data URL 변환
 * 2. buildSpecSheetHTML()에 Data URL 전달 → HTML 인라인 삽입
 * 3. iframe 내 외부 이미지 요청 없음 → lazy loading 없음 → 캡처 100% 안정
 * 4. color-scheme: light 적용 → 다크모드 무관
 */
export async function renderSpecSheetJsPdf(
  product: Partial<Product>
): Promise<{ pdf: jsPDF; fileName: string }> {

  // Step 1: 이미지 Data URL 사전 변환 (iframe 생성 전)
  const [retractedDataUrl, extendedDataUrl] = await Promise.all([
    fetchAsDataUrl(LIFT_RETRACTED_IMG),
    fetchAsDataUrl(LIFT_EXTENDED_IMG),
  ]);

  // Step 2: Data URL이 인라인으로 삽입된 HTML 생성
  const html = buildSpecSheetHTML(product, retractedDataUrl, extendedDataUrl);

  // Step 3: 화면 밖 iframe 생성 후 HTML 쓰기
  const iframe = document.createElement('iframe');
  iframe.style.cssText =
    'position:absolute;top:-9999px;left:0;width:794px;height:1123px;border:none;visibility:hidden;';
  document.body.appendChild(iframe);

  try {
    const iDoc = iframe.contentDocument ?? iframe.contentWindow!.document;
    iDoc.open();
    iDoc.write(html);
    iDoc.close();

    // iframe 로드 완료 대기
    await new Promise<void>(resolve => {
      if (iDoc.readyState === 'complete') return resolve();
      iframe.addEventListener('load', () => resolve(), { once: true });
      setTimeout(resolve, 500);
    });

    // 렌더링 안정화 대기 (Data URL 인라인이므로 img.onload 대기 불필요)
    await new Promise(r => setTimeout(r, 300));

    const iBody = iDoc.body;
    iBody.style.margin = '0';
    iBody.style.padding = '30px 40px';
    iBody.style.width = '794px';
    iBody.style.overflow = 'hidden';

    const canvas = await html2canvas(iBody, {
      scale: 2.0,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: 794,
      windowWidth: 794,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    pdf.addImage(imgData, 'PNG', 0, 0, pageW, pageH);

    const safeModel = (product.modelName || '장비모델').replace(/[\/\\:*?"<>|]/g, '_');
    const fileName = `4.제원표_${safeModel}.pdf`;

    return { pdf, fileName };
  } finally {
    document.body.removeChild(iframe);
  }
}

/**
 * 제원표 PDF 생성 → Cloudflare R2 업로드 → Supabase DB specSheetUrl 자동 갱신
 */
export async function generateAndUploadSpecSheetToR2(
  product: Product,
  config?: GoogleConfig
): Promise<{ success: boolean; url: string; error?: string }> {
  try {
    const accountId       = config?.r2AccountId       || '35014a2514680107d74e1e68d96e6c32';
    const bucketName      = config?.r2BucketName      || 'kiyeun-storage';
    const accessKeyId     = config?.r2AccessKeyId     || '03cdb7560d37242de608a5db2a976030';
    const secretAccessKey = config?.r2SecretAccessKey || 'b2407ab4532e02317860bc3d63226fb7bc232e88083b150c15023906ed141986';
    const publicDomain    = config?.r2PublicDomain    || 'https://pub-a2fd3c2ae0cc450b8ebe34baf1b051e1.r2.dev';

    // 1. PDF 렌더링
    const { pdf, fileName } = await renderSpecSheetJsPdf(product);
    const pdfBase64 = pdf.output('datauristring');

    const key = `Eq_doc/${product.modelName}/${fileName}`;

    // 2. Cloudflare R2 업로드
    const res = await fetch('/api/r2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upload',
        accountId,
        bucketName,
        accessKeyId,
        secretAccessKey,
        key,
        base64Content: pdfBase64,
        contentType: 'application/pdf',
      }),
    });

    const resJson = await res.json();
    if (!resJson.success) {
      throw new Error(resJson.error || 'R2 업로드 응답 실패');
    }

    const publicUrl = `${publicDomain.replace(/\/$/, '')}/${encodeURIComponent(key).replace(/%2F/g, '/')}`;

    // 3. Supabase DB specSheetUrl 자동 갱신
    if (product.id) {
      await supabase
        .from('products')
        .update({ specSheetUrl: publicUrl, updatedAt: new Date().toISOString() })
        .eq('id', product.id);
    }

    return { success: true, url: publicUrl };
  } catch (err: any) {
    console.error('[specSheetPdf] generateAndUploadSpecSheetToR2 실패:', err);
    return { success: false, url: '', error: err?.message || '제원표 PDF 생성 및 R2 업로드 실패' };
  }
}
