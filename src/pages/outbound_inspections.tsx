// src/pages/outbound_inspections.tsx
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
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
  Check
} from 'lucide-react';

// 21대 고소작업대 정비/스펙 체크리스트 마스터 정의
const ALL_SPECS = [
  { id: 'spec1', label: '4면 철망 설치 확인', category: '보양/안전' },
  { id: 'spec2', label: '확장대 철망 설치 확인', category: '보양/안전' },
  { id: 'spec3', label: '확장대 옆면 철망 설치 확인', category: '보양/안전' },
  { id: 'spec4', label: '원판 설치 상태 검수', category: '구조/설비' },
  { id: 'spec5', label: '배터리 단자 풀림 확인 마킹', category: '전원/배터리' },
  { id: 'spec6', label: '배터리 단자 커버 설치', category: '전원/배터리' },
  { id: 'spec7', label: '트레이 내부 볼트류 풀림 마킹', category: '구조/설비' },
  { id: 'spec8', label: '주행속도 세팅 (고속60/저속45)', category: '주행/제어' },
  { id: 'spec9', label: '오버로드 세팅 검수', category: '주행/제어' },
  { id: 'spec10', label: '조이스틱 커버 연장', category: '주행/제어' },
  { id: 'spec11', label: '탑승구 사다리 보양', category: '보양/안전' },
  { id: 'spec12', label: '모서리/전면부/미끄럼방지 보양', category: '보양/안전' },
  { id: 'spec13', label: '소화기함/손잡이/안내스티커', category: '보양/안전' },
  { id: 'spec14', label: '타이어 A급 상태 검수', category: '구조/설비' },
  { id: 'spec15', label: '점멸등/비상하강/정지장치 청결', category: '주행/제어' },
  { id: 'spec16', label: '작업높이 80% 세팅 확인', category: '주행/제어' },
  { id: 'spec17', label: '작업구간 라인구분 (초록/빨강)', category: '보양/안전' },
  { id: 'spec18', label: '하부상승제한/확장대50% 표식', category: '보양/안전' },
  { id: 'spec19', label: '비상정지/꼬리표 부착', category: '보양/안전' },
  { id: 'spec20', label: '협착위험 스티커 부착', category: '보양/안전' },
  { id: 'spec21', label: '부착물 세트 (제원표/보험증권 등)', category: '서류/스티커' }
];

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
  requestedSpecs: typeof ALL_SPECS; // 의뢰가 요구한 맞춤 정비 항목 목록
}

