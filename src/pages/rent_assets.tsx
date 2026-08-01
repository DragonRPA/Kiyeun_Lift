// src/pages/rent_assets.tsx
import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Plus, CheckCircle, Search, AlertTriangle, Download, Clock, Layers, 
  ShieldAlert, Upload, FileSpreadsheet, RefreshCw, FileText, Check, ArrowRight, XCircle, CreditCard
} from 'lucide-react';
import { Asset, db, PurchaseSettlement, PurchaseSettlementItem, Delivery } from '../services/db';
import { exportToExcel } from '../services/excel';
import * as XLSX from 'xlsx';

// 원사 거래명세서 파싱 레코드 인터페이스
export interface VendorStatementRow {
  id: string;
  assetNo: string;
  serialNo?: string;
  modelName?: string;
  rentStart: string;
  rentEnd: string;
  billedAmount: number;
  memo?: string;
}

// 5대 대사 결과 항목 인터페이스
export type ReconcileStatusKey = 'MATCHED' | 'PRICE_MISMATCH' | 'PERIOD_MISMATCH' | 'UNREGISTERED' | 'MISSING_BILLING';

export interface ReconcileResultItem {
  id: string;
  status: ReconcileStatusKey;
  statusLabel: string;
  badgeClass: string;
  statementRow?: VendorStatementRow; // 원사 청구 행
  matchedAsset?: Asset; // 자사 DB 매칭 자산
  priceDiff: number; // 원사청구액 - 자사약정액 (양수: 원사 과다청구, 음수: 원사 할인)
  expectedAmount: number; // 자사 DB 기준 약정 금액
  reason: string;
}

