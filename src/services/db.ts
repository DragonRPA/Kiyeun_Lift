// d:\Kiyeun_Lift\src\services\db.ts

export interface User {
  id: string;
  loginId: string;
  passwordHash: string; // 단순 비교용 평문 패스워드로 시딩
  name: string;
  department: string;
  role: 'ADMIN' | 'MANAGER' | 'USER' | 'MECHANIC';
  createdAt: string;
}

export interface MenuPermission {
  id: string;
  role: string;
  menuId: string; // 'customer' | 'product' | 'asset' | 'acquisition_disposal' | 'rent_asset' | 'consumable' | 'contract' | 'billing' | 'delivery' | 'repair' | 'permission'
  canView: boolean;
  canSave: boolean;
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
  driveFolderId?: string;
  createdAt: string;
}

export interface CustomerContact {
  id: string;
  customerId: string;
  name: string;
  position: string;
  contact: string;
  email: string;
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
  createdAt: string;
}

export interface Product {
  id: string;
  modelName: string;
  feet: number;
  spec: string;
  manufacturer: string;
  createdAt: string;
}

export interface Asset {
  id: string;
  modelName: string;
  assetNo: string; // 관리번호
  serialNo?: string; // 제조번호
  manufacturer?: string;
  ownerType: 'OWNED' | 'RENTED'; // 당사자산 / 임차자산
  status: 'AVAILABLE' | 'RENTED' | 'REPAIRING' | 'RENTED_RETURNED' | 'SOLD';
  
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
  depreciationMonths?: number;
  residualValueRate?: number; // % (예: 10)
  accumDepreciation?: number; // 감가상각누계액
  bookValue?: number; // 장부가
  cumRentalFee?: number; // 누적렌탈료
  cumRepairCost?: number; // 누적수리비

  // 임차자산 상세
  renter?: string; // 임차처
  rentStart?: string;
  rentEnd?: string;
  monthlyRentFee?: number;
  dailyRentFee?: number;

  // 매각 상세
  disposalDate?: string;
  disposalPrice?: number;
  buyer?: string; // 매각처

