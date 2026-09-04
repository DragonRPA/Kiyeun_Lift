// src/mobile/MobileApp.tsx
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { MobileHeader, MobileDeptMode } from './MobileHeader';
import { MobileBottomNav, MobileTabType } from './MobileBottomNav';
import { MobileHome } from './pages/MobileHome';
import { MobileExecutiveHome } from './pages/MobileExecutiveHome';
import { MobileAdminHome } from './pages/MobileAdminHome';
import { MobileAsList } from './pages/MobileAsList';
import { MobileAsDetail } from './pages/MobileAsDetail';
import { MobileAsCreate } from './pages/MobileAsCreate';
import { MobileDispatchList } from './pages/MobileDispatchList';
import { MobileInspectionList } from './pages/MobileInspectionList';
import { MobileAssetSearch } from './pages/MobileAssetSearch';
import { MobileDispatchOrderCreate } from './pages/MobileDispatchOrderCreate';
import { MobileMyContracts } from './pages/MobileMyContracts';
import { PwaInstallBanner } from './components/PwaInstallBanner';
import './mobile.css';

interface MobileAppProps {
  onSwitchToPc: () => void;
}

export const MobileApp: React.FC<MobileAppProps> = ({ onSwitchToPc }) => {
  const { fieldAsTickets, deliveries, outboundInspections, currentUser } = useApp();

  // 1. 초기 부서 모드 감지 (사용자 역할 기반 또는 저장된 모드)
  const [deptMode, setDeptMode] = useState<MobileDeptMode>(() => {
    const saved = localStorage.getItem('erp_mobile_dept') as MobileDeptMode;
    if (saved && (saved === 'SALES' || saved === 'AS' || saved === 'OUTBOUND' || saved === 'EXECUTIVE' || saved === 'ADMIN')) {
      return saved;
    }
    const role = (currentUser?.role || '').toUpperCase();
    if (role === 'ADMIN') return 'EXECUTIVE';
    if (role === 'ACCOUNTING' || role === 'OFFICE') return 'ADMIN';
    if (role === 'MECHANIC' || role === 'AS') return 'AS';
    if (role === 'DISPATCH' || role === 'YARD') return 'OUTBOUND';
    return 'SALES';
  });

  const [activeTab, setActiveTab] = useState<MobileTabType>('home');
  const [selectedAsTicketId, setSelectedAsTicketId] = useState<string | null>(null);
  const [isCreatingAs, setIsCreatingAs] = useState(false);

  // 부서 모드 변경 핸들러
  const handleDeptModeChange = (mode: MobileDeptMode) => {
    setDeptMode(mode);
    localStorage.setItem('erp_mobile_dept', mode);
    setActiveTab('home');
    setSelectedAsTicketId(null);
    setIsCreatingAs(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // 미처리 배지 카운트
  const pendingAsCount = fieldAsTickets.filter(
    (t) => t.status === 'REQUESTED' || t.status === 'SCHEDULED' || t.status === 'REVISIT' || t.status === 'IN_PROGRESS'
  ).length;

  const pendingDispatchCount = deliveries.filter(
    (d) => d.status === 'DISPATCHED' || d.status === 'PENDING'
  ).length;

  const pendingInspectionCount = outboundInspections.filter((ins) => ins.status === 'PENDING').length;

  // 네비게이션 핸들러
  const handleTabChange = (tab: MobileTabType) => {
    setSelectedAsTicketId(null);
    setIsCreatingAs(false);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAsDetail = (ticketId: string) => {
    setSelectedAsTicketId(ticketId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenCreateAs = () => {
    setIsCreatingAs(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="mobile-app-root min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* 상단 모바일 헤더 + 부서 퀵 체인저 */}
      <MobileHeader 
        onSwitchToPc={onSwitchToPc}
        deptMode={deptMode}
        onChangeDeptMode={handleDeptModeChange}
      />

      {/* 홈 화면 PWA 설치 안내 배너 */}
      <PwaInstallBanner />

      {/* 본문 라우팅 */}
      <main className="flex-1 w-full max-w-lg mx-auto">
        {selectedAsTicketId ? (
          <MobileAsDetail
            ticketId={selectedAsTicketId}
            onBack={() => setSelectedAsTicketId(null)}
          />
        ) : isCreatingAs ? (
          <MobileAsCreate
            onBack={() => setIsCreatingAs(false)}
            onCreated={(ticketId) => {
              setIsCreatingAs(false);
              setSelectedAsTicketId(ticketId);
            }}
          />
        ) : activeTab === 'home' ? (
          deptMode === 'EXECUTIVE' ? (
            <MobileExecutiveHome
              onNavigate={handleTabChange}
              onOpenAsDetail={handleOpenAsDetail}
            />
          ) : deptMode === 'ADMIN' ? (
            <MobileAdminHome
              onNavigate={handleTabChange}
            />
          ) : (
            <MobileHome
              deptMode={deptMode}
              onNavigate={handleTabChange}
              onOpenAsDetail={handleOpenAsDetail}
              onOpenCreateAs={handleOpenCreateAs}
            />
          )
        ) : activeTab === 'sales_order' ? (
          <MobileDispatchOrderCreate
            onBack={() => handleTabChange('home')}
            onSuccess={() => handleTabChange('my_contracts')}
          />
        ) : activeTab === 'my_contracts' ? (
          <MobileMyContracts
            onOpenCreateAsForAsset={(assetNo, siteId) => handleOpenCreateAs()}
          />
        ) : activeTab === 'as_create' ? (
          <MobileAsCreate
            onBack={() => handleTabChange('home')}
            onCreated={(ticketId) => {
              setSelectedAsTicketId(ticketId);
            }}
          />
        ) : activeTab === 'as' ? (
          <MobileAsList
            onSelectTicket={handleOpenAsDetail}
            onOpenCreate={handleOpenCreateAs}
          />
        ) : activeTab === 'dispatch' ? (
          <MobileDispatchList />
        ) : activeTab === 'inspection' ? (
          <MobileInspectionList />
        ) : (
          <MobileAssetSearch />
        )}
      </main>

      {/* 하단 고정 부서별 특화 엄지손가락 내비게이션 바 */}
      {!selectedAsTicketId && !isCreatingAs && (
        <MobileBottomNav
          deptMode={deptMode}
          activeTab={activeTab}
          onChangeTab={handleTabChange}
          pendingAsCount={pendingAsCount}
          pendingDispatchCount={pendingDispatchCount}
          pendingInspectionCount={pendingInspectionCount}
        />
      )}
    </div>
  );
};
