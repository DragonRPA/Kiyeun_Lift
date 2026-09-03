// d:\Kiyeun_Lift\src\pages\AssetAcquisitionDisposal.tsx
import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { calculateAssetDepreciation, Asset, Product, Vendor } from '../services/db';
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
  HelpCircle
} from 'lucide-react';

export const AssetAcquisitionDisposal: React.FC = () => {
  const {
    assets,
    products,
    vendors,
    customers,
    assetInOutLogs,
    acquireAsset,
    batchAcquireAssets,
    disposeAsset,
    hasPermission
  } = useApp();

  const canSave = hasPermission('acquisition_disposal', 'save');

  // 메인 서브탭: 당사자산 취득 대장 vs 자산 매각 처분 대장
  const [activeTab, setActiveTab] = useState<'ACQUIRE' | 'DISPOSE'>('ACQUIRE');

  // 필터 상태
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 모달 제어 상태
  const [showAcquireModal, setShowAcquireModal] = useState<boolean>(false);
  const [showDisposeModal, setShowDisposeModal] = useState<boolean>(false);
  const [showExcelUploadModal, setShowExcelUploadModal] = useState<boolean>(false);
  const [selectedAssetForDossier, setSelectedAssetForDossier] = useState<Asset | null>(null);

  // 알림 토스트 상태
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // --------------------------------------------------------------------------
  // [1] 데이터 필터링 및 집계 (Scope)
  // --------------------------------------------------------------------------
  
  // 당사 보유 자산 목록 (취득 대장 대상)
  const ownedAssets = useMemo(() => {
    return assets.filter(a => a.ownerType === 'OWNED' && a.status !== 'SOLD');
  }, [assets]);

  // 매각 처분 완료 자산 목록 (매각 대장 대상)
  const soldAssets = useMemo(() => {
    return assets.filter(a => a.ownerType === 'OWNED' && a.status === 'SOLD');
  }, [assets]);

  // 연도 목록 옵션 (취득/매각일자 기준 유니크 연도)
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    assets.forEach(a => {
      if (a.ownerType === 'OWNED') {
        if (a.acquisitionDate && a.acquisitionDate.length >= 4) {
          years.add(a.acquisitionDate.slice(0, 4));
        }
        if (a.disposalDate && a.disposalDate.length >= 4) {
          years.add(a.disposalDate.slice(0, 4));
        }
      }
    });
    return Array.from(years).sort().reverse();
  }, [assets]);

  // 취득 대장 필터링 결과
  const filteredOwnedAssets = useMemo(() => {
    return ownedAssets.filter(a => {
      if (selectedModel && a.modelName !== selectedModel) return false;
      if (selectedYear && a.acquisitionDate && !a.acquisitionDate.startsWith(selectedYear)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNo = a.assetNo?.toLowerCase().includes(q);
        const matchSerial = a.serialNo?.toLowerCase().includes(q);
        const matchSupplier = a.supplier?.toLowerCase().includes(q);
        const matchModel = a.modelName?.toLowerCase().includes(q);
        if (!matchNo && !matchSerial && !matchSupplier && !matchModel) return false;
      }
      return true;
    });
  }, [ownedAssets, selectedModel, selectedYear, searchQuery]);

  // 매각 대장 필터링 결과
  const filteredSoldAssets = useMemo(() => {
    return soldAssets.filter(a => {
      if (selectedModel && a.modelName !== selectedModel) return false;
      if (selectedYear && a.disposalDate && !a.disposalDate.startsWith(selectedYear)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNo = a.assetNo?.toLowerCase().includes(q);
        const matchSerial = a.serialNo?.toLowerCase().includes(q);
        const matchBuyer = a.buyer?.toLowerCase().includes(q);
        const matchModel = a.modelName?.toLowerCase().includes(q);
        if (!matchNo && !matchSerial && !matchBuyer && !matchModel) return false;
      }
      return true;
    });
  }, [soldAssets, selectedModel, selectedYear, searchQuery]);

  // --------------------------------------------------------------------------
  // [2] KPI 지표 및 회계 대차대조 합계 검증식 (Terminal Audit)
  // --------------------------------------------------------------------------
  
  // 취득 대장 합계 (필터 적용 기준)
  const acqSummary = useMemo(() => {
    let totalCost = 0;
    let totalAccum = 0;
    let totalBook = 0;

    filteredOwnedAssets.forEach(a => {
      const dep = calculateAssetDepreciation(a);
      totalCost += (a.acquisitionPrice || 0);
      totalAccum += dep.accumDepreciation;
      totalBook += dep.bookValue;
    });

    const diff = totalCost - (totalBook + totalAccum);

    return {
      count: filteredOwnedAssets.length,
      totalCost,
      totalAccum,
      totalBook,
      diff // 회계상 원칙적으로 0이어야 함 (단위 절사 오차 방지)
    };
  }, [filteredOwnedAssets]);

  // 매각 대장 합계 (필터 적용 기준)
  const dispSummary = useMemo(() => {
    let totalAcqCost = 0;
    let totalAccum = 0;
    let totalBookAtDisposal = 0;
    let totalDisposalPrice = 0;
    let totalGainLoss = 0;

    filteredSoldAssets.forEach(a => {
      const dep = calculateAssetDepreciation(a);
      const acqPrice = a.acquisitionPrice || 0;
      const dispPrice = a.disposalPrice || 0;
      const bookAtDisp = dep.bookValue;
      const gainLoss = dispPrice - bookAtDisp;

      totalAcqCost += acqPrice;
      totalAccum += dep.accumDepreciation;
      totalBookAtDisposal += bookAtDisp;
      totalDisposalPrice += dispPrice;
      totalGainLoss += gainLoss;
    });

    return {
      count: filteredSoldAssets.length,
      totalAcqCost,
      totalAccum,
      totalBookAtDisposal,
      totalDisposalPrice,
      totalGainLoss
    };
  }, [filteredSoldAssets]);

  // --------------------------------------------------------------------------
  // [3] 취득 모달 상태 (단건 / N대 연속 일괄)
  // --------------------------------------------------------------------------
  const [acquireMode, setAcquireMode] = useState<'SINGLE' | 'BATCH'>('SINGLE');

  // 단건 취득 폼 상태
  const [singleModel, setSingleModel] = useState<string>(products[0]?.modelName || '');
  const [singleAssetNo, setSingleAssetNo] = useState<string>('');
  const [singleSerialNo, setSingleSerialNo] = useState<string>('');
  const [singleManufacturer, setSingleManufacturer] = useState<string>(products[0]?.manufacturer || '');
  const [singleManufactureYear, setSingleManufactureYear] = useState<string>(new Date().getFullYear().toString());
  const [singleAcqDate, setSingleAcqDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [singleAcqPrice, setSingleAcqPrice] = useState<number>(0);
  const [singleDepMonths, setSingleDepMonths] = useState<number>(60);
  const [singleResidualRate, setSingleResidualRate] = useState<number>(10);
  const [singleVendorId, setSingleVendorId] = useState<string>('');
  const [singleSupplierText, setSingleSupplierText] = useState<string>('');
  const [singleSafetyUrl, setSingleSafetyUrl] = useState<string>('');
  const [singleMemo, setSingleMemo] = useState<string>('');

  // N대 연속 일괄 취득 폼 상태
  const [batchModel, setBatchModel] = useState<string>(products[0]?.modelName || '');
  const [batchPrefix, setBatchPrefix] = useState<string>('SJ19-');
  const [batchStartNum, setBatchStartNum] = useState<number>(101);
  const [batchQty, setBatchQty] = useState<number>(5);
  const [batchPadDigits, setBatchPadDigits] = useState<number>(3);
  const [batchManufacturer, setBatchManufacturer] = useState<string>(products[0]?.manufacturer || '');
  const [batchManufactureYear, setBatchManufactureYear] = useState<string>(new Date().getFullYear().toString());
  const [batchAcqDate, setBatchAcqDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [batchUnitPrice, setBatchUnitPrice] = useState<number>(0);
  const [batchDepMonths, setBatchDepMonths] = useState<number>(60);
  const [batchResidualRate, setBatchResidualRate] = useState<number>(10);
  const [batchVendorId, setBatchVendorId] = useState<string>('');
  const [batchSupplierText, setBatchSupplierText] = useState<string>('');
  const [batchCustomSerials, setBatchCustomSerials] = useState<Record<string, string>>({});

  // 모델 변경 시 제조사 및 기본 채번 접두사 자동 설정
  const handleModelChangeSingle = (mName: string) => {
    setSingleModel(mName);
    const prod = products.find(p => p.modelName === mName);
    if (prod) {
      setSingleManufacturer(prod.manufacturer || '');
      suggestNextAssetNo(mName, (suggestedNo) => setSingleAssetNo(suggestedNo));
    }
  };

  const handleModelChangeBatch = (mName: string) => {
    setBatchModel(mName);
    const prod = products.find(p => p.modelName === mName);
    if (prod) {
      setBatchManufacturer(prod.manufacturer || '');
      const prefix = mName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() + '-';
      setBatchPrefix(prefix);
    }
  };

  // 다음 관리번호 추천 로직
  const suggestNextAssetNo = (modelName: string, cb: (val: string) => void) => {
    const existing = assets.filter(a => a.modelName === modelName);
    if (existing.length === 0) {
      const p = products.find(prod => prod.modelName === modelName);
      const prefix = p?.modelName ? p.modelName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() + '-' : 'AST-';
      cb(`${prefix}101`);
      return;
    }
    let maxNum = 0;
    let detectedPrefix = 'AST-';
    existing.forEach(a => {
      const match = a.assetNo.match(/^(.*?)(\d+)$/);
      if (match) {
        detectedPrefix = match[1];
        const n = parseInt(match[2], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    if (maxNum > 0) {
      cb(`${detectedPrefix}${maxNum + 1}`);
    } else {
      cb(`${detectedPrefix}101`);
    }
  };

  // N대 일괄 생성기 실시간 슬롯 미리보기
  const batchGeneratedSlots = useMemo(() => {
    const list: { assetNo: string; serialNo: string; isDup: boolean }[] = [];
    for (let i = 0; i < batchQty; i++) {
      const numStr = String(batchStartNum + i).padStart(batchPadDigits, '0');
      const fullNo = `${batchPrefix}${numStr}`;
      const isDup = assets.some(a => a.assetNo.toLowerCase() === fullNo.toLowerCase());
      list.push({
        assetNo: fullNo,
        serialNo: batchCustomSerials[fullNo] || '',
        isDup
      });
    }
    return list;
  }, [batchPrefix, batchStartNum, batchQty, batchPadDigits, batchCustomSerials, assets]);

  // 단건 취득 제출 핸들러
  const handleSingleAcquireSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) {
      showToast('취득 등록 권한이 없습니다.', 'error');
      return;
    }
    if (!singleAssetNo.trim() || !singleModel) {
      showToast('관리번호와 모델명은 필수 항목입니다.', 'error');
      return;
    }
    if (assets.some(a => a.assetNo.toLowerCase() === singleAssetNo.trim().toLowerCase())) {
      showToast(`이미 등록된 관리번호입니다: ${singleAssetNo}`, 'error');
      return;
    }

    const supplierName = singleSupplierText.trim() ||
      vendors.find(v => v.id === singleVendorId)?.name || '';

    acquireAsset({
      modelName: singleModel,
      assetNo: singleAssetNo.trim(),
      serialNo: singleSerialNo.trim(),
      manufacturer: singleManufacturer.trim(),
      manufactureYear: singleManufactureYear.trim(),
      acquisitionDate: singleAcqDate,
      acquisitionPrice: singleAcqPrice,
      depreciationMonths: singleDepMonths,
      residualValueRate: singleResidualRate,
      vendorId: singleVendorId || undefined,
      supplier: supplierName,
      safetyInspectionUrl: singleSafetyUrl.trim(),
      memo1: singleMemo.trim(),
      ownerType: 'OWNED'
    });

    showToast(`신규 자산 [${singleAssetNo}] 취득 등록이 완료되었습니다.`);
    setShowAcquireModal(false);
    setSingleAssetNo('');
    setSingleSerialNo('');
    setSingleAcqPrice(0);
    setSingleSafetyUrl('');
    setSingleMemo('');
  };

  // N대 일괄 취득 제출 핸들러
  const handleBatchAcquireSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) {
      showToast('취득 등록 권한이 없습니다.', 'error');
      return;
    }
    if (batchGeneratedSlots.some(s => s.isDup)) {
      showToast('중복된 관리번호가 포함되어 있습니다. 시작번호 또는 접두사를 확인해 주세요.', 'error');
      return;
    }
    if (batchGeneratedSlots.length === 0) {
      showToast('생성할 수량이 0대입니다.', 'error');
      return;
    }

    const supplierName = batchSupplierText.trim() ||
      vendors.find(v => v.id === batchVendorId)?.name || '';

    const payload: Partial<Asset>[] = batchGeneratedSlots.map(slot => ({
      modelName: batchModel,
      assetNo: slot.assetNo,
      serialNo: slot.serialNo,
      manufacturer: batchManufacturer.trim(),
      manufactureYear: batchManufactureYear.trim(),
      acquisitionDate: batchAcqDate,
      acquisitionPrice: batchUnitPrice,
      depreciationMonths: batchDepMonths,
      residualValueRate: batchResidualRate,
      vendorId: batchVendorId || undefined,
      supplier: supplierName,
      ownerType: 'OWNED'
    }));

    await batchAcquireAssets(payload);
    showToast(`총 ${payload.length}대 자산 일괄 취득 등록이 완료되었습니다.`);
    setShowAcquireModal(false);
    setBatchCustomSerials({});
  };

  // --------------------------------------------------------------------------
  // [4] 매각 처분 모달 상태 및 핸들러 (Disposal)
  // --------------------------------------------------------------------------
  const [selectedAssetIdToDispose, setSelectedAssetIdToDispose] = useState<string>('');
  const [disposalDate, setDisposalDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [disposalPrice, setDisposalPrice] = useState<number>(0);
  const [buyerType, setBuyerType] = useState<'EXISTING' | 'MANUAL'>('EXISTING');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [manualBuyerName, setManualBuyerName] = useState<string>('');
  const [disposalBillingYm, setDisposalBillingYm] = useState<string>(() => new Date().toISOString().slice(0, 7));

  // 매각 대상 선택 자산
  const activeAssetToDispose = useMemo(() => {
    return assets.find(a => a.id === selectedAssetIdToDispose);
  }, [assets, selectedAssetIdToDispose]);

  // 매각 시점 감가상각 및 장부가 계산
  const disposalDepInfo = useMemo(() => {
    if (!activeAssetToDispose) return null;
    return calculateAssetDepreciation(activeAssetToDispose, new Date(disposalDate));
  }, [activeAssetToDispose, disposalDate]);

  // 실시간 처분손익 계산 (매각가 - 매각시점 장부가)
  const realTimeGainLoss = useMemo(() => {
    if (!disposalDepInfo) return 0;
    return disposalPrice - disposalDepInfo.bookValue;
  }, [disposalPrice, disposalDepInfo]);

  // 매각 제출 핸들러
  const handleDisposeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) {
      showToast('매각 처리 권한이 없습니다.', 'error');
      return;
    }
    if (!selectedAssetIdToDispose) {
      showToast('매각할 대상 자산을 선택해 주세요.', 'error');
      return;
    }
    const finalBuyer = buyerType === 'EXISTING'
      ? customers.find(c => c.id === selectedCustomerId)?.name || ''
      : manualBuyerName.trim();

    if (!finalBuyer) {
      showToast('매각처(인수자)는 필수 입력 사항입니다.', 'error');
      return;
    }
    if (disposalPrice <= 0) {
      showToast('매각 가격(공급가액)을 올바르게 입력해 주세요.', 'error');
      return;
    }

    disposeAsset(selectedAssetIdToDispose, {
      disposalDate,
      disposalPrice,
      buyer: finalBuyer,
      billingYm: disposalBillingYm
    });

    showToast(`자산 매각 및 [${finalBuyer}] 매출 청구서 생성이 완료되었습니다.`);
    setShowDisposeModal(false);
    setSelectedAssetIdToDispose('');
    setDisposalPrice(0);
    setManualBuyerName('');
  };

  // --------------------------------------------------------------------------
  // [5] 엑셀 일괄 업로드 파서 및 템플릿 다운로드
  // --------------------------------------------------------------------------
  const [excelParsedRows, setExcelParsedRows] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 엑셀 서식 다운로드
  const handleDownloadTemplate = () => {
    const templateRows = [
      {
        '관리번호*': 'SJ19-201',
        '제품모델명*': 'SJ-3219',
        '제조사': 'Skyjack',
        '제조번호(시리얼)': 'S-991823',
        '제조년도': '2024',
        '취득일자*': '2026-09-01',
        '취득원가(원)*': 14500000,
        '내용연수(개월)': 60,
        '잔존가치율(%)': 10,
        '구입처': '스카이잭코리아',
        '안전인증URL': '',
        '비고': '신규 1차 도입분'
      },
      {
        '관리번호*': 'SJ19-202',
        '제품모델명*': 'SJ-3219',
        '제조사': 'Skyjack',
        '제조번호(시리얼)': 'S-991824',
        '제조년도': '2024',
        '취득일자*': '2026-09-01',
        '취득원가(원)*': 14500000,
        '내용연수(개월)': 60,
        '잔존가치율(%)': 10,
        '구입처': '스카이잭코리아',
        '안전인증URL': '',
        '비고': '신규 1차 도입분'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '취득자산_일괄등록서식');
    XLSX.writeFile(wb, '기연리프트_당사자산_취득_업로드양식.xlsx');
  };

  // 엑셀 파일 로드 및 유효성 파싱
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

        if (rawData.length === 0) {
          showToast('엑셀 파일에 데이터가 없습니다.', 'error');
          return;
        }

        const validatedRows = rawData.map((row, idx) => {
          const assetNo = String(row['관리번호*'] || row['관리번호'] || '').trim();
          const modelName = String(row['제품모델명*'] || row['제품모델명'] || row['모델명'] || '').trim();
          const acqPrice = parseInt(row['취득원가(원)*'] || row['취득원가'] || row['취득가액'] || 0, 10);
          const acqDate = String(row['취득일자*'] || row['취득일자'] || row['취득일'] || new Date().toISOString().split('T')[0]).trim();
          const manufacturer = String(row['제조사'] || '').trim();
          const serialNo = String(row['제조번호(시리얼)'] || row['제조번호'] || row['시리얼'] || '').trim();
          const manufactureYear = String(row['제조년도'] || '').trim();
          const depMonths = parseInt(row['내용연수(개월)'] || row['내용연수'] || 60, 10);
          const residualRate = parseFloat(row['잔존가치율(%)'] || row['잔존가치율'] || 10);
          const supplier = String(row['구입처'] || row['공급처'] || '').trim();
          const safetyUrl = String(row['안전인증URL'] || '').trim();
          const memo = String(row['비고'] || '').trim();

          const isDup = assets.some(a => a.assetNo.toLowerCase() === assetNo.toLowerCase());
          const isValid = !!assetNo && !!modelName && acqPrice > 0 && !isDup;

          return {
            rowIdx: idx + 1,
            assetNo,
            modelName,
            manufacturer,
            serialNo,
            manufactureYear,
            acquisitionDate: acqDate,
            acquisitionPrice: acqPrice,
            depreciationMonths: depMonths,
            residualValueRate: residualRate,
            supplier,
            safetyInspectionUrl: safetyUrl,
            memo1: memo,
            isDup,
            isValid
          };
        });

        setExcelParsedRows(validatedRows);
      } catch (err: any) {
        showToast(`엑셀 파일 파싱 오류: ${err.message}`, 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  // 엑셀 일괄 업로드 실행
  const handleCommitExcelUpload = async () => {
    if (!canSave) {
      showToast('저장 권한이 없습니다.', 'error');
      return;
    }
    const validRows = excelParsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      showToast('등록 가능한 유효한 데이터가 없습니다.', 'error');
      return;
    }

    const payload: Partial<Asset>[] = validRows.map(r => ({
      modelName: r.modelName,
      assetNo: r.assetNo,
      serialNo: r.serialNo,
      manufacturer: r.manufacturer,
      manufactureYear: r.manufactureYear,
      acquisitionDate: r.acquisitionDate,
      acquisitionPrice: r.acquisitionPrice,
      depreciationMonths: r.depreciationMonths,
      residualValueRate: r.residualValueRate,
      supplier: r.supplier,
      safetyInspectionUrl: r.safetyInspectionUrl,
      memo1: r.memo1,
      ownerType: 'OWNED'
    }));

    await batchAcquireAssets(payload);
    showToast(`총 ${payload.length}대 자산 엑셀 일괄 취득 등록 완료!`);
    setShowExcelUploadModal(false);
    setExcelParsedRows([]);
  };

  // --------------------------------------------------------------------------
  // [6] 대장 엑셀 내보내기 (Export)
  // --------------------------------------------------------------------------
  const handleExportCurrentLedger = () => {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    if (activeTab === 'ACQUIRE') {
      const exportData = filteredOwnedAssets.map(a => {
        const dep = calculateAssetDepreciation(a);
        return {
          '관리번호': a.assetNo,
          '모델명': a.modelName,
          '제조사': a.manufacturer || '-',
          '제조번호': a.serialNo || '-',
          '제조년도': a.manufactureYear || '-',
          '취득일자': a.acquisitionDate || '-',
          '취득원가': a.acquisitionPrice || 0,
          '내용연수(개월)': a.depreciationMonths || 60,
          '월감가상각비': Math.round(dep.monthlyDepreciation),
          '감가상각누계액': dep.accumDepreciation,
          '현재장부가액': dep.bookValue,
          '공급처': a.supplier || '-',
          '안전인증URL': a.safetyInspectionUrl || '-',
          '운용상태': a.status === 'AVAILABLE' ? '임대가능' : a.status === 'RENTED' ? '대여중' : a.status === 'ASSIGNED' ? '출고대기' : a.status === 'REPAIRING' ? '수리중' : a.status
        };
      });
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '당사자산_취득대장');
      XLSX.writeFile(wb, `기연리프트_당사자산_취득대장_${todayStr}.xlsx`);
      showToast('취득 대장 엑셀 파일이 다운로드되었습니다.');
    } else {
      const exportData = filteredSoldAssets.map(a => {
        const dep = calculateAssetDepreciation(a);
        const gainLoss = (a.disposalPrice || 0) - dep.bookValue;
        return {
          '관리번호': a.assetNo,
          '모델명': a.modelName,
          '제조사': a.manufacturer || '-',
          '제조번호': a.serialNo || '-',
          '매각일자': a.disposalDate || '-',
          '취득원가': a.acquisitionPrice || 0,
          '감가상각누계액': dep.accumDepreciation,
          '매각시점 장부가': dep.bookValue,
          '실제 매각가격': a.disposalPrice || 0,
          '유형자산처분손익': gainLoss,
          '매각처(인수자)': a.buyer || '-',
          '비고': a.memo1 || '-'
        };
      });
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '자산_매각처분대장');
      XLSX.writeFile(wb, `기연리프트_자산_매각처분대장_${todayStr}.xlsx`);
      showToast('매각 처분 대장 엑셀 파일이 다운로드되었습니다.');
    }
  };

  // 운용 상태 뱃지 헬퍼
  const renderStatusBadge = (status: Asset['status']) => {
    switch (status) {
      case 'AVAILABLE':
        return <span className="badge badge-success" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>임대가능</span>;
      case 'RENTED':
        return <span className="badge badge-primary" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>대여중</span>;
      case 'ASSIGNED':
        return <span className="badge badge-warning" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>출고대기</span>;
      case 'REPAIRING':
        return <span className="badge badge-danger" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>수리중</span>;
      case 'RENTED_RETURNED':
        return <span className="badge badge-secondary" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>입고검수</span>;
      case 'SOLD':
        return <span className="badge badge-secondary" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>매각완료</span>;
      default:
        return <span className="badge badge-secondary" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>{status}</span>;
    }
  };

  // --------------------------------------------------------------------------
  // 렌더링 시작 (Gutenberg Z-Pattern)
  // --------------------------------------------------------------------------
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '100%', position: 'relative' }}>
      
      {/* 알림 토스트 */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 9999,
          padding: '10px 18px',
          borderRadius: '6px',
          backgroundColor: toastMessage.type === 'success' ? 'var(--success)' : 'var(--danger)',
          color: '#ffffff',
          fontWeight: 600,
          fontSize: '13px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          {toastMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* 헤더 & 파이프라인 (좌상단 Start / Scope + 우상단 Input / Pipeline) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
        paddingBottom: '4px',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0, fontWeight: '700', fontSize: '17px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
            당사자산 취득 / 매각 관리
          </h2>
          
          {/* 서브 탭 셀렉터 */}
          <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-app)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setActiveTab('ACQUIRE')}
              style={{
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: activeTab === 'ACQUIRE' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'ACQUIRE' ? '#ffffff' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap'
              }}
            >
              <ShoppingBag size={13} /> 당사자산 취득 대장 ({ownedAssets.length})
            </button>
            <button
              onClick={() => setActiveTab('DISPOSE')}
              style={{
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: activeTab === 'DISPOSE' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'DISPOSE' ? '#ffffff' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap'
              }}
            >
              <TrendingDown size={13} /> 자산 매각 처분 대장 ({soldAssets.length})
            </button>
          </div>
        </div>

        {/* 우상단 파이프라인 버튼군 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {activeTab === 'ACQUIRE' ? (
            <>
              <button
                className="btn-secondary"
                onClick={handleExportCurrentLedger}
                style={{ padding: '5px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}
              >
                <Download size={13} /> 엑셀 내보내기
              </button>
              <button
                className="btn-secondary"
                onClick={() => setShowExcelUploadModal(true)}
                disabled={!canSave}
                style={{ padding: '5px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}
              >
                <Upload size={13} /> 엑셀 일괄 업로드
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  suggestNextAssetNo(singleModel, (no) => setSingleAssetNo(no));
                  setShowAcquireModal(true);
                }}
                disabled={!canSave}
                style={{ padding: '5px 12px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}
              >
                <Plus size={14} /> 신규 자산 취득 등록
              </button>
            </>
          ) : (
            <>
              <button
                className="btn-secondary"
                onClick={handleExportCurrentLedger}
                style={{ padding: '5px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}
              >
                <Download size={13} /> 매각 대장 엑셀
              </button>
              <button
                className="btn-danger"
                onClick={() => setShowDisposeModal(true)}
                disabled={!canSave}
                style={{ padding: '5px 12px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}
              >
                <TrendingDown size={14} /> 기존 자산 매각 처리
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI 요약 바 & 필터 패널 (좌상단 Scope) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '6px'
      }}>
        {activeTab === 'ACQUIRE' ? (
          <>
            <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>보유 당사자산</span>
              <strong style={{ fontSize: '14px', color: 'var(--primary)', whiteSpace: 'nowrap' }}>{acqSummary.count}대</strong>
            </div>
            <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>총 취득원가</span>
              <strong style={{ fontSize: '13.5px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>₩{acqSummary.totalCost.toLocaleString()}</strong>
            </div>
            <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>감가상각누계액</span>
              <strong style={{ fontSize: '13.5px', color: 'var(--danger)', whiteSpace: 'nowrap' }}>-₩{acqSummary.totalAccum.toLocaleString()}</strong>
            </div>
            <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>현재 장부가치</span>
              <strong style={{ fontSize: '14px', color: 'var(--success)', whiteSpace: 'nowrap' }}>₩{acqSummary.totalBook.toLocaleString()}</strong>
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>매각 완료 자산</span>
              <strong style={{ fontSize: '14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{dispSummary.count}대</strong>
            </div>
            <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>취득원가 합계</span>
              <strong style={{ fontSize: '13.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>₩{dispSummary.totalAcqCost.toLocaleString()}</strong>
            </div>
            <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>총 매각대금</span>
              <strong style={{ fontSize: '14px', color: 'var(--primary)', whiteSpace: 'nowrap' }}>₩{dispSummary.totalDisposalPrice.toLocaleString()}</strong>
            </div>
            <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>유형자산처분손익</span>
              <strong style={{ fontSize: '14px', color: dispSummary.totalGainLoss >= 0 ? 'var(--success)' : 'var(--danger)', whiteSpace: 'nowrap' }}>
                {dispSummary.totalGainLoss >= 0 ? `+₩${dispSummary.totalGainLoss.toLocaleString()}` : `-₩${Math.abs(dispSummary.totalGainLoss).toLocaleString()}`}
              </strong>
            </div>
          </>
        )}
      </div>

      {/* 필터 컨트롤 바 (Vertical Header-Label Layout: 헌장 3.4) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>연도 선택</label>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
            style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', minWidth: '100px' }}
          >
            <option value="">전체 연도</option>
            {availableYears.map(y => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>장비 모델</label>
          <select
            value={selectedModel}
            onChange={e => setSelectedModel(e.target.value)}
            style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', minWidth: '140px' }}
          >
            <option value="">전체 모델</option>
            {products.map(p => (
              <option key={p.id} value={p.modelName}>{p.modelName} ({p.manufacturer})</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: '1', minWidth: '180px' }}>
          <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>검색어</label>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: '8px', top: '7px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="관리번호, 시리얼, 공급처, 매각처 검색"
              style={{
                width: '100%',
                padding: '4px 8px 4px 26px',
                fontSize: '12px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-main)'
              }}
            />
          </div>
        </div>

        {(selectedYear || selectedModel || searchQuery) && (
          <button
            onClick={() => { setSelectedYear(''); setSelectedModel(''); setSearchQuery(''); }}
            style={{
              marginTop: '16px',
              padding: '4px 8px',
              fontSize: '11.5px',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              backgroundColor: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap'
            }}
          >
            <RefreshCw size={11} /> 초기화
          </button>
        )}
      </div>

      {/* 중앙 본문: 고밀도 그리드 작업대 (Body / Inspection - 헌장 3.6 유형 B) */}
      <div style={{
        flex: 1,
        backgroundColor: 'var(--bg-card)',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ flex: 1, overflow: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
          {activeTab === 'ACQUIRE' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11.5px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <th style={{ padding: '7px 8px', width: '50px', textAlign: 'center', whiteSpace: 'nowrap' }}>상세</th>
                  <th style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>관리번호</th>
                  <th style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>모델명</th>
                  <th style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>제조사</th>
                  <th style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>제조번호(시리얼)</th>
                  <th style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>연식</th>
                  <th style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>취득일자</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>취득원가</th>
                  <th style={{ padding: '7px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>내용연수</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>월상각비</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>감가누계액</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>현재장부가</th>
                  <th style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>구입처(공급자)</th>
                  <th style={{ padding: '7px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>안전증빙</th>
                  <th style={{ padding: '7px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>운용상태</th>
                </tr>
              </thead>
              <tbody>
                {filteredOwnedAssets.length === 0 ? (
                  <tr>
                    <td colSpan={15} style={{ padding: '36px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                      조회 조건에 해당하는 당사 보유 자산이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredOwnedAssets.map(a => {
                    const dep = calculateAssetDepreciation(a);
                    return (
                      <tr
                        key={a.id}
                        onClick={() => setSelectedAssetForDossier(a)}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s'
                        }}
                        className="hover-row"
                      >
                        <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedAssetForDossier(a); }}
                            style={{
                              padding: '2px 6px',
                              fontSize: '11px',
                              border: '1px solid var(--border-color)',
                              borderRadius: '3px',
                              backgroundColor: 'transparent',
                              cursor: 'pointer',
                              color: 'var(--primary)',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            보기
                          </button>
                        </td>
                        <td style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{a.assetNo}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{a.modelName}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{a.manufacturer || '-'}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--text-muted)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{a.serialNo || '-'}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{a.manufactureYear || '-'}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{a.acquisitionDate || '-'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                          ₩{(a.acquisitionPrice || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {a.depreciationMonths || 60}개월
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          ₩{Math.round(dep.monthlyDepreciation).toLocaleString()}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--danger)', whiteSpace: 'nowrap' }}>
                          -₩{dep.accumDepreciation.toLocaleString()}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--success)', whiteSpace: 'nowrap' }}>
                          ₩{dep.bookValue.toLocaleString()}
                        </td>
                        <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{a.supplier || '-'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {a.safetyInspectionUrl ? (
                            <span
                              onClick={(e) => { e.stopPropagation(); window.open(a.safetyInspectionUrl, '_blank'); }}
                              style={{ color: 'var(--success)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '11px' }}
                              title="증빙 링크 열기"
                            >
                              <ShieldCheck size={13} /> 등록됨
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {renderStatusBadge(a.status)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11.5px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <th style={{ padding: '7px 8px', width: '50px', textAlign: 'center', whiteSpace: 'nowrap' }}>상세</th>
                  <th style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>관리번호</th>
                  <th style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>모델명</th>
                  <th style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>제조사</th>
                  <th style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>매각일자</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>취득원가</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>감가누계액</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>매각시점 장부가</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>실제 매각가</th>
                  <th style={{ padding: '7px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>⚖️ 처분손익</th>
                  <th style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>매각처(인수자)</th>
                  <th style={{ padding: '7px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>매출청구 상태</th>
                </tr>
              </thead>
              <tbody>
                {filteredSoldAssets.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ padding: '36px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                      매각 처분된 자산 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredSoldAssets.map(a => {
                    const dep = calculateAssetDepreciation(a);
                    const dispPrice = a.disposalPrice || 0;
                    const bookAtDisp = dep.bookValue;
                    const gainLoss = dispPrice - bookAtDisp;

                    return (
                      <tr
                        key={a.id}
                        onClick={() => setSelectedAssetForDossier(a)}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s'
                        }}
                        className="hover-row"
                      >
                        <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedAssetForDossier(a); }}
                            style={{
                              padding: '2px 6px',
                              fontSize: '11px',
                              border: '1px solid var(--border-color)',
                              borderRadius: '3px',
                              backgroundColor: 'transparent',
                              cursor: 'pointer',
                              color: 'var(--primary)',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            보기
                          </button>
                        </td>
                        <td style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{a.assetNo}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{a.modelName}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{a.manufacturer || '-'}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{a.disposalDate || '-'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          ₩{(a.acquisitionPrice || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--danger)', whiteSpace: 'nowrap' }}>
                          -₩{dep.accumDepreciation.toLocaleString()}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                          ₩{bookAtDisp.toLocaleString()}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                          ₩{dispPrice.toLocaleString()}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span className={`badge ${gainLoss >= 0 ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '11px' }}>
                            {gainLoss >= 0 ? `+₩${gainLoss.toLocaleString()}` : `-₩${Math.abs(gainLoss).toLocaleString()}`}
                          </span>
                        </td>
                        <td style={{ padding: '6px 8px', color: 'var(--text-main)', fontWeight: 600, whiteSpace: 'nowrap' }}>{a.buyer || '-'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span className="badge badge-primary" style={{ fontSize: '10.5px' }}>청구생성됨</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* 우하단 Terminal Action: 회계 대차대조 무결성 검증 바 (헌장 3.5 Z-패턴 4단계) */}
        <div style={{
          padding: '8px 14px',
          backgroundColor: 'var(--bg-app)',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          fontSize: '11.5px'
        }}>
          {activeTab === 'ACQUIRE' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <span>총 취득원가: <strong>₩{acqSummary.totalCost.toLocaleString()}</strong></span>
                <span>=</span>
                <span>현재 장부가: <strong style={{ color: 'var(--success)' }}>₩{acqSummary.totalBook.toLocaleString()}</strong></span>
                <span>+</span>
                <span>감가누계액: <strong style={{ color: 'var(--danger)' }}>₩{acqSummary.totalAccum.toLocaleString()}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: acqSummary.diff === 0 ? 'var(--success-light)' : 'var(--danger-light)',
                  color: acqSummary.diff === 0 ? 'var(--success)' : 'var(--danger)',
                  fontWeight: 700,
                  fontSize: '11px'
                }}>
                  {acqSummary.diff === 0 ? '⚖️ 대차 차액 ₩0 (정상)' : `⚠️ 대차 불일치 ₩${acqSummary.diff.toLocaleString()}`}
                </span>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <span>총 매각대금: <strong style={{ color: 'var(--primary)' }}>₩{dispSummary.totalDisposalPrice.toLocaleString()}</strong></span>
                <span>=</span>
                <span>매각시점 장부가: <strong>₩{dispSummary.totalBookAtDisposal.toLocaleString()}</strong></span>
                <span>+</span>
                <span>유형자산처분손익: <strong style={{ color: dispSummary.totalGainLoss >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {dispSummary.totalGainLoss >= 0 ? `+₩${dispSummary.totalGainLoss.toLocaleString()}` : `-₩${Math.abs(dispSummary.totalGainLoss).toLocaleString()}`}
                </strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--success-light)',
                  color: 'var(--success)',
                  fontWeight: 700,
                  fontSize: '11px'
                }}>
                  ⚖️ 대차 차액 ₩0 (확정 완결)
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 모달 1: 신규 자산 취득 모달 (단건 등록 / 연속 N대 일괄 생성기)            */}
      {/* ========================================================================= */}
      {showAcquireModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            width: '100%',
            maxWidth: '780px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
          }}>
            {/* 모달 헤더 */}
            <div style={{
              padding: '12px 18px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-app)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
                  신규 당사자산 취득 등록
                </h3>
                {/* 모드 전환 탭 */}
                <div style={{ display: 'flex', gap: '2px', backgroundColor: 'var(--bg-card)', padding: '2px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                  <button
                    type="button"
                    onClick={() => setAcquireMode('SINGLE')}
                    style={{
                      padding: '3px 10px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      backgroundColor: acquireMode === 'SINGLE' ? 'var(--primary)' : 'transparent',
                      color: acquireMode === 'SINGLE' ? '#ffffff' : 'var(--text-muted)'
                    }}
                  >
                    단건 등록
                  </button>
                  <button
                    type="button"
                    onClick={() => setAcquireMode('BATCH')}
                    style={{
                      padding: '3px 10px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      backgroundColor: acquireMode === 'BATCH' ? 'var(--primary)' : 'transparent',
                      color: acquireMode === 'BATCH' ? '#ffffff' : 'var(--text-muted)'
                    }}
                  >
                    연속 N대 일괄 생성기
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAcquireModal(false)}
                style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* 모달 본문 (스크롤) */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              {acquireMode === 'SINGLE' ? (
                <form id="singleAcquireForm" onSubmit={handleSingleAcquireSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    
                    {/* 모델 선택 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>제품 모델 선택 *</label>
                      <select
                        value={singleModel}
                        onChange={e => handleModelChangeSingle(e.target.value)}
                        required
                        style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.modelName}>{p.modelName} ({p.manufacturer})</option>
                        ))}
                      </select>
                    </div>

                    {/* 관리번호 & 자동추천 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>관리번호 (Asset No.) *</label>
                        <button
                          type="button"
                          onClick={() => suggestNextAssetNo(singleModel, (no) => setSingleAssetNo(no))}
                          style={{ fontSize: '10px', padding: '1px 5px', border: '1px solid var(--border-color)', borderRadius: '3px', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--primary)' }}
                        >
                          자동추천
                        </button>
                      </div>
                      <input
                        type="text"
                        value={singleAssetNo}
                        onChange={e => setSingleAssetNo(e.target.value)}
                        placeholder="예: SJ19-106"
                        required
                        style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                      />
                    </div>

                    {/* 제조사 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>제조사</label>
                      <input
                        type="text"
                        value={singleManufacturer}
                        onChange={e => setSingleManufacturer(e.target.value)}
                        placeholder="제조사명"
                        style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                      />
                    </div>

                    {/* 제조번호(차대번호) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>제조번호 (차대 시리얼)</label>
                      <input
                        type="text"
                        value={singleSerialNo}
                        onChange={e => setSingleSerialNo(e.target.value)}
                        placeholder="타각 시리얼 번호"
                        style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                      />
                    </div>

                    {/* 연식 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>제조년도 (연식)</label>
                      <input
                        type="text"
                        value={singleManufactureYear}
                        onChange={e => setSingleManufactureYear(e.target.value)}
                        placeholder="예: 2024"
                        style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                      />
                    </div>

                    {/* 취득일자 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>취득 일자 *</label>
                      <input
                        type="date"
                        value={singleAcqDate}
                        onChange={e => setSingleAcqDate(e.target.value)}
                        required
                        style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                      />
                    </div>

                    {/* 취득 금액 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>취득 금액 (공급가액, 원) *</label>
                      <input
                        type="number"
                        value={singleAcqPrice || ''}
                        onChange={e => setSingleAcqPrice(parseInt(e.target.value, 10) || 0)}
                        placeholder="취득 공급가액"
                        required
                        style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                      />
                    </div>

                    {/* 감가상각 개월수 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>내용연수 (개월수) *</label>
                      <input
                        type="number"
                        value={singleDepMonths}
                        onChange={e => setSingleDepMonths(parseInt(e.target.value, 10) || 60)}
                        placeholder="기본 60개월"
                        required
                        style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                      />
                    </div>

                    {/* 잔존가치율 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>잔존가치율 (%) *</label>
                      <input
                        type="number"
                        value={singleResidualRate}
                        onChange={e => setSingleResidualRate(parseFloat(e.target.value) || 10)}
                        placeholder="기본 10%"
                        required
                        style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                      />
                    </div>
                  </div>

                  {/* 공급처 및 증빙 섹션 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '2px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>구입처 (매입 거래처 마스터)</label>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <select
                          value={singleVendorId}
                          onChange={e => {
                            setSingleVendorId(e.target.value);
                            const v = vendors.find(item => item.id === e.target.value);
                            if (v) setSingleSupplierText(v.name);
                          }}
                          style={{ flex: 1, padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                        >
                          <option value="">-- 매입처 마스터 선택 --</option>
                          {vendors.map(v => (
                            <option key={v.id} value={v.id}>{v.name} ({v.type})</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={singleSupplierText}
                          onChange={e => setSingleSupplierText(e.target.value)}
                          placeholder="직접 입력"
                          style={{ flex: 1, padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>안전인증 / 검사증명서 URL</label>
                      <input
                        type="url"
                        value={singleSafetyUrl}
                        onChange={e => setSingleSafetyUrl(e.target.value)}
                        placeholder="https://... (클라우드 파일 경로)"
                        style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>비고 (특기사항 및 세금계산서 승인번호)</label>
                    <input
                      type="text"
                      value={singleMemo}
                      onChange={e => setSingleMemo(e.target.value)}
                      placeholder="매입 세금계산서 승인번호, 배터리 사양 등 기재"
                      style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                    />
                  </div>
                </form>
              ) : (
                /* N대 연속 일괄 생성기 폼 */
                <form id="batchAcquireForm" onSubmit={handleBatchAcquireSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{
                    padding: '10px 14px',
                    backgroundColor: 'var(--bg-app)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '11.5px',
                    color: 'var(--text-secondary)'
                  }}>
                    💡 동일 모델 장비를 묶음(Lot)으로 대량 도입할 때, 시작 관리번호와 도입 수량만 입력하면 N대 슬롯이 실시간 자동 생성됩니다.
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>제품 모델 선택 *</label>
                      <select
                        value={batchModel}
                        onChange={e => handleModelChangeBatch(e.target.value)}
                        required
                        style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.modelName}>{p.modelName}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>번호 접두사 *</label>
                      <input
                        type="text"
                        value={batchPrefix}
                        onChange={e => setBatchPrefix(e.target.value)}
                        placeholder="예: SJ19-"
                        required
                        style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>시작 번호 (숫자) *</label>
                      <input
                        type="number"
                        value={batchStartNum}
                        onChange={e => setBatchStartNum(parseInt(e.target.value, 10) || 1)}
                        required
                        style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>도입 수량 (대) *</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={batchQty}
                        onChange={e => setBatchQty(parseInt(e.target.value, 10) || 1)}
                        required
                        style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>대당 취득가액 (원) *</label>
                      <input
                        type="number"
                        value={batchUnitPrice || ''}
                        onChange={e => setBatchUnitPrice(parseInt(e.target.value, 10) || 0)}
                        placeholder="대당 공급가액"
                        required
                        style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>취득 일자 *</label>
                      <input
                        type="date"
                        value={batchAcqDate}
                        onChange={e => setBatchAcqDate(e.target.value)}
                        required
                        style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>내용연수 (개월)</label>
                      <input
                        type="number"
                        value={batchDepMonths}
                        onChange={e => setBatchDepMonths(parseInt(e.target.value, 10) || 60)}
                        style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>공급처 (구입처)</label>
                      <input
                        type="text"
                        value={batchSupplierText}
                        onChange={e => setBatchSupplierText(e.target.value)}
                        placeholder="예: 스카이잭코리아"
                        style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                      />
                    </div>
                  </div>

                  {/* 일괄 생성 대상 실시간 슬롯 미리보기 테이블 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)' }}>
                        생성 대상 장비 목록 ({batchGeneratedSlots.length}대)
                      </label>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        * 차대번호는 비워두거나 인라인으로 입력할 수 있습니다.
                      </span>
                    </div>

                    <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '5px 8px', width: '40px', textAlign: 'center' }}>No</th>
                            <th style={{ padding: '5px 8px' }}>관리번호</th>
                            <th style={{ padding: '5px 8px' }}>모델명</th>
                            <th style={{ padding: '5px 8px' }}>차대 시리얼번호 (선택)</th>
                            <th style={{ padding: '5px 8px', width: '80px', textAlign: 'center' }}>상태 검증</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batchGeneratedSlots.map((slot, idx) => (
                            <tr key={slot.assetNo} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '4px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                              <td style={{ padding: '4px 8px', fontWeight: 700, color: slot.isDup ? 'var(--danger)' : 'var(--text-main)' }}>
                                {slot.assetNo}
                              </td>
                              <td style={{ padding: '4px 8px' }}>{batchModel}</td>
                              <td style={{ padding: '3px 8px' }}>
                                <input
                                  type="text"
                                  placeholder="시리얼 입력"
                                  value={batchCustomSerials[slot.assetNo] || ''}
                                  onChange={e => setBatchCustomSerials({ ...batchCustomSerials, [slot.assetNo]: e.target.value })}
                                  style={{ padding: '2px 6px', fontSize: '11px', width: '100%', borderRadius: '3px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                                />
                              </td>
                              <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                                {slot.isDup ? (
                                  <span className="badge badge-danger" style={{ fontSize: '10px' }}>중복 오류</span>
                                ) : (
                                  <span className="badge badge-success" style={{ fontSize: '10px' }}>생성 가능</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* 모달 푸터 */}
            <div style={{
              padding: '10px 18px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-app)'
            }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                {acquireMode === 'SINGLE' ? '* 취득 확정 시 자산 대장 및 감사 타임라인에 무누락 저장됩니다.' : `* 총 ${batchGeneratedSlots.length}대가 일괄 생성됩니다.`}
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAcquireModal(false)}
                  style={{ padding: '5px 14px', fontSize: '12px' }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  form={acquireMode === 'SINGLE' ? 'singleAcquireForm' : 'batchAcquireForm'}
                  className="btn-primary"
                  style={{ padding: '5px 16px', fontSize: '12px', fontWeight: 700 }}
                >
                  {acquireMode === 'SINGLE' ? '자산 취득 확정' : `${batchGeneratedSlots.length}대 일괄 취득 확정`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 모달 2: 기존 장비 자산 매각 처리 모달                                    */}
      {/* ========================================================================= */}
      {showDisposeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            width: '100%',
            maxWidth: '620px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              padding: '12px 18px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-app)'
            }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
                기존 장비 자산 매각 처리
              </h3>
              <button
                type="button"
                onClick={() => setShowDisposeModal(false)}
                style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDisposeSubmit} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>매각 대상 자산 선택 *</label>
                <select
                  value={selectedAssetIdToDispose}
                  onChange={e => setSelectedAssetIdToDispose(e.target.value)}
                  required
                  style={{ padding: '6px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                >
                  <option value="">-- 매각 가능한 대기 장비 선택 (AVAILABLE 상태) --</option>
                  {assets.filter(a => a.ownerType === 'OWNED' && a.status === 'AVAILABLE').map(a => {
                    const dep = calculateAssetDepreciation(a);
                    return (
                      <option key={a.id} value={a.id}>
                        [{a.assetNo}] {a.modelName} (장부가치: ₩{dep.bookValue.toLocaleString()})
                      </option>
                    );
                  })}
                </select>
                <small style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>
                  * 현재 임대중이거나 수리중인 자산은 매각할 수 없습니다.
                </small>
              </div>

              {activeAssetToDispose && disposalDepInfo && (
                <div style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-app)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                  fontSize: '11.5px'
                }}>
                  <div>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>취득원가</span>
                    <div><strong>₩{(activeAssetToDispose.acquisitionPrice || 0).toLocaleString()}</strong></div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>감가상각누계액</span>
                    <div><strong style={{ color: 'var(--danger)' }}>-₩{disposalDepInfo.accumDepreciation.toLocaleString()}</strong></div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>매각시점 장부가액</span>
                    <div><strong style={{ color: 'var(--success)', fontSize: '13px' }}>₩{disposalDepInfo.bookValue.toLocaleString()}</strong></div>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>매각 일자 *</label>
                  <input
                    type="date"
                    value={disposalDate}
                    onChange={e => setDisposalDate(e.target.value)}
                    required
                    style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>매각 가격 (공급가, 원) *</label>
                  <input
                    type="number"
                    value={disposalPrice || ''}
                    onChange={e => setDisposalPrice(parseInt(e.target.value, 10) || 0)}
                    placeholder="매각 금액"
                    required
                    style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>청구 귀속월 *</label>
                  <input
                    type="month"
                    value={disposalBillingYm}
                    onChange={e => setDisposalBillingYm(e.target.value)}
                    required
                    style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              {/* 실시간 처분손익 프리뷰 카드 */}
              {activeAssetToDispose && (
                <div style={{
                  padding: '8px 12px',
                  backgroundColor: realTimeGainLoss >= 0 ? 'var(--success-light)' : 'var(--danger-light)',
                  border: `1px solid ${realTimeGainLoss >= 0 ? 'var(--success)' : 'var(--danger)'}`,
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: realTimeGainLoss >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {realTimeGainLoss >= 0 ? '🟢 유형자산처분이익' : '🔴 유형자산처분손실'}
                  </span>
                  <strong style={{ fontSize: '14px', color: realTimeGainLoss >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {realTimeGainLoss >= 0 ? `+₩${realTimeGainLoss.toLocaleString()}` : `-₩${Math.abs(realTimeGainLoss).toLocaleString()}`}
                  </strong>
                </div>
              )}

              {/* 매각처 선택 (고객사 마스터 연동) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>매각처 (인수 고객명) *</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setBuyerType('EXISTING')}
                      style={{
                        fontSize: '10.5px',
                        padding: '1px 6px',
                        border: 'none',
                        backgroundColor: buyerType === 'EXISTING' ? 'var(--primary)' : 'transparent',
                        color: buyerType === 'EXISTING' ? '#ffffff' : 'var(--text-muted)',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >
                      기존 거래처
                    </button>
                    <button
                      type="button"
                      onClick={() => setBuyerType('MANUAL')}
                      style={{
                        fontSize: '10.5px',
                        padding: '1px 6px',
                        border: 'none',
                        backgroundColor: buyerType === 'MANUAL' ? 'var(--primary)' : 'transparent',
                        color: buyerType === 'MANUAL' ? '#ffffff' : 'var(--text-muted)',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >
                      신규 직접입력
                    </button>
                  </div>
                </div>

                {buyerType === 'EXISTING' ? (
                  <select
                    value={selectedCustomerId}
                    onChange={e => setSelectedCustomerId(e.target.value)}
                    required
                    style={{ padding: '6px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  >
                    <option value="">-- 매각 대상 고객사 선택 --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.representative || '대표자미지정'})</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={manualBuyerName}
                    onChange={e => setManualBuyerName(e.target.value)}
                    placeholder="신규 매각처 상호명 입력"
                    required
                    style={{ padding: '6px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                )}
                <small style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>
                  * 선택하신 매각처로 매각대금 매출 청구서가 자동 생성됩니다.
                </small>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', paddingTop: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowDisposeModal(false)}
                  style={{ padding: '5px 14px', fontSize: '12px' }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn-danger"
                  style={{ padding: '5px 16px', fontSize: '12px', fontWeight: 700 }}
                >
                  매각 처리 및 매출청구 발행
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 모달 3: 엑셀 일괄 업로드 모달                                            */}
      {/* ========================================================================= */}
      {showExcelUploadModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            width: '100%',
            maxWidth: '820px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              padding: '12px 18px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-app)'
            }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
                당사자산 엑셀 일괄 업로드
              </h3>
              <button
                type="button"
                onClick={() => { setShowExcelUploadModal(false); setExcelParsedRows([]); }}
                style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
              <div style={{
                padding: '12px 16px',
                border: '1px dashed var(--border-color)',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-app)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-main)' }}>엑셀 표준 서식 양식 다운로드</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>규격화된 서식을 내려받아 작성 후 업로드하세요.</div>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleDownloadTemplate}
                  style={{ padding: '4px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Download size={12} /> 서식 다운로드 (.xlsx)
                </button>
              </div>

              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".xlsx, .xls, .csv"
                  style={{ fontSize: '12px' }}
                />
              </div>

              {excelParsedRows.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                      업로드 데이터 검증 결과: 총 {excelParsedRows.length}건 (유효: {excelParsedRows.filter(r => r.isValid).length}건)
                    </span>
                  </div>

                  <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ padding: '5px 8px', width: '35px', textAlign: 'center' }}>행</th>
                          <th style={{ padding: '5px 8px' }}>관리번호</th>
                          <th style={{ padding: '5px 8px' }}>모델명</th>
                          <th style={{ padding: '5px 8px' }}>시리얼번호</th>
                          <th style={{ padding: '5px 8px' }}>취득일자</th>
                          <th style={{ padding: '5px 8px', textAlign: 'right' }}>취득원가</th>
                          <th style={{ padding: '5px 8px' }}>구입처</th>
                          <th style={{ padding: '5px 8px', textAlign: 'center' }}>유효성</th>
                        </tr>
                      </thead>
                      <tbody>
                        {excelParsedRows.map((r) => (
                          <tr key={r.rowIdx} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: !r.isValid ? 'var(--danger-light)' : 'transparent' }}>
                            <td style={{ padding: '4px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>{r.rowIdx}</td>
                            <td style={{ padding: '4px 8px', fontWeight: 700, color: r.isDup ? 'var(--danger)' : 'var(--text-main)' }}>{r.assetNo}</td>
                            <td style={{ padding: '4px 8px' }}>{r.modelName}</td>
                            <td style={{ padding: '4px 8px' }}>{r.serialNo || '-'}</td>
                            <td style={{ padding: '4px 8px' }}>{r.acquisitionDate}</td>
                            <td style={{ padding: '4px 8px', textAlign: 'right' }}>₩{r.acquisitionPrice.toLocaleString()}</td>
                            <td style={{ padding: '4px 8px' }}>{r.supplier || '-'}</td>
                            <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                              {r.isValid ? (
                                <span className="badge badge-success" style={{ fontSize: '10px' }}>정상</span>
                              ) : (
                                <span className="badge badge-danger" style={{ fontSize: '10px' }}>
                                  {r.isDup ? '중복번호' : '필수값 누락'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div style={{
              padding: '10px 18px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '6px',
              backgroundColor: 'var(--bg-app)'
            }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setShowExcelUploadModal(false); setExcelParsedRows([]); }}
                style={{ padding: '5px 14px', fontSize: '12px' }}
              >
                닫기
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleCommitExcelUpload}
                disabled={excelParsedRows.filter(r => r.isValid).length === 0}
                style={{ padding: '5px 16px', fontSize: '12px', fontWeight: 700 }}
              >
                유효 데이터 {excelParsedRows.filter(r => r.isValid).length}건 취득 확정
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 서랍형 상세 Dossier 슬라이드오버 (선택 자산 제원 및 감사 이력 타임라인)   */}
      {/* ========================================================================= */}
      {selectedAssetForDossier && (() => {
        const a = selectedAssetForDossier;
        const dep = calculateAssetDepreciation(a);
        const prod = products.find(p => p.modelName === a.modelName);
        const assetLogs = assetInOutLogs.filter(l => l.assetId === a.id);

        return (
          <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '460px',
            backgroundColor: 'var(--bg-card)',
            borderLeft: '1px solid var(--border-color)',
            boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideLeft 0.2s ease-in-out'
          }}>
            {/* 헤더 */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-app)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
                  [{a.assetNo}] 상세 제원 및 감사 증빙
                </span>
                {renderStatusBadge(a.status)}
              </div>
              <button
                onClick={() => setSelectedAssetForDossier(null)}
                style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* 본문 스크롤 */}
            <div style={{ padding: '16px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '12px' }}>
              
              {/* 기본 제원 섹션 */}
              <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>장비 물리 제원 정보</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11.5px' }}>
                  <div><span style={{ color: 'var(--text-secondary)' }}>모델명:</span> <strong>{a.modelName}</strong></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>제조사:</span> {a.manufacturer || '-'}</div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>시리얼번호:</span> {a.serialNo || '-'}</div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>제조년도:</span> {a.manufactureYear || '-'}</div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>작업높이:</span> {prod?.workingHeight || '-'}</div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>동력원:</span> {prod?.powerSource || '-'}</div>
                </div>
              </div>

              {/* 회계 및 감가상각 원장 */}
              <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>회계 및 감가상각 현황</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11.5px' }}>
                  <div><span style={{ color: 'var(--text-secondary)' }}>취득일자:</span> {a.acquisitionDate || '-'}</div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>취득원가:</span> <strong>₩{(a.acquisitionPrice || 0).toLocaleString()}</strong></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>내용연수:</span> {a.depreciationMonths || 60}개월</div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>월 상각액:</span> ₩{Math.round(dep.monthlyDepreciation).toLocaleString()}</div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>감가누계액:</span> <span style={{ color: 'var(--danger)' }}>-₩{dep.accumDepreciation.toLocaleString()}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>현재 장부가:</span> <span style={{ color: 'var(--success)', fontWeight: 700 }}>₩{dep.bookValue.toLocaleString()}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>구입처:</span> {a.supplier || '-'}</div>
                </div>
              </div>

              {/* 감사 증빙 서류 */}
              <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>감사 증빙 및 안전 서류</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>안전인증 / 검사증명서:</span>
                    {a.safetyInspectionUrl ? (
                      <a
                        href={a.safetyInspectionUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'underline' }}
                      >
                        증빙 열기 <ExternalLink size={11} />
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>미등록</span>
                    )}
                  </div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>특기 비고:</span> {a.memo1 || '-'}</div>
                </div>
              </div>

              {/* 감사 이력 타임라인 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>자산 라이프사이클 감사 로그 ({assetLogs.length}건)</div>
                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {assetLogs.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', padding: '10px 0', textAlign: 'center' }}>기록된 이벤트 로그가 없습니다.</div>
                  ) : (
                    assetLogs.map(log => (
                      <div
                        key={log.id}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--bg-app)',
                          border: '1px solid var(--border-color)',
                          fontSize: '11px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className={`badge ${log.type === 'ACQUISITION' ? 'badge-info' : log.type === 'OUTBOUND' ? 'badge-primary' : log.type === 'INBOUND' ? 'badge-success' : log.type === 'DISPOSAL' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '10px' }}>
                            {log.type}
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>{log.eventDate || log.createdAt?.slice(0, 10)}</span>
                        </div>
                        <div style={{ color: 'var(--text-main)', marginTop: '2px' }}>{log.memo || '-'}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* 푸터 */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedAssetForDossier(null)}
                style={{ padding: '5px 14px', fontSize: '12px' }}
              >
                닫기
              </button>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
