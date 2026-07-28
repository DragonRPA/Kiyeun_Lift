import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { OutboundInspection, OutboundInspectionStatus, Asset, Contract, Customer, CustomerSite, db } from '../services/db';
import {
  CheckSquare,
  AlertTriangle,
  ShieldCheck,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  FileText,
  ChevronRight,
  UserCheck,
  Wrench,
  PackageCheck,
  Layers,
  Sparkles,
  Check,
  RefreshCw,
  ArrowRightLeft,
  Star,
  ShieldAlert,
  Calendar,
  RotateCcw,
  MessageSquare
} from 'lucide-react';

// 정비/기술 스펙 체크리스트 마스터 정의 (스마트 키워드 매칭 규격)
const ALL_SPECS = [
  { id: 'spec1', label: '철망 / 함석 설치 검수', category: '보양/안전', keywords: ['철망', '함석', '사면철망', '1면', '2면', '3면', '4면', '5면', '망'] },
  { id: 'spec2', label: '확장대 철망 / 함석 설치 검수', category: '보양/안전', keywords: ['확장대 철망', '확장대 함석', '확장대철망', '확장대함석'] },
  { id: 'spec3', label: '상단 감지봉 / 협착 방지 센서 검수', category: '보양/안전', keywords: ['감지봉', '감지봉 4ea', '상단감지', '협착', '센서', '4ea', '감지봉4ea'] },
  { id: 'spec4', label: '원판 설치 상태 검수', category: '구조/설비', keywords: ['원판설치', '원판'] },
  { id: 'spec5', label: '배터리 단자 풀림 확인 마킹', category: '전원/배터리', keywords: ['배터리 단자', '단자 풀림', '배터리 마킹'] },
  { id: 'spec6', label: '주행속도 세팅 (고속60/저속45)', category: '주행/제어', keywords: ['주행속도', '고속 60', '저속 45', '속도 세팅'] },
  { id: 'spec7', label: '오버로드 과적재 세팅 검수', category: '주행/제어', keywords: ['오버로드 셋팅', '오버로드', '과적'] },
  { id: 'spec8', label: '탑승구 사다리 및 모서리 보양', category: '보양/안전', keywords: ['사다리 보양', '모서리 보양', '사다리보양', '모서리보양', '모서리 8개소', '미끄럼방지'] },
  { id: 'spec9', label: '소화기함/손잡이/안내스티커', category: '보양/안전', keywords: ['소화기함', '기타 스티커물', '소화기', '안내스티커'] },
  { id: 'spec10', label: '타이어 A급 상태 검수', category: '구조/설비', keywords: ['타이어 A급', '타이어A급', '타이어 A급 상태'] },
  { id: 'spec11', label: '점멸등/비상하강/정지장치 청결', category: '주행/제어', keywords: ['점멸등', '비상하강장치', '비상정지장치'] },
  { id: 'spec12', label: '부착물 세트 (인증서/제원표/보험증권/체크리스트 등)', category: '서류/스티커', keywords: ['부착물', '제원표', '보험증권', '인증서', '반입전', '체크리스트'] }
];

// 💡 [동적 맞춤형 라벨 추출기] 원문 텍스트에서 '3면 함석', '4면 철망', '1면', '2면', '감지봉 4EA' 등 실감지 키워드로 100% 맞춰 동적 표출!
const getDynamicSpecLabel = (spec: { id: string; label: string }, text: string): string => {
  if (!text.trim()) return spec.label;
  const lowerText = text.toLowerCase();

  if (spec.id === 'spec1') {
    const match = text.match(/(\d+)\s*면\s*(함석|철망|망)/i) || text.match(/(함석|철망|망)\s*(\d+)\s*면/i);
    if (match) {
      const sideNum = match[1] && !isNaN(Number(match[1])) ? match[1] : match[2];
      const rawMat = (match[2] && (match[2].includes('함석') || match[2].includes('철망') || match[2].includes('망'))) ? match[2] : match[1];
      const material = rawMat.includes('함석') ? '함석' : '철망';
      return `${sideNum}면 ${material} 설치 검수`;
    }
    const sideOnlyMatch = text.match(/(\d+)\s*면/i);
    if (sideOnlyMatch) {
      const sideNum = sideOnlyMatch[1];
      const material = lowerText.includes('함석') ? '함석' : '철망';
      return `${sideNum}면 ${material} 설치 검수`;
    }
    if (lowerText.includes('함석')) return '함석 설치 검수';
    if (lowerText.includes('철망') || lowerText.includes('사면철망')) return '철망 설치 검수';
  }

  if (spec.id === 'spec2') {
    if (lowerText.includes('확장대 함석')) return '확장대 함석 설치 검수';
    if (lowerText.includes('확장대 철망')) return '확장대 철망 설치 검수';
  }

  if (spec.id === 'spec3') {
    const match = text.match(/감지봉\s*(\d+\s*EA|\d+\s*개)/i);
    if (match) return `상단 감지봉 / 협착 방지 센서 (${match[1].replace(/\s+/g, '')}) 검수`;
    if (lowerText.includes('감지봉')) return '상단 감지봉 / 협착 방지 센서 검수';
  }

  return spec.label;
};

