// src/mobile/MobileHeader.tsx
import React from 'react';
import { Monitor, Sun, Moon, LogOut, Wrench } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface MobileHeaderProps {
  onSwitchToPc: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ onSwitchToPc }) => {
  const { currentUser, logout, theme, toggleTheme } = useApp();

  return (
    <header 
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #1e293b',
        padding: '12px 16px',
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
          backgroundColor: '#2563eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 10px rgba(37, 99, 235, 0.35)',
          flexShrink: 0
        }}>
          <Wrench size={16} color="#ffffff" />
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
            {currentUser?.name || '현장 담당자'} ({currentUser?.role === 'MECHANIC' ? '기사' : '관리자'})
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
  );
};
