// d:\Kiyeun_Lift\src\pages\Deliveries.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Truck, Check, DollarSign, Calendar, Navigation } from 'lucide-react';
import { Delivery } from '../services/db';

export const Deliveries: React.FC = () => {
  const {
    deliveries, contracts, customers, dispatchDelivery, settleDeliveryCost, hasPermission
  } = useApp();

  const canSave = hasPermission('delivery', 'save');

  // 배차 입력 모달 상태
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [targetDeliveryId, setTargetDeliveryId] = useState('');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [vehicleType, setVehicleType] = useState('cargo_truck');
  const [driverName, setDriverName] = useState('');
  const [driverContact, setDriverContact] = useState('');
  const [deliveryCost, setDeliveryCost] = useState(0);

  const getCustNameFromContract = (contractId?: string) => {
    if (!contractId) return '-';
    const contract = contracts.find(c => c.id === contractId);
    if (!contract) return '-';
    return customers.find(c => c.id === contract.customerId)?.name || '-';
  };

  const getContractNo = (contractId?: string) => {
    if (!contractId) return '-';
    return contracts.find(c => c.id === contractId)?.contractNo || '-';
  };

  const handleOpenDispatch = (d: Delivery) => {
    setTargetDeliveryId(d.id);
    setScheduledDate(d.scheduledDate || new Date().toISOString().split('T')[0]);
    setVehicleType(d.vehicleType || '셀프로더');
    setDriverName(d.driverName || '');
    setDriverContact(d.driverContact || '');
    setDeliveryCost(d.deliveryCost || 70000);
    setShowDispatchModal(true);
  };

  const handleDispatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !targetDeliveryId) return;

    dispatchDelivery(targetDeliveryId, {
      scheduledDate,
      vehicleType,
      driverName,
      driverContact,
      deliveryCost
    });

    alert('배차 차량 및 운송 정보 등록이 완료되었습니다.');
    setShowDispatchModal(false);
    setTargetDeliveryId('');
  };



  const handleSettleCost = (id: string) => {
    if (!canSave) return;
    settleDeliveryCost(id);
    alert('해당 배차 운임 정산 처리가 완료되었습니다.');
  };

  return (
    <div>
      <h2 style={{ marginBottom: '24px', fontWeight: '700' }}>출고 및 회수 배차 운송 관리</h2>

      <div className="card-header" style={{ marginBottom: '16px' }}>
        <h3 className="card-title">배차 의뢰 및 운송 비용 목록</h3>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>* 계약 시 출고의뢰 자동 생성 / 단축 시 회수의뢰 자동 생성</span>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>구분</th>
              <th>계약번호</th>
              <th>고객사</th>
              <th>의뢰일</th>
              <th>운송예정일</th>
              <th>운임료</th>
              <th>정차 정보 (차량/기사)</th>
              <th>상태</th>
              <th>비용정산</th>
              <th style={{ width: '120px' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                  배차 대기 중인 운송 의뢰 건이 없습니다.
                </td>
              </tr>
            ) : (
              deliveries.map(d => (
                <tr key={d.id}>
                  <td>
                    <span className={`badge ${d.type === 'OUTBOUND' ? 'badge-primary' : 'badge-warning'}`}>
                      {d.type === 'OUTBOUND' ? '장비출고' : '장비회수'}
                    </span>
                  </td>
                  <td>{getContractNo(d.contractId)}</td>
                  <td><strong>{getCustNameFromContract(d.contractId)}</strong></td>
                  <td>{d.requestDate}</td>
                  <td>{d.scheduledDate || '미정'}</td>
                  <td style={{ fontWeight: '600' }}>
                    {d.deliveryCost ? `${d.deliveryCost.toLocaleString()}원` : '-'}
                  </td>
                  <td style={{ fontSize: '13px' }}>
                    {d.driverName ? (
                      <div>
                        {d.vehicleType} | <strong>{d.driverName}</strong> ({d.driverContact})
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>차량 지정 대기</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${
                      d.status === 'REQUESTED' ? 'badge-danger' :
                      d.status === 'DISPATCHED' ? 'badge-warning' : 'badge-success'
                    }`}>
                      {d.status === 'REQUESTED' ? '배차대기' :
                       d.status === 'DISPATCHED' ? '배차완료' : '배송완료'}
                    </span>
                  </td>
                  <td>
                    {d.status === 'COMPLETED' ? (
                      <button
                        className={d.isCostSettled ? 'btn-success' : 'btn-secondary'}
                        disabled={!canSave || d.isCostSettled}
                        onClick={() => handleSettleCost(d.id)}
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                      >
                        {d.isCostSettled ? '정산완료' : '정산하기'}
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>배송 완료 후 가능</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {canSave && d.status === 'REQUESTED' && (
                        <button className="btn-primary" onClick={() => handleOpenDispatch(d)} style={{ padding: '4px 8px', fontSize: '12px' }}>
                          배차하기
                        </button>
                      )}
                      {canSave && d.status === 'DISPATCHED' && (
                        <button
                          className="btn-success"
                          onClick={() => {
                            // 로컬스토리지 업데이트 함수
                            const list = [...deliveries];
                            const idx = list.findIndex(item => item.id === d.id);
                            if (idx !== -1) {
                              list[idx] = { ...list[idx], status: 'COMPLETED', updatedAt: new Date().toISOString() };
                              localStorage.setItem('erp_deliveries', JSON.stringify(list));
                              window.location.reload();
                            }
                          }}
                          style={{ padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '2px' }}
                        >
                          <Check size={12} /> 완료
                        </button>
                      )}
                      {canSave && d.status === 'DISPATCHED' && (
                        <button className="btn-secondary" onClick={() => handleOpenDispatch(d)} style={{ padding: '4px 8px', fontSize: '12px' }}>
                          수정
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 배차 처리 모달 */}
      {showDispatchModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleDispatchSubmit} className="card" style={{ width: '100%', maxWidth: '450px', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>운송 차량 배차 정보 입력</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label>배송 예정일자 *</label>
                <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} required />
              </div>

              <div>
                <label>운송차량 종류 (화물차/셀프로더) *</label>
                <input type="text" value={vehicleType} onChange={e => setVehicleType(e.target.value)} placeholder="예: 5톤 셀프로더, 화물차" required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>기사 성명 *</label>
                  <input type="text" value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="기사명" required />
                </div>
                <div>
                  <label>기사 연락처 *</label>
                  <input type="text" value={driverContact} onChange={e => setDriverContact(e.target.value)} placeholder="010-0000-0000" required />
                </div>
              </div>

              <div>
                <label>지불 배차 운임료 (원) *</label>
                <input
                  type="number"
                  value={deliveryCost || ''}
                  onChange={e => setDeliveryCost(parseInt(e.target.value) || 0)}
                  placeholder="배차 비용"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowDispatchModal(false)}>취소</button>
              <button type="submit" className="btn-primary">배차 확정</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
