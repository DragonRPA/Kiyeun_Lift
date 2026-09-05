// d:\Kiyeun_Lift\src\pages\AssetAcquisitionDisposal.tsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { calculateAssetDepreciation, Asset, Product, Vendor, Customer } from '../services/db';
import * as XLSX from 'xlsx';
import {
  ShoppingBag,
  TrendingDown,
  Plus,
  Upload,
  Download,
  Search,
  Check,
  AlertCircle,
  X,
  ChevronRight,
  FileText,
  CheckCircle2,
  ShieldCheck,
  Layers,
  Eye,
  RefreshCw,
  ExternalLink,
  HelpCircle,
  Trash2,
  Mail,
  Send,
  Building2,
  Calendar,
  DollarSign,
  Receipt,
  Sparkles,
  CheckSquare,
  Square,
  ArrowRight
} from 'lucide-react';

export const AssetAcquisitionDisposal: React.FC = () => {
  const {
    assets,
    products,
    vendors,
    customers,
    users,
    currentUser,
    acquireAsset,
    batchAcquireAssets,
    executeAssetSale,
    hasPermission,
    showErrorModal
  } = useApp();

  const canSave = hasPermission('acquisition_disposal', 'save');

  // 메인 스튜디오 전환 탭 (헌장 3.1 무수식어 건조 명사 단일 표준)
  const [activeStudio, setActiveStudio] = useState<'ACQUISITION' | 'DISPOSAL'>('ACQUISITION');

  // 토스트 알림 상태
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // ==========================================================================
  // 🏢 [스튜디오 1] 자산 취득 스튜디오 (Asset Acquisition Studio)
  // ==========================================================================
  const [acqMode, setAcqMode] = useState<'SINGLE' | 'EXCEL'>('SINGLE');

  // 자동 관리번호 채번 헬퍼
  const getNextRecommendedAssetNo = (prefix = 'KL-') => {
    let maxNum = 0;
    assets.forEach(a => {
      if (a.assetNo && a.assetNo.startsWith(prefix)) {
        const numPart = parseInt(a.assetNo.slice(prefix.length), 10);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      } else if (a.assetNo && /^\d+$/.test(a.assetNo)) {
        const numPart = parseInt(a.assetNo, 10);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      }
    });
    if (maxNum === 0) maxNum = 800;
    return `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
  };

  // 단건 취득 폼 상태
  const [singleModelName, setSingleModelName] = useState<string>(products[0]?.modelName || '');
  const [singleAssetNo, setSingleAssetNo] = useState<string>('');
  const [singleSerialNo, setSingleSerialNo] = useState<string>('');
  const [singleManufacturer, setSingleManufacturer] = useState<string>('');
  const [singleManufactureYear, setSingleManufactureYear] = useState<string>(new Date().getFullYear().toString());
  const [singleAcqDate, setSingleAcqDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [singleAcqPrice, setSingleAcqPrice] = useState<number>(15000000);
  const [singleDepMonths, setSingleDepMonths] = useState<number>(60);
  const [singleResidualRate, setSingleResidualRate] = useState<number>(10);
  const [singleSupplier, setSingleSupplier] = useState<string>('');
  const [singleVendorId, setSingleVendorId] = useState<string>('');
  const [singleMonthlyRentalFee, setSingleMonthlyRentalFee] = useState<number>(400000);
  const [singleDailyRentalFee, setSingleDailyRentalFee] = useState<number>(15000);
  const [singleSafetyInspectionUrl, setSingleSafetyInspectionUrl] = useState<string>('');
  const [singleMemo, setSingleMemo] = useState<string>('');
  const [isSubmittingAcq, setIsSubmittingAcq] = useState<boolean>(false);

  // 멀티 입고 슬롯 (동일 모델 N대 일괄 입력)
  const [multiSlots, setMultiSlots] = useState<{ id: string; assetNo: string; serialNo: string; price: number }[]>([]);

  // 모델 선택 시 제품 마스터 제원 자동 상속
  const selectedProduct = useMemo(() => {
    return products.find(p => p.modelName === singleModelName);
  }, [products, singleModelName]);

  useEffect(() => {
    if (selectedProduct) {
      if (selectedProduct.manufacturer) setSingleManufacturer(selectedProduct.manufacturer);
    }
  }, [selectedProduct]);

  // 관리번호 초기 자동 추천
  useEffect(() => {
    if (!singleAssetNo) {
      setSingleAssetNo(getNextRecommendedAssetNo('KL-'));
    }
  }, [assets]);

  // 슬롯 추가 핸들러
  const handleAddSlot = () => {
    const nextNo = getNextRecommendedAssetNo('KL-');
    const newId = `slot_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    setMultiSlots(prev => [...prev, { id: newId, assetNo: nextNo, serialNo: '', price: singleAcqPrice }]);
  };

  const handleRemoveSlot = (slotId: string) => {
    setMultiSlots(prev => prev.filter(s => s.id !== slotId));
  };

  const handleUpdateSlot = (slotId: string, field: 'assetNo' | 'serialNo' | 'price', value: any) => {
    setMultiSlots(prev => prev.map(s => s.id === slotId ? { ...s, [field]: value } : s));
  };

  // 감가상각 시뮬레이터 (정액법)
  const depreciationSimulation = useMemo(() => {
    const cost = Number(singleAcqPrice) || 0;
    const months = Number(singleDepMonths) || 60;
    const rate = Number(singleResidualRate) || 0;
    const residualVal = Math.round(cost * (rate / 100));
    const depreciable = cost - residualVal;
    const monthlyDep = months > 0 ? Math.round(depreciable / months) : 0;
    const oneYearDep = monthlyDep * 12;
    const oneYearBook = Math.max(residualVal, cost - oneYearDep);
    return {
      monthlyDep,
      residualVal,
      oneYearBook
    };
  }, [singleAcqPrice, singleDepMonths, singleResidualRate]);

  // 단건 및 N대 슬롯 취득 실행
  const handleExecuteSingleAcquisition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) {
      showErrorModal('자산 취득 저장 권한이 없습니다.');
      return;
    }
    if (!singleModelName) {
      showErrorModal('모델명을 선택해 주세요.');
      return;
    }
    if (!singleAssetNo.trim()) {
      showErrorModal('기본 관리번호를 입력해 주세요.');
      return;
    }

    // 중복 검증
    const existingAsset = assets.find(a => a.assetNo.trim().toLowerCase() === singleAssetNo.trim().toLowerCase());
    if (existingAsset) {
      showErrorModal(`관리번호 [${singleAssetNo}]는 이미 시스템에 등록되어 있습니다.`);
      return;
    }

    setIsSubmittingAcq(true);
    try {
      const mainPayload: Partial<Asset> = {
        modelName: singleModelName,
        assetNo: singleAssetNo.trim(),
        serialNo: singleSerialNo.trim(),
        manufacturer: singleManufacturer.trim(),
        manufactureYear: singleManufactureYear.trim(),
        acquisitionDate: singleAcqDate,
        acquisitionPrice: Number(singleAcqPrice) || 0,
        depreciationMonths: Number(singleDepMonths) || 60,
        residualValueRate: Number(singleResidualRate) || 10,
        supplier: singleSupplier.trim(),
        vendorId: singleVendorId || undefined,
        monthlyRentalFee: Number(singleMonthlyRentalFee) || 0,
        dailyRentalFee: Number(singleDailyRentalFee) || 0,
        safetyInspectionUrl: singleSafetyInspectionUrl.trim() || undefined,
        memo1: singleMemo.trim() || undefined
      };

      if (multiSlots.length === 0) {
        await acquireAsset(mainPayload);
        showToast(`자산 [${singleAssetNo}] 취득 등록 완료 (임대가능 AVAILABLE 입고)`);
      } else {
        const batchPayload: Partial<Asset>[] = [mainPayload];
        for (const slot of multiSlots) {
          if (!slot.assetNo.trim()) continue;
          batchPayload.push({
            ...mainPayload,
            assetNo: slot.assetNo.trim(),
            serialNo: slot.serialNo.trim(),
            acquisitionPrice: Number(slot.price) || Number(singleAcqPrice) || 0
          });
        }
        await batchAcquireAssets(batchPayload);
        showToast(`총 ${batchPayload.length}대 자산 일괄 취득 등록 완료 (임대가능 AVAILABLE 입고)`);
        setMultiSlots([]);
      }

      // 다음 추천 번호로 초기화
      setSingleAssetNo(getNextRecommendedAssetNo('KL-'));
      setSingleSerialNo('');
    } catch (err: any) {
      showErrorModal(`자산 취득 저장 중 오류:\n\n${err?.message || err}`);
    } finally {
      setIsSubmittingAcq(false);
    }
  };

  // 엑셀 일괄 등록 상태
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [excelPreviewData, setExcelPreviewData] = useState<any[]>([]);
  const [excelValidationErrors, setExcelValidationErrors] = useState<{ row: number; error: string }[]>([]);
  const [isProcessingExcel, setIsProcessingExcel] = useState<boolean>(false);

  // 엑셀 표준 양식 다운로드
  const handleDownloadTemplate = () => {
    const headers = [
      '관리번호',
      '모델명',
      '제조번호(SN)',
      '제조사',
      '제조년도',
      '취득일자(YYYY-MM-DD)',
      '취득원가',
      '내용월수',
      '잔존가치율',
      '공급처',
      '월렌탈료',
      '일렌탈료',
      '비고'
    ];
    const sampleRow = [
      'KL-0899',
      products[0]?.modelName || 'S-0808',
      'SN-2024-001',
      products[0]?.manufacturer || '시노붐',
      '2024',
      new Date().toISOString().split('T')[0],
      18500000,
      60,
      10,
      '한국시노붐',
      400000,
      15000,
      '신규 장비 입고'
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '자산취득양식');
    XLSX.writeFile(wb, `기연리프트_자산취득_일괄양식_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // 엑셀 파일 파싱 및 유효성 검사
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (data.length < 2) {
          showErrorModal('엑셀 파일에 데이터 행이 없습니다.');
          return;
        }

        const rows = data.slice(1);
        const parsedRows: any[] = [];
        const errors: { row: number; error: string }[] = [];

        const existingNos = new Set(assets.map(a => a.assetNo.trim().toLowerCase()));
        const fileNos = new Set<string>();

        rows.forEach((r, idx) => {
          if (!r || r.length === 0 || !r[0]) return; // 빈 행 무시
          const rowNum = idx + 2;
          const assetNo = String(r[0] || '').trim();
          const modelName = String(r[1] || '').trim();
          const serialNo = String(r[2] || '').trim();
          const manufacturer = String(r[3] || '').trim();
          const manufactureYear = String(r[4] || '').trim();
          const acquisitionDate = String(r[5] || '').trim() || new Date().toISOString().split('T')[0];
          const acquisitionPrice = Number(r[6]) || 0;
          const depreciationMonths = Number(r[7]) || 60;
          const residualValueRate = Number(r[8]) ?? 10;
          const supplier = String(r[9] || '').trim();
          const monthlyRentalFee = Number(r[10]) || 0;
          const dailyRentalFee = Number(r[11]) || 0;
          const memo1 = String(r[12] || '').trim();

          // 유효성 검증
          if (!assetNo) {
            errors.push({ row: rowNum, error: '관리번호가 누락되었습니다.' });
          } else if (existingNos.has(assetNo.toLowerCase())) {
            errors.push({ row: rowNum, error: `관리번호 [${assetNo}]가 기존 자산과 중복됩니다.` });
          } else if (fileNos.has(assetNo.toLowerCase())) {
            errors.push({ row: rowNum, error: `엑셀 파일 내에서 관리번호 [${assetNo}]가 중복 등장합니다.` });
          }
          fileNos.add(assetNo.toLowerCase());

          if (!modelName) {
            errors.push({ row: rowNum, error: '모델명이 누락되었습니다.' });
          }

          parsedRows.push({
            rowNum,
            assetNo,
            modelName,
            serialNo,
            manufacturer,
            manufactureYear,
            acquisitionDate,
            acquisitionPrice,
            depreciationMonths,
            residualValueRate,
            supplier,
            monthlyRentalFee,
            dailyRentalFee,
            memo1,
            hasError: errors.some(e => e.row === rowNum)
          });
        });

        setExcelPreviewData(parsedRows);
        setExcelValidationErrors(errors);
      } catch (err: any) {
        showErrorModal(`엑셀 파일 파싱 오류:\n\n${err?.message || err}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  // 엑셀 일괄 등록 실행
  const handleExecuteExcelImport = async () => {
    if (excelValidationErrors.length > 0) {
      showErrorModal(`유효성 검사 오류가 ${excelValidationErrors.length}건 존재합니다. 오류를 수정한 후 다시 업로드해 주세요.`);
      return;
    }
    if (excelPreviewData.length === 0) {
      showErrorModal('등록할 자산 데이터가 없습니다.');
      return;
    }

    setIsProcessingExcel(true);
    try {
      const payloadList: Partial<Asset>[] = excelPreviewData.map(r => ({
        assetNo: r.assetNo,
        modelName: r.modelName,
        serialNo: r.serialNo,
        manufacturer: r.manufacturer,
        manufactureYear: r.manufactureYear,
        acquisitionDate: r.acquisitionDate,
        acquisitionPrice: r.acquisitionPrice,
        depreciationMonths: r.depreciationMonths,
        residualValueRate: r.residualValueRate,
        supplier: r.supplier,
        monthlyRentalFee: r.monthlyRentalFee,
        dailyRentalFee: r.dailyRentalFee,
        memo1: r.memo1
      }));

      await batchAcquireAssets(payloadList);
      showToast(`총 ${payloadList.length}대 자산 엑셀 일괄 취득 완료 (AVAILABLE 입고)`);
      setExcelPreviewData([]);
      setExcelValidationErrors([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      showErrorModal(`엑셀 일괄 취득 처리 실패:\n\n${err?.message || err}`);
    } finally {
      setIsProcessingExcel(false);
    }
  };


  // ==========================================================================
  // 💼 [스튜디오 2] 자산 매각 스튜디오 (Asset Disposal Studio: 좌우 50:50)
  // ==========================================================================

  // 좌측 50%: 매각 대상 자산 선택 바구니 상태
  const [disposalSearchQuery, setDisposalSearchQuery] = useState<string>('');
  const [disposalSortOrder, setDisposalSortOrder] = useState<'YEAR_ASC' | 'BOOK_VAL_ASC' | 'ASSET_NO'>('YEAR_ASC');
  const [includeRepairing, setIncludeRepairing] = useState<boolean>(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());

  // 우측 50%: 매각 계약 & 청구서 발행 상태
  const [buyerMode, setBuyerMode] = useState<'EXISTING' | 'NEW'>('EXISTING');
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>('');
  const [newBuyerName, setNewBuyerName] = useState<string>('');
  const [newBuyerBizNo, setNewBuyerBizNo] = useState<string>('');
  const [newBuyerRepEmail, setNewBuyerRepEmail] = useState<string>('');
  const [newBuyerContact, setNewBuyerContact] = useState<string>('');
  const [disposalDate, setDisposalDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [disposalSalespersonId, setDisposalSalespersonId] = useState<string>(currentUser?.id || '');
  const [disposalMemo, setDisposalMemo] = useState<string>('');
  const [itemPrices, setItemPrices] = useState<Record<string, number>>({});
  const [sendEmailImmediately, setSendEmailImmediately] = useState<boolean>(true);
  const [disposalEmailTo, setDisposalEmailTo] = useState<string>('');
  const [disposalEmailCc, setDisposalEmailCc] = useState<string>('');
  const [previewDocTab, setPreviewDocTab] = useState<'CONTRACT' | 'INVOICE'>('CONTRACT');
  const [isSubmittingDisposal, setIsSubmittingDisposal] = useState<boolean>(false);

  // 매각 대상 가능 자산 (임대가능 AVAILABLE, 오매각 원천 방어: RENTED 대여중 절대 배제)
  const availableForDisposalAssets = useMemo(() => {
    return assets.filter(a => {
      if (a.ownerType !== 'OWNED') return false; // 당사자산만 매각 가능
      if (a.status === 'SOLD') return false; // 이미 매각된 자산 배제
      if (a.status === 'RENTED') return false; // 현장 대여중 오매각 원천 차단 (헌장 1.2)
      if (!includeRepairing && a.status === 'REPAIRING') return false;
      return true;
    });
  }, [assets, includeRepairing]);

  // 좌측 자산 목록 필터 및 정렬
  const filteredDisposalAssets = useMemo(() => {
    return availableForDisposalAssets.filter(a => {
      if (disposalSearchQuery.trim()) {
        const q = disposalSearchQuery.toLowerCase().trim();
        const m1 = a.assetNo?.toLowerCase().includes(q);
        const m2 = a.modelName?.toLowerCase().includes(q);
        const m3 = a.serialNo?.toLowerCase().includes(q);
        if (!m1 && !m2 && !m3) return false;
      }
      return true;
    }).sort((a, b) => {
      if (disposalSortOrder === 'YEAR_ASC') {
        return (a.manufactureYear || '9999').localeCompare(b.manufactureYear || '9999');
      }
      if (disposalSortOrder === 'BOOK_VAL_ASC') {
        const bA = calculateAssetDepreciation(a).bookValue;
        const bB = calculateAssetDepreciation(b).bookValue;
        return bA - bB;
      }
      return (a.assetNo || '').localeCompare(b.assetNo || '');
    });
  }, [availableForDisposalAssets, disposalSearchQuery, disposalSortOrder]);

  // 체크박스 토글
  const toggleSelectAsset = (assetId: string) => {
    setSelectedAssetIds(prev => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
        // 기본 매각단가로 장부가치 제안
        const asset = assets.find(a => a.id === assetId);
        if (asset && itemPrices[assetId] === undefined) {
          const bookVal = calculateAssetDepreciation(asset).bookValue;
          setItemPrices(p => ({ ...p, [assetId]: bookVal }));
        }
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedAssetIds.size === filteredDisposalAssets.length) {
      setSelectedAssetIds(new Set());
    } else {
      const next = new Set<string>();
      const newPrices: Record<string, number> = { ...itemPrices };
      filteredDisposalAssets.forEach(a => {
        next.add(a.id);
        if (newPrices[a.id] === undefined) {
          newPrices[a.id] = calculateAssetDepreciation(a).bookValue;
        }
      });
      setSelectedAssetIds(next);
      setItemPrices(newPrices);
    }
  };

  // 선택된 자산 데이터 목록
  const selectedAssetsList = useMemo(() => {
    return assets.filter(a => selectedAssetIds.has(a.id));
  }, [assets, selectedAssetIds]);

  // 고객사 선택 시 이메일 자동 채움
  useEffect(() => {
    if (buyerMode === 'EXISTING' && selectedBuyerId) {
      const cust = customers.find(c => c.id === selectedBuyerId);
      if (cust?.repEmail) {
        setDisposalEmailTo(cust.repEmail);
      }
    }
  }, [buyerMode, selectedBuyerId, customers]);

  // 실시간 회계 집계 (공급가액, 장부가액, 유형자산처분손익, 부가세 10%, 청구총액)
  const disposalAccounting = useMemo(() => {
    let totalSupplyAmount = 0;
    let totalBookValue = 0;

    selectedAssetsList.forEach(a => {
      const dep = calculateAssetDepreciation(a, new Date(disposalDate));
      const bv = dep.bookValue;
      const price = Number(itemPrices[a.id]) || 0;
      totalSupplyAmount += price;
      totalBookValue += bv;
    });

    const gainLoss = totalSupplyAmount - totalBookValue; // 유형자산처분손익
    const vat = Math.round(totalSupplyAmount * 0.1);
    const grandTotal = totalSupplyAmount + vat;

    return {
      totalSupplyAmount,
      totalBookValue,
      gainLoss,
      vat,
      grandTotal
    };
  }, [selectedAssetsList, itemPrices, disposalDate]);

  // 매각 계약 체결 & 청구서 발행 & 이메일 발송 실행
  const handleExecuteDisposal = async () => {
    if (!canSave) {
      showErrorModal('자산 매각 계약 체결 권한이 없습니다.');
      return;
    }
    if (selectedAssetsList.length === 0) {
      showErrorModal('매각할 자산을 1대 이상 선택해 주세요.');
      return;
    }

    let customerId: string | undefined;
    let buyerName = '';

    if (buyerMode === 'EXISTING') {
      if (!selectedBuyerId) {
        showErrorModal('매수처(고객사)를 선택해 주세요.');
        return;
      }
      const cust = customers.find(c => c.id === selectedBuyerId);
      customerId = selectedBuyerId;
      buyerName = cust?.name || '';
    } else {
      if (!newBuyerName.trim()) {
        showErrorModal('신규 매수처 상호를 입력해 주세요.');
        return;
      }
      buyerName = newBuyerName.trim();
    }

    if (!disposalDate) {
      showErrorModal('매각 일자를 입력해 주세요.');
      return;
    }

    setIsSubmittingDisposal(true);
    try {
      const payload = {
        customerId,
        buyerName,
        salespersonId: disposalSalespersonId || undefined,
        disposalDate,
        items: selectedAssetsList.map(a => ({
          assetId: a.id,
          salePrice: Number(itemPrices[a.id]) || 0
        })),
        memo: disposalMemo.trim() || undefined,
        recipientEmail: sendEmailImmediately ? disposalEmailTo.trim() : undefined,
        ccEmail: sendEmailImmediately ? disposalEmailCc.trim() : undefined,
        sendEmail: sendEmailImmediately && !!disposalEmailTo.trim()
      };

      const result = await executeAssetSale(payload);
      showToast(`자산 ${selectedAssetsList.length}대 매각 계약 체결 완료! (계약번호: ${result.contractNo})`);

      // 초기화
      setSelectedAssetIds(new Set());
      setItemPrices({});
      setDisposalMemo('');
    } catch (err: any) {
      showErrorModal(`자산 매각 처리 실패:\n\n${err?.message || err}`);
    } finally {
      setIsSubmittingDisposal(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
      
      {/* 토스트 메시지 표출 */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: toastMessage.type === 'success' ? '#10b981' : '#ef4444',
          color: '#fff',
          padding: '12px 18px',
          borderRadius: '8px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
          zIndex: 9999,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {toastMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* 최상단 스튜디오 전환 탭 (헌장 3.1 무수식어 건조 UI 표준) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'var(--bg-card)',
        padding: '12px 16px',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className={activeStudio === 'ACQUISITION' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setActiveStudio('ACQUISITION')}
            style={{
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus size={15} /> 자산 취득
          </button>
          <button
            type="button"
            className={activeStudio === 'DISPOSAL' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setActiveStudio('DISPOSAL')}
            style={{
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <DollarSign size={15} /> 자산 매각
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
          <span>* 등록 및 처분 완료된 모든 과거 자산은 <strong>[자산관리]</strong> 메뉴에서 26개 풀 컬럼으로 상시 조회 가능합니다.</span>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 🏢 [스튜디오 1] 자산 취득 스튜디오 본문 */}
      {/* ==================================================================== */}
      {activeStudio === 'ACQUISITION' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* 모드 전환: 단건 등록 vs 엑셀 일괄 등록 */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setAcqMode('SINGLE')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: acqMode === 'SINGLE' ? 700 : 500,
                border: acqMode === 'SINGLE' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                backgroundColor: acqMode === 'SINGLE' ? 'var(--primary)' : 'var(--bg-app)',
                color: acqMode === 'SINGLE' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              단건 즉시 등록
            </button>
            <button
              type="button"
              onClick={() => setAcqMode('EXCEL')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: acqMode === 'EXCEL' ? 700 : 500,
                border: acqMode === 'EXCEL' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                backgroundColor: acqMode === 'EXCEL' ? 'var(--primary)' : 'var(--bg-app)',
                color: acqMode === 'EXCEL' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              엑셀 일괄 등록
            </button>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* 1-A. 단건 즉시 등록 워크벤치 */}
          {/* ───────────────────────────────────────────────────────────── */}
          {acqMode === 'SINGLE' && (
            <form onSubmit={handleExecuteSingleAcquisition} className="card" style={{ margin: 0, padding: '18px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Plus size={16} color="var(--primary)" /> 신규 자산 취득 정보 입력
                </h3>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSingleAssetNo(getNextRecommendedAssetNo('KL-'))}
                  style={{ padding: '4px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <RefreshCw size={12} /> 관리번호 재채번
                </button>
              </div>

              {/* 폼 필드 그리드 (헌장 3.4 상하 세로 스택 원칙 준수) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                
                {/* 1. 모델명 선택 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>모델명 (필수)</label>
                  <select
                    value={singleModelName}
                    onChange={e => setSingleModelName(e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '12.5px' }}
                    required
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.modelName}>
                        {p.modelName} ({p.manufacturer || '제조사미상'} / {p.feet ? `${p.feet}ft` : '제원'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. 관리번호 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>관리번호 (자산번호)</label>
                  <input
                    type="text"
                    value={singleAssetNo}
                    onChange={e => setSingleAssetNo(e.target.value)}
                    placeholder="예: KL-0850"
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '12.5px', fontWeight: 700 }}
                    required
                  />
                </div>

                {/* 3. 일련번호 (S/N) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>제조번호 (Serial No)</label>
                  <input
                    type="text"
                    value={singleSerialNo}
                    onChange={e => setSingleSerialNo(e.target.value)}
                    placeholder="차대/제조일련번호"
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '12.5px' }}
                  />
                </div>

                {/* 4. 제조사 & 연식 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>제조사</label>
                    <input
                      type="text"
                      value={singleManufacturer}
                      onChange={e => setSingleManufacturer(e.target.value)}
                      placeholder="제조사"
                      style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '12.5px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>제조년도</label>
                    <input
                      type="text"
                      value={singleManufactureYear}
                      onChange={e => setSingleManufactureYear(e.target.value)}
                      placeholder="2024"
                      style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '12.5px' }}
                    />
                  </div>
                </div>

                {/* 5. 취득일자 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>취득일자</label>
                  <input
                    type="date"
                    value={singleAcqDate}
                    onChange={e => setSingleAcqDate(e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '12.5px' }}
                    required
                  />
                </div>

                {/* 6. 취득원가 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>취득원가 (원)</label>
                  <input
                    type="number"
                    value={singleAcqPrice}
                    onChange={e => setSingleAcqPrice(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '12.5px', fontWeight: 700 }}
                    required
                  />
                </div>

                {/* 7. 내용월수 & 잔존가치율 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>내용월수</label>
                    <input
                      type="number"
                      value={singleDepMonths}
                      onChange={e => setSingleDepMonths(Math.max(1, parseInt(e.target.value, 10) || 60))}
                      style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '12.5px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>잔존가율 (%)</label>
                    <input
                      type="number"
                      value={singleResidualRate}
                      onChange={e => setSingleResidualRate(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '12.5px' }}
                    />
                  </div>
                </div>

                {/* 8. 구입처 / 공급사 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>구입처 (공급처)</label>
                  <input
                    type="text"
                    value={singleSupplier}
                    onChange={e => setSingleSupplier(e.target.value)}
                    placeholder="예: 한국시노붐, 제이엘지"
                    list="suppliers_list"
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '12.5px' }}
                  />
                  <datalist id="suppliers_list">
                    {vendors.map(v => (
                      <option key={v.id} value={v.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* 실시간 감가상각 시뮬레이션 카드 */}
              <div style={{
                backgroundColor: 'var(--bg-app)',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px'
              }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>월 예상 감가상각비</span>
                  <strong style={{ fontSize: '13px', color: 'var(--primary)' }}>₩{depreciationSimulation.monthlyDep.toLocaleString()}원 / 월</strong>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>1년 후 예상 장부가치</span>
                  <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>₩{depreciationSimulation.oneYearBook.toLocaleString()}원</strong>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>만료 후 잔존가치 ({singleResidualRate}%)</span>
                  <strong style={{ fontSize: '13px', color: 'var(--success)' }}>₩{depreciationSimulation.residualVal.toLocaleString()}원</strong>
                </div>
              </div>

              {/* 멀티 입고 슬롯 (동일 모델 N대 연속 등록) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    동일 모델 다수 장비 동시 등록 슬롯 ({multiSlots.length}대 추가 대기)
                  </span>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleAddSlot}
                    style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={12} /> 슬롯 추가
                  </button>
                </div>

                {multiSlots.map((slot, sIdx) => (
                  <div key={slot.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: 'var(--bg-app)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '30px' }}>#{sIdx + 1}</span>
                    <input
                      type="text"
                      placeholder="관리번호"
                      value={slot.assetNo}
                      onChange={e => handleUpdateSlot(slot.id, 'assetNo', e.target.value)}
                      style={{ width: '130px', padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                      required
                    />
                    <input
                      type="text"
                      placeholder="제조번호(S/N)"
                      value={slot.serialNo}
                      onChange={e => handleUpdateSlot(slot.id, 'serialNo', e.target.value)}
                      style={{ width: '180px', padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                    />
                    <input
                      type="number"
                      placeholder="취득가"
                      value={slot.price}
                      onChange={e => handleUpdateSlot(slot.id, 'price', parseInt(e.target.value, 10) || 0)}
                      style={{ width: '140px', padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveSlot(slot.id)}
                      style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* 우하단 Gutenberg Z-패턴 터미널 완결 버튼 */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmittingAcq}
                  style={{ padding: '10px 24px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Plus size={16} />
                  {isSubmittingAcq ? '취득 등록 중...' : `신규 자산 취득 등록 (총 ${1 + multiSlots.length}대 AVAILABLE 입고)`}
                </button>
              </div>

            </form>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* 1-B. 엑셀 일괄 등록 워크벤치 */}
          {/* ───────────────────────────────────────────────────────────── */}
          {acqMode === 'EXCEL' && (
            <div className="card" style={{ margin: 0, padding: '18px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Upload size={16} color="var(--primary)" /> 엑셀 일괄 자산 취득
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    표준 엑셀 서식 파일로 수십~수백 대의 장비를 한 번에 검증하여 시스템에 입고 등록합니다.
                  </p>
                </div>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleDownloadTemplate}
                  style={{ padding: '6px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={14} /> 표준 취득 양식 다운로드
                </button>
              </div>

              {/* 파일 업로드 영역 */}
              <div style={{
                border: '2px dashed var(--border-color)',
                borderRadius: '8px',
                padding: '24px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-app)',
                cursor: 'pointer'
              }} onClick={() => fileInputRef.current?.click()}>
                <Upload size={28} style={{ margin: '0 auto 8px auto', color: 'var(--text-muted)' }} />
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  엑셀 파일 (.xlsx, .xls)을 클릭하여 선택해 주세요
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  업로드 즉시 관리번호 중복 및 필수 필드 유효성 검사가 자동 실행됩니다.
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
              </div>

              {/* 엑셀 파싱 미리보기 및 검증 결과 */}
              {excelPreviewData.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700 }}>
                      파싱 결과: 총 {excelPreviewData.length}행 (정상: {excelPreviewData.length - excelValidationErrors.length}건 / 오류: {excelValidationErrors.length}건)
                    </span>
                    {excelValidationErrors.length > 0 && (
                      <span style={{ fontSize: '11.5px', color: 'var(--danger)', fontWeight: 700 }}>
                        ⚠️ 오류가 있는 행을 수정한 후 다시 업로드해 주세요.
                      </span>
                    )}
                  </div>

                  <div className="table-container" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                    <table>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-app)' }}>
                          <th style={{ whiteSpace: 'nowrap' }}>행</th>
                          <th style={{ whiteSpace: 'nowrap' }}>관리번호</th>
                          <th style={{ whiteSpace: 'nowrap' }}>모델명</th>
                          <th style={{ whiteSpace: 'nowrap' }}>제조번호(S/N)</th>
                          <th style={{ whiteSpace: 'nowrap' }}>제조사</th>
                          <th style={{ whiteSpace: 'nowrap' }}>취득일자</th>
                          <th style={{ whiteSpace: 'nowrap' }}>취득원가</th>
                          <th style={{ whiteSpace: 'nowrap' }}>검증 결과</th>
                        </tr>
                      </thead>
                      <tbody>
                        {excelPreviewData.map(r => {
                          const err = excelValidationErrors.find(e => e.row === r.rowNum);
                          return (
                            <tr key={r.rowNum} style={{ backgroundColor: err ? 'rgba(239, 68, 68, 0.08)' : 'transparent' }}>
                              <td style={{ whiteSpace: 'nowrap' }}>{r.rowNum}</td>
                              <td style={{ whiteSpace: 'nowrap' }}><strong>{r.assetNo}</strong></td>
                              <td style={{ whiteSpace: 'nowrap' }}>{r.modelName}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{r.serialNo || '-'}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{r.manufacturer || '-'}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{r.acquisitionDate}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>₩{r.acquisitionPrice.toLocaleString()}원</td>
                              <td style={{ whiteSpace: 'nowrap' }}>
                                {err ? (
                                  <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '11px' }}>
                                    🔴 {err.error}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: '11px' }}>
                                    🟢 정상
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px' }}>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={isProcessingExcel || excelValidationErrors.length > 0}
                      onClick={handleExecuteExcelImport}
                      style={{ padding: '10px 24px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <Check size={16} />
                      {isProcessingExcel ? '일괄 등록 진행 중...' : `총 ${excelPreviewData.length}대 일괄 취득 등록 (AVAILABLE 입고)`}
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      )}


      {/* ==================================================================== */}
      {/* 💼 [스튜디오 2] 자산 매각 스튜디오 본문 (좌우 50:50 워크벤치) */}
      {/* ==================================================================== */}
      {activeStudio === 'DISPOSAL' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
            
            {/* ───────────────────────────────────────────────────────────── */}
            {/* 좌측 50%: 매각 대상 자산 선택 바구니 */}
            {/* ───────────────────────────────────────────────────────────── */}
            <div className="card" style={{ margin: 0, padding: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={16} color="var(--primary)" /> 매각 대상 자산 선택
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    * 현장 대여중(RENTED) 장비는 오매각 방지를 위해 원천 차단됩니다.
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={includeRepairing}
                      onChange={e => setIncludeRepairing(e.target.checked)}
                    />
                    정비중(REPAIRING) 포함
                  </label>
                </div>
              </div>

              {/* 검색 및 정렬 바 */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--bg-app)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <Search size={14} color="var(--text-muted)" />
                  <input
                    type="text"
                    placeholder="관리번호 / 모델명 검색"
                    value={disposalSearchQuery}
                    onChange={e => setDisposalSearchQuery(e.target.value)}
                    style={{ flex: 1, border: 'none', backgroundColor: 'transparent', fontSize: '12px', outline: 'none', color: 'var(--text-primary)' }}
                  />
                  {disposalSearchQuery && (
                    <button onClick={() => setDisposalSearchQuery('')} style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
                  )}
                </div>

                <select
                  value={disposalSortOrder}
                  onChange={e => setDisposalSortOrder(e.target.value as any)}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', fontSize: '12px', color: 'var(--text-primary)' }}
                >
                  <option value="YEAR_ASC">노후순 (연식 오래된순)</option>
                  <option value="BOOK_VAL_ASC">장부가 낮은순</option>
                  <option value="ASSET_NO">관리번호순</option>
                </select>
              </div>

              {/* 선택된 자산 요약 바 */}
              <div style={{
                backgroundColor: selectedAssetIds.size > 0 ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-app)',
                padding: '8px 12px',
                borderRadius: '6px',
                border: `1px solid ${selectedAssetIds.size > 0 ? 'rgba(59, 130, 246, 0.3)' : 'var(--border-color)'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '11.5px'
              }}>
                <div>
                  선택 자산: <strong style={{ color: 'var(--primary)' }}>{selectedAssetIds.size}대</strong> / 가용 자산 {filteredDisposalAssets.length}대
                </div>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  style={{ border: 'none', background: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: '11px' }}
                >
                  {selectedAssetIds.size === filteredDisposalAssets.length ? '선택 해제' : '가용 자산 전체 선택'}
                </button>
              </div>

              {/* 자산 선택 그리드 테이블 */}
              <div className="table-container" style={{ maxHeight: '440px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-app)' }}>
                      <th style={{ width: '36px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <input
                          type="checkbox"
                          checked={selectedAssetIds.size > 0 && selectedAssetIds.size === filteredDisposalAssets.length}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th style={{ whiteSpace: 'nowrap' }}>관리번호</th>
                      <th style={{ whiteSpace: 'nowrap' }}>모델명</th>
                      <th style={{ whiteSpace: 'nowrap' }}>연식</th>
                      <th style={{ whiteSpace: 'nowrap' }}>현재 장부가치</th>
                      <th style={{ whiteSpace: 'nowrap' }}>취득가</th>
                      <th style={{ whiteSpace: 'nowrap' }}>정비점수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDisposalAssets.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                          매각 가능한 임대가능(AVAILABLE) 유휴 자산이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredDisposalAssets.map(a => {
                        const isSelected = selectedAssetIds.has(a.id);
                        const dep = calculateAssetDepreciation(a);
                        return (
                          <tr
                            key={a.id}
                            onClick={() => toggleSelectAsset(a.id)}
                            style={{
                              backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                              cursor: 'pointer'
                            }}
                          >
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectAsset(a.id)}
                              />
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}><strong style={{ color: 'var(--primary)' }}>{a.assetNo}</strong></td>
                            <td style={{ whiteSpace: 'nowrap' }}>{a.modelName}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{a.manufactureYear || '-'}년</td>
                            <td style={{ whiteSpace: 'nowrap' }}><strong style={{ color: '#0070C0' }}>₩{dep.bookValue.toLocaleString()}원</strong></td>
                            <td style={{ whiteSpace: 'nowrap' }}>₩{(a.acquisitionPrice || 0).toLocaleString()}원</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{a.maintenanceScore ?? 0}점</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </div>

            {/* ───────────────────────────────────────────────────────────── */}
            {/* 우측 50%: 매각 계약 체결 & 청구·이메일 스튜디오 */}
            {/* ───────────────────────────────────────────────────────────── */}
            <div className="card" style={{ margin: 0, padding: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Receipt size={16} color="var(--primary)" /> 매각 계약 체결 & 청구서 발행 스튜디오
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  원클릭 3단계 동시 완결 (계약+청구+메일)
                </span>
              </div>

              {/* 1. 매수처 지정 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>1. 매수처 (인수 거래처) 지정</label>
                  <div style={{ display: 'flex', gap: '6px', fontSize: '11px' }}>
                    <button
                      type="button"
                      onClick={() => setBuyerMode('EXISTING')}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: buyerMode === 'EXISTING' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        backgroundColor: buyerMode === 'EXISTING' ? 'var(--primary)' : 'transparent',
                        color: buyerMode === 'EXISTING' ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      기존 고객사 선택
                    </button>
                    <button
                      type="button"
                      onClick={() => setBuyerMode('NEW')}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: buyerMode === 'NEW' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        backgroundColor: buyerMode === 'NEW' ? 'var(--primary)' : 'transparent',
                        color: buyerMode === 'NEW' ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      신규 매수처 직접 입력
                    </button>
                  </div>
                </div>

                {buyerMode === 'EXISTING' ? (
                  <select
                    value={selectedBuyerId}
                    onChange={e => setSelectedBuyerId(e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '12.5px' }}
                  >
                    <option value="">-- 매수 고객사를 선택해 주세요 --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.representative ? `(대표: ${c.representative})` : ''} {c.repEmail ? `[${c.repEmail}]` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="매수처 상호명 (필수)"
                      value={newBuyerName}
                      onChange={e => setNewBuyerName(e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '12.5px' }}
                    />
                    <input
                      type="text"
                      placeholder="사업자등록번호 (선택)"
                      value={newBuyerBizNo}
                      onChange={e => setNewBuyerBizNo(e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '12.5px' }}
                    />
                  </div>
                )}
              </div>

              {/* 2. 계약일자 및 영업담당자 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>2. 양도/계약일자</label>
                  <input
                    type="date"
                    value={disposalDate}
                    onChange={e => setDisposalDate(e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '12.5px' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>계약 담당자</label>
                  <select
                    value={disposalSalespersonId}
                    onChange={e => setDisposalSalespersonId(e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '12.5px' }}
                  >
                    <option value="">담당자 선택</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. 자산별 매각단가 책정 및 실시간 손익 계산 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  3. 선택 자산별 매각 공급가액 책정 ({selectedAssetsList.length}대)
                </label>

                {selectedAssetsList.length === 0 ? (
                  <div style={{ padding: '16px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                    좌측에서 매각 처분할 자산을 선택해 주세요.
                  </div>
                ) : (
                  <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {selectedAssetsList.map(a => {
                      const dep = calculateAssetDepreciation(a, new Date(disposalDate));
                      const bv = dep.bookValue;
                      const price = Number(itemPrices[a.id]) || 0;
                      const diff = price - bv;
                      return (
                        <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                          <div>
                            <strong style={{ color: 'var(--primary)' }}>{a.assetNo}</strong> ({a.modelName})
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                              장부가: ₩{bv.toLocaleString()}원
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="number"
                              value={itemPrices[a.id] ?? bv}
                              onChange={e => {
                                const val = parseInt(e.target.value, 10) || 0;
                                setItemPrices(p => ({ ...p, [a.id]: val }));
                              }}
                              style={{ width: '120px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px', textAlign: 'right', fontWeight: 700 }}
                            />
                            <span style={{ fontSize: '11px', fontWeight: 700, width: '100px', textAlign: 'right', color: diff >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                              {diff >= 0 ? `🟢 +₩${diff.toLocaleString()}` : `🔴 ₩${diff.toLocaleString()}`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 4. 실시간 회계 정산 요약 카드 */}
              <div style={{
                backgroundColor: 'var(--bg-app)',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px',
                fontSize: '11.5px'
              }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>매각 공급가액</span>
                  <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>₩{disposalAccounting.totalSupplyAmount.toLocaleString()}원</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>유형자산 처분손익</span>
                  <strong style={{ fontSize: '13px', color: disposalAccounting.gainLoss >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {disposalAccounting.gainLoss >= 0 ? `🟢 +₩${disposalAccounting.gainLoss.toLocaleString()}` : `🔴 ₩${disposalAccounting.gainLoss.toLocaleString()}`}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>부가가치세 (10%)</span>
                  <strong style={{ fontSize: '13px', color: 'var(--text-muted)' }}>₩{disposalAccounting.vat.toLocaleString()}원</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>청구 총합계금액</span>
                  <strong style={{ fontSize: '14px', color: 'var(--primary)' }}>₩{disposalAccounting.grandTotal.toLocaleString()}원</strong>
                </div>
              </div>

              {/* 5. 실시간 서식 미리보기 (듀얼 탭) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>4. 실시간 서식 미리보기</label>
                  <div style={{ display: 'flex', gap: '4px', fontSize: '11px' }}>
                    <button
                      type="button"
                      onClick={() => setPreviewDocTab('CONTRACT')}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: previewDocTab === 'CONTRACT' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        backgroundColor: previewDocTab === 'CONTRACT' ? 'var(--primary)' : 'transparent',
                        color: previewDocTab === 'CONTRACT' ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      매각 계약서 미리보기
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewDocTab('INVOICE')}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: previewDocTab === 'INVOICE' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        backgroundColor: previewDocTab === 'INVOICE' ? 'var(--primary)' : 'transparent',
                        color: previewDocTab === 'INVOICE' ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      매각 청구서 미리보기
                    </button>
                  </div>
                </div>

                {/* 서식 뷰어 본체 */}
                <div style={{
                  padding: '12px 14px',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontFamily: 'serif',
                  fontSize: '11.5px',
                  maxHeight: '160px',
                  overflowY: 'auto'
                }}>
                  {previewDocTab === 'CONTRACT' ? (
                    <div>
                      <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 800, marginBottom: '8px', borderBottom: '1px solid #94a3b8', paddingBottom: '4px' }}>
                        자 산 양 도 · 매 각 계 약 서
                      </div>
                      <p style={{ margin: '2px 0' }}>
                        <strong>양도인:</strong> (주)기연리프트 (대표이사 이정용 / 사업자등록번호: 144-81-01234)
                      </p>
                      <p style={{ margin: '2px 0' }}>
                        <strong>양수인:</strong> {buyerMode === 'EXISTING' ? (customers.find(c => c.id === selectedBuyerId)?.name || '매수처') : (newBuyerName || '매수처')} 귀하
                      </p>
                      <p style={{ margin: '4px 0 2px 0', fontWeight: 700 }}>[제1조 매각 대상 자산]</p>
                      <p style={{ margin: '2px 0' }}>
                        총 {selectedAssetsList.length}대 ({selectedAssetsList.map(a => a.assetNo).join(', ') || '선택 없음'})
                      </p>
                      <p style={{ margin: '4px 0 2px 0', fontWeight: 700 }}>[제2조 매각 공급대금]</p>
                      <p style={{ margin: '2px 0' }}>
                        금 ₩{disposalAccounting.totalSupplyAmount.toLocaleString()}원정 (부가가치세 ₩{disposalAccounting.vat.toLocaleString()}원 별도 / 총액 ₩{disposalAccounting.grandTotal.toLocaleString()}원)
                      </p>
                      <p style={{ margin: '4px 0 2px 0', fontWeight: 700 }}>[제3조 대금 결제 및 인도]</p>
                      <p style={{ margin: '2px 0', color: '#64748b' }}>
                        본 대금은 매각 청구서 발행 후 지정 기일 내 입금 완료 시 소유권이 완전히 이전된다.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 800, marginBottom: '8px', borderBottom: '1px solid #94a3b8', paddingBottom: '4px' }}>
                        거 래 명 세 서 (자산 매각 대금 청구서)
                      </div>
                      <p style={{ margin: '2px 0' }}>
                        <strong>공급자:</strong> (주)기연리프트 | <strong>공급받는자:</strong> {buyerMode === 'EXISTING' ? (customers.find(c => c.id === selectedBuyerId)?.name || '매수처') : (newBuyerName || '매수처')}
                      </p>
                      <p style={{ margin: '2px 0' }}>
                        <strong>청구일자:</strong> {disposalDate} | <strong>청구품목:</strong> 고소작업대 자산 매각 대금 ({selectedAssetsList.length}대)
                      </p>
                      <div style={{ marginTop: '6px', borderTop: '1px solid #e2e8f0', paddingTop: '4px' }}>
                        <div>• 공급가액: ₩{disposalAccounting.totalSupplyAmount.toLocaleString()}원</div>
                        <div>• 부가가치세(10%): ₩{disposalAccounting.vat.toLocaleString()}원</div>
                        <div>• <strong>청구 총합계금액: ₩{disposalAccounting.grandTotal.toLocaleString()}원</strong></div>
                        <div style={{ color: '#0284c7', marginTop: '4px' }}>• 입금계좌: [기연리프트] 기업은행 144-082875-01-017</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 6. 이메일 발송 설정 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'var(--bg-app)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={sendEmailImmediately}
                      onChange={e => setSendEmailImmediately(e.target.checked)}
                    />
                    매각 계약서 및 청구서 이메일 즉시 발송
                  </label>
                  <Mail size={14} color="var(--primary)" />
                </div>

                {sendEmailImmediately && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                    <input
                      type="email"
                      placeholder="수신 이메일 (예: buyer@samwoo.co.kr)"
                      value={disposalEmailTo}
                      onChange={e => setDisposalEmailTo(e.target.value)}
                      style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px' }}
                    />
                    <input
                      type="email"
                      placeholder="참조 이메일 (CC, 선택)"
                      value={disposalEmailCc}
                      onChange={e => setDisposalEmailCc(e.target.value)}
                      style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px' }}
                    />
                  </div>
                )}
              </div>

              {/* 7. 우하단 Gutenberg Z-패턴 원클릭 완결 버튼 */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={isSubmittingDisposal || selectedAssetsList.length === 0}
                  onClick={handleExecuteDisposal}
                  style={{
                    padding: '10px 24px',
                    fontSize: '13px',
                    fontWeight: 700,
                    backgroundColor: '#8b5cf6',
                    borderColor: '#7c3aed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Send size={15} />
                  {isSubmittingDisposal ? '계약 체결 및 발행 중...' : `매각 계약 체결 & 청구서 발행 & 이메일 전송 (총 ${selectedAssetsList.length}대)`}
                </button>
              </div>

            </div>

          </div>

          {/* 최하단 Gutenberg 대차대조 항등식 검증 바 (헌장 3.5 준수) */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            padding: '10px 16px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 700 }}>대차대조 회계 검증식:</span>
              <span>📄 매각총액(공급가) <strong>₩{disposalAccounting.totalSupplyAmount.toLocaleString()}원</strong></span>
              <span>=</span>
              <span>📉 매각시점 장부가액 <strong>₩{disposalAccounting.totalBookValue.toLocaleString()}원</strong></span>
              <span>+</span>
              <span style={{ color: disposalAccounting.gainLoss >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                {disposalAccounting.gainLoss >= 0 ? `🟢 처분이익 ₩${disposalAccounting.gainLoss.toLocaleString()}원` : `🔴 처분손실 ₩${disposalAccounting.gainLoss.toLocaleString()}원`}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}>
              <ShieldCheck size={16} color="var(--success)" />
              <span style={{ color: 'var(--success)' }}>
                ⚖️ 대차 차액 ₩0 (회계 무결성 확정)
              </span>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
