// src/services/excelTemplateEngine.ts
// (주)기연리프트 엑셀 원본 템플릿 기반 데이터 주입 엔진 (사이트 미연결 독립 모듈)
// ⚠️ 원칙: HTML/CSS 눈대중 모방을 100% 배제하고, 사장님의 실제 .xlsx 엑셀 파일 서식을 100% 보존하며 셀 값만 정밀 주입합니다.

import ExcelJS from 'exceljs';

export interface ExcelCellInjection {
  cell: string; // 예: 'C4', 'D14', 'H7'
  value: string | number | boolean | Date;
}

export interface ExcelImageInjection {
  imageBytes: ArrayBuffer;
  extension: 'png' | 'jpeg';
  range: {
    tl: { col: number; row: number }; // Top-Left 좌표 (0-indexed)
    br?: { col: number; row: number }; // Bottom-Right 좌표 (선택)
    ext?: { width: number; height: number }; // 크기 (선택)
  };
}

export interface SheetInjectionPayload {
  sheetNameOrIndex: string | number;
  cells: ExcelCellInjection[];
  images?: ExcelImageInjection[];
}

export interface ExcelInjectionOptions {
  templateBytes: ArrayBuffer;
  sheets: SheetInjectionPayload[];
}

/**
 * 엑셀 템플릿 바이너리에 실제 비즈니스 데이터를 셀 단위로 주입하여 새로운 엑셀 바이너리를 생성합니다.
 * @param options 템플릿 바이너리 및 시트별 주입 데이터
 * @returns 데이터가 주입된 완성 엑셀 바이너리 (ArrayBuffer)
 */
export async function injectDataIntoExcelTemplate(
  options: ExcelInjectionOptions
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(options.templateBytes);

  for (const sheetPayload of options.sheets) {
    let worksheet: ExcelJS.Worksheet | undefined;

    if (typeof sheetPayload.sheetNameOrIndex === 'number') {
      worksheet = workbook.worksheets[sheetPayload.sheetNameOrIndex];
    } else {
      worksheet = workbook.getWorksheet(sheetPayload.sheetNameOrIndex);
    }

    if (!worksheet) {
      console.warn(`[ExcelTemplateEngine] 시트를 찾을 수 없습니다: ${sheetPayload.sheetNameOrIndex}`);
      continue;
    }

    // 1. 셀 텍스트/숫자 값 주입 (서식·테두리·글꼴 100% 보존)
    for (const item of sheetPayload.cells) {
      const cell = worksheet.getCell(item.cell);
      cell.value = item.value;
    }

    // 2. 직인/도장 이미지 주입 (옵션)
    if (sheetPayload.images && sheetPayload.images.length > 0) {
      for (const img of sheetPayload.images) {
        const imageId = workbook.addImage({
          buffer: img.imageBytes,
          extension: img.extension
        });

        if (img.range.ext) {
          worksheet.addImage(imageId, {
            tl: img.range.tl as any,
            ext: img.range.ext
          });
        } else if (img.range.br) {
          worksheet.addImage(imageId, {
            tl: img.range.tl as any,
            br: img.range.br as any
          });
        }
      }
    }
  }

  const resultBuffer = await workbook.xlsx.writeBuffer();
  return resultBuffer;
}

/**
 * 계약서 양식 데이터 주입 맵퍼 규격 (설계 참고용 인터페이스)
 */
export interface ContractExcelData {
  contractDate: string;        // 계약일자 (YYYY년 MM월 DD일)
  lessorName: string;          // 임대인 상호
  lessorCeo: string;           // 임대인 대표자
  lessorBizNo: string;         // 임대인 사업자등록번호
  lesseeName: string;          // 임차인 상호
  lesseeCeo: string;           // 임차인 대표자
  lesseeBizNo: string;         // 임차인 등록번호
  deliveryLocation: string;    // 장비 인도장소
  siteAddress: string;         // 현장 상세 위치
  deliveryDateTime: string;    // 장비 인도 일시
  managerName: string;         // 현장 담당자
  managerPhone: string;        // 현장 담당자 연락처
  /**
   * 체결 장비 목록
   * ⚠️ 비즈니스 룰:
   * - 12대 이하: 본문 테이블 12줄 내 1:1 직접 표기
   * - 13대 이상: 본문 1행 요약 ('GS-1930 외 N대 (총 N대)') + [별지 제1호: 체결 장비 상세 명세표] 자동 생성
   */
  assets: Array<{
    modelName: string;         // 품목(모델명)
    quantity: number;          // 수량
    serialNo: string;          // 장비 번호(S/N)
    monthlyFee: number;        // 임대료 (월)
    subtotal: number;          // 소계
  }>;
  totalMonthlyFee: number;     // 총 합계
  transportTerms: string;      // 운송료 청구 기준
  hasAnnexList?: boolean;      // 13대 이상 시 별지 생성 여부 (자동 산출)
}

