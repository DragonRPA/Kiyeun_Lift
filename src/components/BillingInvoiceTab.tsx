// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Plus, RefreshCw, ChevronDown, ChevronRight,
  CheckCircle, AlertCircle, Clock, XCircle, Download,
  Layers, CreditCard, RotateCcw
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  generateInvoices,
  consolidateExistingBillings,
  applyPaymentToInvoice,
  cancelInvoice,
  fetchInvoices,
  fetchInvoiceDetail,
  type InvoiceGroupBy
} from '../services/invoiceEngine';
import type { BillingInvoice } from '../services/db';

// ── 상태 배지 ──
function StatusBadge({ status }: { status: string }) {
  const badgeClass = status === 'PAID' ? 'badge-success'
    : status === 'PARTIAL' ? 'badge-warning'
    : status === 'ISSUED' ? 'badge-primary'
    : status === 'CANCELLED' ? 'badge-danger'
    : 'badge-secondary';
  const label = status === 'PAID' ? '수납완료'
    : status === 'PARTIAL' ? '부분수납'
    : status === 'ISSUED' ? '발행'
    : status === 'CANCELLED' ? '취소'
    : '초안';
  return (
    <span className={`badge ${badgeClass}`}>{label}</span>
  );
}

// ── 금액 포맷 ──
const fmtAmt = (n: number) => n == null ? '-' : `₩${n.toLocaleString()}`;

