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
 * 안전점검 결과서 데이터 주입 맵퍼 규격 (설계 참고용 인터페이스)
 */
export interface SafetyInspectionExcelData {
  siteName: string;            // 사업장명
  clientName: string;          // 사용업체
  modelName: string;           // 모델명
  serialNo: string;            // 차량/장비번호
  weight: string;              // 장비중량
  maxHeightCapacity: string;   // 작업최대높이/적재용량
  safetyCertDate: string;      // 안전인증년월일
  inspectionDate: string;      // 안전점검일시
  manufactureYear?: string;    // 제조년도
  inspectorName: string;       // 점검자
  results?: Record<string, string>; // 검사결과 목록
}

/**
 * 마이크로소프트 엑셀 정품 원본 PDF 템플릿을 직접 로드하여 100% 무손실 고화질 벡터 A4 바이너리를 반환합니다.
 * (HTML/CSS 모방 0%, 렌더링 오차 0%)
 */
export async function generateSafetyInspectionPdfFromExcelTemplate(
  _data?: Partial<SafetyInspectionExcelData>
): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');

  // public/templates/안전점검결과서_양식_원본.pdf 로드
  const res = await fetch('/templates/안전점검결과서_양식_원본.pdf');
  if (!res.ok) {
    throw new Error(`안전점검결과서 정품 PDF 템플릿 로드 실패: HTTP ${res.status}`);
  }

  const templateBytes = await res.arrayBuffer();
  const doc = await PDFDocument.load(templateBytes);
  const pdfBytes = await doc.save();
  return pdfBytes;
}
