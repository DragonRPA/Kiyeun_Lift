// d:\Kiyeun_Lift\src\pages\Billings.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Download, Mail, CheckCircle, Search, DollarSign, Calendar, FileText, Send } from 'lucide-react';
import { emailService } from '../services/email';

export const Billings: React.FC = () => {
  const {
    billings, billingDetails, customers, generateBillingsForMonth, receivePayment, hasPermission, currentUser, approveBilling, rejectBilling
  } = useApp();

  const canSave = hasPermission('billing', 'save');
  const isAdmin = currentUser?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'LIST' | 'GENERATE'>('LIST');

  // 청구 생성 입력
  const [billingYm, setBillingYm] = useState('2026-07');
  const [billingDate, setBillingDate] = useState('2026-07-30');

  // 선택된 청구서 상세
  const [selectedBillingId, setSelectedBillingId] = useState<string | null>(null);

  // 수납 입력 모달
  const [showPayModal, setShowPayModal] = useState(false);
  const [payBillingId, setPayBillingId] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState('BANK_TRANSFER');
  const [payMemo, setPayMemo] = useState('');

  // 메일 전송 모달
  const [showMailModal, setShowMailModal] = useState(false);
  const [mailBillingId, setMailBillingId] = useState('');
  const [mailTo, setMailTo] = useState('');
  const [isSending, setIsSending] = useState(false);

  const getCustName = (id: string) => customers.find(c => c.id === id)?.name || '-';

  const activeBilling = billings.find(b => b.id === selectedBillingId);
  const activeBillingDetails = billingDetails.filter(bd => bd.billingId === selectedBillingId);

  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    
    // 청구 생성 호출
    generateBillingsForMonth(billingYm, billingDate);
    
    alert(`${billingYm} 마감일 기준 청구 데이터가 성공적으로 생성되었습니다.`);
    setActiveTab('LIST');
  };

  const handleApprove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    approveBilling(id);
  };

  const handleReject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const reason = prompt('반려 사유를 입력하세요:');
    if (reason) rejectBilling(id, reason);
  };

  const handleOpenPay = (bId: string, amount: number) => {
    setPayBillingId(bId);
    setPayAmount(amount);
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayMethod('BANK_TRANSFER');
    setPayMemo('');
    setShowPayModal(true);
  };

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !payBillingId || payAmount <= 0) return;

    receivePayment(payBillingId, {
      paymentDate: payDate,
      amount: payAmount,
      method: payMethod,
      memo: payMemo
    });

    alert('수납 등록 처리가 완료되었습니다.');
    setShowPayModal(false);
    setPayBillingId('');
  };

  const handleOpenMail = (billingId: string) => {
    setMailBillingId(billingId);
    const billing = billings.find(b => b.id === billingId);
    const customer = customers.find(c => c.id === billing?.customerId);
    
    setMailTo(customer?.repEmail || '');
    setShowMailModal(true);
  };

  const handleSendStatementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mailTo) {
      alert('수신인 메일을 지정해 주세요.');
      return;
    }

    setIsSending(true);
    const billing = billings.find(b => b.id === mailBillingId);
    const details = billingDetails.filter(d => d.billingId === mailBillingId);
    
    const subject = `[청구내역서] ${getCustName(billing?.customerId || '')} ${billing?.billingYm} 렌탈료 청구 안내`;
    const body = 
      `안녕하세요, ${getCustName(billing?.customerId || '')} 귀하.\n\n` +
      `당사 리프트 임대 계약에 따른 ${billing?.billingYm} 청구내역서를 송부해 드립니다.\n` +
      `청구 일자: ${billing?.billingDate}\n` +
      `합계 금액: ${billing?.totalAmount.toLocaleString()}원\n\n` +
      `[세부 청구 내역]\n` +
      details.map(d => `- ${d.itemName} : ${d.amount.toLocaleString()}원 (${d.description})`).join('\n') + '\n\n' +
      `입금 계좌: 신한은행 100-012-345678 (주)기연리프트\n\n` +
      `감사합니다.`;

    try {
      await emailService.sendEmail(mailTo, subject, body, []);
      alert('청구내역서 이메일 발송이 성공적으로 완료되었습니다.');
      setShowMailModal(false);
    } catch (err) {
      alert('전송 중 에러가 발생했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: '24px', fontWeight: '700' }}>청구 및 수납 수금 관리</h2>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button className={activeTab === 'LIST' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('LIST')}>
          청구 및 수납 내역
        </button>
        {canSave && (
          <button className={activeTab === 'GENERATE' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('GENERATE')}>
            <Plus size={14} /> 월간 청구서 일괄 생성 (마감)
          </button>
        )}
      </div>

      {activeTab === 'LIST' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'flex-start' }}>
          
          {/* 청구 목록 */}
          <div className="card" style={{ margin: 0 }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>청구서 리스트</h3>
            
            <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
              <table style={{ minWidth: '450px' }}>
                <thead>
                  <tr>
                    <th>청구월</th>
                    <th>고객사</th>
                    <th>청구액</th>
                    <th>미납액</th>
                    <th>상태</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {billings.map(b => {
                    const unpaid = b.totalAmount - b.paidAmount;
                    return (
                      <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedBillingId(b.id)}>
                        <td><strong>{b.billingYm}</strong></td>
                        <td>{getCustName(b.customerId)}</td>
                        <td>{b.totalAmount.toLocaleString()}원</td>
                        <td style={{ color: unpaid > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                          {unpaid.toLocaleString()}원
                        </td>
                        <td>
                          <span className={`badge ${
                            b.status === 'REQUESTED' ? 'badge-warning' :
                            b.status === 'REJECTED' ? 'badge-danger' :
                            b.status === 'PAID' ? 'badge-success' :
                            b.status === 'PARTIAL' ? 'badge-warning' : 'badge-info'
                          }`}>
                            {b.status === 'REQUESTED' ? '결재대기' : 
                             b.status === 'REJECTED' ? '반려됨' : 
                             b.status === 'PAID' ? '완납' : 
                             b.status === 'PARTIAL' ? '일부납' : '승인(미납)'}
                          </span>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {isAdmin && b.status === 'REQUESTED' && (
                              <>
                                <button className="btn-success" onClick={(e) => handleApprove(b.id, e)} style={{ padding: '3px 6px', fontSize: '11px' }}>승인</button>
                                <button className="btn-danger" onClick={(e) => handleReject(b.id, e)} style={{ padding: '3px 6px', fontSize: '11px' }}>반려</button>
                              </>
                            )}
                            {canSave && (b.status === 'UNPAID' || b.status === 'PARTIAL') && (
                              <button className="btn-success" onClick={() => handleOpenPay(b.id, unpaid)} style={{ padding: '3px 6px', fontSize: '11px' }}>
                                수납
                              </button>
                            )}
                            {(b.status === 'UNPAID' || b.status === 'PARTIAL' || b.status === 'PAID') && (
                              <button className="btn-secondary" onClick={() => handleOpenMail(b.id)} style={{ padding: '3px 6px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <Mail size={10} /> 발송
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 청구 상세 정보 */}
          <div>
            {activeBilling ? (
              <div className="card" style={{ margin: 0 }}>
                <div className="card-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                  <h3 className="card-title">청구 명세서 ({activeBilling.billingYm})</h3>
                  <span className="badge badge-info">{activeBilling.billingDate} 발행 기안</span>
                </div>
                {activeBilling.status === 'REJECTED' && (
                  <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', borderLeft: '4px solid var(--danger)', marginBottom: '16px', borderRadius: '4px' }}>
                    <strong style={{ color: 'var(--danger)', fontSize: '14px', display: 'block', marginBottom: '4px' }}>[반려 사유]</strong>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{activeBilling.rejectReason || '사유 미기재'}</span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px', marginBottom: '20px' }}>
                  <div><label>고객사명</label><strong>{getCustName(activeBilling.customerId)}</strong></div>
                  <div><label>총 청구 금액</label><strong className="text-primary">{activeBilling.totalAmount.toLocaleString()}원</strong></div>
                  <div><label>기수금액 (수납)</label>{activeBilling.paidAmount.toLocaleString()}원</div>
                  <div><label>미수금 잔액</label><strong style={{ color: 'var(--danger)' }}>{(activeBilling.totalAmount - activeBilling.paidAmount).toLocaleString()}원</strong></div>
                </div>

                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px' }}>세부 청구 내역</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeBillingDetails.map(bd => (
                    <div key={bd.id} style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600', marginBottom: '4px' }}>
                        <span>{bd.itemName}</span>
                        <span>{bd.amount.toLocaleString()}원</span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>{bd.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', margin: 0 }}>
                상세 청구 항목을 조회할 청구서를 왼쪽 목록에서 선택해 주세요.
              </div>
            )}
          </div>

        </div>
      )}

      {activeTab === 'GENERATE' && (
        <div className="card" style={{ maxWidth: '600px', margin: 0 }}>
          <div className="card-header" style={{ marginBottom: '20px' }}>
            <h3 className="card-title">월간 렌탈/수리 요금 정기 청구 생성</h3>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>고객별 마감일 기준 장비 일수 및 청구수리비를 합산합니다.</span>
          </div>

          <form onSubmit={handleGenerateSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label>청구 대상 년월 (YM) *</label>
                <input
                  type="month"
                  value={billingYm}
                  onChange={e => setBillingYm(e.target.value)}
                  required
                />
              </div>

              <div>
                <label>청구 발행일자 *</label>
                <input
                  type="date"
                  value={billingDate}
                  onChange={e => setBillingDate(e.target.value)}
                  required
                />
              </div>

              <div style={{ padding: '14px', backgroundColor: 'var(--bg-app)', border: '1px dashed var(--border-color)', borderRadius: '8px', fontSize: '13px' }}>
                <p style={{ fontWeight: '600', marginBottom: '4px' }}>[자동 합산 비즈니스 로직]</p>
                <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li>대상월 전체 렌탈 계약의 계약 기간에 부합하는 장비 요금 합산</li>
                  <li>중도 출고/중도 회수 건에 대한 일할 임대료 일수 자동 계산</li>
                  <li>해당월 내 완료된 자산 수리 중 <strong>'고객 청구 대상'</strong> 수리 비용 연동</li>
                </ul>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn-primary">청구 생성 및 마감 실행</button>
            </div>
          </form>
        </div>
      )}

      {/* 수납 입력 모달 */}
      {showPayModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handlePaySubmit} className="card" style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>수납 금액 입력</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label>수납 일자</label>
                <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} required />
              </div>
              
              <div>
                <label>수납 처리액 (원) *</label>
                <input
                  type="number"
                  value={payAmount || ''}
                  onChange={e => setPayAmount(parseInt(e.target.value) || 0)}
                  required
                />
              </div>

              <div>
                <label>수납 방법</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                  <option value="BANK_TRANSFER">통장 송금 (Bank Transfer)</option>
                  <option value="CARD">카드 결제</option>
                  <option value="CASH">현금 수납</option>
                </select>
              </div>

              <div>
                <label>수납 비고 (입금자명 등)</label>
                <input
                  type="text"
                  value={payMemo}
                  onChange={e => setPayMemo(e.target.value)}
                  placeholder="예: 현대건설 김민수 입금"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowPayModal(false)}>취소</button>
              <button type="submit" className="btn-primary">수납 완료 처리</button>
            </div>
          </form>
        </div>
      )}

      {/* 청구내역서 메일 발송 모달 */}
      {showMailModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleSendStatementSubmit} className="card" style={{ width: '100%', maxWidth: '450px', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>청구내역서 생성 및 이메일 발송</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label>수신자 대표 이메일 *</label>
                <input
                  type="email"
                  value={mailTo}
                  onChange={e => setMailTo(e.target.value)}
                  placeholder="name@company.com"
                  required
                />
              </div>

              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '10px', backgroundColor: 'var(--bg-app)', borderRadius: '6px' }}>
                * 클릭 시 청구 테이블의 세부 내역(일할 렌탈료 및 청구 수리비)이 텍스트 내역서 포맷으로 자동 변환되어 이메일에 포함됩니다.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowMailModal(false)}>취소</button>
              <button type="submit" className="btn-success" disabled={isSending}>
                {isSending ? '발송 중...' : <><Send size={14} /> 청구내역서 전송</>}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
