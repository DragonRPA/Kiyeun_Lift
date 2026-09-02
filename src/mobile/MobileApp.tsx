// src/mobile/MobileApp.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MobileHeader } from './MobileHeader';
import { MobileBottomNav, MobileTabType } from './MobileBottomNav';
import { MobileHome } from './pages/MobileHome';
import { MobileAsList } from './pages/MobileAsList';
import { MobileAsDetail } from './pages/MobileAsDetail';
import { MobileAsCreate } from './pages/MobileAsCreate';
import { MobileDispatchList } from './pages/MobileDispatchList';
import { MobileInspectionList } from './pages/MobileInspectionList';
import { MobileAssetSearch } from './pages/MobileAssetSearch';

interface MobileAppProps {
  onSwitchToPc: () => void;
}

export const MobileApp: React.FC<MobileAppProps> = ({ onSwitchToPc }) => {
  const { fieldAsTickets, deliveries, outboundInspections } = useApp();

  const [activeTab, setActiveTab] = useState<MobileTabType>('home');
  const [selectedAsTicketId, setSelectedAsTicketId] = useState<string | null>(null);
  const [isCreatingAs, setIsCreatingAs] = useState(false);

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* 상단 모바일 헤더 */}
      <MobileHeader onSwitchToPc={onSwitchToPc} />

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
          <MobileHome
            onNavigate={handleTabChange}
            onOpenAsDetail={handleOpenAsDetail}
            onOpenCreateAs={handleOpenCreateAs}
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

      {/* 하단 고정 엄지손가락 내비게이션 바 */}
      {!selectedAsTicketId && !isCreatingAs && (
        <MobileBottomNav
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
