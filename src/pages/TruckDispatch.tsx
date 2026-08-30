import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { 
  Truck, Check, AlertCircle, Plus, Trash2, Clock, Layers, 
  FileText, Copy, Lock, CreditCard, CheckCircle, RefreshCw, X,
  Calendar, RotateCcw, ShieldCheck, CheckSquare, XCircle, Search,
  MessageSquare, User, Edit2, Upload, Download, FileSpreadsheet,
  CheckCircle2, AlertTriangle, Filter, DollarSign, Send, Sun, MapPin
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Delivery, TransportCompany, TransportDriver, db, DeliveryStatus } from '../services/db';
import { DestinationWeatherModal } from '../components/DestinationWeatherModal';

const VEHICLE_TYPE_OPTIONS = ['1.4T', '2.5T', '3.5T', '5T', '5T장축', '8.5T', '11T', '노배드'];

interface VehicleReq {
  vehicleType: string;
  count: number;
}

interface CargoItem {
  modelName: string;
  count: number;
}

interface AssignedVehicleRow {
  id: string;
  transportCompany: string;
  vehicleType: string;
  vehicleNo: string;
  driverName: string;
  driverContact: string;
  expectedCost: number; // 💰 예상 운송비 (원) - 필수
  finalCost?: number;   // 💵 실제 운송비 (원) - 선택
  deliveryCost: number; // 기존 호환용
}

export interface ReconPairRow {
  pairId: string;
  systemDelivery?: Delivery;
  excelRow?: any;
  matchStatus: 'MATCHED' | 'MISMATCH' | 'SYSTEM_ONLY' | 'EXCEL_ONLY' | 'PENDING' | 'PAYMENT_REQUESTED';
  systemCost: number;
  excelCost: number;
  diffCost: number;
  memo?: string;
  isReconciled: boolean;
}

