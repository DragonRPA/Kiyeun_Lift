// src/mobile/pages/MobileDispatchList.tsx
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { db, Delivery } from '../../services/db';
import { Truck, Phone, CheckCircle2 } from 'lucide-react';

export const MobileDispatchList: React.FC = () => {
  const { deliveries, refreshAllData, showErrorModal } = useApp();
  const [filter, setFilter] = useState<'PENDING' | 'DISPATCHED' | 'DELIVERED'>('DISPATCHED');

  const filteredDeliveries = deliveries.filter((d) => {
    if (filter === 'PENDING') return d.status === 'PENDING' || d.status === 'REQUESTED';
    if (filter === 'DISPATCHED') return d.status === 'DISPATCHED';
    if (filter === 'DELIVERED') return d.status === 'DELIVERED' || d.status === 'COMPLETED';
    return true;
  });

  const handleUpdateStatus = async (deliveryId: string, nextStatus: any) => {
    try {
      db.updateRow<Delivery>('deliveries', deliveryId, {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });
      await db.awaitPendingWrites();
      refreshAllData();
      alert('배차 상태가 업데이트되었습니다.');
    } catch (err: any) {
      showErrorModal('상태 업데이트 실패: ' + (err.message || ''));
    }
  };

  return (
    <div className="flex flex-col gap-3 pb-24 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-white flex items-center gap-2">
          <Truck className="w-5 h-5 text-blue-400" />
          배차 운송 지시 ({filteredDeliveries.length})
        </h2>
      </div>

      {/* 상태 필터 */}
      <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => setFilter('DISPATCHED')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
            filter === 'DISPATCHED'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          운송중 (진행)
        </button>
        <button
          onClick={() => setFilter('PENDING')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
            filter === 'PENDING'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          배차 대기
        </button>
        <button
          onClick={() => setFilter('DELIVERED')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
            filter === 'DELIVERED'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          운송 완료
        </button>
      </div>

      {/* 배차 목록 피드 */}
      <div className="flex flex-col gap-3">
        {filteredDeliveries.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm bg-slate-900/50 rounded-2xl border border-slate-800">
            해당 상태의 배차 건이 없습니다.
          </div>
        ) : (
          filteredDeliveries.map((delivery) => (
            <div
              key={delivery.id}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-black border border-blue-500/30">
                  {delivery.type === 'EXCHANGE' ? '교환 EXCHANGE' : delivery.dispatchCategory || delivery.type}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {delivery.loadingDate || delivery.requestDate}
                </span>
              </div>

              {/* 상하차지 경로 */}
              <div className="flex flex-col gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-md bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center font-bold">
                    상
                  </span>
                  <div className="text-xs text-slate-300">
                    <div className="font-bold text-white">
                      {delivery.pickupVendorName || delivery.originAddress || '본사 주기장'}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center font-bold">
                    하
                  </span>
                  <div className="text-xs text-slate-300">
                    <div className="font-bold text-white">
                      {delivery.destinationAddress || '고객사 현장'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 기사/차량 정보 */}
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  기사: <strong className="text-white">{delivery.driverName || '미지정'}</strong> ({delivery.vehicleNo || '차량번호미상'})
                </span>
                {delivery.driverContact && (
                  <a
                    href={`tel:${delivery.driverContact}`}
                    className="flex items-center gap-1 text-emerald-400 font-bold bg-emerald-950/40 py-1 px-2.5 rounded-lg border border-emerald-900/50"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    통화
                  </a>
                )}
              </div>

              {/* 상태 조작 버튼 */}
              {delivery.status === 'DISPATCHED' && (
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(delivery.id, 'DELIVERED')}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-98 transition-transform shadow-md"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  하차 완료 1-Click 보고
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
