// src/pages/PurchaseSettlementPage.tsx
// 월말 매입 정산 (운송료 / 소모품 매입 / 임차료) 통합 관리 페이지

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { PurchaseSettlement, PurchaseSettlementItem, PurchaseSettlementType } from '../services/db';
import {
  Truck, ShoppingBag, Building2, Plus, CheckCircle2, CreditCard,
  ChevronDown, ChevronUp, FileText, AlertCircle, RefreshCw, X, Download, ExternalLink, Eye
} from 'lucide-react';

// 정산 유형 탭 정의
const SETTLEMENT_TYPES: { id: PurchaseSettlementType | 'ALL'; label: string; icon: React.ReactNode }[] = [
  { id: 'ALL',              label: '전체',            icon: <FileText size={15} /> },
  { id: 'TRANSPORT',        label: '운송료',           icon: <Truck size={15} /> },
  { id: 'CONSUMABLE',       label: '소모품 매입',       icon: <ShoppingBag size={15} /> },
  { id: 'EQUIPMENT_LEASE',  label: '임차료 (전대장비)', icon: <Building2 size={15} /> },
];

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING:   { label: '집계중',  color: '#F59E0B' },
  CONFIRMED: { label: '정산확정', color: '#3B82F6' },
  PAID:      { label: '지급완료', color: '#10B981' },
};

const TYPE_LABEL: Record<string, string> = {
  TRANSPORT:       '운송료',
  CONSUMABLE:      '소모품 매입',
  EQUIPMENT_LEASE: '임차료',
};

