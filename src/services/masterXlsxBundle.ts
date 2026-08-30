// src/services/masterXlsxBundle.ts
// ─────────────────────────────────────────────────────────────────────────────
// 01.계약서패키지_마스터.xlsx 기반 계약서류 일괄 생성 엔진
//
// [최적화] 기존: 자산 N대 → fetch (2N+1)회, PDFDocument (2N+1)번 생성/소멸
//          신규: 마스터 xlsx 1회 fetch → ArrayBuffer 재사용으로 (2N+1)회 파싱
//               → mergedPdf에 직접 페이지 삽입 (중간 PDFDocument 0개)
//
// 시트 구조 (검증 완료 2026-08-30):
//   [0] "계약서 "          — {Today}, {사업자등록번호}, {고객명}, {모델명} 등
//   [1] "반입전체크리스트"  — A2 병합셀에 {모델명}, {관리번호}
//   [2] "안전점검결과서"    — C3~K7 범위에 {사업장명}, {고객명}, {모델명} 등
// ─────────────────────────────────────────────────────────────────────────────

import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';
import html2canvas from 'html2canvas';
import type { ContractBundleAssetItem, ContractFullBundleOptions } from './pdfBundle';

// ─────────────────────────────────────────────────────────────────────────────
// 내부 유틸: 셀 값에서 플레이스홀더 치환
// ─────────────────────────────────────────────────────────────────────────────
function replacePlaceholders(cell: ExcelJS.Cell, map: Record<string, string>): void {
  if (typeof cell.value === 'string') {
    let v = cell.value;
    for (const [key, val] of Object.entries(map)) {
      v = v.split(`{${key}}`).join(val);
    }
    cell.value = v;
  } else if (cell.value && typeof cell.value === 'object' && 'richText' in (cell.value as any)) {
    const rv = cell.value as ExcelJS.CellRichTextValue;
    cell.value = {
      richText: rv.richText.map(run => ({
        ...run,
        text: Object.entries(map).reduce((t, [k, v]) => t.split(`{${k}}`).join(v), run.text),
      })),
    };
  }
}

function injectSheet(ws: ExcelJS.Worksheet, map: Record<string, string>): void {
  ws.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => replacePlaceholders(cell, map));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 워크시트 → HTML 직렬화 → html2canvas → PDF 페이지 삽입
// ─────────────────────────────────────────────────────────────────────────────
function buildCellStyle(cell: ExcelJS.Cell): string {
  const s: string[] = ['padding:2px 3px', 'vertical-align:middle', 'word-break:break-all'];
  const b = cell.border;
  if (b?.top?.style)    s.push('border-top:1px solid #000');
  if (b?.bottom?.style) s.push('border-bottom:1px solid #000');
  if (b?.left?.style)   s.push('border-left:1px solid #000');
  if (b?.right?.style)  s.push('border-right:1px solid #000');
  const fill = cell.fill as any;
  if (fill?.fgColor?.argb && fill.fgColor.argb.length === 8) {
    const hex = '#' + fill.fgColor.argb.slice(2);
    if (hex !== '#000000') s.push(`background-color:${hex}`);
  }
  if (cell.font?.bold) s.push('font-weight:bold');
  if (cell.font?.size) s.push(`font-size:${Math.max(7, cell.font.size - 1)}px`);
  if (cell.alignment?.horizontal) s.push(`text-align:${cell.alignment.horizontal}`);
  return s.join(';');
}

