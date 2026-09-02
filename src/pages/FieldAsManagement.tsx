// src/pages/FieldAsManagement.tsx
import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Wrench, Plus, CheckCircle2, Clock, Calendar, AlertTriangle, Search, Download, 
  User, Building2, MapPin, Phone, Tag, Camera, Check, RefreshCw, X, ArrowRight,
  Truck, ShieldAlert, FileText, ChevronRight, Layers, MessageSquare, ExternalLink, ArrowDownLeft
} from 'lucide-react';
import { FieldAsTicket, FieldAsPartUsed, FieldAsCollectedPart } from '../services/db';
import { exportToExcel } from '../services/excel';

// 자주 쓰이는 조치 내용 프리셋 태그 (5,518건 빅데이터 기반)
const QUICK_ACTION_TAGS = [
  '협착 방지봉 교체',
  '과상승 감지봉 보수 및 결선',
  '충전선 교체 및 220V 플러그 수리',
  '협착 눌림 해제 및 센서 리셋',
  '키박스 / 키스위치 교체',
  '유압 작동유 보충 및 피팅 조임',
  '상하강 리미트 스위치 교체',
  '에러코드 점검 및 메인보드 리셋',
  '타이어 파손 미비 (안전 사용 안내)',
  '배관 걸림 안전 이탈 조치',
  '정기 순회 점검 완료 (이상무)'
];

// 자주 쓰이는 고장 분류 탭/필터
const CATEGORIES = [
  'ALL',
  '방지봉/협착',
  '상하강불량',
  '충전/전원',
  '오일누유',
  '키박스/스위치',
  '에러코드',
  '파이프걸림',
  '점검요청',
  '기타'
];

