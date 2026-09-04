// src/mobile/pages/MobileMyContracts.tsx
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Building2, MapPin, Phone, Calendar, Clock, Layers, 
  Search, ChevronRight, AlertCircle, Wrench 
} from 'lucide-react';

interface MobileMyContractsProps {
  onOpenCreateAsForAsset?: (assetNo: string, siteId: string) => void;
}

export const MobileMyContracts: React.FC<MobileMyContractsProps> = ({ onOpenCreateAsForAsset }) => {
  const { contracts, contractAssets, customers, sites, assets, currentUser } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ACTIVE' | 'ALL'>('ACTIVE');

  // 오늘 날짜
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // 계약 리스트 정제
  const myContractList = useMemo(() => {
    // 1. 활성 계약 필터링
    return contracts
      .filter(c => {
        if (filterStatus === 'ACTIVE' && c.status !== 'ACTIVE' && c.status !== 'EXTENDED') {
          return false;
        }
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const cust = customers.find(cu => cu.id === c.customerId);
          const site = sites.find(s => s.id === c.siteId);
          const custName = (cust?.name || '').toLowerCase();
          const siteName = (site?.name || '').toLowerCase();
          const contractNo = (c.contractNo || '').toLowerCase();
          return custName.includes(q) || siteName.includes(q) || contractNo.includes(q);
        }
        return true;
      })
      .map(c => {
        const cust = customers.find(cu => cu.id === c.customerId);
        const site = sites.find(s => s.id === c.siteId);
        // 계약에 매핑된 자산들
        const myCas = contractAssets.filter(ca => ca.contractId === c.id);
        const assignedAssets = myCas.map(ca => {
          const ast = assets.find(a => a.id === ca.assetId);
          return {
            caId: ca.id,
            assetNo: ast?.assetNo || ca.expectedModel || '미지정',
            modelName: ast?.modelName || ca.expectedModel || '-',
            status: ast?.status || 'ASSIGNED'
          };
        });

        // 만료 D-Day 계산
        let dDayText = '';
        let isUrgent = false;
        if (c.endDate) {
          const diffDays = Math.ceil((new Date(c.endDate).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays < 0) {
            dDayText = `만료도과 (${Math.abs(diffDays)}일)`;
            isUrgent = true;
          } else if (diffDays <= 3) {
            dDayText = `만료임박 (D-${diffDays})`;
            isUrgent = true;
          } else {
            dDayText = `D-${diffDays}`;
          }
        }

        return {
          ...c,
          customerName: cust?.name || '거래처',
          siteName: site?.name || '현장',
          siteAddress: site?.address || '',
          siteContact: site?.contactName || '',
          sitePhone: site?.contact || '',
          assignedAssets,
          dDayText,
          isUrgent
        };
      });
  }, [contracts, contractAssets, customers, sites, assets, filterStatus, searchTerm, todayStr]);

  return (
    <div className="flex flex-col gap-3.5 pb-24 p-4 font-sans text-slate-100">
      {/* 헤더 */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-400" />
            <span>내 계약 & 투입 현장</span>
          </h2>
          <div className="text-[11px] text-slate-400 mt-0.5">
            가동 중 계약 {myContractList.length}건
          </div>
        </div>

        {/* 상태 필터 토글 */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setFilterStatus('ACTIVE')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
              filterStatus === 'ACTIVE'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400'
            }`}
          >
            가동중
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('ALL')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
              filterStatus === 'ALL'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400'
            }`}
          >
            전체
          </button>
        </div>
      </div>

      {/* 검색창 */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="거래처명, 현장명, 계약번호 검색..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500"
        />
      </div>

      {/* 계약 목록 */}
      <div className="flex flex-col gap-3">
        {myContractList.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800">
            조회된 계약 내역이 없습니다.
          </div>
        ) : (
          myContractList.map(c => (
            <div 
              key={c.id} 
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-lg"
            >
              {/* 상단: 고객사 & 현장명 & D-Day */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-bold text-blue-400">{c.customerName}</div>
                  <h3 className="text-sm font-black text-white mt-0.5">{c.siteName}</h3>
                  {c.siteAddress && (
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      <span>{c.siteAddress}</span>
                    </div>
                  )}
                </div>

                {c.dDayText && (
                  <span className={`px-2 py-0.5 rounded-lg text-[10.5px] font-black border ${
                    c.isUrgent
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                  }`}>
                    {c.dDayText}
                  </span>
                )}
              </div>

              {/* 투입 장비 목록 */}
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 flex flex-col gap-1.5">
                <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
                  <span>투입 장비 ({c.assignedAssets.length}대)</span>
                  <span>{c.startDate} ~ {c.endDate || '미정'}</span>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-1">
                  {c.assignedAssets.length === 0 ? (
                    <span className="text-[11px] text-slate-500">배정 진행 중...</span>
                  ) : (
                    c.assignedAssets.map((ast, i) => (
                      <span 
                        key={i}
                        className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-slate-200 flex items-center gap-1"
                      >
                        <span className="text-sky-400">{ast.assetNo}</span>
                        <span className="text-[10px] text-slate-400 font-sans font-normal">({ast.modelName})</span>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* 현장 담당자 및 원터치 전화걸기 */}
              {c.sitePhone && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs">
                  <span className="text-slate-400">
                    현장소장: <strong className="text-slate-200">{c.siteContact || '담당자'}</strong>
                  </span>
                  <a
                    href={`tel:${c.sitePhone}`}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 active:scale-95 transition-all"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>통화하기</span>
                  </a>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
