// src/pages/asset_assignment.tsx
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Wrench, CheckCircle, PackageSearch, Layers, Truck, ChevronDown, Check, Activity, Search, AlertTriangle, CheckSquare, Square, Zap, X } from 'lucide-react';

export const AssetAssignment: React.FC = () => {
  const { hasPermission, contractAssets, contracts, customers, assets, assignAssetToContract, contractHistory } = useApp();
  
  const [selectedContractId, setSelectedContractId] = useState<string>('');
  
  // 멀티 슬롯 선택 (ContractAsset ID 배열)
  const [selectedCaIds, setSelectedCaIds] = useState<string[]>([]);
  // 멀티 장비 선택 (Asset ID 배열)
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  
  // 검색 및 직접 입력 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [quickInputText, setQuickInputText] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const canEdit = hasPermission('dispatch_assign', 'save');
  const canView = hasPermission('dispatch_assign', 'view');

  if (!canView && !canEdit) {
    return <div style={{ padding: '16px', fontSize: '13px' }}>이 메뉴에 접근할 권한이 없습니다. (dispatch_assign)</div>;
  }

  // 대차 교체 의뢰 접수 건 (EXCHANGE 이력 기반)
  const exchangeRequests = (contractHistory || []).filter(h => h.changeType === 'EXCHANGE');
  const exchangeContractIds = Array.from(new Set(exchangeRequests.map(h => h.contractId)));
  const exchangePendingContracts = contracts.filter(c =>
    exchangeContractIds.includes(c.id) &&
    contractAssets.some(ca => ca.contractId === c.id && !ca.assetId)
  );

  // 일반 미할당 계약 목록
  const pendingCaList = contractAssets.filter(ca => !ca.assetId);
  const pendingContractIds = Array.from(new Set(pendingCaList.map(ca => ca.contractId)));
  const pendingContracts = contracts.filter(c => pendingContractIds.includes(c.id) && !exchangeContractIds.includes(c.id));

  // 선택된 계약의 하위 슬롯들 (미할당 + 기할당)
  const currentSlots = useMemo(() => {
    return selectedContractId ? contractAssets.filter(ca => ca.contractId === selectedContractId) : [];
  }, [contractAssets, selectedContractId]);

  // 모델별 그룹핑 집계
  const modelGroups = useMemo(() => {
    const map = new Map<string, { modelName: string; total: number; pending: number; caIds: string[] }>();
    currentSlots.forEach(ca => {
      const model = ca.expectedModel || '미지정';
      const existing = map.get(model) || { modelName: model, total: 0, pending: 0, caIds: [] };
      existing.total += 1;
      if (!ca.assetId) {
        existing.pending += 1;
        existing.caIds.push(ca.id);
      }
      map.set(model, existing);
    });
    return Array.from(map.values());
  }, [currentSlots]);

  // 축약어 지원 유사 모델 매칭 헬퍼
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

  // 가용 장비 풀 필터링
  const availableAssets = useMemo(() => {
    let list = assets.filter(a => a.status === 'AVAILABLE');

    // 선택된 슬롯들의 요구 모델 기준 필터링
    if (selectedCaIds.length > 0) {
      const selectedSlots = currentSlots.filter(ca => selectedCaIds.includes(ca.id));
      const reqModels = Array.from(new Set(selectedSlots.map(ca => ca.expectedModel).filter(Boolean)));
      if (reqModels.length > 0) {
        list = list.filter(a => reqModels.some(req => isModelMatch(a.modelName, req!)));
      }
    } else if (selectedContractId) {
      const pendingSlots = currentSlots.filter(ca => !ca.assetId);
      const reqModels = Array.from(new Set(pendingSlots.map(ca => ca.expectedModel).filter(Boolean)));
      if (reqModels.length > 0) {
        list = list.filter(a => reqModels.some(req => isModelMatch(a.modelName, req!)));
      }
    }

    // 검색어 필터링
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(a =>
        (a.assetNo && a.assetNo.toLowerCase().includes(q)) ||
        (a.serialNo && a.serialNo.toLowerCase().includes(q)) ||
        (a.modelName && a.modelName.toLowerCase().includes(q))
      );
    }

    // 정비 점수 기준 오름차순 정렬 (0에 가까울수록 최상)
    list.sort((a, b) => (a.maintenanceScore || 0) - (b.maintenanceScore || 0));

    return list;
  }, [assets, selectedCaIds, currentSlots, selectedContractId, searchQuery]);

  // 점수 뱃지 스타일
  const getScoreBadgeColor = (score: number = 0) => {
    if (score === 0) return { bg: 'var(--success-light)', color: 'var(--success)', border: 'var(--success)' };
    if (score <= 20) return { bg: 'var(--warning-light)', color: 'var(--warning)', border: 'var(--warning)' };
    return { bg: 'var(--danger-light)', color: 'var(--danger)', border: 'var(--danger)' };
  };

  // 슬롯 전체 선택/해제
  const handleSelectAllPendingSlots = () => {
    const pendingIds = currentSlots.filter(ca => !ca.assetId).map(ca => ca.id);
    if (selectedCaIds.length === pendingIds.length) {
      setSelectedCaIds([]);
    } else {
      setSelectedCaIds(pendingIds);
    }
  };

  // 특정 모델 그룹 슬롯 일괄 선택
  const handleSelectModelGroupSlots = (caIds: string[]) => {
    const allSelected = caIds.every(id => selectedCaIds.includes(id));
    if (allSelected) {
      setSelectedCaIds(selectedCaIds.filter(id => !caIds.includes(id)));
    } else {
      const combined = Array.from(new Set([...selectedCaIds, ...caIds]));
      setSelectedCaIds(combined);
    }
  };

  // 개별 슬롯 토글
  const handleToggleSlot = (caId: string) => {
    if (selectedCaIds.includes(caId)) {
      setSelectedCaIds(selectedCaIds.filter(id => id !== caId));
    } else {
      setSelectedCaIds([...selectedCaIds, caId]);
    }
  };

  // 개별 장비 선택 토글
  const handleToggleAsset = (assetId: string) => {
    if (selectedAssetIds.includes(assetId)) {
      setSelectedAssetIds(selectedAssetIds.filter(id => id !== assetId));
    } else {
      setSelectedAssetIds([...selectedAssetIds, assetId]);
    }
  };

  // 🚀 스마트 자동 추천 선택 (선택된 슬롯 개수만큼 상위 장비 자동 체크)
  const handleAutoSelectTopAssets = () => {
    const needCount = selectedCaIds.length > 0 ? selectedCaIds.length : currentSlots.filter(ca => !ca.assetId).length;
    if (needCount <= 0) {
      alert('할당할 대상 슬롯을 먼저 선택해 주세요.');
      return;
    }
    const topAssetIds = availableAssets.slice(0, needCount).map(a => a.id);
    setSelectedAssetIds(topAssetIds);
  };

  // ⌨️ 관리번호 빠른 입력 처리 (쉼표, 공백, 엔터 분리 다중 매칭)
  const handleQuickInputSubmit = () => {
    if (!quickInputText.trim()) return;

    const tokens = quickInputText
      .split(/[\s,]+/)
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);

    const matchedAssetIds: string[] = [];

    tokens.forEach(token => {
      // 1순위: 관리번호 일치 (전체 또는 뒷자리 부분 일치)
      const found = assets.find(a =>
        a.status === 'AVAILABLE' &&
        (
          (a.assetNo && a.assetNo.toLowerCase() === token) ||
          (a.assetNo && a.assetNo.toLowerCase().endsWith(token)) ||
          (a.serialNo && a.serialNo.toLowerCase().includes(token))
        ) &&
        !matchedAssetIds.includes(a.id)
      );

      if (found) {
        matchedAssetIds.push(found.id);
      }
    });

    if (matchedAssetIds.length > 0) {
      const combined = Array.from(new Set([...selectedAssetIds, ...matchedAssetIds]));
      setSelectedAssetIds(combined);
      setQuickInputText('');
    } else {
      alert(`입력하신 번호(${tokens.join(', ')})와 일치하는 가용 장비를 찾을 수 없습니다.`);
    }
  };

  // ⚡ 다중 선택 일괄 할당 실행
  const handleBatchAssign = async () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (isAssigning) return;

    if (!canEdit) {
      alert('장비 할당 권한이 없습니다.');
      return;
    }

    if (selectedCaIds.length === 0 || selectedAssetIds.length === 0) {
      alert('할당할 슬롯과 장비를 모두 선택해 주세요.');
      return;
    }

    if (selectedCaIds.length !== selectedAssetIds.length) {
      alert(`⚠️ 선택된 수량이 일치하지 않습니다.\n\n• 선택된 슬롯: ${selectedCaIds.length}개\n• 선택된 장비: ${selectedAssetIds.length}대\n\n수량을 동일하게 맞추어 주세요.`);
      return;
    }

    if (!confirm(`선택된 ${selectedCaIds.length}대의 장비를 계약 슬롯에 일괄 할당하시겠습니까?`)) {
      return;
    }

    setIsAssigning(true);
    try {
      // 1:1 순서대로 일괄 할당 트랜잭션 실행
      for (let i = 0; i < selectedCaIds.length; i++) {
        const caId = selectedCaIds[i];
        const aId = selectedAssetIds[i];
        await assignAssetToContract(caId, aId);
      }

      alert(`✅ 총 ${selectedCaIds.length}대 장비 일괄 할당 완료!\n자산 상태가 [출고대기(ASSIGNED)]로 즉시 전환되고 출고 검수 의뢰가 발행되었습니다.`);
      setSelectedCaIds([]);
      setSelectedAssetIds([]);
    } catch (err: any) {
      console.error('일괄 할당 실패:', err);
      alert(`⚠️ 장비 할당 실패: ${err?.message || err}`);
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
      
      {/* 타이틀 및 설명 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontWeight: '800', marginBottom: '4px', fontSize: '18px', letterSpacing: '-0.5px' }}>장비 할당</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            계약의 모델명 × 수량별 요구 슬롯에 가용 장비를 다중 선택 및 관리번호 빠른 입력으로 일괄 매핑합니다.
          </p>
        </div>
      </div>

      {/* 📊 현황 요약 바 */}
      {(() => {
        const totalPendingSlots = contractAssets.filter(ca => !ca.assetId).length;
        const totalAvailableAssets = assets.filter(a => a.status === 'AVAILABLE').length;
        const exchangeSlots = exchangePendingContracts.reduce((sum, c) => sum + contractAssets.filter(ca => ca.contractId === c.id && !ca.assetId).length, 0);

        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>총 미할당 슬롯</span>
              <strong style={{ fontSize: '15px', color: totalPendingSlots > 0 ? '#d97706' : 'var(--text-muted)' }}>{totalPendingSlots}대</strong>
            </div>
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>대차 우선 할당 대기</span>
              <strong style={{ fontSize: '15px', color: exchangeSlots > 0 ? '#c2410c' : 'var(--text-muted)' }}>{exchangeSlots}대</strong>
            </div>
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>가용 장비 (임대가능)</span>
              <strong style={{ fontSize: '15px', color: 'var(--success)' }}>{totalAvailableAssets}대</strong>
            </div>
          </div>
        );
      })()}

      {/* 대차 교체 출고할당 대기 (최우선 표출) */}
      {exchangePendingContracts.length > 0 && (
        <div style={{ backgroundColor: 'var(--warning-light)', padding: '14px', borderRadius: '10px', border: '2px solid var(--warning)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: '#c2410c' }}>
            <AlertTriangle size={14} /> 대차 교체 출고할당 대기 ({exchangePendingContracts.length}건)
            <span style={{ fontSize: '11px', fontWeight: '500', color: '#9a3412', marginLeft: '4px' }}>— 영업사원 대차 의뢰 접수 건</span>
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
            {exchangePendingContracts.map(contract => {
              const cust = customers.find(c => c.id === contract.customerId);
              const cas = contractAssets.filter(ca => ca.contractId === contract.id);
              const isSelected = selectedContractId === contract.id;
              const excHistory = exchangeRequests.find(h => h.contractId === contract.id);
              return (
                <div
                  key={contract.id}
                  onClick={() => { setSelectedContractId(contract.id); setSelectedCaIds([]); setSelectedAssetIds([]); }}
                  style={{
                    padding: '12px', backgroundColor: isSelected ? 'var(--warning-light)' : 'var(--bg-card)',
                    border: `2px solid ${isSelected ? 'var(--warning)' : 'var(--border-color)'}`, borderRadius: '10px',
                    cursor: 'pointer', transition: 'all 0.2s ease'
                  }}
                  className="hover-lift"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div style={{ fontWeight: '800', fontSize: '13px' }}>{cust?.name || '미상 고객'}</div>
                    <span style={{ fontSize: '10px', fontWeight: '700', backgroundColor: '#f97316', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>대차할당대기</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#7c2d12', marginBottom: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div>계약번호: <strong>{contract.contractNo}</strong></div>
                    <div>요구 모델: <strong>{cas.map(ca => ca.expectedModel || '미지정').join(', ')}</strong></div>
                    <div style={{ fontSize: '10px', color: '#9a3412', marginTop: '2px' }}>사유: {excHistory?.description?.substring(excHistory.description.indexOf('사유:') + 3, excHistory.description.indexOf('사유:') + 30) || '대차 요청'}</div>
                  </div>
                  {isSelected && <div style={{ color: '#f97316', fontWeight: '700', fontSize: '11px' }}>▶ 할당 진행 중</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 1단계: 출고 대기 계약(기안) 카드 바둑판 뷰 */}
      <div style={{ backgroundColor: 'var(--bg-card)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <PackageSearch size={14} color="var(--primary)" /> 출고 대기 요청 건 ({pendingContracts.length}건)
        </h3>
        
        {pendingContracts.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>대기 중인 출고 요청이 없습니다.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
            {pendingContracts.map(contract => {
              const cust = customers.find(c => c.id === contract.customerId);
              const cas = contractAssets.filter(ca => ca.contractId === contract.id);
              const totalCount = cas.length;
              const assignedCount = cas.filter(ca => ca.assetId).length;
              const isSelected = selectedContractId === contract.id;
              const progress = totalCount > 0 ? Math.round((assignedCount / totalCount) * 100) : 0;

              // 모델별 × 수량 문자열 집계
              const reqSummary = cas.reduce((acc, curr) => {
                const model = curr.expectedModel || '미지정';
                acc[model] = (acc[model] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);
              const reqText = Object.entries(reqSummary).map(([k, v]) => `${k} × ${v}대`).join(', ');

              return (
                <div 
                  key={contract.id}
                  onClick={() => {
                    setSelectedContractId(contract.id);
                    setSelectedCaIds([]);
                    setSelectedAssetIds([]);
                  }}
                  style={{
                    padding: '12px',
                    backgroundColor: isSelected ? 'var(--primary-light)' : 'var(--bg-app)',
                    border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}`,
                    borderRadius: '10px',
                    cursor: 'pointer',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Layers size={11} /> 요구: <strong style={{ color: 'var(--primary)' }}>{reqText}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Truck size={11} /> 출고예정: {contract.startDate}
                    </div>
                  </div>

                  {/* 프로그레스 바 */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '3px', fontWeight: '600', color: 'var(--text-muted)' }}>
                      <span>진행률</span>
                      <span>{assignedCount}/{totalCount} 대</span>
                    </div>
                    <div style={{ height: '5px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
          
          {/* 2-A: 매핑 대상 슬롯 (모델별 × 수량 그룹 & 개별 슬롯 멀티셀렉트) */}
          <div className="card" style={{ height: '540px', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            
            {/* 슬롯 헤더 */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-app)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ChevronDown size={14} /> 매핑 대상 슬롯 ({currentSlots.length}대)
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  선택됨: <strong style={{ color: 'var(--primary)' }}>{selectedCaIds.length}개</strong> / 미할당: {currentSlots.filter(c => !c.assetId).length}개
                </span>
              </div>
              <button
                type="button"
                onClick={handleSelectAllPendingSlots}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {selectedCaIds.length === currentSlots.filter(c => !c.assetId).length && selectedCaIds.length > 0 ? (
                  <><CheckSquare size={12} color="var(--primary)" /> 전체 해제</>
                ) : (
                  <><Square size={12} /> 미할당 전체 선택</>
                )}
              </button>
            </div>

            {/* 모델별 요약 칩 바 */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {modelGroups.map(grp => {
                const isAllSelected = grp.caIds.length > 0 && grp.caIds.every(id => selectedCaIds.includes(id));
                return (
                  <button
                    key={grp.modelName}
                    type="button"
                    onClick={() => handleSelectModelGroupSlots(grp.caIds)}
                    disabled={grp.pending === 0}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: `1.5px solid ${isAllSelected ? 'var(--primary)' : 'var(--border-color)'}`,
                      backgroundColor: isAllSelected ? 'var(--primary-light)' : 'var(--bg-app)',
                      color: isAllSelected ? 'var(--primary)' : 'var(--text-main)',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: grp.pending === 0 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      opacity: grp.pending === 0 ? 0.5 : 1
                    }}
                  >
                    <span>{grp.modelName} × {grp.total}대</span>
                    <span style={{ fontSize: '10px', color: grp.pending > 0 ? '#d97706' : 'var(--success)' }}>
                      (미할당 {grp.pending})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 슬롯 리스트 */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px' }}>
              {currentSlots.map((ca, idx) => {
                const isAssigned = !!ca.assetId;
                const assignedAsset = isAssigned ? assets.find(a => a.id === ca.assetId) : null;
                const isSelected = selectedCaIds.includes(ca.id);
                
                return (
                  <div 
                    key={ca.id}
                    onClick={() => { if (!isAssigned) handleToggleSlot(ca.id); }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: `1.5px solid ${isAssigned ? 'var(--border-color)' : (isSelected ? 'var(--primary)' : 'var(--border-color)')}`,
                      backgroundColor: isAssigned ? 'var(--bg-app)' : (isSelected ? 'var(--primary-light)' : 'var(--bg-card)'),
                      cursor: isAssigned ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '4px',
                        backgroundColor: isAssigned ? 'var(--success)' : (isSelected ? 'var(--primary)' : 'var(--bg-app)'),
                        border: `1px solid ${isAssigned ? 'var(--success)' : (isSelected ? 'var(--primary)' : 'var(--border-color)')}`,
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '10px'
                      }}>
                        {isAssigned ? <Check size={12} /> : (isSelected ? <Check size={12} /> : idx + 1)}
                      </div>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '12px', color: isAssigned ? 'var(--success)' : 'var(--text-main)' }}>
                          {isAssigned ? `${assignedAsset?.assetNo} (${assignedAsset?.modelName})` : `[대기] ${ca.expectedModel || '미지정'}`}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {isAssigned ? `S/N: ${assignedAsset?.serialNo || '미기재'}` : '가용 장비를 선택하여 할당하세요.'}
                        </div>
                      </div>
                    </div>

                    {!isAssigned && (
                      <span style={{ fontSize: '11px', fontWeight: 600, color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }}>
                        {isSelected ? '선택됨' : '선택'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2-B: 가용 장비 선택 풀 (멀티셀렉트 & 관리번호 빠른 입력) */}
          <div className="card" style={{ height: '540px', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-card)', border: '2px solid var(--success-light)' }}>
            
            {/* 가용 장비 헤더 & 일괄 할당 버튼 */}
            <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--success-light)', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)' }}>
                  <CheckCircle size={14} /> 필터링된 임대가능 장비 ({availableAssets.length}대)
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  선택됨: <strong style={{ color: 'var(--success)' }}>{selectedAssetIds.length}대</strong> / 필요 슬롯: {selectedCaIds.length}개
                </span>
              </div>

              {canEdit && (
                <button 
                  type="button"
                  className="btn-primary" 
                  onClick={handleBatchAssign} 
                  disabled={selectedCaIds.length === 0 || selectedAssetIds.length === 0 || selectedCaIds.length !== selectedAssetIds.length || isAssigning} 
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 'bold',
                    borderRadius: '6px',
                    backgroundColor: selectedCaIds.length > 0 && selectedCaIds.length === selectedAssetIds.length ? 'var(--primary)' : 'var(--border-color)',
                    color: '#ffffff',
                    cursor: selectedCaIds.length > 0 && selectedCaIds.length === selectedAssetIds.length ? 'pointer' : 'not-allowed'
                  }}
                >
                  <Wrench size={13} />
                  {isAssigning ? '일괄 할당 중...' : `선택 장비 일괄 할당 (${selectedAssetIds.length}대)`}
                </button>
              )}
            </div>

            {/* ⌨️ 관리번호 빠른 입력 바 (실무자 요구: 쉼표/엔터 다중 연속 입력) */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                관리번호 빠른 입력 (쉼표 또는 엔터로 다중 연속 입력)
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  placeholder="예: K10437, K10438, 10439 (번호 입력 후 엔터)"
                  value={quickInputText}
                  onChange={e => setQuickInputText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleQuickInputSubmit(); }}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)'
                  }}
                />
                <button
                  type="button"
                  onClick={handleQuickInputSubmit}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  추가
                </button>
                <button
                  type="button"
                  onClick={handleAutoSelectTopAssets}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '4px',
                    border: '1px solid var(--success)',
                    backgroundColor: 'var(--success-light)',
                    color: 'var(--success)',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="슬롯 수량만큼 최상위 정비점수 장비 자동 선택"
                >
                  <Zap size={13} />
                  추천순 자동선택
                </button>
              </div>
            </div>

            {/* 🔍 검색 필터 바 */}
            <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Search size={13} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="목록 내 검색 (관리번호, 모델명, S/N...)"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                  fontSize: '11.5px',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-main)'
                }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <X size={13} />
                </button>
              )}
            </div>

            {/* 가용 장비 그리드 (멀티 셀렉트) */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', padding: '12px', alignContent: 'start' }}>
              {availableAssets.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  조건에 맞는 출고 가능 장비가 없습니다.
                </div>
              ) : (
                availableAssets.map(a => {
                  const isSelected = selectedAssetIds.includes(a.id);
                  const selectOrder = selectedAssetIds.indexOf(a.id) + 1;
                  const scoreInfo = getScoreBadgeColor(a.maintenanceScore);
                  
                  return (
                    <div 
                      key={a.id} 
                      onClick={() => handleToggleAsset(a.id)}
                      style={{ 
                        padding: '10px 8px', 
                        border: `2px solid ${isSelected ? 'var(--success)' : 'var(--border-color)'}`, 
                        borderRadius: '8px', 
                        cursor: 'pointer', 
                        backgroundColor: isSelected ? 'var(--success-light)' : 'var(--bg-card)',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                        position: 'relative'
                      }}
                      className="hover-lift"
                    >
                      {/* 선택 순서 배지 */}
                      {isSelected && (
                        <div style={{
                          position: 'absolute', top: '4px', right: '4px',
                          width: '18px', height: '18px', borderRadius: '50%',
                          backgroundColor: 'var(--success)', color: '#ffffff',
                          fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {selectOrder}
                        </div>
                      )}

                      <div style={{ fontWeight: '800', fontSize: '13px', color: isSelected ? 'var(--success)' : 'var(--text-main)', marginBottom: '2px' }}>
                        {a.assetNo}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '6px' }}>
                        {a.modelName}
                      </div>
                      
                      {/* 정비 점수 배지 */}
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

      <style>{`
        .hover-lift:hover {
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
};