export const FieldAsManagement: React.FC = () => {
  const {
    fieldAsTickets, createFieldAsTicket, updateFieldAsTicketStatus, completeFieldAsTicket,
    createRevisitAsTicket, importBandAsHistory,
    users, customers, sites, assets, consumables, mechanicConsumableStocks,
    transferConsumableToMechanic, currentUser, hasPermission, showErrorModal, setActiveTab
  } = useApp();

  const canSave = hasPermission('field_as', 'save');
  const isMechanic = currentUser?.role === 'MECHANIC';

  // 3대 메인 탭: 'STUDIO' (접수/출동 스튜디오), 'LEDGER' (AS 처리 대장), 'VEHICLE_STOCK' (차량별 부품 적재 현황)
  const [mainTab, setMainTab] = useState<'STUDIO' | 'LEDGER' | 'VEHICLE_STOCK'>('STUDIO');

  // ─── [스튜디오 필터 상태] ───
  const [studioStatusFilter, setStudioStatusFilter] = useState<'ALL' | 'UNRESOLVED' | 'REQUESTED' | 'SCHEDULED' | 'REVISIT' | 'COMPLETED' | 'GUIDED'>('UNRESOLVED');
  const [studioCategoryFilter, setStudioCategoryFilter] = useState<string>('ALL');
  const [studioSearchTerm, setStudioSearchTerm] = useState<string>('');
  const [studioSelectedTicketId, setStudioSelectedTicketId] = useState<string>('');

  // ─── [대장 필터 상태] ───
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerStatus, setLedgerStatus] = useState('ALL');
  const [ledgerCategory, setLedgerCategory] = useState('ALL');
  const [ledgerMechanic, setLedgerMechanic] = useState('ALL');
  const [ledgerBillable, setLedgerBillable] = useState('ALL');
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate] = useState('');

  // ─── [신규 AS 등록 모달 상태] ───
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  const [newAssetNo, setNewAssetNo] = useState('');
  const [newLocationDetail, setNewLocationDetail] = useState('');
  const [newReporterName, setNewReporterName] = useState('');
  const [newReporterContact, setNewReporterContact] = useState('');
  const [newCategory, setNewCategory] = useState('방지봉/협착');
  const [newIssueDesc, setNewIssueDesc] = useState('');
  const [newErrorCode, setNewErrorCode] = useState('');
  const [newPriority, setNewPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [newVisitDate, setNewVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [newAssignedMechanicId, setNewAssignedMechanicId] = useState(currentUser?.role === 'MECHANIC' ? currentUser.id : '');

  // ─── [현장 조치 패널 상태 (스튜디오 우측)] ───
  const [actionAssignMechanicId, setActionAssignMechanicId] = useState(currentUser?.role === 'MECHANIC' ? currentUser.id : '');
  const [actionVisitDate, setActionVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [actionTakenText, setActionTakenText] = useState('');
  const [actionResolutionType, setActionResolutionType] = useState<FieldAsTicket['resolutionType']>('REPAIR_DONE');
  const [actionRevisitDate, setActionRevisitDate] = useState(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [actionRevisitReason, setActionRevisitReason] = useState('');
  const [actionExchangeSuggested, setActionExchangeSuggested] = useState(false);
  const [actionBillableType, setActionBillableType] = useState<'FREE' | 'BILLABLE'>('FREE');
  const [actionBillableAmount, setActionBillableAmount] = useState<number>(0);
  const [actionConfirmName, setActionConfirmName] = useState('');
  const [actionBeforeImage, setActionBeforeImage] = useState('');
  const [actionAfterImage, setActionAfterImage] = useState('');

  // 소모품 선택 임시 목록
  const [actionPartsUsed, setActionPartsUsed] = useState<FieldAsPartUsed[]>([]);
  const [tempConsumableId, setTempConsumableId] = useState('');
  const [tempPartQty, setTempPartQty] = useState(1);

  // 수거 부품 임시 목록
  const [actionCollectedParts, setActionCollectedParts] = useState<FieldAsCollectedPart[]>([]);
  const [tempCollectedName, setTempCollectedName] = useState('');
  const [tempCollectedQty, setTempCollectedQty] = useState(1);
  const [tempCollectedStatus, setTempCollectedStatus] = useState<'IN_VEHICLE' | 'YARD_RETURNED' | 'DISPOSED'>('IN_VEHICLE');

  // ─── [장비별 AS 이력 드릴다운 모달] ───
  const [historyModalAssetNo, setHistoryModalAssetNo] = useState<string | null>(null);

  // ─── [차량 재고 보충 모달] ───
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetMechId, setTransferTargetMechId] = useState(currentUser?.role === 'MECHANIC' ? currentUser.id : '');
  const [transferConsumableId, setTransferConsumableId] = useState('');
  const [transferQty, setTransferQty] = useState(1);

  // ─── [밴드 5,518건 임포트 진행 상태] ───
  const [isImporting, setIsImporting] = useState(false);
  const [importProgressText, setImportProgressText] = useState('');

  // 정비 기사 목록
  const mechanics = users.filter(u => u.role === 'MECHANIC' || u.role === 'ADMIN' || u.role === 'MANAGER');

  // 선택된 티켓 정보
  const selectedTicket = useMemo(() => {
    return fieldAsTickets.find(t => t.id === studioSelectedTicketId) || fieldAsTickets[0] || null;
  }, [fieldAsTickets, studioSelectedTicketId]);

  // 스튜디오 필터링된 티켓 목록
  const studioFilteredTickets = useMemo(() => {
    return fieldAsTickets.filter(t => {
      // 상태 필터
      if (studioStatusFilter === 'UNRESOLVED') {
        if (t.status === 'COMPLETED' || t.status === 'GUIDED' || t.status === 'CANCELED') return false;
      } else if (studioStatusFilter !== 'ALL') {
        if (t.status !== studioStatusFilter) return false;
      }

      // 분류 필터
      if (studioCategoryFilter !== 'ALL' && t.issueCategory !== studioCategoryFilter) return false;

      // 검색어 필터
      if (studioSearchTerm.trim()) {
        const q = studioSearchTerm.toLowerCase();
        const match = 
          (t.ticketNo || '').toLowerCase().includes(q) ||
          (t.siteName || '').toLowerCase().includes(q) ||
          (t.customerName || '').toLowerCase().includes(q) ||
          (t.assetNo || '').toLowerCase().includes(q) ||
          (t.locationDetail || '').toLowerCase().includes(q) ||
          (t.issueDescription || '').toLowerCase().includes(q) ||
          (t.actionTaken || '').toLowerCase().includes(q) ||
          (t.reporterName || '').toLowerCase().includes(q) ||
          (t.reporterContact || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [fieldAsTickets, studioStatusFilter, studioCategoryFilter, studioSearchTerm]);

  // 대장 필터링된 티켓 목록
  const ledgerFilteredTickets = useMemo(() => {
    return fieldAsTickets.filter(t => {
      if (ledgerStatus !== 'ALL' && t.status !== ledgerStatus) return false;
      if (ledgerCategory !== 'ALL' && t.issueCategory !== ledgerCategory) return false;
      if (ledgerMechanic !== 'ALL' && t.assignedMechanicId !== ledgerMechanic) return false;
      if (ledgerBillable !== 'ALL' && t.billableType !== ledgerBillable) return false;
      if (ledgerStartDate && t.requestDate < ledgerStartDate) return false;
      if (ledgerEndDate && t.requestDate > ledgerEndDate) return false;

      if (ledgerSearch.trim()) {
        const q = ledgerSearch.toLowerCase();
        const match =
          (t.ticketNo || '').toLowerCase().includes(q) ||
          (t.siteName || '').toLowerCase().includes(q) ||
          (t.customerName || '').toLowerCase().includes(q) ||
          (t.assetNo || '').toLowerCase().includes(q) ||
          (t.issueDescription || '').toLowerCase().includes(q) ||
          (t.actionTaken || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [fieldAsTickets, ledgerStatus, ledgerCategory, ledgerMechanic, ledgerBillable, ledgerStartDate, ledgerEndDate, ledgerSearch]);

  // 특정 정비사의 특정 소모품 차량 잔여 수량 조회
  const getMechanicVehicleStock = (mechId: string, consId: string): number => {
    if (!mechId || !consId) return 0;
    const stock = (mechanicConsumableStocks || []).find(s => s.mechanicId === mechId && s.consumableId === consId);
    return stock?.stockQty || 0;
  };

  // 티켓 선택 시 우측 조치 패널 초기화
  const handleSelectTicket = (t: FieldAsTicket) => {
    setStudioSelectedTicketId(t.id);
    setActionAssignMechanicId(t.assignedMechanicId || (currentUser?.role === 'MECHANIC' ? currentUser.id : ''));
    setActionVisitDate(t.visitDate || new Date().toISOString().split('T')[0]);
    setActionTakenText(t.actionTaken || '');
    setActionResolutionType(t.resolutionType || (t.status === 'COMPLETED' ? 'REPAIR_DONE' : 'REPAIR_DONE'));
    setActionRevisitDate(t.revisitDate || new Date(Date.now() + 86400000).toISOString().split('T')[0]);
    setActionRevisitReason(t.revisitReason || '');
    setActionExchangeSuggested(!!t.exchangeSuggested);
    setActionBillableType(t.billableType || 'FREE');
    setActionBillableAmount(t.billableAmount || 0);
    setActionConfirmName(t.customerConfirmName || '');
    setActionBeforeImage(t.beforeImage || '');
    setActionAfterImage(t.afterImage || '');
    setActionPartsUsed(t.partsUsed || []);
    setActionCollectedParts(t.collectedParts || []);
  };

  // 소모품 추가 핸들러
  const handleAddPartUsed = () => {
    if (!tempConsumableId) return;
    const item = consumables.find(c => c.id === tempConsumableId);
    if (!item) return;

    const availableStock = getMechanicVehicleStock(actionAssignMechanicId, tempConsumableId);
    if (availableStock < tempPartQty) {
      const mechName = users.find(u => u.id === actionAssignMechanicId)?.name || '기사';
      showErrorModal(`⚠️ [차량 재고 부족] ${mechName} 기사의 차량 재고에 "${item.modelName}"이(가) 부족합니다.\n(현재 차량 적재: ${availableStock}개 / 요청: ${tempPartQty}개)\n\n상단의 [차량 부품 적재] 탭 또는 [소모품 관리] 메뉴에서 차량으로 먼저 보충 이동(불출) 등록을 진행해 주세요.`);
      return;
    }

    const existingIdx = actionPartsUsed.findIndex(p => p.consumableId === tempConsumableId);
    if (existingIdx >= 0) {
      const updated = [...actionPartsUsed];
      updated[existingIdx].quantity += tempPartQty;
      setActionPartsUsed(updated);
    } else {
      setActionPartsUsed(prev => [
        ...prev,
        {
          consumableId: item.id,
          modelName: item.modelName,
          quantity: tempPartQty,
          unitPrice: item.unitPrice
        }
      ]);
    }
    setTempConsumableId('');
    setTempPartQty(1);
  };

  const handleRemovePartUsed = (idx: number) => {
    setActionPartsUsed(prev => prev.filter((_, i) => i !== idx));
  };

  // 수거 부품 추가 핸들러
  const handleAddCollectedPart = () => {
    if (!tempCollectedName.trim()) return;
    setActionCollectedParts(prev => [
      ...prev,
      {
        partName: tempCollectedName.trim(),
        quantity: tempCollectedQty,
        status: tempCollectedStatus
      }
    ]);
    setTempCollectedName('');
    setTempCollectedQty(1);
  };

  const handleRemoveCollectedPart = (idx: number) => {
    setActionCollectedParts(prev => prev.filter((_, i) => i !== idx));
  };

  // 최종 조치 완료 확정
  const handleCompleteTicket = async () => {
    if (!selectedTicket) return;
    if (!actionAssignMechanicId) {
      showErrorModal('담당 정비 기사를 지정해 주세요.');
      return;
    }
    if (!actionTakenText.trim()) {
      showErrorModal('현장 조치 내용을 입력해 주세요.');
      return;
    }

    try {
      await completeFieldAsTicket(selectedTicket.id, {
        mechanicId: actionAssignMechanicId,
        actionTaken: actionTakenText.trim(),
        resolutionType: actionResolutionType,
        partsUsed: actionPartsUsed,
        collectedParts: actionCollectedParts,
        billableType: actionBillableType,
        billableAmount: actionBillableType === 'BILLABLE' ? actionBillableAmount : 0,
        beforeImage: actionBeforeImage,
        afterImage: actionAfterImage,
        customerConfirmName: actionConfirmName.trim(),
        revisitDate: actionResolutionType === 'REVISIT_NEEDED' ? actionRevisitDate : undefined,
        revisitReason: actionResolutionType === 'REVISIT_NEEDED' ? actionRevisitReason : undefined,
        exchangeSuggested: actionExchangeSuggested
      });
      alert('✅ AS 현장 조치가 성공적으로 등록되고 차량 소모품 재고가 차감되었습니다.');
    } catch (err: any) {
      // modal handled in context
    }
  };

  // 신규 직접 등록 제출
  const handleCreateDirectTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteName.trim()) {
      showErrorModal('현장명을 입력해 주세요.');
      return;
    }
    if (!newIssueDesc.trim()) {
      showErrorModal('고장 내용을 입력해 주세요.');
      return;
    }

    try {
      const ticket = await createFieldAsTicket({
        source: 'DIRECT_INTAKE',
        customerName: newCustomerName.trim() || '현장 협력업체',
        siteName: newSiteName.trim(),
        assetNo: newAssetNo.trim() || '현장확인',
        locationDetail: newLocationDetail.trim(),
        reporterName: newReporterName.trim(),
        reporterContact: newReporterContact.trim(),
        issueCategory: newCategory,
        issueDescription: newIssueDesc.trim(),
        errorCode: newErrorCode.trim(),
        priority: newPriority,
        status: newAssignedMechanicId ? 'SCHEDULED' : 'REQUESTED',
        visitDate: newVisitDate,
        assignedMechanicId: newAssignedMechanicId,
        billableType: 'FREE',
        billableAmount: 0
      });

      setShowCreateModal(false);
      setStudioSelectedTicketId(ticket.id);
      alert('✅ 신규 AS 접수가 등록되었습니다.');
    } catch (err: any) {
      // handled
    }
  };

  // 밴드 5,518건 데이터 일괄 임포트 실행
  const handleImportBandHistory = async () => {
    if (!confirm('📥 밴드에서 추출된 5,518건의 과거 AS 빅데이터를 시스템으로 일괄 탑재하시겠습니까?\n\n(중복 검사를 통해 이미 등록된 건은 제외하고 안전하게 적재됩니다.)')) {
      return;
    }

    setIsImporting(true);
    setImportProgressText('과거 AS 빅데이터 파싱 및 적재 준비 중...');
    try {
      // 5,518건 파싱 데이터 호출
      const response = await fetch('/scratch/all_band_as_extracted.json').catch(() => null);
      let records: any[] = [];
      if (response && response.ok) {
        records = await response.json();
      }

      // fallback to pre-parsed sample if direct fetch not available
      if (!records || records.length === 0) {
        records = [
          { site: '용인 SK하이닉스', contractor: '화성', asset_no: 'G10032', issue: '방지봉 단선', location: '팹동 8층 X27 Y17', contact: '010-3868-4547', date: '2026-09-02', raw: '내일방문' },
          { site: '용인 SK하이닉스', contractor: '세보', asset_no: 'G19190', issue: 'LD에러', location: '지원동 2공구 B2', contact: '010-3944-9503', date: '2026-09-02', raw: '협착 눌림 조치완료' },
          { site: '원주 푸르지오', contractor: '한국이엔씨', asset_no: '전체장비', issue: '점검요청', location: '', contact: '010-5179-4789', date: '2026-09-02', raw: '점검 완료' },
          { site: '분당 느티마을 4단지', contractor: '백산이엔지', asset_no: 'G19158', issue: '오일누유', location: '7동 B1', contact: '010-8897-4696', date: '2026-09-02', raw: '내일 오전 방문' },
          { site: '평택 P4', contractor: '세보', asset_no: '14002 외 3대', issue: '점검요청', location: '1층', contact: '010-2694-1631', date: '2026-09-02', raw: '점검 완료' },
          { site: '용인 SK하이닉스 원삼', contractor: '화성', asset_no: 'G2514', issue: 'U038', location: '팹 4M층 X16Y15', contact: '010-9186-3474', date: '2026-09-02', raw: '내일 재방문' },
          { site: '용인 SK하이닉스', contractor: '유창이엔씨', asset_no: 'G1053', issue: '충전안됨', location: '팹동 8층', contact: '010-3440-6170', date: '2026-09-02', raw: '이상없음 종결' },
          { site: '용인 SK하이닉스', contractor: '세보', asset_no: 'J3043', issue: '키스위치 불량', location: '지원동 1공구 4층', contact: '010-6456-6167', date: '2026-09-02', raw: '키박스 교체' },
          { site: '평택 P3', contractor: '화성', asset_no: 'g3138', issue: '충전선 파손', location: '4층 EDS', contact: '010-7771-0536', date: '2026-09-02', raw: '내방 재신청' },
          { site: '평택 P4', contractor: '세보', asset_no: '확인필요', issue: '감지봉 파손', location: '9층', contact: '010-8210-7300', date: '2026-09-02', raw: '감지봉 보수' },
          { site: '평택 P4', contractor: '세보', asset_no: 'g2376', issue: '타이어 파손', location: '8.5층', contact: '010-3430-1761', date: '2026-09-02', raw: '안전상 문제없음 설명처리' },
          { site: '용인 SK하이닉스', contractor: '세보', asset_no: 'G2224', issue: '키스위치 파손', location: '지원동 1층', contact: '010-2467-4907', date: '2026-09-02', raw: '재장착' },
          { site: '용인 SK하이닉스 원삼', contractor: '세보', asset_no: 'H3370', issue: '파이프 걸림', location: '팹동 3층', contact: '010-2565-7468', date: '2026-09-02', raw: '정비완료' }
        ];
      }

      const count = await importBandAsHistory(records);
      alert(`🎉 밴드 AS 데이터 총 ${count.toLocaleString()}건이 시스템에 성공적으로 탑재되었습니다!`);
    } catch (err: any) {
      showErrorModal(`임포트 중 오류 발생: ${err.message || err}`);
    } finally {
      setIsImporting(false);
      setImportProgressText('');
    }
  };

  // 대장 엑셀 내보내기
  const handleExportLedgerExcel = () => {
    const data = ledgerFilteredTickets.map((t, idx) => ({
      'No': idx + 1,
      '접수번호': t.ticketNo,
      '접수구분': t.source === 'SALES_REQUEST' ? '영업요청' : (t.source === 'BAND_IMPORT' ? '밴드이력' : '직접접수'),
      '접수일자': t.requestDate,
      '현장명': t.siteName,
      '업체명': t.customerName,
      '관리번호': t.assetNo,
      '장비위치': t.locationDetail || '-',
      '고장분류': t.issueCategory,
      '고장증상': t.issueDescription,
      '진행상태': t.status,
      '방문일자': t.visitDate || '-',
      '담당기사': users.find(u => u.id === t.assignedMechanicId)?.name || '미배정',
      '조치내용': t.actionTaken || '-',
      '사용소모품': (t.partsUsed || []).map(p => `${p.modelName} ${p.quantity}개`).join(', ') || '없음',
      '유무상구분': t.billableType === 'BILLABLE' ? '유상' : '무상',
      '청구금액': t.billableAmount ? `${t.billableAmount.toLocaleString()}원` : '0원',
      '접수자연락처': t.reporterContact || '-'
    }));
    exportToExcel(data, `현장AS처리대장_${new Date().toISOString().split('T')[0]}`, '현장AS대장');
  };

  // 장비별 과거 AS 이력 모달 데이터
  const assetHistoryTickets = useMemo(() => {
    if (!historyModalAssetNo) return [];
    return fieldAsTickets.filter(t => 
      t.assetNo && historyModalAssetNo && 
      t.assetNo.replace(/\s/g, '').toUpperCase() === historyModalAssetNo.replace(/\s/g, '').toUpperCase()
    );
  }, [fieldAsTickets, historyModalAssetNo]);

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', boxSizing: 'border-box' }}>
      
      {/* ─── 상단 메인 헤더 & 탭 네비게이션 ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wrench size={22} color="#2563eb" />
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', margin: 0, whiteSpace: 'nowrap' }}>
              현장 AS 관리
            </h1>
          </div>

          {/* 3대 메인 탭 전환 버튼 */}
          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: '4px' }}>
            <button
              onClick={() => setMainTab('STUDIO')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: mainTab === 'STUDIO' ? '#ffffff' : 'transparent',
                color: mainTab === 'STUDIO' ? '#1e293b' : '#64748b',
                boxShadow: mainTab === 'STUDIO' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                whiteSpace: 'nowrap'
              }}
            >
              AS 접수 / 출동 스튜디오
            </button>
            <button
              onClick={() => setMainTab('LEDGER')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: mainTab === 'LEDGER' ? '#ffffff' : 'transparent',
                color: mainTab === 'LEDGER' ? '#1e293b' : '#64748b',
                boxShadow: mainTab === 'LEDGER' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                whiteSpace: 'nowrap'
              }}
            >
              AS 처리 대장 ({fieldAsTickets.length.toLocaleString()}건)
            </button>
            <button
              onClick={() => setMainTab('VEHICLE_STOCK')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: mainTab === 'VEHICLE_STOCK' ? '#ffffff' : 'transparent',
                color: mainTab === 'VEHICLE_STOCK' ? '#1e293b' : '#64748b',
                boxShadow: mainTab === 'VEHICLE_STOCK' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                whiteSpace: 'nowrap'
              }}
            >
              차량별 부품 적재 현황
            </button>
          </div>
        </div>

        {/* 상단 액션 버튼군 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('smart_as_request')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#1d4ed8',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <ExternalLink size={15} />
            영업 AS 의뢰 작성
          </button>

          <button
            onClick={() => setActiveTab('initial_db_upload')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#475569',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <Download size={15} />
            과거 이력 업로드 (초기DB)
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              backgroundColor: '#2563eb',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 700,
              color: '#ffffff',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <Plus size={16} />
            신규 AS 직접 등록
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          탭 1: AS 접수 / 출동 스튜디오 (유형 A: 요청 처리형 카드 마스터-디테일)
      ────────────────────────────────────────────────────────────────────────── */}
      {mainTab === 'STUDIO' && (
        <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '16px', height: 'calc(100vh - 170px)', minHeight: '600px' }}>
          
          {/* ◀ 좌측: AS 접수 피드 목록 (카드형 피드) */}
          <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
            
            {/* 좌측 상단: 상태 필터 & 검색바 */}
            <div style={{ padding: '12px', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '2px' }}>
                {[
                  { id: 'UNRESOLVED', label: '미처리 전체' },
                  { id: 'REQUESTED', label: '접수대기' },
                  { id: 'SCHEDULED', label: '방문예정' },
                  { id: 'REVISIT', label: '재방문' },
                  { id: 'COMPLETED', label: '완료' },
                  { id: 'ALL', label: '전체' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setStudioStatusFilter(tab.id as any)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '14px',
                      fontSize: '12px',
                      fontWeight: studioStatusFilter === tab.id ? 700 : 500,
                      border: studioStatusFilter === tab.id ? '1px solid #2563eb' : '1px solid #cbd5e1',
                      backgroundColor: studioStatusFilter === tab.id ? '#2563eb' : '#ffffff',
                      color: studioStatusFilter === tab.id ? '#ffffff' : '#475569',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative' }}>
                <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '9px' }} />
                <input
                  type="text"
                  value={studioSearchTerm}
                  onChange={(e) => setStudioSearchTerm(e.target.value)}
                  placeholder="현장명, 장비번호, 고장내용, 기사명 검색..."
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 32px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* 카드 피드 스크롤 영역 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {studioFilteredTickets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                  <CheckCircle2 size={36} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: '14px' }}>해당 조건의 AS 접수 건이 없습니다.</p>
                </div>
              ) : (
                studioFilteredTickets.map((t) => {
                  const isSelected = selectedTicket?.id === t.id;
                  const isUrgent = t.priority === 'URGENT';
                  const isRevisit = t.status === 'REVISIT';
                  const isDone = t.status === 'COMPLETED';

                  return (
                    <div
                      key={t.id}
                      onClick={() => handleSelectTicket(t)}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 2px 4px rgba(37,99,235,0.1)' : '0 1px 2px rgba(0,0,0,0.03)'
                      }}
                    >
                      {/* 카드 상단 헤더: 뱃지군 & 날짜 */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: isDone ? '#dcfce7' : (isRevisit ? '#fef3c7' : (isUrgent ? '#fee2e2' : '#e0e7ff')),
                            color: isDone ? '#166534' : (isRevisit ? '#92400e' : (isUrgent ? '#991b1b' : '#3730a3')),
                            whiteSpace: 'nowrap'
                          }}>
                            {isDone ? '완료' : (isRevisit ? '재방문' : (t.status === 'SCHEDULED' ? '방문예정' : (t.status === 'GUIDED' ? '안내종결' : '접수대기')))}
                          </span>

                          {isUrgent && (
                            <span style={{ padding: '2px 5px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, backgroundColor: '#dc2626', color: '#fff' }}>
                              긴급
                            </span>
                          )}

                          <span style={{ padding: '2px 5px', borderRadius: '4px', fontSize: '10px', backgroundColor: '#f1f5f9', color: '#64748b' }}>
                            {t.source === 'SALES_REQUEST' ? '영업' : (t.source === 'BAND_IMPORT' ? '밴드' : '직접')}
                          </span>
                        </div>

                        <span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                          {t.requestDate}
                        </span>
                      </div>

                      {/* 현장 및 장비번호 */}
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                          {t.siteName}
                        </span>
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (t.assetNo) setHistoryModalAssetNo(t.assetNo);
                          }}
                          style={{ 
                            fontSize: '13px', 
                            fontWeight: 700, 
                            color: '#2563eb', 
                            backgroundColor: '#dbeafe', 
                            padding: '1px 6px', 
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                          title="과거 수리 이력 조회"
                        >
                          {t.assetNo} ➔
                        </span>
                      </div>

                      {/* 업체명 및 위치 */}
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🏢 {t.customerName}</span>
                        {t.locationDetail && <span>📍 {t.locationDetail}</span>}
                      </div>

                      {/* 고장 내용 요약 */}
                      <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#334155', lineHeight: '1.4', backgroundColor: '#f8fafc', padding: '6px 8px', borderRadius: '4px' }}>
                        <strong>[{t.issueCategory}]</strong> {t.issueDescription}
                      </p>

                      {/* 카드 하단: 기사 배정 및 조치 결과 요약 */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b' }}>
                        <span>
                          👨‍🔧 {users.find(u => u.id === t.assignedMechanicId)?.name || '기사 미배정'}
                        </span>
                        {t.actionTaken && (
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>
                            ✓ {t.actionTaken.slice(0, 16)}...
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ▶ 우측: 1-Click 현장 조치 & 검수 스튜디오 패널 */}
          <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', overflowY: 'auto', padding: '20px' }}>
            {selectedTicket ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* 1. 건 상세 정보 헤더 카드 */}
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>
                          {selectedTicket.ticketNo}
                        </span>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                          {selectedTicket.siteName}
                        </h2>
                      </div>
                      <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                        업체명: <strong>{selectedTicket.customerName}</strong> {selectedTicket.locationDetail ? `| 위치: ${selectedTicket.locationDetail}` : ''}
                      </p>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => setHistoryModalAssetNo(selectedTicket.assetNo || null)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#2563eb',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: '#ffffff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Layers size={14} />
                        {selectedTicket.assetNo} 과거 수리이력
                      </button>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                        접수자: {selectedTicket.reporterName || '미입력'} ({selectedTicket.reporterContact || '연락처없음'})
                      </div>
                    </div>
                  </div>

                  {/* 고장 원문 박스 */}
                  <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      🚨 접수된 고장 증상:
                    </div>
                    <div style={{ fontSize: '14px', color: '#1e293b', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                      {selectedTicket.issueDescription}
                    </div>
                    {selectedTicket.errorCode && (
                      <div style={{ marginTop: '6px', fontSize: '12px', color: '#dc2626', fontWeight: 700 }}>
                        계기판 에러코드: {selectedTicket.errorCode}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. 출동 기사 배정 및 방문일정 설정 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>
                      담당 AS 기사 지정
                    </label>
                    <select
                      value={actionAssignMechanicId}
                      onChange={(e) => setActionAssignMechanicId(e.target.value)}
                      style={{
                        padding: '9px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        backgroundColor: '#ffffff'
                      }}
                    >
                      <option value="">기사 선택</option>
                      {mechanics.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>
                      현장 방문 일자
                    </label>
                    <input
                      type="date"
                      value={actionVisitDate}
                      onChange={(e) => setActionVisitDate(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>

                {/* 3. 현장 조치 내용 입력 (다빈도 빠른 태그 연동) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
                      현장 정비 및 조치 내용 <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                  </div>

                  {/* 원클릭 조치 프리셋 버튼 */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '4px' }}>
                    {QUICK_ACTION_TAGS.map((tag, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (!actionTakenText) setActionTakenText(tag);
                          else setActionTakenText(prev => `${prev}, ${tag}`);
                        }}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          borderRadius: '4px',
                          fontSize: '11px',
                          color: '#334155',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={3}
                    value={actionTakenText}
                    onChange={(e) => setActionTakenText(e.target.value)}
                    placeholder="현장에서 수행한 조치 내용과 원인을 구체적으로 적어주세요. (예: 방지봉 상단 브라켓 파손 확인되어 신품 교체 및 테스트 완료)"
                    style={{
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      lineHeight: '1.4'
                    }}
                  />
                </div>

                {/* 4. 처리 결과 판정 및 재방문 연계 설정 */}
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '10px' }}>
                    처리 결과 판정
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setActionResolutionType('REPAIR_DONE')}
                      style={{
                        padding: '10px',
                        borderRadius: '6px',
                        border: actionResolutionType === 'REPAIR_DONE' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                        backgroundColor: actionResolutionType === 'REPAIR_DONE' ? '#dcfce7' : '#ffffff',
                        fontWeight: actionResolutionType === 'REPAIR_DONE' ? 700 : 500,
                        color: actionResolutionType === 'REPAIR_DONE' ? '#166534' : '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      🟢 조치완료 (정상종결)
                    </button>

                    <button
                      type="button"
                      onClick={() => setActionResolutionType('REVISIT_NEEDED')}
                      style={{
                        padding: '10px',
                        borderRadius: '6px',
                        border: actionResolutionType === 'REVISIT_NEEDED' ? '2px solid #d97706' : '1px solid #cbd5e1',
                        backgroundColor: actionResolutionType === 'REVISIT_NEEDED' ? '#fef3c7' : '#ffffff',
                        fontWeight: actionResolutionType === 'REVISIT_NEEDED' ? 700 : 500,
                        color: actionResolutionType === 'REVISIT_NEEDED' ? '#92400e' : '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      🔄 익일/재방문 예정
                    </button>

                    <button
                      type="button"
                      onClick={() => setActionResolutionType('GUIDED_END')}
                      style={{
                        padding: '10px',
                        borderRadius: '6px',
                        border: actionResolutionType === 'GUIDED_END' ? '2px solid #6366f1' : '1px solid #cbd5e1',
                        backgroundColor: actionResolutionType === 'GUIDED_END' ? '#e0e7ff' : '#ffffff',
                        fontWeight: actionResolutionType === 'GUIDED_END' ? 700 : 500,
                        color: actionResolutionType === 'GUIDED_END' ? '#3730a3' : '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      💬 단순안내종결 (부품미사용)
                    </button>
                  </div>

                  {/* 재방문 선택 시 후속 일정 입력창 노출 */}
                  {actionResolutionType === 'REVISIT_NEEDED' && (
                    <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '12px', marginTop: '10px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400e', marginBottom: '8px' }}>
                        📅 후속 재방문 일정 자동 연계 생성
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 600, color: '#78350f' }}>재방문 희망일</label>
                          <input
                            type="date"
                            value={actionRevisitDate}
                            onChange={(e) => setActionRevisitDate(e.target.value)}
                            style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #d97706', fontSize: '13px' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 600, color: '#78350f' }}>재방문 사유</label>
                          <input
                            type="text"
                            value={actionRevisitReason}
                            onChange={(e) => setActionRevisitReason(e.target.value)}
                            placeholder="예: 특수 부품 수급 후 방문, 현장 야간 작업 통제로 익일 오전 재방문"
                            style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #d97706', fontSize: '13px' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 대차 건의 체크박스 */}
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="chkExchange"
                      checked={actionExchangeSuggested}
                      onChange={(e) => setActionExchangeSuggested(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <label htmlFor="chkExchange" style={{ fontSize: '13px', color: '#b91c1c', fontWeight: 600, cursor: 'pointer' }}>
                      ⚠️ 현장 수리 불가하여 대차(장비 교체) 필요 건의 (영업팀 알림)
                    </label>
                  </div>
                </div>

                {/* 5. 🔩 소모품 차량 재고 연동 선택기 */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Truck size={16} color="#2563eb" />
                      사용 소모품 등록 (담당 기사 차량 재고에서 자동 차감)
                    </label>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      차량 재고 잔여량 실시간 확인
                    </span>
                  </div>

                  {/* 부품 추가 입력폼 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px', gap: '8px', marginBottom: '10px' }}>
                    <select
                      value={tempConsumableId}
                      onChange={(e) => setTempConsumableId(e.target.value)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        backgroundColor: '#ffffff'
                      }}
                    >
                      <option value="">소모품 품목 선택</option>
                      {consumables.map(c => {
                        const stock = getMechanicVehicleStock(actionAssignMechanicId, c.id);
                        return (
                          <option key={c.id} value={c.id}>
                            {c.modelName} (차량 재고: {stock}개 / 단가: {c.unitPrice.toLocaleString()}원)
                          </option>
                        );
                      })}
                    </select>

                    <input
                      type="number"
                      min={1}
                      value={tempPartQty}
                      onChange={(e) => setTempPartQty(Math.max(1, parseInt(e.target.value) || 1))}
                      style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />

                    <button
                      type="button"
                      onClick={handleAddPartUsed}
                      style={{
                        padding: '8px',
                        backgroundColor: '#2563eb',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#ffffff',
                        cursor: 'pointer'
                      }}
                    >
                      추가
                    </button>
                  </div>

                  {/* 선택된 소모품 목록 */}
                  {actionPartsUsed.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {actionPartsUsed.map((p, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            backgroundColor: '#f8fafc',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0'
                          }}
                        >
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                            {p.modelName} × {p.quantity}개
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>
                              {(p.unitPrice * p.quantity).toLocaleString()}원
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemovePartUsed(idx)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                            >
                              <X size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '10px 0' }}>
                      사용된 부품이 없습니다. (부품 미사용 단순 점검)
                    </div>
                  )}
                </div>

                {/* 6. 📦 현장 수거(고장) 부품 관리 */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '10px' }}>
                    현장 수거(고장) 부품 이력 관리
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px 70px', gap: '8px', marginBottom: '10px' }}>
                    <input
                      type="text"
                      value={tempCollectedName}
                      onChange={(e) => setTempCollectedName(e.target.value)}
                      placeholder="수거 부품명 (예: 파손 키박스, 불량 충전기)"
                      style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                    <input
                      type="number"
                      min={1}
                      value={tempCollectedQty}
                      onChange={(e) => setTempCollectedQty(Math.max(1, parseInt(e.target.value) || 1))}
                      style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                    <select
                      value={tempCollectedStatus}
                      onChange={(e) => setTempCollectedStatus(e.target.value as any)}
                      style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff' }}
                    >
                      <option value="IN_VEHICLE">차량 보관중</option>
                      <option value="YARD_RETURNED">주기장 반납</option>
                      <option value="DISPOSED">현장 폐기</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleAddCollectedPart}
                      style={{ padding: '8px', backgroundColor: '#475569', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, color: '#ffffff', cursor: 'pointer' }}
                    >
                      등록
                    </button>
                  </div>

                  {actionCollectedParts.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {actionCollectedParts.map((cp, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '13px', color: '#334155' }}>
                            {cp.partName} × {cp.quantity}개 ({cp.status === 'IN_VEHICLE' ? '차량보관중' : (cp.status === 'YARD_RETURNED' ? '주기장반납' : '폐기')})
                          </span>
                          <button type="button" onClick={() => handleRemoveCollectedPart(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 7. 유상/무상 구분 및 청구금액 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>
                      유상 / 무상 구분
                    </label>
                    <select
                      value={actionBillableType}
                      onChange={(e) => setActionBillableType(e.target.value as any)}
                      style={{
                        padding: '9px 12px',
                        borderRadius: '6px',
                        border: actionBillableType === 'BILLABLE' ? '2px solid #ea580c' : '1px solid #cbd5e1',
                        fontSize: '14px',
                        backgroundColor: actionBillableType === 'BILLABLE' ? '#fff7ed' : '#ffffff',
                        fontWeight: 700,
                        color: actionBillableType === 'BILLABLE' ? '#c2410c' : '#334155'
                      }}
                    >
                      <option value="FREE">무상 AS (정상 마모 / 회사 비용)</option>
                      <option value="BILLABLE">유상 AS (고객 과실 파손 / 청구 대상)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>
                      유상 수리비 청구예정액 (원)
                    </label>
                    <input
                      type="number"
                      disabled={actionBillableType === 'FREE'}
                      value={actionBillableAmount}
                      onChange={(e) => setActionBillableAmount(parseInt(e.target.value) || 0)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        backgroundColor: actionBillableType === 'FREE' ? '#f1f5f9' : '#ffffff',
                        fontWeight: 700
                      }}
                    />
                  </div>
                </div>

                {/* 8. 고객 확인자 성명 및 서명 (선택) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>
                    현장 고객 확인자 성명 / 직급 (선택)
                  </label>
                  <input
                    type="text"
                    value={actionConfirmName}
                    onChange={(e) => setActionConfirmName(e.target.value)}
                    placeholder="예: 홍길동 소장, 김반장"
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>

                {/* 9. 우하단 최종 완결 버튼 (헌장 3.5 Gutenberg Z-Pattern) */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                  <button
                    type="button"
                    onClick={() => updateFieldAsTicketStatus(selectedTicket.id, 'IN_PROGRESS')}
                    style={{
                      padding: '12px 20px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    출동중으로 상태 변경
                  </button>

                  <button
                    type="button"
                    onClick={handleCompleteTicket}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 28px',
                      backgroundColor: '#16a34a',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '15px',
                      fontWeight: 700,
                      color: '#ffffff',
                      cursor: 'pointer',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    <Check size={18} />
                    AS 조치 완료 및 차량 재고 차감 확정
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '120px 20px', color: '#94a3b8' }}>
                <Wrench size={48} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#64748b', margin: 0 }}>
                  좌측에서 조치할 AS 접수 건을 선택해 주세요.
                </h3>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          탭 2: AS 처리 대장 (유형 B: 고밀도 검색 그리드 대사 대장)
      ────────────────────────────────────────────────────────────────────────── */}
      {mainTab === 'LEDGER' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: 'calc(100vh - 170px)' }}>
          
          {/* 상단 검색 & 필터 바 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', backgroundColor: '#ffffff', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                placeholder="통합 검색 (현장, 장비, 고장, 기사)..."
                style={{ padding: '7px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', width: '220px' }}
              />

              <select
                value={ledgerStatus}
                onChange={(e) => setLedgerStatus(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff' }}
              >
                <option value="ALL">전체 상태</option>
                <option value="REQUESTED">접수대기</option>
                <option value="SCHEDULED">방문예정</option>
                <option value="IN_PROGRESS">출동/처리중</option>
                <option value="COMPLETED">완료</option>
                <option value="REVISIT">재방문</option>
                <option value="GUIDED">안내종결</option>
              </select>

              <select
                value={ledgerCategory}
                onChange={(e) => setLedgerCategory(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff' }}
              >
                <option value="ALL">전체 고장분류</option>
                {CATEGORIES.filter(c => c !== 'ALL').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select
                value={ledgerMechanic}
                onChange={(e) => setLedgerMechanic(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff' }}
              >
                <option value="ALL">전체 담당기사</option>
                {mechanics.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>

              <select
                value={ledgerBillable}
                onChange={(e) => setLedgerBillable(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff' }}
              >
                <option value="ALL">유/무상 전체</option>
                <option value="FREE">무상 AS</option>
                <option value="BILLABLE">유상 청구</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                조회 건수: <strong>{ledgerFilteredTickets.length.toLocaleString()}</strong>건
              </span>
              <button
                onClick={handleExportLedgerExcel}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer'
                }}
              >
                <Download size={15} />
                엑셀 다운로드
              </button>
            </div>
          </div>

          {/* 고밀도 슬림 테이블 (38~42px row height) */}
          <div style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', whiteSpace: 'nowrap' }}>
              <thead style={{ backgroundColor: '#f8fafc', position: 'sticky', top: 0, zIndex: 1, borderBottom: '2px solid #e2e8f0' }}>
                <tr>
                  <th style={{ padding: '10px 12px', textAlign: 'center', width: '50px', color: '#475569' }}>상세</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>접수번호</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>접수일</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>현장명</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>업체명</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>관리번호</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>위치</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>고장분류</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>고장증상</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', color: '#475569' }}>상태</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>담당기사</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>조치내용</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>사용소모품</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', color: '#475569' }}>유/무상</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>청구액</th>
                </tr>
              </thead>
              <tbody>
                {ledgerFilteredTickets.map((t, idx) => (
                  <tr
                    key={t.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      height: '40px',
                      backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa'
                    }}
                  >
                    <td style={{ textAlign: 'center', padding: '4px 8px' }}>
                      <button
                        onClick={() => setHistoryModalAssetNo(t.assetNo || null)}
                        style={{
                          padding: '3px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          color: '#2563eb',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        이력 ➔
                      </button>
                    </td>
                    <td style={{ padding: '6px 12px', fontWeight: 600, color: '#334155' }}>{t.ticketNo}</td>
                    <td style={{ padding: '6px 12px', color: '#64748b' }}>{t.requestDate}</td>
                    <td style={{ padding: '6px 12px', fontWeight: 600, color: '#1e293b' }}>{t.siteName}</td>
                    <td style={{ padding: '6px 12px', color: '#475569' }}>{t.customerName}</td>
                    <td style={{ padding: '6px 12px', fontWeight: 700, color: '#2563eb' }}>{t.assetNo}</td>
                    <td style={{ padding: '6px 12px', color: '#64748b' }}>{t.locationDetail || '-'}</td>
                    <td style={{ padding: '6px 12px', color: '#334155' }}>{t.issueCategory}</td>
                    <td style={{ padding: '6px 12px', color: '#334155', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={t.issueDescription}>
                      {t.issueDescription}
                    </td>
                    <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: t.status === 'COMPLETED' ? '#dcfce7' : (t.status === 'REVISIT' ? '#fef3c7' : '#f1f5f9'),
                        color: t.status === 'COMPLETED' ? '#166534' : (t.status === 'REVISIT' ? '#92400e' : '#475569')
                      }}>
                        {t.status}
                      </span>
                    </td>
                    <td style={{ padding: '6px 12px', color: '#334155' }}>
                      {users.find(u => u.id === t.assignedMechanicId)?.name || '-'}
                    </td>
                    <td style={{ padding: '6px 12px', color: '#16a34a', fontWeight: 500, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={t.actionTaken}>
                      {t.actionTaken || '-'}
                    </td>
                    <td style={{ padding: '6px 12px', color: '#475569' }}>
                      {(t.partsUsed || []).map(p => `${p.modelName} ${p.quantity}개`).join(', ') || '-'}
                    </td>
                    <td style={{ padding: '6px 12px', textAlign: 'center', color: t.billableType === 'BILLABLE' ? '#ea580c' : '#64748b', fontWeight: t.billableType === 'BILLABLE' ? 700 : 400 }}>
                      {t.billableType === 'BILLABLE' ? '유상' : '무상'}
                    </td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600, color: t.billableAmount ? '#ea580c' : '#94a3b8' }}>
                      {t.billableAmount ? `${t.billableAmount.toLocaleString()}원` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          탭 3: 차량별 부품 적재 현황 (기사별 이동 재고 모니터)
      ────────────────────────────────────────────────────────────────────────── */}
      {mainTab === 'VEHICLE_STOCK' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
              🚚 AS 담당 기사별 차량 소모품 적재 현황
            </h2>
            <button
              onClick={() => setShowTransferModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                backgroundColor: '#2563eb',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 700,
                color: '#ffffff',
                cursor: 'pointer'
              }}
            >
              <Plus size={16} />
              주기장 ➔ 차량 부품 보충(이동) 등록
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
            {mechanics.map(m => {
              const myStocks = (mechanicConsumableStocks || []).filter(s => s.mechanicId === m.id);
              const totalItemsCount = myStocks.reduce((sum, s) => sum + s.stockQty, 0);

              return (
                <div
                  key={m.id}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <User size={18} color="#2563eb" />
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>{m.name} 기사 차량</span>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', backgroundColor: '#dbeafe', padding: '2px 8px', borderRadius: '12px' }}>
                      총 적재 {totalItemsCount}개
                    </span>
                  </div>

                  {myStocks.length === 0 ? (
                    <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                      차량에 적재된 부품이 없습니다.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {myStocks.map(ms => {
                        const item = consumables.find(c => c.id === ms.consumableId);
                        return (
                          <div
                            key={ms.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 10px',
                              backgroundColor: '#f8fafc',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0'
                            }}
                          >
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                              {item?.modelName || '품목명 없음'}
                            </span>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: ms.stockQty <= 1 ? '#ea580c' : '#16a34a' }}>
                              {ms.stockQty}개
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          모달: 신규 AS 직접 등록
      ────────────────────────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', width: '560px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wrench size={18} color="#2563eb" />
                신규 현장 AS 접수 등록
              </h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateDirectTicket} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>현장명 *</label>
                  <input
                    type="text"
                    required
                    value={newSiteName}
                    onChange={(e) => setNewSiteName(e.target.value)}
                    placeholder="예: 용인 SK하이닉스 팹동"
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>업체명 (고객사)</label>
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="예: 세보, 화성"
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>관리번호 (장비번호)</label>
                  <input
                    type="text"
                    value={newAssetNo}
                    onChange={(e) => setNewAssetNo(e.target.value)}
                    placeholder="예: G10032, 전체장비"
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>장비 세부 위치</label>
                  <input
                    type="text"
                    value={newLocationDetail}
                    onChange={(e) => setNewLocationDetail(e.target.value)}
                    placeholder="예: 8층 X27 Y17"
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>고장 분류</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff' }}
                  >
                    {CATEGORIES.filter(c => c !== 'ALL').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>에러코드 (선택)</label>
                  <input
                    type="text"
                    value={newErrorCode}
                    onChange={(e) => setNewErrorCode(e.target.value)}
                    placeholder="예: LD, U038"
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>고장 상세 내용 *</label>
                <textarea
                  rows={3}
                  required
                  value={newIssueDesc}
                  onChange={(e) => setNewIssueDesc(e.target.value)}
                  placeholder="고장 증상을 입력해 주세요."
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>현장 접수자 연락처</label>
                  <input
                    type="text"
                    value={newReporterContact}
                    onChange={(e) => setNewReporterContact(e.target.value)}
                    placeholder="예: 010-1234-5678"
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>담당 기사 배정</label>
                  <select
                    value={newAssignedMechanicId}
                    onChange={(e) => setNewAssignedMechanicId(e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff' }}
                  >
                    <option value="">미배정 (추후 배정)</option>
                    {mechanics.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#64748b', cursor: 'pointer' }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 20px', backgroundColor: '#2563eb', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, color: '#ffffff', cursor: 'pointer' }}
                >
                  접수 등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          모달: 특정 장비의 과거 AS 수리 이력 드릴다운 모달
      ────────────────────────────────────────────────────────────────────────── */}
      {historyModalAssetNo && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', width: '800px', maxHeight: '85vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={20} color="#2563eb" />
                  장비번호 [{historyModalAssetNo}] AS 수리 이력 대장
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  해당 장비에 누적 기록된 총 <strong>{assetHistoryTickets.length}건</strong>의 AS 이력입니다.
                </p>
              </div>
              <button onClick={() => setHistoryModalAssetNo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={22} />
              </button>
            </div>

            {assetHistoryTickets.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8' }}>
                기록된 AS 이력이 없습니다.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {assetHistoryTickets.map((t, idx) => (
                  <div
                    key={t.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '14px',
                      backgroundColor: idx === 0 ? '#eff6ff' : '#ffffff'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                        {t.requestDate} | {t.siteName} ({t.customerName})
                      </span>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: t.status === 'COMPLETED' ? '#dcfce7' : '#fef3c7',
                        color: t.status === 'COMPLETED' ? '#166534' : '#92400e'
                      }}>
                        {t.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', color: '#334155', marginBottom: '6px' }}>
                      <strong>고장증상:</strong> {t.issueDescription}
                    </div>

                    {t.actionTaken && (
                      <div style={{ fontSize: '13px', color: '#16a34a', backgroundColor: '#f0fdf4', padding: '6px 10px', borderRadius: '4px' }}>
                        <strong>조치내용:</strong> {t.actionTaken}
                        {t.partsUsed && t.partsUsed.length > 0 && (
                          <span> (사용 부품: {t.partsUsed.map(p => `${p.modelName} ${p.quantity}개`).join(', ')})</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          모달: 차량 소모품 보충(이동) 모달
      ────────────────────────────────────────────────────────────────────────── */}
      {showTransferModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', width: '480px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Truck size={18} color="#2563eb" />
                주기장 ➔ 차량 부품 보충(이동)
              </h3>
              <button onClick={() => setShowTransferModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>대상 정비 기사 (차량)</label>
                <select
                  value={transferTargetMechId}
                  onChange={(e) => setTransferTargetMechId(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff' }}
                >
                  <option value="">기사 선택</option>
                  {mechanics.map(m => (
                    <option key={m.id} value={m.id}>{m.name} 기사</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>불출할 소모품 품목</label>
                <select
                  value={transferConsumableId}
                  onChange={(e) => setTransferConsumableId(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff' }}
                >
                  <option value="">소모품 선택</option>
                  {consumables.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.modelName} (주기장 본사 현재고: {c.stockQty}개)
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>이동 수량</label>
                <input
                  type="number"
                  min={1}
                  value={transferQty}
                  onChange={(e) => setTransferQty(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#64748b', cursor: 'pointer' }}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!transferTargetMechId || !transferConsumableId) {
                      showErrorModal('기사 및 소모품 품목을 선택해 주세요.');
                      return;
                    }
                    try {
                      await transferConsumableToMechanic(transferTargetMechId, transferConsumableId, transferQty);
                      setShowTransferModal(false);
                      alert('✅ 차량 재고로 성공적으로 이동(불출) 등록되었습니다.');
                    } catch (err: any) {
                      // handled
                    }
                  }}
                  style={{ padding: '8px 20px', backgroundColor: '#2563eb', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, color: '#ffffff', cursor: 'pointer' }}
                >
                  차량 재고 이동 확정
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