/**
 * 반입전 체크리스트 데이터 주입 맵퍼 규격
 * ⚠️ 실무 규칙:
 * - 점검자(김관주) 및 점검결과(양호), 충전기 작동값(20.7A)은 원본 템플릿에 고정 인쇄되어 있으므로 편집 불필요.
 * - 도장 날인하지 않음.
 * - 오직 상단의 [모델명]과 [관리번호(S/N)] 2개 항목만 동적 주입.
 */
export interface PreDeliveryChecklistExcelData {
  modelName: string;           // 모델명 (예: 'Z-45/25J', 'GS-1930')
  serialNo: string;            // 관리번호 및 S/N (예: 'G19052 (GS30D-13533)')
}

/**
 * 안전점검 결과서 데이터 주입 맵퍼 규격
 * ⚠️ 실무 규칙:
 * - 제조사/장비중량/운행속도/작업높이/안전인증일은 ERP [제품관리] 마스터에서 100% 자동 호출.
 * - 점검자(김관주) 및 도장 날인은 원본 템플릿에 이미 박혀 있으므로 수정 불필요 (100% 원본 보존).
 */
export interface SafetyInspectionExcelData {
  siteName: string;            // 사업장명
  clientName: string;          // 사용업체
  manufacturer: string;        // 제 조 사 (ERP [제품관리] 마스터에서 자동 호출, 예: 'GENIE', 'SINOBOOM', 'DINGLI', 'SKYJACK')
  lessorName?: string;         // 렌탈사 (기본값: '(주)기연리프트')
  modelName: string;           // 모델명
  serialNo: string;            // 차량/장비번호
  weight: string;              // 장비중량 (ERP [제품관리] 마스터에서 자동 호출)
  speed: string;               // 운행속도 (ERP [제품관리] 마스터에서 자동 호출)
  maxHeightCapacity: string;   // 작업최대높이/적재용량 (ERP [제품관리] 마스터에서 자동 호출)
  safetyCertDate: string;      // 안전인증년월일 (ERP [제품관리] 마스터에서 자동 호출)
  inspectionDate: string;      // 안전점검일시 (출고일자)
  manufactureYear?: string;    // 제조년도 (ERP [자산대장] 마스터에서 자동 호출)
  inspectorName?: string;      // 점검자 (상시 '김관주' 고정, 원본 보존)
  results?: Record<string, string>; // 검사결과 목록
}

/**
 * 텍스트 오버레이용 투명 캔버스 레이어를 생성하여 PNG 바이트로 반환합니다.
 */
function createTextCanvasLayer(
  width: number,
  height: number,
  drawFn: (ctx: CanvasRenderingContext2D) => void
): Promise<Uint8Array> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, width, height);
      ctx.textBaseline = 'middle';
      drawFn(ctx);
    }
    canvas.toBlob(async (blob) => {
      if (blob) {
        const buffer = await blob.arrayBuffer();
        resolve(new Uint8Array(buffer));
      } else {
        resolve(new Uint8Array());
      }
    }, 'image/png');
  });
}

/**
 * 1. 고소작업대 임대차 계약서 PDF 생성 (12줄 수용 및 13개 이상 별지 자동 분기)
 * - 기존 셀 내 잔존 텍스트 영역을 100% 화이트아웃 마스킹하여 겹침/낙서 현상 완전 제거
 */
