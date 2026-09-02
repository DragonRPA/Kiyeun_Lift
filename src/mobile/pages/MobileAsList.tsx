// src/mobile/pages/MobileAsList.tsx
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Search, Plus, Wrench } from 'lucide-react';

interface MobileAsListProps {
  onSelectTicket: (ticketId: string) => void;
  onOpenCreate: () => void;
}

export const MobileAsList: React.FC<MobileAsListProps> = ({
  onSelectTicket,
  onOpenCreate,
}) => {
  const { fieldAsTickets } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNRESOLVED' | 'COMPLETED'>('UNRESOLVED');

  const filteredTickets = useMemo(() => {
    return fieldAsTickets.filter((ticket) => {
      // 상태 필터
      if (statusFilter === 'UNRESOLVED') {
        if (ticket.status === 'COMPLETED' || ticket.status === 'CANCELED') return false;
      } else if (statusFilter === 'COMPLETED') {
        if (ticket.status !== 'COMPLETED') return false;
      }

      // 검색어 필터
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchAsset = (ticket.assetNo || '').toLowerCase().includes(q);
        const matchCustomer = (ticket.customerName || '').toLowerCase().includes(q);
        const matchSite = (ticket.siteName || '').toLowerCase().includes(q);
        const matchIssue = (ticket.issueDescription || '').toLowerCase().includes(q);
        const matchMechanic = (ticket.mechanicName || '').toLowerCase().includes(q);
        if (!matchAsset && !matchCustomer && !matchSite && !matchIssue && !matchMechanic) return false;
      }

      return true;
    });
  }, [fieldAsTickets, statusFilter, searchTerm]);

  return (
    <div className="flex flex-col gap-3 pb-24 p-4">
      {/* 상단 타이틀 & 등록 버튼 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-white flex items-center gap-2">
          <Wrench className="w-5 h-5 text-blue-400" />
          현장 AS 티켓 목록 ({filteredTickets.length})
        </h2>
        <button
          onClick={onOpenCreate}
          className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          신규 접수
        </button>
      </div>

      {/* 검색창 */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="장비번호, 고객사, 현장명, 고장증상 검색..."
          className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* 상태 필터 탭 */}
      <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => setStatusFilter('UNRESOLVED')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
            statusFilter === 'UNRESOLVED'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          미완료 (출동/대기)
        </button>
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
            statusFilter === 'ALL'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          전체 보기
        </button>
        <button
          onClick={() => setStatusFilter('COMPLETED')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
            statusFilter === 'COMPLETED'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          조치 완료
        </button>
      </div>

      {/* 티켓 카드 피드 (Card Dossier) */}
      <div className="flex flex-col gap-2.5">
        {filteredTickets.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm bg-slate-900/50 rounded-2xl border border-slate-800">
            해당 조건의 AS 티켓이 없습니다.
          </div>
        ) : (
          filteredTickets.map((ticket) => (
            <div
              key={ticket.id}
              onClick={() => onSelectTicket(ticket.id)}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 active:scale-98 transition-all cursor-pointer flex flex-col gap-2 shadow-sm"
            >
              {/* 상단 뱃지 행 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-black font-mono border border-blue-500/30">
                    {ticket.assetNo || '장비번호미상'}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {ticket.modelName || ''}
                  </span>
                </div>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                    ticket.status === 'COMPLETED'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : ticket.status === 'REVISIT'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : ticket.status === 'SCHEDULED'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-slate-700 text-slate-300 border-slate-600'
                  }`}
                >
                  {ticket.status === 'COMPLETED'
                    ? '조치완료'
                    : ticket.status === 'REVISIT'
                    ? '재방문'
                    : ticket.status === 'SCHEDULED'
                    ? '방문예정'
                    : '접수대기'}
                </span>
              </div>

              {/* 고객사 및 현장명 */}
              <div className="text-sm font-black text-white">
                {ticket.customerName || '고객사'} {ticket.siteName ? `· ${ticket.siteName}` : ''}
              </div>

              {/* 고장 증상 요약 */}
              <div className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <span className="text-slate-500 font-bold mr-1">고장:</span>
                {ticket.issueDescription || ticket.issueCategory || '고장 점검 요청'}
              </div>

              {/* 하단 메타 정보 */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60 font-mono">
                <span>접수: {ticket.requestDate || ''}</span>
                <span>기사: {ticket.mechanicName || '미배정'}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
