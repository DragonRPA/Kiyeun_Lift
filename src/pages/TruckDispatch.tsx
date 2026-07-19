import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Truck, Check, AlertCircle, ChevronDown, CheckCircle } from 'lucide-react';
import { Delivery, TransportCompany, TransportDriver } from '../services/db';

export const TruckDispatch: React.FC = () => {
  const { deliveries, contracts, customers, assets, contractAssets, transportCompanies, transportDrivers, hasPermission, saveTransportDataOnFly } = useApp();
  const canSave = hasPermission('delivery', 'save');

  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [transportCompany, setTransportCompany] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverContact, setDriverContact] = useState('');
  const [deliveryCost, setDeliveryCost] = useState(0);

  // 대기 중인 배차 목록 (REQUESTED)
  const pendingDeliveries = deliveries.filter(d => d.status === 'REQUESTED');
  
  // 마스터 데이터 리스트
  const uniqueCompanies = transportCompanies.map(c => c.name);

  // 현재 선택된 업체에 해당하는 기사 목록 필터링 (정방향 연동)
  const availableDrivers = transportDrivers.filter(d => {
    if (!transportCompany) return true; // 업체가 없으면 모두 표시 (역방향 연동을 위해)
    const company = transportCompanies.find(c => c.name === transportCompany);
    return company ? d.companyId === company.id : true;
  });

  // 기사명 입력값(driverName)이 변경될 때의 역방향 오토필 효과
  useEffect(() => {
    if (!driverName) return;
    
    // 포맷: "홍길동 (대한물류)" 인 경우 파싱
    let searchName = driverName;
    let searchCompany = '';
    const match = driverName.match(/^(.*?)\s*\((.*?)\)$/);
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
      if (company && !transportCompany) {
        setTransportCompany(company.name);
      }
      // 이름 부분만 깔끔하게 세팅
      if (match) setDriverName(searchName);
      
      // Auto-fill 나머지 필드
      if (matchedDriver.vehicleNo) setVehicleNo(matchedDriver.vehicleNo);
      if (matchedDriver.vehicleType) setVehicleType(matchedDriver.vehicleType);
      if (matchedDriver.driverContact) setDriverContact(matchedDriver.driverContact);
    }
  }, [driverName]);

  const getContract = (contractId?: string) => contracts.find(c => c.id === contractId);
  const getCustomer = (customerId?: string) => customers.find(c => c.id === customerId);
  
  const getAssignedCount = (contractId?: string) => {
    if (!contractId) return 0;
    const cas = contractAssets.filter(ca => ca.contractId === contractId);
    return cas.filter(ca => ca.assetId).length;
  };

  const handleSelectDelivery = (d: Delivery) => {
    setSelectedDelivery(d);
    setTransportCompany(d.transportCompany || '');
    setVehicleType(d.vehicleType || '');
    setVehicleNo(d.vehicleNo || '');
    setDriverName(d.driverName || '');
    setDriverContact(d.driverContact || '');
    setDeliveryCost(d.deliveryCost || 0);
  };

  const handleDispatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDelivery || !canSave) return;

    // 마스터 데이터 백그라운드 누적 로직 (Save-on-the-fly)
    saveTransportDataOnFly(transportCompany, driverName, driverContact, vehicleNo, vehicleType);

    // TODO: 배차 로컬 저장 (실제로는 AppContext의 saveDelivery 등)
    const list = [...deliveries];
    const idx = list.findIndex(item => item.id === selectedDelivery.id);
    if (idx !== -1) {
      list[idx] = { 
        ...list[idx], 
        status: 'DISPATCHED', 
        transportCompany,
        vehicleType,
        vehicleNo,
        driverName,
        driverContact,
        deliveryCost,
        updatedAt: new Date().toISOString() 
      };
      localStorage.setItem('erp_deliveries', JSON.stringify(list));
      alert('배차 확정 및 기사 마스터 누적이 완료되었습니다.');
      window.location.reload();
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontWeight: '700', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Truck size={20} color="var(--primary)" /> 출고 및 회수 배차 (차량 할당)
        </h2>
      </div>

      <div className="card-header" style={{ marginBottom: '12px' }}>
        <h3 className="card-title">배차 대기 목록 (출고/회수/이동)</h3>
      </div>

      {/* 바둑판(그리드) 형태 대기 목록 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {pendingDeliveries.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '30px', backgroundColor: 'var(--bg-card)', borderRadius: '6px' }}>
            배차 대기 중인 건이 없습니다.
          </div>
        ) : (
          pendingDeliveries.map(d => {
            const contract = getContract(d.contractId);
            const customer = getCustomer(contract?.customerId);
            const isSelected = selectedDelivery?.id === d.id;
            const assignedCnt = getAssignedCount(d.contractId);

            return (
              <div 
                key={d.id}
                onClick={() => handleSelectDelivery(d)}
                style={{
                  backgroundColor: isSelected ? 'var(--bg-active)' : 'var(--bg-card)',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className={`badge ${d.type === 'OUTBOUND' ? 'badge-primary' : 'badge-warning'}`}>
                    {d.type === 'OUTBOUND' ? '출고 배차' : d.type === 'INBOUND' ? '회수 배차' : d.type === 'EXCHANGE' ? '교환 배차' : '현장 이동'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{d.requestDate}</span>
                </div>
                
                <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '700' }}>
                  {customer?.name || '미상'}
                </h4>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  계약: {contract?.contractNo || '-'}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-body)', padding: '6px 8px', borderRadius: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600' }}>할당된 장비 대수</span>
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
            <h3 className="card-title">운송 차량 섭외 및 배차 정보 입력</h3>
            <span className="badge badge-primary">{selectedDelivery.type}</span>
          </div>

          <form onSubmit={handleDispatchSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', marginBottom: '4px', display: 'block' }}>운송 거래처 (물류사) *</label>
                <input 
                  type="text" 
                  list="transport-companies"
                  value={transportCompany} 
                  onChange={e => setTransportCompany(e.target.value)} 
                  placeholder="직접 입력 또는 선택" 
                  required 
                  style={{ width: '100%', padding: '8px' }}
                />
                <datalist id="transport-companies">
                  {uniqueCompanies.map(c => <option key={c} value={c} />)}
                </datalist>
                <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>* 신규 업체 입력 시 마스터 자동 등록</small>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', marginBottom: '4px', display: 'block' }}>기사 성명 (동명이인 주의) *</label>
                <input 
                  type="text" 
                  list="transport-drivers"
                  value={driverName} 
                  onChange={e => setDriverName(e.target.value)} 
                  placeholder="예: 홍길동" 
                  required 
                  style={{ width: '100%', padding: '8px' }}
                />
                <datalist id="transport-drivers">
                  {availableDrivers.map(d => {
                    const comp = transportCompanies.find(c => c.id === d.companyId);
                    const compName = comp ? comp.name : '미상';
                    // 괄호 병기 처리
                    return <option key={d.id} value={`${d.driverName} (${compName})`} />;
                  })}
                </datalist>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', marginBottom: '4px', display: 'block' }}>차량 번호 *</label>
                <input 
                  type="text" 
                  value={vehicleNo} 
                  onChange={e => setVehicleNo(e.target.value)} 
                  placeholder="예: 서울82가 1234" 
                  required 
                  style={{ width: '100%', padding: '8px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', marginBottom: '4px', display: 'block' }}>운송차량 종류 *</label>
                <input 
                  type="text" 
                  value={vehicleType} 
                  onChange={e => setVehicleType(e.target.value)} 
                  placeholder="예: 5톤 셀프로더" 
                  required 
                  style={{ width: '100%', padding: '8px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', marginBottom: '4px', display: 'block' }}>기사 연락처 *</label>
                <input 
                  type="text" 
                  value={driverContact} 
                  onChange={e => setDriverContact(e.target.value)} 
                  placeholder="010-0000-0000" 
                  required 
                  style={{ width: '100%', padding: '8px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', marginBottom: '4px', display: 'block' }}>확정 운송비 (원) *</label>
                <input
                  type="number"
                  value={deliveryCost || ''}
                  onChange={e => setDeliveryCost(parseInt(e.target.value) || 0)}
                  placeholder="배차 비용"
                  required
                  style={{ width: '100%', padding: '8px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" className="btn-secondary" onClick={() => setSelectedDelivery(null)}>취소</button>
              <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={16} /> 배차 확정
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
