// src/mobile/pages/MobileInspectionList.tsx
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CameraUploader } from '../components/CameraUploader';
import { db, OutboundInspection, Asset } from '../../services/db';
import { CheckSquare, Check, ShieldCheck } from 'lucide-react';

const INSPECTION_ITEMS = [
  '상하강/주행 리미트 정상',
  '과상승/협착 방지봉 센서 정상',
  '조작부 비상정지 스위치 작동',
  '유압 라인 누유 및 피팅 체결',
  '타이어 마모 및 휠 볼트 결속',
  '배터리 전압 및 증류수 레벨',
  '안전 난간 및 확장 데크 락',
  '충전선 및 220V 플러그 상태',
  '외관 도색 및 안전 경고 스티커',
  '하부 컨트롤러 수동 하강 정상',
];

export const MobileInspectionList: React.FC = () => {
  const { outboundInspections, currentUser, refreshAllData, showErrorModal } = useApp();
  const [selectedInspectionId, setSelectedInspectionId] = useState<string>('');
  const [checkedList, setCheckedList] = useState<Record<string, boolean>>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pendingInspections = outboundInspections.filter((ins) => ins.status === 'PENDING');
  const activeInspection = outboundInspections.find((ins) => ins.id === selectedInspectionId);

  // 전체 정상 체크
  const handleCheckAll = () => {
    const allChecked: Record<string, boolean> = {};
    INSPECTION_ITEMS.forEach((item) => {
      allChecked[item] = true;
    });
    setCheckedList(allChecked);
  };

  const handleToggleCheck = (item: string) => {
    setCheckedList((prev) => ({ ...prev, [item]: !prev[item] }));
  };

  // 출고 검수 승인 마감 (카테고리 1.3 출고 검수 승인 시 RENTED 전환)
  const handleApprove = async () => {
    if (!activeInspection) return;

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const inspectorName = currentUser?.name || '담당기사';

      db.updateRow<OutboundInspection>('outboundInspections', activeInspection.id, {
        status: 'COMPLETED',
        inspectorId: inspectorName,
        inspectedAt: nowIso,
        note: `[모바일 검수 승인 완료]`,
        updatedAt: nowIso,
      });

      // 🟢 출고 승인 마감 시 자산 status ➔ 'RENTED' 자동 전환
      if (activeInspection.assetId) {
        db.updateRow<Asset>('assets', activeInspection.assetId, {
          status: 'RENTED',
          updatedAt: nowIso,
        });
      }

      await db.awaitPendingWrites();
      refreshAllData();
      alert('출고 검수가 최종 승인 마감되었습니다. 자산 상태가 대여중(RENTED)으로 전환되었습니다.');
      setSelectedInspectionId('');
      setCheckedList({});
      setPhotos([]);
    } catch (err: any) {
      showErrorModal('검수 승인 실패: ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 pb-24 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-white flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-emerald-400" />
          출고 전 기능 검수 ({pendingInspections.length})
        </h2>
      </div>

      {!activeInspection ? (
        <div className="flex flex-col gap-2.5">
          {pendingInspections.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm bg-slate-900/50 rounded-2xl border border-slate-800">
              대기 중인 출고 검수 의뢰가 없습니다.
            </div>
          ) : (
            pendingInspections.map((ins) => (
              <div
                key={ins.id}
                onClick={() => {
                  setSelectedInspectionId(ins.id);
                  handleCheckAll();
                }}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 active:scale-98 transition-all cursor-pointer flex flex-col gap-2 shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-black font-mono border border-emerald-500/30">
                    자산 #{ins.assetId || '미지정'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                    검수 대기
                  </span>
                </div>
                <div className="text-sm font-bold text-white">
                  계약 ID: {ins.contractId || '직출고'}
                </div>
                <div className="text-xs text-slate-400">
                  의뢰일: {ins.createdAt ? new Date(ins.createdAt).toLocaleDateString() : ''}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* 검수 체크리스트 & 사진 촬영 폼 */
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-white">10대 법정/기능 점검</span>
              <button
                type="button"
                onClick={handleCheckAll}
                className="text-xs font-bold text-emerald-400 py-1 px-2.5 rounded-lg bg-emerald-950/40 border border-emerald-900/50 active:scale-95"
              >
                ✓ 전체 정상 선택
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              {INSPECTION_ITEMS.map((item, idx) => {
                const isChecked = !!checkedList[item];
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleToggleCheck(item)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all ${
                      isChecked
                        ? 'bg-emerald-950/40 border-emerald-700 text-emerald-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span>{idx + 1}. {item}</span>
                    <div
                      className={`w-5 h-5 rounded-lg flex items-center justify-center border ${
                        isChecked
                          ? 'bg-emerald-500 border-emerald-400 text-white'
                          : 'border-slate-700'
                      }`}
                    >
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <CameraUploader
              label="출고 장비 외관 4방향 사진"
              images={photos}
              onChange={setPhotos}
              maxImages={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSelectedInspectionId('')}
              className="py-3.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
            >
              취소
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleApprove}
              className="py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              {isSubmitting ? '승인 중...' : '검수 완료 승인 (RENTED)'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
