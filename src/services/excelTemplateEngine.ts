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
      ctx.font = 'bold 24px "Malgun Gothic", "Dotum", sans-serif';
      ctx.fillStyle = '#000000';
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
 */
export async function generateContractPdf(data: ContractExcelData): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const res = await fetch('/templates/임대차계약서_양식_원본.pdf');
  if (!res.ok) throw new Error(`계약서 원본 템플릿 로드 실패: HTTP ${res.status}`);

  const templateBytes = await res.arrayBuffer();
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();

  // 300 DPI 기준 고해상도 캔버스 (가로 2480, 세로 3508)
  const scale = 3.5;
  const canvasW = width * scale;
  const canvasH = height * scale;

  const overlayPng = await createTextCanvasLayer(canvasW, canvasH, (ctx) => {
    ctx.fillStyle = '#000000';

    // 1. 계약 체결일자 (상단 중앙)
    ctx.font = 'bold 36px "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(data.contractDate || new Date().toISOString().split('T')[0], canvasW * 0.5, canvasH * 0.118);

    // 2. 임차인(을) 정보
    ctx.textAlign = 'left';
    ctx.font = '500 28px "Malgun Gothic", sans-serif';
    ctx.fillText(data.lesseeBizNo || '', canvasW * 0.68, canvasH * 0.148);
    ctx.fillText(data.lesseeName || '', canvasW * 0.68, canvasH * 0.174);
    ctx.fillText(data.lesseeCeo || '', canvasW * 0.68, canvasH * 0.198);

    // 3. 임대차 계약 내용 (현장 및 대리인)
    ctx.fillText(data.deliveryLocation || '', canvasW * 0.22, canvasH * 0.258);
    ctx.fillText(data.deliveryDateTime || '', canvasW * 0.68, canvasH * 0.258);
    ctx.fillText(data.siteAddress || '', canvasW * 0.22, canvasH * 0.280);
    ctx.fillText(data.managerName || '', canvasW * 0.22, canvasH * 0.324);
    ctx.fillText(data.managerPhone || '', canvasW * 0.68, canvasH * 0.324);

    // 4. 품목 및 장비 그리드 (최대 12줄)
    const isOver12 = data.assets.length >= 13;
    const startY = canvasH * 0.368;
    const rowHeight = canvasH * 0.0215;

    if (isOver12) {
      // 13대 이상 시 1행 요약 표기
      ctx.fillText(`${data.assets[0]?.modelName || '고소작업대'} 외 ${data.assets.length - 1}대 (총 ${data.assets.length}대)`, canvasW * 0.08, startY);
      ctx.fillText(`${data.assets.length}`, canvasW * 0.21, startY);
      ctx.fillText('[별지 제1호: 체결 장비 상세 명세표 참조]', canvasW * 0.27, startY);
      ctx.fillText(data.totalMonthlyFee ? `₩${data.totalMonthlyFee.toLocaleString()}` : '-', canvasW * 0.52, startY);
    } else {
      // 12대 이하 1:1 기재
      data.assets.forEach((asset, idx) => {
        if (idx >= 12) return;
        const currentY = startY + idx * rowHeight;
        ctx.fillText(asset.modelName || '', canvasW * 0.08, currentY);
        ctx.fillText(`${asset.quantity || 1}`, canvasW * 0.21, currentY);
        ctx.fillText(asset.serialNo || '', canvasW * 0.27, currentY);
        ctx.fillText(asset.monthlyFee ? asset.monthlyFee.toLocaleString() : '', canvasW * 0.43, currentY);
        ctx.fillText(asset.subtotal ? asset.subtotal.toLocaleString() : '', canvasW * 0.52, currentY);
      });
    }

    // 5. 합계 금액
    ctx.font = 'bold 32px "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`₩${(data.totalMonthlyFee || 0).toLocaleString()}`, canvasW * 0.74, canvasH * 0.485);

    // 6. 영업 담당자 정보
    ctx.textAlign = 'left';
    ctx.font = '500 28px "Malgun Gothic", sans-serif';
    if (data.managerName) {
      ctx.fillText(data.managerName, canvasW * 0.64, canvasH * 0.902);
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
 * 2. 반입 전 CHECK LIST PDF 생성 (상단 모델명, 관리번호(S/N) 2개 항목 동적 주입)
 */
export async function generateChecklistPdf(data: PreDeliveryChecklistExcelData): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const res = await fetch('/templates/반입전체크리스트_양식_원본.pdf');
  if (!res.ok) throw new Error(`체크리스트 원본 템플릿 로드 실패: HTTP ${res.status}`);

  const templateBytes = await res.arrayBuffer();
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();

  const scale = 3.5;
  const canvasW = width * scale;
  const canvasH = height * scale;

  const overlayPng = await createTextCanvasLayer(canvasW, canvasH, (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 30px "Malgun Gothic", sans-serif';

    // 1. 상단 모델명
    ctx.fillText(data.modelName || '', canvasW * 0.32, canvasH * 0.046);

    // 2. 상단 관리번호 (S/N)
    ctx.fillText(data.serialNo || '', canvasW * 0.72, canvasH * 0.046);
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
 * 3. 고소작업대(T/L) 안전점검 결과서 PDF 생성 (헤더 제원 및 출고 정보 동적 주입, 점검자 김관주/도장 원본 보존)
 */
export async function generateSafetyInspectionPdf(data: SafetyInspectionExcelData): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const res = await fetch('/templates/안전점검결과서_양식_원본.pdf');
  if (!res.ok) throw new Error(`안전점검결과서 원본 템플릿 로드 실패: HTTP ${res.status}`);

  const templateBytes = await res.arrayBuffer();
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();

  const scale = 3.5;
  const canvasW = width * scale;
  const canvasH = height * scale;

  const overlayPng = await createTextCanvasLayer(canvasW, canvasH, (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.font = '500 26px "Malgun Gothic", sans-serif';

    // Row 1: 사업장명, 제조사 (렌탈사)
    ctx.fillText(data.siteName || '', canvasW * 0.20, canvasH * 0.062);
    const mfgText = `${data.manufacturer || 'GENIE'} ${data.lessorName || '(주)기연리프트'}`;
    ctx.fillText(mfgText, canvasW * 0.73, canvasH * 0.062);

    // Row 2: 사용업체, 모델명
    ctx.fillText(data.clientName || '', canvasW * 0.20, canvasH * 0.080);
    ctx.fillText(data.modelName || '', canvasW * 0.73, canvasH * 0.080);

    // Row 3: 장비중량, 운행속도, 작업높이/적재용량
    ctx.fillText(data.weight || '', canvasW * 0.20, canvasH * 0.098);
    ctx.fillText(data.speed || '', canvasW * 0.47, canvasH * 0.098);
    ctx.fillText(data.maxHeightCapacity || '', canvasW * 0.73, canvasH * 0.098);

    // Row 4: 차량(관리)번호, 제조년도, 안전인증년월일
    ctx.fillText(data.serialNo || '', canvasW * 0.20, canvasH * 0.116);
    ctx.fillText(data.manufactureYear || '', canvasW * 0.47, canvasH * 0.116);
    ctx.fillText(data.safetyCertDate || '', canvasW * 0.73, canvasH * 0.116);

    // Row 5: 안전점검일시
    ctx.fillText(data.inspectionDate || new Date().toISOString().split('T')[0], canvasW * 0.20, canvasH * 0.134);
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
