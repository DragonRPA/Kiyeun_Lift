// src/services/voiceOrderDraftService.ts
import { Customer, CustomerSite, Asset, Delivery } from './db';

export interface EquipmentOrderItem {
  ft: string;
  modelName: string;
  count: number;
}

export interface VoiceOrderDraft {
  customerId: string;
  customerName: string;
  siteId: string;
  siteName: string;
  newSiteName: string;
  siteAddress: string;
  siteContactName: string;
  siteContactPhone: string;
  deliveryDate: string;
  deliveryTime: string;
  orders: EquipmentOrderItem[];
  memo: string;
  snippets: { text: string; timestamp: string }[];
  updatedAt: string;
}

export const DRAFT_STORAGE_KEY = 'kiyuen_sales_dispatch_draft';

const KOREAN_COUNT_MAP: Record<string, number> = {
  '한': 1, '일': 1, '하나': 1, '1': 1,
  '두': 2, '이': 2, '둘': 2, '2': 2,
  '세': 3, '삼': 3, '셋': 3, '3': 3,
  '네': 4, '사': 4, '넷': 4, '4': 4,
  '다섯': 5, '오': 5, '5': 5,
  '여섯': 6, '육': 6, '6': 6,
  '일곱': 7, '칠': 7, '7': 7,
  '여덟': 8, '팔': 8, '8': 8,
  '아홉': 9, '구': 9, '9': 9,
  '열': 10, '십': 10, '10': 10
};

// 빈 기본 임시저장 객체 생성
export function createEmptyDraft(): VoiceOrderDraft {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    customerId: '',
    customerName: '',
    siteId: '',
    siteName: '',
    newSiteName: '',
    siteAddress: '',
    siteContactName: '',
    siteContactPhone: '',
    deliveryDate: tomorrow.toISOString().split('T')[0],
    deliveryTime: '08:00',
    orders: [{ ft: '19ft', modelName: '1930', count: 1 }],
    memo: '',
    snippets: [],
    updatedAt: new Date().toISOString()
  };
}

// 로컬스토리지에서 불러오기
export function loadVoiceOrderDraft(): VoiceOrderDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.orders) || parsed.orders.length === 0) {
      return null;
    }
    return parsed;
  } catch (e) {
    console.error('Failed to load voice order draft:', e);
    return null;
  }
}

// 로컬스토리지에 저장
export function saveVoiceOrderDraft(draft: VoiceOrderDraft): void {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
      ...draft,
      updatedAt: new Date().toISOString()
    }));
  } catch (e) {
    console.error('Failed to save voice order draft:', e);
  }
}

// 로컬스토리지 초기화
export function clearVoiceOrderDraft(): void {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear voice order draft:', e);
  }
}

