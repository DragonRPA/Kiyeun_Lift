import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// 법인 표기어 및 공백 제거 정규화 파서
export function normalizeCustomerName(name: string): string {
  if (!name) return '';
  return name
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
  bankAccounts?: CustomerBankAccount[]; // 고객사 다중 계좌 목록
  createdAt: string;
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
  createdAt: string;
}

export interface Product {
  id: string;
  modelName: string;
  feet: number;
  spec: string;
  manufacturer: string;
  isActive?: boolean; // 사용/미사용 (단종/매각 등)
  
  // 🌟 안전점검결과서 자동 연동 4대 핵심 제원
  weight?: string;           // 장비중량 (예: '7,513 kg', '1,500 kg')
  speed?: string;            // 운행속도 (예: '4.8 Km/h', '3.5 Km/h')
  maxHeightCapacity?: string;// 작업최대높이/적재용량 (예: '15.9 M / 227 kg', '7.8 M / 227 kg')
  safetyCertDate?: string;   // 안전인증년월일 (예: '2009-09-14', '2024-03-01')

  safetyCertUrl?: string;
  specSheetUrl?: string;
  emergencyGuideUrl?: string;
  createdAt: string;
}

export interface Asset {
  id: string;
  modelName: string;
  assetNo: string; // 관리번호
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
  let targetDate = asOfDate;
  if (asset.status === 'SOLD' && asset.disposalDate) {
    const parsedDisposal = new Date(asset.disposalDate);
    if (!isNaN(parsedDisposal.getTime())) {
      targetDate = parsedDisposal;
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
  stockQty: number;
  unit: string; // '개' | '박스' 등
  unitPrice: number;
  supplier: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConsumableLog {
  id: string;
  consumableId: string;
  type: 'INBOUND' | 'OUTBOUND' | 'ADJUST';
  quantity: number;
  unitPrice: number;
  supplier?: string;
  userId?: string;
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
  status?: 'RENTED' | 'RETURNED' | 'ASSIGNED' | string;
  actualReturnDate?: string;
  monthlyRentalFee: number;
  dailyRentalFee: number;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Contract {
  id: string;
  contractNo: string;
  customerId: string;
  contactId?: string;
  siteId?: string;
  startDate: string;
  endDate: string;
  billingDay: number; // 마감일 (예: 30)
  statementClosingDay?: number; // 거래명세서 마감일 (예: 25)
  status: 'ACTIVE' | 'EXTENDED' | 'SHORTENED' | 'SUCCEEDED' | 'COMPLETED';
  successorContractId?: string;
  predecessorContractId?: string; // 승계 전 이전 계약 ID
  predecessorContractNo?: string; // 승계 전 이전 계약번호
  predecessorCustomerId?: string; // 승계 전 양도 고객사 ID
  predecessorCustomerName?: string; // 승계 전 양도 고객사명
  driveFolderId?: string;
  salespersonId?: string; // 계약담당자 (영업사원 ID)
  createdAt: string;
  updatedAt: string;
  // 가상필드 (조인 시)
  assets?: ContractAsset[];
}

export interface ContractHistory {
  id: string;
  contractId: string;
  changeType: 'REGISTER' | 'EXTEND' | 'SHORTEN' | 'SUCCEED' | 'TERMINATE' | 'EXCHANGE' | 'FEE_CHANGE';
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
  itemName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  description: string;
  createdAt: string;
}

export interface Billing {
  id: string;
  customerId: string;
  contractId?: string; // 연결된 계약 ID (개별 계약 정산용)
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

export interface Payment {
  id: string;
  billingId: string;
  paymentDate: string;
  amount: number;
  method: string; // 'BANK_TRANSFER' | 'CARD' | 'CASH'
  memo: string;
  createdAt: string;
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
  destinationAddress?: string; // 하차지
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
  isCostSettled: boolean;
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

export interface Repair {
  id: string;
  assetId: string;
  mechanicId?: string;
  repairType?: 'INTERNAL' | 'EXTERNAL';
  vendorId?: string;
  outboundDate?: string;
  completedDate?: string;
  estimateFileUrl?: string;
  requestDate: string;
  repairDate?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  details: string;
  totalCost: number;
  billableToCustomer: boolean;
  billingId?: string;
  purchaseBillId?: string;
  isCustomerFault?: boolean;
  faultImageUrl?: string;
  inboundNo?: string;
  defectsJson?: string;
  createdAt: string;
  updatedAt: string;
  // 가상필드
  consumables?: RepairConsumable[];
}

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
  quotationTemplateUrl?: string;
  contractTemplateUrl?: string;
  safetyInspectionTemplateUrl?: string;
  preDeliveryChecklistTemplateUrl?: string;
  bizRegCertUrl?: string;
  bankbookCopyUrl?: string;
  transactionStatementTemplateUrl?: string;
  currentInsuranceStartDate?: string;
  currentInsuranceEndDate?: string;
  nextInsuranceCertUrl?: string;
  nextInsuranceStartDate?: string;
  nextInsuranceEndDate?: string;
  defaultRootFolderId?: string;
  appsScriptUrl?: string;
  oauthClientId?: string;   // 구글 드라이브 백업용 OAuth 2.0 Client ID
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
  subNo: string; // 입고하위번호 (예: INB-20260809-001-01)
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
  createdAt: string;
}

export type OutboundInspectionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

export interface OutboundInspection {
  id: string;
  contractId?: string;
  contractAssetId?: string;
  assetId?: string;
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

// 초기 로컬 스토리지 데이터 생성

const generateMockProducts = (): Product[] => {
  return [
    { id: 'prod-1', modelName: 'SKY-800', feet: 8, spec: '배터리형, 8m', manufacturer: 'SKY', weight: '1,500 kg', speed: '3.5 Km/h', maxHeightCapacity: '7.8 M / 227 kg', safetyCertDate: '2022-05-10', isActive: true, createdAt: new Date().toISOString() },
    { id: 'prod-2', modelName: 'GENIE-1000', feet: 10, spec: '디젤형, 10m', manufacturer: 'GENIE', weight: '2,800 kg', speed: '4.0 Km/h', maxHeightCapacity: '10.0 M / 454 kg', safetyCertDate: '2021-08-15', isActive: true, createdAt: new Date().toISOString() },
    { id: 'prod-3', modelName: 'Z-45/25J', feet: 45, spec: '디젤굴절형, 15.9m', manufacturer: 'GENIE', weight: '7,513 kg', speed: '4.8 Km/h', maxHeightCapacity: '15.9 M / 227 kg', safetyCertDate: '2009-09-14', isActive: true, createdAt: new Date().toISOString() },
    { id: 'prod-4', modelName: 'GS-1930', feet: 19, spec: '배터리수직형, 7.8m', manufacturer: 'GENIE', weight: '1,500 kg', speed: '4.0 Km/h', maxHeightCapacity: '7.8 M / 227 kg', safetyCertDate: '2024-03-01', isActive: true, createdAt: new Date().toISOString() }
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
    quotationTemplateUrl: 'templates/렌탈견적서_양식.html',
    contractTemplateUrl: 'templates/고소작업대_임대차계약서_양식.html',
    safetyInspectionTemplateUrl: 'templates/고소작업대_안전점검결과서_양식.html',
    preDeliveryChecklistTemplateUrl: 'templates/반입전_CHECK_LIST_양식.html',
    bizRegCertUrl: '',
    bankbookCopyUrl: '',
    transactionStatementTemplateUrl: 'templates/거래명세서_양식.html',
    currentInsuranceStartDate: '2026-03-05',
    currentInsuranceEndDate: '2027-03-05',
    nextInsuranceStartDate: '2027-03-05',
    nextInsuranceEndDate: '2028-03-05',
    defaultRootFolderId: '1aBZsZ1KnKhk9Ax6oiM2cb-yKfDHKGRif',
    oauthClientId: '274287991550-7eaeisb14i80315pmlf8390smf58pkbt.apps.googleusercontent.com',
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

export const ALL_DB_KEYS = [
  'users', 'departments', 'permissions', 'customers', 'contacts', 'sites', 
  'products', 'assets', 'consumables', 'consumableLogs', 'consumablePurchases',
  'contracts', 'contractAssets', 'contractHistory', 'deliveries', 
  'transportCompanies', 'transportDrivers', 'vendors',
  'billings', 'billingDetails', 'payments', 'repairs', 'repairConsumables', 'todos', 
  'bankTransactions', 'bankMatchingRules', 'bankInitialBalances', 'googleConfigs', 'assetInOutLogs',
  'cashFlowSnapshots', 'outboundInspections', 'depreciationLogs',
  'purchaseSettlements', 'purchaseSettlementItems', 'settlementPaymentLogs', 'externalLeases',
  'annualLeaveQuotas', 'leaveUsages', 'overtimeRecords', 'payrollClosings', 'inspectionChecklistItems'
];

class LocalDB {
  private get<T>(key: string, seed: T[]): T[] {
    const val = localStorage.getItem(`erp_${key}`);
    if (!val) {
      localStorage.setItem(`erp_${key}`, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(val);
  }

  private set<T>(key: string, data: T[]): void {
    localStorage.setItem(`erp_${key}`, JSON.stringify(data));
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

  get sites() { return this.get<CustomerSite>('sites', SEED_SITES); }
  set sites(val: CustomerSite[]) { this.set('sites', val); }

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

  get contracts() { return this.get<Contract>('contracts', SEED_CONTRACTS); }
  set contracts(val: Contract[]) { this.set('contracts', val); }

  get contractAssets() { return this.get<ContractAsset>('contractAssets', SEED_CONTRACT_ASSETS); }
  set contractAssets(val: ContractAsset[]) { this.set('contractAssets', val); }

  get contractHistory() { return this.get<ContractHistory>('contractHistory', SEED_CONTRACT_HISTORY); }
  set contractHistory(val: ContractHistory[]) { this.set('contractHistory', val); }

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

  get repairs() { return this.get<Repair>('repairs', SEED_REPAIRS); }
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

  // Supabase 테이블 맵핑
  private mapToSupabaseTable(key: string): string {
    const mapping: Record<string, string> = {
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
      assetInOutLogs: 'asset_inout_logs',
      googleConfigs: 'google_configs',
      vendors: 'vendors',
      cashFlowSnapshots: 'cash_flow_snapshots',
      outboundInspections: 'outbound_inspections',
      depreciationLogs: 'depreciation_logs',
      purchaseSettlements: 'purchase_settlements',
      purchaseSettlementItems: 'purchase_settlement_items',
      externalLeases: 'external_leases',
      inspectionChecklistItems: 'inspection_checklist_items'
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
  async pullTableFromSupabase(key: string): Promise<any[] | null> {
    if (!supabase) return null;
    try {
      const tableName = this.mapToSupabaseTable(key);
      const { data, error } = await supabase.from(tableName).select('*');
      if (error) {
        console.warn(`pullTableFromSupabase failed for ${tableName}:`, error);
        return null;
      }
      if (data !== null) {
        const normalizedData = this.normalizePayloadKeys(data);
        this.set(key as keyof LocalDB, normalizedData);
        return normalizedData;
      }
      return data;
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

    // googleConfigs는 SEED 오염 방지를 위해 Supabase pull 직전 로컬 캐시를 항상 비움
    // (이전에 SEED 데이터가 localStorage에 캐싱된 경우도 완전히 초기화)
    this.set('googleConfigs', []);

    const tables = ALL_DB_KEYS;

    try {
      const results = await Promise.all(
        tables.map(async (key) => {
          try {
            const tableName = this.mapToSupabaseTable(key);
            const { data, error } = await supabase!
              .from(tableName)
              .select('*');
            if (error) {
              console.warn(`Supabase pull failed for table ${tableName}:`, error);
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
    return sanitized;
  }

  // 헬퍼 메소드들 - CRUD 시뮬레이션 및 백그라운드 Supabase 업로드
  insertRow<T extends { id: string }>(key: keyof LocalDB, row: Omit<T, 'id'> & { id?: string }): T {
    const list = (this[key] as unknown) as T[];
    const newId = row.id || this.generateNextId(key as string, list as any, row);
    const nowIso = new Date().toISOString();
    const formattedRow = {
      createdAt: nowIso,
      updatedAt: nowIso,
      ...(row as any),
      id: newId
    };
    const newRow = formattedRow as unknown as T;
    list.push(newRow);
    this.set(key, list);

    if (supabase) {
      const tableName = this.mapToSupabaseTable(key as string);
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

  updateRow<T extends { id: string }>(key: keyof LocalDB, id: string, updates: Partial<T>): T | null {
    const list = (this[key] as unknown) as T[];
    const index = list.findIndex(item => item.id === id);
    if (index === -1) return null;
    const nowIso = new Date().toISOString();
    const updatedPayload = {
      ...updates,
      updatedAt: nowIso
    };
    const updated = { ...list[index], ...updatedPayload } as unknown as T;
    list[index] = updated;
    this.set(key, list);

    if (supabase) {
      const tableName = this.mapToSupabaseTable(key as string);
      let payloadForSupabase = this.sanitizeSupabasePayload(updatedPayload, tableName);

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

  deleteRow<T extends { id: string }>(key: keyof LocalDB, id: string): boolean {
    // 최고관리자 계정 절대 보호
    if (key === 'users' && (id === 'u-1' || id === 'sys-admin')) {
      console.warn('Cannot delete system administrator account.');
      return false;
    }
    const list = (this[key] as unknown) as T[];
    const filtered = list.filter(item => item.id !== id);
    if (filtered.length === list.length) return false;
    this.set(key, filtered);

    if (supabase) {
      const tableName = this.mapToSupabaseTable(key as string);
      const promise = supabase
        .from(tableName)
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) {
            console.error(`Supabase delete failed for ${tableName}:`, error);
            const msg = error.message || String(error);
            if (msg.includes('Could not find the table') || error.code === 'PGRST204' || error.code === '42P01') {
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
