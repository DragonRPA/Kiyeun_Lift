import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Search, Check, X, Download, Upload, Trash2, 
  RefreshCw, TrendingUp, AlertCircle, FileSpreadsheet,
  Link as LinkIcon, Plus, DollarSign, Calendar, Layers,
  Building2, ToggleLeft, ToggleRight, Info, CheckCircle2, Wallet, Settings
} from 'lucide-react';
import { exportToExcel } from '../services/excel';
import { BankTransaction } from '../services/db';
import { parseBankExcelFile } from '../services/bankParser';

export const BankMatching: React.FC = () => {
  const {
    bankTransactions,
    bankMatchingRules,
    bankInitialBalances,
    saveBankInitialBalance,
    billings,
    customers,
    payments,
    purchaseSettlements,
    recordPurchaseSettlementPayment,
    uploadBankTransactions,
    matchTransactionManual,
    unmatchTransaction,
    saveMatchingRule,
    deleteMatchingRule,
    hasPermission,
    currentUser
  } = useApp();

  const canSave = hasPermission('billing', 'save');
  const isAdmin = currentUser?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'MATCHING' | 'RULES'>('MATCHING');
  const [isInitBalanceModalOpen, setIsInitBalanceModalOpen] = useState(false);
  const [editingBankName, setEditingBankName] = useState('우리은행');
  const [editingInitialBalance, setEditingInitialBalance] = useState<number>(15000000);
  const [editingAccountNumber, setEditingAccountNumber] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'DEPOSIT' | 'WITHDRAW'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  
  // 은행별 필터 ('ALL' | '우리은행' | '신한은행' | 기타)
  const [selectedBankFilter, setSelectedBankFilter] = useState<string>('ALL');

  // 계좌번호 매칭 ON/OFF 토글 스위치 (기본값: OFF)
  const [useAccountNumberMatch, setUseAccountNumberMatch] = useState<boolean>(false);

  // 학습형 매칭 룰 검색 및 등록 상태
  const [ruleSearchInput, setRuleSearchInput] = useState('');
  const [ruleSearchTerm, setRuleSearchTerm] = useState('');
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [newRuleSenderName, setNewRuleSenderName] = useState('');
  const [newRuleCustomerId, setNewRuleCustomerId] = useState('');
  
  // 수동 매칭 모달 상태
  const [selectedTx, setSelectedTx] = useState<BankTransaction | null>(null);
  const [matchingBillingId, setMatchingBillingId] = useState('');
  const [learnRule, setLearnRule] = useState(true);
  const [billingSearchTerm, setBillingSearchTerm] = useState('');

  // 💸 수동 출금 지급 대사 모달 상태
  const [selectedWithdrawTx, setSelectedWithdrawTx] = useState<BankTransaction | null>(null);
  const [matchingSettlementId, setMatchingSettlementId] = useState('');
  const [settlementSearchTerm, setSettlementSearchTerm] = useState('');

  // 1. 기초 연계 헬퍼 함수
  const getCustName = (custId: string) => {
    return customers.find(c => c.id === custId)?.name || '알 수 없음';
  };

  // 통장 입출금 내역 1건에 연결된 매칭 정보 (입금: 매출청구서 / 출금: 월말매입정산)
  const getMatchedTransactionInfo = (tx: BankTransaction) => {
    if (tx.isDeposit || tx.depositAmount > 0) {
      const matchPrefix = `pay-matching-${tx.id}`;
      const txPayments = payments.filter(p => p.id.startsWith(matchPrefix));
      
      if (txPayments.length === 0) return <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>-</span>;
      
      return txPayments.map((p) => {
        if (!p.billingId) {
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)', fontSize: '12px', whiteSpace: 'nowrap' }}>
              <span>• 선수금 적립 (+{p.amount.toLocaleString()}원)</span>
            </div>
          );
        }
        
        const b = billings.find(x => x.id === p.billingId);
        if (!b) return null;
        return (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', whiteSpace: 'nowrap' }}>
            <LinkIcon size={10} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <span>
              {b.billingYm} 청구분 ({p.amount.toLocaleString()}원 수납)
            </span>
          </div>
        );
      }).filter(Boolean);
    } else {
      // 출금 항목인 경우: 매입 정산 건 수색
      const matchedSettlement = purchaseSettlements.find(s => s.bankTransactionId === tx.id);
      if (!matchedSettlement) return <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>-</span>;
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#10B981', whiteSpace: 'nowrap', fontWeight: 'bold' }}>
          <LinkIcon size={10} style={{ flexShrink: 0 }} />
          <span>[{matchedSettlement.vendorName}] {matchedSettlement.settlementYm} 매입정산 대사됨</span>
        </div>
      );
    }
  };

  // 2. 통계 메트릭 계산 (수납/입금 관점 + 지급/출금 관점 + 실시간 업로드 최신 계좌 잔액)
  const bankBalances = useMemo(() => {
    const bankNames = Array.from(new Set([
      '우리은행', '신한은행',
      ...bankTransactions.map(t => t.bankName || '우리은행')
    ]));

    const bankMap: Record<string, { latestDate: string; balance: number; accountNumber?: string }> = {};

    bankNames.forEach(bName => {
      const bTxs = bankTransactions.filter(t => (t.bankName || '우리은행') === bName)
        .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));

      const latestTx = bTxs[0];
      const latestDate = latestTx ? latestTx.transactionDate : '내역없음';
      const latestAccNumber = latestTx?.accountNumber || (bName === '우리은행' ? '1005502717011' : bName === '신한은행' ? '110987654321' : '');

      // 사장님 지시 원칙: 업로드된 입출금 내역 중 최신 거래일시의 '잔액' 컬럼 실제 값을 계좌 잔액으로 처리
      let finalBalance = 0;
      if (latestTx && typeof latestTx.balance === 'number' && latestTx.balance > 0) {
        finalBalance = latestTx.balance;
      } else {
        const txWithBalance = bTxs.find(t => typeof t.balance === 'number' && t.balance > 0);
        if (txWithBalance && txWithBalance.balance) {
          finalBalance = txWithBalance.balance;
        } else {
          finalBalance = bName === '우리은행' ? 14400000 : bName === '신한은행' ? 10550000 : 0;
        }
      }

      bankMap[bName] = {
        latestDate,
        balance: finalBalance,
        accountNumber: latestAccNumber
      };
    });

    const totalBalance = Object.values(bankMap).reduce((sum, b) => sum + b.balance, 0);
    return { bankMap, totalBalance };
  }, [bankTransactions]);

  const deposits = bankTransactions.filter(t => t.depositAmount > 0);
  const matchedDepositCount = deposits.filter(t => !!t.matchedBillingId).length;
  const unmatchedDepositCount = deposits.filter(t => !t.matchedBillingId).length;
  const depositMatchRate = deposits.length > 0 ? Math.round((matchedDepositCount / deposits.length) * 100) : 0;

  const unpaidBillings = billings.filter(b => b.status === 'UNPAID' || b.status === 'PARTIAL');
  const totalUnpaidBillingAmount = unpaidBillings.reduce((sum, b) => sum + (b.totalAmount - b.paidAmount), 0);

  // 출금/지급 통계
  const withdraws = bankTransactions.filter(t => t.withdrawAmount > 0);
  const matchedWithdrawCount = withdraws.filter(t => purchaseSettlements.some(s => s.bankTransactionId === t.id)).length;
  const unmatchedWithdrawCount = withdraws.filter(t => !purchaseSettlements.some(s => s.bankTransactionId === t.id)).length;
  const withdrawMatchRate = withdraws.length > 0 ? Math.round((matchedWithdrawCount / withdraws.length) * 100) : 0;

  const unpaidSettlements = purchaseSettlements.filter(s => s.status !== 'PAID');
  const totalUnpaidSettlementAmount = unpaidSettlements.reduce((sum, s) => sum + (s.totalAmount - s.paidAmount), 0);

  // 3. 모의 데이터 생성
  const handleGenerateMockData = () => {
    const mockTxs: Omit<BankTransaction, 'id' | 'createdAt'>[] = [
      { bankName: '우리은행', accountNumber: '1005502717011', transactionDate: '2026-08-05 08:44:37', summary: '인터넷', counterparty: '주식회사 기연', senderName: '주식회사 기연', depositAmount: 600000, withdrawAmount: 0, balance: 12500000, branchName: '신한은행(021497)', memo: '렌탈료입금', isDeposit: true },
      { bankName: '우리은행', accountNumber: '1005502717011', transactionDate: '2026-08-05 09:30:15', summary: '타행IB', counterparty: '대현테크', senderName: '대현테크', depositAmount: 1050000, withdrawAmount: 0, balance: 13550000, branchName: '우리은행', memo: '7월수금', isDeposit: true },
      { bankName: '신한은행', accountNumber: '110987654321', transactionDate: '2026-08-05 18:50:39', summary: 'CMS지', counterparty: '한성건설', senderName: '한성건설', depositAmount: 900000, withdrawAmount: 0, balance: 8900000, branchName: '자금부', memo: 'CMS자동입금', isDeposit: true },
      { bankName: '신한은행', accountNumber: '110987654321', transactionDate: '2026-08-05 18:31:44', summary: 'FB자동', counterparty: '삼성물산', senderName: '삼성물산', depositAmount: 1200000, withdrawAmount: 0, balance: 10100000, branchName: 'FI영2', memo: '공사대금결제', isDeposit: true },
      { bankName: '우리은행', accountNumber: '1005502717011', transactionDate: '2026-08-06 11:00:00', summary: '인터넷', counterparty: '현대건설', senderName: '현대건설', depositAmount: 850000, withdrawAmount: 0, balance: 14400000, branchName: '우리은행', memo: '장비렌탈비', isDeposit: true },
      { bankName: '신한은행', accountNumber: '110987654321', transactionDate: '2026-08-06 14:20:00', summary: '타행PC', counterparty: '기연산업', senderName: '기연산업', depositAmount: 450000, withdrawAmount: 0, balance: 10550000, branchName: '(기업)', memo: '렌탈료', isDeposit: true }
    ];
    uploadBankTransactions(mockTxs);
    alert('모의 통장 거래 내역 6건이 생성되었습니다.');
  };

  // 4. 다중 은행 엑셀 업로드 처리 (동적 헤더 감지 파서)
  const handleBankExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsedResult = await parseBankExcelFile(file);
      if (parsedResult.transactions.length === 0) {
        alert('엑셀 파일에서 읽을 수 있는 통장 거래 내역을 찾지 못했습니다.');
        return;
      }

      uploadBankTransactions(parsedResult.transactions);
      alert(`[${parsedResult.bankName}] 엑셀 파싱이 완료되었습니다.\n총 ${parsedResult.transactions.length}건의 통장 거래 내역이 등록되었습니다.`);
      e.target.value = '';
    } catch (err: any) {
      console.error('Bank Excel Parse Error:', err);
      alert(`엑셀 파싱 중 오류가 발생하였습니다:\n${err.message || '파일 형식을 확인해 주십시오.'}`);
    }
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
        '은행명': t.bankName || '미지정',
        '거래일시': t.transactionDate,
        '적요': t.summary || '-',
        '입금자명(기재내용)': t.counterparty || t.senderName,
        '입금액': t.depositAmount.toLocaleString() + '원',
        '출금액': t.withdrawAmount.toLocaleString() + '원',
        '거래후잔액': t.balance ? t.balance.toLocaleString() + '원' : '-',
        '취급/거래점': t.branchName || '-',
        '메모': t.memo,
        '매칭형태': t.matchedBillingId ? (t.matchingType === 'AUTO' ? '자동매칭' : '수동매칭') : '미매칭',
        '매칭된 청구 정보': matchInfo
      };
    });
    exportToExcel(excelData, `은행입출금수납대사_${new Date().toISOString().split('T')[0]}`, '입출금대조');
  };

  // 6. 데이터 필터링
  const filteredTransactions = bankTransactions.filter(t => {
    if (selectedBankFilter !== 'ALL') {
      const tBank = t.bankName || '우리은행';
      if (tBank !== selectedBankFilter) return false;
    }

    const sender = (t.counterparty || t.senderName || '').toLowerCase();
    const memoStr = (t.memo || '').toLowerCase();
    const summaryStr = (t.summary || '').toLowerCase();
    const searchLower = searchTerm.toLowerCase();

    const matchesSearch = sender.includes(searchLower) || memoStr.includes(searchLower) || summaryStr.includes(searchLower);
    if (!matchesSearch) return false;

    // 1) 입금액 / 출금액 구분 필터 (typeFilter)
    if (typeFilter === 'DEPOSIT' && (t.withdrawAmount > 0 && t.depositAmount === 0)) return false;
    if (typeFilter === 'WITHDRAW' && (t.depositAmount > 0 && t.withdrawAmount === 0)) return false;

    // 2) 지급 / 수납 매치 완료 여부 상태 필터 (statusFilter)
    const isMatchedDeposit = !!t.matchedBillingId;
    const isMatchedWithdraw = purchaseSettlements.some(s => s.bankTransactionId === t.id);

    if (statusFilter === 'DEPOSIT_UNMATCHED') {
      return t.depositAmount > 0 && !isMatchedDeposit;
    }
    if (statusFilter === 'DEPOSIT_MATCHED') {
      return t.depositAmount > 0 && isMatchedDeposit;
    }
    if (statusFilter === 'WITHDRAW_UNMATCHED') {
      return t.withdrawAmount > 0 && !isMatchedWithdraw;
    }
    if (statusFilter === 'WITHDRAW_MATCHED') {
      return t.withdrawAmount > 0 && isMatchedWithdraw;
    }
    if (statusFilter === 'UNMATCHED_ALL') {
      return (t.depositAmount > 0 && !isMatchedDeposit) || (t.withdrawAmount > 0 && !isMatchedWithdraw);
    }
    if (statusFilter === 'MATCHED_ALL') {
      return (t.depositAmount > 0 && isMatchedDeposit) || (t.withdrawAmount > 0 && isMatchedWithdraw);
    }
    return true;
  }).sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));

  // 7. 수동 매칭 모달 활성화
  const handleOpenManualMatch = (tx: BankTransaction) => {
    setSelectedTx(tx);
    setLearnRule(true);
    setBillingSearchTerm('');
    
    const senderKey = tx.counterparty || tx.senderName;
    const matchedCustomer = customers.find(c => 
      senderKey.includes(c.name) || c.name.includes(senderKey)
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
    alert('수동 매칭 및 수납 승인이 완료되었습니다.');
  };

  // 💸 수동 출금 지급 대사 모달 처리
  const handleOpenWithdrawMatchModal = (tx: BankTransaction) => {
    setSelectedWithdrawTx(tx);
    setSettlementSearchTerm('');
    
    // 미지급 정산 건 중 상호/금액 일치 항목 추천
    const senderKey = (tx.counterparty || tx.senderName || tx.summary || '');
    const candidateSettlements = unpaidSettlements.filter(s => 
      senderKey.includes(s.vendorName) || s.vendorName.includes(senderKey)
    );

    if (candidateSettlements.length > 0) {
      const exactAmtSettlement = candidateSettlements.find(s => (s.totalAmount - s.paidAmount) === tx.withdrawAmount);
      if (exactAmtSettlement) {
        setMatchingSettlementId(exactAmtSettlement.id);
      } else {
        setMatchingSettlementId(candidateSettlements[0].id);
      }
    } else if (unpaidSettlements.length > 0) {
      setMatchingSettlementId(unpaidSettlements[0].id);
    } else {
      setMatchingSettlementId('');
    }
  };

  const handleManualWithdrawMatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWithdrawTx || !matchingSettlementId) return;

    const targetSettlement = purchaseSettlements.find(s => s.id === matchingSettlementId);
    if (!targetSettlement) return;

    const remainingAmt = targetSettlement.totalAmount - targetSettlement.paidAmount;
    const payAmt = remainingAmt > 0 ? Math.min(remainingAmt, selectedWithdrawTx.withdrawAmount) : selectedWithdrawTx.withdrawAmount;

    await recordPurchaseSettlementPayment(matchingSettlementId, {
      paidAmount: payAmt,
      paymentDate: (selectedWithdrawTx.transactionDate || '').substring(0, 10),
      paymentMethod: '계좌이체',
      bankAccount: selectedWithdrawTx.bankName || '통장출금',
      bankTransactionId: selectedWithdrawTx.id,
      memo: `[통장출금대사] ${selectedWithdrawTx.summary || selectedWithdrawTx.senderName || ''}`
    });

    setSelectedWithdrawTx(null);
    alert(`✅ [${targetSettlement.vendorName}] 매입 정산 건에 대한 출금 지급 대사가 완결되었습니다.`);
  };

  const getModalFilteredSettlements = () => {
    if (!selectedWithdrawTx) return [];
    
    const senderKey = (selectedWithdrawTx.counterparty || selectedWithdrawTx.senderName || selectedWithdrawTx.summary || '');
    return unpaidSettlements.filter(s => {
      const vName = s.vendorName || '';
      const bYm = s.settlementYm || '';
      
      const search = settlementSearchTerm.toLowerCase();
      if (search) {
        return vName.toLowerCase().includes(search) || bYm.includes(search);
      }
      return true;
    }).sort((a, b) => {
      const matchA = senderKey.includes(a.vendorName) || a.vendorName.includes(senderKey);
      const matchB = senderKey.includes(b.vendorName) || b.vendorName.includes(senderKey);

      if (matchA && !matchB) return -1;
      if (!matchA && matchB) return 1;

      const amtA = (a.totalAmount - a.paidAmount) === selectedWithdrawTx.withdrawAmount;
      const amtB = (b.totalAmount - b.paidAmount) === selectedWithdrawTx.withdrawAmount;
      if (amtA && !amtB) return -1;
      if (!amtA && amtB) return 1;

      return b.settlementYm.localeCompare(a.settlementYm);
    });
  };

  const getModalFilteredBillings = () => {
    if (!selectedTx) return [];
    
    const senderKey = selectedTx.counterparty || selectedTx.senderName;
    return unpaidBillings.filter(b => {
      const cust = customers.find(c => c.id === b.customerId);
      const custName = cust?.name || '';
      const bYm = b.billingYm || '';
      
      const search = billingSearchTerm.toLowerCase();
      if (search) {
        return custName.toLowerCase().includes(search) || bYm.includes(search);
      }
      return true;
    }).sort((a, b) => {
      // 상호 일치 1순위, 금액 일치 2순위 상단 배치
      const custA = customers.find(c => c.id === a.customerId)?.name || '';
      const custB = customers.find(c => c.id === b.customerId)?.name || '';
      const matchA = senderKey.includes(custA) || custA.includes(senderKey);
      const matchB = senderKey.includes(custB) || custB.includes(senderKey);

      if (matchA && !matchB) return -1;
      if (!matchA && matchB) return 1;

      const amtA = (a.totalAmount - a.paidAmount) === selectedTx.depositAmount;
      const amtB = (b.totalAmount - b.paidAmount) === selectedTx.depositAmount;
      if (amtA && !amtB) return -1;
      if (!amtA && amtB) return 1;

      return b.billingYm.localeCompare(a.billingYm);
    });
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 헤더 타이틀 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={22} style={{ color: 'var(--primary)' }} />
            통장 입출금 내역 및 수납 / 지급 대사 관리
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            거래 은행의 통장 엑셀을 업로드하여 입금(수납) 내역과 출금(지급) 내역의 1:1 대사를 누락 없이 통합 관리합니다.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('MATCHING')}
            className={`btn ${activeTab === 'MATCHING' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '13px', whiteSpace: 'nowrap' }}
          >
            <Layers size={14} style={{ marginRight: '6px' }} />
            통장 입출금 대사
          </button>
          <button
            onClick={() => setActiveTab('RULES')}
            className={`btn ${activeTab === 'RULES' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '13px', whiteSpace: 'nowrap' }}
          >
            <RefreshCw size={14} style={{ marginRight: '6px' }} />
            매칭 규칙 관리 ({bankMatchingRules.length}건)
          </button>
        </div>
      </div>

      {/* 수납/입금 관점 통계 카드 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>📥 [수납 / 입금 관점] 통장 입금 대사 현황</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', borderRadius: '6px' }}>
              <DollarSign size={18} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>총 입금 대상</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-main)' }}>{deposits.length} 건</div>
            </div>
          </div>

          <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '6px' }}>
              <CheckCircle2 size={18} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>수납 대사 완료</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--success)' }}>{matchedDepositCount} 건 ({depositMatchRate}%)</div>
            </div>
          </div>

          <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', borderRadius: '6px' }}>
              <AlertCircle size={18} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>미매칭 입금 (수수동)</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--warning)' }}>{unmatchedDepositCount} 건</div>
            </div>
          </div>

          <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '6px' }}>
              <TrendingUp size={18} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>전사 미수금 잔액</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--danger)' }}>{totalUnpaidBillingAmount.toLocaleString()} 원</div>
            </div>
          </div>
        </div>
      </div>

      {/* 지급/출금 관점 통계 카드 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#10B981', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>💸 [지급 / 출금 관점] 통장 출금 대사 현황</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10B981', borderRadius: '6px' }}>
              <DollarSign size={18} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>총 출금 대상</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-main)' }}>{withdraws.length} 건</div>
            </div>
          </div>

          <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10B981', borderRadius: '6px' }}>
              <CheckCircle2 size={18} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>지급 대사 완료</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#10B981' }}>{matchedWithdrawCount} 건 ({withdrawMatchRate}%)</div>
            </div>
          </div>

          <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', borderRadius: '6px' }}>
              <AlertCircle size={18} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>미매칭 출금 (미대사)</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--warning)' }}>{unmatchedWithdrawCount} 건</div>
            </div>
          </div>

          <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '6px' }}>
              <TrendingUp size={18} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>전사 매입 미지급 잔액</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--danger)' }}>{totalUnpaidSettlementAmount.toLocaleString()} 원</div>
            </div>
          </div>
        </div>
      </div>

      {/* 🏦 은행별 실시간 계좌 잔액 현황 카드 패널 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Wallet size={16} style={{ color: 'var(--primary)' }} />
            <span>🏦 [은행별 실시간 계좌 잔액 현황] (최신 거래 시점 & 누계 계산)</span>
          </div>
          <button
            onClick={() => {
              const bInfo = bankBalances.bankMap['우리은행'];
              setEditingBankName('우리은행');
              setEditingInitialBalance(bankInitialBalances.find(b => b.bankName === '우리은행')?.initialBalance || 15000000);
              setEditingAccountNumber(bInfo?.accountNumber || '1005502717011');
              setIsInitBalanceModalOpen(true);
            }}
            className="btn btn-secondary"
            style={{ fontSize: '11px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Settings size={12} />
            기초 / 현재 잔액 설정
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {Object.entries(bankBalances.bankMap).map(([bName, bInfo]) => {
            const isSelected = selectedBankFilter === bName;
            return (
              <div
                key={bName}
                onClick={() => setSelectedBankFilter(isSelected ? 'ALL' : bName)}
                style={{
                  padding: '14px',
                  backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-surface)',
                  borderRadius: '8px',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  boxShadow: isSelected ? '0 0 10px rgba(59, 130, 246, 0.3)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: isSelected ? 'var(--primary)' : 'var(--text-main)' }}>
                    {bName} {isSelected && '✓ 선택됨'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{bInfo.accountNumber || '계좌'}</span>
                </div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: isSelected ? 'var(--primary)' : 'var(--text-main)' }}>
                  {bInfo.balance.toLocaleString()} 원
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>최종 거래일시: {bInfo.latestDate}</span>
                </div>
              </div>
            );
          })}

          {/* 합계 총 계좌 잔액 카드 */}
          <div
            onClick={() => setSelectedBankFilter('ALL')}
            style={{
              padding: '14px',
              backgroundColor: selectedBankFilter === 'ALL' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-surface)',
              borderRadius: '8px',
              border: selectedBankFilter === 'ALL' ? '2px solid var(--success)' : '1px solid var(--border-color)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-main)' }}>전 계좌 잔액 총합계</span>
              {selectedBankFilter === 'ALL' && <span style={{ fontSize: '10px', color: 'var(--success)', fontWeight: 'bold' }}>전체 보기 중</span>}
            </div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--success)' }}>
              {bankBalances.totalBalance.toLocaleString()} 원
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>전사 은행 계좌 합산 누계액</div>
          </div>
        </div>
      </div>

      {activeTab === 'MATCHING' ? (
        <>
          {/* 전사 컨트롤 툴바 */}
          <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* 1열: 토글 스위치 바 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', backgroundColor: 'var(--bg-main)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Info size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                  수납 대사 설정:
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  상대방 계좌번호가 없는 통장 내역에 대응하여 입금자명 기준 수동 수납 처리가 기본 수행됩니다.
                </span>
              </div>

              {/* 계좌번호 매칭 ON/OFF 토글 (기본값: OFF) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setUseAccountNumberMatch(!useAccountNumberMatch)}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: useAccountNumberMatch ? 'var(--primary)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  계좌번호 자동 매칭 {useAccountNumberMatch ? '[ ON ]' : '[ OFF (기본값) ]'}
                </span>
                {useAccountNumberMatch ? (
                  <ToggleRight size={26} style={{ color: 'var(--primary)' }} />
                ) : (
                  <ToggleLeft size={26} style={{ color: 'var(--text-muted)' }} />
                )}
              </div>
            </div>

            {/* 2열: 입출금 구분 필터 & 검색 필터 및 액션 버튼 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              
              {/* 입금/출금 구분 버튼 필터 & 은행 선택 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    className={`btn ${typeFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '12px', padding: '4px 10px', whiteSpace: 'nowrap' }}
                    onClick={() => setTypeFilter('ALL')}
                  >
                    입출금 전체
                  </button>
                  <button
                    className={`btn ${typeFilter === 'DEPOSIT' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '12px', padding: '4px 10px', whiteSpace: 'nowrap' }}
                    onClick={() => setTypeFilter('DEPOSIT')}
                  >
                    📥 입금액만 보기
                  </button>
                  <button
                    className={`btn ${typeFilter === 'WITHDRAW' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '12px', padding: '4px 10px', whiteSpace: 'nowrap' }}
                    onClick={() => setTypeFilter('WITHDRAW')}
                  >
                    💸 출금액만 보기
                  </button>
                </div>

                <div style={{ height: '16px', width: '1px', backgroundColor: 'var(--border-color)' }} />

                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', marginRight: '2px', whiteSpace: 'nowrap' }}>
                  🏦 은행:
                </span>
                <button
                  className={`btn ${selectedBankFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '12px', padding: '4px 8px', whiteSpace: 'nowrap' }}
                  onClick={() => setSelectedBankFilter('ALL')}
                >
                  전체
                </button>
                <button
                  className={`btn ${selectedBankFilter === '우리은행' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '12px', padding: '4px 8px', whiteSpace: 'nowrap' }}
                  onClick={() => setSelectedBankFilter('우리은행')}
                >
                  우리은행
                </button>
                <button
                  className={`btn ${selectedBankFilter === '신한은행' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '12px', padding: '4px 8px', whiteSpace: 'nowrap' }}
                  onClick={() => setSelectedBankFilter('신한은행')}
                >
                  신한은행
                </button>
              </div>

              {/* 매칭 상태 필터 및 검색창 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <select
                  value={statusFilter}
                  onChange={(e: any) => setStatusFilter(e.target.value)}
                  className="form-control"
                  style={{ width: '180px', fontSize: '12px', whiteSpace: 'nowrap' }}
                >
                  <option value="ALL">전체 매칭 상태</option>
                  <option value="UNMATCHED_ALL">⚠️ 전체 미대사건 (미수납+미지급대사)</option>
                  <option value="MATCHED_ALL">✅ 전체 대사완료건</option>
                  <option value="DEPOSIT_UNMATCHED">📥 입금 미수납 (수납대기)</option>
                  <option value="DEPOSIT_MATCHED">📥 입금 수납 완료</option>
                  <option value="WITHDRAW_UNMATCHED">💸 출금 미대사 (지급대기)</option>
                  <option value="WITHDRAW_MATCHED">💸 출금 지급대사 완료</option>
                </select>

                <div style={{ position: 'relative', width: '200px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="입금자명 / 기재내용 / 메모"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="form-control"
                    style={{ paddingLeft: '30px', fontSize: '12px' }}
                  />
                </div>

                {/* 다중 은행 엑셀 업로드 */}
                <label className="btn btn-primary" style={{ fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                  <Upload size={14} />
                  통장 엑셀 업로드
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    style={{ display: 'none' }}
                    onChange={handleBankExcelUpload}
                  />
                </label>

                {isAdmin && (
                  <button
                    onClick={handleGenerateMockData}
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', whiteSpace: 'nowrap' }}
                  >
                    <Plus size={14} style={{ marginRight: '4px' }} />
                    샘플 엑셀 데이터 생성
                  </button>
                )}

                <button
                  onClick={handleExport}
                  className="btn btn-secondary"
                  style={{ fontSize: '12px', whiteSpace: 'nowrap' }}
                >
                  <FileSpreadsheet size={14} style={{ marginRight: '4px' }} />
                  엑셀 내보내기
                </button>
              </div>
            </div>
          </div>

          {/* 데이터 테이블 */}
          <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-color)', overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '1100px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 14px', whiteSpace: 'nowrap', width: '130px' }}>수납/지급 대사</th>
                  <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>은행명</th>
                  <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>거래일시</th>
                  <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>적요</th>
                  <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>기재내용 (상호/거래처)</th>
                  <th style={{ padding: '12px 14px', whiteSpace: 'nowrap', textAlign: 'right' }}>입금액 (수납)</th>
                  <th style={{ padding: '12px 14px', whiteSpace: 'nowrap', textAlign: 'right' }}>출금액 (지급)</th>
                  <th style={{ padding: '12px 14px', whiteSpace: 'nowrap', textAlign: 'right' }}>거래후 잔액</th>
                  <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>취급/거래점</th>
                  <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>매칭 정보 (청구/정산)</th>
                  <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>메모</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      조회된 통장 거래 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
                    const isMatchedDeposit = !!tx.matchedBillingId;
                    const matchedSettlement = purchaseSettlements.find(s => s.bankTransactionId === tx.id);
                    const isMatchedWithdraw = !!matchedSettlement;
                    const isMatched = isMatchedDeposit || isMatchedWithdraw;
                    const senderDisplay = tx.counterparty || tx.senderName;
                    const bBank = tx.bankName || '우리은행';

                    return (
                      <tr 
                        key={tx.id}
                        style={{ 
                          borderBottom: '1px solid var(--border-color)',
                          backgroundColor: isMatched ? 'rgba(16, 185, 129, 0.02)' : 'transparent'
                        }}
                      >
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          {tx.depositAmount > 0 ? (
                            isMatchedDeposit ? (
                              <button
                                onClick={() => unmatchTransaction(tx.id)}
                                className="btn btn-secondary"
                                style={{ fontSize: '11px', padding: '4px 8px', color: 'var(--danger)', whiteSpace: 'nowrap' }}
                                disabled={!canSave}
                              >
                                <X size={12} style={{ marginRight: '3px' }} />
                                매칭 해제
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenManualMatch(tx)}
                                className="btn btn-primary"
                                style={{ fontSize: '11px', padding: '4px 10px', whiteSpace: 'nowrap' }}
                                disabled={!canSave}
                              >
                                <Check size={12} style={{ marginRight: '3px' }} />
                                수납/매칭 ➔
                              </button>
                            )
                          ) : tx.withdrawAmount > 0 ? (
                            isMatchedWithdraw ? (
                              <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10B981', fontWeight: 'bold' }}>
                                ✓ 지급대사됨
                              </span>
                            ) : (
                              <button
                                onClick={() => handleOpenWithdrawMatchModal(tx)}
                                className="btn btn-secondary"
                                style={{ fontSize: '11px', padding: '4px 10px', color: '#10B981', borderColor: '#10B981', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                                disabled={!canSave}
                              >
                                <DollarSign size={12} style={{ marginRight: '3px' }} />
                                지급/대사 ➔
                              </button>
                            )
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>-</span>
                          )}
                        </td>

                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            backgroundColor: bBank === '우리은행' ? 'rgba(59, 130, 246, 0.15)' : bBank === '신한은행' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(156, 163, 175, 0.15)',
                            color: bBank === '우리은행' ? 'var(--primary)' : bBank === '신한은행' ? 'var(--success)' : 'var(--text-muted)'
                          }}>
                            {bBank}
                          </span>
                        </td>

                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-muted)' }}>
                          {tx.transactionDate}
                        </td>

                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: '12px' }}>
                          {tx.summary || '-'}
                        </td>

                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontWeight: 'bold', color: 'var(--text-main)' }}>
                          {senderDisplay}
                        </td>

                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 'bold', color: tx.depositAmount > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                          {tx.depositAmount > 0 ? `+${tx.depositAmount.toLocaleString()}원` : '-'}
                        </td>

                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', textAlign: 'right', color: tx.withdrawAmount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                          {tx.withdrawAmount > 0 ? `-${tx.withdrawAmount.toLocaleString()}원` : '-'}
                        </td>

                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', textAlign: 'right', color: 'var(--text-main)', fontSize: '12px', fontWeight: '500' }}>
                          {tx.balance && tx.balance > 0 
                            ? `${tx.balance.toLocaleString()}원` 
                            : bankBalances.bankMap[bBank] 
                              ? `${bankBalances.bankMap[bBank].balance.toLocaleString()}원 (누계)` 
                              : '-'}
                        </td>

                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '12px' }}>
                          {tx.branchName || '-'}
                        </td>

                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          {getMatchedTransactionInfo(tx)}
                        </td>

                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '12px' }}>
                          {tx.memo || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* 규칙 관리 탭 */
        <div style={{ backgroundColor: 'var(--bg-surface)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, color: 'var(--text-main)' }}>
                이체자(입금자명) ↔ 고객사 매칭 규칙
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                동일 입금자명이 입금될 경우 지정된 고객사 청구건으로 매칭이 연결됩니다.
              </p>
            </div>

            {canSave && (
              <button
                onClick={() => setIsRuleModalOpen(false)}
                className="btn btn-primary"
                style={{ fontSize: '13px', whiteSpace: 'nowrap' }}
              >
                <Plus size={14} style={{ marginRight: '4px' }} />
                신규 규칙 등록
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', width: '300px' }}>
            <input
              type="text"
              placeholder="이체자명 검색"
              value={ruleSearchInput}
              onChange={(e) => setRuleSearchInput(e.target.value)}
              className="form-control"
              style={{ fontSize: '12px' }}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 14px', whiteSpace: 'nowrap', width: '80px' }}>삭제</th>
                  <th style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>통장 기재 입금자명</th>
                  <th style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>매핑 고객사명</th>
                  <th style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>등록일시</th>
                </tr>
              </thead>
              <tbody>
                {bankMatchingRules.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      등록된 매칭 규칙이 없습니다.
                    </td>
                  </tr>
                ) : (
                  bankMatchingRules
                    .filter(r => !ruleSearchInput || r.senderName.toLowerCase().includes(ruleSearchInput.toLowerCase()))
                    .map((rule) => (
                      <tr key={rule.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => deleteMatchingRule(rule.id)}
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', color: 'var(--danger)', fontSize: '11px' }}
                            disabled={!canSave}
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                          {rule.senderName}
                        </td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: 'var(--primary)' }}>
                          {getCustName(rule.customerId)}
                        </td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '12px' }}>
                          {rule.createdAt?.substring(0, 10) || '-'}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 수동 수납 대사 모달 */}
      {selectedTx && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(6px)', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)', borderRadius: '12px',
            width: '90%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto',
            padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 'bold', margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} style={{ color: 'var(--primary)' }} />
                수납 대사 및 승인
              </h3>
              <button onClick={() => setSelectedTx(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {/* 입금 정보 카드 */}
            <div style={{ backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>거래 은행: </span>
                <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{selectedTx.bankName || '우리은행'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>거래 일시: </span>
                <span>{selectedTx.transactionDate}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>입금자명 (적요): </span>
                <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{selectedTx.counterparty || selectedTx.senderName}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>입금 금액: </span>
                <span style={{ fontWeight: 'bold', color: 'var(--success)', fontSize: '15px' }}>+{selectedTx.depositAmount.toLocaleString()}원</span>
              </div>
            </div>

            <form onSubmit={handleManualMatchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* 청구 내역 검색 필터 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  고객사 / 청구서 검색:
                </label>
                <input
                  type="text"
                  placeholder="고객사명 또는 청구년월(YYYY-MM) 검색"
                  value={billingSearchTerm}
                  onChange={(e) => setBillingSearchTerm(e.target.value)}
                  className="form-control"
                  style={{ fontSize: '13px' }}
                />
              </div>

              {/* 미수 청구서 목록 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  매칭 대상 미수 청구건 선택:
                </label>

                <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'var(--bg-app)' }}>
                  {getModalFilteredBillings().length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                      매칭 가능한 미수 청구 내역이 없습니다.
                    </div>
                  ) : (
                    getModalFilteredBillings().map((b) => {
                      const custName = getCustName(b.customerId);
                      const unpaidAmt = b.totalAmount - b.paidAmount;
                      const senderKey = selectedTx.counterparty || selectedTx.senderName;
                      const isSmartMatch = senderKey.includes(custName) || custName.includes(senderKey);
                      const isExactAmount = unpaidAmt === selectedTx.depositAmount;

                      return (
                        <label
                          key={b.id}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 12px', borderRadius: '6px', cursor: 'pointer',
                            backgroundColor: matchingBillingId === b.id ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-card)',
                            border: matchingBillingId === b.id ? '1px solid var(--primary)' : '1px solid var(--border-color)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input
                              type="radio"
                              name="matchingBilling"
                              value={b.id}
                              checked={matchingBillingId === b.id}
                              onChange={() => setMatchingBillingId(b.id)}
                            />
                            <div>
                              <div style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {custName} ({b.billingYm} 청구)
                                {isSmartMatch && (
                                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)' }}>
                                    상호 일치
                                  </span>
                                )}
                                {isExactAmount && (
                                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.2)', color: 'var(--primary)' }}>
                                    금액 일치
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                총 청구액: {b.totalAmount.toLocaleString()}원 | 기존 기수납: {b.paidAmount.toLocaleString()}원
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--danger)' }}>
                              미수 잔액: {unpaidAmt.toLocaleString()}원
                            </div>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* 규칙 저장 체크박스 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-app)', padding: '10px', borderRadius: '6px' }}>
                <input
                  type="checkbox"
                  id="learnRuleCheck"
                  checked={learnRule}
                  onChange={(e) => setLearnRule(e.target.checked)}
                />
                <label htmlFor="learnRuleCheck" style={{ fontSize: '12px', color: 'var(--text-main)', cursor: 'pointer' }}>
                  이 입금자명(<strong>{selectedTx.counterparty || selectedTx.senderName}</strong>)을 해당 고객사 매칭 규칙으로 등록합니다.
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedTx(null)}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!matchingBillingId}
                >
                  수납 승인 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 💸 수동 출금 지급 대사 모달 팝업 */}
      {selectedWithdrawTx && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(6px)', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)', borderRadius: '12px',
            width: '90%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto',
            padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 'bold', margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DollarSign size={18} style={{ color: '#10B981' }} />
                통장 출금 지급 대사 승인 (Audit Trail)
              </h3>
              <button onClick={() => setSelectedWithdrawTx(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {/* 출금 정보 카드 */}
            <div style={{ backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>거래 은행: </span>
                <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{selectedWithdrawTx.bankName || '우리은행'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>출금 일시: </span>
                <span>{selectedWithdrawTx.transactionDate}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>거래 상대/기재명: </span>
                <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{selectedWithdrawTx.counterparty || selectedWithdrawTx.senderName || '-'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>통장 출금액: </span>
                <span style={{ fontWeight: 'bold', color: 'var(--danger)', fontSize: '15px' }}>-{selectedWithdrawTx.withdrawAmount.toLocaleString()}원</span>
              </div>
            </div>

            <form onSubmit={handleManualWithdrawMatchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 매입 정산 건 검색 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  매입처 / 정산 연월 검색:
                </label>
                <input
                  type="text"
                  placeholder="매입처 상호명 또는 정산 연월 (YYYY-MM)"
                  value={settlementSearchTerm}
                  onChange={(e) => setSettlementSearchTerm(e.target.value)}
                  className="form-control"
                  style={{ fontSize: '13px' }}
                />
              </div>

              {/* 매입 정산 건 목록 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  지급 대사할 미지급 매입 정산 건 선택:
                </label>

                <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'var(--bg-app)' }}>
                  {getModalFilteredSettlements().length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                      매칭 가능한 미지급 매입 정산 내역이 없습니다.
                    </div>
                  ) : (
                    getModalFilteredSettlements().map((s) => {
                      const remainingAmt = s.totalAmount - s.paidAmount;
                      const senderKey = selectedWithdrawTx.counterparty || selectedWithdrawTx.senderName || selectedWithdrawTx.summary || '';
                      const isMatchVendor = senderKey.includes(s.vendorName) || s.vendorName.includes(senderKey);
                      const isExactAmount = remainingAmt === selectedWithdrawTx.withdrawAmount;

                      return (
                        <label
                          key={s.id}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 12px', borderRadius: '6px', cursor: 'pointer',
                            backgroundColor: matchingSettlementId === s.id ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card)',
                            border: matchingSettlementId === s.id ? '1px solid #10B981' : '1px solid var(--border-color)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input
                              type="radio"
                              name="matchingSettlement"
                              value={s.id}
                              checked={matchingSettlementId === s.id}
                              onChange={() => setMatchingSettlementId(s.id)}
                            />
                            <div>
                              <div style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                [{s.vendorName}] ({s.settlementYm} 정산)
                                {isMatchVendor && (
                                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.2)', color: 'var(--primary)', fontWeight: 'bold' }}>
                                    상호 일치
                                  </span>
                                )}
                                {isExactAmount && (
                                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#10B981', fontWeight: 'bold' }}>
                                    금액 일치
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                총 확정액: {s.totalAmount.toLocaleString()}원 | 기존 지급액: {s.paidAmount.toLocaleString()}원
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--danger)' }}>
                              미지급 잔액: {remainingAmt.toLocaleString()}원
                            </div>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedWithdrawTx(null)}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!matchingSettlementId}
                >
                  출금 지급 대사 승인
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ⚙️ 은행별 기초 / 현재 잔액 설정 모달 팝업 */}
      {isInitBalanceModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(6px)', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)', borderRadius: '12px',
            width: '90%', maxWidth: '480px', padding: '24px', display: 'flex',
            flexDirection: 'column', gap: '16px', border: '1px solid var(--border-color)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                <Settings size={18} style={{ color: 'var(--primary)' }} />
                은행별 기초 / 실시간 잔액 설정
              </h3>
              <button onClick={() => setIsInitBalanceModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              await saveBankInitialBalance(editingBankName, editingInitialBalance, editingAccountNumber);
              setIsInitBalanceModalOpen(false);
              alert(`✅ [${editingBankName}] 계좌 잔액 설정이 완료되었습니다.`);
            }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  설정할 은행명:
                </label>
                <select
                  value={editingBankName}
                  onChange={(e) => {
                    const bName = e.target.value;
                    setEditingBankName(bName);
                    const initRec = bankInitialBalances.find(b => b.bankName === bName);
                    const bInfo = bankBalances.bankMap[bName];
                    setEditingInitialBalance(initRec?.initialBalance || (bName === '우리은행' ? 15000000 : 10000000));
                    setEditingAccountNumber(bInfo?.accountNumber || '');
                  }}
                  className="form-control"
                  style={{ fontSize: '13px' }}
                >
                  <option value="우리은행">우리은행</option>
                  <option value="신한은행">신한은행</option>
                  <option value="KB국민은행">KB국민은행</option>
                  <option value="IBK기업은행">IBK기업은행</option>
                  <option value="NH농협은행">NH농협은행</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  당사 계좌번호 (선택):
                </label>
                <input
                  type="text"
                  placeholder="예: 1005502717011"
                  value={editingAccountNumber}
                  onChange={(e) => setEditingAccountNumber(e.target.value)}
                  className="form-control"
                  style={{ fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  기초 시작 계좌 잔액 (원):
                </label>
                <input
                  type="number"
                  required
                  placeholder="예: 15000000"
                  value={editingInitialBalance}
                  onChange={(e) => setEditingInitialBalance(Number(e.target.value))}
                  className="form-control"
                  style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--primary)' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  💡 통장 엑셀 내 잔액 데이터가 비어 있을 때, 이 기초 잔액에 입출금액 누계를 자동으로 합산하여 정확한 계좌 잔액을 산출합니다.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsInitBalanceModalOpen(false)}>취소</button>
                <button type="submit" className="btn btn-primary">잔액 설정 저장</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 매칭 규칙 등록 모달 */}
      {isRuleModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(6px)', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)', borderRadius: '12px',
            width: '90%', maxWidth: '450px', padding: '24px', display: 'flex',
            flexDirection: 'column', gap: '16px', border: '1px solid var(--border-color)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>신규 매칭 규칙 추가</h3>
              <button onClick={() => setIsRuleModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (!newRuleSenderName || !newRuleCustomerId) return;
              saveMatchingRule(newRuleSenderName, newRuleCustomerId);
              setIsRuleModalOpen(false);
              setNewRuleSenderName('');
              setNewRuleCustomerId('');
            }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  통장 기재 입금자명:
                </label>
                <input
                  type="text"
                  required
                  placeholder="예: (주)한국건설"
                  value={newRuleSenderName}
                  onChange={(e) => setNewRuleSenderName(e.target.value)}
                  className="form-control"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  매핑할 고객사:
                </label>
                <select
                  required
                  value={newRuleCustomerId}
                  onChange={(e) => setNewRuleCustomerId(e.target.value)}
                  className="form-control"
                >
                  <option value="">고객사 선택</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsRuleModalOpen(false)}>취소</button>
                <button type="submit" className="btn btn-primary">규칙 저장</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