// 음성 조각 증분 병합 (Incremental Merge Parser)
export function mergeVoiceFragmentToDraft(
  currentDraft: VoiceOrderDraft,
  speechText: string,
  customers: Customer[],
  sites: CustomerSite[]
): { updatedDraft: VoiceOrderDraft; modifiedFields: string[] } {
  const updated: VoiceOrderDraft = {
    ...currentDraft,
    orders: [...currentDraft.orders],
    snippets: [...(currentDraft.snippets || [])]
  };

  const modifiedFields: string[] = [];
  const cleanText = speechText.trim();
  if (!cleanText) {
    return { updatedDraft: updated, modifiedFields };
  }

  // 발화 이력 기록
  const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  updated.snippets.push({ text: cleanText, timestamp: timeStr });
  if (updated.snippets.length > 20) {
    updated.snippets = updated.snippets.slice(-20);
  }

  // 1. 전화번호 추출 (010-XXXX-XXXX 또는 010XXXXXXXX)
  const phoneMatch = cleanText.match(/010[-.\s]?\d{3,4}[-.\s]?\d{4}/);
  if (phoneMatch) {
    const rawPhone = phoneMatch[0].replace(/[-.\s]/g, '');
    if (rawPhone.length === 11) {
      const formatted = `${rawPhone.slice(0, 3)}-${rawPhone.slice(3, 7)}-${rawPhone.slice(7)}`;
      updated.siteContactPhone = formatted;
      modifiedFields.push(`연락처: ${formatted}`);
    }
  }

  // 2. 담당자 이름 추출 (예: "김반장", "홍길동 소장", "담당자 이철수")
  const titleMatch = cleanText.match(/([가-힣]{1,4}\s*(?:소장님?|반장님?|과장님?|부장님?|팀장님?))/);
  const explicitMatch = cleanText.match(/(?:담당자|이름은?)\s*([가-힣]{2,4})/);
  if (titleMatch && titleMatch[0]) {
    const candidate = titleMatch[0].trim().replace(/님$/, '');
    if (!['현대', '삼성', '대우', '포스코', '내일', '모레', '아침', '오전', '오후'].some(w => candidate.startsWith(w))) {
      updated.siteContactName = candidate;
      modifiedFields.push(`담당자: ${candidate}`);
    }
  } else if (explicitMatch && explicitMatch[1]) {
    const name = explicitMatch[1].trim();
    if (!['현대', '삼성', '대우', '포스코', '내일', '모레', '아침', '오전', '오후'].includes(name)) {
      updated.siteContactName = name;
      modifiedFields.push(`담당자: ${name}`);
    }
  }

  // 3. 날짜 추출 (내일, 모레, 오늘, X월 X일, X일)
  const now = new Date();
  if (cleanText.includes('내일')) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    updated.deliveryDate = d.toISOString().split('T')[0];
    modifiedFields.push(`납품일: 내일(${updated.deliveryDate})`);
  } else if (cleanText.includes('모레') || cleanText.includes('내일모레')) {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    updated.deliveryDate = d.toISOString().split('T')[0];
    modifiedFields.push(`납품일: 모레(${updated.deliveryDate})`);
  } else if (cleanText.includes('오늘') || cleanText.includes('당일')) {
    updated.deliveryDate = now.toISOString().split('T')[0];
    modifiedFields.push(`납품일: 오늘(${updated.deliveryDate})`);
  } else {
    const dateMatch = cleanText.match(/(?:(\d{1,2})월\s*)?(\d{1,2})일/);
    if (dateMatch) {
      const month = dateMatch[1] ? parseInt(dateMatch[1], 10) : now.getMonth() + 1;
      const day = parseInt(dateMatch[2], 10);
      const year = now.getFullYear();
      const targetDate = new Date(year, month - 1, day);
      if (targetDate < now && !dateMatch[1]) {
        targetDate.setMonth(targetDate.getMonth() + 1);
      }
      const ymd = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
      updated.deliveryDate = ymd;
      modifiedFields.push(`납품일: ${ymd}`);
    }
  }

  // 4. 시간 추출 (아침 8시, 오전 7시, 오후 2시, 07:00, 14:00 등)
  const timeMatch = cleanText.match(/(아침|새벽|오전|오후|낮|저녁)?\s*(\d{1,2})시(?:\s*(\d{1,2})분)?/);
  if (timeMatch) {
    const ampm = timeMatch[1] || '';
    let hour = parseInt(timeMatch[2], 10);
    const minute = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
    if ((ampm === '오후' || ampm === '저녁' || ampm === '낮') && hour < 12) {
      hour += 12;
    }
    const timeFormatted = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    updated.deliveryTime = timeFormatted;
    modifiedFields.push(`납품시간: ${timeFormatted}`);
  }

  // 5. 장비 모델 및 수량 추출
  const detectedOrders: EquipmentOrderItem[] = [];
  const modelRegex = /(1930|2632|3246|4047|1412|1612|19피트|26피트|32피트|40피트|46피트|53피트|19ft|26ft|32ft|40ft|46ft|53ft)/gi;
  
  let match;
  const matches: { key: string; index: number }[] = [];
  while ((match = modelRegex.exec(cleanText)) !== null) {
    matches.push({ key: match[0], index: match.index });
  }

  if (matches.length > 0) {
    matches.forEach(m => {
      let model = m.key.toUpperCase();
      let ft = '19ft';
      if (model.includes('19')) { ft = '19ft'; model = '1930'; }
      else if (model.includes('26')) { ft = '26ft'; model = '2632'; }
      else if (model.includes('32')) { ft = '32ft'; model = '3246'; }
      else if (model.includes('40')) { ft = '40ft'; model = '4047'; }
      else if (model.includes('46') || model.includes('1412')) { ft = '46ft'; model = '1412'; }
      else if (model.includes('53') || model.includes('1612')) { ft = '53ft'; model = '1612'; }

      // 모델명 뒤 25글자 내에서 수량 탐색
      const sub = cleanText.substring(m.index, m.index + 25);
      const countMatch = sub.match(/(\d+)\s*대/) || 
                         sub.match(/(한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s*대/);
      
      let count = 1;
      if (countMatch) {
        const rawNum = countMatch[1];
        if (KOREAN_COUNT_MAP[rawNum]) {
          count = KOREAN_COUNT_MAP[rawNum];
        } else if (!isNaN(parseInt(rawNum, 10))) {
          count = parseInt(rawNum, 10);
        }
      }

      detectedOrders.push({ ft, modelName: model, count });
    });

    if (detectedOrders.length > 0) {
      updated.orders = detectedOrders;
      modifiedFields.push(`장비: ${detectedOrders.map(o => `${o.modelName}(${o.count}대)`).join(', ')}`);
    }
  }

  // 6. 거래처 매칭
  let matchedCustomer: Customer | null = null;
  for (const c of customers) {
    const simpleName = c.name.replace(/주식회사|\(주\)|\s/g, '');
    if (simpleName.length >= 2 && cleanText.replace(/\s/g, '').includes(simpleName)) {
      matchedCustomer = c;
      break;
    }
  }

  if (matchedCustomer) {
    updated.customerId = matchedCustomer.id;
    updated.customerName = matchedCustomer.name;
    modifiedFields.push(`고객사: ${matchedCustomer.name}`);
  }

  // 7. 현장 매칭
  let matchedSite: CustomerSite | null = null;
  const sitePool = matchedCustomer 
    ? sites.filter(s => s.customerId === matchedCustomer!.id)
    : sites;

  const siteWordMatch = cleanText.match(/([가-힣A-Za-z0-9]{2,10})\s*(?:현장|신축|공사|캠퍼스|밸리|호텔|타워)/);
  const siteKeyword = siteWordMatch ? siteWordMatch[1].replace(/\s/g, '') : '';

  for (const s of sitePool) {
    const simpleSite = s.name.replace(/\s/g, '');
    const isDirectMatch = simpleSite.length >= 2 && cleanText.replace(/\s/g, '').includes(simpleSite);
    const isKeywordMatch = siteKeyword.length >= 2 && simpleSite.includes(siteKeyword);
    if (isDirectMatch || isKeywordMatch) {
      matchedSite = s;
      break;
    }
  }

  if (matchedSite) {
    updated.siteId = matchedSite.id;
    updated.siteName = matchedSite.name;
    if (matchedSite.address && matchedSite.address !== '미상') {
      updated.siteAddress = matchedSite.address;
    }
    if (matchedSite.contactName && matchedSite.contactName !== '미상' && !updated.siteContactName) {
      updated.siteContactName = matchedSite.contactName;
    }
    if (matchedSite.contact && matchedSite.contact !== '미상' && !updated.siteContactPhone) {
      updated.siteContactPhone = matchedSite.contact;
    }
    modifiedFields.push(`현장: ${matchedSite.name}`);
  } else {
    const siteKeywordMatch = cleanText.match(/([가-힣0-9A-Za-z\s]+?)\s*(?:현장|신축|공사|플랜트|호텔)/);
    if (siteKeywordMatch && siteKeywordMatch[1] && !updated.siteName) {
      const candidate = `${siteKeywordMatch[1].trim()} 현장`;
      if (candidate.length >= 3 && candidate.length <= 25) {
        updated.siteId = 'NEW';
        updated.siteName = candidate;
        updated.newSiteName = candidate;
        modifiedFields.push(`신규현장: ${candidate}`);
      }
    }
  }

  // 8. 특이사항/메모
  const memoKeywords = ['칼국수', '숏바리', '배터리', '보양', '도색', '안전점검', '크레인', '지게차', '신차'];
  const matchedMemoWords = memoKeywords.filter(k => cleanText.includes(k));
  if (matchedMemoWords.length > 0) {
    const memoAdd = `[음성특이사항] ${matchedMemoWords.join(', ')}`;
    if (!updated.memo.includes(memoAdd)) {
      updated.memo = updated.memo ? `${updated.memo} | ${memoAdd}` : memoAdd;
      modifiedFields.push(`메모: ${matchedMemoWords.join(', ')}`);
    }
  }

  // 변경 발생 시 저장
  saveVoiceOrderDraft(updated);

  return { updatedDraft: updated, modifiedFields };
}


