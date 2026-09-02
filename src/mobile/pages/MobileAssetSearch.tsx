// src/mobile/pages/MobileAssetSearch.tsx
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Search, Layers, Box, Tag, DollarSign, CheckCircle2 } from 'lucide-react';

const HEIGHT_PRESETS = ['ALL', '19ft', '26ft', '32ft', '40ft', '46ft', '53ft'];

export const MobileAssetSearch: React.FC = () => {
  const { assets } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'RENTED'>('AVAILABLE');
  const [heightFilter, setHeightFilter] = useState('ALL');

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      // 상태 필터
      if (statusFilter === 'AVAILABLE' && asset.status !== 'AVAILABLE') return false;
      if (statusFilter === 'RENTED' && asset.status !== 'RENTED') return false;

      // 높이 필터
      if (heightFilter !== 'ALL') {
        const model = (asset.modelName || '').toLowerCase();
        if (heightFilter === '19ft' && !model.includes('19') && !model.includes('1330') && !model.includes('3215')) return false;
        if (heightFilter === '26ft' && !model.includes('26') && !model.includes('0812') && !model.includes('3219')) return false;
        if (heightFilter === '32ft' && !model.includes('32') && !model.includes('1012')) return false;
        if (heightFilter === '40ft' && !model.includes('40') && !model.includes('1212')) return false;
        if (heightFilter === '46ft' && !model.includes('46') && !model.includes('1412')) return false;
        if (heightFilter === '53ft' && !model.includes('53') && !model.includes('1612')) return false;
      }

      // 검색어 필터
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchNo = (asset.assetNo || '').toLowerCase().includes(q);
        const matchModel = (asset.modelName || '').toLowerCase().includes(q);
        const matchVendor = (asset.vendorAssetNo || '').toLowerCase().includes(q);
        if (!matchNo && !matchModel && !matchVendor) return false;
      }

      return true;
    });
  }, [assets, statusFilter, heightFilter, searchTerm]);

  return (
    <div className="flex flex-col gap-3 pb-24 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-white flex items-center gap-2">
          <Search className="w-5 h-5 text-sky-400" />
          가용 렌탈 자산 실시간 조회
        </h2>
        <span className="text-xs font-mono text-slate-400 font-bold">
          {filteredAssets.length}대 가용
        </span>
      </div>

      {/* 검색창 */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="장비번호, 모델명, 원사번호 검색..."
          className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* 상태 필터 */}
      <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => setStatusFilter('AVAILABLE')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
            statusFilter === 'AVAILABLE'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          임대 가능 (주기장)
        </button>
        <button
          onClick={() => setStatusFilter('RENTED')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
            statusFilter === 'RENTED'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          대여중 (현장가동)
        </button>
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
            statusFilter === 'ALL'
              ? 'bg-slate-700 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          전체 보기
        </button>
      </div>

      {/* 높이 규격 프리셋 뱃지 */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
        {HEIGHT_PRESETS.map((ht) => (
          <button
            key={ht}
            type="button"
            onClick={() => setHeightFilter(ht)}
            className={`flex-shrink-0 text-xs font-bold py-1 px-3 rounded-xl border transition-all ${
              heightFilter === ht
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            {ht}
          </button>
        ))}
      </div>

      {/* 자산 목록 카드 */}
      <div className="flex flex-col gap-2.5">
        {filteredAssets.slice(0, 50).map((asset) => (
          <div
            key={asset.id}
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-2 shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-black font-mono border border-blue-500/30">
                  {asset.assetNo}
                </span>
                <span className="text-sm font-bold text-white">
                  {asset.modelName}
                </span>
              </div>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                  asset.status === 'AVAILABLE'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                }`}
              >
                {asset.status === 'AVAILABLE' ? '임대가능' : '대여중'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
              <div>소유: <strong className="text-slate-200">{asset.ownerType === 'RENTED' ? '타사임차' : '자사자산'}</strong></div>
              <div>제조: <strong className="text-slate-200">{asset.manufacturer || '-'}</strong></div>
              <div>월단가: <strong className="text-emerald-400">₩{(asset.monthlyRentFee || 0).toLocaleString()}</strong></div>
              <div>일단가: <strong className="text-sky-400">₩{(asset.dailyRentFee || 0).toLocaleString()}</strong></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
