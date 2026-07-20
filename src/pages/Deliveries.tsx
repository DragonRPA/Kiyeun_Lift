// d:\Kiyeun_Lift\src\pages\Deliveries.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Truck, Check, DollarSign, Calendar, Navigation, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Delivery } from '../services/db';

export const Deliveries: React.FC = () => {
  const {
    deliveries, contracts, customers, assets, contractAssets, dispatchDelivery, settleDeliveryCost, completeDelivery, completeInboundDelivery, hasPermission
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

  // 입고 검수 모달 상태
  const [showInboundModal, setShowInboundModal] = useState(false);
  const [inboundDeliveryId, setInboundDeliveryId] = useState('');
  const [actualReturnDate, setActualReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [reviews, setReviews] = useState<{ assetId: string; status: 'AVAILABLE' | 'REPAIRING'; maintenanceScore: number; memo: string }[]>([]);

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

    alert('운송 차량 배차가 승인 및 확정되었습니다.');
    setShowDispatchModal(false);
  };

  const handleOpenInboundReview = (d: Delivery) => {
    setInboundDeliveryId(d.id);
    setActualReturnDate(new Date().toISOString().split('T')[0]);

    // 해당 배차 건의 자산 리스트 추출
    let deliveryAssets: any[] = [];
    if (d.assetIds) {
      deliveryAssets = d.assetIds.split(',').map(id => assets.find(a => a.id === id)).filter((a): a is any => !!a);
    } else {
      const cAssets = contractAssets.filter(ca => ca.contractId === d.contractId);
      deliveryAssets = cAssets.map(ca => assets.find(a => a.id === ca.assetId)).filter((a): a is any => !!a);
    }

    const initialReviews = deliveryAssets.map(asset => ({
      assetId: asset.id,
      status: 'AVAILABLE' as const,
      maintenanceScore: 0,
      memo: ''
    }));

    setReviews(initialReviews);
    setShowInboundModal(true);
  };

  const handleInboundSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !inboundDeliveryId) return;

    completeInboundDelivery(inboundDeliveryId, actualReturnDate, reviews);
    alert('반납 장비의 검수 및 입고등록 처리가 성공적으로 완료되었습니다.');
    setShowInboundModal(false);
    setInboundDeliveryId('');
  };

  const handleReviewChange = (assetId: string, field: 'status' | 'maintenanceScore' | 'memo', value: any) => {
    setReviews(prev => prev.map(item => {
      if (item.assetId === assetId) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  return (
    <div>
      <div className="card-header" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontWeight: '700' }}>배차 및 운송 정산 관리</h2>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          출고 배차 및 장비 회수(INBOUND)를 제어하고, 물류 용역비를 마감 대조합니다.
        </span>
      </div>

      {/* 배차 관리 대장 목록 */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>번호</th>
              <th>구분</th>
              <th>계약번호</th>
              <th>고객사명</th>
              <th>운송 수단</th>
              <th>기사/연락처</th>
              <th>운송 비용</th>
              <th>상태</th>
              <th>용역 정산</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                  등록된 배송 및 회수 배차 의뢰가 없습니다.
                </td>
              </tr>
            ) : (
              [...deliveries].reverse().map((d, idx) => (
                <tr key={d.id}>
                  <td>{idx + 1}</td>
                  <td>
                    <span className={`badge ${d.type === 'OUTBOUND' ? 'badge-primary' : 'badge-danger'}`}>
                      {d.type === 'OUTBOUND' ? '출고' : '회수'}
                    </span>
                  </td>
                  <td>{getContractNo(d.contractId)}</td>
                  <td><strong>{getCustNameFromContract(d.contractId)}</strong></td>
                  <td style={{ fontSize: '13px' }}>
                    {d.vehicleType ? `${d.vehicleType} (${d.vehicleNo || '번호미상'})` : '-'}
                  </td>
                  <td style={{ fontSize: '13px' }}>
                    {d.driverName ? `${d.driverName} (${d.driverContact})` : '-'}
                  </td>
                  <td>{d.deliveryCost.toLocaleString()}원</td>
                  <td>
                    <span className={`badge ${
                      d.status === 'REQUESTED' ? 'badge-warning' :
                      d.status === 'DISPATCHED' ? 'badge-info' : 'badge-success'
                    }`}>
                      {d.status === 'REQUESTED' ? '의뢰(배차대기)' :
                       d.status === 'DISPATCHED' ? '배차완료(이동중)' :
                       d.status === 'COMPLETED' ? '완료' : d.status}
                    </span>
                  </td>
                  <td>
                    {d.status === 'COMPLETED' ? (
                      d.isCostSettled ? (
                        <span style={{ color: 'var(--success)', fontWeight: '600', fontSize: '12px' }}>정산완료</span>
                      ) : (
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            settleDeliveryCost(d.id);
                            alert('운송비 정산이 마감 완료되었습니다.');
                          }}
                          style={{ padding: '2px 6px', fontSize: '11px' }}
                        >
                          정산마감
                        </button>
                      )
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
                            if (d.type === 'INBOUND') {
                              handleOpenInboundReview(d);
                            } else {
                              completeDelivery(d.id);
                              alert('배차 완료 처리가 수락되어 자산 대장 및 계약 상태가 최신화되었습니다.');
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>배송 예정일자 *</label>
                  <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} required />
                </div>
                <div>
                  <label>차량 종류 *</label>
                  <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} required>
                    <option value="셀프로더">셀프로더 (지게차용)</option>
                    <option value="5톤카고">5톤 카고트럭</option>
                    <option value="10톤윙바디">10톤 윙바디</option>
                    <option value="1톤트럭">1톤 소형트럭</option>
                  </select>
                </div>
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

      {/* 회수 검수 및 입고 등록 모달 */}
      {showInboundModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleInboundSubmit} className="card" style={{ width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Navigation size={20} style={{ color: 'var(--success)' }} />
              장비 반납 입고 등록 및 품질 검수
            </h3>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              회수 완료된 각 장비의 외관 상태 및 동작을 검수하고, 다음 출고를 위한 정비 필요 여부를 마킹합니다.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label>실제 입고(회수) 완료일 *</label>
                <input
                  type="date"
                  value={actualReturnDate}
                  onChange={e => setActualReturnDate(e.target.value)}
                  required
                />
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                <label style={{ fontWeight: '700', marginBottom: '10px' }}>회수 장비별 상태 검수 목록</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {reviews.map((rev, index) => {
                    const asset = assets.find(a => a.id === rev.assetId);
                    if (!asset) return null;
                    return (
                      <div key={rev.assetId} style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '13.5px', fontWeight: '700' }}>
                            {index + 1}. <strong style={{ color: 'var(--primary)' }}>{asset.assetNo}</strong> ({asset.modelName})
                          </span>
                          <select
                            value={rev.status}
                            onChange={e => handleReviewChange(rev.assetId, 'status', e.target.value)}
                            style={{ width: '130px', padding: '4px', fontSize: '12px' }}
                          >
                            <option value="AVAILABLE">정상 (대기중)</option>
                            <option value="REPAIRING">정비요망 (수리중)</option>
                          </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                          <div>
                            <label style={{ fontSize: '12px', marginBottom: '4px' }}>정비 소요 점수 (0~100)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={rev.maintenanceScore}
                              onChange={e => handleReviewChange(rev.assetId, 'maintenanceScore', parseInt(e.target.value) || 0)}
                              style={{ padding: '6px', fontSize: '12px' }}
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '12px', marginBottom: '4px' }}>검수 특이사항 (정비의뢰 내용)</label>
                            <input
                              type="text"
                              value={rev.memo}
                              onChange={e => handleReviewChange(rev.assetId, 'memo', e.target.value)}
                              style={{ padding: '6px', fontSize: '12px' }}
                              placeholder="예: 모서리 찌그러짐 정비 필요, 오버로드 작동불량"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowInboundModal(false)}>취소</button>
              <button type="submit" className="btn-success" disabled={reviews.length === 0}>입고 등록 완료</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
