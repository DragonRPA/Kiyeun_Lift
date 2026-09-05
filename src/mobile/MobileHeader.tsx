import React, { useState } from 'react';
import { LogOut, Wrench, Crown, Radio, RotateCw, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';

export type MobileDeptMode = 'SALES' | 'AS' | 'OUTBOUND' | 'EXECUTIVE' | 'ADMIN';

interface MobileHeaderProps {
  onSwitchToPc?: () => void;
  deptMode: MobileDeptMode;
  onChangeDeptMode: (mode: MobileDeptMode) => void;
  isWalkieOn?: boolean;
  onOpenWalkieTalkie?: () => void;
  onOpenGems?: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ 
  onSwitchToPc: _onSwitchToPc, 
  deptMode, 
  onChangeDeptMode,
  isWalkieOn = false,
  onOpenWalkieTalkie,
  onOpenGems
}) => {
  const { currentUser, logout } = useApp();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.update();
        }
      }
    } catch (e) {
      console.error('캐시 초기화 오류:', e);
    }
    setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('t', Date.now().toString());
      window.location.replace(url.toString());
    }, 200);
  };

  const deptList: { mode: MobileDeptMode; label: string; activeColor: string }[] = [
    { mode: 'SALES', label: '영업부', activeColor: '#2563eb' },
    { mode: 'AS', label: 'AS팀', activeColor: '#d97706' },
    { mode: 'OUTBOUND', label: '출고팀', activeColor: '#059669' },
    { mode: 'EXECUTIVE', label: '경영진', activeColor: '#7c3aed' },
    { mode: 'ADMIN', label: '관리부', activeColor: '#0284c7' },
  ];

  return (
    <>
      <header 
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #1e293b',
          padding: 'max(10px, env(safe-area-inset-top, 10px)) 12px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
          width: '100%',
          maxWidth: '100vw',
          overflowX: 'hidden'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, marginRight: '6px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            backgroundColor: deptMode === 'EXECUTIVE' ? '#7c3aed' : '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(37, 99, 235, 0.35)',
            flexShrink: 0
          }}>
            {deptMode === 'EXECUTIVE' ? (
              <Crown size={17} color="#ffffff" />
            ) : (
              <Wrench size={16} color="#ffffff" />
            )}
          </div>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '14px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.02em' }}>기연리프트</span>
              <span style={{
                fontSize: '9px',
                fontWeight: '700',
                padding: '1px 5px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                color: '#60a5fa',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                flexShrink: 0
              }}>
                FIELD
              </span>
            </div>
            <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentUser?.name || '담당자'} ({currentUser?.role === 'ADMIN' ? '최고관리자' : currentUser?.role === 'MECHANIC' ? '정비기사' : '임직원'})
            </div>
          </div>
        </div>

        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px', 
            flexShrink: 1,
            minWidth: 0,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-x'
          }}
          className="scrollbar-none"
        >
          {/* 🔄 화면 새로고침 버튼 (헌장 3.1 무수식어 건조한 명사) */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: '600',
              padding: '6px 8px',
              borderRadius: '10px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              color: '#38bdf8',
              cursor: 'pointer',
              flexShrink: 0
            }}
            title="새로고침"
          >
            <RotateCw 
              size={13} 
              style={{
                transition: 'transform 0.4s ease',
                transform: isRefreshing ? 'rotate(360deg)' : 'none'
              }} 
              color="#38bdf8" 
            />
            <span>새로고침</span>
          </button>

          {/* 📻 현장 무전기 (PTT) 버튼 */}
          <button
            type="button"
            onClick={onOpenWalkieTalkie}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: '700',
              padding: '6px 8px',
              borderRadius: '10px',
              backgroundColor: isWalkieOn ? 'rgba(16, 185, 129, 0.2)' : '#1e293b',
              border: isWalkieOn ? '1px solid #10b981' : '1px solid #334155',
              color: isWalkieOn ? '#34d399' : '#cbd5e1',
              cursor: 'pointer',
              flexShrink: 0
            }}
            title="무전기"
          >
            <Radio size={13} color={isWalkieOn ? '#34d399' : '#94a3b8'} />
            <span>{isWalkieOn ? '무전ON' : '무전'}</span>
            {isWalkieOn && (
              <span style={{
                width: '5px',
                height: '5px',
                borderRadius: '9999px',
                backgroundColor: '#10b981',
                boxShadow: '0 0 5px #10b981'
              }} />
            )}
          </button>

          {/* ✨ 기연 렌탈 GEMS AI 음성비서 버튼 */}
          <button
            type="button"
            onClick={onOpenGems}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: '800',
              padding: '6px 8px',
              borderRadius: '10px',
              backgroundColor: 'rgba(2, 132, 199, 0.25)',
              border: '1px solid #38bdf8',
              color: '#38bdf8',
              cursor: 'pointer',
              flexShrink: 0
            }}
            title="GEMS AI 음성 비서"
          >
            <Sparkles size={13} color="#38bdf8" />
            <span>AI비서</span>
          </button>

          <button
            onClick={logout}
            style={{
              padding: '7px',
              borderRadius: '10px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
            title="로그아웃"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* 부서별 특화 모드 5대 직무 퀵 체인저 (헌장 3.1 무수식어 건조한 명사) */}
      <div style={{
        backgroundColor: 'rgba(15, 23, 42, 0.98)',
        padding: '6px 12px 8px',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          backgroundColor: '#020617',
          padding: '3px',
          borderRadius: '10px',
          border: '1px solid #334155'
        }}>
          {deptList.map(item => {
            const isActive = deptMode === item.mode;
            return (
              <button
                key={item.mode}
                type="button"
                onClick={() => onChangeDeptMode(item.mode)}
                style={{
                  flex: 1,
                  padding: '5px 0',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: isActive ? '800' : '500',
                  backgroundColor: isActive ? item.activeColor : 'transparent',
                  color: isActive ? '#ffffff' : '#94a3b8',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