// 의뢰 1건 그룹 단위 인터페이스
interface InspectionGroup {
  groupId: string;
  contractId: string;
  contractNo: string;
  customerName: string;
  siteName: string;
  requestDate: string;
  status: OutboundInspectionStatus;
  items: OutboundInspection[];
  assets: Asset[];
  equipmentsSummary: string;
  requestedSpecs: typeof ALL_SPECS;
  rawText?: string; // 스마트 출고시 입력된 자연어 원문 텍스트
}

export const OutboundInspections: React.FC = () => {
  const {
    outboundInspections,
    contracts,
    contractAssets,
    assets,
    customers,
    sites,
    deliveries,
    currentUser,
    refreshAllData,
    hasPermission,
    showErrorModal,
    exchangeOutboundAsset
  } = useApp();

  const canEdit = hasPermission('repair', 'save') || hasPermission('delivery', 'save') || hasPermission('contract', 'save');

  const [activeTabStatus, setActiveTabStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // 📅 요청일(신청일) 기간 필터 state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Quick 날짜 선택 헬퍼
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

  // 선택된 의뢰 그룹의 체크리스트 (기본값: false 미체크!)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [inspectionNote, setInspectionNote] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // 반려 모달 상태
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // 반려 시 수리정비중 전환 선택 옵션 (기본값: true)
  const [rejectToRepairing, setRejectToRepairing] = useState<boolean>(true);

  // 🔄 장비 교체 모달 상태
  const [exchangeModalAsset, setExchangeModalAsset] = useState<Asset | null>(null);
  const [targetNewAssetId, setTargetNewAssetId] = useState<string>('');
  const [exchangeReason, setExchangeReason] = useState<string>('');
  const [exchangeToRepairing, setExchangeToRepairing] = useState<boolean>(false); // 💡 기본값: false (수리 미전환)

  // 💡 교체 모달 오픈 시 첫번째 임대가능 대체 장비 100% 자동선택!
  React.useEffect(() => {
    if (exchangeModalAsset) {
      const availables = assets.filter(a => a.status === 'AVAILABLE' && a.modelName === exchangeModalAsset.modelName && a.id !== exchangeModalAsset.id);
      if (availables.length > 0 && (!targetNewAssetId || !availables.some(a => a.id === targetNewAssetId))) {
        setTargetNewAssetId(availables[0].id);
      }
    }
  }, [exchangeModalAsset, assets, targetNewAssetId]);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. 개별 의뢰건들을 계약(contractId) 및 신청일자 기준 의뢰 1건 단위로 그룹핑
  // ──────────────────────────────────────────────────────────────────────────
  const inspectionGroups = useMemo<InspectionGroup[]>(() => {
    const groupMap = new Map<string, OutboundInspection[]>();

    outboundInspections.forEach(item => {
      const key = `${item.contractId || 'NOCONTR'}_${item.createdAt ? item.createdAt.substring(0, 10) : 'NODATE'}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(item);
    });

    const groups: InspectionGroup[] = [];

    groupMap.forEach((items, key) => {
      const firstItem = items[0];
      const contract = contracts.find(c => c.id === firstItem.contractId);
      const customer = contract ? customers.find(c => c.id === contract.customerId) : null;
      const site = contract ? sites.find(s => s.id === contract.siteId) : null;

      const groupAssets = items
        .map(i => assets.find(a => a.id === i.assetId))
        .filter((a): a is Asset => !!a);

      const modelCounts: Record<string, number> = {};
      groupAssets.forEach(a => {
        modelCounts[a.modelName] = (modelCounts[a.modelName] || 0) + 1;
      });
      const summaryText = Object.entries(modelCounts)
        .map(([m, c]) => `${m} ${c}대`)
        .join(', ') || '장비 매핑 대기 중';

      const delivery = deliveries.find(d => d.contractId === firstItem.contractId && d.type === 'OUTBOUND');
      const rawText = delivery?.rawText || delivery?.memo || (contract as any)?.memo || firstItem.note || '';
      const memoText = `${rawText} ${delivery?.closingMemo || ''} ${firstItem.note || ''}`.toLowerCase();

      let reqSpecs = ALL_SPECS.filter(spec => {
        return spec.keywords.some(kw => memoText.includes(kw.toLowerCase()));
      });

      // 만약 원본 요청서에 아무런 특수 옵션 키워드가 없는 일반 기본 출고건인 경우 기본 필수 3종(배터리, 타이어, 부착물)만 표출
      if (reqSpecs.length === 0) {
        reqSpecs = ALL_SPECS.filter(s => ['spec5', 'spec10', 'spec12'].includes(s.id));
      }

      let groupStatus: OutboundInspectionStatus = 'PENDING';
      if (items.every(i => i.status === 'COMPLETED')) {
        groupStatus = 'COMPLETED';
      } else if (items.some(i => i.status === 'REJECTED')) {
        groupStatus = 'REJECTED';
      } else if (items.some(i => i.status === 'IN_PROGRESS')) {
        groupStatus = 'IN_PROGRESS';
      }

      groups.push({
        groupId: key,
        contractId: firstItem.contractId || '',
        contractNo: contract?.contractNo || '출고의뢰건',
        customerName: customer?.name || '고객 미지정',
        siteName: site?.name || '현장 미지정',
        requestDate: firstItem.createdAt ? firstItem.createdAt.substring(0, 10) : new Date().toISOString().split('T')[0],
        status: groupStatus,
        items,
        assets: groupAssets,
        equipmentsSummary: summaryText,
        requestedSpecs: reqSpecs,
        rawText
      });
    });

    return groups.sort((a, b) => b.requestDate.localeCompare(a.requestDate));
  }, [outboundInspections, contracts, customers, sites, assets, deliveries]);

  // ──────────────────────────────────────────────────────────────────────────
  // 2. 검색, 탭 및 📅 요청일자 기간 범위 필터링
  // ──────────────────────────────────────────────────────────────────────────
  const filteredGroups = useMemo(() => {
    return inspectionGroups.filter(g => {
      if (activeTabStatus !== 'ALL' && g.status !== activeTabStatus) return false;

      // 요청일 기간 범위 필터링 적용
      if (startDate && g.requestDate < startDate) return false;
      if (endDate && g.requestDate > endDate) return false;

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        g.customerName.toLowerCase().includes(q) ||
        g.siteName.toLowerCase().includes(q) ||
        g.contractNo.toLowerCase().includes(q) ||
        g.equipmentsSummary.toLowerCase().includes(q) ||
        (g.rawText && g.rawText.toLowerCase().includes(q)) ||
        g.assets.some(a => a.assetNo.toLowerCase().includes(q))
      );
    });
  }, [inspectionGroups, activeTabStatus, startDate, endDate, searchQuery]);

  const selectedGroup = useMemo(() => {
    if (!selectedGroupId) return null;
    return inspectionGroups.find(g => g.groupId === selectedGroupId) || null;
  }, [selectedGroupId, inspectionGroups]);

  const handleSelectGroup = (group: InspectionGroup) => {
    setSelectedGroupId(group.groupId);

    // 초기 체크 상태 세팅 (기본값 false 미체크!)
    const initialMap: Record<string, boolean> = {};
    group.requestedSpecs.forEach(spec => {
      initialMap[spec.id] = false;
    });

    // 만약 이미 검수가 진행중이거나 완료된 경우 기존 note 파싱
    const sampleNote = group.items[0]?.note || '';
    setInspectionNote(sampleNote);
    setCheckedItems(initialMap);
  };

  // 1-Click 전체 선택 / 해제
  const handleToggleAllSpecs = () => {
    if (!selectedGroup) return;
    const allChecked = selectedGroup.requestedSpecs.every(spec => !!checkedItems[spec.id]);
    const updated: Record<string, boolean> = {};
    selectedGroup.requestedSpecs.forEach(spec => {
      updated[spec.id] = !allChecked;
    });
    setCheckedItems(updated);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 3. 작업 접수 실행 (PENDING ➔ IN_PROGRESS)
  // ──────────────────────────────────────────────────────────────────────────
  const handleAcceptGroup = async (group: InspectionGroup) => {
    if (!canEdit) return;
    setIsProcessing(true);
    try {
      const nowIso = new Date().toISOString();
      const inspectorName = currentUser?.name || '담당엔지니어';

      group.items.forEach(item => {
        db.updateRow<OutboundInspection>('outboundInspections', item.id, {
          status: 'IN_PROGRESS',
          inspectorId: inspectorName,
          updatedAt: nowIso
        });
      });

      await db.awaitPendingWrites();
      refreshAllData();
      alert(`✅ [출고 의뢰 접수 완료]\n고객사 [${group.customerName}] 의뢰건 접수가 완료되었습니다.`);
      handleSelectGroup(group);
    } catch (err: any) {
      showErrorModal(`⚠️ 의뢰 접수 실패: ${err?.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 4. 최종 출고 승인 완료 (IN_PROGRESS ➔ COMPLETED & 자산 status ➔ ASSIGNED)
  // ──────────────────────────────────────────────────────────────────────────
  const handleApproveGroup = async () => {
    if (!selectedGroup || !canEdit) return;

    const checkedCount = Object.values(checkedItems).filter(Boolean).length;
    const totalCount = selectedGroup.requestedSpecs.length;

    if (checkedCount < totalCount) {
      if (!confirm(`⚠️ 의뢰 요구 항목 ${totalCount}개 중 ${checkedCount}개만 체크되었습니다.\n\n정말로 이대로 출고를 승인 마감하시겠습니까?`)) {
        return;
      }
    }

    setIsProcessing(true);
    try {
      const nowIso = new Date().toISOString();
      const inspectorName = currentUser?.name || '담당엔지니어';
      const resultNote = `[검수완료 ${checkedCount}/${totalCount}항목 합격] ${inspectionNote}`;

      selectedGroup.items.forEach(item => {
        db.updateRow<OutboundInspection>('outboundInspections', item.id, {
          status: 'COMPLETED',
          inspectorId: inspectorName,
          inspectedAt: nowIso,
          note: resultNote,
          updatedAt: nowIso
        });

        // 🟢 출고 승인 마감 시 해당 고유 장비의 status ➔ 'ASSIGNED' (할당 완료) 로 실시간 변동!
        if (item.assetId) {
          db.updateRow<Asset>('assets', item.assetId, {
            status: 'ASSIGNED',
            updatedAt: nowIso
          });
        }
      });

      await db.awaitPendingWrites();
      refreshAllData();
      alert(`🎉 [출고 승인 마감 성공]\n[${selectedGroup.customerName}] 출고 검수가 최종 마감되었습니다.`);
      setSelectedGroupId(null);
    } catch (err: any) {
      showErrorModal(`⚠️ 출고 승인 마감 실패: ${err?.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 5. 출고 반려 처리 (REJECTED & 자산 status ➔ REPAIRING 로 불량 전환)
  // ──────────────────────────────────────────────────────────────────────────
  const handleConfirmReject = async () => {
    if (!selectedGroup || !canEdit) return;
    if (!rejectReason.trim()) {
      showErrorModal('반려 사유를 입력해 주세요.');
      return;
    }

    setIsProcessing(true);
    try {
      const nowIso = new Date().toISOString();
      const inspectorName = currentUser?.name || '담당엔지니어';

      selectedGroup.items.forEach(item => {
        db.updateRow<OutboundInspection>('outboundInspections', item.id, {
          status: 'REJECTED',
          inspectorId: inspectorName,
          note: `[출고반려] ${rejectReason}`,
          updatedAt: nowIso
        });

        // 🔴 사용자 선택에 따라 수리정비중(REPAIRING) 또는 임대가능(AVAILABLE) 전환!
        if (item.assetId) {
          const targetStatus = rejectToRepairing ? 'REPAIRING' : 'AVAILABLE';
          db.updateRow<Asset>('assets', item.assetId, {
            status: targetStatus,
            updatedAt: nowIso
          });
        }
      });

      await db.awaitPendingWrites();
      refreshAllData();
      const statusText = rejectToRepairing ? '[수리정비중]으로 전환되었습니다.' : '[임대가능] 재고로 복원되었습니다.';
      alert(`🚫 [출고 의뢰 반려 완료]\n해당 의뢰건이 반려되었으며 장비 상태가 ${statusText}`);
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedGroupId(null);
    } catch (err: any) {
      showErrorModal(`⚠️ 반려 처리 실패: ${err?.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 6. 🔄 장비 교체 실행 (출고 검수 진행 중 장비 교체)
  // ──────────────────────────────────────────────────────────────────────────
  const handleConfirmExchangeAsset = async () => {
    if (!exchangeModalAsset || !targetNewAssetId || !selectedGroup) {
      showErrorModal('대체 장비를 선택해 주세요.');
      return;
    }

    // 💡 수리정비중 전환 시에만 사유 입력 필수, 수리 미전환 시 사유 입력은 선택 사항 (빈값 허용!)
    if (exchangeToRepairing && !exchangeReason.trim()) {
      showErrorModal('기존 장비를 [수리정비중]으로 전환 시에는 사유를 입력해 주세요.');
      return;
    }

    const finalReason = exchangeReason.trim(); // 빈값이면 빈값 그대로 전달 (비고 업서트 생략!)

    setIsProcessing(true);
    try {
      // 💡 선택된 의뢰 그룹 및 장비에 정확히 매칭되는 contractAsset ID 탐색
      const targetInsp = selectedGroup.items.find(i => i.assetId === exchangeModalAsset.id);
      const targetCaId = targetInsp?.contractAssetId || selectedGroup.contractId;

      await exchangeOutboundAsset(
        targetCaId,
        exchangeModalAsset.id,
        targetNewAssetId,
        finalReason,
        exchangeToRepairing // 사용자 선택 전송!
      );

      await db.awaitPendingWrites();
      refreshAllData();
      const statusText = exchangeToRepairing ? '[수리정비중]으로 전환되었습니다.' : '[임대가능] 재고로 유지되었습니다.';
      alert(`🔄 [장비 교체 완료]\n장비가 대체 장비로 스왑되었으며 기존 장비는 ${statusText}`);
      setExchangeModalAsset(null);
      setTargetNewAssetId('');
      setExchangeReason('');
      setSelectedGroupId(null);
    } catch (err: any) {
      showErrorModal(`⚠️ 장비 교체 실패: ${err?.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 뱃지 표출 헬퍼
  const getStatusBadge = (status: OutboundInspectionStatus) => {
    switch (status) {
      case 'PENDING':
        return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, backgroundColor: 'rgba(245,158,11,0.15)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> 접수 대기</span>;
      case 'IN_PROGRESS':
        return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, backgroundColor: 'rgba(59,130,246,0.15)', color: '#2563eb', border: '1px solid rgba(59,130,246,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Wrench size={12} /> 검수 진행중</span>;
      case 'COMPLETED':
        return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, backgroundColor: 'rgba(34,197,94,0.15)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={12} /> 출고 승인</span>;
      case 'REJECTED':
        return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, backgroundColor: 'rgba(239,68,68,0.15)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><XCircle size={12} /> 의뢰 반려</span>;
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* 헤더 영역 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontWeight: 800, fontSize: '22px', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <CheckSquare size={24} color="var(--primary)" /> 출고 검수 의뢰 관리 (의뢰 1건 단위)
          </h2>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            출고 의뢰 1건당 포함된 전체 장비를 그룹으로 묶어 요구된 기술 스펙 체크리스트를 검수합니다.
          </p>
        </div>
      </div>

      {/* 상태 필터 카운트 탭 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { key: 'ALL', label: '전체 의뢰 보기', count: inspectionGroups.length },
          { key: 'PENDING', label: '🟡 접수 대기', count: inspectionGroups.filter(g => g.status === 'PENDING').length },
          { key: 'IN_PROGRESS', label: '🔵 검수 진행중', count: inspectionGroups.filter(g => g.status === 'IN_PROGRESS').length },
          { key: 'COMPLETED', label: '🟢 출고 승인 마감', count: inspectionGroups.filter(g => g.status === 'COMPLETED').length },
          { key: 'REJECTED', label: '🔴 의뢰 반려', count: inspectionGroups.filter(g => g.status === 'REJECTED').length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTabStatus(tab.key)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: activeTabStatus === tab.key ? 'var(--primary)' : 'var(--border-color)',
              backgroundColor: activeTabStatus === tab.key ? 'rgba(59,130,246,0.1)' : 'var(--bg-card)',
              color: activeTabStatus === tab.key ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: activeTabStatus === tab.key ? 700 : 500,
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
              backgroundColor: activeTabStatus === tab.key ? 'var(--primary)' : 'var(--bg-body)',
              color: activeTabStatus === tab.key ? '#fff' : 'var(--text-muted)',
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

      {/* 2열 메인 레이아웃 (좌: 의뢰 묶음 카드리스트 + 📅 기간 선택 | 우: 상세 검수서) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 420px) 1fr', gap: '20px' }}>
        
        {/* [좌측] 의뢰 묶음 카드리스트 + 📅 요청일자 기간 지정 피커 */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 230px)', minHeight: '600px' }}>
          
          {/* 📅 의뢰 신청일자 기간 지정 피커 및 1-Click Quick 버튼 */}
          <div style={{ marginBottom: '12px', padding: '10px 12px', backgroundColor: 'var(--bg-body)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={13} /> 의뢰 신청일자 기간 조회
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
              placeholder="고객사 / 현장 / 계약 / 장비명 검색..."
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

          {/* 카드리스트 */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
            {filteredGroups.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                조건에 해당하는 출고 의뢰건이 없습니다.
              </div>
            ) : (
              filteredGroups.map(group => {
                const isSelected = selectedGroupId === group.groupId;
                return (
                  <div
                    key={group.groupId}
                    onClick={() => handleSelectGroup(group)}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--primary)' }}>
                        신청일: {group.requestDate}
                      </span>
                      {getStatusBadge(group.status)}
                    </div>

                    <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      🏢 {group.customerName}
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      📍 {group.siteName}
                    </div>

                    <div style={{ padding: '8px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '8px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Layers size={13} color="var(--primary)" /> 총 {group.assets.length}대 포함: {group.equipmentsSummary}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span>요구 스펙: {group.requestedSpecs.length}개 항목</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {group.assets.slice(0, 3).map(a => (
                          <span key={a.id} style={{ padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(59,130,246,0.1)', color: 'var(--primary)', fontWeight: 700 }}>
                            {a.assetNo}
                          </span>
                        ))}
                      </div>
                    </div>

                    {group.status === 'PENDING' && canEdit && (
                      <div style={{ marginTop: '10px', textAlign: 'right' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAcceptGroup(group); }}
                          disabled={isProcessing}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--primary)',
                            color: '#fff',
                            border: 'none',
                            fontWeight: 700,
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          ▶ 작업 접수 실행
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* [우측] 의뢰 맞춤 검수서 및 정비 체크 작성 */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 230px)', minHeight: '600px', overflowY: 'auto' }}>
          {!selectedGroup ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <PackageCheck size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p style={{ fontSize: '14px', fontWeight: 600 }}>좌측에서 검수할 출고 의뢰건을 선택해 주세요.</p>
            </div>
          ) : (
            <div>
              {/* 상세 상단 헤더 정보 */}
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-body)', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <FileText size={14} /> 출고 의뢰건 상세정보 (계약: {selectedGroup.contractNo})
                    </span>
                    <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '4px 0 0 0' }}>
                      🏢 {selectedGroup.customerName} — {selectedGroup.siteName}
                    </h2>
                  </div>
                  {getStatusBadge(selectedGroup.status)}
                </div>

                {/* 포함 장비 다수 묶음 상세 표출 + 🔄 [장비 교체] 버튼 장착! */}
                <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Wrench size={14} color="var(--primary)" /> 이번 의뢰에 동시 포함된 출고 대상 장비 ({selectedGroup.assets.length}대)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                    {selectedGroup.assets.map(asset => (
                      <div key={asset.id} style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'var(--bg-body)', border: '1px solid var(--border-color)', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>🏷️ {asset.assetNo}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>모델: {asset.modelName} | 시리얼: {asset.serialNo || '-'}</div>
                        </div>
                        {canEdit && selectedGroup.status !== 'COMPLETED' && (
                          <button
                            onClick={() => {
                              setExchangeModalAsset(asset);
                              setTargetNewAssetId('');
                              setExchangeReason('');
                            }}
                            title="출고 불가 사유 발생 시 동일 모델의 다른 임대가능 장비로 즉시 교체"
                            style={{
                              padding: '5px 9px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(239,68,68,0.1)',
                              color: '#dc2626',
                              border: '1px solid rgba(239,68,68,0.3)',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <ArrowRightLeft size={12} /> 교체
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 🎯 의뢰 요구 맞춤 정비 스펙 체크리스트 */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={16} color="var(--primary)" /> 의뢰 요구 맞춤 정비/기술 스펙 검수 항목 ({selectedGroup.requestedSpecs.length}개)
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                      해당 출고 의뢰가 요구한 핵심 항목만 엄선 표출됩니다. (초기 상태: 미체크 false)
                    </p>
                  </div>
                  {canEdit && (
                    <button
                      onClick={handleToggleAllSpecs}
                      className="btn-secondary"
                      style={{ fontSize: '12px', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <CheckCircle size={14} /> 1-Click 전체 체크/해제
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                  {selectedGroup.requestedSpecs.map((spec, index) => {
                    const isChecked = !!checkedItems[spec.id];
                    return (
                      <div
                        key={spec.id}
                        onClick={() => {
                          if (!canEdit) return;
                          setCheckedItems(prev => ({ ...prev, [spec.id]: !isChecked }));
                        }}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '10px',
                          border: isChecked ? '1.5px solid #22c55e' : '1px solid var(--border-color)',
                          backgroundColor: isChecked ? 'rgba(34,197,94,0.06)' : 'var(--bg-body)',
                          cursor: canEdit ? 'pointer' : 'default',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          transition: 'all 0.15s ease',
                          boxShadow: isChecked ? '0 2px 8px rgba(34,197,94,0.1)' : 'none'
                        }}
                      >
                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '6px',
                          border: isChecked ? 'none' : '2px solid var(--text-muted)',
                          backgroundColor: isChecked ? '#22c55e' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: '12px',
                          transition: 'all 0.15s ease'
                        }}>
                          {isChecked && <Check size={14} strokeWidth={3} />}
                        </div>

                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, color: isChecked ? '#16a34a' : 'var(--text-muted)', display: 'block' }}>
                            [{spec.category}] {index + 1}.
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: isChecked ? 700 : 500, color: isChecked ? '#15803d' : 'var(--text-primary)' }}>
                            {getDynamicSpecLabel(spec, selectedGroup.rawText || '')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 특이사항 및 작업 메모 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', display: 'block', color: 'var(--text-secondary)' }}>
                  📝 정비 특이사항 및 작업 결과 메모
                </label>
                <textarea
                  placeholder="예: 배터리 단자 정비 완료, 4면 망 완비 완료, 타이어 교체 등 특이사항 기록..."
                  value={inspectionNote}
                  onChange={e => setInspectionNote(e.target.value)}
                  disabled={!canEdit}
                  style={{
                    width: '100%',
                    height: '75px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-body)',
                    color: 'var(--text-primary)',
                    padding: '10px',
                    fontSize: '12.5px',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* ────────────────────────────────────────────────────────────────── */}
              {/* 💬 스마트 출고 요청 자연어 원본 텍스트 전용 박스 (배차와 동일 디자인) */}
              {/* ────────────────────────────────────────────────────────────────── */}
              <div style={{ marginBottom: '20px', padding: '14px 16px', backgroundColor: 'rgba(59,130,246,0.06)', border: '1.5px solid rgba(59,130,246,0.25)', borderRadius: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MessageSquare size={16} /> 💬 스마트 출고 요청 자연어 원본 텍스트 (검수 판단 참고용)
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.6', fontFamily: 'Consolas, Monaco, monospace', backgroundColor: 'var(--bg-card)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  {selectedGroup.rawText || '요청된 자연어 원문이 없습니다.'}
                </div>
              </div>

              {/* 하단 최종 출고 승인 및 반려 버튼 */}
              {canEdit && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleApproveGroup}
                    disabled={isProcessing}
                    className="btn-primary"
                    style={{
                      flex: 1,
                      padding: '12px 20px',
                      fontWeight: 800,
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <ShieldCheck size={18} /> [🟢 최종 출고 승인 마감] (할당 완료)
                  </button>

                  {selectedGroup.status !== 'COMPLETED' && (
                    <button
                      onClick={() => setShowRejectModal(true)}
                      disabled={isProcessing}
                      style={{
                        padding: '12px 20px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(239,68,68,0.1)',
                        color: '#dc2626',
                        border: '1px solid rgba(239,68,68,0.3)',
                        fontWeight: 800,
                        fontSize: '13.5px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <XCircle size={16} /> 🚫 의뢰 반려 (수리정비중 전환)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 반려 사유 입력 모달 */}
      {showRejectModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '480px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#dc2626', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={20} /> 출고 의뢰 반려 사유 작성
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              의뢰를 반려하면 대상 장비의 자산 상태 변경 여부를 직접 지정할 수 있습니다.
            </p>

            {/* 수리정비중 전환 선택 토글 */}
            <div style={{ marginBottom: '16px', padding: '10px 14px', backgroundColor: 'var(--bg-body)', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  🛠️ 반려 대상 장비를 [수리정비중 (REPAIRING)]으로 전환
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  꺼짐(OFF) 선택 시 임대가능(AVAILABLE) 재고 상태로 원복됩니다.
                </div>
              </div>
              <ToggleSwitch
                checked={rejectToRepairing}
                onChange={setRejectToRepairing}
              />
            </div>

            <textarea
              placeholder="반려 사유 입력 (예: 타이어 마모 심함, 배터리 충전 불량...)"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              style={{ width: '100%', height: '90px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box', marginBottom: '20px' }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowRejectModal(false)} className="btn-secondary">취소</button>
              <button onClick={handleConfirmReject} style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: '#dc2626', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                반려 처리 실행
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔄 1-Click 장비 교체 모달 */}
      {exchangeModalAsset && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowRightLeft size={20} color="var(--primary)" /> 출고 의뢰 1-Click 장비 교체
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              기존 장비 <strong style={{ color: 'var(--primary)' }}>[{exchangeModalAsset.assetNo}] ({exchangeModalAsset.modelName})</strong>를 대체 가능한 동급 장비로 교체합니다.
            </p>

            {/* 기존 장비 수리정비중 전환 토글 */}
            <div style={{ marginBottom: '16px', padding: '10px 14px', backgroundColor: 'var(--bg-body)', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  🛠️ 기존 교체 대상 장비 [{exchangeModalAsset.assetNo}]를 [수리정비중 (REPAIRING)]으로 전환
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  꺼짐(OFF) 선택 시 임대가능(AVAILABLE) 재고 상태로 유지됩니다.
                </div>
              </div>
              <ToggleSwitch
                checked={exchangeToRepairing}
                onChange={setExchangeToRepairing}
              />
            </div>

            {/* 교체사유 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>
                교체 사유 {exchangeToRepairing ? <span style={{ color: '#ef4444' }}>(수리정비중 전환 시 필수)</span> : <span style={{ color: 'var(--text-muted)' }}>(수리 미전환 시 선택 사항 - 입력 생략 가능)</span>}
              </label>
              <input
                type="text"
                placeholder={exchangeToRepairing ? "예: 배터리 방전 발생, 조이스틱 모듈 작동 불량 등" : "사유 미입력 시 '단순 장비 교체'로 등록됩니다 (입력 생략 가능)"}
                value={exchangeReason}
                onChange={e => setExchangeReason(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }}
              />
            </div>

            {/* 대체 장비 셀렉터 */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>
                대체 장비 선택 (동일 모델 {exchangeModalAsset.modelName} 내 임대가능 장비만 노출)
              </label>

              {assets.filter(a => a.status === 'AVAILABLE' && a.modelName === exchangeModalAsset.modelName && a.id !== exchangeModalAsset.id).length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>
                  ⚠️ 교체 가능한 동일 모델({exchangeModalAsset.modelName})의 임대가능(AVAILABLE) 자산이 없습니다.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px', maxHeight: '280px', overflowY: 'auto' }}>
                  {assets.filter(a => a.status === 'AVAILABLE' && a.modelName === exchangeModalAsset.modelName && a.id !== exchangeModalAsset.id).map(a => {
                    const isTarget = targetNewAssetId === a.id;
                    const score = (a as any).maintenanceScore ?? 95;
                    return (
                      <div
                        key={a.id}
                        onClick={() => setTargetNewAssetId(a.id)}
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          border: isTarget ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          backgroundColor: isTarget ? 'rgba(59,130,246,0.08)' : 'var(--bg-body)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)' }}>🏷️ {a.assetNo}</span>
                          <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, backgroundColor: score >= 80 ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: score >= 80 ? '#16a34a' : '#d97706' }}>
                            정비점수: {score}점
                          </span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>시리얼: {a.serialNo || '-'}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setExchangeModalAsset(null)} className="btn-secondary" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}>취소</button>
              {(() => {
                const isBtnDisabled = isProcessing || !targetNewAssetId || (exchangeToRepairing && !exchangeReason.trim());
                return (
                  <button
                    onClick={handleConfirmExchangeAsset}
                    disabled={isBtnDisabled}
                    style={{
                      padding: '9px 22px',
                      borderRadius: '8px',
                      fontWeight: 800,
                      fontSize: '13.5px',
                      backgroundColor: isBtnDisabled ? 'var(--border-color, #cbd5e1)' : 'var(--primary, #3b82f6)',
                      color: isBtnDisabled ? 'var(--text-muted, #64748b)' : '#ffffff',
                      border: 'none',
                      cursor: isBtnDisabled ? 'not-allowed' : 'pointer',
                      boxShadow: isBtnDisabled ? 'none' : '0 4px 14px rgba(59,130,246,0.35)',
                      transition: 'all 0.15s ease',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <ArrowRightLeft size={15} /> 교체 실행
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
