import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { 
  Truck, Check, AlertCircle, Plus, Trash2, Clock, Layers, 
  FileText, Copy, Lock, CreditCard, CheckCircle, RefreshCw, X,
  Calendar, RotateCcw, ShieldCheck, CheckSquare, XCircle, Search
} from 'lucide-react';
import { Delivery, TransportCompany, TransportDriver, db, DeliveryStatus } from '../services/db';

const VEHICLE_TYPE_OPTIONS = ['1.4T', '2.5T', '3.5T', '5T', '5T장축', '8.5T', '11T', '노배드'];

interface VehicleReq {
  vehicleType: string;
  count: number;
}

interface CargoItem {
  modelName: string;
  count: number;
}

interface AssignedVehicleRow {
  id: string;
  transportCompany: string;
  vehicleType: string;
  vehicleNo: string;
  driverName: string;
  driverContact: string;
  deliveryCost: number;
}

export const TruckDispatch: React.FC = () => {
  const { 
    deliveries, contracts, customers, products, 
    transportCompanies, transportDrivers, hasPermission, 
    refreshAllData, showErrorModal 
  } = useApp();

  const canSave = hasPermission('delivery', 'save');

  const [activeTab, setActiveTab] = useState<'DISPATCH' | 'RECONCILIATION'>('DISPATCH');

  // 4단계 배차 진행 상태 탭 state ('ALL' | 'PENDING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED')
  const [activeDispatchStatusTab, setActiveDispatchStatusTab] = useState<string>('ALL');

  // 📅 배차 요청/운송일 기간 조회 피커 state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleSetDateRange = (type: 'TODAY' | 'WEEK' | 'MONTH' | 'ALL') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    if (type === 'TODAY') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (type === 'WEEK') {
      const past = new Date();
      past.setDate(today.getDate() - 7);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (type === 'MONTH') {
      const past = new Date();
      past.setMonth(today.getMonth() - 1);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  
  // 배차 세부 유형 ('출고' | '입고' | '반납' | '정비' | '이동')
  const [dispatchCategory, setDispatchCategory] = useState<'출고' | '입고' | '반납' | '정비' | '이동'>('출고');
  
  // 상차 일시 & 시간 지정
  const [loadingDate, setLoadingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loadingTimeSlot, setLoadingTimeSlot] = useState('오전');
  const [loadingCustomTime, setLoadingCustomTime] = useState('');

  // 하차 일시 & 시간 지정
  const [unloadingDate, setUnloadingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [unloadingTimeSlot, setUnloadingTimeSlot] = useState('오전');
  const [unloadingCustomTime, setUnloadingCustomTime] = useState('');

  // 실무자 마감 비고
  const [closingMemo, setClosingMemo] = useState('');

  const [scheduledDate, setScheduledDate] = useState('');
  const [originAddress, setOriginAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [billableToCust, setBillableToCust] = useState(false);
  const [billableCustId, setBillableCustId] = useState('');
  const [assignedVehicles, setAssignedVehicles] = useState<AssignedVehicleRow[]>([]);

  // 수동 배차 모달 state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualCategory, setManualCategory] = useState<'출고' | '입고' | '반납' | '정비' | '이동'>('출고');
  const [manualCustomerId, setManualCustomerId] = useState('');
  const [manualContractId, setManualContractId] = useState('');
  const [manualOrigin, setManualOrigin] = useState('당사 보관소');
  const [manualDestination, setManualDestination] = useState('');
  const [manualLoadingDate, setManualLoadingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [manualLoadingTimeSlot, setManualLoadingTimeSlot] = useState('오전');
  const [manualLoadingCustomTime, setManualLoadingCustomTime] = useState('');
  const [manualUnloadingDate, setManualUnloadingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [manualUnloadingTimeSlot, setManualUnloadingTimeSlot] = useState('오전');
  const [manualUnloadingCustomTime, setManualUnloadingCustomTime] = useState('');
  const [manualExpectedCost, setManualExpectedCost] = useState(70000);
  const [manualBillable, setManualBillable] = useState(false);
  const [manualMemo, setManualMemo] = useState('');
  const [manualClosingMemo, setManualClosingMemo] = useState('');

  const [manualVehicles, setManualVehicles] = useState<VehicleReq[]>([{ vehicleType: '3.5T', count: 1 }]);
  const [manualCargos, setManualCargos] = useState<CargoItem[]>([{ modelName: products[0]?.modelName || 'Skyjack SJ3219', count: 1 }]);

  const [reconCompanyFilter, setReconCompanyFilter] = useState('ALL');
  const [reconYmFilter, setReconYmFilter] = useState(() => new Date().toISOString().slice(0, 7));
  const [reconStatusFilter, setReconStatusFilter] = useState('ALL');

  const [selectedDeliveryIds, setSelectedDeliveryIds] = useState<string[]>([]);
  const [copiedCompanyId, setCopiedCompanyId] = useState<string | null>(null);

  const [showCostEditModal, setShowCostEditModal] = useState(false);
  const [editingCostDelivery, setEditingCostDelivery] = useState<Delivery | null>(null);
  const [editFinalCost, setEditFinalCost] = useState(0);
  const [editAdjustmentReason, setEditAdjustmentReason] = useState('');

  const getContract = (contractId?: string) => contracts.find(c => c.id === contractId);
  const getCustomer = (customerId?: string) => customers.find(c => c.id === customerId);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. 배차 4단계 진행 상태 판정 헬퍼
  // ──────────────────────────────────────────────────────────────────────────
  const getNormalizedDeliveryStatus = (d: Delivery): 'PENDING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED' => {
    if (d.status === 'DISPATCHED') return 'DISPATCHED';
    if (d.status === 'DELIVERED' || d.status === 'COMPLETED') return 'DELIVERED';
    if (d.status === 'CANCELLED') return 'CANCELLED';
    return 'PENDING';
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 2. 배차건 정밀 필터링 (상태 4단계 + 요청/운송일 기간 피커 + 검색어)
  // ──────────────────────────────────────────────────────────────────────────
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter(d => {
      const dStatus = getNormalizedDeliveryStatus(d);
      if (activeDispatchStatusTab !== 'ALL' && dStatus !== activeDispatchStatusTab) return false;

      // 날짜 범위 필터링 (loadingDate, requestDate, scheduledDate 기준)
      const dDate = d.loadingDate || d.requestDate || d.scheduledDate || d.createdAt?.substring(0, 10);
      if (startDate && dDate && dDate < startDate) return false;
      if (endDate && dDate && dDate > endDate) return false;

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const contract = getContract(d.contractId);
      const customer = contract ? getCustomer(contract.customerId) : null;

      return (
        (d.id && d.id.toLowerCase().includes(q)) ||
        (d.driverName && d.driverName.toLowerCase().includes(q)) ||
        (d.destinationAddress && d.destinationAddress.toLowerCase().includes(q)) ||
        (contract && contract.contractNo.toLowerCase().includes(q)) ||
        (customer && customer.name.toLowerCase().includes(q))
      );
    });
  }, [deliveries, activeDispatchStatusTab, startDate, endDate, searchQuery, contracts, customers]);

  const handleSelectDelivery = (d: Delivery) => {
    const todayStr = new Date().toISOString().split('T')[0];
    setSelectedDelivery(d);

    let defaultCat: '출고' | '입고' | '반납' | '정비' | '이동' = d.dispatchCategory || (d.type === 'OUTBOUND' ? '출고' : d.type === 'RETURN' || d.type === 'INBOUND' ? '반납' : '출고');
    setDispatchCategory(defaultCat);

    setLoadingDate(d.loadingDate || todayStr);
    const lSlot = d.loadingTimeSlot || '오전';
    if (lSlot !== '오전' && lSlot !== '오후') {
      setLoadingTimeSlot('희망시간');
      setLoadingCustomTime(lSlot);
    } else {
      setLoadingTimeSlot(lSlot);
      setLoadingCustomTime('');
    }

    setUnloadingDate(d.unloadingDate || todayStr);
    const uSlot = d.unloadingTimeSlot || '오전';
    if (uSlot !== '오전' && uSlot !== '오후') {
      setUnloadingTimeSlot('희망시간');
      setUnloadingCustomTime(uSlot);
    } else {
      setUnloadingTimeSlot(uSlot);
      setUnloadingCustomTime('');
    }

    setClosingMemo(d.closingMemo || d.memo || '');
    setScheduledDate(d.scheduledDate || todayStr);
    setOriginAddress(d.originAddress || '당사 보관소');

    const contract = getContract(d.contractId);
    const cust = contract ? getCustomer(contract.customerId) : null;
    setDestinationAddress(d.destinationAddress || (cust ? `${cust.name} 현장` : ''));

    setBillableToCust(d.billableToCustomer || false);
    setBillableCustId(d.billableCustomerId || (contract?.customerId || ''));

    if (d.vehicles) {
      try {
        const parsed = JSON.parse(d.vehicles);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAssignedVehicles(parsed);
          return;
        }
      } catch (e) {}
    }

    setAssignedVehicles([{
      id: 'v-' + Date.now(),
      transportCompany: d.transportCompany || '',
      vehicleType: d.vehicleType || '3.5T',
      vehicleNo: d.vehicleNo || '',
      driverName: d.driverName || '',
      driverContact: d.driverContact || '',
      deliveryCost: d.finalCost || d.expectedCost || d.deliveryCost || 70000
    }]);
  };

  const handleVehicleFieldChange = (index: number, field: keyof AssignedVehicleRow, value: any) => {
    const updated = [...assignedVehicles];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'driverName' && value) {
      let searchName = value;
      let searchCompany = '';
      const match = value.match(/^(.*?)\s*\((.*?)\)$/);
      if (match) {
        searchName = match[1].trim();
        searchCompany = match[2].trim();
      }

      const driverMatch = transportDrivers.find(d => 
        d.driverName.trim() === searchName
      );

      if (driverMatch) {
        updated[index].driverName = driverMatch.driverName;
        if (driverMatch.driverContact) updated[index].driverContact = driverMatch.driverContact;
        if (driverMatch.vehicleNo) updated[index].vehicleNo = driverMatch.vehicleNo;
        const comp = transportCompanies.find(c => c.id === driverMatch.companyId);
        if (comp) updated[index].transportCompany = comp.name;
      }
    }
    setAssignedVehicles(updated);
  };

  const handleAddVehicleRow = () => {
    setAssignedVehicles(prev => [
      ...prev,
      {
        id: 'v-' + Date.now(),
        transportCompany: '',
        vehicleType: '3.5T',
        vehicleNo: '',
        driverName: '',
        driverContact: '',
        deliveryCost: 70000
      }
    ]);
  };

  const handleRemoveVehicleRow = (index: number) => {
    if (assignedVehicles.length <= 1) return;
    setAssignedVehicles(prev => prev.filter((_, i) => i !== index));
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 3. 배차 배정 저장 (status: 'DISPATCHED' 배차 완료 전환!)
  // ──────────────────────────────────────────────────────────────────────────
  const handleSaveDispatch = async () => {
    if (!selectedDelivery) return;
    if (!canSave) {
      showErrorModal('배차 수정 권한이 없습니다.');
      return;
    }

    try {
      const finalLoadingSlot = loadingTimeSlot === '희망시간' ? loadingCustomTime : loadingTimeSlot;
      const finalUnloadingSlot = unloadingTimeSlot === '희망시간' ? unloadingCustomTime : unloadingTimeSlot;
      const totalCost = assignedVehicles.reduce((sum, v) => sum + (Number(v.deliveryCost) || 0), 0);

      const mainVeh = assignedVehicles[0] || {};
      const payload: Partial<Delivery> = {
        status: 'DISPATCHED', // 🔵 배차 완료 상태로 전환!
        dispatchCategory: dispatchCategory,
        loadingDate: loadingDate,
        loadingTimeSlot: finalLoadingSlot,
        unloadingDate: unloadingDate,
        unloadingTimeSlot: finalUnloadingSlot,
        scheduledDate: scheduledDate || loadingDate,
        originAddress: originAddress,
        destinationAddress: destinationAddress,
        billableToCustomer: billableToCust,
        billableCustomerId: billableCustId,
        transportCompany: mainVeh.transportCompany || '',
        vehicleType: mainVeh.vehicleType || '3.5T',
        vehicleNo: mainVeh.vehicleNo || '',
        driverName: mainVeh.driverName || '',
        driverContact: mainVeh.driverContact || '',
        deliveryCost: totalCost,
        expectedCost: totalCost,
        finalCost: totalCost,
        vehicles: JSON.stringify(assignedVehicles),
        closingMemo: closingMemo,
        memo: closingMemo,
        updatedAt: new Date().toISOString()
      };

      db.updateRow<Delivery>('deliveries', selectedDelivery.id, payload);
      await db.awaitPendingWrites();
      refreshAllData();
      alert('✅ [배차 기사 배정 완료] 배차 상태가 [🔵 배차 완료]로 갱신되었습니다!');
      setSelectedDelivery(null);
    } catch (err: any) {
      showErrorModal(`⚠️ 배차 저장 실패:\n${err?.message || err}`);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 4. 운송 완료 처리 (status: 'DELIVERED' 운송 완료 전환!)
  // ──────────────────────────────────────────────────────────────────────────
  const handleCompleteDeliveryStatus = async (deliveryId: string) => {
    if (!canSave) return;
    try {
      db.updateRow<Delivery>('deliveries', deliveryId, {
        status: 'DELIVERED', // 🟢 운송 완료 전환!
        updatedAt: new Date().toISOString()
      });
      await db.awaitPendingWrites();
      refreshAllData();
      alert('✅ 운송이 완료 마감되었습니다. (상태: 🟢 운송 완료)');
      setSelectedDelivery(null);
    } catch (err: any) {
      showErrorModal(`⚠️ 운송 완료 처리 실패:\n${err?.message || err}`);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 5. 배차 취소 처리 (status: 'CANCELLED' 배차 취소 전환!)
  // ──────────────────────────────────────────────────────────────────────────
  const handleCancelDeliveryStatus = async (deliveryId: string) => {
    if (!canSave) return;
    if (!window.confirm('해당 배차를 취소 처리하시겠습니까?')) return;
    try {
      db.updateRow<Delivery>('deliveries', deliveryId, {
        status: 'CANCELLED', // 🔴 배차 취소 전환!
        updatedAt: new Date().toISOString()
      });
      await db.awaitPendingWrites();
      refreshAllData();
      alert('🔴 배차가 취소되었습니다. (상태: 🔴 배차 취소)');
      setSelectedDelivery(null);
    } catch (err: any) {
      showErrorModal(`⚠️ 배차 취소 처리 실패:\n${err?.message || err}`);
    }
  };

  const handleSaveManualDispatch = async () => {
    if (!manualOrigin || !manualDestination) {
      showErrorModal('상차지(출발지)와 하차지(도착지)를 작성해 주세요.');
      return;
    }

    try {
      const finalLoadingSlot = manualLoadingTimeSlot === '희망시간' ? manualLoadingCustomTime : manualLoadingTimeSlot;
      const finalUnloadingSlot = manualUnloadingTimeSlot === '희망시간' ? manualUnloadingCustomTime : manualUnloadingTimeSlot;
      const nowIso = new Date().toISOString();

      const newDelivery = db.insertRow<Delivery>('deliveries', {
        type: manualCategory === '출고' ? 'OUTBOUND' : manualCategory === '반납' ? 'RETURN' : 'INBOUND',
        status: 'PENDING', // 🟡 최초 상태: 배차 전
        dispatchCategory: manualCategory,
        contractId: manualContractId || undefined,
        requestDate: manualLoadingDate,
        scheduledDate: manualLoadingDate,
        loadingDate: manualLoadingDate,
        loadingTimeSlot: finalLoadingSlot,
        unloadingDate: manualUnloadingDate,
        unloadingTimeSlot: finalUnloadingSlot,
        originAddress: manualOrigin,
        destinationAddress: manualDestination,
        deliveryCost: manualExpectedCost,
        expectedCost: manualExpectedCost,
        finalCost: manualExpectedCost,
        billableToCustomer: manualBillable,
        billableCustomerId: manualCustomerId || undefined,
        isCostSettled: false,
        memo: manualMemo || manualClosingMemo,
        closingMemo: manualClosingMemo || manualMemo,
        vehicleRequirements: JSON.stringify(manualVehicles),
        cargoItems: JSON.stringify(manualCargos),
        createdAt: nowIso,
        updatedAt: nowIso
      });

      await db.awaitPendingWrites();
      refreshAllData();
      alert('🎉 [수동 배차 생성 완료] 신규 배차건이 생성되었습니다!');
      setShowManualModal(false);
    } catch (err: any) {
      showErrorModal(`⚠️ 수동 배차 생성 실패:\n${err?.message || err}`);
    }
  };

  const parseCargoItems = (d: Delivery): CargoItem[] => {
    if (d.cargoItems) {
      try {
        const parsed = JSON.parse(d.cargoItems);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [{ modelName: '고소작업대 (장비 미지정)', count: 1 }];
  };

  const parseVehicleReqs = (d: Delivery): VehicleReq[] => {
    if (d.vehicleRequirements) {
      try {
        const parsed = JSON.parse(d.vehicleRequirements);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [{ vehicleType: d.vehicleType || '3.5T', count: 1 }];
  };

  // 뱃지 헬퍼
  const getDeliveryStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
      case 'REQUESTED':
        return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, backgroundColor: 'rgba(245,158,11,0.15)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> 🟡 배차 전 (대기)</span>;
      case 'DISPATCHED':
        return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, backgroundColor: 'rgba(59,130,246,0.15)', color: '#2563eb', border: '1px solid rgba(59,130,246,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Truck size={12} /> 🔵 배차 완료 (기사배정)</span>;
      case 'DELIVERED':
      case 'COMPLETED':
        return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, backgroundColor: 'rgba(34,197,94,0.15)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={12} /> 🟢 운송 완료</span>;
      case 'CANCELLED':
        return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, backgroundColor: 'rgba(239,68,68,0.15)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><XCircle size={12} /> 🔴 배차 취소</span>;
      default:
        return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, backgroundColor: 'rgba(148,163,184,0.15)', color: '#64748b' }}>미지정</span>;
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* 헤더 영역 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontWeight: '800', fontSize: '22px', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Truck size={24} color="var(--primary)" /> 배차 / 운송 관리 및 월말 운송료 대사
          </h2>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            상차/하차 배차 일정을 관리하고 기사를 배정하여 운송료 대사를 처리합니다.
          </p>
        </div>
        {canSave && (
          <button className="btn-primary" onClick={() => setShowManualModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', fontWeight: 700 }}>
            <Plus size={16} /> [+ 수동 배차 생성]
          </button>
        )}
      </div>

      {/* 메인 탭 (배차 관리 / 월말 운송료 대사) */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('DISPATCH')}
          style={{
            padding: '10px 18px', fontSize: '14px', fontWeight: 700, backgroundColor: 'transparent', border: 'none',
            borderBottom: activeTab === 'DISPATCH' ? '3px solid var(--primary)' : 'none',
            color: activeTab === 'DISPATCH' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer'
          }}
        >
          <Truck size={15} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          배차 및 운송 기사 배정 관리
        </button>
        <button
          onClick={() => setActiveTab('RECONCILIATION')}
          style={{
            padding: '10px 18px', fontSize: '14px', fontWeight: 700, backgroundColor: 'transparent', border: 'none',
            borderBottom: activeTab === 'RECONCILIATION' ? '3px solid var(--primary)' : 'none',
            color: activeTab === 'RECONCILIATION' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer'
          }}
        >
          <FileText size={15} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          월말 운송료 대사 및 매입 지급 요청
        </button>
      </div>

      {/* 탭 1: 배차 관리 */}
      {activeTab === 'DISPATCH' && (
        <div>
          {/* ────────────────────────────────────────────────────────────────── */}
          {/* 4단계 배차 진행 상태 카운트 탭 (1번 이미지 디자인 완벽 이식!) */}
          {/* ────────────────────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {[
              { key: 'ALL', label: '전체 보기', count: deliveries.length },
              { key: 'PENDING', label: '🟡 배차 전 (대기)', count: deliveries.filter(d => getNormalizedDeliveryStatus(d) === 'PENDING').length },
              { key: 'DISPATCHED', label: '🔵 배차 완료 (기사배정)', count: deliveries.filter(d => getNormalizedDeliveryStatus(d) === 'DISPATCHED').length },
              { key: 'DELIVERED', label: '🟢 운송 완료', count: deliveries.filter(d => getNormalizedDeliveryStatus(d) === 'DELIVERED').length },
              { key: 'CANCELLED', label: '🔴 배차 취소', count: deliveries.filter(d => getNormalizedDeliveryStatus(d) === 'CANCELLED').length },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveDispatchStatusTab(tab.key)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: activeDispatchStatusTab === tab.key ? 'var(--primary)' : 'var(--border-color)',
                  backgroundColor: activeDispatchStatusTab === tab.key ? 'rgba(59,130,246,0.1)' : 'var(--bg-card)',
                  color: activeDispatchStatusTab === tab.key ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: activeDispatchStatusTab === tab.key ? 700 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                {tab.label}
                <span style={{
                  backgroundColor: activeDispatchStatusTab === tab.key ? 'var(--primary)' : 'var(--bg-body)',
                  color: activeDispatchStatusTab === tab.key ? '#fff' : 'var(--text-muted)',
                  borderRadius: '12px',
                  padding: '1px 7px',
                  fontSize: '11px',
                  fontWeight: 700
                }}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* 2열 메인 레이아웃 (좌: 배차 목록 + 📅 기간조회 | 우: 기사 배정 폼) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 420px) 1fr', gap: '20px' }}>
            
            {/* [좌측] 배차 목록 카드 + 📅 요청/운송일 기간 선택 폼 */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 230px)', minHeight: '600px' }}>
              
              {/* 📅 배차 요청/운송일 기간 선택 폼 (1번 이미지 디자인 완벽 반영!) */}
              <div style={{ marginBottom: '12px', padding: '10px 12px', backgroundColor: 'var(--bg-body)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={13} /> 배차 운송일/신청일 기간 조회
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[
                      { label: '오늘', type: 'TODAY' },
                      { label: '1주일', type: 'WEEK' },
                      { label: '1개월', type: 'MONTH' },
                      { label: '전체', type: 'ALL' }
                    ].map(b => (
                      <button
                        key={b.type}
                        onClick={() => handleSetDateRange(b.type as any)}
                        style={{
                          padding: '2px 7px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card)',
                          fontSize: '10.5px',
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          cursor: 'pointer'
                        }}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '5px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>~</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '5px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  />
                  {(startDate || endDate) && (
                    <button
                      onClick={() => handleSetDateRange('ALL')}
                      title="기간 초기화"
                      style={{
                        padding: '5px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex'
                      }}
                    >
                      <RotateCcw size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* 검색창 */}
              <div style={{ marginBottom: '14px', position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="고객사 / 현장 / 계약 / 기사명 검색..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-body)',
                    color: 'var(--text-primary)',
                    fontSize: '12.5px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* 배차 목록 렌더링 */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
                {filteredDeliveries.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    조건에 일치하는 배차 요청건이 없습니다.
                  </div>
                ) : (
                  filteredDeliveries.map(d => {
                    const contract = getContract(d.contractId);
                    const customer = contract ? getCustomer(contract.customerId) : null;
                    const isSelected = selectedDelivery?.id === d.id;
                    const cargoItems = parseCargoItems(d);
                    const normStatus = getNormalizedDeliveryStatus(d);

                    return (
                      <div 
                        key={d.id}
                        onClick={() => handleSelectDelivery(d)}
                        style={{
                          padding: '14px',
                          borderRadius: '10px',
                          border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          backgroundColor: isSelected ? 'rgba(59,130,246,0.05)' : 'var(--bg-body)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected ? '0 4px 12px rgba(59,130,246,0.12)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--primary)' }}>
                            [{d.dispatchCategory || '출고'}] {d.requestDate || d.loadingDate}
                          </span>
                          {getDeliveryStatusBadge(normStatus)}
                        </div>

                        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                          🏢 {customer?.name || '고객사 미지정'}
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          📍 {d.destinationAddress || '목적지 미지정'}
                        </div>

                        {/* 화물 / 배차요청 내역 요약 */}
                        <div style={{ padding: '6px 8px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          📦 화물: {cargoItems.map(c => `${c.modelName} ${c.count}대`).join(', ')}
                        </div>

                        {d.driverName && (
                          <div style={{ marginTop: '6px', fontSize: '11.5px', fontWeight: 700, color: '#16a34a' }}>
                            🚛 기사: {d.driverName} ({d.vehicleNo || '차량번호미상'})
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* [우측] 배차 기사 배정 및 상세 폼 */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', height: 'calc(100vh - 230px)', minHeight: '600px', overflowY: 'auto' }}>
              {!selectedDelivery ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  <Truck size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                  <p style={{ fontSize: '14px', fontWeight: 600 }}>좌측에서 기사를 배정할 배차건을 선택해 주세요.</p>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>
                        🚛 배차 운송 기사 배정 및 상하차 세부 설정
                      </h3>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        배차 ID: {selectedDelivery.id} | 요청일: {selectedDelivery.requestDate}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {getDeliveryStatusBadge(getNormalizedDeliveryStatus(selectedDelivery))}
                      {canSave && (
                        <button
                          onClick={() => handleCancelDeliveryStatus(selectedDelivery.id)}
                          style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          🚫 배차 취소
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 배차 세부 설정 폼 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>배차 구분</label>
                      <select
                        value={dispatchCategory}
                        onChange={e => setDispatchCategory(e.target.value as any)}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', fontSize: '12.5px' }}
                      >
                        <option value="출고">출고</option>
                        <option value="입고">입고</option>
                        <option value="반납">반납</option>
                        <option value="정비">정비</option>
                        <option value="이동">이동</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>상차일자 & 시간</label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="date"
                          value={loadingDate}
                          onChange={e => setLoadingDate(e.target.value)}
                          style={{ flex: 1, padding: '7px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', fontSize: '12.5px' }}
                        />
                        <select
                          value={loadingTimeSlot}
                          onChange={e => setLoadingTimeSlot(e.target.value)}
                          style={{ width: '80px', padding: '7px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', fontSize: '12.5px' }}
                        >
                          <option value="오전">오전</option>
                          <option value="오후">오후</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>상차지 (출발지)</label>
                      <input
                        type="text"
                        value={originAddress}
                        onChange={e => setOriginAddress(e.target.value)}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', fontSize: '12.5px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>하차지 (도착지)</label>
                      <input
                        type="text"
                        value={destinationAddress}
                        onChange={e => setDestinationAddress(e.target.value)}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', fontSize: '12.5px' }}
                      />
                    </div>
                  </div>

                  {/* 🚚 기사 및 운송사 배정 테이블 */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 800 }}>🚚 배정 운송 기사 목록</label>
                      <button onClick={handleAddVehicleRow} style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, borderRadius: '4px', border: '1px solid var(--primary)', color: 'var(--primary)', backgroundColor: 'transparent', cursor: 'pointer' }}>
                        + 차량 추가
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {assignedVehicles.map((veh, idx) => (
                        <div key={veh.id || idx} style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr 30px', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="text"
                            placeholder="운송사 (예: 삼일운송)"
                            value={veh.transportCompany}
                            onChange={e => handleVehicleFieldChange(idx, 'transportCompany', e.target.value)}
                            style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px' }}
                          />
                          <select
                            value={veh.vehicleType}
                            onChange={e => handleVehicleFieldChange(idx, 'vehicleType', e.target.value)}
                            style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px' }}
                          >
                            {VEHICLE_TYPE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                          <input
                            type="text"
                            placeholder="기사명"
                            value={veh.driverName}
                            onChange={e => handleVehicleFieldChange(idx, 'driverName', e.target.value)}
                            style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px' }}
                          />
                          <input
                            type="text"
                            placeholder="연락처"
                            value={veh.driverContact}
                            onChange={e => handleVehicleFieldChange(idx, 'driverContact', e.target.value)}
                            style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px' }}
                          />
                          <input
                            type="number"
                            placeholder="운송비(원)"
                            value={veh.deliveryCost}
                            onChange={e => handleVehicleFieldChange(idx, 'deliveryCost', Number(e.target.value))}
                            style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px', fontWeight: 700 }}
                          />
                          <button onClick={() => handleRemoveVehicleRow(idx)} style={{ color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 마감 비고 메모 */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>📝 배차 특이사항 및 마감 메모</label>
                    <textarea
                      value={closingMemo}
                      onChange={e => setClosingMemo(e.target.value)}
                      placeholder="배차 기사 전달사항, 현장 특이사항 기록..."
                      style={{ width: '100%', height: '70px', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', fontSize: '12.5px', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* 하단 배차 상태 변경 버튼 액션 */}
                  {canSave && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={handleSaveDispatch}
                        className="btn-primary"
                        style={{ flex: 1, padding: '12px', fontWeight: 800, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      >
                        <ShieldCheck size={18} /> [🔵 배차 기사 배정 완료] (배차완료 전환)
                      </button>

                      {getNormalizedDeliveryStatus(selectedDelivery) === 'DISPATCHED' && (
                        <button
                          onClick={() => handleCompleteDeliveryStatus(selectedDelivery.id)}
                          style={{ padding: '12px 18px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 800, fontSize: '13.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <CheckCircle size={16} /> [🟢 운송 완료 마감]
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 수동 배차 모달 */}
      {showManualModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 16px 0' }}>🚛 수동 배차 신규 생성</h3>
            
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>배차 구분의 유형</label>
              <select value={manualCategory} onChange={e => setManualCategory(e.target.value as any)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <option value="출고">출고</option>
                <option value="입고">입고</option>
                <option value="반납">반납</option>
                <option value="정비">정비</option>
                <option value="이동">이동</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>출발지 (상차지)</label>
                <input type="text" value={manualOrigin} onChange={e => setManualOrigin(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
              </div>
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>도착지 (하차지)</label>
                <input type="text" value={manualDestination} onChange={e => setManualDestination(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button onClick={() => setShowManualModal(false)} className="btn-secondary">취소</button>
              <button onClick={handleSaveManualDispatch} className="btn-primary" style={{ fontWeight: 800 }}>배차 생성 저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
