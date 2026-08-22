// d:\Kiyeun_Lift\src\pages\Repairs.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Wrench, Plus, CheckCircle, Smartphone, User, Settings, Download, Search, 
  Calendar, AlertTriangle, Clock, Camera, Image, ShieldCheck, ArrowRight, RefreshCw, X,
  Truck, PenTool, Check, ChevronRight, FileText
} from 'lucide-react';
import { Repair } from '../services/db';
import { exportToExcel } from '../services/excel';

// 10대 자주 쓰는 정비 작업 프리셋 태그
const QUICK_WORK_TAGS = [
  '유압유(작동유) 보충',
  '배터리 증류수 보충 및 터미널 청소',
  '상하강 리밋 스위치 교체',
  '상부 조종기 레버 센서 점검 및 수리',
  '배터리 충전기 및 전원선 점검',
  '구동 모터 브러시 점검',
  '경광등 및 후진 부저 수리',
  '상승 체인 및 와이어 장력 조절',
  '주요 관절부 그리스 주유',
  '비상 수동 하강 밸브 점검'
];

export const Repairs: React.FC = () => {
  const {
    repairs, assets, consumables, repairConsumables, mechanicConsumableStocks, registerRepair, updateRepairStatus, 
    hasPermission, users, currentUser, vendors, contracts, contractAssets, sites, customers
  } = useApp();

  const canSave = hasPermission('repair', 'save');
  const isMechanic = currentUser?.role === 'MECHANIC';

  // 뷰 모드 탭: 'LEDGER' (정비 대장) vs 'SCHEDULER' (AS 출장/예방정비 스케줄러)
  const [activeViewTab, setActiveViewTab] = useState<'LEDGER' | 'SCHEDULER'>('LEDGER');

  // --- 정비 조회 필터 상태 ---
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempTypeFilter, setTempTypeFilter] = useState('ALL');
  const [tempStatusFilter, setTempStatusFilter] = useState('ALL');
  
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');
  const [tempBillableFilter, setTempBillableFilter] = useState('ALL');
  const [tempMechanicFilter, setTempMechanicFilter] = useState('ALL');

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [billableFilter, setBillableFilter] = useState('ALL');
  const [mechanicFilter, setMechanicFilter] = useState('ALL');

  // 정비 등록/수정 모달 및 상태
  const [showModal, setShowModal] = useState(false);
  const [editingRepair, setEditingRepair] = useState<Partial<Repair> | null>(null);

  // 정비 상세 모달 상태
  const [selectedDetailRepair, setSelectedDetailRepair] = useState<Repair | null>(null);

  // 미완료 상태 변경 모달
  const [unresolvedModalRepair, setUnresolvedModalRepair] = useState<Repair | null>(null);
  const [unresolvedReasonInput, setUnresolvedReasonInput] = useState('');
  const [nextActionInput, setNextActionInput] = useState<Repair['nextAction']>('REVISIT');

  // 사용한 소모품 임시 추가 목록 (정비 등록 모달 내)
  const [selectedConsumables, setSelectedConsumables] = useState<{ consumableId: string; quantity: number }[]>([]);
  const [tempConsumableId, setTempConsumableId] = useState('');
  const [tempQty, setTempQty] = useState(1);

  // 현장 증빙 사진 2분할 (정비 전 / 정비 후)
  const [beforeImage, setBeforeImage] = useState<string>('');
  const [afterImage, setAfterImage] = useState<string>('');
  const [otherImages, setOtherImages] = useState<string[]>([]);

  // ✍️ 현장 고객사 전자서명 Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState<string>('');

  const getAssetNo = (id: string) => assets.find(a => a.id === id)?.assetNo || '-';
  const getAssetModel = (id: string) => assets.find(a => a.id === id)?.modelName || '-';
  const getMechanicName = (id?: string) => users.find(u => u.id === id)?.name || '정비사';

  // 장비가 현재 대여중인 계약 현장 및 고객사 조회
  const getAssetRentalInfo = (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset || asset.status !== 'RENTED') return null;

    const activeContractAsset = (contractAssets || []).find(ca => ca.assetId === assetId && ca.status !== 'RETURNED');
    if (!activeContractAsset) return null;

    const activeContract = (contracts || []).find(c => c.id === activeContractAsset.contractId);
    if (!activeContract) return null;

    const customer = (customers || []).find(cu => cu.id === activeContract.customerId);
    const site = (sites || []).find(s => s.id === activeContract.siteId);

    return {
      contractNo: activeContract.contractNo,
      customerName: customer?.name || '-',
      siteName: site?.name || '-',
      siteAddress: site?.address || '-'
    };
  };

  // 현재 로그인한 정비사의 특정 소모품 차량 재고 수량 확인
  const getMyVehicleStockQty = (consumableId: string, mechanicId?: string) => {
    const targetMechId = mechanicId || currentUser?.id;
    if (!targetMechId) return 0;
    const stock = (mechanicConsumableStocks || []).find(ms => ms.mechanicId === targetMechId && ms.consumableId === consumableId);
    return stock?.stockQty || 0;
  };

  const handleSearchClick = () => {
    setSearchTerm(tempSearchTerm);
    setTypeFilter(tempTypeFilter);
    setStatusFilter(tempStatusFilter);
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setBillableFilter(tempBillableFilter);
    setMechanicFilter(tempMechanicFilter);
  };

  const filteredRepairs = repairs.filter(r => {
    const assetNo = getAssetNo(r.assetId).toLowerCase();
    const assetModel = getAssetModel(r.assetId).toLowerCase();
    const vendorName = r.vendorId ? (vendors.find(v => v.id === r.vendorId)?.name || '').toLowerCase() : '';
    const custName = (r.customerName || '').toLowerCase();
    const siteName = (r.siteName || '').toLowerCase();
    
    const matchesSearch = 
      assetNo.includes(searchTerm.toLowerCase()) || 
      assetModel.includes(searchTerm.toLowerCase()) || 
      vendorName.includes(searchTerm.toLowerCase()) || 
      custName.includes(searchTerm.toLowerCase()) || 
      siteName.includes(searchTerm.toLowerCase()) || 
      (r.details && r.details.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = typeFilter === 'ALL' || 
      (r.maintenanceType ? r.maintenanceType === typeFilter : r.repairType === typeFilter);
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;

    const reqDate = r.scheduleDate || r.requestDate || '';
    const matchesDateStart = !startDate || reqDate >= startDate;
    const matchesDateEnd = !endDate || reqDate <= endDate;
    const matchesBillable = billableFilter === 'ALL' ||
      (billableFilter === 'BILLABLE' && r.billableToCustomer) ||
      (billableFilter === 'INTERNAL' && !r.billableToCustomer);
    const matchesMechanic = mechanicFilter === 'ALL' || r.mechanicId === mechanicFilter;

    return matchesSearch && matchesType && matchesStatus && matchesDateStart && matchesDateEnd && matchesBillable && matchesMechanic;
  });

  const handleExportExcel = () => {
    const excelData = filteredRepairs.map((r, idx) => ({
      'No': idx + 1,
      '자산번호': getAssetNo(r.assetId),
      '모델명': getAssetModel(r.assetId),
      '정비 구분': r.maintenanceType === 'EMERGENCY_AS' ? '긴급출장정비' :
                  r.maintenanceType === 'PREVENTIVE' ? '정기예방정비' :
                  r.maintenanceType === 'EXTERNAL' ? '외주정비' : '야적장자사정비',
      '고객사/현장': r.customerName ? `${r.customerName} (${r.siteName || '-'})` : '-',
      '정비 상태': r.status === 'SCHEDULED' ? '방문예정' :
                  r.status === 'IN_PROGRESS' ? '정비중' :
                  r.status === 'UNRESOLVED' ? `미완료 (${r.unresolvedReason || '-'})` : '정비완료',
      '방문/의뢰일': r.scheduleDate || r.requestDate || '-',
      '정비완료일': r.repairDate || '-',
      '정비 내용': r.details || '',
      '정비 총비용': `${(r.totalCost || 0).toLocaleString()}원`,
      '고객사 청구여부': r.billableToCustomer ? '청구' : '미청구',
      '담당 정비사': getMechanicName(r.mechanicId),
      '후속 조치': r.nextAction === 'REVISIT' ? '재방문' : r.nextAction === 'EXCHANGE_REQUEST' ? '대차의뢰' : '-'
    }));

    exportToExcel(excelData, `정비정리대장_${new Date().toISOString().split('T')[0]}`, '정비목록');
  };

  const handleOpenAdd = (defaultType: Repair['maintenanceType'] = 'EMERGENCY_AS') => {
    const defaultAsset = assets.find(a => defaultType === 'EMERGENCY_AS' || defaultType === 'PREVENTIVE' ? a.status === 'RENTED' : true) || assets[0];
    const rentalInfo = defaultAsset ? getAssetRentalInfo(defaultAsset.id) : null;

    setEditingRepair({
      assetId: defaultAsset?.id || '',
      maintenanceType: defaultType,
      repairType: defaultType === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL',
      requestDate: new Date().toISOString().split('T')[0],
      scheduleDate: new Date().toISOString().split('T')[0],
      repairDate: new Date().toISOString().split('T')[0],
      status: defaultType === 'PREVENTIVE' ? 'SCHEDULED' : 'COMPLETED',
      details: '',
      totalCost: 0,
      billableToCustomer: false,
      customerName: rentalInfo?.customerName || '',
      siteName: rentalInfo?.siteName || '',
      evidenceImages: []
    });
    setSelectedConsumables([]);
    setBeforeImage('');
    setAfterImage('');
    setOtherImages([]);
    setSignatureData('');
    setShowModal(true);
  };

  const handleAssetSelectChange = (assetId: string) => {
    const rentalInfo = getAssetRentalInfo(assetId);
    setEditingRepair(prev => prev ? ({
      ...prev,
      assetId,
      customerName: rentalInfo?.customerName || prev.customerName || '',
      siteName: rentalInfo?.siteName || prev.siteName || ''
    }) : null);
  };

  // 자주 쓰는 작업 태그 클릭 시 상세란에 콤마/줄바꿈으로 추가
  const handleAddQuickTag = (tag: string) => {
    setEditingRepair(prev => {
      if (!prev) return null;
      const current = prev.details ? prev.details.trim() : '';
      const newDetails = current ? `${current}\n• ${tag}` : `• ${tag}`;
      return { ...prev, details: newDetails };
    });
  };

  // TOP 4 소모품 퀵 +1 추가 (내 차량 재고 표시)
  const handleQuickAddConsumable = (cId: string) => {
    setSelectedConsumables(prev => {
      const existing = prev.find(item => item.consumableId === cId);
      if (existing) {
        return prev.map(item => item.consumableId === cId ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { consumableId: cId, quantity: 1 }];
    });
  };

  const handleAddConsumableToRepair = () => {
    if (!tempConsumableId) return;
    const existing = selectedConsumables.find(c => c.consumableId === tempConsumableId);
    if (existing) {
      setSelectedConsumables(selectedConsumables.map(c => c.consumableId === tempConsumableId ? { ...c, quantity: c.quantity + tempQty } : c));
    } else {
      setSelectedConsumables([...selectedConsumables, { consumableId: tempConsumableId, quantity: tempQty }]);
    }
    setTempConsumableId('');
    setTempQty(1);
  };

  const handleRemoveConsumableFromRepair = (cId: string) => {
    setSelectedConsumables(selectedConsumables.filter(c => c.consumableId !== cId));
  };

  // 이미지 업로드 헬퍼
  const handleSingleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'BEFORE' | 'AFTER' | 'OTHER') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      if (base64) {
        if (type === 'BEFORE') setBeforeImage(base64);
        else if (type === 'AFTER') setAfterImage(base64);
        else setOtherImages(prev => [...prev, base64]);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 서명 캔버스 이벤트 핸들러
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureData(canvas.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !editingRepair || !editingRepair.assetId) {
      alert('정비 등록 내용을 확인해 주세요.');
      return;
    }

    const allImages: string[] = [];
    if (beforeImage) allImages.push(beforeImage);
    if (afterImage) allImages.push(afterImage);
    if (signatureData) allImages.push(signatureData);
    allImages.push(...otherImages);

    const payload: Partial<Repair> = {
      ...editingRepair,
      evidenceImages: allImages
    };

    registerRepair(payload, selectedConsumables);
    alert('정비 보고가 완료되었습니다. 담당 정비사 차량 재고 차감 및 자산 정비이력이 정상 적재되었습니다.');
    setShowModal(false);
    setEditingRepair(null);
    setSelectedConsumables([]);
    setBeforeImage('');
    setAfterImage('');
    setOtherImages([]);
    setSignatureData('');
  };

  const handleQuickComplete = (repair: Repair) => {
    if (!window.confirm(`[${getAssetNo(repair.assetId)}] 정비를 완료 처리하시겠습니까?`)) return;
    updateRepairStatus(repair.id, 'COMPLETED');
  };

  const handleOpenUnresolved = (repair: Repair) => {
    setUnresolvedModalRepair(repair);
    setUnresolvedReasonInput(repair.unresolvedReason || '부품 수급 대기');
    setNextActionInput(repair.nextAction || 'REVISIT');
  };

  const handleSubmitUnresolved = () => {
    if (!unresolvedModalRepair) return;
    updateRepairStatus(unresolvedModalRepair.id, 'UNRESOLVED', unresolvedReasonInput, nextActionInput);
    alert(`정비 미완료 처리가 기록되었습니다. (후속조치: ${nextActionInput === 'EXCHANGE_REQUEST' ? '대차의뢰' : '재방문'})`);
    setUnresolvedModalRepair(null);
  };

  return (
    <div>
      {/* 상단 헤더 및 뷰 전환 탭 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontWeight: '800', margin: 0 }}>장비 정비 및 AS 관리</h2>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            현장 출장 AS, 정기 예방정비, 차량 이동재고(Van Stock) 차감 및 원터치 증빙 수집
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* 뷰 모드 탭 */}
          <div style={{ display: 'flex', backgroundColor: 'var(--bg-app)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => setActiveViewTab('LEDGER')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: activeViewTab === 'LEDGER' ? '700' : '500',
                backgroundColor: activeViewTab === 'LEDGER' ? 'var(--bg-card)' : 'transparent',
                color: activeViewTab === 'LEDGER' ? 'var(--primary)' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                boxShadow: activeViewTab === 'LEDGER' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              정비수리 대장
            </button>
            <button
              type="button"
              onClick={() => setActiveViewTab('SCHEDULER')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: activeViewTab === 'SCHEDULER' ? '700' : '500',
                backgroundColor: activeViewTab === 'SCHEDULER' ? 'var(--bg-card)' : 'transparent',
                color: activeViewTab === 'SCHEDULER' ? 'var(--primary)' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                boxShadow: activeViewTab === 'SCHEDULER' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Calendar size={13} /> AS 출장/예방정비 스케줄러
            </button>
          </div>

          {canSave && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="btn-primary" onClick={() => handleOpenAdd('EMERGENCY_AS')} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '6px 12px' }}>
                <Plus size={14} /> 긴급 출장 AS 접수
              </button>
              <button className="btn-secondary" onClick={() => handleOpenAdd('PREVENTIVE')} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '6px 12px' }}>
                <ShieldCheck size={14} /> 정기 예방정비 등록
              </button>
            </div>
          )}
        </div>
      </div>

      {isMechanic && (
        <div className="card" style={{ backgroundColor: 'var(--primary-light)', borderColor: 'var(--primary)', marginBottom: '16px', padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ color: 'var(--primary)', fontWeight: '700', margin: 0 }}>안녕하세요, {currentUser.name} 정비사님</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                현장 출동 시 퀵 작업 태그를 터치하고, 차량에 적재된 소모품을 1초 만에 투입 완료할 수 있습니다.
              </p>
            </div>
            <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
              <Smartphone size={13} /> 현장 모바일 10초 입력 지원
            </span>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 탭 1: AS 출장/예방정비 스케줄러 뷰 */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeViewTab === 'SCHEDULER' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            
            {/* 칼럼 1: 방문 예정 */}
            <div className="card" style={{ padding: '14px', backgroundColor: 'var(--bg-card)', borderTop: '4px solid #3b82f6', margin: 0 }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={15} className="text-primary" /> 방문 예정 ({repairs.filter(r => r.status === 'SCHEDULED' || r.status === 'PENDING').length}건)
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '600px', overflowY: 'auto' }}>
                {repairs.filter(r => r.status === 'SCHEDULED' || r.status === 'PENDING').length === 0 ? (
                  <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                    방문 예정인 AS 일정이 없습니다.
                  </div>
                ) : (
                  repairs.filter(r => r.status === 'SCHEDULED' || r.status === 'PENDING').map(r => (
                    <div key={r.id} style={{ padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <span className={`badge ${r.maintenanceType === 'PREVENTIVE' ? 'badge-info' : 'badge-danger'}`} style={{ fontSize: '10px' }}>
                          {r.maintenanceType === 'PREVENTIVE' ? '정기예방정비' : '긴급출장 AS'}
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary)' }}>{r.scheduleDate || r.requestDate}</span>
                      </div>
                      
                      <div style={{ fontSize: '13px', fontWeight: '800' }}>
                        {getAssetNo(r.assetId)} <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--text-muted)' }}>({getAssetModel(r.assetId)})</span>
                      </div>
                      
                      {r.customerName && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          🏢 {r.customerName} | 📍 {r.siteName || '현장'}
                        </div>
                      )}

                      <div style={{ fontSize: '12px', color: 'var(--text-main)', marginTop: '6px', backgroundColor: 'var(--bg-card)', padding: '6px', borderRadius: '4px' }}>
                        {r.details || '정비 상세 내용 없음'}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed var(--border-color)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>👤 {getMechanicName(r.mechanicId)}</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button type="button" className="btn-secondary" onClick={() => updateRepairStatus(r.id, 'IN_PROGRESS')} style={{ padding: '3px 8px', fontSize: '11px' }}>
                            출발
                          </button>
                          <button type="button" className="btn-primary" onClick={() => handleQuickComplete(r)} style={{ padding: '3px 8px', fontSize: '11px' }}>
                            완료
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 칼럼 2: 현장 정비중 */}
            <div className="card" style={{ padding: '14px', backgroundColor: 'var(--bg-card)', borderTop: '4px solid #f59e0b', margin: 0 }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Wrench size={15} className="text-warning" /> 현장 정비중 ({repairs.filter(r => r.status === 'IN_PROGRESS').length}건)
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '600px', overflowY: 'auto' }}>
                {repairs.filter(r => r.status === 'IN_PROGRESS').length === 0 ? (
                  <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                    현재 진행 중인 현장 정비가 없습니다.
                  </div>
                ) : (
                  repairs.filter(r => r.status === 'IN_PROGRESS').map(r => (
                    <div key={r.id} style={{ padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid #f59e0b' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <span className="badge badge-warning" style={{ fontSize: '10px' }}>정비 진행중</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.scheduleDate || r.requestDate}</span>
                      </div>
                      
                      <div style={{ fontSize: '13px', fontWeight: '800' }}>
                        {getAssetNo(r.assetId)} <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--text-muted)' }}>({getAssetModel(r.assetId)})</span>
                      </div>
                      
                      {r.customerName && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          🏢 {r.customerName} | 📍 {r.siteName || '현장'}
                        </div>
                      )}

                      <div style={{ fontSize: '12px', marginTop: '6px' }}>{r.details}</div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed var(--border-color)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>👤 {getMechanicName(r.mechanicId)}</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button type="button" className="btn-danger" onClick={() => handleOpenUnresolved(r)} style={{ padding: '3px 8px', fontSize: '11px' }}>
                            미완료
                          </button>
                          <button type="button" className="btn-primary" onClick={() => handleQuickComplete(r)} style={{ padding: '3px 8px', fontSize: '11px' }}>
                            완료보고
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 칼럼 3: 미완료 건 관리 */}
            <div className="card" style={{ padding: '14px', backgroundColor: 'var(--bg-card)', borderTop: '4px solid #ef4444', margin: 0 }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--danger)' }}>
                <AlertTriangle size={15} /> 미완료 / 부품대기 ({repairs.filter(r => r.status === 'UNRESOLVED').length}건)
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '600px', overflowY: 'auto' }}>
                {repairs.filter(r => r.status === 'UNRESOLVED').length === 0 ? (
                  <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                    미완료 정비 건이 없습니다.
                  </div>
                ) : (
                  repairs.filter(r => r.status === 'UNRESOLVED').map(r => (
                    <div key={r.id} style={{ padding: '12px', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fca5a5' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <span className="badge badge-danger" style={{ fontSize: '10px' }}>미완료</span>
                        <span className="badge badge-secondary" style={{ fontSize: '10px' }}>
                          후속: {r.nextAction === 'EXCHANGE_REQUEST' ? '대차의뢰' : r.nextAction === 'REVISIT' ? '재방문' : '없음'}
                        </span>
                      </div>
                      
                      <div style={{ fontSize: '13px', fontWeight: '800', color: '#991b1b' }}>
                        {getAssetNo(r.assetId)} <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--text-muted)' }}>({getAssetModel(r.assetId)})</span>
                      </div>

                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#b91c1c', marginTop: '4px' }}>
                        ⚠️ 사유: {r.unresolvedReason || '사유 미기재'}
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--text-main)', marginTop: '4px' }}>{r.details}</div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginTop: '8px' }}>
                        <button type="button" className="btn-secondary" onClick={() => updateRepairStatus(r.id, 'IN_PROGRESS')} style={{ padding: '3px 8px', fontSize: '11px' }}>
                          재방문 진행
                        </button>
                        <button type="button" className="btn-primary" onClick={() => handleQuickComplete(r)} style={{ padding: '3px 8px', fontSize: '11px' }}>
                          완료 처리
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 칼럼 4: 최근 완료 건 */}
            <div className="card" style={{ padding: '14px', backgroundColor: 'var(--bg-card)', borderTop: '4px solid #10b981', margin: 0 }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px', color: '#059669' }}>
                <CheckCircle size={15} /> 최근 완료 ({repairs.filter(r => r.status === 'COMPLETED').length}건)
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '600px', overflowY: 'auto' }}>
                {repairs.filter(r => r.status === 'COMPLETED').slice(0, 10).map(r => (
                  <div key={r.id} onDoubleClick={() => setSelectedDetailRepair(r)} style={{ padding: '10px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '12.5px', color: 'var(--primary)' }}>{getAssetNo(r.assetId)}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.repairDate}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-main)' }}>{r.details}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <span>비용: {(r.totalCost || 0).toLocaleString()}원</span>
                      <span>정비사: {getMechanicName(r.mechanicId)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 탭 2: 정비수리 대장 뷰 */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeViewTab === 'LEDGER' && (
        <div className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title" style={{ margin: 0 }}>정비수리 대장</h3>
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={handleExportExcel}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '6px 12px' }}
            >
              <Download size={12} /> 엑셀 다운로드
            </button>
          </div>

          {/* 필터 바 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px', alignItems: 'end', backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px', display: 'block', whiteSpace: 'nowrap' }}>자산/현장/고객사 검색</label>
              <input 
                type="text" 
                value={tempSearchTerm} 
                onChange={e => setTempSearchTerm(e.target.value)} 
                placeholder="자산번호, 고객사, 현장명, 수리내용..."
                style={{ width: '100%', padding: '6px', fontSize: '12.5px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px', display: 'block', whiteSpace: 'nowrap' }}>정비 구분</label>
              <select 
                value={tempTypeFilter} 
                onChange={e => setTempTypeFilter(e.target.value)} 
                style={{ width: '100%', padding: '6px', fontSize: '12.5px' }}
              >
                <option value="ALL">전체 정비구분</option>
                <option value="EMERGENCY_AS">긴급 출장정비 (EMERGENCY_AS)</option>
                <option value="PREVENTIVE">정기 예방정비 (PREVENTIVE)</option>
                <option value="INHOUSE_REPAIR">야적장 자사정비 (INHOUSE)</option>
                <option value="EXTERNAL">외주 정비 (EXTERNAL)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px', display: 'block', whiteSpace: 'nowrap' }}>진행 상태</label>
              <select 
                value={tempStatusFilter} 
                onChange={e => setTempStatusFilter(e.target.value)} 
                style={{ width: '100%', padding: '6px', fontSize: '12.5px' }}
              >
                <option value="ALL">전체 진행상태</option>
                <option value="SCHEDULED">방문예정 (SCHEDULED)</option>
                <option value="IN_PROGRESS">정비중 (IN_PROGRESS)</option>
                <option value="COMPLETED">정비완료 (COMPLETED)</option>
                <option value="UNRESOLVED">미완료 (UNRESOLVED)</option>
              </select>
            </div>
            <button 
              type="button" 
              className="btn-primary" 
              onClick={handleSearchClick}
              style={{ padding: '6px 12px', height: '33px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12.5px' }}
            >
              조회
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr auto', gap: '10px', alignItems: 'end', backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px', marginTop: '-6px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', display: 'block', whiteSpace: 'nowrap' }}>의뢰/방문일</label>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input type="date" value={tempStartDate} onChange={e => setTempStartDate(e.target.value)} style={{ padding: '6px', fontSize: '12.5px' }} />
                <span>~</span>
                <input type="date" value={tempEndDate} onChange={e => setTempEndDate(e.target.value)} style={{ padding: '6px', fontSize: '12.5px' }} />
                
                <div style={{ display: 'flex', gap: '2px', marginLeft: '4px' }}>
                  <button type="button" className="btn-secondary" style={{ fontSize: '11px', padding: '4px 6px' }} onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setTempStartDate(today); setTempEndDate(today);
                  }}>오늘</button>
                  <button type="button" className="btn-secondary" style={{ fontSize: '11px', padding: '4px 6px' }} onClick={() => {
                    const d = new Date(); d.setDate(d.getDate() - 7);
                    setTempStartDate(d.toISOString().split('T')[0]); setTempEndDate(new Date().toISOString().split('T')[0]);
                  }}>1주</button>
                  <button type="button" className="btn-secondary" style={{ fontSize: '11px', padding: '4px 6px' }} onClick={() => {
                    const d = new Date(); d.setMonth(d.getMonth() - 1);
                    setTempStartDate(d.toISOString().split('T')[0]); setTempEndDate(new Date().toISOString().split('T')[0]);
                  }}>1개월</button>
                  <button type="button" className="btn-secondary" style={{ fontSize: '11px', padding: '4px 6px' }} onClick={() => {
                    setTempStartDate(''); setTempEndDate('');
                  }}>전체</button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', display: 'block', whiteSpace: 'nowrap' }}>청구구분</label>
              <select value={tempBillableFilter} onChange={e => setTempBillableFilter(e.target.value)} style={{ padding: '6px', fontSize: '12.5px', width: '100%' }}>
                <option value="ALL">전체</option>
                <option value="BILLABLE">고객사청구</option>
                <option value="INTERNAL">자사비용</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', display: 'block', whiteSpace: 'nowrap' }}>담당정비사</label>
              <select value={tempMechanicFilter} onChange={e => setTempMechanicFilter(e.target.value)} style={{ padding: '6px', fontSize: '12.5px', width: '100%' }}>
                <option value="ALL">전체</option>
                {users.filter(u => u.role === 'MECHANIC').map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <button 
              type="button" 
              className="btn-secondary"
              onClick={() => {
                setTempSearchTerm('');
                setTempTypeFilter('ALL');
                setTempStatusFilter('ALL');
                setTempStartDate('');
                setTempEndDate('');
                setTempBillableFilter('ALL');
                setTempMechanicFilter('ALL');
              }}
              style={{ padding: '6px 12px', height: '33px', fontSize: '12.5px' }}
            >
              초기화
            </button>
          </div>

          <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>정비구분</th>
                  <th>정비장비</th>
                  <th>고객사 / 현장</th>
                  <th>방문/의뢰일</th>
                  <th>완료일</th>
                  <th>정비 내용</th>
                  <th>총 수리비</th>
                  <th>청구 구분</th>
                  <th>담당 정비사</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {filteredRepairs.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                      {repairs.length === 0 ? '📭 등록된 정비 이력이 없습니다.' : '🔍 조회 조건에 맞는 정비 이력이 없습니다.'}
                    </td>
                  </tr>
                ) : (
                  filteredRepairs.map(r => (
                    <tr key={r.id} onDoubleClick={() => setSelectedDetailRepair(r)} style={{ cursor: 'pointer' }} title="더블클릭하여 수리 상세 조회">
                      <td>
                        <span className={`badge ${
                          r.maintenanceType === 'EMERGENCY_AS' ? 'badge-danger' :
                          r.maintenanceType === 'PREVENTIVE' ? 'badge-info' :
                          r.maintenanceType === 'EXTERNAL' ? 'badge-warning' : 'badge-secondary'
                        }`} style={{ fontSize: '11px' }}>
                          {r.maintenanceType === 'EMERGENCY_AS' ? '긴급출장' :
                           r.maintenanceType === 'PREVENTIVE' ? '정기예방' :
                           r.maintenanceType === 'EXTERNAL' ? '외주정비' : '야적장정비'}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--primary)' }}>{getAssetNo(r.assetId)}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{getAssetModel(r.assetId)}</div>
                      </td>
                      <td>
                        {r.customerName ? (
                          <div>
                            <div style={{ fontWeight: '600', fontSize: '12px' }}>{r.customerName}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.siteName || '-'}</div>
                          </div>
                        ) : '-'}
                      </td>
                      <td>{r.scheduleDate || r.requestDate}</td>
                      <td>{r.repairDate || '-'}</td>
                      <td style={{ maxWidth: '240px', fontSize: '12px' }}>
                        {r.unresolvedReason && (
                          <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--danger)', marginBottom: '2px' }}>
                            ⚠️ 미완료사유: {r.unresolvedReason}
                          </div>
                        )}
                        <div style={{ whiteSpace: 'pre-wrap' }}>{r.details}</div>
                        {(r.evidenceImages && r.evidenceImages.length > 0) && (
                          <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', fontSize: '11px' }}>
                            <Camera size={12} /> 증빙 {r.evidenceImages.length}건
                          </div>
                        )}
                      </td>
                      <td style={{ fontWeight: '600' }}>
                        {r.totalCost.toLocaleString()}원
                      </td>
                      <td>
                        <span className={`badge ${r.billableToCustomer ? 'badge-danger' : 'badge-secondary'}`}>
                          {r.billableToCustomer ? '고객사 청구' : '자사 비용'}
                        </span>
                      </td>
                      <td>{getMechanicName(r.mechanicId)}</td>
                      <td>
                        <span className={`badge ${
                          r.status === 'COMPLETED' ? 'badge-success' :
                          r.status === 'IN_PROGRESS' ? 'badge-warning' :
                          r.status === 'UNRESOLVED' ? 'badge-danger' : 'badge-secondary'
                        }`}>
                          {r.status === 'COMPLETED' ? '정비완료' :
                           r.status === 'IN_PROGRESS' ? '정비중' :
                           r.status === 'UNRESOLVED' ? '미완료' : '방문예정'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 📱 현장 모바일 10초 퀵 정비 등록/보고 모달 */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {showModal && editingRepair && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleSubmit} className="card" style={{ width: '95%', maxWidth: '680px', maxHeight: '92vh', overflowY: 'auto', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '12px' }}>
              <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Wrench className="text-primary" /> 현장 AS 정비 보고서
              </h3>
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)} style={{ padding: '3px 8px' }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              
              {/* 1. 정비 유형 선택 */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', display: 'block' }}>정비 유형</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {[
                    { id: 'EMERGENCY_AS', label: '긴급 출장 AS' },
                    { id: 'PREVENTIVE', label: '정기 예방정비' },
                    { id: 'INHOUSE_REPAIR', label: '야적장 자사정비' },
                    { id: 'EXTERNAL', label: '외주 위탁정비' }
                  ].map(t => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setEditingRepair({ 
                        ...editingRepair, 
                        maintenanceType: t.id as Repair['maintenanceType'],
                        repairType: t.id === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL'
                      })}
                      style={{
                        padding: '6px 4px',
                        textAlign: 'center',
                        borderRadius: '6px',
                        border: editingRepair.maintenanceType === t.id ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        backgroundColor: editingRepair.maintenanceType === t.id ? 'var(--primary-light)' : 'var(--bg-app)',
                        color: editingRepair.maintenanceType === t.id ? 'var(--primary)' : 'var(--text-main)',
                        fontWeight: editingRepair.maintenanceType === t.id ? '800' : '500',
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. 대상 자산 및 상태 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '600' }}>정비 대상 장비 *</label>
                  <select 
                    value={editingRepair.assetId} 
                    onChange={e => handleAssetSelectChange(e.target.value)} 
                    required
                    style={{ width: '100%', padding: '6px', fontSize: '12px' }}
                  >
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.assetNo} ({a.modelName}) - [{a.status === 'RENTED' ? '현장대여중' : a.status}]
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '600' }}>진행 상태 *</label>
                  <select 
                    value={editingRepair.status} 
                    onChange={e => setEditingRepair({ ...editingRepair, status: e.target.value as Repair['status'] })} 
                    required
                    style={{ width: '100%', padding: '6px', fontSize: '12px' }}
                  >
                    <option value="COMPLETED">정비 완료 (COMPLETED)</option>
                    <option value="IN_PROGRESS">정비 진행중 (IN_PROGRESS)</option>
                    <option value="SCHEDULED">방문 예정 (SCHEDULED)</option>
                    <option value="UNRESOLVED">미완료/부품대기 (UNRESOLVED)</option>
                  </select>
                </div>
              </div>

              {/* 출장정비 시 고객사/현장 정보 */}
              {(editingRepair.customerName || editingRepair.siteName) && (
                <div style={{ padding: '6px 10px', backgroundColor: 'var(--bg-app)', borderRadius: '4px', fontSize: '11.5px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>🏢 고객사: <strong>{editingRepair.customerName}</strong></span>
                  <span>📍 현장: <strong>{editingRepair.siteName || '-'}</strong></span>
                </div>
              )}

              {/* 3. 🚀 [10초 퀵 편의 1] 자주 쓰는 정비 작업 프리셋 칩 */}
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11.5px', fontWeight: '700', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>⚡ 원터치 퀵 작업 선택 (터치 시 자동 입력)</span>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>타이핑 없이 원터치 완성</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {QUICK_WORK_TAGS.map((tag, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => handleAddQuickTag(tag)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        color: 'var(--text-main)'
                      }}
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* 작업 상세 명세 입력란 */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', display: 'block', marginBottom: '2px' }}>정비 수리 상세 명세 *</label>
                <textarea
                  value={editingRepair.details || ''}
                  onChange={e => setEditingRepair({ ...editingRepair, details: e.target.value })}
                  placeholder="퀵 태그를 누르거나 수리 내역을 직접 입력하세요."
                  rows={2}
                  required
                  style={{ width: '100%', padding: '6px', fontSize: '12px' }}
                />
              </div>

              {/* 4. 🚀 [10초 퀵 편의 2] TOP 4 소모품 퀵 투입 바 (내 차량 재고 표시) */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Truck size={13} className="text-primary" /> 자주 쓰는 소모품 원터치 투입 (내 차량 재고 우선 차감)
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px', marginBottom: '8px' }}>
                  {consumables.slice(0, 4).map(c => {
                    const myStockQty = getMyVehicleStockQty(c.id);
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => handleQuickAddConsumable(c.id)}
                        style={{
                          padding: '6px 8px',
                          textAlign: 'left',
                          fontSize: '11px',
                          backgroundColor: 'var(--bg-app)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}
                      >
                        <div style={{ fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>+1 {c.modelName}</div>
                        <div style={{ fontSize: '10px', color: '#059669' }}>차량보유: <strong>{myStockQty}</strong>{c.unit}</div>
                      </button>
                    );
                  })}
                </div>

                {/* 추가 소모품 선택기 */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '6px', alignItems: 'end', marginBottom: '6px' }}>
                  <select value={tempConsumableId} onChange={e => setTempConsumableId(e.target.value)} style={{ padding: '4px', fontSize: '11.5px' }}>
                    <option value="">-- 기타 소모품 선택 --</option>
                    {consumables.map(c => (
                      <option key={c.id} value={c.id}>{c.modelName} (차량재고: {getMyVehicleStockQty(c.id)}개 / 본사: {c.stockQty}개)</option>
                    ))}
                  </select>
                  <input type="number" value={tempQty} onChange={e => setTempQty(parseInt(e.target.value) || 1)} min={1} style={{ padding: '4px', fontSize: '11.5px' }} />
                  <button type="button" className="btn-secondary" onClick={handleAddConsumableToRepair} style={{ padding: '4px 8px', fontSize: '11.5px' }}>
                    추가
                  </button>
                </div>

                {selectedConsumables.map(sc => {
                  const item = consumables.find(c => c.id === sc.consumableId);
                  const myStock = getMyVehicleStockQty(sc.consumableId);
                  return (
                    <div key={sc.consumableId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', backgroundColor: 'var(--bg-app)', borderRadius: '4px', marginBottom: '4px', fontSize: '11.5px' }}>
                      <span>
                        {item?.modelName} : <strong>{sc.quantity}</strong>개 
                        <span style={{ fontSize: '10px', color: myStock >= sc.quantity ? '#059669' : '#d97706', marginLeft: '6px' }}>
                          [{myStock >= sc.quantity ? '차량재고차감' : '본사재고차감'}]
                        </span>
                      </span>
                      <button type="button" className="btn-danger" onClick={() => handleRemoveConsumableFromRepair(sc.consumableId)} style={{ padding: '1px 5px', fontSize: '10px' }}>✕</button>
                    </div>
                  );
                })}
              </div>

              {/* 5. 🚀 [10초 퀵 편의 3] 카메라 2분할 (정비 전 / 정비 후) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ border: '1px dashed var(--border-color)', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px' }}>📸 정비 전 (고장 부위)</div>
                  {beforeImage ? (
                    <div style={{ position: 'relative', width: '100%', height: '80px', borderRadius: '4px', overflow: 'hidden' }}>
                      <img src={beforeImage} alt="정비전" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button type="button" onClick={() => setBeforeImage('')} style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px' }}>✕</button>
                    </div>
                  ) : (
                    <label className="btn-secondary" style={{ padding: '6px 8px', fontSize: '11px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Camera size={12} /> 사진 촬영
                      <input type="file" accept="image/*" capture="environment" onChange={e => handleSingleImageUpload(e, 'BEFORE')} style={{ display: 'none' }} />
                    </label>
                  )}
                </div>

                <div style={{ border: '1px dashed var(--border-color)', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px' }}>📸 정비 후 (수리 완료)</div>
                  {afterImage ? (
                    <div style={{ position: 'relative', width: '100%', height: '80px', borderRadius: '4px', overflow: 'hidden' }}>
                      <img src={afterImage} alt="정비후" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button type="button" onClick={() => setAfterImage('')} style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px' }}>✕</button>
                    </div>
                  ) : (
                    <label className="btn-secondary" style={{ padding: '6px 8px', fontSize: '11px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Camera size={12} /> 사진 촬영
                      <input type="file" accept="image/*" capture="environment" onChange={e => handleSingleImageUpload(e, 'AFTER')} style={{ display: 'none' }} />
                    </label>
                  )}
                </div>
              </div>

              {/* 6. 🚀 [10초 퀵 편의 4] 현장 고객사 손가락 전자서명 패드 */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <PenTool size={12} className="text-primary" /> 현장 담당자 확인 서명 (손가락 터치 서명)
                  </span>
                  <button type="button" onClick={clearSignature} style={{ fontSize: '10.5px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    서명 지우기
                  </button>
                </div>
                <canvas
                  ref={canvasRef}
                  width={340}
                  height={80}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  style={{
                    width: '100%',
                    height: '80px',
                    backgroundColor: '#fff',
                    border: '1px dashed #cbd5e1',
                    borderRadius: '4px',
                    touchAction: 'none',
                    cursor: 'crosshair'
                  }}
                />
              </div>

            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>취소</button>
              <button type="submit" className="btn-primary" style={{ padding: '8px 18px', fontWeight: '700' }}>정비 완료 보고 저장</button>
            </div>
          </form>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 미완료 처리 팝업 모달 */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {unresolvedModalRepair && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '90%', maxWidth: '420px', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ color: 'var(--danger)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={16} /> AS 정비 미완료 기록
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600' }}>대상 장비</label>
                <div style={{ fontWeight: '700', fontSize: '13px' }}>
                  {getAssetNo(unresolvedModalRepair.assetId)} ({getAssetModel(unresolvedModalRepair.assetId)})
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px', display: 'block' }}>미완료 퀵 사유 선택</label>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  {['부품 수급 대기', '현장 진입 불가', '현장 수리 불가(대차필요)', '시간 부족(2차방문)'].map((r, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => {
                        setUnresolvedReasonInput(r);
                        if (r.includes('대차필요')) setNextActionInput('EXCHANGE_REQUEST');
                        else setNextActionInput('REVISIT');
                      }}
                      style={{
                        padding: '3px 6px',
                        fontSize: '11px',
                        borderRadius: '4px',
                        border: unresolvedReasonInput === r ? '2px solid var(--danger)' : '1px solid var(--border-color)',
                        backgroundColor: unresolvedReasonInput === r ? '#fee2e2' : 'var(--bg-app)'
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <input 
                  type="text" 
                  value={unresolvedReasonInput} 
                  onChange={e => setUnresolvedReasonInput(e.target.value)} 
                  placeholder="상세 사유 입력" 
                  style={{ width: '100%', padding: '6px', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: '600' }}>후속 조치 연계</label>
                <select 
                  value={nextActionInput} 
                  onChange={e => setNextActionInput(e.target.value as Repair['nextAction'])}
                  style={{ width: '100%', padding: '6px', fontSize: '12px' }}
                >
                  <option value="REVISIT">2차 재방문 일정 편성</option>
                  <option value="EXCHANGE_REQUEST">영업부서 대차교체(EXCHANGE) 의뢰</option>
                  <option value="NONE">별도 조치 없음</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setUnresolvedModalRepair(null)}>취소</button>
              <button type="button" className="btn-danger" onClick={handleSubmitUnresolved}>미완료 저장</button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 정비 상세 조회 모달 */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {selectedDetailRepair && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '95%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-card)' }}>
            <div className="card-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Wrench className="text-primary" /> 정비수리 상세 내역 조회
              </h3>
              <button className="btn-secondary" onClick={() => setSelectedDetailRepair(null)} style={{ padding: '4px 10px' }}>닫기</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>장비 관리번호</label><div><strong>{getAssetNo(selectedDetailRepair.assetId)}</strong></div></div>
                <div><label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>모델명</label><div>{getAssetModel(selectedDetailRepair.assetId)}</div></div>
                <div><label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>정비 구분</label>
                  <div>
                    <span className="badge badge-primary">
                      {selectedDetailRepair.maintenanceType === 'EMERGENCY_AS' ? '긴급출장 AS' :
                       selectedDetailRepair.maintenanceType === 'PREVENTIVE' ? '정기예방정비' :
                       selectedDetailRepair.maintenanceType === 'EXTERNAL' ? '외주정비' : '야적장정비'}
                    </span>
                  </div>
                </div>
                <div><label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>진행 상태</label>
                  <div>
                    <span className={`badge ${selectedDetailRepair.status === 'COMPLETED' ? 'badge-success' : selectedDetailRepair.status === 'UNRESOLVED' ? 'badge-danger' : 'badge-warning'}`}>
                      {selectedDetailRepair.status === 'COMPLETED' ? '정비완료' : selectedDetailRepair.status === 'UNRESOLVED' ? '미완료' : '진행중'}
                    </span>
                  </div>
                </div>
                <div><label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>방문/의뢰일</label><div>{selectedDetailRepair.scheduleDate || selectedDetailRepair.requestDate}</div></div>
                <div><label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>정비완료일</label><div>{selectedDetailRepair.repairDate || '-'}</div></div>
              </div>

              {selectedDetailRepair.customerName && (
                <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>출장 현장 정보</div>
                  <div style={{ fontWeight: '700' }}>🏢 {selectedDetailRepair.customerName} | 📍 {selectedDetailRepair.siteName || '현장'}</div>
                </div>
              )}

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>정비 작업 내용</label>
                <div style={{ padding: '10px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', whiteSpace: 'pre-wrap' }}>
                  {selectedDetailRepair.details}
                </div>
              </div>

              {/* 투입 소모품 명세 */}
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>정비 투입 소모품 자재</label>
                <div className="table-container" style={{ border: 'none', boxShadow: 'none', margin: 0 }}>
                  <table style={{ minWidth: '100%' }}>
                    <thead>
                      <tr>
                        <th>소모품명</th>
                        <th style={{ textAlign: 'center' }}>수량</th>
                        <th style={{ textAlign: 'right' }}>단가</th>
                        <th style={{ textAlign: 'right' }}>합계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const rcList = (repairConsumables || []).filter(rc => rc.repairId === selectedDetailRepair.id);
                        if (rcList.length === 0) {
                          return (
                            <tr>
                              <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '10px 0' }}>투입된 소모품 자재가 없습니다.</td>
                            </tr>
                          );
                        }
                        return rcList.map(rc => {
                          const item = consumables.find(c => c.id === rc.consumableId);
                          return (
                            <tr key={rc.id}>
                              <td>{item?.modelName || '기타 자재'}</td>
                              <td style={{ textAlign: 'center' }}>{rc.quantity}</td>
                              <td style={{ textAlign: 'right' }}>{rc.unitPrice.toLocaleString()}원</td>
                              <td style={{ textAlign: 'right', fontWeight: '600' }}>{rc.cost.toLocaleString()}원</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 현장 증빙 사진 갤러리 */}
              {(selectedDetailRepair.evidenceImages && selectedDetailRepair.evidenceImages.length > 0) && (
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    📸 현장 정비 증빙 및 서명 ({selectedDetailRepair.evidenceImages.length}건)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '8px' }}>
                    {selectedDetailRepair.evidenceImages.map((img, idx) => (
                      <a key={idx} href={img} target="_blank" rel="noreferrer" style={{ display: 'block', height: '100px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                        <img src={img} alt={`증빙-${idx}`} style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#f8fafc' }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