// ─────────────────────────────────────────────────────────────
// 🔧 2. 현장 AS 접수 통화 텍스트 파서 (Field AS Intake Parser)
// ─────────────────────────────────────────────────────────────
export interface AsCallParseResult {
  customerName: string;
  siteName: string;
  assetNo: string;
  reporterName: string;
  reporterContact: string;
  issueCategory: string;
  issueDescription: string;
  priority: 'NORMAL' | 'URGENT';
  locationDetail: string;
  modifiedFields: string[];
}

export function parseAsCallTranscript(
  speechText: string,
  customers: Customer[],
  sites: CustomerSite[],
  assets: Asset[]
): AsCallParseResult {
  const cleanText = speechText.trim();
  const modifiedFields: string[] = [];

  let customerName = '';
  let siteName = '';
  let assetNo = '';
  let reporterName = '';
  let reporterContact = '';
  let issueCategory = '기타';
  let issueDescription = cleanText;
  let priority: 'NORMAL' | 'URGENT' = 'NORMAL';
  let locationDetail = '';

  // 1. 긴급도 판별
  if (/급해|당장|중단|작업\s*못해|사고|위험|빨리/i.test(cleanText)) {
    priority = 'URGENT';
    modifiedFields.push('우선순위: 긴급(URGENT)');
  }

  // 2. 카테고리 매핑
  if (/상승|하강|올라|내려|리프트/i.test(cleanText)) {
    issueCategory = '상하강불량';
  } else if (/충전|전원|배터리|방전|시동|차단기/i.test(cleanText)) {
    issueCategory = '충전/전원';
  } else if (/오일|누유|기름|유압/i.test(cleanText)) {
    issueCategory = '오일누유';
  } else if (/키|스위치|비상정지|레버|조이스틱/i.test(cleanText)) {
    issueCategory = '키박스/스위치';
  } else if (/에러|경고등|삐|부저|코드/i.test(cleanText)) {
    issueCategory = '에러코드';
  } else if (/협착|방지봉|안전바/i.test(cleanText)) {
    issueCategory = '방지봉/협착';
  } else if (/파이프|걸림|끼임/i.test(cleanText)) {
    issueCategory = '파이프걸림';
  } else if (/점검|확인/i.test(cleanText)) {
    issueCategory = '점검요청';
  }
  if (issueCategory !== '기타') {
    modifiedFields.push(`증상분류: ${issueCategory}`);
  }

  // 3. 장비 번호 추출 (예: 102호기, 102호, 205호, 1930 등)
  const assetMatch = cleanText.match(/(\d{2,4})\s*호기?/) ||
                     cleanText.match(/(?:장비|번호|관리번호)\s*([0-9A-Za-z]{2,8})/);
  if (assetMatch) {
    const rawNo = assetMatch[1].trim();
    // 실제 assets 목록에서 해당 번호로 시작하거나 일치하는 자산 탐색
    const matchedAsset = assets.find(a => a.assetNo.includes(rawNo) || rawNo.includes(a.assetNo));
    assetNo = matchedAsset ? matchedAsset.assetNo : rawNo;
    modifiedFields.push(`장비번호: ${assetNo}`);
  }

  // 4. 전화번호 추출
  const phoneMatch = cleanText.match(/010[-.\s]?\d{3,4}[-.\s]?\d{4}/);
  if (phoneMatch) {
    const raw = phoneMatch[0].replace(/[-.\s]/g, '');
    if (raw.length === 11) {
      reporterContact = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7)}`;
      modifiedFields.push(`연락처: ${reporterContact}`);
    }
  }

  // 5. 담당자명 추출
  const nameMatch = cleanText.match(/([가-힣]{1,4}\s*(?:소장님?|반장님?|과장님?|부장님?|팀장님?))/);
  const explicitMatch = cleanText.match(/(?:담당자|이름은?)\s*([가-힣]{2,4})/);
  if (nameMatch) {
    reporterName = nameMatch[0].trim().replace(/님$/, '');
    modifiedFields.push(`담당자: ${reporterName}`);
  } else if (explicitMatch) {
    reporterName = explicitMatch[1].trim();
    modifiedFields.push(`담당자: ${reporterName}`);
  }

  // 6. 거래처 및 현장 탐색
  for (const c of customers) {
    const sName = c.name.replace(/주식회사|\(주\)|\s/g, '');
    if (sName.length >= 2 && cleanText.replace(/\s/g, '').includes(sName)) {
      customerName = c.name;
      modifiedFields.push(`고객사: ${c.name}`);
      break;
    }
  }

  const siteWordMatch = cleanText.match(/([가-힣A-Za-z0-9]{2,10})\s*(?:현장|신축|공사|캠퍼스|밸리|호텔|타워)/);
  const siteKeyword = siteWordMatch ? siteWordMatch[1].replace(/\s/g, '') : '';

  for (const s of sites) {
    const sName = s.name.replace(/\s/g, '');
    const isDirectMatch = sName.length >= 2 && cleanText.replace(/\s/g, '').includes(sName);
    const isKeywordMatch = siteKeyword.length >= 2 && sName.includes(siteKeyword);

    if (isDirectMatch || isKeywordMatch) {
      siteName = s.name;
      if (!customerName) {
        const parentCust = customers.find(c => c.id === s.customerId);
        if (parentCust) customerName = parentCust.name;
      }
      modifiedFields.push(`현장: ${s.name}`);
      break;
    }
  }

  // 7. 위치 상세 (예: 지하 1층, 3층 하역장 등)
  const locMatch = cleanText.match(/(지하\s*\d+층|지상\s*\d+층|\d+층|[가-힣A-Za-z0-9]+\s*(?:하역장|주차장|동|구역|게이트))/);
  if (locMatch) {
    locationDetail = locMatch[0].trim();
    modifiedFields.push(`상세위치: ${locationDetail}`);
  }

  return {
    customerName,
    siteName,
    assetNo,
    reporterName,
    reporterContact,
    issueCategory,
    issueDescription,
    priority,
    locationDetail,
    modifiedFields
  };
}


// ─────────────────────────────────────────────────────────────
// 🚚 3. 배차 담당자 기사 배정 통화 파서 (Dispatch Driver Call Parser)
// ─────────────────────────────────────────────────────────────
export interface DispatchDriverParseResult {
  matchedDeliveryId?: string;
  matchedDeliverySummary?: string;
  vehicleNo: string;
  driverName: string;
  driverContact: string;
  vehicleType: string;
  finalCost: number;
  loadingTime?: string;
  unloadingTime?: string;
  memo?: string;
  modifiedFields: string[];
}

export function parseDispatchDriverCallTranscript(
  speechText: string,
  pendingDeliveries: Delivery[]
): DispatchDriverParseResult {
  const cleanText = speechText.trim();
  const modifiedFields: string[] = [];

  let vehicleNo = '';
  let driverName = '';
  let driverContact = '';
  let vehicleType = '';
  let finalCost = 0;
  let loadingTime = '';
  let unloadingTime = '';
  let matchedDeliveryId: string | undefined = undefined;
  let matchedDeliverySummary: string | undefined = undefined;

  // 1. 차량 번호 추출 (대한민국 영업용 화물차 번호판: 경기88바1234, 88바1234, 12가3456 등)
  const plateMatch = cleanText.match(/([가-힣]{2})?\s*(\d{2,3})\s*([가-힣])\s*(\d{4})/);
  if (plateMatch) {
    const area = plateMatch[1] || '';
    vehicleNo = `${area}${plateMatch[2]}${plateMatch[3]}${plateMatch[4]}`.replace(/\s/g, '');
    modifiedFields.push(`차량번호: ${vehicleNo}`);
  }

  // 2. 기사 연락처 추출
  const phoneMatch = cleanText.match(/010[-.\s]?\d{3,4}[-.\s]?\d{4}/);
  if (phoneMatch) {
    const raw = phoneMatch[0].replace(/[-.\s]/g, '');
    if (raw.length === 11) {
      driverContact = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7)}`;
      modifiedFields.push(`기사연락처: ${driverContact}`);
    }
  }

  // 3. 기사명 추출 (이기사, 김기사, 홍길동 기사님 등)
  const driverMatch = cleanText.match(/([가-힣]{1,4})\s*(?:기사님?|사장님?)/);
  if (driverMatch && driverMatch[0]) {
    const cand = driverMatch[0].trim().replace(/님$/, '');
    if (!['경기', '서울', '인천', '충남', '강원', '전북', '내일', '오늘'].some(w => cand.startsWith(w))) {
      driverName = cand;
      modifiedFields.push(`기사명: ${driverName}`);
    }
  }

  // 4. 차종 추출
  const typeMatch = cleanText.match(/(5톤\s*축차|5톤|3\.5톤\s*광폭|3\.5톤|2\.5톤|1톤\s*카고|1톤|윙바디|셀프로더|평판|추레라)/i);
  if (typeMatch) {
    vehicleType = typeMatch[0].trim();
    modifiedFields.push(`차종: ${vehicleType}`);
  }

  // 5. 확정 운송료 추출 (예: 12만원, 12만, 15만원, 130,000원)
  const costMatch1 = cleanText.match(/(\d{1,3})\s*만(?:\s*원)?/);
  const costMatch2 = cleanText.match(/(\d{1,3}(?:,\d{3})+)\s*원/);
  if (costMatch1) {
    finalCost = parseInt(costMatch1[1], 10) * 10000;
    modifiedFields.push(`확정운송비: ${finalCost.toLocaleString()}원`);
  } else if (costMatch2) {
    finalCost = parseInt(costMatch2[1].replace(/,/g, ''), 10);
    modifiedFields.push(`확정운송비: ${finalCost.toLocaleString()}원`);
  }

  // 6. 상하차 시간
  const timeMatch = cleanText.match(/(상차|하차)?\s*(새벽|아침|오전|오후)?\s*(\d{1,2})시(?:\s*(\d{1,2})분)?/);
  if (timeMatch) {
    let hour = parseInt(timeMatch[3], 10);
    const minute = timeMatch[4] ? parseInt(timeMatch[4], 10) : 0;
    if (timeMatch[2] === '오후' && hour < 12) hour += 12;
    const formattedTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    if (timeMatch[1] === '상차') {
      loadingTime = formattedTime;
      modifiedFields.push(`상차시간: ${loadingTime}`);
    } else {
      unloadingTime = formattedTime;
      modifiedFields.push(`도착시간: ${unloadingTime}`);
    }
  }

  // 7. 대기 중인 배차건 1순위 자동 매칭
  // pendingDeliveries 중 목적지나 메모에 텍스트 속 키워드가 포함된 건 탐색
  for (const d of pendingDeliveries) {
    const dest = (d.destinationAddress || '').replace(/\s/g, '');
    const memo = (d.memo || '').replace(/\s/g, '');
    const raw = (d.rawText || '').replace(/\s/g, '');

    // 현장명 매칭
    const siteMatches = cleanText.match(/([가-힣A-Za-z0-9]+?)\s*(?:현장|신축|공사|호텔|타워)/);
    if (siteMatches && siteMatches[1]) {
      const kw = siteMatches[1].replace(/\s/g, '');
      if (kw.length >= 2 && (dest.includes(kw) || memo.includes(kw) || raw.includes(kw))) {
        matchedDeliveryId = d.id;
        matchedDeliverySummary = `${d.destinationAddress || '목적지'} (${d.cargoItems || d.type})`;
        modifiedFields.push(`대상배차: ${matchedDeliverySummary}`);
        break;
      }
    }

    // 또는 장비 모델 매칭
    if (!matchedDeliveryId && /1930|2632|3246|4047/.test(cleanText)) {
      const model = cleanText.match(/1930|2632|3246|4047/)![0];
      if (memo.includes(model) || (d.cargoItems && d.cargoItems.includes(model))) {
        matchedDeliveryId = d.id;
        matchedDeliverySummary = `${d.destinationAddress || '목적지'} (${model})`;
        modifiedFields.push(`대상배차: ${matchedDeliverySummary}`);
        break;
      }
    }
  }

  return {
    matchedDeliveryId,
    matchedDeliverySummary,
    vehicleNo,
    driverName,
    driverContact,
    vehicleType,
    finalCost,
    loadingTime,
    unloadingTime,
    memo: cleanText,
    modifiedFields
  };
}