export const TruckDispatch: React.FC = () => {
  const { 
    deliveries, contracts, customers, products, sites,
    contractAssets, assets,
    transportCompanies, transportDrivers, outboundInspections, hasPermission, 
    refreshAllData, showErrorModal, convertReconciledDeliveriesToSettlement
  } = useApp();

  const canSave = hasPermission('delivery', 'save');

  // 출고 검수 상태 파싱 헬퍼
  const getOutboundInspectionStatus = (contractId?: string) => {
    if (!contractId) return 'NONE';
    const insps = outboundInspections.filter(i => i.contractId === contractId);
    if (insps.length === 0) return 'NONE';
    if (insps.some(i => i.status === 'REJECTED')) return 'REJECTED';
    if (insps.every(i => i.status === 'COMPLETED')) return 'COMPLETED';
    if (insps.some(i => i.status === 'IN_PROGRESS')) return 'IN_PROGRESS';
    return 'PENDING';
  };

  const getOutboundInspectionBadge = (contractId?: string) => {
    const status = getOutboundInspectionStatus(contractId);
    switch (status) {
      case 'REJECTED':
        return (
          <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, backgroundColor: 'rgba(239,68,68,0.15)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <AlertCircle size={12} /> 🔴 출고의뢰 반려됨
          </span>
        );
      case 'COMPLETED':
        return (
          <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, backgroundColor: 'rgba(34,197,94,0.15)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <CheckCircle size={12} /> 🟢 출고승인 완료
          </span>
        );
      case 'IN_PROGRESS':
      case 'PENDING':
        return (
          <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, backgroundColor: 'rgba(59,130,246,0.15)', color: '#2563eb', border: '1px solid rgba(59,130,246,0.3)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <Clock size={12} /> 🔵 출고검수 진행중
          </span>
        );
      default:
        return null;
    }
  };

  const getContract = (contractId?: string) => contracts.find(c => c.id === contractId);
  const getCustomer = (customerId?: string) => customers.find(c => c.id === customerId);

  // 회수 배차 대상 자산 조회 (delivery.assetIds 우선 매핑, 없으면 contractId 기준)
  const getReturnAssets = (delivery: Delivery) => {
    if (!delivery) return [];
    if (delivery.assetIds) {
      const ids = delivery.assetIds.split(',').map(id => id.trim()).filter(Boolean);
      const found = ids.map(id => assets.find(a => a.id === id)).filter(Boolean) as Asset[];
      if (found.length > 0) {
        return found.map(a => ({ modelName: a.modelName || '-', assetNo: a.assetNo || '-', id: a.id }));
      }
    }
    if (delivery.contractId) {
      return contractAssets
        .filter(ca => ca.contractId === delivery.contractId)
        .map(ca => {
          const asset = assets.find(a => a.id === ca.assetId);
          return asset ? { modelName: asset.modelName || ca.modelName || '-', assetNo: asset.assetNo || '-', id: asset.id } : null;
        })
        .filter(Boolean) as { modelName: string; assetNo: string; id: string }[];
    }
    return [];
  };

  // 출고/입고 요청서 인쇄
  const handlePrintDispatchRequest = (delivery: Delivery, docType: 'OUTBOUND' | 'INBOUND') => {
    const contract = getContract(delivery.contractId);
    const customer = contract ? getCustomer(contract.customerId) : null;
    const site = sites?.find(s => s.id === contract?.siteId);
    const cargoItems = parseCargoItems(delivery);
    const returnAssets = getReturnAssets(delivery);
    const isOutbound = docType === 'OUTBOUND';
    const title = isOutbound ? '출고요청서' : '입고요청서';
    const today = new Date().toISOString().split('T')[0];

    const assetRows = isOutbound
      ? cargoItems.map((c, i) => `<tr><td>${i + 1}</td><td>${c.modelName}</td><td>${c.count}대</td><td></td><td></td></tr>`).join('')
      : returnAssets.map((a, i) => `<tr><td>${i + 1}</td><td>${a.modelName}</td><td>{${a.assetNo}}</td><td>1대</td><td></td></tr>`).join('');

    const fromLabel = isOutbound ? '상차지 (출발)' : '상차지 (회수지)';
    const toLabel   = isOutbound ? '하차지 (현장)' : '하차지 (반납지)';
    const fromAddr  = isOutbound ? (delivery.originAddress || '당사 창고') : (delivery.destinationAddress || site?.address || '-');
    const toAddr    = isOutbound ? (delivery.destinationAddress || site?.address || '-') : (delivery.originAddress || '당사 창고');

    const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>${title}</title>
<style>
  body { font-family: 'Malgun Gothic', sans-serif; font-size: 12px; margin: 24px; color: #111; }
  h1 { text-align: center; font-size: 20px; font-weight: 900; margin-bottom: 4px; }
  .sub { text-align: center; font-size: 11px; color: #666; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { border: 1px solid #888; padding: 6px 8px; }
  th { background: #f0f0f0; font-weight: 700; text-align: left; width: 120px; }
  .asset-table th { text-align: center; background: #e8eef8; }
  .asset-table td { text-align: center; }
  .sign-row { display: flex; gap: 16px; margin-top: 24px; }
  .sign-box { flex: 1; border: 1px solid #888; border-radius: 4px; padding: 10px 14px; min-height: 60px; }
  .sign-label { font-weight: 700; font-size: 11px; color: #555; margin-bottom: 8px; }
  @media print { body { margin: 10px; } button { display: none; } }
</style>
</head><body>
<h1>기연리프트 ${title}</h1>
<div class="sub">문서번호: ${delivery.id} | 발행일자: ${today}</div>
<table>
  <tr><th>계약번호</th><td>${contract?.contractNo || '-'}</td><th>배차구분</th><td>${delivery.dispatchCategory || (isOutbound ? '출고' : '입고')}</td></tr>
  <tr><th>고객사</th><td>${customer?.name || '-'}</td><th>현장</th><td>${site?.name || '-'}</td></tr>
  <tr><th>요청일</th><td>${delivery.requestDate || '-'}</td><th>배차일</th><td>${delivery.loadingDate || '-'}</td></tr>
  <tr><th>${fromLabel}</th><td>${fromAddr}</td><th>${toLabel}</th><td>${toAddr}</td></tr>
  <tr><th>담당 기사</th><td>${delivery.driverName || '(미배정)'}</td><th>차량번호</th><td>${delivery.vehicleNo || '-'}</td></tr>
  <tr><th>비고</th><td colspan="3">${delivery.memo || ''}</td></tr>
</table>
<table class="asset-table">
  <thead><tr><th>No</th><th>모델명</th>${isOutbound ? '<th>수량</th><th>비고</th><th>서명</th>' : '<th>관리번호</th><th>수량</th><th>비고</th>'}</tr></thead>
  <tbody>${assetRows || '<tr><td colspan="5" style="text-align:center;color:#999;">장비 정보 없음</td></tr>'}</tbody>
</table>
<div class="sign-row">
  <div class="sign-box"><div class="sign-label">${isOutbound ? '출고' : '회수'} 담당자 확인</div></div>
  <div class="sign-box"><div class="sign-label">현장 수령인 서명</div></div>
  <div class="sign-box"><div class="sign-label">운송 기사 서명</div></div>
</div>
<div style="margin-top:16px;text-align:center">
  <button onclick="window.print()" style="padding:8px 24px;font-size:13px;cursor:pointer;">🖨️ 인쇄</button>
</div>
</body></html>`;

    const w = window.open('', '_blank', 'width=800,height=900');
    if (w) { w.document.write(html); w.document.close(); }
  };

  // 1. 배차 4단계 진행 상태 판정 헬퍼
  const getNormalizedDeliveryStatus = (d: Delivery): 'PENDING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED' => {
    if (!d) return 'PENDING';
    if (d.status === 'DISPATCHED') return 'DISPATCHED';
    if (d.status === 'DELIVERED' || d.status === 'COMPLETED') return 'DELIVERED';
    if (d.status === 'CANCELLED') return 'CANCELLED';
    return 'PENDING';
  };

  // 엑셀 날짜(시리얼 숫자 46174 등 또는 포맷팅 텍스트)를 YYYY-MM-DD로 변환하는 정규화 헬퍼
  const formatExcelDateStr = (rawVal: any): string => {
    if (!rawVal) return '-';
    const str = String(rawVal).trim();
    if (!str) return '-';

    // 1. 엑셀 시리얼 숫자 (예: 46174)
    if (!isNaN(Number(str)) && Number(str) > 30000 && Number(str) < 60000) {
      const serial = Number(str);
      const utcDays = Math.floor(serial - 25569);
      const utcValue = utcDays * 86400;
      const dateObj = new Date(utcValue * 1000);
      const year = dateObj.getUTCFullYear();
      const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // 2. 06월 01일 포맷
    const currentYear = new Date().getFullYear();
    if (str.includes('월') && str.includes('일')) {
      const mMatch = str.match(/(\d+)월\s*(\d+)일/);
      if (mMatch) {
        return `${currentYear}-${String(mMatch[1]).padStart(2, '0')}-${String(mMatch[2]).padStart(2, '0')}`;
      }
    }

    // 3. 6/1 포맷
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 2) {
        return `${currentYear}-${String(parts[0]).padStart(2, '0')}-${String(parts[1]).padStart(2, '0')}`;
      } else if (parts.length === 3) {
        return `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
      }
    }

    return str;
  };

  const [activeTab, setActiveTab] = useState<'DISPATCH' | 'RECONCILIATION'>('DISPATCH');

  // 4단계 배차 진행 상태 탭 state ('ALL' | 'PENDING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED')
  const [activeDispatchStatusTab, setActiveDispatchStatusTab] = useState<string>('ALL');

  // 📅 배차 요청/운송일 기간 조회 피커 state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleSetDateRange = (type: 'TODAY' | 'WEEK' | 'MONTH' | 'ALL') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    if (type === 'TODAY') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (type === 'WEEK') {
      const future = new Date();
      future.setDate(today.getDate() + 7);
      setStartDate(todayStr);
      setEndDate(future.toISOString().split('T')[0]);
    } else if (type === 'MONTH') {
      const future = new Date();
      future.setMonth(today.getMonth() + 1);
      setStartDate(todayStr);
      setEndDate(future.toISOString().split('T')[0]);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  
  // 배차 세부 유형 ('출고' | '입고' | '반납' | '정비' | '이동')
  const [dispatchCategory, setDispatchCategory] = useState<'출고' | '입고' | '반납' | '정비' | '이동' | '교환'>('출고');
  
  // 상차 일시 & 시간 지정
  const [loadingDate, setLoadingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loadingTimeSlot, setLoadingTimeSlot] = useState('오전');
  const [loadingCustomTime, setLoadingCustomTime] = useState('');

  // 하차 일시 & 시간 지정
  const [unloadingDate, setUnloadingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [unloadingTimeSlot, setUnloadingTimeSlot] = useState('오전');
  const [unloadingCustomTime, setUnloadingCustomTime] = useState('');

  // --- 하차지 일기예보 모달 state ---
  const [showDestWeatherModal, setShowDestWeatherModal] = useState(false);
  const [destWeatherParams, setDestWeatherParams] = useState({
    customerName: '',
    siteName: '',
    rawAddress: ''
  });

  const handleOpenDestWeatherForDelivery = (del?: Delivery | null, customAddress?: string) => {
    let customerName = '-';
    let siteName = '-';
    let rawAddress = customAddress || destinationAddress || '';

    if (del) {
      const contract = contracts.find(c => c.id === del.contractId);
      const customer = customers.find(cust => cust.id === contract?.customerId);
      const site = sites?.find(s => s.id === contract?.siteId);

      customerName = customer?.name || (del as any).customerName || '-';
      siteName = site?.name || (typeof site === 'string' ? site : '현장미지정');
      
      if (!rawAddress) {
        rawAddress = site?.address || customer?.address || '';
        if (!rawAddress && del.memo) {
          const match = del.memo.match(/주소:\s*(.*?)(?=\||$)/);
          if (match) rawAddress = match[1].trim();
        }
      }
    }

    setDestWeatherParams({
      customerName: customerName || '배차 하차지',
      siteName: siteName || '현장',
      rawAddress: rawAddress || '경기도 용인시'
    });
    setShowDestWeatherModal(true);
  };

  // 실무자 마감 비고
  const [closingMemo, setClosingMemo] = useState('');

  const [scheduledDate, setScheduledDate] = useState('');
  const [originAddress, setOriginAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [billableToCust, setBillableToCust] = useState(false);
  const [billableCustId, setBillableCustId] = useState('');
  const [assignedVehicles, setAssignedVehicles] = useState<AssignedVehicleRow[]>([]);

  // 수동 배차 모달 state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualCategory, setManualCategory] = useState<'출고' | '입고' | '반납' | '정비' | '이동'>('출고');
  const [manualCustomerId, setManualCustomerId] = useState('');
  const [manualContractId, setManualContractId] = useState('');
  const [manualOrigin, setManualOrigin] = useState('당사 보관소');
  const [manualDestination, setManualDestination] = useState('');
  const [manualLoadingDate, setManualLoadingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [manualLoadingTimeSlot, setManualLoadingTimeSlot] = useState('오전');
  const [manualLoadingCustomTime, setManualLoadingCustomTime] = useState('');
  const [manualUnloadingDate, setManualUnloadingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [manualUnloadingTimeSlot, setManualUnloadingTimeSlot] = useState('오전');
  const [manualUnloadingCustomTime, setManualUnloadingCustomTime] = useState('');
  const [manualExpectedCost, setManualExpectedCost] = useState(70000);
  const [manualBillable, setManualBillable] = useState(false);
  const [manualMemo, setManualMemo] = useState('');
  const [manualClosingMemo, setManualClosingMemo] = useState('');

  const [manualVehicles, setManualVehicles] = useState<VehicleReq[]>([{ vehicleType: '3.5T', count: 1 }]);
  const [manualCargos, setManualCargos] = useState<CargoItem[]>([{ modelName: products[0]?.modelName || 'Skyjack SJ3219', count: 1 }]);

  // 📄 [월말 운송료 대사 탭 state & 1:1 Split Pair 파이프라인]
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reconStartDate, setReconStartDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [reconEndDate, setReconEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedReconCompany, setSelectedReconCompany] = useState<string>('ALL');
  const [reconStatusFilter, setReconStatusFilter] = useState<'ALL' | 'PENDING' | 'MATCHED' | 'MISMATCH' | 'PAYMENT_REQUESTED'>('ALL');
  const [reconSearchQuery, setReconSearchQuery] = useState<string>('');

  // 1:1 Pair 행 배열 state 및 독립 듀얼 패널 선택 state
  const [reconPairs, setReconPairs] = useState<ReconPairRow[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [selectedPairIds, setSelectedPairIds] = useState<Set<string>>(new Set());
  const [reconNotificationMsg, setReconNotificationMsg] = useState<string>('');
  const [selectedSystemDeliveryId, setSelectedSystemDeliveryId] = useState<string | null>(null);
  const [selectedExcelRowIndex, setSelectedExcelRowIndex] = useState<number | null>(null);

  // 💡 [사장님 지시] 금액 수정 모달 state & DB 반영 핸들러
  const [showCostEditModal, setShowCostEditModal] = useState<boolean>(false);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [editingCostInput, setEditingCostInput] = useState<number>(0);

  const handleOpenCostEdit = (d: Delivery, currentCost: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDelivery(d);
    setEditingCostInput(currentCost);
    setShowCostEditModal(true);
  };

  const handleSaveDeliveryCost = async () => {
    if (!editingDelivery) return;
    const newCost = Number(editingCostInput);
    if (isNaN(newCost) || newCost < 0) {
      showErrorModal('유효한 금액을 입력해 주세요.');
      return;
    }

    try {
      // 1. DB (deliveries 테이블) 동기 업데이트 수행 (deliveryCost 및 assignedVehicles 차량 운송비 동시 동기화)
      const updatedVehicles = editingDelivery.assignedVehicles && editingDelivery.assignedVehicles.length > 0
        ? editingDelivery.assignedVehicles.map((v, i) => i === 0 ? { ...v, deliveryCost: newCost } : { ...v, deliveryCost: 0 })
        : [];

      const updateData: any = {
        finalCost: newCost,
        deliveryCost: newCost
      };

      if (updatedVehicles.length > 0) {
        updateData.assignedVehicles = updatedVehicles;
      }

      db.updateRow('deliveries', editingDelivery.id, updateData);

      // 💡 [사장님 지시] 원격 Supabase DB 쓰기가 100% 완료될 때까지 동기 대기 (Zero Silent Failures)
      await db.awaitPendingWrites();

      // 💡 [사장님 지시] 단순 대기만 하지 않고, 실제 DB를 다시 SELECT 읽기조회하여 목표 금액으로 100% 정상 수정되었는지 실시간 검증 (Read-Back Verification)
      const verifiedDelivery = db.deliveries.find(d => d.id === editingDelivery.id);
      const verifiedCost = verifiedDelivery ? (verifiedDelivery.deliveryCost || (verifiedDelivery.assignedVehicles && verifiedDelivery.assignedVehicles[0]?.deliveryCost) || 0) : 0;

      if (!verifiedDelivery || verifiedCost !== newCost) {
        throw new Error(`DB 반영 검증 실패 (목표 금액: ₩${newCost.toLocaleString()}원 vs 실제 DB 저장액: ₩${verifiedCost.toLocaleString()}원). DB 갱신이 정상적으로 처리되지 않았습니다.`);
      }

      // 2. 전체 데이터 및 state 갱신
      await refreshAllData();

      // 3. 1:1 대사 reconPairs 실시간 차액 및 자동 짝짓기 재계산
      setReconPairs(prev => prev.map(p => {
        if (p.systemDelivery?.id === editingDelivery.id) {
          const excelCost = p.excelCost || 0;
          const newDiff = excelCost > 0 ? (excelCost - newCost) : 0;
          const isMatchedNow = p.excelRow ? (newDiff === 0 && excelCost > 0) : false;

          return {
            ...p,
            systemCost: newCost,
            diffCost: newDiff,
            matchStatus: isMatchedNow ? 'MATCHED' : (newDiff !== 0 && excelCost > 0 ? 'MISMATCH' : p.matchStatus),
            isReconciled: isMatchedNow,
            memo: isMatchedNow ? '금액 수정 후 100% 일치 대사 완료' : `금액 수정 반영됨 (시스템 ₩${newCost.toLocaleString()}원)`
          };
        }
        return p;
      }));

      setShowCostEditModal(false);
      setEditingDelivery(null);
      setReconNotificationMsg(`💰 [${editingDelivery.id}] 배차 운송료가 ₩${newCost.toLocaleString()}원으로 수정되어 DB에 반영되었습니다.`);
    } catch (err: any) {
      showErrorModal('금액 수정 중 오류가 발생하였습니다: ' + err.message);
    }
  };

  // 💡 [사장님 지시] 좌측 1개 행 + 우측 1개 행 수동 선택 1:1 대사완료 매칭
  const handleManualPairMatch = () => {
    if (!selectedSystemDeliveryId || selectedExcelRowIndex === null) {
      showErrorModal('좌측 시스템 배차 1건과 우측 엑셀 항목 1건을 각각 선택해 주세요.');
      return;
    }

    const sysD = deliveries.find(d => d.id === selectedSystemDeliveryId);
    const excelRows = reconPairs.filter(p => p.excelRow);
    const excelPair = excelRows[selectedExcelRowIndex];

    if (!sysD || !excelPair) {
      showErrorModal('선택한 배차 또는 엑셀 항목을 찾을 수 없습니다.');
      return;
    }

    const sysCost = sysD.deliveryCost || sysD.assignedVehicles?.reduce((acc: number, v: any) => acc + (v.deliveryCost || 0), 0) || 70000;
    const costKey = Object.keys(excelPair.excelRow).find(k => k.includes('합계') || k.includes('운송비') || k.includes('청구금액') || k.includes('금액'));
    const excelCost = costKey ? Number(String(excelPair.excelRow[costKey]).replace(/[^0-9.-]+/g, '')) : 0;
    const diff = excelCost - sysCost;

    // 💡 [사장님 지시] 좌측/우측 금액 상이 시 대사 처리 거절
    if (diff !== 0) {
      showErrorModal(`⚠️ [대사 처리 거절]\n\n• 좌측 시스템 금액: ₩${sysCost.toLocaleString()}원\n• 우측 엑셀 청구금액: ₩${excelCost.toLocaleString()}원\n• 차액: ₩${Math.abs(diff).toLocaleString()}원\n\n좌측과 우측 패널의 금액이 상이한 항목은 대사 처리가 불가능합니다.`);
      return;
    }

    setReconPairs(prev => {
      const filtered = prev.filter(p => p.systemDelivery?.id !== sysD.id && p.pairId !== excelPair.pairId);
      return [
        ...filtered,
        {
          pairId: `MANUAL-PAIR-${sysD.id}-${Date.now()}`,
          systemDelivery: sysD,
          excelRow: excelPair.excelRow,
          matchStatus: 'MATCHED',
          systemCost: sysCost,
          excelCost,
          diffCost: diff,
          memo: '담당자 1:1 수동 선택 대사 완료',
          isReconciled: true
        }
      ];
    });

    setSelectedSystemDeliveryId(null);
    setSelectedExcelRowIndex(null);
    setReconNotificationMsg(`✅ [${sysD.id}] 배차건과 엑셀 행이 1:1 수동 대사 완료 처리되었습니다.`);
  };

  // 📅 기간 선택 피커 헬퍼
  const handleSetReconDatePreset = (preset: 'THIS_MONTH' | 'LAST_MONTH' | '1M' | '3M' | 'ALL') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === 'THIS_MONTH') {
      const firstDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      setReconStartDate(firstDay);
      setReconEndDate(todayStr);
    } else if (preset === 'LAST_MONTH') {
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthLastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      setReconStartDate(lastMonth.toISOString().split('T')[0]);
      setReconEndDate(lastMonthLastDay.toISOString().split('T')[0]);
    } else if (preset === '1M') {
      const past = new Date();
      past.setMonth(today.getMonth() - 1);
      setReconStartDate(past.toISOString().split('T')[0]);
      setReconEndDate(todayStr);
    } else if (preset === '3M') {
      const past = new Date();
      past.setMonth(today.getMonth() - 3);
      setReconStartDate(past.toISOString().split('T')[0]);
      setReconEndDate(todayStr);
    } else {
      setReconStartDate('');
      setReconEndDate('');
    }
  };

  // 🚚 운송 완료(DELIVERED) 건들 대사 대상 필터링
  const completedDeliveriesForRecon = useMemo(() => {
    return deliveries.filter(d => {
      // 1. 운송 완료건만 대상
      if (getNormalizedDeliveryStatus(d) !== 'DELIVERED') return false;

      // 2. 날짜 필터
      const dDate = d.loadingDate || d.requestDate || d.scheduledDate || d.createdAt?.substring(0, 10);
      if (reconStartDate && dDate && dDate < reconStartDate) return false;
      if (reconEndDate && dDate && dDate > reconEndDate) return false;

      // 3. 운송 거래처 필터
      if (selectedReconCompany !== 'ALL') {
        const matchComp = d.assignedVehicles?.some((v: any) => v.transportCompany.trim() === selectedReconCompany.trim()) || 
                          (d.transportCompany && d.transportCompany.trim() === selectedReconCompany.trim());
        if (!matchComp) return false;
      }

      // 5. 검색어 (배차ID, 기사명, 거래처, 고객사명)
      if (reconSearchQuery) {
        const q = reconSearchQuery.toLowerCase();
        const contract = contracts.find(c => c.id === d.contractId);
        const customer = contract ? customers.find(c => c.id === contract.customerId) : null;
        const match = (d.id && d.id.toLowerCase().includes(q)) ||
          (d.driverName && d.driverName.toLowerCase().includes(q)) ||
          (d.destinationAddress && d.destinationAddress.toLowerCase().includes(q)) ||
          (contract && contract.contractNo.toLowerCase().includes(q)) ||
          (customer && customer.name.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [deliveries, reconStartDate, reconEndDate, selectedReconCompany, reconSearchQuery, contracts, customers]);

  // 거래명세서 엑셀 파싱 및 스마트 1:1 페어링 파이프라인 (헤더 동적 검색 & 다중 비고 병합 & 디토 상속 적용)
  const handleExcelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // 1. Raw 2D 배열로 먼저 읽기 (헤더 행 동적 감지용)
        const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (!rawRows || rawRows.length === 0) {
          showErrorModal('업로드한 엑셀 파일에 데이터가 없습니다.');
          return;
        }

        // 2. 동적 헤더 행 감지 (핵심 버그 수정: 셀 단위 정확 매칭)
        // ⚠️ 이전 방식(rowText.includes)은 "합계금액"에서 '합계'+'금액' 두 키워드가 동시에 매칭되어
        //    11행(합계금액 7,304,000)을 잘못 헤더로 인식하는 심각한 버그가 있었음.
        // → 수정: 각 셀을 개별 비교하여 키워드가 셀 자체에 있는지 체크하는 정밀 감지 방식으로 전면 교체.
        const headerKeywords = ['일자', '날짜', '상차지', '하차지', '톤수', '차종', '운송비', '현장명', '업체명', '기사명', '비고', 'no'];
        let headerRowIndex = -1;

        for (let r = 0; r < Math.min(30, rawRows.length); r++) {
          // 셀 단위로 정확히 비교: 각 셀의 trim().toLowerCase() 값이 키워드와 일치하거나 키워드를 포함하는지 체크
          const cells = rawRows[r].map((c: any) => String(c).trim().toLowerCase());
          const matchCount = headerKeywords.filter(kw =>
            cells.some((cell: string) => cell === kw || (cell.length <= 10 && cell.includes(kw)))
          ).length;
          if (matchCount >= 3) {
            headerRowIndex = r;
            break;
          }
        }

        if (headerRowIndex === -1) {
          headerRowIndex = 0; // Fallback
        }

        // 3. 헤더 컬럼명 추출 (빈 헤더 셀 → 위치 기반 자동명 부여)
        const rawHeaderRow = rawRows[headerRowIndex] || [];
        const headerNames: string[] = rawHeaderRow.map((col: any, cIdx: number) => {
          const title = String(col).trim();
          if (title) return title;
          // 헤더명이 없는 열: 인접한 오른쪽 비고형 열은 자동으로 '비고_N' 명칭 부여
          return `비고_${cIdx + 1}`;
        });

        // 비고형으로 판단할 컬럼인지 확인하는 헬퍼
        const isMemoKey = (k: string) => {
          const kl = k.toLowerCase();
          return kl.includes('현장') || kl.includes('업체') || kl.includes('비고') ||
                 kl.includes('메모') || kl.includes('특이') || kl.includes('참고');
        };

        // 4. 데이터 행 구성 (디토 상속 & 다중 비고 병합)
        const parsedRows: any[] = [];
        let lastDate = '';
        let lastOrigin = '';
        let lastDest = '';

        // 디토 기호 감지 헬퍼
        const isDitto = (val: string) =>
          !val || val === '"' || val === '·' || val === '〃' || val === "''";

        for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
          const rowArr = rawRows[r];
          if (!rowArr || rowArr.every((cell: any) => String(cell).trim() === '')) continue;

          // 하단 합계/소계/서명 행 감지: NO 컬럼 또는 첫 두 셀에 집계 키워드가 있거나 날짜/서명 행인 경우 스킵
          const firstCellClean = String(rowArr[0] || '').replace(/\s+/g, '');
          const secondCellClean = String(rowArr[1] || '').replace(/\s+/g, '');
          const thirdCellClean = String(rowArr[2] || '').replace(/\s+/g, '');
          const fullRowTextClean = rowArr.map((cell: any) => String(cell).trim()).join(' ');

          const isFooterRow =
            firstCellClean === '합계' || firstCellClean === '소계' || firstCellClean === '계' || firstCellClean === '총계' ||
            secondCellClean === '합계' || secondCellClean === '소계' || thirdCellClean === '합계' ||
            fullRowTextClean.includes('공급가액') || fullRowTextClean.includes('합계금액') || fullRowTextClean.includes('부가세') ||
            fullRowTextClean.includes('운송비거래명세표') || fullRowTextClean.includes('사업장주소') || fullRowTextClean.includes('등록번호') ||
            fullRowTextClean.includes('김원진') || fullRowTextClean.includes('서명') || fullRowTextClean.includes('날인');
          if (isFooterRow) continue;

          const rowObj: any = {};
          headerNames.forEach((hName, cIdx) => {
            rowObj[hName] = String(rowArr[cIdx] !== undefined ? rowArr[cIdx] : '').trim();
          });

          const keys = Object.keys(rowObj);
          const dateKey = keys.find(k => k.includes('일자') || k.includes('날짜') || k.includes('운송일'));
          const originKey = keys.find(k => k.includes('상차지') || k.includes('출발지'));
          const destKey = keys.find(k => k.includes('하차지') || k.includes('도착지'));
          const costKey = keys.find(k => k.includes('합계') || k.includes('운송비') || k.includes('청구금액') || k.includes('금액') || k.includes('운임'));

          // 💡 [사장님 지목 버그 완벽 수술] 디토 상속(이전 행 데이터 가져오기)을 실행하기 전에,
          //    원본 셀에 실제 거래 데이터(일자, 상/하차지, 금액, 현장/업체/비고)나 명시적 디토 기호('"','·','〃')가 있는지 1차 검증!
          const rawDateCell = dateKey ? String(rowObj[dateKey]).trim() : '';
          const rawOriginCell = originKey ? String(rowObj[originKey]).trim() : '';
          const rawDestCell = destKey ? String(rowObj[destKey]).trim() : '';
          const rawCostStr = costKey ? String(rowObj[costKey]).replace(/[^0-9.-]+/g, '') : '';
          const rawCost = Number(rawCostStr) || 0;

          const isExplicitDittoSymbol = (val: string) => val === '"' || val === '·' || val === '〃' || val === "''";

          // 비고/현장/업체 컬럼 원본 셀 데이터 체크
          const rawMemoParts: string[] = [];
          keys.forEach(k => {
            if (!isMemoKey(k)) return;
            const val = String(rowObj[k] || '').trim();
            if (val && !isExplicitDittoSymbol(val) && val !== '-') {
              rawMemoParts.push(val);
            }
          });

          const hasOriginalContent =
            (rawDateCell && !isExplicitDittoSymbol(rawDateCell)) ||
            (rawOriginCell && !isExplicitDittoSymbol(rawOriginCell)) ||
            (rawDestCell && !isExplicitDittoSymbol(rawDestCell)) ||
            (rawCost > 0) ||
            (rawMemoParts.length > 0) ||
            isExplicitDittoSymbol(rawDateCell) ||
            isExplicitDittoSymbol(rawOriginCell) ||
            isExplicitDittoSymbol(rawDestCell);

          // NO(번호)만 들어있고 실제 거래 내용 및 디토 기호가 전부 비어있는 가짜 덤미 행(예: NO 34번)은 디토 상속 전 즉시 패스!
          if (!hasOriginalContent) {
            continue;
          }

          // 디토 상속 처리 (유효 거래 데이터 행인 경우만 집행)
          let rawDate = rawDateCell;
          let rawOrigin = rawOriginCell;
          let rawDest = rawDestCell;
          const excelCost = rawCost;

          if (isDitto(rawDate) && lastDate) rawDate = lastDate;
          else if (rawDate && !isDitto(rawDate)) lastDate = rawDate;

          if (isDitto(rawOrigin) && lastOrigin) rawOrigin = lastOrigin;
          else if (rawOrigin && !isDitto(rawOrigin)) lastOrigin = rawOrigin;

          if (isDitto(rawDest) && lastDest) rawDest = lastDest;
          else if (rawDest && !isDitto(rawDest)) lastDest = rawDest;

          // 날짜 정규화: "6/1" → "2026-06-01", "06월 01일" → "2026-06-01", 엑셀 시리얼 숫자 처리
          const currentYear = new Date().getFullYear();
          let normDate = rawDate;
          if (rawDate) {
            const numVal = Number(rawDate);
            if (!isNaN(numVal) && numVal > 30000 && numVal < 60000) {
              // 엑셀 시리얼 날짜
              const utcDays = Math.floor(numVal - 25569);
              const d = new Date(utcDays * 86400 * 1000);
              normDate = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
            } else if (rawDate.includes('월') && rawDate.includes('일')) {
              const mMatch = rawDate.match(/(\d+)월\s*(\d+)일/);
              if (mMatch) normDate = `${currentYear}-${String(mMatch[1]).padStart(2, '0')}-${String(mMatch[2]).padStart(2, '0')}`;
            } else if (rawDate.includes('/')) {
              const parts = rawDate.split('/');
              if (parts.length === 2) normDate = `${currentYear}-${String(parts[0]).padStart(2, '0')}-${String(parts[1]).padStart(2, '0')}`;
              else if (parts.length === 3) normDate = `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[1]).padStart(2, '0')}`;
            }
          }

          if (dateKey) rowObj[dateKey] = normDate;
          if (originKey) rowObj[originKey] = rawOrigin;
          if (destKey) rowObj[destKey] = rawDest;

          // 비고형 컬럼 자동 병합: 현장명, 업체명, 비고_N 등을 하나의 '비고' 값으로 통합
          const memoParts: string[] = [];
          keys.forEach(k => {
            if (!isMemoKey(k)) return;
            let val = String(rowObj[k] || '').trim();
            if (!val || isDitto(val)) return;
            // "비고: ..." 와 같이 컬럼명이 값 앞에 중복된 경우 제거
            const kBase = k.replace(/_\d+$/, '').trim();
            if (val.startsWith(kBase)) val = val.slice(kBase.length).replace(/^[:\s]+/, '').trim();
            if (!val) return;
            // 순수 비고/무헤더 컬럼은 값만, 나머지(현장명/업체명 등)는 "컬럼명: 값" 형태
            const isRawMemo = k.startsWith('비고');
            memoParts.push(isRawMemo ? val : `${kBase}: ${val}`);
          });

          if (memoParts.length > 0) rowObj['비고'] = memoParts.join(' | ');

          parsedRows.push(rowObj);
        }

        if (parsedRows.length === 0) {
          showErrorModal('엑셀 파싱 결과 데이터 행을 찾을 수 없습니다.');
          return;
        }

        // 5. 1:1 스마트 짝짓기 파이프라인 집행
        const remainingSystemDeliveries = [...completedDeliveriesForRecon];
        const pairs: ReconPairRow[] = [];
        let autoMatchedCount = 0;
        let mismatchCount = 0;

        parsedRows.forEach((row, rIdx) => {
          const keys = Object.keys(row);
          const idKey = keys.find(k => k.includes('배차ID') || k.includes('배차번호') || k.includes('ID') || k.includes('운송ID'));
          const costKey = keys.find(k => k.includes('합계') || k.includes('운송비') || k.includes('청구금액') || k.includes('금액') || k.includes('운임'));
          const driverKey = keys.find(k => k.includes('기사명') || k.includes('운송기사') || k.includes('기사'));
          const dateKey = keys.find(k => k.includes('날짜') || k.includes('일자') || k.includes('운송일'));
          const destKey = keys.find(k => k.includes('하차지') || k.includes('도착지') || k.includes('현장'));

          const excelId = idKey ? String(row[idKey]).trim() : '';
          const excelCost = costKey ? Number(String(row[costKey]).replace(/[^0-9.-]+/g, '')) : 0;
          const excelDriver = driverKey ? String(row[driverKey]).trim() : '';
          const excelDate = dateKey ? String(row[dateKey]).trim() : '';
          const excelDest = destKey ? String(row[destKey]).trim() : '';

          // 1차 매칭: 배차ID 정확 일치
          let matchIdx = -1;
          if (excelId) {
            matchIdx = remainingSystemDeliveries.findIndex(d => d.id.toLowerCase() === excelId.toLowerCase());
          }

          // 2차 매칭: 날짜 + 하차지 + 금액 일치
          if (matchIdx === -1) {
            matchIdx = remainingSystemDeliveries.findIndex(d => {
              const sysDate = d.loadingDate || d.requestDate;
              const sysCost = d.deliveryCost || d.assignedVehicles?.reduce((acc: number, v: any) => acc + (v.deliveryCost || 0), 0) || 70000;
              const sysDest = d.destinationAddress || '';

              const dateMatch = !excelDate || !sysDate || sysDate === excelDate;
              const destMatch = !excelDest || !sysDest || sysDest.includes(excelDest) || excelDest.includes(sysDest);
              const costMatch = excelCost > 0 && sysCost === excelCost;

              return dateMatch && destMatch && costMatch;
            });
          }

          // 3차 매칭: 날짜 + 기사명 일치
          if (matchIdx === -1 && excelDriver) {
            matchIdx = remainingSystemDeliveries.findIndex(d => {
              const sysDate = d.loadingDate || d.requestDate;
              const sysDriver = d.driverName || '';
              const dateMatch = !excelDate || !sysDate || sysDate === excelDate;
              const driverMatch = sysDriver && sysDriver.trim() === excelDriver;
              return dateMatch && driverMatch;
            });
          }

          if (matchIdx !== -1) {
            const matchedDelivery = remainingSystemDeliveries.splice(matchIdx, 1)[0];
            const sysCost = matchedDelivery.deliveryCost || matchedDelivery.assignedVehicles?.reduce((acc: number, v: any) => acc + (v.deliveryCost || 0), 0) || 70000;
            const diff = excelCost - sysCost;

            if (excelCost > 0 && Math.abs(diff) > 0) {
              mismatchCount++;
              pairs.push({
                pairId: `PAIR-${matchedDelivery.id}-${rIdx}`,
                systemDelivery: matchedDelivery,
                excelRow: row,
                matchStatus: 'MISMATCH',
                systemCost: sysCost,
                excelCost,
                diffCost: diff,
                memo: row['비고'] || `시스템 ₩${sysCost.toLocaleString()}원 vs 엑셀 ₩${excelCost.toLocaleString()}원 (차액 ₩${diff.toLocaleString()}원)`,
                isReconciled: false
              });
            } else {
              autoMatchedCount++;
              pairs.push({
                pairId: `PAIR-${matchedDelivery.id}-${rIdx}`,
                systemDelivery: matchedDelivery,
                excelRow: row,
                matchStatus: 'MATCHED',
                systemCost: sysCost,
                excelCost: sysCost,
                diffCost: 0,
                memo: row['비고'] || '날짜/하차지/금액 100% 일치 (자동 매칭)',
                isReconciled: true
              });
            }
          } else {
            pairs.push({
              pairId: `EXCEL-ONLY-${rIdx}`,
              excelRow: row,
              matchStatus: 'EXCEL_ONLY',
              systemCost: 0,
              excelCost,
              diffCost: excelCost,
              memo: row['비고'] || '시스템 배차 내역 미존재 (엑셀 단독 항목)',
              isReconciled: false
            });
          }
        });

        // 남은 시스템 운송완료건들 (시스템 단독)
        remainingSystemDeliveries.forEach((sysD, sIdx) => {
          const sysCost = sysD.deliveryCost || sysD.assignedVehicles?.reduce((acc: number, v: any) => acc + (v.deliveryCost || 0), 0) || 70000;
          pairs.push({
            pairId: `SYS-ONLY-${sysD.id}-${sIdx}`,
            systemDelivery: sysD,
            matchStatus: 'SYSTEM_ONLY',
            systemCost: sysCost,
            excelCost: 0,
            diffCost: -sysCost,
            memo: '거래명세서 엑셀 누락건 (시스템 단독)',
            isReconciled: false
          });
        });

        setReconPairs(pairs);
        const msg = `🎉 동적 헤더 & 다중 비고 병합 스마트 대사 완료! [🟢 대사일치 ${autoMatchedCount}건] | [🟡 금액불일치 ${mismatchCount}건] | [🔴 엑셀단독 ${pairs.filter(p => p.matchStatus === 'EXCEL_ONLY').length}건] | [⚪ 시스템단독 ${remainingSystemDeliveries.length}건]`;
        setReconNotificationMsg(msg);
      } catch (err: any) {
        showErrorModal('엑셀 파싱 중 오류가 발생하였습니다: ' + err.message);
      }
    };

    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 💡 [사장님 지시] 💳 대사 완료 1건의 통합 매입 지급요청 생성 (Payment Request Bundle)
  const handleExecuteBundlePaymentRequest = async () => {
    const excelPairs = reconPairs.filter(p => p.excelRow);

    if (excelPairs.length === 0) {
      showErrorModal('지급 요청을 작성하려면 먼저 상단의 [📄 엑셀 거래명세서 업로드]를 진행해 주세요.');
      return;
    }

    // 💡 [사장님 지시] 오른쪽 패널(거래명세서 엑셀) 항목 중 대사 미완료건이 있는지 검사 (우측 대사 미완료 남아있으면 작성 불가)
    const unreconciledExcelPairs = excelPairs.filter(p => !p.isReconciled);

    if (unreconciledExcelPairs.length > 0) {
      showErrorModal(`⚠️ 업로드한 거래명세서 엑셀 항목 (${excelPairs.length}건) 중 아직 대사가 완료되지 않은 항목이 ${unreconciledExcelPairs.length}건 남아있어 지급요청을 작성할 수 없습니다.\n\n우측 패널의 모든 엑셀 항목을 100% 대사 완료 처리해 주세요. (좌측 시스템 배차 미대사건 남음은 허용됨)`);
      return;
    }

    const reconciledPairs = reconPairs.filter(p => p.isReconciled && p.systemDelivery);

    const bundleCode = `PAY-BUNDLE-${new Date().toISOString().substring(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const totalBundleCost = reconciledPairs.reduce((acc, p) => acc + p.systemCost, 0);

    try {
      for (const pair of reconciledPairs) {
        if (pair.systemDelivery) {
          await db.updateRow('deliveries', pair.systemDelivery.id, {
            reconciliationStatus: 'PAYMENT_REQUESTED',
            paymentRequestedAt: new Date().toISOString(),
            memo: `[통합지급요청: ${bundleCode}] ${pair.memo || ''}`
          } as any);
        }
      }

      setReconPairs(prev => prev.map(p => {
        if (p.isReconciled && p.systemDelivery) {
          return { ...p, matchStatus: 'PAYMENT_REQUESTED' as any };
        }
        return p;
      }));

      setReconNotificationMsg(`🎉 [통합 지급요청 완료] 요청번호: ${bundleCode} | 총 ${reconciledPairs.length}건 (합계 ₩${totalBundleCost.toLocaleString()}원) 매입 지급 요청이 저장되었습니다.`);
      showErrorModal(`🎉 [통합 지급 요청 완비]\n\n• 지급요청 번호: ${bundleCode}\n• 포함된 배차건수: ${reconciledPairs.length}건\n• 총 매입 지급금액: ₩${totalBundleCost.toLocaleString()}원\n\n매입 지급 요청이 성공적으로 저장되었습니다.`, '매입 지급 요청 완료');
    } catch (err: any) {
      showErrorModal('지급 요청 처리 중 오류가 발생하였습니다: ' + err.message);
    }
  };

  // 대사 통계 실시간 집계 (사장님 지시: 엑셀 청구 건수와 시스템 배차 건수를 직관적으로 명확히 분리)
  const reconStats = useMemo(() => {
    const isPairMode = reconPairs.length > 0;
    
    if (isPairMode) {
      // 📄 엑셀 거래명세서 기준 업로드 총 건수 및 총 금액
      const excelPairs = reconPairs.filter(p => p.excelRow);
      let excelTotalCount = excelPairs.length;
      let excelTotalCost = excelPairs.reduce((acc, p) => acc + p.excelCost, 0);

      // 🏢 시스템 배차 기준 총 건수
      let systemTotalCount = completedDeliveriesForRecon.length;

      let matchedCount = reconPairs.filter(p => p.isReconciled).length;
      let matchedCost = reconPairs.filter(p => p.isReconciled).reduce((acc, p) => acc + p.systemCost, 0);
      let mismatchCount = reconPairs.filter(p => p.matchStatus === 'MISMATCH').length;
      let mismatchCost = reconPairs.filter(p => p.matchStatus === 'MISMATCH').reduce((acc, p) => acc + p.excelCost, 0);
      let paymentRequestedCount = reconPairs.filter(p => p.matchStatus === 'PAYMENT_REQUESTED').length;
      let paymentRequestedCost = reconPairs.filter(p => p.matchStatus === 'PAYMENT_REQUESTED').reduce((acc, p) => acc + p.systemCost, 0);
      let pendingCount = reconPairs.filter(p => !p.isReconciled && p.matchStatus !== 'PAYMENT_REQUESTED').length;
      let pendingCost = reconPairs.filter(p => !p.isReconciled && p.matchStatus !== 'PAYMENT_REQUESTED').reduce((acc, p) => acc + p.systemCost, 0);

      return {
        isPairMode: true,
        excelTotalCount, excelTotalCost,
        systemTotalCount,
        totalCount: excelTotalCount, // 엑셀 청구 항목 건수를 기본 총건수로 연동 (33건)
        totalCost: excelTotalCost,
        matchedCount, matchedCost,
        mismatchCount, mismatchCost,
        paymentRequestedCount, paymentRequestedCost,
        pendingCount, pendingCost
      };
    }

    let totalCount = completedDeliveriesForRecon.length;
    let totalCost = 0;
    let matchedCount = 0;
    let matchedCost = 0;
    let mismatchCount = 0;
    let mismatchCost = 0;
    let paymentRequestedCount = 0;
    let paymentRequestedCost = 0;
    let pendingCount = 0;
    let pendingCost = 0;

    completedDeliveriesForRecon.forEach(d => {
      const cost = d.deliveryCost || d.assignedVehicles?.reduce((acc: number, v: any) => acc + (v.deliveryCost || 0), 0) || 70000;
      totalCost += cost;

      const st = (d as any).reconciliationStatus || 'PENDING';
      if (st === 'MATCHED') {
        matchedCount++;
        matchedCost += cost;
      } else if (st === 'MISMATCH') {
        mismatchCount++;
        mismatchCost += cost;
      } else if (st === 'PAYMENT_REQUESTED') {
        paymentRequestedCount++;
        paymentRequestedCost += cost;
      } else {
        pendingCount++;
        pendingCost += cost;
      }
    });

    return {
      isPairMode: false,
      excelTotalCount: 0,
      excelTotalCost: 0,
      systemTotalCount: totalCount,
      totalCount, totalCost,
      matchedCount, matchedCost,
      mismatchCount, mismatchCost,
      paymentRequestedCount, paymentRequestedCost,
      pendingCount, pendingCost
    };
  }, [reconPairs, completedDeliveriesForRecon]);

  // 💡 [사장님 지시] 건별 대사 완료 토글 및 [↩️ 대사 취소 (대기 원복)] 기능 (금액 상이 시 대사 거절)
  const handleTogglePairReconciled = (pairId: string) => {
    const targetPair = reconPairs.find(p => p.pairId === pairId);
    if (!targetPair) return;

    if (!targetPair.isReconciled) {
      // 대사 완료 전환 시 금액 검증
      if (targetPair.diffCost !== 0 || targetPair.systemCost !== targetPair.excelCost) {
        showErrorModal(`⚠️ [대사 처리 거절]\n\n• 좌측 시스템 금액: ₩${targetPair.systemCost.toLocaleString()}원\n• 우측 엑셀 청구금액: ₩${targetPair.excelCost.toLocaleString()}원\n• 차액: ₩${Math.abs(targetPair.diffCost).toLocaleString()}원\n\n좌측과 우측의 금액이 상이한 항목은 대사 처리가 불가능합니다.`);
        return;
      }
    }

    setReconPairs(prev => prev.map(p => {
      if (p.pairId === pairId) {
        const nextReconciled = !p.isReconciled;
        return {
          ...p,
          isReconciled: nextReconciled,
          matchStatus: nextReconciled ? 'MATCHED' : (p.diffCost !== 0 ? 'MISMATCH' : 'PENDING'),
          memo: nextReconciled ? '담당자 수동 대사 완료' : '대사 취소됨 (대기 원복)'
        };
      }
      return p;
    }));
  };

  // 선택건 일괄 대사 완료 (금액 상이건 대사 거절)
  const handleBatchReconcilePairs = () => {
    if (selectedPairIds.size === 0) {
      showErrorModal('대사 완료 처리할 항목을 1건 이상 체크해 주세요.');
      return;
    }

    let rejectedCount = 0;
    let successCount = 0;

    setReconPairs(prev => prev.map(p => {
      if (selectedPairIds.has(p.pairId)) {
        if (p.diffCost !== 0 || p.systemCost !== p.excelCost) {
          rejectedCount++;
          return p; // 금액 상이 항목은 대사 처리 거절 (상태 유지)
        }
        successCount++;
        return { ...p, isReconciled: true, matchStatus: 'MATCHED', memo: '선택 항목 일괄 대사 완료' };
      }
      return p;
    }));

    setSelectedPairIds(new Set());

    if (rejectedCount > 0) {
      showErrorModal(`⚠️ 선택한 항목 중 ${rejectedCount}건은 좌/우 금액이 상이하여 대사 처리가 거절되었습니다.\n\n(금액이 일치하는 ${successCount}건만 대사 완료 처리되었습니다.)`);
    } else if (successCount > 0) {
      setReconNotificationMsg(`✅ 선택한 Pair 항목 ${successCount}건이 대사 완료(MATCHED)로 전환되었습니다.`);
    }
  };

  // 💡 [사장님 지시] 선택건 일괄 대사 취소 (대기 원복)
  const handleBatchCancelReconcilePairs = () => {
    if (selectedPairIds.size === 0) {
      showErrorModal('대사를 취소할 항목을 1건 이상 체크해 주세요.');
      return;
    }
    setReconPairs(prev => prev.map(p => {
      if (selectedPairIds.has(p.pairId)) {
        return { ...p, isReconciled: false, matchStatus: 'PENDING', memo: '일괄 대사 취소 (대기 원복)' };
      }
      return p;
    }));
    setSelectedPairIds(new Set());
    setReconNotificationMsg(`↩️ 선택한 Pair 항목들이 대사 대기(PENDING) 상태로 원복되었습니다.`);
  };

  // 엑셀 업로드 시 시스템 미등록 청구 항목 배열
  const unmatchedExcelRows = useMemo(() => {
    return reconPairs
      .filter(p => p.matchStatus === 'EXCEL_ONLY' && p.excelRow)
      .map(p => p.excelRow);
  }, [reconPairs]);

  // 엑셀 내보내기 다운로드
  const handleExportReconciliationReport = () => {
    if (reconPairs.length === 0 && completedDeliveriesForRecon.length === 0) {
      showErrorModal('내보낼 대사 내역이 없습니다.');
      return;
    }

    const exportRows = reconPairs.length > 0
      ? reconPairs.map((p, i) => {
          const sysD = p.systemDelivery;
          const contract = sysD ? contracts.find(c => c.id === sysD.contractId) : null;
          const customer = contract ? customers.find(c => c.id === contract.customerId) : null;

          return {
            '순번': i + 1,
            '대사 상태': p.isReconciled ? '대사완료' : p.matchStatus === 'MISMATCH' ? '금액불일치' : p.matchStatus === 'EXCEL_ONLY' ? '엑셀단독' : '대사대기',
            '시스템 배차ID': sysD?.id || '미존재',
            '운송일자': sysD?.loadingDate || sysD?.requestDate || p.excelRow?.['운송일자'] || p.excelRow?.['날짜'] || '',
            '운송 거래처': sysD?.transportCompany || sysD?.assignedVehicles?.[0]?.transportCompany || '자사배차',
            '고객사/현장': customer?.name ? `${customer.name} (${sysD?.destinationAddress || ''})` : p.excelRow?.['하차지'] || p.excelRow?.['도착지'] || '',
            '운송 기사명': sysD?.driverName || p.excelRow?.['기사명'] || p.excelRow?.['운송기사'] || '',
            '시스템 운송비(원)': p.systemCost,
            '엑셀 청구액(원)': p.excelCost,
            '차액(원)': p.diffCost,
            '비고 / 특이사항': p.memo || ''
          };
        })
      : completedDeliveriesForRecon.map((d, i) => {
          const contract = contracts.find(c => c.id === d.contractId);
          const customer = contract ? customers.find(c => c.id === contract.customerId) : null;
          const cost = d.deliveryCost || d.assignedVehicles?.reduce((acc: number, v: any) => acc + (v.deliveryCost || 0), 0) || 70000;

          return {
            '순번': i + 1,
            '배차ID': d.id,
            '운송일자': d.loadingDate || d.requestDate,
            '운송 거래처': d.transportCompany || d.assignedVehicles?.[0]?.transportCompany || '자사배차',
            '고객사명': customer?.name || '미지정',
            '도착지(현장)': d.destinationAddress || '',
            '운송 기사명': d.driverName || '기사미지정',
            '차종': d.vehicleType || '3.5T',
            '시스템 운송비(원)': cost,
            '엑셀 청구액(원)': cost,
            '차액(원)': 0,
            '대사 상태': (d as any).reconciliationStatus === 'PAYMENT_REQUESTED' ? '지급요청완료' : '대사대기',
            '비고 / 특이사항': d.memo || ''
          };
        });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '월말_운송료_1to1대사내역');
    XLSX.writeFile(workbook, `월말_운송료_1to1대사내역_${reconStartDate}_${reconEndDate}.xlsx`);
  };

  // 엑셀 템플릿 다운로드
  const handleDownloadExcelTemplate = () => {
    const templateData = [
      { '배차ID': 'DLV-0000001', '운송일자': '2026-07-28', '운송기사': '김기사', '청구금액': 70000, '비고': '양호' },
      { '배차ID': 'DLV-0000002', '운송일자': '2026-07-28', '운송기사': '이기사', '청구금액': 85000, '비고': '특이사항 없음' }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '거래명세서_양식');
    XLSX.writeFile(wb, '월말_운송료_대사_거래명세서_양식.xlsx');
  };


  // 2. 배차건 정밀 필터링 (상태 4단계 + 요청/운송일 기간 피커 + 검색어)
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter(d => {
      const dStatus = getNormalizedDeliveryStatus(d);
      if (activeDispatchStatusTab !== 'ALL' && dStatus !== activeDispatchStatusTab) return false;

      const dDate = d.loadingDate || d.requestDate || d.scheduledDate || d.createdAt?.substring(0, 10);
      if (startDate && dDate && dDate < startDate) return false;
      if (endDate && dDate && dDate > endDate) return false;

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const contract = getContract(d.contractId);
      const customer = contract ? getCustomer(contract.customerId) : null;

      return (
        (d.id && d.id.toLowerCase().includes(q)) ||
        (d.driverName && d.driverName.toLowerCase().includes(q)) ||
        (d.destinationAddress && d.destinationAddress.toLowerCase().includes(q)) ||
        (contract && contract.contractNo.toLowerCase().includes(q)) ||
        (customer && customer.name.toLowerCase().includes(q))
      );
    });
  }, [deliveries, activeDispatchStatusTab, startDate, endDate, searchQuery, contracts, customers]);

  // 💡 배차 완료 상태에서 수정을 위해 임시 잠금 해제(Unlock)하는 모드 state
  const [isEditUnlocked, setIsEditUnlocked] = useState<boolean>(false);

  const handleSelectDelivery = (d: Delivery) => {
    const todayStr = new Date().toISOString().split('T')[0];
    setSelectedDelivery(d);
    setIsEditUnlocked(false); // 💡 새로 선택 시 기본 잠금(readOnly) 적용!

    let defaultCat: '출고' | '입고' | '반납' | '정비' | '이동' | '교환' = d.dispatchCategory || (d.type === 'EXCHANGE' ? '교환' : d.type === 'OUTBOUND' ? '출고' : d.type === 'RETURN' || d.type === 'INBOUND' ? '반납' : '출고');
    setDispatchCategory(defaultCat);

    setLoadingDate(d.loadingDate || todayStr);
    const lSlot = d.loadingTimeSlot || '오전';
    if (lSlot !== '오전' && lSlot !== '오후') {
      setLoadingTimeSlot('희망시간');
      setLoadingCustomTime(lSlot);
    } else {
      setLoadingTimeSlot(lSlot);
      setLoadingCustomTime('');
    }

    setUnloadingDate(d.unloadingDate || todayStr);
    const uSlot = d.unloadingTimeSlot || '오전';
    if (uSlot !== '오전' && uSlot !== '오후') {
      setUnloadingTimeSlot('희망시간');
      setUnloadingCustomTime(uSlot);
    } else {
      setUnloadingTimeSlot(uSlot);
      setUnloadingCustomTime('');
    }

    setClosingMemo(d.closingMemo || d.memo || '');
    setScheduledDate(d.scheduledDate || todayStr);
    setOriginAddress(d.originAddress || '당사 보관소');

    const contract = getContract(d.contractId);
    const cust = contract ? getCustomer(contract.customerId) : null;
    setDestinationAddress(d.destinationAddress || (cust ? `${cust.name} 현장` : ''));

    setBillableToCust(d.billableToCustomer || false);
    setBillableCustId(d.billableCustomerId || (contract?.customerId || ''));

    if (d.vehicles) {
      try {
        const parsed = JSON.parse(d.vehicles);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAssignedVehicles(parsed);
          return;
        }
      } catch (e) {}
    }

    setAssignedVehicles([{
      id: 'v-' + Date.now(),
      transportCompany: d.transportCompany || '',
      vehicleType: d.vehicleType || '3.5T',
      vehicleNo: d.vehicleNo || '',
      driverName: d.driverName || '',
      driverContact: d.driverContact || '',
      expectedCost: d.expectedCost || d.deliveryCost || 70000,
      finalCost: d.finalCost !== undefined && d.finalCost !== null ? d.finalCost : 0,
      deliveryCost: d.finalCost || d.expectedCost || d.deliveryCost || 70000
    }]);
  };

  const handleVehicleFieldChange = (index: number, field: keyof AssignedVehicleRow, value: any) => {
    const updated = [...assignedVehicles];
    updated[index] = { ...updated[index], [field]: value };

    // 기사 선택 시 연락처, 차량번호, 차종(톤수) 및 운송사 자동 매핑
    if (field === 'driverName' && value) {
      const driverMatch = transportDrivers.find(d => d.driverName.trim() === value.trim());
      if (driverMatch) {
        if (driverMatch.driverContact) updated[index].driverContact = driverMatch.driverContact;
        if (driverMatch.vehicleNo) updated[index].vehicleNo = driverMatch.vehicleNo;
        if (driverMatch.vehicleType) updated[index].vehicleType = driverMatch.vehicleType;
        const comp = transportCompanies.find(c => c.id === driverMatch.companyId);
        if (comp) updated[index].transportCompany = comp.name;
      }
    }
    setAssignedVehicles(updated);
  };

  const handleAddVehicleRow = () => {
    setAssignedVehicles(prev => [
      ...prev,
      {
        id: 'v-' + Date.now(),
        transportCompany: '',
        vehicleType: '3.5T',
        vehicleNo: '',
        driverName: '',
        driverContact: '',
        expectedCost: 0,
        finalCost: 0,
        deliveryCost: 0
      }
    ]);
  };

  const handleRemoveVehicleRow = (index: number) => {
    if (assignedVehicles.length <= 1) return;
    setAssignedVehicles(prev => prev.filter((_, i) => i !== index));
  };

  // 3. 배차 배정 저장 (status: 'DISPATCHED' 배차 완료 전환!)
  const handleSaveDispatch = async () => {
    if (!selectedDelivery) return;
    if (!canSave) {
      showErrorModal('배차 수정 권한이 없습니다.');
      return;
    }

    // ⚠️ 출고 의뢰가 반려된 상태인지 검사 및 예방적 경고 알림!
    const inspStatus = getOutboundInspectionStatus(selectedDelivery.contractId);
    if (inspStatus === 'REJECTED') {
      if (!window.confirm('⚠️ [경고: 출고 의뢰 반려건]\n\n해당 출고건은 출고 검수 단계에서 [🔴 의뢰 반려] 처리된 건입니다.\n\n정말로 의도를 가지고 배차 기사 배정을 진행하시겠습니까?')) {
        return;
      }
    }

    try {
      const finalLoadingSlot = loadingTimeSlot === '희망시간' ? loadingCustomTime : loadingTimeSlot;
      const finalUnloadingSlot = unloadingTimeSlot === '희망시간' ? unloadingCustomTime : unloadingTimeSlot;
      const totalExpectedCost = assignedVehicles.reduce((sum, v) => sum + (Number(v.expectedCost) || 0), 0);
      const totalFinalCost = assignedVehicles.reduce((sum, v) => sum + (Number(v.finalCost) || 0), 0);

      const mainVeh = assignedVehicles[0] || {};
      const payload: Partial<Delivery> = {
        status: 'DISPATCHED',
        dispatchCategory: dispatchCategory,
        loadingDate: loadingDate,
        loadingTimeSlot: finalLoadingSlot,
        unloadingDate: unloadingDate,
        unloadingTimeSlot: finalUnloadingSlot,
        scheduledDate: scheduledDate || loadingDate,
        originAddress: originAddress,
        destinationAddress: destinationAddress,
        billableToCustomer: billableToCust,
        billableCustomerId: billableCustId,
        transportCompany: mainVeh.transportCompany || '',
        vehicleType: mainVeh.vehicleType || '3.5T',
        vehicleNo: mainVeh.vehicleNo || '',
        driverName: mainVeh.driverName || '',
        driverContact: mainVeh.driverContact || '',
        expectedCost: totalExpectedCost,
        finalCost: totalFinalCost,
        deliveryCost: totalFinalCost || totalExpectedCost,
        vehicles: JSON.stringify(assignedVehicles),
        closingMemo: closingMemo,
        memo: closingMemo,
        updatedAt: new Date().toISOString()
      };

      db.updateRow<Delivery>('deliveries', selectedDelivery.id, payload);
      await db.awaitPendingWrites();
      refreshAllData();
      alert('✅ [배차 기사 배정 완료] 배차 상태가 [🔵 배차 완료]로 갱신되었습니다!');
      setSelectedDelivery(null);
    } catch (err: any) {
      showErrorModal(`⚠️ 배차 저장 실패:\n${err?.message || err}`);
    }
  };

  // 4. 운송 완료 처리 (status: 'DELIVERED')
  const handleCompleteDeliveryStatus = async (deliveryId: string) => {
    if (!canSave) return;

    const targetDelivery = deliveries.find(d => d.id === deliveryId);
    if (targetDelivery) {
      const inspStatus = getOutboundInspectionStatus(targetDelivery.contractId);
      if (inspStatus === 'REJECTED') {
        if (!window.confirm('⚠️ [경고: 출고 의뢰 반려건]\n\n해당 출고건은 출고 검수 단계에서 [🔴 의뢰 반려] 처리된 건입니다.\n\n정말로 의도를 가지고 운송 완료 마감을 진행하시겠습니까?')) {
          return;
        }
      }
    }

    try {
      db.updateRow<Delivery>('deliveries', deliveryId, {
        status: 'DELIVERED',
        updatedAt: new Date().toISOString()
      });
      await db.awaitPendingWrites();
      refreshAllData();
      alert('✅ 운송이 완료 마감되었습니다. (상태: 🟢 운송 완료)');
      setSelectedDelivery(null);
    } catch (err: any) {
      showErrorModal(`⚠️ 운송 완료 처리 실패:\n${err?.message || err}`);
    }
  };

  // 5. 배차 취소 처리 (status: 'CANCELLED')
  const handleCancelDeliveryStatus = async (deliveryId: string) => {
    if (!canSave) return;
    if (!window.confirm('해당 배차를 취소 처리하시겠습니까?')) return;
    try {
      db.updateRow<Delivery>('deliveries', deliveryId, {
        status: 'CANCELLED',
        updatedAt: new Date().toISOString()
      });
      await db.awaitPendingWrites();
      refreshAllData();
      alert('🔴 배차가 취소되었습니다. (상태: 🔴 배차 취소)');
      setSelectedDelivery(null);
    } catch (err: any) {
      showErrorModal(`⚠️ 배차 취소 처리 실패:\n${err?.message || err}`);
    }
  };

  const handleSaveManualDispatch = async () => {
    if (!manualOrigin || !manualDestination) {
      showErrorModal('상차지(출발지)와 하차지(도착지)를 작성해 주세요.');
      return;
    }

    try {
      const finalLoadingSlot = manualLoadingTimeSlot === '희망시간' ? manualLoadingCustomTime : manualLoadingTimeSlot;
      const finalUnloadingSlot = manualUnloadingTimeSlot === '희망시간' ? manualUnloadingCustomTime : manualUnloadingTimeSlot;
      const nowIso = new Date().toISOString();

      db.insertRow<Delivery>('deliveries', {
        type: manualCategory === '출고' ? 'OUTBOUND' : manualCategory === '반납' ? 'RETURN' : 'INBOUND',
        status: 'PENDING',
        dispatchCategory: manualCategory,
        contractId: manualContractId || undefined,
        requestDate: manualLoadingDate,
        scheduledDate: manualLoadingDate,
        loadingDate: manualLoadingDate,
        loadingTimeSlot: finalLoadingSlot,
        unloadingDate: manualUnloadingDate,
        unloadingTimeSlot: finalUnloadingSlot,
        originAddress: manualOrigin,
        destinationAddress: manualDestination,
        deliveryCost: manualExpectedCost,
        expectedCost: manualExpectedCost,
        finalCost: manualExpectedCost,
        billableToCustomer: manualBillable,
        billableCustomerId: manualCustomerId || undefined,
        isCostSettled: false,
        memo: manualMemo || manualClosingMemo,
        closingMemo: manualClosingMemo || manualMemo,
        vehicleRequirements: JSON.stringify(manualVehicles),
        cargoItems: JSON.stringify(manualCargos),
        createdAt: nowIso,
        updatedAt: nowIso
      });

      await db.awaitPendingWrites();
      refreshAllData();
      alert('🎉 [수동 배차 생성 완료] 신규 배차건이 생성되었습니다!');
      setShowManualModal(false);
    } catch (err: any) {
      showErrorModal(`⚠️ 수동 배차 생성 실패:\n${err?.message || err}`);
    }
  };

  const parseCargoItems = (d: Delivery): CargoItem[] => {
    if (d.cargoItems) {
      try {
        const parsed = JSON.parse(d.cargoItems);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [{ modelName: '고소작업대 (장비 미지정)', count: 1 }];
  };

  const getDeliveryStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
      case 'REQUESTED':
        return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, backgroundColor: 'rgba(245,158,11,0.15)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> 🟡 배차 전 (대기)</span>;
      case 'DISPATCHED':
        return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, backgroundColor: 'rgba(59,130,246,0.15)', color: '#2563eb', border: '1px solid rgba(59,130,246,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Truck size={12} /> 🔵 배차 완료 (기사배정)</span>;
      case 'DELIVERED':
      case 'COMPLETED':
        return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, backgroundColor: 'rgba(34,197,94,0.15)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={12} /> 🟢 운송 완료</span>;
      case 'CANCELLED':
        return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, backgroundColor: 'rgba(239,68,68,0.15)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><XCircle size={12} /> 🔴 배차 취소</span>;
      default:
        return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, backgroundColor: 'rgba(148,163,184,0.15)', color: '#64748b' }}>미지정</span>;
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* 헤더 영역 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontWeight: '800', fontSize: '22px', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Truck size={24} color="var(--primary)" /> 배차 / 운송 관리 및 월말 운송료 대사
          </h2>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            상차/하차 배차 일정을 관리하고 기사를 배정하여 운송료 대사를 처리합니다.
          </p>
        </div>
        {canSave && (
          <button className="btn-primary" onClick={() => setShowManualModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', fontWeight: 700 }}>
            <Plus size={16} /> [+ 수동 배차 생성]
          </button>
        )}
      </div>

      {/* 메인 탭 (배차 관리 / 월말 운송료 대사) */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('DISPATCH')}
          style={{
            padding: '10px 18px', fontSize: '14px', fontWeight: 700, backgroundColor: 'transparent', border: 'none',
            borderBottom: activeTab === 'DISPATCH' ? '3px solid var(--primary)' : 'none',
            color: activeTab === 'DISPATCH' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer'
          }}
        >
          <Truck size={15} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          배차 및 운송 기사 배정 관리
        </button>
        <button
          onClick={() => setActiveTab('RECONCILIATION')}
          style={{
            padding: '10px 18px', fontSize: '14px', fontWeight: 700, backgroundColor: 'transparent', border: 'none',
            borderBottom: activeTab === 'RECONCILIATION' ? '3px solid var(--primary)' : 'none',
            color: activeTab === 'RECONCILIATION' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer'
          }}
        >
          <FileText size={15} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          월말 운송료 대사 및 매입 지급 요청
        </button>
      </div>

      {/* 탭 1: 배차 관리 */}
      {activeTab === 'DISPATCH' && (
        <div>
          {/* 📊 오늘/내일/이번주 상차 배차 통계 바 */}
          {(() => {
            const todayStr = new Date().toISOString().split('T')[0];
            const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];
            
            const todayCount = deliveries.filter(d => (d.loadingDate || d.scheduledDate) === todayStr).length;
            const tomorrowCount = deliveries.filter(d => (d.loadingDate || d.scheduledDate) === tomorrowStr).length;
            const pendingTotal = deliveries.filter(d => getNormalizedDeliveryStatus(d) === 'PENDING').length;

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>오늘 상차 예정</span>
                  <strong style={{ fontSize: '15px', color: todayCount > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>{todayCount}건</strong>
                </div>
                <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>내일 상차 예정</span>
                  <strong style={{ fontSize: '15px', color: tomorrowCount > 0 ? '#0070C0' : 'var(--text-muted)' }}>{tomorrowCount}건</strong>
                </div>
                <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>배차 대기 (미배정)</span>
                  <strong style={{ fontSize: '15px', color: pendingTotal > 0 ? '#d97706' : 'var(--text-muted)' }}>{pendingTotal}건</strong>
                </div>
              </div>
            );
          })()}

          {/* 4단계 배차 진행 상태 카운트 탭 */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {[
              { key: 'ALL', label: '전체 보기', count: deliveries.length },
              { key: 'PENDING', label: '🟡 배차 전 (대기)', count: deliveries.filter(d => getNormalizedDeliveryStatus(d) === 'PENDING').length },
              { key: 'DISPATCHED', label: '🔵 배차 완료 (기사배정)', count: deliveries.filter(d => getNormalizedDeliveryStatus(d) === 'DISPATCHED').length },
              { key: 'DELIVERED', label: '🟢 운송 완료', count: deliveries.filter(d => getNormalizedDeliveryStatus(d) === 'DELIVERED').length },
              { key: 'CANCELLED', label: '🔴 배차 취소', count: deliveries.filter(d => getNormalizedDeliveryStatus(d) === 'CANCELLED').length },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveDispatchStatusTab(tab.key)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: activeDispatchStatusTab === tab.key ? 'var(--primary)' : 'var(--border-color)',
                  backgroundColor: activeDispatchStatusTab === tab.key ? 'rgba(59,130,246,0.1)' : 'var(--bg-card)',
                  color: activeDispatchStatusTab === tab.key ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: activeDispatchStatusTab === tab.key ? 700 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                {tab.label}
                <span style={{
                  backgroundColor: activeDispatchStatusTab === tab.key ? 'var(--primary)' : 'var(--bg-body)',
                  color: activeDispatchStatusTab === tab.key ? '#fff' : 'var(--text-muted)',
                  borderRadius: '12px',
                  padding: '1px 7px',
                  fontSize: '11px',
                  fontWeight: 700
                }}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* 2열 메인 레이아웃 (좌: 배차 목록 + 📅 기간조회 | 우: 기사 배정 폼) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 420px) 1fr', gap: '20px' }}>
            
            {/* [좌측] 배차 목록 카드 + 📅 요청/운송일 기간 선택 폼 */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 230px)', minHeight: '600px' }}>
              
              {/* 📅 배차 요청/운송일 기간 선택 폼 */}
              <div style={{ marginBottom: '12px', padding: '10px 12px', backgroundColor: 'var(--bg-body)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={13} /> 배차 운송일/신청일 기간 조회
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[
                      { label: '오늘', type: 'TODAY' },
                      { label: '1주일', type: 'WEEK' },
                      { label: '1개월', type: 'MONTH' },
                      { label: '전체', type: 'ALL' }
                    ].map(b => (
                      <button
                        key={b.type}
                        onClick={() => handleSetDateRange(b.type as any)}
                        style={{
                          padding: '2px 7px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card)',
                          fontSize: '10.5px',
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          cursor: 'pointer'
                        }}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '5px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>~</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '5px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  />
                  {(startDate || endDate) && (
                    <button
                      onClick={() => handleSetDateRange('ALL')}
                      title="기간 초기화"
                      style={{
                        padding: '5px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex'
                      }}
                    >
                      <RotateCcw size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* 검색창 */}
              <div style={{ marginBottom: '14px', position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="고객사 / 현장 / 계약 / 기사명 검색..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-body)',
                    color: 'var(--text-primary)',
                    fontSize: '12.5px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* 배차 목록 렌더링 */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
                {filteredDeliveries.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    조건에 일치하는 배차 요청건이 없습니다.
                  </div>
                ) : (
                  filteredDeliveries.map(d => {
                    const contract = getContract(d.contractId);
                    const customer = contract ? getCustomer(contract.customerId) : null;
                    const isSelected = selectedDelivery?.id === d.id;
                    const cargoItems = parseCargoItems(d);
                    const normStatus = getNormalizedDeliveryStatus(d);

                    return (
                      <div 
                        key={d.id}
                        onClick={() => handleSelectDelivery(d)}
                        style={{
                          padding: '14px',
                          borderRadius: '10px',
                          border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          backgroundColor: isSelected ? 'rgba(59,130,246,0.05)' : 'var(--bg-body)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected ? '0 4px 12px rgba(59,130,246,0.12)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                          <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--primary)' }}>
                            [{d.dispatchCategory || '출고'}] {d.requestDate || d.loadingDate}
                          </span>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            {getOutboundInspectionBadge(d.contractId)}
                            {getDeliveryStatusBadge(normStatus)}
                          </div>
                        </div>

                        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                          🏢 {customer?.name || '고객사 미지정'}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            📍 {d.destinationAddress || '목적지 미지정'}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDestWeatherForDelivery(d);
                            }}
                            style={{
                              padding: '2px 6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              borderRadius: '4px',
                              border: '1px solid rgba(59, 130, 246, 0.4)',
                              backgroundColor: 'rgba(59, 130, 246, 0.1)',
                              color: '#3B82F6',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              flexShrink: 0,
                              marginLeft: '6px'
                            }}
                            title="해당 하차지 실시간 날씨 및 주간 예보 보기"
                          >
                            <Sun size={11} color="#F59E0B" /> 날씨
                          </button>
                        </div>

                        {/* 화물/자산 정보 표시 */}
                        {(d.type === 'INBOUND' || d.dispatchCategory === '입고' || d.dispatchCategory === '반납') ? (
                          // 회수 배차: 계약/회수 자산 목록 표시 (모델명 {관리번호})
                          <div style={{ padding: '6px 8px', backgroundColor: 'rgba(239,68,68,0.05)', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                            🔄 회수 대상:&nbsp;
                            {getReturnAssets(d).length > 0
                              ? getReturnAssets(d).map(a => `${a.modelName} {${a.assetNo}}`).join(' / ')
                              : (cargoItems.length > 0 ? cargoItems.map(c => `${c.modelName} ${c.count}대`).join(', ') : '자산 정보 미확인')}
                          </div>
                        ) : (
                          // 출고 배차: 화물 cargoItems 표시
                          <div style={{ padding: '6px 8px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                            📦 화물: {cargoItems.map(c => `${c.modelName} ${c.count}대`).join(', ')}
                          </div>
                        )}

                        {d.driverName && (
                          <div style={{ marginTop: '6px', fontSize: '11.5px', fontWeight: 700, color: '#16a34a' }}>
                            🚛 기사: {d.driverName} ({d.vehicleNo || '차량번호미상'})
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* [우측] 배차 기사 배정 및 상세 폼 */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', height: 'calc(100vh - 230px)', minHeight: '600px', overflowY: 'auto' }}>
              {!selectedDelivery ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  <Truck size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                  <p style={{ fontSize: '14px', fontWeight: 600 }}>좌측에서 기사를 배정할 배차건을 선택해 주세요.</p>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>
                        🚛 배차 운송 기사 배정 및 상하차 세부 설정
                      </h3>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        배차 ID: {selectedDelivery.id} | 요청일: {selectedDelivery.requestDate}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {getOutboundInspectionBadge(selectedDelivery.contractId)}
                      {getDeliveryStatusBadge(getNormalizedDeliveryStatus(selectedDelivery))}
                      
                      {/* 💡 상단 배차/운송완료/취소 액션 버튼 */}
                      {canSave && (
                        <>
                          <button
                            onClick={handleSaveDispatch}
                            className="btn-primary"
                            style={{ padding: '6px 14px', fontWeight: 800, fontSize: '12.5px', borderRadius: '7px', display: 'inline-flex', alignItems: 'center', gap: '5px', boxShadow: '0 2px 6px rgba(59,130,246,0.25)' }}
                          >
                            <ShieldCheck size={14} /> [🔵 배차 기사 배정 완료]
                          </button>

                          {getNormalizedDeliveryStatus(selectedDelivery) === 'DISPATCHED' && (
                            <button
                              onClick={() => handleCompleteDeliveryStatus(selectedDelivery.id)}
                              style={{ padding: '6px 14px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '7px', fontWeight: 800, fontSize: '12.5px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', boxShadow: '0 2px 6px rgba(22,163,74,0.25)' }}
                            >
                              <CheckCircle size={14} /> [🟢 운송 완료 마감]
                            </button>
                          )}

                          <button
                            onClick={() => handleCancelDeliveryStatus(selectedDelivery.id)}
                            style={{ padding: '6px 10px', borderRadius: '7px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            🚫 배차 취소
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {(() => {
                    const normStatus = getNormalizedDeliveryStatus(selectedDelivery);
                    const isDispatchedOrCompleted = normStatus === 'DISPATCHED' || normStatus === 'DELIVERED' || normStatus === 'CANCELLED';
                    // 💡 [사장님 지시] 배차가 이미 완료/마감된 건은 visible = true, enable = false (수정 불가 잠금!)
                    const isFormDisabled = !canSave || (isDispatchedOrCompleted && !isEditUnlocked);

                    return (
                      <div>

                        {/* 배차 세부 설정 폼 (3컬럼: 배차 구분 | 상차일자 & 시간 | 하차일자 & 시간) */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr 1.25fr', gap: '14px', marginBottom: '16px' }}>
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block', color: 'var(--text-secondary)' }}>배차 구분</label>
                            <select
                              value={dispatchCategory}
                              disabled={isFormDisabled}
                              onChange={e => setDispatchCategory(e.target.value as any)}
                              style={{ width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-body)', fontSize: '12.5px', color: 'var(--text-primary)', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
                            >
                              <option value="출고">출고</option>
                              <option value="입고">입고</option>
                              <option value="반납">반납</option>
                              <option value="정비">정비</option>
                              <option value="이동">이동</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block', color: 'var(--text-secondary)' }}>상차일자 & 시간</label>
                            <div style={{ display: 'flex', gap: '6px', position: 'relative', height: '34px' }}>
                              <input
                                type="date"
                                value={loadingDate}
                                disabled={isFormDisabled}
                                onChange={e => setLoadingDate(e.target.value)}
                                style={{ flex: 1, padding: '7px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-body)', fontSize: '12.5px', color: 'var(--text-primary)', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default', marginRight: '106px' }}
                              />
                              <select
                                value={loadingTimeSlot}
                                disabled={isFormDisabled}
                                onChange={e => {
                                  setLoadingTimeSlot(e.target.value);
                                  (e.target as HTMLSelectElement).blur();
                                }}
                                onFocus={e => { (e.target as HTMLSelectElement).size = 10; }}
                                onBlur={e => { (e.target as HTMLSelectElement).size = 1; }}
                                style={{
                                  width: '100px',
                                  padding: '6px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-body)',
                                  fontSize: '12.5px',
                                  color: 'var(--text-primary)',
                                  opacity: isFormDisabled ? 0.75 : 1,
                                  cursor: isFormDisabled ? 'not-allowed' : 'default',
                                  position: 'absolute',
                                  right: 0,
                                  top: 0,
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

                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block', color: 'var(--text-secondary)' }}>하차일자 & 시간</label>
                            <div style={{ display: 'flex', gap: '6px', position: 'relative', height: '34px' }}>
                              <input
                                type="date"
                                value={unloadingDate}
                                disabled={isFormDisabled}
                                onChange={e => setUnloadingDate(e.target.value)}
                                style={{ flex: 1, padding: '7px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-body)', fontSize: '12.5px', color: 'var(--text-primary)', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default', marginRight: '106px' }}
                              />
                              <select
                                value={unloadingTimeSlot}
                                disabled={isFormDisabled}
                                onChange={e => {
                                  setUnloadingTimeSlot(e.target.value);
                                  (e.target as HTMLSelectElement).blur();
                                }}
                                onFocus={e => { (e.target as HTMLSelectElement).size = 10; }}
                                onBlur={e => { (e.target as HTMLSelectElement).size = 1; }}
                                style={{
                                  width: '100px',
                                  padding: '6px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-body)',
                                  fontSize: '12.5px',
                                  color: 'var(--text-primary)',
                                  opacity: isFormDisabled ? 0.75 : 1,
                                  cursor: isFormDisabled ? 'not-allowed' : 'default',
                                  position: 'absolute',
                                  right: 0,
                                  top: 0,
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

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block', color: 'var(--text-secondary)' }}>상차지 (출발지)</label>
                            <input
                              type="text"
                              value={originAddress}
                              disabled={isFormDisabled}
                              onChange={e => setOriginAddress(e.target.value)}
                              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-body)', fontSize: '12.5px', color: 'var(--text-primary)', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block', color: 'var(--text-secondary)' }}>하차지 (도착지)</label>
                            <input
                              type="text"
                              value={destinationAddress}
                              disabled={isFormDisabled}
                              onChange={e => setDestinationAddress(e.target.value)}
                              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-body)', fontSize: '12.5px', color: 'var(--text-primary)', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
                            />
                          </div>
                        </div>

                        {/* ────────────────────────────────────────────────────────────────── */}
                        {/* 🚚 배정 운송 기사 및 운송 거래처 목록 (isFormDisabled 시 비활성화!) */}
                        {/* ────────────────────────────────────────────────────────────────── */}
                        <div style={{ marginBottom: '20px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>🚚 배정 운송 기사 목록</label>
                            {!isFormDisabled && (
                              <button onClick={handleAddVehicleRow} style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, borderRadius: '4px', border: '1px solid var(--primary)', color: 'var(--primary)', backgroundColor: 'transparent', cursor: 'pointer' }}>
                                + 차량 추가
                              </button>
                            )}
                          </div>

                          {/* 컬럼 헤더 (사장님 지시: 예상 운송비 필수, 실제 운송비 선택적 입력 2열로 분리) */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.1fr 0.8fr 1.1fr 1fr 1fr 30px', gap: '6px', padding: '6px 10px', backgroundColor: 'var(--bg-body)', borderRadius: '6px', fontSize: '11px', fontWeight: 800, color: 'var(--primary)', marginBottom: '6px', border: '1px solid var(--border-color)' }}>
                            <div>🏢 운송사 거래처</div>
                            <div>👤 운송 기사명</div>
                            <div>🚚 차종</div>
                            <div>📞 기사 연락처</div>
                            <div>💰 예상 운송비 (필수)</div>
                            <div>💵 실제 운송비 (선택)</div>
                            <div></div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {assignedVehicles.map((veh, idx) => {
                              const matchedComp = transportCompanies.find(c => c.name.trim() === veh.transportCompany.trim());
                              const filteredDrivers = matchedComp
                                ? transportDrivers.filter(d => d.companyId === matchedComp.id)
                                : transportDrivers;

                              return (
                                <div key={veh.id || idx} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', display: 'grid', gridTemplateColumns: '1.2fr 1.1fr 0.8fr 1.1fr 1fr 1fr 30px', gap: '6px', alignItems: 'center' }}>
                                  
                                  {/* 1. 운송사 셀렉트 */}
                                  <select
                                    value={veh.transportCompany}
                                    disabled={isFormDisabled}
                                    onChange={e => handleVehicleFieldChange(idx, 'transportCompany', e.target.value)}
                                    style={{ padding: '6px 6px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '11.5px', outline: 'none', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
                                  >
                                    <option value="">-- 운송사 선택 --</option>
                                    {transportCompanies.map(c => (
                                      <option key={c.id} value={c.name}>{c.name}</option>
                                    ))}
                                  </select>

                                  {/* 2. 기사명 셀렉트 */}
                                  <select
                                    value={veh.driverName}
                                    disabled={isFormDisabled}
                                    onChange={e => {
                                      const selectedName = e.target.value;
                                      handleVehicleFieldChange(idx, 'driverName', selectedName);
                                    }}
                                    style={{ padding: '6px 6px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '11.5px', outline: 'none', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
                                  >
                                    <option value="">-- 기사 선택 --</option>
                                    {filteredDrivers.map(drv => (
                                      <option key={drv.id} value={drv.driverName}>
                                        {drv.driverName} ({drv.vehicleNo || '차량미상'})
                                      </option>
                                    ))}
                                  </select>

                                  {/* 3. 차종 셀렉트 */}
                                  <select
                                    value={veh.vehicleType}
                                    disabled={isFormDisabled}
                                    onChange={e => handleVehicleFieldChange(idx, 'vehicleType', e.target.value)}
                                    style={{ padding: '6px 6px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '11.5px', outline: 'none', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
                                  >
                                    {VEHICLE_TYPE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                                  </select>

                                  {/* 4. 연락처 */}
                                  <input
                                    type="text"
                                    placeholder="연락처"
                                    value={veh.driverContact}
                                    disabled={isFormDisabled}
                                    onChange={e => handleVehicleFieldChange(idx, 'driverContact', e.target.value)}
                                    style={{ padding: '6px 6px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '11.5px', outline: 'none', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
                                  />

                                  {/* 5. 💰 예상 운송비 (필수) */}
                                  <input
                                    type="number"
                                    placeholder="예상 운송비"
                                    value={veh.expectedCost !== undefined ? veh.expectedCost : ''}
                                    disabled={isFormDisabled}
                                    onChange={e => {
                                      const val = Number(e.target.value);
                                      handleVehicleFieldChange(idx, 'expectedCost', val);
                                      handleVehicleFieldChange(idx, 'deliveryCost', val);
                                    }}
                                    style={{ padding: '6px 6px', borderRadius: '6px', border: '1px solid var(--primary)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-card)', color: 'var(--primary)', fontSize: '11.5px', fontWeight: 800, textAlign: 'right', outline: 'none', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
                                  />

                                  {/* 6. 💵 실제 운송비 (선택 - 알면 금액 입력, 모르면 기본값 0 유지) */}
                                  <input
                                    type="number"
                                    placeholder="0 (알면 입력)"
                                    value={veh.finalCost !== undefined && veh.finalCost !== null ? veh.finalCost : 0}
                                    disabled={isFormDisabled}
                                    onChange={e => {
                                      const val = e.target.value === '' ? 0 : Number(e.target.value);
                                      handleVehicleFieldChange(idx, 'finalCost', val);
                                    }}
                                    style={{ padding: '6px 6px', borderRadius: '6px', border: '1px solid #16a34a', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'rgba(34,197,94,0.05)', color: '#16a34a', fontSize: '11.5px', fontWeight: 800, textAlign: 'right', outline: 'none', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
                                  />

                                  {!isFormDisabled && (
                                    <button onClick={() => handleRemoveVehicleRow(idx)} style={{ color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* 마감 비고 메모 */}
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block', color: 'var(--text-secondary)' }}>📝 배차 특이사항 및 마감 메모</label>
                          <textarea
                            value={closingMemo}
                            disabled={isFormDisabled}
                            onChange={e => setClosingMemo(e.target.value)}
                            placeholder="배차 기사 전달사항, 현장 특이사항 기록..."
                            style={{ width: '100%', height: '65px', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-body)', color: 'var(--text-primary)', fontSize: '12.5px', boxSizing: 'border-box', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* 💬 최하단: 스마트 출고 요청 자연어 원본 텍스트 박스 */}
                  <div style={{ marginBottom: '20px', padding: '14px 16px', backgroundColor: 'rgba(59,130,246,0.06)', border: '1.5px solid rgba(59,130,246,0.25)', borderRadius: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MessageSquare size={16} /> 💬 스마트 출고 요청 자연어 원본 텍스트 (배차 판단 참고용)
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.6', fontFamily: 'Consolas, Monaco, monospace', backgroundColor: 'var(--bg-card)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      {selectedDelivery.rawText || selectedDelivery.memo || '요청된 자연어 원문이 없습니다.'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 탭 2: 월말 운송료 대사 및 매입 지급 요청 (좌우 분할 1:1 대사 스튜디오) */}
      {activeTab === 'RECONCILIATION' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* 1. 상단 컨트롤 바 (기간/거래처/조회버튼 + 컴팩트 요약 4종 + 엑셀 파이프라인) */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* Row 1: 기간 피커 + 거래처 드롭다운 + [🔍 조회] 버튼 + 엑셀 파이프라인 버튼군 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              
              {/* 📅 기간 및 거래처 선택 & [🔍 조회] 버튼 */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--bg-body)', padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <Calendar size={14} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: '12px', fontWeight: 800, whiteSpace: 'nowrap' }}>운송 기간:</span>
                  <input
                    type="date"
                    value={reconStartDate}
                    onChange={e => setReconStartDate(e.target.value)}
                    style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px' }}
                  />
                  <span style={{ fontSize: '12px' }}>~</span>
                  <input
                    type="date"
                    value={reconEndDate}
                    onChange={e => setReconEndDate(e.target.value)}
                    style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px' }}
                  />
                </div>

                {/* 기간 프리셋 버튼들 */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[
                    { label: '당월', key: 'THIS_MONTH' },
                    { label: '전월', key: 'LAST_MONTH' },
                    { label: '1개월', key: '1M' },
                    { label: '3개월', key: '3M' },
                    { label: '전체', key: 'ALL' }
                  ].map(b => (
                    <button
                      key={b.key}
                      onClick={() => handleSetReconDatePreset(b.key as any)}
                      style={{ padding: '5px 9px', fontSize: '11.5px', fontWeight: 700, borderRadius: '5px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>

                {/* 🏢 운송 거래처 선택 드롭다운 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>🏢 운송 거래처:</span>
                  <select
                    value={selectedReconCompany}
                    onChange={e => setSelectedReconCompany(e.target.value)}
                    style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 700 }}
                  >
                    <option value="ALL">전체 거래처</option>
                    {transportCompanies.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* 💡 [사장님 지시] 🔍 조회 버튼 추가 */}
                <button
                  onClick={() => setReconNotificationMsg(`🔍 [${selectedReconCompany === 'ALL' ? '전체 거래처' : selectedReconCompany}] (${reconStartDate} ~ ${reconEndDate}) 기간 조회가 갱신되었습니다.`)}
                  className="btn-primary"
                  style={{ padding: '6px 14px', fontSize: '12.5px', fontWeight: 800, borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', boxShadow: '0 2px 6px rgba(59,130,246,0.3)' }}
                >
                  <Search size={14} /> 조회
                </button>
              </div>

              {/* 📂 엑셀 파이프라인 버튼군 */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="file" ref={fileInputRef} onChange={handleExcelFileUpload} accept=".xlsx, .xls, .csv" style={{ display: 'none' }} />
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-primary"
                  style={{ padding: '7px 13px', fontSize: '12px', fontWeight: 800, borderRadius: '7px', display: 'inline-flex', alignItems: 'center', gap: '5px', boxShadow: '0 2px 8px rgba(59,130,246,0.25)' }}
                >
                  <Upload size={14} /> 📄 엑셀 거래명세서 업로드 & 자동대사
                </button>

                <button
                  onClick={handleDownloadExcelTemplate}
                  style={{ padding: '7px 11px', fontSize: '12px', fontWeight: 700, borderRadius: '7px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <FileSpreadsheet size={13} /> 양식 다운로드
                </button>

                <button
                  onClick={handleExportReconciliationReport}
                  style={{ padding: '7px 11px', fontSize: '12px', fontWeight: 700, borderRadius: '7px', border: '1px solid #16a34a', backgroundColor: 'rgba(22,163,74,0.1)', color: '#16a34a', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <Download size={13} /> 📊 대사 리포트 엑셀 다운로드
                </button>

                <button
                  onClick={async () => {
                    const targetYm = reconStartDate.slice(0, 7);
                    const compId = selectedReconCompany === 'ALL' ? undefined : transportCompanies.find(c => c.name === selectedReconCompany)?.id;
                    if (!confirm(`[${targetYm}] 연월의 대사 완료된 배차 운송비 건들을 [월말 매입 정산 대장]으로 자동 집계/이관하시겠습니까?`)) return;
                    try {
                      const count = await convertReconciledDeliveriesToSettlement(targetYm, compId);
                      if (count > 0) {
                        alert(`✅ 대사 완료 배차 ${count}건이 [월말 매입 정산(Purchase Settlement)] 대장으로 성공적으로 이관되었습니다.`);
                      } else {
                        alert(`ℹ️ [${targetYm}] 연월에 대사 완료(RECONCILED) 상태인 미이관 배차건이 없습니다.`);
                      }
                    } catch (err: any) {
                      showErrorModal(`매입 정산 이관 실패: ${err?.message || err}`);
                    }
                  }}
                  style={{ padding: '7px 11px', fontSize: '12px', fontWeight: 800, borderRadius: '7px', border: '1px solid #6366f1', backgroundColor: 'rgba(99,102,241,0.12)', color: '#6366f1', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  🚀 대사 완료건 매입정산 대장 이관
                </button>
              </div>
            </div>

            {/* 💡 [사장님 지시] Row 2: 각 유형 집계를 컴팩트 소형 카드로 축소하여 상단으로 배치 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', paddingTop: '4px', borderTop: '1px dashed var(--border-color)' }}>
              <div style={{ backgroundColor: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)' }}>
                  {reconStats.isPairMode ? '📄 엑셀 청구 항목' : '🏢 총 운송 완료'}
                </span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '14px', fontWeight: 900, color: 'var(--text-primary)', marginRight: '6px' }}>{reconStats.totalCount}건</span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)' }}>₩{reconStats.totalCost.toLocaleString()}원</span>
                </div>
              </div>

              <div style={{ backgroundColor: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '8px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#16a34a' }}>🟢 대사 일치/완료</span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '14px', fontWeight: 900, color: '#16a34a', marginRight: '6px' }}>{reconStats.matchedCount}건</span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#16a34a' }}>₩{reconStats.matchedCost.toLocaleString()}원</span>
                </div>
              </div>

              <div style={{ backgroundColor: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: '8px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#ca8a04' }}>🟡 금액 불일치</span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '14px', fontWeight: 900, color: '#ca8a04', marginRight: '6px' }}>{reconStats.mismatchCount}건</span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#ca8a04' }}>₩{reconStats.mismatchCost.toLocaleString()}원</span>
                </div>
              </div>

              <div style={{ backgroundColor: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#2563eb' }}>💳 매입 지급 요청</span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '14px', fontWeight: 900, color: '#2563eb', marginRight: '6px' }}>{reconStats.paymentRequestedCount}건</span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#2563eb' }}>₩{reconStats.paymentRequestedCost.toLocaleString()}원</span>
                </div>
              </div>
            </div>

            {/* Row 3: 대사 상태 탭 필터 및 검색어 입력 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', paddingTop: '4px' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { key: 'ALL', label: '전체 대사 내역' },
                  { key: 'PENDING', label: '⚪ 대사 대기' },
                  { key: 'MATCHED', label: '🟢 대사 완료' },
                  { key: 'MISMATCH', label: '🟡 금액 불일치' },
                  { key: 'PAYMENT_REQUESTED', label: '💳 지급 요청 완료' }
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => setReconStatusFilter(t.key as any)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: reconStatusFilter === t.key ? 'var(--primary)' : 'var(--border-color)',
                      backgroundColor: reconStatusFilter === t.key ? 'rgba(59,130,246,0.12)' : 'var(--bg-body)',
                      color: reconStatusFilter === t.key ? 'var(--primary)' : 'var(--text-secondary)',
                      fontWeight: reconStatusFilter === t.key ? 800 : 500,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative', width: '260px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="배차ID / 기사명 / 거래처 검색..."
                  value={reconSearchQuery}
                  onChange={e => setReconSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '5px 10px 5px 30px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>

          {/* 3. 대사 조치 툴바 (수동 1:1 대사 매칭, 대사 취소, 1건의 통합 매입 지급요청 버튼) */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                선택 상태: <span style={{ color: 'var(--primary)' }}>{selectedSystemDeliveryId ? '🏢 좌측 1건 선택됨' : '🏢 좌측 미선택'}</span> | <span style={{ color: '#16a34a' }}>{selectedExcelRowIndex !== null ? '📄 우측 1건 선택됨' : '📄 우측 미선택'}</span>
              </span>

              {/* 💡 [사장님 지시] 좌측 1개 + 우측 1개 선택 수동 1:1 대사완료 매칭 버튼 */}
              <button
                onClick={handleManualPairMatch}
                disabled={!selectedSystemDeliveryId || selectedExcelRowIndex === null}
                style={{
                  padding: '7px 14px',
                  fontSize: '12.5px',
                  fontWeight: 900,
                  borderRadius: '7px',
                  border: 'none',
                  backgroundColor: (selectedSystemDeliveryId && selectedExcelRowIndex !== null) ? '#16a34a' : 'var(--bg-body)',
                  color: (selectedSystemDeliveryId && selectedExcelRowIndex !== null) ? '#fff' : 'var(--text-muted)',
                  cursor: (selectedSystemDeliveryId && selectedExcelRowIndex !== null) ? 'pointer' : 'not-allowed',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: (selectedSystemDeliveryId && selectedExcelRowIndex !== null) ? '0 2px 8px rgba(22,163,74,0.3)' : 'none'
                }}
              >
                <CheckCircle2 size={15} /> 🔗 선택 1:1 수동 대사 완료 매칭
              </button>

              {/* 선택 해제 버튼 */}
              {(selectedSystemDeliveryId || selectedExcelRowIndex !== null) && (
                <button
                  onClick={() => {
                    setSelectedSystemDeliveryId(null);
                    setSelectedExcelRowIndex(null);
                  }}
                  style={{ padding: '6px 10px', fontSize: '11.5px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  선택 해제
                </button>
              )}
            </div>

            {/* 💡 [사장님 지시] 💳 대사 완료 1건의 통합 매입 지급요청 생성 버튼 */}
            <button
              onClick={handleExecuteBundlePaymentRequest}
              style={{
                padding: '10px 22px',
                fontSize: '13.5px',
                fontWeight: 900,
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#fff',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(37,99,235,0.35)'
              }}
            >
              <Send size={16} /> [💳 대사 완료 1건의 통합 매입 지급요청 생성 ({reconPairs.filter(p => p.isReconciled).length}건)]
            </button>
          </div>

          {/* 4. 💡 [사장님 지시] 좌우 독립 스크롤 듀얼 패널 대사 스튜디오 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            
            {/* ────────────── [좌측 패널] 회사의 운송 완료 내역 목록 (독립 스크롤) ────────────── */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--primary)', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🏢 [좌측] 회사의 운송 완료 내역 ({completedDeliveriesForRecon.length}건)</span>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>💡 선택 클릭하여 우측과 1:1 수동대사</span>
              </div>

              <div style={{ maxHeight: '580px', overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {completedDeliveriesForRecon.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                    조회된 기간 내 회사의 운송 완료 배차 내역이 없습니다.
                  </div>
                ) : (
                  completedDeliveriesForRecon.map((d) => {
                    const contract = contracts.find(c => c.id === d.contractId);
                    const customer = contract ? customers.find(c => c.id === contract.customerId) : null;
                    const cost = d.deliveryCost || d.assignedVehicles?.reduce((acc: number, v: any) => acc + (v.deliveryCost || 0), 0) || 70000;
                    const isSelected = selectedSystemDeliveryId === d.id;
                    const reconPair = reconPairs.find(p => p.systemDelivery?.id === d.id);
                    const isReconciled = reconPair?.isReconciled || (d as any).reconciliationStatus === 'PAYMENT_REQUESTED';

                    return (
                      <div
                        key={d.id}
                        onClick={() => setSelectedSystemDeliveryId(isSelected ? null : d.id)}
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          border: isSelected ? '2px solid #2563eb' : '1px solid var(--border-color)',
                          backgroundColor: isSelected ? 'rgba(59,130,246,0.12)' : isReconciled ? 'rgba(34,197,94,0.03)' : 'var(--bg-body)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected ? '0 0 0 3px rgba(37,99,235,0.2)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '13px' }}>
                            {d.id}
                          </span>
                          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                            📅 {d.loadingDate || d.requestDate}
                          </span>
                        </div>

                        <div style={{ fontWeight: 800, fontSize: '12.5px', color: 'var(--text-primary)' }}>
                          🏢 {customer?.name || '미지정 고객사'}
                        </div>

                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0' }}>
                          📍 {d.destinationAddress || '도착지 미지정'}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed var(--border-color)' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            🚛 {d.driverName || '기사미지정'} ({d.vehicleType || '3.5T'})
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <span style={{ fontSize: '13px', fontWeight: 900, color: d.finalCost && d.finalCost > 0 ? '#16a34a' : '#d97706' }}>
                                  💵 실제가(final): ₩{(d.finalCost ?? 0).toLocaleString()}원
                                </span>
                                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                                  (💰 예상가: ₩{(d.expectedCost || d.deliveryCost || 70000).toLocaleString()}원)
                                </span>
                              </div>
                            </div>

                            {/* 💡 [사장님 지시] finalCost 수정 버튼 (대사 정산 완료 시 엑셀 금액과 100% 일치) */}
                            <button
                              onClick={(e) => handleOpenCostEdit(d, d.finalCost ?? 0, e)}
                              title="실제 운송료(finalCost) 수정 (DB finalCost 및 deliveryCost 즉시 반영)"
                              style={{
                                padding: '3px 8px',
                                fontSize: '11px',
                                fontWeight: 800,
                                borderRadius: '5px',
                                border: '1px solid #2563eb',
                                backgroundColor: 'rgba(59,130,246,0.1)',
                                color: '#2563eb',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              ✏️ finalCost 수정
                            </button>
                          </div>
                        </div>

                        {/* 상태 및 대사 취소 버튼 */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                          {isReconciled ? (
                            <span style={{ padding: '3px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 900, backgroundColor: 'rgba(34,197,94,0.15)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)' }}>
                              🟢 대사 완료
                            </span>
                          ) : (
                            <span style={{ padding: '3px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                              ⚪ 대사 대기
                            </span>
                          )}

                          {reconPair && isReconciled && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTogglePairReconciled(reconPair.pairId);
                              }}
                              style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 800, borderRadius: '5px', border: '1px solid #eab308', backgroundColor: 'rgba(234,179,8,0.12)', color: '#ca8a04', cursor: 'pointer' }}
                            >
                              <RotateCcw size={12} style={{ display: 'inline', marginRight: '2px' }} /> ↩️ 대사 취소
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ────────────── [우측 패널] 업로드 거래명세서 엑셀 내역 (독립 스크롤) ────────────── */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#16a34a', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📄 [우측] 업로드 거래명세서 엑셀 내역 ({reconPairs.filter(p => p.excelRow).length}건)</span>
                {uploadedFileName && <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>📄 {uploadedFileName}</span>}
              </div>

              <div style={{ maxHeight: '580px', overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {reconPairs.filter(p => p.excelRow).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                    상단 [📄 엑셀 거래명세서 업로드 & 자동대사] 버튼으로 명세서(.xlsx, .csv)를 업로드해 주세요.
                  </div>
                ) : (
                  reconPairs.filter(p => p.excelRow).map((pair, idx) => {
                    const row = pair.excelRow;
                    const isSelected = selectedExcelRowIndex === idx;
                    const costKey = Object.keys(row).find(k => k.includes('합계') || k.includes('운송비') || k.includes('청구금액') || k.includes('금액'));
                    const excelCost = costKey ? Number(String(row[costKey]).replace(/[^0-9.-]+/g, '')) : 0;

                    return (
                      <div
                        key={pair.pairId}
                        onClick={() => setSelectedExcelRowIndex(isSelected ? null : idx)}
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          border: isSelected ? '2px solid #16a34a' : '1px solid var(--border-color)',
                          backgroundColor: isSelected ? 'rgba(34,197,94,0.12)' : pair.isReconciled ? 'rgba(34,197,94,0.03)' : 'var(--bg-body)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected ? '0 0 0 3px rgba(22,163,74,0.2)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '11.5px', color: 'var(--primary)', fontWeight: 800, backgroundColor: 'rgba(59,130,246,0.1)', padding: '3px 8px', borderRadius: '5px' }}>
                            📅 {formatExcelDateStr(row['운송일자'] || row['날짜'] || row['일자'])}
                          </span>
                          <span style={{ fontSize: '14px', fontWeight: 900, color: pair.diffCost !== 0 ? '#ca8a04' : '#16a34a' }}>
                            ₩{excelCost.toLocaleString()}원
                          </span>
                        </div>

                        {/* 💡 [사장님 지시] 심플 뱃지 그리드 (중복 합계/금액/일자/행번호/비고:비고/빈기사아이콘 전면 제거) */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '4px 0' }}>
                          {Object.entries(row).map(([k, v]) => {
                            if (!v || v === '-' || v === "''") return null;
                            const kClean = k.trim();
                            const vStr = String(v).trim();
                            if (!vStr || vStr === '-') return null;

                            // 1. 중복 금액/합계/일자 컬럼은 우측 상단 금액/날짜로 표출되므로 뱃지에서 생략
                            if (kClean.includes('합계') || kClean.includes('금액') || kClean.includes('운송비') || kClean.includes('청구금액')) return null;
                            if (kClean.includes('일자') || kClean.includes('날짜') || kClean.includes('운송일')) return null;

                            // 2. '비고: 비고 세보 엠이씨' 처럼 '비고' 단어 중복 필터링
                            let displayVal = vStr;
                            if (kClean === '비고' && displayVal.startsWith('비고')) {
                              displayVal = displayVal.replace(/^비고[:\s]*/, '').trim();
                            }
                            if (!displayVal) return null;

                            return (
                              <span
                                key={k}
                                style={{
                                  padding: '2px 7px',
                                  borderRadius: '5px',
                                  fontSize: '11.5px',
                                  backgroundColor: 'var(--bg-card)',
                                  border: '1px solid var(--border-color)',
                                  color: 'var(--text-primary)',
                                  lineHeight: '1.4'
                                }}
                              >
                                <strong style={{ color: 'var(--primary)', marginRight: '3px' }}>{kClean}:</strong>
                                {displayVal}
                              </span>
                            );
                          })}
                        </div>

                        {/* 기사명이 존재할 때만 기사 정보 노출 (빈 기사아이콘 '🚛 -' 제거) */}
                        {(row['기사명'] || row['운송기사']) && String(row['기사명'] || row['운송기사']).trim() !== '-' && (
                          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            🚛 {row['기사명'] || row['운송기사']}
                          </div>
                        )}

                        {/* 대사 완료 상태일 때만 🟢 대사 완료 뱃지 및 ↩️ 대사 취소 버튼 노출 */}
                        {pair.isReconciled && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed var(--border-color)' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 900, backgroundColor: 'rgba(34,197,94,0.15)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)' }}>
                              🟢 대사 완료
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTogglePairReconciled(pair.pairId);
                              }}
                              style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 800, borderRadius: '5px', border: '1px solid #eab308', backgroundColor: 'rgba(234,179,8,0.12)', color: '#ca8a04', cursor: 'pointer' }}
                            >
                              <RotateCcw size={12} style={{ display: 'inline', marginRight: '2px' }} /> ↩️ 대사 취소
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* 5. 엑셀 업로드 시 시스템 미등록 청구 항목 카드 */}
          {unmatchedExcelRows.length > 0 && (
            <div style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1.5px solid rgba(239,68,68,0.25)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#dc2626', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={16} /> 🔴 시스템 미등록 엑셀 청구 내역 ({unmatchedExcelRows.length}건)
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                업로드한 엑셀에 존재하지만 시스템 배차 내역에 일치하는 ID/기사가 없는 청구 항목들입니다.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                {unmatchedExcelRows.map((row, idx) => (
                  <div key={idx} style={{ padding: '8px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px', fontFamily: 'Consolas, Monaco, monospace' }}>
                    {JSON.stringify(row)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 수동 배차 모달 */}
      {showManualModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 16px 0' }}>🚛 수동 배차 신규 생성</h3>
            
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>배차 구분의 유형</label>
              <select value={manualCategory} onChange={e => setManualCategory(e.target.value as any)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)' }}>
                <option value="출고">출고</option>
                <option value="입고">입고</option>
                <option value="반납">반납</option>
                <option value="정비">정비</option>
                <option value="이동">이동</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>출발지 (상차지)</label>
                <input type="text" value={manualOrigin} onChange={e => setManualOrigin(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>도착지 (하차지)</label>
                <input type="text" value={manualDestination} onChange={e => setManualDestination(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)' }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button onClick={() => setShowManualModal(false)} className="btn-secondary">취소</button>
              <button onClick={handleSaveManualDispatch} className="btn-primary" style={{ fontWeight: 800 }}>배차 생성 저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 💡 [사장님 지시] 배차 운송료 금액 수정 모달 (DB 실시간 동기화) */}
      {showCostEditModal && editingDelivery && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '420px', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 900, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                💰 배차 운송료 금액 수정
              </h3>
              <button onClick={() => setShowCostEditModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ backgroundColor: 'var(--bg-body)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px', fontSize: '12.5px' }}>
              <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '4px' }}>📌 배차ID: {editingDelivery.id}</div>
              <div>📍 하차지: {editingDelivery.destinationAddress || '미지정'}</div>
              <div>🚛 기사명: {editingDelivery.driverName || '미지정'}</div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: 800, marginBottom: '6px', display: 'block', color: 'var(--text-primary)' }}>
                변경할 운송료 금액 (원)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  value={editingCostInput}
                  onChange={e => setEditingCostInput(Number(e.target.value))}
                  placeholder="예: 70000"
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 30px',
                    borderRadius: '8px',
                    border: '2px solid var(--primary)',
                    backgroundColor: 'var(--bg-body)',
                    color: 'var(--text-primary)',
                    fontSize: '15px',
                    fontWeight: 900,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 900, color: 'var(--primary)' }}>₩</span>
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>
                💡 변경 즉시 원격 DB(Supabase) `deliveries` 테이블의 `deliveryCost`에 저장되고 실시간 반영됩니다.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setShowCostEditModal(false)}
                style={{ padding: '8px 14px', borderRadius: '7px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 700, fontSize: '12.5px' }}
              >
                취소
              </button>
              <button
                onClick={handleSaveDeliveryCost}
                style={{ padding: '8px 18px', borderRadius: '7px', border: 'none', backgroundColor: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 900, fontSize: '13px', boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}
              >
                💾 DB 금액 수정 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ☀️ 운송 하차지 실시간 날씨 및 주간 예보 모달 */}
      <DestinationWeatherModal
        isOpen={showDestWeatherModal}
        onClose={() => setShowDestWeatherModal(false)}
        customerName={destWeatherParams.customerName}
        siteName={destWeatherParams.siteName}
        rawAddress={destWeatherParams.rawAddress}
      />
    </div>
  );
};
