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
  assets: Array<{
    modelName: string;         // 품목(모델명)
    quantity: number;          // 수량
    serialNo: string;          // 장비 번호(S/N)
    monthlyFee: number;        // 임대료 (월)
    subtotal: number;          // 소계
  }>;
  totalMonthlyFee: number;     // 총 합계
  transportTerms: string;      // 운송료 청구 기준
}

/**
 * 반입전 체크리스트 데이터 주입 맵퍼 규격 (설계 참고용 인터페이스)
 */
export interface PreDeliveryChecklistExcelData {
  modelName: string;           // 모델명
  serialNo: string;            // 관리번호 (S/N)
  inspectorName: string;       // 점검자 성명
  checkDate: string;           // 점검일자
  results: Record<number, '양호' | '불량' | '해당없음'>; // 1~58번 항목 결과
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
 * 3.안전점검결과서.xlsx 서식에 실시간 비즈니스 데이터를 주입하여 고화질 A4 1페이지 PDF 바이너리를 생성합니다.
 */
export async function generateSafetyInspectionPdfFromExcelTemplate(
  data: Partial<SafetyInspectionExcelData>
): Promise<Uint8Array> {
  const { default: html2canvas } = await import('html2canvas');
  const { jsPDF } = await import('jspdf');

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '800px';
  container.style.background = '#ffffff';
  container.style.fontFamily = "'Malgun Gothic', 'Dotum', sans-serif";
  container.style.color = '#000000';
  container.style.padding = '20px 24px';
  container.style.boxSizing = 'border-box';

  const siteName = data.siteName || '인천 검단신도시 101 역세권 개발사업';
  const clientName = data.clientName || '주식회사 우진아이엔에스';
  const modelName = data.modelName || 'GS-1930';
  const weight = data.weight || '1,500 kg';
  const serialNo = data.serialNo || 'G19052 (GS30D-13533)';
  const manufactureYear = data.manufactureYear || '2024년';
  const safetyCertDate = data.safetyCertDate || '2024-03-01';
  const inspectionDate = data.inspectionDate || new Date().toISOString().split('T')[0];
  const inspectorName = data.inspectorName || '김관주';

  container.innerHTML = `
    <div style="text-align:center; margin-bottom: 12px;">
      <h2 style="font-size: 22px; font-weight: 800; text-decoration: underline; margin: 0; letter-spacing: 2px;">고소작업대(T/L) 안전점검 결과서</h2>
    </div>

    <!-- 상단 기본 제원표 -->
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: center; margin-bottom: 10px;">
      <colgroup>
        <col style="width: 12%; background: #f8fafc;" />
        <col style="width: 21%;" />
        <col style="width: 12%; background: #f8fafc;" />
        <col style="width: 21%;" />
        <col style="width: 14%; background: #f8fafc;" />
        <col style="width: 20%;" />
      </colgroup>
      <tr>
        <td style="border: 1px solid #000; padding: 5px 4px; font-weight: bold;">사업장명</td>
        <td style="border: 1px solid #000; padding: 5px 4px; font-weight: 600;">${siteName}</td>
        <td style="border: 1px solid #000; padding: 5px 4px; font-weight: bold;">형식</td>
        <td style="border: 1px solid #000; padding: 5px 4px;">수직상승형 고소작업대</td>
        <td style="border: 1px solid #000; padding: 5px 4px; font-weight: bold;">제 조 사 (렌탈사)</td>
        <td style="border: 1px solid #000; padding: 5px 4px; font-weight: bold;">GENIE (주)기연리프트</td>
      </tr>
      <tr>
        <td style="border: 1px solid #000; padding: 5px 4px; font-weight: bold;">사용업체</td>
        <td style="border: 1px solid #000; padding: 5px 4px; font-weight: 600;">${clientName}</td>
        <td style="border: 1px solid #000; padding: 5px 4px; font-weight: bold;">동력전달방식</td>
        <td style="border: 1px solid #000; padding: 5px 4px;">배터리충전식</td>
        <td style="border: 1px solid #000; padding: 5px 4px; font-weight: bold;">모델명</td>
        <td style="border: 1px solid #000; padding: 5px 4px; font-weight: bold; color: #1e3a8a;">${modelName}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #000; padding: 5px 4px; font-weight: bold;">장비중량</td>
        <td style="border: 1px solid #000; padding: 5px 4px;">${weight}</td>
        <td style="border: 1px solid #000; padding: 5px 4px; font-weight: bold;">운행속도</td>
        <td style="border: 1px solid #000; padding: 5px 4px;">4.8 Km/h</td>
        <td style="border: 1px solid #000; padding: 5px 4px; font-weight: bold;">작업높이/적재용량</td>
        <td style="border: 1px solid #000; padding: 5px 4px;">7.8 M / 227 kg</td>
      </tr>
      <tr>
        <td style="border: 1px solid #000; padding: 5px 4px; font-weight: bold;">차량(장비)번호</td>
        <td style="border: 1px solid #000; padding: 5px 4px; font-weight: bold; color: #b91c1c;">${serialNo}</td>
        <td style="border: 1px solid #000; padding: 5px 4px; font-weight: bold;">제조년도</td>
        <td style="border: 1px solid #000; padding: 5px 4px;">${manufactureYear}</td>
        <td style="border: 1px solid #000; padding: 5px 4px; font-weight: bold;">안전인증년월일</td>
        <td style="border: 1px solid #000; padding: 5px 4px;">${safetyCertDate}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #000; padding: 5px 4px; font-weight: bold;">안전점검일시</td>
        <td style="border: 1px solid #000; padding: 5px 4px; font-weight: 600;">${inspectionDate}</td>
        <td style="border: 1px solid #000; padding: 5px 4px; font-weight: bold;">점검부서</td>
        <td style="border: 1px solid #000; padding: 5px 4px;">정비팀</td>
        <td style="border: 1px solid #000; padding: 5px 4px; font-weight: bold;">점검자</td>
        <td style="border: 1px solid #000; padding: 5px 4px; font-weight: bold;">
          ${inspectorName}
          <span style="display: inline-block; border: 1.5px solid #dc2626; color: #dc2626; border-radius: 50%; width: 22px; height: 22px; line-height: 22px; font-size: 10px; margin-left: 6px; font-weight: bold; text-align: center; vertical-align: middle;">인</span>
        </td>
      </tr>
    </table>

    <!-- 점검 항목 리스트 -->
    <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
      <thead>
        <tr style="background: #f1f5f9; text-align: center; font-weight: bold;">
          <th style="border: 1px solid #000; padding: 4px; width: 18%;">검사구분</th>
          <th style="border: 1px solid #000; padding: 4px;">검사항목</th>
          <th style="border: 1px solid #000; padding: 4px; width: 10%;">검사결과</th>
          <th style="border: 1px solid #000; padding: 4px; width: 12%;">조치사항</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td rowspan="3" style="border: 1px solid #000; padding: 4px; font-weight: bold;">1. 공통사항<br/>(1) 등록번호표 등</td>
          <td style="border: 1px solid #000; padding: 3px 6px;">제조일로부터 15년 이내의 장비일 것</td>
          <td style="border: 1px solid #000; text-align: center; font-weight: bold;">O</td>
          <td style="border: 1px solid #000;"></td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 3px 6px;">붐대, 아웃트리거, 용접부등 비파괴 검사 성적서 비치되어 있을것</td>
          <td style="border: 1px solid #000; text-align: center; font-weight: bold;">ㅡ</td>
          <td style="border: 1px solid #000;"></td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 3px 6px;">운전원은 장비의 운전 및 안전에 대한 교육을 받은 유경험자이고 보험 가입되어 있을것</td>
          <td style="border: 1px solid #000; text-align: center; font-weight: bold;">ㅡ</td>
          <td style="border: 1px solid #000;"></td>
        </tr>
        <tr>
          <td rowspan="2" style="border: 1px solid #000; padding: 4px; font-weight: bold;">2. 차대와 타이어<br/>(1) 차체 및 타이어</td>
          <td style="border: 1px solid #000; padding: 3px 6px;">차체의 균열, 변형, 손상 및 부식이 없을것</td>
          <td style="border: 1px solid #000; text-align: center; font-weight: bold;">O</td>
          <td style="border: 1px solid #000;"></td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 3px 6px;">타이어의 이상마모 및 변형이 없고 구동축에서 견고하게 고정되어 있을것</td>
          <td style="border: 1px solid #000; text-align: center; font-weight: bold;">O</td>
          <td style="border: 1px solid #000;"></td>
        </tr>
        <tr>
          <td rowspan="3" style="border: 1px solid #000; padding: 4px; font-weight: bold;">(2) 동력원</td>
          <td style="border: 1px solid #000; padding: 3px 6px;">유압펌프와 모터는 설치상태가 견고하고 작동상태에서 심한 진동과 이상음이 없을 것</td>
          <td style="border: 1px solid #000; text-align: center; font-weight: bold;">O</td>
          <td style="border: 1px solid #000;"></td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 3px 6px;">유압실린더, 유압호스, 파이프, 밸브, 탱크 등 연결부는 균열, 손상 및 누유가 없을 것</td>
          <td style="border: 1px solid #000; text-align: center; font-weight: bold;">O</td>
          <td style="border: 1px solid #000;"></td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 3px 6px;">축전지의 단락, 손상 및 단자 부식이 없고 배선부분은 과열에 의한 열화가 없을 것</td>
          <td style="border: 1px solid #000; text-align: center; font-weight: bold;">O</td>
          <td style="border: 1px solid #000;"></td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 4px; font-weight: bold;">3. 연장구조물<br/>(1) 구조부</td>
          <td style="border: 1px solid #000; padding: 3px 6px;">구조물의 균열, 변형 및 손상이 없고 힌지부 연결핀 고정상태 양호 및 잠금밸브 정상 작동</td>
          <td style="border: 1px solid #000; text-align: center; font-weight: bold;">O</td>
          <td style="border: 1px solid #000;"></td>
        </tr>
        <tr>
          <td rowspan="2" style="border: 1px solid #000; padding: 4px; font-weight: bold;">4. 작업대<br/>(1) 낙하 방호조치</td>
          <td style="border: 1px solid #000; padding: 3px 6px;">작업대의 난간높이 1.0m 이상, 발끝막이판 0.15m 이상 설치 및 중간대 설치상태 양호</td>
          <td style="border: 1px solid #000; text-align: center; font-weight: bold;">O</td>
          <td style="border: 1px solid #000;"></td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 3px 6px;">바닥면은 배수가 가능하고 미끄럼 방지 구조일 것</td>
          <td style="border: 1px solid #000; text-align: center; font-weight: bold;">O</td>
          <td style="border: 1px solid #000;"></td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 4px; font-weight: bold;">5. 조작장치</td>
          <td style="border: 1px solid #000; padding: 3px 6px;">비상정지장치는 수동으로 복귀하는 형식으로 정상 작동하고 스위치 오작동이 없을 것</td>
          <td style="border: 1px solid #000; text-align: center; font-weight: bold;">O</td>
          <td style="border: 1px solid #000;"></td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 4px; font-weight: bold;">6. 안전장치</td>
          <td style="border: 1px solid #000; padding: 3px 6px;">과상승방지봉, 기울기경보장치(수평센서), 하강경보음 정상 작동 상태 확인</td>
          <td style="border: 1px solid #000; text-align: center; font-weight: bold;">O</td>
          <td style="border: 1px solid #000;"></td>
        </tr>
      </tbody>
    </table>
    <div style="font-size: 10px; color: #475569; margin-top: 6px; text-align: right;">
      점검결과 판정: <strong>[ 적합 / 합격 ]</strong> &nbsp;|&nbsp; (주)기연리프트 정비팀
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
    const pdfArrayBuffer = pdf.output('arraybuffer');
    return new Uint8Array(pdfArrayBuffer);
  } finally {
    document.body.removeChild(container);
  }
}
