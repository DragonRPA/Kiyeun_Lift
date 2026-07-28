import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { 
  Truck, Check, AlertCircle, Plus, Trash2, Clock, Layers, 
  FileText, Copy, Lock, CreditCard, CheckCircle, RefreshCw, X,
  Calendar, RotateCcw, ShieldCheck, CheckSquare, XCircle, Search,
  MessageSquare, User, Edit2, Upload, Download, FileSpreadsheet,
  CheckCircle2, AlertTriangle, Filter, DollarSign, Send
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Delivery, TransportCompany, TransportDriver, db, DeliveryStatus } from '../services/db';

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
  deliveryCost: number;
}

export const TruckDispatch: React.FC = () => {
  const { 
    deliveries, contracts, customers, products, 
    transportCompanies, transportDrivers, outboundInspections, hasPermission, 
    refreshAllData, showErrorModal 
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
      const past = new Date();
      past.setDate(today.getDate() - 7);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (type === 'MONTH') {
      const past = new Date();
      past.setMonth(today.getMonth() - 1);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  
  // 배차 세부 유형 ('출고' | '입고' | '반납' | '정비' | '이동')
  const [dispatchCategory, setDispatchCategory] = useState<'출고' | '입고' | '반납' | '정비' | '이동'>('출고');
  
  // 상차 일시 & 시간 지정
  const [loadingDate, setLoadingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loadingTimeSlot, setLoadingTimeSlot] = useState('오전');
  const [loadingCustomTime, setLoadingCustomTime] = useState('');

  // 하차 일시 & 시간 지정
  const [unloadingDate, setUnloadingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [unloadingTimeSlot, setUnloadingTimeSlot] = useState('오전');
  const [unloadingCustomTime, setUnloadingCustomTime] = useState('');

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

  // 📄 [월말 운송료 대사 탭 state & 파이프라인]
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reconStartDate, setReconStartDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [reconEndDate, setReconEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedReconCompany, setSelectedReconCompany] = useState<string>('ALL');
  const [reconStatusFilter, setReconStatusFilter] = useState<'ALL' | 'PENDING' | 'MATCHED' | 'MISMATCH' | 'PAYMENT_REQUESTED'>('ALL');
  const [reconSearchQuery, setReconSearchQuery] = useState<string>('');

  const [manualReconMap, setManualReconMap] = useState<Record<string, { 
    status: 'MATCHED' | 'MISMATCH' | 'PENDING' | 'PAYMENT_REQUESTED'; 
    excelCost?: number; 
    diffCost?: number; 
    excelDriverName?: string;
    memo?: string;
  }>>({});

  const [selectedReconIds, setSelectedReconIds] = useState<Set<string>>(new Set());
  const [unmatchedExcelRows, setUnmatchedExcelRows] = useState<any[]>([]);
  const [reconNotificationMsg, setReconNotificationMsg] = useState<string>('');

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
        const matchComp = d.assignedVehicles?.some(v => v.transportCompany.trim() === selectedReconCompany.trim()) || 
                          (d.transportCompany && d.transportCompany.trim() === selectedReconCompany.trim());
        if (!matchComp) return false;
      }

      // 4. 대사 상태 필터
      const localState = manualReconMap[d.id];
      const currentStatus = localState?.status || (d as any).reconciliationStatus || 'PENDING';
      if (reconStatusFilter !== 'ALL' && currentStatus !== reconStatusFilter) return false;

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
  }, [deliveries, reconStartDate, reconEndDate, selectedReconCompany, reconStatusFilter, reconSearchQuery, manualReconMap, contracts, customers]);

  // 대사 통계 실시간 집계
  const reconStats = useMemo(() => {
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
      const cost = d.deliveryCost || d.assignedVehicles?.reduce((acc, v) => acc + (v.deliveryCost || 0), 0) || 70000;
      totalCost += cost;

      const st = manualReconMap[d.id]?.status || (d as any).reconciliationStatus || 'PENDING';
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
      totalCount, totalCost,
      matchedCount, matchedCost,
      mismatchCount, mismatchCost,
      paymentRequestedCount, paymentRequestedCost,
      pendingCount, pendingCost
    };
  }, [completedDeliveriesForRecon, manualReconMap]);

  // 📄 엑셀 업로드 및 대사 (Reconciliation) 파싱 엔진
  const handleExcelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (!jsonRows || jsonRows.length === 0) {
          showErrorModal('업로드한 엑셀 파일에 데이터가 없습니다.');
          return;
        }

        let matchedCount = 0;
        let mismatchCount = 0;
        const unmatchedList: any[] = [];
        const newMap = { ...manualReconMap };

        jsonRows.forEach(row => {
          const keys = Object.keys(row);
          const idKey = keys.find(k => k.includes('배차ID') || k.includes('배차번호') || k.includes('ID') || k.includes('운송ID'));
          const costKey = keys.find(k => k.includes('운송비') || k.includes('청구금액') || k.includes('금액') || k.includes('운임'));
          const driverKey = keys.find(k => k.includes('기사명') || k.includes('운송기사') || k.includes('기사'));

          const excelId = idKey ? String(row[idKey]).trim() : '';
          const excelCost = costKey ? Number(String(row[costKey]).replace(/[^0-9.-]+/g, '')) : 0;
          const excelDriver = driverKey ? String(row[driverKey]).trim() : '';

          let targetDelivery = completedDeliveriesForRecon.find(d => d.id.toLowerCase() === excelId.toLowerCase());

          if (!targetDelivery && excelDriver) {
            targetDelivery = completedDeliveriesForRecon.find(d => d.driverName && d.driverName.trim() === excelDriver);
          }

          if (targetDelivery) {
            const systemCost = targetDelivery.deliveryCost || targetDelivery.assignedVehicles?.reduce((acc: number, v: any) => acc + (v.deliveryCost || 0), 0) || 70000;
            const diff = excelCost - systemCost;

            if (excelCost > 0 && Math.abs(diff) > 0) {
              mismatchCount++;
              newMap[targetDelivery.id] = {
                status: 'MISMATCH',
                excelCost,
                diffCost: diff,
                excelDriverName: excelDriver,
                memo: `시스템 ₩${systemCost.toLocaleString()}원 vs 엑셀 청구 ₩${excelCost.toLocaleString()}원 (차액 ₩${diff.toLocaleString()}원)`
              };
            } else {
              matchedCount++;
              newMap[targetDelivery.id] = {
                status: 'MATCHED',
                excelCost: systemCost,
                diffCost: 0,
                excelDriverName: excelDriver,
                memo: '엑셀 대사 금액 100% 일치'
              };
            }
          } else {
            unmatchedList.push(row);
          }
        });

        setManualReconMap(newMap);
        setUnmatchedExcelRows(unmatchedList);

        const msg = `🎉 엑셀 대사 완료: [🟢 일치 ${matchedCount}건] | [🟡 금액 불일치 ${mismatchCount}건] | [🔴 미등록 청구건 ${unmatchedList.length}건]`;
        setReconNotificationMsg(msg);
      } catch (err: any) {
        showErrorModal('엑셀 파싱 중 오류가 발생하였습니다: ' + err.message);
      }
    };

    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 선택건 수동 대사 완료 전환
  const handleBatchSetReconciled = () => {
    if (selectedReconIds.size === 0) {
      showErrorModal('대사 처리할 배차건을 최소 1건 이상 체크해 주세요.');
      return;
    }
    const newMap = { ...manualReconMap };
    selectedReconIds.forEach(id => {
      newMap[id] = { status: 'MATCHED', memo: '수동 대사 완료' };
    });
    setManualReconMap(newMap);
    setReconNotificationMsg(`✅ 선택한 ${selectedReconIds.size}건의 배차 내역이 대사 완료(MATCHED)로 전환되었습니다.`);
  };

  // 대사 완료건 매입 지급 요청 실행 (DB 동기화)
  const handleExecutePaymentRequest = async () => {
    const targetIds = Array.from(selectedReconIds).length > 0
      ? Array.from(selectedReconIds)
      : completedDeliveriesForRecon.filter(d => (manualReconMap[d.id]?.status === 'MATCHED' || (d as any).reconciliationStatus === 'MATCHED')).map(d => d.id);

    if (targetIds.length === 0) {
      showErrorModal('지급 요청할 대사 완료건이 없습니다. 먼저 엑셀 대사 또는 체크 후 대사 완료를 집행해 주세요.');
      return;
    }

    try {
      const newMap = { ...manualReconMap };
      for (const id of targetIds) {
        newMap[id] = { status: 'PAYMENT_REQUESTED', memo: `지급 요청 실행 (${new Date().toISOString().substring(0, 10)})` };
        await db.updateRow('deliveries', id, { reconciliationStatus: 'PAYMENT_REQUESTED', paymentRequestedAt: new Date().toISOString() } as any);
      }

      setManualReconMap(newMap);
      setSelectedReconIds(new Set());
      await refreshAllData();
      setReconNotificationMsg(`💳 성공적으로 ${targetIds.length}건의 대사 완료 내역에 대한 [매입 지급 요청]이 완료되었습니다!`);
    } catch (err: any) {
      showErrorModal('지급 요청 처리 중 오류가 발생하였습니다: ' + err.message);
    }
  };

  // 엑셀 내보내기 다운로드
  const handleExportReconciliationReport = () => {
    if (completedDeliveriesForRecon.length === 0) {
      showErrorModal('내보낼 대사 내역이 없습니다.');
      return;
    }

    const exportRows = completedDeliveriesForRecon.map((d, i) => {
      const contract = contracts.find(c => c.id === d.contractId);
      const customer = contract ? customers.find(c => c.id === contract.customerId) : null;
      const localState = manualReconMap[d.id];
      const st = localState?.status || (d as any).reconciliationStatus || 'PENDING';
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
        '엑셀 청구액(원)': localState?.excelCost || cost,
        '차액(원)': localState?.diffCost || 0,
        '대사 상태': st === 'MATCHED' ? '대사일치' : st === 'MISMATCH' ? '금액불일치' : st === 'PAYMENT_REQUESTED' ? '지급요청완료' : '대사대기',
        '비고 / 특이사항': localState?.memo || d.memo || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '월말_운송료_대사내역');
    XLSX.writeFile(workbook, `월말_운송료_대사내역_${reconStartDate}_${reconEndDate}.xlsx`);
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

  const getContract = (contractId?: string) => contracts.find(c => c.id === contractId);
  const getCustomer = (customerId?: string) => customers.find(c => c.id === customerId);

  // 1. 배차 4단계 진행 상태 판정 헬퍼
  const getNormalizedDeliveryStatus = (d: Delivery): 'PENDING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED' => {
    if (d.status === 'DISPATCHED') return 'DISPATCHED';
    if (d.status === 'DELIVERED' || d.status === 'COMPLETED') return 'DELIVERED';
    if (d.status === 'CANCELLED') return 'CANCELLED';
    return 'PENDING';
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

    let defaultCat: '출고' | '입고' | '반납' | '정비' | '이동' = d.dispatchCategory || (d.type === 'OUTBOUND' ? '출고' : d.type === 'RETURN' || d.type === 'INBOUND' ? '반납' : '출고');
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
        deliveryCost: 70000
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
      const totalCost = assignedVehicles.reduce((sum, v) => sum + (Number(v.deliveryCost) || 0), 0);

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
        deliveryCost: totalCost,
        expectedCost: totalCost,
        finalCost: totalCost,
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
                        <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          📍 {d.destinationAddress || '목적지 미지정'}
                        </div>

                        <div style={{ padding: '6px 8px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          📦 화물: {cargoItems.map(c => `${c.modelName} ${c.count}대`).join(', ')}
                        </div>

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
                      
                      {/* 💡 [사장님 지시] 하단에 있던 배차/운송완료 액션 버튼을 상단 우측 헤더로 이동 배치! */}
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

                        {/* 배차 세부 설정 폼 (isFormDisabled 시 비활성화 수정 불가!) */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block', color: 'var(--text-secondary)' }}>배차 구분</label>
                            <select
                              value={dispatchCategory}
                              disabled={isFormDisabled}
                              onChange={e => setDispatchCategory(e.target.value as any)}
                              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-body)', fontSize: '12.5px', color: 'var(--text-primary)', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
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
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <input
                                type="date"
                                value={loadingDate}
                                disabled={isFormDisabled}
                                onChange={e => setLoadingDate(e.target.value)}
                                style={{ flex: 1, padding: '7px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-body)', fontSize: '12.5px', color: 'var(--text-primary)', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
                              />
                              <select
                                value={loadingTimeSlot}
                                disabled={isFormDisabled}
                                onChange={e => setLoadingTimeSlot(e.target.value)}
                                style={{ width: '80px', padding: '7px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-body)', fontSize: '12.5px', color: 'var(--text-primary)', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
                              >
                                <option value="오전">오전</option>
                                <option value="오후">오후</option>
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

                          {/* 컬럼 헤더 */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.3fr 1fr 1.3fr 1fr 30px', gap: '8px', padding: '6px 10px', backgroundColor: 'var(--bg-body)', borderRadius: '6px', fontSize: '11.5px', fontWeight: 800, color: 'var(--primary)', marginBottom: '6px', border: '1px solid var(--border-color)' }}>
                            <div>🏢 운송사 거래처</div>
                            <div>👤 운송 기사명</div>
                            <div>🚚 차종</div>
                            <div>📞 기사 연락처</div>
                            <div>💰 운송비 (원)</div>
                            <div></div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {assignedVehicles.map((veh, idx) => {
                              const matchedComp = transportCompanies.find(c => c.name.trim() === veh.transportCompany.trim());
                              const filteredDrivers = matchedComp
                                ? transportDrivers.filter(d => d.companyId === matchedComp.id)
                                : transportDrivers;

                              return (
                                <div key={veh.id || idx} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', display: 'grid', gridTemplateColumns: '1.4fr 1.3fr 1fr 1.3fr 1fr 30px', gap: '8px', alignItems: 'center' }}>
                                  
                                  {/* 1. 운송사 셀렉트 */}
                                  <select
                                    value={veh.transportCompany}
                                    disabled={isFormDisabled}
                                    onChange={e => handleVehicleFieldChange(idx, 'transportCompany', e.target.value)}
                                    style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
                                  >
                                    <option value="">-- 운송사 거래처 선택 --</option>
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
                                    style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
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
                                    style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
                                  >
                                    {VEHICLE_TYPE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                                  </select>

                                  {/* 4. 연락처 */}
                                  <input
                                    type="text"
                                    placeholder="기사 연락처"
                                    value={veh.driverContact}
                                    disabled={isFormDisabled}
                                    onChange={e => handleVehicleFieldChange(idx, 'driverContact', e.target.value)}
                                    style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
                                  />

                                  {/* 5. 운송비 (원) */}
                                  <input
                                    type="number"
                                    placeholder="운송비"
                                    value={veh.deliveryCost}
                                    disabled={isFormDisabled}
                                    onChange={e => handleVehicleFieldChange(idx, 'deliveryCost', Number(e.target.value))}
                                    style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 800, textAlign: 'right', outline: 'none', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
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

                  {/* ────────────────────────────────────────────────────────────────── */}
                  {/* 💬 최하단: 스마트 출고 요청 자연어 원본 텍스트 박스 */}
                  {/* ────────────────────────────────────────────────────────────────── */}
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

      {/* 탭 2: 월말 운송료 대사 및 매입 지급 요청 */}
      {activeTab === 'RECONCILIATION' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* 1. 상단 컨트롤 바 (기간/거래처/검색어 + 엑셀 파이프라인 버튼들) */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              
              {/* 📅 기간 선택 및 거래처 필터 */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--bg-body)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <Calendar size={14} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: '12px', fontWeight: 800 }}>운송 기간:</span>
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
                  <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>🏢 운송 거래처:</span>
                  <select
                    value={selectedReconCompany}
                    onChange={e => setSelectedReconCompany(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: '12.5px', fontWeight: 700 }}
                  >
                    <option value="ALL">전체 거래처</option>
                    {transportCompanies.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 📂 엑셀 파이프라인 버튼군 */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="file" ref={fileInputRef} onChange={handleExcelFileUpload} accept=".xlsx, .xls, .csv" style={{ display: 'none' }} />
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-primary"
                  style={{ padding: '8px 14px', fontSize: '12.5px', fontWeight: 800, borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(59,130,246,0.25)' }}
                >
                  <Upload size={15} /> 📄 엑셀 거래명세서 업로드 & 자동 대사
                </button>

                <button
                  onClick={handleDownloadExcelTemplate}
                  style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 700, borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <FileSpreadsheet size={14} /> 양식 다운로드
                </button>

                <button
                  onClick={handleExportReconciliationReport}
                  style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 700, borderRadius: '8px', border: '1px solid #16a34a', backgroundColor: 'rgba(22,163,74,0.1)', color: '#16a34a', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <Download size={14} /> 📊 대사 리포트 엑셀 다운로드
                </button>
              </div>
            </div>

            {/* 검색어 입력 및 대사 상태 탭 필터 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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

              <div style={{ position: 'relative', width: '280px' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="배차ID / 기사명 / 거래처 검색..."
                  value={reconSearchQuery}
                  onChange={e => setReconSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px 6px 32px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>

          {/* 알림 메시지 바너 */}
          {reconNotificationMsg && (
            <div style={{ padding: '12px 16px', backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '10px', fontSize: '13px', fontWeight: 800, color: 'var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{reconNotificationMsg}</span>
              <button onClick={() => setReconNotificationMsg('')} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}><X size={16} /></button>
            </div>
          )}

          {/* 2. 핵심 요약 카드 4종 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>📦 총 운송 완료 내역</div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)' }}>{reconStats.totalCount}건</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>₩{reconStats.totalCost.toLocaleString()}원</div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a', marginBottom: '4px' }}>🟢 대사 일치 / 완료</div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#16a34a' }}>{reconStats.matchedCount}건</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>₩{reconStats.matchedCost.toLocaleString()}원</div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#ca8a04', marginBottom: '4px' }}>🟡 금액 불일치 (청구차액)</div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#ca8a04' }}>{reconStats.mismatchCount}건</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#ca8a04', marginTop: '2px' }}>₩{reconStats.mismatchCost.toLocaleString()}원</div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(59,130,246,0.4)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', marginBottom: '4px' }}>💳 매입 지급 요청 완료</div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#2563eb' }}>{reconStats.paymentRequestedCount}건</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>₩{reconStats.paymentRequestedCost.toLocaleString()}원</div>
            </div>
          </div>

          {/* 3. 대사 수행 조치 버튼 바 */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                체크 선택 항목: <span style={{ color: 'var(--primary)' }}>{selectedReconIds.size}건</span>
              </span>
              <button
                onClick={handleBatchSetReconciled}
                style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 800, borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <CheckCircle2 size={14} style={{ color: '#16a34a' }} /> 선택건 수동 대사 완료 처리
              </button>
            </div>

            {/* 메인 매입 지급 요청 실행 버튼 */}
            <button
              onClick={handleExecutePaymentRequest}
              style={{
                padding: '10px 20px',
                fontSize: '13.5px',
                fontWeight: 800,
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#fff',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(37,99,235,0.3)'
              }}
            >
              <Send size={16} /> [💳 대사 완료건 매입 지급 요청 실행]
            </button>
          </div>

          {/* 4. 대사 정밀 비교 테이블 */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-body)', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '10px 8px', textAlign: 'center', width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={completedDeliveriesForRecon.length > 0 && completedDeliveriesForRecon.every(d => selectedReconIds.has(d.id))}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedReconIds(new Set(completedDeliveriesForRecon.map(d => d.id)));
                        } else {
                          setSelectedReconIds(new Set());
                        }
                      }}
                    />
                  </th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', width: '50px' }}>순번</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left' }}>운송일자</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left' }}>배차ID</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left' }}>운송 거래처</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left' }}>고객사 / 도착지(현장)</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left' }}>기사명 (차종)</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>시스템 운송비</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>엑셀 청구액</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>차액</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>대사 상태</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left' }}>비고 / 특이사항</th>
                </tr>
              </thead>
              <tbody>
                {completedDeliveriesForRecon.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
                      조건에 해당하는 운송 완료 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  completedDeliveriesForRecon.map((d, i) => {
                    const contract = contracts.find(c => c.id === d.contractId);
                    const customer = contract ? customers.find(c => c.id === contract.customerId) : null;
                    const isChecked = selectedReconIds.has(d.id);

                    const localState = manualReconMap[d.id];
                    const currentStatus = localState?.status || (d as any).reconciliationStatus || 'PENDING';
                    const systemCost = d.deliveryCost || d.assignedVehicles?.reduce((acc: number, v: any) => acc + (v.deliveryCost || 0), 0) || 70000;
                    const excelCost = localState?.excelCost !== undefined ? localState.excelCost : systemCost;
                    const diffCost = localState?.diffCost !== undefined ? localState.diffCost : 0;

                    return (
                      <tr
                        key={d.id}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          backgroundColor: isChecked ? 'rgba(59,130,246,0.05)' : 'transparent'
                        }}
                      >
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const newSet = new Set(selectedReconIds);
                              if (newSet.has(d.id)) newSet.delete(d.id);
                              else newSet.add(d.id);
                              setSelectedReconIds(newSet);
                            }}
                          />
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td style={{ padding: '10px 8px', fontWeight: 700 }}>{d.loadingDate || d.requestDate}</td>
                        <td style={{ padding: '10px 8px', fontWeight: 800, color: 'var(--primary)' }}>{d.id}</td>
                        <td style={{ padding: '10px 8px', fontWeight: 700 }}>
                          {d.transportCompany || d.assignedVehicles?.[0]?.transportCompany || '자사배차'}
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <div style={{ fontWeight: 800 }}>🏢 {customer?.name || '미지정'}</div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>📍 {d.destinationAddress || '도착지 미지정'}</div>
                        </td>
                        <td style={{ padding: '10px 8px', fontWeight: 700 }}>
                          🚛 {d.driverName || '기사미지정'} ({d.vehicleType || '3.5T'})
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800 }}>
                          ₩{systemCost.toLocaleString()}원
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, color: diffCost !== 0 ? '#ca8a04' : 'var(--text-primary)' }}>
                          ₩{excelCost.toLocaleString()}원
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, color: diffCost > 0 ? '#dc2626' : diffCost < 0 ? '#16a34a' : 'var(--text-muted)' }}>
                          {diffCost > 0 ? `+₩${diffCost.toLocaleString()}` : diffCost < 0 ? `-₩${Math.abs(diffCost).toLocaleString()}` : '0원'}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          {currentStatus === 'MATCHED' && (
                            <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, backgroundColor: 'rgba(34,197,94,0.15)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)' }}>
                              🟢 대사일치
                            </span>
                          )}
                          {currentStatus === 'MISMATCH' && (
                            <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, backgroundColor: 'rgba(234,179,8,0.15)', color: '#ca8a04', border: '1px solid rgba(234,179,8,0.3)' }}>
                              🟡 금액불일치
                            </span>
                          )}
                          {currentStatus === 'PAYMENT_REQUESTED' && (
                            <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, backgroundColor: 'rgba(59,130,246,0.15)', color: '#2563eb', border: '1px solid rgba(59,130,246,0.3)' }}>
                              💳 지급요청완료
                            </span>
                          )}
                          {currentStatus === 'PENDING' && (
                            <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, backgroundColor: 'var(--bg-body)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                              ⚪ 대사대기
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 8px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                          {localState?.memo || d.memo || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
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
    </div>
  );
};
