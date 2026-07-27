import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Wrench, CheckCircle, PackageSearch, Layers, Truck, ChevronDown, Check, Activity } from 'lucide-react';

export const AssetAssignment: React.FC = () => {
  const { hasPermission, contractAssets, contracts, customers, assets, assignAssetToContract } = useApp();
  
  const [selectedContractId, setSelectedContractId] = useState<string>('');
  const [selectedCaId, setSelectedCaId] = useState<string>('');
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');

  const canEdit = hasPermission('dispatch_assign', 'save');
  const canView = hasPermission('dispatch_assign', 'view');

  if (!canView && !canEdit) {
    return <div style={{ padding: '16px', fontSize: '13px' }}>이 메뉴에 접근할 권한이 없습니다. (dispatch_assign)</div>;
  }

  // 1. 미할당된 ContractAsset을 포함하고 있는 Contract 들을 찾는다.
  const pendingCaList = contractAssets.filter(ca => !ca.assetId);
  const pendingContractIds = Array.from(new Set(pendingCaList.map(ca => ca.contractId)));
  const pendingContracts = contracts.filter(c => pendingContractIds.includes(c.id));

  const handleAssign = async () => {
    if (!canEdit) {
      alert('장비 할당 권한이 없습니다.');
      return;
    }
    if (!selectedCaId || !selectedAssetId) {
      alert('출고 건과 할당할 장비를 모두 선택해주세요.');
      return;
    }

    try {
      await assignAssetToContract(selectedCaId, selectedAssetId);
      alert('✅ 장비 할당이 성공적으로 완결되었습니다!\n자산 상태가 [출고대기(ASSIGNED)]로 즉시 전환되어 타 계약 이중 할당이 차단되었으며, 출고 검수 의뢰가 발행되었습니다.');
      setSelectedCaId('');
      setSelectedAssetId('');
    } catch (err: any) {
      alert(`⚠️ 장비 할당 실패: ${err?.message || err}`);
    }
  };

  // 선택된 계약의 하위 슬롯들 (미할당 + 기할당 모두 보여주기)
  const slots = selectedContractId ? contractAssets.filter(ca => ca.contractId === selectedContractId) : [];

  // 축약어(예: '1212') 지원용 유사 모델 매칭 헬퍼
  const isModelMatch = (assetModel: string, expectedModel: string): boolean => {
    if (!assetModel || !expectedModel) return false;
    if (assetModel === expectedModel) return true;
    
    const cleanedA = assetModel.replace(/[\s\-_]/g, '').toLowerCase();
    const cleanedE = expectedModel.replace(/[\s\-_]/g, '').toLowerCase();
    if (cleanedA.includes(cleanedE) || cleanedE.includes(cleanedA)) return true;

    const nums = expectedModel.match(/\d{3,4}/);
    if (nums && assetModel.includes(nums[0])) return true;

    return false;
  };

  // 가용 장비 필터링 및 정렬 로직 (스마트 매핑 & Score 우선순위)
  let availableAssets = assets.filter(a => a.status === 'AVAILABLE');

  if (selectedCaId) {
    // [슬롯 선택 시] 해당 슬롯의 expectedModel로 좁힘 (완전일치 + 유사매칭 포함)
    const selectedSlot = slots.find(ca => ca.id === selectedCaId);
    if (selectedSlot?.expectedModel) {
      const expModel = selectedSlot.expectedModel;
      availableAssets = availableAssets.filter(a => isModelMatch(a.modelName, expModel));
    }
  } else if (selectedContractId) {
    // [계약 선택 시] 미할당 슬롯들이 요구하는 모델 목록 기반 1차 필터
    const pendingSlots = slots.filter(ca => !ca.assetId);
    const requiredModels = pendingSlots.map(ca => ca.expectedModel).filter((m): m is string => Boolean(m));
    if (requiredModels.length > 0) {
      availableAssets = availableAssets.filter(a => requiredModels.some(req => isModelMatch(a.modelName, req)));
    }
  }

  // Maintenance Score 기준 오름차순 정렬 (0에 가까울수록 우선)
  availableAssets.sort((a, b) => (a.maintenanceScore || 0) - (b.maintenanceScore || 0));

  // 점수에 따른 뱃지 컬러 렌더링 도우미
  const getScoreBadgeColor = (score: number = 0) => {
    if (score === 0) return { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' }; // 매우 좋음 (녹색)
    if (score <= 20) return { bg: '#fef3c7', color: '#92400e', border: '#fde68a' }; // 보통 (노란색)
    return { bg: '#fee2e2', color: '#991b1b', border: '#fecaca' }; // 나쁨 (빨간색)
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontWeight: '800', marginBottom: '4px', fontSize: '18px', letterSpacing: '-0.5px' }}>장비 할당 보드 (고밀도 뷰)</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>가용 장비를 바둑판 카드로 매핑합니다. (선택된 슬롯과 동일한 모델명만 노출 및 상태 점수순 정렬)</p>
        </div>
      </div>

      {/* 1단계: 출고 대기 중인 계약(기안) 카드 바둑판 뷰 */}
      <div style={{ backgroundColor: 'var(--bg-card)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <PackageSearch size={14} className="text-warning" /> 출고 대기 요청 건 ({pendingContracts.length}건)
        </h3>
        
        {pendingContracts.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>대기 중인 지시가 없습니다.</div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', 
            gap: '12px' 
          }}>
            {pendingContracts.map(contract => {
              const cust = customers.find(c => c.id === contract.customerId);
              const cas = contractAssets.filter(ca => ca.contractId === contract.id);
              const totalCount = cas.length;
              const assignedCount = cas.filter(ca => ca.assetId).length;
              const isSelected = selectedContractId === contract.id;
              const progress = totalCount > 0 ? Math.round((assignedCount / totalCount) * 100) : 0;

              // 요구 장비 문자열 집계
              const reqSummary = cas.reduce((acc, curr) => {
                const model = curr.expectedModel || '미지정';
                acc[model] = (acc[model] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);
              const reqText = Object.entries(reqSummary).map(([k, v]) => `${k} ${v}대`).join(', ');

              return (
                <div 
                  key={contract.id}
                  onClick={() => {
                    setSelectedContractId(contract.id);
                    setSelectedCaId('');
                  }}
                  style={{
                    padding: '12px',
                    backgroundColor: isSelected ? 'var(--primary-light)' : '#fff',
                    border: `2px solid ${isSelected ? 'var(--primary)' : 'transparent'}`,
                    borderRadius: '10px',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 4px 8px rgba(59,130,246,0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  className="hover-lift"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ fontWeight: '800', fontSize: '13px', color: 'var(--text-main)' }}>
                      {cust?.name || '미상 고객'}
                    </div>
                    <span className="badge badge-warning" style={{ fontSize: '10px', padding: '2px 4px' }}>대기중</span>
                  </div>
                  
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Layers size={11} /> 장비: <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{reqText}</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Truck size={11} /> 출고: {contract.startDate}</div>
                  </div>

                  {/* 프로그레스 바 */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '3px', fontWeight: '600', color: 'var(--text-muted)' }}>
                      <span>진행률</span>
                      <span>{assignedCount}/{totalCount} 대</span>
                    </div>
                    <div style={{ height: '5px', backgroundColor: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${progress}%`, 
                        backgroundColor: progress === 100 ? 'var(--success)' : 'var(--primary)',
                        transition: 'width 0.3s ease'
                      }}></div>
                    </div>
                  </div>

                  {isSelected && (
                    <div style={{ position: 'absolute', bottom: '8px', right: '8px', color: 'var(--primary)' }}>
                      <CheckCircle size={16} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2단계: 선택된 계약의 장비 할당 상세 워크보드 */}
      {selectedContractId && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start', animation: 'fadeIn 0.3s ease' }}>
          
          {/* 2-A: 계약의 장비 슬롯 리스트 */}
          <div className="card" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ padding: '12px' }}>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                <ChevronDown size={14} /> 매핑 대상 슬롯 ({slots.length}대)
              </h3>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px' }}>
              {slots.map((ca, idx) => {
                const isAssigned = !!ca.assetId;
                const assignedAsset = isAssigned ? assets.find(a => a.id === ca.assetId) : null;
                const isSelectedCa = selectedCaId === ca.id;
                
                return (
                  <div 
                    key={ca.id}
                    onClick={() => { if (!isAssigned) setSelectedCaId(ca.id); }}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: `2px dashed ${isAssigned ? 'transparent' : (isSelectedCa ? 'var(--primary)' : '#cbd5e1')}`,
                      backgroundColor: isAssigned ? '#f0fdf4' : (isSelectedCa ? 'var(--primary-light)' : '#f8fafc'),
                      cursor: isAssigned ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ 
                        width: '22px', height: '22px', borderRadius: '50%', 
                        backgroundColor: isAssigned ? 'var(--success)' : (isSelectedCa ? 'var(--primary)' : '#cbd5e1'), 
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '11px' 
                      }}>
                        {isAssigned ? <Check size={12} /> : idx + 1}
                      </div>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '12px', color: isAssigned ? 'var(--success)' : 'var(--text-main)' }}>
                          {isAssigned ? `${assignedAsset?.assetNo} (${assignedAsset?.modelName})` : `[대기] ${ca.expectedModel || '미지정'}`}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {isAssigned ? '할당 완료됨' : '우측 목록에서 가용 장비를 선택해주세요.'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2-B: 가용 장비 선택 풀 */}
          <div className="card" style={{ height: '400px', display: 'flex', flexDirection: 'column', border: '2px solid var(--success-light)' }}>
            <div className="card-header" style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--success-light)' }}>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)', fontSize: '13px' }}>
                <CheckCircle size={14} /> 필터링된 가용 장비 ({availableAssets.length})
                {selectedCaId && (() => {
                  const sel = slots.find(ca => ca.id === selectedCaId);
                  return sel?.expectedModel ? <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', marginLeft: '4px' }}>— {sel.expectedModel} 전용</span> : null;
                })()}
                {!selectedCaId && selectedContractId && (() => {
                  const pendingSlots = slots.filter(ca => !ca.assetId);
                  const models = [...new Set(pendingSlots.map(ca => ca.expectedModel).filter(Boolean))];
                  return models.length > 0 ? <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', marginLeft: '4px' }}>— {models.join(', ')} 모델만</span> : null;
                })()}
              </h3>
              {canEdit && (
                <button 
                  className="btn-primary" 
                  onClick={handleAssign} 
                  disabled={!selectedCaId || !selectedAssetId} 
                  style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold', borderRadius: '6px' }}
                >
                  <Wrench size={12} /> 슬롯 연결
                </button>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', padding: '12px', alignContent: 'start' }}>
              {availableAssets.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  조건에 맞는 출고 가능 장비가 없습니다.
                </div>
              ) : (
                availableAssets.map(a => {
                  const isSelectedAsset = selectedAssetId === a.id;
                  const scoreInfo = getScoreBadgeColor(a.maintenanceScore);
                  
                  return (
                    <div 
                      key={a.id} 
                      onClick={() => setSelectedAssetId(a.id)}
                      style={{ 
                        padding: '12px 8px', 
                        border: `2px solid ${isSelectedAsset ? 'var(--success)' : 'var(--border-color)'}`, 
                        borderRadius: '8px', 
                        cursor: 'pointer', 
                        backgroundColor: isSelectedAsset ? '#ecfdf5' : '#fff',
                        textAlign: 'center',
                        transition: 'all 0.2s ease',
                        boxShadow: isSelectedAsset ? '0 4px 8px rgba(16, 185, 129, 0.15)' : 'none',
                        position: 'relative'
                      }}
                      className="hover-lift"
                    >
                      <div style={{ fontWeight: '800', fontSize: '13px', color: isSelectedAsset ? 'var(--success)' : 'var(--text-main)', marginBottom: '2px' }}>
                        {a.assetNo}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '6px' }}>
                        {a.modelName}
                      </div>
                      
                      {/* Maintenance Score Badge */}
                      <div style={{ 
                        display: 'inline-flex', alignItems: 'center', gap: '2px', 
                        backgroundColor: scoreInfo.bg, color: scoreInfo.color, border: `1px solid ${scoreInfo.border}`, 
                        padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold' 
                      }}>
                        <Activity size={10} /> 점수: {a.maintenanceScore || 0}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 글로벌 스타일 추가 (호버 이펙트 등) */}
      <style>{`
        .hover-lift:hover {
          transform: translateY(-2px);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

