import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Download, Eye, Layers, Edit2, Save, X, Wrench } from 'lucide-react';
import { exportToExcel } from '../services/excel';
import { Asset, calculateAssetDepreciation, AssetInOutLog, Repair } from '../services/db';
import { ASSET_STATUS_SSOT, getAssetStatusLabel, getAssetStatusBadgeClass } from '../config/asset_status_config';

export const Assets: React.FC = () => {
  const { assets, customers, sites, contracts, contractAssets, hasPermission, saveAsset, showErrorModal, loadTablesForMenu, assetInOutLogs, repairs } = useApp();

  const canEdit = hasPermission('asset', 'save');

  // 수동 조회 실행 여부 (초기 진입 시 자동 조회 방지 & 메뉴 진입속도 0초 최적화!)
  const [hasQueried, setHasQueried] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // 임시 필터 입력 상태 (조회 버튼을 누르기 전까지 홀드)
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempStatusFilter, setTempStatusFilter] = useState('ALL');
  const [tempOwnerFilter, setTempOwnerFilter] = useState('ALL');
  const [tempManufacturerFilter, setTempManufacturerFilter] = useState('ALL');
  const [tempCustomerFilter, setTempCustomerFilter] = useState('ALL');

  // 확정 필터 상태 (초기값: 전체 조회 상태)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [ownerFilter, setOwnerFilter] = useState('ALL');
  const [manufacturerFilter, setManufacturerFilter] = useState('ALL');
  const [customerFilter, setCustomerFilter] = useState('ALL');

  // 상세조회 / 수정 모달 상태
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Asset>>({});
  const [showHistoryToggle, setShowHistoryToggle] = useState(false); // 명시적 자산이력 조회 버튼 전용 상태

  const handleSelectAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setIsEditing(false);
    setShowHistoryToggle(false);
    setEditForm({ ...asset });
  };

  // 자산 개별 생애주기 통합 이력(입출고 + 현장 정비/AS 대장) 추출 헬퍼
  const getUnifiedAssetLogs = (asset: Asset): AssetInOutLog[] => {
    if (!asset) return [];

    // 1. 기존 입출고 로그 (assetId 또는 assetNo 일치)
    const rawLogs = (assetInOutLogs || []).filter((l: AssetInOutLog) => l.assetId === asset.id || (l.assetNo && l.assetNo === asset.assetNo));

    // 2. 정비/AS 대장(repairs) 연동 로그
    const assetRepairs = (repairs || []).filter((r: Repair) => r.assetId === asset.id || (r.assetNo && r.assetNo === asset.assetNo));

    // 이미 rawLogs에 동일 repairId가 있는 경우 중복 방지
    const existingRepairIds = new Set(rawLogs.map(l => l.repairId).filter(Boolean));

    const repairLogs: AssetInOutLog[] = assetRepairs
      .filter(r => !existingRepairIds.has(r.id))
      .map(r => ({
        id: `repair-log-${r.id}`,
        assetId: asset.id,
        assetNo: asset.assetNo,
        modelName: asset.modelName,
        type: 'REPAIR',
        eventDate: r.visitDate || r.repairDate || r.requestDate || (r.createdAt ? r.createdAt.slice(0, 10) : ''),
        customerId: r.customerId,
        customerName: r.customerName || (r as any).customer,
        siteId: r.siteId,
        siteName: r.siteName || (r as any).site,
        repairId: r.id,
        memo: `[${r.ticketNo || 'AS'}] ${r.issueDescription || r.details || '정비점검'} ➔ ${r.actionTaken || '조치완료'} (정비사: ${r.mechanicName || '-'})`,
        createdAt: r.createdAt || new Date().toISOString()
      }));

    const unified = [...rawLogs, ...repairLogs];

    // 3. 최초 취득 로그 fallback
    const hasAcquisition = unified.some(l => l.type === 'ACQUISITION');
    if (!hasAcquisition && asset.acquisitionDate) {
      unified.unshift({
        id: `acq-fallback-${asset.id}`,
        assetId: asset.id,
        assetNo: asset.assetNo,
        modelName: asset.modelName,
        type: 'ACQUISITION',
        eventDate: asset.acquisitionDate,
        memo: `자산 최초 취득 및 대장 등록 (취득일: ${asset.acquisitionDate} / 취득가: ${(asset.acquisitionPrice || 0).toLocaleString()}원 / 임차/구입처: ${asset.renter || '-'})`,
        createdAt: asset.createdAt || asset.acquisitionDate
      });
    }

    // 최신순(내림차순) 정렬
    return unified.sort((a, b) => (b.eventDate || '').localeCompare(a.eventDate || ''));
  };

  // 자산 개별 생애주기 통합 이력 엑셀 내려받기
  const handleExportAssetHistoryExcel = (asset: Asset) => {
    const assetLogs = getUnifiedAssetLogs(asset);
    if (assetLogs.length === 0) {
      alert('해당 자산의 누적 이력 데이터가 존재하지 않습니다.');
      return;
    }
    const dataToExport = assetLogs.map((log: AssetInOutLog, idx: number) => ({
      'No': idx + 1,
      '구분': log.type === 'ACQUISITION' ? '취득' : log.type === 'OUTBOUND' ? '출고' : log.type === 'INBOUND' ? '입고' : log.type === 'INBOUND_CANCEL' ? '입고취소' : log.type === 'DISPOSAL' ? '매각' : '정비',
      '입고고유번호': log.inboundNo || '-',
      '발생일자': log.eventDate,
      '관리번호': log.assetNo,
      '모델명': log.modelName,
      '거래처(고객사)': log.customerName || '-',
      '현장명': log.siteName || '-',
      '정비점수': log.maintenanceScore || 0,
      '특이사항/메모': log.memo || '-'
    }));

    exportToExcel(dataToExport, `자산이력_${asset.assetNo}_${new Date().toISOString().split('T')[0]}`);
  };

  const handleStartEdit = () => {
    if (selectedAsset) {
      setEditForm({ ...selectedAsset });
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm(selectedAsset ? { ...selectedAsset } : {});
  };

  const handleSaveEdit = async () => {
    if (!selectedAsset || !editForm) return;
    try {
      const updated: Asset = { ...selectedAsset, ...editForm };
      await (saveAsset as any)(updated);
      setSelectedAsset(updated);
      setIsEditing(false);
    } catch (err: any) {
      showErrorModal(`⚠️ 자산 정보 저장 실패:\n\n${err?.message || err}`, '자산 저장 오류');
    }
  };

  const ef = (field: keyof Asset) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const val = e.target.type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value;
    setEditForm(prev => ({ ...prev, [field]: val }));
  };

  type AssetSortField = 'assetNo' | 'modelName' | 'ownerType' | 'status' | 'currentCustomerId' | 'acquisitionDate' | 'manufacturer';
  const [sortField, setSortField] = useState<AssetSortField>('assetNo');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: AssetSortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // 고유 제조사 목록 추출
  const uniqueManufacturers = useMemo(
    () => Array.from(new Set(assets.map(a => a.manufacturer).filter(Boolean))) as string[],
    [assets]
  );

  const getCustomerName = (id?: string) => {
    if (!id) return '-';
    return customers.find(c => c.id === id)?.name || '-';
  };

  const getSiteName = (id?: string) => {
    if (!id) return '-';
    return sites.find(s => s.id === id)?.name || '-';
  };

  // 자산 → 계약번호 역방향 룩업 (contract_assets 경유)
  // 하나의 자산이 여러 계약에 걸쳐 이력이 있을 수 있으나,
  // 현재 활성(ACTIVE) 계약을 우선 반환하고, 없으면 가장 최근 계약을 반환
  const getAssetContractInfo = (assetId?: string): { contractNo: string; contractId: string } | null => {
    if (!assetId || !contractAssets || !contracts) return null;
    const linkedCAs = contractAssets.filter(ca => ca.assetId === assetId);
    if (linkedCAs.length === 0) return null;
    // ACTIVE 계약 우선
    for (const ca of linkedCAs) {
      const contract = contracts.find(c => c.id === ca.contractId && c.status === 'ACTIVE');
      if (contract) return { contractNo: contract.contractNo, contractId: contract.id };
    }
    // ACTIVE 없으면 가장 최근 계약
    const latestCA = linkedCAs[linkedCAs.length - 1];
    const contract = contracts.find(c => c.id === latestCA.contractId);
    if (contract) return { contractNo: contract.contractNo, contractId: contract.id };
    return null;
  };

  const statusLabel = getAssetStatusLabel;
  const statusBadge = getAssetStatusBadgeClass;

  // 필터링 및 정렬 (수동 [조회] 실행 시에만 계산)
  const filtered = useMemo(() => {
    if (!hasQueried) return [];

    return assets.filter(a => {
      const matchesSearch =
        !searchTerm ||
        a.assetNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.modelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.serialNo && a.serialNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (a.manufacturer && a.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
      const matchesOwner = ownerFilter === 'ALL' || a.ownerType === ownerFilter;
      const matchesManufacturer = manufacturerFilter === 'ALL' || a.manufacturer === manufacturerFilter;
      const matchesCustomer = customerFilter === 'ALL' || a.currentCustomerId === customerFilter;
      return matchesSearch && matchesStatus && matchesOwner && matchesManufacturer && matchesCustomer;
    }).sort((a, b) => {
      let aVal: any = sortField === 'currentCustomerId' ? getCustomerName(a.currentCustomerId) : a[sortField as keyof Asset];
      let bVal: any = sortField === 'currentCustomerId' ? getCustomerName(b.currentCustomerId) : b[sortField as keyof Asset];
      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';
      const cmp = String(aVal).localeCompare(String(bVal), 'ko', { numeric: true });
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [hasQueried, assets, searchTerm, statusFilter, ownerFilter, manufacturerFilter, customerFilter, sortField, sortDirection]);

  const renderSortArrow = (field: AssetSortField) => {
    if (sortField !== field) return <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginLeft: '3px' }}>↕</span>;
    return <span style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '11px', marginLeft: '3px' }}>{sortDirection === 'asc' ? '▲' : '▼'}</span>;
  };

  const handleSearchClick = async () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setIsLoadingData(true);
    setSearchTerm(tempSearchTerm);
    setStatusFilter(tempStatusFilter);
    setOwnerFilter(tempOwnerFilter);
    setManufacturerFilter(tempManufacturerFilter);
    setCustomerFilter(tempCustomerFilter);

    try {
      await loadTablesForMenu('asset');
      setHasQueried(true);
    } catch (e) {
      console.error('Asset load error:', e);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleExport = () => {
    const data = filtered.map((a, idx) => {
      const ci = getAssetContractInfo(a.id);
      return {
        // ① 식별자
        'No': idx + 1,
        '관리번호': a.assetNo || '-',
        '원사(타사) 관리번호': a.vendorAssetNo || '-',
        '제조번호(S/N)': a.serialNo || '-',

        // ② 장비 제원 및 소유 속성
        '모델명': a.modelName || '-',
        '제조사': a.manufacturer || '-',
        '제조년도': a.manufactureYear || '-',
        '소유구분': a.ownerType === 'OWNED' ? '당사자산' : '외부임차',
        '상태': statusLabel(a.status),

        // ③ 소유/임차 거래처 및 기간
        '임차처(원사)': a.renter || a.supplier || '-',
        '임차개시일': a.rentStart ? a.rentStart.slice(0, 10) : '-',
        '임차만료일': a.rentEnd ? a.rentEnd.slice(0, 10) : '-',
        '실제반납일': a.actualRentReturnDate ? a.actualRentReturnDate.slice(0, 10) : '-',
        '월임차료(원)': a.monthlyRentFee || 0,
        '일임차료(원)': a.dailyRentFee || 0,

        // ④ 현재 가동 현장 및 계약
        '현재 고객사': getCustomerName(a.currentCustomerId),
        '현재 현장': getSiteName(a.currentSiteId),
        '계약번호': ci ? ci.contractNo : '-',
        '계약시작일': a.contractStart ? a.contractStart.slice(0, 10) : '-',
        '계약종료일': a.contractEnd ? a.contractEnd.slice(0, 10) : '-',
        '청구마감일': a.billingDay ? `${a.billingDay}일` : '-',
        '월대여료(원)': a.monthlyRentalFee || 0,
        '일대여료(원)': a.dailyRentalFee || 0,

        // ⑤ 자산 회계 및 손익
        '취득일자': a.acquisitionDate ? a.acquisitionDate.slice(0, 10) : '-',
        '취득금액(원)': a.acquisitionPrice || 0,
        '구입처': a.supplier || '-',
        '감가상각개월수': a.depreciationMonths || 0,
        '감가상각누계액(원)': calculateAssetDepreciation(a).accumDepreciation || 0,
        '잔존가치율': a.residualValueRate != null ? `${a.residualValueRate}%` : '-',
        '장부가치(원)': a.bookValue ?? (a.acquisitionPrice || 0),
        '누적렌탈수익(원)': a.cumRentalFee || 0,
        '누적수리비(원)': a.cumRepairCost || 0,
        '정비점수': a.maintenanceScore || 0,

        // ⑥ 매각 및 비고
        '매각일자': a.disposalDate ? a.disposalDate.slice(0, 10) : '-',
        '매각가격(원)': a.disposalPrice || 0,
        '매각처': a.buyer || '-',
        '비고': a.memo || a.memo1 || a.note || '-'
      };
    });
    exportToExcel(data, `자산장비목록_${new Date().toISOString().split('T')[0]}`, '자산목록');
  };

  // ─── 컬럼 width 설정 (픽셀, 모든 DB 컬럼 표시 - 횡스크롤 허용)
  const colWidths = {
    action: 52,           // 상세 (맨 앞)
    assetNo: 88,
    modelName: 130,
    manufacturer: 80,
    serialNo: 112,
    manufactureYear: 78,
    ownerType: 60,
    status: 72,
    currentCustomer: 120,
    currentSite: 100,
    contractNo: 110,
    contractStart: 88,
    contractEnd: 88,
    billingDay: 70,
    monthlyRentalFee: 90,
    dailyRentalFee: 80,
    acquisitionDate: 88,
    acquisitionPrice: 96,
    supplier: 90,
    depreciationMonths: 80,
    residualValueRate: 70,
    bookValue: 90,
    cumRentalFee: 100,
    cumRepairCost: 96,
    renter: 90,
    rentStart: 88,
    rentEnd: 88,
    monthlyRentFee: 90,
    dailyRentFee: 80,
    actualRentReturnDate: 88,
    disposalDate: 88,
    disposalPrice: 96,
    buyer: 90,
    maintenanceScore: 70,
    memo1: 110,
    memo2: 110,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: 0 }}>
      <div className="card-header" style={{ marginBottom: '12px', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontWeight: '700' }}>자산 (장비) 관리 대장</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            전체 <strong>{assets.length}</strong>대 등록됨 (검색 결과: <strong>{filtered.length}</strong>대)
            {assets.length === 0 && <span style={{ color: 'var(--warning)', marginLeft: '8px' }}>⚠️ Supabase 연결 후 자산 데이터를 업로드해 주세요.</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={handleExport}>
            <Download size={16} /> 엑셀 다운로드
          </button>
        </div>
      </div>

      {/* 📊 자산 상태별 보유 대수 실시간 요약 바 */}
      {(() => {
        const availableCount = assets.filter(a => a.status === 'AVAILABLE').length;
        const rentedCount = assets.filter(a => a.status === 'RENTED').length;
        const assignedCount = assets.filter(a => a.status === 'ASSIGNED').length;
        const repairingCount = assets.filter(a => a.status === 'REPAIRING').length;

        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '12px', flexShrink: 0 }}>
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>임대 가능</span>
              <strong style={{ fontSize: '15px', color: '#16a34a' }}>{availableCount}대</strong>
            </div>
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>현장 대여중</span>
              <strong style={{ fontSize: '15px', color: 'var(--primary)' }}>{rentedCount}대</strong>
            </div>
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>출고/검수 대기</span>
              <strong style={{ fontSize: '15px', color: '#0070C0' }}>{assignedCount}대</strong>
            </div>
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>수리/정비중</span>
              <strong style={{ fontSize: '15px', color: 'var(--danger)' }}>{repairingCount}대</strong>
            </div>
          </div>
        );
      })()}

      {/* 필터 카드 */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: '10px', flexShrink: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 0.9fr 0.9fr 1.4fr 0.7fr', gap: '10px', alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', marginBottom: '5px', display: 'block' }}>통합 검색</label>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={tempSearchTerm}
                onChange={e => setTempSearchTerm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearchClick()}
                placeholder="관리번호, 모델명, 제조사, S/N..."
                style={{ paddingLeft: '32px', height: '36px', width: '100%' }}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', marginBottom: '5px', display: 'block' }}>소유구분</label>
            <select value={tempOwnerFilter} onChange={e => setTempOwnerFilter(e.target.value)} style={{ width: '100%', padding: '7px', fontSize: '13px' }}>
              <option value="ALL">전체</option>
              <option value="OWNED">당사</option>
              <option value="RENTED">임차</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', marginBottom: '5px', display: 'block' }}>장비 상태</label>
            <select value={tempStatusFilter} onChange={e => setTempStatusFilter(e.target.value)} style={{ width: '100%', padding: '7px', fontSize: '13px' }}>
              <option value="ALL">전체</option>
              {Object.values(ASSET_STATUS_SSOT).map(st => (
                <option key={st.code} value={st.code}>{st.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', marginBottom: '5px', display: 'block' }}>제조사</label>
            <select value={tempManufacturerFilter} onChange={e => setTempManufacturerFilter(e.target.value)} style={{ width: '100%', padding: '7px', fontSize: '13px' }}>
              <option value="ALL">전체</option>
              {uniqueManufacturers.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', marginBottom: '5px', display: 'block' }}>현재 고객사</label>
            <select value={tempCustomerFilter} onChange={e => setTempCustomerFilter(e.target.value)} style={{ width: '100%', padding: '7px', fontSize: '13px' }}>
              <option value="ALL">전체</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSearchClick}
              disabled={isLoadingData}
              style={{ width: '100%', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', fontWeight: 'bold', fontSize: '13px' }}
            >
              <Search size={14} /> {isLoadingData ? '조회 중...' : '조회'}
            </button>
          </div>
        </div>
      </div>

      {/* 자산 목록 테이블 - 하단 남는 뷰포트 공간 100% flex-fill */}
      <div className="table-container" style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0, maxHeight: 'none' }}>
        <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '13px' }}>
          <colgroup>
            <col style={{ width: `${colWidths.action}px` }} />
            <col style={{ width: `${colWidths.assetNo}px` }} />
            <col style={{ width: `${colWidths.modelName}px` }} />
            <col style={{ width: `${colWidths.manufacturer}px` }} />
            <col style={{ width: `${colWidths.serialNo}px` }} />
            <col style={{ width: `${colWidths.manufactureYear}px` }} />
            <col style={{ width: `${colWidths.ownerType}px` }} />
            <col style={{ width: `${colWidths.status}px` }} />
            <col style={{ width: `${colWidths.currentCustomer}px` }} />
            <col style={{ width: `${colWidths.currentSite}px` }} />
            <col style={{ width: `${colWidths.contractNo}px` }} />
            <col style={{ width: `${colWidths.contractStart}px` }} />
            <col style={{ width: `${colWidths.contractEnd}px` }} />
            <col style={{ width: `${colWidths.billingDay}px` }} />
            <col style={{ width: `${colWidths.monthlyRentalFee}px` }} />
            <col style={{ width: `${colWidths.dailyRentalFee}px` }} />
            <col style={{ width: `${colWidths.acquisitionDate}px` }} />
            <col style={{ width: `${colWidths.acquisitionPrice}px` }} />
            <col style={{ width: `${colWidths.supplier}px` }} />
            <col style={{ width: `${colWidths.depreciationMonths}px` }} />
            <col style={{ width: `${colWidths.residualValueRate}px` }} />
            <col style={{ width: `${colWidths.bookValue}px` }} />
            <col style={{ width: `${colWidths.cumRentalFee}px` }} />
            <col style={{ width: `${colWidths.cumRepairCost}px` }} />
            <col style={{ width: `${colWidths.renter}px` }} />
            <col style={{ width: `${colWidths.rentStart}px` }} />
            <col style={{ width: `${colWidths.rentEnd}px` }} />
            <col style={{ width: `${colWidths.monthlyRentFee}px` }} />
            <col style={{ width: `${colWidths.dailyRentFee}px` }} />
            <col style={{ width: `${colWidths.actualRentReturnDate}px` }} />
            <col style={{ width: `${colWidths.disposalDate}px` }} />
            <col style={{ width: `${colWidths.disposalPrice}px` }} />
            <col style={{ width: `${colWidths.buyer}px` }} />
            <col style={{ width: `${colWidths.maintenanceScore}px` }} />
            <col style={{ width: `${colWidths.memo1}px` }} />
            <col style={{ width: `${colWidths.memo2}px` }} />
          </colgroup>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-sidebar)' }}>
            <tr>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px', textAlign: 'center' }}>상세</th>
              <th onClick={() => handleSort('assetNo')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px' }}>
                관리번호{renderSortArrow('assetNo')}
              </th>
              <th onClick={() => handleSort('modelName')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px' }}>
                모델명{renderSortArrow('modelName')}
              </th>
              <th onClick={() => handleSort('manufacturer')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px' }}>
                제조사{renderSortArrow('manufacturer')}
              </th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px' }}>제조번호(S/N)</th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px', textAlign: 'center' }}>제조년도</th>
              <th onClick={() => handleSort('ownerType')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px', textAlign: 'center' }}>
                소유{renderSortArrow('ownerType')}
              </th>
              <th onClick={() => handleSort('status')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px', textAlign: 'center' }}>
                상태{renderSortArrow('status')}
              </th>
              <th onClick={() => handleSort('currentCustomerId')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px' }}>
                현재 고객사{renderSortArrow('currentCustomerId')}
              </th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px' }}>현재 현장</th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px', textAlign: 'center' }}>계약번호</th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px', textAlign: 'center' }}>계약시작일</th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px', textAlign: 'center' }}>계약종료일</th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px', textAlign: 'center' }}>청구마감일</th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px', textAlign: 'right' }}>월대여료</th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px', textAlign: 'right' }}>일대여료</th>
              <th onClick={() => handleSort('acquisitionDate')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px', textAlign: 'center' }}>
                취득일자{renderSortArrow('acquisitionDate')}
              </th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px', textAlign: 'right' }}>취득금액</th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px' }}>구입처</th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px', textAlign: 'center' }}>상각개월수</th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px', textAlign: 'center' }}>잔존가치율</th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px', textAlign: 'right' }}>장부가치</th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px', textAlign: 'right' }}>기여액(기수)</th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px', textAlign: 'right' }}>누적수리비</th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px' }}>임차처</th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px', textAlign: 'center' }}>임차개시일</th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px', textAlign: 'center' }}>임차만료일</th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px', textAlign: 'right' }}>월임차료</th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px', textAlign: 'right' }}>일임차료</th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px', textAlign: 'center' }}>실제반납일</th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px', textAlign: 'center' }}>매각일자</th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px', textAlign: 'right' }}>매각가격</th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px' }}>매각처</th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px', textAlign: 'center' }}>정비점수</th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px' }}>비고1</th>
              <th style={{ whiteSpace: 'nowrap', padding: '8px 6px', fontSize: '12px' }}>비고2</th>
            </tr>
          </thead>
          <tbody>
            {isLoadingData ? (
              <tr>
                <td colSpan={35} style={{ textAlign: 'center', padding: '60px 0', color: 'var(--primary)', fontWeight: 'bold' }}>
                  ⏳ 자산 관리 데이터를 데이터베이스에서 불러오는 중입니다...
                </td>
              </tr>
            ) : (!hasQueried || filtered.length === 0) ? (
              <tr>
                <td colSpan={35} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                  조회 결과가 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map(a => {
                return (
                  <tr key={a.id}>
                    {/* 상세 버튼 - 맨 앞 */}
                    <td style={{ padding: '7px 6px', textAlign: 'center' }}>
                      <button
                        className="btn-secondary"
                        style={{ padding: '4px', borderRadius: '50%' }}
                        title="상세 조회"
                        onClick={() => handleSelectAsset(a)}
                      >
                        <Eye size={13} />
                      </button>
                    </td>
                    <td style={{ padding: '7px 6px' }}>
                      <strong style={{ color: 'var(--primary)', fontSize: '12px' }}>{a.assetNo}</strong>
                    </td>
                    <td style={{ padding: '7px 6px', fontSize: '12px' }}>{a.modelName}</td>
                    <td style={{ padding: '7px 6px', fontSize: '12px', color: 'var(--text-secondary)' }}>{a.manufacturer || '-'}</td>
                    <td style={{ padding: '7px 6px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{a.serialNo || '-'}</td>
                    <td style={{ padding: '7px 6px', fontSize: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}>{a.manufactureYear || '-'}</td>
                    <td style={{ padding: '7px 6px', textAlign: 'center' }}>
                      <span className={`badge ${a.ownerType === 'OWNED' ? 'badge-success' : 'badge-info'}`} style={{ fontSize: '11px', padding: '2px 5px' }}>
                        {a.ownerType === 'OWNED' ? '당사' : '임차'}
                      </span>
                    </td>
                    <td style={{ padding: '7px 6px', textAlign: 'center' }}>
                      <span className={`badge ${statusBadge(a.status)}`} style={{ fontSize: '11px', padding: '2px 5px' }}>
                        {statusLabel(a.status)}
                      </span>
                    </td>
                    <td style={{ padding: '7px 6px', fontSize: '12px' }}>{getCustomerName(a.currentCustomerId)}</td>
                    <td style={{ padding: '7px 6px', fontSize: '12px', color: 'var(--text-secondary)' }}>{getSiteName(a.currentSiteId)}</td>
                    <td style={{ padding: '7px 6px', fontSize: '11px', textAlign: 'center' }}>
                      {(() => {
                        const ci = getAssetContractInfo(a.id);
                        return ci ? (
                          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--primary)', fontWeight: '600', whiteSpace: 'nowrap' }}>
                            {ci.contractNo}
                          </span>
                        ) : <span style={{ color: 'var(--text-muted)' }}>-</span>;
                      })()}
                    </td>
                    <td style={{ padding: '7px 6px', fontSize: '11px', textAlign: 'center', color: 'var(--text-muted)' }}>{a.contractStart ? a.contractStart.slice(0, 10) : '-'}</td>
                    <td style={{ padding: '7px 6px', fontSize: '11px', textAlign: 'center', color: 'var(--text-muted)' }}>{a.contractEnd ? a.contractEnd.slice(0, 10) : '-'}</td>
                    <td style={{ padding: '7px 6px', fontSize: '12px', textAlign: 'center' }}>{a.billingDay ? `${a.billingDay}일` : '-'}</td>
                    <td style={{ padding: '7px 6px', fontSize: '12px', textAlign: 'right' }}>{a.monthlyRentalFee ? a.monthlyRentalFee.toLocaleString() : '-'}</td>
                    <td style={{ padding: '7px 6px', fontSize: '12px', textAlign: 'right' }}>{a.dailyRentalFee ? a.dailyRentalFee.toLocaleString() : '-'}</td>
                    <td style={{ padding: '7px 6px', fontSize: '11px', textAlign: 'center', color: 'var(--text-muted)' }}>{a.acquisitionDate ? a.acquisitionDate.slice(0, 10) : '-'}</td>
                    <td style={{ padding: '7px 6px', fontSize: '12px', textAlign: 'right' }}>{a.acquisitionPrice ? a.acquisitionPrice.toLocaleString() : '-'}</td>
                    <td style={{ padding: '7px 6px', fontSize: '12px', color: 'var(--text-secondary)' }}>{a.supplier || '-'}</td>
                    <td style={{ padding: '7px 6px', fontSize: '12px', textAlign: 'center' }}>{a.depreciationMonths ? `${a.depreciationMonths}M` : '-'}</td>
                    <td style={{ padding: '7px 6px', fontSize: '12px', textAlign: 'center' }}>{a.residualValueRate != null ? `${a.residualValueRate}%` : '-'}</td>
                    <td style={{ padding: '7px 6px', fontSize: '12px', textAlign: 'right', fontWeight: 'bold' }}>{(a.bookValue ?? (a.acquisitionPrice || 0)).toLocaleString()}</td>
                    <td style={{ padding: '7px 6px', fontSize: '12px', textAlign: 'right', color: 'var(--primary)' }}>{(a.cumRentalFee || 0).toLocaleString()}</td>
                    <td style={{ padding: '7px 6px', fontSize: '12px', textAlign: 'right', color: 'var(--danger)' }}>{(a.cumRepairCost || 0).toLocaleString()}</td>
                    <td style={{ padding: '7px 6px', fontSize: '12px', color: 'var(--text-secondary)' }}>{a.renter || '-'}</td>
                    <td style={{ padding: '7px 6px', fontSize: '11px', textAlign: 'center', color: 'var(--text-muted)' }}>{a.rentStart ? a.rentStart.slice(0, 10) : '-'}</td>
                    <td style={{ padding: '7px 6px', fontSize: '11px', textAlign: 'center', color: 'var(--text-muted)' }}>{a.rentEnd ? a.rentEnd.slice(0, 10) : '-'}</td>
                    <td style={{ padding: '7px 6px', fontSize: '12px', textAlign: 'right' }}>{a.monthlyRentFee ? a.monthlyRentFee.toLocaleString() : '-'}</td>
                    <td style={{ padding: '7px 6px', fontSize: '12px', textAlign: 'right' }}>{a.dailyRentFee ? a.dailyRentFee.toLocaleString() : '-'}</td>
                    <td style={{ padding: '7px 6px', fontSize: '11px', textAlign: 'center', color: 'var(--text-muted)' }}>{a.actualRentReturnDate ? a.actualRentReturnDate.slice(0, 10) : '-'}</td>
                    <td style={{ padding: '7px 6px', fontSize: '11px', textAlign: 'center', color: 'var(--danger)' }}>{a.disposalDate ? a.disposalDate.slice(0, 10) : '-'}</td>
                    <td style={{ padding: '7px 6px', fontSize: '12px', textAlign: 'right' }}>{a.disposalPrice ? a.disposalPrice.toLocaleString() : '-'}</td>
                    <td style={{ padding: '7px 6px', fontSize: '12px', color: 'var(--text-secondary)' }}>{a.buyer || '-'}</td>
                    <td style={{ padding: '7px 6px', fontSize: '12px', textAlign: 'center' }}>{a.maintenanceScore != null ? a.maintenanceScore : '-'}</td>
                    <td style={{ padding: '7px 6px', fontSize: '11px', color: 'var(--text-muted)', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.memo1 || ''}>{a.memo1 || '-'}</td>
                    <td style={{ padding: '7px 6px', fontSize: '11px', color: 'var(--text-muted)', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.memo2 || ''}>{a.memo2 || '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 자산 세부 속성 팝업 모달 */}
      {selectedAsset && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => { if (!isEditing) setSelectedAsset(null); }}>
          <div className="card" onClick={e => e.stopPropagation()} style={{ width: '92%', maxWidth: '860px', maxHeight: '92vh', overflowY: 'auto', backgroundColor: 'var(--bg-card)' }}>
            {/* 모달 헤더 */}
            <div className="card-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 5 }}>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Layers className="text-primary" />
                {isEditing ? '✏️ 자산 정보 수정' : '자산 상세 명세서'} — {selectedAsset.assetNo}
              </h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {canEdit && !isEditing && (
                  <button className="btn-primary" onClick={handleStartEdit} style={{ padding: '5px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Edit2 size={14} /> 수정
                  </button>
                )}
                {isEditing && (
                  <>
                    <button className="btn-success" onClick={handleSaveEdit} style={{ padding: '5px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Save size={14} /> 저장
                    </button>
                    <button className="btn-secondary" onClick={handleCancelEdit} style={{ padding: '5px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <X size={14} /> 취소
                    </button>
                  </>
                )}
                <button className="btn-secondary" onClick={() => setSelectedAsset(null)} style={{ padding: '5px 12px', fontSize: '13px' }}>닫기</button>
              </div>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* 1. 기본 장비 정보 */}
              <section>
                <h4 style={{ fontWeight: '600', marginBottom: '12px', color: 'var(--primary)', fontSize: '14px' }}>1. 기본 장비 정보</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                  {isEditing ? (
                    <>
                      <div><label style={labelStyle}>관리번호</label><input style={inputStyle} value={editForm.assetNo || ''} onChange={ef('assetNo')} /></div>
                      <div><label style={labelStyle}>모델명</label><input style={inputStyle} value={editForm.modelName || ''} onChange={ef('modelName')} /></div>
                      <div><label style={labelStyle}>제조번호 (S/N)</label><input style={inputStyle} value={editForm.serialNo || ''} onChange={ef('serialNo')} /></div>
                      <div><label style={labelStyle}>제조사</label><input style={inputStyle} value={editForm.manufacturer || ''} onChange={ef('manufacturer')} /></div>
                      <div><label style={labelStyle}>제조년도</label><input style={inputStyle} value={editForm.manufactureYear || ''} onChange={ef('manufactureYear')} /></div>
                      <div>
                        <label style={labelStyle}>소유구분</label>
                        <select style={inputStyle} value={editForm.ownerType || 'OWNED'} onChange={ef('ownerType')}>
                          <option value="OWNED">당사자산</option>
                          <option value="RENTED">임차자산</option>
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>상태</label>
                        <select style={inputStyle} value={editForm.status || 'AVAILABLE'} onChange={ef('status')}>
                          {Object.values(ASSET_STATUS_SSOT).map(st => (
                            <option key={st.code} value={st.code}>{st.label}</option>
                          ))}
                        </select>
                      </div>
                      <div><label style={labelStyle}>비고1 (장비특기)</label><input style={inputStyle} value={editForm.memo1 || ''} onChange={ef('memo1')} /></div>
                      <div><label style={labelStyle}>비고2 (작업지시)</label><input style={inputStyle} value={editForm.memo2 || ''} onChange={ef('memo2')} /></div>
                    </>
                  ) : (
                    <>
                      <InfoItem label="관리번호" value={<strong>{selectedAsset.assetNo}</strong>} />
                      <InfoItem label="모델명" value={<strong>{selectedAsset.modelName}</strong>} />
                      <InfoItem label="제조번호 (S/N)" value={selectedAsset.serialNo || '-'} />
                      <InfoItem label="제조사" value={selectedAsset.manufacturer || '-'} />
                      <InfoItem label="제조년도" value={selectedAsset.manufactureYear || '-'} />
                      <InfoItem label="소유구분" value={selectedAsset.ownerType === 'OWNED' ? '당사자산' : '임차자산'} />
                      <InfoItem label="현재상태" value={<span className={`badge ${statusBadge(selectedAsset.status)}`}>{statusLabel(selectedAsset.status)}</span>} />
                      <InfoItem label="비고1 (장비특기)" value={selectedAsset.memo1 || '-'} />
                      <InfoItem label="비고2 (작업지시)" value={selectedAsset.memo2 || '-'} />
                    </>
                  )}
                </div>
              </section>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

              {/* 2. 현재 운용/임대 현황 */}
              <section>
                <h4 style={{ fontWeight: '600', marginBottom: '12px', color: 'var(--info)', fontSize: '14px' }}>2. 현재 운용 / 임대 현황</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                  {isEditing ? (
                    <>
                      <div><label style={labelStyle}>월 렌탈료 (원)</label><input type="number" style={inputStyle} value={editForm.monthlyRentalFee ?? ''} onChange={ef('monthlyRentalFee')} /></div>
                      <div><label style={labelStyle}>일 렌탈료 (원)</label><input type="number" style={inputStyle} value={editForm.dailyRentalFee ?? ''} onChange={ef('dailyRentalFee')} /></div>
                      <div><label style={labelStyle}>청구 마감일 (일)</label><input type="number" style={inputStyle} value={editForm.billingDay ?? ''} onChange={ef('billingDay')} /></div>
                      <div><label style={labelStyle}>계약 시작일</label><input type="date" style={inputStyle} value={editForm.contractStart || ''} onChange={ef('contractStart')} /></div>
                      <div><label style={labelStyle}>계약 종료일</label><input type="date" style={inputStyle} value={editForm.contractEnd || ''} onChange={ef('contractEnd')} /></div>
                    </>
                  ) : (
                    <>
                      <InfoItem label="계약번호" value={(() => { const ci = getAssetContractInfo(selectedAsset.id); return ci ? ci.contractNo : '-'; })()} />
                      <InfoItem label="현재 고객사" value={getCustomerName(selectedAsset.currentCustomerId)} />
                      <InfoItem label="사용 현장" value={getSiteName(selectedAsset.currentSiteId)} />
                      <InfoItem label="계약 기간" value={selectedAsset.contractStart ? `${selectedAsset.contractStart} ~ ${selectedAsset.contractEnd}` : '-'} />
                      <InfoItem label="청구 마감일" value={selectedAsset.billingDay ? `매달 ${selectedAsset.billingDay}일` : '-'} />
                      <InfoItem label="월 렌탈료" value={`${(selectedAsset.monthlyRentalFee || 0).toLocaleString()}원`} />
                      <InfoItem label="일 렌탈료" value={`${(selectedAsset.dailyRentalFee || 0).toLocaleString()}원`} />
                    </>
                  )}
                </div>
              </section>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

              {/* 3. 당사자산 IFRS 재무정보 */}
              {(isEditing ? editForm.ownerType === 'OWNED' : selectedAsset.ownerType === 'OWNED') && (() => {
                const depn = calculateAssetDepreciation(isEditing ? { ...selectedAsset, ...editForm } as Asset : selectedAsset);
                return (
                  <section>
                    <h4 style={{ fontWeight: '600', marginBottom: '12px', color: 'var(--success)', fontSize: '14px' }}>3. 당사자산 IFRS 감가상각 / 재무 가치</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                      {isEditing ? (
                        <>
                          <div><label style={labelStyle}>취득일자</label><input type="date" style={inputStyle} value={editForm.acquisitionDate || ''} onChange={ef('acquisitionDate')} /></div>
                          <div><label style={labelStyle}>취득원가 (원)</label><input type="number" style={inputStyle} value={editForm.acquisitionPrice ?? ''} onChange={ef('acquisitionPrice')} /></div>
                          <div><label style={labelStyle}>구입처 (매입처)</label><input style={inputStyle} value={editForm.supplier || ''} onChange={ef('supplier')} /></div>
                          <div><label style={labelStyle}>감가상각 개월수</label><input type="number" style={inputStyle} value={editForm.depreciationMonths ?? ''} onChange={ef('depreciationMonths')} /></div>
                          <div><label style={labelStyle}>잔존가치율 (%)</label><input type="number" style={inputStyle} value={editForm.residualValueRate ?? ''} onChange={ef('residualValueRate')} /></div>
                        </>
                      ) : (
                        <>
                          <InfoItem label="취득일자" value={selectedAsset.acquisitionDate || '-'} />
                          <InfoItem label="취득원가" value={`${(selectedAsset.acquisitionPrice || 0).toLocaleString()}원`} />
                          <InfoItem label="구입처 (매입처)" value={selectedAsset.supplier || '-'} />
                          <InfoItem label="감가상각 개월수" value={selectedAsset.depreciationMonths ? `${selectedAsset.depreciationMonths}개월 (경과: ${depn.elapsedMonths}개월)` : '-'} />
                          <InfoItem label="잔존가치율" value={`${selectedAsset.residualValueRate ?? 0}%`} />
                          <InfoItem label="감가상각 누계액" value={<span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>{depn.accumDepreciation.toLocaleString()}원</span>} />
                          <InfoItem label="미상각 잔액 (장부가치)" value={<strong style={{ color: 'var(--success)' }}>{depn.bookValue.toLocaleString()}원</strong>} />
                        </>
                      )}
                    </div>
                  </section>
                );
              })()}

              {/* 3. 임차자산 계약 정보 */}
              {(isEditing ? editForm.ownerType === 'RENTED' : selectedAsset.ownerType === 'RENTED') && (
                <section>
                  <h4 style={{ fontWeight: '600', marginBottom: '12px', color: 'var(--warning)', fontSize: '14px' }}>3. 재임차 계약 정보</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                    {isEditing ? (
                      <>
                        <div><label style={labelStyle}>임차처</label><input style={inputStyle} value={editForm.renter || ''} onChange={ef('renter')} /></div>
                        <div><label style={labelStyle}>임차 개시일</label><input type="date" style={inputStyle} value={editForm.rentStart || ''} onChange={ef('rentStart')} /></div>
                        <div><label style={labelStyle}>임차 만료일</label><input type="date" style={inputStyle} value={editForm.rentEnd || ''} onChange={ef('rentEnd')} /></div>
                        <div><label style={labelStyle}>월 임차료 (원)</label><input type="number" style={inputStyle} value={editForm.monthlyRentFee ?? ''} onChange={ef('monthlyRentFee')} /></div>
                        <div><label style={labelStyle}>일 임차료 (원)</label><input type="number" style={inputStyle} value={editForm.dailyRentFee ?? ''} onChange={ef('dailyRentFee')} /></div>
                      </>
                    ) : (
                      <>
                        <InfoItem label="임차처" value={selectedAsset.renter || '-'} />
                        <InfoItem label="임차 개시일" value={selectedAsset.rentStart || '-'} />
                        <InfoItem label="임차 만료일" value={selectedAsset.rentEnd || '-'} />
                        <InfoItem label="월 임차료" value={`${(selectedAsset.monthlyRentFee || 0).toLocaleString()}원`} />
                        <InfoItem label="일 임차료" value={`${(selectedAsset.dailyRentFee || 0).toLocaleString()}원`} />
                      </>
                    )}
                  </div>
                </section>
              )}

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

              {/* 4. 기수 기여 / 수리비 */}
              <section>
                <h4 style={{ fontWeight: '600', marginBottom: '12px', color: 'var(--text-main)', fontSize: '14px' }}>4. 기여액 (기수) / 수리비 현황</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                  {isEditing ? (
                    <>
                      <div><label style={labelStyle}>기여액 기수 누계 (원)</label><input type="number" style={inputStyle} value={editForm.cumRentalFee ?? ''} onChange={ef('cumRentalFee')} /></div>
                      <div><label style={labelStyle}>누적 수리비 (원)</label><input type="number" style={inputStyle} value={editForm.cumRepairCost ?? ''} onChange={ef('cumRepairCost')} /></div>
                    </>
                  ) : (
                    <>
                      <InfoItem label="기여액 (기수)" value={<span className="text-primary" style={{ fontWeight: '600' }}>{(selectedAsset.cumRentalFee || 0).toLocaleString()}원</span>} />
                      <InfoItem label="누적 수리비" value={<span className="text-danger" style={{ fontWeight: '600' }}>{(selectedAsset.cumRepairCost || 0).toLocaleString()}원</span>} />
                      <InfoItem
                        label="기수 순익"
                        value={<strong style={{ color: ((selectedAsset.cumRentalFee || 0) - (selectedAsset.cumRepairCost || 0)) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {((selectedAsset.cumRentalFee || 0) - (selectedAsset.cumRepairCost || 0)).toLocaleString()}원
                        </strong>}
                      />
                    </>
                  )}
                </div>
              </section>

              {/* 5. 정비 및 검수 이력 현황 */}
              {!isEditing && (
                <section style={{ backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '8px' }}>
                  <h4 style={{ fontWeight: '600', marginBottom: '12px', color: 'var(--warning)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Wrench size={16} /> 5. 자산 정비 및 검수 이력 현황
                  </h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                    <InfoItem
                      label="현재 정비필요점수"
                      value={
                        <span className={`badge ${(selectedAsset.maintenanceScore || 0) === 0 ? 'badge-success' : 'badge-warning'}`} style={{ fontWeight: 'bold' }}>
                          {selectedAsset.maintenanceScore || 0}점 {(selectedAsset.maintenanceScore || 0) === 0 ? '(이상무)' : '(검수대기)'}
                        </span>
                      }
                    />
                    <InfoItem
                      label="누적 정비/수리 횟수"
                      value={`${repairs.filter((r: Repair) => r.assetId === selectedAsset.id).length}회`}
                    />
                    <InfoItem
                      label="최근 입고 일자"
                      value={assetInOutLogs.filter((l: AssetInOutLog) => l.assetId === selectedAsset.id && l.type === 'INBOUND')[0]?.eventDate || '-'}
                    />
                  </div>

                  {/* 이력 조회 & 엑셀 내려받기 명시적 버튼 그룹 */}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', paddingTop: '10px', borderTop: '1px dashed var(--border-color)' }}>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => setShowHistoryToggle(!showHistoryToggle)}
                      style={{ flex: 1, padding: '8px 12px', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <Layers size={15} /> {showHistoryToggle ? '📜 자산이력 닫기' : '📜 자산이력 조회'}
                    </button>

                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleExportAssetHistoryExcel(selectedAsset)}
                      style={{ flex: 1, padding: '8px 12px', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--success)', borderColor: 'var(--success)' }}
                    >
                      <Download size={15} /> 📥 엑셀 내려받기
                    </button>
                  </div>

                  {/* 명시적 [자산이력 조회] 클릭 시에만 자산이력 표출 */}
                  {showHistoryToggle && (
                    <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                      {(() => {
                        const unifiedLogs = getUnifiedAssetLogs(selectedAsset);
                        return (
                          <>
                            <h5 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold' }}>
                              자산이력 ({unifiedLogs.length}건)
                            </h5>

                            {unifiedLogs.length === 0 ? (
                              <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>
                                기록된 입출고 및 정비 이력이 없습니다.
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderLeft: '2px solid var(--border-color)', paddingLeft: '12px', marginLeft: '4px' }}>
                                {unifiedLogs.map((log: AssetInOutLog, idx: number) => (
                                  <div key={idx} style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span className={`badge ${log.type === 'ACQUISITION' ? 'badge-info' : log.type === 'OUTBOUND' ? 'badge-primary' : log.type === 'INBOUND' ? 'badge-success' : log.type === 'DISPOSAL' ? 'badge-danger' : 'badge-warning'}`}>
                                        {log.type === 'ACQUISITION' ? '취득' : log.type === 'OUTBOUND' ? '출고' : log.type === 'INBOUND' ? '입고' : log.type === 'INBOUND_CANCEL' ? '입고취소' : log.type === 'DISPOSAL' ? '매각' : '정비'}
                                      </span>
                                      <strong>{log.eventDate}</strong>
                                      {log.inboundNo && <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>[{log.inboundNo}]</span>}
                                      {log.customerName && <span>(거래처: {log.customerName})</span>}
                                    </div>
                                    <div style={{ color: 'var(--text-secondary)', paddingLeft: '4px' }}>
                                      {log.memo || '이상 무'}
                                      {log.defectsJson && (
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                                          {JSON.parse(log.defectsJson).map((d: any, dIdx: number) => (
                                            <span key={dIdx} className="badge badge-secondary" style={{ fontSize: '10px' }}>
                                              {d.subNo}: {d.checkitemName} (+{d.score}점)
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </section>
              )}

              {/* 수정 모드 하단 저장 버튼 */}
              {isEditing && (
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                  <button className="btn-success" onClick={handleSaveEdit} style={{ padding: '8px 20px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Save size={15} /> 변경 사항 저장
                  </button>
                  <button className="btn-secondary" onClick={handleCancelEdit} style={{ padding: '8px 16px', fontSize: '14px' }}>
                    취소
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// ─── 헬퍼 스타일
const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-muted)',
  fontWeight: '600',
  display: 'block',
  marginBottom: '3px',
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  fontSize: '13px',
  borderRadius: '6px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-app)',
  color: 'var(--text-main)',
  boxSizing: 'border-box',
};

// ─── InfoItem 컴포넌트
const InfoItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <label style={labelStyle}>{label}</label>
    <div style={{ fontSize: '13px', color: 'var(--text-main)' }}>{value}</div>
  </div>
);
