// d:\Kiyeun_Lift\src\pages\BankMatching.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Search, Check, X, Download, Upload, Trash2, 
  RefreshCw, TrendingUp, AlertCircle, FileSpreadsheet,
  Link as LinkIcon, Plus, DollarSign, Calendar, Layers
} from 'lucide-react';
import { exportToExcel } from '../services/excel';
import { BankTransaction } from '../services/db';

export const BankMatching: React.FC = () => {
  const {
    bankTransactions,
    bankMatchingRules,
    billings,
    customers,
    payments,
    uploadBankTransactions,
    matchTransactionManual,
    unmatchTransaction,
    deleteMatchingRule,
    hasPermission,
    currentUser
  } = useApp();

  const canSave = hasPermission('billing', 'save');
  const isAdmin = currentUser?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'MATCHING' | 'RULES'>('MATCHING');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNMATCHED' | 'MATCHED'>('ALL');
  
  // 수동 매칭 모달 상태
  const [selectedTx, setSelectedTx] = useState<BankTransaction | null>(null);
  const [matchingBillingId, setMatchingBillingId] = useState('');
  const [learnRule, setLearnRule] = useState(true);
  const [billingSearchTerm, setBillingSearchTerm] = useState('');

  // 1. 기초 연계 헬퍼 함수
  const getCustName = (custId: string) => {
    return customers.find(c => c.id === custId)?.name || '알 수 없음';
  };

  const getBillingName = (bId: string) => {
    const b = billings.find(x => x.id === bId);
    if (!b) return '-';
    return `[${getCustName(b.customerId)}] ${b.billingYm} 청구분 (${b.totalAmount.toLocaleString()}원)`;
  };

  const getMatchedBillingsInfo = (txId: string) => {
    const matchPrefix = `pay-matching-${txId}`;
    const txPayments = payments.filter(p => p.id.startsWith(matchPrefix));
    
    if (txPayments.length === 0) return <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>-</span>;
    
    return txPayments.map((p) => {
      if (!p.billingId) {
        return (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)', fontSize: '12px' }}>
            <span>• 선수금 적립 (+{p.amount.toLocaleString()}원)</span>
          </div>
        );
      }
      
      const b = billings.find(x => x.id === p.billingId);
      if (!b) return null;
      return (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
          <LinkIcon size={10} style={{ color: 'var(--primary)' }} />
          <span>
            {b.billingYm} 청구분 ({p.amount.toLocaleString()}원 수납)
          </span>
        </div>
      );
    }).filter(Boolean);
  };

  // 2. 통계 메트릭 계산
  const deposits = bankTransactions.filter(t => t.depositAmount > 0);
  const matchedCount = deposits.filter(t => !!t.matchedBillingId).length;
  const unmatchedCount = deposits.filter(t => !t.matchedBillingId).length;
  const matchRate = deposits.length > 0 ? Math.round((matchedCount / deposits.length) * 100) : 0;

  const unpaidBillings = billings.filter(b => b.status === 'UNPAID' || b.status === 'PARTIAL');
  const totalUnpaidAmount = unpaidBillings.reduce((sum, b) => sum + (b.totalAmount - b.paidAmount), 0);

  // 3. 모의 데이터 생성
  const handleGenerateMockData = () => {
    const mockTxs = [
      { transactionDate: '2026-07-20 09:30:15', senderName: '대현테크', depositAmount: 1050000, withdrawAmount: 0, memo: '통장입금' },
      { transactionDate: '2026-07-20 10:15:22', senderName: '주식회사기연', depositAmount: 600000, withdrawAmount: 0, memo: '7월분결제' },
      { transactionDate: '2026-07-20 11:00:00', senderName: '이정용', depositAmount: 300000, withdrawAmount: 0, memo: '임대료 송금' },
      { transactionDate: '2026-07-20 13:45:10', senderName: '현장가설', depositAmount: 0, withdrawAmount: 150000, memo: '유류비 지출' },
      { transactionDate: '2026-07-20 14:20:00', senderName: '한성건설', depositAmount: 900000, withdrawAmount: 0, memo: '7월렌탈료' },
      { transactionDate: '2026-07-21 09:10:00', senderName: '삼성물산', depositAmount: 1200000, withdrawAmount: 0, memo: '공사대금' },
      { transactionDate: '2026-07-21 11:30:00', senderName: '현대건설', depositAmount: 850000, withdrawAmount: 0, memo: '장비대' },
      { transactionDate: '2026-07-21 14:00:00', senderName: '김정비', depositAmount: 0, withdrawAmount: 350000, memo: '외주수리비' },
      { transactionDate: '2026-07-22 10:00:00', senderName: '에이스렌탈', depositAmount: 0, withdrawAmount: 500000, memo: '임차료' },
      { transactionDate: '2026-07-22 16:30:00', senderName: '기연산업', depositAmount: 450000, withdrawAmount: 0, memo: '렌탈입금' }
    ];
    uploadBankTransactions(mockTxs);
    alert('10건의 모의 거래 내역이 성공적으로 생성되었으며, 규칙에 따른 자동 대조 처리가 완료되었습니다.');
  };

  // 4. CSV 다운로드/업로드 처리
  const handleDownloadTemplate = () => {
    const headers = '거래일시,이체자명,입금액,출금액,메모\n';
    const rows = [
      '2026-07-20 09:30:00,대현테크,1050000,0,보통예금입금',
      '2026-07-20 10:15:00,주식회사기연,600000,0,수금대금',
      '2026-07-20 14:00:00,홍길동,300000,0,렌탈료송금'
    ].join('\n');
    
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'bank_transactions_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const parsed: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const cols = line.split(',');
        if (cols.length >= 5) {
          parsed.push({
            transactionDate: cols[0].trim(),
            senderName: cols[1].trim(),
            depositAmount: parseFloat(cols[2].trim()) || 0,
            withdrawAmount: parseFloat(cols[3].trim()) || 0,
            memo: cols[4].trim()
          });
        }
      }

      if (parsed.length > 0) {
        uploadBankTransactions(parsed);
        alert(`${parsed.length}건의 은행 입출금 거래 내역이 업로드되었으며 자동 대조를 마쳤습니다.`);
      } else {
        alert('올바른 CSV 형식이 아닙니다. 헤더라인을 포함하여 컬럼을 맞춰 주십시오.');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  // 5. 엑셀 다운로드
  const handleExport = () => {
    const excelData = filteredTransactions.map((t, idx) => {
      const matchPrefix = `pay-matching-${t.id}`;
      const txPayments = payments.filter(p => p.id.startsWith(matchPrefix));
      const matchInfo = txPayments.length > 0
        ? txPayments.map(p => p.billingId ? `${billings.find(b => b.id === p.billingId)?.billingYm} 청구분 (${p.amount.toLocaleString()}원)` : `선수금 적립 (+${p.amount.toLocaleString()}원)`).join(', ')
        : '-';

      return {
        'No': idx + 1,
        '거래일시': t.transactionDate,
        '이체/입금자명': t.senderName,
        '입금액': t.depositAmount.toLocaleString() + '원',
        '출금액': t.withdrawAmount.toLocaleString() + '원',
        '적요/메모': t.memo,
        '매칭형태': t.matchedBillingId ? (t.matchingType === 'AUTO' ? '자동매칭' : '수동매칭') : '미매칭',
        '매칭된 청구 정보': matchInfo
      };
    });
    exportToExcel(excelData, `은행입출금매칭_${new Date().toISOString().split('T')[0]}`, '입출금대조');
  };

  // 6. 데이터 필터링
  const filteredTransactions = bankTransactions.filter(t => {
    const matchesSearch = 
      t.senderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.memo.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    if (statusFilter === 'UNMATCHED') {
      return t.depositAmount > 0 && !t.matchedBillingId;
    }
    if (statusFilter === 'MATCHED') {
      return !!t.matchedBillingId;
    }
    return true;
  }).sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));

  // 7. 수동 매칭 모달 활성화 및 정렬
  const handleOpenManualMatch = (tx: BankTransaction) => {
    setSelectedTx(tx);
    setLearnRule(true);
    setBillingSearchTerm('');
    
    const matchedCustomer = customers.find(c => 
      tx.senderName.includes(c.name) || c.name.includes(tx.senderName)
    );
    
    const candidateBillings = unpaidBillings.filter(b => {
      if (!matchedCustomer) return true;
      return b.customerId === matchedCustomer.id;
    });

    if (candidateBillings.length > 0) {
      const exactAmountBilling = candidateBillings.find(b => (b.totalAmount - b.paidAmount) === tx.depositAmount);
      if (exactAmountBilling) {
        setMatchingBillingId(exactAmountBilling.id);
      } else {
        setMatchingBillingId(candidateBillings[0].id);
      }
    } else if (unpaidBillings.length > 0) {
      setMatchingBillingId(unpaidBillings[0].id);
    } else {
      setMatchingBillingId('');
    }
  };

  const handleManualMatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTx || !matchingBillingId) return;

    matchTransactionManual(selectedTx.id, matchingBillingId, learnRule);
    setSelectedTx(null);
    alert('수동 매칭 및 수납 처리가 완료되었습니다.');
  };

  const getModalFilteredBillings = () => {
    if (!selectedTx) return [];
    
    const matchedCustomer = customers.find(c => 
      selectedTx.senderName.includes(c.name) || c.name.includes(selectedTx.senderName)
    );

    return unpaidBillings.filter(b => {
      const custName = getCustName(b.customerId);
      return custName.toLowerCase().includes(billingSearchTerm.toLowerCase()) ||
             b.billingYm.includes(billingSearchTerm);
    }).sort((a, b) => {
      const aIsMatch = matchedCustomer && a.customerId === matchedCustomer.id;
      const bIsMatch = matchedCustomer && b.customerId === matchedCustomer.id;
      if (aIsMatch && !bIsMatch) return -1;
      if (!aIsMatch && bIsMatch) return 1;

      const aAmtMatch = (a.totalAmount - a.paidAmount) === selectedTx.depositAmount;
      const bAmtMatch = (b.totalAmount - b.paidAmount) === selectedTx.depositAmount;
      if (aAmtMatch && !bAmtMatch) return -1;
      if (!aAmtMatch && bAmtMatch) return 1;

      return a.billingYm.localeCompare(b.billingYm);
    });
  };

  return (
    <div>
      <h2 style={{ marginBottom: '24px', fontWeight: '700' }}>은행 입출금 및 청구서 대조 관리</h2>

      {/* 탭 헤더 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button 
          className={activeTab === 'MATCHING' ? 'btn-primary' : 'btn-secondary'} 
          onClick={() => setActiveTab('MATCHING')}
        >
          <RefreshCw size={14} /> 입출금 대조 및 수납 매칭
        </button>
        <button 
          className={activeTab === 'RULES' ? 'btn-primary' : 'btn-secondary'} 
          onClick={() => setActiveTab('RULES')}
        >
          <Layers size={14} /> 학습형 매칭 룰 관리 ({bankMatchingRules.length}건)
        </button>
      </div>

      {activeTab === 'MATCHING' ? (
        <>
          {/* 상단 통계 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            <div className="card" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
              <div style={{ padding: '12px', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', color: 'var(--primary)' }}>
                <TrendingUp size={24} />
              </div>
              <div>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block' }}>전체 통장 입금</span>
                <strong style={{ fontSize: '20px', fontWeight: '700' }}>{deposits.length} 건</strong>
              </div>
            </div>

            <div className="card" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
              <div style={{ padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', color: 'var(--success)' }}>
                <Check size={24} />
              </div>
              <div>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block' }}>대조 매칭 완료 (매칭율)</span>
                <strong style={{ fontSize: '20px', fontWeight: '700' }}>{matchedCount} 건 ({matchRate}%)</strong>
              </div>
            </div>

            <div className="card" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
              <div style={{ padding: '12px', backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px', color: 'var(--warning)' }}>
                <AlertCircle size={24} />
              </div>
              <div>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block' }}>미매칭 대기 입금</span>
                <strong style={{ fontSize: '20px', fontWeight: '700', color: 'var(--warning)' }}>{unmatchedCount} 건</strong>
              </div>
            </div>

            <div className="card" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
              <div style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', color: 'var(--danger)' }}>
                <DollarSign size={24} />
              </div>
              <div>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block' }}>미수금 청구 잔액</span>
                <strong style={{ fontSize: '18px', fontWeight: '700', color: 'var(--danger)' }}>
                  {totalUnpaidAmount.toLocaleString()}원 ({unpaidBillings.length}건)
                </strong>
              </div>
            </div>
          </div>

          {/* 작업 컨트롤 바 */}
          <div className="card" style={{ padding: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button className="btn-secondary" onClick={handleDownloadTemplate} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <FileSpreadsheet size={15} /> 템플릿 받기
              </button>
              {canSave && (
                <label className="btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', margin: 0 }}>
                  <Upload size={15} /> CSV 업로드
                  <input type="file" accept=".csv" onChange={handleCSVUpload} style={{ display: 'none' }} />
                </label>
              )}
              {canSave && (
                <button className="btn-secondary" onClick={handleGenerateMockData} style={{ display: 'flex', alignItems: 'center', gap: '4px', border: '1px dashed var(--border-color)' }}>
                  <Plus size={14} /> 모의 입출금 데이터 생성
                </button>
              )}
            </div>

            <button className="btn-secondary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Download size={15} /> 현재 목록 엑셀 저장
            </button>
          </div>

          {/* 검색 및 필터 패널 */}
          <div className="card" style={{ padding: '16px', marginBottom: '20px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="이체자명 또는 적요 검색..."
                style={{ paddingLeft: '36px' }}
              />
            </div>
            
            <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
              <button 
                onClick={() => setStatusFilter('ALL')}
                style={{
                  padding: '8px 16px', fontSize: '13px', border: 'none', borderRadius: 0,
                  backgroundColor: statusFilter === 'ALL' ? 'var(--bg-active)' : 'transparent',
                  color: statusFilter === 'ALL' ? 'var(--primary)' : 'var(--text-secondary)'
                }}
              >
                전체 거래
              </button>
              <button 
                onClick={() => setStatusFilter('UNMATCHED')}
                style={{
                  padding: '8px 16px', fontSize: '13px', border: 'none', borderRadius: 0,
                  backgroundColor: statusFilter === 'UNMATCHED' ? 'var(--bg-active)' : 'transparent',
                  color: statusFilter === 'UNMATCHED' ? 'var(--primary)' : 'var(--text-secondary)',
                  borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)'
                }}
              >
                대기 (미대조)
              </button>
              <button 
                onClick={() => setStatusFilter('MATCHED')}
                style={{
                  padding: '8px 16px', fontSize: '13px', border: 'none', borderRadius: 0,
                  backgroundColor: statusFilter === 'MATCHED' ? 'var(--bg-active)' : 'transparent',
                  color: statusFilter === 'MATCHED' ? 'var(--primary)' : 'var(--text-secondary)'
                }}
              >
                대조 완료
              </button>
            </div>
          </div>

          {/* 메인 리스트 그리드 */}
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>No</th>
                  <th>거래일시</th>
                  <th>이체/입금자명</th>
                  <th>입금액 (매출)</th>
                  <th>출금액 (매입)</th>
                  <th>적요/메모</th>
                  <th style={{ width: '100px' }}>상태</th>
                  <th>대조 매칭된 청구서</th>
                  {canSave && <th style={{ width: '100px', textAlign: 'center' }}>작업</th>}
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={canSave ? 9 : 8} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                      해당하는 통장 거래 내역이 없습니다. (상단의 '모의 입출금 데이터 생성'을 눌러 테스트해 보세요)
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx, index) => {
                    const isDeposit = tx.depositAmount > 0;
                    const isMatched = !!tx.matchedBillingId;

                    return (
                      <tr key={tx.id}>
                        <td>{index + 1}</td>
                        <td>{tx.transactionDate}</td>
                        <td>
                          <strong>{tx.senderName}</strong>
                        </td>
                        <td style={{ color: tx.depositAmount > 0 ? 'var(--primary)' : 'inherit', fontWeight: tx.depositAmount > 0 ? '600' : 'normal' }}>
                          {tx.depositAmount > 0 ? `+${tx.depositAmount.toLocaleString()}원` : '-'}
                        </td>
                        <td style={{ color: tx.withdrawAmount > 0 ? 'var(--danger)' : 'inherit' }}>
                          {tx.withdrawAmount > 0 ? `-${tx.withdrawAmount.toLocaleString()}원` : '-'}
                        </td>
                        <td>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{tx.memo}</span>
                        </td>
                        <td>
                          {!isDeposit ? (
                            <span className="badge badge-secondary" style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-muted)' }}>출금(제외)</span>
                          ) : isMatched ? (
                            tx.matchingType === 'AUTO' ? (
                              <span className="badge badge-success" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>자동 매칭</span>
                            ) : (
                              <span className="badge badge-info" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)' }}>수동 매칭</span>
                            )
                          ) : (
                            <span className="badge badge-warning" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>대기</span>
                          )}
                        </td>
                        <td>
                          {isMatched ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {getMatchedBillingsInfo(tx.id)}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>-</span>
                          )}
                        </td>
                        {canSave && (
                          <td style={{ textAlign: 'center' }}>
                            {isDeposit && !isMatched && (
                              <button 
                                className="btn-primary" 
                                onClick={() => handleOpenManualMatch(tx)}
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                              >
                                대조 매칭
                              </button>
                            )}
                            {isMatched && (
                              <button 
                                className="btn-danger" 
                                onClick={() => {
                                  if (confirm('이 매칭을 취소하시겠습니까?\n매칭을 취소하면 청구서의 수납 전표가 완전히 삭제되고 미납 상태로 롤백됩니다.')) {
                                    unmatchTransaction(tx.id);
                                    alert('대조 매칭이 해제되고 수납 내역이 안전하게 롤백되었습니다.');
                                  }
                                }}
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                              >
                                매칭 취소
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* 학습형 매칭 룰 탭 */
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 className="card-title">학습형 매칭 규칙 목록</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              수동 매칭 시 등록한 이체자명과 고객사의 연결 고리를 보여줍니다. 통장 내역 업로드 시 본 규칙을 조회하여 우선적으로 자동 대조 수납을 처리합니다.
            </p>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>No</th>
                  <th>은행 이체자/입금자명 (적요 기준)</th>
                  <th>연결된 ERP 고객사</th>
                  <th style={{ width: '150px' }}>등록일</th>
                  {canSave && <th style={{ width: '100px', textAlign: 'center' }}>작업</th>}
                </tr>
              </thead>
              <tbody>
                {bankMatchingRules.length === 0 ? (
                  <tr>
                    <td colSpan={canSave ? 5 : 4} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                      등록된 학습형 매칭 룰이 없습니다. 수동 대조 매칭을 진행할 때 '매핑 관계 기억' 체크박스를 켜서 규칙을 추가해 보세요.
                    </td>
                  </tr>
                ) : (
                  bankMatchingRules.map((rule, idx) => (
                    <tr key={rule.id}>
                      <td>{idx + 1}</td>
                      <td>
                        <strong>{rule.senderName}</strong>
                      </td>
                      <td>{getCustName(rule.customerId)}</td>
                      <td>{rule.createdAt.substring(0, 10)}</td>
                      {canSave && (
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            className="btn-danger" 
                            onClick={() => {
                              if (confirm('이 매핑 매칭 규칙을 삭제하시겠습니까?\n삭제 후에는 해당 입금자명으로 들어오는 거래가 자동으로 대조되지 않습니다.')) {
                                deleteMatchingRule(rule.id);
                                alert('매핑 규칙이 제거되었습니다.');
                              }
                            }}
                            style={{ padding: '3px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                          >
                            <Trash2 size={10} /> 삭제
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 수동 매칭 모달 */}
      {selectedTx && (
        <div style={{
          position: 'fixed', left: 0, top: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 999, padding: '16px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '700px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 className="card-title" style={{ margin: 0 }}>수동 대조 매칭 실행</h3>
              <button onClick={() => setSelectedTx(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px',
                padding: '16px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', marginBottom: '20px'
              }}>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>거래일시</span>
                  <strong>{selectedTx.transactionDate}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>이체자/입금자명</span>
                  <strong className="text-primary">{selectedTx.senderName}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>실제 입금액</span>
                  <strong style={{ color: 'var(--success)' }}>{selectedTx.depositAmount.toLocaleString()}원</strong>
                </div>
              </div>

              <div style={{ marginBottom: '16px', position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={billingSearchTerm}
                  onChange={e => setBillingSearchTerm(e.target.value)}
                  placeholder="고객사명 또는 청구월(YYYY-MM) 검색..."
                  style={{ paddingLeft: '32px', fontSize: '13px' }}
                />
              </div>

              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600' }}>매칭할 청구서 선택 (이체자명 기준 자동 추천 정렬됨)</label>
              
              <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border-color)' }}>
                <table style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>선택</th>
                      <th>청구월</th>
                      <th>고객사명</th>
                      <th>총액</th>
                      <th>미납잔액</th>
                      <th>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getModalFilteredBillings().length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>
                          수납 매칭 대기 중인(미납/일부납 상태) 청구서가 존재하지 않습니다.
                        </td>
                      </tr>
                    ) : (
                      getModalFilteredBillings().map(b => {
                        const unpaidAmount = b.totalAmount - b.paidAmount;
                        const isExactAmount = unpaidAmount === selectedTx.depositAmount;
                        const matchedCustomer = customers.find(c => 
                          selectedTx.senderName.includes(c.name) || c.name.includes(selectedTx.senderName)
                        );
                        const isRecommendedCustomer = matchedCustomer && b.customerId === matchedCustomer.id;

                        return (
                          <tr 
                            key={b.id} 
                            onClick={() => setMatchingBillingId(b.id)} 
                            style={{ 
                              cursor: 'pointer',
                              backgroundColor: matchingBillingId === b.id ? 'var(--bg-active)' : 'transparent'
                            }}
                          >
                            <td>
                              <input 
                                type="radio" 
                                checked={matchingBillingId === b.id}
                                onChange={() => setMatchingBillingId(b.id)}
                              />
                            </td>
                            <td>{b.billingYm}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <strong>{getCustName(b.customerId)}</strong>
                                {isRecommendedCustomer && (
                                  <span style={{ fontSize: '10px', padding: '1px 4px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', borderRadius: '3px' }}>추천 고객사</span>
                                )}
                              </div>
                            </td>
                            <td>{b.totalAmount.toLocaleString()}원</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <strong style={{ color: isExactAmount ? 'var(--success)' : 'inherit' }}>
                                  {unpaidAmount.toLocaleString()}원
                                </strong>
                                {isExactAmount && (
                                  <span style={{ fontSize: '10px', padding: '1px 4px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '3px' }}>금액 일치</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className={`badge ${b.status === 'PARTIAL' ? 'badge-warning' : 'badge-info'}`}>
                                {b.status === 'PARTIAL' ? '일부납' : '승인(미납)'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '20px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={learnRule}
                    onChange={e => setLearnRule(e.target.checked)}
                  />
                  <span>
                    향후 <strong>'{selectedTx.senderName}'</strong> 입금자는 매칭된 고객사로 자동 대조 학습형 규칙 추가
                  </span>
                </label>
              </div>

            </div>

            <div style={{ display: 'flex', gap: '10px', padding: '16px 20px', borderTop: '1px solid var(--border-color)', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setSelectedTx(null)}>취소</button>
              <button 
                className="btn-primary" 
                onClick={handleManualMatchSubmit}
                disabled={!matchingBillingId}
              >
                매칭 완료 (수납 확정)
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
