// src/pages/outbound_inspections.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { OutboundInspection, OutboundInspectionStatus, Asset, Contract, Customer, CustomerSite } from '../services/db';
import { CheckSquare, AlertTriangle, ShieldCheck, Clock, CheckCircle, XCircle, Search, FileText, ChevronRight, UserCheck, Wrench } from 'lucide-react';
import { db } from '../services/db';

// 21대 고소작업대 표준 정비/스펙 체크리스트 항목
const INSPECTION_SPECS = [
  { id: 'spec1', label: '4면 철망 설치 확인' },
  { id: 'spec2', label: '확장대 철망 설치 확인' },
  { id: 'spec3', label: '확장대 옆면 철망 설치 확인' },
  { id: 'spec4', label: '원판 설치 상태 검수' },
  { id: 'spec5', label: '배터리 단자 풀림 확인 마킹' },
  { id: 'spec6', label: '배터리 단자 커버 설치' },
  { id: 'spec7', label: '트레이 내부 볼트류 풀림 마킹' },
  { id: 'spec8', label: '주행속도 세팅 (고속60/저속45)' },
  { id: 'spec9', label: '오버로드 세팅 검수' },
  { id: 'spec10', label: '조이스틱 커버 연장' },
  { id: 'spec11', label: '탑승구 사다리 보양' },
  { id: 'spec12', label: '모서리/전면부/미끄럼방지 보양' },
  { id: 'spec13', label: '소화기함/손잡이/안내스티커' },
  { id: 'spec14', label: '타이어 A급 상태 검수' },
  { id: 'spec15', label: '점멸등/비상하강/정지장치 청결' },
  { id: 'spec16', label: '작업높이 80% 세팅 확인' },
  { id: 'spec17', label: '작업구간 라인구분 (초록/빨강)' },
  { id: 'spec18', label: '하부상승제한/확장대50% 표식' },
  { id: 'spec19', label: '비상정지/꼬리표 부착' },
  { id: 'spec20', label: '협착위험 스티커 부착' },
  { id: 'spec21', label: '부착물 세트 (제원표/보험증권 등)' }
];

