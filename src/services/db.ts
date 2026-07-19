import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

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
  address?: string;
  phone?: string;
  email?: string;
  profileImageUrl?: string;
  createdAt?: string;
}

export interface Department {
  id: string;
  name: string;
  parentDepartmentId: string | null;
}

export interface MenuPermission {
  id: string;
  userId: string;
  menuId: string;
  canView: boolean;
  canSave: boolean;
  createdAt: string;
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
  assetId?: string;
  expectedModel?: string;
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

// 초기 로컬 스토리지 데이터 생성
const generateMockProducts = (): Product[] => {
  return [
    { id: 'prod-1', modelName: 'SKY-800', feet: 8, spec: '배터리형, 8m', manufacturer: 'SKY', createdAt: new Date().toISOString() },
    { id: 'prod-2', modelName: 'GENIE-1000', feet: 10, spec: '디젤형, 10m', manufacturer: 'GENIE', createdAt: new Date().toISOString() },
    { id: 'prod-3', modelName: 'LIFT-1200', feet: 12, spec: '전동형, 12m', manufacturer: 'LIFT', createdAt: new Date().toISOString() }
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
      maintenanceScore: Math.floor(Math.random() * 51), // 0 ~ 50 무작위 점수
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
      maintenanceScore: Math.floor(Math.random() * 51),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  return assets;
};

const generateMockContracts = (customers: Customer[], contacts: CustomerContact[], sites: CustomerSite[], assets: Asset[]) => {
  const contracts: Contract[] = [];
  const contractAssets: ContractAsset[] = [];
  
  let assetIdx = 0;
  for(let i=1; i<=13; i++) { // 13 contracts
    const cust = customers[i];
    const custContacts = contacts.filter(c => c.customerId === cust.id);
    const custSites = sites.filter(s => s.customerId === cust.id);
    
    const contractId = `contract-${i}`;
    contracts.push({
      id: contractId,
      contractNo: `CTR-2026-${i.toString().padStart(3, '0')}`,
      customerId: cust.id,
      contactId: custContacts[0]?.id,
      siteId: custSites[0]?.id,
      startDate: '2026-07-01',
      endDate: '2026-12-31',
      billingDay: 30,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    const count = Math.floor(Math.random() * 2) + 1; // 1~2 assets per contract
    for(let j=0; j<count; j++) {
      if(assetIdx >= assets.length) break;
      const asset = assets[assetIdx];
      asset.status = 'RENTED';
      asset.currentCustomerId = cust.id;
      asset.currentSiteId = custSites[0]?.id;
      asset.contractStart = '2026-07-01';
      asset.contractEnd = '2026-12-31';
      asset.billingDay = 30;
      asset.monthlyRentalFee = 500000;
      asset.dailyRentalFee = 16000;
      
      contractAssets.push({
        id: `ca-${contractId}-${j}`,
        contractId,
        assetId: asset.id,
        monthlyRentalFee: 500000,
        dailyRentalFee: 16000,
        startDate: '2026-07-01',
        endDate: '2026-12-31',
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
const SEED_CONTRACTS: Contract[] = mockDataCont.contracts;
const SEED_CONTRACT_ASSETS: ContractAsset[] = mockDataCont.contractAssets;
const SEED_DELIVERIES: Delivery[] = [];
const SEED_BILLINGS: Billing[] = [];
const SEED_BILLING_DETAILS: BillingDetail[] = [];
const SEED_PAYMENTS: Payment[] = [];
const SEED_REPAIRS: Repair[] = [];
const SEED_REPAIR_CONSUMABLES: RepairConsumable[] = [];
const SEED_CONTRACT_HISTORY: ContractHistory[] = [];
const SEED_TODOS: Todo[] = [];

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

  get todos() { return this.get<Todo>('todos', SEED_TODOS); }
  set todos(val: Todo[]) { this.set('todos', val); }

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
      contracts: 'contracts',
      contractAssets: 'contract_assets',
      contractHistory: 'contract_history',
      deliveries: 'deliveries',
      billings: 'billings',
      billingDetails: 'billing_details',
      payments: 'payments',
      repairs: 'repairs',
      repairConsumables: 'repair_consumables'
    };
    return mapping[key] || key;
  }

  // 비동기 쓰기 큐
  private pendingWrites: any[] = [];

  isSupabaseConnected(): boolean {
    return !!supabase;
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

    const tables = [
      'users', 'departments', 'permissions', 'customers', 'contacts', 'sites', 
      'products', 'assets', 'consumables', 'consumableLogs', 
      'contracts', 'contractAssets', 'contractHistory', 'deliveries', 
      'billings', 'billingDetails', 'payments', 'repairs', 'repairConsumables'
    ];

    try {
      const results = await Promise.all(
        tables.map(async (key) => {
          const tableName = this.mapToSupabaseTable(key);
          const { data, error } = await supabase!
            .from(tableName)
            .select('*');
          if (error) throw error;
          return { key, data };
        })
      );

      // 전체 로컬 스토리지 캐시 최신 DB 값으로 덮어쓰기
      results.forEach(({ key, data }) => {
        this.set(key, data || []);
      });
    } catch (err) {
      console.error("Supabase pullFromSupabase failed, falling back to local cache:", err);
      throw err;
    }
  }

  // 헬퍼 메소드들 - CRUD 시뮬레이션 및 백그라운드 Supabase 업로드
  insertRow<T extends { id: string }>(key: keyof LocalDB, row: Omit<T, 'id'> & { id?: string }): T {
    const list = (this[key] as unknown) as T[];
    const newId = row.id || Math.random().toString(36).substr(2, 9);
    const newRow = { ...row, id: newId } as unknown as T;
    list.push(newRow);
    this.set(key, list);

    if (supabase) {
      const tableName = this.mapToSupabaseTable(key as string);
      const promise = supabase
        .from(tableName)
        .insert([newRow])
        .then(({ error }) => {
          if (error) console.error(`Supabase insert failed for ${tableName}:`, error);
        });
      this.pendingWrites.push(promise);
    }

    return newRow;
  }

  updateRow<T extends { id: string }>(key: keyof LocalDB, id: string, updates: Partial<T>): T | null {
    const list = (this[key] as unknown) as T[];
    const index = list.findIndex(item => item.id === id);
    if (index === -1) return null;
    const updated = { ...list[index], ...updates };
    list[index] = updated;
    this.set(key, list);

    if (supabase) {
      const tableName = this.mapToSupabaseTable(key as string);
      const promise = supabase
        .from(tableName)
        .update(updates as any)
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error(`Supabase update failed for ${tableName}:`, error);
        });
      this.pendingWrites.push(promise);
    }

    return updated;
  }

  deleteRow<T extends { id: string }>(key: keyof LocalDB, id: string): boolean {
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
          if (error) console.error(`Supabase delete failed for ${tableName}:`, error);
        });
      this.pendingWrites.push(promise);
    }

    return true;
  }

  // 조직도 및 구성원 일괄 저장 (Batch) - 기존 데이터를 전부 덮어씌움
  saveOrganizationBatch(departments: Department[], users: User[]): void {
    this.set('departments', departments);
    this.set('users', users);
    
    // Supabase 연동 시: 실제 프로덕션에서는 diff(추가,수정,삭제)를 계산해서 각각 API를 호출하거나
    // Supabase RPC(Stored Procedure)를 호출하여 통째로 동기화해야 하지만,
    // 현재는 구조만 잡아두고 로컬 스토리지에 우선 저장함.
    if (supabase) {
      console.log('Batch sync to Supabase (Departments, Users) is required here.');
    }
  }
}

export const db = new LocalDB();