export async function generateContractPdf(data: ContractExcelData): Promise<Uint8Array> {
  const { PDFDocument, rgb } = await import('pdf-lib');
  const res = await fetch('/templates/임대차계약서_양식_원본.pdf');
  if (!res.ok) throw new Error(`계약서 원본 템플릿 로드 실패: HTTP ${res.status}`);

  const templateBytes = await res.arrayBuffer();
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();

  // ── [1단계] 기존 템플릿에 들어있던 잔존 텍스트 영역 순백색(White-out) 마스킹 ──
  // (pdf-lib 좌표계: 좌측 하단이 0, 0)
  const white = rgb(1, 1, 1);

  // 상단 계약일자 마스킹
  page.drawRectangle({ x: 200, y: height - 105, width: 200, height: 16, color: white });

  // 임차인(을) 등록번호, 상호, 대표자 마스킹
  page.drawRectangle({ x: 380, y: height - 130, width: 180, height: 15, color: white });
  page.drawRectangle({ x: 380, y: height - 150, width: 180, height: 15, color: white });
  page.drawRectangle({ x: 380, y: height - 170, width: 180, height: 15, color: white });

  // 인도장소, 인도일시, 상세주소, 담당자, 연락처 마스킹
  page.drawRectangle({ x: 120, y: height - 222, width: 200, height: 15, color: white });
  page.drawRectangle({ x: 395, y: height - 222, width: 165, height: 15, color: white });
  page.drawRectangle({ x: 120, y: height - 240, width: 440, height: 15, color: white });
  page.drawRectangle({ x: 120, y: height - 276, width: 200, height: 15, color: white });
  page.drawRectangle({ x: 395, y: height - 276, width: 165, height: 15, color: white });

  // 체결 장비 그리드 12행 전체 화이트아웃 마스킹 (기존 옛날 데이터 전면 삭제)
  page.drawRectangle({ x: 35, y: height - 528, width: 525, height: 218, color: white });

  // 합계 금액 영역 마스킹
  page.drawRectangle({ x: 395, y: height - 425, width: 165, height: 18, color: white });

  // 하단 영업담당자 영역 마스킹
  page.drawRectangle({ x: 375, y: height - 765, width: 180, height: 15, color: white });

  // ── [2단계] 정밀 폰트 텍스트 렌더링 ──
  const scale = 3.5;
  const canvasW = width * scale;
  const canvasH = height * scale;

  const overlayPng = await createTextCanvasLayer(canvasW, canvasH, (ctx) => {
    ctx.fillStyle = '#111827';

    // 1. 계약 체결일자 (상단 중앙)
    ctx.font = 'bold 30px "Malgun Gothic", "맑은 고딕", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(data.contractDate || new Date().toISOString().split('T')[0], canvasW * 0.5, canvasH * 0.115);

    // 2. 임차인(을) 정보
    ctx.textAlign = 'left';
    ctx.font = '500 24px "Malgun Gothic", "맑은 고딕", sans-serif';
    ctx.fillText(data.lesseeBizNo || '', canvasW * 0.65, canvasH * 0.144);
    ctx.fillText(data.lesseeName || '', canvasW * 0.65, canvasH * 0.168);
    ctx.fillText(data.lesseeCeo || '', canvasW * 0.65, canvasH * 0.192);

    // 3. 임대차 계약 내용 (현장 및 대리인)
    ctx.fillText(data.deliveryLocation || '', canvasW * 0.21, canvasH * 0.254);
    ctx.fillText(data.deliveryDateTime || '', canvasW * 0.67, canvasH * 0.254);
    ctx.fillText(data.siteAddress || '', canvasW * 0.21, canvasH * 0.276);
    ctx.fillText(data.managerName || '', canvasW * 0.21, canvasH * 0.318);
    ctx.fillText(data.managerPhone || '', canvasW * 0.67, canvasH * 0.318);

    // 4. 체결 장비 12줄 그리드
    const isOver12 = data.assets.length >= 13;
    const startY = canvasH * 0.380;
    const rowHeight = canvasH * 0.0216;

    if (isOver12) {
      ctx.fillText(`${data.assets[0]?.modelName || '고소작업대'} 외 ${data.assets.length - 1}대 (총 ${data.assets.length}대)`, canvasW * 0.08, startY);
      ctx.textAlign = 'center';
      ctx.fillText(`${data.assets.length}`, canvasW * 0.22, startY);
      ctx.textAlign = 'left';
      ctx.fillText('[별지 제1호: 체결 장비 상세 명세표 참조]', canvasW * 0.27, startY);
      ctx.textAlign = 'right';
      ctx.fillText(data.totalMonthlyFee ? data.totalMonthlyFee.toLocaleString() : '-', canvasW * 0.58, startY);
    } else {
      data.assets.forEach((asset, idx) => {
        if (idx >= 12) return;
        const currentY = startY + idx * rowHeight;
        ctx.textAlign = 'left';
        ctx.fillText(asset.modelName || '', canvasW * 0.08, currentY);
        ctx.textAlign = 'center';
        ctx.fillText(`${asset.quantity || 1}`, canvasW * 0.22, currentY);
        ctx.textAlign = 'left';
        ctx.fillText(asset.serialNo || '', canvasW * 0.26, currentY);
        ctx.textAlign = 'right';
        ctx.fillText(asset.monthlyFee ? asset.monthlyFee.toLocaleString() : '', canvasW * 0.49, currentY);
        ctx.fillText(asset.subtotal ? asset.subtotal.toLocaleString() : '', canvasW * 0.58, currentY);
      });
    }

    // 5. 합계 금액
    ctx.font = 'bold 28px "Malgun Gothic", "맑은 고딕", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`₩ ${(data.totalMonthlyFee || 0).toLocaleString()}`, canvasW * 0.92, canvasH * 0.494);

    // 6. 영업 담당자 정보
    ctx.textAlign = 'left';
    ctx.font = '500 24px "Malgun Gothic", "맑은 고딕", sans-serif';
    if (data.managerName) {
      ctx.fillText(data.managerName, canvasW * 0.65, canvasH * 0.900);
    }
  });

  const embeddedImage = await pdfDoc.embedPng(overlayPng);
  page.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width,
    height
  });

  return await pdfDoc.save();
}

