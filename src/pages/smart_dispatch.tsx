// src/pages/smart_dispatch.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Zap, Clipboard, FileText, Copy, Printer, Braces, Plus, Trash2, RefreshCw } from 'lucide-react';

interface EquipmentItem {
  modelName: string;
  qty: number;
}

interface SpecItem {
  id: string;
  label: string;
  keywords: string[];
}

// 고소작업대 필수 기술 요구사항 표준 체크리스트 정의
const STANDARD_SPECS: SpecItem[] = [
  { id: 'spec1', label: '4면 철망 설치', keywords: ['4면 철망', '사면철망', '철망'] },
  { id: 'spec2', label: '확장대 철망 설치', keywords: ['확장대 철망', '확장대철망'] },
  { id: 'spec3', label: '확장대 옆면 철망 설치', keywords: ['확장대 옆면 철망', '옆면 철망'] },
  { id: 'spec4', label: '원판 설치', keywords: ['원판설치', '원판'] },
  { id: 'spec5', label: '배터리 단자 풀림 확인 마킹', keywords: ['배터리 단자 풀림', '단자 풀림 확인 마킹', '배터리 단자 풀림 확인 마킹', '단자 풀림'] },
  { id: 'spec6', label: '배터리 단자 커버 설치', keywords: ['배터리 단자 커버', '커버설치', '단자 커버'] },
  { id: 'spec7', label: '트레이 내부 볼트류 풀림 확인 마킹', keywords: ['트레이 내부 볼트', '볼트류 풀림 확인마킹', '트레이 내부 볼트류 풀림'] },
  { id: 'spec8', label: '주행속도 세팅 (고속 60 / 저속 45)', keywords: ['주행속도', '고속 60', '저속 45', '주행속도 고속'] },
  { id: 'spec9', label: '오버로드 세팅', keywords: ['오버로드 셋팅', '오버로드', '오버로드 세팅'] },
  { id: 'spec10', label: '조이스틱 커버 연장', keywords: ['조이스틱 커버', '커버 연장', '조이스틱 커버 연장'] },
  { id: 'spec11', label: '탑승구 사다리 보양', keywords: ['탑승구 사다리', '사다리 보양', '탑승구 사다리 보양'] },
  { id: 'spec12', label: '모서리/전면부/미끄럼방지 보양', keywords: ['미끄럼방지', '모서리 8개소', '전면부 2개소', '모서리보양', '모서리 8면'] },
  { id: 'spec13', label: '소화기함/손잡이 설치 및 안내스티커 부착', keywords: ['소화기함', '기타 스티커물', '탑승구 손잡이', '작동설명'] },
  { id: 'spec14', label: '타이어 A급 장착', keywords: ['타이어 A급', '타이어A급'] },
  { id: 'spec15', label: '점멸등, 비상하강장치, 비상정지장치 청결', keywords: ['점멸등', '비상하강장치', '비상정지장치', '비상하강장치 청결'] },
  { id: 'spec16', label: '작업높이 80% 세팅', keywords: ['작업높이 80프로', '발판높이기준', '작업높이 80%', '작업높이 80'] },
  { id: 'spec17', label: '작업구간 색상 라인구분 (초록/빨강)', keywords: ['라인구분', '초록, 빨강', '라인 구분'] },
  { id: 'spec18', label: '하부상승제한, 확장대 50% 표식 부착', keywords: ['하부상승제한', '확장대 50%', '50%지점 표식'] },
  { id: 'spec19', label: '비상정지스위치 및 비상하강꼬리표 부착', keywords: ['비상정지스위치', '비상하강꼬리표', '비상정지스위치 부착'] },
  { id: 'spec20', label: '시저구간 협착위험 스티커 부착', keywords: ['협착위험 스티커', '시저구간', '접촉금지', '시저구간 접촉금지'] },
  { id: 'spec21', label: '부착물 세트 (제원표, 비상하강법, 보험증권, 인증서)', keywords: ['부착물', '제원표', '비상하강사용법', '보험증권', '인증서'] }
];