function worksheetToHtml(ws: ExcelJS.Worksheet): string {
  const skip = new Set<string>();
  const mergesMap: Record<string, { r1:number; c1:number; r2:number; c2:number }> = {};

  // ExcelJS 내부 _merges 접근 (비공개 API — 실용적 사용)
  const raw = (ws as any)._merges as Record<string, string> | undefined;
  if (raw) {
    for (const rangeStr of Object.keys(raw)) {
      // rangeStr 예: "A1:C3"
      const [tl, br] = rangeStr.includes(':') ? rangeStr.split(':') : [rangeStr, rangeStr];
      const c1 = tl.replace(/[0-9]/g, '').split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
      const r1 = parseInt(tl.replace(/[A-Z]/g, ''), 10);
      const c2 = br.replace(/[0-9]/g, '').split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
      const r2 = parseInt(br.replace(/[A-Z]/g, ''), 10);
      mergesMap[tl] = { r1, c1, r2, c2 };
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const addr = `${colNumToLetter(c)}${r}`;
          if (addr !== tl) skip.add(addr);
        }
      }
    }
  }

  function colNumToLetter(n: number): string {
    let s = '';
    while (n > 0) { s = String.fromCharCode(64 + (n % 26 || 26)) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }

  const maxCol = ws.columnCount || 12;
  const rows: string[] = [];

  ws.eachRow({ includeEmpty: true }, (row, rowNum) => {
    const cells: string[] = [];
    for (let c = 1; c <= maxCol; c++) {
      const letter = colNumToLetter(c);
      const addr = `${letter}${rowNum}`;
      if (skip.has(addr)) continue;

      const cell = row.getCell(c);
      const merge = mergesMap[addr];
      const colspan = merge ? merge.c2 - merge.c1 + 1 : 1;
      const rowspan = merge ? merge.r2 - merge.r1 + 1 : 1;

      let val = '';
      if (typeof cell.value === 'string') val = cell.value;
      else if (typeof cell.value === 'number') val = String(cell.value);
      else if (cell.value && typeof cell.value === 'object' && 'richText' in (cell.value as any)) {
        val = (cell.value as ExcelJS.CellRichTextValue).richText.map(r => r.text).join('');
      }

      const cs = colspan > 1 ? ` colspan="${colspan}"` : '';
      const rs = rowspan > 1 ? ` rowspan="${rowspan}"` : '';
      cells.push(`<td${cs}${rs} style="${buildCellStyle(cell)}">${val.replace(/\n/g, '<br/>')}</td>`);
    }
    rows.push(`<tr>${cells.join('')}</tr>`);
  });

  return `<table style="width:100%;border-collapse:collapse;font-size:9px;table-layout:fixed;"><tbody>${rows.join('')}</tbody></table>`;
}

