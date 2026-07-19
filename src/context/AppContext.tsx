// d:\Kiyeun_Lift\src\context\AppContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, User, MenuPermission, Customer, CustomerContact, CustomerSite, Product, Asset, Consumable, ConsumableLog, Contract, ContractAsset, ContractHistory, Billing, BillingDetail, Payment, Delivery, Repair, RepairConsumable } from '../services/db';

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
  billings: Billing[];
  billingDetails: BillingDetail[];
  payments: Payment[];
  repairs: Repair[];
  repairConsumables: RepairConsumable[];

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
  
  // Billings
  generateBillingsForMonth: (billingYm: string, billingDate: string) => void;
  approveBilling: (billingId: string) => void;
  rejectBilling: (billingId: string, reason: string) => void;
  receivePayment: (billingId: string, data: { paymentDate: string; amount: number; method: string; memo: string }) => void;
  
  // Deliveries
  dispatchDelivery: (deliveryId: string, dispatchData: { scheduledDate: string; vehicleType: string; driverName: string; driverContact: string; deliveryCost: number }) => void;
  settleDeliveryCost: (deliveryId: string) => void;
  
  // Repairs
  registerRepair: (repairData: Partial<Repair>, usedConsumables: { consumableId: string; quantity: number }[]) => void;
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
  const [billings, setBillings] = useState<Billing[]>([]);
  const [billingDetails, setBillingDetails] = useState<BillingDetail[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [repairConsumables, setRepairConsumables] = useState<RepairConsumable[]>([]);

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
    setBillings(db.billings);
    setBillingDetails(db.billingDetails);
    setPayments(db.payments);
    setRepairs(db.repairs);
    setRepairConsumables(db.repairConsumables);
  };

  useEffect(() => {
    // 테마 설정 불러오기
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
    
    // 세션 정보 확인
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
    // 최초 세팅 및 강제 접근을 위한 슈퍼 어드민 백도어 (데이터 의존성 제거)
    if (loginId === 'admin' && passwordHash === 'admin123') {
      const fallbackAdmin: User = { 
        id: 'sys-admin', loginId: 'admin', passwordHash: 'admin123', 
        name: '최고관리자', department: '시스템', role: 'ADMIN', createdAt: new Date().toISOString() 
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

  // --- MUTATORS ---

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

  // 자산 취득
  const acquireAsset = (assetData: Partial<Asset>) => {
    const residualRate = assetData.residualValueRate ?? 10;
    const price = assetData.acquisitionPrice ?? 0;
    const bookVal = price; // 취득 시 장부가는 취득가와 동일
    
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

  // 자산 매각
  const disposeAsset = (assetId: string, disposalData: { disposalDate: string; disposalPrice: number; buyer: string }) => {
    const asset = db.assets.find(a => a.id === assetId);
    if (!asset) return;

    // 장부가 및 속성값 업데이트
    db.updateRow<Asset>('assets', assetId, {
      status: 'SOLD',
      disposalDate: disposalData.disposalDate,
      disposalPrice: disposalData.disposalPrice,
      buyer: disposalData.buyer,
      updatedAt: new Date().toISOString()
    });

    // 매각처에 대한 청구 데이터 자동 생성
    const billingYm = disposalData.disposalDate.substring(0, 7);
    
    // 매각처 임시 고객 생성 또는 조회 (매각처 텍스트 매칭)
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

  // 임차자산 조회/등록/반납
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

  // 소모품 구입
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

    // 입고 로그
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

  // 소모품 사용
  const useConsumable = (data: { consumableId: string; quantity: number; targetAssetId: string; description: string }) => {
    const consumable = db.consumables.find(c => c.id === data.consumableId);
    if (!consumable || consumable.stockQty < data.quantity) return;

    // 재고 차감
    db.updateRow<Consumable>('consumables', consumable.id, {
      stockQty: consumable.stockQty - data.quantity,
      updatedAt: new Date().toISOString()
    });

    // 로그 작성
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

    // 자산의 누적 수리비용 가산
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

  // 계약 등록 및 비즈니스 연동
  const createContract = (contractData: Omit<Contract, 'id' | 'createdAt' | 'updatedAt' | 'contractNo'>, assetsList: { assetId: string; monthlyRentalFee: number; dailyRentalFee: number }[]) => {
    const contractNo = `CT-${new Date().toISOString().split('T')[0].replace(/-/g, '').substring(2)}-${Math.floor(100 + Math.random() * 900)}`;
    
    // 1. 계약 생성
    const contract = db.insertRow<Contract>('contracts', {
      ...contractData,
      contractNo,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // 2. 계약 자산 연결 및 자산 상태 변경
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

      // 자산 테이블 업데이트 (렌탈 중, 고객/현장 연동)
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

    // 3. 계약 히스토리
    db.insertRow<ContractHistory>('contractHistory', {
      contractId: contract.id,
      changeType: 'REGISTER',
      changeDate: new Date().toISOString().split('T')[0],
      newEndDate: contractData.endDate,
      description: '계약 신규 등록',
      createdAt: new Date().toISOString()
    });

    // 4. 배차 출고 의뢰 자동 생성
    db.insertRow<Delivery>('deliveries', {
      contractId: contract.id,
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

  // 계약 연장
  const extendContract = (contractId: string, newEndDate: string, description: string) => {
    const contract = db.contracts.find(c => c.id === contractId);
    if (!contract) return;

    const prevEnd = contract.endDate;

    // 계약 기간 연장
    db.updateRow<Contract>('contracts', contractId, {
      endDate: newEndDate,
      status: 'EXTENDED',
      updatedAt: new Date().toISOString()
    });

    // 계약에 묶인 자산 상태 정보 수정
    const cAssets = db.contractAssets.filter(ca => ca.contractId === contractId);
    cAssets.forEach(ca => {
      db.updateRow<ContractAsset>('contractAssets', ca.id, { endDate: newEndDate });
      db.updateRow<Asset>('assets', ca.assetId, {
        contractEnd: newEndDate,
        updatedAt: new Date().toISOString()
      });
    });

    // 이력 등록
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

  // 계약 단축
  const shortenContract = (contractId: string, newEndDate: string, description: string) => {
    const contract = db.contracts.find(c => c.id === contractId);
    if (!contract) return;

    const prevEnd = contract.endDate;

    // 계약 기간 단축
    db.updateRow<Contract>('contracts', contractId, {
      endDate: newEndDate,
      status: 'SHORTENED',
      updatedAt: new Date().toISOString()
    });

    // 계약 자산 및 자산 정보 단축
    const cAssets = db.contractAssets.filter(ca => ca.contractId === contractId);
    cAssets.forEach(ca => {
      db.updateRow<ContractAsset>('contractAssets', ca.id, { endDate: newEndDate });
      db.updateRow<Asset>('assets', ca.assetId, {
        contractEnd: newEndDate,
        updatedAt: new Date().toISOString()
      });
    });

    // 이력 등록
    db.insertRow<ContractHistory>('contractHistory', {
      contractId,
      changeType: 'SHORTEN',
      changeDate: new Date().toISOString().split('T')[0],
      prevEndDate: prevEnd,
      newEndDate,
      description: `계약 단축 처리: ${description}`,
      createdAt: new Date().toISOString()
    });

    // 단축일에 맞추어 회수 의뢰 자동 생성
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

  // 계약 승계
  const succeedContract = (contractId: string, successorCustomerId: string, successorContactId: string, successorSiteId: string, successionDate: string, description: string) => {
    const oldContract = db.contracts.find(c => c.id === contractId);
    if (!oldContract) return;

    const oldEndDate = oldContract.endDate;
    
    // 1. 기존 계약 단축 (승계일 기준)
    db.updateRow<Contract>('contracts', contractId, {
      endDate: successionDate,
      status: 'SHORTENED',
      updatedAt: new Date().toISOString()
    });

    // 기존 계약 자산 기간도 승계일로 단축
    const oldCAssets = db.contractAssets.filter(ca => ca.contractId === contractId);
    oldCAssets.forEach(ca => {
      db.updateRow<ContractAsset>('contractAssets', ca.id, { endDate: successionDate });
    });

    // 기존 계약 이력 등록
    db.insertRow<ContractHistory>('contractHistory', {
      contractId,
      changeType: 'SHORTEN',
      changeDate: successionDate,
      prevEndDate: oldEndDate,
      newEndDate: successionDate,
      description: `계약 승계 이전(타 고객 인수)에 따른 단축 완료`,
      createdAt: new Date().toISOString()
    });

    // 2. 승계받을 새 계약 생성 (승계 다음날 ~ 기존 계약 만료일)
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

    // 기존 계약에서 승계 연동 정보 업데이트
    db.updateRow<Contract>('contracts', contractId, {
      successorContractId: newContract.id,
      status: 'SUCCEEDED'
    });

    // 3. 자산을 새 계약으로 승계 이전
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

      // 자산 정보 업데이트 (새 고객 및 현장 연동)
      db.updateRow<Asset>('assets', ca.assetId, {
        currentCustomerId: successorCustomerId,
        currentSiteId: successorSiteId,
        contractStart: nextDay,
        contractEnd: oldEndDate,
        updatedAt: new Date().toISOString()
      });
    });

    // 새 계약 이력 작성
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

  // 고객별 마감일 기준 청구 생성
  const generateBillingsForMonth = (billingYm: string, billingDate: string) => {
    // 해당 월의 시작일과 종료일 계산
    const [year, month] = billingYm.split('-').map(Number);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0); // 말일

    // 모든 활성 계약 조회
    const activeContracts = db.contracts.filter(c => c.status !== 'COMPLETED');
    
    // 고객별 계약 데이터 그룹화
    const customerContractsMap: Record<string, Contract[]> = {};
    activeContracts.forEach(c => {
      if (!customerContractsMap[c.customerId]) {
        customerContractsMap[c.customerId] = [];
      }
      customerContractsMap[c.customerId].push(c);
    });

    Object.entries(customerContractsMap).forEach(([customerId, custContracts]) => {
      // 1. 이미 해당 월에 청구 생성되었는지 확인
      const existing = db.billings.find(b => b.customerId === customerId && b.billingYm === billingYm);
      if (existing) return; // 이미 청구가 생성된 고객은 스킵

      let billingDetailsList: Omit<BillingDetail, 'id' | 'billingId' | 'createdAt'>[] = [];
      let customerTotalAmount = 0;

      // 2. 고객 소속 계약별 자산 렌탈료 계산
      custContracts.forEach(c => {
        const cAssets = db.contractAssets.filter(ca => ca.contractId === c.id);
        
        cAssets.forEach(ca => {
          // 계약 자산의 유효 기간과 청구대상 월의 겹치는 구간 산정
          const assetStart = new Date(ca.startDate);
          const assetEnd = new Date(ca.endDate);
          
          const calcStart = assetStart > startOfMonth ? assetStart : startOfMonth;
          const calcEnd = assetEnd < endOfMonth ? assetEnd : endOfMonth;

          if (calcStart <= calcEnd) {
            // 일수 계산
            const diffTime = Math.abs(calcEnd.getTime() - calcStart.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // 시작일 포함
            
            const assetInfo = db.assets.find(a => a.id === ca.assetId);
            const assetName = assetInfo ? `${assetInfo.modelName} (관리번호: ${assetInfo.assetNo})` : '렌탈 장비';
            
            let rentalCost = 0;
            let calcDesc = '';
            
            // 한 달 전체를 채우는 경우 월 렌탈료 적용, 그 외는 일할 계산
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

              // 자산 누적 렌탈료 업데이트
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

      // 3. 해당 월에 완료된 자산 수리 중 청구가능 여부 연동
      const customerAssets = db.assets.filter(a => a.currentCustomerId === customerId);
      customerAssets.forEach(asset => {
        const repairList = db.repairs.filter(r => 
          r.assetId === asset.id && 
          r.status === 'COMPLETED' && 
          r.billableToCustomer && 
          !r.billingId && // 아직 청구에 연결 안 된 것
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

      // 4. 청구 마스터 정보 및 상세 저장
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

        // 5. 청구 처리 완료된 수리건들에는 billingId 업데이트
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

  const rejectBilling = (billingId: string, reason: string) => {
    db.updateRow<Billing>('billings', billingId, { status: 'REJECTED', rejectReason: reason });
    refreshAllData();
  };

  // 수납 처리
  const receivePayment = (billingId: string, data: { paymentDate: string; amount: number; method: string; memo: string }) => {
    const billing = db.billings.find(b => b.id === billingId);
    if (!billing) return;

    // 수납 로그 추가
    db.insertRow<Payment>('payments', {
      billingId,
      paymentDate: data.paymentDate,
      amount: data.amount,
      method: data.method,
      memo: data.memo,
      createdAt: new Date().toISOString()
    });

    // 청구 금액 상태 변경
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

  // 배차 및 차량 운송
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

  // 자산 수리 및 소모품 재고 차감 등록
  const registerRepair = (repairData: Partial<Repair>, usedConsumables: { consumableId: string; quantity: number }[]) => {
    const repairId = repairData.id || `rep-${Math.random().toString(36).substr(2, 9)}`;
    const totalRepairCost = repairData.totalCost ?? 0;

    if (repairData.id) {
      // 수정인 경우
      db.updateRow<Repair>('repairs', repairData.id, {
        ...repairData,
        status: repairData.status || 'COMPLETED',
        updatedAt: new Date().toISOString()
      });
    } else {
      // 신규 수리 등록
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

    // 소모품 차감 및 수리 연결 기록 처리
    usedConsumables.forEach(uc => {
      const consumable = db.consumables.find(c => c.id === uc.consumableId);
      if (consumable && consumable.stockQty >= uc.quantity) {
        // 재고 마이너스
        db.updateRow<Consumable>('consumables', consumable.id, {
          stockQty: consumable.stockQty - uc.quantity,
          updatedAt: new Date().toISOString()
        });

        // 소모품 로그 생성
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

        // 수리용 소모품 맵핑 테이블 데이터 추가
        db.insertRow<RepairConsumable>('repairConsumables', {
          repairId,
          consumableId: uc.consumableId,
          quantity: uc.quantity,
          unitPrice: consumable.unitPrice,
          cost: consumable.unitPrice * uc.quantity
        });
      }
    });

    // 자산 상태 수리중 -> 정비 완료인 경우 AVAILABLE로 리셋, 누적수리비에 추가
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

  return (
    <AppContext.Provider value={{
      currentUser, theme, toggleTheme, login, logout, hasPermission,
      users, permissions, customers, contacts, sites, products, assets, consumables, consumableLogs, contracts, contractAssets, contractHistory, deliveries, billings, billingDetails, payments, repairs, repairConsumables,
      refreshAllData, updatePermissions, saveUser, saveCustomer, saveContact, saveSite, saveProduct,
      acquireAsset, disposeAsset, registerRentedAsset, returnRentedAsset,
      purchaseConsumable, useConsumable,
      createContract, extendContract, shortenContract, succeedContract,
      generateBillingsForMonth, receivePayment,
      dispatchDelivery, settleDeliveryCost,
      registerRepair
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
