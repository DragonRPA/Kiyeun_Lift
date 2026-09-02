// src/mobile/MobileBottomNav.tsx
import React from 'react';
import { Home, Wrench, Truck, CheckSquare, Search } from 'lucide-react';

export type MobileTabType = 'home' | 'as' | 'dispatch' | 'inspection' | 'assets';

interface MobileBottomNavProps {
  activeTab: MobileTabType;
  onChangeTab: (tab: MobileTabType) => void;
  pendingAsCount?: number;
  pendingDispatchCount?: number;
  pendingInspectionCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onChangeTab,
  pendingAsCount = 0,
  pendingDispatchCount = 0,
  pendingInspectionCount = 0,
}) => {
  const navItems = [
    { id: 'home' as MobileTabType, label: '홈', icon: Home, badge: 0 },
    { id: 'as' as MobileTabType, label: '현장AS', icon: Wrench, badge: pendingAsCount },
    { id: 'dispatch' as MobileTabType, label: '배차확인', icon: Truck, badge: pendingDispatchCount },
    { id: 'inspection' as MobileTabType, label: '출고검수', icon: CheckSquare, badge: pendingInspectionCount },
    { id: 'assets' as MobileTabType, label: '가용자산', icon: Search, badge: 0 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/98 backdrop-blur-lg border-t border-slate-800 px-2 py-1.5 flex items-center justify-around safe-area-bottom shadow-2xl">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChangeTab(item.id)}
            className={`relative flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-2xl transition-all duration-150 active:scale-95 ${
              isActive
                ? 'text-blue-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              {item.badge > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg border border-slate-900 animate-pulse">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </div>
            <span className={`text-[11px] mt-1 ${isActive ? 'text-blue-400 font-black' : 'text-slate-400'}`}>
              {item.label}
            </span>
            {isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-0.5 shadow-md shadow-blue-500/50" />
            )}
          </button>
        );
      })}
    </nav>
  );
};
