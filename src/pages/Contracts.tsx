// d:\Kiyeun_Lift\src\pages\Contracts.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Mail, Calendar, ArrowRight, FileText, Check, Send, Download, Search } from 'lucide-react';
import { drive } from '../services/drive';
import { emailService } from '../services/email';
import { documentBuilder } from '../services/templates';
import { Contract, db, Customer, CustomerContact, CustomerSite, Todo } from '../services/db';
import { exportToExcel } from '../services/excel';

export const Contracts: React.FC = () => {
  const {
    contracts, contractAssets, contractHistory, customers, contacts, sites, assets, users, currentUser,
    createContract, extendContract, shortenContract, succeedContract, exchangeAsset, hasPermission,
    products, googleConfigs, refreshAllData
  } = useApp();

  const canSave = hasPermission('contract', 'save');

  // 계약 변경 권한 검증 함수 (본인 계약 또는 청구 서포터 권한 소유자)
  const canModifyContract = (contract: Contract) => {
    if (!currentUser) return false;
    if (currentUser.role === 'ADMIN') return true;
    if (hasPermission('billing', 'save')) return true; // 청구 입력 권한 = 영업 서포터
    return contract.salespersonId === currentUser.id;
  };

  const [activeTab, setActiveTab] = useState<'LIST' | 'CREATE' | 'MODIFY' | 'TRANSFER' | 'EMAIL'>('LIST');

  // --- 계약 조회 필터 상태 ---
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempStatusFilter, setTempStatusFilter] = useState('ALL');
  const [tempSalespersonFilter, setTempSalespersonFilter] = useState('ALL');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [salespersonFilter, setSalespersonFilter] = useState('ALL');

  // 선택된 계약 상세 조회 상태
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

  // --- 계약 등록 상태 ---
  const [custSelect, setCustSelect] = useState(customers[0]?.id || '');
  const [contactSelect, setContactSelect] = useState('');
  const [siteSelect, setSiteSelect] = useState('');
  const [salespersonSelect, setSalespersonSelect] = useState(currentUser?.id || '');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(new Date().getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [billingDay, setBillingDay] = useState(30);
  const [statementClosingDay, setStatementClosingDay] = useState(25);

  // 신규 직접등록 세부 필드 상태
  const [isNewCust, setIsNewCust] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newBizRegNo, setNewBizRegNo] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newRepresentative, setNewRepresentative] = useState('');
  const [newRepContact, setNewRepContact] = useState('');
  const [newRepEmail, setNewRepEmail] = useState('');

  const [isNewContact, setIsNewContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPosition, setNewContactPosition] = useState('담당자');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');

  const [isNewSite, setIsNewSite] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteAddress, setNewSiteAddress] = useState('');
  const [newSiteContactName, setNewSiteContactName] = useState('');
  const [newSiteContactPhone, setNewSiteContactPhone] = useState('');
  const [newSiteContactEmail, setNewSiteContactEmail] = useState('');
  
  // 계약 등록 중 자산 바스켓
  const [basket, setBasket] = useState<{ assetId?: string; expectedModel?: string; monthlyRentalFee: number; dailyRentalFee: number }[]>([]);
  const [basketAssetMethod, setBasketAssetMethod] = useState<'ASSET' | 'MODEL'>('ASSET');
  const [selectedAssetToAdd, setSelectedAssetToAdd] = useState('');
  const [selectedModelToAdd, setSelectedModelToAdd] = useState('');
  const [customMonthly, setCustomMonthly] = useState(400000);
  const [customDaily, setCustomDaily] = useState(15000);

  // --- 계약 연장/단축 상태 ---
  const [modContractId, setModContractId] = useState('');
  const [modType, setModType] = useState<'EXTEND' | 'SHORTEN'>('EXTEND');
  const [newEndDate, setNewEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [modDesc, setModDesc] = useState('');

  // --- 계약 승계 상태 ---
  const [succContractId, setSuccContractId] = useState('');
  const [succCustId, setSuccCustId] = useState('');
  const [succContactId, setSuccContactId] = useState('');
  const [succSiteId, setSuccSiteId] = useState('');
  const [succDate, setSuccDate] = useState(new Date().toISOString().split('T')[0]);
  const [succDesc, setSuccDesc] = useState('');
  
  // --- 장비 교체 상태 ---
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [exchangeContractAssetId, setExchangeContractAssetId] = useState('');
  const [exchangeOldAssetId, setExchangeOldAssetId] = useState('');
  const [exchangeNewAssetId, setExchangeNewAssetId] = useState('');
  const [exchangeDate, setExchangeDate] = useState(new Date().toISOString().split('T')[0]);

  const handleOpenExchange = (caId: string, oldAssetId: string) => {
    setExchangeContractAssetId(caId);
    setExchangeOldAssetId(oldAssetId);
    setExchangeNewAssetId('');
    setExchangeDate(new Date().toISOString().split('T')[0]);
    setShowExchangeModal(true);
  };

  const handleExchangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !selectedContractId || !exchangeOldAssetId || !exchangeNewAssetId) return;

    exchangeAsset(selectedContractId, exchangeOldAssetId, exchangeNewAssetId, exchangeDate);
    alert('장비 교체 처리가 완료되었습니다. 회수 및 대체 출고 배차 의뢰가 자동 생성되었습니다.');
    setShowExchangeModal(false);
    setExchangeNewAssetId('');
  };

  // --- 이메일 전송 상태 ---
  const [mailContractId, setMailContractId] = useState('');
  const [mailTo, setMailTo] = useState('');
  const [mailCc, setMailCc] = useState('');
  const [mailSubject, setMailSubject] = useState('');
  const [mailBody, setMailBody] = useState('');
  const [mailAttachmentIds, setMailAttachmentIds] = useState<string[]>([]);
  const [isSendingMail, setIsSendingMail] = useState(false);

  const getCustName = (id: string) => customers.find(c => c.id === id)?.name || '-';
  const getSiteName = (id?: string) => sites.find(s => s.id === id)?.name || '-';
  const getContactName = (id?: string) => contacts.find(c => c.id === id)?.name || '-';

  const handleSearchClick = () => {
    setSearchTerm(tempSearchTerm);
    setStatusFilter(tempStatusFilter);
    setSalespersonFilter(tempSalespersonFilter);
  };

  const filteredContracts = contracts.filter(c => {
    const nameCust = getCustName(c.customerId).toLowerCase();
    const matchesSearch = 
      c.contractNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      nameCust.includes(searchTerm.toLowerCase());
      
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const matchesSalesperson = salespersonFilter === 'ALL' || c.salespersonId === salespersonFilter;

    return matchesSearch && matchesStatus && matchesSalesperson;
  });

  const handleExportExcel = () => {
    const excelData = filteredContracts.map((c, idx) => ({
      'No': idx + 1,
      '계약번호': c.contractNo,
      '고객사': getCustName(c.customerId),
      '현장': getSiteName(c.siteId),
      '담당자': getContactName(c.contactId),
      '담당 영업사원': users.find(u => u.id === c.salespersonId)?.name || '지정없음',
      '임대 시작일': c.startDate,
      '임대 종료일': c.endDate || '미상',
      '청구마감일(일)': c.billingDay,
      '명세서마감일(일)': c.statementClosingDay || '-',
      '계약상태': c.status === 'ACTIVE' ? '진행중' :
                 c.status === 'EXTENDED' ? '연장됨' :
                 c.status === 'SHORTENED' ? '단축됨' :
                 c.status === 'SUCCEEDED' ? '승계됨' : '종료',
      '등록일': c.createdAt ? c.createdAt.split('T')[0] : '-'
    }));

    exportToExcel(excelData, `계약관리대장_${new Date().toISOString().split('T')[0]}`, '계약목록');
  };

  const activeContract = contracts.find(c => c.id === selectedContractId);
  const activeContractHistory = contractHistory.filter(h => h.contractId === selectedContractId);
  const activeContractAssets = contractAssets.filter(ca => ca.contractId === selectedContractId);

  // 대기상태 장비 목록 (계약 추가용)
  const availableAssets = assets.filter(a => a.status === 'AVAILABLE');
  const oldAssetToExchange = assets.find(a => a.id === exchangeOldAssetId);
  const filteredAvailableAssets = assets.filter(a => a.status === 'AVAILABLE' && (oldAssetToExchange ? a.modelName === oldAssetToExchange.modelName : true));

  // 계약 등록 중 자산 추가
  const handleAddToBasket = () => {
    if (basketAssetMethod === 'ASSET') {
      if (!selectedAssetToAdd) return;
      if (basket.some(b => b.assetId === selectedAssetToAdd)) return;
      setBasket([...basket, {
        assetId: selectedAssetToAdd,
        monthlyRentalFee: customMonthly,
        dailyRentalFee: customDaily
      }]);
      setSelectedAssetToAdd('');
    } else {
      if (!selectedModelToAdd) return;
      if (basket.some(b => b.expectedModel === selectedModelToAdd)) return;
      setBasket([...basket, {
        expectedModel: selectedModelToAdd,
        monthlyRentalFee: customMonthly,
        dailyRentalFee: customDaily
      }]);
      setSelectedModelToAdd('');
    }
  };

  const handleRemoveFromBasket = (id?: string) => {
    if (!id) return;
    setBasket(basket.filter(b => b.assetId !== id && b.expectedModel !== id));
  };

  const handleCreateContractSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    if (custSelect === 'NEW' && !newCustName) {
      alert('신규 고객사명을 입력해 주세요.');
      return;
    }
    if (basket.length === 0) {
      alert('최소 한 대 이상의 자산 또는 제품 모델을 바스켓에 추가해 주세요.');
      return;
    }

    let finalCustomerId = custSelect;
    let finalContactId = contactSelect;
    let finalSiteId = siteSelect;

    // 1. 신규 고객사 등록
    if (custSelect === 'NEW') {
      const newCust = db.insertRow<Customer>('customers', {
        name: newCustName,
        bizRegNo: newBizRegNo || '미상',
        isClosed: false,
        address: newAddress || '미상',
        representative: newRepresentative || '미상',
        repContact: newRepContact || '미상',
        repEmail: newRepEmail || '미상',
        createdAt: new Date().toISOString()
      });
      finalCustomerId = newCust.id;

      // Todo 생성
      if (currentUser) {
        db.insertRow<Todo>('todos', {
          userId: currentUser.id,
          type: 'MISSING_INFO',
          title: `신규 고객 정보 보완 (${newCustName})`,
          content: `계약 직접 등록 시 생성된 고객의 필수 항목(대표자, 주소 등)을 보완해 주세요.`,
          isCompleted: false,
          relatedEntityId: newCust.id,
          createdAt: new Date().toISOString()
        });
      }
    }

    // 2. 신규 담당자 등록
    if (contactSelect === 'NEW') {
      const newContact = db.insertRow<CustomerContact>('contacts', {
        customerId: finalCustomerId,
        name: newContactName || '미상',
        position: newContactPosition || '담당자',
        contact: newContactPhone || '미상',
        email: newContactEmail || '미상',
        isActive: true,
        createdAt: new Date().toISOString()
      });
      finalContactId = newContact.id;
    }

    // 3. 신규 현장 등록
    if (siteSelect === 'NEW') {
      const newSite = db.insertRow<CustomerSite>('sites', {
        customerId: finalCustomerId,
        name: newSiteName,
        address: newSiteAddress || '미상',
        contactName: newSiteContactName || '미상',
        contact: newSiteContactPhone || '미상',
        email: newSiteContactEmail || '미상',
        isActive: true,
        createdAt: new Date().toISOString()
      });
      finalSiteId = newSite.id;
    }

    createContract({
      customerId: finalCustomerId,
      contactId: finalContactId && finalContactId !== 'NEW' ? finalContactId : undefined,
      siteId: finalSiteId && finalSiteId !== 'NEW' ? finalSiteId : undefined,
      startDate,
      endDate,
      billingDay,
      statementClosingDay,
      salespersonId: salespersonSelect || undefined,
      status: 'ACTIVE'
    }, basket);

    alert('계약 등록이 완료되었으며, 출고 배차 의뢰가 자동 생성되었습니다.');
    
    // 초기화
    setBasket([]);
    setCustSelect(customers[0]?.id || '');
    setContactSelect('');
    setSiteSelect('');
    setNewCustName('');
    setNewBizRegNo('');
    setNewAddress('');
    setNewRepresentative('');
    setNewRepContact('');
    setNewRepEmail('');
    setNewContactName('');
    setNewContactPhone('');
    setNewContactEmail('');
    setNewSiteName('');
    setNewSiteAddress('');
    setNewSiteContactName('');
    setNewSiteContactPhone('');
    setNewSiteContactEmail('');

    refreshAllData();
    setActiveTab('LIST');
  };

  const handlePeriodModSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !modContractId) return;

    const contract = contracts.find(c => c.id === modContractId);
    if (!contract) {
      alert('선택한 계약을 찾을 수 없습니다.');
      return;
    }

    if (!canModifyContract(contract)) {
      alert('본 계약의 변경 권한이 없습니다.');
      return;
    }

    if (modType === 'EXTEND') {
      if (new Date(newEndDate) <= new Date(contract.endDate)) {
        alert(`연장 만료일은 기존 만료일(${contract.endDate})보다 늦어야 합니다.`);
        return;
      }
      extendContract(modContractId, newEndDate, modDesc);
      alert('계약 기간 연장 처리가 완료되었습니다.');
    } else {
      if (new Date(newEndDate) >= new Date(contract.endDate)) {
        alert(`단축 만료일은 기존 만료일(${contract.endDate})보다 빨라야 합니다.`);
        return;
      }
      if (new Date(newEndDate) < new Date(contract.startDate)) {
        alert(`단축 만료일은 계약 개시일(${contract.startDate})보다 같거나 늦어야 합니다.`);
        return;
      }
      shortenContract(modContractId, newEndDate, modDesc);
      alert('계약 기간 단축 처리 및 회수 의뢰가 자동 등록되었습니다.');
    }

    setModContractId('');
    setModDesc('');
    setActiveTab('LIST');
  };

  const handleSuccessionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !succContractId || !succCustId) return;

    const contract = contracts.find(c => c.id === succContractId);
    if (!contract || !canModifyContract(contract)) {
      alert('본 계약의 승계(변경) 권한이 없습니다.');
      return;
    }

    succeedContract(succContractId, succCustId, succContactId, succSiteId, succDate, succDesc);
    alert('계약 잔여기간 승계 처리가 승인되었습니다. 승계 대상 신규계약이 발행되었습니다.');
    setSuccContractId('');
    setSuccCustId('');
    setSuccContactId('');
    setSuccSiteId('');
    setSuccDesc('');
    setActiveTab('LIST');
  };

  const handleMailContractChange = (cid: string) => {
    setMailContractId(cid);
    const contract = contracts.find(c => c.id === cid);
    if (!contract) return;

    // 수신 이메일 디폴트 설정 (고객 담당자 및 현장 담당자)
    const cc = contacts.find(contact => contact.id === contract.contactId);
    const site = sites.find(s => s.id === contract.siteId);
    const customer = customers.find(c => c.id === contract.customerId);
    const salesperson = users.find(u => u.id === contract.salespersonId);

    // 1. 자동으로 이메일에 필요한 견적서/계약서/회사증빙/장비별점검표를 빌드하고 구글드라이브에 업로드
    documentBuilder.generateAndUploadAllDocs(contract, customer, cc, site, salesperson);
    
    setMailTo(cc?.email || '');
    setMailCc(site?.email || '');
    setMailSubject(`[렌탈계약 알림] ${getCustName(contract.customerId)} 계약 정보 안내 (${contract.contractNo})`);
    setMailBody(
      `안녕하세요, ${getCustName(contract.customerId)} 담당자님.\n\n` +
      `당사 렌탈 장비 계약이 체결 완료되어 안내드립니다.\n` +
      `계약번호: ${contract.contractNo}\n` +
      `계약기간: ${contract.startDate} ~ ${contract.endDate}\n\n` +
      `구글드라이브에 업로드된 계약 및 인수 서류를 첨부하여 전송합니다.\n` +
      `상세 내용은 첨부파일을 확인해 주시기 바랍니다.\n\n` +
      `감사합니다.\n(주)기연리프트`
    );

    // 디폴트 구글드라이브 첨부파일 선택 (계약 폴더 내에 있는 임대계약서 날인본 등 매핑)
    const folderFiles = drive.listFiles(contract.driveFolderId || '');
    const defaultPublic = drive.listAllFiles().filter(f => f.folderId === 'root'); // 공용양식
    const autoSelects = [...folderFiles, ...defaultPublic].map(f => f.id);
    setMailAttachmentIds(autoSelects);
  };

  const handleSendEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mailTo) {
      alert('수신자 이메일을 입력해 주세요.');
      return;
    }
    
    const config = googleConfigs[0];
    const isDev = config?.isDevMode !== false;
    if (isDev) {
      const confirmSend = window.confirm(
        "현재 시스템이 개발 모드입니다. 메일은 실제 수신인이 아닌 개발용 주소(77.victor.lee@gmail.com)로 우회되어 안전하게 발송됩니다. 발송하시겠습니까?"
      );
      if (!confirmSend) return;
    }

    setIsSendingMail(true);
    try {
      await emailService.sendEmail(mailTo, mailSubject, mailBody, mailAttachmentIds, mailCc);
      alert('구글 드라이브 첨부파일 포함 이메일이 성공적으로 발송되었습니다.');
      setMailTo('');
      setMailSubject('');
      setMailBody('');
      setMailAttachmentIds([]);
      setActiveTab('LIST');
    } catch (err) {
      alert('메일 전송에 실패했습니다.');
    } finally {
      setIsSendingMail(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: '24px', fontWeight: '700' }}>렌탈 계약 및 연동 관리</h2>

      {/* 대메뉴 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button className={activeTab === 'LIST' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('LIST')}>
          계약 리스트 / 조회
        </button>
        {canSave && (
          <>
            <button className={activeTab === 'CREATE' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('CREATE')}>
              <Plus size={14} /> 계약 등록 (출고의뢰 자동연동)
            </button>
            <button className={activeTab === 'MODIFY' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('MODIFY')}>
              <Calendar size={14} /> 계약 연장 / 단축 (회수의뢰 연동)
            </button>
            <button className={activeTab === 'TRANSFER' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('TRANSFER')}>
              <ArrowRight size={14} /> 계약 승계 (타사 잔여 승계)
            </button>
            <button className={activeTab === 'EMAIL' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('EMAIL')}>
              <Mail size={14} /> 계약 통지 메일 발송 (구글드라이브 연동)
            </button>
          </>
        )}
      </div>

      {activeTab === 'LIST' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'flex-start' }}>
          {/* 계약 목록 */}
          <div className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title" style={{ margin: 0 }}>계약 목록</h3>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={handleExportExcel}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '6px 12px' }}
              >
                <Download size={12} /> 엑셀 다운로드
              </button>
            </div>

            {/* 필터 바 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px', alignItems: 'end', backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px', display: 'block' }}>계약번호/고객사</label>
                <input 
                  type="text" 
                  value={tempSearchTerm} 
                  onChange={e => setTempSearchTerm(e.target.value)} 
                  placeholder="검색어 입력..."
                  style={{ width: '100%', padding: '6px', fontSize: '12.5px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px', display: 'block' }}>계약 상태</label>
                <select 
                  value={tempStatusFilter} 
                  onChange={e => setTempStatusFilter(e.target.value)} 
                  style={{ width: '100%', padding: '6px', fontSize: '12.5px' }}
                >
                  <option value="ALL">전체 상태</option>
                  <option value="ACTIVE">진행중 (ACTIVE)</option>
                  <option value="EXTENDED">연장됨 (EXTENDED)</option>
                  <option value="SHORTENED">단축됨 (SHORTENED)</option>
                  <option value="SUCCEEDED">승계됨 (SUCCEEDED)</option>
                  <option value="COMPLETED">종료됨 (COMPLETED)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px', display: 'block' }}>영업 담당자</label>
                <select 
                  value={tempSalespersonFilter} 
                  onChange={e => setTempSalespersonFilter(e.target.value)} 
                  style={{ width: '100%', padding: '6px', fontSize: '12.5px' }}
                >
                  <option value="ALL">전체 담당자</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <button 
                type="button" 
                className="btn-primary" 
                onClick={handleSearchClick}
                style={{ padding: '6px 12px', height: '33px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12.5px' }}
              >
                조회
              </button>
            </div>

            <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
              <table style={{ minWidth: '400px' }}>
                <thead>
                  <tr>
                    <th>계약번호</th>
                    <th>고객사</th>
                    <th>계약기간</th>
                    <th>상태</th>
                    <th>선택</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContracts.map(c => (
                    <tr key={c.id}>
                      <td><strong>{c.contractNo}</strong></td>
                      <td>{getCustName(c.customerId)}</td>
                      <td style={{ fontSize: '12px' }}>{c.startDate} ~ {c.endDate}</td>
                      <td>
                        <span className={`badge ${
                          c.status === 'ACTIVE' ? 'badge-success' :
                          c.status === 'EXTENDED' ? 'badge-info' :
                          c.status === 'SUCCEEDED' ? 'badge-warning' : 'badge-danger'
                        }`}>
                          {c.status === 'ACTIVE' ? '진행중' :
                           c.status === 'EXTENDED' ? '연장됨' :
                           c.status === 'SHORTENED' ? '단축됨' :
                           c.status === 'SUCCEEDED' ? '승계됨' : '종료'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn-secondary"
                          onClick={() => setSelectedContractId(c.id)}
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                        >
                          보기
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 계약 세부 내용 */}
          <div>
            {activeContract ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="card" style={{ margin: 0 }}>
                  <h3 className="card-title" style={{ marginBottom: '16px', color: 'var(--primary)' }}>
                    계약 상세 명세: {activeContract.contractNo}
                  </h3>
                  {!canModifyContract(activeContract) && (
                    <div style={{ padding: '8px 12px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--danger)', borderRadius: '6px', color: 'var(--danger)', fontSize: '12.5px', marginBottom: '12px' }}>
                      ⚠️ 본 계약의 담당 영업사원이 아니므로 변경 권한이 제한됩니다. (청구서포터 및 최고관리자는 수정 대행 가능)
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px', marginBottom: '20px' }}>
                    <div><label>고객사</label><strong>{getCustName(activeContract.customerId)}</strong></div>
                    <div><label>현장구분</label>{getSiteName(activeContract.siteId)}</div>
                    <div><label>계약담당자</label><strong>{users.find(u => u.id === activeContract.salespersonId)?.name || '지정없음'}</strong></div>
                    <div><label>계약시작일</label>{activeContract.startDate}</div>
                    <div><label>계약만료일</label>{activeContract.endDate}</div>
                    <div><label>청구 / 명세서 마감일</label>매월 {activeContract.billingDay}일 / {activeContract.statementClosingDay || '-'}일</div>
                    <div><label>구글드라이브 폴더</label>
                      <a href={`https://drive.google.com/drive/folders/${activeContract.driveFolderId}`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: '600' }}>
                        구글드라이브 열기 (링크)
                      </a>
                    </div>
                  </div>

                  <h4 style={{ fontWeight: '600', marginBottom: '10px', fontSize: '14px' }}>계약 체결 장비 목록</h4>
                  <div className="table-container" style={{ border: 'none', boxShadow: 'none', marginBottom: '20px' }}>
                    <table style={{ minWidth: '400px' }}>
                      <thead>
                        <tr>
                          <th>자산번호</th>
                          <th>모델명</th>
                          <th>월 렌탈료</th>
                          <th>관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeContractAssets.map(ca => {
                          const assetInfo = assets.find(a => a.id === ca.assetId);
                          return (
                            <tr key={ca.id}>
                              <td><strong>{assetInfo?.assetNo || '미지정'}</strong></td>
                              <td>{assetInfo?.modelName || ca.expectedModel}</td>
                              <td>{ca.monthlyRentalFee.toLocaleString()}원</td>
                              <td>
                                {ca.assetId && activeContract.status !== 'COMPLETED' && canSave && canModifyContract(activeContract) && (
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => handleOpenExchange(ca.id, ca.assetId!)}
                                    style={{ padding: '2px 8px', fontSize: '11px' }}
                                  >
                                    장비교체
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 계약 변동 이력 */}
                <div className="card" style={{ margin: 0 }}>
                  <h3 className="card-title" style={{ marginBottom: '12px' }}>계약 변경 이력</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {activeContractHistory.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>변동 이력이 없습니다.</div>
                    ) : (
                      activeContractHistory.map(h => (
                        <div key={h.id} style={{ padding: '8px', borderLeft: '3px solid var(--primary)', backgroundColor: 'var(--bg-app)', fontSize: '13px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}>
                            <span>{h.changeType === 'REGISTER' ? '신규등록' : h.changeType === 'EXTEND' ? '계약연장' : '계약단축/승계'}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{h.changeDate}</span>
                          </div>
                          <div style={{ marginTop: '4px' }}>{h.description}</div>
                          {h.prevEndDate && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              만료일 변경: {h.prevEndDate} → {h.newEndDate}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', margin: 0 }}>
                상세 정보를 조회할 계약을 왼쪽에서 선택해 주세요.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'CREATE' && (
        <div className="card" style={{ maxWidth: '800px', margin: 0 }}>
          <h3 className="card-title" style={{ marginBottom: '20px' }}>신규 렌탈 계약 체결</h3>
          <form onSubmit={handleCreateContractSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label>계약 고객사 선택 *</label>
                <select value={custSelect} onChange={e => {
                  setCustSelect(e.target.value);
                  setContactSelect('');
                  setSiteSelect('');
                }} required>
                  <option value="">-- 고객사 선택 --</option>
                  <option value="NEW">[NEW] -- 직접 입력 (신규 고객사) --</option>
                  {customers.filter(c => !c.isClosed).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label>계약담당자 (영업사원) *</label>
                <select value={salespersonSelect} onChange={e => setSalespersonSelect(e.target.value)} required>
                  <option value="">-- 계약담당자 선택 --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role === 'ADMIN' ? '관리자' : u.role === 'SALES' ? '영업' : u.role === 'REPAIR' ? '정비' : u.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label>청구 마감일자 기준 (일) *</label>
                <input
                  type="number"
                  value={billingDay}
                  onChange={e => setBillingDay(parseInt(e.target.value) || 30)}
                  min={1}
                  max={30}
                  required
                />
              </div>

              <div>
                <label>거래명세서 마감일자 기준 (일) *</label>
                <input
                  type="number"
                  value={statementClosingDay}
                  onChange={e => setStatementClosingDay(parseInt(e.target.value) || 25)}
                  min={1}
                  max={30}
                  required
                />
              </div>

              <div>
                <label>고객 담당자 선택</label>
                <select value={contactSelect} onChange={e => setContactSelect(e.target.value)}>
                  <option value="">-- 담당자 선택 안함 --</option>
                  <option value="NEW">[NEW] -- 직접 입력 (신규 담당자) --</option>
                  {contacts.filter(co => co.customerId === custSelect && co.isActive !== false).map(co => (
                    <option key={co.id} value={co.id}>{co.name} ({co.position})</option>
                  ))}
                </select>
              </div>

              <div>
                <label>출고 대상 현장 선택</label>
                <select value={siteSelect} onChange={e => setSiteSelect(e.target.value)}>
                  <option value="">-- 직납 (현장 없음) --</option>
                  <option value="NEW">[NEW] -- 직접 입력 (신규 현장) --</option>
                  {sites.filter(s => s.customerId === custSelect && s.isActive !== false).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label>임대 시작일자 *</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
              </div>

              <div>
                <label>임대 종료일자 *</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
              </div>
            </div>

            {/* 신규 고객사 직접 입력 카드 */}
            {custSelect === 'NEW' && (
              <div className="card" style={{ backgroundColor: 'var(--bg-app)', padding: '16px', marginBottom: '20px', border: '1px dashed var(--primary)' }}>
                <h4 style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--primary)', marginBottom: '10px' }}>신규 고객사 직접 입력</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px' }}>고객사명 *</label>
                    <input type="text" value={newCustName} onChange={e => setNewCustName(e.target.value)} placeholder="예: (주)한라건설" required={custSelect === 'NEW'} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px' }}>사업자등록번호</label>
                    <input type="text" value={newBizRegNo} onChange={e => setNewBizRegNo(e.target.value)} placeholder="예: 123-45-67890" />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px' }}>대표자명</label>
                    <input type="text" value={newRepresentative} onChange={e => setNewRepresentative(e.target.value)} placeholder="대표자 이름" />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px' }}>대표 연락처</label>
                    <input type="text" value={newRepContact} onChange={e => setNewRepContact(e.target.value)} placeholder="예: 02-123-4567" />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px' }}>대표 이메일</label>
                    <input type="email" value={newRepEmail} onChange={e => setNewRepEmail(e.target.value)} placeholder="email@company.com" />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px' }}>사업장 주소</label>
                    <input type="text" value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="본사 주소" />
                  </div>
                </div>
              </div>
            )}

            {/* 신규 담당자 직접 입력 카드 */}
            {contactSelect === 'NEW' && (
              <div className="card" style={{ backgroundColor: 'var(--bg-app)', padding: '16px', marginBottom: '20px', border: '1px dashed var(--primary)' }}>
                <h4 style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--primary)', marginBottom: '10px' }}>신규 고객 담당자 직접 입력</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px' }}>담당자명 *</label>
                    <input type="text" value={newContactName} onChange={e => setNewContactName(e.target.value)} placeholder="예: 홍길동" required={contactSelect === 'NEW'} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px' }}>직급</label>
                    <input type="text" value={newContactPosition} onChange={e => setNewContactPosition(e.target.value)} placeholder="예: 대리, 과장" />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px' }}>연락처 *</label>
                    <input type="text" value={newContactPhone} onChange={e => setNewContactPhone(e.target.value)} placeholder="예: 010-1234-5678" required={contactSelect === 'NEW'} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px' }}>이메일</label>
                    <input type="email" value={newContactEmail} onChange={e => setNewContactEmail(e.target.value)} placeholder="email@company.com" />
                  </div>
                </div>
              </div>
            )}

            {/* 신규 현장 직접 입력 카드 */}
            {siteSelect === 'NEW' && (
              <div className="card" style={{ backgroundColor: 'var(--bg-app)', padding: '16px', marginBottom: '20px', border: '1px dashed var(--primary)' }}>
                <h4 style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--primary)', marginBottom: '10px' }}>신규 현장 직접 입력</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '12px' }}>현장명 *</label>
                    <input type="text" value={newSiteName} onChange={e => setNewSiteName(e.target.value)} placeholder="예: 여의도 주상복합 신축공사 현장" required={siteSelect === 'NEW'} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '12px' }}>현장 주소 *</label>
                    <input type="text" value={newSiteAddress} onChange={e => setNewSiteAddress(e.target.value)} placeholder="현장 납품 주소" required={siteSelect === 'NEW'} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px' }}>현장 담당자명</label>
                    <input type="text" value={newSiteContactName} onChange={e => setNewSiteContactName(e.target.value)} placeholder="현장 담당 기사/소장 이름" />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px' }}>현장 연락처</label>
                    <input type="text" value={newSiteContactPhone} onChange={e => setNewSiteContactPhone(e.target.value)} placeholder="전화번호" />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '12px' }}>현장 이메일</label>
                    <input type="email" value={newSiteContactEmail} onChange={e => setNewSiteContactEmail(e.target.value)} placeholder="email@company.com" />
                  </div>
                </div>
              </div>
            )}

            {/* 리프트 장비 추가 바스켓 세션 */}
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>임대 투입 리프트 장비 바스켓 추가</h4>
              
              <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', fontSize: '13px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input type="radio" name="addMethod" checked={basketAssetMethod === 'ASSET'} onChange={() => setBasketAssetMethod('ASSET')} />
                  특정 실물 장비(호기) 지정 추가
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input type="radio" name="addMethod" checked={basketAssetMethod === 'MODEL'} onChange={() => setBasketAssetMethod('MODEL')} />
                  제품 모델 규격(미정 출고용) 지정 추가
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.2fr auto', gap: '12px', alignItems: 'end', marginBottom: '16px' }}>
                {basketAssetMethod === 'ASSET' ? (
                  <div>
                    <label>임대 가능 장비 목록</label>
                    <select value={selectedAssetToAdd} onChange={e => {
                      setSelectedAssetToAdd(e.target.value);
                      const asset = assets.find(a => a.id === e.target.value);
                      if (asset) {
                        setCustomMonthly(asset.monthlyRentalFee || 400000);
                        setCustomDaily(asset.dailyRentalFee || 15000);
                      }
                    }}>
                      <option value="">-- 대기 장비 선택 --</option>
                      {availableAssets.map(a => (
                        <option key={a.id} value={a.id}>{a.assetNo} - {a.modelName} (기준 월 {(a.monthlyRentalFee || 0).toLocaleString()}원)</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label>제품 규격 모델 목록</label>
                    <select value={selectedModelToAdd} onChange={e => {
                      setSelectedModelToAdd(e.target.value);
                      setCustomMonthly(400000);
                      setCustomDaily(15000);
                    }}>
                      <option value="">-- 모델 규격 선택 --</option>
                      {products.filter(p => p.isActive !== false).map(p => (
                        <option key={p.id} value={p.modelName}>{p.modelName} ({p.spec})</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label>합의 월 렌탈료 (원)</label>
                  <input type="number" value={customMonthly} onChange={e => setCustomMonthly(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label>합의 일 렌탈료 (원)</label>
                  <input type="number" value={customDaily} onChange={e => setCustomDaily(parseInt(e.target.value) || 0)} />
                </div>
                <button type="button" className="btn-secondary" onClick={handleAddToBasket}>
                  추가
                </button>
              </div>

              {/* 추가된 자재 바스켓 */}
              {basket.length > 0 && (
                <div className="table-container" style={{ border: 'none', boxShadow: 'none', margin: 0 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>임대 장비 / 모델규격</th>
                        <th>합의 월렌탈료</th>
                        <th>합의 일렌탈료</th>
                        <th style={{ width: '80px' }}>취소</th>
                      </tr>
                    </thead>
                    <tbody>
                      {basket.map((item, idx) => {
                        const asset = item.assetId ? assets.find(a => a.id === item.assetId) : null;
                        const key = item.assetId || item.expectedModel || `idx-${idx}`;
                        return (
                          <tr key={key}>
                            <td>
                              {item.assetId ? (
                                <span><span className="badge badge-success" style={{ marginRight: '6px' }}>호기지정</span><strong>{asset?.assetNo}</strong> ({asset?.modelName})</span>
                              ) : (
                                <span><span className="badge badge-warning" style={{ marginRight: '6px' }}>모델의뢰</span><strong>(미지정 모델) {item.expectedModel}</strong></span>
                              )}
                            </td>
                            <td>{item.monthlyRentalFee.toLocaleString()}원</td>
                            <td>{item.dailyRentalFee.toLocaleString()}원</td>
                            <td>
                              <button 
                                type="button" 
                                className="btn-danger" 
                                onClick={() => handleRemoveFromBasket(item.assetId || item.expectedModel)} 
                                style={{ padding: '2px 6px', fontSize: '11px' }}
                              >
                                삭제
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" className="btn-secondary" onClick={() => setActiveTab('LIST')}>취소</button>
              <button type="submit" className="btn-primary" disabled={basket.length === 0}>계약 체결 및 확정</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'MODIFY' && (
        <div className="card" style={{ maxWidth: '600px', margin: 0 }}>
          <h3 className="card-title" style={{ marginBottom: '20px' }}>계약 기간 임대 연장 / 단축 변경</h3>
          <form onSubmit={handlePeriodModSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label>변경할 계약 건 선택 *</label>
                <select value={modContractId} onChange={e => setModContractId(e.target.value)} required>
                  <option value="">-- 활성 렌탈 계약 선택 --</option>
                  {contracts.filter(c => (c.status === 'ACTIVE' || c.status === 'EXTENDED') && canModifyContract(c)).map(c => (
                    <option key={c.id} value={c.id}>{c.contractNo} - {getCustName(c.customerId)} (종료일: {c.endDate})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>변경 처리 구분 *</label>
                  <select value={modType} onChange={e => setModType(e.target.value as 'EXTEND' | 'SHORTEN')}>
                    <option value="EXTEND">계약 기간 연장 (Extend)</option>
                    <option value="SHORTEN">계약 조기 단축 (Shorten)</option>
                  </select>
                </div>
                <div>
                  <label>신규 만료 일자 *</label>
                  <input type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} required />
                </div>
              </div>

              <div>
                <label>변경 사유 명세 *</label>
                <textarea
                  value={modDesc}
                  onChange={e => setModDesc(e.target.value)}
                  placeholder="예: 공사 기간 증가에 따른 2달 추가 연장 합의 완료"
                  rows={3}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" className="btn-secondary" onClick={() => setActiveTab('LIST')}>취소</button>
              <button type="submit" className="btn-primary" disabled={!modContractId}>변경 실행</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'TRANSFER' && (
        <div className="card" style={{ maxWidth: '650px', margin: 0 }}>
          <h3 className="card-title" style={{ marginBottom: '20px' }}>계약 잔여 기간 타사 승계 (인수)</h3>
          <form onSubmit={handleSuccessionSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              
              {/* 기존 계약 */}
              <div>
                <label>승계할 기존 계약건 선택 *</label>
                <select value={succContractId} onChange={e => setSuccContractId(e.target.value)} required>
                  <option value="">-- 기존 진행 계약 선택 --</option>
                  {contracts.filter(c => (c.status === 'ACTIVE' || c.status === 'EXTENDED') && canModifyContract(c)).map(c => (
                    <option key={c.id} value={c.id}>{c.contractNo} - {getCustName(c.customerId)} (기간: ~{c.endDate})</option>
                  ))}
                </select>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

              {/* 신규 계약처 */}
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--primary)' }}>승계 인수 고객사 지정</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label>인수 고객사 *</label>
                    <select value={succCustId} onChange={e => {
                      setSuccCustId(e.target.value);
                      setSuccContactId('');
                      setSuccSiteId('');
                    }} required>
                      <option value="">-- 신규 인수사 선택 --</option>
                      {customers.filter(c => c.id !== contracts.find(co => co.id === succContractId)?.customerId).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label>승계 기준 일자 *</label>
                    <input type="date" value={succDate} onChange={e => setSuccDate(e.target.value)} required />
                    <small style={{ color: 'var(--text-muted)' }}>* 기존계약은 해당일에 종료, 신규계약은 다음날 자동개시</small>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>인수사 담당자</label>
                  <select value={succContactId} onChange={e => setSuccContactId(e.target.value)}>
                    <option value="">-- 선택 안함 --</option>
                    {contacts.filter(cc => cc.customerId === succCustId).map(cc => (
                      <option key={cc.id} value={cc.id}>{cc.name} ({cc.position})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>인수사 현장지정</label>
                  <select value={succSiteId} onChange={e => setSuccSiteId(e.target.value)}>
                    <option value="">-- 선택 안함 --</option>
                    {sites.filter(s => s.customerId === succCustId).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label>승계 특기 사유 *</label>
                <textarea
                  value={succDesc}
                  onChange={e => setSuccDesc(e.target.value)}
                  placeholder="예: 현대건설 하도급 사 변경에 따른 잔여 계약 기간 및 장비 승계 인계"
                  rows={2}
                  required
                />
              </div>

            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" className="btn-secondary" onClick={() => setActiveTab('LIST')}>취소</button>
              <button type="submit" className="btn-primary" disabled={!succContractId || !succCustId}>승계 처리 실행</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'EMAIL' && (
        <div className="card" style={{ maxWidth: '700px', margin: 0 }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <Mail className="text-primary" /> 구글 드라이브 문서 첨부 이메일 전송
          </h3>

          <form onSubmit={handleSendEmailSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label>대상 계약 건 선택 *</label>
                <select value={mailContractId} onChange={e => handleMailContractChange(e.target.value)} required>
                  <option value="">-- 계약 선택시 구글드라이브 폴더와 이메일이 연동됩니다 --</option>
                  {contracts.map(c => (
                    <option key={c.id} value={c.id}>{c.contractNo} - {getCustName(c.customerId)} (시작일: {c.startDate})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>수신자 이메일 (To) *</label>
                  <input type="email" value={mailTo} onChange={e => setMailTo(e.target.value)} placeholder="recipient@company.com" required />
                </div>
                <div>
                  <label>참조 이메일 (Cc)</label>
                  <input type="email" value={mailCc} onChange={e => setMailCc(e.target.value)} placeholder="cc@company.com" />
                </div>
              </div>

              <div>
                <label>이메일 제목 *</label>
                <input type="text" value={mailSubject} onChange={e => setMailSubject(e.target.value)} required />
              </div>

              <div>
                <label>이메일 본문 내용</label>
                <textarea value={mailBody} onChange={e => setMailBody(e.target.value)} rows={6} />
              </div>

              {/* 구글 드라이브 첨부파일 선택 체크박스 */}
              {mailContractId && (
                <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-app)' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px' }}>구글 드라이브 계약 연동 파일 목록 (첨부할 파일 선택)</h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* 해당 계약 하위 폴더의 파일 */}
                    {drive.listFiles(contracts.find(c => c.id === mailContractId)?.driveFolderId || '').map(f => (
                      <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'normal', margin: 0, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={mailAttachmentIds.includes(f.id)}
                          onChange={e => {
                            if (e.target.checked) setMailAttachmentIds([...mailAttachmentIds, f.id]);
                            else setMailAttachmentIds(mailAttachmentIds.filter(id => id !== f.id));
                          }}
                          style={{ width: '16px', height: '16px' }}
                        />
                        <FileText size={14} className="text-primary" /> {f.name} ({f.size}) - [계약업무폴더]
                      </label>
                    ))}

                    {/* 공용 루트의 폴더 파일 */}
                    {drive.listAllFiles().filter(f => f.folderId === 'root').map(f => (
                      <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'normal', margin: 0, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={mailAttachmentIds.includes(f.id)}
                          onChange={e => {
                            if (e.target.checked) setMailAttachmentIds([...mailAttachmentIds, f.id]);
                            else setMailAttachmentIds(mailAttachmentIds.filter(id => id !== f.id));
                          }}
                          style={{ width: '16px', height: '16px' }}
                        />
                        <FileText size={14} className="text-secondary" /> {f.name} ({f.size}) - [ERP공용양식]
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" className="btn-secondary" onClick={() => setActiveTab('LIST')}>취소</button>
              <button type="submit" className="btn-success" disabled={isSendingMail || !mailContractId}>
                {isSendingMail ? '발송 중...' : <><Send size={14} /> 메일 발송하기</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 장비 교체 모달 */}
      {showExchangeModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleExchangeSubmit} className="card" style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>장비 교체 (대차 처리)</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label>기존 장비</label>
                <input 
                  type="text" 
                  value={assets.find(a => a.id === exchangeOldAssetId) ? `${assets.find(a => a.id === exchangeOldAssetId)?.modelName} (관리번호: ${assets.find(a => a.id === exchangeOldAssetId)?.assetNo})` : ''} 
                  disabled 
                  style={{ width: '100%', padding: '8px', backgroundColor: 'var(--bg-body)' }}
                />
              </div>

              <div>
                <label>교체 장비 선택 *</label>
                <select 
                  value={exchangeNewAssetId} 
                  onChange={e => setExchangeNewAssetId(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px' }}
                >
                  <option value="">-- 가용 장비 선택 --</option>
                  {filteredAvailableAssets.map(a => (
                    <option key={a.id} value={a.id}>{a.modelName} (관리번호: {a.assetNo})</option>
                  ))}
                  {filteredAvailableAssets.length === 0 && (
                    <option disabled style={{ color: 'var(--danger)' }}>교체 가능한 동일 모델 가용 재고 없음</option>
                  )}
                </select>
              </div>

              <div>
                <label>교체 일자 *</label>
                <input 
                  type="date" 
                  value={exchangeDate} 
                  onChange={e => setExchangeDate(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '8px' }}
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                  * 교체일 당일까지는 기존 장비 요금이 일할 적용되며, 다음날부터 새 장비 요금이 청구됩니다.
                </small>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowExchangeModal(false)}>취소</button>
              <button type="submit" className="btn-primary" disabled={!exchangeNewAssetId}>교체 완료</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
