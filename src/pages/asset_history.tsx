// src/pages/asset_history.tsx
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Download, Calendar, Layers, Wrench, ArrowUpRight, ArrowDownLeft, CheckCircle2, RotateCcw, AlertTriangle, ShieldCheck, Camera } from 'lucide-react';
import { exportToExcel } from '../services/excel';
import { InboundDefectDetail } from '../services/db';
import { compressImageFile } from '../utils/imageCompressor';

export const AssetHistory: React.FC = () => {
  const { 
    assetInOutLogs, assets, customers, sites, contractAssets, contracts, repairs, repairConsumables, consumables, navigationPayload, setNavigationPayload,
    inspectionChecklistItems, registerInboundAsset, cancelInboundAsset
  } = useApp();

  // 1. 탭 상태: 'INBOUND_REGISTER' | 'INBOUND' | 'OUTBOUND' | 'REPAIR'
  const [activeTab, setActiveTab] = useState<'INBOUND_REGISTER' | 'INBOUND' | 'OUTBOUND' | 'REPAIR'>('INBOUND_REGISTER');

  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const todayStr = getTodayStr();

  // 2. 검색 및 조회기간 입력 상태 (사용자 조작용)
  const [inputStartDate, setInputStartDate] = useState('');
  const [inputEndDate, setInputEndDate] = useState(todayStr);
  const [inputSearchTerm, setInputSearchTerm] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');

  // 3. 확정 조회 조건 (명시적 [조회] 버튼 클릭 시에만 갱신)
  const [activeSearchParams, setActiveSearchParams] = useState({
    startDate: '',
    endDate: todayStr,
    searchTerm: ''
  });

  // 💡 [입고 등록 폼 상태] (수동 점수 입력 제거 ➔ 정비 필요 항목 체크박스 선택 연동 + 사진 첨부)
  const [inboundAssetNoInput, setInboundAssetNoInput] = useState('');
  const [selectedInboundAssetId, setSelectedInboundAssetId] = useState('');
  const [inboundDate, setInboundDate] = useState(todayStr);
  const [selectedChecklistIds, setSelectedChecklistIds] = useState<string[]>([]);
  const [defectPhotos, setDefectPhotos] = useState<Record<string, string>>({}); // { checkitemId: photoUrlBase64 }
  const [inboundMemo, setInboundMemo] = useState('');
  const [isSubmittingInbound, setIsSubmittingInbound] = useState(false);

  // 💡 [사장님 지시] 사전 정의 정비 필요 항목 점수 100% 자동 합산 (수동 입력 휴먼에러 전면 제거)
  const selectedChecklistObjects = inspectionChecklistItems.filter(item => selectedChecklistIds.includes(item.id));
  const calculatedInboundScore = selectedChecklistObjects.reduce((sum, item) => sum + item.score, 0);
  const selectedChecklistSummary = selectedChecklistObjects.map(item => `${item.name}(+${item.score}점)`).join(', ');

  // 💡 모바일 카메라 촬영 앱 전환 후 복귀 시 자동 복원 (SessionStorage Auto Recovery)
  useEffect(() => {
    try {
      const savedAssetNo = sessionStorage.getItem('inbound_draft_assetNo');
      const savedChecklist = sessionStorage.getItem('inbound_draft_checklist');
      const savedMemo = sessionStorage.getItem('inbound_draft_memo');
      const savedPhotos = sessionStorage.getItem('inbound_draft_photos');

      if (savedAssetNo) setInboundAssetNoInput(savedAssetNo);
      if (savedChecklist) setSelectedChecklistIds(JSON.parse(savedChecklist));
      if (savedMemo) setInboundMemo(savedMemo);
      if (savedPhotos) setDefectPhotos(JSON.parse(savedPhotos));
    } catch (e) {}
  }, []);

  // 💡 [사진 업로드 처리] (모바일 고해상도 카메라 10MB+ ➔ 100KB 경량화 압축: RAM 부족 탭 새로고침 100% 차단)
  const handlePhotoFileChange = async (itemId: string, file: File | null) => {
    if (!file) return;
    try {
      const compressedDataUrl = await compressImageFile(file, 1024, 1024, 0.75);
      setDefectPhotos(prev => {
        const next = { ...prev, [itemId]: compressedDataUrl };
        try {
          sessionStorage.setItem('inbound_draft_photos', JSON.stringify(next));
        } catch (e) {}
        return next;
      });
    } catch (err) {
      console.error('Photo compression error:', err);
    }
  };

  // 0. 타 탭 이동 페이로드(특정 자산 이력 조회) 감지
  useEffect(() => {
    if (navigationPayload && navigationPayload.assetId) {
      setSelectedAssetId(navigationPayload.assetId);
      setNavigationPayload(null); // 페이로드 소비 후 소멸
    }
  }, [navigationPayload]);

  // 💡 명시적 [조회] 버튼 실행 헬퍼
  const handleSearch = (overrideStart?: string, overrideEnd?: string) => {
    setActiveSearchParams({
      startDate: overrideStart !== undefined ? overrideStart : inputStartDate,
      endDate: overrideEnd !== undefined ? overrideEnd : inputEndDate,
      searchTerm: inputSearchTerm
    });
  };

  // 💡 기간 빠른 선택 (오늘 / 1주 / 1개월 / 전체)
  const setQuickRange = (rangeType: 'TODAY' | 'WEEK' | 'MONTH' | 'ALL') => {
    const today = new Date();
    let newStart = '';
    let newEnd = todayStr;

    if (rangeType === 'TODAY') {
      newStart = todayStr;
    } else if (rangeType === 'WEEK') {
      const pastWeek = new Date(today);
      pastWeek.setDate(today.getDate() - 7);
      newStart = pastWeek.toISOString().split('T')[0];
    } else if (rangeType === 'MONTH') {
      const pastMonth = new Date(today);
      pastMonth.setMonth(today.getMonth() - 1);
      newStart = pastMonth.toISOString().split('T')[0];
    } else if (rangeType === 'ALL') {
      newStart = '';
    }

    setInputStartDate(newStart);
    setInputEndDate(newEnd);
    handleSearch(newStart, newEnd);
  };

  // 4. 탭별 및 확정 조회 조건 교집합(AND) 로그 집계
  const filteredTabLogs = assetInOutLogs.filter(log => {
    // [교집합 1] 탭 조건 (출고 / 입고 / 정비)
    if (log.type !== activeTab) return false;

    // [교집합 2] 미래 일자 차단 (출고/입고/정비는 발생 완료 건만 해당)
    if (log.eventDate > todayStr) return false;

    // [교집합 3] 선택 자산 조건 (타 페이지 연동 시)
    if (selectedAssetId && log.assetId !== selectedAssetId) return false;

    // [교집합 4] 확정 조회 기간 (시작일자 ~ 종료일자)
    if (activeSearchParams.startDate && log.eventDate < activeSearchParams.startDate) return false;
    if (activeSearchParams.endDate && log.eventDate > activeSearchParams.endDate) return false;

    // [교집합 5] 확정 통합 검색어 (모델명 OR 관리번호 OR 거래처명 OR 현장명 OR 메모)
    if (activeSearchParams.searchTerm.trim()) {
      const term = activeSearchParams.searchTerm.toLowerCase();
      const matchesAssetNo = log.assetNo.toLowerCase().includes(term);
      const matchesModel = log.modelName.toLowerCase().includes(term);
      const matchesCustomer = log.customerName && log.customerName.toLowerCase().includes(term);
      const matchesSite = log.siteName && log.siteName.toLowerCase().includes(term);
      const matchesMemo = log.memo && log.memo.toLowerCase().includes(term);

      if (!matchesAssetNo && !matchesModel && !matchesCustomer && !matchesSite && !matchesMemo) {
        return false;
      }
    }

    return true;
  }).sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());

  // 💡 [오타방지 및 유연매칭] 입고 등록용 선택된 자산 정보 및 대여 계약 자동 매칭 탐색
  const inboundTargetAsset = assets.find(a => a.id === selectedInboundAssetId || a.assetNo.toLowerCase() === inboundAssetNoInput.trim().toLowerCase());
  const inboundContractAsset = inboundTargetAsset ? (
    contractAssets.find(ca => ca.assetId === inboundTargetAsset.id && ca.status === 'RENTED') ||
    contractAssets.find(ca => ca.assetId === inboundTargetAsset.id && ca.status !== 'RETURNED') ||
    contractAssets.find(ca => ca.assetId === inboundTargetAsset.id)
  ) : null;
  const inboundContract = inboundContractAsset ? contracts.find(c => c.id === inboundContractAsset.contractId) : null;
  const inboundCustomer = inboundContract ? customers.find(c => c.id === inboundContract.customerId) : null;
  const inboundSite = inboundContract ? sites.find(s => s.id === inboundContract.siteId) : null;

  // 입고 등록 전송 실행 (HTML form 미사용 독립 버튼 전송으로 모발 새로고침 100% 차단)
  const handleSubmitInbound = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!inboundTargetAsset) {
      alert('입고 처리할 대상 자산의 정확한 관리번호를 입력해 주세요.');
      return;
    }

    try {
      setIsSubmittingInbound(true);
      const combinedMemo = selectedChecklistSummary 
        ? `[정비 필요 항목: ${selectedChecklistSummary}] ${inboundMemo}`.trim()
        : (inboundMemo.trim() || '입고 검수 이상 무');

      const defectPayloads: InboundDefectDetail[] = selectedChecklistObjects.map(item => ({
        subNo: '', // AppContext에서 INB-XXXX-01 채번 결합
        checkitemId: item.id,
        checkitemName: item.name,
        score: item.score,
        photoUrl: defectPhotos[item.id] || undefined
      }));

      await registerInboundAsset({
        assetId: inboundTargetAsset.id,
        returnDate: inboundDate,
        maintenanceScore: calculatedInboundScore,
        defects: defectPayloads,
        memo: combinedMemo
      });

      alert(`✅ [입고 등록 완결]\n\n자산번호: [${inboundTargetAsset.assetNo}] (${inboundTargetAsset.modelName})\n입고 일자: ${inboundDate}\n정비 필요 점수: ${calculatedInboundScore}점\n상태 전환: ${calculatedInboundScore === 0 ? '임대가능 (AVAILABLE)' : '입고반납/검수대기 (RENTED_RETURNED)'}\n\n계약 반납 마감, 입고 고유번호 및 자산 정비수리 이력이 정상 연동 등록되었습니다.`);
      
      // 폼 초기화 및 임시 저장 세션 소멸
      setSelectedInboundAssetId('');
      setInboundAssetNoInput('');
      setSelectedChecklistIds([]);
      setDefectPhotos({});
      setInboundMemo('');
      try {
        sessionStorage.removeItem('inbound_draft_assetNo');
        sessionStorage.removeItem('inbound_draft_checklist');
        sessionStorage.removeItem('inbound_draft_memo');
        sessionStorage.removeItem('inbound_draft_photos');
      } catch (e) {}
      setActiveTab('INBOUND');
    } catch (err: any) {
      alert(`⚠️ 입고 등록 중 오류 발생: ${err?.message || err}`);
    } finally {
      setIsSubmittingInbound(false);
    }
  };

  // 💡 [입고 취소 롤백] 휴먼에러 입고 취소 처리
  const handleCancelInbound = async (log: any) => {
    const reason = prompt(`[휴먼에러 복원 - 입고 취소 롤백]\n\n자산번호 [${log.assetNo}] 입고 건을 취소하고 자산 상태를 대여중(RENTED)으로 복원하시겠습니까?\n취소 사유를 작성해주세요:`, '사용자 입력 오타로 인한 입고 취소 롤백');
    if (reason === null) return; // 취소 누름

    try {
      await cancelInboundAsset(log.id, reason);
      alert(`✅ [입고 취소 롤백 성공]\n\n자산 [${log.assetNo}]의 상태 및 계약 매핑이 [대여중(RENTED)]으로 안전하게 원복 되었습니다.\n\n※Audit Trail: 입고 취소(INBOUND_CANCEL) 이력이 기록되어 무누락 추적성이 보장됩니다.`);
    } catch (err: any) {
      alert(`⚠️ 입고 취소 롤백 실패: ${err?.message || err}`);
    }
  };

  // 4. 수리 디테일 및 소모품 사용량 조회 헬퍼
  const getRepairDetail = (repairId: string) => {
    const rep = repairs.find(r => r.id === repairId);
    if (!rep) return null;

    const used = repairConsumables.filter(rc => rc.repairId === repairId).map(rc => {
      const item = consumables.find(c => c.id === rc.consumableId);
      return {
        name: item?.modelName || '소모품',
        qty: rc.quantity,
        price: rc.unitPrice
      };
    });

    return {
      description: rep.details,
      details: rep.details,
      cost: rep.totalCost,
      date: rep.repairDate,
      repairType: rep.repairType || 'SELF',
      vendorId: rep.vendorId,
      usedConsumables: used
    };
  };

  // 5. 선택된 자산 정보 및 통합 타임라인
  const selectedAsset = assets.find(a => a.id === selectedAssetId);
  const selectedAssetTimeline = assetInOutLogs
    .filter(l => l.assetId === selectedAssetId)
    .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());

  // 6. 엑셀 다운로드
  const handleExport = () => {
    const tabName = activeTab === 'OUTBOUND' ? '출고이력' : activeTab === 'INBOUND' ? '입고이력' : '정비이력';
    const excelData = filteredTabLogs.map((log, idx) => ({
      'No': idx + 1,
      '발생일자': log.eventDate,
      '관리번호': log.assetNo,
      '모델명': log.modelName,
      '거래처(고객사)': log.customerName || '-',
      '연관 현장': log.siteName || '-',
      '상태/점수': log.type === 'INBOUND' ? `${log.maintenanceScore || 0}점` : log.type,
      '메모 / 비고': log.memo || '-'
    }));

    exportToExcel(excelData, `자산_${tabName}_${new Date().toISOString().split('T')[0]}`, tabName);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 1. 페이지 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontWeight: '700', marginBottom: '4px' }}>자산 입출고 및 정비 이력</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            장비의 출고(출하), 반납 입고 및 검수, 정비/수리 완료까지의 라이프사이클을 탭별로 조회 추적합니다.
          </p>
        </div>
        <button className="btn-secondary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
          <Download size={14} /> 엑셀 다운로드
        </button>
      </div>

      {/* 2. 4대 탭 메뉴 (입고등록, 입고조회, 출고조회, 정비이력조회) */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '2px solid var(--border-color)', paddingBottom: '10px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('INBOUND_REGISTER')}
          className={activeTab === 'INBOUND_REGISTER' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '8px 18px', fontSize: '13.5px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <CheckCircle2 size={16} /> 입고 등록 (반납)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('INBOUND')}
          className={activeTab === 'INBOUND' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '8px 18px', fontSize: '13.5px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowDownLeft size={16} /> 입고 조회
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('OUTBOUND')}
          className={activeTab === 'OUTBOUND' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '8px 18px', fontSize: '13.5px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowUpRight size={16} /> 출고 조회
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('REPAIR')}
          className={activeTab === 'REPAIR' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '8px 18px', fontSize: '13.5px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Wrench size={16} /> 정비 이력 조회
        </button>
      </div>

      {/* 3. [신설] 입고 등록 전용 워크보드 (activeTab === 'INBOUND_REGISTER') */}
      {activeTab === 'INBOUND_REGISTER' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
          
          {/* 왼쪽: 자산 관리번호 선택 및 폼 입력 */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowDownLeft size={18} className="text-primary" /> 입고 자산 선택 및 검수 정보 입력
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* 1. 관리번호 수동/검색 입력 (휴먼에러 교차 검증) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 'bold' }}>입고 장비 관리번호 입력 / 검색 *</label>
                <input
                  type="text"
                  placeholder="예: G19004 또는 RENT-0001 관리번호 입력..."
                  value={inboundAssetNoInput}
                  onChange={e => {
                    const val = e.target.value;
                    setInboundAssetNoInput(val);
                    try { sessionStorage.setItem('inbound_draft_assetNo', val); } catch (err) {}
                    const matched = assets.find(a => a.assetNo.toLowerCase() === val.trim().toLowerCase());
                    if (matched) setSelectedInboundAssetId(matched.id);
                  }}
                  required
                  style={{ padding: '9px 12px', fontSize: '13.5px', fontWeight: 'bold' }}
                />
              </div>

              {/* 2. 입고 일자 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 'bold' }}>입고 일자 *</label>
                <input
                  type="date"
                  max={todayStr}
                  value={inboundDate}
                  onChange={e => setInboundDate(e.target.value)}
                  required
                  style={{ padding: '8px', fontSize: '13px' }}
                />
              </div>

              {/* 3. [사장님 지시] 정비 필요 항목 선택 및 정비필요점수 자동 연동 (수동 입력 제거) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={15} className="text-primary" /> 정비 필요 항목 점검 선택 (자동 합산 연동)
                  </label>
                  <span className={`badge ${calculatedInboundScore === 0 ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '12px', fontWeight: 'bold', padding: '4px 8px' }}>
                    총 정비필요점수: {calculatedInboundScore}점 {calculatedInboundScore === 0 ? '(이상무: AVAILABLE)' : '(검수대기: RENTED_RETURNED)'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', marginTop: '4px' }}>
                  {inspectionChecklistItems.map(item => {
                    const isChecked = selectedChecklistIds.includes(item.id);
                    const photo = defectPhotos[item.id];
                    return (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          backgroundColor: isChecked ? 'var(--primary-light)' : 'var(--bg-card)',
                          border: `1px solid ${isChecked ? 'var(--primary)' : 'var(--border-color)'}`,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', margin: 0 }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                let newIds: string[];
                                if (e.target.checked) {
                                  newIds = [...selectedChecklistIds, item.id];
                                } else {
                                  newIds = selectedChecklistIds.filter(id => id !== item.id);
                                  setDefectPhotos(prev => {
                                    const next = { ...prev };
                                    delete next[item.id];
                                    try { sessionStorage.setItem('inbound_draft_photos', JSON.stringify(next)); } catch (err) {}
                                    return next;
                                  });
                                }
                                setSelectedChecklistIds(newIds);
                                try { sessionStorage.setItem('inbound_draft_checklist', JSON.stringify(newIds)); } catch (err) {}
                              }}
                              style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                            />
                            <span style={{ fontWeight: isChecked ? 'bold' : 'normal' }}>{item.name}</span>
                          </label>
                          <span style={{ fontSize: '12px', color: isChecked ? 'var(--primary)' : 'var(--warning)', fontWeight: 'bold' }}>
                            +{item.score}점
                          </span>
                        </div>

                        {/* 체크 시 사진 촬영 / PC 업로드 영역 표출 */}
                        {isChecked && (
                          <div style={{ marginTop: '4px', paddingTop: '6px', borderTop: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const fileInput = document.getElementById(`defect-photo-input-${item.id}`);
                                if (fileInput) fileInput.click();
                              }}
                              style={{ padding: '4px 8px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', margin: 0 }}
                            >
                              <Camera size={13} /> 📸 증상 사진 촬영 / PC 선택
                            </button>
                            <input
                              id={`defect-photo-input-${item.id}`}
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={e => handlePhotoFileChange(item.id, e.target.files?.[0] || null)}
                            />

                            {photo ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <img src={photo} alt="파손 사진" style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
                                <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 'bold' }}>✅ 사진 첨부됨</span>
                                <button
                                  type="button"
                                  onClick={() => setDefectPhotos(prev => {
                                    const next = { ...prev };
                                    delete next[item.id];
                                    try { sessionStorage.setItem('inbound_draft_photos', JSON.stringify(next)); } catch (err) {}
                                    return next;
                                  })}
                                  style={{ border: 'none', background: 'none', color: 'var(--danger)', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                  삭제
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(사진 선택 시 자동 저장)</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. 검수 메모 (선택사항) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                  검수 및 입고 특이사항 메모 (선택사항)
                </label>
                <textarea
                  rows={2}
                  placeholder="추가적인 특이사항 또는 담당자 비고 입력 (선택)..."
                  value={inboundMemo}
                  onChange={e => {
                    const val = e.target.value;
                    setInboundMemo(val);
                    try { sessionStorage.setItem('inbound_draft_memo', val); } catch (err) {}
                  }}
                  style={{ padding: '8px', fontSize: '12.5px' }}
                />
              </div>

              <button
                type="button"
                onClick={() => handleSubmitInbound()}
                className="btn-primary"
                disabled={isSubmittingInbound || !inboundTargetAsset}
                style={{ width: '100%', padding: '10px', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '6px' }}
              >
                <CheckCircle2 size={16} /> 📥 반납 / 입고 등록 확정
              </button>

            </div>
          </div>

          {/* 오른쪽: 휴먼에러 오타 방지용 자동 매칭 교차 검증 정보 카드 */}
          <div className="card" style={{ padding: '20px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)' }}>
              <ShieldCheck size={18} /> 오타 방지 자산 및 대여 계약 자동 검증 정보
            </h3>

            {inboundTargetAsset ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                
                {/* 1. 장비 사양 확인 */}
                <div style={{ padding: '12px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--primary)', marginBottom: '4px' }}>
                    [{inboundTargetAsset.assetNo}] {inboundTargetAsset.modelName}
                  </div>
                  <div><strong>시리얼번호(S/N):</strong> {inboundTargetAsset.serialNo || '-'}</div>
                  <div><strong>소유형태:</strong> {inboundTargetAsset.ownerType === 'OWNED' ? '당사 자산' : '외부 임차 장비'}</div>
                  <div><strong>현재 자산 상태:</strong> <span className="badge badge-info">{inboundTargetAsset.status}</span></div>
                </div>

                {/* 2. 대여 중인 계약 정보 확인 */}
                {inboundContractAsset ? (
                  <div style={{ padding: '12px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--primary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 'bold' }}>
                      ✓ 대여 계약 매칭 성공 (휴먼에러 방지 교차 확인)
                    </div>
                    <div><strong>계약번호:</strong> {inboundContract?.contractNo}</div>
                    <div><strong>고객사 (거래처):</strong> <strong style={{ fontSize: '14px' }}>{inboundCustomer?.name || '-'}</strong></div>
                    <div><strong>현장명:</strong> {inboundSite?.name || '-'} ({inboundSite?.address || '-'})</div>
                    <div><strong>약정 계약기간:</strong> {inboundContract?.startDate} ~ {inboundContract?.endDate}</div>
                  </div>
                ) : (
                  <div style={{ padding: '12px', backgroundColor: 'var(--warning-light)', borderRadius: '8px', border: '1px solid var(--warning)', color: '#c2410c' }}>
                    ⚠️ 현재 체결 대여 중인 계약(RENTED)을 찾을 수 없습니다. (입고 시 미할당 자산으로 자동 처리됩니다)
                  </div>
                )}

                {/* 안내 문구 */}
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '8px', backgroundColor: 'var(--bg-card)', borderRadius: '6px' }}>
                  💡 <strong>입고 후 자동 자산 상태 전환:</strong><br />
                  - 검수점수 0점: <strong>`임대가능 (AVAILABLE)`</strong> 상태로 자동 즉시 전이<br />
                  - 검수점수 1점 이상: <strong>`입고반납/검수대기 (RENTED_RETURNED)`</strong> 상태로 자동 전이
                </div>

              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '240px', color: 'var(--text-muted)' }}>
                <AlertTriangle size={40} style={{ strokeWidth: 1.2, marginBottom: '10px' }} />
                <span>왼쪽 폼에서 입고할 자산의 관리번호를 선택하거나 입력해 주세요.</span>
              </div>
            )}
          </div>

        </div>
      ) : (

        /* 기존 필터 패널 (activeTab !== 'INBOUND_REGISTER') */
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', alignItems: 'end' }}>
            
            {/* 1. 조회 기간 설정 필터 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                조회 기간 설정 (상한: 오늘)
              </label>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input
                  type="date"
                  value={inputStartDate}
                  max={todayStr}
                  onChange={e => setInputStartDate(e.target.value)}
                  style={{ flex: 1, padding: '7px', fontSize: '12.5px' }}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>~</span>
                <input
                  type="date"
                  value={inputEndDate}
                  max={todayStr}
                  onChange={e => {
                    const val = e.target.value;
                    setInputEndDate(val > todayStr ? todayStr : val);
                  }}
                  style={{ flex: 1, padding: '7px', fontSize: '12.5px' }}
                />
              </div>
            </div>

            {/* 2. 조회기간 빠른 선택 버튼 (오늘 / 1주 / 1개월 / 전체) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                기간 빠른 선택
              </label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setQuickRange('TODAY')}
                  style={{ flex: 1, padding: '6px 4px', fontSize: '12px', whiteSpace: 'nowrap' }}
                >
                  오늘
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setQuickRange('WEEK')}
                  style={{ flex: 1, padding: '6px 4px', fontSize: '12px', whiteSpace: 'nowrap' }}
                >
                  1주
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setQuickRange('MONTH')}
                  style={{ flex: 1, padding: '6px 4px', fontSize: '12px', whiteSpace: 'nowrap' }}
                >
                  1개월
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setQuickRange('ALL')}
                  style={{ flex: 1, padding: '6px 4px', fontSize: '12px', whiteSpace: 'nowrap' }}
                >
                  전체
                </button>
              </div>
            </div>

            {/* 3. 통합 검색 필터 (모델명 / 관리번호 / 거래처 / 현장명) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                통합 검색 (모델명 / 관리번호 / 거래처)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={inputSearchTerm}
                  onChange={e => setInputSearchTerm(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
                  placeholder="모델명, 관리번호, 거래처명, 현장 검색 (Enter 키)..."
                  style={{ width: '100%', padding: '7px 10px 7px 32px', fontSize: '12.5px' }}
                />
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>

            {/* 4. 명시적 [조회] 실행 버튼 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'transparent', whiteSpace: 'nowrap', userSelect: 'none' }}>
                조회 실행
              </label>
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleSearch()}
                style={{
                  width: '100%',
                  padding: '7px 16px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  height: '34px'
                }}
              >
                <Search size={15} /> 조회
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 4. 자산 개별 선택 정보 및 연대기 타임라인 (자산이 선택된 경우에만 렌더링) */}
      {selectedAssetId && selectedAsset && (
        <div className="card" style={{ padding: '20px', border: '1px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontWeight: '700', fontSize: '15px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} />
              자산 통합 이력 연대기: [{selectedAsset.assetNo}] {selectedAsset.modelName}
            </h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className={`badge ${
                selectedAsset.status === 'AVAILABLE' ? 'badge-success' :
                selectedAsset.status === 'RENTED' ? 'badge-info' : 'badge-danger'
              }`}>
                현재상태: {
                  selectedAsset.status === 'AVAILABLE' ? '임대가능' :
                  selectedAsset.status === 'ASSIGNED' ? '출고대기' :
                  selectedAsset.status === 'RENTED' ? '대여중' :
                  selectedAsset.status === 'REPAIRING' ? '정비중' :
                  selectedAsset.status === 'RENTED_RETURNED' ? '반납완료' : selectedAsset.status
                }
              </span>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedAssetId('')}
                style={{ fontSize: '11px', padding: '2px 8px' }}
              >
                ✕ 전체 보기로 복귀
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '24px', alignItems: 'start' }}>
            {/* 자산 사양 요약 */}
            <div style={{ backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '8px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border-color)' }}>
              <div><strong>관리번호:</strong> <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{selectedAsset.assetNo}</span></div>
              <div><strong>모델명:</strong> {selectedAsset.modelName}</div>
              <div><strong>제조번호 (SN):</strong> {selectedAsset.serialNo || '-'}</div>
              <div><strong>소유 형태:</strong> {selectedAsset.ownerType === 'OWNED' ? '자사자산' : '외부임차장비'}</div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />
              <div><strong>누적 렌탈 기여액:</strong> {(selectedAsset.cumRentalFee || 0).toLocaleString()}원</div>
              <div><strong>누적 수리비 지출:</strong> {(selectedAsset.cumRepairCost || 0).toLocaleString()}원</div>
            </div>

            {/* 자산 타임라인 */}
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '13.5px', fontWeight: '700' }}>장비 생애주기 이력 로그 ({selectedAssetTimeline.length}건)</h4>
              {selectedAssetTimeline.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                  등록된 이력 로그가 없습니다.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '2px solid var(--border-color)', paddingLeft: '14px', marginLeft: '6px' }}>
                  {selectedAssetTimeline.map(log => (
                    <div key={log.id} style={{ position: 'relative' }}>
                      <div style={{
                        position: 'absolute', left: '-21px', top: '3px', width: '12px', height: '12px', borderRadius: '50%',
                        backgroundColor: 
                          log.type === 'OUTBOUND' ? 'var(--primary)' : 
                          log.type === 'INBOUND' ? 'var(--success)' : 'var(--warning)',
                        border: '2px solid var(--bg-card)'
                      }} />
                      <div style={{ padding: '10px', fontSize: '12.5px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <strong style={{ color: log.type === 'OUTBOUND' ? 'var(--primary)' : log.type === 'INBOUND' ? 'var(--success)' : 'var(--warning)' }}>
                            {log.type === 'OUTBOUND' ? '📤 출고 (OUTBOUND)' : log.type === 'INBOUND' ? '📥 입고 (INBOUND)' : '🛠️ 정비 (REPAIR)'}
                          </strong>
                          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{log.eventDate}</span>
                        </div>
                        <div>고객사/거래처: <strong>{log.customerName || '-'}</strong> {log.siteName ? `(${log.siteName})` : ''}</div>
                        {log.memo && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>비고: {log.memo}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. 탭별 조회 결과 안내 텍스트 & 데이터 테이블 (activeTab !== 'INBOUND_REGISTER') */}
      {activeTab !== 'INBOUND_REGISTER' && (
        <div className="card" style={{ padding: '16px' }}>
          
          {/* 결과 건수 텍스트 안내 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
              {activeTab === 'OUTBOUND' && <span>📤 출고 이력 목록</span>}
              {activeTab === 'INBOUND' && <span>📥 입고 이력 목록</span>}
              {activeTab === 'REPAIR' && <span>🛠️ 정비 이력 목록</span>}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              총 <strong style={{ color: 'var(--primary)', fontSize: '15px' }}>{filteredTabLogs.length}</strong>건의 이력이 조회되었습니다.
            </div>
          </div>

          {/* 데이터 테이블 */}
          <div className="table-container">
            <table>
              <thead>
                {activeTab === 'OUTBOUND' && (
                  <tr>
                    <th style={{ whiteSpace: 'nowrap' }}>번호</th>
                    <th style={{ whiteSpace: 'nowrap' }}>출고일자</th>
                    <th style={{ whiteSpace: 'nowrap' }}>관리번호</th>
                    <th style={{ whiteSpace: 'nowrap' }}>모델명</th>
                    <th style={{ whiteSpace: 'nowrap' }}>고객사 (거래처)</th>
                    <th style={{ whiteSpace: 'nowrap' }}>현장명</th>
                    <th style={{ whiteSpace: 'nowrap' }}>비고 / 메모</th>
                  </tr>
                )}
                {activeTab === 'INBOUND' && (
                  <tr>
                    <th style={{ whiteSpace: 'nowrap' }}>번호</th>
                    <th style={{ whiteSpace: 'nowrap' }}>입고 고유번호</th>
                    <th style={{ whiteSpace: 'nowrap' }}>입고일자</th>
                    <th style={{ whiteSpace: 'nowrap' }}>관리번호</th>
                    <th style={{ whiteSpace: 'nowrap' }}>모델명</th>
                    <th style={{ whiteSpace: 'nowrap' }}>고객사 (거래처)</th>
                    <th style={{ whiteSpace: 'nowrap' }}>현장명</th>
                    <th style={{ whiteSpace: 'nowrap' }}>정비 점수</th>
                    <th>불량 증상 상세 (하위번호/사진)</th>
                    <th style={{ whiteSpace: 'nowrap' }}>작업 (휴먼에러 복원)</th>
                  </tr>
                )}
                {activeTab === 'REPAIR' && (
                  <tr>
                    <th style={{ whiteSpace: 'nowrap' }}>번호</th>
                    <th style={{ whiteSpace: 'nowrap' }}>정비일자</th>
                    <th style={{ whiteSpace: 'nowrap' }}>관리번호</th>
                    <th style={{ whiteSpace: 'nowrap' }}>모델명</th>
                    <th style={{ whiteSpace: 'nowrap' }}>정비 구분</th>
                    <th style={{ whiteSpace: 'nowrap' }}>정비 내역 및 사유</th>
                    <th style={{ whiteSpace: 'nowrap' }}>정비 비용</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {filteredTabLogs.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
                      선택한 탭 및 검색 조건에 부합하는 자산 이력 데이터가 존재하지 않습니다.
                    </td>
                  </tr>
                ) : (
                  filteredTabLogs.map((log, idx) => {
                    const repDetail = log.type === 'REPAIR' && log.repairId ? getRepairDetail(log.repairId) : null;
                    const parsedDefects: InboundDefectDetail[] = log.defectsJson ? JSON.parse(log.defectsJson) : [];
                    return (
                      <tr
                        key={log.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedAssetId(log.assetId)}
                        title="클릭 시 자산별 생애주기 통합 연대기를 확인합니다."
                      >
                        <td style={{ whiteSpace: 'nowrap' }}>{idx + 1}</td>
                        
                        {activeTab === 'OUTBOUND' && (
                          <>
                            <td style={{ whiteSpace: 'nowrap' }}>{log.eventDate}</td>
                            <td style={{ whiteSpace: 'nowrap' }}><strong style={{ color: 'var(--primary)' }}>[{log.assetNo}]</strong></td>
                            <td style={{ whiteSpace: 'nowrap' }}>{log.modelName}</td>
                            <td style={{ whiteSpace: 'nowrap' }}><strong>{log.customerName || '-'}</strong></td>
                            <td style={{ whiteSpace: 'nowrap' }}>{log.siteName || '-'}</td>
                            <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{log.memo || '-'}</td>
                          </>
                        )}

                        {activeTab === 'INBOUND' && (
                          <>
                            <td style={{ whiteSpace: 'nowrap', fontWeight: 'bold', color: 'var(--primary)', fontSize: '12px' }}>
                              {log.inboundNo || '-'}
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>{log.eventDate}</td>
                            <td style={{ whiteSpace: 'nowrap' }}><strong style={{ color: 'var(--primary)' }}>[{log.assetNo}]</strong></td>
                            <td style={{ whiteSpace: 'nowrap' }}>{log.modelName}</td>
                            <td style={{ whiteSpace: 'nowrap' }}><strong>{log.customerName || '-'}</strong></td>
                            <td style={{ whiteSpace: 'nowrap' }}>{log.siteName || '-'}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <span className={`badge ${(log.maintenanceScore || 0) === 0 ? 'badge-success' : 'badge-warning'}`}>
                                {log.maintenanceScore || 0}점
                              </span>
                            </td>
                            <td style={{ fontSize: '12px' }}>
                              {parsedDefects.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {parsedDefects.map((d, dIdx) => (
                                    <div key={dIdx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span className="badge badge-secondary" style={{ fontSize: '10px' }}>{d.subNo}</span>
                                      <span>{d.checkitemName} (+{d.score}점)</span>
                                      {d.photoUrl && (
                                        <a href={d.photoUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                                          <img src={d.photoUrl} alt="사진" style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '3px', border: '1px solid var(--border-color)' }} />
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span>{log.memo || '-'}</span>
                              )}
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleCancelInbound(log)}
                                style={{ fontSize: '11px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--danger)', border: '1px solid var(--danger-light)' }}
                                title="사용자 휴먼에러 입고 오타 시 원래 대여중 상태로 롤백 복원합니다."
                              >
                                <RotateCcw size={12} /> 입고 취소
                              </button>
                            </td>
                          </>
                        )}

                        {activeTab === 'REPAIR' && (
                          <>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <span className={`badge ${repDetail?.repairType === 'VENDOR' ? 'badge-warning' : 'badge-info'}`}>
                                {repDetail?.repairType === 'VENDOR' ? '외주정비' : '자체정비'}
                              </span>
                            </td>
                            <td style={{ fontSize: '12.5px' }}>
                              {repDetail ? repDetail.details : (log.memo || '정비 작업')}
                            </td>
                            <td style={{ whiteSpace: 'nowrap', fontWeight: 'bold', color: 'var(--primary)' }}>
                              {repDetail ? `${(repDetail.cost || 0).toLocaleString()}원` : '-'}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