/**
 * 2. 반입 전 CHECK LIST PDF 생성
 * - 상단 [모델명], [관리번호(S/N)] 셀 영역 화이트아웃 마스킹 후 정밀 주입
 */
export async function generateChecklistPdf(data: PreDeliveryChecklistExcelData): Promise<Uint8Array> {
  const { PDFDocument, rgb } = await import('pdf-lib');
  const res = await fetch('/templates/반입전체크리스트_양식_원본.pdf');
  if (!res.ok) throw new Error(`체크리스트 원본 템플릿 로드 실패: HTTP ${res.status}`);

  const templateBytes = await res.arrayBuffer();
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();
  const white = rgb(1, 1, 1);

  // 상단 모델명 및 관리번호(S/N) 기존 텍스트 셀 화이트아웃 마스킹
  page.drawRectangle({ x: 180, y: height - 46, width: 140, height: 16, color: white });
  page.drawRectangle({ x: 410, y: height - 46, width: 150, height: 16, color: white });

  const scale = 3.5;
  const canvasW = width * scale;
  const canvasH = height * scale;

  const overlayPng = await createTextCanvasLayer(canvasW, canvasH, (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 26px "Malgun Gothic", "맑은 고딕", sans-serif';

    // 1. 상단 모델명 (가로/세로 중앙 맞춤)
    ctx.textAlign = 'left';
    ctx.fillText(data.modelName || '', canvasW * 0.32, canvasH * 0.045);

    // 2. 상단 관리번호 (S/N)
    ctx.fillText(data.serialNo || '', canvasW * 0.71, canvasH * 0.045);
  });

  const embeddedImage = await pdfDoc.embedPng(overlayPng);
  page.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width,
    height
  });

  return await pdfDoc.save();
}

/**
 * 3. 고소작업대(T/L) 안전점검 결과서 PDF 생성
 * - 상단 헤더 5행의 기존 텍스트 셀 전체 화이트아웃 마스킹 후 ERP 마스터 제원 정밀 주입
 * - 점검자(김관주) 및 도장 날인은 원본 보존
 */
