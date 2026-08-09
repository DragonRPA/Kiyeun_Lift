// src/pages/smart_return.tsx
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Zap, Clipboard, FileText, Check, Search, ArrowUpDown, Shield, AlertTriangle } from 'lucide-react';
import { SmartReturnData } from '../context/AppContext';

export const SmartReturn: React.FC = () => {
  const { hasPermission, saveSmartReturn, contracts, customers, sites, contacts, deliveries, contractAssets, assets, repairs, vendors } = useApp();
  const canSave = hasPermission('delivery', 'save');

  // 모드 상태: 'SALES' (영업사원 - Case 1,2,3) | 'MAINTENANCE' (정비직원 - Case 4)
  const [activeMode, setActiveMode] = useState<'SALES' | 'MAINTENANCE'>('SALES');

  const getTodayString = () => new Date().toISOString().split('T')[0];

  // ==========================================
  // [1] 영업사원 모드 (SALES) 상태
  // ==========================================
  const [salesSearch, setSalesSearch] = useState('');
  const [salesSortBy, setSalesSortBy] = useState<'END_DATE' | 'CUSTOMER_NAME' | 'SITE_NAME'>('END_DATE');
  const [salesSortDesc, setSalesSortDesc] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [returnDate, setReturnDate] = useState(getTodayString()); // 오늘 날짜 기본 제공
  const [loadingTime, setLoadingTime] = useState('오전');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [note, setNote] = useState('');

  // 💡 [사장님 지시] 계약 선택 시 최초 출고/현장에 등록되었던 담당자 정보 자동 기본값 세팅 (수정 가능)
  useEffect(() => {
    if (!selectedContractId) return;
    const contract = contracts.find(c => c.id === selectedContractId);
    if (!contract) return;

    const outboundDelivery = (deliveries || []).find((d: any) => d.contractId === selectedContractId);
    const site = (sites || []).find((s: any) => s.id === contract.siteId);
    const contact = (contacts || []).find((ct: any) => ct.id === contract.contactId);

    const defaultContactName = (outboundDelivery as any)?.siteContactName || (outboundDelivery as any)?.recipientName || contact?.name || site?.contactName || '';
    const defaultContactPhone = (outboundDelivery as any)?.siteContactPhone || (outboundDelivery as any)?.recipientPhone || contact?.contact || site?.contact || '';

    if (defaultContactName) setContactName(defaultContactName);
    if (defaultContactPhone) setContactPhone(defaultContactPhone);
  }, [selectedContractId, contracts, deliveries, sites, contacts]);

  // 메신저 텍스트 오더 입력 및 파싱용 상태
  const [rawText, setRawText] = useState<string>(
`* 회수 요청 *

고객명 : 현대건설(주)
현장명 : 삼성동 현장
회수일 : 2026-07-25
회수 장비번호 : RENT-0001, RENT-0002

특이사항 : 현장 종료로 인한 장비 조기 반납 및 회수 처리 요청.`
  );
  const [showParser, setShowParser] = useState(false);

  // ==========================================
  // [2] 정비직원 모드 (MAINTENANCE) 상태
  // ==========================================
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [selectedRepairIds, setSelectedRepairIds] = useState<string[]>([]);
  const [maintReturnDate, setMaintReturnDate] = useState(getTodayString()); // 오늘 날짜 기본 제공
  const [maintLoadingTime, setMaintLoadingTime] = useState('오전');
  const [maintNote, setMaintNote] = useState('');

  // ==========================================
  // [3] 공통 및 파서 로직
  // ==========================================
  const handleParseText = () => {
    const lines = rawText.split('\n');
    let parsedCust = '';
    let parsedSite = '';
    let parsedDate = '';
    let parsedAssets: string[] = [];
    let parsedMemo = '';

    lines.forEach(line => {
      const clean = line.trim();
      if (clean.includes('고객명') || clean.includes('고객')) {
        parsedCust = clean.split(':')[1]?.trim() || '';
      } else if (clean.includes('현장명') || clean.includes('현장')) {
        parsedSite = clean.split(':')[1]?.trim() || '';
      } else if (clean.includes('회수일') || clean.includes('상차시간') || clean.includes('스케줄')) {
        const val = clean.split(':')[1]?.trim() || '';
        const dateMatch = val.match(/\d{4}-\d{2}-\d{2}/);
        if (dateMatch) {
          parsedDate = dateMatch[0];
        } else {
          parsedDate = val;
        }
      } else if (clean.includes('장비번호') || clean.includes('관리번호') || clean.includes('장비')) {
        const val = clean.split(':')[1]?.trim() || '';
        parsedAssets = val.split(',').map(v => v.trim()).filter(Boolean);
      } else if (clean.includes('특이사항') || clean.includes('비고') || clean.includes('메모')) {
        parsedMemo = clean.split(':')[1]?.trim() || '';
      }
    });

    // 고객/현장 계약 매칭
    const customer = customers.find(c => 
      c.name.replace(/\s/g, '').includes(parsedCust.replace(/\s/g, '')) || 
      parsedCust.replace(/\s/g, '').includes(c.name.replace(/\s/g, ''))
    );
    const site = sites.find(s => 
      s.name.replace(/\s/g, '').includes(parsedSite.replace(/\s/g, '')) || 
      parsedSite.replace(/\s/g, '').includes(s.name.replace(/\s/g, ''))
    );

    let matchedContract = null;
    if (customer) {
      matchedContract = contracts.find(c => 
        c.customerId === customer.id && 
        (site ? c.siteId === site.id : true) && 
        c.status !== 'COMPLETED'
      );
    }

    if (matchedContract) {
      setSelectedContractId(matchedContract.id);
      
      const cAssets = contractAssets.filter(ca => ca.contractId === matchedContract.id);
      const mappedAssetIds: string[] = [];
      
      parsedAssets.forEach(aNo => {
        const realAsset = assets.find(ast => ast.assetNo === aNo || ast.assetNo.includes(aNo));
        if (realAsset && cAssets.some(ca => ca.assetId === realAsset.id)) {
          mappedAssetIds.push(realAsset.id);
        }
      });
      setSelectedAssetIds(mappedAssetIds);
    } else {
      setSelectedContractId('');
      setSelectedAssetIds([]);
      alert('매칭되는 활성 계약을 찾지 못했습니다. 목록에서 직접 선택해 주세요.');
    }

    if (parsedDate) setReturnDate(parsedDate);
    if (parsedMemo) setNote(parsedMemo);
    setShowParser(false); // 분석 완료 후 목록으로 전환
  };

  // ==========================================
  // [4] 영업용 데이터 정렬/필터
  // ==========================================
  const activeContracts = contracts.filter(c => c.status !== 'COMPLETED');

  const filteredContracts = activeContracts.filter(c => {
    const custName = customers.find(cust => cust.id === c.customerId)?.name || '';
    return custName.toLowerCase().includes(salesSearch.toLowerCase());
  });

  const sortedContracts = filteredContracts.slice().sort((a, b) => {
    let valA = '';
    let valB = '';

    if (salesSortBy === 'END_DATE') {
      valA = a.endDate || '';
      valB = b.endDate || '';
    } else if (salesSortBy === 'CUSTOMER_NAME') {
      valA = customers.find(cust => cust.id === a.customerId)?.name || '';
      valB = customers.find(cust => cust.id === b.customerId)?.name || '';
    } else if (salesSortBy === 'SITE_NAME') {
      valA = sites.find(s => s.id === a.siteId)?.name || '';
      valB = sites.find(s => s.id === b.siteId)?.name || '';
    }

    const compare = valA.localeCompare(valB);
    return salesSortDesc ? -compare : compare;
  });

  // 계약 선택에 따른 자산 매칭
  const activeContractAssets = contractAssets.filter(ca => ca.contractId === selectedContractId && ca.assetId);

  const handleSalesAssetCheckboxChange = (assetId: string) => {
    if (selectedAssetIds.includes(assetId)) {
      setSelectedAssetIds(selectedAssetIds.filter(id => id !== assetId));
    } else {
      setSelectedAssetIds([...selectedAssetIds, assetId]);
    }
  };

  const handleSelectAllSalesAssets = () => {
    const allIds = activeContractAssets.map(ca => ca.assetId!).filter(Boolean);
    if (selectedAssetIds.length === allIds.length) {
      setSelectedAssetIds([]);
    } else {
      setSelectedAssetIds(allIds);
    }
  };

  const handleSalesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    if (!selectedContractId) {
      alert('회수할 대상 계약을 목록에서 선택해 주세요.');
      return;
    }
    if (selectedAssetIds.length === 0) {
      alert('회수할 장비를 1대 이상 선택해 주세요.');
      return;
    }
    if (!returnDate) {
      alert('회수 예정일자를 입력해 주세요.');
      return;
    }

    saveSmartReturn({
      contractId: selectedContractId,
      returnDate,
      assetIds: selectedAssetIds,
      loadingTime,
      contactName,
      contactPhone,
      note
    });

    alert('영업 계약 장비 스마트 회수의뢰 등록이 성공적으로 완료되었습니다.\n배차관리 화면에 회수(INBOUND) 건이 대기열에 추가되었습니다.');
    setSelectedContractId('');
    setSelectedAssetIds([]);
    setReturnDate('');
    setLoadingTime('');
    setContactName('');
    setContactPhone('');
    setNote('');
  };

  // ==========================================
  // [5] 정비용 데이터 가공 (외주 정비 자산)
  // ==========================================
  // repairs 중에서 repairType === 'EXTERNAL' 이고 status !== 'COMPLETED' (외주수리중)인 수리 건 필터링
  const ongoingRepairs = repairs.filter(r => r.repairType === 'EXTERNAL' && r.status !== 'COMPLETED');

  // 외주정비 중인 자산이 존재하는 정비 업체(Vendor)들만 추출
  const repairVendors = vendors.filter(v => 
    v.type === 'REPAIR' && 
    ongoingRepairs.some(r => r.vendorId === v.id)
  );

  // 선택된 외주업체에서 외주정비 중인 정비 리스트
  const repairsAtSelectedVendor = ongoingRepairs.filter(r => r.vendorId === selectedVendorId);

  const handleMaintAssetCheckboxChange = (repairId: string) => {
    if (selectedRepairIds.includes(repairId)) {
      setSelectedRepairIds(selectedRepairIds.filter(id => id !== repairId));
    } else {
      setSelectedRepairIds([...selectedRepairIds, repairId]);
    }
  };

  const handleSelectAllMaintAssets = () => {
    const allIds = repairsAtSelectedVendor.map(r => r.id);
    if (selectedRepairIds.length === allIds.length) {
      setSelectedRepairIds([]);
    } else {
      setSelectedRepairIds(allIds);
    }
  };

  const handleMaintSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    if (!selectedVendorId) {
      alert('회수해 올 외주정비 업체를 선택해 주세요.');
      return;
    }
    if (selectedRepairIds.length === 0) {
      alert('회수할 정비 자산을 1개 이상 선택해 주세요.');
      return;
    }
    if (!maintReturnDate) {
      alert('회수 일자를 입력해 주세요.');
      return;
    }

    // 선택된 수리건들의 assetId 목록 추출
    const targetAssetIds: string[] = [];
    selectedRepairIds.forEach(rId => {
      const rep = repairs.find(r => r.id === rId);
      if (rep && rep.assetId) {
        targetAssetIds.push(rep.assetId);
      }
    });

    saveSmartReturn({
      returnDate: maintReturnDate,
      assetIds: targetAssetIds,
      loadingTime: maintLoadingTime,
      repairId: selectedRepairIds.join(','),
      vendorId: selectedVendorId,
      note: maintNote
    });

    alert('외주 정비 수리완료 자산 스마트 회수의뢰 등록이 성공적으로 완료되었습니다.\n배차관리 화면에 외주정비회수 건이 추가되었습니다.');
    setSelectedVendorId('');
    setSelectedRepairIds([]);
    setMaintReturnDate('');
    setMaintLoadingTime('');
    setMaintNote('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 타이틀 및 가이드 배너 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontWeight: '700', marginBottom: '4px' }}>스마트 회수 요청 생성 및 배차 연계</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            영업 계약 만료/단축/고장 및 외주정비업체 수리 완료 건에 대한 맞춤형 회수 의뢰(INBOUND) 프로세스를 생성합니다.
          </p>
        </div>
      </div>

      {/* 모드 전환 탭 */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '2px solid var(--border-color)', paddingBottom: '10px' }}>
        <button
          type="button"
          onClick={() => {
            setActiveMode('SALES');
            setSelectedContractId('');
            setSelectedAssetIds([]);
          }}
          className={activeMode === 'SALES' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '8px 18px', fontSize: '14px', fontWeight: 'bold' }}
        >
          영업용 회수 요청 (계약만료/단축/고장)
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveMode('MAINTENANCE');
            setSelectedVendorId('');
            setSelectedRepairIds([]);
          }}
          className={activeMode === 'MAINTENANCE' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '8px 18px', fontSize: '14px', fontWeight: 'bold' }}
        >
          정비용 회수 요청 (외주정비 완료 자산)
        </button>
      </div>

      {/* [1] 영업사용자 모드 UI */}
      {activeMode === 'SALES' && (
        <div style={{ display: 'grid', gridTemplateColumns: '4.5fr 5.5fr', gap: '20px', alignItems: 'start' }}>
          
          {/* 왼쪽: 계약 목록 / 검색 / 파서 */}
          <div className="card" style={{ padding: '16px', minHeight: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Search size={16} className="text-primary" />
                <h4 style={{ margin: 0, fontWeight: '700' }}>임대 계약 조회</h4>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowParser(!showParser)}
                style={{ fontSize: '12px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Zap size={12} /> {showParser ? '계약 목록 보기' : '메신저 텍스트 파싱'}
              </button>
            </div>

            {showParser ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ padding: '10px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px' }}>
                  💡 카카오톡/이메일 오더를 분석해 해당 고객의 미종료 계약을 자동 매칭합니다.
                </div>
                <textarea
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  style={{ width: '100%', height: '240px', fontFamily: 'monospace', fontSize: '12.5px', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                />
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleParseText}
                  style={{ width: '100%', padding: '10px', fontWeight: 'bold' }}
                >
                  <Zap size={14} /> 텍스트 구조화 파싱 실행
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                {/* 필터 및 정렬 제어판 */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="고객명 검색..."
                    value={salesSearch}
                    onChange={e => setSalesSearch(e.target.value)}
                    style={{ flex: 1, padding: '6px 10px', fontSize: '13px' }}
                  />
                  
                  {/* 정렬 타겟 버튼 */}
                  <button
                    type="button"
                    onClick={() => {
                      if (salesSortBy === 'END_DATE') {
                        setSalesSortDesc(!salesSortDesc);
                      } else {
                        setSalesSortBy('END_DATE');
                        setSalesSortDesc(false);
                      }
                    }}
                    className={salesSortBy === 'END_DATE' ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '6px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '2px' }}
                  >
                    <ArrowUpDown size={12} /> 만료일 {salesSortBy === 'END_DATE' && (salesSortDesc ? '▼' : '▲')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (salesSortBy === 'CUSTOMER_NAME') {
                        setSalesSortDesc(!salesSortDesc);
                      } else {
                        setSalesSortBy('CUSTOMER_NAME');
                        setSalesSortDesc(false);
                      }
                    }}
                    className={salesSortBy === 'CUSTOMER_NAME' ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '6px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '2px' }}
                  >
                    <ArrowUpDown size={12} /> 고객명 {salesSortBy === 'CUSTOMER_NAME' && (salesSortDesc ? '▼' : '▲')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (salesSortBy === 'SITE_NAME') {
                        setSalesSortDesc(!salesSortDesc);
                      } else {
                        setSalesSortBy('SITE_NAME');
                        setSalesSortDesc(false);
                      }
                    }}
                    className={salesSortBy === 'SITE_NAME' ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '6px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '2px' }}
                  >
                    <ArrowUpDown size={12} /> 현장명 {salesSortBy === 'SITE_NAME' && (salesSortDesc ? '▼' : '▲')}
                  </button>
                </div>

                {/* 계약 목록 */}
                <div style={{ maxHeight: '380px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)' }}>
                  {sortedContracts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                      검색 조건에 맞는 활성 임대계약이 없습니다.
                    </div>
                  ) : (
                    sortedContracts.map(c => {
                      const cust = customers.find(cust => cust.id === c.customerId);
                      const site = sites.find(s => s.id === c.siteId);
                      const isSelected = selectedContractId === c.id;
                      
                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedContractId(c.id);
                            setSelectedAssetIds([]);
                          }}
                          style={{
                            padding: '10px 12px',
                            borderBottom: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                            borderLeft: isSelected ? '4px solid var(--primary)' : '4px solid transparent',
                            transition: 'all 0.15s'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <strong style={{ fontSize: '13.5px', color: isSelected ? 'var(--primary)' : 'var(--text-primary)' }}>
                              {cust?.name}
                            </strong>
                            <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                              {c.contractNo}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>현장: {site?.name || '미정'}</span>
                            <span style={{ fontWeight: '600', color: 'var(--danger)' }}>
                              만료일: {c.endDate || '-'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            )}
          </div>

          {/* 오른쪽: 상세 정보 입력 및 폼 제출 */}
          <div className="card" style={{ padding: '20px', minHeight: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h4 style={{ margin: 0, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clipboard size={18} className="text-success" />
                회수 지시 세부 설정
              </h4>
            </div>

            {selectedContractId ? (
              <form onSubmit={handleSalesSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                {/* 1. 계약 기본 확인 */}
                <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px' }}>
                  {(() => {
                    const c = contracts.find(con => con.id === selectedContractId);
                    const cust = customers.find(cust => cust.id === c?.customerId);
                    const site = sites.find(s => s.id === c?.siteId);
                    return (
                      <>
                        <div style={{ marginBottom: '4px' }}><strong>계약번호:</strong> {c?.contractNo}</div>
                        <div style={{ marginBottom: '4px' }}><strong>고객사:</strong> {cust?.name}</div>
                        <div><strong>현장명:</strong> {site?.name} ({site?.address || '-'})</div>
                      </>
                    );
                  })()}
                </div>

                {/* 2. 자산 선택 (전부 vs 일부) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ margin: 0, fontSize: '13px', fontWeight: 'bold' }}>회수할 자산 지정 *</label>
                    <button
                      type="button"
                      onClick={handleSelectAllSalesAssets}
                      style={{ fontSize: '11px', padding: '2px 8px', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      전체선택 / 해제
                    </button>
                  </div>
                  <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'var(--bg-app)' }}>
                    {activeContractAssets.length === 0 ? (
                      <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', textAlign: 'center', padding: '10px' }}>
                        대여 중인 자산 정보가 없습니다.
                      </div>
                    ) : (
                      activeContractAssets.map(ca => {
                        const asset = assets.find(a => a.id === ca.assetId);
                        if (!asset) return null;
                        return (
                          <label key={ca.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', margin: 0 }}>
                            <input
                              type="checkbox"
                              checked={selectedAssetIds.includes(asset.id)}
                              onChange={() => handleSalesAssetCheckboxChange(asset.id)}
                            />
                            <span><strong>[{asset.assetNo}]</strong> {asset.modelName}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    * 일부 장비만 부분 조기반송하는 경우 해당하는 장비만 체크하세요.
                  </div>
                </div>

                {/* 3. 일정 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label>회수 예정일자 *</label>
                    <input
                      type="date"
                      value={returnDate}
                      onChange={e => setReturnDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label>회수 희망시간</label>
                    <div style={{ display: 'flex', gap: '6px', position: 'relative', height: '38px' }}>
                      <select
                        value={loadingTime}
                        onChange={e => {
                          setLoadingTime(e.target.value);
                          (e.target as HTMLSelectElement).blur();
                        }}
                        onFocus={e => { (e.target as HTMLSelectElement).size = 10; }}
                        onBlur={e => { (e.target as HTMLSelectElement).size = 1; }}
                        style={{
                          flex: 1,
                          position: 'absolute',
                          width: '100%',
                          zIndex: 30,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                        }}
                      >
                        <option value="오전">오전</option>
                        <option value="오후">오후</option>
                        <option value="수시">수시</option>
                        <option value="06시">06시</option>
                        <option value="07시">07시</option>
                        <option value="08시">08시</option>
                        <option value="09시">09시</option>
                        <option value="10시">10시</option>
                        <option value="11시">11시</option>
                        <option value="12시">12시</option>
                        <option value="13시">13시</option>
                        <option value="14시">14시</option>
                        <option value="15시">15시</option>
                        <option value="16시">16시</option>
                        <option value="17시">17시</option>
                        <option value="18시">18시</option>
                        <option value="19시">19시</option>
                        <option value="20시">20시</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 4. 고객 담당 정보 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label>방문지 고객 담당자명 *</label>
                    <input
                      type="text"
                      placeholder="이름 입력"
                      value={contactName}
                      onChange={e => setContactName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label>담당자 연락처 *</label>
                    <input
                      type="text"
                      placeholder="연락처 입력"
                      value={contactPhone}
                      onChange={e => setContactPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* 5. 비고 */}
                <div>
                  <label>특이사항 및 비고</label>
                  <textarea
                    rows={2}
                    placeholder="조기 반납 조건 명시 또는 운반비 조건 등 입력..."
                    value={note}
                    onChange={e => setNote(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="btn-success"
                  style={{ width: '100%', padding: '10px', fontSize: '14px', fontWeight: 'bold' }}
                  disabled={!canSave || selectedAssetIds.length === 0}
                >
                  <Check size={16} /> 스마트 회수의뢰 등록 확정
                </button>

              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '360px', color: 'var(--text-muted)' }}>
                <Shield size={48} style={{ strokeWidth: 1.2, marginBottom: '12px' }} />
                <span>왼쪽 계약 목록에서 회수 요청 대상을 선택해 주세요.</span>
              </div>
            )}
          </div>

        </div>
      )}

      {/* [2] 정비직원 모드 UI */}
      {activeMode === 'MAINTENANCE' && (
        <div style={{ display: 'grid', gridTemplateColumns: '4.5fr 5.5fr', gap: '20px', alignItems: 'start' }}>
          
          {/* 왼쪽: 외주 정비 수리중인 외주업체 목록 */}
          <div className="card" style={{ padding: '16px', minHeight: '520px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
              <Search size={16} className="text-primary" />
              <h4 style={{ margin: 0, fontWeight: '700' }}>외주 정비 진행중인 업체 목록</h4>
            </div>
            
            <div style={{ padding: '10px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', marginBottom: '12px' }}>
              ℹ 현재 외주 정비 (`EXTERNAL`) 중인 리프트 자산이 존재하는 정비소들만 노출됩니다.
            </div>

            <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
              {repairVendors.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  현재 외주정비 진행 중인 자산이 없습니다.
                </div>
              ) : (
                repairVendors.map(v => {
                  const cnt = ongoingRepairs.filter(r => r.vendorId === v.id).length;
                  const isSelected = selectedVendorId === v.id;
                  return (
                    <div
                      key={v.id}
                      onClick={() => {
                        setSelectedVendorId(v.id);
                        setSelectedRepairIds([]);
                      }}
                      style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                        borderLeft: isSelected ? '4px solid var(--primary)' : '4px solid transparent',
                        transition: 'all 0.15s',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '13.5px' }}>{v.name}</strong>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          대표자: {v.contactName || '-'} | 연락처: {v.contact || '-'}
                        </div>
                      </div>
                      <span className="badge badge-warning" style={{ fontSize: '12px', fontWeight: 'bold' }}>
                        정비중 {cnt}대
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 오른쪽: 외주정비 자산 리스트 및 회수 폼 */}
          <div className="card" style={{ padding: '20px', minHeight: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h4 style={{ margin: 0, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clipboard size={18} className="text-success" />
                외주정비 완료 회수 의뢰
              </h4>
            </div>

            {selectedVendorId ? (
              <form onSubmit={handleMaintSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                {/* 외주업체 정보 */}
                <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px' }}>
                  {(() => {
                    const v = vendors.find(vend => vend.id === selectedVendorId);
                    return (
                      <>
                        <div style={{ marginBottom: '4px' }}><strong>회수장소 (외주정비업체):</strong> {v?.name}</div>
                        <div><strong>업체 주소/연락처:</strong> {v?.memo || '공장'} / {v?.contact || '-'}</div>
                      </>
                    );
                  })()}
                </div>

                {/* 해당 외주업체 정비 리스트 */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ margin: 0, fontSize: '13px', fontWeight: 'bold' }}>수리완료 회수 대상 자산 선택 (전부 또는 일부) *</label>
                    <button
                      type="button"
                      onClick={handleSelectAllMaintAssets}
                      style={{ fontSize: '11px', padding: '2px 8px', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      전체선택 / 해제
                    </button>
                  </div>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'var(--bg-app)' }}>
                    {repairsAtSelectedVendor.map(r => {
                      const asset = assets.find(a => a.id === r.assetId);
                      if (!asset) return null;
                      return (
                        <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={selectedRepairIds.includes(r.id)}
                            onChange={() => handleMaintAssetCheckboxChange(r.id)}
                          />
                          <span>
                            <strong>[{asset.assetNo}]</strong> {asset.modelName} (수리의뢰내역: {r.details || '내용없음'})
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 일정 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label>회수 예정일자 *</label>
                    <input
                      type="date"
                      value={maintReturnDate}
                      onChange={e => setMaintReturnDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label>상차 희망시간</label>
                    <div style={{ display: 'flex', gap: '6px', position: 'relative', height: '38px' }}>
                      <select
                        value={maintLoadingTime}
                        onChange={e => {
                          setMaintLoadingTime(e.target.value);
                          (e.target as HTMLSelectElement).blur();
                        }}
                        onFocus={e => { (e.target as HTMLSelectElement).size = 10; }}
                        onBlur={e => { (e.target as HTMLSelectElement).size = 1; }}
                        style={{
                          flex: 1,
                          position: 'absolute',
                          width: '100%',
                          zIndex: 30,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                        }}
                      >
                        <option value="오전">오전</option>
                        <option value="오후">오후</option>
                        <option value="수시">수시</option>
                        <option value="06시">06시</option>
                        <option value="07시">07시</option>
                        <option value="08시">08시</option>
                        <option value="09시">09시</option>
                        <option value="10시">10시</option>
                        <option value="11시">11시</option>
                        <option value="12시">12시</option>
                        <option value="13시">13시</option>
                        <option value="14시">14시</option>
                        <option value="15시">15시</option>
                        <option value="16시">16시</option>
                        <option value="17시">17시</option>
                        <option value="18시">18시</option>
                        <option value="19시">19시</option>
                        <option value="20시">20시</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 비고 */}
                <div>
                  <label>인수 특이사항</label>
                  <textarea
                    rows={3}
                    placeholder="수리 완료 부품 확인 필요, 또는 물류 기사 사전 인수 통화 요청..."
                    value={maintNote}
                    onChange={e => setMaintNote(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="btn-success"
                  style={{ width: '100%', padding: '10px', fontSize: '14px', fontWeight: 'bold' }}
                  disabled={!canSave || selectedRepairIds.length === 0}
                >
                  <Check size={16} /> 외주정비 회수 요청 생성
                </button>

              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '360px', color: 'var(--text-muted)' }}>
                <AlertTriangle size={48} style={{ strokeWidth: 1.2, marginBottom: '12px' }} />
                <span>왼쪽 외주업체 목록에서 회수 대상을 선택해 주세요.</span>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};
