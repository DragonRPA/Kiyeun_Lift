// src/mobile/pages/MobileHome.tsx
import React from 'react';
import { useApp } from '../../context/AppContext';
import { Wrench, Truck, CheckSquare, Search, PhoneCall, Plus, ArrowRight, AlertTriangle, ShieldCheck, Clock } from 'lucide-react';
import { MobileTabType } from '../MobileBottomNav';

interface MobileHomeProps {
  onNavigate: (tab: MobileTabType) => void;
  onOpenAsDetail: (ticketId: string) => void;
  onOpenCreateAs: () => void;
}

export const MobileHome: React.FC<MobileHomeProps> = ({
  onNavigate,
  onOpenAsDetail,
  onOpenCreateAs,
}) => {
  const { fieldAsTickets, deliveries, outboundInspections, currentUser, assets } = useApp();
  const availableAssetCount = assets.filter(a => a.status === 'AVAILABLE').length;

  // 당일 미처리 AS 티켓
  const pendingAsTickets = fieldAsTickets.filter(
    (t) => t.status === 'REQUESTED' || t.status === 'SCHEDULED' || t.status === 'REVISIT' || t.status === 'IN_PROGRESS'
  );

  // 대기 배차
  const pendingDeliveries = deliveries.filter(
    (d) => d.status === 'PENDING' || d.status === 'REQUESTED' || d.status === 'DISPATCHED'
  );

  // 출고 검수 대기
  const pendingInspections = outboundInspections.filter((ins) => ins.status === 'PENDING');

  return (
    <div className="flex flex-col gap-4 pb-20 p-4">
      {/* 긴급 상단 액션 카드 */}
      <div className="bg-gradient-to-br from-blue-900/60 to-slate-900 border border-blue-500/30 rounded-3xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-blue-400 tracking-wider">TODAY TASK FEED</span>
          <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
          </span>
        </div>
        <h2 className="text-xl font-black text-white leading-tight mb-2">
          {currentUser?.name || '현장 담당자'}님,<br />
          오늘 처리할 당면 과제 <span className="text-blue-400 font-black">{pendingAsTickets.length + pendingDeliveries.length + pendingInspections.length}건</span>
        </h2>
        <div className="grid grid-cols-3 gap-2 mt-4">
          <button
            onClick={() => onNavigate('as')}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-800/80 border border-slate-700 active:scale-95 transition-transform"
          >
            <Wrench className="w-5 h-5 text-amber-400 mb-1" />
            <span className="text-[11px] text-slate-400">현장AS</span>
            <span className="text-base font-black text-white">{pendingAsTickets.length}건</span>
          </button>
          <button
            onClick={() => onNavigate('dispatch')}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-800/80 border border-slate-700 active:scale-95 transition-transform"
          >
            <Truck className="w-5 h-5 text-blue-400 mb-1" />
            <span className="text-[11px] text-slate-400">운송배차</span>
            <span className="text-base font-black text-white">{pendingDeliveries.length}건</span>
          </button>
          <button
            onClick={() => onNavigate('inspection')}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-800/80 border border-slate-700 active:scale-95 transition-transform"
          >
            <CheckSquare className="w-5 h-5 text-emerald-400 mb-1" />
            <span className="text-[11px] text-slate-400">출고검수</span>
            <span className="text-base font-black text-white">{pendingInspections.length}건</span>
          </button>
        </div>
      </div>

      {/* 가용 재고 현황 퀵 카드 */}
      <div 
        onClick={() => onNavigate('assets')}
        className="cursor-pointer bg-gradient-to-r from-emerald-950/60 via-slate-900 to-sky-950/60 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between shadow-lg active:scale-98 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
            <Search className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-white">가용 재고 현황</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              규격별 출고 가능 자산 <strong className="text-emerald-400 font-bold">{availableAssetCount}대</strong>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-xl border border-emerald-500/20">
          <span>조회</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* 1-Click 긴급 AS 등록 버튼 */}
      <button
        onClick={onOpenCreateAs}
        className="w-full py-4 px-5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-base flex items-center justify-between shadow-xl shadow-blue-600/30 active:scale-98 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Plus className="w-6 h-6 stroke-[3]" />
          </div>
          <span>현장 AS 신규 접수하기</span>
        </div>
        <ArrowRight className="w-5 h-5" />
      </button>

      {/* 긴급 출동 대상 AS 목록 (최대 3건) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            당면 AS 출동 과제
          </h3>
          <button
            onClick={() => onNavigate('as')}
            className="text-xs text-blue-400 font-semibold"
          >
            전체보기 ➔
          </button>
        </div>

        {pendingAsTickets.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-500 text-sm">
            처리할 대기 AS 건이 없습니다.
          </div>
        ) : (
          pendingAsTickets.slice(0, 3).map((ticket) => (
            <div
              key={ticket.id}
              onClick={() => onOpenAsDetail(ticket.id)}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 active:scale-98 transition-all cursor-pointer flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-black font-mono border border-blue-500/30">
                    {ticket.assetNo || '장비번호미상'}
                  </span>
                  <span className="text-xs text-slate-400">{ticket.modelName || ''}</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  {ticket.status === 'SCHEDULED' ? '방문예정' : ticket.status === 'REVISIT' ? '재방문' : '접수'}
                </span>
              </div>
              <div className="text-sm font-bold text-white line-clamp-1">
                {ticket.siteName ? `[${ticket.siteName}] ` : ''}{ticket.customerName || '고객사'}
              </div>
              <div className="text-xs text-slate-400 line-clamp-1">
                증상: {ticket.issueDescription || ticket.issueCategory || '고장 점검 요청'}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 가용 장비 빠른 조회 배너 */}
      <div
        onClick={() => onNavigate('assets')}
        className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between active:scale-98 transition-all cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">가용 자산 조회</div>
            <div className="text-xs text-slate-400">규격별 출고 가능 자산 목록</div>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-slate-500" />
      </div>
    </div>
  );
};
