import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, CheckCircle, Search, AlertTriangle, Download, Clock, Layers, ShieldAlert } from 'lucide-react';
import { Asset, db } from '../services/db';
import { exportToExcel } from '../services/excel';

export const RentAssets: React.FC = () => {
  const { assets, products, customers, registerRentedAsset, returnRentedAsset, hasPermission } = useApp();
  const canSave = hasPermission('rent_asset', 'save');

  // 활성화 탭 상태: CURRENT (임차자산 현황), SETTLEMENT (지연 및 매입 정산)
  const [activeTab, setActiveTab] = useState<'CURRENT' | 'SETTLEMENT'>('CURRENT');

  // 검색/필터 입력용 임시 상태
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempRenterFilter, setTempRenterFilter] = useState('');
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');
  const [tempReturnStatus, setTempReturnStatus] = useState('ALL');

  // 실제 조회 버튼을 눌렀을 때 갱신되는 필터 확정 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [renterQuery, setRenterQuery] = useState('');
  const [startDateQuery, setStartDateQuery] = useState('');
  const [endDateQuery, setEndDateQuery] = useState('');
  const [returnQuery, setReturnQuery] = useState('ALL');

  // 등록/수정 및 반납 상태
  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Partial<Asset> | null>(null);

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnAssetId, setReturnAssetId] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);

  // 반납 배차 옵션 상태
  const [isDispatchRequested, setIsDispatchRequested] = useState(false);
  const [returnOrigin, setReturnOrigin] = useState('');
  const [returnDestination, setReturnDestination] = useState('');
  const [returnVehicleType, setReturnVehicleType] = useState('3.5T');
  const [returnCost, setReturnCost] = useState(70000);

  // 임차자산 리스트 추출
  const rentedAssets = assets.filter(a => a.ownerType === 'RENTED');

  const filtered = rentedAssets.filter(a => {
    const matchesSearch = 
      a.assetNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.modelName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRenter = !renterQuery || (a.renter && a.renter.toLowerCase().includes(renterQuery.toLowerCase()));

    const matchesStartDate = !startDateQuery || (a.rentEnd && a.rentEnd >= startDateQuery);
    const matchesEndDate = !endDateQuery || (a.rentStart && a.rentStart <= endDateQuery);

    const matchesReturn = returnQuery === 'ALL' ? true :
                          returnQuery === 'RETURNED' ? a.status === 'RENTED_RETURNED' :
                          a.status !== 'RENTED_RETURNED';

    return matchesSearch && matchesRenter && matchesStartDate && matchesEndDate && matchesReturn;
  });

  // 유니크 임차처 목록 생성 (필터용)
  const rentersList = Array.from(new Set(rentedAssets.map(a => a.renter).filter(Boolean)));

  // 1. 반납 지연일 계산 함수
  const calculateDelayDays = (asset: Asset): number => {
    if (!asset.rentEnd) return 0;
    const plannedEnd = new Date(asset.rentEnd);
    const actualEnd = asset.actualRentReturnDate 
      ? new Date(asset.actualRentReturnDate) 
      : new Date(); // 미반납 시 오늘 기준 계산
      
    // 시간 성분 제거하고 일 단위 차이 계산
    plannedEnd.setHours(0,0,0,0);
    actualEnd.setHours(0,0,0,0);

    const diffTime = actualEnd.getTime() - plannedEnd.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // 2. 전대 기간 미스매치(초과) 검사
  const isSubleaseOverdue = (asset: Asset): boolean => {
    if (!asset.rentEnd || !asset.contractEnd) return false;
    const leaseEnd = new Date(asset.rentEnd);
    const subleaseEnd = new Date(asset.contractEnd);
    leaseEnd.setHours(0,0,0,0);
    subleaseEnd.setHours(0,0,0,0);
    return subleaseEnd.getTime() > leaseEnd.getTime();
  };

  // 3. 지연 통계 메트릭 계산
  const delayedAssets = rentedAssets.filter(a => calculateDelayDays(a) > 0);
  const totalConfirmedDelayFee = rentedAssets
    .filter(a => a.status === 'RENTED_RETURNED')
    .reduce((sum, a) => sum + calculateDelayDays(a) * (a.dailyRentFee || 0), 0);
  
  const totalEstimatedDelayFee = rentedAssets
    .filter(a => a.status !== 'RENTED_RETURNED')
    .reduce((sum, a) => sum + calculateDelayDays(a) * (a.dailyRentFee || 0), 0);

  const totalSubleaseMismatches = rentedAssets.filter(a => isSubleaseOverdue(a)).length;

  const handleOpenAdd = () => {
    setEditingAsset({
      modelName: products[0]?.modelName || '',
      assetNo: '',
      serialNo: '',
      manufacturer: '',
      renter: '',
      rentStart: new Date().toISOString().split('T')[0],
      rentEnd: new Date(new Date().getTime() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      monthlyRentFee: 0,
      dailyRentFee: 0,
      memo1: ''
    });
    setShowModal(true);
  };

  const handleOpenEdit = (a: Asset) => {
    setEditingAsset(a);
    setShowModal(true);
  };

  const handleOpenReturn = (asset: Asset) => {
    setReturnAssetId(asset.id);
    setReturnDate(new Date().toISOString().split('T')[0]);
    
    // 기본 상/하차지 세팅: 현장/보관소 -> 임차처 주소
    const cust = customers.find(c => c.id === asset.currentCustomerId);
    setReturnOrigin(cust ? `${cust.name} 현장` : '당사 보관소');
    setReturnDestination(asset.renter ? `${asset.renter} (소유원사)` : '원사 보관소');
    setIsDispatchRequested(false);
    setShowReturnModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !editingAsset || !editingAsset.assetNo || !editingAsset.modelName) {
      alert('필수 입력을 확인해 주세요.');
      return;
    }

    registerRentedAsset(editingAsset);
    alert(`임차 자산(${editingAsset.assetNo}) 등록/수정이 완료되었습니다.`);
    setShowModal(false);
    setEditingAsset(null);
  };

  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !returnAssetId) return;

    const targetAsset = rentedAssets.find(a => a.id === returnAssetId);

    // 1. 임차 자산 반납 상태 갱신
    returnRentedAsset(returnAssetId, returnDate);

    // 2. 반납 배차 옵션 선택 시 배차 레코드 자동 생성
    if (isDispatchRequested && targetAsset) {
      db.insertRow('deliveries', {
        type: 'RETURN',
        status: 'REQUESTED',
        requestDate: new Date().toISOString().split('T')[0],
        scheduledDate: returnDate,
        assetIds: targetAsset.id,
        originAddress: returnOrigin,
        destinationAddress: returnDestination,
        transportCompany: targetAsset.renter || '',
        vehicleType: returnVehicleType,
        deliveryCost: returnCost,
        expectedCost: returnCost,
        finalCost: returnCost,
        reconciliationStatus: 'PENDING',
        cargoItems: JSON.stringify([{ modelName: targetAsset.modelName, count: 1 }]),
        vehicleRequirements: JSON.stringify([{ vehicleType: returnVehicleType, count: 1 }]),
        isCostSettled: false,
        memo: `[임차 자산 반납 배차] 관리번호: ${targetAsset.assetNo}, 임차처: ${targetAsset.renter || '미상'}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as any);
      alert('임차 장비 반납 처리 및 반납 회수 배차가 배차 관리 메뉴에 자동 등록되었습니다.');
    } else {
      alert('임차 장비의 반납 처리가 완료되었습니다.');
    }

    setShowReturnModal(false);
    setReturnAssetId('');
  };

  // 임차자산 현황 내역 엑셀 다운로드
  const handleExportCurrent = () => {
    const excelData = filtered.map((a, idx) => {
      const custName = a.currentCustomerId ? (customers.find(c => c.id === a.currentCustomerId)?.name || '알 수 없음') : '-';
      return {
        'No': idx + 1,
        '관리번호': a.assetNo,
        '모델명': a.modelName,
        '임차처': a.renter || '-',
        '임차 개시일': a.rentStart || '-',
        '임차 만료일': a.rentEnd || '-',
        '실제 반납일': a.actualRentReturnDate || (a.status === 'RENTED_RETURNED' ? '반납완료' : '미반납'),
        '월 임차료(원)': (a.monthlyRentFee || 0),
        '일 임차료(원)': (a.dailyRentFee || 0),
        '상태': a.status === 'RENTED_RETURNED' ? '임차반납' : '임차중',
        '전대 고객사': custName,
        '고객 대여만료일': a.contractEnd || '-'
      };
    });
    
    exportToExcel(excelData, `임차장비현황_${new Date().toISOString().split('T')[0]}`, '임차자산목록');
  };

  // 4. 지연 정산 내역 엑셀 다운로드
  const handleExportSettlement = () => {
    const excelData = rentedAssets.map((a, idx) => {
      const delayDays = calculateDelayDays(a);
      const delayFee = delayDays * (a.dailyRentFee || 0);
      const isMismatched = isSubleaseOverdue(a);
      const custName = a.currentCustomerId ? (customers.find(c => c.id === a.currentCustomerId)?.name || '알 수 없음') : '-';

      return {
        'No': idx + 1,
        '관리번호': a.assetNo,
        '모델명': a.modelName,
        '임차처': a.renter || '-',
        '임차 개시일': a.rentStart || '-',
        '임차 만료일 (예정)': a.rentEnd || '-',
        '실제 반납일': a.actualRentReturnDate || (a.status === 'RENTED_RETURNED' ? '반납완료' : '미반납'),
        '지연일수': delayDays + '일',
        '일 임차료': (a.dailyRentFee || 0).toLocaleString() + '원',
        '지연임차료(연장료)': delayFee.toLocaleString() + '원',
        '전대 고객사': custName,
        '고객 대여종료일': a.contractEnd || '-',
        '전대 만료일 초과여부': isMismatched ? '⚠️ 초과 (손실 위험)' : '정상'
      };
    });
    
    exportToExcel(excelData, `임차장비_지연정산_${new Date().toISOString().split('T')[0]}`, '지연정산현황');
  };

  return (
    <div>
      <div className="card-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontWeight: '700' }}>임차 전대 자산관리 및 반납 지연 정산</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          {activeTab === 'CURRENT' && (
            <button className="btn-secondary" onClick={handleExportCurrent} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Download size={14} /> 엑셀 다운로드
            </button>
          )}
          {activeTab === 'SETTLEMENT' && (
            <button className="btn-secondary" onClick={handleExportSettlement} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Download size={14} /> 엑셀 다운로드
            </button>
          )}
          {canSave && (
            <button className="btn-primary" onClick={handleOpenAdd}>
              <Plus size={16} /> 임차자산 등록
            </button>
          )}
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('CURRENT')}
          style={{
            padding: '10px 16px',
            fontSize: '14px',
            fontWeight: '600',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'CURRENT' ? '2.5px solid var(--primary)' : 'none',
            color: activeTab === 'CURRENT' ? 'var(--primary)' : 'var(--text-secondary)',
            cursor: 'pointer'
          }}
        >
          <Layers size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          임차자산 현황 및 계약 관리
        </button>
        <button
          onClick={() => setActiveTab('SETTLEMENT')}
          style={{
            padding: '10px 16px',
            fontSize: '14px',
            fontWeight: '600',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'SETTLEMENT' ? '2.5px solid var(--primary)' : 'none',
            color: activeTab === 'SETTLEMENT' ? 'var(--primary)' : 'var(--text-secondary)',
            cursor: 'pointer'
          }}
        >
          <Clock size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          반납 지연 및 매입 정산 관리
        </button>
      </div>

      {/* 탭 2: 지연 정산 요약 보드 */}
      {activeTab === 'SETTLEMENT' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--danger)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>반납 지연 자산</div>
            <div style={{ fontSize: '20px', fontWeight: '800', marginTop: '6px', color: 'var(--danger)' }}>
              {delayedAssets.length} <span style={{ fontSize: '13px', fontWeight: 'normal' }}>대</span>
            </div>
          </div>
          <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--success)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>확정 지연 매입금 (반납완료분)</div>
            <div style={{ fontSize: '20px', fontWeight: '800', marginTop: '6px', color: 'var(--success)' }}>
              {totalConfirmedDelayFee.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: 'normal' }}>원</span>
            </div>
          </div>
          <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--warning)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>예상 지연 매입금 (미반납 지연분)</div>
            <div style={{ fontSize: '20px', fontWeight: '800', marginTop: '6px', color: 'var(--warning)' }}>
              {totalEstimatedDelayFee.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: 'normal' }}>원</span>
            </div>
          </div>
          <div className="card" style={{ padding: '16px', borderLeft: '4px solid #ef4444' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>전대 만료 초과 위험 (미스매치)</div>
            <div style={{ fontSize: '20px', fontWeight: '800', marginTop: '6px', color: '#ef4444' }}>
              {totalSubleaseMismatches} <span style={{ fontSize: '13px', fontWeight: 'normal' }}>대</span>
            </div>
          </div>
        </div>
      )}

      {/* 검색 필터 */}
      <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
        <form onSubmit={(e) => {
          e.preventDefault();
          setSearchQuery(tempSearchTerm);
          setRenterQuery(tempRenterFilter);
          setStartDateQuery(tempStartDate);
          setEndDateQuery(tempEndDate);
          setReturnQuery(tempReturnStatus);
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'end' }}>
            <div>
              <label>자산 검색</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={tempSearchTerm}
                  onChange={e => setTempSearchTerm(e.target.value)}
                  placeholder="관리번호, 모델명..."
                  style={{ paddingLeft: '32px' }}
                />
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
              </div>
            </div>
            <div>
              <label>임차처 (소유사) 필터</label>
              <select value={tempRenterFilter} onChange={e => setTempRenterFilter(e.target.value)}>
                <option value="">전체 임차처</option>
                {rentersList.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label>임차 시작일 (이후)</label>
              <input type="date" value={tempStartDate} onChange={e => setTempStartDate(e.target.value)} />
            </div>
            <div>
              <label>임차 종료일 (이전)</label>
              <input type="date" value={tempEndDate} onChange={e => setTempEndDate(e.target.value)} />
            </div>
            <div>
              <label>반납 여부</label>
              <select value={tempReturnStatus} onChange={e => setTempReturnStatus(e.target.value)}>
                <option value="ALL">전체 반납 상태</option>
                <option value="RETURNED">반납 완료</option>
                <option value="RENTING">미반납 (임차 중)</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn-primary" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', height: '38px' }}>
                <Search size={14} /> 조회
              </button>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => {
                  setTempSearchTerm('');
                  setTempRenterFilter('');
                  setTempStartDate('');
                  setTempEndDate('');
                  setTempReturnStatus('ALL');
                  setSearchQuery('');
                  setRenterQuery('');
                  setStartDateQuery('');
                  setEndDateQuery('');
                  setReturnQuery('ALL');
                }}
                style={{ height: '38px' }}
              >
                초기화
              </button>
            </div>
          </div>
        </form>
      </div>

      {activeTab === 'CURRENT' ? (
        /* 탭 1: 임차자산 현황 리스트 */
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>관리번호</th>
                <th>모델명</th>
                <th>임차처 (소유원사)</th>
                <th>임차 개시일</th>
                <th>임차 만료일</th>
                <th>실제 반납일</th>
                <th>월 임차료</th>
                <th>상태</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                  {rentedAssets.length === 0 ? '📭 등록된 임차 자산이 없습니다.' : '🔍 조회 조건에 맞는 임차 자산이 없습니다. 검색 조건을 변경해 보세요.'}
                  </td>
                </tr>
              ) : (
                filtered.map(a => (
                  <tr key={a.id}>
                    <td><strong style={{ color: 'var(--primary)' }}>{a.assetNo}</strong></td>
                    <td>{a.modelName}</td>
                    <td>{a.renter}</td>
                    <td>{a.rentStart}</td>
                    <td>{a.rentEnd}</td>
                    <td>
                      {a.actualRentReturnDate ? (
                        <span style={{ color: 'var(--success)', fontWeight: '600' }}>{a.actualRentReturnDate}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>미반납</span>
                      )}
                    </td>
                    <td>{(a.monthlyRentFee || 0).toLocaleString()}원</td>
                    <td>
                      <span className={`badge ${
                        a.status === 'AVAILABLE' ? 'badge-success' :
                        a.status === 'RENTED' ? 'badge-info' :
                        a.status === 'REPAIRING' ? 'badge-warning' : 'badge-secondary'
                      }`}>
                        {a.status === 'AVAILABLE' ? '대기중' :
                         a.status === 'RENTED' ? '대여중' :
                         a.status === 'REPAIRING' ? '수리중' :
                         a.status === 'RENTED_RETURNED' ? '반납완료' : a.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {canSave && (
                          <button className="btn-secondary" onClick={() => handleOpenEdit(a)} style={{ padding: '4px 8px', fontSize: '12px' }}>
                            수정
                          </button>
                        )}
                        {canSave && a.status !== 'RENTED_RETURNED' && (
                          <button className="btn-danger" onClick={() => handleOpenReturn(a)} style={{ padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <CheckCircle size={12} /> 반납처리
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
      ) : (
        /* 탭 2: 반납 지연 및 매입 정산 테이블 */
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>관리번호</th>
                <th>모델명</th>
                <th>임차처</th>
                <th>임차 만료일</th>
                <th>실제 반납일</th>
                <th>지연일수</th>
                <th>지연 임차료 (연장료)</th>
                <th>전대(매출) 현황</th>
                <th>상태 / 경고</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                    {rentedAssets.length === 0 ? '📭 등록된 임차 자산이 없습니다.' : '🔍 조회 조건에 해당하는 정산 대상 임차 자산이 없습니다.'}
                  </td>
                </tr>
              ) : (
                filtered.map(a => {
                  const delayDays = calculateDelayDays(a);
                  const delayFee = delayDays * (a.dailyRentFee || 0);
                  const isMismatched = isSubleaseOverdue(a);
                  const cust = a.currentCustomerId ? customers.find(c => c.id === a.currentCustomerId) : null;

                  return (
                    <tr key={a.id} style={{ backgroundColor: isMismatched ? 'rgba(239, 68, 68, 0.02)' : 'inherit' }}>
                      <td><strong style={{ color: 'var(--primary)' }}>{a.assetNo}</strong></td>
                      <td>{a.modelName}</td>
                      <td>{a.renter}</td>
                      <td>{a.rentEnd}</td>
                      <td>
                        {a.actualRentReturnDate ? (
                          <span style={{ color: 'var(--success)', fontWeight: '600' }}>{a.actualRentReturnDate} (완료)</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>미반납 (진행중)</span>
                        )}
                      </td>
                      <td style={{ color: delayDays > 0 ? 'var(--danger)' : 'inherit', fontWeight: delayDays > 0 ? '600' : 'normal' }}>
                        {delayDays > 0 ? `${delayDays}일 지연` : '지연 없음'}
                      </td>
                      <td style={{ color: delayFee > 0 ? 'var(--danger)' : 'inherit', fontWeight: delayFee > 0 ? '600' : 'normal' }}>
                        {delayFee > 0 ? `${delayFee.toLocaleString()}원` : '-'}
                      </td>
                      <td>
                        {cust ? (
                          <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
                            <div style={{ fontWeight: '600' }}>{cust.name}</div>
                            <div style={{ color: 'var(--text-muted)' }}>
                              만료일: <span style={{ color: isMismatched ? 'var(--danger)' : 'inherit', fontWeight: isMismatched ? '600' : 'normal' }}>{a.contractEnd || '미지정'}</span>
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>대기중 (전대 없음)</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className={`badge ${
                            a.status === 'RENTED_RETURNED' ? 'badge-success' : 'badge-warning'
                          }`} style={{ width: 'fit-content' }}>
                            {a.status === 'RENTED_RETURNED' ? '반납 완료' : '미반납'}
                          </span>
                          {isMismatched && (
                            <span className="badge badge-danger" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', width: 'fit-content', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <ShieldAlert size={10} /> 전대 기간 초과
                            </span>
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
      )}

      {/* 등록/수정 모달 */}
      {showModal && editingAsset && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleSubmit} className="card" style={{ width: '100%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>
              {editingAsset.id ? '임차자산 정보 수정' : '신규 임차자산(재임대용) 등록'}
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>관리번호 *</label>
                  <input
                    type="text"
                    value={editingAsset.assetNo || ''}
                    disabled={!!editingAsset.id}
                    onChange={e => setEditingAsset({ ...editingAsset, assetNo: e.target.value })}
                    placeholder="예: RENT-001"
                    required
                  />
                </div>
                <div>
                  <label>제품 모델 선택 *</label>
                  <select
                    value={editingAsset.modelName || ''}
                    onChange={e => setEditingAsset({ ...editingAsset, modelName: e.target.value })}
                    required
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.modelName}>{p.modelName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>제조번호 (Serial)</label>
                  <input
                    type="text"
                    value={editingAsset.serialNo || ''}
                    onChange={e => setEditingAsset({ ...editingAsset, serialNo: e.target.value })}
                  />
                </div>
                <div>
                  <label>제조사 (영문)</label>
                  <input
                    type="text"
                    value={editingAsset.manufacturer || ''}
                    onChange={e => setEditingAsset({ ...editingAsset, manufacturer: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label>임차처 (소유 원렌탈사) *</label>
                <input
                  type="text"
                  value={editingAsset.renter || ''}
                  onChange={e => setEditingAsset({ ...editingAsset, renter: e.target.value })}
                  placeholder="예: (주)한국종합렌탈"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>임차 개시일 *</label>
                  <input
                    type="date"
                    value={editingAsset.rentStart || ''}
                    onChange={e => setEditingAsset({ ...editingAsset, rentStart: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label>임차 만료일 *</label>
                  <input
                    type="date"
                    value={editingAsset.rentEnd || ''}
                    onChange={e => setEditingAsset({ ...editingAsset, rentEnd: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>월 지불 임차료 (원) *</label>
                  <input
                    type="number"
                    value={editingAsset.monthlyRentFee || ''}
                    onChange={e => setEditingAsset({ ...editingAsset, monthlyRentFee: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div>
                  <label>일 지불 임차료 (원) *</label>
                  <input
                    type="number"
                    value={editingAsset.dailyRentFee || ''}
                    onChange={e => setEditingAsset({ ...editingAsset, dailyRentFee: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>

              {editingAsset.id && (
                <div>
                  <label>실제 반납 처리일자</label>
                  <input
                    type="date"
                    value={editingAsset.actualRentReturnDate || ''}
                    onChange={e => setEditingAsset({ ...editingAsset, actualRentReturnDate: e.target.value })}
                    placeholder="YYYY-MM-DD"
                  />
                </div>
              )}

              <div>
                <label>메모 (임차조건 등)</label>
                <textarea
                  value={editingAsset.memo1 || ''}
                  onChange={e => setEditingAsset({ ...editingAsset, memo1: e.target.value })}
                  rows={2}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>취소</button>
              <button type="submit" className="btn-primary">저장</button>
            </div>
          </form>
        </div>
      )}

      {/* 반납 모달 */}
      {showReturnModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleReturnSubmit} className="card" style={{ width: '100%', maxWidth: '500px', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>임차 장비 반납 확정 & 회수 배차 신청</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              선택하신 장비를 소유원사에 최종 반납 처리하고, 필요 시 회수/반납 배차를 동시에 신청합니다.
            </p>
            <div style={{ marginBottom: '16px' }}>
              <label>반납 처리일자 *</label>
              <input
                type="date"
                value={returnDate}
                onChange={e => setReturnDate(e.target.value)}
                required
              />
            </div>

            {/* 반납 배차 통합 신청 옵션 */}
            <div style={{ padding: '14px', backgroundColor: 'var(--bg-active)', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', cursor: 'pointer', color: 'var(--primary)' }}>
                <input
                  type="checkbox"
                  checked={isDispatchRequested}
                  onChange={e => setIsDispatchRequested(e.target.checked)}
                />
                🚚 회수 / 반납 배차 동시 신청하기
              </label>

              {isDispatchRequested && (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '12px' }}>상차지 (출발지)</label>
                      <input type="text" value={returnOrigin} onChange={e => setReturnOrigin(e.target.value)} placeholder="현장주소 또는 보관소" />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px' }}>하차지 (도착지)</label>
                      <input type="text" value={returnDestination} onChange={e => setReturnDestination(e.target.value)} placeholder="임차처/소유원사 주소" />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '12px' }}>필요 차종 / 톤수</label>
                      <select value={returnVehicleType} onChange={e => setReturnVehicleType(e.target.value)}>
                        <option value="1.4T">1.4T</option>
                        <option value="2.5T">2.5T</option>
                        <option value="3.5T">3.5T</option>
                        <option value="5T">5T</option>
                        <option value="5T장축">5T장축</option>
                        <option value="8.5T">8.5T</option>
                        <option value="11T">11T</option>
                        <option value="노배드">노배드</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px' }}>예상 운송료 (원)</label>
                      <input type="number" value={returnCost} onChange={e => setReturnCost(parseInt(e.target.value) || 0)} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowReturnModal(false)}>취소</button>
              <button type="submit" className="btn-danger">
                {isDispatchRequested ? '반납 & 배차신청 완료' : '반납 확정'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
