// @ts-nocheck
// src/pages/Contracts.tsx - 렌탈 계약 관리 (건조하고 직관적인 전문 용어 적용)
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Plus, Calendar, Search, Download, Edit3, Repeat, Clock, Wrench, ChevronLeft,
  Building2, ArrowLeftRight
} from 'lucide-react';
import { Contract, db, Customer, CustomerContact, CustomerSite, ContractAsset, ContractHistory, Delivery } from '../services/db';
import { exportToExcel } from '../services/excel';
import { ContractDocumentBundleModal } from '../components/ContractDocumentBundleModal';
import { FileText } from 'lucide-react';

export const Contracts: React.FC = () => {
  const {
    contracts, contractAssets, contractHistory, customers, contacts, sites, assets, users, currentUser,
    createContract, extendContract, shortenContract, succeedContract, exchangeAsset, hasPermission,
    products, refreshAllData, deliveries, repairs, outboundInspections
  } = useApp();

  const canSave = hasPermission('contract', 'save');

  // 6종 통합 서류팩 모달 상태
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [bundleTargetContractId, setBundleTargetContractId] = useState<string | undefined>(undefined);

  // 계약 변경 권한 검증 함수
  const canModifyContract = (contract: Contract) => {
    if (!currentUser) return false;
    if (currentUser.role === 'ADMIN') return true;
    if (hasPermission('billing', 'save')) return true;
    return contract.salespersonId === currentUser.id;
  };

  // 100% 화면 모드 전환 ('LIST': 목록 뷰 | 'DETAIL': 상세 뷰)
  const [viewMode, setViewMode] = useState<'LIST' | 'DETAIL'>('LIST');
  const [activeTab, setActiveTab] = useState<'ALL_LIST' | 'CREATE'>('ALL_LIST');

  // --- 계약 조회 필터 상태 ---
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [siteFilter, setSiteFilter] = useState('ALL');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [quickChipFilter, setQuickChipFilter] = useState<'ALL' | 'ACTIVE' | 'ASSIGNED' | 'D3' | 'ZERO_FEE' | 'SUCCEEDED' | 'COMPLETED'>('ALL');

  // 선택된 계약 ID
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

  // --- 계약 등록 폼 상태 ---
  const [custSelect, setCustSelect] = useState(customers[0]?.id || '');
  const [contactSelect, setContactSelect] = useState('');
  const [siteSelect, setSiteSelect] = useState('');
  const [salespersonSelect, setSalespersonSelect] = useState(currentUser?.id || '');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [isEndDateOpen, setIsEndDateOpen] = useState(false); // 종료일 미정 여부
  const [endDate, setEndDate] = useState(new Date(new Date().getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [billingDay, setBillingDay] = useState(30);
  const [statementClosingDay, setStatementClosingDay] = useState(25);

  // 신규 수동입력 세부 폼 상태
  const [newCustName, setNewCustName] = useState('');
  const [newBizRegNo, setNewBizRegNo] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newRepresentative, setNewRepresentative] = useState('');
  const [newRepContact, setNewRepContact] = useState('');
  const [newRepEmail, setNewRepEmail] = useState('');

  const [newContactName, setNewContactName] = useState('');
  const [newContactPosition, setNewContactPosition] = useState('담당자');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');

  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteAddress, setNewSiteAddress] = useState('');
  const [newSiteContactName, setNewSiteContactName] = useState('');
  const [newSiteContactPhone, setNewSiteContactPhone] = useState('');
  const [newSiteContactEmail, setNewSiteContactEmail] = useState('');
  
  // 등록 중 자산 바스켓
  const [basket, setBasket] = useState<{ assetId?: string; expectedModel?: string; monthlyRentalFee: number; dailyRentalFee: number }[]>([]);
  const [basketAssetMethod, setBasketAssetMethod] = useState<'ASSET' | 'MODEL'>('ASSET');
  const [selectedAssetToAdd, setSelectedAssetToAdd] = useState('');
  const [selectedModelToAdd, setSelectedModelToAdd] = useState('');
  const [customMonthly, setCustomMonthly] = useState(400000);
  const [customDaily, setCustomDaily] = useState(15000);

  // --- 💡 모달 팝업 상태들 ---
  // 1) 렌탈료 수정 모달
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [editCaId, setEditCaId] = useState('');
  const [editMonthlyFee, setEditMonthlyFee] = useState(0);
  const [editDailyFee, setEditDailyFee] = useState(0);
  const [feeChangeReason, setFeeChangeReason] = useState('');

  // 2) 만료일 / 연장/단축 모달
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [modIsOpen, setModIsOpen] = useState(false);
  const [modNewEndDate, setModNewEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [modDesc, setModDesc] = useState('');

  // 3) 계약 승계 모달
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [succCustId, setSuccCustId] = useState('');
  const [succContactId, setSuccContactId] = useState('');
  const [succSiteId, setSuccSiteId] = useState('');
  const [succDate, setSuccDate] = useState(new Date().toISOString().split('T')[0]);
  const [succDesc, setSuccDesc] = useState('');

  // 4) 장비 교체(대차) 모달
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [exchangeContractAssetId, setExchangeContractAssetId] = useState('');
  const [exchangeOldAssetId, setExchangeOldAssetId] = useState('');
  const [exchangeNewAssetId, setExchangeNewAssetId] = useState('');
  const [exchangeDate, setExchangeDate] = useState(new Date().toISOString().split('T')[0]);
  const [exchangeTimeSlot, setExchangeTimeSlot] = useState('오전 (08:00 ~ 12:00)');
  const [exchangeIdentifyType, setExchangeIdentifyType] = useState<'KNOWN' | 'UNKNOWN'>('KNOWN');
  const [exchangeReason, setExchangeReason] = useState('');

  // 헬퍼
  const getCustName = (id: string) => customers.find(c => c.id === id)?.name || '-';
  const getSiteName = (id?: string) => sites.find(s => s.id === id)?.name || '-';
  const getContactName = (id?: string) => contacts.find(c => c.id === id)?.name || '-';

  // 오늘 날짜 및 D-Day 계산
  const todayStr = new Date().toISOString().split('T')[0];

  const getDDayText = (endDateStr?: string) => {
    if (!endDateStr || endDateStr === '미정') return { text: '미정', isWarning: false };
    const diff = Math.ceil((new Date(endDateStr).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: `D+${Math.abs(diff)}일`, isWarning: true };
    if (diff === 0) return { text: 'D-DAY', isWarning: true };
    if (diff <= 3) return { text: `D-${diff}일`, isWarning: true };
    return { text: `D-${diff}일`, isWarning: false };
  };

  // 💡 다차원 필터링 (고객사, 현장, 시작일, 종료일)
  const filteredContracts = useMemo(() => {
    return contracts.filter(c => {
      const custName = getCustName(c.customerId).toLowerCase();
      const siteName = getSiteName(c.siteId).toLowerCase();
      const contactName = getContactName(c.contactId).toLowerCase();
      const cas = contractAssets.filter(ca => ca.contractId === c.id);
      const assetNos = cas.map(ca => assets.find(a => a.id === ca.assetId)?.assetNo || '').join(' ').toLowerCase();

      const q = searchTerm.trim().toLowerCase();
      const matchesSearch = !q ||
        c.contractNo.toLowerCase().includes(q) ||
        custName.includes(q) ||
        siteName.includes(q) ||
        contactName.includes(q) ||
        assetNos.includes(q);

      const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
      const matchesCustomer = customerFilter === 'ALL' || c.customerId === customerFilter;
      const matchesSite = siteFilter === 'ALL' || c.siteId === siteFilter;
      const matchesStartDate = !startDateFilter || (c.startDate && c.startDate >= startDateFilter);
      const matchesEndDate = !endDateFilter || (c.endDate && c.endDate !== '미정' && c.endDate <= endDateFilter);

      let matchesChip = true;
      if (quickChipFilter === 'ACTIVE') matchesChip = c.status === 'ACTIVE' || c.status === 'EXTENDED';
      else if (quickChipFilter === 'ASSIGNED') matchesChip = cas.some(ca => assets.find(a => a.id === ca.assetId)?.status === 'ASSIGNED');
      else if (quickChipFilter === 'D3') {
        const dday = getDDayText(c.endDate);
        matchesChip = dday.isWarning;
      } else if (quickChipFilter === 'ZERO_FEE') {
        matchesChip = cas.some(ca => ca.monthlyRentalFee === 0);
      } else if (quickChipFilter === 'SUCCEEDED') matchesChip = c.status === 'SUCCEEDED';
      else if (quickChipFilter === 'COMPLETED') matchesChip = c.status === 'COMPLETED';

      return matchesSearch && matchesStatus && matchesCustomer && matchesSite && matchesStartDate && matchesEndDate && matchesChip;
    });
  }, [contracts, contractAssets, assets, customers, sites, contacts, searchTerm, statusFilter, customerFilter, siteFilter, startDateFilter, endDateFilter, quickChipFilter]);

  // 선택된 계약 관련 데이터
  const activeContract = contracts.find(c => c.id === selectedContractId);
  const activeContractHistory = contractHistory.filter(h => h.contractId === selectedContractId);
  const activeContractAssets = contractAssets.filter(ca => ca.contractId === selectedContractId);

  // 📜 계약 변경 및 이력 타임라인
  const activeTimeline = useMemo(() => {
    if (!activeContract) return [];

    const timeline: { id: string; date: string; title: string; desc: string; category: 'CONTRACT' | 'INSPECTION' | 'TRUCK' | 'REPAIR' }[] = [];

    // 1. 계약 변경 및 대차 교체 이력
    activeContractHistory.forEach(h => {
      const isExchange = h.changeType === 'EXCHANGE' || h.description.includes('대차') || h.description.includes('교체');
      
      let historyTitle = '계약 이력';
      if (isExchange) {
        historyTitle = '🔄 자산 대차/교체 이력';
      } else if (h.changeType === 'FEE_CHANGE' || h.description?.includes('렌탈료') || h.description?.includes('단가')) {
        if (h.description.includes('월/일') || (h.description.includes('월') && h.description.includes('일'))) {
          historyTitle = '💰 월/일 렌탈료 단가 변경';
        } else if (h.description.includes('일 렌탈료') || h.description.includes('일 단가') || h.description.includes('일단가')) {
          historyTitle = '💰 일 렌탈료 단가 변경';
        } else {
          historyTitle = '💰 월 렌탈료 단가 변경';
        }
      } else if (h.changeType === 'REGISTER') {
        historyTitle = '계약 등록';
      } else if (h.changeType === 'EXTEND') {
        historyTitle = '기간 변경';
      } else if (h.changeType === 'SHORTEN') {
        historyTitle = '기간 단축';
      } else if (h.changeType === 'SUCCEED') {
        historyTitle = '계약 승계';
      }

      timeline.push({
        id: `h-${h.id}`,
        date: h.changeDate || h.createdAt?.split('T')[0] || todayStr,
        title: historyTitle,
        desc: h.description,
        category: 'CONTRACT'
      });
    });

    // 2. 출고 검수 이력
    const relInsps = outboundInspections.filter(o => o.contractId === activeContract.id);
    relInsps.forEach(i => {
      const asset = assets.find(a => a.id === i.assetId);
      timeline.push({
        id: `i-${i.id}`,
        date: i.inspectedAt?.split('T')[0] || i.createdAt.split('T')[0],
        title: i.status === 'COMPLETED' ? `출고 검수 승인 (${asset?.assetNo || '자산'})` : `출고 검수 대기/반려`,
        desc: i.note || '검수 체크리스트 확인',
        category: 'INSPECTION'
      });
    });

    // 3. 배차 이력
    const relDels = deliveries.filter(d => d.contractId === activeContract.id);
    relDels.forEach(d => {
      const cost = d.finalCost || d.deliveryCostConfirmed || d.deliveryCost || d.expectedCost || 0;
      const dDate = d.loadingDate || d.scheduledDate || d.requestDate || d.createdAt.split('T')[0];
      timeline.push({
        id: `d-${d.id}`,
        date: dDate,
        title: `배차 (${d.type === 'OUTBOUND' ? '출고' : '회수'})`,
        desc: `${d.driverName ? `기사: ${d.driverName} (${d.driverContact || ''})` : '배차 대기'} / 운반비: ${cost.toLocaleString()}원`,
        category: 'TRUCK'
      });
    });

    // 4. 수리 이력
    const relAssetIds = activeContractAssets.map(ca => ca.assetId).filter((id): id is string => Boolean(id));
    const relReps = repairs.filter(r => relAssetIds.includes(r.assetId));
    relReps.forEach(r => {
      const asset = assets.find(a => a.id === r.assetId);
      const rDate = r.repairDate || r.completedDate || r.requestDate || r.createdAt.split('T')[0];
      timeline.push({
        id: `r-${r.id}`,
        date: rDate,
        title: `자산 정비 (${asset?.assetNo || '자산'})`,
        desc: `내용: ${r.details || '정비 완료'} / 비용: ${(r.totalCost || 0).toLocaleString()}원`,
        category: 'REPAIR'
      });
    });

    return timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeContract, activeContractHistory, outboundInspections, deliveries, repairs, activeContractAssets, assets, todayStr]);

  // 핸들러
  const handleSelectContract = (contractId: string) => {
    setSelectedContractId(contractId);
    setViewMode('DETAIL');
  };

  const handleOpenFeeModal = (ca: ContractAsset) => {
    setEditCaId(ca.id);
    setEditMonthlyFee(ca.monthlyRentalFee || 0);
    setEditDailyFee(ca.dailyRentalFee || 0);
    setFeeChangeReason('');
    setShowFeeModal(true);
  };

  const handleSaveFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCaId || !selectedContractId) return;

    try {
      const ca = db.contractAssets.find(c => c.id === editCaId);
      const asset = assets.find(a => a.id === ca?.assetId);
      const oldMonthly = ca?.monthlyRentalFee || 0;
      const oldDaily = ca?.dailyRentalFee || 0;

      const isMonthlyChanged = oldMonthly !== editMonthlyFee;
      const isDailyChanged = oldDaily !== editDailyFee;

      db.updateRow<ContractAsset>('contractAssets', editCaId, {
        monthlyRentalFee: editMonthlyFee,
        dailyRentalFee: editDailyFee
      });

      const assetTag = asset?.assetNo || ca?.expectedModel || '자산';
      let changeDesc = '';

      if (isMonthlyChanged && isDailyChanged) {
        changeDesc = `월/일 렌탈료 단가 수정 [${assetTag}]: (월 ${oldMonthly.toLocaleString()}원 ➔ ${editMonthlyFee.toLocaleString()}원, 일 ${oldDaily.toLocaleString()}원 ➔ ${editDailyFee.toLocaleString()}원) (사유: ${feeChangeReason || '단가 조정'})`;
      } else if (isDailyChanged) {
        changeDesc = `일 렌탈료 단가 수정 [${assetTag}]: ${oldDaily.toLocaleString()}원 ➔ ${editDailyFee.toLocaleString()}원 (사유: ${feeChangeReason || '단가 조정'})`;
      } else {
        changeDesc = `월 렌탈료 단가 수정 [${assetTag}]: ${oldMonthly.toLocaleString()}원 ➔ ${editMonthlyFee.toLocaleString()}원 (사유: ${feeChangeReason || '단가 조정'})`;
      }

      db.insertRow<ContractHistory>('contractHistory', {
        contractId: selectedContractId,
        changeType: 'FEE_CHANGE',
        changeDate: todayStr,
        description: changeDesc,
        createdAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
      alert('렌탈료 변경 사항이 저장되었습니다.');
      setShowFeeModal(false);
    } catch (err: any) {
      alert(`저장 실패: ${err?.message || err}`);
    }
  };

  const handleOpenExtendModal = () => {
    if (!activeContract) return;
    setModIsOpen(activeContract.endDate === '미정');
    setModNewEndDate(activeContract.endDate && activeContract.endDate !== '미정' ? activeContract.endDate : todayStr);
    setModDesc('');
    setShowExtendModal(true);
  };

  const handleSaveExtend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeContract) return;

    try {
      const targetEndDate = modIsOpen ? '미정' : modNewEndDate;
      const prevEnd = activeContract.endDate;

      db.updateRow<Contract>('contracts', activeContract.id, {
        endDate: targetEndDate,
        updatedAt: new Date().toISOString()
      });

      db.insertRow<ContractHistory>('contractHistory', {
        contractId: activeContract.id,
        changeType: 'EXTEND',
        changeDate: todayStr,
        description: `계약 기간 변경: ${prevEnd || '미정'} ➔ ${targetEndDate} (사유: ${modDesc || '기간 조정'})`,
        createdAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
      alert(`계약 만료일이 [${targetEndDate}]로 변경되었습니다.`);
      setShowExtendModal(false);
    } catch (err: any) {
      alert(`저장 실패: ${err?.message || err}`);
    }
  };

  const handleOpenTransferModal = () => {
    if (!activeContract) return;
    setSuccCustId('');
    setSuccContactId('');
    setSuccSiteId('');
    setSuccDate(todayStr);
    setSuccDesc('');
    setShowTransferModal(true);
  };

  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeContract || !succCustId) {
      alert('양수 고객사를 선택하십시오.');
      return;
    }

    try {
      succeedContract(activeContract.id, succCustId, succContactId, succSiteId, succDate, succDesc);
      alert('계약 승계가 완료되었습니다.');
      setShowTransferModal(false);
    } catch (err: any) {
      alert(`승계 실패: ${err?.message || err}`);
    }
  };

  const handleOpenExchangeGlobal = () => {
    setExchangeContractAssetId('');
    setExchangeOldAssetId(activeContractAssets[0]?.assetId || '');
    setExchangeNewAssetId('');
    setExchangeDate(todayStr);
    setExchangeIdentifyType('KNOWN');
    setExchangeReason('');
    setShowExchangeModal(true);
  };

  const handleExchangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !selectedContractId) return;

    // 💡 [ERR-003] 중복 대차 방지: 동일 계약에 처리 대기 중인 EXCHANGE 배차/슬롯이 이미 존재하는지 검증
    const pendingExchangeDelivery = deliveries.find(d => 
      d.contractId === selectedContractId && 
      d.type === 'EXCHANGE' && 
      (d.status === 'REQUESTED' || d.status === 'PENDING' || d.status === 'DISPATCHED')
    );
    const unassignedExchangeSlot = contractAssets.find(ca => 
      ca.contractId === selectedContractId && 
      !ca.assetId
    );

    if (pendingExchangeDelivery || unassignedExchangeSlot) {
      alert(`⚠️ [대차 의뢰 중복 불가]\n\n해당 계약에 이미 처리 대기 중인 대차/교체 배차 또는 미할당 슬롯이 존재합니다.\n기존 대차가 완료된 후 추가 의뢰를 진행해 주십시오.`);
      return;
    }

    try {
      const oldAssetObj = assets.find(a => a.id === exchangeOldAssetId);
      const targetModelName = exchangeIdentifyType === 'KNOWN' 
        ? (oldAssetObj?.modelName || '동일/동급 모델')
        : (exchangeContractAssetId || activeContractAssets[0]?.expectedModel || '동일/동급 모델');

      const isKnown = exchangeIdentifyType === 'KNOWN';
      const identifyTag = isKnown 
        ? `[식별됨] 관리번호:${oldAssetObj?.assetNo || '미지정'} / SN:${oldAssetObj?.serialNo || '미지정'}`
        : `[미식별] 모델명(${targetModelName}) 현장 입고 검수 시 자산 확정 필요`;

      // 💡 [ERR-001] 기존 자산 ContractAsset 종료 처리 (endDate 고정, status=RETURNED, actualReturnDate)
      const targetOldContractAsset = contractAssets.find(ca => 
        ca.contractId === selectedContractId && 
        (exchangeOldAssetId ? ca.assetId === exchangeOldAssetId : ca.id === exchangeContractAssetId)
      );

      if (targetOldContractAsset) {
        db.updateRow<ContractAsset>('contractAssets', targetOldContractAsset.id, {
          endDate: exchangeDate,
          status: 'RETURNED',
          actualReturnDate: exchangeDate,
          updatedAt: new Date().toISOString()
        });
      }

      // 1. contractHistory 기록
      db.insertRow<ContractHistory>('contractHistory', {
        contractId: selectedContractId,
        changeType: 'EXCHANGE',
        changeDate: exchangeDate,
        description: `[대차/교체 의뢰 접수] ${identifyTag} / 회수모델: ${targetModelName} / 사유: ${exchangeReason || '현장 고장/스펙 변경 요청'} — 기존 계약 조건(렌탈료, 마감일, 현장조건) 100% 자동 상속 (기존자산 종료일: ${exchangeDate})`,
        createdAt: new Date().toISOString()
      });

      // 2. 후속 업무 흐름 연계: 단일 대차 요구에 대해 'EXCHANGE' (교환 왕복 배차) 1건만 발행
      db.insertRow<Delivery>('deliveries', {
        contractId: selectedContractId,
        type: 'EXCHANGE',
        dispatchCategory: '교환',
        status: 'REQUESTED',
        requestDate: exchangeDate,
        scheduledDate: exchangeDate,
        loadingTimeSlot: exchangeTimeSlot,
        unloadingTimeSlot: exchangeTimeSlot,
        memo: `[대차/교환 왕복 배차] 희망시간: ${exchangeTimeSlot} | 회수대상: ${isKnown ? `${oldAssetObj?.assetNo}(${targetModelName})` : `${targetModelName}(미식별)`} ➔ 대차출고요구: ${targetModelName} | 사유: ${exchangeReason}`,
        vehicleType: '5톤 렉카',
        driverName: '',
        deliveryCost: 0,
        deliveryCostConfirmed: 0,
        isCostSettled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // 3. 후속 업무 흐름 연계: 출고 부서를 위한 대차 출고 슬롯(ContractAsset) 자동 추가
      db.insertRow<ContractAsset>('contractAssets', {
        contractId: selectedContractId,
        assetId: undefined, // 미할당 상태로 생성하여 출고 부서(asset_assignment.tsx)로 할당 요청
        expectedModel: targetModelName,
        monthlyRentalFee: targetOldContractAsset?.monthlyRentalFee || activeContractAssets[0]?.monthlyRentalFee || 0,
        dailyRentalFee: targetOldContractAsset?.dailyRentalFee || activeContractAssets[0]?.dailyRentalFee || 0,
        startDate: exchangeDate,
        endDate: activeContract?.endDate || '미정',
        createdAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
      alert(`✅ [대차/교체 의뢰 접수 성공]\n\n1. 회수 배차 건이 [배차 관리] 메뉴로 자동 발행되었습니다. (${isKnown ? '자산번호 식별' : '현장 미식별 검수대기'})\n2. 기존 자산은 [${exchangeDate}] 일자로 종료 처리되었습니다.\n3. 대차 출고 할당 요청이 [장비 할당] 카드 보드 최상단으로 즉시 연동되었습니다.`);

      setShowExchangeModal(false);
      setExchangeNewAssetId('');
      setExchangeReason('');
    } catch (err: any) {
      alert(`대차 의뢰 접수 실패: ${err?.message || err}`);
    }
  };

  const handleExportExcel = () => {
    const excelData = filteredContracts.map((c, idx) => ({
      'No': idx + 1,
      '계약번호': c.contractNo,
      '고객사': getCustName(c.customerId),
      '현장명': getSiteName(c.siteId),
      '담당자': getContactName(c.contactId),
      '영업담당': users.find(u => u.id === c.salespersonId)?.name || '-',
      '시작일': c.startDate,
      '만료일': c.endDate || '미정',
      '청구마감일': `매월 ${c.billingDay}일`,
      '상태': c.status === 'ACTIVE' ? '진행중' :
             c.status === 'EXTENDED' ? '연장됨' :
             c.status === 'SUCCEEDED' ? '승계됨' : '종료',
    }));

    exportToExcel(excelData, `계약대장_${todayStr}`, '계약목록');
  };

  const availableAssets = assets.filter(a => a.status === 'AVAILABLE');
  const oldAssetToExchange = assets.find(a => a.id === exchangeOldAssetId);
  const filteredAvailableAssets = assets.filter(a => a.status === 'AVAILABLE' && (oldAssetToExchange ? a.modelName === oldAssetToExchange.modelName : true));

  const handleAddToBasket = () => {
    if (basketAssetMethod === 'ASSET') {
      if (!selectedAssetToAdd) return;
      if (basket.some(b => b.assetId === selectedAssetToAdd)) return;
      setBasket([...basket, { assetId: selectedAssetToAdd, monthlyRentalFee: customMonthly, dailyRentalFee: customDaily }]);
      setSelectedAssetToAdd('');
    } else {
      if (!selectedModelToAdd) return;
      if (basket.some(b => b.expectedModel === selectedModelToAdd)) return;
      setBasket([...basket, { expectedModel: selectedModelToAdd, monthlyRentalFee: customMonthly, dailyRentalFee: customDaily }]);
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

    if (custSelect !== 'NEW' && custSelect) {
      const selectedCustomer = customers.find(c => c.id === custSelect);
      if (selectedCustomer?.transactionStatus === 'BLOCKED') {
        alert('거래 불가 상태인 거래처입니다.');
        return;
      }
    }

    if (basket.length === 0) {
      alert('최소 한 대 이상의 자산을 추가하십시오.');
      return;
    }

    let finalCustomerId = custSelect;
    let finalContactId = contactSelect;
    let finalSiteId = siteSelect;

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
    }

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

    const finalSalespersonId = salespersonSelect || currentUser?.id;

    createContract({
      customerId: finalCustomerId,
      contactId: finalContactId && finalContactId !== 'NEW' ? finalContactId : undefined,
      siteId: finalSiteId && finalSiteId !== 'NEW' ? finalSiteId : undefined,
      salespersonId: finalSalespersonId,
      startDate: startDate,
      endDate: isEndDateOpen ? '미정' : endDate,
      billingDay: Number(billingDay),
      statementClosingDay: Number(statementClosingDay),
      status: 'ACTIVE'
    }, basket);

    alert('계약 등록이 완료되었습니다.');
    setActiveTab('ALL_LIST');
    setViewMode('LIST');
    setBasket([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
      
      {/* 최상단 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)', padding: '14px 18px', borderRadius: '8px', border: '1px solid var(--border-color)', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {viewMode === 'DETAIL' && (
            <button
              className="btn-secondary"
              onClick={() => setViewMode('LIST')}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', fontSize: '12px' }}
            >
              <ChevronLeft size={16} /> 목록으로 돌아가기
            </button>
          )}
          <div>
            <h2 style={{ fontWeight: '700', marginBottom: '2px', fontSize: '18px' }}>
              {viewMode === 'DETAIL' ? `계약 상세: ${activeContract?.contractNo}` : '계약 관리'}
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              {viewMode === 'DETAIL'
                ? `${getCustName(activeContract?.customerId || '')} — ${getSiteName(activeContract?.siteId)}`
                : '계약 등록, 상태 변경, 기간 조정 및 승계 내역을 관리합니다.'}
            </p>
          </div>
        </div>

        {viewMode === 'LIST' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={activeTab === 'ALL_LIST' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setActiveTab('ALL_LIST')}
              style={{ padding: '7px 14px', fontSize: '12px' }}
            >
              계약 목록 ({filteredContracts.length})
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setBundleTargetContractId(undefined);
                setShowBundleModal(true);
              }}
              style={{ padding: '7px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', fontWeight: 'bold' }}
            >
              <FileText size={14} /> 7종 통합 서류팩 PDF / 이메일
            </button>
            {canSave && (
              <button
                className={activeTab === 'CREATE' ? 'btn-success' : 'btn-secondary'}
                onClick={() => setActiveTab('CREATE')}
                style={{ padding: '7px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={14} /> 신규 계약 등록
              </button>
            )}
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 뷰 1: 계약 목록 (viewMode === 'LIST') */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {viewMode === 'LIST' && activeTab === 'ALL_LIST' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* 필터 패널 */}
          <div className="card" style={{ padding: '14px', margin: 0, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* 1행: 검색어 & 엑셀 다운로드 */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-app)', padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <Search size={16} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="통합 검색 (계약번호, 고객사명, 현장명, 자산번호, 담당자명...)"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ flex: 1, border: 'none', backgroundColor: 'transparent', fontSize: '13px', outline: 'none', color: 'var(--text-primary)' }}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} style={{ border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>✕</button>
                )}
              </div>

              <button className="btn-secondary" onClick={handleExportExcel} style={{ padding: '8px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Download size={14} /> 엑셀 다운로드
              </button>
            </div>

            {/* 2행: 고객사, 현장, 시작일, 종료일 세부 상세 필터 (레이블 상단 헤더 세로 스택 구조) */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', backgroundColor: 'var(--bg-app)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', overflowX: 'auto' }}>
              {/* 고객사 기준 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>고객사 선택</label>
                <select
                  value={customerFilter}
                  onChange={e => {
                    setCustomerFilter(e.target.value);
                    setSiteFilter('ALL');
                  }}
                  style={{ padding: '6px 10px', borderRadius: '6px', fontSize: '12.5px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', whiteSpace: 'nowrap', minWidth: '150px' }}
                >
                  <option value="ALL">전체 고객사</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* 현장 기준 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>현장 선택</label>
                <select
                  value={siteFilter}
                  onChange={e => setSiteFilter(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '6px', fontSize: '12.5px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', whiteSpace: 'nowrap', minWidth: '150px' }}
                >
                  <option value="ALL">전체 현장</option>
                  {(customerFilter === 'ALL' ? sites : sites.filter(s => s.customerId === customerFilter)).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* 계약 시작일 (이후) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>계약 시작일 (이후)</label>
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={e => setStartDateFilter(e.target.value)}
                  style={{ padding: '5px 8px', borderRadius: '6px', fontSize: '12px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}
                />
              </div>

              {/* 계약 종료일 (이전) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>계약 종료일 (이전)</label>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={e => setEndDateFilter(e.target.value)}
                  style={{ padding: '5px 8px', borderRadius: '6px', fontSize: '12px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}
                />
              </div>

              {/* 명시적 [조회] 버튼 */}
              <button
                className="btn-primary"
                onClick={() => {
                  // 명시적 조회 실행
                }}
                style={{
                  padding: '6px 16px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  height: '33px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Search size={14} /> 조회
              </button>

              {/* 필터 초기화 버튼 */}
              {(customerFilter !== 'ALL' || siteFilter !== 'ALL' || startDateFilter || endDateFilter) && (
                <button
                  onClick={() => {
                    setCustomerFilter('ALL');
                    setSiteFilter('ALL');
                    setStartDateFilter('');
                    setEndDateFilter('');
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    height: '33px'
                  }}
                >
                  필터 초기화 ✕
                </button>
              )}
            </div>

            {/* 3행: 상태 필터 칩 */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}>상태 필터:</span>
              {[
                { id: 'ALL', label: `전체 (${contracts.length})` },
                { id: 'ACTIVE', label: `진행중 (${contracts.filter(c => c.status === 'ACTIVE' || c.status === 'EXTENDED').length})` },
                { id: 'D3', label: `만료 임박 (${contracts.filter(c => getDDayText(c.endDate).isWarning).length})` },
                { id: 'ZERO_FEE', label: `렌탈료 0원 (${contracts.filter(c => contractAssets.filter(ca => ca.contractId === c.id).some(ca => ca.monthlyRentalFee === 0)).length})` },
                { id: 'SUCCEEDED', label: `승계건 (${contracts.filter(c => c.status === 'SUCCEEDED').length})` },
                { id: 'COMPLETED', label: `종결건 (${contracts.filter(c => c.status === 'COMPLETED').length})` }
              ].map(chip => (
                <button
                  key={chip.id}
                  onClick={() => setQuickChipFilter(chip.id as any)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    border: `1px solid ${quickChipFilter === chip.id ? 'var(--primary)' : 'var(--border-color)'}`,
                    backgroundColor: quickChipFilter === chip.id ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card)',
                    color: quickChipFilter === chip.id ? 'var(--primary)' : 'var(--text-secondary)',
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* 계약 목록 데이터 테이블 (횡 스크롤 지원 & 셀 줄바꿈 방지) */}
          <div className="card" style={{ padding: 0, margin: 0, overflowX: 'auto' }}>
            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '1200px', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-app)', whiteSpace: 'nowrap' }}>
                    <th style={{ textAlign: 'center', whiteSpace: 'nowrap', width: '80px' }}>상세 보기</th>
                    <th style={{ whiteSpace: 'nowrap' }}>계약번호</th>
                    <th style={{ whiteSpace: 'nowrap' }}>고객사명</th>
                    <th style={{ whiteSpace: 'nowrap' }}>현장명</th>
                    <th style={{ whiteSpace: 'nowrap' }}>체결 자산</th>
                    <th style={{ whiteSpace: 'nowrap' }}>월 렌탈료</th>
                    <th style={{ whiteSpace: 'nowrap' }}>계약 기간</th>
                    <th style={{ whiteSpace: 'nowrap' }}>만료 D-Day</th>
                    <th style={{ whiteSpace: 'nowrap' }}>청구 마감일</th>
                    <th style={{ whiteSpace: 'nowrap' }}>영업담당</th>
                    <th style={{ whiteSpace: 'nowrap' }}>상태</th>
                  </tr>
                </thead>
                <tbody style={{ whiteSpace: 'nowrap' }}>
                  {filteredContracts.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                        조회 결과가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredContracts.map(c => {
                      const cas = contractAssets.filter(ca => ca.contractId === c.id);
                      const totalFee = cas.reduce((sum, ca) => sum + (ca.monthlyRentalFee || 0), 0);
                      const dday = getDDayText(c.endDate);
                      const hasZeroFee = cas.some(ca => ca.monthlyRentalFee === 0);

                      // 💡 자산 표기: 모델명 * 수량 요약 집계 (예: GS-1930 2대, GS-3246 1대)
                      const modelCountMap: Record<string, number> = {};
                      cas.forEach(ca => {
                        const a = assets.find(ast => ast.id === ca.assetId);
                        const modelName = a?.modelName || ca.expectedModel || '미지정 모델';
                        modelCountMap[modelName] = (modelCountMap[modelName] || 0) + 1;
                      });

                      const modelSummaryText = Object.entries(modelCountMap)
                        .map(([model, count]) => `${model} ${count}대`)
                        .join(', ');

                      return (
                        <tr
                          key={c.id}
                          style={{ whiteSpace: 'nowrap' }}
                          className="hover-row"
                        >
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <button
                              className="btn-primary"
                              style={{ padding: '3px 10px', fontSize: '11px' }}
                              onClick={() => handleSelectContract(c.id)}
                            >
                              상세 ➔
                            </button>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}><strong style={{ color: 'var(--primary)' }}>{c.contractNo}</strong></td>
                          <td style={{ whiteSpace: 'nowrap' }}><strong>{getCustName(c.customerId)}</strong></td>
                          <td style={{ whiteSpace: 'nowrap' }}>{getSiteName(c.siteId)}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <strong style={{ color: 'var(--text-primary)' }}>{modelSummaryText || '미지정'}</strong>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>(총 {cas.length}대)</span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {hasZeroFee ? (
                              <span style={{ color: 'var(--danger)', fontWeight: 700 }}>0원 (미입력)</span>
                            ) : (
                              <span>{totalFee.toLocaleString()}원</span>
                            )}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>{c.startDate} ~ {c.endDate || '미정'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {dday.isWarning ? (
                              <span className="badge badge-danger" style={{ fontSize: '10px' }}>{dday.text}</span>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{dday.text}</span>
                            )}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>매월 {c.billingDay}일</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{users.find(u => u.id === c.salespersonId)?.name || '-'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span className={
                              c.status === 'ACTIVE' || c.status === 'EXTENDED' ? 'badge badge-success' :
                              c.status === 'SUCCEEDED' ? 'badge badge-info' : 'badge badge-secondary'
                            }>
                              {c.status === 'ACTIVE' ? '진행중' : c.status === 'EXTENDED' ? '연장됨' : c.status === 'SUCCEEDED' ? '승계됨' : '종료'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 뷰 2: 계약 상세 뷰 (viewMode === 'DETAIL') */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {viewMode === 'DETAIL' && activeContract && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* 상단 컨트롤 바 */}
          <div className="card" style={{ padding: '12px 18px', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge badge-success" style={{ fontSize: '12px' }}>
                {activeContract.status === 'ACTIVE' ? '진행중' : activeContract.status === 'EXTENDED' ? '연장됨' : activeContract.status === 'SUCCEEDED' ? '승계됨' : '종료'}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>등록일: {activeContract.createdAt?.split('T')[0]}</span>
            </div>

            {/* 실행 버튼 그룹 */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setBundleTargetContractId(activeContract.id);
                  setShowBundleModal(true);
                }}
                style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', fontWeight: 'bold' }}
              >
                <Download size={14} /> 7종 통합 서류팩 PDF / 이메일
              </button>

              {canSave && canModifyContract(activeContract) && (
                <>
                  <button className="btn-primary" onClick={handleOpenExtendModal} style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={14} /> 기간 연장/단축
                  </button>

                  <button className="btn-secondary" onClick={handleOpenTransferModal} style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ArrowLeftRight size={14} /> 계약 승계
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 기본 정보 & 체결 자산 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
            
            {/* 섹션 1: 계약 기본 정보 */}
            <div className="card" style={{ margin: 0, height: '100%' }}>
              <h3 className="card-title" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building2 size={16} /> 계약 기본 정보
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div><label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>고객사명</label><strong>{getCustName(activeContract.customerId)}</strong></div>
                <div><label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>현장명</label><strong>{getSiteName(activeContract.siteId)}</strong></div>
                
                <div><label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>영업담당</label><span>{users.find(u => u.id === activeContract.salespersonId)?.name || '-'}</span></div>
                <div><label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>청구 / 명세서 마감일</label>매월 {activeContract.billingDay}일 / {activeContract.statementClosingDay || '-'}일</div>
                
                <div><label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>계약 시작일</label><span>{activeContract.startDate}</span></div>
                <div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>계약 만료일</label>
                  <span>{activeContract.endDate || '미정'}</span>
                  <span className="badge badge-danger" style={{ marginLeft: '6px', fontSize: '10px' }}>{getDDayText(activeContract.endDate).text}</span>
                </div>
              </div>

              {/* 승계 이전 정보 안내 박스 */}
              {(activeContract.predecessorContractNo || activeContract.predecessorCustomerName) && (
                <div style={{ marginTop: '12px', padding: '10px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px' }}>
                  <div style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    🔄 승계 이전 계약 정보
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', color: 'var(--text-primary)' }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>이전 고객사:</span> <strong>{activeContract.predecessorCustomerName || '-'}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>이전 계약번호:</span> <strong>{activeContract.predecessorContractNo || '-'}</strong></div>
                  </div>
                </div>
              )}

              {/* 구글 드라이브 문서함 연동 */}
              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '12px' }}>구글 드라이브 문서함 연동</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>스캔 계약서 및 관련 파일 보관 폴더</div>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const link = activeContract.driveFolderId?.trim();
                    if (!link) { alert('등록된 구글 드라이브 폴더 링크가 없습니다.'); return; }
                    window.open(link.startsWith('http') ? link : `https://drive.google.com/drive/folders/${link}`, '_blank');
                  }}
                  style={{ padding: '4px 10px', fontSize: '11px' }}
                >
                  폴더 열기 🔗
                </button>
              </div>
            </div>

            {/* 섹션 2: 체결 자산 목록 */}
            <div className="card" style={{ margin: 0, height: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Wrench size={16} /> 체결 자산 목록 ({activeContractAssets.length}대)
                </h3>
                {canSave && canModifyContract(activeContract) && activeContract.status !== 'COMPLETED' && (
                  <button className="btn-secondary" onClick={() => handleOpenExchangeGlobal()} style={{ padding: '5px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Repeat size={13} /> 자산 교체/대차 의뢰
                  </button>
                )}
              </div>

              <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
                <table>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-app)' }}>
                      <th style={{ whiteSpace: 'nowrap' }}>자산번호</th>
                      <th style={{ whiteSpace: 'nowrap' }}>모델명</th>
                      <th style={{ whiteSpace: 'nowrap' }}>월 렌탈료</th>
                      <th style={{ whiteSpace: 'nowrap' }}>일 렌탈료</th>
                      <th style={{ whiteSpace: 'nowrap' }}>가동일수</th>
                      <th style={{ whiteSpace: 'nowrap' }}>매출 기여액</th>
                      <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>수정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeContractAssets.map(ca => {
                      const asset = assets.find(a => a.id === ca.assetId);
                      const isZero = ca.monthlyRentalFee === 0;

                      // 가동일수 및 매출 기여액 정밀 일할 계산
                      const sDate = new Date(ca.startDate || activeContract.startDate || todayStr);
                      const eDateStr = ca.endDate || activeContract.endDate;
                      const eDate = (!eDateStr || eDateStr === '미정') ? new Date() : new Date(eDateStr);
                      const diffTime = Math.max(0, eDate.getTime() - sDate.getTime());
                      const activeDays = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);
                      const dailyFee = ca.dailyRentalFee || Math.round(ca.monthlyRentalFee / 30);
                      const revenueContribution = activeDays * dailyFee;

                      return (
                        <tr key={ca.id}>
                          <td style={{ whiteSpace: 'nowrap' }}><strong style={{ color: 'var(--primary)' }}>{asset?.assetNo || '미지정'}</strong></td>
                          <td style={{ whiteSpace: 'nowrap' }}>{asset?.modelName || ca.expectedModel}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {isZero ? (
                              <span style={{ color: 'var(--danger)', fontWeight: 700 }}>0원 (미입력)</span>
                            ) : (
                              <span>{ca.monthlyRentalFee.toLocaleString()}원</span>
                            )}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>{(ca.dailyRentalFee || 0).toLocaleString()}원</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span className="badge badge-info" style={{ fontSize: '11px' }}>{activeDays}일</span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <strong style={{ color: '#0070C0' }}>₩{revenueContribution.toLocaleString()}</strong>
                          </td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {canSave && canModifyContract(activeContract) && (
                              <button className="btn-secondary" onClick={() => handleOpenFeeModal(ca)} style={{ padding: '2px 6px', fontSize: '10.5px' }}>
                                <Edit3 size={11} /> 렌탈료 수정
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
          </div>

          {/* 하단 그리드: 계약 변경 및 이력 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card" style={{ margin: 0 }}>
              <h3 className="card-title" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} color="var(--primary)" /> 계약 변경 및 이력 ({activeTimeline.length}건)
              </h3>

              <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                {activeTimeline.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>기록된 이력이 없습니다.</div>
                ) : (
                  activeTimeline.map(item => (
                    <div
                      key={item.id}
                      style={{
                        padding: '10px 12px',
                        borderLeft: `3px solid ${
                          item.category === 'CONTRACT' ? 'var(--primary)' :
                          item.category === 'INSPECTION' ? '#166534' :
                          item.category === 'TRUCK' ? '#2563eb' : '#c2410c'
                        }`,
                        backgroundColor: 'var(--bg-app)',
                        borderRadius: '0 4px 4px 0',
                        fontSize: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: '2px' }}>
                        <span>{item.title}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{item.date}</span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>{item.desc}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 모달 1: 렌탈료 수정 */}
      {showFeeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleSaveFee} className="card" style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '14px' }}>렌탈료 수정</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label>월 렌탈료 (원) *</label>
                <input type="number" value={editMonthlyFee} onChange={e => setEditMonthlyFee(Number(e.target.value))} required style={{ width: '100%', padding: '8px' }} />
              </div>
              <div>
                <label>일할 계산 일단가 (원) *</label>
                <input type="number" value={editDailyFee} onChange={e => setEditDailyFee(Number(e.target.value))} required style={{ width: '100%', padding: '8px' }} />
              </div>
              <div>
                <label>변경 사유 *</label>
                <input type="text" placeholder="단가 조정 사유 입력" value={feeChangeReason} onChange={e => setFeeChangeReason(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowFeeModal(false)}>취소</button>
              <button type="submit" className="btn-primary">저장</button>
            </div>
          </form>
        </div>
      )}

      {/* 모달 2: 만료일 / 기간 연장/단축 */}
      {showExtendModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleSaveExtend} className="card" style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '14px' }}>계약 기간 연장 / 단축</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={modIsOpen} onChange={e => setModIsOpen(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                종료일 미정 (상시 대여중)
              </label>

              {!modIsOpen && (
                <div>
                  <label>변경 만료일 *</label>
                  <input type="date" value={modNewEndDate} onChange={e => setModNewEndDate(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
                </div>
              )}

              <div>
                <label>변경 사유 *</label>
                <input type="text" placeholder="기간 연장 또는 단축 사유 입력" value={modDesc} onChange={e => setModDesc(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowExtendModal(false)}>취소</button>
              <button type="submit" className="btn-primary">저장</button>
            </div>
          </form>
        </div>
      )}

      {/* 모달 3: 계약 승계 */}
      {showTransferModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleSaveTransfer} className="card" style={{ width: '100%', maxWidth: '420px', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '14px' }}>계약 승계 처리</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label>양수 고객사 선택 *</label>
                <select value={succCustId} onChange={e => setSuccCustId(e.target.value)} required style={{ width: '100%', padding: '8px' }}>
                  <option value="">-- 양수 고객사 선택 --</option>
                  {customers.filter(c => c.id !== activeContract?.customerId).map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.bizRegNo})</option>
                  ))}
                </select>
              </div>

              <div>
                <label>승계 일자 *</label>
                <input type="date" value={succDate} onChange={e => setSuccDate(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
              </div>

              <div>
                <label>승계 사유 및 메모</label>
                <input type="text" placeholder="승계 사유 입력" value={succDesc} onChange={e => setSuccDesc(e.target.value)} style={{ width: '100%', padding: '8px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowTransferModal(false)}>취소</button>
              <button type="submit" className="btn-primary" disabled={!succCustId}>승계 처리</button>
            </div>
          </form>
        </div>
      )}

      {/* 모달 4: 자산 교체 / 대차 의뢰 (식별 여부 구분 및 업무 흐름 자동 연계 구조) */}
      {showExchangeModal && activeContract && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleExchangeSubmit} className="card" style={{ width: '100%', maxWidth: '500px', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '14px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowLeftRight size={18} /> 자산 교체 / 대차 의뢰
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px' }}>
              
              {/* 1단계 시작점 분기: 교체 대상 식별 여부 */}
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px', fontSize: '12px' }}>1. 회수 대상 장비 식별 상태 *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={exchangeIdentifyType === 'KNOWN' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setExchangeIdentifyType('KNOWN')}
                    style={{ flex: 1, padding: '8px 10px', fontSize: '11.5px', fontWeight: 'bold', borderRadius: '6px' }}
                  >
                    🔵 모델 + 관리번호/S/N 식별됨
                  </button>
                  <button
                    type="button"
                    className={exchangeIdentifyType === 'UNKNOWN' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setExchangeIdentifyType('UNKNOWN')}
                    style={{ flex: 1, padding: '8px 10px', fontSize: '11.5px', fontWeight: 'bold', borderRadius: '6px' }}
                  >
                    🟠 모델명만 지정 (현장회수시 확정)
                  </button>
                </div>
              </div>

              {/* 회수 대상 장비 선택 */}
              {exchangeIdentifyType === 'KNOWN' ? (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>회수 대상 계약 자산 선택 (자산번호/SN 지정) *</label>
                  <select value={exchangeOldAssetId} onChange={e => setExchangeOldAssetId(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '6px', fontSize: '12.5px' }}>
                    {activeContractAssets.map(ca => {
                      const ast = assets.find(a => a.id === ca.assetId);
                      return (
                        <option key={ca.id} value={ca.assetId}>
                          {ast ? `${ast.modelName} (관리번호: ${ast.assetNo} / SN: ${ast.serialNo || '미기재'})` : (ca.expectedModel || '자산')}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>회수 대상 요청 모델 선택 (모델명만) *</label>
                    <select value={exchangeContractAssetId} onChange={e => setExchangeContractAssetId(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '6px', fontSize: '12.5px' }}>
                      {Array.from(new Set(activeContractAssets.map(ca => ca.expectedModel || (assets.find(a => a.id === ca.assetId)?.modelName)))).map((model, idx) => (
                        <option key={idx} value={model}>{model} (현장 회수 검수 시 자산번호 확정)</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ padding: '8px 10px', backgroundColor: 'var(--warning-light)', border: '1px solid var(--warning)', borderRadius: '6px', fontSize: '11.5px', color: 'var(--warning-hover)' }}>
                    💡 <strong>미식별 교체 안내:</strong> 현장의 정확한 자산번호/SN을 모르는 상태입니다. 대차 장비 출고 후 회수 장비가 센터에 <strong>입고 검수 승인되는 시점에 자산번호가 최종 매핑 완성</strong>됩니다.
                  </div>
                </div>
              )}

              {/* 계약 속성 자동 상속 카드 명세 */}
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontWeight: 'bold', color: 'var(--primary)', marginBottom: '2px' }}>🔒 기존 계약 속성 100% 자동 상속</div>
                <div>고객사 / 현장: <strong>{getCustName(activeContract.customerId)} — {getSiteName(activeContract.siteId)}</strong></div>
                <div>대차 요구 모델: <strong>{exchangeIdentifyType === 'KNOWN' ? (assets.find(a => a.id === exchangeOldAssetId)?.modelName || activeContractAssets[0]?.expectedModel || '동급 동일 모델') : (exchangeContractAssetId || activeContractAssets[0]?.expectedModel || '동급 동일 모델')}</strong></div>
                <div>렌탈료 단가 조건: 기존 계약 월 렌탈료 조건 100% 동일 상속 (추가 비용 없음)</div>
                <div>청구 / 작업지시 조건: 매월 {activeContract.billingDay}일 청구 마감 조건 승계</div>
              </div>

              {/* 후속 업무 흐름 연계 시각화 카드 */}
              <div style={{ padding: '10px 12px', backgroundColor: 'var(--info-light)', border: '1px solid var(--info)', borderRadius: '6px', fontSize: '11.5px', color: 'var(--info)' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>🔄 후속 업무 자동 연계 체인</div>
                <div>1. <strong>[배차 관리]</strong>에 교환 왕복 배차(EXCHANGE) 1건 자동 발행 (출고/회수 1:1 통합 관리)</div>
                <div>2. <strong>[장비 할당]</strong> 보드 최상단 카드로 대차 출고 할당 요청 자동 노출</div>
                <div>3. <strong>[입고 검수]</strong> 승인 마감 시 회수 자산 `AVAILABLE`(또는 수리) 자동 마감 연동</div>
              </div>

              {/* 대차/교체 희망일자 및 희망시간대 (상하 헤더 세로 스택 컨셉) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>대차/교체 희망일자 *</label>
                  <input
                    type="date"
                    value={exchangeDate}
                    onChange={e => setExchangeDate(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', fontSize: '12.5px', border: '1px solid var(--border-color)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>희망 시간대 (배차 스케줄) *</label>
                  <select
                    value={exchangeTimeSlot}
                    onChange={e => setExchangeTimeSlot(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', fontSize: '12.5px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  >
                    <option value="오전 (08:00 ~ 12:00)">오전 (08:00 ~ 12:00)</option>
                    <option value="오후 (13:00 ~ 17:00)">오후 (13:00 ~ 17:00)</option>
                    <option value="새벽/조기 (07:00 이전)">새벽/조기 (07:00 이전)</option>
                    <option value="08:30 정시 도착">08:30 정시 도착</option>
                    <option value="13:00 정시 도착">13:00 정시 도착</option>
                    <option value="야간/작업 마감후">야간/작업 마감후</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>교체 사유 및 현장 상황 메모 *</label>
                <input type="text" placeholder="예: 유압유 누유 고장, 작업 높이 변경 요청 등" value={exchangeReason} onChange={e => setExchangeReason(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '6px', fontSize: '12.5px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowExchangeModal(false)}>취소</button>
              <button type="submit" className="btn-success" style={{ fontWeight: 'bold', padding: '8px 14px' }}>
                대차 의뢰 접수 (출고/회수 배차 발행)
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 뷰 3: 신규 계약 등록 */}
      {viewMode === 'LIST' && activeTab === 'CREATE' && (
        <form onSubmit={handleCreateContractSubmit} className="card" style={{ margin: 0 }}>
          <h3 className="card-title" style={{ marginBottom: '16px' }}>신규 계약 등록</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label>고객사 선택 *</label>
              <select
                value={custSelect}
                onChange={e => {
                  const val = e.target.value;
                  setCustSelect(val);
                  if (val && val !== 'NEW') {
                    const sel = customers.find(c => c.id === val);
                    if (sel) {
                      setBillingDay(sel.defaultBillingDay || 30);
                      setStatementClosingDay(sel.defaultStatementClosingDay || 25);
                    }
                  }
                }}
                required
                style={{ width: '100%', padding: '8px' }}
              >
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.bizRegNo})</option>
                ))}
                <option value="NEW">+ [신규 고객사 직접 등록]</option>
              </select>
            </div>

            <div>
              <label>영업담당 *</label>
              <select value={salespersonSelect} onChange={e => setSalespersonSelect(e.target.value)} required style={{ width: '100%', padding: '8px' }}>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label>계약 시작일 *</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={isEndDateOpen} onChange={e => setIsEndDateOpen(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                종료일 미정 (상시 대여중)
              </label>
              {!isEndDateOpen && (
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '4px' }} />
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div><label>청구 마감일 (일) *</label><input type="number" min={1} max={31} value={billingDay} onChange={e => setBillingDay(Number(e.target.value))} required style={{ width: '100%', padding: '8px' }} /></div>
              <div><label>명세서 마감일 (일)</label><input type="number" min={1} max={31} value={statementClosingDay} onChange={e => setStatementClosingDay(Number(e.target.value))} style={{ width: '100%', padding: '8px' }} /></div>
            </div>
          </div>

          {/* 자산 바스켓 */}
          <div style={{ padding: '14px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
            <h4 style={{ fontWeight: 600, marginBottom: '10px' }}>체결 자산 선택</h4>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
              <select value={basketAssetMethod} onChange={e => setBasketAssetMethod(e.target.value as any)} style={{ padding: '7px' }}>
                <option value="ASSET">자산 관리번호 선택</option>
                <option value="MODEL">제품 모델명 선택</option>
              </select>

              {basketAssetMethod === 'ASSET' ? (
                <select value={selectedAssetToAdd} onChange={e => setSelectedAssetToAdd(e.target.value)} style={{ padding: '7px', minWidth: '180px' }}>
                  <option value="">-- 임대가능 자산 선택 --</option>
                  {availableAssets.map(a => (
                    <option key={a.id} value={a.id}>{a.assetNo} ({a.modelName})</option>
                  ))}
                </select>
              ) : (
                <select value={selectedModelToAdd} onChange={e => setSelectedModelToAdd(e.target.value)} style={{ padding: '7px', minWidth: '180px' }}>
                  <option value="">-- 제품 모델 선택 --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.modelName}>{p.modelName} ({p.feet}피트)</option>
                  ))}
                </select>
              )}

              <span>월 렌탈료:</span>
              <input type="number" value={customMonthly} onChange={e => setCustomMonthly(Number(e.target.value))} style={{ width: '100px', padding: '6px' }} />
              
              <button type="button" className="btn-primary" onClick={handleAddToBasket} style={{ padding: '6px 12px' }}>+ 추가</button>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {basket.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>추가된 자산이 없습니다.</div>
              ) : (
                basket.map((b, idx) => {
                  const ast = assets.find(a => a.id === b.assetId);
                  return (
                    <div key={idx} style={{ padding: '4px 10px', backgroundColor: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong>{ast?.assetNo || b.expectedModel}</strong> (월 {b.monthlyRentalFee.toLocaleString()}원)
                      <button type="button" onClick={() => handleRemoveFromBasket(b.assetId || b.expectedModel)} style={{ border: 'none', background: 'none', color: 'red', cursor: 'pointer' }}>✕</button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn-secondary" onClick={() => setActiveTab('ALL_LIST')}>취소</button>
            <button type="submit" className="btn-success">계약 등록</button>
          </div>
        </form>
      )}

      {/* 6종 통합 계약 서류팩 모달 */}
      <ContractDocumentBundleModal
        isOpen={showBundleModal}
        onClose={() => setShowBundleModal(false)}
        initialContractId={bundleTargetContractId}
      />

      {/* 스타일 */}
      <style>{`
        .hover-row:hover {
          background-color: #f1f5f9 !important;
        }
      `}</style>
    </div>
  );
};