export const OutboundInspections: React.FC = () => {
  const { outboundInspections, contracts, contractAssets, assets, customers, sites, currentUser, refreshAllData, hasPermission, showErrorModal } = useApp();
  const canEdit = hasPermission('repair', 'save') || hasPermission('delivery', 'save') || hasPermission('contract', 'save');

  const [activeTabStatus, setActiveTabStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);

  // 체크리스트 개별 체크 state
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [inspectionNote, setInspectionNote] = useState<string>('');

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const filteredInspections = outboundInspections.filter(item => {
    if (activeTabStatus !== 'ALL' && item.status !== activeTabStatus) return false;
    if (!searchQuery) return true;
    
    const asset = assets.find(a => a.id === item.assetId);
    const contract = contracts.find(c => c.id === item.contractId);
    const customer = contract ? customers.find(c => c.id === contract.customerId) : null;
    const q = searchQuery.toLowerCase();
    
    return (
      (item.id && item.id.toLowerCase().includes(q)) ||
      (asset && (asset.assetNo.toLowerCase().includes(q) || asset.modelName.toLowerCase().includes(q))) ||
      (contract && contract.contractNo.toLowerCase().includes(q)) ||
      (customer && customer.name.toLowerCase().includes(q))
    );
  });

  const selectedItem = outboundInspections.find(i => i.id === selectedInspectionId);
  const selectedAsset = selectedItem ? assets.find(a => a.id === selectedItem.assetId) : null;
  const selectedContract = selectedItem ? contracts.find(c => c.id === selectedItem.contractId) : null;
  const selectedCustomer = selectedContract ? customers.find(c => c.id === selectedContract.customerId) : null;
  const selectedSite = selectedContract ? sites.find(s => s.id === selectedContract.siteId) : null;

  // 의뢰 선택 시 초기 체크리스트 상태 로드
  const handleSelectInspection = (item: OutboundInspection) => {
    setSelectedInspectionId(item.id);
    let specs: Record<string, boolean> = {};
    if (item.specsJson) {
      try { specs = JSON.parse(item.specsJson); } catch (e) {}
    } else {
      // 기본 전체 true 체크
      INSPECTION_SPECS.forEach(s => { specs[s.id] = true; });
    }
    setCheckedItems(specs);
    setInspectionNote(item.note || '');
  };

  const [isProcessing, setIsProcessing] = useState(false);

  // 접수 처리 (PENDING -> IN_PROGRESS)
  const handleAcceptInspection = async (item: OutboundInspection) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (isProcessing) return;

    setIsProcessing(true);
    try {
      db.updateRow<OutboundInspection>('outboundInspections', item.id, {
        status: 'IN_PROGRESS',
        inspectorId: currentUser?.id,
        updatedAt: new Date().toISOString()
      });
      await db.awaitPendingWrites();
      refreshAllData();
      alert(`의뢰(${item.id})가 성공적으로 접수 처리되었습니다.`);
    } catch (err: any) {
      showErrorModal(`⚠️ 접수 처리 실패:\n${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 검수 완료 승인 (IN_PROGRESS/PENDING -> COMPLETED)
  const handleCompleteInspection = async () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (isProcessing) return;
    if (!selectedItem || !selectedAsset) return;

    if (!confirm(`선택된 자산 [${selectedAsset.assetNo} - ${selectedAsset.modelName}]의 출고 전 정비/검수를 완료하고 최종 출고 승인하시겠습니까?\n\n(※ 자산 상태가 '출고대기'에서 '대여중'으로 최종 전환됩니다.)`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const nowIso = new Date().toISOString();
      // 1. 의뢰 상태 완료 업데이트
      db.updateRow<OutboundInspection>('outboundInspections', selectedItem.id, {
        status: 'COMPLETED',
        specsJson: JSON.stringify(checkedItems),
        inspectorId: currentUser?.id,
        inspectedAt: nowIso,
        note: inspectionNote,
        updatedAt: nowIso
      });

      // 2. 자산 상태: ASSIGNED -> RENTED 전환!
      db.updateRow<Asset>('assets', selectedAsset.id, {
        status: 'RENTED',
        updatedAt: nowIso
      });

      await db.awaitPendingWrites();
      refreshAllData();
      alert(`✅ 출고 검수 및 정비 마감이 완결되었습니다.\n자산 [${selectedAsset.assetNo}] 상태가 '대여중(RENTED)'으로 성공적으로 전환되었습니다.`);
      setSelectedInspectionId(null);
    } catch (err: any) {
      showErrorModal(`⚠️ 출고 검수 마감 실패:\n${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 반려 처리 (REJECTED)
  const handleConfirmReject = async () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (isProcessing) return;
    if (!selectedItem || !selectedAsset || !rejectReason.trim()) {
      alert('반려 사유를 입력해주세요.');
      return;
    }

    setIsProcessing(true);
    try {
      const nowIso = new Date().toISOString();
      // 1. 의뢰 상태 REJECTED 업데이트
      db.updateRow<OutboundInspection>('outboundInspections', selectedItem.id, {
        status: 'REJECTED',
        note: `[반려사유] ${rejectReason}`,
        inspectorId: currentUser?.id,
        inspectedAt: nowIso,
        updatedAt: nowIso
      });

      // 2. 자산 상태: ASSIGNED -> AVAILABLE 원복 (이중할당 해제)
      db.updateRow<Asset>('assets', selectedAsset.id, {
        status: 'AVAILABLE',
        currentCustomerId: undefined,
        currentSiteId: undefined,
        contractStart: undefined,
        contractEnd: undefined,
        updatedAt: nowIso
      });

      // 3. 계약 슬롯(contractAssets)의 assetId 비우기 (재할당 가능하도록)
      if (selectedItem.contractAssetId) {
        db.updateRow<any>('contractAssets', selectedItem.contractAssetId, {
          assetId: '',
          updatedAt: nowIso
        });
      }

      await db.awaitPendingWrites();
      refreshAllData();
      alert(`⚠️ 자산 [${selectedAsset.assetNo}] 출고 검수가 반려되었습니다.\n자산 상태가 '임대가능(AVAILABLE)'으로 원복되어 재할당이 가능합니다.`);
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedInspectionId(null);
    } catch (err: any) {
      showErrorModal(`⚠️ 반려 처리 실패:\n${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: OutboundInspectionStatus) => {
    switch (status) {
      case 'PENDING':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', backgroundColor: 'rgba(234,179,8,0.15)', color: '#ca8a04', border: '1px solid rgba(234,179,8,0.3)' }}>🟡 미접수 (PENDING)</span>;
      case 'IN_PROGRESS':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', backgroundColor: 'rgba(59,130,246,0.15)', color: '#2563eb', border: '1px solid rgba(59,130,246,0.3)' }}>🔵 접수/검수 중</span>;
      case 'COMPLETED':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', backgroundColor: 'rgba(34,197,94,0.15)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)' }}>🟢 검수 완료 승인</span>;
      case 'REJECTED':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', backgroundColor: 'rgba(239,68,68,0.15)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)' }}>🔴 불량/반려</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
      
      {/* 헤더 타이틀 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontWeight: '800', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.5px' }}>
            <CheckSquare size={20} color="var(--primary)" /> 출고 전 장비 정비 및 21대 스펙 검수 의뢰 관리
          </h2>
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            계약에 할당 완료된 <strong>출고대기(ASSIGNED)</strong> 장비들의 출고 전 21가지 필수 기술/정비 스펙을 검수하고 최종 출고 승인을 진행합니다.
          </p>
        </div>
      </div>

      {/* 상태별 탭 네비게이션 */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        {[
          { key: 'ALL', label: '전체 보기', count: outboundInspections.length },
          { key: 'PENDING', label: '🟡 미접수 대기', count: outboundInspections.filter(i => i.status === 'PENDING').length },
          { key: 'IN_PROGRESS', label: '🔵 접수/검수 중', count: outboundInspections.filter(i => i.status === 'IN_PROGRESS').length },
          { key: 'COMPLETED', label: '🟢 검수 완료 승인', count: outboundInspections.filter(i => i.status === 'COMPLETED').length },
          { key: 'REJECTED', label: '🔴 불량/반려', count: outboundInspections.filter(i => i.status === 'REJECTED').length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTabStatus(tab.key)}
            style={{
              padding: '6px 12px', fontSize: '12.5px', fontWeight: '700', borderRadius: '6px', cursor: 'pointer',
              border: activeTabStatus === tab.key ? '1px solid var(--primary)' : '1px solid var(--border-color)',
              backgroundColor: activeTabStatus === tab.key ? 'rgba(59,130,246,0.1)' : 'var(--bg-card)',
              color: activeTabStatus === tab.key ? 'var(--primary)' : 'var(--text-secondary)'
            }}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* 메인 2열 그리드 layout (왼쪽 의뢰 목록 + 오른쪽 21대 스펙 검수 워크시트) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '16px', alignItems: 'start' }}>
        
        {/* [왼쪽] 의뢰 리스트 카드 */}
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={15} /> 검수 의뢰 목록 ({filteredInspections.length}건)
            </h3>
            <div style={{ position: 'relative', width: '180px' }}>
              <input
                type="text"
                placeholder="장비/고객/계약 검색"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '4px 8px 4px 26px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
              />
              <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '550px', overflowY: 'auto' }}>
            {filteredInspections.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                조건에 일치하는 출고 검수 의뢰건이 없습니다.
              </div>
            ) : (
              filteredInspections.map(item => {
                const asset = assets.find(a => a.id === item.assetId);
                const contract = contracts.find(c => c.id === item.contractId);
                const customer = contract ? customers.find(c => c.id === contract.customerId) : null;
                const isSelected = item.id === selectedInspectionId;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectInspection(item)}
                    style={{
                      padding: '12px 14px', borderRadius: '8px', cursor: 'pointer',
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      backgroundColor: isSelected ? 'rgba(59,130,246,0.05)' : 'var(--bg-card)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)' }}>{item.id}</span>
                      {getStatusBadge(item.status)}
                    </div>

                    <div style={{ fontWeight: '800', fontSize: '13.5px', marginBottom: '4px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Wrench size={14} className="text-primary" />
                      <span>{asset ? `${asset.assetNo} (${asset.modelName})` : '장비 미상'}</span>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div>🏢 <strong>고객사:</strong> {customer?.name || '고객 미상'}</div>
                      <div>📄 <strong>계약번호:</strong> {contract?.contractNo || '-'} (신청일: {item.createdAt.substring(0, 10)})</div>
                    </div>

                    {/* 미접수 상태 시 바로 접수 버튼 노출 */}
                    {item.status === 'PENDING' && canEdit && (
                      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          className="btn-primary"
                          onClick={(e) => { e.stopPropagation(); handleAcceptInspection(item); }}
                          style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 'bold' }}
                        >
                          ▶ 작업 접수
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* [오른쪽] 선택된 의뢰의 21대 정비 스펙 검수 워크시트 */}
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: 'var(--bg-card)' }}>
          {!selectedItem ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <CheckSquare size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>좌측에서 출고 검수 의뢰건을 선택해주세요.</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>21대 기술/정비 요구사항을 체크하고 최종 출고를 승인할 수 있습니다.</div>
            </div>
          ) : (
            <>
              {/* 상세 상단 가이던스 헤더 */}
              <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: 'var(--primary)' }}>
                    ⚙️ 출고 전 정비 & 21대 기술 스펙 검수서
                  </h3>
                  {getStatusBadge(selectedItem.status)}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                  <div><strong>관리번호:</strong> <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{selectedAsset?.assetNo}</span></div>
                  <div><strong>장비모델:</strong> {selectedAsset?.modelName}</div>
                  <div><strong>고객사:</strong> {selectedCustomer?.name || '미상'}</div>
                  <div><strong>현장:</strong> {selectedSite?.name || '미상'}</div>
                </div>
              </div>

              {/* 21대 스펙 체크리스트 영역 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={14} color="var(--success)" /> 출고 필수 21대 정비 스펙 검수 항목
                  </h4>
                  {canEdit && selectedItem.status !== 'COMPLETED' && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          const all: Record<string, boolean> = {};
                          INSPECTION_SPECS.forEach(s => { all[s.id] = true; });
                          setCheckedItems(all);
                        }}
                        style={{ padding: '2px 6px', fontSize: '11px' }}
                      >
                        전체체크
                      </button>
                    </div>
                  )}
                </div>

                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px',
                  maxHeight: '320px', overflowY: 'auto', padding: '8px',
                  backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)'
                }}>
                  {INSPECTION_SPECS.map((spec, idx) => (
                    <label
                      key={spec.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '4px 6px',
                        borderRadius: '4px', backgroundColor: checkedItems[spec.id] ? 'rgba(34,197,94,0.08)' : 'transparent',
                        cursor: canEdit && selectedItem.status !== 'COMPLETED' ? 'pointer' : 'default'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checkedItems[spec.id] ?? true}
                        onChange={e => {
                          if (!canEdit || selectedItem.status === 'COMPLETED') return;
                          setCheckedItems(prev => ({ ...prev, [spec.id]: e.target.checked }));
                        }}
                        disabled={!canEdit || selectedItem.status === 'COMPLETED'}
                        style={{ accentColor: 'var(--success)' }}
                      />
                      <span><strong>{idx + 1}.</strong> {spec.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 검수 특기사항 및 최종 승인 하단 조치 바 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>📝 특기사항 / 작업 메모</label>
                <input
                  type="text"
                  value={inspectionNote}
                  onChange={e => setInspectionNote(e.target.value)}
                  placeholder="예: 배터리 단자 정비 완료, 4면 망 완비 완료"
                  disabled={!canEdit || selectedItem.status === 'COMPLETED'}
                  style={{ width: '100%', padding: '6px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                />

                {canEdit && selectedItem.status !== 'COMPLETED' && (
                  <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                    <button
                      className="btn-primary"
                      onClick={handleCompleteInspection}
                      disabled={isProcessing}
                      style={{ flex: 1, padding: '10px', fontWeight: '800', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <CheckCircle size={16} /> {isProcessing ? '처리 중...' : '최종 출고 승인 (대여중 전환)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRejectModal(true)}
                      disabled={isProcessing}
                      style={{ padding: '10px 14px', backgroundColor: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '12.5px', cursor: 'pointer' }}
                    >
                      🚫 반려 처리
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

      </div>

      {/* 반려 사유 입력 모달 */}
      {showRejectModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '400px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: 'var(--bg-card)' }}>
            <h3 style={{ margin: 0, color: 'var(--danger)', fontSize: '15px', fontWeight: '800' }}>🚫 출고 검수 반려 및 불량 처리</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              반려 처리 시 자산 상태가 <strong>'임대가능(AVAILABLE)'</strong>으로 원복되어 재할당이 진행됩니다.
            </p>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>반려 및 불량 사유 입력</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="예: 배터리 방전 심함, 유압 호스 누유 발각되어 재정비 필요"
                rows={3}
                style={{ width: '100%', padding: '8px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn-secondary" onClick={() => setShowRejectModal(false)}>취소</button>
              <button className="btn-primary" onClick={handleConfirmReject} style={{ backgroundColor: 'var(--danger)' }}>반려 확정</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