export const BillingInvoiceTab: React.FC = () => {
  const { showSuccessToast, showErrorModal, customers } = useApp();

  const [invoices, setInvoices]         = useState<BillingInvoice[]>([]);
  const [isLoading, setIsLoading]       = useState(false);
  const [selectedYm, setSelectedYm]     = useState('');
  const [groupBy, setGroupBy]           = useState<InvoiceGroupBy>('CUSTOMER');
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [detail, setDetail]             = useState<BillingInvoice | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConsolidating, setIsConsolidating] = useState(false);

  // 청구서통합 목록 로드
  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchInvoices(selectedYm || undefined);
      setInvoices(data);
    } catch (e: any) {
      showErrorModal?.(`청구서통합 조회 실패: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYm]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  // 월별 청구서통합 생성
  const handleGenerate = async () => {
    if (!selectedYm) { showErrorModal?.('청구 귀속월(YYYY-MM)을 선택하세요.'); return; }
    setIsGenerating(true);
    try {
      const r = await generateInvoices({ billingYm: selectedYm, groupBy });
      showSuccessToast?.(`청구서통합 ${r.created}건 생성 완료 (건너뜀 ${r.skipped}건)`);
      await loadInvoices();
    } catch (e: any) {
      showErrorModal?.(`생성 실패: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // 기존 데이터 소급 묶기
  const handleConsolidate = async () => {
    if (!window.confirm('기존 청구를 청구서통합으로 일괄 묶습니다. 계속하시겠습니까?')) return;
    setIsConsolidating(true);
    try {
      const r = await consolidateExistingBillings(groupBy);
      showSuccessToast?.(`소급 완료: 총 ${r.totalCreated}건 청구서통합 생성`);
      await loadInvoices();
    } catch (e: any) {
      showErrorModal?.(`소급 실패: ${e.message}`);
    } finally {
      setIsConsolidating(false);
    }
  };

  // 상세 펼치기
  const handleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); setDetail(null); return; }
    setExpandedId(id);
    const d = await fetchInvoiceDetail(id);
    setDetail(d);
  };

  // 청구서통합 취소
  const handleCancel = async (id: string) => {
    if (!window.confirm(`청구서통합 ${id}를 취소하면 포함된 청구의 통합 연결이 해제됩니다. 계속하시겠습니까?`)) return;
    const r = await cancelInvoice(id);
    if (r.success) { showSuccessToast?.(r.message); await loadInvoices(); }
    else showErrorModal?.(r.message);
  };

  const customerName = (id: string) => customers?.find(c => c.id === id)?.name ?? id;

  // ── 월 선택 옵션 ──
  const ymSet = new Set<string>();
  invoices.forEach(inv => ymSet.add(inv.billingYm));
  const ymOptions = [...ymSet].sort().reverse();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── 툴바 ── */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>

        {/* 귀속월 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>귀속월</span>
          <input
            type="month"
            value={selectedYm}
            onChange={e => setSelectedYm(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
          />
        </div>

        {/* 통합 단위 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>통합 단위</span>
          <select
            value={groupBy}
            onChange={e => setGroupBy(e.target.value as InvoiceGroupBy)}
            style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
          >
            <option value="CUSTOMER">고객 단위</option>
            <option value="SITE">현장 단위</option>
          </select>
        </div>

        {/* 액션 버튼 */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !selectedYm}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '6px', border: 'none',
            background: isGenerating ? 'var(--text-muted)' : 'var(--primary)', color: 'var(--text-on-primary)',
            fontWeight: 600, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap'
          }}
        >
          <Plus size={14} />
          {isGenerating ? '생성 중...' : '청구서통합 생성'}
        </button>

        <button
          onClick={handleConsolidate}
          disabled={isConsolidating}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-color)',
            background: 'var(--bg-card)', color: 'var(--text-main)',
            fontWeight: 600, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap'
          }}
        >
          <Layers size={14} />
          {isConsolidating ? '처리 중...' : '기존 청구 소급 묶기'}
        </button>

        <button
          onClick={loadInvoices}
          disabled={isLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--border-color)',
            background: 'var(--bg-app)', color: 'var(--text-muted)', cursor: 'pointer'
          }}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* ── 청구서통합 목록 테이블 ── */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-card)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)' }}>
              {['', '통합청구번호', '고객사', '귀속월', '상태', '합계금액', '납기일', '액션'].map(h => (
                <th key={h} style={{
                  padding: '10px 12px', textAlign: 'left', fontWeight: 600,
                  color: 'var(--text-secondary)', whiteSpace: 'nowrap'
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>로딩 중...</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>청구서통합 내역 없음</td></tr>
            ) : invoices.map(inv => (
              <React.Fragment key={inv.id}>
                {/* 청구서통합 행 */}
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <button
                      onClick={() => handleExpand(inv.id)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      {expandedId === inv.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  </td>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                    {inv.id}
                  </td>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>
                    {customerName(inv.customerId)}
                  </td>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>{inv.billingYm}</td>
                  <td style={{ padding: '8px 12px' }}><StatusBadge status={inv.status} /></td>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 600, color: 'var(--text-main)' }}>
                    {fmtAmt(inv.totalAmount)}
                  </td>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                    {inv.dueDate ?? '-'}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {inv.status !== 'CANCELLED' && (
                        <button
                          onClick={() => handleCancel(inv.id)}
                          title="청구서통합 취소"
                          style={{
                            padding: '4px 8px', borderRadius: '4px', border: '1px solid #fca5a5',
                            background: 'var(--bg-card)', color: '#dc2626', cursor: 'pointer', fontSize: '12px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          취소
                        </button>
                      )}
                    </div>
                  </td>
                </tr>

                {/* 확장 상세 행 */}
                {expandedId === inv.id && (
                  <tr style={{ background: 'var(--bg-app)' }}>
                    <td colSpan={8} style={{ padding: '0 12px 12px 32px' }}>
                      {!detail ? (
                        <div style={{ padding: '16px', color: 'var(--text-muted)' }}>로딩 중...</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', padding: '8px 0 4px' }}>
                            포함 청구 {detail.billings?.length ?? 0}건
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ background: 'var(--bg-secondary)' }}>
                                {['청구ID', '계약ID', '청구일', '청구액', '수납액', '상태'].map(h => (
                                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(detail.billings || []).map(b => (
                                <tr key={b.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                  <td style={{ padding: '5px 10px', whiteSpace: 'nowrap', color: 'var(--primary)' }}>{b.id}</td>
                                  <td style={{ padding: '5px 10px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{b.contractId ?? '-'}</td>
                                  <td style={{ padding: '5px 10px', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>{b.billingDate}</td>
                                  <td style={{ padding: '5px 10px', whiteSpace: 'nowrap', textAlign: 'right', color: 'var(--text-main)' }}>{fmtAmt(b.totalAmount)}</td>
                                  <td style={{ padding: '5px 10px', whiteSpace: 'nowrap', textAlign: 'right', color: 'var(--text-main)' }}>{fmtAmt(b.paidAmount)}</td>
                                  <td style={{ padding: '5px 10px' }}><StatusBadge status={b.status} /></td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr style={{ background: 'var(--bg-secondary)', fontWeight: 700 }}>
                                <td colSpan={3} style={{ padding: '6px 10px', color: 'var(--text-main)' }}>합계</td>
                                <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-main)' }}>{fmtAmt(inv.totalAmount)}</td>
                                <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-main)' }}>
                                  {fmtAmt((detail.billings || []).reduce((s, b) => s + (b.paidAmount || 0), 0))}
                                </td>
                                <td />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── 합계 요약 ── */}
      {invoices.length > 0 && (
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {(['DRAFT','ISSUED','PARTIAL','PAID','CANCELLED'] as const).map(s => {
            const cnt = invoices.filter(i => i.status === s).length;
            const amt = invoices.filter(i => i.status === s).reduce((a, i) => a + i.totalAmount, 0);
            if (cnt === 0) return null;
            const m = STATUS_META[s];
            return (
              <div key={s} style={{
                display: 'flex', gap: '8px', alignItems: 'center',
                padding: '8px 14px', borderRadius: '8px', background: m.bg,
                border: `1px solid ${m.color}22`
              }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: m.color }}>{m.label}</span>
                <span style={{ fontSize: '13px', color: '#374151' }}>{cnt}건</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: m.color }}>{fmtAmt(amt)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