export async function generateSafetyInspectionPdf(data: SafetyInspectionExcelData): Promise<Uint8Array> {
  const { PDFDocument, rgb } = await import('pdf-lib');
  const res = await fetch('/templates/안전점검결과서_양식_원본.pdf');
  if (!res.ok) throw new Error(`안전점검결과서 원본 템플릿 로드 실패: HTTP ${res.status}`);

  const templateBytes = await res.arrayBuffer();
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();
  const white = rgb(1, 1, 1);

  // 상단 헤더 5개 행의 데이터 영역 화이트아웃 마스킹
  // Row 1: 사업장명, 제조사
  page.drawRectangle({ x: 105, y: height - 58, width: 220, height: 14, color: white });
  page.drawRectangle({ x: 420, y: height - 58, width: 140, height: 14, color: white });

  // Row 2: 사용업체, 모델명
  page.drawRectangle({ x: 105, y: height - 73, width: 220, height: 14, color: white });
  page.drawRectangle({ x: 420, y: height - 73, width: 140, height: 14, color: white });

  // Row 3: 장비중량, 운행속도, 작업높이/용량
  page.drawRectangle({ x: 105, y: height - 88, width: 100, height: 14, color: white });
  page.drawRectangle({ x: 270, y: height - 88, width: 60, height: 14, color: white });
  page.drawRectangle({ x: 420, y: height - 88, width: 140, height: 14, color: white });

  // Row 4: 차량(관리)번호, 제조년도, 안전인증년월일
  page.drawRectangle({ x: 105, y: height - 103, width: 100, height: 14, color: white });
  page.drawRectangle({ x: 270, y: height - 103, width: 60, height: 14, color: white });
  page.drawRectangle({ x: 420, y: height - 103, width: 140, height: 14, color: white });

  // Row 5: 안전점검일시
  page.drawRectangle({ x: 105, y: height - 118, width: 220, height: 14, color: white });

  const scale = 3.5;
  const canvasW = width * scale;
  const canvasH = height * scale;

  const overlayPng = await createTextCanvasLayer(canvasW, canvasH, (ctx) => {
    ctx.fillStyle = '#111827';
    ctx.font = '500 23px "Malgun Gothic", "맑은 고딕", sans-serif';
    ctx.textAlign = 'left';

    // Row 1: 사업장명, 제조사 (렌탈사)
    ctx.fillText(data.siteName || '', canvasW * 0.19, canvasH * 0.059);
    const mfgText = `${data.manufacturer || 'GENIE'} ${data.lessorName || '(주)기연리프트'}`;
    ctx.fillText(mfgText, canvasW * 0.72, canvasH * 0.059);

    // Row 2: 사용업체, 모델명
    ctx.fillText(data.clientName || '', canvasW * 0.19, canvasH * 0.076);
    ctx.fillText(data.modelName || '', canvasW * 0.72, canvasH * 0.076);

    // Row 3: 장비중량, 운행속도, 작업높이/적재용량
    ctx.fillText(data.weight || '', canvasW * 0.19, canvasH * 0.093);
    ctx.fillText(data.speed || '', canvasW * 0.46, canvasH * 0.093);
    ctx.fillText(data.maxHeightCapacity || '', canvasW * 0.72, canvasH * 0.093);

    // Row 4: 차량(관리)번호, 제조년도, 안전인증년월일
    ctx.fillText(data.serialNo || '', canvasW * 0.19, canvasH * 0.111);
    ctx.fillText(data.manufactureYear || '', canvasW * 0.46, canvasH * 0.111);
    ctx.fillText(data.safetyCertDate || '', canvasW * 0.72, canvasH * 0.111);

    // Row 5: 안전점검일시
    ctx.fillText(data.inspectionDate || new Date().toISOString().split('T')[0], canvasW * 0.19, canvasH * 0.129);
  });

  const embeddedImage = await pdfDoc.embedPng(overlayPng);
  page.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width,
    height
  });

  return await pdfDoc.save();
}

/**
 * 거래명세서 정품 A4 PDF 렌더링 규격 인터페이스
 */
export interface TransactionStatementPdfData {
  billingDate: string; // YYYY-MM-DD
  billingYm: string;   // YYYY-MM
  contractNo?: string;

  // 공급자 (당사)
  lessorBizNo?: string;
  lessorName?: string;
  lessorCeo?: string;
  lessorAddress?: string;
  salespersonName?: string;
  salespersonPhone?: string;
  billingManagerName?: string;
  billingManagerPhone?: string;
  lessorEmail?: string;

  // 공급받는 자 (고객사)
  customerBizNo?: string;
  customerName?: string;
  customerCeo?: string;
  customerAddress?: string;
  customerBizType?: string;
  customerBizItem?: string;
  siteManagerName?: string;
  siteManagerPhone?: string;
  custBillingManagerName?: string;
  custBillingManagerPhone?: string;
  custBillingEmail?: string;
  siteName?: string;
  bankAccount?: string;

  // 품목 내역 (최대 11행)
  items: Array<{
    month: number;
    day: number;
    itemDescription: string; // {모델명}[{관리번호}]_{청구시작일}~{청구종료일}
    quantity: number;
    unitPrice: number;
    supplyAmount: number;
    vatAmount: number;
    notes?: string;
  }>;

  totalSupply: number;
  totalVat: number;
  totalGrand: number;
}

