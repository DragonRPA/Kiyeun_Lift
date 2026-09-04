import React from 'react';
import { Monitor, LogOut, Wrench, Crown, Radio } from 'lucide-react';
import { useApp } from '../context/AppContext';

export type MobileDeptMode = 'SALES' | 'AS' | 'OUTBOUND' | 'EXECUTIVE' | 'ADMIN';

interface MobileHeaderProps {
  onSwitchToPc: () => void;
  deptMode: MobileDeptMode;
  onChangeDeptMode: (mode: MobileDeptMode) => void;
  isWalkieOn?: boolean;
  onOpenWalkieTalkie?: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ 
  onSwitchToPc, 
  deptMode, 
  onChangeDeptMode,
  isWalkieOn = false,
  onOpenWalkieTalkie
}) => {
  const { currentUser, logout } = useApp();

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
          padding: 'max(12px, env(safe-area-inset-top, 12px)) 16px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '15px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.02em' }}>기연리프트</span>
              <span style={{
                fontSize: '10px',
                fontWeight: '700',
                padding: '2px 6px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                color: '#60a5fa',
                border: '1px solid rgba(59, 130, 246, 0.3)'
              }}>
                FIELD
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
              {currentUser?.name || '담당자'} ({currentUser?.role === 'ADMIN' ? '최고관리자' : currentUser?.role === 'MECHANIC' ? '정비기사' : '임직원'})
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* 📻 현장 무전기 (PTT) 버튼 */}
          <button
            type="button"
            onClick={onOpenWalkieTalkie}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '12px',
              fontWeight: '700',
              padding: '6px 10px',
              borderRadius: '10px',
              backgroundColor: isWalkieOn ? 'rgba(16, 185, 129, 0.2)' : '#1e293b',
              border: isWalkieOn ? '1px solid #10b981' : '1px solid #334155',
              color: isWalkieOn ? '#34d399' : '#cbd5e1',
              cursor: 'pointer'
            }}
            title="현장 무전기 (PTT)"
          >
            <Radio size={14} color={isWalkieOn ? '#34d399' : '#94a3b8'} />
            <span>{isWalkieOn ? '무전ON' : '무전'}</span>
            {isWalkieOn && (
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '9999px',
                backgroundColor: '#10b981',
                boxShadow: '0 0 6px #10b981'
              }} />
            )}
          </button>

          <button
            onClick={onSwitchToPc}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: '600',
              padding: '6px 10px',
              borderRadius: '10px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              color: '#cbd5e1',
              cursor: 'pointer'
            }}
            title="PC 대장 화면으로 전환"
          >
            <Monitor size={14} color="#38bdf8" />
            <span>PC화면</span>
          </button>

          <button
            onClick={logout}
            style={{
              padding: '8px',
              borderRadius: '10px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="로그아웃"
          >
            <LogOut size={16} />
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
