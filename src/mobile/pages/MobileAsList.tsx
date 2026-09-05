// src/mobile/pages/MobileAsList.tsx
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Search, Plus, Wrench, MapPin, User, Phone } from 'lucide-react';
import { safePhoneCall, resolveSiteDetailedAddress } from '../../utils/nativeLauncher';

interface MobileAsListProps {
  onSelectTicket: (ticketId: string) => void;
  onOpenCreate: () => void;
}

export const MobileAsList: React.FC<MobileAsListProps> = ({
  onSelectTicket,
  onOpenCreate,
}) => {
  const { fieldAsTickets, sites, customers, contracts, contractAssets } = useApp();
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
        const matchAddress = (ticket.siteAddress || '').toLowerCase().includes(q);
        const matchReporter = (ticket.reporterName || '').toLowerCase().includes(q);
        if (!matchAsset && !matchCustomer && !matchSite && !matchIssue && !matchMechanic && !matchAddress && !matchReporter) return false;
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
          placeholder="장비번호, 고객사, 현장명, 고장증상, 주소 검색..."
          className="w-full rounded-2xl py-3 pl-10 pr-4 text-sm placeholder-slate-500 focus:outline-none border"
          style={{
            backgroundColor: '#090d16',
            color: '#f8fafc',
            borderColor: '#334155',
            colorScheme: 'dark'
          }}
        />
      </div>

      {/* 상태 필터 탭 */}
      <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => setStatusFilter('UNRESOLVED')}
          className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            statusFilter === 'UNRESOLVED'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          미완료 (출동/대기)
        </button>
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            statusFilter === 'ALL'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          전체 보기
        </button>
        <button
          onClick={() => setStatusFilter('COMPLETED')}
          className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
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
          filteredTickets.map((ticket) => {
            // 도로명 상세 주소 역추적
            const resolvedAddress = resolveSiteDetailedAddress({
              siteAddress: ticket.siteAddress,
              siteId: ticket.siteId,
              siteName: ticket.siteName,
              contractId: ticket.contractId,
              assetNo: ticket.assetNo,
              assetId: ticket.assetId,
              customerName: ticket.customerName,
              locationDetail: ticket.locationDetail,
              customerSites: sites || [],
              contracts: contracts || [],
              contractAssets: contractAssets || [],
              customers: customers || [],
            });

            // 현장 담당자 및 연락처 역추적
            const matchedSite = (sites || []).find(
              (s) => s.id === ticket.siteId || (ticket.siteName && s.name === ticket.siteName)
            );
            const contactName = ticket.reporterName?.trim() || matchedSite?.contactName?.trim() || '';
            const contactPhone = ticket.reporterContact?.trim() || matchedSite?.contact?.trim() || '';

            return (
              <div
                key={ticket.id}
                onClick={() => onSelectTicket(ticket.id)}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 active:scale-98 transition-all cursor-pointer flex flex-col gap-2.5 shadow-md"
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

                {/* 📍 현장 상세 주소 */}
                <div className="flex items-start gap-1.5 text-xs text-slate-300 bg-slate-950/40 p-2 rounded-xl border border-slate-800/60">
                  <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">
                    {resolvedAddress || '현장 주소 미등록'}
                    {ticket.locationDetail ? (
                      <span className="text-amber-300 ml-1.5 font-bold">[{ticket.locationDetail}]</span>
                    ) : null}
                  </span>
                </div>

                {/* 👤 현장 담당자 정보 & 원터치 통화 */}
                <div className="flex items-center justify-between text-xs text-slate-300 bg-slate-950/40 p-2 rounded-xl border border-slate-800/60">
                  <div className="flex items-center gap-1.5 truncate">
                    <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="font-bold text-white truncate">
                      {contactName || '현장 담당자 미지정'}
                    </span>
                    {contactPhone && (
                      <span className="text-slate-400 font-mono text-[11px] truncate">
                        ({contactPhone})
                      </span>
                    )}
                  </div>
                  {contactPhone && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        safePhoneCall(contactPhone);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-black flex items-center gap-1 shrink-0 active:scale-95 transition-all shadow-sm"
                    >
                      <Phone className="w-3 h-3 text-emerald-400" />
                      <span>통화</span>
                    </button>
                  )}
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
            );
          })
        )}
      </div>
    </div>
  );
};
