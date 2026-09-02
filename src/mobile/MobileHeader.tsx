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
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between safe-area-top shadow-md">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
          <Wrench className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-black tracking-tight text-white">기연리프트</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
              FIELD
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            {currentUser?.name || '현장 담당자'} ({currentUser?.role === 'MECHANIC' ? '기사' : '관리자'})
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={onSwitchToPc}
          className="flex items-center gap-1 text-xs font-semibold py-1.5 px-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white active:scale-95 transition-transform"
          title="PC 대장 화면으로 전환"
        >
          <Monitor className="w-3.5 h-3.5 text-sky-400" />
          <span>PC화면</span>
        </button>

        <button
          onClick={logout}
          className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-red-400 active:scale-95 transition-transform"
          title="로그아웃"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
