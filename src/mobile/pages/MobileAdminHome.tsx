// src/mobile/pages/MobileAdminHome.tsx
import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Building2, Calendar, CheckCircle2, AlertCircle, ArrowRight, 
  Search, Phone, FileText, Check, Clock 
} from 'lucide-react';
import { MobileTabType } from '../MobileBottomNav';

interface MobileAdminHomeProps {
  onNavigate: (tab: MobileTabType) => void;
}

export const MobileAdminHome: React.FC<MobileAdminHomeProps> = ({ onNavigate }) => {
  const { customers, billings, sites, currentUser } = useApp();
  const [toast, setToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // 1. 오늘/이번 주 마감 도래 업체 목록 (defaultBillingDay or defaultStatementClosingDay)
  const closingDueCustomers = useMemo(() => {
    const todayDay = new Date().getDate();
    return customers.filter(c => {
      const closing = c.defaultBillingDay || c.defaultStatementClosingDay;
      if (!closing) return false;
      return Math.abs(closing - todayDay) <= 4;
    }).slice(0, 5);
  }, [customers]);

  // 2. 미수 청구서
  const unpaidBillings = useMemo(() => {
    return billings
      .filter(b => Math.max(0, (b.totalAmount || 0) - (b.paidAmount || 0)) > 0)
      .map(b => {
        const cust = customers.find(c => c.id === b.customerId);
        return {
          ...b,
          customerName: cust?.name || '거래처',
          unpaidAmount: Math.max(0, (b.totalAmount || 0) - (b.paidAmount || 0))
        };
      })
      .slice(0, 5);
  }, [billings, customers]);

  // 통장 입금 모의 확인
  const handleBankMatchConfirm = (depositName: string, amount: number) => {
    triggerToast(`[${depositName}] ₩${amount.toLocaleString()}원 입금 건이 수납 완료 매칭되었습니다.`);
  };

  return (
    <div className="flex flex-col gap-4 pb-24 p-4 font-sans text-slate-100">
      {/* 토스트 */}
      {toast && (
        <div 
          style={{
            position: 'fixed',
            top: '70px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            padding: '10px 18px',
            borderRadius: '12px',
            backgroundColor: '#065f46',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: '700',
            boxShadow: '0 10px 25px rgba(0,0,0,0.4)'
          }}
        >
          {toast}
        </div>
      )}

      {/* ── 1. 상단 관리 피드 헤더 ── */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-950/60 to-slate-950 border border-blue-500/30 rounded-3xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-sky-400 tracking-wider flex items-center gap-1.5">
            <Building2 className="w-4 h-4" />
            <span>관리부 정산 & 수납 피드</span>
          </span>
          <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
          </span>
        </div>
        <h2 className="text-xl font-black text-white leading-tight">
          {currentUser?.name || '관리담당'}님,<br />
          마감 임박 <span className="text-sky-400 font-mono">{closingDueCustomers.length}개사</span> • 미수 채권 관리
        </h2>
      </div>

      {/* ── 2. 통장 입금 1:1 즉시 수납 매칭 카드 ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>통장 입금 1:1 수납 대사</span>
          </h3>
          <span className="text-[11px] text-slate-500">대사 대기 2건</span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
            <div>
              <div className="font-bold text-white flex items-center gap-1.5">
                <span className="text-sky-400 font-mono">[신한 110]</span>
                <span>(주)삼우건설</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">입금액: ₩4,400,000원 (8월 청구분)</div>
            </div>
            <button
              type="button"
              onClick={() => handleBankMatchConfirm('(주)삼우건설', 4400000)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs active:scale-95"
            >
              매칭승인
            </button>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
            <div>
              <div className="font-bold text-white flex items-center gap-1.5">
                <span className="text-sky-400 font-mono">[국민 240]</span>
                <span>대현이엔지</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">입금액: ₩2,200,000원 (8월 청구분)</div>
            </div>
            <button
              type="button"
              onClick={() => handleBankMatchConfirm('대현이엔지', 2200000)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs active:scale-95"
            >
              매칭승인
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. 업체별 마감 도래 현황 (계약서/명세서 발송) ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-sky-400" />
            <span>마감 도래 거래처 (D-Day)</span>
          </h3>
          <span className="text-[11px] text-sky-400">발송 관제</span>
        </div>

        {closingDueCustomers.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500 bg-slate-950 rounded-xl">
            이번 주 마감 도래 거래처가 없습니다.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {closingDueCustomers.map(c => {
              const closing = c.defaultBillingDay || c.defaultStatementClosingDay || 30;
              return (
                <div key={c.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-white">{c.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      마감일: 매월 {closing}일 • 담당자: {c.repEmail || '미등록'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => triggerToast(`[${c.name}] 계약서/청구명세서 발송 큐에 등록되었습니다.`)}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white font-bold text-xs"
                  >
                    패키지발송
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 4. 미수채권 관리 피드 ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" />
            <span>미수금 회수 관리</span>
          </h3>
          <span className="text-[11px] text-slate-500">미수 건수 {unpaidBillings.length}건</span>
        </div>

        <div className="flex flex-col gap-2">
          {unpaidBillings.map(b => (
            <div key={b.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <div className="font-bold text-white">{b.customerName}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">청구월: {b.billingYm || '2026-08'}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-rose-400">₩{b.unpaidAmount.toLocaleString()}원</div>
                <div className="text-[10px] text-slate-500">미납잔액</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
