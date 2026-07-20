// d:\Kiyeun_Lift\src\pages\Deliveries.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Truck, Check, DollarSign, Calendar, Navigation, AlertTriangle, CheckCircle, ShieldAlert, Download, Search } from 'lucide-react';
import { Delivery } from '../services/db';
import { exportToExcel } from '../services/excel';

interface SettleVehicle {
  id: string;
  transportCompany: string;
  vehicleType: string;
  vehicleNo: string;
  driverName: string;
  driverContact: string;
  deliveryCost: number;
  deliveryCostConfirmed?: number;
}

export const Deliveries: React.FC = () => {
  const {
    deliveries, contracts, customers, assets, contractAssets, dispatchDelivery, settleDeliveryCost, completeDelivery, completeInboundDelivery, hasPermission
  } = useApp();

  const canSave = hasPermission('delivery', 'save');

  // --- 배차 조회 필터 상태 ---
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempTypeFilter, setTempTypeFilter] = useState('ALL');
  const [tempStatusFilter, setTempStatusFilter] = useState('ALL');
  const [tempSettleFilter, setTempSettleFilter] = useState('ALL');

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [settleFilter, setSettleFilter] = useState('ALL');

  // 배차 입력 모달 상태
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [targetDeliveryId, setTargetDeliveryId] = useState('');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [vehicleType, setVehicleType] = useState('cargo_truck');
  const [driverName, setDriverName] = useState('');
  const [driverContact, setDriverContact] = useState('');
  const [deliveryCost, setDeliveryCost] = useState(0);

  // 운송 정산용 상세 입력 모달 상태
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleDeliveryId, setSettleDeliveryId] = useState('');
  const [settleVehicles, setSettleVehicles] = useState<SettleVehicle[]>([]);

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

  const handleSearchClick = () => {
    setSearchTerm(tempSearchTerm);
    setTypeFilter(tempTypeFilter);
    setStatusFilter(tempStatusFilter);
    setSettleFilter(tempSettleFilter);
  };

  const filteredDeliveries = deliveries.filter(d => {
    let displayName = getCustNameFromContract(d.contractId).toLowerCase();
    if (displayName === '-' && d.memo.includes('[외주정비회수]')) {
      const match = d.memo.match(/외주업체:\s*(.*?)\s*\|/);
      displayName = match ? `${match[1]} (외주회수)`.toLowerCase() : '외주정비 공장';
    }

    const matchesSearch = 
      d.memo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      displayName.includes(searchTerm.toLowerCase()) ||
      (d.contractId && getContractNo(d.contractId).toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = typeFilter === 'ALL' || d.type === typeFilter;
    const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
    
    let matchesSettle = true;
    if (settleFilter === 'UNSETTLED') {
      matchesSettle = !d.isCostSettled;
    } else if (settleFilter === 'SETTLED') {
      matchesSettle = d.isCostSettled;
    }

    return matchesSearch && matchesType && matchesStatus && matchesSettle;
  });

  const handleExportExcel = () => {
    const excelData = filteredDeliveries.map((d, idx) => {
      let displayName = getCustNameFromContract(d.contractId);
      if (displayName === '-' && d.memo.includes('[외주정비회수]')) {
        const match = d.memo.match(/외주업체:\s*(.*?)\s*\|/);
        displayName = match ? `${match[1]} (외주회수)` : '외주정비 공장';
      }

      let vehiclesSummary = '';
      if (d.vehicles) {
        try {
          const parsed = JSON.parse(d.vehicles);
          if (Array.isArray(parsed)) {
            vehiclesSummary = parsed.map(v => `${v.transportCompany} ${v.vehicleNo} (${v.driverName})`).join(' / ');
          }
        } catch(e) {
          vehiclesSummary = `${d.vehicleType || ''} ${d.vehicleNo || ''} (${d.driverName || ''})`;
        }
      } else {
        vehiclesSummary = `${d.vehicleType || ''} ${d.vehicleNo || ''} (${d.driverName || ''})`;
      }

      return {
        'No': idx + 1,
        '구분': d.type === 'OUTBOUND' ? '출고' : '회수',
        '계약번호': getContractNo(d.contractId),
        '의뢰 메모': d.memo,
        '고객사/대상지': displayName,
        '운송 차량 정보': vehiclesSummary,
        '기사 연락처': d.driverContact || '-',
        '임시 운송비': d.deliveryCost ? `${d.deliveryCost.toLocaleString()}원` : '0원',
        '확정 운송비': d.deliveryCostConfirmed ? `${d.deliveryCostConfirmed.toLocaleString()}원` : '0원',
        '배송 상태': d.status === 'REQUESTED' ? '의뢰중' :
                   d.status === 'DISPATCHED' ? '배차완료' : '완료',
        '정산 여부': d.isCostSettled ? '정산완료' : '미정산',
        '정산 마감일': (d.isCostSettled && d.updatedAt) ? d.updatedAt.split('T')[0] : '-',
        '등록일': d.createdAt ? d.createdAt.split('T')[0] : '-'
      };
    });

    exportToExcel(excelData, `배차정산대장_${new Date().toISOString().split('T')[0]}`, '배차목록');
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

    // 단일 배정 시에도 JSON 형식 호환을 위해 vehicles 생성
    const singleVehicle = [
      {
        id: 'v-' + Date.now(),
        transportCompany: '일반운송사',
        vehicleType,
        vehicleNo: '미상',
        driverName,
        driverContact,
        deliveryCost
      }
    ];

    dispatchDelivery(targetDeliveryId, {
      scheduledDate,
      transportCompany: '일반운송사',
      vehicleType,
      vehicleNo: '미상',
      driverName,
      driverContact,
      deliveryCost,
      vehiclesJson: JSON.stringify(singleVehicle)
    });

    alert('운송 차량 배차가 승인 및 확정되었습니다.');
    setShowDispatchModal(false);
  };

  // 운송료 정산 모달 열기
  const handleOpenSettleModal = (d: Delivery) => {
    setSettleDeliveryId(d.id);
    
    // 배차 시 지정된 차량 리스트 파싱
    let list: SettleVehicle[] = [];
    if (d.vehicles) {
      try {
        list = JSON.parse(d.vehicles);
      } catch (e) {
        console.error("Failed to parse vehicles JSON in settle", e);
      }
    }

    // 만약 차량 지정 목록이 없다면 단일 차량 컬럼 데이터를 바탕으로 가공
    if (list.length === 0) {
      list = [
        {
          id: 'v-legacy',
          transportCompany: d.transportCompany || '기본운송사',
          vehicleType: d.vehicleType || '차종미상',
          vehicleNo: d.vehicleNo || '번호미상',
          driverName: d.driverName || '성명미상',
          driverContact: d.driverContact || '-',
          deliveryCost: d.deliveryCost,
          deliveryCostConfirmed: d.deliveryCostConfirmed ?? d.deliveryCost
        }
      ];
    } else {
      // 이미 확정 금액이 있다면 그대로 사용, 없으면 임시(estimated)금액을 기본값으로 바인딩
      list = list.map(v => ({
        ...v,
        deliveryCostConfirmed: v.deliveryCostConfirmed ?? v.deliveryCost
      }));
    }

    setSettleVehicles(list);
    setShowSettleModal(true);
  };

  const handleSettleVehicleCostChange = (id: string, val: number) => {
    setSettleVehicles(prev => prev.map(v => v.id === id ? { ...v, deliveryCostConfirmed: val } : v));
  };

  const handleSettleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !settleDeliveryId) return;

    // 모든 차량 확정운송료 합산
    const totalConfirmedCost = settleVehicles.reduce((sum, v) => sum + Number(v.deliveryCostConfirmed || 0), 0);
    const vehiclesJson = JSON.stringify(settleVehicles);

    settleDeliveryCost(settleDeliveryId, totalConfirmedCost, vehiclesJson);

    alert('차량별 운송비 정산 마감이 정상 처리되었습니다.');
    setShowSettleModal(false);
    setSettleDeliveryId('');
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
      <div className="card-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontWeight: '700', margin: 0 }}>배차 및 운송 정산 관리</h2>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            출고 배차 및 장비 회수(INBOUND)를 제어하고, 물류사 차량별 운송비(임시 vs 확정)를 정산 마감합니다.
          </span>
        </div>
        <button 
          type="button" 
          className="btn-secondary" 
          onClick={handleExportExcel}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', padding: '8px 14px' }}
        >
          <Download size={14} /> 배차목록 엑셀 다운로드
        </button>
      </div>

      {/* 필터 제어부 */}
      <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', marginBottom: '6px', display: 'block' }}>검색어 (고객명/의뢰메모)</label>
            <input 
              type="text" 
              value={tempSearchTerm} 
              onChange={e => setTempSearchTerm(e.target.value)} 
              placeholder="검색어 입력..."
              style={{ width: '100%', padding: '8px' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', marginBottom: '6px', display: 'block' }}>배차 구분</label>
            <select value={tempTypeFilter} onChange={e => setTempTypeFilter(e.target.value)} style={{ width: '100%', padding: '8px' }}>
              <option value="ALL">전체 구분</option>
              <option value="OUTBOUND">출고 배차 (OUTBOUND)</option>
              <option value="INBOUND">회수 배차 (INBOUND)</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', marginBottom: '6px', display: 'block' }}>배송 상태</label>
            <select value={tempStatusFilter} onChange={e => setTempStatusFilter(e.target.value)} style={{ width: '100%', padding: '8px' }}>
              <option value="ALL">전체 상태</option>
              <option value="REQUESTED">의뢰중 (REQUESTED)</option>
              <option value="DISPATCHED">배차완료 (DISPATCHED)</option>
              <option value="COMPLETED">배송완료 (COMPLETED)</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', marginBottom: '6px', display: 'block' }}>정산 여부</label>
            <select value={tempSettleFilter} onChange={e => setTempSettleFilter(e.target.value)} style={{ width: '100%', padding: '8px' }}>
              <option value="ALL">전체 정산상태</option>
              <option value="UNSETTLED">미정산 (UNSETTLED)</option>
              <option value="SETTLED">정산완료 (SETTLED)</option>
            </select>
          </div>
          <div>
            <button 
              type="button" 
              className="btn-primary" 
              onClick={handleSearchClick}
              style={{ width: '100%', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 'bold' }}
            >
              <Search size={16} /> 조회
            </button>
          </div>
        </div>
      </div>

      {/* 배차 관리 대장 목록 */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>번호</th>
              <th>구분</th>
              <th>계약번호 / 의뢰메모</th>
              <th>고객사명 / 회수지</th>
              <th>운송 차량</th>
              <th>담당기사/연락처</th>
              <th>운송비(임시)</th>
              <th>운송비(확정)</th>
              <th>배송상태</th>
              <th>용역 정산</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredDeliveries.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                  조회된 배송 및 회수 배차 의뢰가 없습니다.
                </td>
              </tr>
            ) : (
              [...filteredDeliveries].reverse().map((d, idx) => {
                // 외주정비회수 및 일반회수 가독성 바인딩
                let displayName = getCustNameFromContract(d.contractId);
                if (displayName === '-' && d.memo.includes('[외주정비회수]')) {
                  const match = d.memo.match(/외주업체:\s*(.*?)\s*\|/);
                  displayName = match ? `${match[1]} (외주회수)` : '외주정비 공장';
                }

                // 배차된 차량 수 카운트
                let vehicleCount = 1;
                if (d.vehicles) {
                  try {
                    const parsed = JSON.parse(d.vehicles);
                    if (Array.isArray(parsed)) vehicleCount = parsed.length;
                  } catch(e){}
                }

                return (
                  <tr key={d.id}>
                    <td>{idx + 1}</td>
                    <td>
                      <span className={`badge ${d.type === 'OUTBOUND' ? 'badge-primary' : 'badge-danger'}`}>
                        {d.type === 'OUTBOUND' ? '출고' : '회수'}
                      </span>
                    </td>
                    <td style={{ fontSize: '12.5px' }}>
                      {d.contractId ? getContractNo(d.contractId) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          일반이동 ({d.memo.substring(0, 15)}...)
                        </span>
                      )}
                    </td>
                    <td><strong>{displayName}</strong></td>
                    <td style={{ fontSize: '13px' }}>
                      {d.vehicleType ? (
                        <span>
                          {d.vehicleType} {vehicleCount > 1 && <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>(총 {vehicleCount}대)</span>}
                        </span>
                      ) : '-'}
                    </td>
                    <td style={{ fontSize: '13px' }}>
                      {d.driverName ? `${d.driverName}` : '-'}
                    </td>
                    <td>{d.deliveryCost.toLocaleString()}원</td>
                    <td style={{ fontWeight: 'bold', color: d.deliveryCostConfirmed ? 'var(--primary)' : 'var(--text-muted)' }}>
                      {d.deliveryCostConfirmed ? `${d.deliveryCostConfirmed.toLocaleString()}원` : '미확정'}
                    </td>
                    <td>
                      <span className={`badge ${
                        d.status === 'REQUESTED' ? 'badge-warning' :
                        d.status === 'DISPATCHED' ? 'badge-info' : 'badge-success'
                      }`}>
                        {d.status === 'REQUESTED' ? '배차대기' :
                         d.status === 'DISPATCHED' ? '이동중' :
                         d.status === 'COMPLETED' ? '배송완료' : d.status}
                      </span>
                    </td>
                    <td>
                      {d.status === 'COMPLETED' ? (
                        d.isCostSettled ? (
                          <span style={{ color: 'var(--success)', fontWeight: '700', fontSize: '12px' }}>정산완료(마감)</span>
                        ) : (
                          <button
                            className="btn-primary"
                            onClick={() => handleOpenSettleModal(d)}
                            style={{ padding: '2px 8px', fontSize: '11.5px', fontWeight: 'bold' }}
                          >
                            정산등록
                          </button>
                        )
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>완료 후 가능</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {canSave && d.status === 'REQUESTED' && (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            배차관리 탭 이용
                          </span>
                        )}
                        {canSave && d.status === 'DISPATCHED' && (
                          <button
                            className="btn-success"
                            onClick={() => {
                              if (d.type === 'INBOUND') {
                                handleOpenInboundReview(d);
                              } else {
                                completeDelivery(d.id);
                                alert('배차 완료 처리가 승인되었습니다.');
                              }
                            }}
                            style={{ padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '2px' }}
                          >
                            <Check size={12} /> 완료처리
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* [1] 단일 배차 처리 대체 모달 (백업용) */}
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

      {/* [2] 다중차량 운송비 정산 확정 모달 */}
      {showSettleModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleSettleSubmit} className="card" style={{ width: '100%', maxWidth: '650px', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '10px' }}>물류 운송료 정산 및 최종 확정</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              실제 물류 기사로부터 수령한 세금계산서 또는 인수증 영수금액을 기반으로 차량별 <strong>운송료(확정)</strong> 금액을 입력하여 마감 처리합니다.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-app)' }}>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>물류사 / 기사</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>차종 / 차량번호</th>
                      <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border-color)' }}>임시운송비</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border-color)', width: '150px' }}>확정운송비 *</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settleVehicles.map(v => (
                      <tr key={v.id}>
                        <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>
                          <strong>{v.transportCompany}</strong>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{v.driverName}</div>
                        </td>
                        <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>
                          {v.vehicleType}
                          <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{v.vehicleNo}</div>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border-color)' }}>
                          {v.deliveryCost.toLocaleString()}원
                        </td>
                        <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>
                          <input
                            type="number"
                            value={v.deliveryCostConfirmed || ''}
                            onChange={e => handleSettleVehicleCostChange(v.id, parseInt(e.target.value) || 0)}
                            style={{ padding: '4px 8px', width: '120px', textAlign: 'right' }}
                            required
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 총액 비교 요약 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', fontSize: '13.5px' }}>
                <div>
                  임시운송비 합계: <strong>{settleVehicles.reduce((sum, v) => sum + v.deliveryCost, 0).toLocaleString()}원</strong>
                </div>
                <div style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                  확정운송비 합계: {settleVehicles.reduce((sum, v) => sum + Number(v.deliveryCostConfirmed || 0), 0).toLocaleString()}원
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowSettleModal(false)}>취소</button>
              <button type="submit" className="btn-success" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                <CheckCircle size={14} /> 정산 마감 처리 완료
              </button>
            </div>
          </form>
        </div>
      )}

      {/* [3] 회수 검수 및 입고 등록 모달 */}
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
