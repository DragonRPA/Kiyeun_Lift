// d:\Kiyeun_Lift\src\pages\Dashboard.tsx
import React from 'react';
import { useApp } from '../context/AppContext';
import { Activity, ShieldAlert, Users, Layers, ShieldCheck, Wrench, Truck, CreditCard, ShoppingBag, CheckCircle, Bell, AlertTriangle, ArrowRight, Cloud, AlertCircle } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { currentUser, hasPermission, assets, contracts, consumables, repairs, deliveries, billings, customers, todos, completeTodo, setActiveTab, setNavigationPayload } = useApp();

  // 사용자 메뉴 권한 기반 카드 노출 판단 플래그 (메뉴 저장/조회 권한 보유 여부)
  const canSaveDelivery = hasPermission('delivery', 'save') || hasPermission('delivery', 'view');
  const canSaveRepair = hasPermission('repairs', 'save') || hasPermission('repair', 'save') || hasPermission('repairs', 'view') || hasPermission('repair', 'view');
  const canSaveBilling = hasPermission('billings', 'save') || hasPermission('billing', 'save') || hasPermission('billings', 'view') || hasPermission('billing', 'view');
  const canSaveContract = hasPermission('contracts', 'save') || hasPermission('contract', 'save') || hasPermission('contracts', 'view') || hasPermission('contract', 'view');
  const canSaveConsumable = hasPermission('consumables', 'save') || hasPermission('consumable', 'save') || hasPermission('consumables', 'view') || hasPermission('consumable', 'view');
  const canSaveRentAsset = hasPermission('rent_asset', 'save') || hasPermission('rent_asset', 'view');

  const myTodos = todos.filter(t => t.userId === currentUser?.id && !t.isCompleted);

  const totalAssets = assets.length;
  const rentedAssets = assets.filter(a => a.status === 'RENTED').length;
  const availableAssets = assets.filter(a => a.status === 'AVAILABLE').length;
  const repairingAssets = assets.filter(a => a.status === 'REPAIRING').length;

  const activeContracts = contracts.filter(c => c.status === 'ACTIVE' || c.status === 'EXTENDED').length;
  const lowStockConsumables = consumables.filter(c => c.stockQty < 5).length;
  const pendingRepairs = repairs.filter(r => r.status === 'PENDING' || r.status === 'IN_PROGRESS').length;
  const activeDeliveries = deliveries.filter(d => d.status !== 'COMPLETED').length;

  const unpaidBillings = billings.filter(b => b.status !== 'PAID');
  const totalUnpaidAmount = unpaidBillings.reduce((sum, b) => sum + (b.totalAmount - b.paidAmount), 0);

  // 임차 자산 반납 지연 및 전대 계약 미스매치 계산
  const allRentedAssets = assets.filter(a => a.ownerType === 'RENTED');

  const checkRentedDelayDays = (asset: any): number => {
    if (!asset.rentEnd) return 0;
    const plannedEnd = new Date(asset.rentEnd);
    const actualEnd = asset.actualRentReturnDate 
      ? new Date(asset.actualRentReturnDate) 
      : new Date();
    plannedEnd.setHours(0,0,0,0);
    actualEnd.setHours(0,0,0,0);
    const diffTime = actualEnd.getTime() - plannedEnd.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const isSubleaseMismatch = (asset: any): boolean => {
    if (!asset.rentEnd || !asset.contractEnd) return false;
    const leaseEnd = new Date(asset.rentEnd);
    const subleaseEnd = new Date(asset.contractEnd);
    leaseEnd.setHours(0,0,0,0);
    subleaseEnd.setHours(0,0,0,0);
    return subleaseEnd.getTime() > leaseEnd.getTime();
  };

  const overdueRentedCount = allRentedAssets.filter(a => a.status !== 'RENTED_RETURNED' && checkRentedDelayDays(a) > 0).length;
  const mismatchRentedCount = allRentedAssets.filter(a => isSubleaseMismatch(a)).length;

  // 최근 활동 내역 합성
  const activities: { id: string; type: string; text: string; date: string; icon: React.ReactNode }[] = [];
  
  contracts.slice(-3).forEach(c => {
    const cust = customers.find(cust => cust.id === c.customerId);
    activities.push({
      id: `act-c-${c.id}`,
      type: '계약',
      text: `계약 등록: ${cust?.name || '고객'} (${c.contractNo})`,
      date: c.createdAt.substring(0, 10),
      icon: <Layers size={16} className="text-primary" />
    });
  });

  repairs.slice(-3).forEach(r => {
    const asset = assets.find(a => a.id === r.assetId);
    activities.push({
      id: `act-r-${r.id}`,
      type: '정비',
      text: `정비 등록: [${asset?.assetNo || '자산'}] ${r.details.substring(0, 20)}...`,
      date: r.createdAt.substring(0, 10),
      icon: <Wrench size={16} className="text-warning" />
    });
  });

  deliveries.slice(-3).forEach(d => {
    const contr = contracts.find(c => c.id === d.contractId);
    const cust = contr ? customers.find(cust => cust.id === contr.customerId) : null;
    activities.push({
      id: `act-d-${d.id}`,
      type: '배차',
      text: `${d.type === 'OUTBOUND' ? '출고' : '회수'} 배차 상태: [${d.status}] ${cust?.name || ''}`,
      date: d.createdAt.substring(0, 10),
      icon: <Truck size={16} className="text-info" />
    });
  });

  activities.sort((a, b) => b.date.localeCompare(a.date));

  const role = currentUser?.role || 'SALES';

  // 직무 역할 한글 매핑 및 배지 색상
  const getRoleBadge = () => {
    switch (role) {
      case 'ADMIN': return { text: '최고관리자 (ADMIN)', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
      case 'MANAGER': return { text: '부서관리자 (MANAGER)', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' };
      case 'SALES': return { text: '영업담당자 (SALES)', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' };
      case 'REPAIR':
      case 'MECHANIC': return { text: '정비담당자 (MECHANIC)', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
      case 'LOGISTICS':
      case 'DELIVERY': return { text: '배차물류담당자 (LOGISTICS)', color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' };
      default: return { text: '임직원 (USER)', color: '#64748b', bg: 'rgba(100,116,137,0.1)' };
    }
  };

  const badge = getRoleBadge();

  return (
    <div className="dashboard-page" style={{ maxWidth: '850px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* 웰컴 상단 바 */}
      <div className="card" style={{
        margin: '0 0 24px 0', padding: '24px', borderRadius: '12px',
        background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-secondary) 100%)',
        border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0 }}>반갑습니다, {currentUser?.name || '임직원'}님!</h2>
            <span style={{
              fontSize: '11px', fontWeight: '800', padding: '3px 8px', borderRadius: '4px',
              color: badge.color, backgroundColor: badge.bg, border: `1px solid ${badge.color}`
            }}>
              {badge.text}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '6px 0 0 0' }}>
            오늘 실시간으로 확인하고 즉시 처리해야 할 직무 전용 할 일 목록입니다.
          </p>
        </div>

        {role === 'ADMIN' && (
          <button 
            className="btn-danger" 
            onClick={() => {
              if(confirm('모든 로컬 데이터를 삭제하고 방금 주입된 100개의 테스트 데이터로 초기화하시겠습니까?')) {
                localStorage.clear();
                location.reload();
              }
            }}
            style={{ padding: '8px 16px', fontSize: '12.5px', borderRadius: '8px', fontWeight: 'bold' }}
          >
            🔄 테스트 데이터 리셋
          </button>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* 권한(Permission) 기반 스마트 카드 피드 렌더링 섹션 */}
      {/* ──────────────────────────────────────────────────────── */}
      {(() => {
        const requestedDeliveries = deliveries.filter(d => d.status === 'REQUESTED');
        const showDeliveryFeed = requestedDeliveries.length > 0 && canSaveDelivery;
        const showBillingFeed = unpaidBillings.length > 0 && (canSaveBilling || role === 'ADMIN' || role === 'MANAGER');
        const showRentAssetFeed = (overdueRentedCount > 0 || mismatchRentedCount > 0) && (canSaveRentAsset || role === 'ADMIN' || role === 'MANAGER');
        const showRepairFeed = pendingRepairs > 0 && (canSaveRepair || role === 'ADMIN' || role === 'MANAGER');
        const showConsumableFeed = lowStockConsumables > 0 && (canSaveConsumable || canSaveRepair || role === 'ADMIN' || role === 'MANAGER');
        const showContractFeed = canSaveContract;
        const showTodoFeed = myTodos.length > 0;

        const visibleCount = [showDeliveryFeed, showBillingFeed, showRentAssetFeed, showRepairFeed, showConsumableFeed, showContractFeed, showTodoFeed].filter(Boolean).length;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* 1. 출고/회수 배차 대기 피드 카드 (배차 메뉴 권한이 있는 사용자에게 표출) */}
            {showDeliveryFeed && (
              <div style={{
                backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '20px 24px',
                borderLeft: '5px solid #06b6d4', border: '1px solid var(--border-color)', borderLeftWidth: '5px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.12)', padding: '3px 9px', borderRadius: '4px', border: '1px solid rgba(6,182,212,0.3)' }}>
                    🚚 배차 권한 실시간 할일
                  </span>
                  <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#06b6d4' }}>
                    배차 대기 목록 총 {requestedDeliveries.length}건
                  </span>
                </div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Truck size={18} color="#06b6d4" /> 출고 및 회수 배차 대기 피드
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px 0', lineHeight: '1.5' }}>
                  스마트 출고/회수 시스템을 통해 접수되었으나, 아직 차량 배차 및 장비 매핑이 완결되지 않은 <strong>{requestedDeliveries.length}건</strong>의 배차 지시가 있습니다. 
                  운송 기사 수배 및 차량 배차 처리를 완료해 주십시오.
                </p>

                {/* 배차 대기 목록 프리뷰 카드 피드 리스트 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                  {requestedDeliveries.slice(0, 3).map((del, idx) => {
                    const contr = contracts.find(c => c.id === del.contractId);
                    const cust = contr ? customers.find(c => c.id === contr.customerId) : null;
                    let cargoSummary = '';
                    try {
                      const items = JSON.parse(del.cargoItems || '[]');
                      cargoSummary = items.map((it: any) => `${it.modelName} ${it.count}대`).join(', ');
                    } catch (e) {
                      cargoSummary = '장비 배정 대기';
                    }

                    return (
                      <div key={del.id} style={{
                        backgroundColor: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: '8px',
                        border: '1px solid var(--border-color)', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: '800', color: 'var(--text-main)' }}>
                            {idx + 1}. {cust?.name || del.destinationAddress || '고객사 미상'}
                          </span>
                          <span style={{
                            fontSize: '11px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px',
                            backgroundColor: del.type === 'OUTBOUND' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                            color: del.type === 'OUTBOUND' ? '#3b82f6' : '#f59e0b'
                          }}>
                            {del.type === 'OUTBOUND' ? '출고 배차' : '회수 배차'} (요청: {del.requestDate || del.createdAt.substring(0, 10)})
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          <span>🚩 <strong>하차지:</strong> {del.destinationAddress}</span>
                          {cargoSummary && <span style={{ color: '#06b6d4', fontWeight: 'bold' }}>⚙️ {cargoSummary}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button className="btn-primary" onClick={() => setActiveTab('delivery')} style={{ backgroundColor: '#06b6d4', border: 'none', fontSize: '12.5px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  배차 / 운송 관리 메뉴로 이동하여 배차 처리하기 <ArrowRight size={13} />
                </button>
              </div>
            )}

            {/* 2. 전사 미수금 회수 독촉 카드 (수납/청구 권한 보유 시 노출) */}
            {showBillingFeed && (
              <div style={{
                backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '20px 24px',
                borderLeft: '5px solid #ef4444', border: '1px solid var(--border-color)', borderLeftWidth: '5px'
              }}>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: '4px' }}>[재무 위기 관리]</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>수납 미완료 {unpaidBillings.length}건</span>
                </div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CreditCard size={18} color="#ef4444" /> 전사 렌탈 매출 미수금 누적 알림
                </h4>
                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: '0 0 14px 0', lineHeight: '1.5' }}>
                  현재 수납 처리되지 않은 연체/미수 대금이 총 <strong style={{ color: '#ef4444', fontSize: '15px' }}>{totalUnpaidAmount.toLocaleString()}원</strong>에 달합니다. 
                  미수 거래처 목록과 발행 명세서를 전수 점검하여 즉시 수납 처리를 진행하십시오.
                </p>
                <button className="btn-primary" onClick={() => setActiveTab('billings')} style={{ backgroundColor: '#ef4444', border: 'none', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  연체 및 미수금 현황 수납 마감 <ArrowRight size={12} />
                </button>
              </div>
            )}

            {/* 3. 소유사(임차) 자산 반납 지연 카드 */}
            {showRentAssetFeed && (
              <div style={{
                backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '20px 24px',
                borderLeft: '5px solid #f59e0b', border: '1px solid var(--border-color)', borderLeftWidth: '5px'
              }}>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: '4px' }}>[정산 위험]</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>경보 {overdueRentedCount + mismatchRentedCount}건</span>
                </div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={18} color="#f59e0b" /> 소유사(임차) 자산 반납 지연 및 매칭 만기 미스매치
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px 0', lineHeight: '1.5' }}>
                  {overdueRentedCount > 0 && `• 반납 기한을 넘겨 매입 연장 비용이 청구되고 있는 임차 장비가 ${overdueRentedCount}대 있습니다. `}
                  {mismatchRentedCount > 0 && `• 고객 매출 종료일보다 소유사 매입 기한이 짧아 손실이 우려되는 정산 계약이 ${mismatchRentedCount}건 검출되었습니다.`}
                </p>
                <button className="btn-primary" onClick={() => setActiveTab('rent_asset')} style={{ backgroundColor: '#f59e0b', border: 'none', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  임차 자산 회수 정산 관리 <ArrowRight size={12} />
                </button>
              </div>
            )}

            {/* 4. 장비 정비 대기열 카드 (정비 권한 보유 시 노출) */}
            {showRepairFeed && (
              <div style={{
                backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '20px 24px',
                borderLeft: '5px solid #f59e0b', border: '1px solid var(--border-color)', borderLeftWidth: '5px'
              }}>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: '4px' }}>[정비 할일]</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>미완료 {pendingRepairs}건</span>
                </div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wrench size={18} color="#f59e0b" /> 실시간 장비 정비 대기열 및 입고 불량 상태
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                  {repairs.filter(r => r.status !== 'COMPLETED').slice(0, 3).map((rep, idx) => {
                    const asset = assets.find(a => a.id === rep.assetId);
                    return (
                      <div key={rep.id} style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                          <span>{idx + 1}. 장비번호: <strong style={{ color: 'var(--primary)' }}>{asset?.assetNo || '미정'}</strong> ({asset?.modelName || '미정'})</span>
                          <span style={{ color: 'var(--danger)', fontSize: '11px' }}>정비부담점수: {asset?.maintenanceScore || 0}점</span>
                        </div>
                        <div style={{ marginTop: '6px', color: 'var(--text-secondary)' }}>
                          <strong>불량/의뢰 내용:</strong> {rep.details}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button className="btn-primary" onClick={() => setActiveTab('repairs')} style={{ backgroundColor: '#f59e0b', border: 'none', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  전체 정비 의뢰 등록 및 자재 투입 <ArrowRight size={12} />
                </button>
              </div>
            )}

            {/* 5. 소모품 재고 부족 경보 카드 */}
            {showConsumableFeed && (
              <div style={{
                backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '20px 24px',
                borderLeft: '5px solid #ef4444', border: '1px solid var(--border-color)', borderLeftWidth: '5px'
              }}>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: '4px' }}>[자재 부족]</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>부족 품목수 {lowStockConsumables}종</span>
                </div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShoppingBag size={18} color="#ef4444" /> 메카닉 정비 소모품 안전 마진 임계값 초과
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px 0', lineHeight: '1.5' }}>
                  고소작업대 정비 및 출고 인도에 필요한 소모품 품목 중 재고량이 5개 미만인 자재가 <strong>{lowStockConsumables}종</strong> 있습니다. 
                  신속히 재고 구매 보완 신청을 진행하십시오.
                </p>
                <button className="btn-primary" onClick={() => setActiveTab('consumable')} style={{ backgroundColor: '#ef4444', border: 'none', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  소모품 재고 확인 및 구매 신청 <ArrowRight size={12} />
                </button>
              </div>
            )}

            {/* 6. 영업 및 임대차 계약 관리 카드 (계약 권한 보유 시 노출) */}
            {showContractFeed && (
              <div style={{
                backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '20px 24px',
                borderLeft: '5px solid #3b82f6', border: '1px solid var(--border-color)', borderLeftWidth: '5px'
              }}>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: '4px' }}>[영업/계약 관리]</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>진행 중 계약 {activeContracts}건</span>
                </div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={18} color="#3b82f6" /> 기연리프트 고객 대여 렌탈 계약 관리
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px 0', lineHeight: '1.5' }}>
                  현재 담당 관리하는 활성/연장 계약은 총 <strong>{activeContracts}건</strong>입니다. 
                  계약 만기 연장 처리 또는 종료 예정 계약들의 회수 일정을 전수 확인하여 반납 입고 준비를 시작하십시오.
                </p>
                <button className="btn-primary" onClick={() => setActiveTab('contracts')} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  계약 관리 대장으로 이동 <ArrowRight size={12} />
                </button>
              </div>
            )}

            {/* 7. 고객 정보 미비 보완 카드 */}
            {showTodoFeed && (
              <div style={{
                backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '20px 24px',
                borderLeft: '5px solid #f59e0b', border: '1px solid var(--border-color)', borderLeftWidth: '5px'
              }}>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: '4px' }}>[정보 미비]</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>보완 {myTodos.length}건</span>
                </div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={18} color="#f59e0b" /> 신규 고객사 및 현장 세부 정보 보완 요망
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px 0', lineHeight: '1.5' }}>
                  최근 신설되었으나 연락처, 현장 상세 주소, 정산 조건 등 필수 인적 사항 정보가 누락되어 정산에 위험이 되는 고객이 있습니다. 
                  신속히 거래처 정보를 보완해 주세요.
                </p>
                <button className="btn-primary" onClick={() => setActiveTab('customers')} style={{ backgroundColor: '#f59e0b', border: 'none', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  고객 및 현장 마스터 정보 보완 <ArrowRight size={12} />
                </button>
              </div>
            )}

            {/* 8. 나의 권한 범위 내 당면 과제가 0건일 때 완료 안내 카드 */}
            {visibleCount === 0 && (
              <div className="card" style={{ padding: '36px 24px', textAlign: 'center', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
                <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e', marginBottom: '12px' }}>
                  <CheckCircle size={36} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 8px 0' }}>🎉 현재 즉시 처리해야 할 당면 과제가 없습니다!</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                  귀하에게 할당된 메뉴 권한 범위 내의 모든 실시간 업무가 완벽하게 완료되었습니다.
                </p>
              </div>
            )}

          </div>
        );
      })()}

    </div>
  );
};
