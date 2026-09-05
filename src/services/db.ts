// @ts-nocheck
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// 법인 표기어 및 공백 제거 정규화 파서
export function normalizeCustomerName(name: string): string {
  if (!name) return '';
  return String(name)
    .replace(/주식회사|\(주\)|\(주\)|㈜|\(유\)|유한회사|\(합\)|합자회사|사단법인|재단법인/gi, '')
    .replace(/[\s\(\)\[\]._\-]/g, '')
    .toLowerCase();
}

export function findCustomerByNormalizedName(customers: Customer[], targetName: string): Customer | undefined {
  if (!targetName) return undefined;
  const targetKey = normalizeCustomerName(targetName);
  if (!targetKey) return undefined;
  return customers.find(c => normalizeCustomerName(c.name) === targetKey);
}

/** 계약 종료일 정규화: '미정' / null / undefined → '9999-12-31' 처리 */
export function normalizeEndDate(endDate?: string | null): string {
  if (!endDate || endDate === '미정') return '9999-12-31';
  return endDate;
}

export interface User {
  id: string;
  loginId?: string;
  passwordHash?: string; // 단순 비교용 평문 패스워드로 시딩
  name: string;
  departmentId: string | null;
  department?: string; // (legacy or display)
  role: string;
  position?: string;
  status?: 'ACTIVE' | 'LEAVE_OF_ABSENCE' | 'RETIRED';
  birthDate?: string;
  joinDate?: string;  // 입사일 (YYYY-MM-DD)
  baseSalary?: number; // 기본급 (원) - 급여 정산 권한자 전용
  address?: string;
  phone?: string;
  email?: string;
  profileImageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AnnualLeaveQuota {
  id: string;
  userId: string;
  periodStart: string; // YYYY-MM-DD (갱신 주기 시작)
  periodEnd: string;   // YYYY-MM-DD (갱신 주기 종료)
  grantedDays: number; // 이번 1년 동안 부여될 연차 갯수 (예: 15)
  memo?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LeaveUsage {
  id: string;
  userId: string;
  leaveType: 'ANNUAL' | 'HALF_AM' | 'HALF_PM'; // 연차(1일) / 오전반차(0.5일) / 오후반차(0.5일)
  usedDays: number; // 1.0 또는 0.5
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  reason: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  createdAt: string;
}

export interface OvertimeRecord {
  id: string;
  userId: string;
  startDateTime: string; // YYYY-MM-DD HH:mm (시작 일시)
  hours: number;         // 몇 시간 OT 하였는지 (예: 2.5)
  workDetail: string;    // 연장근무 내용
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  createdAt: string;
}

export interface PayrollClosing {
  id: string;
  month: string; // YYYY-MM
  status: 'DRAFT' | 'APPROVED';
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Department {
  id: string;
  name: string;
  parentDepartmentId: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MenuPermission {
  id: string;
  userId: string;
  menuId: string;
  canView: boolean;
  canSave: boolean;
  createdAt: string;
  updatedAt?: string;
}

/** MenuPermission 단일 진실의 원천(SSOT) 팩토리 생성 함수 */
export function createMenuPermission(
  userId: string,
  menuId: string,
  canView: boolean = true,
  canSave: boolean = false
): MenuPermission {
  const cleanUserId = userId ? String(userId).trim() : '';
  const nowIso = new Date().toISOString();
  return {
    id: `perm-${cleanUserId}-${menuId}`,
    userId: cleanUserId,
    menuId: menuId,
    canView: canView,
    canSave: canSave,
    createdAt: nowIso,
    updatedAt: nowIso
  };
}

export interface CustomerBankAccount {
  id: string;
  bankName: string;      // 은행명 (예: 국민, 농협, 신한, 기업 등)
  accountNumber: string; // 계좌번호
  accountHolder?: string;// 예금주명
  memo?: string;         // 메모 (예: 대표 계좌, 현장 전용 등)
}

export interface SpecItem {
  id: string;
  label: string;
  keywords: string[];
}

// 🛡️ 고소작업대 필수 기술 요구사항 표준 체크리스트 정의 (SSOT 단일 원천)
export const STANDARD_SPECS: SpecItem[] = [
  { id: 'spec1', label: '철망 / 함석 설치', keywords: ['철망', '함석', '사면철망', '1면', '2면', '3면', '4면', '5면', '망'] },
  { id: 'spec2', label: '확장대 철망 / 함석 설치', keywords: ['확장대 철망', '확장대철망', '확장대 함석', '확장대함석'] },
  { id: 'spec3', label: '상단 감지봉 / 협착 센서 설치 (4EA)', keywords: ['감지봉', '감지봉 4ea', '상단감지', '협착', '센서', '4ea', '감지봉4ea'] },
  { id: 'spec4', label: '원판 설치', keywords: ['원판설치', '원판'] },
  { id: 'spec5', label: '배터리 단자 풀림 확인 마킹', keywords: ['배터리 단자 풀림', '단자 풀림 확인 마킹', '단자 풀림', '배터리 마킹'] },
  { id: 'spec6', label: '배터리 단자 커버 설치', keywords: ['배터리 단자 커버', '커버설치', '단자 커버'] },
  { id: 'spec7', label: '트레이 내부 볼트류 풀림 확인 마킹', keywords: ['트레이 내부 볼트', '볼트류 풀림 확인마킹', '트레이 내부 볼트류 풀림'] },
  { id: 'spec8', label: '주행속도 세팅 (고속 60 / 저속 45)', keywords: ['주행속도', '고속 60', '저속 45', '주행속도 고속', '속도 세팅'] },
  { id: 'spec9', label: '오버로드 과적재 세팅', keywords: ['오버로드 셋팅', '오버로드', '오버로드 세팅', '과적'] },
  { id: 'spec10', label: '조이스틱 커버 연장', keywords: ['조이스틱 커버', '커버 연장', '조이스틱 커버 연장'] },
  { id: 'spec11', label: '탑승구 사다리 보양', keywords: ['탑승구 사다리', '사다리 보양', '탑승구 사다리 보양', '사다리'] },
  { id: 'spec12', label: '모서리/전면부/미끄럼방지 보양', keywords: ['미끄럼방지', '모서리 8개소', '전면부 2개소', '모서리보양', '모서리 8면', '보양'] },
  { id: 'spec13', label: '소화기함/손잡이 설치 및 안내스티커 부착', keywords: ['소화기함', '기타 스티커물', '탑승구 손잡이', '작동설명', '소화기', '스티커'] },
  { id: 'spec14', label: '타이어 A급 장착', keywords: ['타이어 A급', '타이어A급', '타이어 A급 상태', '타이어'] },
  { id: 'spec15', label: '점멸등, 비상하강장치, 비상정지장치 청결', keywords: ['점멸등', '비상하강장치', '비상정지장치', '비상하강장치 청결', '정지장치'] },
  { id: 'spec16', label: '작업높이 80% 세팅', keywords: ['작업높이 80프로', '발판높이기준', '작업높이 80%', '작업높이 80'] },
  { id: 'spec17', label: '작업구간 색상 라인구분 (초록/빨강)', keywords: ['라인구분', '초록, 빨강', '라인 구분'] },
  { id: 'spec18', label: '하부상승제한, 확장대 50% 표식 부착', keywords: ['하부상승제한', '확장대 50%', '50%지점 표식'] },
  { id: 'spec19', label: '비상정지스위치 및 비상하강꼬리표 부착', keywords: ['비상정지스위치', '비상하강꼬리표', '비상정지스위치 부착'] },
  { id: 'spec20', label: '시저구간 협착위험 스티커 부착', keywords: ['협착위험 스티커', '시저구간', '접촉금지', '시저구간 접촉금지'] },
  { id: 'spec21', label: '부착물 세트 (인증서, 제원표, 보험증권, 반입전 체크리스트)', keywords: ['부착물', '제원표', '비상하강사용법', '보험증권', '인증서', '반입전', '체크리스트'] }
];

export interface Customer {
  id: string;
  name: string;
  bizRegNo: string;
  isClosed: boolean;
  address: string;
  representative: string;
  repContact: string;
  repEmail: string;
  bizType?: string; // 업태 (예: 건설업, 도소매업)
  bizItem?: string; // 종목 (예: 고소작업대임대, 가설재)
  driveFolderId?: string;
  prepaidBalance?: number; // 선수금 (예치금) 잔액
  transactionStatus?: 'ALLOWED' | 'BLOCKED'; // ALLOWED: 거래가능 (기본), BLOCKED: 거래불가 (신규 계약/출고 제한)
  defaultBillingDay?: number; // 청구서(세금계산서) 기본 마감일 (예: 30일/월말)
  defaultStatementClosingDay?: number; // 거래명세서 기본 마감일 (예: 25일)
  paymentDueDay?: number; // 익월 결제일 (N일)
  paymentTermDays?: number; // Net Terms 결제기한 (발행 후 N일)
  bankAccounts?: CustomerBankAccount[]; // 고객사 다중 계좌 목록
  
  // 🌟 [신규] 고객사 기본 옵션/보양/요구스펙 자동 재사용 마스터
  defaultPaidOptions?: string;       // 기본 유상옵션 (예: '협착방지봉 4EA, 소화기함')
  defaultProtection?: string;        // 기본 보양작업 (예: '4면 철망 보양, 탑승구 사다리')
  defaultCheckedSpecs?: Record<string, boolean>; // 기본 21대 표준 스펙 체크 상태
  specialNotes?: string;             // 고객사 특이사항 메모 (예: '재임대 출고건으로 운반비 및 배차 한솔렌탈 부담')

  createdAt: string;
  updatedAt?: string;
}

export interface CustomerContact {
  id: string;
  customerId: string;
  name: string;
  position: string;
  contact: string;
  email: string;
  isActive?: boolean; // 사용/미사용 (퇴사/부서이동 등)
  createdAt: string;
  updatedAt?: string;
}

export interface CustomerSite {
  id: string;
  customerId: string;
  name: string;
  address: string;
  contactName: string;
  contact: string;
  email: string;
  isActive?: boolean; // 사용/미사용 (공사 완공 시 미사용)
  
  // 🌟 [신규] 현장 전용 옵션/보양/요구스펙 (미입력 시 고객사 기본값 자동 상속)
  paidOptions?: string;              // 현장 전용 유상옵션
  protection?: string;               // 현장 전용 보양작업
  checkedSpecs?: Record<string, boolean>; // 현장 전용 21대 표준 스펙 체크 상태

  createdAt: string;
  updatedAt?: string;
}

export interface Product {
  id: string;
  modelName: string;
  feet: number;
  spec: string;
  manufacturer: string;
  isActive?: boolean; // 사용/미사용 (단종/매각 등)
  
  // 🌟 [신규 확장] 장비 제원표 상세 규격 (1대1 매핑)
  powerSource?: string;          // 동력 (예: '배터리', '디젤', '전동')
  workingHeight?: string;        // 작업 높이 (예: '6.57 M')
  platformHeight?: string;       // 발판 높이 (예: '4.57 M')
  weight?: string;               // 장비 중량 (예: '1,148 Kg')
  machineDimensions?: string;    // 장비 크기 전장x전폭x전고 (예: '1.80 x 0.81 x 1.92 M')
  platformDimensions?: string;   // 플랫폼 크기 길이x폭 (예: '1.55 x 0.66 M')
  gradeability?: string;         // 등판 능력 (예: '25 %')
  speed?: string;                // 주행 속도 (예: '3.4 Km/h')
  asContact?: string;            // A/S 접수처 (예: '031-334-5296')

  // 🌟 [신규 확장] 작업대 확장 전/후 적재중량 및 안전 기준
  capacityPreExt?: string;       // 확장 전 적재중량 (예: '272 kg' - 작업자 2인)
  capacityPostExtMain?: string;  // 확장 후 본체 적재중량 (예: '159 kg' - 작업자 1인)
  capacityPostExtDeck?: string;  // 확장 후 확장부 적재중량 (예: '113 kg' - 작업자 1인)
  maxWindSpeed?: string;         // 최대 허용 풍속 (예: '12.5 m/s 이내')

  // 기존 안전/문서 URL
  maxHeightCapacity?: string;    // 작업최대높이/적재용량
  safetyCertDate?: string;       // 안전인증년월일 (예: '2009-09-14', '2024-03-01')
  safetyCertUrl?: string;
  specSheetUrl?: string;
  emergencyGuideUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Asset {
  id: string;
  modelName: string;
  assetNo: string; // 관리번호
  vendorId?: string; // 임차처/매입처 외래키
  vendorAssetNo?: string; // 타사(원사) 원래 관리번호
  serialNo?: string; // 제조번호
  manufacturer?: string;
  manufactureYear?: string; // 제조년도 (예: 2023)
  ownerType: 'OWNED' | 'RENTED'; // 당사자산 / 임차자산
  status: 'AVAILABLE' | 'ASSIGNED' | 'RENTED' | 'REPAIRING' | 'RENTED_RETURNED' | 'SOLD';
  
  maintenanceScore?: number; // 정비 소요 점수 (0이 최상 상태)

  // 현재 계약 상태 (타 메뉴 비즈니스 연동 시 변경됨)
  currentCustomerId?: string;
  currentSiteId?: string;
  contractStart?: string;
  contractEnd?: string;
  billingDay?: number;
  monthlyRentalFee?: number;
  dailyRentalFee?: number;

  // 당사자산 상세
  acquisitionDate?: string;
  acquisitionPrice?: number;
  depreciationMonths?: number; // 감가상각개월수 (내용월수)
  residualValueRate?: number; // % (예: 10)
  accumDepreciation?: number; // 감가상각누계액
  bookValue?: number; // 장부가 (미상각 잔액)
  cumRentalFee?: number; // 누적렌탈료
  cumRepairCost?: number; // 누적수리비
  renter?: string; // 임차처
  rentStart?: string;
  rentEnd?: string;
  monthlyRentFee?: number;
  dailyRentFee?: number;
  actualRentReturnDate?: string; // 실제 소유원사 반납 처리일

  // 매각 상세
  disposalDate?: string;
  disposalPrice?: number;
  buyer?: string; // 매각처

  supplier?: string; // 구입처
  memo1?: string;
  memo2?: string;
  note?: string; // 자산 수리/비고 사유
  memo?: string;
  safetyInspectionUrl?: string;
  preDeliveryChecklistUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * IFRS 회계기준 자산 월별 자동 감가상각 계산 함수
 * - 매월 말일 기준으로 상각경과 월수를 계산하여 감가상각누계액 및 미상각 잔액(장부가치) 산출
 * - 매각된 자산 (status === 'SOLD')은 매각일(disposalDate) 시점까지만 감가상각 적용 (매각 이후 상각 정지)
 * - 감가상각누계액: 1원 단위 반올림 처리 (Math.round)
 * - 미상각 잔액 (장부가치) = 취득원가 - 감가상각누계액
 */
export function calculateAssetDepreciation(asset: Asset, asOfDate: Date = new Date()): {
  accumDepreciation: number;
  bookValue: number;
  elapsedMonths: number;
  monthlyDepreciation: number;
} {
  const cost = asset.acquisitionPrice || 0;
  if (cost <= 0 || !asset.acquisitionDate || !asset.depreciationMonths || asset.depreciationMonths <= 0) {
    return {
      accumDepreciation: asset.accumDepreciation || 0,
      bookValue: asset.bookValue ?? cost,
      elapsedMonths: 0,
      monthlyDepreciation: 0,
    };
  }

  // 잔존가치율 (기본값 0%) 및 잔존가액
  const residualRate = asset.residualValueRate ?? 0;
  const residualValue = Math.round(cost * (residualRate / 100));
  const depreciableAmount = cost - residualValue; // 상각 대상 총액

  // 월 감가상각비 (정액법)
  const monthlyDepn = depreciableAmount / asset.depreciationMonths;

  // 기준 상각 종료일 결정 (매각된 자산은 매각일자 시점 고정, 아니면 현재/지정일)
  // IFRS 완전 정합: 매각 자산은 매각일 이후 추가 상각이 중단되지만, 과거 시점 결산 조회 시(asOfDate < disposalDate)에는 asOfDate 시점 기준으로 정상 상각되어야 함!
  let targetDate = asOfDate;
  if (asset.status === 'SOLD' && asset.disposalDate) {
    const parsedDisposal = new Date(asset.disposalDate);
    if (!isNaN(parsedDisposal.getTime())) {
      targetDate = parsedDisposal < asOfDate ? parsedDisposal : asOfDate;
    }
  }

  // 취득일자 Date 객체
  const acqDate = new Date(asset.acquisitionDate);
  if (isNaN(acqDate.getTime())) {
    return {
      accumDepreciation: asset.accumDepreciation || 0,
      bookValue: asset.bookValue ?? cost,
      elapsedMonths: 0,
      monthlyDepreciation: 0,
    };
  }

  // 경과 월수 계산 (IFRS 기준: 매월 말일 1개월 경과)
  let yearsDiff = targetDate.getFullYear() - acqDate.getFullYear();
  let monthsDiff = targetDate.getMonth() - acqDate.getMonth();
  let totalElapsed = yearsDiff * 12 + monthsDiff;

  if (targetDate.getDate() < acqDate.getDate() && totalElapsed > 0) {
    totalElapsed -= 1;
  }

  if (totalElapsed < 0) totalElapsed = 0;

  // 상각 개월수 캡 제한 (내용월수 초과 불가능)
  const effectiveElapsed = Math.min(totalElapsed, asset.depreciationMonths);

  // 감가상각누계액 (1원 단위 반올림)
  const accumDepn = Math.min(cost - residualValue, Math.round(monthlyDepn * effectiveElapsed));
  // 미상각 잔액 (장부가치)
  const bookVal = Math.max(residualValue, cost - accumDepn);

  return {
    accumDepreciation: accumDepn,
    bookValue: bookVal,
    elapsedMonths: effectiveElapsed,
    monthlyDepreciation: Math.round(monthlyDepn),
  };
}

export interface Consumable {
  id: string;
  modelName: string;
  stockQty: number; // 본사 중앙 창고 재고
  unit: string; // '개' | '박스' 등
  unitPrice: number;
  supplier: string;
  createdAt: string;
  updatedAt: string;
}

export interface MechanicConsumableStock {
  id: string;
  mechanicId: string; // 담당 정비사 ID
  consumableId: string; // 소모품 ID
  stockQty: number; // 기사 차량 내 현재 적재 수량
  updatedAt: string;
}

export interface ConsumableLog {
  id: string;
  consumableId: string;
  type: 'INBOUND' | 'OUTBOUND' | 'ADJUST' | 'TRANSFER_TO_VEHICLE' | 'RETURN_TO_HQ';
  quantity: number;
  unitPrice: number;
  supplier?: string;
  userId?: string;
  mechanicId?: string; // 차량 재고 이동 정비사
  fromLocation?: string; // 출처 (예: '본사 중앙창고', '김정비 차량')
  toLocation?: string; // 이동처 (예: '김정비 차량', '본사 중앙창고', '현장장비')
  targetAssetId?: string;
  actionDate: string;
  description: string;
  createdAt: string;
}

export interface ConsumablePurchaseRequest {
  id: string;
  consumableId?: string;
  modelName: string;
  requestedQty: number;
  unitPrice: number;
  requestDate: string;
  sellerName: string;
  status: 'REQUESTED' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';
  acceptedDate?: string;
  completedDate?: string;
  requesterId: string;
  requesterName: string; // 신청자 이름 (로그인 계정)
  accepterId?: string;
  accepterName?: string; // 접수자 이름 (로그인 계정)
  inbounderName?: string; // 입고 처리자 이름 (로그인 계정)
  receivedQty: number;
  statementFileUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContractAsset {
  id: string;
  contractId: string;
  assetId?: string;
  expectedModel?: string;
  status?: 'RENTED' | 'RETURNED' | 'ASSIGNED' | 'SOLD' | string;
  actualReturnDate?: string;
  monthlyRentalFee: number;
  dailyRentalFee: number;
  salePrice?: number; // 💡 자산 매각 계약 시 매각 공급가액
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt?: string;
}

export type ContractType = 'RENTAL' | 'SALE';

/** 자산 매각 계약 전용 실무 5대 조건 인터페이스 */
export interface SaleContractTerms {
  paymentType: 'LUMP_SUM' | 'INSTALLMENT'; // 일시불 | 분할 지급 (계약금+잔금)
  lumpSumDueTerm?: string; // 일시불 완납 기한 ('IMMEDIATE' | 'DELIVERY' | '7_DAYS' | '14_DAYS' | 'MONTH_10')
  installmentDownRate?: number; // 계약금 비율 (예: 20%)
  installmentDownAmount?: number; // 계약금 금액 (원)
  installmentDownDate?: string; // 계약금 납기일 (YYYY-MM-DD)
  installmentBalanceAmount?: number; // 잔금 금액 (원)
  installmentBalanceDueDate?: string; // 잔금 납기일 (YYYY-MM-DD)
  bankAccount?: string; // 입금 지정 계좌

  deliveryDate?: string; // 장비 인도 예정일 (YYYY-MM-DD)
  deliveryLocationType?: 'YARD' | 'BUYER_SITE'; // 당사 주기장 상차도(FOB) | 매수처 도착도
  deliverySiteAddress?: string; // 도착도 시 상세 주소
  freightBearer?: 'BUYER' | 'SELLER'; // 운송비 부담 주체: 매수자 부담(기본) | 당사(기연) 부담

  useStandardAsIsClause?: boolean; // 현상태 인수(As-Is) 및 하자담보책임 면책 특약 동의 여부
  specialNotes?: string; // 추가 특약 사항 전문
}

export interface Contract {
  id: string;
  contractNo: string;
  contractType?: ContractType; // 💡 신규 추가: 'RENTAL' (기본값) | 'SALE' (자산 매각 계약)
  saleTerms?: SaleContractTerms; // 💡 자산 매각 계약 전용 상세 조건
  customerId: string;
  contactId?: string;
  siteId?: string;
  startDate: string;
  endDate: string;
  billingDay: number; // 청구서 발행일 (예: 25 → 매월 25일 발행, 청구기간: 전월26~당월25)
  statementClosingDay?: number; // 거래명세서 마감일 (구버전 호환)
  lateInterestRate: number; // 연체이자율 (%), 기본값 0 = 미발생
  paymentDueDay?: number; // 납기일: 세금계산서 발행 익월 N일 (계약별 개별 지정)
  status: 'ACTIVE' | 'EXTENDED' | 'SHORTENED' | 'SUCCEEDED' | 'COMPLETED';
  successorContractId?: string;
  predecessorContractId?: string; // 승계 전 이전 계약 ID
  predecessorContractNo?: string; // 승계 전 이전 계약번호
  predecessorCustomerId?: string; // 승계 전 양도 고객사 ID
  predecessorCustomerName?: string; // 승계 전 양도 고객사명
  driveFolderId?: string;
  salespersonId?: string; // 계약담당자 (영업사원 ID)
  // 💡 직전 청구 마일스톤 메타데이터 (청구 발행 시 자동 트리거 갱신)
  lastBillingDate?: string; // 최근 렌탈료 청구 발행일 (YYYY-MM-DD)
  lastBilledPeriodStart?: string; // 최근 청구 시작일 (YYYY-MM-DD)
  lastBilledPeriodEnd?: string; // 최근 청구 종료일 (YYYY-MM-DD)
  lastBilledYm?: string; // 최근 청구 귀속월 (YYYY-MM)
  billingCount?: number; // 누적 발행 청구 건수
  createdAt: string;
  updatedAt: string;
  // 가상필드 (조인 시)
  assets?: ContractAsset[];
}

export interface ContractHistory {
  id: string;
  contractId: string;
  changeType: 'REGISTER' | 'EXTEND' | 'SHORTEN' | 'SUCCEED' | 'TERMINATE' | 'EXCHANGE' | 'FEE_CHANGE' | 'AS_SERVICE'
           | 'BILLING_CREATED' | 'BILLING_SENT' | 'BILLING_CANCELLED' | 'BILLING_REGENERATED' | 'PAYMENT_RECEIVED' | 'PAYMENT_CANCELLED' | 'DOCUMENT_SENT' | 'ASSET_SOLD';
  changeDate: string;
  prevEndDate?: string;
  newEndDate?: string;
  description: string;
  createdAt: string;
}

export interface BillingDetail {
  id: string;
  billingId: string;
  contractAssetId?: string;
  assetId?: string;
  receivableId?: string; // 외상미수금 연동 ID
  itemName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  description?: string; // 구버전 호환
  internalDescription?: string; // 내부 장부 기재명 (실제 발생 내용)
  displayName?: string; // 거래명세서 표기명 (NULL이면 itemName 사용)
  createdAt: string;
  updatedAt?: string;
}

/** 청구 인보이스 — 동일 고객의 복수 계약 청구를 단일 청구서/거래명세서로 통합하는 단위 */
export interface BillingInvoice {
  id: string;                  // 'INV-YYYYMM-NNNN'
  customId?: string;           // 세금계산서 번호 등 외부 식별자
  customerId: string;          // FK → customers
  billingYm: string;           // 'YYYY-MM' 청구 귀속월
  siteId?: string;             // null=고객 전체 통합, 값=현장 단위 분리
  totalAmount: number;         // 포함된 billings 합계
  vatAmount: number;           // 부가세 (기본 0, 필요 시 별도 입력)
  grandTotal: number;          // totalAmount + vatAmount
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'PARTIAL' | 'CANCELLED';
  dueDate?: string;            // 납기일
  issuedAt?: string;           // 실제 발행일시
  memo?: string;
  createdAt: string;
  updatedAt: string;
  // 가상 필드 (조인 시)
  billings?: Billing[];
}

export type BillingType = 'RENTAL' | 'REPAIR' | 'TRANSPORT' | 'ASSET_SALE';

export interface Billing {
  id: string;
  billingType?: BillingType; // 💡 신규 추가: 'RENTAL' (기본값) | 'REPAIR' | 'TRANSPORT' | 'ASSET_SALE' (자산매각)
  customerId: string;
  contractId?: string; // 연결된 계약 ID (개별 계약 정산용)
  invoiceId?: string;  // FK → billing_invoices (통합 인보이스 묶음, null=단독 청구)
  billingYm: string; // 'YYYY-MM'
  billingDate: string;
  totalAmount: number;
  paidAmount: number;
  status: 'REQUESTED' | 'REJECTED' | 'UNPAID' | 'PARTIAL' | 'PAID';
  rejectReason?: string; // 반려 사유
  createdAt: string;
  updatedAt: string;
  // 가상필드
  details?: BillingDetail[];
}


/** 외상미수금 대장 — 운송료·수리비·청소비·타사구상금 분할 청산 관리 */
export interface Receivable {
  id: string;
  contractId?: string;
  customerId?: string;
  type: 'TRANSPORT' | 'REPAIR' | 'CLEANING' | 'VENDOR_CLAIM' | 'OTHER';
  totalAmount: number;        // 외상 총액
  billedAmount: number;       // 청구된 누적 금액
  // remainingAmount = totalAmount - billedAmount (계산값)
  internalDescription: string; // 내부 장부 기재명
  displayName?: string;        // 명세서 표기명 (NULL이면 internalDescription 사용)
  occurredDate: string;        // 발생일
  status: 'PENDING' | 'PARTIAL' | 'CLEARED';
  repairId?: string;           // 수리비 연동 시 repairs.id
  vendorName?: string;         // 타사 구상금인 경우 원사명
  assetNo?: string;            // 대상 장비번호
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  billingId: string;
  paymentDate: string;
  amount: number;
  method: string; // 'BANK_TRANSFER' | 'CARD' | 'CASH'
  memo: string;
  createdAt: string;
  updatedAt?: string;
}

/** 통장입금-수납 마늤투마니 연결 테이블 (1건 수납 : N건 입금건) */
export interface PaymentDepositLink {
  id: string;
  paymentId: string;           // FK → Payment
  bankTransactionId: string;   // FK → BankTransaction (isDeposit=true)
  usedAmount: number;          // 이 수납에서 해당 입금건에서 소진한 금액
  createdAt: string;
}

export type DeliveryStatus = 'PENDING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED' | 'REQUESTED' | 'COMPLETED';

export interface Delivery {
  id: string;
  contractId?: string;
  assetIds?: string; // 대상 장비 ID 목록 (콤마 구분)
  type: 'OUTBOUND' | 'INBOUND' | 'EXCHANGE' | 'MOVEMENT' | 'RETURN'; // OUTBOUND: 출고, INBOUND: 회수, EXCHANGE: 단일 교환(왕복) 배차
  dispatchCategory?: '출고' | '입고' | '반납' | '정비' | '이동' | '교환'; // 배차 세부 유형
  status: DeliveryStatus; // 배차 4단계 진행상태 (PENDING: 배차전, DISPATCHED: 배차완료, DELIVERED: 운송완료, CANCELLED: 배차취소)
  requestDate: string;
  scheduledDate?: string;
  loadingDate?: string; // 상차 일자 (YYYY-MM-DD)
  loadingTimeSlot?: string; // 상차 시간 구분 (오전/오후/희망시간)
  unloadingDate?: string; // 하차 일자 (YYYY-MM-DD)
  unloadingTimeSlot?: string; // 하차 시간 구분 (오전/오후/희망시간)
  originAddress?: string; // 상차지
  pickupType?: 'HQ_YARD' | 'VENDOR_YARD' | 'CUSTOMER_SITE'; // 상차 구분
  pickupVendorName?: string; // 타사 주기장명 (타사 직출고 시)
  destinationAddress?: string; // 하차지
  dropoffType?: 'CUSTOMER_SITE' | 'HQ_YARD' | 'VENDOR_YARD' | 'MULTI_STOP'; // 하차 구분
  viaDropoffAddress?: string; // 1차 경유 하차지 주소 (혼적 회수 시)
  viaDropoffName?: string; // 1차 경유지명 (예: 기연 본사 주기장)
  transportCompany?: string; // 운송 거래처 (월 마감 및 정산용)
  vehicleType?: string; // 예: 1톤, 2.5톤 등
  vehicleNo?: string; // 차량 번호
  driverName?: string;
  driverContact?: string;
  deliveryCost: number; // 최초 예상 운송비
  expectedCost?: number; // 최초 예상 운송비 별칭
  deliveryCostConfirmed?: number; // 최종 확정 운송비
  finalCost?: number; // 최종 확정 운송비 별칭
  costAdjustmentReason?: string; // 운송비 조정/할증/할인 사유
  reconciliationStatus?: 'PENDING' | 'MATCHED' | 'MISMATCH' | 'RECONCILED' | 'PAYMENT_REQUESTED' | 'PAID'; // 대사 및 지급 상태
  reconciledAt?: string;
  paymentRequestedAt?: string;
  paymentCompletedAt?: string;
  statementFileUrl?: string; // 거래명세서 증빙 파일 URL
  billableToCustomer?: boolean; // 고객 청구 여부
  billableCustomerId?: string; // 청구 대상 고객사 ID
  assignedVehicles?: any[]; // 배정 차량 목록 배열
  vehicleRequirements?: string; // 차량 종류별 대수 지정 JSON: [{ vehicleType: string, count: number }]
  cargoItems?: string; // 운반 장비 명세 JSON: [{ modelName: string, count: number }]
  isCostSettled?: boolean;
  rawText?: string; // 스마트 출고 시 입력된 자연어 원문 텍스트
  memo: string;
  closingMemo?: string; // 실무자 마감 비고
  vehicles?: string; // 여러 차량 배차 정보를 위한 JSON 문자열 필드
  createdAt: string;
  updatedAt: string;
}

export interface TransportCompany {
  id: string;
  name: string;
  businessNo: string;
  contact: string;
  bankName?: string; // 계좌 은행
  bankAccount?: string; // 계좌 번호
  bankHolder?: string; // 예금주
  memo: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Vendor {
  id: string;
  name: string;
  type: 'TRANSPORT' | 'RENTAL' | 'REPAIR' | 'PURCHASE' | 'CONSUMABLE' | 'OTHER';
  types?: ('TRANSPORT' | 'RENTAL' | 'REPAIR' | 'PURCHASE' | 'CONSUMABLE' | 'OTHER')[];
  bizRegNo?: string;
  representative?: string;
  contactName?: string;
  contact?: string;
  email?: string;
  address?: string;
  bankAccount?: string;
  isActive?: boolean;
  memo?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TransportDriver {
  id: string;
  companyId: string; // TransportCompany.id
  driverName: string;
  driverContact: string;
  idNo?: string; // 주민등록번호 (000000-0* 7자리 규격)
  address?: string; // 기사 주소
  vehicleNo: string;
  vehicleType: string;
  vehicleColor?: string; // 차량 색상
  createdAt: string;
  updatedAt?: string;
}

export interface RepairConsumable {
  id: string;
  repairId: string;
  consumableId: string;
  quantity: number;
  unitPrice: number;
  cost: number;
}

export interface RepairPartUsed {
  consumableId: string;
  modelName: string;
  quantity: number;
  unitPrice: number;
  stockSource?: 'VEHICLE_VAN' | 'CENTRAL_HQ';
}

export interface RepairCollectedPart {
  partName: string;
  quantity: number;
  status: 'IN_VEHICLE' | 'YARD_RETURNED' | 'DISPOSED'; // 차량보관 | 주기장반납 | 폐기
  returnedAt?: string;
  memo?: string;
}

// 💡 [전사 정비 & AS 단일 물리 통합 인터페이스 (1-A 원칙)]
export interface Repair {
  id: string;
  ticketNo?: string; // 예: AS-260902-001 또는 REP-260902-001
  
  // 1. 업무 분류 및 장소
  workCategory?: 'FIELD_AS' | 'YARD_INTERNAL' | 'PREVENTIVE' | 'EXTERNAL_VENDOR'; // 외근AS | 주기장정비 | 예방정비 | 외주정비
  workLocation?: 'SITE' | 'YARD' | 'VENDOR_SHOP';                                  // 현장 | 주기장 | 외주처
  stockSource?: 'VEHICLE_VAN' | 'CENTRAL_HQ' | 'DIRECT_PURCHASE';                  // 기사차량 | 본사창고 | 현장구매
  source?: 'SALES_REQUEST' | 'DIRECT_INTAKE' | 'INBOUND_INSPECTION' | 'BAND_IMPORT';
  repairType?: 'INTERNAL' | 'EXTERNAL';
  maintenanceType?: 'EMERGENCY_AS' | 'PREVENTIVE' | 'INHOUSE_REPAIR' | 'EXTERNAL'; // 레거시 호환
  
  // 2. 대상 자산 및 계약 정보
  assetId?: string;
  assetNo?: string;
  modelName?: string;
  contractId?: string; // 🌟 소속 계약 ID (계약별 AS 이력 1:1 매핑)
  targetContractStatus?: string;
  targetAssetStatus?: Asset['status']; // 🌟 정비 완료 시 자산 상태 전이 (AVAILABLE, REPAIRING 등)
  
  // 3. 고객사 및 현장 정보
  customerId?: string;
  customerName?: string;
  siteId?: string;
  siteName?: string;
  siteAddress?: string; // 🌟 도로명 상세주소 (T맵/내비/지도 자동 길안내 SSOT)
  locationDetail?: string; // 예: 팹동 8층 X27 Y17
  reporterName?: string;
  reporterContact?: string;
  
  // 4. 고장 증상 및 정비 내용
  issueCategory?: string;
  inspectionItemCode?: string; // [NEW] 정비 항목 코드 맵핑 (e.g. CHK-000003)
  degradationScore?: number;   // [NEW] 자산 노후도 누적 점수 (e.g. +15)
  issueDescription?: string;
  details: string; // 레거시 details 호환
  errorCode?: string;
  priority?: 'NORMAL' | 'URGENT';
  
  // 5. 정비자 및 일정
  mechanicId?: string;
  assignedMechanicId?: string; // mechanicId 동의어
  mechanicName?: string;
  vendorId?: string;
  requestDate: string;
  scheduleDate?: string;
  visitDate?: string;
  repairDate?: string;
  completedDate?: string;
  outboundDate?: string;
  
  // 6. 상태 머신 및 다형성 완료 판정
  status: 'REQUESTED' | 'SCHEDULED' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REVISIT' | 'GUIDED' | 'UNRESOLVED' | 'CANCELED';
  resolutionType?: 
    | 'REPAIR_DONE'
    | 'REVISIT_NEEDED'
    | 'GUIDED_END'
    | 'EXCHANGE_SUGGESTED'
    | 'YARD_REPAIRED'
    | 'SCRAP_CANDIDATE'
    | 'EXTERNAL_OUTSOURCE';
  unresolvedReason?: string;
  nextAction?: 'REVISIT' | 'EXCHANGE_REQUEST' | 'NONE';
  
  // 7. 조치 및 부품
  actionTaken?: string;
  partsUsed?: RepairPartUsed[];
  collectedParts?: RepairCollectedPart[];
  consumables?: RepairConsumable[];
  
  // 8. 비용 및 청구
  billableType?: 'FREE' | 'BILLABLE';
  billableAmount?: number;
  billableToCustomer?: boolean;
  totalCost?: number;
  billingId?: string;
  purchaseBillId?: string;
  isCustomerFault?: boolean;
  
  // 9. 증빙 및 연계
  faultImageUrl?: string;
  evidenceImages?: string[];
  beforeImage?: string;
  afterImage?: string;
  estimateFileUrl?: string;
  customerSignature?: string;
  customerConfirmName?: string;
  parentRepairId?: string;
  parentTicketId?: string; // 호환용
  revisitRepairId?: string;
  revisitTicketId?: string; // 호환용
  revisitDate?: string;
  revisitReason?: string;
  exchangeSuggested?: boolean;
  
  inboundNo?: string;
  defectsJson?: string;
  memo?: string;
  timelineEvents?: RepairTimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface RepairTimelineEvent {
  id: string;
  eventType: 'CALL_MADE' | 'TRANSIT_START' | 'ARRIVED' | 'COMPLETED';
  label: string;
  mechanicId: string;
  mechanicName: string;
  detail?: string;
  timestamp: string;
}

// 💡 호환용 타입 알리아스 (단일 물리 테이블: repairs)
export type FieldAsTicket = Repair;
export type FieldAsPartUsed = RepairPartUsed;
export type FieldAsCollectedPart = RepairCollectedPart;

export interface InspectionChecklistItem {
  id: string;
  category: string;
  code: string;
  name: string;
  score: number;
  description?: string;
  createdAt: string;
}

export interface Todo {
  id: string;
  userId: string;
  type: 'MISSING_INFO' | 'GENERAL';
  title: string;
  content: string;
  isCompleted: boolean;
  relatedEntityId?: string; // 고객사 ID 등
  createdAt: string;
}

export interface PrepaidTransaction {
  id: string;
  customerId: string;
  type: 'CHARGE' | 'USE_FOR_BILLING' | 'REFUND';
  amount: number;
  balanceAfter: number;
  billingId?: string;
  paymentId?: string;
  bankTransactionId?: string;
  memo?: string;
  createdAt: string;
}

export interface LegalNoticeLog {
  id: string;
  customerId: string;
  customerName: string;
  representative: string;
  bizRegNo?: string;
  address: string;
  overdueAmount: number;
  overdueDays: number;
  noticeTitle: string;
  noticeContent: string;
  deadlineDays: number;
  sentDate: string;
  sentByUserId: string;
  sentByName: string;
  postalTrackingNo?: string;
  createdAt: string;
}

export interface LegalNoticeTemplate {
  id: string;
  title: string;
  content: string;
  deadlineDays: number;
  updatedAt: string;
}

export interface DelinquencyActionLog {
  id: string;
  customerId: string;
  actionType: 'CALL' | 'NOTICE_SENT' | 'VISIT' | 'LEGAL' | 'DIRECTIVE';
  actionDetails: string;
  proofFileName?: string;
  recordedBy: string;
  mandateType: 'CEO_AUTO_MANDATE';
  promiseDate?: string;
  promiseAmount?: number;
  promiseStatus?: 'PENDING' | 'KEPT' | 'BROKEN';
  promiseContactPerson?: string;
  directiveTargetUserId?: string;
  directiveDueDate?: string;
  createdAt: string;
}

export interface BankTransaction {
  id: string;
  bankName?: string;       // 은행명 ('우리은행' | '신한은행' 등)
  accountNumber?: string;  // 당사 계좌번호
  transactionDate: string; // 'YYYY-MM-DD HH:mm:ss'
  summary?: string;        // 적요/거래구분 (인터넷, CMS, FB자동 등)
  counterparty?: string;   // 기재내용/내용 (실질적 입금자명 / 거래상대방)
  senderName: string;      // 이체자/입금자명 (기존 호환용, counterparty와 동동)
  senderAccount?: string;  // 입금자 계좌번호 (기본값 null)
  depositAmount: number;   // 입금액 (매출 수납용)
  withdrawAmount: number;  // 출금액
  balance?: number;        // 거래후 잔액
  branchName?: string;     // 취급점 / 거래점명
  memo: string;            // 거래 메모
  matchedBillingId?: string; // 매칭된 청구서 ID (비어 있으면 미매칭)
  matchingType?: 'AUTO' | 'MANUAL';
  createdAt: string;
  // 수납 연동 확장 필드
  customerId?: string;     // 매핑된 고객사 ID (수납 잔액 추적용)
  isDeposit?: boolean;     // true: 입금내역 (수납 재원), false: 일반 거래내역
}

export interface BankMatchingRule {
  id: string;
  senderName: string; // 이체자명
  customerId: string; // 매핑된 고객사 ID
  createdAt: string;
  updatedAt?: string;
}

export interface BankAccountInitialBalance {
  id: string;             // 'bank-init-우리은행'
  bankName: string;       // '우리은행' | '신한은행' 등
  accountNumber?: string; // 계좌번호
  initialBalance: number; // 기초 시작 잔액 (원)
  updatedAt: string;
}

export interface GoogleConfig {
  id: string;
  googleEmail: string;
  googlePassword?: string;
  gmailAppPassword?: string;
  contractFolder: string;
  consumableFolder: string;
  deliveryFolder: string;
  maintenanceFolder: string;
  isDevMode: boolean;
  currentInsuranceStartDate?: string;
  currentInsuranceEndDate?: string;
  nextInsuranceCertUrl?: string;
  nextInsuranceStartDate?: string;
  nextInsuranceEndDate?: string;

  mirrorRecursive?: boolean; // 하위 폴더 재귀 미러링 여부
  // ── Cloudflare R2 클라우드 스토리지 설정 ──
  r2AccountId?: string;      // Cloudflare 32자리 Account ID
  r2BucketName?: string;     // R2 버킷명 (예: kiyeun-storage)
  r2AccessKeyId?: string;    // R2 S3 Access Key ID
  r2SecretAccessKey?: string;// R2 S3 Secret Access Key
  r2PublicDomain?: string;   // R2 공개 URL (예: https://pub-xxxx.r2.dev)
  createdAt?: string;
  updatedAt: string;
}

export interface CashFlowSnapshot {
  id: string;
  snapshotDate: string; // 스냅샷 작성일 (YYYY-MM-DD)
  startingBalance: number; // 스냅샷 시점의 통장 총잔액
  projectedInflow: number; // 향후 30일 수납 예정액
  projectedOpex: number; // 향후 30일 일반 지출예정액
  projectedCapex: number; // 향후 30일 CAPEX 지출예정액
  projectedFinalBalance: number; // 30일 후 최종 예상잔액
  notes?: string; // 경영자 의사결정 코멘트
  createdAt: string;
}

export interface InboundDefectDetail {
  subNo?: string; // 입고하위번호 (예: INB-20260809-001-01)
  checkitemId: string;
  checkitemName: string;
  score: number;
  photoUrl?: string; // 모바일 촬영 또는 PC 업로드 파일 URL
}

export interface AssetInOutLog {
  id: string;
  assetId: string;
  assetNo: string;
  modelName: string;
  type: 'ACQUISITION' | 'OUTBOUND' | 'INBOUND' | 'INBOUND_CANCEL' | 'REPAIR' | 'DISPOSAL'; // 취득등록, 출고, 입고, 입고취소롤백, 정비, 매각
  inboundNo?: string; // 입고 고유 번호 (예: INB-20260809-001)
  eventDate: string; // YYYY-MM-DD
  customerId?: string;
  customerName?: string;
  siteId?: string;
  siteName?: string;
  deliveryId?: string;
  repairId?: string;
  maintenanceScore?: number;
  defectsJson?: string; // InboundDefectDetail[] JSON 문자열
  memo?: string;
  createdAt?: string;
}

export type OutboundInspectionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

export interface OutboundInspection {
  id: string;
  contractId?: string;
  contractAssetId?: string;
  assetId?: string;
  deliveryId?: string;
  status: OutboundInspectionStatus;
  specsJson?: string;
  inspectorId?: string;
  inspectedAt?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DepreciationLog {
  id: string;
  depreciationYm: string;
  executedAt: string;
  executedBy?: string;
  targetAssetCount: number;
  totalDepreciationAmount: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// 월말 매입 정산 (Purchase Settlement)
// ============================================================

export type PurchaseSettlementType = 'TRANSPORT' | 'CONSUMABLE' | 'EQUIPMENT_LEASE' | 'EXTERNAL_REPAIR';
export type PurchaseSettlementStatus = 'PENDING' | 'CONFIRMED' | 'PAID';

/** 월말 매입 정산 헤더 — 매입처 × 정산 연월 단위 통합 집계 */
export interface PurchaseSettlement {
  id: string;                          // PST-YYMM0001 형식
  settlementYm: string;                // 정산 연월 YYYY-MM
  settlementType: PurchaseSettlementType;
  vendorId?: string;                   // 매입처 ID (TransportCompany.id or Vendor.id)
  vendorName: string;                  // 매입처명
  totalAmount: number;                 // 총 청구액
  paidAmount: number;                  // 지급 완료액
  status: PurchaseSettlementStatus;
  paymentDate?: string;                // 최종 지급 완료일
  paymentMethod?: string;              // 지급 수단
  bankAccount?: string;                // 지급 계좌번호
  bankTransactionId?: string;          // 통장 출금 연결 ID (감사 대사 Audit Trail용)
  confirmedAt?: string;                // 정산 확정 일시
  confirmedBy?: string;                // 정산 확정자 이름
  itemCount?: number;
  memo?: string;
  createdAt: string;
  updatedAt?: string;
}

/** 정산 라인 아이템 — 원천 건(배차 / 구매신청 / 임차 / 외주정비)과 1:1 연결 */
export interface PurchaseSettlementItem {
  id: string;
  settlementId: string;                // FK → PurchaseSettlement.id
  sourceType: 'DELIVERY' | 'CONSUMABLE_PURCHASE' | 'EQUIPMENT_LEASE' | 'REPAIR';
  sourceId: string;                    // 원천 ID
  itemDescription: string;            // 내역 설명
  quantity: number;                    // 수량 or 가동일수
  unitPrice: number;                   // 단가 or 일할료
  amount: number;                      // 금액
  evidenceFileUrl?: string;            // 증빙 파일 URL
  createdAt: string;
}

/** 정산 지급/수납 분할 이력 레코드 — 통장 출금 1건 ↔ 정산 항목들 1:N 감사 대사 연결 */
export interface SettlementPaymentLog {
  id: string;                          // SPL-YYMM0001
  settlementId: string;                // FK → PurchaseSettlement.id
  bankTransactionId?: string;          // FK → BankTransaction.id
  paidAmount: number;                  // 이번 지급 금액
  paymentDate: string;                 // 지급일
  paymentMethod: string;               // 지급 수단
  bankAccount?: string;                // 지급 계좌
  memo?: string;                       // 비고
  createdAt: string;
}

/** 임차(전대)장비 임차 계약 — Phase 2 */
export interface ExternalLease {
  id: string;
  vendorId: string;                    // 임차사 ID (Vendor[RENTAL])
  contractId: string;                  // 연결 계약 ID
  contractAssetId?: string;            // 연결 계약 자산 슬롯 ID
  assetDescription: string;            // 임차 장비 사양/모델명
  monthlyRentFee: number;              // 월 임차료
  dailyRentFee: number;                // 일할 임차료
  leaseStartDate: string;              // 임차 시작일 (출고 완료일)
  leaseEndDate?: string;               // 임차 종료일 (반납 완료일)
  status: 'ACTIVE' | 'RETURNED';
  statementFileUrl?: string;           // 임차사 거래명세서 증빙
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

/** 로컬 사이드카 에이전트 레지스트리 */
export interface AgentRegistryItem {
  callsign: string;                    // 고유 콜사인 (로그인 아이디)
  userId?: string;                     // 연동 사용자 ID
  machineName?: string;                // 컴퓨터 이름
  isMaster?: boolean;                  // 마스터 대행 여부
  status: 'ONLINE' | 'BUSY' | 'OFFLINE';
  lastHeartbeat: string;
  createdAt?: string;
  updatedAt?: string;
}

/** 문서 생산 작업 큐 */
export interface DocumentJob {
  id: string;                          // JOB-YYMMDD-0001
  jobType: 'CONTRACT_BUNDLE' | 'CHECKLIST' | 'SAFETY_INSPECTION' | 'ZIP_BACKUP';
  contractId?: string;
  targetCallsign?: string;             // 우선 처리 대상 콜사인
  assignedCallsign?: string;           // 실제 락 획득 에이전트
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  payload: any;                        // 작업 상세 페이로드
  resultUrl?: string;                  // 클라우드 완성본 URL
  localFilePath?: string;              // 로컬 문서고 저장 경로
  errorMessage?: string;
  createdAt: string;
  lockedAt?: string;
  completedAt?: string;
}

// ============================================================
// 7. 법인 차량 및 차량운행일지/주유 영수증 관리 (Corporate Fleet & Logs)
// ============================================================

export type CorporateVehicleType = '승합차' | '화물/탑차' | '승용차' | '전기차';
export type CorporateVehicleOwnership = 'OWNED' | 'LEASE' | 'RENTAL';
export type CorporateVehicleFuelType = 'DIESEL' | 'GASOLINE' | 'LPG' | 'HYBRID' | 'ELECTRIC';

export interface CorporateVehicle {
  id: string;
  vehicleNo: string;
  modelName: string;
  vehicleType: CorporateVehicleType;
  ownershipType: CorporateVehicleOwnership;
  fuelType: CorporateVehicleFuelType;
  assignedDepartment: string;
  primaryDriverId?: string;
  primaryDriverName?: string;
  initialMileage: number;
  currentMileage: number;
  insuranceExpiryDate?: string;
  inspectionExpiryDate?: string;
  isActive: boolean;
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

export type OperationPurposeType = 'COMMUTE' | 'BUSINESS_GENERAL' | 'CLIENT_MEETING' | 'SITE_AS' | 'LOGISTICS_DELIVERY' | 'OTHER';
export type OperationLogStatus = 'SUBMITTED' | 'CONFIRMED' | 'REJECTED';

export interface VehicleOperationLog {
  id: string;
  vehicleId: string;
  vehicleNo: string;
  driverId: string;
  driverName: string;
  driverDept?: string;
  operationDate: string; // YYYY-MM-DD
  purposeType: OperationPurposeType;
  purposeDetail?: string;
  departureLocation: string;
  arrivalLocation: string;
  departureMileage: number;
  arrivalMileage: number;
  driveDistance: number; // arrivalMileage - departureMileage
  businessDistance: number;
  commuteDistance: number;
  dashboardPhotoStart?: string;
  dashboardPhotoEnd?: string;
  memo?: string;
  status: OperationLogStatus;
  confirmedBy?: string;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleFuelLog {
  id: string;
  vehicleId: string;
  vehicleNo: string;
  driverId: string;
  driverName: string;
  fuelDate: string; // YYYY-MM-DD HH:mm or YYYY-MM-DD
  fuelType: string;
  fuelVolume: number; // 리터 L
  fuelAmount: number; // 금액 ₩
  fuelUnitPrice?: number; // ₩/L
  currentMileage: number; // 주유 시 계기판 km
  dashboardPhotoUrl?: string; // 계기판 사진 URL / Base64
  receiptPhotoUrl: string; // 영수증 사진 URL / Base64
  gasStationName?: string;
  paymentMethod?: string; // CORPORATE_CARD, PERSONAL_EXPENSE
  cardLast4?: string;
  fuelEfficiency?: number; // km/L
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

// 초기 로컬 스토리지 데이터 생성

const generateMockProducts = (): Product[] => {
  return [
    {
        "id": "prod-001",
        "modelName": "JCPT0607DCS",
        "feet": 20,
        "spec": "배터리, 5.6 M, 적재 240 kg",
        "manufacturer": "DINGLI",
        "powerSource": "배터리",
        "workingHeight": "5.6 M",
        "platformHeight": "3.6 M",
        "weight": "880 Kg",
        "capacityPreExt": "240 kg",
        "machineDimensions": "1.44x 0.76 x 1.90 M",
        "platformDimensions": "1.29x 0.70 M",
        "gradeability": "° 15 %",
        "speed": "4 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "140 kg",
        "capacityPostExtDeck": "100 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-002",
        "modelName": "JCPT0807AC",
        "feet": 20,
        "spec": "배터리, 7.8 M, 적재 230 kg",
        "manufacturer": "DINGLI",
        "powerSource": "배터리",
        "workingHeight": "7.8 M",
        "platformHeight": "6 M",
        "weight": "1,630 Kg",
        "capacityPreExt": "230 kg",
        "machineDimensions": "1.86 x 0.76 x 2.02 M",
        "platformDimensions": "1.67 x 0.74 M",
        "gradeability": "25 %",
        "speed": "4.5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "117 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-003",
        "modelName": "JCPT1008AC",
        "feet": 32,
        "spec": "배터리, 10 M, 적재 230 kg",
        "manufacturer": "DINGLI",
        "powerSource": "배터리",
        "workingHeight": "10 M",
        "platformHeight": "8 M",
        "weight": "2,230 Kg",
        "capacityPreExt": "230 kg",
        "machineDimensions": "2.48 x 0.83 x 2.36 M",
        "platformDimensions": "2.27 x 0.81 M",
        "gradeability": "% 25 %",
        "speed": "5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "117 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-004",
        "modelName": "JCPT1012AC",
        "feet": 32,
        "spec": "배터리, 10.0 M, 적재 450 kg",
        "manufacturer": "DINGLI",
        "powerSource": "배터리",
        "workingHeight": "10.0 M",
        "platformHeight": "8.0 M",
        "weight": "2,710 Kg",
        "capacityPreExt": "450 kg",
        "machineDimensions": "2.48 x 1.15 x 2.36 M",
        "platformDimensions": "1.15 x 2.27 M",
        "gradeability": "% 25 %",
        "speed": "5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "337 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-005",
        "modelName": "S1008AC+",
        "feet": 32,
        "spec": "배터리, 10 M, 적재 272 kg",
        "manufacturer": "DINGLI",
        "powerSource": "배터리",
        "workingHeight": "10 M",
        "platformHeight": "8 M",
        "weight": "2,230 Kg",
        "capacityPreExt": "272 kg",
        "machineDimensions": "2.48 x 0.83 x 2.36 M",
        "platformDimensions": "2.27 x 0.81 M",
        "gradeability": "% 25 %",
        "speed": "6 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "159 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-006",
        "modelName": "S1012AC+",
        "feet": 32,
        "spec": "배터리, 10 M, 적재 450 kg",
        "manufacturer": "DINGLI",
        "powerSource": "배터리",
        "workingHeight": "10 M",
        "platformHeight": "8 M",
        "weight": "2,750 Kg",
        "capacityPreExt": "450 kg",
        "machineDimensions": "2.48 x 1.15 x 2.36 M",
        "platformDimensions": "2.27 x 1.12 M",
        "gradeability": "% 25 %",
        "speed": "3 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "337 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-007",
        "modelName": "JCPT1212AC",
        "feet": 39,
        "spec": "배터리, 12.0 M, 적재 320 kg",
        "manufacturer": "DINGLI",
        "powerSource": "배터리",
        "workingHeight": "12.0 M",
        "platformHeight": "10.0 M",
        "weight": "3,060 Kg",
        "capacityPreExt": "320 kg",
        "machineDimensions": "2.48 x 1.15 x 2.49 M",
        "platformDimensions": "2.27 x 1.12 M",
        "gradeability": "% 25 %",
        "speed": "3.5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "207 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-008",
        "modelName": "S1212AC+",
        "feet": 39,
        "spec": "배터리, 12 M, 적재 408 kg",
        "manufacturer": "DINGLI",
        "powerSource": "배터리",
        "workingHeight": "12 M",
        "platformHeight": "10 M",
        "weight": "3,060 Kg",
        "capacityPreExt": "408 kg",
        "machineDimensions": "2.48 x 1.15 x 2.49 M",
        "platformDimensions": "2.27 x 1.12 M",
        "gradeability": "% 25 %",
        "speed": "3 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "295 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-009",
        "modelName": "JCPT1412AC",
        "feet": 45,
        "spec": "배터리, 13.8 M, 적재 320 kg",
        "manufacturer": "DINGLI",
        "powerSource": "배터리",
        "workingHeight": "13.8 M",
        "platformHeight": "11.8 M",
        "weight": "2,990 Kg",
        "capacityPreExt": "320 kg",
        "machineDimensions": "2.84 x 1.19 x 2.62 M",
        "platformDimensions": "2.48 x 2.62 M",
        "gradeability": "% 25 %",
        "speed": "3.5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "207 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-010",
        "modelName": "S1412AC+",
        "feet": 45,
        "spec": "배터리, 13.8 M, 적재 408 kg",
        "manufacturer": "DINGLI",
        "powerSource": "배터리",
        "workingHeight": "13.8 M",
        "platformHeight": "11.8 M",
        "weight": "3,250 Kg",
        "capacityPreExt": "408 kg",
        "machineDimensions": "M",
        "platformDimensions": "2.27 x 1.12 M",
        "gradeability": "25 %",
        "speed": "6.0 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "295 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-011",
        "modelName": "JCPT1614ACZ",
        "feet": 53,
        "spec": "배터리, 15.7 M, 적재 350 kg",
        "manufacturer": "DINGLI",
        "powerSource": "배터리",
        "workingHeight": "15.7 M",
        "platformHeight": "13.7 M",
        "weight": "3,470 Kg",
        "capacityPreExt": "350 kg",
        "machineDimensions": "2.84 x 1.39 x 2.62 M",
        "platformDimensions": "2.64 x 1.12 M",
        "gradeability": "% 25 %",
        "speed": "3 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "237 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "16.0 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-012",
        "modelName": "S1612AC+",
        "feet": 53,
        "spec": "배터리, 15.7 M, 적재 363 kg",
        "manufacturer": "DINGLI",
        "powerSource": "배터리",
        "workingHeight": "15.7 M",
        "platformHeight": "13.7 M",
        "weight": "3,520 Kg",
        "capacityPreExt": "363 kg",
        "machineDimensions": "2.84 x 1.25 x 2.62 M",
        "platformDimensions": "2.64 x 1.12 M",
        "gradeability": "% 25 %",
        "speed": "6 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "227 kg",
        "capacityPostExtDeck": "136 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-013",
        "modelName": "S1614AC+",
        "feet": 53,
        "spec": "배터리, 15.7 M, 적재 363 kg",
        "manufacturer": "DINGLI",
        "powerSource": "배터리",
        "workingHeight": "15.7 M",
        "platformHeight": "13.7 M",
        "weight": "3,500 Kg",
        "capacityPreExt": "363 kg",
        "machineDimensions": "2.84 x 1.39 x 2.62 M",
        "platformDimensions": "2.64 x 1.12 M",
        "gradeability": "% 25 %",
        "speed": "5.5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "250 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-014",
        "modelName": "GS-1330m",
        "feet": 13,
        "spec": "배터리, 5.7 M, 적재 227 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "5.7 M",
        "platformHeight": "3.9 M",
        "weight": "902 Kg",
        "capacityPreExt": "227 kg",
        "machineDimensions": "1.41 x 0.78 x 1.83 M",
        "platformDimensions": "1.26 x 0.67 M",
        "gradeability": "25 %",
        "speed": "4 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "136 kg",
        "capacityPostExtDeck": "91 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-015",
        "modelName": "GS-1432",
        "feet": 14,
        "spec": "배터리, 6.3 M, 적재 227 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "6.3 M",
        "platformHeight": "4.3 M",
        "weight": "900 Kg",
        "capacityPreExt": "227 kg",
        "machineDimensions": "1.40 x 0.81 x 1.88 M",
        "platformDimensions": "1.40 x 0.78 M",
        "gradeability": "25 %",
        "speed": "4 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "114 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-016",
        "modelName": "GS-1930",
        "feet": 19,
        "spec": "배터리, 7.8 M, 적재 227 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "7.8 M",
        "platformHeight": "5.8 M",
        "weight": "1226 Kg",
        "capacityPreExt": "227 kg",
        "machineDimensions": "1.83 x 0.77 x 2.16 M",
        "platformDimensions": "1.64 x 0.76 M",
        "gradeability": "25 %",
        "speed": "4 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "114 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-017",
        "modelName": "GS-1930 E",
        "feet": 19,
        "spec": "배터리, 7.8 M, 적재 227 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "7.8 M",
        "platformHeight": "5.8 M",
        "weight": "1,498 Kg",
        "capacityPreExt": "227 kg",
        "machineDimensions": "1.83 x 0.76 x 2.10 M",
        "platformDimensions": "1.63 x 0.76 M",
        "gradeability": "% 25 %",
        "speed": "4 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "114 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-018",
        "modelName": "GS-2632",
        "feet": 26,
        "spec": "배터리, 9.9 M, 적재 227 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "9.9 M",
        "platformHeight": "7.9 M",
        "weight": "2,003 Kg",
        "capacityPreExt": "227 kg",
        "machineDimensions": "2.44 x 0.81 x 2.26 M",
        "platformDimensions": "2.26 x 0.84 M",
        "gradeability": "25 %",
        "speed": "3.5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "114 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-019",
        "modelName": "GS-2632 E",
        "feet": 26,
        "spec": "배터리, 10 M, 적재 227 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "10 M",
        "platformHeight": "8 M",
        "weight": "2,145 Kg",
        "capacityPreExt": "227 kg",
        "machineDimensions": "2.44 x 0.82 x 2.31 M",
        "platformDimensions": "2.26 x 0.84 M",
        "gradeability": "% 25 %",
        "speed": "3.2 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "114 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-020",
        "modelName": "GS-2646",
        "feet": 26,
        "spec": "배터리, 9.92 M, 적재 454 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "9.92 M",
        "platformHeight": "7.92 M",
        "weight": "1,956 Kg",
        "capacityPreExt": "454 kg",
        "machineDimensions": "2.44 x 1.18 x 2.31 M",
        "platformDimensions": "2.26 x 1.18 M",
        "gradeability": "25 %",
        "speed": "3.5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "341 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-021",
        "modelName": "GS-2646 E",
        "feet": 26,
        "spec": "배터리, 10 M, 적재 454 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "10 M",
        "platformHeight": "8 M",
        "weight": "1,997 Kg",
        "capacityPreExt": "454 kg",
        "machineDimensions": "2.44 x 1.17 x 2.26 M",
        "platformDimensions": "2.26 x 1.15 M",
        "gradeability": "% 25 %",
        "speed": "3.5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "341 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-022",
        "modelName": "GS-3246",
        "feet": 32,
        "spec": "배터리, 11.8 M, 적재 205 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "11.8 M",
        "platformHeight": "9.8 M",
        "weight": "2367 Kg",
        "capacityPreExt": "205 kg",
        "machineDimensions": "2.44 x 1.18 x 2.44 M",
        "platformDimensions": "2.26 x 1.18 M",
        "gradeability": "25 %",
        "speed": "3.2 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "113 kg",
        "capacityPostExtDeck": "",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-023",
        "modelName": "GS-3246 E",
        "feet": 32,
        "spec": "배터리, 11.7 M, 적재 318 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "11.7 M",
        "platformHeight": "9.7 M",
        "weight": "2,374 Kg",
        "capacityPreExt": "318 kg",
        "machineDimensions": "2.44 x 1.17 x 2.39 M",
        "platformDimensions": "2.26 x 1.16 M",
        "gradeability": "% 25 %",
        "speed": "3.5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "205 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-024",
        "modelName": "GS-4046",
        "feet": 40,
        "spec": "배터리, 13.7 M, 적재 350 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "13.7 M",
        "platformHeight": "11.9 M",
        "weight": "3,184 Kg",
        "capacityPreExt": "350 kg",
        "machineDimensions": "2.48 x 1.17 x 2.57 M",
        "platformDimensions": "2.26 x 1.16 M",
        "gradeability": "25 %",
        "speed": "3.2 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "237 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-025",
        "modelName": "GS-4047",
        "feet": 40,
        "spec": "배터리, 13.7 M, 적재 350 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "13.7 M",
        "platformHeight": "11.7 M",
        "weight": "3,260 Kg",
        "capacityPreExt": "350 kg",
        "machineDimensions": "2.48 x 1.19 x 2.54 M",
        "platformDimensions": "2.26 x 1.16 M",
        "gradeability": "% 25 %",
        "speed": "3.2 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "237 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-026",
        "modelName": "GS-4069DC",
        "feet": 40,
        "spec": "배터리, 14.3 M, 적재 363 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "14.3 M",
        "platformHeight": "12.3 M",
        "weight": "4,933 Kg",
        "capacityPreExt": "363 kg",
        "machineDimensions": "3.12 x 1.6 x 2.74 M",
        "platformDimensions": "2.79 x 1.6 M",
        "gradeability": "19 ° %",
        "speed": "7.2 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "250 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-027",
        "modelName": "Z-45/25J",
        "feet": 45,
        "spec": "배터리, 15.9 M, 적재 227 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "15.9 M",
        "platformHeight": "13.9 M",
        "weight": "7,400 Kg",
        "capacityPreExt": "227 kg",
        "machineDimensions": "6.83 x 1.79 x 2.0 M",
        "platformDimensions": "1.83 x 0.76 M",
        "gradeability": "30 %",
        "speed": "4.8 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "227 kg",
        "capacityPostExtDeck": "-",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-028",
        "modelName": "GS-4655",
        "feet": 46,
        "spec": "배터리, 15.95 M, 적재 349 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "15.95 M",
        "platformHeight": "13.95 M",
        "weight": "3,701 Kg",
        "capacityPreExt": "349 kg",
        "machineDimensions": "3.11 x 1.41 x 2.77 M",
        "platformDimensions": "2.84 x 1.35 M",
        "gradeability": "% 25 %",
        "speed": "4 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "213 kg",
        "capacityPostExtDeck": "136 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-029",
        "modelName": "GS-5390RT",
        "feet": 53,
        "spec": "디젤, 18 M, 적재 680 kg",
        "manufacturer": "GENIE",
        "powerSource": "디젤",
        "workingHeight": "18 M",
        "platformHeight": "16.15 M",
        "weight": "7,537 Kg",
        "capacityPreExt": "680 kg",
        "machineDimensions": "4.88 x 2.29 x 3.15 M",
        "platformDimensions": "3.98 x 1.83 M",
        "gradeability": "12 %",
        "speed": "8 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "460 kg",
        "capacityPostExtDeck": "110 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-030",
        "modelName": "STAR-6",
        "feet": 15,
        "spec": "배터리, 5.8 M, 적재 230 kg",
        "manufacturer": "HAULOTTE",
        "powerSource": "배터리",
        "workingHeight": "5.8 M",
        "platformHeight": "3.8 M",
        "weight": "880 Kg",
        "capacityPreExt": "230 kg",
        "machineDimensions": "1.4 x 0.79 x 1.75 M",
        "platformDimensions": "1.38 x 0.77 M",
        "gradeability": "% 25 %",
        "speed": "4.5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "110 kg",
        "capacityPostExtDeck": "120 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-031",
        "modelName": "OPTIMUM 8",
        "feet": 20,
        "spec": "배터리, 7.77 M, 적재 230 kg",
        "manufacturer": "HAULOTTE",
        "powerSource": "배터리",
        "workingHeight": "7.77 M",
        "platformHeight": "5.77 M",
        "weight": "1,590 Kg",
        "capacityPreExt": "230 kg",
        "machineDimensions": "1.9 x 0.79 x 1.88 M",
        "platformDimensions": "2.59 x 0.74 M",
        "gradeability": "25 %",
        "speed": "4.5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "120 kg",
        "capacityPostExtDeck": "110 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-032",
        "modelName": "1230ES",
        "feet": 12,
        "spec": "배터리, 5.7 M, 적재 230 kg",
        "manufacturer": "JLG",
        "powerSource": "배터리",
        "workingHeight": "5.7 M",
        "platformHeight": "3.7 M",
        "weight": "790 Kg",
        "capacityPreExt": "230 kg",
        "machineDimensions": "1.37 x 0.76 x 1.65 M",
        "platformDimensions": "1.25 x 0.68 M",
        "gradeability": "25 %",
        "speed": "3.2 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "230 kg",
        "capacityPostExtDeck": "-",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-033",
        "modelName": "ES1330L",
        "feet": 13,
        "spec": "배터리, 5.8 M, 적재 227 kg",
        "manufacturer": "JLG",
        "powerSource": "배터리",
        "workingHeight": "5.8 M",
        "platformHeight": "3.8 M",
        "weight": "900 Kg",
        "capacityPreExt": "227 kg",
        "machineDimensions": "1.8 x 0.6 x 1.4 M",
        "platformDimensions": "1.3 x 0.6 M",
        "gradeability": "° 25 %",
        "speed": "3.8 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "112 kg",
        "capacityPostExtDeck": "115 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-034",
        "modelName": "1532R",
        "feet": 15,
        "spec": "배터리, 6.6 M, 적재 270 kg",
        "manufacturer": "JLG",
        "powerSource": "배터리",
        "workingHeight": "6.6 M",
        "platformHeight": "4.6 M",
        "weight": "1,079 Kg",
        "capacityPreExt": "270 kg",
        "machineDimensions": "1.74 x 0.81 x 1.90 M",
        "platformDimensions": "1.74x 0.81 M",
        "gradeability": "° 14 %",
        "speed": "3 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "150 kg",
        "capacityPostExtDeck": "120 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-035",
        "modelName": "R1532i",
        "feet": 15,
        "spec": "배터리, 6.6 M, 적재 275 kg",
        "manufacturer": "JLG",
        "powerSource": "배터리",
        "workingHeight": "6.6 M",
        "platformHeight": "4.6 M",
        "weight": "1,085 Kg",
        "capacityPreExt": "275 kg",
        "machineDimensions": "1.74 x 0.81 x 1.90 M",
        "platformDimensions": "1.74x 0.81 M",
        "gradeability": "° 14 %",
        "speed": "3 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "155 kg",
        "capacityPostExtDeck": "120 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-036",
        "modelName": "1930ES",
        "feet": 19,
        "spec": "배터리, 7.7 M, 적재 230 kg",
        "manufacturer": "JLG",
        "powerSource": "배터리",
        "workingHeight": "7.7 M",
        "platformHeight": "5.7 M",
        "weight": "1,230 Kg",
        "capacityPreExt": "230 kg",
        "machineDimensions": "1.87 x 0.76 x 1.99 M",
        "platformDimensions": "1.87x 0.76 M",
        "gradeability": "° 14 %",
        "speed": "4.8 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "117 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-037",
        "modelName": "ES2646",
        "feet": 26,
        "spec": "배터리, 9.92 M, 적재 545 kg",
        "manufacturer": "JLG",
        "powerSource": "배터리",
        "workingHeight": "9.92 M",
        "platformHeight": "7.92 M",
        "weight": "2,401 Kg",
        "capacityPreExt": "545 kg",
        "machineDimensions": "2.28 x 1.17 x 2.4 M",
        "platformDimensions": "1.1 x 2.1 M",
        "gradeability": "% 30 %",
        "speed": "3.2 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "425 kg",
        "capacityPostExtDeck": "120 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-038",
        "modelName": "4069LE",
        "feet": 40,
        "spec": "배터리, 14 M, 적재 360 kg",
        "manufacturer": "JLG",
        "powerSource": "배터리",
        "workingHeight": "14 M",
        "platformHeight": "12 M",
        "weight": "4,790 Kg",
        "capacityPreExt": "360 kg",
        "machineDimensions": "3.15 x 1.75 x 2.84 M",
        "platformDimensions": "2.92x 1.65 M",
        "gradeability": "° 19 %",
        "speed": "4.8 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "247 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-039",
        "modelName": "JLG-E600JP",
        "feet": 60,
        "spec": "배터리, 20.1 M, 적재 227 kg",
        "manufacturer": "JLG",
        "powerSource": "배터리",
        "workingHeight": "20.1 M",
        "platformHeight": "18.3 M",
        "weight": "7,663 Kg",
        "capacityPreExt": "227 kg",
        "machineDimensions": "10.16 x 2.41 x 2.54 M",
        "platformDimensions": "1.83 x 0.76 M",
        "gradeability": "30 %",
        "speed": "3 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "227 kg",
        "capacityPostExtDeck": "-",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-040",
        "modelName": "S0808E",
        "feet": 26,
        "spec": "배터리, 10 M, 적재 230 kg",
        "manufacturer": "LGMG",
        "powerSource": "배터리",
        "workingHeight": "10 M",
        "platformHeight": "8 M",
        "weight": "2,200 Kg",
        "capacityPreExt": "230 kg",
        "machineDimensions": "2.45 x 0.83 x 2.32 M",
        "platformDimensions": "2.26 x 0.81 M",
        "gradeability": "% 25 %",
        "speed": "변동 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "113 kg",
        "capacityPostExtDeck": "117 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-041",
        "modelName": "S0812E",
        "feet": 26,
        "spec": "배터리, 10 M, 적재 450 kg",
        "manufacturer": "LGMG",
        "powerSource": "배터리",
        "workingHeight": "10 M",
        "platformHeight": "8 M",
        "weight": "2,300 Kg",
        "capacityPreExt": "450 kg",
        "machineDimensions": "2.49 x 1.18 x 2.36 M",
        "platformDimensions": "2.26 x 1.12 M",
        "gradeability": "% 25 %",
        "speed": "3 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "340 kg",
        "capacityPostExtDeck": "110 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-042",
        "modelName": "S1012E",
        "feet": 32,
        "spec": "배터리, 12.0 M, 적재 320 kg",
        "manufacturer": "LGMG",
        "powerSource": "배터리",
        "workingHeight": "12.0 M",
        "platformHeight": "10.0 M",
        "weight": "2,600 Kg",
        "capacityPreExt": "320 kg",
        "machineDimensions": "x 1.18 x 2.49 M",
        "platformDimensions": "1.18 x 2.26 M",
        "gradeability": "% 25 %",
        "speed": "3.5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "200 kg",
        "capacityPostExtDeck": "120 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-043",
        "modelName": "S1212E",
        "feet": 39,
        "spec": "배터리, 14.0 M, 적재 320 kg",
        "manufacturer": "LGMG",
        "powerSource": "배터리",
        "workingHeight": "14.0 M",
        "platformHeight": "12.0 M",
        "weight": "3,000 Kg",
        "capacityPreExt": "320 kg",
        "machineDimensions": "2.49 x 1.18 x 2.63 M",
        "platformDimensions": "1.18 x 2.26 M",
        "gradeability": "25 %",
        "speed": "3.5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "200 kg",
        "capacityPostExtDeck": "120 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-044",
        "modelName": "S1413E",
        "feet": 45,
        "spec": "배터리, 15.8 M, 적재 320 kg",
        "manufacturer": "LGMG",
        "powerSource": "배터리",
        "workingHeight": "15.8 M",
        "platformHeight": "13.8 M",
        "weight": "3,500 Kg",
        "capacityPreExt": "320 kg",
        "machineDimensions": "2.8 x 1.3 x 2.74 M",
        "platformDimensions": "2.64 x 1.12 M",
        "gradeability": "25 %",
        "speed": "4.5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "200 kg",
        "capacityPostExtDeck": "120 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-045",
        "modelName": "SR1623E",
        "feet": 53,
        "spec": "배터리, 17.9 M, 적재 680 kg",
        "manufacturer": "LGMG",
        "powerSource": "배터리",
        "workingHeight": "17.9 M",
        "platformHeight": "15.9 M",
        "weight": "8,200 Kg",
        "capacityPreExt": "680 kg",
        "machineDimensions": "4.9 x 2.3 x 3.23 M",
        "platformDimensions": "3.98 x 1.83 M",
        "gradeability": "% 40 %",
        "speed": "변동 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "450 kg",
        "capacityPostExtDeck": "230 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-046",
        "modelName": "MS10.4",
        "feet": 34,
        "spec": "AC 110~220V, 11.9 M, 적재 159 kg",
        "manufacturer": "MANLIFT",
        "powerSource": "AC 110~220V",
        "workingHeight": "11.9 M",
        "platformHeight": "10.06 M",
        "weight": "389 Kg",
        "capacityPreExt": "159 kg",
        "machineDimensions": "1.46 x 0.74 x 1.97 M",
        "platformDimensions": "0.68 x 0.66 M",
        "gradeability": "-",
        "speed": "-",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "159 kg",
        "capacityPostExtDeck": "-",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-047",
        "modelName": "MS11.8",
        "feet": 38,
        "spec": "AC 110~220V, 13.8 M, 적재 136 kg",
        "manufacturer": "MANLIFT",
        "powerSource": "AC 110~220V",
        "workingHeight": "13.8 M",
        "platformHeight": "11.8 M",
        "weight": "458 Kg",
        "capacityPreExt": "136 kg",
        "machineDimensions": "1.53 x 0.74 x 1.97 M",
        "platformDimensions": "0.68 x 0.66 M",
        "gradeability": "-",
        "speed": "-",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "136 kg",
        "capacityPostExtDeck": "-",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-048",
        "modelName": "GTJZ0608ME",
        "feet": 20,
        "spec": "배터리, 7.8 M, 적재 230 kg",
        "manufacturer": "Sinoboom",
        "powerSource": "배터리",
        "workingHeight": "7.8 M",
        "platformHeight": "5.8 M",
        "weight": "1,575 Kg",
        "capacityPreExt": "230 kg",
        "machineDimensions": "1.80 x 0.81 x 2.04 M",
        "platformDimensions": "1.64 x 0.76 M",
        "gradeability": "25 %",
        "speed": "4 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "110 kg",
        "capacityPostExtDeck": "120 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-049",
        "modelName": "GTJZ1012E",
        "feet": 32,
        "spec": "배터리, 12 M, 적재 320 kg",
        "manufacturer": "Sinoboom",
        "powerSource": "배터리",
        "workingHeight": "12 M",
        "platformHeight": "10 M",
        "weight": "2,815 Kg",
        "capacityPreExt": "320 kg",
        "machineDimensions": "2.45 x 1.17 x 2.48 M",
        "platformDimensions": "2.30 x 1.15 M",
        "gradeability": "25 %",
        "speed": "4 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "200 kg",
        "capacityPostExtDeck": "120 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-050",
        "modelName": "GTJZ0808E",
        "feet": 26,
        "spec": "배터리, 10.1 M, 적재 250 kg",
        "manufacturer": "기연리프트",
        "powerSource": "배터리",
        "workingHeight": "10.1 M",
        "platformHeight": "8.1 M",
        "weight": "2,265 Kg",
        "capacityPreExt": "250 kg",
        "machineDimensions": "2.46 x 0.83 x 2.36 M",
        "platformDimensions": "2.30x 0.80 M",
        "gradeability": "% 25 %",
        "speed": "4 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "137 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-051",
        "modelName": "GTJZ0812E",
        "feet": 26,
        "spec": "배터리, 10.1 M, 적재 450 kg",
        "manufacturer": "기연리프트",
        "powerSource": "배터리",
        "workingHeight": "10.1 M",
        "platformHeight": "8.1 M",
        "weight": "2,715 Kg",
        "capacityPreExt": "450 kg",
        "machineDimensions": "2.45 x 1.17 x 2.36 M",
        "platformDimensions": "2.30x 1.15 M",
        "gradeability": "% 25 %",
        "speed": "4 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "330 kg",
        "capacityPostExtDeck": "120 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-052",
        "modelName": "GTJZ1212E",
        "feet": 39,
        "spec": "배터리, 13.9 M, 적재 320 kg",
        "manufacturer": "기연리프트",
        "powerSource": "배터리",
        "workingHeight": "13.9 M",
        "platformHeight": "11.9 M",
        "weight": "3,210 Kg",
        "capacityPreExt": "320 kg",
        "machineDimensions": "2.45 x 1.17 x 2.60 M",
        "platformDimensions": "2.30 x 1.15 M",
        "gradeability": "% 25 %",
        "speed": "4 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "200 kg",
        "capacityPostExtDeck": "120 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-053",
        "modelName": "1414E Plus",
        "feet": 45,
        "spec": "배터리, 15.8 M, 적재 350 kg",
        "manufacturer": "기연리프트",
        "powerSource": "배터리",
        "workingHeight": "15.8 M",
        "platformHeight": "13.8 M",
        "weight": "3,660 Kg",
        "capacityPreExt": "350 kg",
        "machineDimensions": "2.78 x 1.41 x 2.6 M",
        "platformDimensions": "2.64 x 1.3 M",
        "gradeability": "% 25 %",
        "speed": "4 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "230 kg",
        "capacityPostExtDeck": "120 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    }
];
};

const generateMockCustomers = () => {
  const customers: Customer[] = [];
  const contacts: CustomerContact[] = [];
  const sites: CustomerSite[] = [];
  for (let i = 1; i <= 20; i++) {
    const custId = `cust-${i}`;
    customers.push({
      id: custId,
      name: `(주)대현테크 ${i}호점`,
      bizRegNo: `123-45-00${i.toString().padStart(3, '0')}`,
      isClosed: false,
      address: `서울시 강남구 테헤란로 ${i}번길`,
      representative: `대표자${i}`,
      repContact: `010-1234-${i.toString().padStart(4, '0')}`,
      repEmail: `ceo${i}@example.com`,
      bizType: '건설 및 임대업',
      bizItem: '고소작업대 외',
      transactionStatus: 'ALLOWED',
      createdAt: new Date().toISOString()
    });
    
    const contactCount = Math.floor(Math.random() * 3) + 1; // 1~3명
    for(let j=1; j<=contactCount; j++) {
      contacts.push({
        id: `contact-${i}-${j}`,
        customerId: custId,
        name: `김담당${i}-${j}`,
        position: '대리',
        contact: `010-9999-${i}${j}`,
        email: `contact${i}_${j}@example.com`,
        isActive: true,
        createdAt: new Date().toISOString()
      });
    }

    const siteCount = Math.floor(Math.random() * 2) + 2; // 2~3개
    for(let j=1; j<=siteCount; j++) {
      sites.push({
        id: `site-${i}-${j}`,
        customerId: custId,
        name: `강남 래미안 공사현장 ${i}-${j}구역`,
        address: `경기도 분당구 판교로 ${i}-${j}`,
        contactName: `이소장${i}-${j}`,
        contact: `010-8888-${i}${j}`,
        email: `site${i}_${j}@example.com`,
        isActive: true,
        createdAt: new Date().toISOString()
      });
    }
  }
  return { customers, contacts, sites };
};

const generateMockAssets = (products: Product[]): Asset[] => {
  const assets: Asset[] = [];
  for(let i=1; i<=100; i++) {
    const prod = products[i % products.length];
    assets.push({
      id: `asset-${i}`,
      modelName: prod.modelName,
      assetNo: `EQ-${i.toString().padStart(4, '0')}`,
      ownerType: 'OWNED',
      status: 'AVAILABLE',
      acquisitionDate: '2023-01-01',
      acquisitionPrice: 15000000,
      depreciationMonths: 60,
      residualValueRate: 10,
      accumDepreciation: 0,
      bookValue: 15000000,
      cumRentalFee: 0,
      cumRepairCost: 0,
      maintenanceScore: 0, // 기본 이상무 (0점)
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  
  // 20개 강제 장비 생성 (스마트 출고 테스트용: GS3246, 1012E 등)
  const extraModels = ['GS3246', 'GS3246', 'GS3246', 'GS3246', 'GS3246', 'GS3246', 'GS3246', 'GS3246', 'GS3246', 'GS3246',
                       '1012E', '1012E', '1012E', '1012E', '1012E', '1012E', '1012E', '1012E', '1012E', '1012E'];
  for(let i=0; i<extraModels.length; i++) {
    const assetId = 101 + i;
    assets.push({
      id: `asset-${assetId}`,
      modelName: extraModels[i],
      assetNo: `EQ-${assetId.toString().padStart(4, '0')}`,
      ownerType: 'OWNED',
      status: 'AVAILABLE',
      acquisitionDate: '2023-01-01',
      acquisitionPrice: 15000000,
      depreciationMonths: 60,
      residualValueRate: 10,
      accumDepreciation: 0,
      bookValue: 15000000,
      cumRentalFee: 0,
      cumRepairCost: 0,
      maintenanceScore: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  // 임차 자산(RENTED) 테스트용 모의 데이터 3건 주입
  assets.push({
    id: 'asset-rent-1',
    modelName: 'GS3246',
    assetNo: 'RENT-0001',
    ownerType: 'RENTED',
    status: 'RENTED',
    renter: 'AJ네트웍스',
    rentStart: '2026-05-01',
    rentEnd: '2026-07-10',
    monthlyRentFee: 350000,
    dailyRentFee: 15000,
    currentCustomerId: 'cust-1',
    currentSiteId: 'site-1-1',
    contractStart: '2026-05-05',
    contractEnd: '2026-07-20',
    monthlyRentalFee: 500000,
    dailyRentalFee: 20000,
    cumRentalFee: 1000000,
    cumRepairCost: 0,
    maintenanceScore: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  assets.push({
    id: 'asset-rent-2',
    modelName: '1012E',
    assetNo: 'RENT-0002',
    ownerType: 'RENTED',
    status: 'RENTED_RETURNED',
    renter: '한국종합렌탈',
    rentStart: '2026-06-01',
    rentEnd: '2026-07-12',
    actualRentReturnDate: '2026-07-18',
    monthlyRentFee: 400000,
    dailyRentFee: 18000,
    cumRentalFee: 0,
    cumRepairCost: 0,
    maintenanceScore: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  assets.push({
    id: 'asset-rent-3',
    modelName: 'GS3246',
    assetNo: 'RENT-0003',
    ownerType: 'RENTED',
    status: 'AVAILABLE',
    renter: 'AJ네트웍스',
    rentStart: '2026-06-10',
    rentEnd: '2026-08-30',
    monthlyRentFee: 300000,
    dailyRentFee: 12000,
    cumRentalFee: 0,
    cumRepairCost: 0,
    maintenanceScore: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  return assets;
};

const generateMockContracts = (customers: Customer[], contacts: CustomerContact[], sites: CustomerSite[], assets: Asset[]) => {
  const contracts: Contract[] = [];
  const contractAssets: ContractAsset[] = [];
  
  let assetIdx = 0;
  for(let i=1; i<=11; i++) { // 11 contracts
    const cust = customers[i % customers.length];
    const custContacts = contacts.filter(c => c.customerId === cust.id);
    const custSites = sites.filter(s => s.customerId === cust.id);
    
    const contractId = `contract-${i}`;
    
    // 다양한 시작일/종료일 세팅 (일할 계산 테스트용)
    let startDate = '2026-07-01';
    let endDate = '2026-12-31';
    if (i === 4 || i === 5) {
      startDate = '2026-07-10'; // 이번달 중간부터 시작 (일할 대상)
    } else if (i === 6) {
      startDate = '2026-06-15';
      endDate = '2026-07-20'; // 이번달 중간에 종료 (일할 대상)
    } else if (i === 8) {
      startDate = '2026-07-15';
      endDate = '2026-07-25'; // 아주 짧은 기간 (일할 대상)
    }

    // 마감일 및 거래명세서 마감일 설정 (오늘 날짜가 20일이므로 오늘 마감 걸리게 20일 다수 분포)
    let billingDay = 30;
    let statementClosingDay = 25;
    
    if (i === 1 || i === 6) {
      billingDay = 20; // 청구일 오늘
      statementClosingDay = 15;
    } else if (i === 2 || i === 8) {
      billingDay = 25;
      statementClosingDay = 20; // 명세서 마감일 오늘
    } else if (i === 3 || i === 9) {
      billingDay = 20; // 청구일 오늘
      statementClosingDay = 20; // 명세서 마감일 오늘
    } else if (i === 4) {
      billingDay = 10;
      statementClosingDay = 5;
    } else if (i === 5) {
      billingDay = 28;
      statementClosingDay = 20; // 명세서 마감일 오늘
    } else if (i === 10) {
      billingDay = 20; // 청구일 오늘
      statementClosingDay = 15;
    }

    contracts.push({
      id: contractId,
      contractNo: `CTR-2026-${i.toString().padStart(3, '0')}`,
      customerId: cust.id,
      contactId: custContacts[0]?.id,
      siteId: custSites[0]?.id,
      startDate,
      endDate,
      billingDay,
      statementClosingDay,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    // 다양성을 위해 1~2대의 장비 할당 및 대당 렌탈료 다양화 (월 30만원~90만원 선)
    const count = (i % 2) + 1; // 1대 또는 2대
    for(let j=0; j<count; j++) {
      if(assetIdx >= assets.length) break;
      const asset = assets[assetIdx];
      asset.status = 'RENTED';
      asset.currentCustomerId = cust.id;
      asset.currentSiteId = custSites[0]?.id;
      asset.contractStart = startDate;
      asset.contractEnd = endDate;
      asset.billingDay = billingDay;
      
      const monthlyRentalFee = 300000 + ((i + j) % 5) * 150000;
      const dailyRentalFee = Math.floor(monthlyRentalFee / 30);
      
      asset.monthlyRentalFee = monthlyRentalFee;
      asset.dailyRentalFee = dailyRentalFee;
      
      contractAssets.push({
        id: `ca-${contractId}-${j}`,
        contractId,
        assetId: asset.id,
        monthlyRentalFee,
        dailyRentalFee,
        startDate,
        endDate,
        createdAt: new Date().toISOString()
      });
      assetIdx++;
    }
  }
  return { contracts, contractAssets };
};

const mockDataProducts = generateMockProducts();
const mockDataCust = generateMockCustomers();
const mockDataAssets = generateMockAssets(mockDataProducts);
const mockDataCont = generateMockContracts(mockDataCust.customers, mockDataCust.contacts, mockDataCust.sites, mockDataAssets);

const SEED_USERS: User[] = [];
const SEED_DEPARTMENTS: Department[] = [];
const SEED_PERMISSIONS: MenuPermission[] = [];
const SEED_PRODUCTS: Product[] = mockDataProducts;
const SEED_CUSTOMERS: Customer[] = mockDataCust.customers;
const SEED_CONTACTS: CustomerContact[] = mockDataCust.contacts;
const SEED_SITES: CustomerSite[] = mockDataCust.sites;
const SEED_ASSETS: Asset[] = mockDataAssets;
const SEED_CONSUMABLES: Consumable[] = [];
const SEED_CONSUMABLE_LOGS: ConsumableLog[] = [];
const SEED_CONSUMABLE_PURCHASES: ConsumablePurchaseRequest[] = [];
const SEED_CONTRACTS: Contract[] = mockDataCont.contracts;
const SEED_CONTRACT_ASSETS: ContractAsset[] = mockDataCont.contractAssets;
const SEED_DELIVERIES: Delivery[] = [];
const SEED_TRANSPORT_COMPANIES: TransportCompany[] = [
  { id: 'TC-001', name: '대한물류', businessNo: '123-45-67890', contact: '1588-0001', memo: '주요 파트너', createdAt: new Date().toISOString() },
  { id: 'TC-002', name: '민국운수', businessNo: '234-56-78901', contact: '1588-0002', memo: '', createdAt: new Date().toISOString() }
];
const SEED_TRANSPORT_DRIVERS: TransportDriver[] = [
  { id: 'TD-001', companyId: 'TC-001', driverName: '홍길동', driverContact: '010-1111-1111', vehicleNo: '서울82가 1111', vehicleType: '5톤 셀프로더', createdAt: new Date().toISOString() },
  { id: 'TD-002', companyId: 'TC-002', driverName: '홍길동', driverContact: '010-2222-2222', vehicleNo: '경기99바 2222', vehicleType: '1톤 화물차', createdAt: new Date().toISOString() },
  { id: 'TD-003', companyId: 'TC-001', driverName: '김기사', driverContact: '010-3333-3333', vehicleNo: '서울82가 3333', vehicleType: '2.5톤', createdAt: new Date().toISOString() }
];
const SEED_BILLINGS: Billing[] = [];
const SEED_BILLING_DETAILS: BillingDetail[] = [];
const SEED_PAYMENTS: Payment[] = [];
const SEED_VENDORS: Vendor[] = [
  { id: 'V-001', name: '가나외주정비', type: 'REPAIR', bizRegNo: '111-22-33333', contactName: '김정비', contact: '010-9999-9999', memo: '경기 서부권 외주수리공장', createdAt: new Date().toISOString() },
  { id: 'V-002', name: '나라정비센터', type: 'REPAIR', bizRegNo: '222-33-44444', contactName: '이수리', contact: '010-8888-8888', memo: '호남권 외주수리공장', createdAt: new Date().toISOString() }
];
const SEED_REPAIRS: Repair[] = [
  {
    id: 'REP-001',
    assetId: 'asset-own-1',
    repairType: 'EXTERNAL',
    vendorId: 'V-001',
    requestDate: '2026-07-15',
    status: 'IN_PROGRESS',
    details: '리프트 유압 호스 누유로 외주 입고',
    totalCost: 250000,
    billableToCustomer: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'REP-002',
    assetId: 'asset-own-2',
    repairType: 'EXTERNAL',
    vendorId: 'V-002',
    requestDate: '2026-07-18',
    status: 'PENDING',
    details: '메인보드 통신 에러 외주 의뢰',
    totalCost: 450000,
    billableToCustomer: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];
const SEED_REPAIR_CONSUMABLES: RepairConsumable[] = [];
const SEED_CONTRACT_HISTORY: ContractHistory[] = [];
const SEED_TODOS: Todo[] = [];

const SEED_BANK_TRANSACTIONS: BankTransaction[] = [
  { id: 'bt-1', bankName: '우리은행', accountNumber: 'XXXX-XX-XXXXXXX01', transactionDate: '2026-07-20 09:30:15', senderName: '대현테크', counterparty: '대현테크', depositAmount: 1050000, withdrawAmount: 0, balance: 13550000, memo: '보통예금입금', createdAt: new Date().toISOString() },
  { id: 'bt-2', bankName: '우리은행', accountNumber: 'XXXX-XX-XXXXXXX01', transactionDate: '2026-07-20 10:15:22', senderName: '주식회사기연', counterparty: '주식회사기연', depositAmount: 600000, withdrawAmount: 0, balance: 14150000, memo: '7월분결제', createdAt: new Date().toISOString() },
  { id: 'bt-3', bankName: '우리은행', accountNumber: 'XXXX-XX-XXXXXXX01', transactionDate: '2026-07-20 11:00:00', senderName: '거래상대방', counterparty: '거래상대방', depositAmount: 300000, withdrawAmount: 0, balance: 14450000, memo: '임대료 송금', createdAt: new Date().toISOString() },
  { id: 'bt-4', bankName: '우리은행', accountNumber: 'XXXX-XX-XXXXXXX01', transactionDate: '2026-07-20 13:45:10', senderName: '현장가설', counterparty: '현장가설', depositAmount: 0, withdrawAmount: 150000, balance: 14300000, memo: '유류비 지출', createdAt: new Date().toISOString() },
  { id: 'bt-5', bankName: '우리은행', accountNumber: 'XXXX-XX-XXXXXXX01', transactionDate: '2026-07-22 16:30:00', senderName: '기연산업', counterparty: '기연산업', depositAmount: 450000, withdrawAmount: 0, balance: 14750000, memo: '렌탈료', createdAt: new Date().toISOString() }
];

const SEED_BANK_MATCHING_RULES: BankMatchingRule[] = [
  { id: 'bmr-1', senderName: '주식회사기연', customerId: 'cust-1', createdAt: new Date().toISOString() }
];

const SEED_GOOGLE_CONFIG: GoogleConfig[] = [
  {
    id: 'default-config',
    googleEmail: '',
    googlePassword: '',
    gmailAppPassword: '',
    contractFolder: '렌탈계약서_증빙',
    consumableFolder: '소모품납품증빙',
    deliveryFolder: '출고의뢰_증빙',
    maintenanceFolder: '정비보고서_증빙',
    isDevMode: false,
    currentInsuranceStartDate: '2026-03-05',
    currentInsuranceEndDate: '2027-03-05',
    nextInsuranceStartDate: '2027-03-05',
    nextInsuranceEndDate: '2028-03-05',
    updatedAt: new Date().toISOString()

  }
];

const SEED_CASH_FLOW_SNAPSHOTS: CashFlowSnapshot[] = [
  {
    id: 'snap-1',
    snapshotDate: '2026-07-20',
    startingBalance: 17350000,
    projectedInflow: 38200000,
    projectedOpex: 28500000,
    projectedCapex: 45000000,
    projectedFinalBalance: -17950000,
    notes: '7월 정기 고소작업대 2대 추가 CAPEX 취득에 따른 일시적 유동성 부족 예상',
    createdAt: new Date().toISOString()
  }
];

const SEED_ANNUAL_LEAVE_QUOTAS: AnnualLeaveQuota[] = [
  {
    id: 'quota-1',
    userId: 'usr-admin',
    periodStart: '2026-01-01',
    periodEnd: '2026-12-31',
    grantedDays: 15,
    memo: '2026년 정기 부여 연차',
    createdAt: new Date().toISOString()
  },
  {
    id: 'quota-2',
    userId: 'usr-sales1',
    periodStart: '2026-03-15',
    periodEnd: '2027-03-14',
    grantedDays: 15,
    memo: '입사일 주기 연차 부여',
    createdAt: new Date().toISOString()
  }
];

const SEED_LEAVE_USAGES: LeaveUsage[] = [
  {
    id: 'leave-1',
    userId: 'usr-sales1',
    leaveType: 'ANNUAL',
    usedDays: 1.0,
    startDate: '2026-06-10',
    endDate: '2026-06-10',
    reason: '개인 사유 휴가',
    status: 'APPROVED',
    createdAt: new Date().toISOString()
  },
  {
    id: 'leave-2',
    userId: 'usr-sales1',
    leaveType: 'HALF_PM',
    usedDays: 0.5,
    startDate: '2026-07-20',
    endDate: '2026-07-20',
    reason: '병원 진료 (오후 반차)',
    status: 'APPROVED',
    createdAt: new Date().toISOString()
  }
];

const SEED_OVERTIME_RECORDS: OvertimeRecord[] = [
  {
    id: 'ot-1',
    userId: 'usr-sales1',
    startDateTime: '2026-08-01 18:00',
    hours: 2.5,
    workDetail: '긴급 출고 장비 정비 및 야간 배차 대기',
    status: 'APPROVED',
    createdAt: new Date().toISOString()
  }
];

// [v1.68.15] 체크리스트 항목은 앱 UI(체크리스트 관리 메뉴)에서만 등록/관리한다.
// 코드 레벨 자동 시드 주입 시 Supabase DB 삭제 후에도 재부활하는 문제가 있어 빈 배열로 변경.
// 실제 운영 데이터는 Supabase에 저장되며, 신규 설치 시에는 체크리스트 관리 메뉴에서 직접 등록한다.
const SEED_INSPECTION_CHECKLIST_ITEMS: InspectionChecklistItem[] = [];

export const SEED_BANK_INITIAL_BALANCES: BankAccountInitialBalance[] = [
  { id: 'bank-init-우리은행', bankName: '우리은행', accountNumber: 'XXXX-XX-XXXXXXX01', initialBalance: 0, updatedAt: new Date().toISOString() },
  { id: 'bank-init-신한은행', bankName: '신한은행', accountNumber: 'XXX-XXXXXXXXX-XX', initialBalance: 0, updatedAt: new Date().toISOString() }
];

export const SEED_CORPORATE_VEHICLES: CorporateVehicle[] = [
  {
    id: 'veh-01',
    vehicleNo: '82가 1024',
    modelName: '스타리아 카고 5인승',
    vehicleType: '승합차',
    ownershipType: 'OWNED',
    fuelType: 'DIESEL',
    assignedDepartment: 'AS팀',
    primaryDriverId: 'usr-mech1',
    primaryDriverName: '김정비',
    initialMileage: 12500,
    currentMileage: 28450,
    insuranceExpiryDate: '2027-03-15',
    inspectionExpiryDate: '2026-11-20',
    isActive: true,
    memo: '경기/인천 현장 AS 1호 출동차량',
    createdAt: '2026-01-10T09:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z'
  },
  {
    id: 'veh-02',
    vehicleNo: '83나 5678',
    modelName: '포터II 특장 윙바디',
    vehicleType: '화물/탑차',
    ownershipType: 'OWNED',
    fuelType: 'DIESEL',
    assignedDepartment: '출고관리부',
    primaryDriverId: 'usr-outbound1',
    primaryDriverName: '박출고',
    initialMileage: 5400,
    currentMileage: 41200,
    insuranceExpiryDate: '2027-05-20',
    inspectionExpiryDate: '2027-02-10',
    isActive: true,
    memo: '소형 고소작업대 긴급 근거리 탁송 전용',
    createdAt: '2026-01-10T09:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z'
  },
  {
    id: 'veh-03',
    vehicleNo: '24너 9182',
    modelName: '아반떼 하이브리드',
    vehicleType: '승용차',
    ownershipType: 'LEASE',
    fuelType: 'HYBRID',
    assignedDepartment: '영업부',
    primaryDriverId: 'usr-sales1',
    primaryDriverName: '이영업',
    initialMileage: 3000,
    currentMileage: 18900,
    insuranceExpiryDate: '2027-08-31',
    inspectionExpiryDate: '2027-08-31',
    isActive: true,
    memo: '수도권 건설사 현장영업 및 계약 체결용',
    createdAt: '2026-02-01T09:00:00.000Z',
    updatedAt: '2026-09-02T10:00:00.000Z'
  },
  {
    id: 'veh-04',
    vehicleNo: '11다 3456',
    modelName: '카니발 하이리무진 7인승',
    vehicleType: '승용차',
    ownershipType: 'LEASE',
    fuelType: 'GASOLINE',
    assignedDepartment: '경영지원부',
    primaryDriverId: 'usr-admin',
    primaryDriverName: '관리자',
    initialMileage: 1000,
    currentMileage: 15300,
    insuranceExpiryDate: '2027-12-31',
    inspectionExpiryDate: '2028-01-15',
    isActive: true,
    memo: '임원 의전 및 본사 경영관리 출장용',
    createdAt: '2026-01-15T09:00:00.000Z',
    updatedAt: '2026-09-03T11:00:00.000Z'
  },
  {
    id: 'veh-05',
    vehicleNo: '95라 7731',
    modelName: '봉고III EV (전기화물)',
    vehicleType: '화물/탑차',
    ownershipType: 'OWNED',
    fuelType: 'ELECTRIC',
    assignedDepartment: 'AS팀',
    primaryDriverId: 'usr-mech2',
    primaryDriverName: '최기사',
    initialMileage: 500,
    currentMileage: 9800,
    insuranceExpiryDate: '2027-09-10',
    inspectionExpiryDate: '2027-09-10',
    isActive: true,
    memo: '주기장 및 시흥 배곧 관내 순회 긴급 정비용',
    createdAt: '2026-03-01T09:00:00.000Z',
    updatedAt: '2026-09-04T15:00:00.000Z'
  }
];

export const SEED_VEHICLE_OPERATION_LOGS: VehicleOperationLog[] = [
  {
    id: 'vlog-01',
    vehicleId: 'veh-01',
    vehicleNo: '82가 1024',
    driverId: 'usr-mech1',
    driverName: '김정비',
    driverDept: 'AS팀',
    operationDate: '2026-09-04',
    purposeType: 'SITE_AS',
    purposeDetail: '시흥 배곧 건설현장 유압 호스 누유 긴급 출장 수리',
    departureLocation: '본사 주기장 (화성)',
    arrivalLocation: '시흥 배곧 2차 현장',
    departureMileage: 28350,
    arrivalMileage: 28450,
    driveDistance: 100,
    businessDistance: 100,
    commuteDistance: 0,
    memo: '정상 수리 완료 후 본사 복귀',
    status: 'CONFIRMED',
    confirmedBy: '관리자',
    confirmedAt: '2026-09-04 18:30',
    createdAt: '2026-09-04T17:40:00.000Z',
    updatedAt: '2026-09-04T18:30:00.000Z'
  },
  {
    id: 'vlog-02',
    vehicleId: 'veh-03',
    vehicleNo: '24너 9182',
    driverId: 'usr-sales1',
    driverName: '이영업',
    driverDept: '영업부',
    operationDate: '2026-09-03',
    purposeType: 'CLIENT_MEETING',
    purposeDetail: '평택 고덕 삼성 반도체 4기 신축현장 렌탈 계약 미팅',
    departureLocation: '본사 사무실',
    arrivalLocation: '평택 고덕 현장사무소',
    departureMileage: 18760,
    arrivalMileage: 18900,
    driveDistance: 140,
    businessDistance: 140,
    commuteDistance: 0,
    memo: '고소작업대 6대 6개월 장기계약 협의',
    status: 'CONFIRMED',
    confirmedBy: '관리자',
    confirmedAt: '2026-09-03 19:10',
    createdAt: '2026-09-03T18:20:00.000Z',
    updatedAt: '2026-09-03T19:10:00.000Z'
  }
];

export const SEED_VEHICLE_FUEL_LOGS: VehicleFuelLog[] = [
  {
    id: 'vfuel-01',
    vehicleId: 'veh-01',
    vehicleNo: '82가 1024',
    driverId: 'usr-mech1',
    driverName: '김정비',
    fuelDate: '2026-09-04 08:30',
    fuelType: '경유',
    fuelVolume: 55.4,
    fuelAmount: 85000,
    fuelUnitPrice: 1534,
    currentMileage: 28350,
    gasStationName: 'SK에너지 서해로주유소',
    paymentMethod: 'CORPORATE_CARD',
    cardLast4: '7721',
    fuelEfficiency: 11.2,
    receiptPhotoUrl: '',
    dashboardPhotoUrl: '',
    memo: '출장 전 만땅 주유',
    createdAt: '2026-09-04T08:35:00.000Z',
    updatedAt: '2026-09-04T08:35:00.000Z'
  },
  {
    id: 'vfuel-02',
    vehicleId: 'veh-03',
    vehicleNo: '24너 9182',
    driverId: 'usr-sales1',
    driverName: '이영업',
    fuelDate: '2026-09-03 09:15',
    fuelType: '휘발유',
    fuelVolume: 42.0,
    fuelAmount: 71000,
    fuelUnitPrice: 1690,
    currentMileage: 18760,
    gasStationName: 'GS칼텍스 평택스마트주유소',
    paymentMethod: 'CORPORATE_CARD',
    cardLast4: '4490',
    fuelEfficiency: 16.8,
    receiptPhotoUrl: '',
    dashboardPhotoUrl: '',
    memo: '평택 출장길 주유',
    createdAt: '2026-09-03T09:20:00.000Z',
    updatedAt: '2026-09-03T09:20:00.000Z'
  }
];

export const ALL_DB_KEYS = [
  'users', 'departments', 'permissions', 'customers', 'contacts', 'sites', 
  'products', 'assets', 'consumables', 'consumableLogs', 'consumablePurchases',
  'contracts', 'contractAssets', 'contractHistory', 'deliveries', 
  'transportCompanies', 'transportDrivers', 'vendors',
  'billings', 'billingDetails', 'payments', 'paymentDepositLinks', 'repairs', 'repairConsumables', 'todos', 
  'bankTransactions', 'bankMatchingRules', 'bankInitialBalances', 'googleConfigs', 'assetInOutLogs',
  'cashFlowSnapshots', 'outboundInspections', 'depreciationLogs',
  'purchaseSettlements', 'purchaseSettlementItems', 'settlementPaymentLogs', 'externalLeases',
  'annualLeaveQuotas', 'leaveUsages', 'overtimeRecords', 'payrollClosings', 'inspectionChecklistItems',
  'prepaidTransactions', 'delinquencyActionLogs', 'mechanicConsumableStocks', 'receivables', 'legalNoticeLogs', 'legalNoticeTemplates',
  'corporateVehicles', 'vehicleOperationLogs', 'vehicleFuelLogs'
];

class LocalDB {
  private inMemoryCache: Map<string, any> = new Map();

  private get<T>(key: string, seed: T[]): T[] {
    if (this.inMemoryCache.has(key)) {
      return this.inMemoryCache.get(key);
    }
    try {
      const val = localStorage.getItem(`erp_${key}`);
      if (!val) {
        this.inMemoryCache.set(key, seed);
        try {
          localStorage.setItem(`erp_${key}`, JSON.stringify(seed));
        } catch {
          // localStorage 용량 초과 시 인메모리 보존 유지
        }
        return seed;
      }
      const parsed = JSON.parse(val);
      this.inMemoryCache.set(key, parsed);
      return parsed;
    } catch {
      this.inMemoryCache.set(key, seed);
      return seed;
    }
  }

  private set<T>(key: string, data: T[]): void {
    this.inMemoryCache.set(key, data);
    try {
      localStorage.setItem(`erp_${key}`, JSON.stringify(data));
    } catch (e: any) {
      console.warn(`[LocalDB Quota Exceeded] localStorage 용량 한도(5MB) 초과로 erp_${key} 키를 인메모리에 안전하게 보존합니다:`, e?.message || e);
    }
  }

  get users() { return this.get<User>('users', SEED_USERS); }
  set users(val: User[]) { this.set('users', val); }

  get departments() { return this.get<Department>('departments', SEED_DEPARTMENTS); }
  set departments(val: Department[]) { this.set('departments', val); }

  get permissions() { 
    const raw = this.get<MenuPermission>('permissions', SEED_PERMISSIONS); 
    const validUserIds = new Set(this.users.map(u => u.id));
    // userId가 유실(null)되었거나, users 마스터 대장에 없는 유령/퇴사자 권한 찌꺼기 85건을 localStorage에서 즉각 100% 영구 물리 삭제!
    const cleanPermissions = raw.filter(p => p && p.userId && validUserIds.has(p.userId));
    if (cleanPermissions.length !== raw.length) {
      this.set('permissions', cleanPermissions);
    }
    return cleanPermissions;
  }
  set permissions(val: MenuPermission[]) { 
    const validUserIds = new Set(this.users.map(u => u.id));
    const cleanVals = (val || []).filter(p => p && p.userId && validUserIds.has(p.userId));
    this.set('permissions', cleanVals); 
  }

  get customers() { return this.get<Customer>('customers', SEED_CUSTOMERS); }
  set customers(val: Customer[]) { this.set('customers', val); }

  get contacts() { return this.get<CustomerContact>('contacts', SEED_CONTACTS); }
  set contacts(val: CustomerContact[]) { this.set('contacts', val); }
  get customerContacts() { return this.contacts; }
  set customerContacts(val: CustomerContact[]) { this.contacts = val; }

  get sites() { return this.get<CustomerSite>('sites', SEED_SITES); }
  set sites(val: CustomerSite[]) { this.set('sites', val); }
  get customerSites() { return this.sites; }
  set customerSites(val: CustomerSite[]) { this.sites = val; }

  get products() { return this.get<Product>('products', SEED_PRODUCTS); }
  set products(val: Product[]) { this.set('products', val); }

  get assets() { return this.get<Asset>('assets', SEED_ASSETS); }
  set assets(val: Asset[]) { this.set('assets', val); }

  get inspectionChecklistItems() {
    return this.get<InspectionChecklistItem>('inspectionChecklistItems', SEED_INSPECTION_CHECKLIST_ITEMS);
  }
  set inspectionChecklistItems(val: InspectionChecklistItem[]) { this.set('inspectionChecklistItems', val); }


  get consumables() { return this.get<Consumable>('consumables', SEED_CONSUMABLES); }
  set consumables(val: Consumable[]) { this.set('consumables', val); }

  get consumableLogs() { return this.get<ConsumableLog>('consumableLogs', SEED_CONSUMABLE_LOGS); }
  set consumableLogs(val: ConsumableLog[]) { this.set('consumableLogs', val); }

  get consumablePurchases() { return this.get<ConsumablePurchaseRequest>('consumablePurchases', SEED_CONSUMABLE_PURCHASES); }
  set consumablePurchases(val: ConsumablePurchaseRequest[]) { this.set('consumablePurchases', val); }

  get mechanicConsumableStocks() { return this.get<MechanicConsumableStock>('mechanicConsumableStocks', []); }
  set mechanicConsumableStocks(val: MechanicConsumableStock[]) { this.set('mechanicConsumableStocks', val); }

  get contracts() { return this.get<Contract>('contracts', SEED_CONTRACTS); }
  set contracts(val: Contract[]) { this.set('contracts', val); }

  get contractAssets() { return this.get<ContractAsset>('contractAssets', SEED_CONTRACT_ASSETS); }
  set contractAssets(val: ContractAsset[]) { this.set('contractAssets', val); }

  get contractHistory() { return this.get<ContractHistory>('contractHistory', SEED_CONTRACT_HISTORY); }
  set contractHistory(val: ContractHistory[]) { this.set('contractHistory', val); }
  get contractHistories() { return this.contractHistory; }
  set contractHistories(val: ContractHistory[]) { this.contractHistory = val; }

  get deliveries() { return this.get<Delivery>('deliveries', SEED_DELIVERIES); }
  set deliveries(val: Delivery[]) { this.set('deliveries', val); }

  get transportCompanies() { return this.get<TransportCompany>('transportCompanies', SEED_TRANSPORT_COMPANIES); }
  set transportCompanies(val: TransportCompany[]) { this.set('transportCompanies', val); }

  get transportDrivers() { return this.get<TransportDriver>('transportDrivers', SEED_TRANSPORT_DRIVERS); }
  set transportDrivers(val: TransportDriver[]) { this.set('transportDrivers', val); }

  get billings() { return this.get<Billing>('billings', SEED_BILLINGS); }
  set billings(val: Billing[]) { this.set('billings', val); }

  get billingDetails() { return this.get<BillingDetail>('billingDetails', SEED_BILLING_DETAILS); }
  set billingDetails(val: BillingDetail[]) { this.set('billingDetails', val); }

  get receivables() { return this.get<Receivable>('receivables', []); }
  set receivables(val: Receivable[]) { this.set('receivables', val); }

  get payments() { return this.get<Payment>('payments', SEED_PAYMENTS); }
  set payments(val: Payment[]) { this.set('payments', val); }

  get paymentDepositLinks() { return this.get<PaymentDepositLink>('paymentDepositLinks', []); }
  set paymentDepositLinks(val: PaymentDepositLink[]) { this.set('paymentDepositLinks', val); }

  get annualLeaveQuotas() { return this.get<AnnualLeaveQuota>('annualLeaveQuotas', SEED_ANNUAL_LEAVE_QUOTAS); }
  set annualLeaveQuotas(val: AnnualLeaveQuota[]) { this.set('annualLeaveQuotas', val); }

  get leaveUsages() { return this.get<LeaveUsage>('leaveUsages', SEED_LEAVE_USAGES); }
  set leaveUsages(val: LeaveUsage[]) { this.set('leaveUsages', val); }

  get overtimeRecords() { return this.get<OvertimeRecord>('overtimeRecords', SEED_OVERTIME_RECORDS); }
  set overtimeRecords(val: OvertimeRecord[]) { this.set('overtimeRecords', val); }

  get payrollClosings() { return this.get<PayrollClosing>('payrollClosings', []); }
  set payrollClosings(val: PayrollClosing[]) { this.set('payrollClosings', val); }

  get repairs() {
    const list = this.get<Repair>('repairs', SEED_REPAIRS);
    // 🌟 현장 도로명 주소(siteAddress) 보강 (원격 DB 미반영 환경에서도 무누락 상속)
    return list.map(r => {
      if (r.siteAddress && r.siteAddress.trim()) return r;
      let addr = '';
      if (r.locationDetail && /(?:시|군|구)\s+[가-힣0-9]+(?:로|길|읍|면|동)/.test(r.locationDetail)) {
        addr = r.locationDetail.trim();
      } else if (r.memo && r.memo.includes('[현장도로명:')) {
        const match = r.memo.match(/\[현장도로명:\s*([^\]]+)\]/);
        if (match) addr = match[1].trim();
      }
      if (addr) return { ...r, siteAddress: addr };
      return r;
    });
  }
  set repairs(val: Repair[]) { this.set('repairs', val); }

  get vendors() { return this.get<Vendor>('vendors', SEED_VENDORS); }
  set vendors(val: Vendor[]) { this.set('vendors', val); }

  get repairConsumables() { return this.get<RepairConsumable>('repairConsumables', SEED_REPAIR_CONSUMABLES); }
  set repairConsumables(val: RepairConsumable[]) { this.set('repairConsumables', val); }

  get todos() { return this.get<Todo>('todos', SEED_TODOS); }
  set todos(val: Todo[]) { this.set('todos', val); }

  get bankTransactions() { return this.get<BankTransaction>('bankTransactions', SEED_BANK_TRANSACTIONS); }
  set bankTransactions(val: BankTransaction[]) { this.set('bankTransactions', val); }

  get bankMatchingRules() { return this.get<BankMatchingRule>('bankMatchingRules', SEED_BANK_MATCHING_RULES); }
  set bankMatchingRules(val: BankMatchingRule[]) { this.set('bankMatchingRules', val); }

  get bankInitialBalances() { return this.get<BankAccountInitialBalance>('bankInitialBalances', SEED_BANK_INITIAL_BALANCES); }
  set bankInitialBalances(val: BankAccountInitialBalance[]) { this.set('bankInitialBalances', val); }

  get googleConfigs() { return this.get<GoogleConfig>('googleConfigs', []); }
  set googleConfigs(val: GoogleConfig[]) { this.set('googleConfigs', val); }

  get assetInOutLogs() { return this.get<AssetInOutLog>('assetInOutLogs', []); }
  set assetInOutLogs(val: AssetInOutLog[]) { this.set('assetInOutLogs', val); }

  get cashFlowSnapshots() { return this.get<CashFlowSnapshot>('cashFlowSnapshots', SEED_CASH_FLOW_SNAPSHOTS); }
  set cashFlowSnapshots(val: CashFlowSnapshot[]) { this.set('cashFlowSnapshots', val); }

  get outboundInspections() { return this.get<OutboundInspection>('outboundInspections', []); }
  set outboundInspections(val: OutboundInspection[]) { this.set('outboundInspections', val); }

  // 💡 [Zero Silent Failures / 1000-Row Pagination Bug Fix]
  // Supabase의 기본 select('*')는 최대 1000건까지만 반환합니다.
  // 데이터가 1000건을 초과하면 이후 생성된 데이터가 프론트엔드에 동기화되지 않고 무음 누락(Silent Drop)되는 심각한 결함이 있었습니다.
  // 이를 해결하기 위해 while 문과 range()를 사용하여 테이블의 모든 레코드를 페이지네이션으로 100% 무누락 조회합니다.
  private async fetchAllFromSupabase(tableName: string): Promise<any[]> {
    if (!supabase) return [];
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1);
        
      if (error) {
        throw error;
      }
      if (!data || data.length === 0) {
        break;
      }
      allData = allData.concat(data);
      if (data.length < pageSize) {
        break;
      }
      page++;
    }
    return allData;
  }

  get depreciationLogs() { return this.get<DepreciationLog>('depreciationLogs', []); }
  set depreciationLogs(val: DepreciationLog[]) { this.set('depreciationLogs', val); }

  get purchaseSettlements() { return this.get<PurchaseSettlement>('purchaseSettlements', []); }
  set purchaseSettlements(val: PurchaseSettlement[]) { this.set('purchaseSettlements', val); }

  get purchaseSettlementItems() { return this.get<PurchaseSettlementItem>('purchaseSettlementItems', []); }
  set purchaseSettlementItems(val: PurchaseSettlementItem[]) { this.set('purchaseSettlementItems', val); }

  get settlementPaymentLogs() { return this.get<SettlementPaymentLog>('settlementPaymentLogs', []); }
  set settlementPaymentLogs(val: SettlementPaymentLog[]) { this.set('settlementPaymentLogs', val); }

  get externalLeases() { return this.get<ExternalLease>('externalLeases', []); }
  set externalLeases(val: ExternalLease[]) { this.set('externalLeases', val); }

  get prepaidTransactions() { return this.get<PrepaidTransaction>('prepaidTransactions', []); }
  set prepaidTransactions(val: PrepaidTransaction[]) { this.set('prepaidTransactions', val); }

  get legalNoticeLogs() { return this.get<LegalNoticeLog>('legalNoticeLogs', []); }
  set legalNoticeLogs(val: LegalNoticeLog[]) { this.set('legalNoticeLogs', val); }

  get legalNoticeTemplates() { return this.get<LegalNoticeTemplate>('legalNoticeTemplates', []); }
  set legalNoticeTemplates(val: LegalNoticeTemplate[]) { this.set('legalNoticeTemplates', val); }
  get delinquencyActionLogs() { return this.get<DelinquencyActionLog>('delinquencyActionLogs', []); }
  set delinquencyActionLogs(val: DelinquencyActionLog[]) { this.set('delinquencyActionLogs', val); }

  get corporateVehicles() { return this.get<CorporateVehicle>('corporateVehicles', SEED_CORPORATE_VEHICLES); }
  set corporateVehicles(val: CorporateVehicle[]) { this.set('corporateVehicles', val); }

  get vehicleOperationLogs() { return this.get<VehicleOperationLog>('vehicleOperationLogs', SEED_VEHICLE_OPERATION_LOGS); }
  set vehicleOperationLogs(val: VehicleOperationLog[]) { this.set('vehicleOperationLogs', val); }

  get vehicleFuelLogs() { return this.get<VehicleFuelLog>('vehicleFuelLogs', SEED_VEHICLE_FUEL_LOGS); }
  set vehicleFuelLogs(val: VehicleFuelLog[]) { this.set('vehicleFuelLogs', val); }

  // Supabase 테이블 맵핑
  private mapToSupabaseTable(key: string): string {
    const mapping: Record<string, string> = {
      prepaidTransactions: 'prepaid_transactions',
      delinquencyActionLogs: 'delinquency_action_logs',
      legalNoticeLogs: 'legal_notice_logs',
      legalNoticeTemplates: 'legal_notice_templates',
      users: 'users',
      departments: 'departments',
      permissions: 'permissions',
      customers: 'customers',
      contacts: 'customer_contacts',
      sites: 'customer_sites',
      products: 'products',
      assets: 'assets',
      consumables: 'consumables',
      consumableLogs: 'consumable_logs',
      consumablePurchases: 'consumable_purchases',
      contracts: 'contracts',
      contractAssets: 'contract_assets',
      contractHistory: 'contract_history',
      deliveries: 'deliveries',
      transportCompanies: 'transport_companies',
      transportDrivers: 'transport_drivers',
      billings: 'billings',
      billingDetails: 'billing_details',
      payments: 'payments',
      paymentDepositLinks: 'payment_deposit_links',
      repairs: 'repairs',
      repairConsumables: 'repair_consumables',
      bankTransactions: 'bank_transactions',
      bankMatchingRules: 'bank_matching_rules',
      bankInitialBalances: 'bank_initial_balances',
      assetInOutLogs: 'asset_inout_logs',
      googleConfigs: 'google_configs',
      vendors: 'vendors',
      cashFlowSnapshots: 'cash_flow_snapshots',
      outboundInspections: 'outbound_inspections',
      depreciationLogs: 'depreciation_logs',
      purchaseSettlements: 'purchase_settlements',
      purchaseSettlementItems: 'purchase_settlement_items',
      settlementPaymentLogs: 'settlement_payment_logs',
      externalLeases: 'external_leases',
      inspectionChecklistItems: 'inspection_checklist_items',
      mechanicConsumableStocks: 'mechanic_consumable_stocks',
      receivables: 'receivables',
      annualLeaveQuotas: 'annual_leave_quotas',
      leaveUsages: 'leave_usages',
      overtimeRecords: 'overtime_records',
      payrollClosings: 'payroll_closings',
      corporateVehicles: 'corporate_vehicles',
      vehicleOperationLogs: 'vehicle_operation_logs',
      vehicleFuelLogs: 'vehicle_fuel_logs',
    };
    return mapping[key] || key;
  }

  // 비동기 쓰기 큐
  public pendingWrites: any[] = [];

  async awaitPendingWrites(): Promise<void> {
    if (!this.pendingWrites || this.pendingWrites.length === 0) return;
    try {
      await Promise.all(this.pendingWrites);
    } catch (err: any) {
      console.error("Supabase pending write error:", err);
      const errMsg = err?.message || String(err);
      if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError')) {
        throw new Error(`원격 Supabase DB 통신 장애 (Failed to fetch):\n\n인터넷 네트워크 연결 상태, 사내 방화벽 정책 또는 Supabase 서버 상태를 확인해 주세요.\n(로컬 데이터는 안전하게 보존되었습니다.)`);
      }
      throw err;
    } finally {
      this.pendingWrites = [];
    }
  }

  isSupabaseConnected(): boolean {
    return !!supabase;
  }

  private normalizePayloadKeys(item: any): any {
    if (!item || typeof item !== 'object') return item;
    if (Array.isArray(item)) {
      return item.map(i => this.normalizePayloadKeys(i));
    }
    const normalized = { ...item };
    
    // userId (user_id ➔ userId 변환 후 snake_case 전면 파기)
    if (normalized.user_id) {
      if (!normalized.userId) normalized.userId = normalized.user_id;
      delete normalized.user_id;
    }
    
    // salespersonId (salesperson_id ➔ salespersonId 변환 후 snake_case 전면 파기)
    if (normalized.salesperson_id) {
      if (!normalized.salespersonId) normalized.salespersonId = normalized.salesperson_id;
      delete normalized.salesperson_id;
    }

    // requesterId (requester_id ➔ requesterId 변환 후 snake_case 전면 파기)
    if (normalized.requester_id) {
      if (!normalized.requesterId) normalized.requesterId = normalized.requester_id;
      delete normalized.requester_id;
    }

    // mechanicId (mechanic_id ➔ mechanicId 변환 후 snake_case 전면 파기)
    if (normalized.mechanic_id) {
      if (!normalized.mechanicId) normalized.mechanicId = normalized.mechanic_id;
      delete normalized.mechanic_id;
    }

    // customerId (customer_id ➔ customerId 변환 후 snake_case 전면 파기)
    if (normalized.customer_id) {
      if (!normalized.customerId) normalized.customerId = normalized.customer_id;
      delete normalized.customer_id;
    }

    // siteId (site_id ➔ siteId 변환 후 snake_case 전면 파기)
    if (normalized.site_id) {
      if (!normalized.siteId) normalized.siteId = normalized.site_id;
      delete normalized.site_id;
    }

    // contractId (contract_id ➔ contractId 변환 후 snake_case 전면 파기)
    if (normalized.contract_id) {
      if (!normalized.contractId) normalized.contractId = normalized.contract_id;
      delete normalized.contract_id;
    }

    // contractStart (contract_start ➔ contractStart 변환 후 snake_case 전면 파기)
    if (normalized.contract_start) {
      if (!normalized.contractStart) normalized.contractStart = normalized.contract_start;
      delete normalized.contract_start;
    }

    // contractEnd (contract_end ➔ contractEnd 변환 후 snake_case 전면 파기)
    if (normalized.contract_end) {
      if (!normalized.contractEnd) normalized.contractEnd = normalized.contract_end;
      delete normalized.contract_end;
    }

    // currentCustomerId (current_customer_id ➔ currentCustomerId 변환 후 snake_case 전면 파기)
    if (normalized.current_customer_id) {
      if (!normalized.currentCustomerId) normalized.currentCustomerId = normalized.current_customer_id;
      delete normalized.current_customer_id;
    }

    // currentSiteId (current_site_id ➔ currentSiteId 변환 후 snake_case 전면 파기)
    if (normalized.current_site_id) {
      if (!normalized.currentSiteId) normalized.currentSiteId = normalized.current_site_id;
      delete normalized.current_site_id;
    }

    // assetId (asset_id ➔ assetId 변환 후 snake_case 전면 파기)
    if (normalized.asset_id) {
      if (!normalized.assetId) normalized.assetId = normalized.asset_id;
      delete normalized.asset_id;
    }

    return normalized;
  }

  // 단일 테이블만 Supabase에서 pull (메뉴 전환 시 관련 테이블만 선택적 로딩용)
  /**
   * Supabase PostgREST 기본 1,000건 제한을 극복하여 대용량 테이블(billing_details 등)의 전체 레코드를 무누락 전수 로드합니다.
   */
  private async fetchAllRowsFromSupabase(tableName: string): Promise<any[] | null> {
    if (!supabase) return null;
    const PAGE_SIZE = 1000;
    let allRows: any[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        if (tableName === 'bank_initial_balances') {
          const fallback = await this.fetchAllRowsFromSupabase('bank_account_initial_balances');
          if (fallback !== null) return fallback;
        }
        if (tableName === 'asset_inout_logs') {
          const fallback = await this.fetchAllRowsFromSupabase('asset_in_out_logs');
          if (fallback !== null) return fallback;
        }
        console.warn(`[db.ts] Supabase fetchAllRows failed for ${tableName} (range ${from}-${from + PAGE_SIZE - 1}):`, error);
        if (allRows.length > 0) return allRows;
        return null;
      }

      if (!data || data.length === 0) break;
      allRows.push(...data);

      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    return allRows;
  }

  // 단일 테이블만 Supabase에서 pull (메뉴 전환 시 관련 테이블만 선택적 로딩용)
  async pullTableFromSupabase(key: string): Promise<any[] | null> {
    if (!supabase) return null;
    try {
      const tableName = this.mapToSupabaseTable(key);
      const data = await this.fetchAllRowsFromSupabase(tableName);
      if (data !== null) {
        const normalizedData = this.normalizePayloadKeys(data);
        this.set(key as keyof LocalDB, normalizedData);
        return normalizedData;
      }
      return null;
    } catch (e) {
      console.warn(`pullTableFromSupabase exception for ${key}:`, e);
      return null;
    }
  }


  async pullFromSupabase(): Promise<void> {
    if (!supabase) return;

    // 대기 중인 모든 로컬 백그라운드 쓰기(insert/update/delete)가 완료될 때까지 대기
    if (this.pendingWrites.length > 0) {
      try {
        await Promise.all(this.pendingWrites);
      } catch (err) {
        console.error("Error waiting for pending writes:", err);
      }
      this.pendingWrites = [];
    }

    // ✅ [SSOT 원칙] Supabase pull 직전, 모든 테이블의 로컬 캐시를 빈 배열로 초기화한다.
    // 이전 세션의 구버전 데이터(테스트 데이터, 삭제된 DB 데이터 등)가 로컬에 잔류하여
    // Supabase fetch 실패 테이블 영역에서 stale 데이터로 오염되는 현상을 원천 차단한다.
    ALL_DB_KEYS.forEach(key => {
      this.set(key as keyof LocalDB, []);
    });

    const tables = ALL_DB_KEYS;

    try {
      const results = await Promise.all(
        tables.map(async (key) => {
          try {
            const tableName = this.mapToSupabaseTable(key);
            const data = await this.fetchAllRowsFromSupabase(tableName);
            if (data === null) {
              console.warn(`Supabase pull failed for table ${tableName}`);
              return { key, data: null };
            }
            return { key, data: this.normalizePayloadKeys(data) };
          } catch (e) {
            console.warn(`Supabase pull failed for key ${key}:`, e);
            return { key, data: null };
          }
        })
      );

      // 전체 로컬 스토리지 캐시를 원격 DB(Supabase) 최신 값으로 덮어쓰기 (Supabase가 단일 진실의 원천 SSOT)
      results.forEach(({ key, data }) => {
        if (data !== null) {
          this.set(key as keyof LocalDB, data);
        }
      });
    } catch (err) {
      console.error("Supabase pullFromSupabase failed, falling back to local cache:", err);
      throw err;
    }
  }

  generateNextId(key: string, list: { id: string }[], extraData?: any): string {
    if (key === 'inboundNo') {
      const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const prefix = `INB-${todayStr}-`;
      let maxNum = 0;
      list.forEach((item: any) => {
        const checkStr = item.inboundNo || item.id;
        if (checkStr && typeof checkStr === 'string' && checkStr.startsWith(prefix)) {
          const numPart = parseInt(checkStr.replace(prefix, ''), 10);
          if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
        }
      });
      return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
    }

    if (key === 'billings') {
      let ymStr = '';
      if (extraData && typeof extraData.billingYm === 'string') {
        ymStr = extraData.billingYm.replace('-', '').trim().slice(2, 6);
      } else if (extraData && typeof extraData.billingDate === 'string') {
        ymStr = extraData.billingDate.replace('-', '').trim().slice(2, 6);
      }
      if (!ymStr || ymStr.length !== 4) {
        const now = new Date();
        ymStr = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0');
      }

      const billPrefix = `BILL-${ymStr}`;
      let maxNum = 0;
      list.forEach(item => {
        if (!item || !item.id) return;
        if (item.id.startsWith(billPrefix)) {
          const numPart = parseInt(item.id.replace(billPrefix, ''), 10);
          if (!isNaN(numPart) && numPart > maxNum) {
            maxNum = numPart;
          }
        }
      });
      return `${billPrefix}${String(maxNum + 1).padStart(4, '0')}`;
    }

    let prefix = '';
    switch (key) {
      case 'products':           prefix = 'PROD-';   break;
      case 'customers':          prefix = 'CUST-';   break;
      case 'assets':             prefix = 'ASSET-';  break;
      case 'sites':              prefix = 'SITE-';   break;
      case 'contacts':           prefix = 'CONT-';   break;
      case 'contracts':          prefix = 'CONTR-';  break;
      case 'vendors':            prefix = 'VND-';    break;
      case 'deliveries':         prefix = 'DLV-';    break;
      case 'repairs':            prefix = 'REP-';    break;
      case 'billings':           prefix = 'BILL-';   break;
      case 'billingDetails':     prefix = 'BDET-';   break;
      case 'payments':               prefix = 'PAY-';    break;
      case 'paymentDepositLinks':    prefix = 'PDL-';    break;
      case 'todos':              prefix = 'TODO-';   break;
      case 'bankMatchingRules':  prefix = 'RULE-';   break;
      case 'bankTransactions':   prefix = 'TXN-';    break;
      case 'departments':        prefix = 'DEPT-';   break;
      case 'users':              prefix = 'USR-';    break;
      case 'permissions':        prefix = 'PERM-';   break;
      case 'consumables':        prefix = 'CSM-';    break;
      case 'consumableLogs':     prefix = 'CLOG-';   break;
      case 'consumablePurchases':prefix = 'CPRC-';   break;
      case 'contractAssets':     prefix = 'CAST-';   break;
      case 'contractHistory':    prefix = 'CHST-';   break;
      case 'assetInOutLogs':     prefix = 'AIOG-';   break;
      case 'cashFlowSnapshots':  prefix = 'CFSN-';   break;
      case 'transportCompanies': prefix = 'TCOM-';   break;
      case 'transportDrivers':   prefix = 'TDRV-';   break;
      case 'outboundInspections':prefix = 'OIN-';    break;
      case 'inspectionChecklistItems': prefix = 'CHK-'; break;
      case 'depreciationLogs':   prefix = 'DEP-';    break;
      case 'receivables':        prefix = 'RCV-';    break;
      case 'fieldAsTickets':     prefix = 'AS-';     break;
      case 'corporateVehicles':   prefix = 'VEH-';    break;
      case 'vehicleOperationLogs':prefix = 'VLOG-';   break;
      case 'vehicleFuelLogs':     prefix = 'VFUEL-';  break;
      default:
        prefix = key.slice(0, 4).toUpperCase() + '-';
    }

    let maxNum = 0;
    const regex = new RegExp(`^${prefix}(\\d+)`, 'i');
    const fallbackRegex = new RegExp(`^${key.slice(0, 4)}-(\\d+)`, 'i');

    list.forEach(item => {
      if (!item || !item.id) return;
      let match = item.id.match(regex);
      if (!match) {
        match = item.id.match(fallbackRegex);
      }
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });

    const nextNum = maxNum + 1;
    const paddedNum = String(nextNum).padStart(7, '0');
    return `${prefix}${paddedNum}`;
  }

  private sanitizeSupabasePayload(obj: any, tableName?: string): any {
    if (!obj || typeof obj !== 'object') return obj;
    const sanitized: any = Array.isArray(obj) ? [] : {};
    for (const key in obj) {
      const val = obj[key];
      // undefined 값은 제외 (PostgreSQL update/insert Payload 오염 및 쿼리 거부 방지)
      if (val === undefined) {
        continue;
      }
      // DB consumables 스키마에 없는 supplier 컬럼 오염 방지
      if (tableName === 'consumables' && key === 'supplier') {
        continue;
      }
      // DB purchase_settlements 스키마에 없는 bankTransactionId 컬럼 오염 방지 (Audit Log는 settlement_payment_logs에 보관)
      if (tableName === 'purchase_settlements' && key === 'bankTransactionId') {
        continue;
      }
      // DB repairs 스키마에 아직 없는 siteAddress 컬럼 오염 및 PostgreSQL 42703 에러 방지
      if (tableName === 'repairs' && (key === 'siteAddress')) {
        continue;
      }
      if (typeof val === 'string' && (key === 'userId' || key === 'salespersonId' || key === 'requesterId' || key === 'accepterId' || key === 'completerId' || key === 'inbounderId' || key === 'createdById' || key === 'updatedById' || key.toLowerCase().includes('user'))) {
        const userExists = this.users.some(u => u.id === val);
        sanitized[key] = userExists ? val : (this.users[0]?.id || null);
      } else if (key === 'consumableId') {
        const consumableExists = typeof val === 'string' && val.trim() !== '' && this.consumables.some(c => c.id === val);
        sanitized[key] = consumableExists ? val : null;
      } else if (typeof val === 'string' && val.trim() === '' && (key.endsWith('Id') || key === 'contractId' || key === 'assetId' || key === 'customerId' || key === 'siteId' || key === 'salespersonId' || key === 'vendorId')) {
        sanitized[key] = null;
      } else {
        sanitized[key] = val;
      }
    }
    // repairs 테이블의 경우 siteAddress를 locationDetail 또는 memo에 무누락 백업 (원격 DB 컬럼 미반영 환경 100% 호환)
    if (tableName === 'repairs' && obj.siteAddress && typeof obj.siteAddress === 'string' && obj.siteAddress.trim()) {
      const addr = obj.siteAddress.trim();
      if (!sanitized.locationDetail || !sanitized.locationDetail.trim()) {
        sanitized.locationDetail = addr;
      } else if (!sanitized.locationDetail.includes(addr)) {
        if (!sanitized.memo || !sanitized.memo.includes(addr)) {
          sanitized.memo = sanitized.memo ? `${sanitized.memo}\n[현장도로명: ${addr}]` : `[현장도로명: ${addr}]`;
        }
      }
    }
    return sanitized;
  }

  // Supabase 테이블명 / snake_case / 복수형 키를 LocalDB의 내부 프로퍼티 키로 상호 호환 정규화
  private normalizeKey(key: string): keyof LocalDB {
    const reverseMapping: Record<string, string> = {
      customer_sites: 'sites',
      customer_contacts: 'contacts',
      customerSites: 'sites',
      customerContacts: 'contacts',
      contract_assets: 'contractAssets',
      contract_history: 'contractHistory',
      contractHistories: 'contractHistory',
      asset_inout_logs: 'assetInOutLogs',
      asset_in_out_logs: 'assetInOutLogs',
      outbound_inspections: 'outboundInspections',
      billing_details: 'billingDetails',
      transport_companies: 'transportCompanies',
      transport_drivers: 'transportDrivers',
      bank_transactions: 'bankTransactions',
      bank_matching_rules: 'bankMatchingRules',
      bank_initial_balances: 'bankInitialBalances',
      bank_account_initial_balances: 'bankInitialBalances',
      payment_deposit_links: 'paymentDepositLinks',
      repair_consumables: 'repairConsumables',
      consumable_logs: 'consumableLogs',
      consumable_purchases: 'consumablePurchases',
      purchase_settlements: 'purchaseSettlements',
      purchase_settlement_items: 'purchaseSettlementItems',
      settlement_payment_logs: 'settlementPaymentLogs',
      external_leases: 'externalLeases',
      prepaid_transactions: 'prepaidTransactions',
      delinquency_action_logs: 'delinquencyActionLogs',
      legal_notice_logs: 'legalNoticeLogs',
      legal_notice_templates: 'legalNoticeTemplates',
      inspection_checklist_items: 'inspectionChecklistItems',
      mechanic_consumable_stocks: 'mechanicConsumableStocks',
      depreciation_logs: 'depreciationLogs',
      annual_leave_quotas: 'annualLeaveQuotas',
      leave_usages: 'leaveUsages',
      overtime_records: 'overtimeRecords',
      payroll_closings: 'payrollClosings',
    };
    return (reverseMapping[key] || key) as keyof LocalDB;
  }

  // 단일 행 조회 (로컬 캐시 기준, snake_case 및 복수형 키 자동 호환)
  getRow<T extends { id: string }>(key: keyof LocalDB | string, id: string): T | null {
    const tableKey = this.normalizeKey(key as string);
    const list = ((this[tableKey] || []) as unknown) as T[];
    if (!Array.isArray(list)) return null;
    return list.find(item => item && item.id === id) || null;
  }

  // 헬퍼 메소드들 - CRUD 시뮬레이션 및 백그라운드 Supabase 업로드
  addRow<T extends { id: string }>(key: keyof LocalDB | string, row: Omit<T, 'id'> & { id?: string }): T {
    return this.insertRow<T>(key, row);
  }

  insertRow<T extends { id: string }>(key: keyof LocalDB | string, row: Omit<T, 'id'> & { id?: string }): T {
    const tableKey = this.normalizeKey(key as string);
    const list = ((this[tableKey] || []) as unknown) as T[];
    const newId = row.id || this.generateNextId(tableKey as string, list as any, row);
    const nowIso = new Date().toISOString();
    const formattedRow = {
      createdAt: nowIso,
      updatedAt: nowIso,
      ...(row as any),
      id: newId
    };
    const newRow = formattedRow as unknown as T;
    list.push(newRow);
    this.set(tableKey, list);

    if (supabase) {
      const tableName = this.mapToSupabaseTable(tableKey as string);
      const payloadForSupabase = this.sanitizeSupabasePayload(newRow, tableName);
      // upsert(onConflict: 'id'): 동일 id가 이미 존재하면 update로 대체 — PK 중복 오류 방지
      const promise = supabase
        .from(tableName)
        .upsert([payloadForSupabase], { onConflict: 'id' })
        .then(({ data, error }) => {
          if (error) {
            console.error(`Supabase upsert failed for ${tableName}:`, error);
            const msg = error.message || String(error);
            if (msg.includes('Could not find the table') || error.code === 'PGRST204' || error.code === '42P01') {
              if (tableName === 'bank_initial_balances') {
                return supabase.from('bank_account_initial_balances').upsert([payloadForSupabase], { onConflict: 'id' }).then(({ data: fd }) => fd);
              }
              if (tableName === 'asset_inout_logs') {
                return supabase.from('asset_in_out_logs').upsert([payloadForSupabase], { onConflict: 'id' }).then(({ data: fd }) => fd);
              }
              console.warn(`[Graceful Isolation] 원격 Supabase DB에 ${tableName} 테이블이 존재하지 않습니다. 로컬 저장을 완결합니다.`);
              return null;
            }
            // 신규 미반영 컬럼 에러 시 2차 Fallback (주요 기본 컬럼만 전송하여 100% 저장 성공 보장)
            if (msg.includes('column') || msg.includes('Could not find') || error.code === 'PGRST200' || error.code === '42703') {
              const fallbackPayload = { ...payloadForSupabase };
              delete fallbackPayload.defectsJson;
              delete fallbackPayload.inboundNo;
              delete fallbackPayload.maintenanceScore;
              delete fallbackPayload.supplier;
              delete fallbackPayload.bankTransactionId;
              return supabase.from(tableName).upsert([fallbackPayload], { onConflict: 'id' }).then(({ data: d2, error: e2 }) => {
                if (e2) console.warn(`Supabase fallback upsert failed for ${tableName}:`, e2);
                return d2;
              });
            }
            return null;
          }
          return data;
        });
      this.pendingWrites.push(promise);
    }

    return newRow;
  }

  updateRow<T extends { id: string }>(key: keyof LocalDB | string, id: string, updates: Partial<T>): T | null {
    const tableKey = this.normalizeKey(key as string);
    const list = ((this[tableKey] || []) as unknown) as T[];
    if (!Array.isArray(list)) return null;
    const index = list.findIndex(item => item && item.id === id);
    if (index === -1) return null;
    const nowIso = new Date().toISOString();
    const updatedPayload = {
      ...updates,
      updatedAt: nowIso
    };
    const updated = { ...list[index], ...updatedPayload } as unknown as T;
    list[index] = updated;
    this.set(tableKey, list);

    if (supabase) {
      const tableName = this.mapToSupabaseTable(tableKey as string);
      let payloadForSupabase = this.sanitizeSupabasePayload(updatedPayload, tableName);

      // 💡 [NULL 컬럼 갱신 보장]: updates에 명시적으로 전달된 undefined/null 필드를 Supabase null로 정확히 반영
      for (const updateKey in updates) {
        if (updates[updateKey] === undefined || updates[updateKey] === null) {
          payloadForSupabase[updateKey] = null;
        }
      }

      // 🛡️ [FK 위반 원천 차단] consumable_purchases 테이블 업데이트 시,
      // 기존 레코드에 남아있는 consumableId가 유효하지 않으면 consumableId = null을 명시하여 Supabase FK 오류를 완벽하게 예방
      if (tableName === 'consumable_purchases') {
        const targetConsumableId = ('consumableId' in payloadForSupabase) ? payloadForSupabase.consumableId : (list[index] as any)?.consumableId;
        const isValid = typeof targetConsumableId === 'string' && targetConsumableId.trim() !== '' && this.consumables.some(c => c.id === targetConsumableId);
        if (!isValid) {
          payloadForSupabase = {
            ...payloadForSupabase,
            consumableId: null
          };
        }
      }

      const promise = supabase
        .from(tableName)
        .update(payloadForSupabase as any)
        .eq('id', id)
        .then(({ data, error }) => {
          if (error) {
            console.error(`Supabase update failed for ${tableName}:`, error);
            const msg = error.message || String(error);
            if (msg.includes('Could not find the table') || error.code === 'PGRST204' || error.code === '42P01') {
              if (tableName === 'bank_initial_balances') {
                return supabase.from('bank_account_initial_balances').update(payloadForSupabase as any).eq('id', id).then(({ data: fd }) => fd);
              }
              if (tableName === 'asset_inout_logs') {
                return supabase.from('asset_in_out_logs').update(payloadForSupabase as any).eq('id', id).then(({ data: fd }) => fd);
              }
              console.warn(`[Graceful Isolation] 원격 Supabase DB에 ${tableName} 테이블이 존재하지 않습니다. 로컬 저장을 완결합니다.`);
              return null;
            }
            throw error;
          }
          return data;
        });
      this.pendingWrites.push(promise);
    }

    return updated;
  }

  deleteRow<T extends { id: string }>(key: keyof LocalDB | string, id: string): boolean {
    const tableKey = this.normalizeKey(key as string);
    // 최고관리자 계정 절대 보호
    if (tableKey === 'users' && (id === 'u-1' || id === 'sys-admin')) {
      console.warn('Cannot delete system administrator account.');
      return false;
    }
    const list = ((this[tableKey] || []) as unknown) as T[];
    if (!Array.isArray(list)) return false;
    const filtered = list.filter(item => item && item.id !== id);
    if (filtered.length === list.length) return false;
    this.set(tableKey, filtered);

    if (supabase) {
      const tableName = this.mapToSupabaseTable(tableKey as string);
      const promise = supabase
        .from(tableName)
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) {
            console.error(`Supabase delete failed for ${tableName}:`, error);
            const msg = error.message || String(error);
            if (msg.includes('Could not find the table') || error.code === 'PGRST204' || error.code === '42P01') {
              if (tableName === 'bank_initial_balances') {
                return supabase.from('bank_account_initial_balances').delete().eq('id', id);
              }
              if (tableName === 'asset_inout_logs') {
                return supabase.from('asset_in_out_logs').delete().eq('id', id);
              }
              console.warn(`[Graceful Isolation] 원격 Supabase DB에 ${tableName} 테이블이 존재하지 않습니다. 로컬 저장을 완결합니다.`);
              return null;
            }
            throw new Error(`[Supabase DB 삭제 실패] ${tableName} (ID: ${id})\n\n사유: ${msg}`);
          }
        });
      this.pendingWrites.push(promise);
    }

    return true;
  }

  // Bulk upload all tables to Supabase
  async uploadAllTables(): Promise<void> {
    if (!supabase) return;
    const tables = ALL_DB_KEYS;
    await Promise.all(tables.map(async (key) => {
      const data = (this as any)[key] as any[];
      const tableName = this.mapToSupabaseTable(key);
      const sanitizedData = Array.isArray(data) ? data.map(item => this.sanitizeSupabasePayload(item, tableName)) : [];
      const { error } = await supabase.from(tableName).upsert(sanitizedData, { onConflict: 'id' });
      if (error) console.error(`Bulk upsert error for ${tableName}:`, error);
    }));
  }

  // Clear all data from Supabase tables
  async clearAllTables(): Promise<void> {
    this.inMemoryCache.clear();
    const tables = ALL_DB_KEYS;
    // Clear local storage first
    tables.forEach(key => {
      this.set(key, []);
    });
    
    if (!supabase) return;
    await Promise.all(tables.map(async (key) => {
      const tableName = this.mapToSupabaseTable(key);
      const { error } = await supabase.from(tableName).delete().neq('id', '');
      if (error) console.error(`Clear table error for ${tableName}:`, error);
    }));
  }


  // 조직도 및 구성원 일괄 저장 (Batch) - 기존 데이터를 전부 덮어씌움
  async saveOrganizationBatch(departments: Department[], users: User[]): Promise<void> {
    this.set('departments', departments);
    this.set('users', users);
    
    if (supabase) {
      const promise = (async () => {
        // 1. Departments Sync (삭제된 부서 식별 후 삭제, 신규/수정 부서 upsert)
        const currentDepts = await supabase.from('departments').select('id');
        if (currentDepts.data) {
          const deptsToDelete = currentDepts.data
            .map(d => d.id)
            .filter(id => !departments.some(d => d.id === id));
          if (deptsToDelete.length > 0) {
            const { error: delErr } = await supabase.from('departments').delete().in('id', deptsToDelete);
            if (delErr) {
              console.error('Supabase delete departments failed:', delErr);
              throw delErr;
            }
          }
        }
        if (departments.length > 0) {
          const nowIso = new Date().toISOString();
          const sanitizedDepts = departments.map(d => ({
            ...d,
            createdAt: d.createdAt || nowIso,
            updatedAt: nowIso
          }));
          const { error: deptErr } = await supabase.from('departments').upsert(sanitizedDepts, { onConflict: 'id' });
          if (deptErr) {
            console.error('Supabase batch upsert departments failed:', deptErr);
            throw deptErr;
          }
        }

        // 2. Users Sync (삭제된 직원 식별 후 삭제, 신규/수정 직원 upsert)
        const currentUsers = await supabase.from('users').select('id');
        if (currentUsers.data) {
          const usersToDelete = currentUsers.data
            .map(u => u.id)
            // admin 계정은 절대 삭제 리스트에서 제외
            .filter(id => id !== 'u-1' && id !== 'sys-admin' && !users.some(u => u.id === id));
          if (usersToDelete.length > 0) {
            const { error: delErr } = await supabase.from('users').delete().in('id', usersToDelete);
            if (delErr) {
              console.error('Supabase delete users failed:', delErr);
              throw delErr;
            }
          }
        }
        if (users.length > 0) {
          const nowIso = new Date().toISOString();
          const sanitizedUsers = users.map(u => ({
            ...u,
            createdAt: u.createdAt || nowIso,
            updatedAt: nowIso
          }));
          const { error: userErr } = await supabase.from('users').upsert(sanitizedUsers, { onConflict: 'id' });
          if (userErr) {
            console.error('Supabase batch upsert users failed:', userErr);
            throw userErr;
          }
        }
      })();
      this.pendingWrites.push(promise);
      await promise;
    }
  }
}

export const db = new LocalDB();