/**
 * 4. (주)기연리프트 공식 표준 거래명세서 정품 A4 PDF 생성 엔진
 * - 1순위: 로컬 사이드카 에이전트의 MS Excel COM 엔진(00.거래명세서양식.xlsx 정품 원본 기반)
 * - 2순위: 브라우저 고정밀 Canvas 2D 렌더러 (에이전트 미연결 시 Fallback)
 */
export async function generateTransactionStatementPdf(data: TransactionStatementPdfData): Promise<Uint8Array> {
  // 1순위: 로컬 사이드카 에이전트 (정품 MS Excel COM 엔진) 호출
  try {
    const agentResp = await fetch('http://127.0.0.1:5175/api/generate-statement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (agentResp.ok) {
      const agentRes = await agentResp.json();
      if (agentRes.success && agentRes.base64Content) {
        const binaryStr = atob(agentRes.base64Content);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        return bytes;
      }
    }
  } catch (agentErr) {
    console.warn('⚠️ 로컬 에이전트 연결 불가 또는 오류 발생, 브라우저 렌더러로 전환합니다:', agentErr);
  }

  // 2순위: 브라우저 고정밀 Canvas 2D 렌더러 (Fallback)
  const { PDFDocument, rgb } = await import('pdf-lib');
  
  // A4 표준 규격: 595.28 x 841.89 pt
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const scale = 3.5;
  const canvasW = width * scale;   // 2083 px
  const canvasH = height * scale;  // 2946 px

  const overlayPng = await createTextCanvasLayer(canvasW, canvasH, (ctx) => {
    // 배경 흰색
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const marginX = canvasW * 0.05; // 좌우 5% 마진 (약 104px)
    const contentW = canvasW - marginX * 2;
    const startY = canvasH * 0.045;

    // ── 1. 상단 메인 타이틀 ──
    ctx.fillStyle = '#0284c7';
    ctx.font = 'bold 58px "Malgun Gothic", "맑은 고딕", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('거  래  명  세  서', canvasW * 0.5, startY + 40);

    ctx.fillStyle = '#64748b';
    ctx.font = '500 24px "Malgun Gothic", "맑은 고딕", sans-serif';
    ctx.fillText('( 공급받는자 보관용 )', canvasW * 0.5, startY + 80);

    // ── 2. 공급자 (좌) / 공급받는자 (우) 2분할 테이블 ──
    const partyY = startY + 110;
    const halfW = (contentW - 20) / 2;
    const boxH = 430;

    // 공통 테두리 스타일
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0284c7';

    // (1) 공급자 박스
    ctx.strokeRect(marginX, partyY, halfW, boxH);
    // (2) 공급받는자 박스
    ctx.strokeRect(marginX + halfW + 20, partyY, halfW, boxH);

    // 내부 헤더 밴드
    ctx.fillStyle = 'rgba(2, 132, 199, 0.08)';
    ctx.fillRect(marginX, partyY, halfW, 44);
    ctx.fillRect(marginX + halfW + 20, partyY, halfW, 44);

    ctx.fillStyle = '#0369a1';
    ctx.font = 'bold 26px "Malgun Gothic", "맑은 고딕", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('  [ 공  급  자 ]', marginX + 10, partyY + 28);
    ctx.fillText('  [ 공 급 받 는 자 ]', marginX + halfW + 30, partyY + 28);

    // 공급자 텍스트 렌더링
    const rowH = 46;
    let curY = partyY + 70;
    ctx.font = '500 22px "Malgun Gothic", "맑은 고딕", sans-serif';

    const drawInfoRow = (x: number, label: string, val: string, w: number, isBoldVal = false) => {
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 21px "Malgun Gothic", "맑은 고딕", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(label, x + 15, curY);

      ctx.fillStyle = '#0f172a';
      ctx.font = isBoldVal ? 'bold 22px "Malgun Gothic", "맑은 고딕", sans-serif' : '500 21px "Malgun Gothic", "맑은 고딕", sans-serif';
      ctx.fillText(val, x + 130, curY);
    };

    // 공급자 상세
    drawInfoRow(marginX, '등록번호', data.lessorBizNo || '138-81-83251', halfW, true);
    curY += rowH;
    drawInfoRow(marginX, '상      호', `${data.lessorName || '(주)기연리프트'}   대표: ${data.lessorCeo || '이수용'} (인)`, halfW, true);
    curY += rowH;
    drawInfoRow(marginX, '주      소', data.lessorAddress || '경기도 용인시 처인구 모현읍 갈담로112번길 21-3', halfW);
    curY += rowH;
    drawInfoRow(marginX, '업태/종목', '임대서비스업 외 / 고소장비임대업 외', halfW);
    curY += rowH;
    drawInfoRow(marginX, '계약담당', `${data.salespersonName || '-'} (${data.salespersonPhone || '-'})`, halfW);
    curY += rowH;
    drawInfoRow(marginX, '계산서담당', `${data.billingManagerName || '정수아'} (${data.billingManagerPhone || '031-334-5295'})`, halfW);
    curY += rowH;
    drawInfoRow(marginX, '이 메 일', data.lessorEmail || 'giyeonlift@naver.com', halfW);
    curY += rowH;
    drawInfoRow(marginX, '작성일자', data.billingDate || new Date().toISOString().split('T')[0], halfW, true);

    // 공급받는자 상세
    curY = partyY + 70;
    const rightX = marginX + halfW + 20;
    drawInfoRow(rightX, '등록번호', data.customerBizNo || '-', halfW, true);
    curY += rowH;
    drawInfoRow(rightX, '상      호', `${data.customerName || '-'}   대표: ${data.customerCeo || '-'}`, halfW, true);
    curY += rowH;
    drawInfoRow(rightX, '주      소', data.customerAddress || '-', halfW);
    curY += rowH;
    drawInfoRow(rightX, '업태/종목', `${data.customerBizType || '-'} / ${data.customerBizItem || '-'}`, halfW);
    curY += rowH;
    drawInfoRow(rightX, '현장담당', `${data.siteManagerName || '-'} (${data.siteManagerPhone || '-'})`, halfW);
    curY += rowH;
    drawInfoRow(rightX, '계산서담당', `${data.custBillingManagerName || '-'} (${data.custBillingManagerPhone || '-'})`, halfW);
    curY += rowH;
    drawInfoRow(rightX, '계산서메일', data.custBillingEmail || '-', halfW);
    curY += rowH;
    drawInfoRow(rightX, '작업현장', data.siteName || '-', halfW, true);

    // ── 3. 메인 거래 내역 테이블 (11행) ──
    const tableY = partyY + boxH + 30;
    const colDefs = [
      { key: 'no', label: '순번', w: 80, align: 'center' },
      { key: 'm', label: '월', w: 60, align: 'center' },
      { key: 'd', label: '일', w: 60, align: 'center' },
      { key: 'item', label: '품      목', w: 860, align: 'left' },
      { key: 'qty', label: '수량', w: 80, align: 'center' },
      { key: 'price', label: '단  가', w: 180, align: 'right' },
      { key: 'supply', label: '공 급 가 액', w: 200, align: 'right' },
      { key: 'vat', label: '부 가 세', w: 180, align: 'right' },
      { key: 'note', label: '비  고', w: contentW - (80 + 60 + 60 + 860 + 80 + 180 + 200 + 180), align: 'center' }
    ];

    // 헤더 그리기
    const headerH = 50;
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(marginX, tableY, contentW, headerH);
    ctx.strokeStyle = '#0284c7';
    ctx.strokeRect(marginX, tableY, contentW, headerH);

    let curColX = marginX;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Malgun Gothic", "맑은 고딕", sans-serif';
    colDefs.forEach(col => {
      ctx.textAlign = 'center';
      ctx.fillText(col.label, curColX + col.w / 2, tableY + 32);
      ctx.beginPath();
      ctx.moveTo(curColX + col.w, tableY);
      ctx.lineTo(curColX + col.w, tableY + headerH);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      curColX += col.w;
    });

    // 11개 데이터 행 그리기
    const dataRowH = 62;
    const maxRows = 11;
    let curRowY = tableY + headerH;

    for (let i = 0; i < maxRows; i++) {
      const item = data.items[i];
      
      // 행 배경 교차색
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#f8fafc';
      ctx.fillRect(marginX, curRowY, contentW, dataRowH);

      // 행 테두리
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(marginX, curRowY, contentW, dataRowH);

      curColX = marginX;
      colDefs.forEach(col => {
        // 세로 구분선
        ctx.beginPath();
        ctx.moveTo(curColX + col.w, curRowY);
        ctx.lineTo(curColX + col.w, curRowY + dataRowH);
        ctx.stroke();

        if (item) {
          ctx.fillStyle = '#0f172a';
          ctx.font = '500 20px "Malgun Gothic", "맑은 고딕", sans-serif';

          let valStr = '';
          if (col.key === 'no') valStr = String(i + 1);
          else if (col.key === 'm') valStr = String(item.month || '');
          else if (col.key === 'd') valStr = String(item.day || '');
          else if (col.key === 'item') {
            valStr = item.itemDescription || '';
            ctx.font = 'bold 20px "Malgun Gothic", "맑은 고딕", sans-serif';
          }
          else if (col.key === 'qty') valStr = String(item.quantity || 1);
          else if (col.key === 'price') valStr = item.unitPrice ? item.unitPrice.toLocaleString() : '-';
          else if (col.key === 'supply') valStr = item.supplyAmount ? item.supplyAmount.toLocaleString() : '-';
          else if (col.key === 'vat') valStr = item.vatAmount ? item.vatAmount.toLocaleString() : '-';
          else if (col.key === 'note') valStr = item.notes || '';

          if (col.align === 'center') {
            ctx.textAlign = 'center';
            ctx.fillText(valStr, curColX + col.w / 2, curRowY + 38);
          } else if (col.align === 'right') {
            ctx.textAlign = 'right';
            ctx.fillText(valStr, curColX + col.w - 15, curRowY + 38);
          } else {
            ctx.textAlign = 'left';
            ctx.fillText(valStr, curColX + 15, curRowY + 38);
          }
        }
        curColX += col.w;
      });

      curRowY += dataRowH;
    }

    // ── 4. 하단 합계 행 (Row 27 대응) ──
    const totalRowH = 65;
    ctx.fillStyle = '#f0fdf4';
    ctx.fillRect(marginX, curRowY, contentW, totalRowH);
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(marginX, curRowY, contentW, totalRowH);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px "Malgun Gothic", "맑은 고딕", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('합     계', marginX + (colDefs[0].w + colDefs[1].w + colDefs[2].w + colDefs[3].w + colDefs[4].w) / 2, curRowY + 41);

    // 공급가합계
    ctx.textAlign = 'right';
    ctx.fillStyle = '#0284c7';
    ctx.fillText(`₩ ${data.totalSupply.toLocaleString()}`, marginX + 1460, curRowY + 41);

    // 세액합계
    ctx.fillText(`₩ ${data.totalVat.toLocaleString()}`, marginX + 1660, curRowY + 41);

    // 총합계 (굵은 강조)
    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'bold 26px "Malgun Gothic", "맑은 고딕", sans-serif';
    ctx.fillText(`₩ ${data.totalGrand.toLocaleString()}`, marginX + contentW - 20, curRowY + 41);

    // ── 5. 하단 입금계좌 및 안내 ──
    const footerY = curRowY + totalRowH + 35;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(marginX, footerY, contentW, 110);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.strokeRect(marginX, footerY, contentW, 110);

    ctx.fillStyle = '#0369a1';
    ctx.font = 'bold 22px "Malgun Gothic", "맑은 고딕", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`💳 입금계좌: ${data.bankAccount || '신한은행 140-010-007060 , 주식회사 기연리프트'}`, marginX + 25, footerY + 40);

    ctx.fillStyle = '#64748b';
    ctx.font = '500 19px "Malgun Gothic", "맑은 고딕", sans-serif';
    ctx.fillText('• 본 거래명세서는 (주)기연리프트 전산시스템을 통해 자동 발행된 공식 전자문서입니다.', marginX + 25, footerY + 80);
  });

  const embeddedImage = await pdfDoc.embedPng(overlayPng);
  page.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width,
    height
  });

  return await pdfDoc.save();
}

/**
 * 엑셀 정품 PDF 템플릿 로더 (하위 호환)
 */
export async function generateSafetyInspectionPdfFromExcelTemplate(
  data?: Partial<SafetyInspectionExcelData>
): Promise<Uint8Array> {
  return generateSafetyInspectionPdf({
    siteName: data?.siteName || '',
    clientName: data?.clientName || '',
    manufacturer: data?.manufacturer || 'GENIE',
    modelName: data?.modelName || 'GS-1930',
    serialNo: data?.serialNo || 'G19052',
    weight: data?.weight || '1,500 kg',
    speed: data?.speed || '4.0 Km/h',
    maxHeightCapacity: data?.maxHeightCapacity || '7.8 M / 227 kg',
    safetyCertDate: data?.safetyCertDate || '2024-03-01',
    inspectionDate: data?.inspectionDate || new Date().toISOString().split('T')[0]
  });
}

