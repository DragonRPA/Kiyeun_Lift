// d:\Kiyeun_Lift\src\pages\Billings.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { db, Asset, Billing, BillingDetail } from '../services/db';
import { Plus, Download, Mail, CheckCircle, Search, DollarSign, Calendar, FileText, Send } from 'lucide-react';
import { emailService } from '../services/email';

export const Billings: React.FC = () => {
  const {
    billings, billingDetails, customers, contracts, contractAssets, assets, sites,
    generateBillingsForMonth, receivePayment, hasPermission, currentUser, approveBilling, cancelBilling, refreshAllData
  } = useApp();

  const canSave = hasPermission('billing', 'save');
  const isAdmin = currentUser?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'LIST' | 'GENERATE' | 'WIZARD'>('LIST');

  // --- 청구 마법사 상태 ---
  const [wizardSearchStartDate, setWizardSearchStartDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  });
  const [wizardSearchEndDate, setWizardSearchEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedContractIdForWizard, setSelectedContractIdForWizard] = useState<string | null>(null);
  const [wizardStartDate, setWizardStartDate] = useState('');
  const [wizardEndDate, setWizardEndDate] = useState('');
  const [calcMethod, setCalcMethod] = useState<'MONTHLY' | 'PRORATED'>('MONTHLY');
  const [extraCharges, setExtraCharges] = useState<{ id: string; category: string; customName: string; quantity: number; unitPrice: number }[]>([]);

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

  const handleCancel = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('이 청구를 취소하시겠습니까?\n취소 시 해당 청구서는 완전히 삭제되고, 정산 이전 상태로 계약이 복구됩니다.')) {
      cancelBilling(id);
    }
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

  // --- 청구 마법사 비즈니스 로직 ---
  
  const getTodayDay = () => new Date().getDate();
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getCurrentYm = () => new Date().toISOString().substring(0, 7);

  const getSiteName = (id?: string) => {
    const s = sites.find(site => site.id === id);
    return s ? s.name : '직납(현장없음)';
  };

  const getLatestBillingPeriod = () => {
    if (!selectedContractIdForWizard) return '이전 청구 내역 없음';
    
    const contractBillings = billings
      .filter(b => b.contractId === selectedContractIdForWizard)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      
    if (contractBillings.length === 0) return '이전 청구 내역이 없습니다.';
    
    const latest = contractBillings[0];
    const details = billingDetails.filter(bd => bd.billingId === latest.id);
    const descriptions = details.map(d => d.description).filter(Boolean);
    
    const periodDesc = descriptions[0] || '상세 내용 없음';
    return `[${latest.billingYm} 청구분] ${periodDesc} (합계: ${latest.totalAmount.toLocaleString()}원)`;
  };

  const todayStr = getTodayStr();
  const currentYm = getCurrentYm();
  
  const activeContractsForWizard = contracts.filter(c => {
    const isNotExpired = !c.endDate || c.endDate >= todayStr;
    if (!isNotExpired) return false;

    const hasBillingThisMonth = billings.some(b => b.contractId === c.id && b.billingYm === currentYm);
    return !hasBillingThisMonth;
  });

  const isDuePeriod = (c: any) => {
    if (!wizardSearchStartDate || !wizardSearchEndDate) return true;
    
    const startDay = new Date(wizardSearchStartDate).getDate();
    const endDay = new Date(wizardSearchEndDate).getDate();
    
    const isDayInRange = (day: number) => {
      if (startDay <= endDay) {
        return day >= startDay && day <= endDay;
      } else {
        return day >= startDay || day <= endDay;
      }
    };
    
    const billingDayMatch = c.billingDay && isDayInRange(c.billingDay);
    const statementDayMatch = c.statementClosingDay && isDayInRange(c.statementClosingDay);
    
    return billingDayMatch || statementDayMatch;
  };

  const filteredWizardContracts = activeContractsForWizard.filter(c => {
    return isDuePeriod(c);
  });

  const handleSelectContractForWizard = (c: any) => {
    setSelectedContractIdForWizard(c.id);
    setExtraCharges([]);
    
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    
    const firstOfM = new Date(year, month, 1);
    const lastOfM = new Date(year, month + 1, 0);
    
    const startStr = firstOfM.toISOString().split('T')[0];
    const endStr = lastOfM.toISOString().split('T')[0];
    
    const calcStart = c.startDate > startStr ? c.startDate : startStr;
    const calcEnd = c.endDate && c.endDate < endStr ? c.endDate : endStr;
    
    setWizardStartDate(calcStart);
    setWizardEndDate(calcEnd);
    setCalcMethod('MONTHLY');
  };

  const selectedContractForWizard = contracts.find(c => c.id === selectedContractIdForWizard);
  const wizardContractAssets = contractAssets.filter(ca => ca.contractId === selectedContractIdForWizard);
  
  const getDiffDays = () => {
    if (!wizardStartDate || !wizardEndDate) return 0;
    const d1 = new Date(wizardStartDate);
    const d2 = new Date(wizardEndDate);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return isNaN(diffTime) ? 0 : Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const diffDaysForWizard = getDiffDays();

  const totalAmountForWizard = wizardContractAssets.reduce((sum, ca) => {
    if (calcMethod === 'MONTHLY') {
      return sum + ca.monthlyRentalFee;
    } else {
      return sum + (ca.dailyRentalFee * diffDaysForWizard);
    }
  }, 0);

  const handleGenerateWizardBilling = () => {
    if (!selectedContractForWizard || !wizardStartDate || !wizardEndDate) return;

    const extraChargesTotal = extraCharges.reduce((sum, ec) => sum + (ec.quantity * ec.unitPrice), 0);
    const overallTotal = totalAmountForWizard + extraChargesTotal;

    if (overallTotal <= 0) {
      alert('청구 금액이 0원 이하이므로 청구서를 발행할 수 없습니다.');
      return;
    }

    const detailsList: any[] = [];
    
    // 1. 기본 장비 렌탈료 정산 (논리적 기간/방식 계산 적용)
    wizardContractAssets.forEach(ca => {
      const assetInfo = assets.find(a => a.id === ca.assetId);
      const assetName = assetInfo ? `${assetInfo.modelName} (관리번호: ${assetInfo.assetNo})` : '렌탈 장비';
      
      let amount = 0;
      let desc = '';
      if (calcMethod === 'MONTHLY') {
        amount = ca.monthlyRentalFee;
        desc = `${wizardStartDate.substring(0, 7)} 정기 월렌탈료 (월단가 기준)`;
      } else {
        amount = ca.dailyRentalFee * diffDaysForWizard;
        desc = `${wizardStartDate} ~ ${wizardEndDate} 일할 청구 (${diffDaysForWizard}일)`;
      }

      detailsList.push({
        contractAssetId: ca.id,
        itemName: `${assetName} 렌탈료`,
        quantity: 1,
        unitPrice: amount,
        amount: amount,
        description: desc
      });

      if (assetInfo) {
        db.updateRow<Asset>('assets', assetInfo.id, {
          cumRentalFee: (assetInfo.cumRentalFee || 0) + amount,
          updatedAt: new Date().toISOString()
        });
      }
    });

    // 2. 추가 청구 항목 정산 (계산로직 없이 입력 값 그대로 적용)
    extraCharges.forEach(ec => {
      let itemName = '';
      if (ec.category === 'TRANSPORT_ONEWAY') itemName = '운송료 (편도)';
      else if (ec.category === 'TRANSPORT_ROUNDTRIP') itemName = '운송료 (왕복)';
      else if (ec.category === 'REPAIR') itemName = '수리비';
      else itemName = ec.customName || '기타 추가청구';

      const amount = ec.quantity * ec.unitPrice;

      detailsList.push({
        contractAssetId: undefined,
        itemName: itemName,
        quantity: ec.quantity,
        unitPrice: ec.unitPrice,
        amount: amount,
        description: '추가 청구 항목 (수기 지정)'
      });
    });

    // 선수금(예치금) 차감 연동
    const customerInfo = customers.find(c => c.id === selectedContractForWizard.customerId);
    let finalBillingAmount = overallTotal;
    
    if (customerInfo && (customerInfo.prepaidBalance || 0) > 0) {
      const prepaid = customerInfo.prepaidBalance || 0;
      const appliedPrepaid = Math.min(overallTotal, prepaid);
      
      if (appliedPrepaid > 0) {
        detailsList.push({
          contractAssetId: undefined,
          itemName: '선수금(예치금) 차감 반영',
          quantity: 1,
          unitPrice: -appliedPrepaid,
          amount: -appliedPrepaid,
          description: `보유 선수금 중 ${appliedPrepaid.toLocaleString()}원 차감 반영`
        });
        
        db.updateRow<any>('customers', customerInfo.id, {
          prepaidBalance: prepaid - appliedPrepaid,
          updatedAt: new Date().toISOString()
        });
        
        finalBillingAmount = overallTotal - appliedPrepaid;
      }
    }

    const billing = db.insertRow<Billing>('billings', {
      customerId: selectedContractForWizard.customerId,
      contractId: selectedContractForWizard.id,
      billingYm: currentYm,
      billingDate: todayStr,
      totalAmount: finalBillingAmount,
      paidAmount: 0,
      status: 'REQUESTED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    detailsList.forEach(det => {
      db.insertRow<BillingDetail>('billingDetails', {
        ...det,
        billingId: billing.id,
        createdAt: new Date().toISOString()
      });
    });

    refreshAllData();
    setSelectedContractIdForWizard(null);
    setExtraCharges([]);
    alert(`[${getCustName(selectedContractForWizard.customerId)}] 고객사에 대해 총 ${overallTotal.toLocaleString()}원(추가청구 포함) 청구 생성이 완료되었습니다.`);
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
        {canSave && (
          <button className={activeTab === 'WIZARD' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('WIZARD')}>
            <Calendar size={14} /> 미청구 계약 정산 마법사
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
                             b.status === 'REJECTED' ? '취소됨' : 
                             b.status === 'PAID' ? '완납' : 
                             b.status === 'PARTIAL' ? '일부납' : '승인(미납)'}
                          </span>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {isAdmin && b.status === 'REQUESTED' && (
                              <>
                                <button className="btn-success" onClick={(e) => handleApprove(b.id, e)} style={{ padding: '3px 6px', fontSize: '11px' }}>승인</button>
                                <button className="btn-danger" onClick={(e) => handleCancel(b.id, e)} style={{ padding: '3px 6px', fontSize: '11px' }}>취소</button>
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
                    <strong style={{ color: 'var(--danger)', fontSize: '14px', display: 'block', marginBottom: '4px' }}>[취소 사유]</strong>
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

      {activeTab === 'WIZARD' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px', alignItems: 'flex-start' }}>
          {/* 왼쪽: 계약 카드 목록 */}
          <div>
            <div className="card" style={{ margin: 0, marginBottom: '16px' }}>
              <h3 className="card-title" style={{ marginBottom: '12px' }}>정산 대상 계약 목록</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', margin: 0 }}>마감일 기준 검색 기간</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="date"
                    value={wizardSearchStartDate}
                    onChange={e => setWizardSearchStartDate(e.target.value)}
                    style={{ flex: 1, padding: '6px', fontSize: '13px' }}
                  />
                  <span style={{ color: 'var(--text-muted)' }}>~</span>
                  <input
                    type="date"
                    value={wizardSearchEndDate}
                    onChange={e => setWizardSearchEndDate(e.target.value)}
                    style={{ flex: 1, padding: '6px', fontSize: '13px' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredWizardContracts.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', margin: 0 }}>
                  해당 조건의 정산 대상 계약이 없습니다.
                </div>
              ) : (
                filteredWizardContracts.map(c => {
                  const customerName = getCustName(c.customerId);
                  const siteName = getSiteName(c.siteId);
                  const isSelected = selectedContractIdForWizard === c.id;
                  const due = isDuePeriod(c);

                  return (
                    <div
                      key={c.id}
                      onClick={() => handleSelectContractForWizard(c)}
                      className="card"
                      style={{
                        margin: 0,
                        cursor: 'pointer',
                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        backgroundColor: isSelected ? 'var(--bg-active)' : 'var(--bg-card)',
                        transition: 'all 0.2s',
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '700' }}>계약번호: {c.contractNo}</span>
                        {due && (
                          <span className="badge badge-danger">
                            🔥 마감 도래
                          </span>
                        )}
                      </div>
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {customerName}
                      </h4>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        현장: {siteName}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        <div>계약시작: <strong>{c.startDate}</strong></div>
                        <div>계약만료: <strong>{c.endDate || '오픈형'}</strong></div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '8px', color: 'var(--text-muted)' }}>
                        <div>청구 마감: <strong>매월 {c.billingDay}일</strong></div>
                        <div>명세서 마감: <strong>매월 {c.statementClosingDay || '-'}일</strong></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 오른쪽: 정산 계산기 */}
          <div>
            {selectedContractForWizard ? (
              <div className="card" style={{ margin: 0, borderTop: '4px solid var(--primary)' }}>
                <h3 className="card-title" style={{ marginBottom: '8px' }}>
                  [{getCustName(selectedContractForWizard.customerId)}] 청구 요금 계산기
                </h3>
                <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', flexWrap: 'wrap' }}>
                  <span>계약번호: <strong>{selectedContractForWizard.contractNo}</strong></span>
                  <span>계약 기간: <strong>{selectedContractForWizard.startDate} ~ {selectedContractForWizard.endDate || '오픈형'}</strong></span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                  {/* 정산 기간 입력 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', marginBottom: '4px', display: 'block' }}>정산 시작일</label>
                      <input
                        type="date"
                        value={wizardStartDate}
                        onChange={e => setWizardStartDate(e.target.value)}
                        style={{ width: '100%', padding: '8px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', marginBottom: '4px', display: 'block' }}>정산 종료일</label>
                      <input
                        type="date"
                        value={wizardEndDate}
                        onChange={e => setWizardEndDate(e.target.value)}
                        style={{ width: '100%', padding: '8px' }}
                      />
                    </div>
                  </div>

                  {/* 이전 청구 기간 정보 */}
                  <div style={{
                    padding: '10px 14px',
                    backgroundColor: 'var(--bg-app)',
                    borderLeft: '4px solid var(--primary)',
                    borderRadius: '4px',
                    fontSize: '12.5px',
                    color: 'var(--text-secondary)',
                    marginTop: '4px'
                  }}>
                    ℹ️ <strong>이전 회차 청구 내역:</strong> {getLatestBillingPeriod()}
                  </div>

                  {/* 계산 방식 라디오 버튼 */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', marginBottom: '6px', display: 'block' }}>정산 방식 선택</label>
                    <div style={{ display: 'flex', gap: '20px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'normal' }}>
                        <input
                          type="radio"
                          name="calcMethod"
                          checked={calcMethod === 'MONTHLY'}
                          onChange={() => setCalcMethod('MONTHLY')}
                          style={{ width: '16px', height: '16px' }}
                        />
                        월단가 계산 (월렌탈료 전액 적용)
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'normal' }}>
                        <input
                          type="radio"
                          name="calcMethod"
                          checked={calcMethod === 'PRORATED'}
                          onChange={() => setCalcMethod('PRORATED')}
                          style={{ width: '16px', height: '16px' }}
                        />
                        일할청구 계산 (일단가 * 사용일수)
                      </label>
                    </div>
                  </div>

                  {calcMethod === 'PRORATED' && (
                    <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', fontSize: '13px', color: 'var(--primary)', fontWeight: '600' }}>
                      💡 계산된 대여 기간: {diffDaysForWizard}일
                    </div>
                  )}
                </div>

                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px' }}>장비별 예상 요금 상세</h4>
                <div className="table-container" style={{ border: 'none', boxShadow: 'none', marginBottom: '24px' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>모델명</th>
                        <th>월단가</th>
                        <th>일단가</th>
                        <th>정산 방식/기간</th>
                        <th style={{ textAlign: 'right' }}>요금</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wizardContractAssets.map(ca => {
                        const assetInfo = assets.find(a => a.id === ca.assetId);
                        const calculatedItemFee = calcMethod === 'MONTHLY' ? ca.monthlyRentalFee : ca.dailyRentalFee * diffDaysForWizard;

                        return (
                          <tr key={ca.id}>
                            <td>{assetInfo ? `${assetInfo.modelName} (${assetInfo.assetNo})` : ca.expectedModel}</td>
                            <td>{ca.monthlyRentalFee.toLocaleString()}원</td>
                            <td>{ca.dailyRentalFee.toLocaleString()}원</td>
                            <td>
                              {calcMethod === 'MONTHLY' ? '정기월렌탈료' : `일할정산 (${diffDaysForWizard}일)`}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--text-primary)' }}>
                              {calculatedItemFee.toLocaleString()}원
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 추가 청구 항목 입력 섹션 */}
                <div style={{ marginTop: '24px', borderTop: '1px dashed var(--border-color)', paddingTop: '16px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      ➕ 추가 청구 등록 (운송료, 수리비 등)
                    </h4>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setExtraCharges([...extraCharges, {
                        id: Math.random().toString(),
                        category: 'TRANSPORT_ONEWAY',
                        customName: '',
                        quantity: 1,
                        unitPrice: 0
                      }])}
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                    >
                      + 추가항목 생성
                    </button>
                  </div>

                  {extraCharges.length === 0 ? (
                    <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>
                      등록된 추가 청구 항목이 없습니다.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {extraCharges.map((ec, idx) => (
                        <div key={ec.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {/* 카테고리 */}
                          <select
                            value={ec.category}
                            onChange={e => {
                              const updated = [...extraCharges];
                              updated[idx].category = e.target.value;
                              if (e.target.value !== 'OTHER') {
                                updated[idx].customName = '';
                              }
                              setExtraCharges(updated);
                            }}
                            style={{ width: '130px', padding: '6px', fontSize: '13px', border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                          >
                            <option value="TRANSPORT_ONEWAY">운송료(편도)</option>
                            <option value="TRANSPORT_ROUNDTRIP">운송료(왕복)</option>
                            <option value="REPAIR">수리비</option>
                            <option value="OTHER">기타(수기입력)</option>
                          </select>

                          {/* 기타 수기입력명 */}
                          {ec.category === 'OTHER' && (
                            <input
                              type="text"
                              placeholder="기타 항목명"
                              value={ec.customName}
                              onChange={e => {
                                const updated = [...extraCharges];
                                updated[idx].customName = e.target.value;
                                setExtraCharges(updated);
                              }}
                              style={{ width: '110px', padding: '6px', fontSize: '13px', border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                            />
                          )}

                          {/* 수량 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>수량:</span>
                            <input
                              type="number"
                              min="1"
                              value={ec.quantity}
                              onChange={e => {
                                const updated = [...extraCharges];
                                updated[idx].quantity = Math.max(1, parseInt(e.target.value) || 1);
                                setExtraCharges(updated);
                              }}
                              style={{ width: '50px', padding: '6px', fontSize: '13px', border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                            />
                          </div>

                          {/* 단가 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>단가:</span>
                            <input
                              type="number"
                              placeholder="단가(원)"
                              value={ec.unitPrice || ''}
                              onChange={e => {
                                const updated = [...extraCharges];
                                updated[idx].unitPrice = parseInt(e.target.value) || 0;
                                setExtraCharges(updated);
                              }}
                              style={{ width: '100%', minWidth: '70px', padding: '6px', fontSize: '13px', border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', textAlign: 'right' }}
                            />
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>원</span>
                          </div>

                          {/* 금액 표시 */}
                          <span style={{ fontSize: '13px', fontWeight: '600', minWidth: '80px', textAlign: 'right', color: 'var(--text-primary)' }}>
                            {(ec.quantity * ec.unitPrice).toLocaleString()}원
                          </span>

                          {/* 삭제 버튼 */}
                          <button
                            type="button"
                            onClick={() => {
                              setExtraCharges(extraCharges.filter(item => item.id !== ec.id));
                            }}
                            style={{
                              padding: '2px 8px',
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: 'var(--text-secondary)',
                              fontSize: '16px',
                              cursor: 'pointer'
                            }}
                            title="항목 삭제"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '16px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <span>기본 장비 렌탈료 합계</span>
                    <span>{totalAmountForWizard.toLocaleString()}원</span>
                  </div>
                  {extraCharges.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '6px', marginBottom: '4px' }}>
                      <span>추가 청구 항목 합계</span>
                      <span>{extraCharges.reduce((sum, ec) => sum + ec.quantity * ec.unitPrice, 0).toLocaleString()}원</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
                    <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>총 정산 예상 금액</span>
                    <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)' }}>
                      {(totalAmountForWizard + extraCharges.reduce((sum, ec) => sum + ec.quantity * ec.unitPrice, 0)).toLocaleString()}원
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button type="button" className="btn-secondary" onClick={() => setSelectedContractIdForWizard(null)}>
                    취소
                  </button>
                  <button type="button" className="btn-primary" onClick={handleGenerateWizardBilling} disabled={(totalAmountForWizard + extraCharges.reduce((sum, ec) => sum + ec.quantity * ec.unitPrice, 0)) <= 0}>
                    청구 생성
                  </button>
                </div>
              </div>
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)', margin: 0 }}>
                왼쪽 계약 목록에서 청구를 진행할 카드를 선택해 주세요.
              </div>
            )}
          </div>
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
