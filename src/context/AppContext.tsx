// d:\Kiyeun_Lift\src\context\AppContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, supabase, User, MenuPermission, createMenuPermission, Customer, CustomerContact, CustomerSite, Product, Asset, Consumable, ConsumableLog, ConsumablePurchaseRequest, Contract, ContractAsset, ContractHistory, Billing, BillingDetail, Payment, Delivery, TransportCompany, TransportDriver, Repair, RepairConsumable, Todo, BankTransaction, BankMatchingRule, AssetInOutLog, Vendor, GoogleConfig, CashFlowSnapshot, OutboundInspection, DepreciationLog, findCustomerByNormalizedName } from '../services/db';
import { ErrorModal } from '../components/ErrorModal';
import { getAllSystemMenuIds } from '../config/menu_config';

export interface SmartDispatchData {
  customerName: string;
  siteName: string;
  siteAddress: string;
  siteContactName: string;
  siteContactPhone: string;
  siteContactEmail: string;
  billingContactName: string;
  billingContactPhone: string;
  statementEmail: string;
  taxBillEmail: string;
  loadingTime: string;
  unloadingTime: string;
  equipments: { modelName: string, qty: number }[];
  note: string;
}

export interface SmartReturnData {
  contractId?: string;
  returnDate: string;
  assetIds: string[];
  loadingTime?: string;
  unloadingTime?: string;
  note?: string;
  // 정비회수 추가 필드
  repairId?: string;
  vendorId?: string;
  // 고객측 회수 담당 정보
  contactName?: string;
  contactPhone?: string;
}

interface AppContextType {
  currentUser: User | null;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  login: (loginId: string, passwordHash: string, keepLoggedIn?: boolean) => boolean;
  logout: () => void;
  hasPermission: (menuId: string, action: 'view' | 'save') => boolean;
  showErrorModal: (message: string, title?: string) => void;
  
  // Data States
  users: User[];
  permissions: MenuPermission[];
  customers: Customer[];
  contacts: CustomerContact[];
  sites: CustomerSite[];
  products: Product[];
  assets: Asset[];
  consumables: Consumable[];
  consumableLogs: ConsumableLog[];
  consumablePurchases: ConsumablePurchaseRequest[];
  contracts: Contract[];
  contractAssets: ContractAsset[];
  contractHistory: ContractHistory[];
  deliveries: Delivery[];
  transportCompanies: TransportCompany[];
  transportDrivers: TransportDriver[];
  billings: Billing[];
  billingDetails: BillingDetail[];
  payments: Payment[];
  repairs: Repair[];
  repairConsumables: RepairConsumable[];
  todos: Todo[];
  bankTransactions: BankTransaction[];
  bankMatchingRules: BankMatchingRule[];
  assetInOutLogs: AssetInOutLog[];
  vendors: Vendor[];
  googleConfigs: GoogleConfig[];
  cashFlowSnapshots: CashFlowSnapshot[];
  outboundInspections: OutboundInspection[];
  depreciationLogs: DepreciationLog[];