export const SmartDispatch: React.FC = () => {
  const { hasPermission, saveSmartDispatch, assets, products, showErrorModal } = useApp();
  const canSave = hasPermission('delivery', 'save');

  // 실시간 프로세스 진행 릴레이 모달 상태
  const [isProcessingModalOpen, setIsProcessingModalOpen] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentStepText, setCurrentStepText] = useState('');
  const [progressLogs, setProgressLogs] = useState<string[]>([]);
  const [isProcessCompleted, setIsProcessCompleted] = useState(false);

  // 원본 텍스트 입력 상태 (초기값 빈 문자열)
  const [rawText, setRawText] = useState<string>('');
  const txtFileInputRef = useRef<HTMLInputElement>(null);

  // 텍스트 파일 불러오기 핸들러
  const handleTextFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text !== undefined && text !== null) {
        setRawText(text);
        alert(`📂 파일 "${file.name}"의 텍스트 내용을 입력창에 불러왔습니다.`);
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  // 구조화된 폼 데이터 상태
  const [customerName, setCustomerName] = useState('');
  const [siteName, setSiteName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');

  const [siteContactName, setSiteContactName] = useState('');
  const [siteContactPhone, setSiteContactPhone] = useState('');
  const [siteContactEmail, setSiteContactEmail] = useState('');

  const [billingContactName, setBillingContactName] = useState('');
  const [billingContactPhone, setBillingContactPhone] = useState('');
  const [statementEmail, setStatementEmail] = useState('');
  const [taxBillEmail, setTaxBillEmail] = useState('');

  const [loadingTime, setLoadingTime] = useState('');
  const [unloadingTime, setUnloadingTime] = useState('');
  const [equipments, setEquipments] = useState<EquipmentItem[]>([{ modelName: '', qty: 1 }]);

  const [paidOptions, setPaidOptions] = useState('');
  const [protection, setProtection] = useState('');

  // 요구사항 필수 체크리스트 선택/해제 상태 (Record<specId, boolean>)
  const [checkedSpecs, setCheckedSpecs] = useState<Record<string, boolean>>({});

  const [closingDay, setClosingDay] = useState('');
  const [paymentDay, setPaymentDay] = useState('');
  const [note, setNote] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // 유니크 모델명 목록 추출
  const uniqueModels = Array.from(new Set(assets.map(a => a.modelName).filter(Boolean))).sort();

  // 프리뷰 탭 관리
  const [previewTab, setPreviewTab] = useState<'SHEET' | 'TEXT' | 'JSON'>('SHEET');

  // 규칙 기반 지능형 텍스트 파서 함수 (AI-less)
  const handleParse = () => {
    if (!rawText.trim()) {
      alert('파싱할 텍스트를 입력해 주세요.');
      return;
    }

    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    let parsedCustomer = '';
    let parsedSite = '';
    let parsedAddress = '';
    let parsedSiteContactName = '';
    let parsedSiteContactPhone = '';
    let parsedSiteContactEmail = '';
    let parsedBillingContactName = '';
    let parsedBillingContactPhone = '';
    let parsedStatementEmail = '';
    let parsedTaxBillEmail = '';
    let parsedLoading = '';
    let parsedUnloading = '';
    let parsedEquipments: EquipmentItem[] = [];
    let parsedPaidOptions = '';
    let parsedProtection = '';
    let parsedClosing = '';
    let parsedPayment = '';
    let parsedNote = '';

    // 이메일 추출 Helper (공백 제거 후 / 구분자로 조인)
    const extractEmails = (str: string): string => {
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const matches = str.match(emailRegex);
      if (!matches) return '';
      return matches.map(e => e.replace(/\s+/g, '')).join('/');
    };

    // 전화번호 추출 Helper (공백 제거)
    const extractPhone = (str: string): string => {
      const phoneRegex = /(01[016789]\s*[-~]?\s*\d{3,4}\s*[-~]?\s*\d{4})/g;
      const matches = str.match(phoneRegex);
      return matches ? matches[0].replace(/\s+/g, '') : '';
    };

    // 이름 추출 Helper (전화번호나 이메일 앞부분)
    const extractName = (str: string): string => {
      let namePart = str.split(/01[016789]/)[0] || str;
      namePart = namePart.split(/[a-zA-Z0-9._%+-]+@/)[0] || namePart;
      return namePart.replace(/[:\-]/g, '').replace(/선임|책임|담당자/g, '').trim();
    };

    lines.forEach(line => {
      if (line.includes('고객명')) {
        parsedCustomer = line.split(':')[1]?.trim() || '';
      } else if (line.includes('현장명')) {
        parsedSite = line.split(':')[1]?.trim() || '';
      } else if (line.includes('현장 상세 주소') || line.includes('현장상세주소')) {
        parsedAddress = line.split(':')[1]?.trim() || '';
      } else if (line.includes('현장담당자') || line.includes('현장 담당자')) {
        const val = line.split(':')[1] || '';
        parsedSiteContactName = extractName(val);
        parsedSiteContactPhone = extractPhone(val);
      } else if (line.includes('담당자 메일') || line.includes('담당자메일')) {
        const val = line.split(':')[1] || '';
        parsedSiteContactEmail = extractEmails(val);
      } else if (line.includes('강경현책임') || line.includes('강경현 책임')) {
        const val = line.split(':')[1] || '';
        const email = extractEmails(val);
        if (email) {
          parsedSiteContactEmail = parsedSiteContactEmail ? `${parsedSiteContactEmail}/${email}` : email;
        }
      } else if (line.includes('상차시간') || line.includes('상차 시간')) {
        parsedLoading = line.split(':')[1]?.trim() || '';
      } else if (line.includes('하차시간') || line.includes('하차 시간')) {
        parsedUnloading = line.split(':')[1]?.trim() || '';
      } else if (line.includes('모델명') || line.includes('장비명')) {
        const val = line.split(':')[1] || '';
        const parts = val.split('/');
        parts.forEach(p => {
          const match = p.match(/(.+?)\s*[*xX]\s*(\d+)/);
          if (match) {
            parsedEquipments.push({
              modelName: match[1].trim(),
              qty: parseInt(match[2]) || 1
            });
          } else {
            if (p.trim()) {
              parsedEquipments.push({
                modelName: p.trim(),
                qty: 1
              });
            }
          }
        });
      } else if (line.includes('유상옵션') || line.includes('유상 옵션')) {
        parsedPaidOptions = line.split(':')[1]?.trim() || '';
      } else if (line.includes('보양')) {
        parsedProtection = line.split(':')[1]?.trim() || '';
      } else if (line.includes('청구담당자') || line.includes('청구 담당자')) {
        const val = line.split(':')[1] || '';
        parsedBillingContactName = extractName(val);
        parsedBillingContactPhone = extractPhone(val);
      } else if (line.includes('거래명세서')) {
        const val = line.split(':')[1] || '';
        parsedStatementEmail = extractEmails(val);
      } else if (line.includes('계산서메일') || line.includes('계산서 메일')) {
        const val = line.split(':')[1]?.trim() || '';
        const email = extractEmails(val);
        parsedTaxBillEmail = email || val;
      } else if (line.includes('마감일')) {
        parsedClosing = line.split(':')[1]?.trim() || '';
      } else if (line.includes('결제일')) {
        parsedPayment = line.split(':')[1]?.trim() || '';
      } else if (line.includes('특이사항')) {
        parsedNote = line.split(':')[1]?.trim() || '';
      }
    });

    // 21가지 표준 스펙 체크 박스 상태 추출 매칭 논리 (공백 제거 후 키워드 탐색)
    const cleanedRawText = rawText.replace(/\s+/g, '');
    const newCheckedSpecs: Record<string, boolean> = {};
    STANDARD_SPECS.forEach(spec => {
      const matched = spec.keywords.some(kw => cleanedRawText.includes(kw.replace(/\s+/g, '')));
      newCheckedSpecs[spec.id] = matched;
    });

    // 상태 업데이트
    setCustomerName(parsedCustomer);
    setSiteName(parsedSite);
    setSiteAddress(parsedAddress);
    setSiteContactName(parsedSiteContactName);
    setSiteContactPhone(parsedSiteContactPhone);
    setSiteContactEmail(parsedSiteContactEmail);
    setBillingContactName(parsedBillingContactName);
    setBillingContactPhone(parsedBillingContactPhone);
    setStatementEmail(parsedStatementEmail);
    setTaxBillEmail(parsedTaxBillEmail);
    setLoadingTime(parsedLoading);
    setUnloadingTime(parsedUnloading);
    setEquipments(parsedEquipments.length > 0 ? parsedEquipments : [{ modelName: '', qty: 1 }]);
    setPaidOptions(parsedPaidOptions);
    setProtection(parsedProtection);
    setCheckedSpecs(newCheckedSpecs);
    setClosingDay(parsedClosing);
    setPaymentDay(parsedPayment);
    setNote(parsedNote);

    alert('정규식 룰 파서가 분석을 완료하여, 폼 필드 대입 및 21대 요구사항 체크박스를 자동 체크 처리했습니다. (비용 0원)');
  };

  // 장비 모델 행 동적 관리
  const handleAddEquipment = () => {
    setEquipments([...equipments, { modelName: '', qty: 1 }]);
  };

  const handleRemoveEquipment = (index: number) => {
    if (equipments.length <= 1) return;
    setEquipments(equipments.filter((_, i) => i !== index));
  };

  const handleEquipmentChange = (index: number, field: keyof EquipmentItem, value: any) => {
    const updated = [...equipments];
    updated[index] = { ...updated[index], [field]: value };
    setEquipments(updated);
  };

  // 체크박스 토글
  const handleToggleSpec = (id: string) => {
    setCheckedSpecs(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // 체크박스 일괄 설정
  const handleSetAllSpecs = (status: boolean) => {
    const updated: Record<string, boolean> = {};
    STANDARD_SPECS.forEach(spec => {
      updated[spec.id] = status;
    });
    setCheckedSpecs(updated);
  };

  // 실시간 정형 텍스트 생성 (적용된 스펙 요구사항 필터링 표시)
  const generateFormattedText = () => {
    const activeSpecs = STANDARD_SPECS.filter(s => checkedSpecs[s.id]);
    return (
`* 기연리프트 출고 요청서 *

■ 기본 정보
- 고객명 : ${customerName || '-'}
- 현장명 : ${siteName || '-'}
- 현장 상세 주소 : ${siteAddress || '-'}

■ 담당자 정보
- 현장담당자 : ${siteContactName || '-'} (연락처: ${siteContactPhone || '-'} / 메일: ${siteContactEmail || '-'})
- 청구담당자 : ${billingContactName || '-'} (연락처: ${billingContactPhone || '-'})
- 거래명세서 메일 : ${statementEmail || '-'}
- 계산서 메일 : ${taxBillEmail || '-'}

■ 배송 및 장비 상세
- 상차스케줄 : ${loadingTime || '-'}
- 하차스케줄 : ${unloadingTime || '-'}
- 임대 장비 : ${equipments.map(e => `${e.modelName || '미지정'} * ${e.qty}대`).join(' / ')}

■ 옵션 및 보양 스펙
- 유상옵션 : ${paidOptions || '없음'}
- 보양작업 : ${protection || '없음'}
- 필수 요구사항 (적용 항목) :
${activeSpecs.map((s, idx) => `  ${idx + 1}. [적용] ${s.label}`).join('\n') || '  - 특이 적용 사양 없음'}

■ 회계 정산 정보
- 마감일 : ${closingDay || '-'}
- 결제일 : ${paymentDay || '-'}
- 특이사항 : ${note || '없음'}`
    );
  };

  // 실시간 JSON 생성 (전체 체크박스 맵과 적용 배열 동시 출력)
  const generateJSON = () => {
    const activeSpecLabels = STANDARD_SPECS.filter(s => checkedSpecs[s.id]).map(s => s.label);
    return JSON.stringify({
      customerInfo: {
        customerName,
        siteName,
        siteAddress
      },
      contacts: {
        siteManager: {
          name: siteContactName,
          phone: siteContactPhone,
          emails: siteContactEmail ? siteContactEmail.split('/') : []
        },
        billingManager: {
          name: billingContactName,
          phone: billingContactPhone
        },
        receivers: {
          statementEmail: statementEmail ? statementEmail.split('/') : [],
          taxBillEmail: taxBillEmail
        }
      },
      logistics: {
        loadingTime,
        unloadingTime,
        equipments
      },
      options: {
        paidOptions,
        protection,
        technicalSpecsMap: checkedSpecs,
        activeTechnicalSpecs: activeSpecLabels
      },
      accounting: {
        closingDay,
        paymentDay,
        note
      },
      meta: {
        parserType: "Deterministic Rule-based RegExp",
        parsedAt: new Date().toISOString()
      }
    }, null, 2);
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('클립보드에 복사되었습니다.');
  };

  const handlePrint = () => {
    const printContent = document.getElementById('dispatch-sheet-print');
    if (!printContent) return;
    const windowUrl = 'about:blank';
    const uniqueName = new Date().getTime();
    const windowName = 'Print' + uniqueName;
    const printWindow = window.open(windowUrl, windowName, 'left=100,top=100,width=800,height=900');
    
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>기연리프트 출고요청서 - ${customerName}</title>
            <style>
              body { font-family: 'Malgun Gothic', sans-serif; padding: 20px; color: #333; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; }
              th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 13px; }
              th { background-color: #f5f5f5; font-weight: bold; width: 130px; }
              .header { text-align: center; margin-bottom: 30px; }
              .header h1 { margin: 0; font-size: 24px; font-weight: 800; color: #1e1b4b; border-bottom: 2px solid #1e1b4b; padding-bottom: 10px; }
              .section-title { font-size: 15px; font-weight: bold; margin-top: 20px; margin-bottom: 8px; color: #312e81; border-left: 4px solid #312e81; padding-left: 8px; }
              .spec-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; margin-top: 5px; }
              .spec-item { display: flex; align-items: center; gap: 6px; }
              .checked { font-weight: bold; color: #059669; }
              .unchecked { color: #9ca3af; text-decoration: line-through; }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
            <script>
              window.onload = function() {
                window.print();
                window.close();
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  // 컴포넌트 마운트 시 자동 예제 파싱 실행
  useEffect(() => {
    if (rawText) {
      const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      let parsedCustomer = '';
      let parsedSite = '';
      let parsedAddress = '';
      let parsedSiteContactName = '';
      let parsedSiteContactPhone = '';
      let parsedSiteContactEmail = '';
      let parsedBillingContactName = '';
      let parsedBillingContactPhone = '';
      let parsedStatementEmail = '';
      let parsedTaxBillEmail = '';
      let parsedLoading = '';
      let parsedUnloading = '';
      let parsedEquipments: EquipmentItem[] = [];
      let parsedPaidOptions = '';
      let parsedProtection = '';
      let parsedClosing = '';
      let parsedPayment = '';
      let parsedNote = '';

      const extractEmails = (str: string): string => {
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const matches = str.match(emailRegex);
        if (!matches) return '';
        return matches.map(e => e.replace(/\s+/g, '')).join('/');
      };

      const extractPhone = (str: string): string => {
        const phoneRegex = /(01[016789]\s*[-~]?\s*\d{3,4}\s*[-~]?\s*\d{4})/g;
        const matches = str.match(phoneRegex);
        return matches ? matches[0].replace(/\s+/g, '') : '';
      };

      const extractName = (str: string): string => {
        let namePart = str.split(/01[016789]/)[0] || str;
        namePart = namePart.split(/[a-zA-Z0-9._%+-]+@/)[0] || namePart;
        return namePart.replace(/[:\-]/g, '').replace(/선임|책임|담당자/g, '').trim();
      };

      lines.forEach(line => {
        if (line.includes('고객명')) parsedCustomer = line.split(':')[1]?.trim() || '';
        else if (line.includes('현장명')) parsedSite = line.split(':')[1]?.trim() || '';
        else if (line.includes('현장 상세 주소') || line.includes('현장상세주소')) parsedAddress = line.split(':')[1]?.trim() || '';
        else if (line.includes('현장담당자') || line.includes('현장 담당자')) {
          const val = line.split(':')[1] || '';
          parsedSiteContactName = extractName(val);
          parsedSiteContactPhone = extractPhone(val);
        } else if (line.includes('담당자 메일') || line.includes('담당자메일')) {
          const val = line.split(':')[1] || '';
          parsedSiteContactEmail = extractEmails(val);
        } else if (line.includes('강경현책임') || line.includes('강경현 책임')) {
          const val = line.split(':')[1] || '';
          const email = extractEmails(val);
          if (email) parsedSiteContactEmail = parsedSiteContactEmail ? `${parsedSiteContactEmail}/${email}` : email;
        } else if (line.includes('상차시간') || line.includes('상차 시간')) parsedLoading = line.split(':')[1]?.trim() || '';
        else if (line.includes('하차시간') || line.includes('하차 시간')) parsedUnloading = line.split(':')[1]?.trim() || '';
        else if (line.includes('모델명') || line.includes('장비명')) {
          const val = line.split(':')[1] || '';
          val.split('/').forEach(p => {
            const match = p.match(/(.+?)\s*[*xX]\s*(\d+)/);
            if (match) parsedEquipments.push({ modelName: match[1].trim(), qty: parseInt(match[2]) || 1 });
            else if (p.trim()) parsedEquipments.push({ modelName: p.trim(), qty: 1 });
          });
        } else if (line.includes('유상옵션') || line.includes('유상 옵션')) parsedPaidOptions = line.split(':')[1]?.trim() || '';
        else if (line.includes('보양')) parsedProtection = line.split(':')[1]?.trim() || '';
        else if (line.includes('청구담당자') || line.includes('청구 담당자')) {
          const val = line.split(':')[1] || '';
          parsedBillingContactName = extractName(val);
          parsedBillingContactPhone = extractPhone(val);
        } else if (line.includes('거래명세서')) {
          const val = line.split(':')[1] || '';
          parsedStatementEmail = extractEmails(val);
        } else if (line.includes('계산서메일') || line.includes('계산서 메일')) {
          const val = line.split(':')[1]?.trim() || '';
          parsedTaxBillEmail = extractEmails(val) || val;
        } else if (line.includes('마감일')) parsedClosing = line.split(':')[1]?.trim() || '';
        else if (line.includes('결제일')) parsedPayment = line.split(':')[1]?.trim() || '';
        else if (line.includes('특이사항')) parsedNote = line.split(':')[1]?.trim() || '';
      });

      const cleanedRawText = rawText.replace(/\s+/g, '');
      const newCheckedSpecs: Record<string, boolean> = {};
      STANDARD_SPECS.forEach(spec => {
        newCheckedSpecs[spec.id] = spec.keywords.some(kw => cleanedRawText.includes(kw.replace(/\s+/g, '')));
      });

      setCustomerName(parsedCustomer);
      setSiteName(parsedSite);
      setSiteAddress(parsedAddress);
      setSiteContactName(parsedSiteContactName);
      setSiteContactPhone(parsedSiteContactPhone);
      setSiteContactEmail(parsedSiteContactEmail);
      setBillingContactName(parsedBillingContactName);
      setBillingContactPhone(parsedBillingContactPhone);
      setStatementEmail(parsedStatementEmail);
      setTaxBillEmail(parsedTaxBillEmail);
      setLoadingTime(parsedLoading);
      setUnloadingTime(parsedUnloading);
      setEquipments(parsedEquipments.length > 0 ? parsedEquipments : [{ modelName: '', qty: 1 }]);
      setPaidOptions(parsedPaidOptions);
      setProtection(parsedProtection);
      setCheckedSpecs(newCheckedSpecs);
      setClosingDay(parsedClosing);
      setPaymentDay(parsedPayment);
      setNote(parsedNote);
    }
  }, []);

  const findSuggestedModel = (inputModel: string, officialModels: string[]): string | null => {
    if (!inputModel || !inputModel.trim()) return null;
    const cleanedInput = inputModel.replace(/[\s\-_]/g, '').toLowerCase();

    // 1. 공백/특수문자 제거 후 부분 문자열 매칭
    let matched = officialModels.find(m => {
      const cleanedM = m.replace(/[\s\-_]/g, '').toLowerCase();
      return cleanedM.includes(cleanedInput) || cleanedInput.includes(cleanedM);
    });
    if (matched) return matched;

    // 2. 3~4자리 연속 숫자 패턴 매칭 (예: "1212", "1930", "2646", "3219" 등)
    const nums = inputModel.match(/\d{3,4}/);
    if (nums) {
      const targetNum = nums[0];
      matched = officialModels.find(m => m.includes(targetNum));
      if (matched) return matched;
    }

    return null;
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (isSubmitting) return;

    if (!canSave) {
      alert('저장 권한이 없습니다.');
      return;
    }
    if (!customerName || !siteName) {
      alert('파싱된 결과에 고객사명과 현장명이 없습니다.');
      return;
    }

    setIsSubmitting(true);
    try {

    // 🔍 장비 모델명 정식 검증 & 인터랙티브 변경 승인 팝업
    const officialModels: string[] = uniqueModels.length > 0 ? uniqueModels : products.map((p: any) => p.modelName);
    const updatedEquipments = [...equipments];
    for (let i = 0; i < updatedEquipments.length; i++) {
      const eq = updatedEquipments[i];
      const inputModel = eq.modelName?.trim();
      if (!inputModel) continue;

      const isExactOfficial = officialModels.some(m => m === inputModel);
      if (!isExactOfficial) {
        const suggestedModel = findSuggestedModel(inputModel, officialModels);
        if (suggestedModel) {
          const confirmChange = confirm(
            `💡 [장비 모델명 검증 안내]\n\n입력하신 모델명 '${inputModel}'은(는) 자산 마스터의 정식 모델명이 아닙니다.\n\n시스템 등록 정식 모델명인 '${suggestedModel}'(으)로 변경하여 저장하시겠습니까?\n\n[확인]: 정식 모델명(${suggestedModel})으로 변경 후 저장 진행\n[취소]: 저장 중단 및 폼 재수정`
          );
          if (confirmChange) {
            updatedEquipments[i].modelName = suggestedModel;
            setEquipments(updatedEquipments);
          } else {
            return; // 저장 중단
          }
        } else {
          alert(`⚠️ 입력하신 모델명 '${inputModel}'은(는) 시스템에 등록된 자산 모델이 아닙니다.\n\n정확한 정식 모델명을 선택하거나 등록 후 다시 시도해주세요.`);
          return; // 저장 중단
        }
      }
    }

    const data = {
      customerName, siteName, siteAddress, siteContactName, siteContactPhone, siteContactEmail,
      billingContactName, billingContactPhone, statementEmail, taxBillEmail,
      loadingTime, unloadingTime, equipments: updatedEquipments, note
    };

    // 프로세스 진행 모달 초기화
    setProgressLogs([]);
    setProgressPercent(0);
    setCurrentStepText('🚀 스마트 출고 파이프라인 가동 준비 중...');
    setIsProcessCompleted(false);
    setIsProcessingModalOpen(true);

    const onProgress = (logText: string, pct: number) => {
      setProgressPercent(pct);
      setCurrentStepText(logText);
      setProgressLogs(prev => [...prev, logText]);
    };

    let result = await saveSmartDispatch(data, false, onProgress);

    if (result.requiresConfirm) {
      setIsProcessingModalOpen(false);
      if (confirm(`다음 정보가 데이터베이스에 없습니다.\n${result.missingFields?.join('\n')}\n\n※안내: 배차(물류 배송) 지시와 장비 할당(고유 장비 매핑)은 별개의 권한으로 독립적으로 작동합니다.\n\n신규로 자동 등록하고 출고 지시를 저장하시겠습니까?`)) {
        setProgressLogs([]);
        setProgressPercent(0);
        setCurrentStepText('🚀 신규 고객/현장 등록 & 출고 프로세스 재가동 중...');
        setIsProcessCompleted(false);
        setIsProcessingModalOpen(true);

        result = await saveSmartDispatch(data, true, onProgress);
      } else {
        return;
      }
    }

    if (result.errorMessage) {
      setIsProcessingModalOpen(false);
      showErrorModal(result.errorMessage, '스마트 출고 요청 저장 오류');
      return;
    }

    if (result.success) {
      setIsProcessCompleted(true);
      setRawText('');
    }
    } catch (err: any) {
      console.error('handleSave error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
      
      {/* 타이틀 및 가이드 배너 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontWeight: '700', marginBottom: '4px' }}>스마트 출고 요청 입력 (디지털 파서)</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>카카오톡/메신저로 전송받은 비정형 출고 의뢰 텍스트를 AI 없이 브라우저 단독 정규식으로 안전하게 분할 분석합니다.</p>
            <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
              <Zap size={12} /> AI-less Deterministic Parser
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>
        
        {/* 1단계: 레거시 통텍스트 입력 및 스마트 변환 */}
        <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '62px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
              <Clipboard size={16} className="text-primary" /> 1단계: 메신저 줄글 텍스트 복사/붙여넣기
            </h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="file"
                ref={txtFileInputRef}
                style={{ display: 'none' }}
                accept=".txt,.log,.csv"
                onChange={handleTextFileChange}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => txtFileInputRef.current?.click()}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', fontSize: '12.5px' }}
              >
                📂 텍스트 파일 불러오기
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleParse}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', fontSize: '13px', fontWeight: 'bold' }}
              >
                <Zap size={14} /> 스마트 폼 데이터로 즉시 변환 (추출)
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '12px' }}>
            <textarea
              style={{ flex: 1, minHeight: '380px', fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.6', padding: '12px', resize: 'vertical' }}
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder="여기에 메신저로 복사한 출고 줄글 텍스트를 그대로 붙여넣으세요..."
            />
          </div>
        </div>

        {/* 2단계: 구조화 개별 입력 및 편집 폼 */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '62px' }}>
            <h3 className="card-title" style={{ margin: 0 }}>2단계: 개별 세부 정보 확인 및 보정 폼</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn-secondary" onClick={() => setRawText('')} style={{ padding: '6px 12px', fontSize: '13px' }}>
                초기화
              </button>
              {canSave && (
                <button type="button" className="btn-primary" onClick={handleSave} style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 'bold' }}>
                  출고 지시 (자동 생성 및 저장)
                </button>
              )}
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            
            {/* 섹션 1: 기본 정보 */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                1. 기본 고객 및 현장 정보
              </h4>
              <div className="mobile-grid-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>고객사명</label>
                  <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                </div>
                <div>
                  <label>현장명</label>
                  <input type="text" value={siteName} onChange={e => setSiteName(e.target.value)} />
                </div>
              </div>
              <div style={{ marginTop: '10px' }}>
                <label>현장 상세 주소</label>
                <input type="text" value={siteAddress} onChange={e => setSiteAddress(e.target.value)} />
              </div>
            </div>

            {/* 섹션 2: 담당자 상세망 */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                2. 현장 및 회계 청구 담당자 정보
              </h4>
              <div className="mobile-grid-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <div>
                  <label>현장담당자 이름</label>
                  <input type="text" value={siteContactName} onChange={e => setSiteContactName(e.target.value)} />
                </div>
                <div>
                  <label>현장담당자 연락처</label>
                  <input type="text" value={siteContactPhone} onChange={e => setSiteContactPhone(e.target.value)} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>현장담당자 이메일 (다중 수신자 `/` 구분)</label>
                  <input type="text" value={siteContactEmail} onChange={e => setSiteContactEmail(e.target.value.replace(/\s+/g, ''))} placeholder="이메일1@test.com/이메일2@test.com" />
                </div>
                <div>
                  <label>청구담당자 이름</label>
                  <input type="text" value={billingContactName} onChange={e => setBillingContactName(e.target.value)} />
                </div>
                <div>
                  <label>청구담당자 연락처</label>
                  <input type="text" value={billingContactPhone} onChange={e => setBillingContactPhone(e.target.value)} />
                </div>
                <div>
                  <label>거래명세서 수신 메일</label>
                  <input type="text" value={statementEmail} onChange={e => setStatementEmail(e.target.value.replace(/\s+/g, ''))} />
                </div>
                <div>
                  <label>계산서 메일 (역발행 여부 등)</label>
                  <input type="text" value={taxBillEmail} onChange={e => setTaxBillEmail(e.target.value)} />
                </div>
              </div>
            </div>

            {/* 섹션 3: 배송 스케줄 및 모델 */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                3. 배송 배차 일정 및 신청 장비 모델
              </h4>
              <div className="mobile-grid-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                <div>
                  <label>상차 스케줄</label>
                  <input type="text" value={loadingTime} onChange={e => setLoadingTime(e.target.value)} placeholder="예: 07.18(토) 오전 8시 상차" />
                </div>
                <div>
                  <label>하차 스케줄</label>
                  <input type="text" value={unloadingTime} onChange={e => setUnloadingTime(e.target.value)} placeholder="예: 07.18(토) 오전 하차" />
                </div>
              </div>

              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span>신청 고소작업대 모델 목록</span>
                  <button type="button" className="btn-secondary" onClick={handleAddEquipment} style={{ padding: '2px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <Plus size={12} /> 모델 추가
                  </button>
                </label>
                
                {equipments.map((eq, index) => (
                  <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                    <input
                      type="text"
                      list="unique-models"
                      placeholder="모델 선택 또는 직접 입력 (예: GS3246)"
                      value={eq.modelName}
                      onChange={e => handleEquipmentChange(index, 'modelName', e.target.value)}
                      style={{ flex: 2 }}
                    />
                    <input
                      type="number"
                      placeholder="수량"
                      value={eq.qty}
                      onChange={e => handleEquipmentChange(index, 'qty', parseInt(e.target.value) || 1)}
                      style={{ flex: 1 }}
                      min={1}
                    />
                    {equipments.length > 1 && (
                      <button type="button" className="btn-danger" onClick={() => handleRemoveEquipment(index)} style={{ padding: '6px' }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                
                {/* 콤보박스 자동완성(Datalist) 데이터 */}
                <datalist id="unique-models">
                  {uniqueModels.map(model => (
                    <option key={model} value={model} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* 섹션 4: 필수 기술 요구사항 체크리스트 (핵심 요구사항 반영) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)', margin: 0 }}>
                  4. 필수 요구사항 체크리스트 (선택 적용)
                </h4>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button type="button" className="btn-secondary" onClick={() => handleSetAllSpecs(true)} style={{ padding: '2px 6px', fontSize: '11px' }}>전체선택</button>
                  <button type="button" className="btn-secondary" onClick={() => handleSetAllSpecs(false)} style={{ padding: '2px 6px', fontSize: '11px' }}>전체해제</button>
                </div>
              </div>

              <div className="mobile-grid-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label>유상 옵션 내역</label>
                  <input type="text" value={paidOptions} onChange={e => setPaidOptions(e.target.value)} />
                </div>
                <div>
                  <label>보양작업 조건</label>
                  <input type="text" value={protection} onChange={e => setProtection(e.target.value)} />
                </div>
              </div>

              {/* 21가지 표준 스펙 체크박스 선택 제어부 */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
                gap: '8px', 
                padding: '12px', 
                maxHeight: '300px', 
                overflowY: 'auto', 
                border: '1px solid var(--border-color)', 
                borderRadius: '6px', 
                backgroundColor: 'var(--bg-app)' 
              }}>
                {STANDARD_SPECS.map(spec => {
                  const isChecked = !!checkedSpecs[spec.id];
                  return (
                    <label 
                      key={spec.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        padding: '6px 8px', 
                        borderRadius: '4px', 
                        cursor: 'pointer',
                        fontSize: '12px',
                        backgroundColor: isChecked ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                        border: `1px solid ${isChecked ? 'var(--success)' : 'transparent'}`,
                        transition: 'all 0.2s'
                      }}
                    >
                      <input 
                        type="checkbox" 
                        checked={isChecked} 
                        onChange={() => handleToggleSpec(spec.id)} 
                        style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                      />
                      <span style={{ 
                        color: isChecked ? 'var(--success)' : 'var(--text-secondary)',
                        fontWeight: isChecked ? '600' : 'normal' 
                      }}>
                        {spec.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 섹션 5: 회계 정산 */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                5. 정산 회계 및 특이사항
              </h4>
              <div className="mobile-grid-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>매달 청구 마감일</label>
                  <input type="text" value={closingDay} onChange={e => setClosingDay(e.target.value)} placeholder="예: 20일" />
                </div>
                <div>
                  <label>결제 예정일</label>
                  <input type="text" value={paymentDay} onChange={e => setPaymentDay(e.target.value)} placeholder="예: 익월 말일" />
                </div>
              </div>
              <div style={{ marginTop: '10px' }}>
                <label>특이사항 / 메모</label>
                <input type="text" value={note} onChange={e => setNote(e.target.value)} />
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* 3단계: 실시간 프리뷰 영역 */}
      <div className="card" style={{ marginTop: '10px' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '62px' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
            <FileText size={16} className="text-success" /> 3단계: 실시간 프리뷰 및 출력
          </h3>
        </div>

        <div style={{ minHeight: '300px', padding: '16px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          
          <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                <button type="button" className="btn-primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', padding: '6px 14px', fontWeight: 'bold' }}>
                  <Printer size={14} /> 출고요청서 인쇄하기
                </button>
              </div>

              {/* 실제 인쇄 타겟 컨테이너 */}
              <div id="dispatch-sheet-print" style={{ padding: '24px', backgroundColor: '#ffffff', color: '#111111', borderRadius: '4px', border: '1px solid #ddd', maxWidth: '800px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', borderBottom: '2px solid #312e81', paddingBottom: '12px', marginBottom: '24px' }}>
                  <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#1e1b4b', letterSpacing: '2px' }}>기연리프트 출고요청서</h1>
                </div>

                <div style={{ fontSize: '14px', fontWeight: 'bold', borderLeft: '4px solid #312e81', paddingLeft: '8px', marginBottom: '10px', color: '#312e81' }}>1. 거래 정보 및 현장 주소</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                  <tbody>
                    <tr>
                      <th style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f9fafb', width: '130px', fontWeight: 'bold', fontSize: '13px' }}>고객사명</th>
                      <td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px' }}>{customerName || '-'}</td>
                      <th style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f9fafb', width: '130px', fontWeight: 'bold', fontSize: '13px' }}>현장명</th>
                      <td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px' }}>{siteName || '-'}</td>
                    </tr>
                    <tr>
                      <th style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f9fafb', fontWeight: 'bold', fontSize: '13px' }}>상세 현장주소</th>
                      <td colSpan={3} style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px' }}>{siteAddress || '-'}</td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ fontSize: '14px', fontWeight: 'bold', borderLeft: '4px solid #312e81', paddingLeft: '8px', marginBottom: '10px', color: '#312e81' }}>2. 연락 관계인 정보</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                  <tbody>
                    <tr>
                      <th style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f9fafb', width: '130px', fontWeight: 'bold', fontSize: '13px' }}>현장담당자</th>
                      <td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px' }}>{siteContactName || '-'} (연락처: {siteContactPhone || '-'})</td>
                      <th style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f9fafb', width: '130px', fontWeight: 'bold', fontSize: '13px' }}>담당 메일</th>
                      <td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px' }}>{siteContactEmail || '-'}</td>
                    </tr>
                    <tr>
                      <th style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f9fafb', fontWeight: 'bold', fontSize: '13px' }}>청구담당자</th>
                      <td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px' }}>{billingContactName || '-'} (연락처: {billingContactPhone || '-'})</td>
                      <th style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f9fafb', fontWeight: 'bold', fontSize: '13px' }}>명세서 수신처</th>
                      <td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px' }}>{statementEmail || '-'}</td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ fontSize: '14px', fontWeight: 'bold', borderLeft: '4px solid #312e81', paddingLeft: '8px', marginBottom: '10px', color: '#312e81' }}>3. 배송 배차 및 리프트 모델</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                  <tbody>
                    <tr>
                      <th style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f9fafb', width: '130px', fontWeight: 'bold', fontSize: '13px' }}>상차스케줄</th>
                      <td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px' }}>{loadingTime || '-'}</td>
                      <th style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f9fafb', width: '130px', fontWeight: 'bold', fontSize: '13px' }}>하차스케줄</th>
                      <td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px' }}>{unloadingTime || '-'}</td>
                    </tr>
                    <tr>
                      <th style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f9fafb', fontWeight: 'bold', fontSize: '13px' }}>임대 투입 장비</th>
                      <td colSpan={3} style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px', fontWeight: '600' }}>
                        {equipments.map(e => `${e.modelName || '미지정'} * ${e.qty}대`).join(', ')}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ fontSize: '14px', fontWeight: 'bold', borderLeft: '4px solid #312e81', paddingLeft: '8px', marginBottom: '10px', color: '#312e81' }}>4. 장비 출하 필수 스펙 체크리스트 (검수원 확인용)</div>
                <div style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '20px' }}>
                  <div className="spec-grid">
                    {STANDARD_SPECS.map(s => {
                      const isChecked = !!checkedSpecs[s.id];
                      return (
                        <div key={s.id} className={`spec-item ${isChecked ? 'checked' : 'unchecked'}`}>
                          <span>{isChecked ? '☑' : '☐'}</span>
                          <span>{s.label} ({isChecked ? '적용' : '미적용'})</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ fontSize: '14px', fontWeight: 'bold', borderLeft: '4px solid #312e81', paddingLeft: '8px', marginBottom: '10px', color: '#312e81' }}>5. 정산 및 특이사항</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <th style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f9fafb', width: '130px', fontWeight: 'bold', fontSize: '13px' }}>마감 마감일</th>
                      <td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px' }}>{closingDay || '-'}</td>
                      <th style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f9fafb', width: '130px', fontWeight: 'bold', fontSize: '13px' }}>결제 지급일</th>
                      <td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px' }}>{paymentDay || '-'}</td>
                    </tr>
                    <tr>
                      <th style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f9fafb', fontWeight: 'bold', fontSize: '13px' }}>특이사항</th>
                      <td colSpan={3} style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px' }}>{note || '특이사항 없음'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

        </div>
      </div>

      {/* 실시간 프로세스 진행 릴레이 팝업 모달 */}
      {isProcessingModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: '520px', padding: '28px', backgroundColor: '#0f172a',
            color: '#f8fafc', borderRadius: '16px', border: '1px solid #334155', boxSizing: 'border-box',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8' }}>
                <RefreshCw size={18} className={isProcessCompleted ? '' : 'animate-spin'} style={{ color: isProcessCompleted ? '#10b981' : '#38bdf8' }} />
                {isProcessCompleted ? '스마트 출고 요청 생성 완료' : '스마트 출고 프로세스 실시간 릴레이'}
              </h3>
              <span style={{ fontSize: '13px', fontWeight: '700', color: isProcessCompleted ? '#10b981' : '#38bdf8', padding: '2px 10px', borderRadius: '12px', backgroundColor: isProcessCompleted ? 'rgba(16,185,129,0.15)' : 'rgba(56,189,248,0.15)' }}>
                {progressPercent}%
              </span>
            </div>

            {/* 프로그레스 바 */}
            <div style={{ width: '100%', height: '10px', backgroundColor: '#1e293b', borderRadius: '5px', overflow: 'hidden', marginBottom: '20px' }}>
              <div style={{
                width: `${progressPercent}%`, height: '100%',
                backgroundColor: isProcessCompleted ? '#10b981' : '#3b82f6',
                backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.2) 50%, rgba(255,255,255,.2) 75%, transparent 75%, transparent)',
                backgroundSize: '1rem 1rem',
                transition: 'width 0.3s ease-in-out'
              }}></div>
            </div>

            {/* 현재 진행 단계 가이드 메인 박스 */}
            <div style={{ backgroundColor: '#1e293b', padding: '14px', borderRadius: '10px', fontSize: '13.5px', fontWeight: '700', color: '#f1f5f9', borderLeft: isProcessCompleted ? '4px solid #10b981' : '4px solid #3b82f6', marginBottom: '16px' }}>
              {currentStepText}
            </div>

            {/* 단계별 로그 기록 콘솔 타임라인 */}
            <div style={{
              backgroundColor: '#020617', padding: '12px 14px', borderRadius: '8px',
              fontSize: '12px', fontFamily: 'monospace', color: '#94a3b8', maxHeight: '160px',
              overflowY: 'auto', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '6px'
            }}>
              {progressLogs.map((log, idx) => (
                <div key={idx} style={{ color: idx === progressLogs.length - 1 ? '#38bdf8' : '#64748b' }}>
                  {log}
                </div>
              ))}
            </div>

            {isProcessCompleted && (
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '12.5px', color: '#94a3b8', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  ✅ 출고 지시 1건이 데이터베이스에 안전하게 등록되었습니다.<br />
                  [배차 관리] 담당자가 배차 차량 및 고유 장비 번호를 매핑할 예정입니다.
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setIsProcessingModalOpen(false)}
                    style={{ padding: '10px 24px', backgroundColor: '#10b981', borderColor: '#10b981', fontWeight: '800' }}
                  >
                    확인 (출고 지시 완료)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
