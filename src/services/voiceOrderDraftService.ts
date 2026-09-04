// src/services/voiceOrderDraftService.ts
import { Customer, CustomerSite } from './db';

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

  for (const s of sitePool) {
    const simpleSite = s.name.replace(/\s/g, '');
    if (simpleSite.length >= 2 && cleanText.replace(/\s/g, '').includes(simpleSite)) {
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