async function worksheetToPdfPage(ws: ExcelJS.Worksheet, mergedPdf: PDFDocument): Promise<void> {
  const container = document.createElement('div');
  container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:794px;background:#fff;color:#000;font-family:\'Malgun Gothic\',\'맑은 고딕\',sans-serif;box-sizing:border-box;padding:16px;';
  container.innerHTML = worksheetToHtml(ws);
  document.body.appendChild(container);
  try {
    const canvas = await html2canvas(container, {
      scale: 2.0, useCORS: true, allowTaint: true,
      logging: false, backgroundColor: '#ffffff', width: 794, windowWidth: 794,
    });
    const jpgBytes = await (await fetch(canvas.toDataURL('image/jpeg', 0.92))).arrayBuffer();
    const embedded = await mergedPdf.embedJpg(jpgBytes);   // 중간 PDFDocument 없이 직접 삽입 ✅
    const page = mergedPdf.addPage([595.28, 841.89]);
    page.drawImage(embedded, { x: 0, y: 0, width: 595.28, height: 841.89 });
  } finally {
    document.body.removeChild(container);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 퍼블릭 API
// ─────────────────────────────────────────────────────────────────────────────
export interface MasterXlsxBundleResult {
  pagesAdded: number;
}

/**
 * 마스터 xlsx 1번 fetch → 자산 N대에 대해:
 *   [계약서 1p] + [반입전체크리스트 Np] + [안전점검결과서 Np] = (2N+1)p 생성
 *
 * fetch 횟수: 기존 (2N+1)회 → 신규 1회
 * PDFDocument 생성 횟수: 기존 (2N+1)회 → 신규 0회 (mergedPdf 직접 재사용)
 */
export async function injectMasterXlsxToBundle(
  options: ContractFullBundleOptions,
  mergedPdf: PDFDocument,
  onProgress?: (msg: string, step: number, total: number) => void,
): Promise<MasterXlsxBundleResult> {
  const assetList = (options.assets && options.assets.length > 0)
    ? options.assets
    : [{ assetNo: 'SAMPLE', modelName: 'GS-1930', sn: '-', rentalFee: 0 }];

  const publicDomain = options.r2Config?.publicDomain
    || 'https://pub-4bd1b65a7bcc4eef8993da27e7362727.r2.dev';

  const N = assetList.length;
  const totalSteps = 1 + 1 + N + N; // fetch + 계약서 + 체크리스트N + 안전점검N

  // ── 1. 마스터 xlsx 1회 fetch ───────────────────────────────────────────────
  onProgress?.('마스터 xlsx 1회 fetch 중...', 1, totalSteps);

  let masterBytes: ArrayBuffer | null = null;
  const masterFileName = '01.%EA%B3%84%EC%95%BD%EC%84%9C%ED%8C%A8%ED%82%A4%EC%A7%80_%EB%A7%88%EC%8A%A4%ED%84%B0.xlsx';

  try {
    const res = await fetch(`${publicDomain.replace(/\/$/, '')}/${masterFileName}`, {
      signal: AbortSignal.timeout(20000),
    });
    if (res.ok) masterBytes = await res.arrayBuffer();
  } catch (_) {}

  // 로컬 에이전트 fallback
  if (!masterBytes) {
    try {
      const res = await fetch(
        `/api/local-agent?action=readFile&path=${encodeURIComponent('C:/KiyeunAgent/drive_mirror/01.계약서패키지_마스터.xlsx')}`,
        { signal: AbortSignal.timeout(10000) },
      );
      if (res.ok) masterBytes = await res.arrayBuffer();
    } catch (_) {}
  }

  if (!masterBytes) {
    throw new Error('[masterXlsxBundle] 마스터 xlsx 로드 실패 — R2 및 로컬 에이전트 모두 응답 없음');
  }

  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일`;
  })();

  let pagesAdded = 0;
  let stepIdx = 2;

  // ── 2. 계약서 시트 (1페이지) ──────────────────────────────────────────────
  onProgress?.('계약서 데이터 주입 중...', stepIdx++, totalSteps);
  {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(masterBytes);           // ArrayBuffer 재파싱 (네트워크 0회)
    const ws = wb.worksheets[0];               // "계약서 "

    const first = assetList[0];
    const totalFee = assetList.reduce((s, a) => s + (Number(a.rentalFee) || 0), 0);
    const modelSummary = assetList.length > 1
      ? `${first.modelName} 외 ${assetList.length - 1}대 (총 ${assetList.length}대)`
      : first.modelName;

    injectSheet(ws, {
      Today: today,
      사업자등록번호: options.bizRegNo || '',
      고객명: options.customerName || '',
      대표자: options.ceoName || '',
      현장명: options.siteName || '',
      현장주소: options.siteAddress || '',
      하차일시: options.deliveryDate || '',
      현장담당자: options.siteManagerName || options.managerName || '',
      현장담당자연락처: options.siteManagerPhone || options.managerPhone || '',
      모델명: modelSummary,
      수량: String(assetList.length),
      SN: first.sn || '',
      관리번호: first.assetNo || '',
      임대료: (Number(first.rentalFee) || 0).toLocaleString(),
      소계: (Number(first.rentalFee) || 0).toLocaleString(),
      합계: totalFee.toLocaleString(),
      옵션: options.optionsText || '-',
      특이사항: options.remarksText || '-',
    });

    await worksheetToPdfPage(ws, mergedPdf);
    pagesAdded++;
  }

  // ── 3. 반입전체크리스트 × N ───────────────────────────────────────────────
  for (let i = 0; i < N; i++) {
    const ast = assetList[i];
    onProgress?.(`반입전체크리스트 (${i + 1}/${N}) 주입 중...`, stepIdx++, totalSteps);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(masterBytes);           // 같은 버퍼 재파싱 (fetch 0회)
    const ws = wb.worksheets[1];              // "반입전체크리스트"

    injectSheet(ws, {
      모델명: ast.modelName || '',
      관리번호: ast.assetNo ? `${ast.assetNo} (${ast.sn || '-'})` : (ast.sn || ''),
    });

    await worksheetToPdfPage(ws, mergedPdf);
    pagesAdded++;
  }

  // ── 4. 안전점검결과서 × N ─────────────────────────────────────────────────
  for (let i = 0; i < N; i++) {
    const ast = assetList[i];
    onProgress?.(`안전점검결과서 (${i + 1}/${N}) 주입 중...`, stepIdx++, totalSteps);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(masterBytes);           // 같은 버퍼 재파싱 (fetch 0회)
    const ws = wb.worksheets[2];              // "안전점검결과서"

    injectSheet(ws, {
      사업장명: options.siteName || '',
      형식: '수직상승형\n고소작업대',
      제조사: ast.manufacturer || 'GENIE',
      고객명: options.customerName || '',
      동력방식: '배터리충전식',
      모델명: ast.modelName || '',
      중량: ast.weight || '',
      운행속도: '3.5 Km/h',
      작업높이: ast.workingHeight || '',
      적재: ast.capacityPreExt || '',
      차량번호: ast.assetNo || '',
      제조연도: String(ast.manufactureYear || ''),
      안전인증일: ast.certDate || '',
      Today: today,
      점검자: '김관주',
    });

    await worksheetToPdfPage(ws, mergedPdf);
    pagesAdded++;
  }

  return { pagesAdded };
}
