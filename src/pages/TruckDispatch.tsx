import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Truck, Check, AlertCircle, Plus, Trash2, CheckCircle } from 'lucide-react';
import { Delivery, TransportCompany, TransportDriver } from '../services/db';

interface AssignedVehicle {
  id: string;
  transportCompany: string;
  vehicleType: string;
  vehicleNo: string;
  driverName: string;
  driverContact: string;
  deliveryCost: number;
}

export const TruckDispatch: React.FC = () => {
  const { deliveries, contracts, customers, assets, contractAssets, transportCompanies, transportDrivers, hasPermission, saveTransportDataOnFly, dispatchDelivery } = useApp();
  const canSave = hasPermission('delivery', 'save');

  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  
  // 다중 차량 배차 리스트 상태
  const [assignedVehicles, setAssignedVehicles] = useState<AssignedVehicle[]>([]);

  // 대기 중인 배차 목록 (REQUESTED)
  const pendingDeliveries = deliveries.filter(d => d.status === 'REQUESTED');
  
  // 마스터 데이터 리스트
  const uniqueCompanies = transportCompanies.map(c => c.name);

  const getContract = (contractId?: string) => contracts.find(c => c.id === contractId);
  const getCustomer = (customerId?: string) => customers.find(c => c.id === customerId);
  
  const getAssignedCount = (delivery: Delivery) => {
    if (delivery.assetIds) {
      return delivery.assetIds.split(',').length;
    }
    if (!delivery.contractId) return 0;
    const cas = contractAssets.filter(ca => ca.contractId === delivery.contractId);
    return cas.filter(ca => ca.assetId).length;
  };

  const handleSelectDelivery = (d: Delivery) => {
    setSelectedDelivery(d);
    setScheduledDate(d.scheduledDate || new Date().toISOString().split('T')[0]);

    // 기존에 배정된 다중 차량 JSON이 있다면 로드, 없으면 1개 기본 생성
    if (d.vehicles) {
      try {
        const parsed = JSON.parse(d.vehicles);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAssignedVehicles(parsed);
          return;
        }
      } catch (e) {
        console.error("Failed to parse delivery vehicles JSON", e);
      }
    }

    // 기본 차량 1대 배정 초기화
    setAssignedVehicles([
      {
        id: 'v-' + Date.now(),
        transportCompany: d.transportCompany || '',
        vehicleType: d.vehicleType || '',
        vehicleNo: d.vehicleNo || '',
        driverName: d.driverName || '',
        driverContact: d.driverContact || '',
        deliveryCost: d.deliveryCost || 70000
      }
    ]);
  };

  // 차량 행 변경 핸들러 및 기사명 오토필
  const handleVehicleFieldChange = (index: number, field: keyof AssignedVehicle, value: any) => {
    const updated = [...assignedVehicles];
    updated[index] = { ...updated[index], [field]: value };

    // 기사 오토필 연동
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
        if (company) {
          updated[index].transportCompany = company.name;
        }
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
        vehicleType: '',
        vehicleNo: '',
        driverName: '',
        driverContact: '',
        deliveryCost: 70000
      }
    ]);
  };

  const handleRemoveVehicleRow = (index: number) => {
    if (assignedVehicles.length <= 1) return;
    setAssignedVehicles(assignedVehicles.filter((_, idx) => idx !== index));
  };

  const handleDispatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDelivery || !canSave) return;

    // 빈 필드 검증
    for (const v of assignedVehicles) {
      if (!v.transportCompany || !v.driverName || !v.vehicleNo || !v.vehicleType || !v.driverContact) {
        alert('모든 배차 차량의 필수 필드(물류사, 기사성명, 차량번호, 차종, 연락처)를 채워주세요.');
        return;
      }
    }

    // 각 차량 정보를 마스터 DB에 백그라운드 등록/누적
    assignedVehicles.forEach(v => {
      saveTransportDataOnFly(v.transportCompany, v.driverName, v.driverContact, v.vehicleNo, v.vehicleType);
    });

    // 전체 임시 운송비 계산
    const totalEstCost = assignedVehicles.reduce((sum, v) => sum + Number(v.deliveryCost), 0);
    const vehiclesJson = JSON.stringify(assignedVehicles);
    const first = assignedVehicles[0];

    // 대표 데이터 및 JSON 일괄 전송
    dispatchDelivery(selectedDelivery.id, {
      scheduledDate,
      transportCompany: first.transportCompany,
      vehicleType: first.vehicleType,
      vehicleNo: first.vehicleNo,
      driverName: first.driverName + (assignedVehicles.length > 1 ? ` 외 ${assignedVehicles.length - 1}대` : ''),
      driverContact: first.driverContact,
      deliveryCost: totalEstCost,
      vehiclesJson
    });

    alert('운송 차량 배차(다중차량 포함) 지정이 성공적으로 확정되었습니다.');
    setSelectedDelivery(null);
    setAssignedVehicles([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontWeight: '700', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Truck size={22} color="var(--primary)" /> 출고 및 회수 배차 (차량 할당)
        </h2>
      </div>

      <div className="card-header" style={{ marginBottom: '-8px' }}>
        <h3 className="card-title">배차 대기 목록 (출고/회수/이동)</h3>
      </div>

      {/* 바둑판(그리드) 형태 대기 목록 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {pendingDeliveries.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)' }}>
            배차 대기 중인 건이 없습니다.
          </div>
        ) : (
          pendingDeliveries.map(d => {
            const contract = getContract(d.contractId);
            const customer = getCustomer(contract?.customerId);
            const isSelected = selectedDelivery?.id === d.id;
            const assignedCnt = getAssignedCount(d);

            // 외주정비회수의 경우 고객사명이 미상일 수 있으므로 메모 등에서 추출 또는 대체 텍스트 표시
            let displayName = customer?.name;
            if (!displayName && d.memo.includes('[외주정비회수]')) {
              const vendorMatch = d.memo.match(/외주업체:\s*(.*?)\s*\|/);
              displayName = vendorMatch ? `${vendorMatch[1]} (외주회수)` : '외주정비업체 회수';
            }
            if (!displayName) displayName = '비계약 일반 이동';

            return (
              <div 
                key={d.id}
                onClick={() => handleSelectDelivery(d)}
                style={{
                  backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-card)',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className={`badge ${d.type === 'OUTBOUND' ? 'badge-primary' : 'badge-warning'}`}>
                    {d.type === 'OUTBOUND' ? '출고 배차' : d.type === 'INBOUND' ? '회수 배차' : d.type === 'EXCHANGE' ? '교환 배차' : '현장 이동'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{d.requestDate}</span>
                </div>
                
                <h4 style={{ margin: '0 0 4px 0', fontSize: '14.5px', fontWeight: '700' }}>
                  {displayName}
                </h4>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  {contract ? `계약번호: ${contract.contractNo}` : `메모: ${d.memo.substring(0, 30)}...`}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-app)', padding: '6px 8px', borderRadius: '4px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>회수 장비 수량</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary)' }}>{assignedCnt}대</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 배차 정보 입력 폼 */}
      {selectedDelivery && (
        <div className="card" style={{ padding: '20px', borderTop: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <h3 className="card-title" style={{ margin: 0 }}>운송 차량 섭외 및 다중 배차 설정</h3>
            <span className="badge badge-primary" style={{ padding: '4px 10px' }}>
              {selectedDelivery.type === 'OUTBOUND' ? '출고' : '회수'} ({getAssignedCount(selectedDelivery)}대 물량)
            </span>
          </div>

          <form onSubmit={handleDispatchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            
            {/* 공통 배차일 */}
            <div style={{ maxWidth: '300px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', marginBottom: '6px', display: 'block' }}>배차/상차 희망일자 *</label>
              <input 
                type="date" 
                value={scheduledDate} 
                onChange={e => setScheduledDate(e.target.value)} 
                required 
              />
            </div>

            {/* 차량 리스트 작성 영역 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '14px', fontWeight: '700' }}>할당 차량 목록 ({assignedVehicles.length}대)</span>
                <button
                  type="button"
                  onClick={handleAddVehicleRow}
                  className="btn-primary"
                  style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={14} /> 차량 추가 배정
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {assignedVehicles.map((v, index) => (
                  <div 
                    key={v.id} 
                    style={{ 
                      padding: '16px', 
                      backgroundColor: 'var(--bg-app)', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: '6px',
                      position: 'relative'
                    }}
                  >
                    {assignedVehicles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveVehicleRow(index)}
                        style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          border: 'none',
                          background: 'none',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          padding: '4px'
                        }}
                        title="차량 제외"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>운송 물류사 *</label>
                        <input 
                          type="text" 
                          list="transport-companies"
                          value={v.transportCompany} 
                          onChange={e => handleVehicleFieldChange(index, 'transportCompany', e.target.value)} 
                          placeholder="물류업체명" 
                          required 
                          style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>기사 성명 *</label>
                        <input 
                          type="text" 
                          list="transport-drivers"
                          value={v.driverName} 
                          onChange={e => handleVehicleFieldChange(index, 'driverName', e.target.value)} 
                          placeholder="홍길동" 
                          required 
                          style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>차량 번호 *</label>
                        <input 
                          type="text" 
                          value={v.vehicleNo} 
                          onChange={e => handleVehicleFieldChange(index, 'vehicleNo', e.target.value)} 
                          placeholder="서울82가 1234" 
                          required 
                          style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>운송차종 *</label>
                        <input 
                          type="text" 
                          value={v.vehicleType} 
                          onChange={e => handleVehicleFieldChange(index, 'vehicleType', e.target.value)} 
                          placeholder="5톤 셀프로더" 
                          required 
                          style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>기사 연락처 *</label>
                        <input 
                          type="text" 
                          value={v.driverContact} 
                          onChange={e => handleVehicleFieldChange(index, 'driverContact', e.target.value)} 
                          placeholder="010-0000-0000" 
                          required 
                          style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>임시/사전 운송비 (원) *</label>
                        <input
                          type="number"
                          value={v.deliveryCost || ''}
                          onChange={e => handleVehicleFieldChange(index, 'deliveryCost', parseInt(e.target.value) || 0)}
                          placeholder="예: 70000"
                          required
                          style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 자가 데이터리스트 연동 */}
            <datalist id="transport-companies">
              {uniqueCompanies.map(c => <option key={c} value={c} />)}
            </datalist>
            <datalist id="transport-drivers">
              {transportDrivers.map(d => {
                const comp = transportCompanies.find(c => c.id === d.companyId);
                const compName = comp ? comp.name : '미상';
                return <option key={d.id} value={`${d.driverName} (${compName})`} />;
              })}
            </datalist>

            {/* 요약비용 및 확정 버튼 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-app)', padding: '12px 18px', borderRadius: '6px', marginTop: '10px' }}>
              <div style={{ fontSize: '14px' }}>
                총 배정 차량: <strong style={{ color: 'var(--primary)' }}>{assignedVehicles.length}대</strong> | 임시 합계 운송비: <strong style={{ color: 'var(--danger)' }}>{assignedVehicles.reduce((sum, v) => sum + Number(v.deliveryCost), 0).toLocaleString()}원</strong>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn-secondary" onClick={() => { setSelectedDelivery(null); setAssignedVehicles([]); }}>취소</button>
                <button type="submit" className="btn-success" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                  <CheckCircle size={16} /> 배차 확정 및 전송
                </button>
              </div>
            </div>

          </form>
        </div>
      )}
    </div>
  );
};
