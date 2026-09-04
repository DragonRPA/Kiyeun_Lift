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
    <nav 
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9000,
        backgroundColor: 'rgba(15, 23, 42, 0.98)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid #1e293b',
        padding: '6px 8px env(safe-area-inset-bottom, 8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.4)'
      }}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChangeTab(item.id)}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              padding: '6px 4px',
              borderRadius: '12px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: isActive ? '#60a5fa' : '#94a3b8',
              fontWeight: isActive ? '700' : '500'
            }}
          >
            <div style={{ position: 'relative' }}>
              <Icon size={22} color={isActive ? '#60a5fa' : '#94a3b8'} strokeWidth={isActive ? 2.4 : 1.8} />
              {item.badge > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-10px',
                  minWidth: '18px',
                  height: '18px',
                  padding: '0 4px',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: '900',
                  borderRadius: '9999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #0f172a'
                }}>
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </div>
            <span style={{
              fontSize: '11px',
              marginTop: '4px',
              color: isActive ? '#60a5fa' : '#94a3b8',
              fontWeight: isActive ? '800' : '500'
            }}>
              {item.label}
            </span>
            {isActive && (
              <span style={{
                width: '4px',
                height: '4px',
                borderRadius: '9999px',
                backgroundColor: '#3b82f6',
                marginTop: '2px'
              }} />
            )}
          </button>
        );
      })}
    </nav>
  );
};