export const PurchaseSettlementPage: React.FC = () => {
  const {
    purchaseSettlements,
    purchaseSettlementItems,
    consumablePurchases,
    deliveries,
    generateMonthlyPurchaseSettlements,
    confirmPurchaseSettlement,
    recordPurchaseSettlementPayment,
    savePurchaseSettlement,
  } = useApp();

  // 현재 연월 기본 선택
  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [selectedYm, setSelectedYm]               = useState(currentYm);
  const [typeFilter, setTypeFilter]                = useState<PurchaseSettlementType | 'ALL'>('ALL');
  const [expandedId, setExpandedId]                = useState<string | null>(null);
  const [isGenerating, setIsGenerating]            = useState(false);
  const [generateResult, setGenerateResult]        = useState<string | null>(null);
  const [paymentModal, setPaymentModal]            = useState<{ id: string; totalAmount: number; paidAmount: number } | null>(null);
  const [paymentForm, setPaymentForm]              = useState({ paidAmount: '', paymentDate: currentYm.slice(0,7) + '-' + String(now.getDate()).padStart(2,'0'), paymentMethod: '계좌이체', bankAccount: '', memo: '' });
  const [memoEditId, setMemoEditId]                = useState<string | null>(null);
  const [memoText, setMemoText]                    = useState('');

  // 증빙 파일 미리보기 모달 상태
  const [previewEvidence, setPreviewEvidence]      = useState<{ url: string; title: string } | null>(null);


  // 동적 원천 레코드 증빙 조회 (정산 항목에 없다면 원천 레코드에서 파악)
  const getItemEvidenceUrl = (item: PurchaseSettlementItem): string | undefined => {
    if (item.evidenceFileUrl && item.evidenceFileUrl !== '-' && item.evidenceFileUrl.trim() !== '') {
      return item.evidenceFileUrl;
    }
    if (item.sourceType === 'CONSUMABLE_PURCHASE') {
      const cp = consumablePurchases.find(p => p.id === item.sourceId);
      if (cp?.statementFileUrl && cp.statementFileUrl !== '-' && cp.statementFileUrl.trim() !== '') {
        return cp.statementFileUrl;
      }
    } else if (item.sourceType === 'DELIVERY') {
      const d = deliveries.find(d => d.id === item.sourceId);
      if (d?.statementFileUrl && d.statementFileUrl !== '-' && d.statementFileUrl.trim() !== '') {
        return d.statementFileUrl;
      }
    }
    return undefined;
  };

  // 증빙 열람 / 미리보기 핸들러
  const handleOpenEvidence = (url?: string, title?: string) => {
    if (!url || url === '-' || url.trim() === '') {
      alert('첨부된 증빙 파일이 없습니다.');
      return;
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    if (url.startsWith('data:')) {
      setPreviewEvidence({ url, title: title || '거래명세서 증빙' });
      return;
    }

    alert(`증빙 정보: ${url}`);
  };

  // 필터링된 정산 목록
  const filtered = useMemo(() => {
    return purchaseSettlements
      .filter(p => p.settlementYm === selectedYm && (typeFilter === 'ALL' || p.settlementType === typeFilter))
      .sort((a, b) => a.settlementType.localeCompare(b.settlementType) || a.vendorName.localeCompare(b.vendorName));
  }, [purchaseSettlements, selectedYm, typeFilter]);

  // 연월 선택지 (최근 12개월)
  const ymOptions = useMemo(() => {
    const opts = [];
    const d = new Date();
    for (let i = 0; i < 12; i++) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      opts.push(`${y}-${m}`);
      d.setMonth(d.getMonth() - 1);
    }
    return opts;
  }, []);

  // 요약 집계
  const summary = useMemo(() => {
    const total = filtered.reduce((s, p) => s + p.totalAmount, 0);
    const paid  = filtered.reduce((s, p) => s + p.paidAmount, 0);
    return { total, paid, remaining: total - paid, count: filtered.length };
  }, [filtered]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerateResult(null);
    try {
      const result = await generateMonthlyPurchaseSettlements(selectedYm);
      if (result.transport + result.consumable === 0) {
        setGenerateResult('ℹ️ 집계할 신규 정산 건이 없습니다. (이미 집계되었거나 해당 월 데이터 없음)');
      } else {
        setGenerateResult(`✅ 자동 집계 완료 — 운송료 ${result.transport}건 / 소모품 매입 ${result.consumable}건 생성`);
      }
    } catch (err: any) {
      setGenerateResult(`❌ 집계 실패: ${err?.message || err}`);
    }
    setIsGenerating(false);
  };

  const handleConfirm = async (id: string) => {
    await confirmPurchaseSettlement(id);
  };

  const handlePaymentSubmit = async () => {
    if (!paymentModal) return;
    const amt = parseFloat(paymentForm.paidAmount);
    if (!amt || amt <= 0) return;
    await recordPurchaseSettlementPayment(paymentModal.id, {
      paidAmount: amt,
      paymentDate: paymentForm.paymentDate,
      paymentMethod: paymentForm.paymentMethod,
      bankAccount: paymentForm.bankAccount || undefined,
      memo: paymentForm.memo || undefined,
    });
    setPaymentModal(null);
  };

  const handleMemoSave = async (id: string) => {
    await savePurchaseSettlement({ id, memo: memoText });
    setMemoEditId(null);
  };

  return (
    <div style={{ padding: '20px 24px', maxWidth: '1100px' }}>
      <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '6px' }}>월말 매입 정산</h2>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
        운송료 / 소모품 매입 / 임차(전대)장비 임차료를 월별 매입처 단위로 집계·확정·지급 처리합니다.
      </p>

      {/* 상단 컨트롤 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end', marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>정산 연월</label>
          <select
            value={selectedYm}
            onChange={e => setSelectedYm(e.target.value)}
            style={{ height: '36px', fontSize: '14px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', minWidth: '130px' }}
          >
            {ymOptions.map(ym => <option key={ym} value={ym}>{ym}</option>)}
          </select>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 16px', background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '13.5px', cursor: isGenerating ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
        >
          {isGenerating ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
          {selectedYm} 자동 집계
        </button>

        {generateResult && (
          <div style={{ padding: '8px 14px', borderRadius: '6px', background: 'var(--bg-app)', border: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-primary)' }}>
            {generateResult}
          </div>
        )}
      </div>

      {/* 유형 탭 */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {SETTLEMENT_TYPES.map(t => (
          <button
            key={t.id}
            onClick={() => setTypeFilter(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
              background: typeFilter === t.id ? 'var(--primary)' : 'var(--bg-card)',
              color: typeFilter === t.id ? '#fff' : 'var(--text-secondary)',
              border: typeFilter === t.id ? 'none' : '1px solid var(--border)',
              whiteSpace: 'nowrap',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: '총 정산 건수',  value: `${summary.count}건`,                    color: 'var(--primary)' },
          { label: '총 청구액',     value: `${summary.total.toLocaleString()}원`,    color: '#F59E0B' },
          { label: '지급 완료액',   value: `${summary.paid.toLocaleString()}원`,     color: '#10B981' },
          { label: '미지급 잔액',   value: `${summary.remaining.toLocaleString()}원`, color: '#EF4444' },
        ].map(card => (
          <div key={card.label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '4px', whiteSpace: 'nowrap' }}>{card.label}</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* 정산 목록 */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)', fontSize: '14px' }}>
          <AlertCircle size={32} style={{ marginBottom: '12px', opacity: 0.4 }} />
          <div>{selectedYm} 정산 데이터가 없습니다.</div>
          <div style={{ fontSize: '12.5px', marginTop: '6px' }}>위 [자동 집계] 버튼을 눌러 당월 데이터를 집계하세요.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(p => {
            const items = purchaseSettlementItems.filter(i => i.settlementId === p.id);
            const isExpanded = expandedId === p.id;
            const statusInfo = STATUS_LABEL[p.status] || { label: p.status, color: '#888' };
            const remaining = p.totalAmount - p.paidAmount;

            return (
              <div key={p.id} className="card" style={{ padding: '0', overflow: 'hidden' }}>
                {/* 헤더 행 */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', cursor: 'pointer', flexWrap: 'wrap' }}
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                >
                  {/* 유형 배지 */}
                  <span style={{ fontSize: '11.5px', fontWeight: '700', padding: '3px 8px', borderRadius: '12px', background: 'var(--bg-app)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', border: '1px solid var(--border)' }}>
                    {TYPE_LABEL[p.settlementType] || p.settlementType}
                  </span>

                  {/* 매입처명 */}
                  <span style={{ fontWeight: '800', fontSize: '15px', flexGrow: 1, minWidth: '120px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {p.vendorName.startsWith('http://') || p.vendorName.startsWith('https://') ? (
                      <a
                        href={p.vendorName}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ color: 'var(--primary)', textDecoration: 'underline', wordBreak: 'break-all', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        {p.vendorName} <ExternalLink size={13} />
                      </a>
                    ) : (
                      p.vendorName
                    )}
                  </span>

                  {/* 상태 뱃지 */}
                  <span style={{ fontSize: '12px', fontWeight: '700', padding: '3px 10px', borderRadius: '12px', background: statusInfo.color + '22', color: statusInfo.color, whiteSpace: 'nowrap' }}>
                    {statusInfo.label}
                  </span>

                  {/* 카드 헤더 증빙 보기 직결 버튼 */}
                  {(() => {
                    const evidences = items.map(item => ({ item, url: getItemEvidenceUrl(item) })).filter(x => !!x.url) as { item: PurchaseSettlementItem; url: string }[];
                    if (evidences.length === 0) return null;
                    return (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEvidence(evidences[0].url, evidences[0].item.itemDescription);
                        }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--primary)',
                          background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)',
                          fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap'
                        }}
                      >
                        <Eye size={13} /> 증빙 보기 ({evidences.length}건)
                      </button>
                    );
                  })()}

                  {/* 금액 */}
                  <div style={{ textAlign: 'right', minWidth: '120px' }}>
                    <div style={{ fontSize: '16px', fontWeight: '800' }}>{p.totalAmount.toLocaleString()}원</div>
                    {p.paidAmount > 0 && (
                      <div style={{ fontSize: '11.5px', color: '#10B981' }}>지급 {p.paidAmount.toLocaleString()}원</div>
                    )}
                  </div>

                  {/* 아이템 수 */}
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{items.length}건</span>

                  {/* 펼치기 */}
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>

                {/* 상세 영역 */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '16px 18px', background: 'var(--bg-app)' }}>
                    {/* 라인 아이템 테이블 */}
                    {items.length > 0 && (
                      <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-card)' }}>
                              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '700', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>내역</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', whiteSpace: 'nowrap', width: '80px', borderBottom: '1px solid var(--border)' }}>수량</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', whiteSpace: 'nowrap', width: '110px', borderBottom: '1px solid var(--border)' }}>단가</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', whiteSpace: 'nowrap', width: '130px', borderBottom: '1px solid var(--border)' }}>금액</th>
                              <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '700', whiteSpace: 'nowrap', width: '120px', borderBottom: '1px solid var(--border)' }}>증빙</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map(item => {
                              const evidenceUrl = getItemEvidenceUrl(item);
                              return (
                                <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                  <td style={{ padding: '8px 12px', textAlign: 'left' }}>{item.itemDescription}</td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>{item.quantity.toLocaleString()}</td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>{item.unitPrice.toLocaleString()}원</td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', whiteSpace: 'nowrap', color: 'var(--primary)' }}>{item.amount.toLocaleString()}원</td>
                                  <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                    {evidenceUrl ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenEvidence(evidenceUrl, item.itemDescription);
                                        }}
                                        style={{
                                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                                          padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--primary)',
                                          background: 'rgba(99, 102, 241, 0.08)', color: 'var(--primary)',
                                          fontSize: '12px', fontWeight: '600', cursor: 'pointer'
                                        }}
                                      >
                                        {evidenceUrl.startsWith('http') ? <ExternalLink size={13} /> : <Eye size={13} />}
                                        증빙 보기
                                      </button>
                                    ) : (
                                      <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>없음</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* 비고 편집 */}
                    <div style={{ marginBottom: '14px' }}>
                      {memoEditId === p.id ? (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="text"
                            value={memoText}
                            onChange={e => setMemoText(e.target.value)}
                            placeholder="비고 입력"
                            style={{ flex: 1, height: '34px', fontSize: '13px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                          />
                          <button onClick={() => handleMemoSave(p.id)} style={{ padding: '6px 12px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>저장</button>
                          <button onClick={() => setMemoEditId(null)} style={{ padding: '6px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer' }}><X size={14} /></button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
                          <span>비고: {p.memo || '—'}</span>
                          <button onClick={() => { setMemoEditId(p.id); setMemoText(p.memo || ''); }} style={{ fontSize: '12px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>수정</button>
                        </div>
                      )}
                    </div>

                    {/* 액션 버튼 */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {p.status === 'PENDING' && (
                        <button
                          onClick={() => handleConfirm(p.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13.5px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          <CheckCircle2 size={15} /> 정산 확정
                        </button>
                      )}
                      {(p.status === 'CONFIRMED' || (p.status === 'PAID' && p.paidAmount < p.totalAmount)) && remaining > 0 && (
                        <button
                          onClick={() => setPaymentModal({ id: p.id, totalAmount: p.totalAmount, paidAmount: p.paidAmount })}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13.5px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          <CreditCard size={15} /> 지급 처리 ({remaining.toLocaleString()}원 잔여)
                        </button>
                      )}
                      {p.status === 'PAID' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10B981', fontWeight: '700', fontSize: '13.5px' }}>
                          <CheckCircle2 size={16} /> 지급 완료 ({p.paymentDate})
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 지급 처리 모달 */}
      {paymentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontWeight: '800', fontSize: '17px', marginBottom: '6px' }}>지급 처리</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              총 {paymentModal.totalAmount.toLocaleString()}원 | 기지급 {paymentModal.paidAmount.toLocaleString()}원 | 잔여 {(paymentModal.totalAmount - paymentModal.paidAmount).toLocaleString()}원
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { label: '지급 금액 *', key: 'paidAmount', type: 'number', placeholder: '지급할 금액 입력' },
                { label: '지급일 *', key: 'paymentDate', type: 'date', placeholder: '' },
                { label: '지급 수단', key: 'paymentMethod', type: 'text', placeholder: '계좌이체 / 현금 등' },
                { label: '지급 계좌번호', key: 'bankAccount', type: 'text', placeholder: '은행명 계좌번호 예금주' },
                { label: '비고', key: 'memo', type: 'text', placeholder: '' },
              ].map(field => (
                <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: '700', whiteSpace: 'nowrap' }}>{field.label}</label>
                  <input
                    type={field.type}
                    value={(paymentForm as any)[field.key]}
                    onChange={e => setPaymentForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    style={{ height: '38px', fontSize: '14px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button
                onClick={handlePaymentSubmit}
                style={{ flex: 1, height: '42px', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '14px', cursor: 'pointer' }}
              >
                지급 완료 처리
              </button>
              <button
                onClick={() => setPaymentModal(null)}
                style={{ flex: 1, height: '42px', background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', color: 'var(--text-primary)' }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 증빙 파일 미리보기/다운로드 모달 */}
      {previewEvidence && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', width: '100%', maxWidth: '900px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="var(--primary)" />
                {previewEvidence.title} 증빙 파일
              </h3>
              <button onClick={() => setPreviewEvidence(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, textAlign: 'center' }}>
              {previewEvidence.url.startsWith('data:image/') || previewEvidence.url.match(/\.(jpeg|jpg|png|gif|webp)(\?.*)?$/i) ? (
                <div style={{ textAlign: 'center' }}>
                  <img src={previewEvidence.url} alt="증빙 이미지" style={{ maxWidth: '100%', maxHeight: '580px', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '16px' }} />
                  <div>
                    <a
                      href={previewEvidence.url}
                      download={`${(previewEvidence.title || '매입증빙').replace(/[^a-zA-Z0-9가-힣_-]/g, '_')}.jpg`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: 'var(--primary)', color: '#fff', borderRadius: '6px', fontWeight: '700', textDecoration: 'none', fontSize: '13.5px' }}
                    >
                      <Download size={15} /> 원본 사진 파일 저장 (내PC/스마트폰 다운로드)
                    </a>
                  </div>
                </div>
              ) : previewEvidence.url.startsWith('data:') || previewEvidence.url.includes('pdf') ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <FileText size={16} color="var(--primary)" />
                      PDF 증빙 문서 실물 미리보기
                    </span>
                    <a
                      href={previewEvidence.url}
                      download={`${(previewEvidence.title || '매입증빙').replace(/[^a-zA-Z0-9가-힣_-]/g, '_')}.pdf`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: 'var(--primary)', color: '#fff', borderRadius: '6px', fontWeight: '700', textDecoration: 'none', fontSize: '12.5px' }}
                    >
                      <Download size={14} /> PDF 원본 저장
                    </a>
                  </div>
                  <div style={{ height: '600px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', background: '#525659' }}>
                    <object
                      data={previewEvidence.url}
                      type="application/pdf"
                      width="100%"
                      height="100%"
                    >
                      <iframe
                        src={previewEvidence.url}
                        title="PDF 증빙 문서 미리보기"
                        style={{ width: '100%', height: '100%', border: 'none' }}
                      />
                    </object>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '30px' }}>
                  <a
                    href={previewEvidence.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 18px', background: 'var(--primary)', color: '#fff', borderRadius: '6px', fontWeight: '700', textDecoration: 'none', fontSize: '14px' }}
                  >
                    <ExternalLink size={15} /> 증빙 URL 원본 열기
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Phase 2 임차료 안내 */}
      {(typeFilter === 'ALL' || typeFilter === 'EQUIPMENT_LEASE') && (
        <div style={{ marginTop: '28px', padding: '16px', borderRadius: '8px', border: '1px dashed var(--border)', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6' }}>
          <strong>📌 임차(전대)장비 임차료 정산</strong> — Phase 2 개발 예정<br />
          외부 임차사(RENTAL)로부터 전대한 장비의 월 가동일수 × 일할 임차료 자동 집계 기능은 별도 임차 계약 등록 기능 개발 후 연동될 예정입니다.
        </div>
      )}

      <div style={{ height: '80px' }} aria-hidden="true" />
    </div>
  );
};
