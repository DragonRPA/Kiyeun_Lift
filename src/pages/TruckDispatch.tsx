import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Truck, Check, AlertCircle, Plus, Trash2, Clock, Layers, 
  FileText, Copy, Lock, CreditCard, CheckCircle, RefreshCw, X
} from 'lucide-react';
import { Delivery, TransportCompany, TransportDriver, db } from '../services/db';

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

  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [originAddress, setOriginAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [billableToCust, setBillableToCust] = useState(false);
  const [billableCustId, setBillableCustId] = useState('');
  const [assignedVehicles, setAssignedVehicles] = useState<AssignedVehicleRow[]>([]);

  const [showManualModal, setShowManualModal] = useState(false);
  const [manualType, setManualType] = useState<'OUTBOUND' | 'INBOUND' | 'MOVEMENT' | 'RETURN'>('OUTBOUND');
  const [manualCustomerId, setManualCustomerId] = useState('');
  const [manualOrigin, setManualOrigin] = useState('당사 보관소');
  const [manualDestination, setManualDestination] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualExpectedCost, setManualExpectedCost] = useState(70000);
  const [manualBillable, setManualBillable] = useState(false);
  const [manualMemo, setManualMemo] = useState('');

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

  const parseCargoItems = (d: Delivery): CargoItem[] => {
    if (d.cargoItems) {
      try { return JSON.parse(d.cargoItems); } catch (e) {}
    }
    return [];
  };

  const handleSelectDelivery = (d: Delivery) => {
    setSelectedDelivery(d);
    setScheduledDate(d.scheduledDate || new Date().toISOString().split('T')[0]);
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

      const matchedDriver = transportDrivers.find(d => {
        const company = transportCompanies.find(c => c.id === d.companyId);
        if (searchCompany && company?.name !== searchCompany) return false;
        return d.driverName === searchName;
      });

      if (matchedDriver) {
        const company = transportCompanies.find(c => c.id === matchedDriver.companyId);
        if (company) updated[index].transportCompany = company.name;
        updated[index].driverName = searchName;
        if (matchedDriver.vehicleNo) updated[index].vehicleNo = matchedDriver.vehicleNo;
        if (matchedDriver.vehicleType) updated[index].vehicleType = matchedDriver.vehicleType;
        if (matchedDriver.driverContact) updated[index].driverContact = matchedDriver.driverContact;
      }
    }
    setAssignedVehicles(updated);
  };

  const handleAddVehicleRow = () => {
    setAssignedVehicles([
      ...assignedVehicles,
      {
        id: 'v-' + Date.now() + '-' + assignedVehicles.length,
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
    if (assignedVehicles.length === 1) {
      alert('최소 1대의 배차 차량 정보가 포함되어야 합니다.');
      return;
    }
    setAssignedVehicles(assignedVehicles.filter((_, i) => i !== index));
  };

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDelivery) return;

    if (selectedDelivery.reconciliationStatus === 'PAID') {
      alert('🔒 정산 및 지급이 이미 완료된 배차 건은 수정/배차가 원천 차단됩니다.');
      return;
    }

    const firstV = assignedVehicles[0];
    const totalCost = assignedVehicles.reduce((sum, v) => sum + (Number(v.deliveryCost) || 0), 0);

    const payload: Partial<Delivery> = {
      scheduledDate,
      originAddress,
      destinationAddress,
      transportCompany: firstV?.transportCompany || '',
      vehicleType: firstV?.vehicleType || '',
      vehicleNo: firstV?.vehicleNo || '',
      driverName: firstV?.driverName || '',
      driverContact: firstV?.driverContact || '',
      deliveryCost: totalCost,
      expectedCost: selectedDelivery.expectedCost || totalCost,
      finalCost: totalCost,
      vehicles: JSON.stringify(assignedVehicles),
      billableToCustomer: billableToCust,
      billableCustomerId: billableCustId,
      status: 'DISPATCHED'
    };

    try {
      db.updateRow<Delivery>('deliveries', selectedDelivery.id, payload as any);
      await db.awaitPendingWrites();
      refreshAllData();
      alert('배차 지시 및 운송 기사 배정이 정상적으로 등록 완료되었습니다.');
      setSelectedDelivery(null);
    } catch (err: any) {
      showErrorModal(`⚠️ 배차 지시 저장 중 오류가 발생했습니다:\n\n${err?.message || err}`);
    }
  };

  const handleAddManualVehicleReq = () => {
    setManualVehicles([...manualVehicles, { vehicleType: '3.5T', count: 1 }]);
  };

  const handleAddManualCargo = () => {
    setManualCargos([...manualCargos, { modelName: products[0]?.modelName || '', count: 1 }]);
  };

  const handleCreateManualDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualOrigin || !manualDestination) {
      alert('상차지와 하차지는 필수 입력 항목입니다.');
      return;
    }

    try {
      db.insertRow<Delivery>('deliveries', {
        type: manualType,
        status: 'REQUESTED',
        requestDate: new Date().toISOString().split('T')[0],
        scheduledDate: manualDate,
        originAddress: manualOrigin,
        destinationAddress: manualDestination,
        deliveryCost: manualExpectedCost,
        expectedCost: manualExpectedCost,
        finalCost: manualExpectedCost,
        reconciliationStatus: 'PENDING',
        vehicleRequirements: JSON.stringify(manualVehicles),
        cargoItems: JSON.stringify(manualCargos),
        billableToCustomer: manualBillable,
        billableCustomerId: manualCustomerId || undefined,
        isCostSettled: false,
        memo: manualMemo,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as any);

      await db.awaitPendingWrites();
      refreshAllData();
      alert(`신규 수동 배차 요청 생성이 성공적으로 완료되었습니다.`);
      setShowManualModal(false);
    } catch (err: any) {
      showErrorModal(`⚠️ 수동 배차 생성 실패:\n\n${err?.message || err}`);
    }
  };

  const filteredReconDeliveries = deliveries.filter(d => {
    if (d.status !== 'DISPATCHED' && d.status !== 'COMPLETED') return false;
    if (reconCompanyFilter !== 'ALL' && d.transportCompany !== reconCompanyFilter) return false;
    if (reconYmFilter) {
      const dateStr = d.scheduledDate || d.requestDate;
      if (!dateStr || !dateStr.startsWith(reconYmFilter)) return false;
    }
    if (reconStatusFilter !== 'ALL' && (d.reconciliationStatus || 'PENDING') !== reconStatusFilter) return false;
    return true;
  });

  const handleToggleSelectAllRecon = () => {
    if (selectedDeliveryIds.length === filteredReconDeliveries.length) setSelectedDeliveryIds([]);
    else setSelectedDeliveryIds(filteredReconDeliveries.map(d => d.id));
  };

  const handleToggleSelectRecon = (id: string) => {
    if (selectedDeliveryIds.includes(id)) setSelectedDeliveryIds(selectedDeliveryIds.filter(i => i !== id));
    else setSelectedDeliveryIds([...selectedDeliveryIds, id]);
  };

  const selectedDeliveriesObj = deliveries.filter(d => selectedDeliveryIds.includes(d.id));
  const sumSupplyAmount = selectedDeliveriesObj.reduce((sum, d) => sum + (d.finalCost || d.deliveryCostConfirmed || d.expectedCost || d.deliveryCost || 0), 0);
  const sumVatAmount = Math.round(sumSupplyAmount * 0.1);
  const sumTotalAmount = sumSupplyAmount + sumVatAmount;

  const handleCopyCompanyAccount = (compName: string) => {
    const comp = transportCompanies.find(c => c.name === compName);
    if (!comp || !comp.bankAccount) {
      alert('등록된 계좌 정보가 없는 운송사입니다.');
      return;
    }
    navigator.clipboard.writeText(`${comp.name} | ${comp.bankName || ''} ${comp.bankAccount} (${comp.bankHolder || ''})`);
    setCopiedCompanyId(comp.id);
    setTimeout(() => setCopiedCompanyId(null), 2000);
  };

  const handleOpenCostEdit = (d: Delivery) => {
    if (d.reconciliationStatus === 'PAID') {
      alert('🔒 이미 지급 완료(PAID)된 배차 건은 금액 수정이 불가능합니다.');
      return;
    }
    setEditingCostDelivery(d);
    setEditFinalCost(d.finalCost || d.deliveryCostConfirmed || d.expectedCost || d.deliveryCost || 0);
    setEditAdjustmentReason(d.costAdjustmentReason || '');
    setShowCostEditModal(true);
  };

  const handleSaveCostEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCostDelivery) return;

    try {
      db.updateRow<Delivery>('deliveries', editingCostDelivery.id, {
        finalCost: editFinalCost,
        deliveryCostConfirmed: editFinalCost,
        deliveryCost: editFinalCost,
        costAdjustmentReason: editAdjustmentReason,
        reconciliationStatus: editingCostDelivery.reconciliationStatus === 'PENDING' ? 'RECONCILED' : editingCostDelivery.reconciliationStatus,
        updatedAt: new Date().toISOString()
      } as any);

      await db.awaitPendingWrites();
      refreshAllData();
      alert('최종 운송료가 성공적으로 반영되었습니다.');
      setShowCostEditModal(false);
      setEditingCostDelivery(null);
    } catch (err: any) { showErrorModal(`⚠️ 수정 실패:\n\n${err?.message || err}`); }
  };

  const handleRequestPaymentSubmit = async () => {
    if (selectedDeliveryIds.length === 0) return;
    if (selectedDeliveriesObj.some(d => d.reconciliationStatus === 'PAID')) {
      alert('지급 완료 건은 제외 후 진행해주세요.');
      return;
    }
    if (!confirm(`선택한 ${selectedDeliveryIds.length}건에 대해 지급 요청을 전송하시겠습니까?`)) return;

    try {
      const nowIso = new Date().toISOString();
      selectedDeliveryIds.forEach(id => db.updateRow<Delivery>('deliveries', id, { reconciliationStatus: 'PAYMENT_REQUESTED', paymentRequestedAt: nowIso, updatedAt: nowIso } as any));
      await db.awaitPendingWrites();
      refreshAllData();
      setSelectedDeliveryIds([]);
    } catch (err: any) { showErrorModal(`⚠️ 실패: ${err?.message}`); }
  };

  const handleCompletePayment = async () => {
    if (selectedDeliveryIds.length === 0) return;
    if (!confirm(`최종 [지급 완료] 마감 처리하시겠습니까?`)) return;

    try {
      const nowIso = new Date().toISOString();
      selectedDeliveryIds.forEach(id => db.updateRow<Delivery>('deliveries', id, { reconciliationStatus: 'PAID', paymentCompletedAt: nowIso, isCostSettled: true, updatedAt: nowIso } as any));
      await db.awaitPendingWrites();
      refreshAllData();
      setSelectedDeliveryIds([]);
    } catch (err: any) { showErrorModal(`⚠️ 실패: ${err?.message}`); }
  };

  const handleCancelPaymentRequest = async () => {
    if (selectedDeliveryIds.length === 0) return;
    if (selectedDeliveriesObj.some(d => d.reconciliationStatus === 'PAID')) return;
    
    try {
      selectedDeliveryIds.forEach(id => db.updateRow<Delivery>('deliveries', id, { reconciliationStatus: 'PENDING', updatedAt: new Date().toISOString() } as any));
      await db.awaitPendingWrites();
      refreshAllData();
      setSelectedDeliveryIds([]);
    } catch (err: any) { showErrorModal(`⚠️ 실패: ${err?.message}`); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontWeight: '700', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Truck size={22} color="var(--primary)" /> 배차 / 운송 관리 및 월말 운송료 대사
        </h2>
        {canSave && (
          <button className="btn-primary" onClick={() => setShowManualModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} /> [+ 수동 배차 생성]
          </button>
        )}
      </div>

      {/* 탭 네비게이션 */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('DISPATCH')}
          style={{
            padding: '10px 16px', fontSize: '14px', fontWeight: '600', backgroundColor: 'transparent', border: 'none',
            borderBottom: activeTab === 'DISPATCH' ? '2.5px solid var(--primary)' : 'none',
            color: activeTab === 'DISPATCH' ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer'
          }}
        >
          <Truck size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          배차 및 운송 기사 배정 관리
        </button>
        <button
          onClick={() => setActiveTab('RECONCILIATION')}
          style={{
            padding: '10px 16px', fontSize: '14px', fontWeight: '600', backgroundColor: 'transparent', border: 'none',
            borderBottom: activeTab === 'RECONCILIATION' ? '2.5px solid var(--primary)' : 'none',
            color: activeTab === 'RECONCILIATION' ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer'
          }}
        >
          <FileText size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          월말 운송료 대사 및 매입 지급 요청
        </button>
      </div>

      {/* 탭 1: 배차 관리 */}
      {activeTab === 'DISPATCH' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={16} className="text-warning" /> 출고 / 회수 배차 대기 목록 ({deliveries.filter(d => d.status === 'REQUESTED').length}건)
              </h3>
            </div>
            
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '650px', overflowY: 'auto' }}>
              {deliveries.filter(d => d.status === 'REQUESTED').length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  대기 중인 배차 요청이 없습니다.
                </div>
              ) : (
                deliveries.filter(d => d.status === 'REQUESTED').map(d => {
                  const contract = getContract(d.contractId);
                  const customer = contract ? getCustomer(contract.customerId) : null;
                  const isSelected = selectedDelivery?.id === d.id;
                  const cargoItems = parseCargoItems(d);

                  return (
                    <div 
                      key={d.id}
                      onClick={() => handleSelectDelivery(d)}
                      style={{
                        padding: '12px', borderRadius: '8px', cursor: 'pointer',
                        backgroundColor: isSelected ? 'var(--bg-active)' : 'transparent',
                        border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span className={`badge ${d.type === 'OUTBOUND' ? 'badge-info' : d.type === 'INBOUND' ? 'badge-warning' : d.type === 'RETURN' ? 'badge-danger' : 'badge-secondary'}`}>
                          {d.type === 'OUTBOUND' ? '출고 배차' : d.type === 'INBOUND' ? '회수 배차' : d.type === 'RETURN' ? '반납 배차' : '이동 배차'}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>요청일: {d.requestDate}</span>
                      </div>
                      
                      <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>
                        {customer?.name || (d.destinationAddress ? d.destinationAddress.split(' ')[0] : '미지정 고객')}
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        <div>🚩 <strong>상차:</strong> {d.originAddress || '당사 보관소'}</div>
                        <div>🏁 <strong>하차:</strong> {d.destinationAddress || '고객 현장'}</div>
                      </div>

                      {cargoItems.length > 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--primary)', backgroundColor: 'var(--bg-card)', padding: '4px 6px', borderRadius: '4px', marginTop: '4px' }}>
                          📦 운반장비: {cargoItems.map(c => `${c.modelName} ${c.count}대`).join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="card">
            {selectedDelivery ? (
              <form onSubmit={handleDispatchSubmit}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="card-title">배차 지시 및 운송 기사 배정 ({selectedDelivery.id})</h3>
                  {selectedDelivery.reconciliationStatus === 'PAID' && (
                    <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Lock size={12} /> 정산/지급 완료 (수정 불가)
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '12px', backgroundColor: 'var(--bg-active)', borderRadius: '8px' }}>
                    <div>
                      <label style={{ fontWeight: '700' }}>🚩 상차지 (출발 장소) *</label>
                      <input type="text" value={originAddress} onChange={e => setOriginAddress(e.target.value)} disabled={selectedDelivery.reconciliationStatus === 'PAID'} required />
                    </div>
                    <div>
                      <label style={{ fontWeight: '700' }}>🏁 하차지 (도착 장소) *</label>
                      <input type="text" value={destinationAddress} onChange={e => setDestinationAddress(e.target.value)} disabled={selectedDelivery.reconciliationStatus === 'PAID'} required />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label>배차 예정일시 *</label>
                      <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} disabled={selectedDelivery.reconciliationStatus === 'PAID'} required />
                    </div>
                    <div>
                      <label>비용 부담 주체 (고객 청구 여부)</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={billableToCust} onChange={e => setBillableToCust(e.target.checked)} disabled={selectedDelivery.reconciliationStatus === 'PAID'} />
                        <span>고객사 청구 대상 (billableToCustomer)</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontWeight: '700', fontSize: '14px' }}>🚚 운송 차량 및 기사 배정 목록 ({assignedVehicles.length}대)</label>
                      {canSave && selectedDelivery.reconciliationStatus !== 'PAID' && (
                        <button type="button" className="btn-secondary" onClick={handleAddVehicleRow} style={{ padding: '2px 8px', fontSize: '12px' }}>
                          + 차량 1대 추가
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {assignedVehicles.map((vRow, idx) => (
                        <div key={vRow.id} style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: 'var(--bg-card)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--primary)' }}>차량 #{idx + 1}</span>
                            {assignedVehicles.length > 1 && canSave && selectedDelivery.reconciliationStatus !== 'PAID' && (
                              <button type="button" onClick={() => handleRemoveVehicleRow(idx)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '8px' }}>
                            <div>
                              <label style={{ fontSize: '11px' }}>기사명 (오토필)</label>
                              <input type="text" value={vRow.driverName || ''} onChange={e => handleVehicleFieldChange(idx, 'driverName', e.target.value)} disabled={selectedDelivery.reconciliationStatus === 'PAID'} />
                            </div>
                            <div>
                              <label style={{ fontSize: '11px' }}>운송사</label>
                              <select value={vRow.transportCompany || ''} onChange={e => handleVehicleFieldChange(idx, 'transportCompany', e.target.value)} disabled={selectedDelivery.reconciliationStatus === 'PAID'}>
                                <option value="">-- 선택 --</option>
                                {transportCompanies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                              </select>
                            </div>
                            <div>
                              <label style={{ fontSize: '11px' }}>차종/톤수</label>
                              <select value={vRow.vehicleType || '3.5T'} onChange={e => handleVehicleFieldChange(idx, 'vehicleType', e.target.value)} disabled={selectedDelivery.reconciliationStatus === 'PAID'}>
                                {VEHICLE_TYPE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                            <div>
                              <label style={{ fontSize: '11px' }}>차량번호</label>
                              <input type="text" value={vRow.vehicleNo || ''} onChange={e => handleVehicleFieldChange(idx, 'vehicleNo', e.target.value)} disabled={selectedDelivery.reconciliationStatus === 'PAID'} />
                            </div>
                            <div>
                              <label style={{ fontSize: '11px' }}>운송료 (원)</label>
                              <input type="number" value={vRow.deliveryCost || 0} onChange={e => handleVehicleFieldChange(idx, 'deliveryCost', parseInt(e.target.value) || 0)} disabled={selectedDelivery.reconciliationStatus === 'PAID'} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                    <button type="button" className="btn-secondary" onClick={() => setSelectedDelivery(null)}>취소</button>
                    {canSave && selectedDelivery.reconciliationStatus !== 'PAID' && (
                      <button type="submit" className="btn-primary">배차 지시 완료</button>
                    )}
                  </div>
                </div>
              </form>
            ) : (
              <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                👈 왼쪽 대기 목록에서 배차할 항목을 선택하시거나 상단의 <strong>[+ 수동 배차 생성]</strong>을 클릭해주세요.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 탭 2: 월말 대사 */}
      {activeTab === 'RECONCILIATION' && (
        <div>
          <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700' }}>운송 거래처 (물류사)</label>
                  <select value={reconCompanyFilter} onChange={e => setReconCompanyFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px' }}>
                    <option value="ALL">전체 운송사</option>
                    {transportCompanies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700' }}>매출/배차 귀속월</label>
                  <input type="month" value={reconYmFilter} onChange={e => setReconYmFilter(e.target.value)} style={{ padding: '5px 10px', borderRadius: '6px' }} />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700' }}>대사 / 지급 상태</label>
                  <select value={reconStatusFilter} onChange={e => setReconStatusFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px' }}>
                    <option value="ALL">전체 상태</option>
                    <option value="PENDING">미대사 (PENDING)</option>
                    <option value="RECONCILED">대사완료 (RECONCILED)</option>
                    <option value="PAYMENT_REQUESTED">지급요청 (REQUESTED)</option>
                    <option value="PAID">지급완료 (PAID - Lock)</option>
                  </select>
                </div>
              </div>

              {reconCompanyFilter !== 'ALL' && (
                <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-active)', borderRadius: '6px', border: '1px solid var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CreditCard size={16} color="var(--primary)" />
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>
                    {reconCompanyFilter} 계좌: {transportCompanies.find(c => c.name === reconCompanyFilter)?.bankName || '은행미등록'} {transportCompanies.find(c => c.name === reconCompanyFilter)?.bankAccount || '계좌미등록'} ({transportCompanies.find(c => c.name === reconCompanyFilter)?.bankHolder || ''})
                  </span>
                  <button className="btn-secondary" onClick={() => handleCopyCompanyAccount(reconCompanyFilter)} style={{ padding: '2px 6px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    {copiedCompanyId ? <Check size={12} color="var(--success)" /> : <Copy size={12} />} 계좌복사
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ marginBottom: '20px', padding: '16px', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: '700', fontSize: '15px' }}>선택 항목 대사 집계: </span>
                <span style={{ fontSize: '14px', marginLeft: '8px' }}>
                  선택 <strong>{selectedDeliveryIds.length}</strong>건 | 
                  공급가액: <strong style={{ color: 'var(--primary)' }}>{sumSupplyAmount.toLocaleString()}원</strong> | 
                  부가세(10%): <strong>{sumVatAmount.toLocaleString()}원</strong> | 
                  <strong style={{ color: 'var(--success)', fontSize: '16px', marginLeft: '6px' }}>총 합계: {sumTotalAmount.toLocaleString()}원</strong>
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {canSave && selectedDeliveryIds.length > 0 && (
                  <>
                    <button className="btn-warning" onClick={handleCancelPaymentRequest} style={{ padding: '6px 12px', fontSize: '12px' }}>
                      ↺ 지급요청 회수 (재정산)
                    </button>
                    <button className="btn-primary" onClick={handleRequestPaymentSubmit} style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FileText size={14} /> 매입 담당자 지급 요청
                    </button>
                    <button className="btn-success" onClick={handleCompletePayment} style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Lock size={14} /> 최종 지급 완료 마감
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input type="checkbox" checked={selectedDeliveryIds.length === filteredReconDeliveries.length && filteredReconDeliveries.length > 0} onChange={handleToggleSelectAllRecon} />
                  </th>
                  <th>일자</th>
                  <th>운송 거래처</th>
                  <th>상차지</th>
                  <th>하차지</th>
                  <th>차종/대수</th>
                  <th>최초 예상운송료</th>
                  <th>최종 확정운송료 (공급가액)</th>
                  <th>할증/할인 사유</th>
                  <th>대사 상태</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {filteredReconDeliveries.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      조회 조건에 해당하는 완료된 배차 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredReconDeliveries.map(d => {
                    const isSelected = selectedDeliveryIds.includes(d.id);
                    const expectedCost = d.expectedCost || d.deliveryCost || 0;
                    const finalCost = d.finalCost || d.deliveryCostConfirmed || expectedCost;
                    const isDiff = expectedCost !== finalCost;

                    return (
                      <tr key={d.id} style={{ backgroundColor: isSelected ? 'var(--bg-active)' : 'transparent' }}>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={isSelected} onChange={() => handleToggleSelectRecon(d.id)} />
                        </td>
                        <td>{d.scheduledDate || d.requestDate}</td>
                        <td style={{ fontWeight: '700' }}>{d.transportCompany || '미지정'}</td>
                        <td style={{ fontSize: '12px' }}>{d.originAddress || '-'}</td>
                        <td style={{ fontSize: '12px' }}>{d.destinationAddress || '-'}</td>
                        <td><span className="badge badge-info">{d.vehicleType || '3.5T'}</span></td>
                        <td style={{ color: 'var(--text-muted)', textDecoration: isDiff ? 'line-through' : 'none' }}>
                          {expectedCost.toLocaleString()}원
                        </td>
                        <td style={{ fontWeight: '700', color: isDiff ? 'var(--danger)' : 'var(--text-main)' }}>
                          {finalCost.toLocaleString()}원
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{d.costAdjustmentReason || '-'}</td>
                        <td>
                          <span className={`badge ${
                            d.reconciliationStatus === 'PAID' ? 'badge-success' :
                            d.reconciliationStatus === 'PAYMENT_REQUESTED' ? 'badge-primary' :
                            d.reconciliationStatus === 'RECONCILED' ? 'badge-info' : 'badge-secondary'
                          }`}>
                            {d.reconciliationStatus === 'PAID' ? '🔒 지급완료' :
                             d.reconciliationStatus === 'PAYMENT_REQUESTED' ? '지급요청' :
                             d.reconciliationStatus === 'RECONCILED' ? '대사완료' : '미대사'}
                          </span>
                        </td>
                        <td>
                          {canSave && (
                            <button 
                              className="btn-secondary" 
                              onClick={() => handleOpenCostEdit(d)} 
                              style={{ padding: '2px 6px', fontSize: '11px' }}
                              disabled={d.reconciliationStatus === 'PAID'}
                            >
                              금액조정
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 수동 배차 생성 모달 */}
      {showManualModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleCreateManualDelivery} className="card" style={{ width: '100%', maxWidth: '650px', backgroundColor: 'var(--bg-card)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>신규 수동 배차 요청 생성</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label>배차 구분 *</label>
                  <select value={manualType} onChange={e => setManualType(e.target.value as any)}>
                    <option value="OUTBOUND">출고 배차</option>
                    <option value="INBOUND">회수 배차</option>
                    <option value="MOVEMENT">현장 이동</option>
                    <option value="RETURN">임차 반납</option>
                  </select>
                </div>
                <div>
                  <label>고객사 선택</label>
                  <select value={manualCustomerId} onChange={e => setManualCustomerId(e.target.value)}>
                    <option value="">-- 미지정 --</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label>배차 희망일시 *</label>
                  <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label>상차지 (출발 장소) *</label>
                  <input type="text" value={manualOrigin} onChange={e => setManualOrigin(e.target.value)} required placeholder="예: 당사 용인보관소" />
                </div>
                <div>
                  <label>하차지 (도착 장소) *</label>
                  <input type="text" value={manualDestination} onChange={e => setManualDestination(e.target.value)} required placeholder="예: 평택 고덕 현장" />
                </div>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'var(--bg-active)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontWeight: '700', fontSize: '13px' }}>🚚 차량 종류별 대수 지정 (멀티 배차)</label>
                  <button type="button" onClick={handleAddManualVehicleReq} style={{ padding: '2px 6px', fontSize: '11px' }}>+ 차종 추가</button>
                </div>
                {manualVehicles.map((v, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                    <select value={v.vehicleType} onChange={e => {
                      const copy = [...manualVehicles];
                      copy[i].vehicleType = e.target.value;
                      setManualVehicles(copy);
                    }}>
                      {VEHICLE_TYPE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                    <input type="number" min={1} value={v.count} onChange={e => {
                      const copy = [...manualVehicles];
                      copy[i].count = parseInt(e.target.value) || 1;
                      setManualVehicles(copy);
                    }} style={{ width: '80px' }} />
                    <span>대</span>
                  </div>
                ))}
              </div>

              <div style={{ padding: '12px', backgroundColor: 'var(--bg-active)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontWeight: '700', fontSize: '13px' }}>📦 운반 대상 장비 모델 및 대수</label>
                  <button type="button" onClick={handleAddManualCargo} style={{ padding: '2px 6px', fontSize: '11px' }}>+ 장비 추가</button>
                </div>
                {manualCargos.map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                    <select value={c.modelName} onChange={e => {
                      const copy = [...manualCargos];
                      copy[i].modelName = e.target.value;
                      setManualCargos(copy);
                    }}>
                      {products.map(p => <option key={p.id} value={p.modelName}>{p.modelName}</option>)}
                    </select>
                    <input type="number" min={1} value={c.count} onChange={e => {
                      const copy = [...manualCargos];
                      copy[i].count = parseInt(e.target.value) || 1;
                      setManualCargos(copy);
                    }} style={{ width: '80px' }} />
                    <span>대</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label>최초 예상 운송료 (원)</label>
                  <input type="number" value={manualExpectedCost} onChange={e => setManualExpectedCost(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label>고객 청구 여부</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                    <input type="checkbox" checked={manualBillable} onChange={e => setManualBillable(e.target.checked)} />
                    <span>고객 청구 대상</span>
                  </label>
                </div>
              </div>

              <div>
                <label>특이사항 / 메모</label>
                <textarea value={manualMemo} onChange={e => setManualMemo(e.target.value)} rows={2} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowManualModal(false)}>취소</button>
              <button type="submit" className="btn-primary">배차 생성</button>
            </div>
          </form>
        </div>
      )}

      {/* 최종 운송료 / 사유 수정 모달 */}
      {showCostEditModal && editingCostDelivery && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleSaveCostEdit} className="card" style={{ width: '100%', maxWidth: '420px', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>최종 확정 운송료 및 할증 사유 수정</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label>최초 예상 운송료</label>
                <input type="text" value={`${(editingCostDelivery.expectedCost || editingCostDelivery.deliveryCost || 0).toLocaleString()}원`} disabled />
              </div>

              <div>
                <label>최종 확정 운송료 (공급가액) *</label>
                <input 
                  type="number" 
                  value={editFinalCost} 
                  onChange={e => setEditFinalCost(parseInt(e.target.value) || 0)} 
                  required 
                />
              </div>

              <div>
                <label>운송료 변동/할증/할인 사유</label>
                <textarea 
                  value={editAdjustmentReason} 
                  onChange={e => setEditAdjustmentReason(e.target.value)} 
                  placeholder="예: 현장대기 2시간 추가, 2회 이동상차 등" 
                  rows={3} 
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowCostEditModal(false)}>취소</button>
              <button type="submit" className="btn-primary">수정 반영</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