  // Mutators
  refreshAllData: () => void;
  executeMonthlyDepreciation: (depreciationYm: string, note?: string) => Promise<{ count: number; totalAmount: number }>;
  loadTablesForMenu: (menuId: string) => Promise<void>;
  updatePermissions: (updated: MenuPermission[]) => void;
  saveUser: (user: Omit<User, 'id' | 'createdAt'> & { id?: string }) => void;
  saveCustomer: (cust: Omit<Customer, 'id' | 'createdAt'> & { id?: string }) => Promise<Customer>;
  saveContact: (contact: Omit<CustomerContact, 'id' | 'createdAt'> & { id?: string }) => Promise<void>;
  saveSite: (site: Omit<CustomerSite, 'id' | 'createdAt'> & { id?: string }) => Promise<void>;
  saveProduct: (prod: Omit<Product, 'id' | 'createdAt'> & { id?: string }) => void;
  saveAsset: (asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  updateGoogleConfig: (config: GoogleConfig) => Promise<void>;
  saveCashFlowSnapshot: (snap: Omit<CashFlowSnapshot, 'id' | 'createdAt'>) => void;
  deleteCashFlowSnapshot: (snapId: string) => void;
  saveVendor: (vendor: Vendor) => Promise<void>;
  deleteVendor: (id: string) => void;
  
  // Asset Mutators
  changeAssetStatus: (assetId: string, status: Asset['status'], extraData?: Partial<Asset>) => Promise<void>;
  acquireAsset: (assetData: Partial<Asset>) => void;
  disposeAsset: (assetId: string, disposalData: { disposalDate: string; disposalPrice: number; buyer: string; billingYm?: string }) => void;
  registerRentedAsset: (assetData: Partial<Asset>) => Promise<any>;
  returnRentedAsset: (assetId: string, returnDate: string) => void;
  
  // Consumables Mutators
  purchaseConsumable: (data: { modelName: string; qty: number; unit: string; unitPrice: number; supplier: string }) => Promise<void>;
  useConsumable: (data: { consumableId: string; quantity: number; targetAssetId: string; description: string }) => Promise<void>;
  requestConsumablePurchase: (data: { consumableId?: string; modelName: string; qty: number; unitPrice: number; requestDate: string; sellerName: string }) => Promise<void>;
  acceptConsumablePurchase: (id: string) => Promise<void>;
  completeConsumablePurchase: (id: string) => Promise<void>;
  inboundConsumablePurchase: (id: string, qty: number, statementFileUrl: string) => Promise<void>;
  
  // Contract Mutators
  createContract: (contractData: Omit<Contract, 'id' | 'createdAt' | 'updatedAt' | 'contractNo'>, assetsList: { assetId?: string; expectedModel?: string; monthlyRentalFee: number; dailyRentalFee: number }[]) => Promise<void>;
  extendContract: (contractId: string, newEndDate: string, description: string) => void;
  shortenContract: (contractId: string, newEndDate: string, description: string) => void;
  succeedContract: (contractId: string, successorCustomerId: string, successorContactId: string, successorSiteId: string, successionDate: string, description: string) => void;
  exchangeAsset: (contractId: string, oldAssetId: string, newAssetId: string, exchangeDate: string) => void;
  
  // 장비 할당 및 출고전 교체
  assignAssetToContract: (contractAssetId: string, assetId: string) => Promise<void>;
  exchangeOutboundAsset: (contractAssetId: string, oldAssetId: string, newAssetId: string, reason: string, markOldAsRepairing?: boolean) => Promise<void>;
  saveSmartDispatch: (data: SmartDispatchData, autoRegister: boolean, onProgress?: (log: string, percent: number) => void) => Promise<{ success: boolean; requiresConfirm?: boolean; missingFields?: string[]; errorMessage?: string }>;
  saveSmartReturn: (data: SmartReturnData) => void;
  
  // Todos
  completeTodo: (todoId: string) => void;
  
  // Billings
  generateBillingsForMonth: (billingYm: string, billingDate: string) => void;
  approveBilling: (billingId: string) => void;
  cancelBilling: (billingId: string) => void;
  receivePayment: (billingId: string, data: { paymentDate: string; amount: number; method: string; memo: string }) => void;
  uploadBankTransactions: (txs: Omit<BankTransaction, 'id' | 'createdAt'>[]) => void;
  matchTransactionManual: (txId: string, billingId: string, learnRule: boolean) => void;
  unmatchTransaction: (txId: string) => void;
  saveMatchingRule: (senderName: string, customerId: string) => void;
  deleteMatchingRule: (ruleId: string) => void;
  
  // Deliveries
  dispatchDelivery: (deliveryId: string, dispatchData: { scheduledDate: string; transportCompany: string; vehicleType: string; vehicleNo: string; driverName: string; driverContact: string; deliveryCost: number; vehiclesJson?: string }) => void;
  settleDeliveryCost: (deliveryId: string, deliveryCostConfirmed: number, vehiclesJson?: string) => void;
  completeDelivery: (deliveryId: string) => void;
  completeInboundDelivery: (deliveryId: string, actualReturnDate: string, reviews: { assetId: string; status: 'AVAILABLE' | 'REPAIRING'; maintenanceScore: number; memo: string; faultImageUrl?: string }[]) => void;
  
  // Repairs
  registerRepair: (repairData: Partial<Repair>, usedConsumables: { consumableId: string; quantity: number }[]) => void;
  
  // Transport Master
  saveTransportDataOnFly: (companyName: string, driverName: string, contact: string, vehicleNo: string, vehicleType: string) => void;

  // Navigation states (cross-page routing)
  activeTab: string;
  setActiveTab: (tab: string) => void;
  navigationPayload: any;
  setNavigationPayload: (payload: any) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // React state of database tables
  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<MenuPermission[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [sites, setSites] = useState<CustomerSite[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [consumableLogs, setConsumableLogs] = useState<ConsumableLog[]>([]);
  const [consumablePurchases, setConsumablePurchases] = useState<ConsumablePurchaseRequest[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractAssets, setContractAssets] = useState<ContractAsset[]>([]);
  const [contractHistory, setContractHistory] = useState<ContractHistory[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [transportCompanies, setTransportCompanies] = useState<TransportCompany[]>([]);
  const [transportDrivers, setTransportDrivers] = useState<TransportDriver[]>([]);
  const [billings, setBillings] = useState<Billing[]>([]);
  const [billingDetails, setBillingDetails] = useState<BillingDetail[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [repairConsumables, setRepairConsumables] = useState<RepairConsumable[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [bankMatchingRules, setBankMatchingRules] = useState<BankMatchingRule[]>([]);
  const [assetInOutLogs, setAssetInOutLogs] = useState<AssetInOutLog[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [googleConfigs, setGoogleConfigs] = useState<GoogleConfig[]>([]);
  const [cashFlowSnapshots, setCashFlowSnapshots] = useState<CashFlowSnapshot[]>([]);
  const [outboundInspections, setOutboundInspections] = useState<OutboundInspection[]>([]);
  const [depreciationLogs, setDepreciationLogs] = useState<DepreciationLog[]>([]);

  // Navigation / Routing states
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [navigationPayload, setNavigationPayload] = useState<any>(null);

  // 글로벌 커스텀 에러 모달 상태
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title?: string; message: string }>({
    isOpen: false,
    title: '시스템 오류 발생',
    message: ''
  });

  const showErrorModal = (message: string, title: string = '시스템 오류 발생') => {
    setErrorModal({
      isOpen: true,
      title,
      message
    });
  };

  // ─────────────────────────────────────────────────────────
  // 로컬 db 인메모리 스토어 → React state 즉시 동기화 (Supabase pull 없음 — 저장 후 즉각 화면 반영용)
  const syncLocalToState = () => {
    setUsers([...db.users]);
    setPermissions([...db.permissions]);
    setCustomers([...db.customers]);
    setContacts([...db.contacts]);
    setSites([...db.sites]);
    setProducts([...db.products]);
    setAssets([...db.assets]);
    setConsumables([...db.consumables]);
    setConsumableLogs([...db.consumableLogs]);
    setConsumablePurchases([...db.consumablePurchases]);
    setContracts([...db.contracts]);
    setContractAssets([...db.contractAssets]);
    setContractHistory([...db.contractHistory]);
    setDeliveries([...db.deliveries]);
    setTransportCompanies([...db.transportCompanies]);
    setTransportDrivers([...db.transportDrivers]);
    setBillings([...db.billings]);
    setBillingDetails([...db.billingDetails]);
    setPayments([...db.payments]);
    setRepairs([...db.repairs]);
    setRepairConsumables([...db.repairConsumables]);
    setTodos([...db.todos]);
    setBankTransactions([...db.bankTransactions]);
    setBankMatchingRules([...db.bankMatchingRules]);
    setAssetInOutLogs([...db.assetInOutLogs]);
    setVendors([...db.vendors]);
    setGoogleConfigs([...db.googleConfigs]);
    setCashFlowSnapshots([...db.cashFlowSnapshots]);
    setOutboundInspections([...db.outboundInspections]);
    setDepreciationLogs([...db.depreciationLogs]);
  };

  // 전체 28개 테이블 Supabase pull 후 state 동기화 (초기 로딩 전용)
  const fullRefreshFromServer = async () => {
    if (db.isSupabaseConnected()) {
      try {
        await db.pullFromSupabase();
      } catch (err) {
        console.error("Failed to sync from Supabase:", err);
      }
    }
    syncLocalToState();
  };

  // 메뉴별 관련 테이블만 Supabase pull (메뉴 전환 시 호출 — 최신 데이터 보장)
  const MENU_TABLE_MAP: Record<string, string[]> = {
    'dashboard':            ['deliveries', 'contracts', 'billings', 'todos', 'assets'],
    'delivery':             ['deliveries', 'transportCompanies', 'transportDrivers', 'contracts', 'assets'],
    'transport_master':     ['transportCompanies', 'transportDrivers'],
    'contract':             ['contracts', 'contractAssets', 'contractHistory', 'customers', 'assets'],
    'billing':              ['billings', 'billingDetails', 'payments', 'contracts', 'customers'],
    'customer':             ['customers', 'contacts', 'sites'],
    'product':              ['products'],
    'asset':                ['assets', 'products', 'vendors', 'contracts'],
    'acquisition_disposal': ['assets', 'products', 'vendors'],
    'rent_asset':           ['assets', 'vendors'],
    'consumable':           ['consumables', 'consumableLogs', 'consumablePurchases', 'vendors'],
    'repair':               ['repairs', 'repairConsumables', 'assets', 'consumables', 'vendors'],
    'smart_dispatch':       ['deliveries', 'contracts', 'assets', 'transportCompanies', 'transportDrivers'],
    'smart_return':         ['deliveries', 'contracts', 'assets', 'transportCompanies', 'transportDrivers'],
    'asset_inout_history':  ['assetInOutLogs', 'assets', 'customers'],
    'dispatch_assign':      ['contracts', 'contractAssets', 'assets', 'outboundInspections'],
    'outbound_inspections': ['outboundInspections', 'contracts', 'contractAssets', 'assets', 'customers'],
    'bank_matching':        ['bankTransactions', 'bankMatchingRules', 'billings', 'customers'],
    'vendors':              ['vendors'],
    'organization':         ['users', 'departments'],
    'permission':           ['users', 'permissions'],
    'payroll':              ['users', 'departments'],
    'corporate_card':       ['vendors', 'billings'],
    'cash_flow':            ['billings', 'payments', 'contracts', 'assets'],
    'delinquency':          ['billings', 'customers', 'contracts'],
    'google_config':        ['googleConfigs'],
    'depreciation_execution': ['depreciationLogs', 'assets'],
  };

  const loadTablesForMenu = async (menuId: string) => {
    if (!db.isSupabaseConnected()) return;
    const keys = MENU_TABLE_MAP[menuId];
    if (!keys || keys.length === 0) return;
    try {
      await Promise.all(keys.map(key => db.pullTableFromSupabase(key)));
      syncLocalToState();
    } catch (err) {
      console.warn('loadTablesForMenu error:', err);
    }
  };

  // 하위 호환 유지용 alias — 저장 후 즉각 화면 반영 (Supabase pull 없음, 순수 로컬 동기화)
  const refreshAllData = syncLocalToState;


  useEffect(() => {
    if (!localStorage.getItem('seed_v1_8_dummy_contracts_v2')) {
      localStorage.removeItem('erp_contracts');
      localStorage.removeItem('erp_contractAssets');
      localStorage.setItem('seed_v1_8_dummy_contracts_v2', 'true');
    }
    // 안전한 Google Config 마이그레이션 (기존 정보 보존 및 신규 컬럼 주입)
    const existingConfigsStr = localStorage.getItem('erp_googleConfigs');
    if (existingConfigsStr) {
      try {
        const configs = JSON.parse(existingConfigsStr);
        if (Array.isArray(configs) && configs.length > 0) {
          let updated = false;
          const defaultTemplate: Record<string, any> = {
            isDevMode: true,
            quotationTemplateUrl: 'templates/렌탈견적서_양식.html',
            contractTemplateUrl: 'templates/고소작업대_임대차계약서_양식.html',
            safetyInspectionTemplateUrl: 'templates/고소작업대_안전점검결과서_양식.html',
            preDeliveryChecklistTemplateUrl: 'templates/반입전_CHECK_LIST_양식.html',
            bizRegCertUrl: 'C:/Users/이정용/GoogleDrive/Kiyuen_Lift/company/사업자등록증.pdf',
            bankbookCopyUrl: 'C:/Users/이정용/GoogleDrive/Kiyuen_Lift/company/통장사본.pdf'
          };

          const mergedConfigs = configs.map(cfg => {
            const newCfg = { ...cfg };
            for (const [key, value] of Object.entries(defaultTemplate)) {
              if (newCfg[key] === undefined) {
                newCfg[key] = value;
                updated = true;
              }
            }
            return newCfg;
          });

          if (updated) {
            localStorage.setItem('erp_googleConfigs', JSON.stringify(mergedConfigs));
          }
        }
      } catch (e) {
        console.error('Failed to migrate google config safely', e);
      }
    }
    localStorage.setItem('seed_v2_2_google_config_v2', 'true');

    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
    
    const savedUser = sessionStorage.getItem('user');
    const autoUser = localStorage.getItem('auto_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    } else if (autoUser) {
      setCurrentUser(JSON.parse(autoUser));
    }
    
    // 초기 로딩: 전체 28개 테이블 Supabase pull (앱 최초 진입 1회만)
    fullRefreshFromServer();
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const login = (loginId: string, passwordHash: string, keepLoggedIn?: boolean): boolean => {
    if (loginId === 'admin' && passwordHash === 'admin123') {
      const fallbackAdmin: User = { 
        id: 'sys-admin', loginId: 'admin', passwordHash: 'admin123', 
        name: '최고관리자', department: '시스템', departmentId: '', role: 'ADMIN', createdAt: new Date().toISOString() 
      };
      setCurrentUser(fallbackAdmin);
      sessionStorage.setItem('user', JSON.stringify(fallbackAdmin));
      if (keepLoggedIn) {
        localStorage.setItem('auto_user', JSON.stringify(fallbackAdmin));
      } else {
        localStorage.removeItem('auto_user');
      }
      return true;
    }

    const user = db.users.find(u => u.loginId === loginId && u.passwordHash === passwordHash);
    if (user) {
      setCurrentUser(user);
      sessionStorage.setItem('user', JSON.stringify(user));
      if (keepLoggedIn) {
        localStorage.setItem('auto_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('auto_user');
      }
      return true;
    }
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('user');
    localStorage.removeItem('auto_user');
  };

  const hasPermission = (menuId: string, action: 'view' | 'save'): boolean => {
    if (!currentUser) return false;
    // 시스템 최고관리자 계정 및 ADMIN 역할 사용자는 모든 메뉴에 100% 무조건 권한 부여
    if (currentUser.role === 'ADMIN' || currentUser.loginId === 'admin' || currentUser.id === 'sys-admin' || currentUser.id === 'u-1') return true;

    // userId / user_id 양방향 호환 탐색 (파편화 방지)
    const perm = permissions.find(p => (p.userId === currentUser.id || (p as any).user_id === currentUser.id) && p.menuId === menuId);
    if (!perm) {
      // 권한 레코드가 누락된 신규 메뉴의 경우 조회(view)는 기본 허용(true), 저장(save)은 false
      return action === 'view';
    }
    return action === 'view' ? perm.canView : perm.canSave;
  };

  const updatePermissions = async (updated: MenuPermission[]) => {
    try {
      db.permissions = updated;
      if (supabase) {
        // DB 스키마 및 레거시 role/updatedAt NOT NULL 제약 조건 우회를 위해 타임스탬프 & 기본값 부여 (userId camelCase 단일 표준 적용)
        const nowStr = new Date().toISOString();
        const payload = updated.map(p => ({
          ...p,
          userId: p.userId,
          role: (p as any).role || 'USER',
          createdAt: p.createdAt || nowStr,
          updatedAt: nowStr
        }));

        const lastCommandInfo = `supabase.from('permissions').upsert(payload[${payload.length}건], { onConflict: 'id' })`;
        const samplePayloadJson = JSON.stringify(payload.slice(0, 2), null, 2);

        const { error } = await supabase.from('permissions').upsert(payload as any[], { onConflict: 'id' });
        if (error) {
          const isSchemaCacheOrColumnError = error.message?.includes("userId") || error.code === 'PGRST204' || error.code === 'PGRST200';
          const rawErrorDetails = 
            `■ [마지막 실행 시도 명령]: ${lastCommandInfo}\n` +
            `■ [PostgREST Raw Error]:\n` +
            `  - Code: ${error.code || 'N/A'}\n` +
            `  - Message: ${error.message || 'N/A'}\n` +
            `  - Details: ${error.details || 'N/A'}\n` +
            `  - Hint: ${error.hint || 'N/A'}\n\n` +
            `■ [시도된 페이로드 샘플 (최대 2건)]:\n${samplePayloadJson}\n\n` +
            `■ [조치 안내 (개발자 도구 패치 적용 또는 Supabase SQL Editor 실행 DDL)]:\n` +
            (isSchemaCacheOrColumnError
              ? `💡 원인: Supabase DB의 permissions 테이블 컬럼 미비 또는 PostgREST 스키마 캐시 미갱신 현상입니다.\n` +
                `1) [개발자 도구] ➔ [[개발] DB 데이터 업로더] 메뉴 하단의 [⚡ 패치 자동 적용 (DB 직접 실행)] 버튼 클릭\n` +
                `2) 또는 Supabase SQL Editor에서 아래 DDL 직접 실행:\n` +
                `   ALTER TABLE "permissions" ADD COLUMN IF NOT EXISTS "userId" TEXT;\n` +
                `   NOTIFY pgrst, 'reload schema';`
              : `ALTER TABLE "permissions" ADD COLUMN IF NOT EXISTS "userId" TEXT;\nNOTIFY pgrst, 'reload schema';`);

          throw new Error(rawErrorDetails);
        }
      }
      refreshAllData();
    } catch (err: any) {
      console.error('Update permissions error:', err);
      throw err;
    }
  };

  const updateGoogleConfig = async (configData: GoogleConfig) => {
    try {
      const nowIso = new Date().toISOString();
      const payload: GoogleConfig = { ...configData, updatedAt: nowIso };

      // 1. 로컬 스토리지 즉시 반영
      const currentList = [...db.googleConfigs];
      const localIndex = currentList.findIndex(cfg => cfg.id === configData.id);
      if (localIndex >= 0) {
        currentList[localIndex] = payload;
      } else {
        currentList.push({ ...payload, createdAt: nowIso });
      }
      db.googleConfigs = currentList;

      // 2. Supabase UPSERT — 행 존재 여부와 관계없이 반드시 반영
      if (supabase) {
        const upsertPayload = { ...payload, createdAt: (payload as any).createdAt || nowIso };
        const { error } = await supabase
          .from('google_configs')
          .upsert([upsertPayload], { onConflict: 'id' });
        if (error) {
          console.error('Supabase upsert failed for google_configs:', error);
          throw error;
        }
      }

      refreshAllData();
    } catch (err: any) {
      console.error('updateGoogleConfig Error:', err);
      showErrorModal(`⚠️ 구글 설정 원격 DB 저장 실패:\n\n${err?.message || err}`, '원격 DB 저장 오류');
      throw err;
    }
  };

  const saveUser = (userData: Omit<User, 'id' | 'createdAt'> & { id?: string }) => {
    if (userData.id) {
      db.updateRow<User>('users', userData.id, userData);
    } else {
      // 신규 임직원 생성
      const newUser = db.insertRow<User>('users', { ...userData, createdAt: new Date().toISOString() });
      
      // ADMIN 역할 신규 임직원은 모든 메뉴에 대해 기본 전체 권한(canView+canSave=true) 레코드 자동 생성
      if (userData.role === 'ADMIN' && newUser?.id) {
        const allMenuIds = getAllSystemMenuIds();
        allMenuIds.forEach(menuId => {
          const exists = db.permissions.some(p => p.userId === newUser.id && p.menuId === menuId);
          if (!exists) {
            const perm = createMenuPermission(newUser.id, menuId, true, true);
            db.insertRow<MenuPermission>('permissions', perm);
          }
        });
      }
    }
    refreshAllData();
  };

  const saveCustomer = async (cust: Omit<Customer, 'id' | 'createdAt'> & { id?: string }): Promise<Customer> => {
    let res: Customer;
    if (cust.id) {
      res = db.updateRow<Customer>('customers', cust.id, cust) as Customer;

      // 고객 정보 보완 완료 시 관련 할 일(Todo) 자동 상계 처리
      const relatedTodos = db.todos.filter(
        t => t.relatedEntityId === cust.id && t.type === 'MISSING_INFO' && !t.isCompleted
      );
      if (relatedTodos.length > 0) {
        const isInfoComplete = 
          cust.bizRegNo && cust.bizRegNo !== '미상' && cust.bizRegNo.trim() !== '' &&
          cust.representative && cust.representative !== '미상' && cust.representative.trim() !== '' &&
          cust.repContact && cust.repContact !== '미상' && cust.repContact.trim() !== '' &&
          cust.address && cust.address !== '미상' && cust.address.trim() !== '' &&
          cust.repEmail && cust.repEmail !== '미상' && cust.repEmail.trim() !== '';

        if (isInfoComplete) {
          relatedTodos.forEach(todo => {
            db.updateRow<Todo>('todos', todo.id, { isCompleted: true });
          });
        }
      }
    } else {
      res = db.insertRow<Customer>('customers', { ...cust, createdAt: new Date().toISOString() }) as Customer;
    }

    if (db.isSupabaseConnected() && db.pendingWrites.length > 0) {
      try {
        await db.pendingWrites[db.pendingWrites.length - 1];
      } catch (err) {
        console.error("Supabase write await error:", err);
        throw err;
      }
    }

    refreshAllData();
    return res;
  };

  const saveContact = async (contact: Omit<CustomerContact, 'id' | 'createdAt'> & { id?: string }) => {
    if (contact.id) {
      db.updateRow<CustomerContact>('contacts', contact.id, contact as CustomerContact);
    } else {
      db.insertRow<CustomerContact>('contacts', {
        ...contact,
        isActive: contact.isActive !== undefined ? contact.isActive : true,
        createdAt: new Date().toISOString()
      } as Omit<CustomerContact, 'id'>);
    }

    if (db.isSupabaseConnected() && db.pendingWrites.length > 0) {
      try {
        await db.pendingWrites[db.pendingWrites.length - 1];
      } catch (err) {
        console.error("Supabase write await error:", err);
        throw err;
      }
    }

    refreshAllData();
  };

  const saveSite = async (site: Omit<CustomerSite, 'id' | 'createdAt'> & { id?: string }) => {
    if (site.id) {
      db.updateRow<CustomerSite>('sites', site.id, site as CustomerSite);
    } else {
      db.insertRow<CustomerSite>('sites', {
        ...site,
        isActive: site.isActive !== undefined ? site.isActive : true,
        createdAt: new Date().toISOString()
      } as Omit<CustomerSite, 'id'>);
    }

    if (db.isSupabaseConnected() && db.pendingWrites.length > 0) {
      try {
        await db.pendingWrites[db.pendingWrites.length - 1];
      } catch (err) {
        console.error("Supabase write await error:", err);
        throw err;
      }
    }

    refreshAllData();
  };

  const saveProduct = async (prod: Omit<Product, 'id' | 'createdAt'> & { id?: string }) => {
    let result;
    if (prod.id) {
      result = db.updateRow<Product>('products', prod.id, prod as Product);
    } else {
      result = db.insertRow<Product>('products', {
        ...prod,
        isActive: prod.isActive !== undefined ? prod.isActive : true,
        createdAt: new Date().toISOString()
      } as Omit<Product, 'id'>);
    }
    
    try {
      await db.awaitPendingWrites();
    } catch (err: any) {
      console.error("Supabase write await error:", err);
      showErrorModal(`⚠️ 제품 카탈로그 저장 중 DB 동기화 오류가 발생했습니다:\n${err.message || err.details || JSON.stringify(err)}`, 'DB 동기화 오류');
      throw err;
    }
    
    refreshAllData();
    return result;
  };

  const saveAsset = async (asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    let result;
    if (asset.id) {
      result = db.updateRow<Asset>('assets', asset.id, asset as Asset);
    } else {
      result = db.insertRow<Asset>('assets', {
        ...asset,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as Omit<Asset, 'id'>);
    }
    try {
      await db.awaitPendingWrites();
    } catch (err: any) {
      console.error('saveAsset Supabase sync error:', err);
      showErrorModal(`⚠️ 장비 자산 저장 중 DB 동기화 오류가 발생했습니다:\n${err.message || err.details || JSON.stringify(err)}`, 'DB 동기화 오류');
      throw err;
    }
    refreshAllData();
    return result;
  };

  // 💡 자산 상태 SSOT 실시간 자동 변동 헬퍼 메소드
  const changeAssetStatus = async (assetId: string, newStatus: Asset['status'], extraData?: Partial<Asset>) => {
    try {
      const targetAsset = db.assets.find(a => a.id === assetId);
      if (!targetAsset) return;

      const updatedPayload: Partial<Asset> = {
        status: newStatus,
        ...extraData
      };

      db.updateRow<Asset>('assets', assetId, updatedPayload);

      // 자산 입출고/상태 변동 이력(assetInOutLogs) 자동 타임라인 기록
      db.insertRow<AssetInOutLog>('assetInOutLogs', {
        assetId: assetId,
        assetNo: targetAsset.assetNo || '',
        modelName: targetAsset.modelName || '',
        type: (newStatus === 'RENTED' || newStatus === 'ASSIGNED') ? 'OUTBOUND' : 'INBOUND',
        eventDate: new Date().toISOString().split('T')[0],
        memo: `[자산상태 실시간 변동] ${targetAsset.status || 'AVAILABLE'} ➔ ${newStatus}`,
        createdAt: new Date().toISOString()
      });

      if (db.isSupabaseConnected() && db.pendingWrites.length > 0) {
        await db.awaitPendingWrites();
      }
      refreshAllData();
    } catch (err: any) {
      console.error('changeAssetStatus error:', err);
      showErrorModal(`⚠️ 자산 상태 변동 처리 중 오류가 발생했습니다:\n\n${err?.message || err}`);
      throw err;
    }
  };

  // 전사 계약번호 통일 생성 헬퍼 (YYMM + 4자리 순차: 예 '26070001')
  const generateNextContractNo = (): string => {
    const prefix = new Date().toISOString().split('T')[0].replace(/-/g, '').substring(2, 6); // e.g. "2607"
    let maxSeq = 0;
    
    db.contracts.forEach(c => {
      if (!c || !c.contractNo) return;
      const match = c.contractNo.match(new RegExp(`${prefix}(\\d{4})`)) || c.contractNo.match(/(\d{8})/);
      if (match) {
        const str = match[1] || match[0];
        if (str.length === 8 && str.startsWith(prefix)) {
          const seq = parseInt(str.substring(4), 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        } else if (str.length === 4) {
          const seq = parseInt(str, 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
      }
    });

    const nextSeq = String(maxSeq + 1).padStart(4, '0');
    return `${prefix}${nextSeq}`;
  };

  const saveSmartDispatch = async (data: SmartDispatchData, autoRegister: boolean, onProgress?: (log: string, percent: number) => void) => {
    const notify = async (msg: string, pct: number, delayMs = 180) => {
      if (onProgress) {
        onProgress(msg, pct);
        await new Promise(r => setTimeout(r, delayMs));
      }
    };

    await notify('🔍 [1/5] 고객사 명칭 정규화 및 거래 상태 확인 중...', 10);

    // 약칭("세보엠이씨") 또는 표기 형태(" (주) 세보엠이씨 ") 검색 시 기존 정식 법인명("주식회사 세보엠이씨") 자동 탐색 & 보정
    let customer = findCustomerByNormalizedName(db.customers, data.customerName);
    if (customer) {
      // 약칭 입력을 정식 등록 명칭으로 자동 치환/보정!
      data.customerName = customer.name;
    }
    if (customer && customer.transactionStatus === 'BLOCKED') {
      return { success: false, errorMessage: '⚠️ 해당 고객사는 [거래불가] 상태로 설정되어 있어 신규 출고 및 계약 등록이 원천 차단됩니다.' };
    }
    const customerId = customer?.id;
    let site = customerId ? db.sites.find(s => s.customerId === customerId && s.name.replace(/\s/g, '') === data.siteName.replace(/\s/g, '')) : null;
    
    const missingFields = [];
    if (!customer) missingFields.push(`고객사: ${data.customerName}`);
    if (!site) missingFields.push(`현장: ${data.siteName}`);

    if (missingFields.length > 0 && !autoRegister) {
      return { success: false, requiresConfirm: true, missingFields };
    }

    if (!customer) {
      await notify(`🏢 [신규 고객] DB에 없는 고객사 '${data.customerName}' 자동 신규 생성 중...`, 20);
      customer = db.insertRow<Customer>('customers', {
        name: data.customerName,
        bizRegNo: '미상',
        isClosed: false,
        address: '미상',
        representative: '미상',
        repContact: '미상',
        repEmail: '미상',
        createdAt: new Date().toISOString()
      });

      // ⚠️ FK 제약 방지: 신규 고객이 Supabase에 완전히 저장된 후에만 contacts/sites 생성 가능
      try {
        await db.awaitPendingWrites();
      } catch (err: any) {
        console.error('Supabase new customer sync error:', err);
        showErrorModal(`⚠️ 신규 고객 DB 저장 중 오류:\n${err.message || JSON.stringify(err)}`, '스마트 출고 오류');
        return { success: false, errorMessage: err.message };
      }

      if (data.siteContactName) {
        db.insertRow<CustomerContact>('contacts', {
          customerId: customer.id,
          name: data.siteContactName,
          position: '담당자',
          contact: data.siteContactPhone || '미상',
          email: data.siteContactEmail || '미상',
          createdAt: new Date().toISOString()
        });
      }
    } else {
      await notify(`✅ [고객 확인] 기존 등록 고객사 '${customer.name}' 매핑 완료`, 25);
      if (data.siteContactName) {
        const targetCustomerId = customer.id;
        const existingContact = db.contacts.find(ct => ct.customerId === targetCustomerId && ct.name.replace(/\s/g, '') === data.siteContactName.replace(/\s/g, ''));
        if (!existingContact) {
          await notify(`👤 [담당자 신규] 현장 담당자 '${data.siteContactName}' 등록 중...`, 30);
          db.insertRow<CustomerContact>('contacts', {
            customerId: targetCustomerId,
            name: data.siteContactName,
            position: '담당자',
            contact: data.siteContactPhone || '미상',
            email: data.siteContactEmail || '미상',
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    const finalCustomer = customer;

    if (!site) {
      await notify(`📍 [2/5 현장 등록] 신규 현장 '${data.siteName}' 자동 등록 중...`, 40);
      site = db.insertRow<CustomerSite>('sites', {
        customerId: finalCustomer.id,
        name: data.siteName,
        address: data.siteAddress || '미상',
        contactName: data.siteContactName || '미상',
        contact: data.siteContactPhone || '미상',
        email: data.siteContactEmail || '미상',
        createdAt: new Date().toISOString()
      });
    } else {
      await notify(`📍 [2/5 현장 매핑] 기존 현장 '${site.name}' 매핑 완료`, 45);
    }

    if (autoRegister && currentUser) {
      db.insertRow<Todo>('todos', {
        userId: currentUser.id,
        type: 'MISSING_INFO',
        title: `신규 고객/현장 정보 보완 (${data.customerName})`,
        content: `스마트 출고 요청 시 사업자등록번호 등 미상으로 처리된 필수 항목을 채워주세요.`,
        isCompleted: false,
        relatedEntityId: finalCustomer.id,
        createdAt: new Date().toISOString()
      });
    }

    const finalSite = site!;

    const existingUsers = db.users;
    const isSalespersonValid = currentUser?.id && existingUsers.some(u => u.id === currentUser.id);
    const validSalespersonId = isSalespersonValid ? currentUser.id : (existingUsers.find(u => u.id === 'u-1')?.id || existingUsers[0]?.id || undefined);

    const nextContractNo = generateNextContractNo();

    await notify(`📄 [3/5 계약 생성] 스마트 임대차 계약서 작성 중 (${nextContractNo})...`, 55);

    const contract = db.insertRow<Contract>('contracts', {
      contractNo: nextContractNo,
      customerId: finalCustomer.id,
      siteId: finalSite.id,
      startDate: new Date().toISOString().split('T')[0],
      endDate: '', 
      billingDay: 30,
      salespersonId: validSalespersonId,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // ⚠️ 외래키(Foreign Key) 제약조건 위반 방지: 부모 contract 레코드가 Supabase 원격 DB에 먼저 100% 생성되도록 1차 동기 대기!
    try {
      await db.awaitPendingWrites();
    } catch (err: any) {
      console.error('Supabase contract insert sync error:', err);
      showErrorModal(`⚠️ 스마트 출고 계약 생성 중 DB 동기화 오류가 발생했습니다:\n${err.message || err.details || JSON.stringify(err)}`, '스마트 출고 DB 동기화 오류');
      return { success: false, errorMessage: err.message || err.details };
    }

    await notify('🏗️ [4/5 장비 매핑] 계약 투입 장비 모델 및 수량 매핑 중...', 80);

    data.equipments.forEach((eq) => {
      for(let i=0; i<eq.qty; i++) {
        db.insertRow<ContractAsset>('contractAssets', {
          contractId: contract.id,
          assetId: '',
          expectedModel: eq.modelName,
          monthlyRentalFee: 0,
          dailyRentalFee: 0,
          startDate: contract.startDate,
          endDate: '',
          createdAt: new Date().toISOString()
        });
      }
    });

    await notify('🚚 [5/5 배차 생성] 배차/운송 관리 출고대기 지시건 생성 중...', 90);

    // 신규 배차(Delivery) - 출고 대기 건 자동 생성
    const cargoItems = JSON.stringify(data.equipments.map(e => ({ modelName: e.modelName, count: e.qty })));
    const dData = data as any;
    db.insertRow<Delivery>('deliveries', {
      contractId: contract.id,
      type: 'OUTBOUND',
      status: 'REQUESTED',
      requestDate: contract.startDate,
      scheduledDate: data.loadingTime || contract.startDate,
      originAddress: '당사 보관소',
      destinationAddress: `${finalCustomer.name} (${finalSite.name} - ${finalSite.address || ''})`,
      transportCompany: '',
      vehicleType: '',
      vehicleNo: '',
      driverName: '',
      driverContact: '',
      deliveryCost: 70000,
      expectedCost: 70000,
      finalCost: 70000,
      reconciliationStatus: 'PENDING',
      cargoItems,
      isCostSettled: false,
      rawText: (data as any).prompt || (data as any).rawText || data.note || '',
      memo: `[스마트출고] 현장담당: ${data.siteContactName || '-'} (${data.siteContactPhone || '-'}) | 상차: ${data.loadingTime || '-'} / 하차: ${data.unloadingTime || '-'} | 청구담당: ${data.billingContactName || '-'} (${data.billingContactPhone || '-'}) | 계산서: ${data.taxBillEmail || '-'} | 특이사항: ${data.note || '없음'}`,
      closingMemo: `[마감조건] 마감일: ${dData.closingDay || '-'} / 결제일: ${dData.paymentDay || '-'} | 유상옵션: ${dData.paidOptions || '없음'} | 보양: ${dData.protection || '없음'}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await notify('🌐 Supabase 원격 DB 최종 2차 동기화 완료 중...', 96);

    try {
      await db.awaitPendingWrites();
    } catch (err: any) {
      console.error('Supabase sync error during saveSmartDispatch:', err);
      
      // 💥 DB 저장 실패 시 생성되었던 임시 계약/배차/슬롯 레코드 롤백 삭제!
      if (contract?.id) {
        db.deleteRow('contracts', contract.id);
        const addedCAssets = db.contractAssets.filter(ca => ca.contractId === contract.id);
        addedCAssets.forEach(ca => db.deleteRow('contractAssets', ca.id));
        const addedDeliveries = db.deliveries.filter(d => d.contractId === contract.id);
        addedDeliveries.forEach(d => db.deleteRow('deliveries', d.id));
      }
      refreshAllData();

      const errorMsg = `⚠️ Supabase 데이터베이스 동기화 중 오류가 발생했습니다:\n\n■ [안내]: 저장 실패로 인해 생성 시도했던 데이터가 안전하게 자동 롤백 원복되었습니다.\n\n${err.message || err.details || JSON.stringify(err)}`;
      showErrorModal(errorMsg, '스마트 출고 DB 동기화 오류 (자동 원복 완료)');
      return { 
        success: false, 
        errorMessage: errorMsg
      };
    }

    await notify('🎉 [완료] 출고의뢰 생성을 성공적으로 완료하였습니다!', 100, 300);

    refreshAllData();
    return { success: true };
  };

  const saveSmartReturn = (data: SmartReturnData) => {
    if (data.contractId) {
      const contract = db.contracts.find(c => c.id === data.contractId);
      if (!contract) return;

      db.updateRow<Contract>('contracts', data.contractId, {
        endDate: data.returnDate,
        status: 'SHORTENED',
        updatedAt: new Date().toISOString()
      });

      // 새로운 고객담당자(처음 등장하는 사람)라면 자동 등록!
      if (data.contactName) {
        const existingContact = db.contacts.find(ct => ct.customerId === contract.customerId && ct.name.replace(/\s/g, '') === data.contactName!.replace(/\s/g, ''));
        if (!existingContact) {
          db.insertRow<CustomerContact>('contacts', {
            customerId: contract.customerId,
            name: data.contactName,
            position: '담당자',
            contact: data.contactPhone || '미상',
            email: '미상',
            createdAt: new Date().toISOString()
          });
        }
      }

      data.assetIds.forEach(assetId => {
        const ca = db.contractAssets.find(c => c.contractId === data.contractId && c.assetId === assetId);
        if (ca) {
          db.updateRow<ContractAsset>('contractAssets', ca.id, {
            endDate: data.returnDate
          });
        }
        db.updateRow<Asset>('assets', assetId, {
          status: 'RENTED_RETURNED',
          contractEnd: data.returnDate,
          updatedAt: new Date().toISOString()
        });

        const targetAsset = db.assets.find(a => a.id === assetId);
        // 자산 입출고/반납 이력 자동 기록
        db.insertRow<AssetInOutLog>('assetInOutLogs', {
          assetId: assetId,
          assetNo: targetAsset?.assetNo || '',
          modelName: targetAsset?.modelName || '',
          type: 'INBOUND',
          eventDate: data.returnDate || new Date().toISOString().split('T')[0],
          memo: `[스마트반납 완료] 계약번호(${contract.contractNo}) 현장 반납 입고 완료`,
          createdAt: new Date().toISOString()
        });
      });

      db.insertRow<ContractHistory>('contractHistory', {
        contractId: data.contractId,
        changeType: 'SHORTEN',
        changeDate: new Date().toISOString().split('T')[0],
        prevEndDate: contract.endDate,
        newEndDate: data.returnDate,
        description: `스마트 회수 등록 (회수 자산: ${data.assetIds.length}대)`,
        createdAt: new Date().toISOString()
      });

      const contactInfoMemo = data.contactName || data.contactPhone
        ? `[고객담당자: ${data.contactName || '-'} (${data.contactPhone || '-'})] `
        : '';
      const cust = db.customers.find(c => c.id === contract.customerId);
      const site = db.sites.find(s => s.id === contract.siteId);
      const returnAssets = db.assets.filter(a => data.assetIds.includes(a.id));
      const modelCountsMap: Record<string, number> = {};
      returnAssets.forEach(a => {
        modelCountsMap[a.modelName] = (modelCountsMap[a.modelName] || 0) + 1;
      });
      const cargoItems = JSON.stringify(Object.entries(modelCountsMap).map(([modelName, count]) => ({ modelName, count })));

      db.insertRow<Delivery>('deliveries', {
        contractId: data.contractId,
        assetIds: data.assetIds.join(','),
        type: 'INBOUND',
        status: 'REQUESTED',
        requestDate: data.returnDate,
        scheduledDate: data.loadingTime || data.returnDate,
        originAddress: `${cust?.name || '고객사'} (${site?.name || '현장'})`,
        destinationAddress: '당사 보관소',
        transportCompany: '',
        vehicleType: '',
        vehicleNo: '',
        driverName: '',
        driverContact: '',
        deliveryCost: 70000,
        expectedCost: 70000,
        finalCost: 70000,
        reconciliationStatus: 'PENDING',
        cargoItems,
        isCostSettled: false,
        memo: `${contactInfoMemo}${data.note || ''}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } else {
      // Case 4: 외주정비 회수
      db.insertRow<Delivery>('deliveries', {
        assetIds: data.assetIds.join(','),
        type: 'INBOUND',
        status: 'REQUESTED',
        requestDate: data.returnDate,
        scheduledDate: data.loadingTime || data.returnDate,
        transportCompany: '',
        vehicleType: '',
        vehicleNo: '',
        driverName: '',
        driverContact: '',
        deliveryCost: 0,
        isCostSettled: false,
        memo: `[외주정비회수] 정비건: ${data.repairId || '-'} / 외주업체: ${data.vendorId || '-'} | ${data.note || ''}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    refreshAllData();
  };

  const completeTodo = (todoId: string) => {
    db.updateRow<Todo>('todos', todoId, { isCompleted: true });
    refreshAllData();
  };

  const acquireAsset = (assetData: Partial<Asset>) => {
    const residualRate = assetData.residualValueRate ?? 10;
    const price = assetData.acquisitionPrice ?? 0;
    const bookVal = price;
    
    db.insertRow<Asset>('assets', {
      modelName: assetData.modelName || '',
      assetNo: assetData.assetNo || '',
      serialNo: assetData.serialNo || '',
      manufacturer: assetData.manufacturer || '',
      ownerType: 'OWNED',
      status: 'AVAILABLE',
      billingDay: 30,
      monthlyRentalFee: assetData.monthlyRentalFee || 0,
      dailyRentalFee: assetData.dailyRentalFee || 0,
      acquisitionDate: assetData.acquisitionDate || new Date().toISOString().split('T')[0],
      acquisitionPrice: price,
      depreciationMonths: assetData.depreciationMonths || 60,
      residualValueRate: residualRate,
      accumDepreciation: 0,
      bookValue: bookVal,
      cumRentalFee: 0,
      cumRepairCost: 0,
      supplier: assetData.supplier || '',
      memo1: assetData.memo1 || '',
      memo2: assetData.memo2 || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    refreshAllData();
  };

  const disposeAsset = (assetId: string, disposalData: { disposalDate: string; disposalPrice: number; buyer: string }) => {
    const asset = db.assets.find(a => a.id === assetId);
    if (!asset) return;

    db.updateRow<Asset>('assets', assetId, {
      status: 'SOLD',
      disposalDate: disposalData.disposalDate,
      disposalPrice: disposalData.disposalPrice,
      buyer: disposalData.buyer,
      updatedAt: new Date().toISOString()
    });

    const billingYm = disposalData.disposalDate.substring(0, 7);
    
    let customer = db.customers.find(c => c.name === disposalData.buyer);
    if (!customer) {
      customer = db.insertRow<Customer>('customers', {
        name: disposalData.buyer,
        bizRegNo: '',
        isClosed: false,
        address: '',
        representative: '',
        repContact: '',
        repEmail: '',
        createdAt: new Date().toISOString()
      });
    }

    const billing = db.insertRow<Billing>('billings', {
      customerId: customer.id,
      billingYm,
      billingDate: disposalData.disposalDate,
      totalAmount: disposalData.disposalPrice,
      paidAmount: 0,
      status: 'REQUESTED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    db.insertRow<BillingDetail>('billingDetails', {
      billingId: billing.id,
      itemName: `자산 매각대금 청구 (관리번호: ${asset.assetNo}, 모델: ${asset.modelName})`,
      quantity: 1,
      unitPrice: disposalData.disposalPrice,
      amount: disposalData.disposalPrice,
      description: `장비 매각 처리에 따른 청구서 발행.`,
      createdAt: new Date().toISOString()
    });

    refreshAllData();
  };

  const registerRentedAsset = async (assetData: Partial<Asset>) => {
    let result;
    const existing = db.assets.find(a => a.assetNo === assetData.assetNo);
    if (existing) {
      result = db.updateRow<Asset>('assets', existing.id, {
        ...assetData,
        ownerType: 'RENTED',
        updatedAt: new Date().toISOString()
      });
    } else {
      result = db.insertRow<Asset>('assets', {
        modelName: assetData.modelName || '',
        assetNo: assetData.assetNo || '',
        serialNo: assetData.serialNo || '',
        manufacturer: assetData.manufacturer || '',
        ownerType: 'RENTED',
        status: 'AVAILABLE',
        billingDay: 30,
        monthlyRentalFee: assetData.monthlyRentalFee || 0,
        dailyRentalFee: assetData.dailyRentalFee || 0,
        renter: assetData.renter || '',
        rentStart: assetData.rentStart || '',
        rentEnd: assetData.rentEnd || '',
        monthlyRentFee: assetData.monthlyRentFee || 0,
        dailyRentFee: assetData.dailyRentFee || 0,
        acquisitionPrice: 0,
        depreciationMonths: 0,
        residualValueRate: 0,
        accumDepreciation: 0,
        bookValue: 0,
        cumRentalFee: 0,
        cumRepairCost: 0,
        memo1: assetData.memo1 || '',
        memo2: assetData.memo2 || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    try {
      await db.awaitPendingWrites();
    } catch (err: any) {
      console.error('registerRentedAsset Supabase sync error:', err);
      showErrorModal(`⚠️ 임차 자산 저장 중 원격 DB 동기화 오류가 발생했습니다:\n${err.message || err.details || JSON.stringify(err)}`, 'DB 동기화 오류');
      throw err;
    }
    refreshAllData();
    return result;
  };

  const returnRentedAsset = (assetId: string, returnDate: string) => {
    db.updateRow<Asset>('assets', assetId, {
      status: 'RENTED_RETURNED',
      actualRentReturnDate: returnDate,
      updatedAt: new Date().toISOString()
    });
    refreshAllData();
  };

  const purchaseConsumable = async (data: { modelName: string; qty: number; unit: string; unitPrice: number; supplier: string }) => {
    let consumable = db.consumables.find(c => c.modelName.replace(/\s/g, '') === data.modelName.replace(/\s/g, ''));
    
    if (consumable) {
      db.updateRow<Consumable>('consumables', consumable.id, {
        stockQty: consumable.stockQty + data.qty,
        unitPrice: data.unitPrice,
        supplier: data.supplier,
        updatedAt: new Date().toISOString()
      });
    } else {
      consumable = db.insertRow<Consumable>('consumables', {
        modelName: data.modelName,
        stockQty: data.qty,
        unit: data.unit || '개',
        unitPrice: data.unitPrice,
        supplier: data.supplier,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    db.insertRow<ConsumableLog>('consumableLogs', {
      consumableId: consumable.id,
      type: 'INBOUND',
      quantity: data.qty,
      unitPrice: data.unitPrice,
      supplier: data.supplier,
      userId: currentUser?.id,
      actionDate: new Date().toISOString().split('T')[0],
      description: '소모품 구입 입고',
      createdAt: new Date().toISOString()
    });

    await db.awaitPendingWrites();
    refreshAllData();
  };

  const useConsumable = async (data: { consumableId: string; quantity: number; targetAssetId: string; description: string }) => {
    const consumable = db.consumables.find(c => c.id === data.consumableId);
    if (!consumable || consumable.stockQty < data.quantity) return;

    db.updateRow<Consumable>('consumables', consumable.id, {
      stockQty: consumable.stockQty - data.quantity,
      updatedAt: new Date().toISOString()
    });

    db.insertRow<ConsumableLog>('consumableLogs', {
      consumableId: consumable.id,
      type: 'OUTBOUND',
      quantity: data.quantity,
      unitPrice: consumable.unitPrice,
      targetAssetId: data.targetAssetId,
      userId: currentUser?.id,
      actionDate: new Date().toISOString().split('T')[0],
      description: data.description,
      createdAt: new Date().toISOString()
    });

    const asset = db.assets.find(a => a.id === data.targetAssetId);
    if (asset) {
      const cost = consumable.unitPrice * data.quantity;
      db.updateRow<Asset>('assets', asset.id, {
        cumRepairCost: (asset.cumRepairCost || 0) + cost,
        updatedAt: new Date().toISOString()
      });
    }

    refreshAllData();
  };

  const requestConsumablePurchase = async (data: { consumableId?: string; modelName: string; qty: number; unitPrice: number; requestDate: string; sellerName: string }) => {
    db.insertRow<ConsumablePurchaseRequest>('consumablePurchases', {
      consumableId: data.consumableId || undefined,
      modelName: data.modelName,
      requestedQty: data.qty,
      unitPrice: data.unitPrice,
      requestDate: data.requestDate,
      sellerName: data.sellerName,
      status: 'REQUESTED',
      requesterId: currentUser?.id || 'system',
      requesterName: currentUser?.name || '시스템',
      receivedQty: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await db.awaitPendingWrites();
    refreshAllData();
  };

  const acceptConsumablePurchase = async (id: string) => {
    db.updateRow<ConsumablePurchaseRequest>('consumablePurchases', id, {
      status: 'ACCEPTED',
      acceptedDate: new Date().toISOString().split('T')[0],
      accepterId: currentUser?.id || 'system',
      accepterName: currentUser?.name || '시스템',
      updatedAt: new Date().toISOString()
    });
    await db.awaitPendingWrites();
    refreshAllData();
  };

  const completeConsumablePurchase = async (id: string) => {
    db.updateRow<ConsumablePurchaseRequest>('consumablePurchases', id, {
      status: 'COMPLETED',
      completedDate: new Date().toISOString().split('T')[0],
      accepterId: currentUser?.id || 'system',
      accepterName: currentUser?.name || '시스템',
      updatedAt: new Date().toISOString()
    });
    await db.awaitPendingWrites();
    refreshAllData();
  };

  const inboundConsumablePurchase = async (id: string, qty: number, statementFileUrl: string) => {
    const req = db.consumablePurchases.find(p => p.id === id);
    if (!req) return;

    const nextReceivedQty = req.receivedQty + qty;
    db.updateRow<ConsumablePurchaseRequest>('consumablePurchases', id, {
      receivedQty: nextReceivedQty,
      statementFileUrl,
      inbounderName: currentUser?.name || '시스템',
      updatedAt: new Date().toISOString()
    });

    let consumable = req.consumableId ? db.consumables.find(c => c.id === req.consumableId) : null;
    if (!consumable) {
      consumable = db.consumables.find(c => c.modelName.replace(/\s/g, '') === req.modelName.replace(/\s/g, '')) || null;
    }

    if (consumable) {
      db.updateRow<Consumable>('consumables', consumable.id, {
        stockQty: consumable.stockQty + qty,
        unitPrice: req.unitPrice,
        supplier: req.sellerName,
        updatedAt: new Date().toISOString()
      });
    } else {
      consumable = db.insertRow<Consumable>('consumables', {
        modelName: req.modelName,
        stockQty: qty,
        unit: '개',
        unitPrice: req.unitPrice,
        supplier: req.sellerName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      db.updateRow<ConsumablePurchaseRequest>('consumablePurchases', id, {
        consumableId: consumable.id
      });
    }

    db.insertRow<ConsumableLog>('consumableLogs', {
      consumableId: consumable.id,
      type: 'INBOUND',
      quantity: qty,
      unitPrice: req.unitPrice,
      supplier: req.sellerName,
      userId: currentUser?.id,
      actionDate: new Date().toISOString().split('T')[0],
      description: `구매신청 연계 입고 (증빙: ${statementFileUrl.split('/').pop()})`,
      createdAt: new Date().toISOString()
    });

    await db.awaitPendingWrites();
    refreshAllData();
  };

  const createContract = async (contractData: Omit<Contract, 'id' | 'createdAt' | 'updatedAt' | 'contractNo'>, assetsList: { assetId?: string; expectedModel?: string; monthlyRentalFee: number; dailyRentalFee: number }[]) => {
    const contractNo = generateNextContractNo();
    
    const contract = db.insertRow<Contract>('contracts', {
      ...contractData,
      contractNo,
      salespersonId: contractData.salespersonId || currentUser?.id,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // ⚠️ 외래키(Foreign Key) 제약조건 위반 방지: contract가 Supabase 원격 DB에 먼저 100% 생성되도록 1차 동기 대기!
    try {
      await db.awaitPendingWrites();
    } catch (err: any) {
      console.error('Supabase contract insert sync error in saveContract:', err);
    }

    assetsList.forEach(item => {
      db.insertRow<ContractAsset>('contractAssets', {
        contractId: contract.id,
        assetId: item.assetId || undefined,
        expectedModel: item.expectedModel || undefined,
        monthlyRentalFee: item.monthlyRentalFee,
        dailyRentalFee: item.dailyRentalFee,
        startDate: contractData.startDate,
        endDate: contractData.endDate,
        createdAt: new Date().toISOString()
      });

      if (item.assetId) {
        db.updateRow<Asset>('assets', item.assetId, {
          status: 'RENTED',
          currentCustomerId: contractData.customerId,
          currentSiteId: contractData.siteId,
          contractStart: contractData.startDate,
          contractEnd: contractData.endDate,
          monthlyRentalFee: item.monthlyRentalFee,
          dailyRentalFee: item.dailyRentalFee,
          updatedAt: new Date().toISOString()
        });
      }
    });

    db.insertRow<ContractHistory>('contractHistory', {
      contractId: contract.id,
      changeType: 'REGISTER',
      changeDate: new Date().toISOString().split('T')[0],
      newEndDate: contractData.endDate,
      description: '계약 신규 등록',
      createdAt: new Date().toISOString()
    });

    const today = new Date().toISOString().split('T')[0];
    db.insertRow<Delivery>('deliveries', {
      contractId: contract.id,
      type: 'OUTBOUND',
      dispatchCategory: '출고',
      status: 'REQUESTED',
      requestDate: today,
      loadingDate: today,
      loadingTimeSlot: '오전',
      unloadingDate: today,
      unloadingTimeSlot: '오전',
      deliveryCost: 0,
      isCostSettled: false,
      memo: '신규 계약 체결에 따른 스마트 출고 의뢰',
      closingMemo: '스마트 출고 파이프라인 자동 지시건',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    refreshAllData();
  };

  const extendContract = (contractId: string, newEndDate: string, description: string) => {
    const contract = db.contracts.find(c => c.id === contractId);
    if (!contract) return;

    const prevEnd = contract.endDate;

    db.updateRow<Contract>('contracts', contractId, {
      endDate: newEndDate,
      status: 'EXTENDED',
      updatedAt: new Date().toISOString()
    });

    const cAssets = db.contractAssets.filter(ca => ca.contractId === contractId);
    cAssets.forEach(ca => {
      db.updateRow<ContractAsset>('contractAssets', ca.id, { endDate: newEndDate });
      if (ca.assetId) {
        db.updateRow<Asset>('assets', ca.assetId, {
          contractEnd: newEndDate,
          updatedAt: new Date().toISOString()
        });
      }
    });

    db.insertRow<ContractHistory>('contractHistory', {
      contractId,
      changeType: 'EXTEND',
      changeDate: new Date().toISOString().split('T')[0],
      prevEndDate: prevEnd,
      newEndDate,
      description: `계약 연장 처리: ${description}`,
      createdAt: new Date().toISOString()
    });

    refreshAllData();
  };

  const shortenContract = (contractId: string, newEndDate: string, description: string) => {
    const contract = db.contracts.find(c => c.id === contractId);
    if (!contract) return;

    const prevEnd = contract.endDate;

    db.updateRow<Contract>('contracts', contractId, {
      endDate: newEndDate,
      status: 'SHORTENED',
      updatedAt: new Date().toISOString()
    });

    const cAssets = db.contractAssets.filter(ca => ca.contractId === contractId);
    cAssets.forEach(ca => {
      db.updateRow<ContractAsset>('contractAssets', ca.id, { endDate: newEndDate });
      if (ca.assetId) {
        db.updateRow<Asset>('assets', ca.assetId, {
          contractEnd: newEndDate,
          updatedAt: new Date().toISOString()
        });
      }
    });

    db.insertRow<ContractHistory>('contractHistory', {
      contractId,
      changeType: 'SHORTEN',
      changeDate: new Date().toISOString().split('T')[0],
      prevEndDate: prevEnd,
      newEndDate,
      description: `계약 단축 처리: ${description}`,
      createdAt: new Date().toISOString()
    });

    db.insertRow<Delivery>('deliveries', {
      contractId: contract.id,
      type: 'INBOUND',
      status: 'REQUESTED',
      requestDate: new Date().toISOString().split('T')[0],
      scheduledDate: newEndDate,
      deliveryCost: 0,
      isCostSettled: false,
      memo: '계약 조기 단축/만료에 따른 회수 의뢰',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    refreshAllData();
  };

  const succeedContract = (contractId: string, successorCustomerId: string, successorContactId: string, successorSiteId: string, successionDate: string, description: string) => {
    const oldContract = db.contracts.find(c => c.id === contractId);
    if (!oldContract) return;

    const oldEndDate = oldContract.endDate;
    
    db.updateRow<Contract>('contracts', contractId, {
      endDate: successionDate,
      status: 'SHORTENED',
      updatedAt: new Date().toISOString()
    });

    const oldCAssets = db.contractAssets.filter(ca => ca.contractId === contractId);
    oldCAssets.forEach(ca => {
      db.updateRow<ContractAsset>('contractAssets', ca.id, { endDate: successionDate });
    });

    db.insertRow<ContractHistory>('contractHistory', {
      contractId,
      changeType: 'SHORTEN',
      changeDate: successionDate,
      prevEndDate: oldEndDate,
      newEndDate: successionDate,
      description: `계약 승계 이전(타 고객 인수)에 따른 단축 완료`,
      createdAt: new Date().toISOString()
    });

    const nextDay = new Date(new Date(successionDate).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const newContractNo = `CT-SUCC-${Math.floor(1000 + Math.random() * 9000)}`;

    const newContract = db.insertRow<Contract>('contracts', {
      contractNo: newContractNo,
      customerId: successorCustomerId,
      contactId: successorContactId,
      siteId: successorSiteId,
      startDate: nextDay,
      endDate: oldEndDate,
      billingDay: oldContract.billingDay,
      salespersonId: oldContract.salespersonId,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    db.updateRow<Contract>('contracts', contractId, {
      successorContractId: newContract.id,
      status: 'SUCCEEDED'
    });

    oldCAssets.forEach(ca => {
      db.insertRow<ContractAsset>('contractAssets', {
        contractId: newContract.id,
        assetId: ca.assetId,
        monthlyRentalFee: ca.monthlyRentalFee,
        dailyRentalFee: ca.dailyRentalFee,
        startDate: nextDay,
        endDate: oldEndDate,
        createdAt: new Date().toISOString()
      });

      if (ca.assetId) {
        db.updateRow<Asset>('assets', ca.assetId, {
          currentCustomerId: successorCustomerId,
          currentSiteId: successorSiteId,
          contractStart: nextDay,
          contractEnd: oldEndDate,
          updatedAt: new Date().toISOString()
        });
      }
    });

    db.insertRow<ContractHistory>('contractHistory', {
      contractId: newContract.id,
      changeType: 'REGISTER',
      changeDate: successionDate,
      newEndDate: oldEndDate,
      description: `계약 승계 인수 완료 (이전 계약번호: ${oldContract.contractNo}): ${description}`,
      createdAt: new Date().toISOString()
    });

    refreshAllData();
  };

  const assignAssetToContract = async (contractAssetId: string, assetId: string) => {
    // 💡 1. 롤백용 원본 스냅샷 백업
    const origCa = db.contractAssets.find(c => c.id === contractAssetId);
    const caSnapshot = origCa ? { ...origCa } : null;

    const origAsset = db.assets.find(a => a.id === assetId);
    const assetSnapshot = origAsset ? { ...origAsset } : null;

    let createdInspectionId: string | null = null;

    try {
      if (!origCa) throw new Error('해당 계약 슬롯(contractAsset)을 찾을 수 없습니다.');

      let contract = db.contracts.find(c => c.id === origCa.contractId);
      if (!contract && db.isSupabaseConnected()) {
        try {
          await db.pullTableFromSupabase('contracts');
          contract = db.contracts.find(c => c.id === origCa.contractId);
        } catch (e) {}
      }

      if (!origAsset) throw new Error('할당할 대상 장비를 찾을 수 없습니다.');

      const nowIso = new Date().toISOString();

      // 1. ContractAsset 업데이트 (실물 장비 ID 할당)
      db.updateRow<ContractAsset>('contractAssets', contractAssetId, {
        assetId: assetId,
        ...(origAsset?.modelName ? { expectedModel: origAsset.modelName } : {})
      });

      // 2. Asset 상태 업데이트 (ASSIGNED 출고대기로 전환)
      const assetUpdatePayload: Partial<Asset> = {
        status: 'ASSIGNED',
        updatedAt: nowIso
      };
      if (contract?.customerId) assetUpdatePayload.currentCustomerId = contract.customerId;
      if (contract?.siteId) assetUpdatePayload.currentSiteId = contract.siteId;
      if (contract?.startDate) assetUpdatePayload.contractStart = contract.startDate;
      if (contract?.endDate) assetUpdatePayload.contractEnd = contract.endDate;

      db.updateRow<Asset>('assets', assetId, assetUpdatePayload);

      // 3. 출고 검수/정비 작업 의뢰 생성
      const createdInsp = db.insertRow<OutboundInspection>('outboundInspections', {
        contractId: origCa.contractId,
        contractAssetId: origCa.id,
        assetId: assetId,
        status: 'PENDING',
        createdAt: nowIso,
        updatedAt: nowIso
      });
      createdInspectionId = createdInsp.id;

      // 4. Supabase 원격 DB 쓰기 100% 완결 동기 대기 (실패 시 catch 블록에서 자동 롤백!)
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      console.error('assignAssetToContract error & Rollback:', err);

      // 💥 DB 저장 실패 시 로컬 DB 및 UI State를 100% 이전 상태로 자동 롤백 (Rollback Execution)!
      if (caSnapshot) {
        db.updateRow<ContractAsset>('contractAssets', contractAssetId, caSnapshot);
      }
      if (assetSnapshot) {
        db.updateRow<Asset>('assets', assetId, assetSnapshot);
      }
      if (createdInspectionId) {
        db.deleteRow('outboundInspections', createdInspectionId);
      }

      refreshAllData(); // 롤백된 원복 상태를 UI에 반영!

      const errMsg = err?.message || err?.details || JSON.stringify(err);
      showErrorModal(
        `⚠️ 장비 할당 저장 중 DB 동기화 오류가 발생했습니다:\n\n` +
        `■ [안내]: 저장 실패로 인해 장비 할당 상태가 이전 미할당 상태로 안전하게 롤백(자동 원복)되었습니다. 할당 대상 목록에서 계속 작업하실 수 있습니다.\n\n` +
        `■ [실패 원인]: ${errMsg}\n\n` +
        `■ [조치 방법]: 아래 버튼 [🚀 1-Click DB 패치 즉시 실행] 을 누르시거나 개발자 도구에서 패치를 실행해 주십시오:\n\n` +
        `ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "contractStart" TEXT;\n` +
        `ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "contractEnd" TEXT;\n` +
        `ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "currentCustomerId" TEXT;\n` +
        `ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "currentSiteId" TEXT;\n` +
        `NOTIFY pgrst, 'reload schema';`,
        '장비 할당 DB 동기화 오류 (자동 롤백 원복 완료)'
      );
      throw err;
    }
  };

  // 💡 출고 진행 중 장비 교체 및 수리전환 트랜잭션 메소드
  const exchangeOutboundAsset = async (contractAssetId: string, oldAssetId: string, newAssetId: string, reason: string, markOldAsRepairing: boolean = true) => {
    // 롤백용 스냅샷 준비
    const oldAssetOrig = db.assets.find(a => a.id === oldAssetId);
    const newAssetOrig = db.assets.find(a => a.id === newAssetId);
    const caOrig = db.contractAssets.find(c => c.id === contractAssetId);
    const inspOrig = db.outboundInspections.find(i => i.contractAssetId === contractAssetId && i.assetId === oldAssetId);

    const oldSnapshot = oldAssetOrig ? { ...oldAssetOrig } : null;
    const newSnapshot = newAssetOrig ? { ...newAssetOrig } : null;
    const caSnapshot = caOrig ? { ...caOrig } : null;
    const inspSnapshot = inspOrig ? { ...inspOrig } : null;

    try {
      if (!oldAssetOrig || !newAssetOrig || !caOrig) {
        throw new Error('교체 대상 장비 또는 계약 슬롯을 찾을 수 없습니다.');
      }

      const today = new Date().toISOString().split('T')[0];
      const nowIso = new Date().toISOString();

      // 1. 기존 장비: 수리정비중(REPAIRING) 선택 시 REPAIRING 전환, 아니면 임대가능(AVAILABLE) 유지!
      const targetStatus = markOldAsRepairing ? 'REPAIRING' : 'AVAILABLE';
      const oldNote = oldAssetOrig.memo1 || oldAssetOrig.note || oldAssetOrig.memo || '';
      const appendedNote = oldNote
        ? `${oldNote}\n[출고전 교체(${targetStatus})] ${today}: ${reason}`
        : `[출고전 교체(${targetStatus})] ${today}: ${reason}`;

      db.updateRow<Asset>('assets', oldAssetId, {
        status: targetStatus,
        memo1: appendedNote,
        note: appendedNote,
        memo: appendedNote,
        currentCustomerId: undefined,
        currentSiteId: undefined,
        contractStart: undefined,
        contractEnd: undefined,
        updatedAt: nowIso
      });

      // 2. 대체 장비: 배차지정(ASSIGNED)으로 전환 및 계약 정보 매핑
      db.updateRow<Asset>('assets', newAssetId, {
        status: 'ASSIGNED',
        currentCustomerId: oldAssetOrig.currentCustomerId,
        currentSiteId: oldAssetOrig.currentSiteId,
        contractStart: oldAssetOrig.contractStart,
        contractEnd: oldAssetOrig.contractEnd,
        updatedAt: nowIso
      });

      // 3. 계약 슬롯(contractAssets) assetId 교체
      db.updateRow<ContractAsset>('contractAssets', contractAssetId, {
        assetId: newAssetId,
        expectedModel: newAssetOrig.modelName
      });

      // 4. 출고 검수 의뢰건(outboundInspections) assetId 교체
      if (inspOrig) {
        db.updateRow<OutboundInspection>('outboundInspections', inspOrig.id, {
          assetId: newAssetId,
          note: `[장비교체] 기존(${oldAssetOrig.assetNo}) ➔ 대체(${newAssetOrig.assetNo}) | 사유: ${reason}`,
          updatedAt: nowIso
        });
      }

      // 5. 자산 입출고/수리 타임라인 로깅
      db.insertRow<AssetInOutLog>('assetInOutLogs', {
        assetId: oldAssetId,
        assetNo: oldAssetOrig.assetNo,
        modelName: oldAssetOrig.modelName,
        type: 'REPAIR',
        eventDate: today,
        memo: `[출고불가 수리전환] 대체장비(${newAssetOrig.assetNo}) 교체출고 | 사유: ${reason}`,
        createdAt: nowIso
      });

      db.insertRow<AssetInOutLog>('assetInOutLogs', {
        assetId: newAssetId,
        assetNo: newAssetOrig.assetNo,
        modelName: newAssetOrig.modelName,
        type: 'OUTBOUND',
        eventDate: today,
        memo: `[대체장비 출고할당] 기존장비(${oldAssetOrig.assetNo}) 교체대체 | 사유: ${reason}`,
        createdAt: nowIso
      });

      // 6. DB 완결 동기 대기 (실패 시 catch 블록에서 자동 롤백!)
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      console.error('exchangeOutboundAsset error & Rollback:', err);

      // 💥 DB 저장 실패 시 100% 스냅샷 롤백!
      if (oldSnapshot) db.updateRow('assets', oldAssetId, oldSnapshot);
      if (newSnapshot) db.updateRow('assets', newAssetId, newSnapshot);
      if (caSnapshot) db.updateRow('contractAssets', contractAssetId, caSnapshot);
      if (inspSnapshot && inspOrig) db.updateRow('outboundInspections', inspOrig.id, inspSnapshot);

      refreshAllData();

      const errorMsg = `⚠️ 출고 장비 교체 처리 중 DB 동기화 오류가 발생했습니다:\n\n■ [안내]: 저장 실패로 인해 장비 교체 작업이 안전하게 자동 롤백 원복되었습니다.\n\n${err.message || err.details || JSON.stringify(err)}`;
      showErrorModal(errorMsg, '출고 장비 교체 DB 동기화 오류');
      throw err;
    }
  };

  const exchangeAsset = (contractId: string, oldAssetId: string, newAssetId: string, exchangeDate: string) => {
    const contract = db.contracts.find(c => c.id === contractId);
    if (!contract) return;

    const caList = db.contractAssets.filter(ca => ca.contractId === contractId && ca.assetId === oldAssetId);
    const ca = caList.find(c => !c.endDate || new Date(c.endDate) >= new Date(exchangeDate));
    if (!ca) return;

    const originalEndDate = ca.endDate;
    db.updateRow<ContractAsset>('contractAssets', ca.id, { endDate: exchangeDate });

    const oldAsset = db.assets.find(a => a.id === oldAssetId);
    if (oldAsset) {
      db.updateRow<Asset>('assets', oldAssetId, {
        status: 'REPAIRING',
        currentCustomerId: undefined,
        currentSiteId: undefined,
        contractStart: undefined,
        contractEnd: undefined,
        updatedAt: new Date().toISOString()
      });
    }

    const nextDay = new Date(new Date(exchangeDate).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const newAsset = db.assets.find(a => a.id === newAssetId);
    if (newAsset) {
      db.insertRow<ContractAsset>('contractAssets', {
        contractId: contractId,
        assetId: newAssetId,
        monthlyRentalFee: ca.monthlyRentalFee,
        dailyRentalFee: ca.dailyRentalFee,
        startDate: nextDay,
        endDate: originalEndDate || contract.endDate,
        createdAt: new Date().toISOString()
      });

      db.updateRow<Asset>('assets', newAssetId, {
        status: 'RENTED',
        currentCustomerId: contract.customerId,
        currentSiteId: contract.siteId,
        contractStart: nextDay,
        contractEnd: originalEndDate || contract.endDate,
        monthlyRentalFee: ca.monthlyRentalFee,
        dailyRentalFee: ca.dailyRentalFee,
        updatedAt: new Date().toISOString()
      });
    }

    db.insertRow<Delivery>('deliveries', {
      contractId: contractId,
      type: 'EXCHANGE',
      status: 'REQUESTED',
      requestDate: exchangeDate,
      deliveryCost: 0,
      isCostSettled: false,
      memo: `장비 교체 의뢰 (구: ${oldAsset?.assetNo || '미상'} -> 신: ${newAsset?.assetNo || '미상'})`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    db.insertRow<ContractHistory>('contractHistory', {
      contractId,
      changeType: 'SHORTEN',
      changeDate: exchangeDate,
      description: `장비 교체 완료 (구: ${oldAsset?.assetNo || '미상'} -> 신: ${newAsset?.assetNo || '미상'})`,
      createdAt: new Date().toISOString()
    });

    refreshAllData();
  };

  const generateBillingsForMonth = (billingYm: string, billingDate: string) => {
    const [year, month] = billingYm.split('-').map(Number);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);

    const activeContracts = db.contracts.filter(c => {
      const contractStart = new Date(c.startDate);
      const contractEnd = c.endDate ? new Date(c.endDate) : null;
      
      if (contractStart > endOfMonth) return false;
      if (contractEnd && contractEnd < startOfMonth) return false;
      
      return true;
    });
    
    const customerContractsMap: Record<string, Contract[]> = {};
    activeContracts.forEach(c => {
      if (!customerContractsMap[c.customerId]) {
        customerContractsMap[c.customerId] = [];
      }
      customerContractsMap[c.customerId].push(c);
    });

    Object.entries(customerContractsMap).forEach(([customerId, custContracts]) => {
      const existing = db.billings.find(b => b.customerId === customerId && b.billingYm === billingYm);
      if (existing) return;

      let billingDetailsList: Omit<BillingDetail, 'id' | 'billingId' | 'createdAt'>[] = [];
      let customerTotalAmount = 0;

      custContracts.forEach(c => {
        const cAssets = db.contractAssets.filter(ca => ca.contractId === c.id);
        
        cAssets.forEach(ca => {
          const assetStart = new Date(ca.startDate);
          const rawEndDate = ca.endDate || c.endDate;
          const assetEnd = rawEndDate ? new Date(rawEndDate) : endOfMonth;
          
          const calcStart = assetStart > startOfMonth ? assetStart : startOfMonth;
          const calcEnd = assetEnd < endOfMonth ? assetEnd : endOfMonth;

          if (calcStart <= calcEnd) {
            const diffTime = Math.abs(calcEnd.getTime() - calcStart.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            
            const assetInfo = db.assets.find(a => a.id === ca.assetId);
            const assetName = assetInfo ? `${assetInfo.modelName} (관리번호: ${assetInfo.assetNo})` : '렌탈 장비';
            
            let rentalCost = 0;
            let calcDesc = '';
            
            const isFullMonth = calcStart.getDate() === 1 && calcEnd.getDate() === endOfMonth.getDate();
            if (isFullMonth) {
              rentalCost = ca.monthlyRentalFee;
              calcDesc = `${billingYm} 정기 월렌탈료`;
            } else {
              rentalCost = ca.dailyRentalFee * diffDays;
              calcDesc = `${calcStart.toISOString().split('T')[0]} ~ ${calcEnd.toISOString().split('T')[0]} 일할 청구 (${diffDays}일)`;
            }

            if (rentalCost > 0) {
              billingDetailsList.push({
                contractAssetId: ca.id,
                itemName: `${assetName} 렌탈료`,
                quantity: 1,
                unitPrice: rentalCost,
                amount: rentalCost,
                description: calcDesc
              });
              customerTotalAmount += rentalCost;

              if (assetInfo) {
                db.updateRow<Asset>('assets', assetInfo.id, {
                  cumRentalFee: (assetInfo.cumRentalFee || 0) + rentalCost,
                  updatedAt: new Date().toISOString()
                });
              }
            }
          }
        });
      });

      const customerAssets = db.assets.filter(a => a.currentCustomerId === customerId);
      customerAssets.forEach(asset => {
        const repairList = db.repairs.filter(r => 
          r.assetId === asset.id && 
          r.status === 'COMPLETED' && 
          r.billableToCustomer && 
          !r.billingId &&
          r.repairDate && 
          new Date(r.repairDate) >= startOfMonth && 
          new Date(r.repairDate) <= endOfMonth
        );

        repairList.forEach(repair => {
          billingDetailsList.push({
            itemName: `${asset.modelName} (관리번호: ${asset.assetNo}) 수리 비용 청구`,
            quantity: 1,
            unitPrice: repair.totalCost,
            amount: repair.totalCost,
            description: `정비 완료 건 청구 연동 (${repair.repairDate}) - ${repair.details}`
          });
          customerTotalAmount += repair.totalCost;
        });
      });

      if (billingDetailsList.length > 0) {
        const billing = db.insertRow<Billing>('billings', {
          customerId,
          billingYm,
          billingDate,
          totalAmount: customerTotalAmount,
          paidAmount: 0,
          status: 'REQUESTED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        billingDetailsList.forEach(detail => {
          db.insertRow<BillingDetail>('billingDetails', {
            ...detail,
            billingId: billing.id,
            createdAt: new Date().toISOString()
          });
        });

        customerAssets.forEach(asset => {
          const repairList = db.repairs.filter(r => 
            r.assetId === asset.id && 
            r.status === 'COMPLETED' && 
            r.billableToCustomer && 
            !r.billingId && 
            r.repairDate && 
            new Date(r.repairDate) >= startOfMonth && 
            new Date(r.repairDate) <= endOfMonth
          );
          repairList.forEach(repair => {
            db.updateRow<Repair>('repairs', repair.id, { billingId: billing.id });
          });
        });
      }
    });

    refreshAllData();
  };

  const approveBilling = (billingId: string) => {
    db.updateRow<Billing>('billings', billingId, { status: 'UNPAID' });
    refreshAllData();
  };

  const cancelBilling = (billingId: string) => {
    const billing = db.billings.find(b => b.id === billingId);
    if (!billing) return;

    const details = db.billingDetails.filter(bd => bd.billingId === billingId);

    details.forEach(bd => {
      if (bd.itemName === '선수금(예치금) 차감 반영') {
        const customer = db.customers.find(c => c.id === billing.customerId);
        if (customer) {
          db.updateRow<Customer>('customers', customer.id, {
            prepaidBalance: (customer.prepaidBalance || 0) + Math.abs(bd.amount),
            updatedAt: new Date().toISOString()
          } as any);
        }
      }
      if (bd.contractAssetId) {
        const ca = db.contractAssets.find(x => x.id === bd.contractAssetId);
        if (ca) {
          const assetInfo = db.assets.find(a => a.id === ca.assetId);
          if (assetInfo) {
            db.updateRow<Asset>('assets', assetInfo.id, {
              cumRentalFee: Math.max(0, (assetInfo.cumRentalFee || 0) - bd.amount),
              updatedAt: new Date().toISOString()
            });
          }
        }
      }
    });

    details.forEach(bd => {
      db.deleteRow('billingDetails', bd.id);
    });

    db.deleteRow('billings', billingId);

    refreshAllData();
  };

  const receivePayment = (billingId: string, data: { paymentDate: string; amount: number; method: string; memo: string }) => {
    const billing = db.billings.find(b => b.id === billingId);
    if (!billing) return;

    db.insertRow<Payment>('payments', {
      billingId,
      paymentDate: data.paymentDate,
      amount: data.amount,
      method: data.method,
      memo: data.memo,
      createdAt: new Date().toISOString()
    });

    const nextPaid = billing.paidAmount + data.amount;
    let nextStatus: Billing['status'] = 'UNPAID';
    if (nextPaid >= billing.totalAmount) {
      nextStatus = 'PAID';
    } else if (nextPaid > 0) {
      nextStatus = 'PARTIAL';
    }

    db.updateRow<Billing>('billings', billingId, {
      paidAmount: nextPaid,
      status: nextStatus,
      updatedAt: new Date().toISOString()
    });

    refreshAllData();
  };

  const executeMatch = (txId: string, billingId: string, matchingType: 'AUTO' | 'MANUAL') => {
    const tx = db.bankTransactions.find(t => t.id === txId);
    const firstBilling = db.billings.find(b => b.id === billingId);
    if (!tx || !firstBilling) return;

    const customerId = firstBilling.customerId;
    let remainingDeposit = tx.depositAmount;

    // 해당 고객사의 미납/일부납 상태 청구서를 오래된 순서(billingYm)로 조회
    const activeBillings = db.billings
      .filter(b => b.customerId === customerId && (b.status === 'UNPAID' || b.status === 'PARTIAL'))
      .sort((a, b) => a.billingYm.localeCompare(b.billingYm));

    // 혹시라도 정렬 목록에 타겟 청구서가 포함되지 않았을 경우 추가 예외 조치
    if (!activeBillings.some(x => x.id === billingId)) {
      activeBillings.unshift(firstBilling);
    }

    const matchedBillingIds: string[] = [];

    // 1. 청구서에 금액 순차 Cascade 배분
    for (const billing of activeBillings) {
      if (remainingDeposit <= 0) break;

      const unpaidAmount = billing.totalAmount - billing.paidAmount;
      if (unpaidAmount <= 0) continue;

      const paymentAmount = Math.min(unpaidAmount, remainingDeposit);
      remainingDeposit -= paymentAmount;

      // 수납 분할 전표 등록
      const payId = `pay-matching-${txId}-${billing.id}`;
      db.insertRow<Payment>('payments', {
        id: payId,
        billingId: billing.id,
        paymentDate: tx.transactionDate.split(' ')[0],
        amount: paymentAmount,
        method: 'BANK_TRANSFER',
        memo: `${matchingType === 'AUTO' ? '자동' : '수동'} 분할 대조 수납 (${tx.senderName})`,
        createdAt: new Date().toISOString()
      });

      // 청구서 납부금액 및 상태 업데이트
      const nextPaid = billing.paidAmount + paymentAmount;
      const nextStatus: Billing['status'] = nextPaid >= billing.totalAmount ? 'PAID' : 'PARTIAL';
      db.updateRow<Billing>('billings', billing.id, {
        paidAmount: nextPaid,
        status: nextStatus,
        updatedAt: new Date().toISOString()
      });

      matchedBillingIds.push(billing.id);
    }

    // 2. 남은 초과금 선수금 적립
    if (remainingDeposit > 0) {
      const customer = db.customers.find(c => c.id === customerId);
      if (customer) {
        const prevPrepaid = customer.prepaidBalance || 0;
        db.updateRow<Customer>('customers', customerId, {
          prepaidBalance: prevPrepaid + remainingDeposit,
          updatedAt: new Date().toISOString()
        } as any);

        // 선수금 가상 수납 전표 등록
        db.insertRow<Payment>('payments', {
          id: `pay-matching-${txId}-prepaid`,
          billingId: '',
          paymentDate: tx.transactionDate.split(' ')[0],
          amount: remainingDeposit,
          method: 'BANK_TRANSFER',
          memo: `통장 대조 매칭 초과 선수금 적립 (${tx.senderName})`,
          createdAt: new Date().toISOString()
        });
      }
    }

    // 3. 거래 내역 상태 변경
    db.updateRow<BankTransaction>('bankTransactions', txId, {
      matchedBillingId: matchedBillingIds.length > 0 ? matchedBillingIds[0] : billingId,
      matchingType,
      updatedAt: new Date().toISOString()
    } as any);
  };

  const tryAutoMatchForTransaction = (tx: BankTransaction) => {
    const rule = db.bankMatchingRules.find(r => r.senderName === tx.senderName);
    if (rule) {
      const activeBillings = db.billings.filter(b => 
        b.customerId === rule.customerId && 
        (b.status === 'UNPAID' || b.status === 'PARTIAL')
      );
      if (activeBillings.length > 0) {
        let target = activeBillings.find(b => (b.totalAmount - b.paidAmount) === tx.depositAmount);
        if (!target) {
          target = activeBillings.sort((a, b) => a.billingYm.localeCompare(b.billingYm))[0];
        }
        executeMatch(tx.id, target.id, 'AUTO');
        return;
      }
    }

    const matchedCustomer = db.customers.find(c => 
      tx.senderName.includes(c.name) || c.name.includes(tx.senderName)
    );
    if (matchedCustomer) {
      const activeBillings = db.billings.filter(b => 
        b.customerId === matchedCustomer.id && 
        (b.status === 'UNPAID' || b.status === 'PARTIAL')
      );
      if (activeBillings.length > 0) {
        let target = activeBillings.find(b => (b.totalAmount - b.paidAmount) === tx.depositAmount);
        if (!target) {
          target = activeBillings.sort((a, b) => a.billingYm.localeCompare(b.billingYm))[0];
        }
        executeMatch(tx.id, target.id, 'AUTO');
        return;
      }
    }
  };

  const uploadBankTransactions = (txs: Omit<BankTransaction, 'id' | 'createdAt'>[]) => {
    txs.forEach(tx => {
      const newTx = db.insertRow<BankTransaction>('bankTransactions', {
        ...tx,
        matchedBillingId: undefined,
        matchingType: undefined,
        createdAt: new Date().toISOString()
      } as any);

      if (newTx.depositAmount > 0) {
        tryAutoMatchForTransaction(newTx);
      }
    });
    refreshAllData();
  };

  const matchTransactionManual = (txId: string, billingId: string, learnRule: boolean) => {
    const tx = db.bankTransactions.find(t => t.id === txId);
    const billing = db.billings.find(b => b.id === billingId);
    if (!tx || !billing) return;

    executeMatch(txId, billingId, 'MANUAL');

    if (learnRule) {
      const exists = db.bankMatchingRules.some(r => r.senderName === tx.senderName);
      if (!exists) {
        db.insertRow<BankMatchingRule>('bankMatchingRules', {
          senderName: tx.senderName,
          customerId: billing.customerId,
          createdAt: new Date().toISOString()
        });
      }
    }
    refreshAllData();
  };

  const unmatchTransaction = (txId: string) => {
    const tx = db.bankTransactions.find(t => t.id === txId);
    if (!tx || !tx.matchedBillingId) return;

    // 해당 거래 ID 패턴으로 등록되었던 모든 수납 전표 검색
    const matchPrefix = `pay-matching-${txId}`;
    const associatedPayments = db.payments.filter(p => p.id.startsWith(matchPrefix));

    // 대표 청구서를 찾아 customerId 획득
    const repBilling = db.billings.find(b => b.id === tx.matchedBillingId);
    const customerId = repBilling?.customerId;

    associatedPayments.forEach(pay => {
      if (pay.billingId) {
        // 청구서 수납 잔액 롤백
        const billing = db.billings.find(b => b.id === pay.billingId);
        if (billing) {
          const nextPaid = Math.max(0, billing.paidAmount - pay.amount);
          const nextStatus: Billing['status'] = nextPaid === 0 ? 'UNPAID' : (nextPaid >= billing.totalAmount ? 'PAID' : 'PARTIAL');
          db.updateRow<Billing>('billings', billing.id, {
            paidAmount: nextPaid,
            status: nextStatus,
            updatedAt: new Date().toISOString()
          });
        }
      } else if (customerId) {
        // 선수금 적립 롤백
        const customer = db.customers.find(c => c.id === customerId);
        if (customer) {
          db.updateRow<Customer>('customers', customerId, {
            prepaidBalance: Math.max(0, (customer.prepaidBalance || 0) - pay.amount),
            updatedAt: new Date().toISOString()
          } as any);
        }
      }

      db.deleteRow('payments', pay.id);
    });

    // 거래 정보 복구
    db.updateRow<BankTransaction>('bankTransactions', txId, {
      matchedBillingId: '',
      matchingType: undefined,
      updatedAt: new Date().toISOString()
    } as any);

    refreshAllData();
  };

  const saveMatchingRule = (senderName: string, customerId: string) => {
    const existing = db.bankMatchingRules.find(r => r.senderName.toLowerCase() === senderName.toLowerCase());
    if (existing) {
      db.updateRow<BankMatchingRule>('bankMatchingRules', existing.id, {
        customerId,
        updatedAt: new Date().toISOString()
      } as any);
    } else {
      db.insertRow<BankMatchingRule>('bankMatchingRules', {
        senderName,
        customerId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as any);
    }
    refreshAllData();
  };

  const deleteMatchingRule = (ruleId: string) => {
    db.deleteRow('bankMatchingRules', ruleId);
    refreshAllData();
  };

  const dispatchDelivery = (
    deliveryId: string, 
    dispatchData: { 
      scheduledDate: string; 
      transportCompany: string; 
      vehicleType: string; 
      vehicleNo: string; 
      driverName: string; 
      driverContact: string; 
      deliveryCost: number; 
      vehiclesJson?: string;
    }
  ) => {
    db.updateRow<Delivery>('deliveries', deliveryId, {
      scheduledDate: dispatchData.scheduledDate,
      transportCompany: dispatchData.transportCompany,
      vehicleType: dispatchData.vehicleType,
      vehicleNo: dispatchData.vehicleNo,
      driverName: dispatchData.driverName,
      driverContact: dispatchData.driverContact,
      deliveryCost: dispatchData.deliveryCost,
      vehicles: dispatchData.vehiclesJson,
      status: 'DISPATCHED',
      updatedAt: new Date().toISOString()
    });
    refreshAllData();
  };

  const settleDeliveryCost = (deliveryId: string, deliveryCostConfirmed: number, vehiclesJson?: string) => {
    db.updateRow<Delivery>('deliveries', deliveryId, {
      isCostSettled: true,
      deliveryCostConfirmed,
      vehicles: vehiclesJson,
      updatedAt: new Date().toISOString()
    });
    refreshAllData();
  };

  const completeDelivery = (deliveryId: string) => {
    const delivery = db.deliveries.find(d => d.id === deliveryId);
    if (!delivery) return;

    db.updateRow<Delivery>('deliveries', deliveryId, {
      status: 'COMPLETED',
      updatedAt: new Date().toISOString()
    });

    const contract = delivery.contractId ? db.contracts.find(c => c.id === delivery.contractId) : null;
    const customer = contract ? db.customers.find(c => c.id === contract.customerId) : null;
    const site = contract ? db.sites.find(s => s.id === contract.siteId) : null;

    // INBOUND (회수) 완료 시 장비를 대기중(AVAILABLE)으로 복원 및 계약 완료 처리
    if (delivery.type === 'INBOUND' && delivery.contractId) {
      const cAssets = db.contractAssets.filter(ca => ca.contractId === delivery.contractId);
      cAssets.forEach(ca => {
        if (ca.assetId) {
          const asset = db.assets.find(a => a.id === ca.assetId);
          db.updateRow<Asset>('assets', ca.assetId, {
            status: 'AVAILABLE',
            currentCustomerId: '',
            currentSiteId: '',
            contractStart: '',
            contractEnd: '',
            monthlyRentalFee: 0,
            dailyRentalFee: 0,
            updatedAt: new Date().toISOString()
          });

          if (asset) {
            // 입고 이력 추가 (기본 점수 0, 특이사항 없음)
            db.insertRow<AssetInOutLog>('assetInOutLogs', {
              assetId: asset.id,
              assetNo: asset.assetNo,
              modelName: asset.modelName,
              type: 'INBOUND',
              eventDate: new Date().toISOString().split('T')[0],
              customerId: contract?.customerId,
              customerName: customer?.name || '',
              siteId: contract?.siteId,
              siteName: site?.name || '',
              deliveryId: deliveryId,
              maintenanceScore: asset.maintenanceScore || 0,
              memo: '일반 배차 반납 입고',
              createdAt: new Date().toISOString()
            });
          }
        }
      });

      db.updateRow<Contract>('contracts', delivery.contractId, {
        status: 'COMPLETED',
        updatedAt: new Date().toISOString()
      });
    }

    // OUTBOUND (출고) 완료 시 계약 활성화 및 출고 이력 생성
    if (delivery.type === 'OUTBOUND' && delivery.contractId) {
      if (contract && contract.status !== 'COMPLETED') {
        db.updateRow<Contract>('contracts', delivery.contractId, {
          status: 'ACTIVE',
          updatedAt: new Date().toISOString()
        });

        // OUTBOUND 로그 추가
        const cAssets = db.contractAssets.filter(ca => ca.contractId === delivery.contractId);
        cAssets.forEach(ca => {
          if (ca.assetId) {
            const asset = db.assets.find(a => a.id === ca.assetId);
            if (asset) {
              db.insertRow<AssetInOutLog>('assetInOutLogs', {
                assetId: asset.id,
                assetNo: asset.assetNo,
                modelName: asset.modelName,
                type: 'OUTBOUND',
                eventDate: delivery.scheduledDate || new Date().toISOString().split('T')[0],
                customerId: contract.customerId,
                customerName: customer?.name || '',
                siteId: contract.siteId,
                siteName: site?.name || '',
                deliveryId: deliveryId,
                createdAt: new Date().toISOString()
              });
            }
          }
        });
      }
    }

    refreshAllData();
  };

  const completeInboundDelivery = (
    deliveryId: string,
    actualReturnDate: string,
    reviews: { assetId: string; status: 'AVAILABLE' | 'REPAIRING'; maintenanceScore: number; memo: string; faultImageUrl?: string }[]
  ) => {
    const delivery = db.deliveries.find(d => d.id === deliveryId);
    if (!delivery) return;

    db.updateRow<Delivery>('deliveries', deliveryId, {
      status: 'COMPLETED',
      updatedAt: new Date().toISOString()
    });

    const contract = delivery.contractId ? db.contracts.find(c => c.id === delivery.contractId) : null;
    const customer = contract ? db.customers.find(c => c.id === contract.customerId) : null;
    const site = contract ? db.sites.find(s => s.id === contract.siteId) : null;

    reviews.forEach(review => {
      const asset = db.assets.find(a => a.id === review.assetId);
      if (!asset) return;

      db.updateRow<Asset>('assets', review.assetId, {
        status: review.status,
        maintenanceScore: review.maintenanceScore,
        currentCustomerId: '',
        currentSiteId: '',
        contractStart: '',
        contractEnd: '',
        updatedAt: new Date().toISOString()
      });

      db.insertRow<AssetInOutLog>('assetInOutLogs', {
        assetId: asset.id,
        assetNo: asset.assetNo,
        modelName: asset.modelName,
        type: 'INBOUND',
        eventDate: actualReturnDate,
        customerId: contract?.customerId || '',
        customerName: customer?.name || '',
        siteId: contract?.siteId || '',
        siteName: site?.name || '',
        deliveryId: deliveryId,
        maintenanceScore: review.maintenanceScore,
        memo: review.memo,
        createdAt: new Date().toISOString()
      });

      if (review.status === 'REPAIRING') {
        db.insertRow<Repair>('repairs', {
          assetId: asset.id,
          details: `스마트 입고 검수 시 등록됨: ${review.memo}`,
          status: 'PENDING',
          requestDate: actualReturnDate,
          totalCost: 0,
          billableToCustomer: false,
          isCustomerFault: true,
          faultImageUrl: review.faultImageUrl || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    });

    if (delivery.contractId) {
      db.updateRow<Contract>('contracts', delivery.contractId, {
        status: 'COMPLETED',
        updatedAt: new Date().toISOString()
      });
    }

    refreshAllData();
  };

  const registerRepair = (repairData: Partial<Repair>, usedConsumables: { consumableId: string; quantity: number }[]) => {
    const repairId = repairData.id || db.generateNextId('repairs', db.repairs);
    const totalRepairCost = repairData.totalCost ?? 0;

    if (repairData.id) {
      db.updateRow<Repair>('repairs', repairData.id, {
        ...repairData,
        status: repairData.status || 'COMPLETED',
        updatedAt: new Date().toISOString()
      });
    } else {
      db.insertRow<Repair>('repairs', {
        id: repairId,
        assetId: repairData.assetId || '',
        mechanicId: currentUser?.id || 'u-4',
        requestDate: repairData.requestDate || new Date().toISOString().split('T')[0],
        repairDate: repairData.repairDate || new Date().toISOString().split('T')[0],
        status: repairData.status || 'COMPLETED',
        details: repairData.details || '',
        totalCost: totalRepairCost,
        billableToCustomer: repairData.billableToCustomer || false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    usedConsumables.forEach(uc => {
      const consumable = db.consumables.find(c => c.id === uc.consumableId);
      if (consumable && consumable.stockQty >= uc.quantity) {
        db.updateRow<Consumable>('consumables', consumable.id, {
          stockQty: consumable.stockQty - uc.quantity,
          updatedAt: new Date().toISOString()
        });

        db.insertRow<ConsumableLog>('consumableLogs', {
          consumableId: consumable.id,
          type: 'OUTBOUND',
          quantity: uc.quantity,
          unitPrice: consumable.unitPrice,
          targetAssetId: repairData.assetId,
          userId: currentUser?.id,
          actionDate: repairData.repairDate || new Date().toISOString().split('T')[0],
          description: `정비수리(번호: ${repairId}) 소모품 사용`,
          createdAt: new Date().toISOString()
        });

        db.insertRow<RepairConsumable>('repairConsumables', {
          repairId,
          consumableId: uc.consumableId,
          quantity: uc.quantity,
          unitPrice: consumable.unitPrice,
          cost: consumable.unitPrice * uc.quantity
        });
      }
    });

    const asset = db.assets.find(a => a.id === repairData.assetId);
    if (asset) {
      const nextStatus = repairData.status === 'COMPLETED' ? 'AVAILABLE' : 'REPAIRING';
      db.updateRow<Asset>('assets', asset.id, {
        status: nextStatus,
        maintenanceScore: repairData.status === 'COMPLETED' ? 0 : asset.maintenanceScore,
        cumRepairCost: (asset.cumRepairCost || 0) + totalRepairCost,
        updatedAt: new Date().toISOString()
      });

      // 정비 완료 시 정비 이력 로그 추가
      if (repairData.status === 'COMPLETED') {
        db.insertRow<AssetInOutLog>('assetInOutLogs', {
          assetId: asset.id,
          assetNo: asset.assetNo,
          modelName: asset.modelName,
          type: 'REPAIR',
          eventDate: repairData.repairDate || new Date().toISOString().split('T')[0],
          repairId: repairId,
          maintenanceScore: 0,
          memo: `정비 완료: ${repairData.details || ''}`,
          createdAt: new Date().toISOString()
        });
      }
    }

    refreshAllData();
  };

  const saveTransportDataOnFly = (companyName: string, driverName: string, contact: string, vehicleNo: string, vehicleType: string) => {
    if (!companyName && !driverName) return;

    let companyId = '';
    
    // 1. 운송업체 처리
    if (companyName) {
      const existingCompany = db.transportCompanies.find(c => c.name === companyName);
      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        const newCompany = db.insertRow<TransportCompany>('transportCompanies', {
          name: companyName,
          businessNo: '',
          contact: contact || '',
          memo: '자동 추가됨',
          createdAt: new Date().toISOString()
        });
        companyId = newCompany.id;
      }
    }

    // 2. 기사 처리
    if (driverName) {
      const existingDriver = db.transportDrivers.find(d => 
        d.driverName === driverName && (companyId ? d.companyId === companyId : true)
      );
      if (!existingDriver) {
        db.insertRow<TransportDriver>('transportDrivers', {
          companyId: companyId,
          driverName: driverName,
          driverContact: contact || '',
          vehicleNo: vehicleNo || '',
          vehicleType: vehicleType || '',
          createdAt: new Date().toISOString()
        });
      }
    }
    
    refreshAllData();
  };

  const saveCashFlowSnapshot = (snap: Omit<CashFlowSnapshot, 'id' | 'createdAt'>) => {
    db.insertRow<CashFlowSnapshot>('cashFlowSnapshots', {
      ...snap,
      createdAt: new Date().toISOString()
    });
    refreshAllData();
  };

  const deleteCashFlowSnapshot = (snapId: string) => {
    db.deleteRow('cashFlowSnapshots', snapId);
    refreshAllData();
  };

  const saveVendor = async (vendor: Vendor): Promise<void> => {
    try {
      const existing = db.vendors.find(v => v.id === vendor.id);
      if (existing) {
        db.updateRow('vendors', vendor.id, vendor);
      } else {
        db.insertRow('vendors', vendor);
      }
      // Supabase 비동기 쓰기 큐 완료 대기 및 에러 전파
      if (db.pendingWrites.length > 0) {
        await db.awaitPendingWrites();
      }
      refreshAllData();
    } catch (err: any) {
      console.error('saveVendor error:', err);
      throw err;
    }
  };

  const deleteVendor = (id: string) => {
    db.deleteRow('vendors', id);
    refreshAllData();
  };

  // 월 1회 당사자산 감가상각 결산 마감 실행 (월말 의도적 실행)
  const executeMonthlyDepreciation = async (depreciationYm: string, note?: string) => {
    const existing = db.depreciationLogs.find(l => l.depreciationYm === depreciationYm);
    if (existing) {
      throw new Error(`이미 [${depreciationYm}] 연월의 감가상각 결산 마감이 완료되었습니다. (마감 처리일시: ${existing.executedAt.substring(0, 10)})`);
    }

    const ownedAssets = db.assets.filter(a => a.ownerType === 'OWNED');
    let totalDepnSum = 0;
    let updatedCount = 0;
    const nowIso = new Date().toISOString();

    for (const asset of ownedAssets) {
      const cost = asset.acquisitionPrice || 0;
      if (cost <= 0 || !asset.acquisitionDate || !asset.depreciationMonths || asset.depreciationMonths <= 0) {
        continue;
      }

      const residualRate = asset.residualValueRate ?? 0;
      const residualValue = Math.round(cost * (residualRate / 100));
      const depreciableAmount = cost - residualValue;
      if (depreciableAmount <= 0) continue;

      const monthlyDepn = Math.round(depreciableAmount / asset.depreciationMonths);
      if (monthlyDepn <= 0) continue;

      const currentAccum = asset.accumDepreciation || 0;
      const maxAccum = depreciableAmount;

      if (currentAccum >= maxAccum) continue;

      const actualDepn = Math.min(monthlyDepn, maxAccum - currentAccum);
      const newAccum = currentAccum + actualDepn;
      const newBookValue = Math.max(residualValue, cost - newAccum);

      db.updateRow<Asset>('assets', asset.id, {
        accumDepreciation: newAccum,
        bookValue: newBookValue,
        updatedAt: nowIso
      });

      totalDepnSum += actualDepn;
      updatedCount++;
    }

    db.insertRow<DepreciationLog>('depreciationLogs', {
      depreciationYm,
      executedAt: nowIso,
      executedBy: currentUser?.name || currentUser?.id,
      targetAssetCount: updatedCount,
      totalDepreciationAmount: totalDepnSum,
      note: note || `[${depreciationYm}] 월말 당사자산 감가상각 결산 마감 완료`,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    try {
      await db.awaitPendingWrites();
    } catch (err: any) {
      console.error('executeMonthlyDepreciation sync error:', err);
    }

    refreshAllData();
    return { count: updatedCount, totalAmount: totalDepnSum };
  };

  return (
    <AppContext.Provider value={{
      currentUser, theme, toggleTheme, login, logout, hasPermission, showErrorModal,
      users, permissions, customers, contacts, sites, products, assets, consumables, consumableLogs, consumablePurchases, contracts, contractAssets, contractHistory, deliveries, billings, billingDetails, payments, repairs, repairConsumables, transportCompanies, transportDrivers, todos,
      bankTransactions, bankMatchingRules, assetInOutLogs, vendors, googleConfigs, cashFlowSnapshots, outboundInspections, depreciationLogs,
      refreshAllData, executeMonthlyDepreciation, loadTablesForMenu, updatePermissions, saveUser, saveCustomer, saveContact, saveSite, saveProduct, saveAsset, updateGoogleConfig,
      saveCashFlowSnapshot, deleteCashFlowSnapshot, saveVendor, deleteVendor,
      acquireAsset, disposeAsset, registerRentedAsset, returnRentedAsset, changeAssetStatus,
      purchaseConsumable, useConsumable,
      requestConsumablePurchase, acceptConsumablePurchase, completeConsumablePurchase, inboundConsumablePurchase,
      createContract, extendContract, shortenContract, succeedContract, exchangeAsset,
      assignAssetToContract, exchangeOutboundAsset,
      saveSmartDispatch, saveSmartReturn,
      completeTodo,
      generateBillingsForMonth, approveBilling, cancelBilling, receivePayment,
      uploadBankTransactions, matchTransactionManual, unmatchTransaction, saveMatchingRule, deleteMatchingRule,
      dispatchDelivery, settleDeliveryCost, completeDelivery, completeInboundDelivery,
      registerRepair,
      saveTransportDataOnFly,
      activeTab,
      setActiveTab,
      navigationPayload,
      setNavigationPayload
    }}>
      {children}
      <ErrorModal
        isOpen={errorModal.isOpen}
        title={errorModal.title}
        message={errorModal.message}
        onClose={() => setErrorModal(prev => ({ ...prev, isOpen: false }))}
      />
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
