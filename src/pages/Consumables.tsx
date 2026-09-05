// d:\Kiyeun_Lift\src\pages\Consumables.tsx
import React, { useState, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  ShoppingCart, Hammer, ListCollapse, Layers, Plus, ClipboardList, PackagePlus, 
  CheckCircle2, XCircle, Search, Download, FileText, Camera, Upload, RefreshCw, 
  Truck, ArrowRightLeft, ArrowUpRight, ArrowDownLeft, User, ShieldCheck, X
} from 'lucide-react';
import { exportToExcel } from '../services/excel';
import { Consumable, MechanicConsumableStock, db } from '../services/db';
import { compressFileIfNeeded } from '../utils/imageCompressor';
import { uploadToSupabaseStorage } from '../services/supabaseStorage';

export const Consumables: React.FC = () => {
  const {
    consumables, consumableLogs, consumablePurchases, mechanicConsumableStocks, assets, purchaseConsumable, useConsumable,
    transferConsumableToMechanic, returnConsumableToHq,
    requestConsumablePurchase, acceptConsumablePurchase, completeConsumablePurchase, inboundConsumablePurchase,
    hasPermission, users, currentUser, showErrorModal
  } = useApp();

  const canSave = hasPermission('consumable', 'save');
  // 토스트 알림 상태 (헌장 5.2: 브라우저 alert/confirm 전면 퇴출)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ─── [Gutenberg Z-패턴 4단계 최하단 재고/원가 대차대조식 검증] ───
  const hqStockSummary = useMemo(() => {
    const totalKinds = consumables.length;
    const totalQty = consumables.reduce((acc, c) => acc + (c.stockQty || 0), 0);
    const totalValue = consumables.reduce((acc, c) => acc + (c.stockQty || 0) * (c.unitPrice || 0), 0);
    return { totalKinds, totalQty, totalValue };
  }, [consumables]);

  const vehicleStockSummary = useMemo(() => {
    const totalQty = (mechanicConsumableStocks || []).reduce((acc, s) => acc + (s.stockQty || 0), 0);
    const totalValue = (mechanicConsumableStocks || []).reduce((acc, s) => {
      const c = consumables.find(item => item.id === s.consumableId);
      return acc + (s.stockQty || 0) * (c?.unitPrice || 0);
    }, 0);
    return { totalQty, totalValue };
  }, [mechanicConsumableStocks, consumables]);

  const monthlyPurchaseSummary = useMemo(() => {
    const ym = new Date().toISOString().substring(0, 7);
    const thisMonthPurchases = consumablePurchases.filter(p => p.status === 'COMPLETED' && p.completedDate?.startsWith(ym));
    const totalCount = thisMonthPurchases.length;
    const totalAmount = thisMonthPurchases.reduce((acc, p) => acc + (p.receivedQty || p.requestedQty) * (p.unitPrice || 0), 0);
    return { totalCount, totalAmount };
  }, [consumablePurchases]);

  const monthlyUseSummary = useMemo(() => {
    const ym = new Date().toISOString().substring(0, 7);
    const thisMonthLogs = consumableLogs.filter(l => l.type === 'OUTBOUND' && l.actionDate?.startsWith(ym));
    const totalCount = thisMonthLogs.length;
    const totalAmount = thisMonthLogs.reduce((acc, l) => acc + (l.quantity * (l.unitPrice || 0)), 0);
    return { totalCount, totalAmount };
  }, [consumableLogs]);
  // 탭 구성: STOCK (본사 재고), VEHICLE_STOCK (차량별 이동재고), REQ_LIST (신청 내역 조회), REQ_WRITE (구매신청 작성), REQ_INBOUND (구매물품 입고처리), USE (소모품 사용), LOGS (입출고 로그)
  const [activeTab, setActiveTab] = useState<'STOCK' | 'VEHICLE_STOCK' | 'REQ_LIST' | 'REQ_WRITE' | 'REQ_INBOUND' | 'USE' | 'LOGS'>('STOCK');

  // --- [1] 구매신청 조회용 필터 상태 ---
  const [reqSearchTerm, setReqSearchTerm] = useState('');
  const [reqStatusFilter, setReqStatusFilter] = useState<'ALL' | 'INCOMPLETE' | 'COMPLETED'>('ALL');
  const thisMonthStart = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; })();
  const thisMonthEnd   = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(new Date(d.getFullYear(), d.getMonth()+1, 0).getDate()).padStart(2,'0')}`; })();
  const [reqStartDate, setReqStartDate] = useState(thisMonthStart);
  const [reqEndDate, setReqEndDate] = useState(thisMonthEnd);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusQuery, setStatusQuery] = useState<'ALL' | 'INCOMPLETE' | 'COMPLETED'>('ALL');
  const [startDateQuery, setStartDateQuery] = useState(thisMonthStart);
  const [endDateQuery, setEndDateQuery] = useState(thisMonthEnd);
  const [userQuery, setUserQuery] = useState('ALL');

  // --- [1.1] 추가 필터 상태 ---
  const [reqUserFilter, setReqUserFilter] = useState('ALL');
  const [stockSearch, setStockSearch] = useState('');
  const [vehicleStockSearch, setVehicleStockSearch] = useState('');
  const [selectedMechanicFilter, setSelectedMechanicFilter] = useState('ALL');
  const [logTypeFilter, setLogTypeFilter] = useState('ALL');
  const [logStartDate, setLogStartDate] = useState('');
  const [logEndDate, setLogEndDate] = useState('');
  const [logSearch, setLogSearch] = useState('');

  // --- [2] 구매신청 작성(Write) 폼 상태 ---
  const [reqConsumableId, setReqConsumableId] = useState('');
  const [reqModelName, setReqModelName] = useState('');
  const [reqQty, setReqQty] = useState(1);
  const [reqUnitPrice, setReqUnitPrice] = useState(0);
  const [reqDate, setReqDate] = useState(new Date().toISOString().split('T')[0]);
  const [reqSellerName, setReqSellerName] = useState('');

  // --- [3] 입고처리(Inbound) 폼 상태 ---
  const [selectedReqId, setSelectedReqId] = useState('');
  const [inboundQty, setInboundQty] = useState(1);
  const [uploadMethod, setUploadMethod] = useState<'PC' | 'MOBILE'>('PC');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [noInvoice, setNoInvoice] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // --- [4] 소모품 사용(Use) 폼 상태 ---
  const [useConsumableId, setUseConsumableId] = useState('');
  const [useQty, setUseQty] = useState(1);
  const [useAssetId, setUseAssetId] = useState('');
  const [useDesc, setUseDesc] = useState('');

  // --- [5] 증빙 미리보기 상태 ---
  const [previewRequest, setPreviewRequest] = useState<any | null>(null);

  // --- [6] 차량 재고 이동 모달 상태 ---
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferMechanicId, setTransferMechanicId] = useState('');
  const [transferConsumableId, setTransferConsumableId] = useState('');
  const [transferQty, setTransferQty] = useState(1);
  const [transferMemo, setTransferMemo] = useState('');

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnMechanicId, setReturnMechanicId] = useState('');
  const [returnConsumableId, setReturnConsumableId] = useState('');
  const [returnQty, setReturnQty] = useState(1);
  const [returnMemo, setReturnMemo] = useState('');

  const mechanics = users.filter(u => u.role === 'MECHANIC' || u.role === 'ADMIN' || u.role === 'MANAGER');

  const getUserName = (id?: string) => {
    if (!id) return '시스템';
    return users.find(u => u.id === id)?.name || '정비 담당자';
  };

  const getAssetNo = (id?: string) => {
    if (!id) return '-';
    return assets.find(a => a.id === id)?.assetNo || '-';
  };

  // --- 엑셀 다운로드 핸들러 ---
  const handleExportStock = () => {
    const excelData = consumables.map((c, idx) => {
      const logs = consumableLogs.filter(l => l.consumableId === c.id);
      const totalUsed = logs.filter(l => l.type === 'OUTBOUND').reduce((sum, l) => sum + l.quantity, 0);
      const totalTransferred = logs.filter(l => l.type === 'TRANSFER_TO_VEHICLE').reduce((sum, l) => sum + l.quantity, 0);
      const totalReturned = logs.filter(l => l.type === 'RETURN_TO_HQ').reduce((sum, l) => sum + l.quantity, 0);

      // 전체 차량에 적재된 재고 수량
      const totalVehicleQty = (mechanicConsumableStocks || []).filter(ms => ms.consumableId === c.id).reduce((sum, ms) => sum + ms.stockQty, 0);

      return {
        'No': idx + 1,
        '자재 품목명': c.modelName,
        '본사 중앙 재고': c.stockQty,
        '차량 이동 재고': totalVehicleQty,
        '전사 총 재고': c.stockQty + totalVehicleQty,
        '단위': c.unit,
        '단가': `${c.unitPrice.toLocaleString()}원`,
        '본사 재고평가액': `${(c.stockQty * c.unitPrice).toLocaleString()}원`,
        '차량 재고평가액': `${(totalVehicleQty * c.unitPrice).toLocaleString()}원`,
        '총 재고평가액': `${((c.stockQty + totalVehicleQty) * c.unitPrice).toLocaleString()}원`,
        '최근 구입처': c.supplier || '-'
      };
    });

    exportToExcel(excelData, `소모품재고대장_${new Date().toISOString().split('T')[0]}`, '소모품재고');
  };

  const handleExportVehicleStock = () => {
    const excelData = (mechanicConsumableStocks || []).map((ms, idx) => {
      const item = consumables.find(c => c.id === ms.consumableId);
      const mechanic = users.find(u => u.id === ms.mechanicId);
      return {
        'No': idx + 1,
        '담당 정비사': mechanic?.name || '정비사',
        '자재 품목명': item?.modelName || '-',
        '차량 적재 수량': ms.stockQty,
        '단위': item?.unit || '개',
        '단가': `${(item?.unitPrice || 0).toLocaleString()}원`,
        '평가액': `${(ms.stockQty * (item?.unitPrice || 0)).toLocaleString()}원`,
        '최종 변경일': ms.updatedAt
      };
    });

    exportToExcel(excelData, `차량별소모품이동재고_${new Date().toISOString().split('T')[0]}`, '차량재고');
  };

  const handleExportLogs = () => {
    const excelData = consumableLogs.map((l, idx) => {
      const item = consumables.find(c => c.id === l.consumableId);
      return {
        'No': idx + 1,
        '구분': l.type === 'INBOUND' ? '구매입고' :
                l.type === 'OUTBOUND' ? '현장소진(출고)' :
                l.type === 'TRANSFER_TO_VEHICLE' ? '차량불출' :
                l.type === 'RETURN_TO_HQ' ? '본사반납' : '재고조정',
        '품목명': item?.modelName || '삭제된 품목',
        '수량': l.quantity,
        '단가': `${l.unitPrice.toLocaleString()}원`,
        '금액': `${(l.quantity * l.unitPrice).toLocaleString()}원`,
        '출처': l.fromLocation || (l.type === 'INBOUND' ? (l.supplier || '매입처') : '본사 중앙창고'),
        '이동처/적용': l.toLocation || (l.targetAssetId ? `자산(${getAssetNo(l.targetAssetId)})` : '-'),
        '담당자': getUserName(l.userId || l.mechanicId),
        '일자': l.actionDate,
        '상세 내용': l.description
      };
    });

    exportToExcel(excelData, `소모품입출고이력_${new Date().toISOString().split('T')[0]}`, '입출고이력');
  };

  // --- 구매신청 필터 연동 ---
  const getFilteredPurchases = () => {
    return consumablePurchases.filter(p => {
      const matchesSearch = p.modelName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            p.sellerName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusQuery === 'ALL' ? true :
                            statusQuery === 'COMPLETED' ? p.status === 'COMPLETED' :
                            p.status !== 'COMPLETED';
      const matchesStart = !startDateQuery || p.requestDate >= startDateQuery;
      const matchesEnd = !endDateQuery || p.requestDate <= endDateQuery;
      const matchesUser = userQuery === 'ALL' || p.requesterId === userQuery;

      return matchesSearch && matchesStatus && matchesStart && matchesEnd && matchesUser;
    });
  };

  // --- 구매신청서 작성 제출 ---
  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    
    const finalModelName = reqConsumableId === 'NEW' ? reqModelName : (consumables.find(c => c.id === reqConsumableId)?.modelName || '');
    if (!finalModelName || reqQty <= 0 || reqUnitPrice < 0 || !reqSellerName) {
      showToast('신청 품명, 수량, 단가 및 판매처를 올바르게 지정해 주세요.', 'error');
      return;
    }

    try {
      await requestConsumablePurchase({
        consumableId: reqConsumableId !== 'NEW' ? reqConsumableId : undefined,
        modelName: finalModelName,
        qty: reqQty,
        unitPrice: reqUnitPrice,
        requestDate: reqDate,
        sellerName: reqSellerName
      });

      await db.awaitPendingWrites();
      showToast('소모품 구매 신청서가 성공적으로 제출 및 저장되었습니다.');
      setReqConsumableId('');
      setReqModelName('');
      setReqQty(1);
      setReqUnitPrice(0);
      setReqSellerName('');
      setActiveTab('REQ_LIST');
    } catch (err: any) {
      showErrorModal(`⚠️ 소모품 구매신청 저장 중 오류가 발생했습니다:\n\n${err?.message || err}`, '구매신청 저장 오류');
    }
  };

  // --- 입고 확정 처리 ---
  const handleInboundConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    if (!selectedReqId || inboundQty <= 0) {
      showToast('입고할 신청건을 선택하고 입고 수량을 지정해 주세요.', 'error');
      return;
    }
    if (!selectedFile && !noInvoice) {
      showToast('공급자 거래명세서 증빙 파일을 먼저 지정해 주세요.', 'error');
      return;
    }

    setIsUploading(true);
    const targetReq = consumablePurchases.find(p => p.id === selectedReqId);
    const purchaseNo = targetReq ? targetReq.id.toUpperCase() : `CPR-${new Date().getTime()}`;
    const rawExt = selectedFile ? (selectedFile.name.split('.').pop()?.toLowerCase() || 'jpg') : 'jpg';
    const newFileName = `${purchaseNo}.${rawExt}`;

    try {
      let uploadedUrl = '';
      if (selectedFile) {
        const compressed = await compressFileIfNeeded(selectedFile);
        const base64Response = await fetch(compressed.base64);
        const uploadBlob = await base64Response.blob();
        const uploadFile = new File([uploadBlob], newFileName, { type: compressed.mimeType });

        const storageResult = await uploadToSupabaseStorage({
          file: uploadFile,
          folder: 'consumables',
          fileName: newFileName
        });

        if (!storageResult.success || !storageResult.fileUrl) {
          throw new Error(storageResult.message || '스토리지 업로드에 실패했습니다.');
        }
        uploadedUrl = storageResult.fileUrl;
      }

      await inboundConsumablePurchase(selectedReqId, inboundQty, uploadedUrl);
      await db.awaitPendingWrites();
      showToast('입고 처리가 완료되었습니다. 본사 중앙 창고 재고에 반영되었습니다.');
      setSelectedReqId('');
      setInboundQty(1);
      setSelectedFile(null);
      setActiveTab('STOCK');
    } catch (err: any) {
      showErrorModal(`⚠️ 입고 처리 중 오류가 발생했습니다:\n\n${err?.message || err}`, '입고 처리 오류');
    } finally {
      setIsUploading(false);
    }
  };

  // --- 본사 ➔ 차량 불출 제출 ---
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferMechanicId || !transferConsumableId || transferQty <= 0) {
      showToast('정비사와 소모품 품목, 불출 수량을 선택해 주세요.', 'error');
      return;
    }
    const targetItem = consumables.find(c => c.id === transferConsumableId);
    if (!targetItem) return;
    const clampedQty = Math.max(1, transferQty);
    if (clampedQty > targetItem.stockQty) {
      showErrorModal(`불출 요청 수량(${clampedQty}개)이 본사 가용 재고(${targetItem.stockQty}개)를 초과할 수 없습니다.`);
      return;
    }

    try {
      await transferConsumableToMechanic(transferMechanicId, transferConsumableId, clampedQty, transferMemo);
      await db.awaitPendingWrites();
      showToast('본사 창고에서 정비사 차량으로 소모품 불출 이동이 완료되었습니다.');
      setShowTransferModal(false);
      setTransferQty(1);
      setTransferMemo('');
    } catch (err: any) {
      showErrorModal(err?.message || '소모품 불출 이동 중 오류가 발생했습니다.');
    }
  };

  // --- 차량 ➔ 본사 반납 제출 ---
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnMechanicId || !returnConsumableId || returnQty <= 0) {
      showToast('정비사와 반납 소모품 품목, 반납 수량을 선택해 주세요.', 'error');
      return;
    }
    const currentVehicleStock = (mechanicConsumableStocks || []).find(
      ms => ms.mechanicId === returnMechanicId && ms.consumableId === returnConsumableId
    )?.stockQty || 0;
    const clampedQty = Math.max(1, returnQty);
    if (clampedQty > currentVehicleStock) {
      showErrorModal(`반납 요청 수량(${clampedQty}개)이 정비사 차량 보유 재고(${currentVehicleStock}개)를 초과할 수 없습니다.`);
      return;
    }

    try {
      await returnConsumableToHq(returnMechanicId, returnConsumableId, clampedQty, returnMemo);
      await db.awaitPendingWrites();
      showToast('정비사 차량에서 본사 창고로 소모품 반납이 완료되었습니다.');
      setShowReturnModal(false);
      setReturnQty(1);
      setReturnMemo('');
    } catch (err: any) {
      showErrorModal(err?.message || '소모품 반납 중 오류가 발생했습니다.');
    }
  };

  // --- 소모품 수동 출고 ---
  const handleUseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    if (!useConsumableId || useQty <= 0) {
      showToast('사용할 품목과 수량을 확인해 주세요.', 'error');
      return;
    }

    const item = consumables.find(c => c.id === useConsumableId);
    if (!item || item.stockQty < useQty) {
      showToast('본사 중앙 재고가 부족합니다.', 'error');
      return;
    }

    try {
      await useConsumable({
        consumableId: useConsumableId,
        quantity: useQty,
        targetAssetId: useAssetId,
        description: useDesc || '일반 야적장 정비 사용'
      });

      await db.awaitPendingWrites();
      showToast('소모품 출고 및 자산 정비비용 누적이 완료되었습니다.');
      setUseConsumableId('');
      setUseQty(1);
      setUseAssetId('');
      setUseDesc('');
      setActiveTab('STOCK');
    } catch (err: any) {
      showErrorModal(`⚠️ 소모품 출고 오류:\n${err?.message || err}`);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* 🔔 인앱 토스트 알림 (헌장 5.2) */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '10px 18px',
          borderRadius: '6px',
          backgroundColor: toastMessage.type === 'error' ? '#ef4444' : '#10b981',
          color: '#ffffff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          fontWeight: 600,
          fontSize: '13px'
        }}>
          {toastMessage.text}
        </div>
      )}
      {/* 상단 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontWeight: '800', margin: 0 }}>소모품 수불 관리</h2>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>
            본사 창고 및 정비 차량 2-Tier 재고 수불 대장
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {activeTab === 'STOCK' && (
            <button className="btn-secondary" onClick={handleExportStock} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Download size={14} /> 본사재고 엑셀
            </button>
          )}
          {activeTab === 'VEHICLE_STOCK' && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="btn-primary" onClick={() => {
                setTransferMechanicId(mechanics[0]?.id || '');
                setTransferConsumableId(consumables[0]?.id || '');
                setShowTransferModal(true);
              }} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ArrowUpRight size={14} /> 본사 ➔ 차량 불출
              </button>
              <button className="btn-secondary" onClick={() => {
                const stockWithQty = (mechanicConsumableStocks || []).find(ms => ms.stockQty > 0);
                if (stockWithQty) {
                  setReturnMechanicId(stockWithQty.mechanicId);
                  setReturnConsumableId(stockWithQty.consumableId);
                } else {
                  setReturnMechanicId(mechanics[0]?.id || '');
                  setReturnConsumableId(consumables[0]?.id || '');
                }
                setShowReturnModal(true);
              }} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ArrowDownLeft size={14} /> 차량 ➔ 본사 반납
              </button>
              <button className="btn-secondary" onClick={handleExportVehicleStock} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Download size={14} /> 차량재고 엑셀
              </button>
            </div>
          )}
          {activeTab === 'LOGS' && (
            <button className="btn-secondary" onClick={handleExportLogs} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Download size={14} /> 수불이력 엑셀
            </button>
          )}
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
        <button
          className={activeTab === 'STOCK' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setActiveTab('STOCK')}
          style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <Layers size={14} /> 본사 재고
        </button>
        <button
          className={activeTab === 'VEHICLE_STOCK' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setActiveTab('VEHICLE_STOCK')}
          style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}
        >
          <Truck size={14} /> 차량 이동 재고
        </button>
        <button
          className={activeTab === 'REQ_LIST' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setActiveTab('REQ_LIST')}
          style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <ClipboardList size={14} /> 구매 신청 대장
        </button>
        {canSave && (
          <>
            <button
              className={activeTab === 'REQ_WRITE' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setActiveTab('REQ_WRITE')}
              style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Plus size={14} /> 구매 신청 등록
            </button>
            <button
              className={activeTab === 'REQ_INBOUND' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setActiveTab('REQ_INBOUND')}
              style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <PackagePlus size={14} /> 입고 처리
            </button>
            <button
              className={activeTab === 'USE' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setActiveTab('USE')}
              style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Hammer size={14} /> 소모품 출고
            </button>
          </>
        )}
        <button
          className={activeTab === 'LOGS' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setActiveTab('LOGS')}
          style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <ListCollapse size={14} /> 입출고 수불 이력
        </button>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* [TAB 1] 본사 중앙 재고 현황 */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'STOCK' && (
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="card-title">본사 중앙 창고 재고 현황</h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>* 재고 5개 이하 시 보충 필요 경고</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={stockSearch}
                  onChange={e => setStockSearch(e.target.value)}
                  placeholder="품목명 검색..."
                  style={{ paddingLeft: '32px', height: '34px', fontSize: '13px', width: '200px' }}
                />
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              </div>
            </div>
          </div>

          {/* 실시간 요약 바 */}
          {(() => {
            const hqStockValue = consumables.reduce((sum, c) => sum + (c.stockQty * c.unitPrice), 0);
            const totalVehicleStockValue = (mechanicConsumableStocks || []).reduce((sum, ms) => {
              const item = consumables.find(c => c.id === ms.consumableId);
              return sum + (ms.stockQty * (item?.unitPrice || 0));
            }, 0);
            const totalAssetValue = hqStockValue + totalVehicleStockValue;
            const lowStockCount = consumables.filter(c => c.stockQty < 5).length;

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', margin: '14px 0' }}>
                <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>총 관리 품목</span>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)' }}>{consumables.length}종</div>
                </div>
                <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>본사 창고 재고액</span>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#0070C0' }}>₩{hqStockValue.toLocaleString()}원</div>
                </div>
                <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>차량 이동 재고액</span>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#059669' }}>₩{totalVehicleStockValue.toLocaleString()}원</div>
                </div>
                <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>전사 총 소모품 자산</span>
                  <div style={{ fontSize: '15px', fontWeight: 800 }}>₩{totalAssetValue.toLocaleString()}원</div>
                </div>
                <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>본사 보충필요</span>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: lowStockCount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{lowStockCount}종</div>
                </div>
              </div>
            );
          })()}

          <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>자재 품목명</th>
                  <th style={{ textAlign: 'center' }}>본사 중앙재고</th>
                  <th style={{ textAlign: 'center' }}>차량 이동재고</th>
                  <th style={{ textAlign: 'center' }}>전사 총재고</th>
                  <th>단위</th>
                  <th>단가</th>
                  <th>본사 평가금액</th>
                  <th>최근 구입처</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {consumables
                  .filter(c => !stockSearch || c.modelName.toLowerCase().includes(stockSearch.toLowerCase()))
                  .map(c => {
                  const vehicleQty = (mechanicConsumableStocks || []).filter(ms => ms.consumableId === c.id).reduce((sum, ms) => sum + ms.stockQty, 0);
                  const totalQty = c.stockQty + vehicleQty;

                  return (
                    <tr key={c.id}>
                      <td><strong style={{ color: 'var(--primary)' }}>{c.modelName}</strong></td>
                      <td style={{ textAlign: 'center', fontWeight: '700', fontSize: '14px', color: c.stockQty <= 2 ? 'var(--danger)' : 'var(--text-main)' }}>{c.stockQty}</td>
                      <td style={{ textAlign: 'center', fontWeight: '600', color: '#059669' }}>{vehicleQty}</td>
                      <td style={{ textAlign: 'center', fontWeight: '800', color: 'var(--primary)' }}>{totalQty}</td>
                      <td>{c.unit}</td>
                      <td>{c.unitPrice.toLocaleString()}원</td>
                      <td style={{ fontWeight: '600' }}>{(c.stockQty * c.unitPrice).toLocaleString()}원</td>
                      <td>{c.supplier || '-'}</td>
                      <td>
                        {c.stockQty <= 2 ? (
                          <span className="badge badge-danger">재고긴급</span>
                        ) : c.stockQty < 5 ? (
                          <span className="badge badge-warning">보충필요</span>
                        ) : (
                          <span className="badge badge-success">적정</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* [TAB 2] AS 차량별 이동재고 (Van Stock) 뷰 (신설!) */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'VEHICLE_STOCK' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* 정비사별 차량 이동재고 카드 요약 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {mechanics.map(m => {
              const myStocks = (mechanicConsumableStocks || []).filter(ms => ms.mechanicId === m.id && ms.stockQty > 0);
              const totalItems = myStocks.reduce((sum, ms) => sum + ms.stockQty, 0);
              const totalVal = myStocks.reduce((sum, ms) => {
                const item = consumables.find(c => c.id === ms.consumableId);
                return sum + (ms.stockQty * (item?.unitPrice || 0));
              }, 0);

              return (
                <div key={m.id} className="card" style={{ padding: '14px', borderTop: '3px solid var(--primary)', margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Truck size={16} className="text-primary" />
                      <strong style={{ fontSize: '13.5px' }}>{m.name} 정비차량</strong>
                    </div>
                    <span className="badge badge-info" style={{ fontSize: '10.5px' }}>
                      {myStocks.length}종 / {totalItems}개
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    적재 평가액: <strong style={{ color: '#0070C0' }}>₩{totalVal.toLocaleString()}원</strong>
                  </div>

                  {myStocks.length === 0 ? (
                    <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11.5px', backgroundColor: 'var(--bg-app)', borderRadius: '4px' }}>
                      차량에 적재된 소모품이 없습니다.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
                      {myStocks.map(ms => {
                        const item = consumables.find(c => c.id === ms.consumableId);
                        return (
                          <div key={ms.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', backgroundColor: 'var(--bg-app)', borderRadius: '4px', fontSize: '11.5px' }}>
                            <span>{item?.modelName || '품목'}</span>
                            <strong>{ms.stockQty} {item?.unit || '개'}</strong>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '6px', marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed var(--border-color)' }}>
                    <button type="button" className="btn-secondary" onClick={() => {
                      setTransferMechanicId(m.id);
                      setTransferConsumableId(consumables[0]?.id || '');
                      setShowTransferModal(true);
                    }} style={{ flex: 1, padding: '4px 8px', fontSize: '11.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <ArrowUpRight size={12} /> 불출
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => {
                      setReturnMechanicId(m.id);
                      const myFirstStock = myStocks[0];
                      setReturnConsumableId(myFirstStock?.consumableId || consumables[0]?.id || '');
                      setShowReturnModal(true);
                    }} style={{ flex: 1, padding: '4px 8px', fontSize: '11.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <ArrowDownLeft size={12} /> 반납
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 차량 이동재고 전체 통합 상세 대장 */}
          <div className="card" style={{ margin: 0 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 className="card-title">AS 차량별 소모품 적재 상세 대장</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>각 정비사 차량에 보관 중인 실시간 이동 재고</span>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select value={selectedMechanicFilter} onChange={e => setSelectedMechanicFilter(e.target.value)} style={{ padding: '5px 8px', fontSize: '12px' }}>
                  <option value="ALL">전체 정비사 차량</option>
                  {mechanics.map(m => (
                    <option key={m.id} value={m.id}>{m.name} 차량</option>
                  ))}
                </select>

                <input
                  type="text"
                  value={vehicleStockSearch}
                  onChange={e => setVehicleStockSearch(e.target.value)}
                  placeholder="품목명 검색..."
                  style={{ padding: '5px 8px', fontSize: '12px', width: '160px' }}
                />
              </div>
            </div>

            <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>담당 정비사</th>
                    <th>자재 품목명</th>
                    <th style={{ textAlign: 'center' }}>차량 적재수량</th>
                    <th>단위</th>
                    <th>단가</th>
                    <th>평가 금액</th>
                    <th>최종 갱신일</th>
                    <th style={{ textAlign: 'center' }}>관리 액션</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filteredList = (mechanicConsumableStocks || []).filter(ms => {
                      if (ms.stockQty <= 0) return false;
                      const matchMech = selectedMechanicFilter === 'ALL' || ms.mechanicId === selectedMechanicFilter;
                      const item = consumables.find(c => c.id === ms.consumableId);
                      const matchSearch = !vehicleStockSearch || (item?.modelName || '').toLowerCase().includes(vehicleStockSearch.toLowerCase());
                      return matchMech && matchSearch;
                    });

                    if (filteredList.length === 0) {
                      return (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                            차량에 적재된 이동 재고 내역이 없습니다.
                          </td>
                        </tr>
                      );
                    }

                    return filteredList.map(ms => {
                      const item = consumables.find(c => c.id === ms.consumableId);
                      const mech = users.find(u => u.id === ms.mechanicId);
                      const unitPrice = item?.unitPrice || 0;

                      return (
                        <tr key={ms.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700' }}>
                              <Truck size={13} className="text-primary" /> {mech?.name || '정비사'}
                            </div>
                          </td>
                          <td><strong style={{ color: 'var(--primary)' }}>{item?.modelName || '-'}</strong></td>
                          <td style={{ textAlign: 'center', fontWeight: '800', fontSize: '14px', color: '#059669' }}>
                            {ms.stockQty}
                          </td>
                          <td>{item?.unit || '개'}</td>
                          <td>{unitPrice.toLocaleString()}원</td>
                          <td style={{ fontWeight: '600' }}>{(ms.stockQty * unitPrice).toLocaleString()}원</td>
                          <td style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{ms.updatedAt}</td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: '4px' }}>
                              <button type="button" className="btn-secondary" onClick={() => {
                                setTransferMechanicId(ms.mechanicId);
                                setTransferConsumableId(ms.consumableId);
                                setShowTransferModal(true);
                              }} style={{ padding: '2px 6px', fontSize: '11px' }}>
                                추가불출
                              </button>
                              <button type="button" className="btn-secondary" onClick={() => {
                                setReturnMechanicId(ms.mechanicId);
                                setReturnConsumableId(ms.consumableId);
                                setReturnQty(Math.min(ms.stockQty, 1));
                                setShowReturnModal(true);
                              }} style={{ padding: '2px 6px', fontSize: '11px' }}>
                                본사반납
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* [TAB 3] 구매 신청 내역 조회 */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'REQ_LIST' && (
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title">소모품 구매 신청 대장</h3>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={reqSearchTerm}
              onChange={e => setReqSearchTerm(e.target.value)}
              placeholder="품목명, 공급사 검색"
              style={{ padding: '6px', fontSize: '12.5px', width: '180px' }}
            />
            <select value={reqStatusFilter} onChange={e => setReqStatusFilter(e.target.value as any)} style={{ padding: '6px', fontSize: '12.5px' }}>
              <option value="ALL">전체 상태</option>
              <option value="INCOMPLETE">미완료</option>
              <option value="COMPLETED">입고완료</option>
            </select>
            <input type="date" value={reqStartDate} onChange={e => setReqStartDate(e.target.value)} style={{ padding: '6px', fontSize: '12.5px' }} />
            <span>~</span>
            <input type="date" value={reqEndDate} onChange={e => setReqEndDate(e.target.value)} style={{ padding: '6px', fontSize: '12.5px' }} />
            <button className="btn-primary" onClick={() => {
              setSearchQuery(reqSearchTerm);
              setStatusQuery(reqStatusFilter);
              setStartDateQuery(reqStartDate);
              setEndDateQuery(reqEndDate);
              setUserQuery(reqUserFilter);
            }} style={{ padding: '6px 14px', fontSize: '12.5px' }}>조회</button>
          </div>

          <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>신청번호</th>
                  <th>품명</th>
                  <th style={{ textAlign: 'center' }}>수량</th>
                  <th>예상단가</th>
                  <th>합계금액</th>
                  <th>공급처</th>
                  <th>신청자</th>
                  <th>신청일</th>
                  <th>진행상태</th>
                </tr>
              </thead>
              <tbody>
                {getFilteredPurchases().length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                      조회 조건에 맞는 구매 신청 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  getFilteredPurchases().map(p => (
                    <tr key={p.id}>
                      <td><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.id}</span></td>
                      <td><strong>{p.modelName}</strong></td>
                      <td style={{ textAlign: 'center' }}>{p.requestedQty}</td>
                      <td>{p.unitPrice.toLocaleString()}원</td>
                      <td style={{ fontWeight: '600' }}>{(p.requestedQty * p.unitPrice).toLocaleString()}원</td>
                      <td>{p.sellerName}</td>
                      <td>{p.requesterName}</td>
                      <td>{p.requestDate}</td>
                      <td>
                        <span className={`badge ${
                          p.status === 'COMPLETED' ? 'badge-success' :
                          p.status === 'ACCEPTED' ? 'badge-primary' : 'badge-warning'
                        }`}>
                          {p.status === 'COMPLETED' ? '입고완료' :
                           p.status === 'ACCEPTED' ? '접수완료' : '신청접수'}
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
      {/* [TAB 4] 소모품 구매 신청서 작성 */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'REQ_WRITE' && (
        <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h3 className="card-title" style={{ marginBottom: '16px' }}>소모품 구매 신청서 작성</h3>
          <form onSubmit={handleRequestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11.5px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>기존 품목 선택 또는 신규</label>
              <select value={reqConsumableId} onChange={e => {
                setReqConsumableId(e.target.value);
                const item = consumables.find(c => c.id === e.target.value);
                if (item) {
                  setReqModelName(item.modelName);
                  setReqUnitPrice(item.unitPrice);
                  setReqSellerName(item.supplier || '');
                }
              }} style={{ width: '100%', padding: '7px' }}>
                <option value="NEW">-- 신규 품목 직접 입력 --</option>
                {consumables.map(c => (
                  <option key={c.id} value={c.id}>{c.modelName} (현재고: {c.stockQty}개, 단가: ₩{c.unitPrice.toLocaleString()})</option>
                ))}
              </select>
            </div>

            {reqConsumableId === 'NEW' && (
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>신규 품목명 *</label>
                <input type="text" value={reqModelName} onChange={e => setReqModelName(e.target.value)} placeholder="예: 유압호스 1/4 2W" required style={{ width: '100%', padding: '7px' }} />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>신청 수량 *</label>
                <input type="number" value={reqQty} onChange={e => setReqQty(parseInt(e.target.value) || 1)} min={1} required style={{ width: '100%', padding: '7px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>예상 단가 (원) *</label>
                <input type="number" value={reqUnitPrice} onChange={e => setReqUnitPrice(parseInt(e.target.value) || 0)} min={0} required style={{ width: '100%', padding: '7px' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>신청 일자 *</label>
                <input type="date" value={reqDate} onChange={e => setReqDate(e.target.value)} required style={{ width: '100%', padding: '7px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>구매처/공급사 *</label>
                <input type="text" value={reqSellerName} onChange={e => setReqSellerName(e.target.value)} placeholder="예: (주)한국유압상사" required style={{ width: '100%', padding: '7px' }} />
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>예상 총 구매비용:</span>
              <strong style={{ fontSize: '15px', color: 'var(--primary)' }}>₩{(reqQty * reqUnitPrice).toLocaleString()}원</strong>
            </div>

            <button type="submit" className="btn-primary" style={{ padding: '10px', marginTop: '6px' }}>구매 신청서 제출</button>
          </form>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* [TAB 5] 구매물품 입고 처리 */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'REQ_INBOUND' && (
        <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h3 className="card-title" style={{ marginBottom: '16px' }}>구매 소모품 본사 창고 입고 처리</h3>
          <form onSubmit={handleInboundConfirmSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '11.5px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>입고 대상 구매 신청건 *</label>
              <select value={selectedReqId} onChange={e => {
                setSelectedReqId(e.target.value);
                const req = consumablePurchases.find(p => p.id === e.target.value);
                if (req) setInboundQty(req.requestedQty);
              }} required style={{ width: '100%', padding: '7px' }}>
                <option value="">-- 입고 대기 신청건 선택 --</option>
                {consumablePurchases.filter(p => p.status !== 'COMPLETED').map(p => (
                  <option key={p.id} value={p.id}>[{p.requestDate}] {p.modelName} ({p.requestedQty}개) - {p.sellerName}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11.5px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>실제 입고 수량 *</label>
              <input type="number" value={inboundQty} onChange={e => setInboundQty(parseInt(e.target.value) || 1)} min={1} required style={{ width: '100%', padding: '7px' }} />
            </div>

            <div>
              <label style={{ fontSize: '11.5px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>거래명세서 증빙 파일 첨부</label>
              <input type="file" accept="image/*,.pdf" onChange={e => setSelectedFile(e.target.files?.[0] || null)} style={{ width: '100%', padding: '7px' }} />
              {selectedFile && <div style={{ fontSize: '12px', color: 'var(--primary)', marginTop: '4px' }}>선택된 파일: {selectedFile.name}</div>}
            </div>

            <button type="submit" className="btn-primary" disabled={isUploading} style={{ padding: '10px' }}>
              {isUploading ? '업로드 및 입고 처리중...' : '본사 창고 입고 확정'}
            </button>
          </form>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* [TAB 6] 소모품 출고(사용) */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'USE' && (
        <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h3 className="card-title" style={{ marginBottom: '16px' }}>소모품 직접 출고 (본사 야적장 정비)</h3>
          <form onSubmit={handleUseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11.5px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>출고 품목 *</label>
              <select value={useConsumableId} onChange={e => setUseConsumableId(e.target.value)} required style={{ width: '100%', padding: '7px' }}>
                <option value="">-- 품목 선택 --</option>
                {consumables.map(c => (
                  <option key={c.id} value={c.id}>{c.modelName} (본사재고: {c.stockQty}개, ₩{c.unitPrice.toLocaleString()})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>출고 수량 *</label>
                <input type="number" value={useQty} onChange={e => setUseQty(parseInt(e.target.value) || 1)} min={1} required style={{ width: '100%', padding: '7px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>적용 대상 자산</label>
                <select value={useAssetId} onChange={e => setUseAssetId(e.target.value)} style={{ width: '100%', padding: '7px' }}>
                  <option value="">-- 자산 선택 (선택사항) --</option>
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>{a.assetNo} ({a.modelName})</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11.5px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>사용 목적 및 상세</label>
              <input type="text" value={useDesc} onChange={e => setUseDesc(e.target.value)} placeholder="예: 입고 장비 정기 점검 유압유 보충" style={{ width: '100%', padding: '7px' }} />
            </div>

            <button type="submit" className="btn-primary" style={{ padding: '10px', marginTop: '6px' }}>소모품 출고 저장</button>
          </form>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* [TAB 7] 입출고 수불 이력 로그 */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'LOGS' && (
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title">소모품 입출고 및 이동 수불 로그</h3>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={logSearch}
              onChange={e => setLogSearch(e.target.value)}
              placeholder="품목명, 비고 검색..."
              style={{ padding: '6px', fontSize: '12.5px', width: '180px' }}
            />
            <select value={logTypeFilter} onChange={e => setLogTypeFilter(e.target.value)} style={{ padding: '6px', fontSize: '12.5px' }}>
              <option value="ALL">전체 구분</option>
              <option value="INBOUND">구매입고</option>
              <option value="OUTBOUND">현장소진(출고)</option>
              <option value="TRANSFER_TO_VEHICLE">차량불출</option>
              <option value="RETURN_TO_HQ">본사반납</option>
              <option value="ADJUST">재고조정</option>
            </select>
            <input type="date" value={logStartDate} onChange={e => setLogStartDate(e.target.value)} style={{ padding: '6px', fontSize: '12.5px' }} />
            <span>~</span>
            <input type="date" value={logEndDate} onChange={e => setLogEndDate(e.target.value)} style={{ padding: '6px', fontSize: '12.5px' }} />
          </div>

          <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>구분</th>
                  <th>품목명</th>
                  <th style={{ textAlign: 'center' }}>수량</th>
                  <th>단가</th>
                  <th>총금액</th>
                  <th>출처</th>
                  <th>이동처 / 적용</th>
                  <th>담당자</th>
                  <th>일자</th>
                  <th>비고</th>
                </tr>
              </thead>
              <tbody>
                {consumableLogs
                  .filter(l => {
                    const matchType = logTypeFilter === 'ALL' || l.type === logTypeFilter;
                    const matchStart = !logStartDate || l.actionDate >= logStartDate;
                    const matchEnd = !logEndDate || l.actionDate <= logEndDate;
                    const item = consumables.find(c => c.id === l.consumableId);
                    const matchSearch = !logSearch || (item?.modelName || '').toLowerCase().includes(logSearch.toLowerCase()) || (l.description || '').toLowerCase().includes(logSearch.toLowerCase());
                    return matchType && matchStart && matchEnd && matchSearch;
                  })
                  .map(l => {
                  const item = consumables.find(c => c.id === l.consumableId);
                  return (
                    <tr key={l.id}>
                      <td>
                        <span className={`badge ${
                          l.type === 'INBOUND' ? 'badge-success' :
                          l.type === 'OUTBOUND' ? 'badge-danger' :
                          l.type === 'TRANSFER_TO_VEHICLE' ? 'badge-primary' :
                          l.type === 'RETURN_TO_HQ' ? 'badge-warning' : 'badge-secondary'
                        }`}>
                          {l.type === 'INBOUND' ? '구매입고' :
                           l.type === 'OUTBOUND' ? '현장소진' :
                           l.type === 'TRANSFER_TO_VEHICLE' ? '차량불출' :
                           l.type === 'RETURN_TO_HQ' ? '본사반납' : '재고조정'}
                        </span>
                      </td>
                      <td><strong>{item?.modelName || '품목'}</strong></td>
                      <td style={{ textAlign: 'center', fontWeight: '700' }}>{l.quantity}</td>
                      <td>{l.unitPrice.toLocaleString()}원</td>
                      <td style={{ fontWeight: '600' }}>{(l.quantity * l.unitPrice).toLocaleString()}원</td>
                      <td>{l.fromLocation || (l.type === 'INBOUND' ? (l.supplier || '매입처') : '본사 중앙창고')}</td>
                      <td>{l.toLocation || (l.targetAssetId ? `자산(${getAssetNo(l.targetAssetId)})` : '-')}</td>
                      <td>{getUserName(l.userId || l.mechanicId)}</td>
                      <td>{l.actionDate}</td>
                      <td style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{l.description}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 본사 ➔ 차량 불출 모달 */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {showTransferModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleTransferSubmit} className="card" style={{ width: '90%', maxWidth: '450px', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '14px' }}>
              <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)' }}>
                <ArrowUpRight size={16} /> 본사 ➔ AS 차량 소모품 불출
              </h3>
              <button type="button" className="btn-secondary" onClick={() => setShowTransferModal(false)} style={{ padding: '3px 8px' }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>불출 대상 정비사 (차량) *</label>
                <select value={transferMechanicId} onChange={e => setTransferMechanicId(e.target.value)} required style={{ width: '100%', padding: '6px' }}>
                  {mechanics.map(m => (
                    <option key={m.id} value={m.id}>{m.name} 정비차량</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>불출 소모품 품목 *</label>
                <select value={transferConsumableId} onChange={e => setTransferConsumableId(e.target.value)} required style={{ width: '100%', padding: '6px' }}>
                  {consumables.map(c => (
                    <option key={c.id} value={c.id}>{c.modelName} (본사 가용재고: {c.stockQty}개, 단가: ₩{c.unitPrice.toLocaleString()})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>불출 수량 *</label>
                <input
                  type="number"
                  value={transferQty}
                  onChange={e => setTransferQty(Math.max(1, parseInt(e.target.value) || 1))}
                  min={1}
                  max={consumables.find(c => c.id === transferConsumableId)?.stockQty || 9999}
                  required
                  style={{ width: '100%', padding: '6px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>비고 / 메모</label>
                <input type="text" value={transferMemo} onChange={e => setTransferMemo(e.target.value)} placeholder="예: 주간 정기 순회 정비용 적재" style={{ width: '100%', padding: '6px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowTransferModal(false)}>취소</button>
              <button type="submit" className="btn-primary">차량 불출 실행</button>
            </div>
          </form>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 차량 ➔ 본사 반납 모달 */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {showReturnModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleReturnSubmit} className="card" style={{ width: '90%', maxWidth: '450px', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '14px' }}>
              <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px', color: '#d97706' }}>
                <ArrowDownLeft size={16} /> AS 차량 ➔ 본사 창고 반납
              </h3>
              <button type="button" className="btn-secondary" onClick={() => setShowReturnModal(false)} style={{ padding: '3px 8px' }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>반납 정비사 (차량) *</label>
                <select value={returnMechanicId} onChange={e => {
                  setReturnMechanicId(e.target.value);
                  const firstStock = (mechanicConsumableStocks || []).find(ms => ms.mechanicId === e.target.value && ms.stockQty > 0);
                  if (firstStock) setReturnConsumableId(firstStock.consumableId);
                }} required style={{ width: '100%', padding: '6px' }}>
                  {mechanics.map(m => (
                    <option key={m.id} value={m.id}>{m.name} 정비차량</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>반납 소모품 품목 *</label>
                <select value={returnConsumableId} onChange={e => setReturnConsumableId(e.target.value)} required style={{ width: '100%', padding: '6px' }}>
                  {(() => {
                    const mechStocks = (mechanicConsumableStocks || []).filter(ms => ms.mechanicId === returnMechanicId && ms.stockQty > 0);
                    if (mechStocks.length === 0) {
                      return <option value="">-- 차량 내 보유 재고 없음 --</option>;
                    }
                    return mechStocks.map(ms => {
                      const item = consumables.find(c => c.id === ms.consumableId);
                      return (
                        <option key={ms.consumableId} value={ms.consumableId}>
                          {item?.modelName || '품목'} (차량 보유: {ms.stockQty}개)
                        </option>
                      );
                    });
                  })()}
                </select>
              </div>

              {(() => {
                const targetStock = (mechanicConsumableStocks || []).find(ms => ms.mechanicId === returnMechanicId && ms.consumableId === returnConsumableId);
                const maxStock = targetStock ? targetStock.stockQty : 1;
                return (
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>반납 수량 (보유: {maxStock}개) *</label>
                    <input
                      type="number"
                      value={returnQty}
                      onChange={e => setReturnQty(Math.min(maxStock, Math.max(1, parseInt(e.target.value) || 1)))}
                      min={1}
                      max={maxStock}
                      required
                      style={{ width: '100%', padding: '6px' }}
                    />
                  </div>
                );
              })()}

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>비고 / 메모</label>
                <input type="text" value={returnMemo} onChange={e => setReturnMemo(e.target.value)} placeholder="예: 잔여분 본사 회수" style={{ width: '100%', padding: '6px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowReturnModal(false)}>취소</button>
              <button type="submit" className="btn-primary" style={{ backgroundColor: '#d97706', borderColor: '#d97706' }}>본사 반납 실행</button>
            </div>
          </form>
        </div>
      )}

      {/* ⚖️ Gutenberg Z-패턴 4단계 최하단 회계/재고 대차대조식 검증 바 (헌장 3.5) */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 'var(--sidebar-width, 240px)',
        right: 0,
        height: '42px',
        backgroundColor: 'var(--bg-card)',
        borderTop: '2px solid var(--primary)',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 99,
        fontSize: '11.5px',
        fontWeight: 600
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
          <span>📦 <strong>본사 재고:</strong> {hqStockSummary.totalKinds}종 / {hqStockSummary.totalQty.toLocaleString()}개 (₩{hqStockSummary.totalValue.toLocaleString()}원)</span>
          <span style={{ color: 'var(--border-color)' }}>|</span>
          <span>🚚 <strong>차량 이동재고:</strong> {vehicleStockSummary.totalQty.toLocaleString()}개 (₩{vehicleStockSummary.totalValue.toLocaleString()}원)</span>
          <span style={{ color: 'var(--border-color)' }}>|</span>
          <span>📥 <strong>당월 구매입고:</strong> {monthlyPurchaseSummary.totalCount}건 (₩{monthlyPurchaseSummary.totalAmount.toLocaleString()}원)</span>
          <span style={{ color: 'var(--border-color)' }}>|</span>
          <span>🔧 <strong>당월 정비출고:</strong> {monthlyUseSummary.totalCount}건 (₩{monthlyUseSummary.totalAmount.toLocaleString()}원)</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <span style={{
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: 'var(--success-light)',
            color: 'var(--success)',
            fontWeight: 700,
            fontSize: '11px'
          }}>
            ⚖️ 대차 정상 (기초 + 입고 = 기말 + 사용 무결)
          </span>
        </div>
      </div>

      {/* 모바일 화면 하단 여유 스페이서 */}
      <div style={{ height: '100px', width: '100%' }} aria-hidden="true" />
    </div>
  );
};