  supplier?: string; // 구입처
  memo1?: string;
  memo2?: string;
  createdAt: string;
  updatedAt: string;
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

export interface ContractAsset {
  id: string;
  contractId: string;
  assetId: string;
  monthlyRentalFee: number;
  dailyRentalFee: number;
  startDate: string;
  endDate: string;
  createdAt: string;
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
  status: 'ACTIVE' | 'EXTENDED' | 'SHORTENED' | 'SUCCEEDED' | 'COMPLETED';
  successorContractId?: string;
  driveFolderId?: string;
  createdAt: string;
  updatedAt: string;
  // 가상필드 (조인 시)
  assets?: ContractAsset[];
}

export interface ContractHistory {
  id: string;
  contractId: string;
  changeType: 'REGISTER' | 'EXTEND' | 'SHORTEN' | 'SUCCEED' | 'TERMINATE';
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
  billingYm: string; // 'YYYY-MM'
  billingDate: string;
  totalAmount: number;
  paidAmount: number;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
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

export interface Delivery {
  id: string;
  contractId?: string;
  type: 'OUTBOUND' | 'INBOUND'; // 출고의뢰 / 회수의뢰
  status: 'REQUESTED' | 'DISPATCHED' | 'COMPLETED';
  requestDate: string;
  scheduledDate?: string;
  vehicleType?: string; // 'cargo_truck' | 'self_loader'
  driverName?: string;
  driverContact?: string;
  deliveryCost: number;
  isCostSettled: boolean;
  memo: string;
  createdAt: string;
  updatedAt: string;
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
  requestDate: string;
  repairDate?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  details: string;
  totalCost: number;
  billableToCustomer: boolean;
  billingId?: string;
  createdAt: string;
  updatedAt: string;
  // 가상필드
  consumables?: RepairConsumable[];
}

// 초기 로컬 스토리지 데이터 생성
const SEED_USERS: User[] = [
  { id: 'u-1', loginId: 'admin', passwordHash: 'admin123', name: '김관리', department: '본사', role: 'ADMIN', createdAt: new Date().toISOString() },
  { id: 'u-2', loginId: 'manager', passwordHash: 'mgr123', name: '박부장', department: '영업부', role: 'MANAGER', createdAt: new Date().toISOString() },
  { id: 'u-3', loginId: 'user', passwordHash: 'user123', name: '이대리', department: '영업부', role: 'USER', createdAt: new Date().toISOString() },
  { id: 'u-4', loginId: 'mechanic', passwordHash: 'mech123', name: '최정비', department: '정비팀', role: 'MECHANIC', createdAt: new Date().toISOString() }
];

const SEED_PERMISSIONS: MenuPermission[] = [
  // ADMIN
  ...['customer', 'product', 'asset', 'acquisition_disposal', 'rent_asset', 'consumable', 'contract', 'billing', 'delivery', 'repair', 'permission', 'smart_dispatch'].map(menu => ({
    id: `p-admin-${menu}`, role: 'ADMIN', menuId: menu, canView: true, canSave: true
  })),
  // MANAGER
  ...['customer', 'product', 'asset', 'acquisition_disposal', 'rent_asset', 'consumable', 'contract', 'billing', 'delivery', 'repair', 'smart_dispatch'].map(menu => ({
    id: `p-mgr-${menu}`, role: 'MANAGER', menuId: menu, canView: true, canSave: true
  })),
  { id: 'p-mgr-permission', role: 'MANAGER', menuId: 'permission', canView: true, canSave: false },
  // USER
  ...['customer', 'product', 'asset', 'rent_asset', 'contract', 'billing', 'smart_dispatch'].map(menu => ({
    id: `p-user-${menu}`, role: 'USER', menuId: menu, canView: true, canSave: true
  })),
  ...['acquisition_disposal', 'consumable', 'delivery', 'repair'].map(menu => ({
    id: `p-user-${menu}`, role: 'USER', menuId: menu, canView: true, canSave: false
  })),
  { id: 'p-user-permission', role: 'USER', menuId: 'permission', canView: false, canSave: false },
  // MECHANIC
  { id: 'p-mech-repair', role: 'MECHANIC', menuId: 'repair', canView: true, canSave: true },
  { id: 'p-mech-consumable', role: 'MECHANIC', menuId: 'consumable', canView: true, canSave: true },
  { id: 'p-mech-asset', role: 'MECHANIC', menuId: 'asset', canView: true, canSave: false },
  { id: 'p-mech-delivery', role: 'MECHANIC', menuId: 'delivery', canView: true, canSave: false },
  ...['customer', 'product', 'acquisition_disposal', 'rent_asset', 'contract', 'billing', 'permission', 'smart_dispatch'].map(menu => ({
    id: `p-mech-${menu}`, role: 'MECHANIC', menuId: menu, canView: false, canSave: false
  }))
];

const SEED_PRODUCTS: Product[] = [
  { id: 'prod-1', modelName: 'Skyjack SJ3219', feet: 19, spec: '작업높이 7.8m / 리프트 용량 227kg', manufacturer: 'Skyjack', createdAt: new Date().toISOString() },
  { id: 'prod-2', modelName: 'Genie GS-1930', feet: 19, spec: '작업높이 7.8m / 무소음 친환경 모터', manufacturer: 'Genie', createdAt: new Date().toISOString() },
  { id: 'prod-3', modelName: 'JLG 1930ES', feet: 19, spec: '작업높이 7.7m / 장시간 운행 배터리', manufacturer: 'JLG', createdAt: new Date().toISOString() },
  { id: 'prod-4', modelName: 'Skyjack SJ4632', feet: 32, spec: '작업높이 11.7m / 넓은 적재 공간', manufacturer: 'Skyjack', createdAt: new Date().toISOString() }
];

const SEED_CUSTOMERS: Customer[] = [
  { id: 'cust-1', name: '현대건설(주)', bizRegNo: '101-81-12345', isClosed: false, address: '서울시 종로구 율곡로 75', representative: '윤영준', repContact: '02-746-1114', repEmail: 'contact@hdec.co.kr', driveFolderId: 'folder-hdec-123', createdAt: new Date().toISOString() },
  { id: 'cust-2', name: '삼성물산(주)', bizRegNo: '202-81-54321', isClosed: false, address: '서울시 강동구 상일로6길 26', representative: '오세철', repContact: '02-2145-5114', repEmail: 'info@samsungcnt.com', driveFolderId: 'folder-samsung-456', createdAt: new Date().toISOString() }
];

const SEED_CONTACTS: CustomerContact[] = [
  { id: 'cc-1', customerId: 'cust-1', name: '김민수 과장', position: '공사담당', contact: '010-1234-5678', email: 'ms.kim@hdec.co.kr', createdAt: new Date().toISOString() },
  { id: 'cc-2', customerId: 'cust-2', name: '이지훈 대리', position: '관리담당', contact: '010-8765-4321', email: 'jh.lee@samsungcnt.com', createdAt: new Date().toISOString() }
];

const SEED_SITES: CustomerSite[] = [
  { id: 'cs-1', customerId: 'cust-1', name: '여의도 파크원 오피스 빌딩 신축현장', address: '서울시 영등포구 여의도동 22', contactName: '김민수 과장', contact: '010-1234-5678', email: 'ms.kim@hdec.co.kr', createdAt: new Date().toISOString() },
  { id: 'cs-2', customerId: 'cust-2', name: '반포 주공 1단지 재건축 현장', address: '서울시 서초구 반포동 110-1', contactName: '박현우 부장', contact: '010-9999-8888', email: 'hw.park@samsungcnt.com', createdAt: new Date().toISOString() }
];

const SEED_ASSETS: Asset[] = [
  {
    id: 'as-1', modelName: 'Skyjack SJ3219', assetNo: 'SJ19-001', serialNo: 'SJ19S-228394', manufacturer: 'Skyjack', ownerType: 'OWNED', status: 'AVAILABLE',
    billingDay: 30, monthlyRentalFee: 400000, dailyRentalFee: 15000,
    acquisitionDate: '2024-01-15', acquisitionPrice: 6500000, depreciationMonths: 60, residualValueRate: 10.00,
    accumDepreciation: 2925000, bookValue: 3575000, cumRentalFee: 3600000, cumRepairCost: 150000,
    supplier: '스카이잭 한국지사', memo1: 'A블럭 작업용 주력장비', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  },
  {
    id: 'as-2', modelName: 'Genie GS-1930', assetNo: 'GE19-002', serialNo: 'GE19G-382910', manufacturer: 'Genie', ownerType: 'OWNED', status: 'RENTED',
    currentCustomerId: 'cust-1', currentSiteId: 'cs-1', contractStart: '2026-03-01', contractEnd: '2026-08-31',
    billingDay: 30, monthlyRentalFee: 450000, dailyRentalFee: 18000,
    acquisitionDate: '2024-03-20', acquisitionPrice: 7200000, depreciationMonths: 60, residualValueRate: 10.00,
    accumDepreciation: 2880000, bookValue: 4320000, cumRentalFee: 4500000, cumRepairCost: 75000,
    supplier: '지니 코리아', memo1: '모터 소음 없음, 상태 양호', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  },
  {
    id: 'as-3', modelName: 'JLG 1930ES', assetNo: 'JL19-003', serialNo: 'JL19J-993821', manufacturer: 'JLG', ownerType: 'RENTED', status: 'RENTED',
    currentCustomerId: 'cust-2', currentSiteId: 'cs-2', contractStart: '2026-05-10', contractEnd: '2026-11-09',
    billingDay: 30, monthlyRentalFee: 420000, dailyRentalFee: 16000,
    renter: '한국종합렌탈(주)', rentStart: '2026-05-01', rentEnd: '2026-11-30', monthlyRentFee: 320000, dailyRentFee: 12000,
    supplier: '한국종합렌탈(주)', memo1: '재임대 장비', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  },
  {
    id: 'as-4', modelName: 'Skyjack SJ4632', assetNo: 'SJ32-004', serialNo: 'SJ32S-482938', manufacturer: 'Skyjack', ownerType: 'OWNED', status: 'AVAILABLE',
    billingDay: 30, monthlyRentalFee: 650000, dailyRentalFee: 25000,
    acquisitionDate: '2025-05-10', acquisitionPrice: 12000000, depreciationMonths: 60, residualValueRate: 10.00,
    accumDepreciation: 2520000, bookValue: 9480000, cumRentalFee: 1300000, cumRepairCost: 0,
    supplier: '스카이잭 한국지사', memo1: '고소작업용 대형 장비', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  }
];

const SEED_CONSUMABLES: Consumable[] = [
  { id: 'con-1', modelName: '작동유 (Hydraulic Oil 46#)', stockQty: 18, unit: '박스', unitPrice: 42000, supplier: '지에스칼텍스', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'con-2', modelName: '딥사이클 배터리 US-2200', stockQty: 6, unit: '개', unitPrice: 135000, supplier: '세방전지', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'con-3', modelName: '비례 제어 조이스틱 레버', stockQty: 12, unit: '개', unitPrice: 85000, supplier: '우진센서', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
];

const SEED_CONSUMABLE_LOGS: ConsumableLog[] = [
  { id: 'cl-1', consumableId: 'con-1', type: 'INBOUND', quantity: 20, unitPrice: 40000, supplier: '지에스칼텍스', actionDate: '2026-06-01', description: '정기 입고', createdAt: new Date().toISOString() },
  { id: 'cl-2', consumableId: 'con-1', type: 'OUTBOUND', quantity: 2, unitPrice: 42000, targetAssetId: 'as-1', userId: 'u-4', actionDate: '2026-07-01', description: 'SJ19-001 자산 정기 점검 작동유 보충', createdAt: new Date().toISOString() }
];

const SEED_CONTRACTS: Contract[] = [
  {
    id: 'cont-1', contractNo: 'CT-260301-001', customerId: 'cust-1', contactId: 'cc-1', siteId: 'cs-1',
    startDate: '2026-03-01', endDate: '2026-08-31', billingDay: 30, status: 'ACTIVE', driveFolderId: 'folder-ct-001',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  },
  {
    id: 'cont-2', contractNo: 'CT-260510-002', customerId: 'cust-2', contactId: 'cc-2', siteId: 'cs-2',
    startDate: '2026-05-10', endDate: '2026-11-09', billingDay: 30, status: 'ACTIVE', driveFolderId: 'folder-ct-002',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  }
];

const SEED_CONTRACT_ASSETS: ContractAsset[] = [
  { id: 'ca-1', contractId: 'cont-1', assetId: 'as-2', monthlyRentalFee: 450000, dailyRentalFee: 18000, startDate: '2026-03-01', endDate: '2026-08-31', createdAt: new Date().toISOString() },
  { id: 'ca-2', contractId: 'cont-2', assetId: 'as-3', monthlyRentalFee: 420000, dailyRentalFee: 16000, startDate: '2026-05-10', endDate: '2026-11-09', createdAt: new Date().toISOString() }
];

const SEED_DELIVERIES: Delivery[] = [
  { id: 'del-1', contractId: 'cont-1', type: 'OUTBOUND', status: 'COMPLETED', requestDate: '2026-02-25', scheduledDate: '2026-03-01', vehicleType: '셀프로더', driverName: '김철수', driverContact: '010-3333-2222', deliveryCost: 80000, isCostSettled: true, memo: '안전 장구 필수 착용', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'del-2', contractId: 'cont-2', type: 'OUTBOUND', status: 'COMPLETED', requestDate: '2026-05-08', scheduledDate: '2026-05-10', vehicleType: '5톤 카고', driverName: '이성진', driverContact: '010-4444-5555', deliveryCost: 90000, isCostSettled: false, memo: '오전 9시까지 도착 완료 요망', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
];

const SEED_BILLINGS: Billing[] = [
  { id: 'bill-1', customerId: 'cust-1', billingYm: '2026-06', billingDate: '2026-06-30', totalAmount: 450000, paidAmount: 450000, status: 'PAID', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'bill-2', customerId: 'cust-2', billingYm: '2026-06', billingDate: '2026-06-30', totalAmount: 420000, paidAmount: 0, status: 'UNPAID', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
];

const SEED_BILLING_DETAILS: BillingDetail[] = [
  { id: 'bd-1', billingId: 'bill-1', contractAssetId: 'ca-1', itemName: 'Genie GS-1930 (GE19-002) 렌탈료 (6/1 ~ 6/30)', quantity: 1, unitPrice: 450000, amount: 450000, description: '정기 청구', createdAt: new Date().toISOString() },
  { id: 'bd-2', billingId: 'bill-2', contractAssetId: 'ca-2', itemName: 'JLG 1930ES (JL19-003) 렌탈료 (6/1 ~ 6/30)', quantity: 1, unitPrice: 420000, amount: 420000, description: '정기 청구', createdAt: new Date().toISOString() }
];

const SEED_PAYMENTS: Payment[] = [
  { id: 'pay-1', billingId: 'bill-1', paymentDate: '2026-07-05', amount: 450000, method: 'BANK_TRANSFER', memo: '국민은행 송금완료', createdAt: new Date().toISOString() }
];

const SEED_REPAIRS: Repair[] = [
  { id: 'rep-1', assetId: 'as-1', mechanicId: 'u-4', requestDate: '2026-07-01', repairDate: '2026-07-01', status: 'COMPLETED', details: '작동유 충진 및 조이스틱 밸브 불량 교체 완료', totalCost: 150000, billableToCustomer: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
];

const SEED_REPAIR_CONSUMABLES: RepairConsumable[] = [
  { id: 'rc-1', repairId: 'rep-1', consumableId: 'con-1', quantity: 2, unitPrice: 42000, cost: 84000 }
];

const SEED_CONTRACT_HISTORY: ContractHistory[] = [];

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

  get permissions() { return this.get<MenuPermission>('permissions', SEED_PERMISSIONS); }
  set permissions(val: MenuPermission[]) { this.set('permissions', val); }

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

  get consumables() { return this.get<Consumable>('consumables', SEED_CONSUMABLES); }
  set consumables(val: Consumable[]) { this.set('consumables', val); }

  get consumableLogs() { return this.get<ConsumableLog>('consumableLogs', SEED_CONSUMABLE_LOGS); }
  set consumableLogs(val: ConsumableLog[]) { this.set('consumableLogs', val); }

  get contracts() { return this.get<Contract>('contracts', SEED_CONTRACTS); }
  set contracts(val: Contract[]) { this.set('contracts', val); }

  get contractAssets() { return this.get<ContractAsset>('contractAssets', SEED_CONTRACT_ASSETS); }
  set contractAssets(val: ContractAsset[]) { this.set('contractAssets', val); }

  get contractHistory() { return this.get<ContractHistory>('contractHistory', SEED_CONTRACT_HISTORY); }
  set contractHistory(val: ContractHistory[]) { this.set('contractHistory', val); }

  get deliveries() { return this.get<Delivery>('deliveries', SEED_DELIVERIES); }
  set deliveries(val: Delivery[]) { this.set('deliveries', val); }

  get billings() { return this.get<Billing>('billings', SEED_BILLINGS); }
  set billings(val: Billing[]) { this.set('billings', val); }

  get billingDetails() { return this.get<BillingDetail>('billingDetails', SEED_BILLING_DETAILS); }
  set billingDetails(val: BillingDetail[]) { this.set('billingDetails', val); }

  get payments() { return this.get<Payment>('payments', SEED_PAYMENTS); }
  set payments(val: Payment[]) { this.set('payments', val); }

  get repairs() { return this.get<Repair>('repairs', SEED_REPAIRS); }
  set repairs(val: Repair[]) { this.set('repairs', val); }

  get repairConsumables() { return this.get<RepairConsumable>('repairConsumables', SEED_REPAIR_CONSUMABLES); }
  set repairConsumables(val: RepairConsumable[]) { this.set('repairConsumables', val); }

  // 헬퍼 메소드들 - CRUD 시뮬레이션
  insertRow<T extends { id: string }>(key: keyof LocalDB, row: Omit<T, 'id'>): T {
    const list = (this[key] as unknown) as T[];
    const newRow = { ...row, id: Math.random().toString(36).substr(2, 9) } as unknown as T;
    list.push(newRow);
    this.set(key, list);
    return newRow;
  }

  updateRow<T extends { id: string }>(key: keyof LocalDB, id: string, updates: Partial<T>): T | null {
    const list = (this[key] as unknown) as T[];
    const index = list.findIndex(item => item.id === id);
    if (index === -1) return null;
    const updated = { ...list[index], ...updates };
    list[index] = updated;
    this.set(key, list);
    return updated;
  }

  deleteRow<T extends { id: string }>(key: keyof LocalDB, id: string): boolean {
    const list = (this[key] as unknown) as T[];
    const filtered = list.filter(item => item.id !== id);
    if (filtered.length === list.length) return false;
    this.set(key, filtered);
    return true;
  }
}

export const db = new LocalDB();
