// d:\Kiyeun_Lift\src\context\AppContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, User, MenuPermission, Customer, CustomerContact, CustomerSite, Product, Asset, Consumable, ConsumableLog, ConsumablePurchaseRequest, Contract, ContractAsset, ContractHistory, Billing, BillingDetail, Payment, Delivery, TransportCompany, TransportDriver, Repair, RepairConsumable, Todo, BankTransaction, BankMatchingRule, AssetInOutLog, Vendor, GoogleConfig, CashFlowSnapshot } from '../services/db';

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

  // Mutators
  refreshAllData: () => void;
  updatePermissions: (updated: MenuPermission[]) => void;
  saveUser: (user: Omit<User, 'id' | 'createdAt'> & { id?: string }) => void;
  saveCustomer: (cust: Omit<Customer, 'id' | 'createdAt'> & { id?: string }) => Customer;
  saveContact: (contact: Omit<CustomerContact, 'id' | 'createdAt'> & { id?: string }) => void;
  saveSite: (site: Omit<CustomerSite, 'id' | 'createdAt'> & { id?: string }) => void;
  saveProduct: (prod: Omit<Product, 'id' | 'createdAt'> & { id?: string }) => void;
  saveAsset: (asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  updateGoogleConfig: (config: GoogleConfig) => void;
  saveCashFlowSnapshot: (snap: Omit<CashFlowSnapshot, 'id' | 'createdAt'>) => void;
  deleteCashFlowSnapshot: (snapId: string) => void;
  
  // Asset Mutators
  acquireAsset: (assetData: Partial<Asset>) => void;
  disposeAsset: (assetId: string, disposalData: { disposalDate: string; disposalPrice: number; buyer: string }) => void;
  registerRentedAsset: (assetData: Partial<Asset>) => void;
  returnRentedAsset: (assetId: string, returnDate: string) => void;
  
  // Consumables Mutators
  purchaseConsumable: (data: { modelName: string; qty: number; unit: string; unitPrice: number; supplier: string }) => void;
  useConsumable: (data: { consumableId: string; quantity: number; targetAssetId: string; description: string }) => void;
  requestConsumablePurchase: (data: { consumableId?: string; modelName: string; qty: number; unitPrice: number; requestDate: string; sellerName: string }) => void;
  acceptConsumablePurchase: (id: string) => void;
  completeConsumablePurchase: (id: string) => void;
  inboundConsumablePurchase: (id: string, qty: number, statementFileUrl: string) => void;
  
  // Contract Mutators
  createContract: (contractData: Omit<Contract, 'id' | 'createdAt' | 'updatedAt' | 'contractNo'>, assetsList: { assetId?: string; expectedModel?: string; monthlyRentalFee: number; dailyRentalFee: number }[]) => void;
  extendContract: (contractId: string, newEndDate: string, description: string) => void;
  shortenContract: (contractId: string, newEndDate: string, description: string) => void;
  succeedContract: (contractId: string, successorCustomerId: string, successorContactId: string, successorSiteId: string, successionDate: string, description: string) => void;
  exchangeAsset: (contractId: string, oldAssetId: string, newAssetId: string, exchangeDate: string) => void;
  
  // 장비 할당
  assignAssetToContract: (contractAssetId: string, assetId: string) => void;
  saveSmartDispatch: (data: SmartDispatchData, autoRegister: boolean) => Promise<{ success: boolean; requiresConfirm?: boolean; missingFields?: string[]; errorMessage?: string }>;
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

  // Navigation / Routing states
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [navigationPayload, setNavigationPayload] = useState<any>(null);

  const refreshAllData = async () => {
    if (db.isSupabaseConnected()) {
      try {
        await db.pullFromSupabase();
      } catch (err) {
        console.error("Failed to sync from Supabase:", err);
      }
    }
    setUsers(db.users);
    setPermissions(db.permissions);
    setCustomers(db.customers);
    setContacts(db.contacts);
    setSites(db.sites);
    setProducts(db.products);
    setAssets(db.assets);
    setConsumables(db.consumables);
    setConsumableLogs(db.consumableLogs);
    setConsumablePurchases(db.consumablePurchases);
    setContracts(db.contracts);
    setContractAssets(db.contractAssets);
    setContractHistory(db.contractHistory);
    setDeliveries(db.deliveries);
    setTransportCompanies(db.transportCompanies);
    setTransportDrivers(db.transportDrivers);
    setBillings(db.billings);
    setBillingDetails(db.billingDetails);
    setPayments(db.payments);
    setRepairs(db.repairs);
    setRepairConsumables(db.repairConsumables);
    setTodos(db.todos);
    setBankTransactions(db.bankTransactions);
    setBankMatchingRules(db.bankMatchingRules);
    setAssetInOutLogs(db.assetInOutLogs);
    setVendors(db.vendors);
    setGoogleConfigs(db.googleConfigs);
    setCashFlowSnapshots(db.cashFlowSnapshots);
  };

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
    
    refreshAllData();
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
    if (currentUser.role === 'ADMIN') return true;
    const perm = permissions.find(p => p.userId === currentUser.id && p.menuId === menuId);
    if (!perm) return false;
    return action === 'view' ? perm.canView : perm.canSave;
  };

  const updatePermissions = (updated: MenuPermission[]) => {
    db.permissions = updated;
    refreshAllData();
  };

  const updateGoogleConfig = (configData: GoogleConfig) => {
    const exists = db.googleConfigs.some(cfg => cfg.id === configData.id);
    if (exists) {
      db.updateRow<GoogleConfig>('googleConfigs', configData.id, configData);
    } else {
      db.insertRow<GoogleConfig>('googleConfigs', configData);
    }
    refreshAllData();
  };

  const saveUser = (userData: Omit<User, 'id' | 'createdAt'> & { id?: string }) => {
    if (userData.id) {
      db.updateRow<User>('users', userData.id, userData);
    } else {
      db.insertRow<User>('users', { ...userData, createdAt: new Date().toISOString() });
    }
    refreshAllData();
  };

  const saveCustomer = (cust: Omit<Customer, 'id' | 'createdAt'> & { id?: string }): Customer => {
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
    refreshAllData();
    return res;
  };

  const saveContact = (contact: Omit<CustomerContact, 'id' | 'createdAt'> & { id?: string }) => {
    if (contact.id) {
      db.updateRow<CustomerContact>('contacts', contact.id, contact as CustomerContact);
    } else {
      db.insertRow<CustomerContact>('contacts', {
        ...contact,
        isActive: contact.isActive !== undefined ? contact.isActive : true,
        createdAt: new Date().toISOString()
      } as Omit<CustomerContact, 'id'>);
    }
    refreshAllData();
  };

  const saveSite = (site: Omit<CustomerSite, 'id' | 'createdAt'> & { id?: string }) => {
    if (site.id) {
      db.updateRow<CustomerSite>('sites', site.id, site as CustomerSite);
    } else {
      db.insertRow<CustomerSite>('sites', {
        ...site,
        isActive: site.isActive !== undefined ? site.isActive : true,
        createdAt: new Date().toISOString()
      } as Omit<CustomerSite, 'id'>);
    }
    refreshAllData();
  };

  const saveProduct = (prod: Omit<Product, 'id' | 'createdAt'> & { id?: string }) => {
    if (prod.id) {
      db.updateRow<Product>('products', prod.id, prod as Product);
    } else {
      db.insertRow<Product>('products', {
        ...prod,
        isActive: prod.isActive !== undefined ? prod.isActive : true,
        createdAt: new Date().toISOString()
      } as Omit<Product, 'id'>);
    }
    refreshAllData();
  };

  const saveAsset = (asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    if (asset.id) {
      db.updateRow<Asset>('assets', asset.id, asset as Asset);
    } else {
      db.insertRow<Asset>('assets', {
        ...asset,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as Omit<Asset, 'id'>);
    }
    refreshAllData();
  };

  const saveSmartDispatch = async (data: SmartDispatchData, autoRegister: boolean) => {
    let customer = db.customers.find(c => c.name.replace(/\s/g, '') === data.customerName.replace(/\s/g, ''));
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
      // 기존 고객사가 존재하는 경우에도, 새로운 고객담당자(처음 등장하는 사람)라면 자동 등록!
      if (data.siteContactName) {
        const targetCustomerId = customer.id;
        const existingContact = db.contacts.find(ct => ct.customerId === targetCustomerId && ct.name.replace(/\s/g, '') === data.siteContactName.replace(/\s/g, ''));
        if (!existingContact) {
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
      site = db.insertRow<CustomerSite>('sites', {
        customerId: finalCustomer.id,
        name: data.siteName,
        address: data.siteAddress || '미상',
        contactName: data.siteContactName || '미상',
        contact: data.siteContactPhone || '미상',
        email: data.siteContactEmail || '미상',
        createdAt: new Date().toISOString()
      });
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

    const contract = db.insertRow<Contract>('contracts', {
      contractNo: `S-CTR-${Date.now()}`,
      customerId: finalCustomer.id,
      siteId: finalSite.id,
      startDate: new Date().toISOString().split('T')[0],
      endDate: '', 
      billingDay: 30,
      salespersonId: currentUser?.id,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

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

    // 신규 배차(Delivery) - 출고 대기 건 자동 생성
    db.insertRow<Delivery>('deliveries', {
      contractId: contract.id,
      type: 'OUTBOUND',
      status: 'REQUESTED',
      requestDate: contract.startDate,
      scheduledDate: data.loadingTime || contract.startDate,
      transportCompany: '',
      vehicleType: '',
      vehicleNo: '',
      driverName: '',
      driverContact: '',
      deliveryCost: 0,
      isCostSettled: false,
      memo: data.note || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

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
          contractEnd: data.returnDate,
          updatedAt: new Date().toISOString()
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
      db.insertRow<Delivery>('deliveries', {
        contractId: data.contractId,
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

  const registerRentedAsset = (assetData: Partial<Asset>) => {
    const existing = db.assets.find(a => a.assetNo === assetData.assetNo);
    if (existing) {
      db.updateRow<Asset>('assets', existing.id, {
        ...assetData,
        ownerType: 'RENTED',
        updatedAt: new Date().toISOString()
      });
    } else {
      db.insertRow<Asset>('assets', {
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
    refreshAllData();
  };

  const returnRentedAsset = (assetId: string, returnDate: string) => {
    db.updateRow<Asset>('assets', assetId, {
      status: 'RENTED_RETURNED',
      actualRentReturnDate: returnDate,
      updatedAt: new Date().toISOString()
    });
    refreshAllData();
  };

  const purchaseConsumable = (data: { modelName: string; qty: number; unit: string; unitPrice: number; supplier: string }) => {
    let consumable = db.consumables.find(c => c.modelName === data.modelName);
    
    if (consumable) {
      const nextQty = consumable.stockQty + data.qty;
      db.updateRow<Consumable>('consumables', consumable.id, {
        stockQty: nextQty,
        unit: data.unit,
        unitPrice: data.unitPrice,
        supplier: data.supplier,
        updatedAt: new Date().toISOString()
      });
    } else {
      consumable = db.insertRow<Consumable>('consumables', {
        modelName: data.modelName,
        stockQty: data.qty,
        unit: data.unit,
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

    refreshAllData();
  };

  const useConsumable = (data: { consumableId: string; quantity: number; targetAssetId: string; description: string }) => {
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

  const requestConsumablePurchase = (data: { consumableId?: string; modelName: string; qty: number; unitPrice: number; requestDate: string; sellerName: string }) => {
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
    refreshAllData();
  };

  const acceptConsumablePurchase = (id: string) => {
    db.updateRow<ConsumablePurchaseRequest>('consumablePurchases', id, {
      status: 'ACCEPTED',
      acceptedDate: new Date().toISOString().split('T')[0],
      accepterId: currentUser?.id || 'system',
      accepterName: currentUser?.name || '시스템',
      updatedAt: new Date().toISOString()
    });
    refreshAllData();
  };

  const completeConsumablePurchase = (id: string) => {
    db.updateRow<ConsumablePurchaseRequest>('consumablePurchases', id, {
      status: 'COMPLETED',
      completedDate: new Date().toISOString().split('T')[0],
      accepterId: currentUser?.id || 'system',
      accepterName: currentUser?.name || '시스템',
      updatedAt: new Date().toISOString()
    });
    refreshAllData();
  };

  const inboundConsumablePurchase = (id: string, qty: number, statementFileUrl: string) => {
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

    refreshAllData();
  };

  const createContract = (contractData: Omit<Contract, 'id' | 'createdAt' | 'updatedAt' | 'contractNo'>, assetsList: { assetId?: string; expectedModel?: string; monthlyRentalFee: number; dailyRentalFee: number }[]) => {
    const contractNo = `CT-${new Date().toISOString().split('T')[0].replace(/-/g, '').substring(2)}-${Math.floor(100 + Math.random() * 900)}`;
    
    const contract = db.insertRow<Contract>('contracts', {
      ...contractData,
      contractNo,
      salespersonId: contractData.salespersonId || currentUser?.id,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

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

    db.insertRow<Delivery>('deliveries', {
      contractId: contract.id || '',
      type: 'OUTBOUND',
      status: 'REQUESTED',
      requestDate: new Date().toISOString().split('T')[0],
      deliveryCost: 0,
      isCostSettled: false,
      memo: '신규 계약 체결에 따른 출고 의뢰',
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
      contractId: contract.id || '',
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

  const assignAssetToContract = (contractAssetId: string, assetId: string) => {
    const ca = db.contractAssets.find(c => c.id === contractAssetId);
    if (!ca) return;
    const contract = db.contracts.find(c => c.id === ca.contractId);
    
    // 1. ContractAsset 업데이트
    db.updateRow<ContractAsset>('contractAssets', contractAssetId, {
      assetId: assetId
    });

    // 2. Asset 상태 업데이트
    if (contract) {
      db.updateRow<Asset>('assets', assetId, {
        status: 'RENTED',
        currentCustomerId: contract.customerId,
        currentSiteId: contract.siteId,
        contractStart: contract.startDate,
        contractEnd: contract.endDate,
        updatedAt: new Date().toISOString()
      });
    }

    refreshAllData();
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
    const repairId = repairData.id || `rep-${Math.random().toString(36).substr(2, 9)}`;
    const totalRepairCost = repairData.totalCost ?? 0;

    if (repairData.id) {
      db.updateRow<Repair>('repairs', repairData.id, {
        ...repairData,
        status: repairData.status || 'COMPLETED',
        updatedAt: new Date().toISOString()
      });
    } else {
      db.insertRow<Repair>('repairs', {
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

  return (
    <AppContext.Provider value={{
      currentUser, theme, toggleTheme, login, logout, hasPermission,
      users, permissions, customers, contacts, sites, products, assets, consumables, consumableLogs, consumablePurchases, contracts, contractAssets, contractHistory, deliveries, billings, billingDetails, payments, repairs, repairConsumables, transportCompanies, transportDrivers, todos,
      bankTransactions, bankMatchingRules, assetInOutLogs, vendors, googleConfigs, cashFlowSnapshots,
      refreshAllData, updatePermissions, saveUser, saveCustomer, saveContact, saveSite, saveProduct, saveAsset, updateGoogleConfig,
      saveCashFlowSnapshot, deleteCashFlowSnapshot,
      acquireAsset, disposeAsset, registerRentedAsset, returnRentedAsset,
      purchaseConsumable, useConsumable,
      requestConsumablePurchase, acceptConsumablePurchase, completeConsumablePurchase, inboundConsumablePurchase,
      createContract, extendContract, shortenContract, succeedContract, exchangeAsset,
      assignAssetToContract,
      saveSmartDispatch, saveSmartReturn,
      completeTodo,
      generateBillingsForMonth, approveBilling, cancelBilling, receivePayment,
      uploadBankTransactions, matchTransactionManual, unmatchTransaction, deleteMatchingRule,
      dispatchDelivery, settleDeliveryCost, completeDelivery, completeInboundDelivery,
      registerRepair,
      saveTransportDataOnFly,
      activeTab,
      setActiveTab,
      navigationPayload,
      setNavigationPayload
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
