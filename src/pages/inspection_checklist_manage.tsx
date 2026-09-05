// src/pages/inspection_checklist_manage.tsx
import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShieldCheck,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Search,
  FileText,
  Download,
  Eye,
  BookOpen,
  Wrench,
  BarChart2,
  Clock,
  Layers,
  Calendar,
  Filter,
  CheckCircle2,
  UploadCloud,
  FileDown
} from 'lucide-react';
import { InspectionChecklistItem, EquipmentManual, db } from '../services/db';

type TabType = 'MASTER' | 'ANALYTICS' | 'MANUALS';

export const InspectionChecklistManage: React.FC = () => {
  const {
    inspectionChecklistItems,
    saveInspectionChecklistItem,
    deleteInspectionChecklistItem,
    equipmentManuals,
    saveEquipmentManual,
    deleteEquipmentManual,
    repairs,
    repairConsumables,
    consumables,
    products
  } = useApp();

  // ─── [탭 상태] ───
  const [activeTab, setActiveTab] = useState<TabType>('MASTER');

  // ─── [토스트 및 확인 모달 (헌장 5.2: alert/confirm 퇴출)] ───
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    isDanger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // ═════════════════════════════════════════════════════════════════
  // ─── [탭 1: 정비 항목 마스터 (MASTER)] 상태 및 로직 ───
  // ═════════════════════════════════════════════════════════════════
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<InspectionChecklistItem> | null>(null);

  const [formCategory, setFormCategory] = useState('외관/바디');
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formScore, setFormScore] = useState<number>(5);
  const [formManHours, setFormManHours] = useState<number>(0.5);
  const [formRecommendedConsumables, setFormRecommendedConsumables] = useState<string[]>([]);
  const [formActionGuide, setFormActionGuide] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // 과거 AS 발생 누적 통계 매핑
  const repairMappingStats = useMemo(() => {
    const stats: Record<string, { count: number; lastOccurred?: string }> = {};
    (repairs || []).forEach(r => {
      if (r.inspectionItemCode) {
        const code = r.inspectionItemCode;
        if (!stats[code]) stats[code] = { count: 0 };
        const stat = stats[code]!;
        stat.count += 1;
        if (r.requestDate) {
          if (!stat.lastOccurred || r.requestDate > stat.lastOccurred) {
            stat.lastOccurred = r.requestDate;
          }
        }
      }
    });
    return stats;
  }, [repairs]);

  // 소모품 Map (id -> Consumable)
  const consumableMap = useMemo(() => {
    const map = new Map<string, (typeof consumables)[0]>();
    (consumables || []).forEach(c => map.set(c.id, c));
    return map;
  }, [consumables]);

  const handleOpenAddItemModal = () => {
    setEditingItem(null);
    setFormCategory('외관/바디');
    let maxNum = 0;
    inspectionChecklistItems.forEach(item => {
      if (item.code && item.code.startsWith('CHK-')) {
        const num = parseInt(item.code.replace('CHK-', ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    const nextCode = `CHK-${String(maxNum + 1).padStart(7, '0')}`;
    setFormCode(nextCode);
    setFormName('');
    setFormScore(5);
    setFormManHours(0.5);
    setFormRecommendedConsumables([]);
    setFormActionGuide('');
    setFormDescription('');
    setIsItemModalOpen(true);
  };

  const handleOpenEditItemModal = (item: InspectionChecklistItem) => {
    setEditingItem(item);
    setFormCategory(item.category || '외관/바디');
    setFormCode(item.code || '');
    setFormName(item.name || '');
    setFormScore(item.score || 0);
    setFormManHours(item.standardManHours || 0.5);
    setFormRecommendedConsumables(item.recommendedConsumableIds || []);
    setFormActionGuide(item.actionGuide || '');
    setFormDescription(item.description || '');
    setIsItemModalOpen(true);
  };

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('정비 필요 항목명을 입력해 주세요.', 'error');
      return;
    }

    try {
      await saveInspectionChecklistItem({
        id: editingItem?.id,
        category: formCategory,
        code: formCode || `CHK-${Date.now().toString().slice(-7)}`,
        name: formName.trim(),
        score: Number(formScore),
        standardManHours: Number(formManHours),
        recommendedConsumableIds: formRecommendedConsumables,
        actionGuide: formActionGuide.trim(),
        description: formDescription.trim()
      });
      await db.awaitPendingWrites();

      showToast(`[${formName}] 정비 항목 ${editingItem ? '수정' : '신규 등록'} 완료`);
      setIsItemModalOpen(false);
    } catch (err: any) {
      showToast(`저장 실패: ${err?.message || err}`, 'error');
    }
  };

  const doDeleteItem = async (item: InspectionChecklistItem) => {
    try {
      await deleteInspectionChecklistItem(item.id);
      await db.awaitPendingWrites();
      showToast(`[${item.name}] 항목이 마스터 대장에서 삭제되었습니다.`);
    } catch (err: any) {
      showToast(`삭제 실패: ${err?.message || err}`, 'error');
    }
  };

  const handleDeleteItem = (item: InspectionChecklistItem) => {
    setConfirmModal({
      isOpen: true,
      title: '정비 항목 삭제',
      message: `정비 항목 [${item.name}] (${item.code})을 마스터 대장에서 삭제하시겠습니까?\n기존 누적 데이터 연계에 영향을 줄 수 있습니다.`,
      confirmText: '삭제 실행',
      isDanger: true,
      onConfirm: () => {
        setConfirmModal(null);
        doDeleteItem(item);
      }
    });
  };

  const filteredMasterItems = useMemo(() => {
    return inspectionChecklistItems.filter(item => {
      const matchCat = selectedCategory === '전체' || item.category === selectedCategory;
      if (!matchCat) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        item.name.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term) ||
        item.code.toLowerCase().includes(term) ||
        (item.description && item.description.toLowerCase().includes(term)) ||
        (item.actionGuide && item.actionGuide.toLowerCase().includes(term))
      );
    });
  }, [inspectionChecklistItems, selectedCategory, searchTerm]);

  // 마스터 요약 통계
  const masterAuditSummary = useMemo(() => {
    const totalCount = inspectionChecklistItems.length;
    const categories = Array.from(new Set(inspectionChecklistItems.map(i => i.category || '외관/바디')));
    const totalScore = inspectionChecklistItems.reduce((sum, i) => sum + (i.score || 0), 0);
    const avgScore = totalCount > 0 ? (totalScore / totalCount).toFixed(1) : '0';
    const totalManHours = inspectionChecklistItems.reduce((sum, i) => sum + (i.standardManHours || 0.5), 0);
    const linkedPartsCount = inspectionChecklistItems.filter(i => (i.recommendedConsumableIds || []).length > 0).length;

    return {
      totalCount,
      categoryCount: categories.length,
      totalScore,
      avgScore,
      totalManHours: totalManHours.toFixed(1),
      linkedPartsCount
    };
  }, [inspectionChecklistItems]);

  // 엑셀 내보내기 (마스터 대장)
  const exportMasterToExcel = () => {
    const headers = ['No', '카테고리', '항목코드', '항목명', '배점', '표준공수(M/H)', '추천부품', '누적발생건수', '조치가이드', '상세설명'];
    const rows = filteredMasterItems.map((item, idx) => {
      const partsNames = (item.recommendedConsumableIds || [])
        .map(cid => consumableMap.get(cid)?.modelName || cid)
        .join(', ');
      const stat = repairMappingStats[item.code] || { count: 0 };
      return [
        idx + 1,
        item.category,
        item.code,
        item.name,
        item.score,
        item.standardManHours || 0.5,
        partsNames || '-',
        stat.count,
        (item.actionGuide || '-').replace(/"/g, '""'),
        (item.description || '-').replace(/"/g, '""')
      ];
    });

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `정비항목_마스터대장_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('정비 항목 마스터 대장 CSV 내보내기 완료');
  };

  // ═════════════════════════════════════════════════════════════════
  // ─── [탭 2: 조직역량 & 비용 분석 (ANALYTICS)] 상태 및 로직 ───
  // ═════════════════════════════════════════════════════════════════
  const getTodayStr = () => new Date().toISOString().slice(0, 10);
  const getFirstDayOfMonth = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  };
  const getLastDayOfMonth = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  };

  const [analyticsStartDate, setAnalyticsStartDate] = useState(getFirstDayOfMonth());
  const [analyticsEndDate, setAnalyticsEndDate] = useState(getLastDayOfMonth());
  const [analyticsCategoryFilter, setAnalyticsCategoryFilter] = useState('전체');

  const setPeriodPreset = (type: 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_3_MONTHS' | 'ALL') => {
    const now = new Date();
    if (type === 'THIS_MONTH') {
      setAnalyticsStartDate(getFirstDayOfMonth());
      setAnalyticsEndDate(getLastDayOfMonth());
    } else if (type === 'LAST_MONTH') {
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
      setAnalyticsStartDate(prevStart);
      setAnalyticsEndDate(prevEnd);
    } else if (type === 'LAST_3_MONTHS') {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10);
      setAnalyticsStartDate(start);
      setAnalyticsEndDate(getTodayStr());
    } else if (type === 'ALL') {
      setAnalyticsStartDate('2020-01-01');
      setAnalyticsEndDate(getTodayStr());
    }
  };

  // 기간 내 정비 건 필터링 및 항목별 집계
  const analyticsData = useMemo(() => {
    const filteredRepairs = (repairs || []).filter(r => {
      const date = r.completedDate || r.repairDate || r.requestDate;
      if (!date) return false;
      return date >= analyticsStartDate && date <= analyticsEndDate;
    });

    const repairConsMap = new Map<string, typeof repairConsumables>();
    (repairConsumables || []).forEach(rc => {
      const list = repairConsMap.get(rc.repairId) || [];
      list.push(rc);
      repairConsMap.set(rc.repairId, list);
    });

    const itemCodeMap = new Map<string, InspectionChecklistItem>();
    inspectionChecklistItems.forEach(item => itemCodeMap.set(item.code, item));

    interface ItemAggregate {
      itemCode: string;
      itemName: string;
      category: string;
      standardManHours: number;
      count: number;
      totalManHours: number;
      partCost: number;
      externalCost: number;
      totalCost: number;
      billableAmount: number;
      companyCost: number;
      actionGuide?: string;
    }

    const itemAggMap = new Map<string, ItemAggregate>();

    let totalRepairCount = 0;
    let grandTotalManHours = 0;
    let grandPartCost = 0;
    let grandExternalCost = 0;
    let grandTotalCost = 0;
    let grandBillableAmount = 0;
    let grandCompanyCost = 0;

    filteredRepairs.forEach(r => {
      totalRepairCount += 1;
      const code = r.inspectionItemCode || 'UNCLASSIFIED';
      const masterItem = itemCodeMap.get(code);

      const category = masterItem?.category || r.issueCategory || '기타/검수';
      const itemName = masterItem?.name || r.details || '미분류 정비';
      const stdMH = masterItem?.standardManHours || 0.5;

      // 부품비 계산
      let repairPartCost = 0;
      const rCons = repairConsMap.get(r.id) || [];
      if (rCons.length > 0) {
        rCons.forEach(rc => {
          const uPrice = rc.unitPrice || consumableMap.get(rc.consumableId)?.unitPrice || 0;
          repairPartCost += uPrice * rc.quantity;
        });
      } else if (r.partsUsed && r.partsUsed.length > 0) {
        r.partsUsed.forEach(pu => {
          repairPartCost += (pu.unitPrice || 0) * (pu.quantity || 1);
        });
      }

      // 외주비 계산
      let repairExternalCost = 0;
      const isExternal =
        r.workCategory === 'EXTERNAL_VENDOR' ||
        r.repairType === 'EXTERNAL' ||
        r.resolutionType === 'EXTERNAL_OUTSOURCE';
      if (isExternal) {
        repairExternalCost = r.totalCost || 0;
      }

      const repairTotalCost = repairPartCost + repairExternalCost || (r.totalCost || 0);
      const billable = r.billableType === 'BILLABLE' ? (r.billableAmount || 0) : 0;
      const compCost = Math.max(0, repairTotalCost - billable);

      const existing = itemAggMap.get(code) || {
        itemCode: code,
        itemName,
        category,
        standardManHours: stdMH,
        count: 0,
        totalManHours: 0,
        partCost: 0,
        externalCost: 0,
        totalCost: 0,
        billableAmount: 0,
        companyCost: 0,
        actionGuide: masterItem?.actionGuide
      };

      existing.count += 1;
      existing.totalManHours += stdMH;
      existing.partCost += repairPartCost;
      existing.externalCost += repairExternalCost;
      existing.totalCost += repairTotalCost;
      existing.billableAmount += billable;
      existing.companyCost += compCost;
      itemAggMap.set(code, existing);

      grandTotalManHours += stdMH;
      grandPartCost += repairPartCost;
      grandExternalCost += repairExternalCost;
      grandTotalCost += repairTotalCost;
      grandBillableAmount += billable;
      grandCompanyCost += compCost;
    });

    const items = Array.from(itemAggMap.values())
      .filter(item => {
        if (analyticsCategoryFilter === '전체') return true;
        return item.category === analyticsCategoryFilter;
      })
      .sort((a, b) => b.totalCost - a.totalCost || b.count - a.count);

    return {
      items,
      totalRepairCount,
      grandTotalManHours: grandTotalManHours.toFixed(1),
      grandPartCost,
      grandExternalCost,
      grandTotalCost,
      grandBillableAmount,
      grandCompanyCost,
      balanceDiff: grandTotalCost - (grandBillableAmount + grandCompanyCost)
    };
  }, [
    repairs,
    repairConsumables,
    inspectionChecklistItems,
    consumableMap,
    analyticsStartDate,
    analyticsEndDate,
    analyticsCategoryFilter
  ]);

  // 분석 데이터 엑셀 내보내기
  const exportAnalyticsToExcel = () => {
    const headers = [
      '항목코드',
      '정비항목명',
      '카테고리',
      '발생건수',
      '표준공수(M/H)',
      '누적공수(M/H)',
      '자체부품비(원)',
      '외주정비비(원)',
      '총소요비용(원)',
      '고객청구액(원)',
      '회사순부담(원)',
      '비용비중(%)'
    ];

    const rows = analyticsData.items.map(item => {
      const share = analyticsData.grandTotalCost > 0
        ? ((item.totalCost / analyticsData.grandTotalCost) * 100).toFixed(1)
        : '0.0';
      return [
        item.itemCode,
        item.itemName,
        item.category,
        item.count,
        item.standardManHours,
        item.totalManHours.toFixed(1),
        item.partCost,
        item.externalCost,
        item.totalCost,
        item.billableAmount,
        item.companyCost,
        `${share}%`
      ];
    });

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `정비조직역량_비용분석_${analyticsStartDate}_${analyticsEndDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('정비 역량 및 비용 분석 데이터 CSV 내보내기 완료');
  };

  // ═════════════════════════════════════════════════════════════════
  // ─── [탭 3: 장비 매뉴얼 라이브러리 (MANUALS)] 상태 및 로직 ───
  // ═════════════════════════════════════════════════════════════════
  const [manualSearchTerm, setManualSearchTerm] = useState('');
  const [selectedManualModel, setSelectedManualModel] = useState<string>('전체');
  const [selectedManualCategory, setSelectedManualCategory] = useState<string>('전체');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [previewManual, setPreviewManual] = useState<EquipmentManual | null>(null);

  // 매뉴얼 등록 폼 상태
  const [manualFormModel, setManualFormModel] = useState('SJ-3219');
  const [manualFormManufacturer, setManualFormManufacturer] = useState('Skyjack');
  const [manualFormCategory, setManualFormCategory] = useState<EquipmentManual['category']>('PARTS_BOOK');
  const [manualFormTitle, setManualFormTitle] = useState('');
  const [manualFormVersion, setManualFormVersion] = useState('Rev. 2024-A');
  const [manualFormTargetSpecFt, setManualFormTargetSpecFt] = useState<number>(19);
  const [manualFormMemo, setManualFormMemo] = useState('');
  const [manualFormFileName, setManualFormFileName] = useState('');
  const [manualFormFileSize, setManualFormFileSize] = useState<number>(0);
  const [manualFormFileSizeLabel, setManualFormFileSizeLabel] = useState('0 KB');
  const [manualFormFileUrl, setManualFormFileUrl] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 모델 고유 목록 추출
  const modelOptions = useMemo(() => {
    const models = new Set<string>();
    (equipmentManuals || []).forEach(m => {
      if (m.modelName) models.add(m.modelName);
    });
    (products || []).forEach(p => {
      if (p.modelName) models.add(p.modelName);
    });
    return Array.from(models).sort();
  }, [equipmentManuals, products]);

  // 매뉴얼 필터링
  const filteredManuals = useMemo(() => {
    return (equipmentManuals || []).filter(m => {
      const matchModel = selectedManualModel === '전체' || m.modelName === selectedManualModel;
      const matchCat = selectedManualCategory === '전체' || m.category === selectedManualCategory;
      if (!matchModel || !matchCat) return false;
      if (!manualSearchTerm.trim()) return true;
      const term = manualSearchTerm.toLowerCase();
      return (
        m.title.toLowerCase().includes(term) ||
        m.modelName.toLowerCase().includes(term) ||
        m.manufacturer.toLowerCase().includes(term) ||
        (m.memo && m.memo.toLowerCase().includes(term)) ||
        (m.version && m.version.toLowerCase().includes(term))
      );
    });
  }, [equipmentManuals, selectedManualModel, selectedManualCategory, manualSearchTerm]);

  // 매뉴얼 통계
  const manualSummary = useMemo(() => {
    const total = (equipmentManuals || []).length;
    const partsBookCount = (equipmentManuals || []).filter(m => m.category === 'PARTS_BOOK').length;
    const errorCodeCount = (equipmentManuals || []).filter(m => m.category === 'ERROR_CODE').length;
    const wiringCount = (equipmentManuals || []).filter(m => m.category === 'WIRING_DIAGRAM').length;
    const operatorCount = (equipmentManuals || []).filter(m => m.category === 'OPERATOR_MANUAL').length;

    return { total, partsBookCount, errorCodeCount, wiringCount, operatorCount };
  }, [equipmentManuals]);

  // 파일 선택 핸들러
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setManualFormFileName(file.name);
    setManualFormFileSize(file.size);

    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    setManualFormFileSizeLabel(`${sizeMb} MB`);

    if (!manualFormTitle) {
      setManualFormTitle(file.name.replace(/\.[^/.]+$/, ''));
    }

    const reader = new FileReader();
    reader.onload = event => {
      setManualFormFileUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleOpenAddManualModal = () => {
    setManualFormModel(modelOptions[0] || 'SJ-3219');
    setManualFormManufacturer('Skyjack');
    setManualFormCategory('PARTS_BOOK');
    setManualFormTitle('');
    setManualFormVersion('Rev. 2024-A');
    setManualFormTargetSpecFt(19);
    setManualFormMemo('');
    setManualFormFileName('');
    setManualFormFileSize(0);
    setManualFormFileSizeLabel('0 KB');
    setManualFormFileUrl('');
    setIsManualModalOpen(true);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualFormTitle.trim()) {
      showToast('매뉴얼 명칭을 입력해 주세요.', 'error');
      return;
    }
    if (!manualFormFileUrl) {
      showToast('매뉴얼 문서(PDF 등) 파일을 선택해 주세요.', 'error');
      return;
    }

    try {
      await saveEquipmentManual({
        modelName: manualFormModel,
        manufacturer: manualFormManufacturer,
        targetSpecFt: Number(manualFormTargetSpecFt) || undefined,
        category: manualFormCategory,
        title: manualFormTitle.trim(),
        fileUrl: manualFormFileUrl,
        fileName: manualFormFileName || `${manualFormTitle}.pdf`,
        fileSize: manualFormFileSize || 1024 * 1024,
        fileSizeLabel: manualFormFileSizeLabel,
        version: manualFormVersion.trim() || 'Rev. 1.0',
        uploadDate: getTodayStr(),
        uploadedBy: '정비자산팀',
        memo: manualFormMemo.trim()
      });
      await db.awaitPendingWrites();

      showToast(`[${manualFormTitle}] 매뉴얼 라이브러리 등록 완료`);
      setIsManualModalOpen(false);
    } catch (err: any) {
      showToast(`등록 실패: ${err?.message || err}`, 'error');
    }
  };

  const doDeleteManual = async (manual: EquipmentManual) => {
    try {
      await deleteEquipmentManual(manual.id);
      await db.awaitPendingWrites();
      showToast(`[${manual.title}] 매뉴얼이 삭제되었습니다.`);
    } catch (err: any) {
      showToast(`삭제 실패: ${err?.message || err}`, 'error');
    }
  };

  const handleDeleteManual = (manual: EquipmentManual) => {
    setConfirmModal({
      isOpen: true,
      title: '장비 매뉴얼 삭제',
      message: `매뉴얼 [${manual.title}] (${manual.modelName} / ${manual.category}) 문서를 라이브러리에서 삭제하시겠습니까?`,
      confirmText: '삭제 실행',
      isDanger: true,
      onConfirm: () => {
        setConfirmModal(null);
        doDeleteManual(manual);
      }
    });
  };

  const getCategoryBadgeClass = (category: EquipmentManual['category']) => {
    switch (category) {
      case 'PARTS_BOOK':
        return 'badge-info';
      case 'ERROR_CODE':
        return 'badge-danger';
      case 'WIRING_DIAGRAM':
        return 'badge-warning';
      case 'OPERATOR_MANUAL':
        return 'badge-success';
      default:
        return 'badge-secondary';
    }
  };

  const getCategoryLabel = (category: EquipmentManual['category']) => {
    switch (category) {
      case 'PARTS_BOOK':
        return '부품 파츠북';
      case 'ERROR_CODE':
        return '에러코드 진단표';
      case 'WIRING_DIAGRAM':
        return '전기/유압 회로도';
      case 'OPERATOR_MANUAL':
        return '취급 운전 설명서';
      default:
        return category;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
      {/* 🔔 인앱 토스트 알림 (헌장 5.2) */}
      {toastMessage && (
        <div
          style={{
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
          }}
        >
          {toastMessage.text}
        </div>
      )}

      {/* ─── 상단 헤더 & 탭 네비게이션 ─── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '12px'
        }}
      >
        <div>
          <h2 style={{ fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck className="text-primary" size={22} /> 정비 항목 & 역량 관리 스튜디오
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            정비 항목 마스터(SOP·부품연동), 기간별 조직역량 및 비용 분석, 장비 매뉴얼 라이브러리 통합
          </p
        ></div>

        {/* 3대 탭 스위처 */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '3px'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('MASTER')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: activeTab === 'MASTER' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'MASTER' ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            <Layers size={14} /> 정비 항목 마스터
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ANALYTICS')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: activeTab === 'ANALYTICS' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'ANALYTICS' ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            <BarChart2 size={14} /> 조직역량 & 비용 분석
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('MANUALS')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: activeTab === 'MANUALS' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'MANUALS' ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            <BookOpen size={14} /> 장비 매뉴얼 라이브러리
          </button>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* ─── [탭 1: 정비 항목 마스터 (MASTER)] ─── */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {activeTab === 'MASTER' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 상단 4대 요약 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>관리 분류</span>
              <strong style={{ fontSize: '15px', color: 'var(--primary)' }}>{masterAuditSummary.categoryCount}개 카테고리</strong>
            </div>
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>총 점검항목</span>
              <strong style={{ fontSize: '15px', color: '#16a34a' }}>{masterAuditSummary.totalCount}개</strong>
            </div>
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>평균 정비배점</span>
              <strong style={{ fontSize: '15px', color: '#d97706' }}>{masterAuditSummary.avgScore}점</strong>
            </div>
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>부품연계 항목</span>
              <strong style={{ fontSize: '15px', color: '#2563eb' }}>
                {masterAuditSummary.linkedPartsCount}개 ({masterAuditSummary.totalCount > 0 ? ((masterAuditSummary.linkedPartsCount / masterAuditSummary.totalCount) * 100).toFixed(0) : 0}%)
              </strong>
            </div>
          </div>

          {/* 필터 및 상단 파이프라인 액션 바 */}
          <div
            className="card"
            style={{
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px'
            }}
          >
            {/* 좌상단: Scope */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '260px' }}>
                <input
                  type="text"
                  placeholder="항목명, 코드, 가이드 검색..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px 7px 32px', fontSize: '12.5px' }}
                />
                <Search
                  size={14}
                  style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                />
              </div>

              {/* 카테고리 칩 필터 */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {['전체', '외관/바디', '유압/동력', '전기/배터리', '주행/타이어', '기타/검수'].map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                      fontSize: '11.5px',
                      cursor: 'pointer',
                      backgroundColor: selectedCategory === cat ? 'var(--primary)' : 'var(--bg-main)',
                      color: selectedCategory === cat ? '#ffffff' : 'var(--text-secondary)',
                      fontWeight: selectedCategory === cat ? 700 : 500,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 우상단: Pipeline 액션군 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={exportMasterToExcel}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', fontSize: '12px' }}
              >
                <FileDown size={14} /> 엑셀 내보내기
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleOpenAddItemModal}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', fontSize: '12px', fontWeight: 600 }}
              >
                <Plus size={15} /> 신규 정비 항목 등록
              </button>
            </div>
          </div>

          {/* 중앙 고밀도 데이터 그리드 (헌장 3.2: 줄바꿈 방지) */}
          <div className="card" style={{ padding: '14px' }}>
            <div className="table-container" style={{ maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ whiteSpace: 'nowrap', width: '50px' }}>No</th>
                    <th style={{ whiteSpace: 'nowrap', width: '90px' }}>카테고리</th>
                    <th style={{ whiteSpace: 'nowrap', width: '105px' }}>항목 코드</th>
                    <th style={{ whiteSpace: 'nowrap', width: '180px' }}>정비 필요 항목명</th>
                    <th style={{ whiteSpace: 'nowrap', width: '80px' }}>정비 배점</th>
                    <th style={{ whiteSpace: 'nowrap', width: '90px' }}>표준 공수</th>
                    <th style={{ whiteSpace: 'nowrap', minWidth: '160px' }}>추천 소모품 / 부품</th>
                    <th style={{ whiteSpace: 'nowrap', width: '100px' }}>누적 정비 건수</th>
                    <th style={{ minWidth: '220px' }}>표준 조치 절차 (SOP)</th>
                    <th style={{ whiteSpace: 'nowrap', width: '110px' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMasterItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
                        조회 조건에 해당하는 정비 점검 항목이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredMasterItems.map((item, idx) => {
                      const stat = repairMappingStats[item.code] || { count: 0 };
                      const recommendedParts = (item.recommendedConsumableIds || []).map(cid => consumableMap.get(cid)).filter(Boolean);

                      return (
                        <tr key={item.id}>
                          <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span className="badge badge-info">{item.category}</span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap', fontSize: '11.5px', color: 'var(--text-muted)' }}>{item.code}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <strong style={{ fontSize: '13px' }}>{item.name}</strong>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span
                              className="badge badge-warning"
                              style={{ fontSize: '11.5px', fontWeight: 'bold', padding: '2px 7px' }}
                            >
                              +{item.score}점
                            </span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                              {item.standardManHours || 0.5} M/H
                            </span>
                          </td>
                          <td>
                            {recommendedParts.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {recommendedParts.map(part => (
                                  <span
                                    key={part!.id}
                                    style={{
                                      fontSize: '11px',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      backgroundColor: '#eff6ff',
                                      color: '#1d4ed8',
                                      border: '1px solid #bfdbfe',
                                      whiteSpace: 'nowrap'
                                    }}
                                    title={`단가: ₩${(part!.unitPrice || 0).toLocaleString()} | 현재재고: ${part!.stockQty}개`}
                                  >
                                    {part!.modelName}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>-</span>
                            )}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {stat.count > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--primary)' }}>
                                  {stat.count.toLocaleString()}건
                                </span>
                                {stat.lastOccurred && (
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>최근 {stat.lastOccurred}</span>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>0건</span>
                            )}
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                            {item.actionGuide || item.description || '-'}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleOpenEditItemModal(item)}
                                style={{ padding: '3px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}
                              >
                                <Edit2 size={12} /> 수정
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleDeleteItem(item)}
                                style={{ padding: '3px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--danger)' }}
                              >
                                <Trash2 size={12} /> 삭제
                              </button>
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

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* ─── [탭 2: 조직역량 & 비용 분석 (ANALYTICS)] ─── */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {activeTab === 'ANALYTICS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 기간 선택 및 스코핑 컨트롤 바 */}
          <div
            className="card"
            style={{
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            {/* 좌상단: Scope (기간 및 카테고리) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={15} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '12px', fontWeight: 700 }}>분석 기간</span>
                <input
                  type="date"
                  value={analyticsStartDate}
                  onChange={e => setAnalyticsStartDate(e.target.value)}
                  style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>~</span>
                <input
                  type="date"
                  value={analyticsEndDate}
                  onChange={e => setAnalyticsEndDate(e.target.value)}
                  style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                />
              </div>

              {/* 기간 퀵 프리셋 버튼 */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setPeriodPreset('THIS_MONTH')}
                  style={{ padding: '3px 8px', fontSize: '11px' }}
                >
                  당월
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setPeriodPreset('LAST_MONTH')}
                  style={{ padding: '3px 8px', fontSize: '11px' }}
                >
                  전월
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setPeriodPreset('LAST_3_MONTHS')}
                  style={{ padding: '3px 8px', fontSize: '11px' }}
                >
                  최근 3개월
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setPeriodPreset('ALL')}
                  style={{ padding: '3px 8px', fontSize: '11px' }}
                >
                  전체
                </button>
              </div>

              {/* 카테고리 필터 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={13} style={{ color: 'var(--text-muted)' }} />
                <select
                  value={analyticsCategoryFilter}
                  onChange={e => setAnalyticsCategoryFilter(e.target.value)}
                  style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                >
                  <option value="전체">전체 카테고리</option>
                  <option value="외관/바디">외관/바디</option>
                  <option value="유압/동력">유압/동력</option>
                  <option value="전기/배터리">전기/배터리</option>
                  <option value="주행/타이어">주행/타이어</option>
                  <option value="기타/검수">기타/검수</option>
                </select
              ></div>
            </div>

            {/* 우상단: Pipeline (엑셀 내보내기) */}
            <div>
              <button
                type="button"
                className="btn-secondary"
                onClick={exportAnalyticsToExcel}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', fontSize: '12px' }}
              >
                <FileDown size={14} /> 정산 분석 엑셀 내보내기
              </button>
            </div>
          </div>

          {/* 상단 5대 핵심 KPI 카드 (조직역량 Throughput & 비용) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>정비 완료 총량 (건수)</span>
                <Clock size={15} style={{ color: 'var(--primary)' }} />
              </div>
              <strong style={{ fontSize: '18px', color: 'var(--primary)' }}>
                {analyticsData.totalRepairCount.toLocaleString()}건
              </strong>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                투입 공수: {analyticsData.grandTotalManHours} M/H
              </span>
            </div>

            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>정비 소요 총비용</span>
                <Wrench size={15} style={{ color: '#d97706' }} />
              </div>
              <strong style={{ fontSize: '18px', color: '#d97706' }}>
                ₩{analyticsData.grandTotalCost.toLocaleString()}
              </strong>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                부품비 + 외주비 합계
              </span>
            </div>

            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>자체 부품 소모액</span>
                <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 700 }}>부품</span>
              </div>
              <strong style={{ fontSize: '18px', color: '#16a34a' }}>
                ₩{analyticsData.grandPartCost.toLocaleString()}
              </strong>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                비중: {analyticsData.grandTotalCost > 0 ? ((analyticsData.grandPartCost / analyticsData.grandTotalCost) * 100).toFixed(1) : 0}%
              </span>
            </div>

            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>고객 유상 청구액</span>
                <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: 700 }}>청구</span>
              </div>
              <strong style={{ fontSize: '18px', color: '#2563eb' }}>
                ₩{analyticsData.grandBillableAmount.toLocaleString()}
              </strong>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>고객 과실/파손 청구</span>
            </div>

            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>당사 순부담 원가</span>
                <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 700 }}>순원가</span>
              </div>
              <strong style={{ fontSize: '18px', color: '#dc2626' }}>
                ₩{analyticsData.grandCompanyCost.toLocaleString()}
              </strong>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                총비용 - 고객청구액
              </span>
            </div>
          </div>

          {/* 중앙 고밀도 항목별 역량 및 비용 대사 그리드 (Inspection) */}
          <div className="card" style={{ padding: '14px' }}>
            <div className="table-container" style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ whiteSpace: 'nowrap', width: '50px' }}>No</th>
                    <th style={{ whiteSpace: 'nowrap', width: '90px' }}>카테고리</th>
                    <th style={{ whiteSpace: 'nowrap', width: '105px' }}>항목 코드</th>
                    <th style={{ whiteSpace: 'nowrap', minWidth: '160px' }}>정비 항목명</th>
                    <th style={{ whiteSpace: 'nowrap', width: '80px', textAlign: 'right' }}>발생 건수</th>
                    <th style={{ whiteSpace: 'nowrap', width: '90px', textAlign: 'right' }}>소요 공수</th>
                    <th style={{ whiteSpace: 'nowrap', width: '100px', textAlign: 'right' }}>자체 부품비</th>
                    <th style={{ whiteSpace: 'nowrap', width: '100px', textAlign: 'right' }}>외주 정비비</th>
                    <th style={{ whiteSpace: 'nowrap', width: '110px', textAlign: 'right' }}>정비 총비용</th>
                    <th style={{ whiteSpace: 'nowrap', width: '100px', textAlign: 'right' }}>고객 청구액</th>
                    <th style={{ whiteSpace: 'nowrap', width: '100px', textAlign: 'right' }}>회사 순부담</th>
                    <th style={{ whiteSpace: 'nowrap', width: '80px', textAlign: 'right' }}>비용 비중</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsData.items.length === 0 ? (
                    <tr>
                      <td colSpan={12} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
                        지정된 기간 내 정비 활동 데이터가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    analyticsData.items.map((item, idx) => {
                      const share = analyticsData.grandTotalCost > 0
                        ? ((item.totalCost / analyticsData.grandTotalCost) * 100).toFixed(1)
                        : '0.0';

                      return (
                        <tr key={item.itemCode}>
                          <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span className="badge badge-info">{item.category}</span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap', fontSize: '11.5px', color: 'var(--text-muted)' }}>{item.itemCode}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <strong style={{ fontSize: '13px' }}>{item.itemName}</strong>
                          </td>
                          <td style={{ whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                            {item.count}건
                          </td>
                          <td style={{ whiteSpace: 'nowrap', textAlign: 'right', fontSize: '12px' }}>
                            {item.totalManHours.toFixed(1)} M/H
                          </td>
                          <td style={{ whiteSpace: 'nowrap', textAlign: 'right', fontSize: '12px' }}>
                            ₩{item.partCost.toLocaleString()}
                          </td>
                          <td style={{ whiteSpace: 'nowrap', textAlign: 'right', fontSize: '12px' }}>
                            ₩{item.externalCost.toLocaleString()}
                          </td>
                          <td style={{ whiteSpace: 'nowrap', textAlign: 'right', fontSize: '12.5px', fontWeight: 700, color: '#d97706' }}>
                            ₩{item.totalCost.toLocaleString()}
                          </td>
                          <td style={{ whiteSpace: 'nowrap', textAlign: 'right', fontSize: '12px', color: '#2563eb' }}>
                            ₩{item.billableAmount.toLocaleString()}
                          </td>
                          <td style={{ whiteSpace: 'nowrap', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#dc2626' }}>
                            ₩{item.companyCost.toLocaleString()}
                          </td>
                          <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                              {share}%
                            </span>
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

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* ─── [탭 3: 장비 매뉴얼 라이브러리 (MANUALS)] ─── */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {activeTab === 'MANUALS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 상단 통계 바 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>등록 매뉴얼 총수</span>
              <strong style={{ fontSize: '15px', color: 'var(--primary)' }}>{manualSummary.total}건</strong>
            </div>
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>부품 파츠북</span>
              <strong style={{ fontSize: '15px', color: '#2563eb' }}>{manualSummary.partsBookCount}건</strong>
            </div>
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>에러코드 진단표</span>
              <strong style={{ fontSize: '15px', color: '#dc2626' }}>{manualSummary.errorCodeCount}건</strong>
            </div>
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>전기/유압 회로도</span>
              <strong style={{ fontSize: '15px', color: '#d97706' }}>{manualSummary.wiringCount}건</strong>
            </div>
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>취급 운전 설명서</span>
              <strong style={{ fontSize: '15px', color: '#16a34a' }}>{manualSummary.operatorCount}건</strong>
            </div>
          </div>

          {/* 검색 및 필터 컨트롤 바 */}
          <div
            className="card"
            style={{
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px'
            }}
          >
            {/* 좌상단: Scope */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '240px' }}>
                <input
                  type="text"
                  placeholder="매뉴얼명, 모델, 제조사 검색..."
                  value={manualSearchTerm}
                  onChange={e => setManualSearchTerm(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px 7px 32px', fontSize: '12.5px' }}
                />
                <Search
                  size={14}
                  style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                />
              </div>

              {/* 모델 필터 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  장비 모델:
                </span>
                <select
                  value={selectedManualModel}
                  onChange={e => setSelectedManualModel(e.target.value)}
                  style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                >
                  <option value="전체">전체 모델</option>
                  {modelOptions.map(model => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>

              {/* 문서 유형 칩 필터 */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {[
                  { key: '전체', label: '전체' },
                  { key: 'PARTS_BOOK', label: '파츠북' },
                  { key: 'ERROR_CODE', label: '에러코드' },
                  { key: 'WIRING_DIAGRAM', label: '회로도' },
                  { key: 'OPERATOR_MANUAL', label: '취급설명서' }
                ].map(item => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSelectedManualCategory(item.key)}
                    style={{
                      padding: '4px 9px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                      fontSize: '11.5px',
                      cursor: 'pointer',
                      backgroundColor: selectedManualCategory === item.key ? 'var(--primary)' : 'var(--bg-main)',
                      color: selectedManualCategory === item.key ? '#ffffff' : 'var(--text-secondary)',
                      fontWeight: selectedManualCategory === item.key ? 700 : 500,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 우상단: Pipeline 액션 */}
            <div>
              <button
                type="button"
                className="btn-primary"
                onClick={handleOpenAddManualModal}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', fontSize: '12px', fontWeight: 600 }}
              >
                <UploadCloud size={15} /> 신규 장비 매뉴얼 등록
              </button>
            </div>
          </div>

          {/* 카드 그리드 워크벤치 (유형 A/Card Dossier) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
            {filteredManuals.length === 0 ? (
              <div
                className="card"
                style={{ gridColumn: '1 / -1', padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}
              >
                등록된 장비 매뉴얼 문서가 없습니다. [신규 장비 매뉴얼 등록] 버튼으로 PDF를 업로드해 주세요.
              </div>
            ) : (
              filteredManuals.map(manual => (
                <div
                  key={manual.id}
                  className="card"
                  style={{
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                    border: '1px solid var(--border-color)',
                    transition: 'box-shadow 0.2s',
                    backgroundColor: 'var(--bg-card)'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* 상단 배지 헤더 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span className={`badge ${getCategoryBadgeClass(manual.category)}`} style={{ fontSize: '11px' }}>
                          {getCategoryLabel(manual.category)}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--bg-main)',
                            border: '1px solid var(--border-color)'
                          }}
                        >
                          {manual.modelName}
                        </span>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{manual.version}</span>
                    </div>

                    {/* 매뉴얼 명칭 */}
                    <h4
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        fontWeight: 700,
                        color: 'var(--text-main)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <FileText size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {manual.title}
                      </span>
                    </h4>

                    {/* 제원 및 제조사 정보 */}
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', display: 'flex', gap: '10px' }}>
                      <span>제조사: <strong>{manual.manufacturer}</strong></span>
                      {manual.targetSpecFt && <span>규격: <strong>{manual.targetSpecFt}ft</strong></span>}
                      <span>크기: <strong>{manual.fileSizeLabel || '0 MB'}</strong></span>
                    </div>

                    {/* 설명/메모 */}
                    {manual.memo && (
                      <p
                        style={{
                          margin: 0,
                          fontSize: '11.5px',
                          color: 'var(--text-muted)',
                          lineHeight: '1.4',
                          backgroundColor: 'var(--bg-main)',
                          padding: '6px 8px',
                          borderRadius: '4px'
                        }}
                      >
                        {manual.memo}
                      </p>
                    )}
                  </div>

                  {/* 하단 액션 버튼군 */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid var(--border-color)',
                      paddingTop: '10px'
                    }}
                  >
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                      등록일: {manual.uploadDate}
                    </span>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => setPreviewManual(manual)}
                        style={{ padding: '4px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Eye size={13} /> 열람
                      </button>
                      <a
                        href={manual.fileUrl}
                        download={manual.fileName}
                        className="btn-secondary"
                        style={{
                          padding: '4px 10px',
                          fontSize: '11.5px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          textDecoration: 'none'
                        }}
                      >
                        <Download size={13} /> 다운로드
                      </a>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => handleDeleteManual(manual)}
                        style={{ padding: '4px 8px', fontSize: '11.5px', color: 'var(--danger)' }}
                        title="매뉴얼 삭제"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* ─── [모달 1] 정비 필요 항목 등록/수정 모달 (상하 스택 헌장 3.4) ─── */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {isItemModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '10px'
              }}
            >
              <h3 style={{ margin: 0, fontWeight: '700', fontSize: '16px' }}>
                {editingItem ? '정비 항목 마스터 수정' : '신규 정비 항목 마스터 등록'}
              </h3>
              <button
                type="button"
                onClick={() => setIsItemModalOpen(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleItemSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {/* 카테고리 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>카테고리 분류 *</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    style={{ padding: '7px', fontSize: '12.5px' }}
                  >
                    <option value="외관/바디">외관/바디 (도장, 섀시, 커버)</option>
                    <option value="유압/동력">유압/동력 (실린더, 유압유, 호스)</option>
                    <option value="전기/배터리">전기/배터리 (단선, 컨트롤러, 충전기)</option>
                    <option value="주행/타이어">주행/타이어 (타이어, 휠, 모터)</option>
                    <option value="기타/검수">기타/검수</option>
                  </select>
                </div>

                {/* 항목 코드 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>항목 코드 (자동채번)</label>
                  <input
                    type="text"
                    value={formCode}
                    readOnly
                    style={{ padding: '7px', fontSize: '12.5px', backgroundColor: 'var(--bg-main)', color: 'var(--text-muted)' }}
                  />
                </div>
              </div>

              {/* 항목명 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>정비 항목명 *</label>
                <input
                  type="text"
                  placeholder="예: 실린더 유압유 누유 (패킹 마모)"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  required
                  style={{ padding: '8px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {/* 연동 정비 배점 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>연동 정비 배점 (벌점) *</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={formScore}
                    onChange={e => setFormScore(Number(e.target.value))}
                    required
                    style={{ padding: '7px', fontSize: '12.5px' }}
                  />
                </div>

                {/* 표준 작업 공수 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>표준 작업 공수 (M/H) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0.1}
                    max={50}
                    value={formManHours}
                    onChange={e => setFormManHours(Number(e.target.value))}
                    required
                    style={{ padding: '7px', fontSize: '12.5px' }}
                  />
                </div>
              </div>

              {/* 추천 소모품 / 부품 연계 멀티 선택 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>추천 소모품 / 필요 부품 연계 (다중 선택)</label>
                <div
                  style={{
                    maxHeight: '110px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '8px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    backgroundColor: 'var(--bg-main)'
                  }}
                >
                  {(consumables || []).map(part => {
                    const isSelected = formRecommendedConsumables.includes(part.id);
                    return (
                      <button
                        key={part.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setFormRecommendedConsumables(formRecommendedConsumables.filter(id => id !== part.id));
                          } else {
                            setFormRecommendedConsumables([...formRecommendedConsumables, part.id]);
                          }
                        }}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: isSelected ? '1px solid #2563eb' : '1px solid var(--border-color)',
                          backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                          color: isSelected ? '#1d4ed8' : 'var(--text-main)',
                          fontSize: '11.5px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {isSelected && <CheckCircle2 size={12} />}
                        {part.modelName} (₩{(part.unitPrice || 0).toLocaleString()})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 표준 조치 절차 (SOP) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>표준 조치 절차 (SOP)</label>
                <textarea
                  rows={2}
                  placeholder="정비사 조치 시 핵심 확인 절차 (예: 메인 밸브 차단 후 오링 교체, 유압유 레벨 점검)..."
                  value={formActionGuide}
                  onChange={e => setFormActionGuide(e.target.value)}
                  style={{ padding: '7px', fontSize: '12px' }}
                />
              </div>

              {/* 상세 설명 및 판단 가이드 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>상세 설명 및 입고검수 판단 기준</label>
                <textarea
                  rows={2}
                  placeholder="현장 검수자가 이 항목을 판단할 때 참고할 기준 가이드..."
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  style={{ padding: '7px', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsItemModalOpen(false)}
                  style={{ flex: 1, padding: '8px' }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1, padding: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                >
                  <Save size={14} /> 저장 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* ─── [모달 2] 신규 장비 매뉴얼 등록 모달 (상하 스택 헌장 3.4) ─── */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {isManualModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '540px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '10px'
              }}
            >
              <h3 style={{ margin: 0, fontWeight: '700', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <UploadCloud className="text-primary" size={18} /> 신규 장비 매뉴얼 등록
              </h3>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {/* 장비 모델 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>적용 장비 모델 *</label>
                  <input
                    type="text"
                    list="model-options"
                    placeholder="예: SJ-3219, GS-1930, 공통"
                    value={manualFormModel}
                    onChange={e => setManualFormModel(e.target.value)}
                    required
                    style={{ padding: '7px', fontSize: '12.5px' }}
                  />
                  <datalist id="model-options">
                    {modelOptions.map(m => (
                      <option key={m} value={m} />
                    ))}
                    <option value="공통" />
                  </datalist>
                </div>

                {/* 제조사 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>제조사 *</label>
                  <select
                    value={manualFormManufacturer}
                    onChange={e => setManualFormManufacturer(e.target.value)}
                    style={{ padding: '7px', fontSize: '12.5px' }}
                  >
                    <option value="Skyjack">Skyjack (스카이잭)</option>
                    <option value="Genie">Genie (지니)</option>
                    <option value="Dingli">Dingli (딩리)</option>
                    <option value="JLG">JLG</option>
                    <option value="기타">기타 제조사</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {/* 문서 분류 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>문서 분류 *</label>
                  <select
                    value={manualFormCategory}
                    onChange={e => setManualFormCategory(e.target.value as EquipmentManual['category'])}
                    style={{ padding: '7px', fontSize: '12.5px' }}
                  >
                    <option value="PARTS_BOOK">부품 파츠북 (Parts Book)</option>
                    <option value="ERROR_CODE">에러코드 진단표 (Error Codes)</option>
                    <option value="WIRING_DIAGRAM">전기/유압 회로도 (Schematics)</option>
                    <option value="OPERATOR_MANUAL">취급 운전 설명서 (Manual)</option>
                  </select>
                </div>

                {/* 개정 버전 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>개정 버전</label>
                  <input
                    type="text"
                    placeholder="예: Rev. 2024-C"
                    value={manualFormVersion}
                    onChange={e => setManualFormVersion(e.target.value)}
                    style={{ padding: '7px', fontSize: '12.5px' }}
                  />
                </div>
              </div>

              {/* 매뉴얼 명칭 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>매뉴얼 명칭 (제목) *</label>
                <input
                  type="text"
                  placeholder="예: Skyjack SJIII 3219 부품 매뉴얼 (Rev. 2024)"
                  value={manualFormTitle}
                  onChange={e => setManualFormTitle(e.target.value)}
                  required
                  style={{ padding: '8px', fontSize: '13px' }}
                />
              </div>

              {/* 파일 업로드 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>매뉴얼 문서 파일 (PDF 등) *</label>
                <div
                  style={{
                    border: '2px dashed var(--border-color)',
                    borderRadius: '8px',
                    padding: '16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: 'var(--bg-main)'
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <UploadCloud size={28} style={{ color: 'var(--primary)', marginBottom: '6px' }} />
                  {manualFormFileName ? (
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--primary)' }}>
                      선택된 파일: {manualFormFileName} ({manualFormFileSizeLabel})
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      클릭하여 PDF 문서 또는 매뉴얼 파일 선택
                    </div>
                  )}
                </div>
              </div>

              {/* 비고 및 요약 설명 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>비고 및 요약 설명</label>
                <textarea
                  rows={2}
                  placeholder="문서 주요 내용, 특이사항, 정비 참고 사항..."
                  value={manualFormMemo}
                  onChange={e => setManualFormMemo(e.target.value)}
                  style={{ padding: '7px', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsManualModalOpen(false)}
                  style={{ flex: 1, padding: '8px' }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1, padding: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                >
                  <Save size={14} /> 매뉴얼 등록 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* ─── [모달 3] 인앱 PDF/문서 미리보기 뷰어 모달 ─── */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {previewManual && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '20px'
          }}
        >
          <div
            className="card"
            style={{
              width: '95%',
              maxWidth: '960px',
              height: '85vh',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              overflow: 'hidden'
            }}
          >
            {/* 뷰어 헤더 */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 18px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`badge ${getCategoryBadgeClass(previewManual.category)}`}>
                  {getCategoryLabel(previewManual.category)}
                </span>
                <strong style={{ fontSize: '14px' }}>{previewManual.title}</strong>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({previewManual.modelName})</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <a
                  href={previewManual.fileUrl}
                  download={previewManual.fileName}
                  className="btn-secondary"
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    textDecoration: 'none'
                  }}
                >
                  <Download size={13} /> 다운로드
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewManual(null)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* 뷰어 본문 */}
            <div style={{ flex: 1, backgroundColor: '#333333', overflow: 'hidden', position: 'relative' }}>
              {previewManual.fileUrl.startsWith('data:application/pdf') || previewManual.fileName.endsWith('.pdf') ? (
                <iframe
                  src={previewManual.fileUrl}
                  title={previewManual.title}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    gap: '12px',
                    padding: '24px'
                  }}
                >
                  <FileText size={48} style={{ color: '#93c5fd' }} />
                  <div style={{ fontSize: '16px', fontWeight: 700 }}>{previewManual.title}</div>
                  <div style={{ fontSize: '13px', color: '#d1d5db' }}>
                    파일 형식: {previewManual.fileName} ({previewManual.fileSizeLabel || '0 KB'})
                  </div>
                  <p style={{ maxWidth: '500px', textAlign: 'center', fontSize: '12.5px', color: '#9ca3af' }}>
                    {previewManual.memo || '브라우저 내장 뷰어가 지원되지 않는 문서 형식입니다. [다운로드] 버튼을 눌러 원본 파일을 확인하세요.'}
                  </p>
                  <a
                    href={previewManual.fileUrl}
                    download={previewManual.fileName}
                    className="btn-primary"
                    style={{ padding: '8px 16px', fontSize: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Download size={15} /> 로컬 다운로드 및 열기
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* ─── [모달 4] 인앱 커스텀 삭제 확인 모달 (헌장 5.2) ─── */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {confirmModal && confirmModal.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '20px'
          }}
        >
          <div
            className="card"
            style={{
              width: '90%',
              maxWidth: '440px',
              backgroundColor: 'var(--bg-card)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <h3
              style={{
                fontSize: '15px',
                fontWeight: 800,
                margin: 0,
                color: confirmModal.isDanger ? 'var(--danger)' : 'var(--text-main)'
              }}
            >
              {confirmModal.title}
            </h3>
            <div
              style={{
                fontSize: '12.5px',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                color: 'var(--text-secondary)'
              }}
            >
              {confirmModal.message}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                borderTop: '1px solid var(--border-color)',
                paddingTop: '10px'
              }}
            >
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConfirmModal(null)}
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                취소
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={confirmModal.onConfirm}
                style={{
                  padding: '6px 16px',
                  fontSize: '12px',
                  backgroundColor: confirmModal.isDanger ? '#dc2626' : 'var(--primary)',
                  borderColor: confirmModal.isDanger ? '#dc2626' : 'var(--primary)'
                }}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* ─── [우하단 Gutenberg Z-패턴 4단계 최하단 대차대조식 바 (헌장 3.5)] ─── */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <div
        style={{
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
        }}
      >
        {activeTab === 'MASTER' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
            <span>🛠️ <strong>정비점검항목:</strong> {masterAuditSummary.totalCount}개</span>
            <span style={{ color: 'var(--border-color)' }}>|</span>
            <span>📂 <strong>관리분류:</strong> {masterAuditSummary.categoryCount}개 카테고리</span>
            <span style={{ color: 'var(--border-color)' }}>|</span>
            <span style={{ color: 'var(--warning)' }}>⭐ <strong>배점총합:</strong> {masterAuditSummary.totalScore}점 (평균 {masterAuditSummary.avgScore}점)</span>
            <span style={{ color: 'var(--border-color)' }}>|</span>
            <span>⏱️ <strong>표준공수 총계:</strong> {masterAuditSummary.totalManHours} M/H</span>
          </div>
        )}

        {activeTab === 'ANALYTICS' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
            <span>📄 <strong>정비총비용:</strong> ₩{analyticsData.grandTotalCost.toLocaleString()}</span>
            <span style={{ color: 'var(--border-color)' }}>=</span>
            <span style={{ color: '#16a34a' }}>🟢 <strong>부품비:</strong> ₩{analyticsData.grandPartCost.toLocaleString()}</span>
            <span>+</span>
            <span style={{ color: '#d97706' }}>🏢 <strong>외주비:</strong> ₩{analyticsData.grandExternalCost.toLocaleString()}</span>
            <span style={{ color: 'var(--border-color)' }}>=</span>
            <span style={{ color: '#2563eb' }}>🟢 <strong>고객청구:</strong> ₩{analyticsData.grandBillableAmount.toLocaleString()}</span>
            <span>+</span>
            <span style={{ color: '#dc2626' }}>🔴 <strong>회사순부담:</strong> ₩{analyticsData.grandCompanyCost.toLocaleString()}</span>
          </div>
        )}

        {activeTab === 'MANUALS' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
            <span>📚 <strong>매뉴얼 총계:</strong> {manualSummary.total}건</span>
            <span style={{ color: 'var(--border-color)' }}>|</span>
            <span>파츠북 {manualSummary.partsBookCount}건</span>
            <span style={{ color: 'var(--border-color)' }}>|</span>
            <span>에러코드 {manualSummary.errorCodeCount}건</span>
            <span style={{ color: 'var(--border-color)' }}>|</span>
            <span>회로도 {manualSummary.wiringCount}건</span>
            <span style={{ color: 'var(--border-color)' }}>|</span>
            <span>취급설명서 {manualSummary.operatorCount}건</span>
          </div>
        )}

        {/* 우측 종단 확정 배지 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: 'var(--success-light)',
              color: 'var(--success)',
              fontWeight: 700,
              fontSize: '11px',
              whiteSpace: 'nowrap'
            }}
          >
            {activeTab === 'ANALYTICS'
              ? `⚖️ 대차 차액 ₩${analyticsData.balanceDiff.toLocaleString()} (무결)`
              : '⚖️ 데이터 무결 보존'}
          </span>
        </div>
      </div>

      <div style={{ height: '50px' }} aria-hidden="true" />
    </div>
  );
};