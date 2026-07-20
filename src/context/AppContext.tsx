// d:\Kiyeun_Lift\src\context\AppContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, User, MenuPermission, Customer, CustomerContact, CustomerSite, Product, Asset, Consumable, ConsumableLog, Contract, ContractAsset, ContractHistory, Billing, BillingDetail, Payment, Delivery, TransportCompany, TransportDriver, Repair, RepairConsumable, Todo } from '../services/db';

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

  // Mutators
  refreshAllData: () => void;
  updatePermissions: (updated: MenuPermission[]) => void;
  saveUser: (user: Omit<User, 'id' | 'createdAt'> & { id?: string }) => void;
  saveCustomer: (cust: Omit<Customer, 'id' | 'createdAt'> & { id?: string }) => Customer;
  saveContact: (contact: Omit<CustomerContact, 'id' | 'createdAt'> & { id?: string }) => void;
  saveSite: (site: Omit<CustomerSite, 'id' | 'createdAt'> & { id?: string }) => void;
  saveProduct: (prod: Omit<Product, 'id' | 'createdAt'> & { id?: string }) => void;
  
  // Asset Mutators
  acquireAsset: (assetData: Partial<Asset>) => void;
  disposeAsset: (assetId: string, disposalData: { disposalDate: string; disposalPrice: number; buyer: string }) => void;
  registerRentedAsset: (assetData: Partial<Asset>) => void;
  returnRentedAsset: (assetId: string, returnDate: string) => void;
  
  // Consumables Mutators
  purchaseConsumable: (data: { modelName: string; qty: number; unit: string; unitPrice: number; supplier: string }) => void;
  useConsumable: (data: { consumableId: string; quantity: number; targetAssetId: string; description: string }) => void;
  
  // Contract Mutators
  createContract: (contractData: Omit<Contract, 'id' | 'createdAt' | 'updatedAt' | 'contractNo'>, assetsList: { assetId: string; monthlyRentalFee: number; dailyRentalFee: number }[]) => void;
  extendContract: (contractId: string, newEndDate: string, description: string) => void;
  shortenContract: (contractId: string, newEndDate: string, description: string) => void;
  succeedContract: (contractId: string, successorCustomerId: string, successorContactId: string, successorSiteId: string, successionDate: string, description: string) => void;
  exchangeAsset: (contractId: string, oldAssetId: string, newAssetId: string, exchangeDate: string) => void;
  
  // 장비 할당
  assignAssetToContract: (contractAssetId: string, assetId: string) => void;
  saveSmartDispatch: (data: SmartDispatchData, autoRegister: boolean) => Promise<{ success: boolean; requiresConfirm?: boolean; missingFields?: string[] }>;
  
  // Todos
  completeTodo: (todoId: string) => void;
  
  // Billings
  generateBillingsForMonth: (billingYm: string, billingDate: string) => void;
  approveBilling: (billingId: string) => void;
  cancelBilling: (billingId: string) => void;
  receivePayment: (billingId: string, data: { paymentDate: string; amount: number; method: string; memo: string }) => void;
  
  // Deliveries
  dispatchDelivery: (deliveryId: string, dispatchData: { scheduledDate: string; vehicleType: string; driverName: string; driverContact: string; deliveryCost: number }) => void;
  settleDeliveryCost: (deliveryId: string) => void;
  
  // Repairs
  registerRepair: (repairData: Partial<Repair>, usedConsumables: { consumableId: string; quantity: number }[]) => void;
  
  // Transport Master
  saveTransportDataOnFly: (companyName: string, driverName: string, contact: string, vehicleNo: string, vehicleType: string) => void;
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
  };

  useEffect(() => {
    if (!localStorage.getItem('seed_v1_8_dummy_contracts_v2')) {
      localStorage.removeItem('erp_contracts');
      localStorage.removeItem('erp_contractAssets');
      localStorage.setItem('seed_v1_8_dummy_contracts_v2', 'true');
    }

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
    } else {
      res = db.insertRow<Customer>('customers', { ...cust, createdAt: new Date().toISOString() }) as Customer;
    }
    refreshAllData();
    return res;
  };

  const saveContact = (contact: Omit<CustomerContact, 'id' | 'createdAt'> & { id?: string }) => {
    if (contact.id) {
      db.updateRow<CustomerContact>('contacts', contact.id, contact);
    } else {
      db.insertRow<CustomerContact>('contacts', { ...contact, createdAt: new Date().toISOString() });
    }
    refreshAllData();
  };

  const saveSite = (site: Omit<CustomerSite, 'id' | 'createdAt'> & { id?: string }) => {
    if (site.id) {
      db.updateRow<CustomerSite>('sites', site.id, site);
    } else {
      db.insertRow<CustomerSite>('sites', { ...site, createdAt: new Date().toISOString() });
    }
    refreshAllData();
  };

  const saveProduct = (prod: Omit<Product, 'id' | 'createdAt'> & { id?: string }) => {
    if (prod.id) {
      db.updateRow<Product>('products', prod.id, prod);
    } else {
      db.insertRow<Product>('products', { ...prod, createdAt: new Date().toISOString() });
    }
    refreshAllData();
  };

  const saveSmartDispatch = async (data: SmartDispatchData, autoRegister: boolean) => {
    let customer = db.customers.find(c => c.name.replace(/\s/g, '') === data.customerName.replace(/\s/g, ''));
    let site = db.sites.find(s => s.name.replace(/\s/g, '') === data.siteName.replace(/\s/g, ''));
    
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
    }

    if (!site) {
      site = db.insertRow<CustomerSite>('sites', {
        customerId: customer.id,
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
        relatedEntityId: customer.id,
        createdAt: new Date().toISOString()
      });
    }

    const contract = db.insertRow<Contract>('contracts', {
      contractNo: `S-CTR-${Date.now()}`,
      customerId: customer.id,
      siteId: site.id,
      startDate: new Date().toISOString().split('T')[0],
      endDate: '', 
      billingDay: 30,
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
      rentEnd: returnDate,
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

  const createContract = (contractData: Omit<Contract, 'id' | 'createdAt' | 'updatedAt' | 'contractNo'>, assetsList: { assetId: string; monthlyRentalFee: number; dailyRentalFee: number }[]) => {
    const contractNo = `CT-${new Date().toISOString().split('T')[0].replace(/-/g, '').substring(2)}-${Math.floor(100 + Math.random() * 900)}`;
    
    const contract = db.insertRow<Contract>('contracts', {
      ...contractData,
      contractNo,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    assetsList.forEach(item => {
      db.insertRow<ContractAsset>('contractAssets', {
        contractId: contract.id,
        assetId: item.assetId,
        monthlyRentalFee: item.monthlyRentalFee,
        dailyRentalFee: item.dailyRentalFee,
        startDate: contractData.startDate,
        endDate: contractData.endDate,
        createdAt: new Date().toISOString()
      });

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

  const dispatchDelivery = (deliveryId: string, dispatchData: { scheduledDate: string; vehicleType: string; driverName: string; driverContact: string; deliveryCost: number }) => {
    db.updateRow<Delivery>('deliveries', deliveryId, {
      ...dispatchData,
      status: 'DISPATCHED',
      updatedAt: new Date().toISOString()
    });
    refreshAllData();
  };

  const settleDeliveryCost = (deliveryId: string) => {
    db.updateRow<Delivery>('deliveries', deliveryId, {
      isCostSettled: true,
      updatedAt: new Date().toISOString()
    });
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
        cumRepairCost: (asset.cumRepairCost || 0) + totalRepairCost,
        updatedAt: new Date().toISOString()
      });
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

  return (
    <AppContext.Provider value={{
      currentUser, theme, toggleTheme, login, logout, hasPermission,
      users, permissions, customers, contacts, sites, products, assets, consumables, consumableLogs, contracts, contractAssets, contractHistory, deliveries, billings, billingDetails, payments, repairs, repairConsumables, transportCompanies, transportDrivers, todos,
      refreshAllData, updatePermissions, saveUser, saveCustomer, saveContact, saveSite, saveProduct,
      acquireAsset, disposeAsset, registerRentedAsset, returnRentedAsset,
      purchaseConsumable, useConsumable,
      createContract, extendContract, shortenContract, succeedContract, exchangeAsset,
      assignAssetToContract,
      saveSmartDispatch,
      completeTodo,
      generateBillingsForMonth, approveBilling, cancelBilling, receivePayment,
      dispatchDelivery, settleDeliveryCost,
      registerRepair,
      saveTransportDataOnFly
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