export const RentAssets: React.FC = () => {
  const { 
    assets, products, customers, vendors, registerRentedAsset, returnRentedAsset, 
    hasPermission
  } = useApp();
  
  const canSave = hasPermission('rent_asset', 'save');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 대사 상세 모달 상태 (임차처 거래명세서 원본 vs 자사 DB 1:1 대비)
  const [selectedReconcileDetail, setSelectedReconcileDetail] = useState<ReconcileResultItem | null>(null);

  // 활성화 탭 상태: CURRENT (임차자산 대장 & 반납 현황 관리 - 기본 메인), RECONCILIATION (임차처 거래명세서 대사 & 매입 정산)
  const [activeTab, setActiveTab] = useState<'CURRENT' | 'RECONCILIATION'>('CURRENT');

  // ==========================================
  // [탭 2] 임차처 거래명세서 대사 (Reconciliation) 관련 상태
  // ==========================================
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [selectedYm, setSelectedYm] = useState<string>(new Date().toISOString().slice(0, 7));
  const [statementRows, setStatementRows] = useState<VendorStatementRow[]>([]);
  const [selectedReconcileIds, setSelectedReconcileIds] = useState<string[]>([]);
  const [isSettling, setIsSettling] = useState<boolean>(false);

  // 임차 자산(ownerType === 'RENTED') 전체 리스트
  const rentedAssets = assets.filter(a => a.ownerType === 'RENTED');

  // 등록된 임차처(임차거래처) 목록 (알파벳/한글 오름차순 정렬)
  const renterVendors = React.useMemo(() => {
    const rentalVendorNames = vendors
      .filter(v => v.type === 'RENTAL' || (v.types && v.types.includes('RENTAL')))
      .map(v => v.name)
      .filter(Boolean);

    const existingRenters = rentedAssets.map(a => a.renter).filter(Boolean) as string[];
    const combined = Array.from(new Set([...rentalVendorNames, ...existingRenters]));
    return combined.sort((a, b) => a.localeCompare(b));
  }, [vendors, rentedAssets]);

  // 1:1 대사 계산 엔진 (3단계 스마트 매칭 & 5대 교차 검증)
  const reconcileResults: ReconcileResultItem[] = React.useMemo(() => {
    const results: ReconcileResultItem[] = [];
    const matchedAssetIds = new Set<string>();

    // 문자열 공백/하이픈/소문자 통일 정화 헬퍼
    const cleanStr = (s?: string) => (s || '').replace(/[\s\-_]/g, '').toLowerCase();

    // A. 원사 청구 명세서 행 기준으로 자사 DB 자산 대조 (3단계 매칭)
    statementRows.forEach((row, idx) => {
      // 1단계: 관리번호 또는 시리얼번호 정밀 매칭
      let matched = rentedAssets.find(a => 
        (a.assetNo && cleanStr(a.assetNo) === cleanStr(row.assetNo)) ||
        (a.serialNo && row.serialNo && cleanStr(a.serialNo) === cleanStr(row.serialNo))
      );

      // 2단계: 관리번호 불일치 시 [모델명 + 임차처(원사)] 조합 2차 자동 추적
      if (!matched && row.modelName) {
        matched = rentedAssets.find(a => 
          cleanStr(a.modelName) === cleanStr(row.modelName) &&
          (!selectedVendor || cleanStr(a.renter) === cleanStr(selectedVendor)) &&
          !matchedAssetIds.has(a.id)
        );
      }

      if (!matched) {
        // 🔴 미등록 청구 (자사 DB에 없는 장비)
        results.push({
          id: `recon-unreg-${idx}`,
          status: 'UNREGISTERED',
          statusLabel: '미등록 청구',
          badgeClass: 'badge-danger',
          statementRow: row,
          priceDiff: row.billedAmount,
          expectedAmount: 0,
          reason: '자사 DB 자산대장에 존재하지 않는 장비입니다. (유령 청구 위험)'
        });
      } else {
        matchedAssetIds.add(matched.id);

        // 일할/월할 약정 금액 계산 (자사 DB 기준)
        const expected = matched.monthlyRentFee || 0;
        const diff = row.billedAmount - expected;

        // 기간 대조
        const isPeriodMismatch = (matched.rentStart && matched.rentStart !== row.rentStart) ||
                                 (matched.rentEnd && matched.rentEnd !== row.rentEnd);

        if (isPeriodMismatch) {
          // 🟠 기간 불일치
          results.push({
            id: `recon-period-${idx}`,
            status: 'PERIOD_MISMATCH',
            statusLabel: '기간 불일치',
            badgeClass: 'badge-warning',
            statementRow: row,
            matchedAsset: matched,
            priceDiff: diff,
            expectedAmount: expected,
            reason: `자사 계약기간(${matched.rentStart || '~'}~${matched.rentEnd || '~'})과 임차처 청구기간이 다릅니다.`
          });
        } else if (Math.abs(diff) > 1000) {
          // 🟡 단가/금액 오차
          results.push({
            id: `recon-price-${idx}`,
            status: 'PRICE_MISMATCH',
            statusLabel: '금액 오차',
            badgeClass: 'badge-info',
            statementRow: row,
            matchedAsset: matched,
            priceDiff: diff,
            expectedAmount: expected,
            reason: diff > 0 ? `임차처 청구가 자사 약정액보다 ${diff.toLocaleString()}원 과다 청구됨.` : `임차처 임의 할인 적용 (${Math.abs(diff).toLocaleString()}원 차감).`
          });
        } else {
          // 🟢 완벽 일치
          results.push({
            id: `recon-match-${idx}`,
            status: 'MATCHED',
            statusLabel: '완벽 일치',
            badgeClass: 'badge-success',
            statementRow: row,
            matchedAsset: matched,
            priceDiff: 0,
            expectedAmount: expected,
            reason: '임차처 청구 금액 및 임차 기간이 자사 등록 정보와 100% 일치합니다.'
          });
        }
      }
    });

    // B. 선택된 임차처의 자사 임차 자산 중 당월 1일 이상 존재했으나 청구 누락된 장비 추출
    const [yearStr, monthStr] = selectedYm.split('-');
    const yearNum = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);
    const monthStart = `${selectedYm}-01`;
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const monthEnd = `${selectedYm}-${String(daysInMonth).padStart(2, '0')}`;

    const targetRented = rentedAssets.filter(a => {
      const matchesVendor = !selectedVendor || a.renter === selectedVendor;
      const assetStart = a.rentStart || '1900-01-01';
      const assetEnd = a.actualRentReturnDate || a.rentEnd || '9999-12-31';
      const isOverlapped = (assetStart <= monthEnd) && (assetEnd >= monthStart);
      return matchesVendor && isOverlapped;
    });

    targetRented.forEach(asset => {
      if (!matchedAssetIds.has(asset.id)) {
        // 🔵 청구 누락 자산
        results.push({
          id: `recon-missing-${asset.id}`,
          status: 'MISSING_BILLING',
          statusLabel: '청구 누락',
          badgeClass: 'badge-secondary',
          matchedAsset: asset,
          priceDiff: -(asset.monthlyRentFee || 0),
          expectedAmount: asset.monthlyRentFee || 0,
          reason: '자사 대장에는 임차 가동 중이나, 임차처 거래명세서 청구 항목에서 누락되었습니다.'
        });
      }
    });

    return results;
  }, [statementRows, rentedAssets, selectedVendor]);

  // 대사 통계 KPI
  const statsRecon = React.useMemo(() => {
    const totalCount = statementRows.length;
    const totalBilled = statementRows.reduce((sum, r) => sum + r.billedAmount, 0);
    const matchedCount = reconcileResults.filter(r => r.status === 'MATCHED').length;
    const priceMismatchCount = reconcileResults.filter(r => r.status === 'PRICE_MISMATCH').length;
    const periodMismatchCount = reconcileResults.filter(r => r.status === 'PERIOD_MISMATCH').length;
    const unregisteredCount = reconcileResults.filter(r => r.status === 'UNREGISTERED').length;
    const missingCount = reconcileResults.filter(r => r.status === 'MISSING_BILLING').length;
    const totalDiffAmount = reconcileResults.reduce((sum, r) => sum + r.priceDiff, 0);

    return { totalCount, totalBilled, matchedCount, priceMismatchCount, periodMismatchCount, unregisteredCount, missingCount, totalDiffAmount };
  }, [statementRows, reconcileResults]);

  // 엑셀 업로드 처리 핸들러
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawRows = XLSX.utils.sheet_to_json<any>(worksheet, { defval: '' });

        const parsedRows: VendorStatementRow[] = rawRows.map((r, i) => {
          const assetNo = (r['관리번호'] || r['자산번호'] || r['assetNo'] || r['장비번호'] || '').toString().trim();
          const serialNo = (r['제조번호'] || r['시리얼'] || r['serialNo'] || '').toString().trim();
          const modelName = (r['모델명'] || r['modelName'] || '').toString().trim();
          const rentStart = (r['임차시작일'] || r['시작일'] || r['rentStart'] || '').toString().trim();
          const rentEnd = (r['임차종료일'] || r['종료일'] || r['rentEnd'] || '').toString().trim();
          const billedAmount = Number(r['청구금액'] || r['임차료'] || r['billedAmount'] || 0);
          const memo = (r['비고'] || r['memo'] || '').toString().trim();

          return {
            id: `stmt-${i}-${Date.now()}`,
            assetNo: assetNo || `R-${1000 + i}`,
            serialNo,
            modelName,
            rentStart: rentStart || `${selectedYm}-01`,
            rentEnd: rentEnd || `${selectedYm}-28`,
            billedAmount,
            memo
          };
        }).filter(row => Boolean(row.assetNo));

        setStatementRows(parsedRows);
        setSelectedReconcileIds(parsedRows.map(r => r.id));
        alert(`✅ 원사 거래명세서 ${parsedRows.length}건이 성공적으로 업로드 및 대사 처리되었습니다.`);
      } catch (err: any) {
        alert(`⚠️ 엑셀 파일 읽기 오류: ${err?.message || err}`);
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 샘플 거래명세서 빠른 생성 (데모 시연용 - 선택된 임차처 우선 반영)
  const handleLoadSampleStatement = () => {
    const targetAssets = selectedVendor 
      ? rentedAssets.filter(a => a.renter === selectedVendor)
      : rentedAssets;

    if (targetAssets.length === 0 && rentedAssets.length === 0) {
      alert('등록된 자사 임차자산이 없습니다. 먼저 임차자산을 등록하거나 테스트 데모 데이터를 사용해주세요.');
      return;
    }

    const assetsToUse = targetAssets.length > 0 ? targetAssets : rentedAssets;

    const samples: VendorStatementRow[] = assetsToUse.slice(0, 5).map((a, idx) => {
      // 데모를 위해 의도적으로 금액 오차 1건 생성
      const billed = idx === 1 ? (a.monthlyRentFee || 300000) + 50000 : (a.monthlyRentFee || 300000);
      return {
        id: `sample-${idx}`,
        assetNo: a.assetNo,
        serialNo: a.serialNo,
        modelName: a.modelName,
        rentStart: a.rentStart || `${selectedYm}-01`,
        rentEnd: a.rentEnd || `${selectedYm}-28`,
        billedAmount: billed,
        memo: idx === 1 ? '원사 청구 단가 인상분 반영' : '정상 월 임차료'
      };
    });

    // 🔴 1건의 유령 청구 미등록 자산 추가
    samples.push({
      id: `sample-ghost`,
      assetNo: 'R-GHOST-99',
      serialNo: 'SN-UNKNOWN-999',
      modelName: 'S-1212 (유령장비)',
      rentStart: `${selectedYm}-01`,
      rentEnd: `${selectedYm}-28`,
      billedAmount: 450000,
      memo: '자사 대장에 없는 원사 단독 청구 건'
    });

    setStatementRows(samples);
    setSelectedReconcileIds(samples.map(s => s.id));
  };

  // 대사 양식 다운로드
  const handleDownloadTemplate = () => {
    const templateData = [
      { 관리번호: 'R-001', 제조번호: 'SN-12345', 모델명: 'S-1212', 임차시작일: '2026-08-01', 임차종료일: '2026-08-31', 청구금액: 350000, 비고: '월 정기 임차료' },
      { 관리번호: 'R-002', 제조번호: 'SN-67890', 모델명: 'Z-3422', 임차시작일: '2026-08-01', 임차종료일: '2026-08-31', 청구금액: 400000, 비고: '월 정기 임차료' }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '원사_거래명세서_양식');
    XLSX.writeFile(wb, '원사_임차료_거래명세서_대사양식.xlsx');
  };

  // 선택된 대사 항목만 부분 매입 정산 1-Click 확정 처리
  const handleConfirmPurchaseSettlement = async () => {
    if (!canSave) {
      alert('매입 정산 승인 권한이 없습니다.');
      return;
    }

    // 선택된 ID에 해당하는 명세서 행 추출
    const targetRows = statementRows.filter(r => selectedReconcileIds.includes(r.id));

    if (targetRows.length === 0) {
      alert('매입 정산을 승인할 선택 항목이 없습니다. 대사 테이블에서 체크박스를 선택해주세요.');
      return;
    }

    const partialTotalBilled = targetRows.reduce((sum, r) => sum + r.billedAmount, 0);
    const unselectedCount = statementRows.length - targetRows.length;
    const vendorName = selectedVendor || (targetRows[0]?.assetNo ? (rentedAssets.find(a => a.assetNo === targetRows[0].assetNo)?.renter || '기타 원사') : '기타 원사');

    const confirmMsg = `[부분 매입 정산 확정 승인]\n\n- 선택 승인 대상: ${targetRows.length}건 (전체 ${statementRows.length}건 중)\n- 보류/미승인 유지: ${unselectedCount}건\n- 정산월: ${selectedYm}\n- 거래처: ${vendorName}\n- 선택 확정 청구액: ${partialTotalBilled.toLocaleString()}원\n\n선택한 ${targetRows.length}건만 부분 매입 정산 대장으로 전송하시겠습니까?\n(미선택된 ${unselectedCount}건은 '보류' 상태로 남아 후속 조정이 가능합니다.)`;

    if (!window.confirm(confirmMsg)) return;

    setIsSettling(true);
    try {
      const nowStr = new Date().toISOString();

      // 1. PurchaseSettlement 레코드 생성 (선택 정산액 기준)
      const settlement = db.insertRow<PurchaseSettlement>('purchaseSettlements', {
        settlementYm: selectedYm,
        settlementType: 'EQUIPMENT_LEASE',
        vendorName: vendorName,
        totalAmount: partialTotalBilled,
        paidAmount: 0,
        status: 'CONFIRMED',
        confirmedAt: nowStr,
        memo: `[부분정산 확정] ${targetRows.length}건 부분 승인 (보류 ${unselectedCount}건 제외)`,
        createdAt: nowStr,
        updatedAt: nowStr
      });

      // 2. 선택된 행들만 PurchaseSettlementItem 생성
      targetRows.forEach(row => {
        const matched = rentedAssets.find(a => a.assetNo === row.assetNo);
        db.insertRow<PurchaseSettlementItem>('purchaseSettlementItems', {
          settlementId: settlement.id,
          sourceType: 'EQUIPMENT_LEASE',
          sourceId: matched ? matched.id : row.assetNo,
          itemDescription: `[임차료 부분승인] ${row.modelName || row.assetNo} (${row.rentStart}~${row.rentEnd})`,
          quantity: 1,
          unitPrice: row.billedAmount,
          amount: row.billedAmount,
          createdAt: nowStr
        });
      });

      await db.awaitPendingWrites();
      alert(`✅ 선택한 ${targetRows.length}건(${partialTotalBilled.toLocaleString()}원)의 부분 매입 정산 승인이 완료되었습니다!\n(미선택된 ${unselectedCount}건은 '보류' 상태로 계속 유지됩니다.)`);
      
      // 승인 완료된 행만 제거하고 미승인(보류) 행은 잔여 유지
      const remainingRows = statementRows.filter(r => !selectedReconcileIds.includes(r.id));
      setStatementRows(remainingRows);
      setSelectedReconcileIds([]);
    } catch (err: any) {
      alert(`⚠️ 부분 매입 정산 승인 오류: ${err?.message || err}`);
    } finally {
      setIsSettling(false);
    }
  };

  // ==========================================
  // [탭 2] 임차자산 대장 현황 (Current Assets) 관련 상태
  // ==========================================
  const [searchQuery, setSearchQuery] = useState('');
  const [renterQuery, setRenterQuery] = useState('');
  const [startDateQuery, setStartDateQuery] = useState('');
  const [endDateQuery, setEndDateQuery] = useState('');
  const [returnQuery, setReturnQuery] = useState('ALL');

  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Partial<Asset> | null>(null);

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnAssetId, setReturnAssetId] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);

  // 반납 배차 옵션 상태
  const [isDispatchRequested, setIsDispatchRequested] = useState(false);
  const [returnOrigin, setReturnOrigin] = useState('');
  const [returnDestination, setReturnDestination] = useState('');
  const [returnVehicleType, setReturnVehicleType] = useState('3.5T');
  const [returnCost, setReturnCost] = useState(70000);

  const filteredAssets = rentedAssets.filter(a => {
    const matchesSearch = a.assetNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          a.modelName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRenter = !renterQuery || (a.renter && a.renter.toLowerCase().includes(renterQuery.toLowerCase()));
    const matchesStartDate = !startDateQuery || (a.rentEnd && a.rentEnd >= startDateQuery);
    const matchesEndDate = !endDateQuery || (a.rentStart && a.rentStart <= endDateQuery);
    const matchesReturn = returnQuery === 'ALL' ? true :
                          returnQuery === 'RETURNED' ? a.status === 'RENTED_RETURNED' :
                          a.status !== 'RENTED_RETURNED';

    return matchesSearch && matchesRenter && matchesStartDate && matchesEndDate && matchesReturn;
  });

  // 모델명 알파벳/한글 오름차순 정렬
  const sortedProducts = React.useMemo(() => {
    return [...products].sort((a, b) => (a.modelName || '').localeCompare(b.modelName || ''));
  }, [products]);

  // 임차 만료예정일 자동 계산 헬퍼 (시작일로부터 30일 뒤)
  const calcRentEnd = (startStr: string): string => {
    if (!startStr) return '';
    const d = new Date(startStr);
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  };

  // 반납 지연일 및 초과 검사 헬퍼
  const calculateDelayDays = (asset: Asset): number => {
    if (!asset.rentEnd) return 0;
    const plannedEnd = new Date(asset.rentEnd);
    const actualEnd = asset.actualRentReturnDate ? new Date(asset.actualRentReturnDate) : new Date();
    plannedEnd.setHours(0,0,0,0);
    actualEnd.setHours(0,0,0,0);
    const diffTime = actualEnd.getTime() - plannedEnd.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const isSubleaseOverdue = (asset: Asset): boolean => {
    if (!asset.rentEnd || !asset.contractEnd) return false;
    const leaseEnd = new Date(asset.rentEnd);
    const subleaseEnd = new Date(asset.contractEnd);
    leaseEnd.setHours(0,0,0,0);
    subleaseEnd.setHours(0,0,0,0);
    return subleaseEnd.getTime() > leaseEnd.getTime();
  };

  const handleOpenAdd = () => {
    const today = new Date().toISOString().split('T')[0];
    setEditingAsset({
      modelName: sortedProducts[0]?.modelName || '',
      assetNo: '',
      serialNo: '',
      manufacturer: '',
      renter: renterVendors[0] || '',
      rentStart: today,
      rentEnd: calcRentEnd(today),
      monthlyRentFee: 0,
      dailyRentFee: 0,
      memo1: ''
    });
    setShowModal(true);
  };

  const handleOpenEdit = (a: Asset) => {
    setEditingAsset(a);
    setShowModal(true);
  };

  const handleOpenReturn = (asset: Asset) => {
    setReturnAssetId(asset.id);
    setReturnDate(new Date().toISOString().split('T')[0]);
    const cust = customers.find(c => c.id === asset.currentCustomerId);
    setReturnOrigin(cust ? `${cust.name} 현장` : '당사 보관소');
    setReturnDestination(asset.renter ? `${asset.renter} (소유원사)` : '원사 보관소');
    setIsDispatchRequested(false);
    setShowReturnModal(true);
  };

  const handleSubmitAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !editingAsset || !editingAsset.assetNo || !editingAsset.modelName) {
      alert('필수 입력을 확인해 주세요.');
      return;
    }
    try {
      const calculatedDailyFee = editingAsset.dailyRentFee || Math.floor((editingAsset.monthlyRentFee || 0) / 30);
      await registerRentedAsset({
        ...editingAsset,
        dailyRentFee: calculatedDailyFee
      });
      alert(`임차 자산(${editingAsset.assetNo}) 등록/수정이 완료되었습니다.`);
      setShowModal(false);
      setEditingAsset(null);
    } catch (err: any) {
      alert(`⚠️ 처리 오류: ${err?.message || err}`);
    }
  };

  const handleConfirmReturn = async () => {
    if (!returnAssetId || !returnDate) {
      alert('반납 일자를 입력해주세요.');
      return;
    }
    const target = assets.find(a => a.id === returnAssetId);
    if (!target) return;

    if (isDispatchRequested) {
      db.insertRow<Delivery>('deliveries', {
        contractId: target.currentCustomerId || '',
        type: 'RETURN',
        status: 'PENDING',
        requestDate: new Date().toISOString().split('T')[0],
        vehicleType: returnVehicleType,
        deliveryCost: returnCost,
        originAddress: returnOrigin,
        destinationAddress: returnDestination,
        memo: `[임차자산 반납 배차] 장비번호: ${target.assetNo} (${target.modelName}) / 원사: ${target.renter || '미지정'}`,
        isCostSettled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    returnRentedAsset(returnAssetId, returnDate);
    alert(`임차 자산(${target.assetNo})의 반납 처리가 완결되었습니다.`);
    setShowReturnModal(false);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto' }}>
      
      {/* 1. 상단 메뉴 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
            <Layers className="text-primary" size={22} /> 임차(전대) 자산관리 & 임차처 거래명세서 매입 정산
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            임차처 거래명세서 1:1 교차 대사, 단가/기간 오차 자동 검증 및 매입 정산 1-Click 승인 시스템
          </p>
        </div>

        {activeTab === 'CURRENT' && canSave && (
          <button className="btn-primary" onClick={handleOpenAdd} style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={15} /> 임차자산 신규 등록
          </button>
        )}
      </div>

      {/* 2. 상단 2대 메인 탭 (임차자산 대장 우선 배치) */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border-color)', marginBottom: '20px', gap: '8px' }}>
        <button
          onClick={() => setActiveTab('CURRENT')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: '700',
            border: 'none',
            borderBottom: activeTab === 'CURRENT' ? '3px solid var(--primary)' : '3px solid transparent',
            backgroundColor: activeTab === 'CURRENT' ? 'var(--primary-light)' : 'transparent',
            color: activeTab === 'CURRENT' ? 'var(--primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            borderRadius: '8px 8px 0 0',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <Layers size={15} /> 📦 임차자산 대장 & 반납 현황 관리
        </button>

        <button
          onClick={() => setActiveTab('RECONCILIATION')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: '700',
            border: 'none',
            borderBottom: activeTab === 'RECONCILIATION' ? '3px solid var(--primary)' : '3px solid transparent',
            backgroundColor: activeTab === 'RECONCILIATION' ? 'var(--primary-light)' : 'transparent',
            color: activeTab === 'RECONCILIATION' ? 'var(--primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            borderRadius: '8px 8px 0 0',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <FileSpreadsheet size={15} /> 📄 임차처 거래명세서 대사 & 매입 정산
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 탭 1: 임차처 거래명세서 대사 & 매입 정산 (Reconciliation) */}
      {/* ========================================================================= */}
      {activeTab === 'RECONCILIATION' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* A. 툴바 & 엑셀 업로드 제어 패널 */}
          <div className="card" style={{ padding: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              
              {/* 좌측: 임차처 & 청구월 필터 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>임차처 선택</label>
                  <select
                    value={selectedVendor}
                    onChange={e => setSelectedVendor(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px', fontWeight: '600', minWidth: '160px' }}
                  >
                    <option value="">전체 임차처 대조</option>
                    {renterVendors.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>청구 정산년월</label>
                  <input
                    type="month"
                    value={selectedYm}
                    onChange={e => setSelectedYm(e.target.value)}
                    style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px', fontWeight: '600' }}
                  />
                </div>
              </div>

              {/* 우측: 엑셀 파일 업로드 & 양식 다운로드 & 샘플 버튼 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleExcelUpload}
                  accept=".xlsx, .xls"
                  style={{ display: 'none' }}
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-primary"
                  style={{ padding: '8px 14px', fontSize: '12px', fontWeight: '700', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Upload size={14} /> 📄 임차처 거래명세서(엑셀) 업로드
                </button>

                <button
                  onClick={handleLoadSampleStatement}
                  style={{ padding: '8px 12px', fontSize: '12px', fontWeight: '700', borderRadius: '6px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="등록된 자산 기반 테스트 명세서 자동 생성"
                >
                  <RefreshCw size={13} /> ✨ 샘플 명세서 빠른 대사 시연
                </button>

                <button
                  onClick={handleDownloadTemplate}
                  style={{ padding: '8px 12px', fontSize: '12px', fontWeight: '600', borderRadius: '6px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <Download size={13} /> 양식 다운로드
                </button>
              </div>

            </div>
          </div>

          {/* B. 대사 결산 요약 KPI 카드뉴스 (다크/라이트 테마 완벽 응응) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            
            <div style={{ backgroundColor: 'var(--bg-card)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '4px' }}>총 임차처 청구 명세</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>{statsRecon.totalCount} 건</div>
              <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '700', marginTop: '2px' }}>청구액: ₩{statsRecon.totalBilled.toLocaleString()}</div>
            </div>

            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <div style={{ fontSize: '11px', color: '#10b981', fontWeight: '700', marginBottom: '4px' }}>🟢 완벽 일치</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#10b981' }}>{statsRecon.matchedCount} 건</div>
              <div style={{ fontSize: '11px', color: '#10b981', marginTop: '2px' }}>단가·기간 100% 검증 통과</div>
            </div>

            <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: '700', marginBottom: '4px' }}>🟡 단가/금액 오차</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#f59e0b' }}>{statsRecon.priceMismatchCount} 건</div>
              <div style={{ fontSize: '11px', color: statsRecon.totalDiffAmount > 0 ? '#ef4444' : '#10b981', fontWeight: '700', marginTop: '2px' }}>
                차액: {statsRecon.totalDiffAmount > 0 ? `+${statsRecon.totalDiffAmount.toLocaleString()}` : statsRecon.totalDiffAmount.toLocaleString()}원
              </div>
            </div>

            <div style={{ backgroundColor: 'rgba(249, 115, 22, 0.1)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(249, 115, 22, 0.3)' }}>
              <div style={{ fontSize: '11px', color: '#f97316', fontWeight: '700', marginBottom: '4px' }}>🟠 기간 불일치</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#f97316' }}>{statsRecon.periodMismatchCount} 건</div>
              <div style={{ fontSize: '11px', color: '#f97316', marginTop: '2px' }}>계약/반납 기간 미스매치</div>
            </div>

            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: '700', marginBottom: '4px' }}>🔴 미등록 청구</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#ef4444' }}>{statsRecon.unregisteredCount} 건</div>
              <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: '700', marginTop: '2px' }}>유령 장비 청구 주의</div>
            </div>

            <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
              <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: '700', marginBottom: '4px' }}>🔵 청구 누락 자산</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#3b82f6' }}>{statsRecon.missingCount} 건</div>
              <div style={{ fontSize: '11px', color: '#3b82f6', marginTop: '2px' }}>자사 임차 중 청구 누락</div>
            </div>

          </div>

          {/* C. 1:1 대사 교차 대조 테이블 (Reconciliation Table) */}
          <div className="card" style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-card-header)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                  <CheckCircle size={15} className="text-success" /> 임차처 명세서 ↔ 자사 DB 대조 결과 ({reconcileResults.length}건)
                </h3>
                
                {statementRows.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => {
                        const matchedIds = reconcileResults.filter(r => r.status === 'MATCHED' && r.statementRow).map(r => r.statementRow!.id);
                        setSelectedReconcileIds(matchedIds);
                      }}
                      style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 'bold', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '4px', cursor: 'pointer' }}
                      title="🟢 일치 건만 1-Click 선택"
                    >
                      🟢 일치 건만 빠른 선택 ({statsRecon.matchedCount}건)
                    </button>
                    <button
                      onClick={() => {
                        if (selectedReconcileIds.length === statementRows.length) {
                          setSelectedReconcileIds([]);
                        } else {
                          setSelectedReconcileIds(statementRows.map(r => r.id));
                        }
                      }}
                      style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 'bold', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      {selectedReconcileIds.length === statementRows.length ? '전체 해제' : '전체 선택'}
                    </button>
                  </div>
                )}
              </div>

              {statementRows.length > 0 && canSave && (
                <button
                  onClick={handleConfirmPurchaseSettlement}
                  disabled={isSettling || selectedReconcileIds.length === 0}
                  className="btn-primary"
                  style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '6px' }}
                >
                  <CreditCard size={14} /> 💳 선택한 {selectedReconcileIds.length}건만 부분 매입 정산 승인
                </button>
              )}
            </div>

            {reconcileResults.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                상단 [📄 임차처 거래명세서 엑셀 업로드] 또는 [✨ 샘플 명세서 시연] 버튼을 눌러 교차 대사를 실행해 주세요.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-card-header)', borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '10px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={statementRows.length > 0 && selectedReconcileIds.length === statementRows.length}
                          onChange={e => {
                            if (e.target.checked) setSelectedReconcileIds(statementRows.map(r => r.id));
                            else setSelectedReconcileIds([]);
                          }}
                        />
                      </th>
                      <th style={{ padding: '10px', whiteSpace: 'nowrap', textAlign: 'center' }}>상세 뷰</th>
                      <th style={{ padding: '10px', whiteSpace: 'nowrap', textAlign: 'center' }}>대사 상태</th>
                      <th style={{ padding: '10px', whiteSpace: 'nowrap' }}>관리번호 / 시리얼</th>
                      <th style={{ padding: '10px', whiteSpace: 'nowrap' }}>모델명</th>
                      <th style={{ padding: '10px', whiteSpace: 'nowrap' }}>📄 임차처 청구 기간</th>
                      <th style={{ padding: '10px', whiteSpace: 'nowrap' }}>🏠 자사 등록/반납 기간</th>
                      <th style={{ padding: '10px', whiteSpace: 'nowrap', textAlign: 'right' }}>📄 임차처 청구금액</th>
                      <th style={{ padding: '10px', whiteSpace: 'nowrap', textAlign: 'right' }}>🏠 자사 약정금액</th>
                      <th style={{ padding: '10px', whiteSpace: 'nowrap', textAlign: 'right' }}>오차 차액</th>
                      <th style={{ padding: '10px', whiteSpace: 'nowrap' }}>대사 검증 소견</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconcileResults.map(item => {
                      const stmt = item.statementRow;
                      const matched = item.matchedAsset;
                      
                      let rowBg = 'transparent';
                      if (item.status === 'PRICE_MISMATCH') rowBg = 'rgba(245, 158, 11, 0.12)';
                      if (item.status === 'PERIOD_MISMATCH') rowBg = 'rgba(249, 115, 22, 0.12)';
                      if (item.status === 'UNREGISTERED') rowBg = 'rgba(239, 68, 68, 0.12)';
                      if (item.status === 'MISSING_BILLING') rowBg = 'rgba(59, 130, 246, 0.12)';

                      const isChecked = stmt ? selectedReconcileIds.includes(stmt.id) : false;

                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: rowBg, color: 'var(--text-main)' }}>
                          {/* 선택 체크박스 */}
                          <td style={{ padding: '10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {stmt && (
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setSelectedReconcileIds([...selectedReconcileIds, stmt.id]);
                                  } else {
                                    setSelectedReconcileIds(selectedReconcileIds.filter(id => id !== stmt.id));
                                  }
                                }}
                              />
                            )}
                          </td>

                          {/* 상세 뷰 버튼 */}
                          <td style={{ padding: '10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <button
                              onClick={() => setSelectedReconcileDetail(item)}
                              style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 'bold', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              상세 🔍
                            </button>
                          </td>

                          {/* 대사 상태 배지 */}
                          <td style={{ padding: '10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span className={`badge ${item.badgeClass}`} style={{ fontSize: '11px', padding: '3px 7px' }}>
                              {item.statusLabel}
                            </span>
                          </td>

                          {/* 관리번호 / 시리얼 */}
                          <td style={{ padding: '10px', whiteSpace: 'nowrap', fontWeight: '800', color: 'var(--text-main)' }}>
                            {stmt?.assetNo || matched?.assetNo}
                            {stmt?.serialNo && <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal' }}>S/N: {stmt.serialNo}</div>}
                          </td>

                          {/* 모델명 */}
                          <td style={{ padding: '10px', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>
                            {stmt?.modelName || matched?.modelName || '미지정'}
                          </td>

                          {/* 임차처 청구 기간 */}
                          <td style={{ padding: '10px', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>
                            {stmt ? `${stmt.rentStart} ~ ${stmt.rentEnd}` : '-'}
                          </td>

                          {/* 자사 등록/반납 기간 */}
                          <td style={{ padding: '10px', whiteSpace: 'nowrap', color: '#475569' }}>
                            {matched ? (
                              matched.actualRentReturnDate ? (
                                <span style={{ color: '#059669', fontWeight: '600' }}>반납: {matched.actualRentReturnDate}</span>
                              ) : (
                                `${matched.rentStart || '~'} ~ ${matched.rentEnd || '~'}`
                              )
                            ) : (
                              <span style={{ color: '#dc2626' }}>자사 대장 미등록</span>
                            )}
                          </td>

                          {/* 원사 청구금액 */}
                          <td style={{ padding: '10px', whiteSpace: 'nowrap', textAlign: 'right', fontWeight: '700' }}>
                            {stmt ? `₩${stmt.billedAmount.toLocaleString()}` : '-'}
                          </td>

                          {/* 자사 약정금액 */}
                          <td style={{ padding: '10px', whiteSpace: 'nowrap', textAlign: 'right', color: 'var(--text-secondary)' }}>
                            ₩{item.expectedAmount.toLocaleString()}
                          </td>

                          {/* 오차 차액 */}
                          <td style={{ padding: '10px', whiteSpace: 'nowrap', textAlign: 'right', fontWeight: '800', color: item.priceDiff > 0 ? '#dc2626' : (item.priceDiff < 0 ? '#059669' : 'var(--text-main)') }}>
                            {item.priceDiff > 0 ? `+₩${item.priceDiff.toLocaleString()}` : item.priceDiff < 0 ? `-₩${Math.abs(item.priceDiff).toLocaleString()}` : '0원'}
                          </td>

                          {/* 대사 분석 소견 */}
                          <td style={{ padding: '10px', fontSize: '11px', color: 'var(--text-secondary)', maxWidth: '300px' }}>
                            {item.reason}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 탭 2: 임차자산 대장 현황 (Current Assets) */}
      {/* ========================================================================= */}
      {activeTab === 'CURRENT' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* 자산 검색/필터 바 */}
          <div className="card" style={{ padding: '14px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', alignItems: 'end' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>자산 검색</label>
                <input
                  type="text"
                  placeholder="관리번호 또는 모델명"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>임차처</label>
                <select
                  value={renterQuery}
                  onChange={e => setRenterQuery(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px' }}
                >
                  <option value="">전체 임차처</option>
                  {renterVendors.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>반납 여부</label>
                <select
                  value={returnQuery}
                  onChange={e => setReturnQuery(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px' }}
                >
                  <option value="ALL">전체 반납 상태</option>
                  <option value="ACTIVE">미반납 (임차 가동 중)</option>
                  <option value="RETURNED">반납 완료</option>
                </select>
              </div>

              <div>
                <button
                  onClick={() => exportToExcel(filteredAssets, '임차자산_대장_목록')}
                  style={{ padding: '7px 12px', fontSize: '12px', fontWeight: '600', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <Download size={13} /> 엑셀 다운로드
                </button>
              </div>

            </div>
          </div>

          {/* 자산 목록 테이블 */}
          <div className="card" style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-card-header)', borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px', whiteSpace: 'nowrap', textAlign: 'center' }}>관리</th>
                    <th style={{ padding: '10px', whiteSpace: 'nowrap' }}>관리번호</th>
                    <th style={{ padding: '10px', whiteSpace: 'nowrap' }}>모델명</th>
                    <th style={{ padding: '10px', whiteSpace: 'nowrap' }}>임차처</th>
                    <th style={{ padding: '10px', whiteSpace: 'nowrap' }}>임차 계약기간</th>
                    <th style={{ padding: '10px', whiteSpace: 'nowrap', textAlign: 'right' }}>월 임차료</th>
                    <th style={{ padding: '10px', whiteSpace: 'nowrap' }}>실제 반납일</th>
                    <th style={{ padding: '10px', whiteSpace: 'nowrap', textAlign: 'center' }}>상태 / 경보</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        조건에 부합하는 임차 자산이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredAssets.map(a => {
                      const isReturned = a.status === 'RENTED_RETURNED';
                      const isOverdue = isSubleaseOverdue(a);
                      const delayDays = calculateDelayDays(a);

                      return (
                        <tr key={a.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: isReturned ? 'rgba(255, 255, 255, 0.03)' : 'transparent', color: 'var(--text-main)' }}>
                          {/* 관리 버튼 */}
                          <td style={{ padding: '8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              {canSave && (
                                <button
                                  onClick={() => handleOpenEdit(a)}
                                  style={{ padding: '3px 6px', fontSize: '11px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                  수정
                                </button>
                              )}
                              {canSave && !isReturned && (
                                <button
                                  onClick={() => handleOpenReturn(a)}
                                  style={{ padding: '3px 6px', fontSize: '11px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                  반납
                                </button>
                              )}
                            </div>
                          </td>

                          {/* 관리번호 */}
                          <td style={{ padding: '10px', whiteSpace: 'nowrap', fontWeight: '800', color: 'var(--text-main)' }}>
                            {a.assetNo}
                            <span className="badge badge-info" style={{ marginLeft: '4px', fontSize: '9px' }}>임차</span>
                          </td>

                          {/* 모델명 */}
                          <td style={{ padding: '10px', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>{a.modelName}</td>

                          {/* 임차처 */}
                          <td style={{ padding: '10px', whiteSpace: 'nowrap', fontWeight: '600', color: 'var(--text-main)' }}>{a.renter || '미지정'}</td>

                          {/* 임차 계약기간 */}
                          <td style={{ padding: '10px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                            {a.rentStart || '~'} ~ {a.rentEnd || '~'}
                          </td>

                          {/* 월 임차료 */}
                          <td style={{ padding: '10px', whiteSpace: 'nowrap', textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>
                            ₩{(a.monthlyRentFee || 0).toLocaleString()}
                          </td>

                          {/* 실제 반납일 / 현재 가동 상태 */}
                          <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                            {a.actualRentReturnDate ? (
                              <span style={{ color: '#10b981', fontWeight: '600' }}>{a.actualRentReturnDate} (반납)</span>
                            ) : (a.status === 'RENTED' || a.currentCustomerId) ? (
                              <span style={{ color: '#3b82f6', fontWeight: '600' }}>대여중 (현장가동중)</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>입고 보관중 (미출고)</span>
                            )}
                          </td>

                          {/* 상태 / 경보 */}
                          <td style={{ padding: '10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                              {a.status === 'RENTED_RETURNED' ? (
                                <span className="badge" style={{ backgroundColor: '#64748b', color: '#fff', fontSize: '10px' }}>⚪ 임차처 반납완료</span>
                              ) : (a.status === 'RENTED' || a.status === 'ASSIGNED' || a.currentCustomerId) ? (
                                <span className="badge badge-info" style={{ fontSize: '10px' }}>🔵 대여중 (현장가동)</span>
                              ) : a.status === 'REPAIRING' ? (
                                <span className="badge badge-danger" style={{ fontSize: '10px' }}>🔧 정비중</span>
                              ) : (
                                <span className="badge badge-success" style={{ fontSize: '10px' }}>🟢 임대가능 (보관중)</span>
                              )}

                              {isOverdue && (
                                <span className="badge badge-danger" style={{ fontSize: '9px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                  <AlertTriangle size={9} /> 전대 기간 초과
                                </span>
                              )}

                              {delayDays > 0 && !isReturned && (
                                <span style={{ fontSize: '9px', color: '#dc2626', fontWeight: '700' }}>
                                  지연 +{delayDays}일
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. 모달: 임차 자산 등록 / 수정 모달 */}
      {/* ========================================================================= */}
      {showModal && editingAsset && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', padding: '24px', borderRadius: '12px', width: '500px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-color)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px', color: 'var(--text-main)' }}>
              {editingAsset.id ? '임차 자산 수정' : '임차 자산 신규 등록'}
            </h2>

            <form onSubmit={handleSubmitAsset} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>관리번호 (필수)</label>
                <input
                  type="text"
                  required
                  placeholder="예: R-001"
                  value={editingAsset.assetNo || ''}
                  onChange={e => setEditingAsset({ ...editingAsset, assetNo: e.target.value })}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>모델명 (필수)</label>
                <select
                  value={editingAsset.modelName || ''}
                  onChange={e => setEditingAsset({ ...editingAsset, modelName: e.target.value })}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px' }}
                >
                  {sortedProducts.map(p => (
                    <option key={p.id} value={p.modelName}>{p.modelName}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>임차처 (필수)</label>
                <select
                  required
                  value={editingAsset.renter || ''}
                  onChange={e => setEditingAsset({ ...editingAsset, renter: e.target.value })}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px' }}
                >
                  <option value="">-- 임차처 선택 --</option>
                  {renterVendors.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>임차 시작일</label>
                  <input
                    type="date"
                    value={editingAsset.rentStart || ''}
                    onChange={e => {
                      const newStart = e.target.value;
                      setEditingAsset({
                        ...editingAsset,
                        rentStart: newStart,
                        rentEnd: calcRentEnd(newStart)
                      });
                    }}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>임차 만료예정일</label>
                  <input
                    type="date"
                    value={editingAsset.rentEnd || ''}
                    onChange={e => setEditingAsset({ ...editingAsset, rentEnd: e.target.value })}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>월 임차료 (원)</label>
                <input
                  type="number"
                  placeholder="300000"
                  value={editingAsset.monthlyRentFee || 0}
                  onChange={e => setEditingAsset({ ...editingAsset, monthlyRentFee: Number(e.target.value) })}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '12px', cursor: 'pointer' }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. 모달: 임차 자산 반납 및 회수 배차 동시 신청 모달 */}
      {/* ========================================================================= */}
      {showReturnModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', padding: '24px', borderRadius: '12px', width: '480px', maxWidth: '90%', border: '1px solid var(--border-color)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '14px', color: '#ef4444' }}>
              임차 자산 반납 처리
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>실제 임차처 반납일자</label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={e => setReturnDate(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px' }}
                />
              </div>

              {/* 반납 회수 배차 동시 신청 옵션 */}
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', color: 'var(--text-main)' }}>
                  <input
                    type="checkbox"
                    checked={isDispatchRequested}
                    onChange={e => setIsDispatchRequested(e.target.checked)}
                  />
                  🚚 반납/회수 운송 배차 신청 동시 접수
                </label>

                {isDispatchRequested && (
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>상차지 (출발)</label>
                      <input type="text" value={returnOrigin} onChange={e => setReturnOrigin(e.target.value)} style={{ padding: '4px 8px', fontSize: '11px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '4px' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>하차지 (임차처 반납 장소)</label>
                      <input type="text" value={returnDestination} onChange={e => setReturnDestination(e.target.value)} style={{ padding: '4px 8px', fontSize: '11px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '4px' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>차량 톤수</label>
                        <select value={returnVehicleType} onChange={e => setReturnVehicleType(e.target.value)} style={{ padding: '4px 8px', fontSize: '11px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '4px' }}>
                          <option value="1T">1톤</option>
                          <option value="3.5T">3.5톤 셀프로더</option>
                          <option value="5T">5톤 셀프로더</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>예상 운송료 (원)</label>
                        <input type="number" value={returnCost} onChange={e => setReturnCost(Number(e.target.value))} style={{ padding: '4px 8px', fontSize: '11px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '4px' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  onClick={() => setShowReturnModal(false)}
                  style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '12px', cursor: 'pointer' }}
                >
                  취소
                </button>
                <button
                  onClick={handleConfirmReturn}
                  style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: '#ef4444', color: '#fff', border: 'none', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  반납 완결 처리
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. 모달: 임차처 거래명세서 수신 내용 ↔ 자사 DB 대장 1:1 원본 대조 상세 모달 */}
      {/* ========================================================================= */}
      {selectedReconcileDetail && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', padding: '24px', borderRadius: '12px', width: '700px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-color)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                  📄 임차처 거래명세서 ↔ 🏠 자사 DB 자산대장 1:1 원본 대조
                </h2>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  임차처 청구 내용과 자사 등록 정보를 1:1로 원본 비교 검증합니다.
                </p>
              </div>
              <span className={`badge ${selectedReconcileDetail.badgeClass}`} style={{ fontSize: '12px', padding: '4px 10px' }}>
                {selectedReconcileDetail.statusLabel}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              
              {/* 좌측: 📄 임차처 거래명세서 수신 내용 */}
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '800', margin: '0 0 12px 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📄 임차처 거래명세서 수신 내용
                </h3>
                {selectedReconcileDetail.statementRow ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: 'var(--text-main)' }}>
                    <div><strong>관리번호:</strong> {selectedReconcileDetail.statementRow.assetNo}</div>
                    <div><strong>시리얼/제조번호:</strong> {selectedReconcileDetail.statementRow.serialNo || '미기재'}</div>
                    <div><strong>임차처 표기 모델명:</strong> {selectedReconcileDetail.statementRow.modelName || '미기재'}</div>
                    <div><strong>임차처 청구 기간:</strong> <span style={{ color: '#3b82f6', fontWeight: '700' }}>{selectedReconcileDetail.statementRow.rentStart} ~ {selectedReconcileDetail.statementRow.rentEnd}</span></div>
                    <div><strong>임차처 청구 금액:</strong> <span style={{ color: '#ef4444', fontWeight: '800', fontSize: '14px' }}>₩{selectedReconcileDetail.statementRow.billedAmount.toLocaleString()}원</span></div>
                    <div><strong>임차처 비고/메모:</strong> {selectedReconcileDetail.statementRow.memo || '없음'}</div>
                  </div>
                ) : (
                  <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>
                    임차처 거래명세서에 해당 항목 청구가 존재하지 않음 (청구 누락)
                  </div>
                )}
              </div>

              {/* 우측: 🏠 자사 DB 자산대장 등록 내용 */}
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '800', margin: '0 0 12px 0', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🏠 자사 DB 자산대장 약정 내용
                </h3>
                {selectedReconcileDetail.matchedAsset ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: 'var(--text-main)' }}>
                    <div><strong>자사 관리번호:</strong> {selectedReconcileDetail.matchedAsset.assetNo}</div>
                    <div><strong>등록 제조번호:</strong> {selectedReconcileDetail.matchedAsset.serialNo || '미기재'}</div>
                    <div><strong>등록 모델명:</strong> {selectedReconcileDetail.matchedAsset.modelName}</div>
                    <div><strong>소유 임차처:</strong> {selectedReconcileDetail.matchedAsset.renter || '미지정'}</div>
                    <div><strong>약정/가동 기간:</strong> <span style={{ color: '#10b981', fontWeight: '700' }}>{selectedReconcileDetail.matchedAsset.rentStart || '~'} ~ {selectedReconcileDetail.matchedAsset.rentEnd || '~'}</span></div>
                    <div><strong>실제 반납일:</strong> {selectedReconcileDetail.matchedAsset.actualRentReturnDate || '미반납 (가동중)'}</div>
                    <div><strong>약정 월 임차료:</strong> <span style={{ color: '#10b981', fontWeight: '800', fontSize: '14px' }}>₩{(selectedReconcileDetail.matchedAsset.monthlyRentFee || 0).toLocaleString()}원</span></div>
                  </div>
                ) : (
                  <div style={{ padding: '20px', color: '#ef4444', fontSize: '12px', textAlign: 'center', fontWeight: '700' }}>
                    ⚠️ 자사 DB 자산대장에 존재하지 않는 미등록 장비 (유령 청구 위험)
                  </div>
                )}
              </div>

            </div>

            {/* 검증 소견 카드 */}
            <div style={{ padding: '14px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
              <div style={{ fontWeight: '800', fontSize: '12px', color: 'var(--text-main)', marginBottom: '4px' }}>🔍 시스템 자동 대사 검증 소견:</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{selectedReconcileDetail.reason}</div>
              <div style={{ fontSize: '12px', fontWeight: '700', marginTop: '6px', color: selectedReconcileDetail.priceDiff > 0 ? '#ef4444' : (selectedReconcileDetail.priceDiff < 0 ? '#10b981' : 'var(--text-main)') }}>
                오차 차액: {selectedReconcileDetail.priceDiff > 0 ? `+₩${selectedReconcileDetail.priceDiff.toLocaleString()}원 (임차처 과다 청구)` : selectedReconcileDetail.priceDiff < 0 ? `-₩${Math.abs(selectedReconcileDetail.priceDiff).toLocaleString()}원 (임차처 임의 할인)` : '0원 (정상 일치)'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedReconcileDetail(null)}
                style={{ padding: '8px 18px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                닫기
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