export const OutboundInspections: React.FC = () => {
  const {
    outboundInspections,
    contracts,
    assets,
    customers,
    sites,
    deliveries,
    currentUser,
    refreshAllData,
    hasPermission,
    showErrorModal
  } = useApp();

  const canEdit = hasPermission('repair', 'save') || hasPermission('delivery', 'save') || hasPermission('contract', 'save');

  const [activeTabStatus, setActiveTabStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // 선택된 의뢰 그룹의 체크리스트 (기본값: false 미체크!)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [inspectionNote, setInspectionNote] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // ──────────────────────────────────────────────────────────────────────────
  // 1. 개별 의뢰건들을 계약(contractId) 및 신청일자 기준 의뢰 1건 단위로 그룹핑
  // ──────────────────────────────────────────────────────────────────────────
  const inspectionGroups = useMemo<InspectionGroup[]>(() => {
    const groupMap = new Map<string, OutboundInspection[]>();

    outboundInspections.forEach(item => {
      // 계약 ID 또는 신청일 기준 그룹핑 키 생성
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

      // 그룹 내 포함된 자산 목록
      const groupAssets = items
        .map(i => assets.find(a => a.id === i.assetId))
        .filter((a): a is Asset => !!a);

      // 모델별 수량 집계 요약문
      const modelCounts: Record<string, number> = {};
      groupAssets.forEach(a => {
        modelCounts[a.modelName] = (modelCounts[a.modelName] || 0) + 1;
      });
      const summaryText = Object.entries(modelCounts)
        .map(([m, c]) => `${m} ${c}대`)
        .join(', ') || '장비 매핑 대기 중';

      // 의뢰 관련 배차(Delivery) 메모 분석하여 요구된 옵션/정비 항목 동적 선정
      const delivery = deliveries.find(d => d.contractId === firstItem.contractId && d.type === 'OUTBOUND');
      const memoText = `${delivery?.memo || ''} ${delivery?.closingMemo || ''} ${firstItem.note || ''}`.toLowerCase();

      // 의뢰에 맞춘 정비 요구 항목 필터링 (기본 필수 8개 + 메모 연관 스펙)
      let reqSpecs = ALL_SPECS.filter((spec, idx) => {
        // 필수 기본 검수 8개
        if ([0, 3, 4, 7, 8, 13, 14, 20].includes(idx)) return true;
        // 메모에 철망, 타이어, 스티커, 보양, 소화기 등 언급 시 추가
        if (memoText.includes('망') && spec.label.includes('망')) return true;
        if (memoText.includes('보양') && spec.label.includes('보양')) return true;
        if (memoText.includes('스티커') && spec.label.includes('스티커')) return true;
        if (memoText.includes('소화기') && spec.label.includes('소화기')) return true;
        return false;
      });

      if (reqSpecs.length < 5) {
        reqSpecs = ALL_SPECS.slice(0, 10);
      }

      // 대표 그룹 상태 판정 (하나라도 PENDING이면 PENDING, 전부 COMPLETED면 COMPLETED)
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
        requestedSpecs: reqSpecs
      });
    });

    return groups.sort((a, b) => b.requestDate.localeCompare(a.requestDate));
  }, [outboundInspections, contracts, customers, sites, assets, deliveries]);

  // 검색 및 탭 필터링
  const filteredGroups = useMemo(() => {
    return inspectionGroups.filter(g => {
      if (activeTabStatus !== 'ALL' && g.status !== activeTabStatus) return false;
      if (!searchQuery) return true;

      const q = searchQuery.toLowerCase();
      return (
        g.contractNo.toLowerCase().includes(q) ||
        g.customerName.toLowerCase().includes(q) ||
        g.siteName.toLowerCase().includes(q) ||
        g.assets.some(a => a.assetNo.toLowerCase().includes(q) || a.modelName.toLowerCase().includes(q))
      );
    });
  }, [inspectionGroups, activeTabStatus, searchQuery]);

  const selectedGroup = useMemo(() => {
    return inspectionGroups.find(g => g.groupId === selectedGroupId) || null;
  }, [inspectionGroups, selectedGroupId]);

  // 의뢰 그룹 선택 시 초기 체크리스트 로드 (기본값: false 미체크 보장!)
  const handleSelectGroup = (group: InspectionGroup) => {
    setSelectedGroupId(group.groupId);

    const initialCheckMap: Record<string, boolean> = {};
    // 요구 항목들 모두 초기 상태 false (미체크) 보장!
    group.requestedSpecs.forEach(s => {
      initialCheckMap[s.id] = false;
    });

    // 기존에 완료된 건이 있다면 저장된 스펙 로드
    const firstItem = group.items[0];
    if (firstItem && firstItem.specsJson) {
      try {
        const loaded = JSON.parse(firstItem.specsJson);
        Object.assign(initialCheckMap, loaded);
      } catch (e) {}
    }

    setCheckedItems(initialCheckMap);
    setInspectionNote(firstItem?.note || '');
  };

  // 1-Click 전체 항목 체크/해제 토글
  const handleToggleAllSpecs = () => {
    if (!selectedGroup) return;
    const allChecked = selectedGroup.requestedSpecs.every(s => checkedItems[s.id]);
    const nextMap: Record<string, boolean> = {};
    selectedGroup.requestedSpecs.forEach(s => {
      nextMap[s.id] = !allChecked;
    });
    setCheckedItems(nextMap);
  };

  // 접수 처리 (PENDING -> IN_PROGRESS)
  const handleAcceptGroup = async (group: InspectionGroup) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const nowIso = new Date().toISOString();
      group.items.forEach(item => {
        db.updateRow<OutboundInspection>('outboundInspections', item.id, {
          status: 'IN_PROGRESS',
          inspectorId: currentUser?.id,
          updatedAt: nowIso
        });
      });

      await db.awaitPendingWrites();
      refreshAllData();
      setSelectedGroupId(group.groupId);
    } catch (err: any) {
      showErrorModal(`⚠️ 의뢰 접수 처리 중 DB 동기화 오류가 발생했습니다:\n${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 최종 검수 승인 마감 (의뢰 1건에 속한 다수 장비 전체 일괄 승인 + RENTED 임대중 전환!)
  const handleApproveGroup = async () => {
    if (!selectedGroup || isProcessing) return;

    // 검수 미체크 항목이 있는지 확인 안내
    const uncheckedCount = selectedGroup.requestedSpecs.filter(s => !checkedItems[s.id]).length;
    if (uncheckedCount > 0) {
      if (!window.confirm(`⚠️ 아직 검수 완료되지 않은 항목이 ${uncheckedCount}개 있습니다.\n이대로 최종 출고 승인을 진행하시겠습니까?`)) {
        return;
      }
    }

    setIsProcessing(true);
    try {
      const nowIso = new Date().toISOString();
      const specsJson = JSON.stringify(checkedItems);

      // 의뢰 1건에 속한 전체 장비건 일괄 완료 처리
      for (const item of selectedGroup.items) {
        db.updateRow<OutboundInspection>('outboundInspections', item.id, {
          status: 'COMPLETED',
          specsJson,
          inspectorId: currentUser?.id,
          inspectedAt: nowIso,
          note: inspectionNote,
          updatedAt: nowIso
        });

        // 장비 자산 상태 SSOT: ASSIGNED -> RENTED (임대중) 전환!
        if (item.assetId) {
          db.updateRow<Asset>('assets', item.assetId, {
            status: 'RENTED',
            updatedAt: nowIso
          });
        }
      }

      await db.awaitPendingWrites();
      refreshAllData();
      alert(`✅ [의뢰 1건 마감 완료] 의뢰건(${selectedGroup.contractNo})에 속한 장비 ${selectedGroup.assets.length}대의 출고 정비/검수가 정상 마감 승인되었습니다!\n자산 상태가 '대여중(RENTED)'으로 전환되었습니다.`);
      setSelectedGroupId(null);
    } catch (err: any) {
      showErrorModal(`⚠️ 출고 검수 마감 처리 중 DB 동기화 오류가 발생했습니다:\n${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 반려 처리 (REJECTED)
  const handleConfirmRejectGroup = async () => {
    if (!selectedGroup || !rejectReason.trim() || isProcessing) return;
    setIsProcessing(true);
    try {
      const nowIso = new Date().toISOString();
      for (const item of selectedGroup.items) {
        db.updateRow<OutboundInspection>('outboundInspections', item.id, {
          status: 'REJECTED',
          note: `[반려사유] ${rejectReason}`,
          inspectorId: currentUser?.id,
          inspectedAt: nowIso,
          updatedAt: nowIso
        });

        // 자산 상태: AVAILABLE 복원
        if (item.assetId) {
          db.updateRow<Asset>('assets', item.assetId, {
            status: 'AVAILABLE',
            currentCustomerId: undefined,
            currentSiteId: undefined,
            contractStart: undefined,
            contractEnd: undefined,
            updatedAt: nowIso
          });
        }

        // 계약 슬롯(contractAssets) 해제
        if (item.contractAssetId) {
          db.updateRow<any>('contractAssets', item.contractAssetId, {
            assetId: '',
            updatedAt: nowIso
          });
        }
      }

      await db.awaitPendingWrites();
      refreshAllData();
      alert(`🔴 의뢰건이 반려 처리되어 포함된 장비 ${selectedGroup.assets.length}대의 할당이 해제되고 '임대가능'으로 복원되었습니다.`);
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedGroupId(null);
    } catch (err: any) {
      showErrorModal(`⚠️ 반려 처리 중 오류가 발생했습니다:\n${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 뱃지 스타일 헬퍼
  const getStatusBadge = (status: OutboundInspectionStatus) => {
    switch (status) {
      case 'PENDING':
        return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, backgroundColor: 'rgba(245,158,11,0.15)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> 미접수 대기</span>;
      case 'IN_PROGRESS':
        return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, backgroundColor: 'rgba(59,130,246,0.15)', color: '#2563eb', border: '1px solid rgba(59,130,246,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Wrench size={12} /> 접수/검수 중</span>;
      case 'COMPLETED':
        return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, backgroundColor: 'rgba(34,197,94,0.15)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={12} /> 검수완료 승인</span>;
      case 'REJECTED':
        return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, backgroundColor: 'rgba(239,68,68,0.15)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><XCircle size={12} /> 불량/반려</span>;
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 헤더 영역 */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ backgroundColor: 'var(--primary)', padding: '8px', borderRadius: '10px', color: '#fff', display: 'flex' }}>
              <PackageCheck size={22} />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>출고 검수 의뢰 관리 (의뢰 1건 단위 처리)</h1>
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            출고 의뢰 1건 단위(다수 장비 묶음)로 의뢰가 요구한 맞춤형 검수 항목을 체크하여 출고 승인을 마감합니다.
          </p>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 상태별 카운트 탭 */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { key: 'ALL', label: '전체 보기', count: inspectionGroups.length },
          { key: 'PENDING', label: '🟡 미접수 대기', count: inspectionGroups.filter(g => g.status === 'PENDING').length },
          { key: 'IN_PROGRESS', label: '🔵 접수/검수 중', count: inspectionGroups.filter(g => g.status === 'IN_PROGRESS').length },
          { key: 'COMPLETED', label: '🟢 검수 완료 승인', count: inspectionGroups.filter(g => g.status === 'COMPLETED').length },
          { key: 'REJECTED', label: '🔴 불량/반려', count: inspectionGroups.filter(g => g.status === 'REJECTED').length },
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

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 2열 메인 레이아웃 (좌: 의뢰 1건 단위 목록 | 우: 맞춤 검수서 작성) */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 420px) 1fr', gap: '20px' }}>
        
        {/* [좌측] 의뢰 1건 단위 목록 카드리스트 */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 230px)', minHeight: '600px' }}>
          <div style={{ marginBottom: '14px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="고객사 / 현장 / 계약 / 장비 검색..."
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

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
            {filteredGroups.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                검색 조건에 일치하는 출고 의뢰건이 없습니다.
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                        📄 {group.contractNo} (신청: {group.requestDate})
                      </span>
                      {getStatusBadge(group.status)}
                    </div>

                    <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      🏢 {group.customerName}
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                      📍 {group.siteName}
                    </div>

                    {/* 의뢰 포함 장비 묶음 태그 목록 */}
                    <div style={{ padding: '8px 10px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Layers size={13} /> 포함 장비 총 {group.assets.length}대 ({group.equipmentsSummary})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {group.assets.map(a => (
                          <span key={a.id} style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(59,130,246,0.1)', color: 'var(--primary)', fontWeight: 600, fontSize: '11px' }}>
                            {a.assetNo} ({a.modelName})
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 미접수 상태 시 바로 접수 버튼 */}
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

                {/* 포함 장비 다수 묶음 상세 표출 */}
                <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Wrench size={14} color="var(--primary)" /> 이번 의뢰에 동시 포함된 출고 대상 장비 ({selectedGroup.assets.length}대)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                    {selectedGroup.assets.map(asset => (
                      <div key={asset.id} style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: 'var(--bg-body)', border: '1px solid var(--border-color)', fontSize: '12px' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>🏷️ {asset.assetNo}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>모델: {asset.modelName} | 시리얼: {asset.serialNo || '-'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ────────────────────────────────────────────────────────────────── */}
              {/* 🎯 의뢰 요구 맞춤 정비 스펙 체크리스트 */}
              {/* ────────────────────────────────────────────────────────────────── */}
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

                {/* 개별 정비 항목 프리미엄 카드 디자인 (기본값 false 미체크) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                  {selectedGroup.requestedSpecs.map((spec, index) => {
                    const isChecked = !!checkedItems[spec.id]; // 기본값 false!
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
                        {/* 스위치 체크박스 아이콘 */}
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
                            {spec.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 특이사항 및 작업 메모 */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>
                  📝 정비 특이사항 및 작업 결과 메모
                </label>
                <textarea
                  placeholder="예: 배터리 단자 정비 완료, 4면 망 완비 완료, 타이어 교체 등 특이사항 기록..."
                  value={inspectionNote}
                  onChange={e => setInspectionNote(e.target.value)}
                  disabled={!canEdit}
                  style={{
                    width: '100%',
                    height: '80px',
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

              {/* 하단 최종 하차/출고 승인 버튼 (의뢰 1건 단위 마감!) */}
              {canEdit && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleApproveGroup}
                    disabled={isProcessing}
                    className="btn-primary"
                    style={{
                      flex: 1,
                      padding: '12px 20px',
                      fontSize: '14px',
                      fontWeight: 800,
                      backgroundColor: '#16a34a',
                      borderColor: '#16a34a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <ShieldCheck size={18} /> 최종 출고 승인 (의뢰 1건에 포함된 장비 {selectedGroup.assets.length}대 일괄 대여중 전환)
                  </button>

                  <button
                    onClick={() => setShowRejectModal(true)}
                    disabled={isProcessing}
                    style={{
                      padding: '12px 18px',
                      fontSize: '13px',
                      fontWeight: 700,
                      backgroundColor: 'rgba(239,68,68,0.1)',
                      color: '#dc2626',
                      border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    🚫 의뢰 반려
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 반려 사유 모달 */}
      {showRejectModal && selectedGroup && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '440px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--danger)', margin: '0 0 12px 0' }}>
              🚫 출고 의뢰 반려 사유 입력
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              반려 시 해당 의뢰건에 속한 장비 {selectedGroup.assets.length}대의 할당이 해제되고 '임대가능' 상태로 원복됩니다.
            </p>
            <textarea
              placeholder="반려 사유를 상세히 작성해 주세요..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              style={{ width: '100%', height: '90px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)', padding: '10px', fontSize: '13px', marginBottom: '16px', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setShowRejectModal(false)} className="btn-secondary" style={{ fontSize: '12px' }}>취소</button>
              <button onClick={handleConfirmRejectGroup} style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: '#dc2626', color: '#fff', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>반려 확정</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
