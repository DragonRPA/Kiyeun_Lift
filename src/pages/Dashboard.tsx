// d:\Kiyeun_Lift\src\pages\Dashboard.tsx
import React from 'react';
import { useApp } from '../context/AppContext';
import { Activity, ShieldAlert, Users, Layers, ShieldCheck, Wrench, Truck, CreditCard, ShoppingBag, CheckCircle, Bell } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { currentUser, assets, contracts, consumables, repairs, deliveries, billings, customers, todos, completeTodo, setActiveTab, setNavigationPayload } = useApp();

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

  return (
    <div className="dashboard-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '800' }}>ERP 종합 대시보드</h2>
        <button 
          className="btn-danger" 
          onClick={() => {
            if(confirm('모든 로컬 데이터를 삭제하고 방금 주입된 100개의 테스트 데이터로 초기화하시겠습니까?')) {
              localStorage.clear();
              location.reload();
            }
          }}
          style={{ padding: '8px 16px', fontSize: '14px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(239,68,68,0.3)' }}
        >
          🔄 테스트 데이터 강제 리셋 (100대/13건 주입)
        </button>
      </div>

      {/* 임차 자산 지연 및 기간 불일치 경보 */}
      {(overdueRentedCount > 0 || mismatchRentedCount > 0) && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', padding: '16px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c', fontWeight: 'bold' }}>
            <ShieldAlert size={18} />
            <span>⚠️ 임차 자산 반납 지연 및 정산 위험 알림</span>
          </div>
          <div style={{ fontSize: '13.5px', color: '#7f1d1d', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {overdueRentedCount > 0 && (
              <span>• 소유사에 아직 반납되지 않은 채 임차 만료일이 도래한 자산이 <strong>{overdueRentedCount}건</strong> 있습니다. (일할 매입 연장료 누적 중)</span>
            )}
            {mismatchRentedCount > 0 && (
              <span>• 우리 고객사 매출 대여만료일이 소유사 매입 종료일보다 늦게 체결된 정산 불일치(손실 위험) 자산이 <strong>{mismatchRentedCount}건</strong> 있습니다.</span>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button 
              className="btn-primary" 
              onClick={() => setActiveTab('rent_asset')} 
              style={{ backgroundColor: '#b91c1c', border: 'none', padding: '6px 12px', fontSize: '12px', borderRadius: '6px' }}
            >
              임차자산 정산하러 가기
            </button>
          </div>
        </div>
      )}

      {/* 나의 할 일 (Todo) 알림 패널 */}
      {myTodos.length > 0 && (
        <div style={{ backgroundColor: '#fffbe1', border: '1px solid #fde047', borderRadius: '8px', padding: '16px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', fontWeight: 'bold' }}>
            <Bell size={18} />
            <span>나의 할 일 (정보 보완 요망) - {myTodos.length}건</span>
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            {myTodos.map(todo => {
              const isMissingInfo = todo.type === 'MISSING_INFO';
              return (
                <div key={todo.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #fef08a' }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: '#92400e' }}>{todo.title}</div>
                    <div style={{ fontSize: '12px', color: '#b45309', marginTop: '4px' }}>{todo.content}</div>
                  </div>
                  {isMissingInfo ? (
                    <button 
                      className="btn-primary"
                      style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--primary)' }}
                      onClick={() => {
                        setActiveTab('customers');
                        setNavigationPayload({ editCustomerId: todo.relatedEntityId });
                      }}
                    >
                      <Layers size={14} /> 정보 보완하러 가기
                    </button>
                  ) : (
                    <button 
                      className="btn-primary"
                      style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => completeTodo(todo.id)}
                    >
                      <CheckCircle size={14} /> 확인 (보완 완료)
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: 0 }}>
          <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
            <Layers size={24} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>전체 자산 / 운용중</div>
            <div style={{ fontSize: '22px', fontWeight: '700' }}>
              {totalAssets} <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-muted)' }}>대</span>
              <span style={{ margin: '0 8px', color: 'var(--border-color)' }}>|</span>
              <span className="text-primary">{rentedAssets}</span> <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-muted)' }}>대 대여중</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: 0 }}>
          <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'var(--success-light)', color: 'var(--success)' }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>진행 중인 렌탈 계약</div>
            <div style={{ fontSize: '22px', fontWeight: '700' }}>{activeContracts}건</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: 0 }}>
          <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'var(--warning-light)', color: 'var(--warning)' }}>
            <Wrench size={24} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>대기 중인 수리 건수</div>
            <div style={{ fontSize: '22px', fontWeight: '700' }}>{pendingRepairs}건</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: 0 }}>
          <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'var(--danger-light)', color: 'var(--danger)' }}>
            <CreditCard size={24} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>미수 수납 금액</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--danger)' }}>
              {totalUnpaidAmount.toLocaleString()}원
            </div>
          </div>
        </div>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
        
        {/* 장비 자산 상태 차트 모형 */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header">
            <h3 className="card-title">장비 현황 요약</h3>
            <span className="badge badge-info">실시간</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '14px' }}>
                <span>대여 가능 (AVAILABLE)</span>
                <span style={{ fontWeight: '600' }}>{availableAssets}대 ({totalAssets ? Math.round((availableAssets/totalAssets)*100) : 0}%)</span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${totalAssets ? (availableAssets/totalAssets)*100 : 0}%`, backgroundColor: 'var(--success)' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '14px' }}>
                <span>대여 중 (RENTED)</span>
                <span style={{ fontWeight: '600' }}>{rentedAssets}대 ({totalAssets ? Math.round((rentedAssets/totalAssets)*100) : 0}%)</span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${totalAssets ? (rentedAssets/totalAssets)*100 : 0}%`, backgroundColor: 'var(--primary)' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '14px' }}>
                <span>정비 중 (REPAIRING)</span>
                <span style={{ fontWeight: '600' }}>{repairingAssets}대 ({totalAssets ? Math.round((repairingAssets/totalAssets)*100) : 0}%)</span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${totalAssets ? (repairingAssets/totalAssets)*100 : 0}%`, backgroundColor: 'var(--warning)' }}></div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1, padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>소모품 부족 (5개 미만)</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: lowStockConsumables > 0 ? 'var(--danger)' : 'var(--text-main)', marginTop: '4px' }}>
                {lowStockConsumables} 품목
              </div>
            </div>
            <div style={{ flex: 1, padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>진행중 배차 의뢰</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--info)', marginTop: '4px' }}>
                {activeDeliveries} 건
              </div>
            </div>
          </div>
        </div>

        {/* 최근 등록/변경 활동 스트림 */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header">
            <h3 className="card-title">최근 업무 변동 현황</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Activity size={12} /> 실시간 로그
            </span>
          </div>

          {activities.length === 0 ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)' }}>최근 등록된 활동이 없습니다.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {activities.map(act => (
                <div key={act.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ padding: '6px', borderRadius: '50%', backgroundColor: 'var(--bg-app)', marginTop: '2px' }}>
                    {act.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>{act.text}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)' }}>{act.type}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{act.date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
