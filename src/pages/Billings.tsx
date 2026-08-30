// @ts-nocheck
// d:\Kiyeun_Lift\src\pages\Billings.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { db, Asset, Billing, BillingDetail, ContractHistory, normalizeEndDate } from '../services/db';
import { Plus, Download, Mail, CheckCircle, Search, DollarSign, Calendar, FileText, Send, Edit3, RotateCcw, AlertTriangle, Check } from 'lucide-react';
import { emailService } from '../services/email';
import { exportToExcel, exportTransactionStatementExcel, exportTransactionStatementExcelBuffer, calcServicePeriod } from '../services/excel';

export const Billings: React.FC = () => {
  const {
    billings, billingDetails, customers, contacts, contracts, contractAssets, assets, sites, users, googleConfigs,
    generateBillingsForMonth, getDueContractsForBilling, generateDueBillings, regenerateBilling, generateBillingForSingleContract,
    receivePayment, cancelPayment, hasPermission, currentUser, approveBilling, cancelBilling,
    refreshAllData, showErrorModal, bankTransactions, paymentDepositLinks, payments,
    repairs, linkRepairToBilling, applyPrepaidBalanceForBilling,
    receivables, linkReceivableToBilling
  } = useApp();


  const canSave = hasPermission('billing', 'save');
  const isAdmin = currentUser?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'LIST' | 'GENERATE' | 'WIZARD'>('LIST');

  // --- 청구 조회 필터 상태 ---
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempContractNoFilter, setTempContractNoFilter] = useState('');
  const [tempStartBillingYmFilter, setTempStartBillingYmFilter] = useState('');
  const [tempEndBillingYmFilter, setTempEndBillingYmFilter] = useState('');
  const [tempPaymentFilter, setTempPaymentFilter] = useState<'ALL' | 'PAID' | 'UNPAID_ANY'>('ALL');
  const [tempMailSentFilter, setTempMailSentFilter] = useState<'ALL' | 'SENT' | 'UNSENT'>('ALL');

  const [searchTerm, setSearchTerm] = useState('');
  const [contractNoFilter, setContractNoFilter] = useState('');
  const [startBillingYmFilter, setStartBillingYmFilter] = useState('');
  const [endBillingYmFilter, setEndBillingYmFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'PAID' | 'UNPAID_ANY'>('ALL');
  const [mailSentFilter, setMailSentFilter] = useState<'ALL' | 'SENT' | 'UNSENT'>('ALL');

  // --- 청구 마법사 상태 ---
  const [wizardSearchStartDate, setWizardSearchStartDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  });
  const [wizardSearchEndDate, setWizardSearchEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // 마법사 고객, 계약번호, 현장명 필터 상태
  const [wizardTempCustomerFilter, setWizardTempCustomerFilter] = useState('');
  const [wizardTempContractNoFilter, setWizardTempContractNoFilter] = useState('');
  const [wizardTempSiteFilter, setWizardTempSiteFilter] = useState('');

  const [wizardCustomerFilter, setWizardCustomerFilter] = useState('');
  const [wizardContractNoFilter, setWizardContractNoFilter] = useState('');
  const [wizardSiteFilter, setWizardSiteFilter] = useState('');

  const [selectedContractIdForWizard, setSelectedContractIdForWizard] = useState<string | null>(null);
  const [wizardStartDate, setWizardStartDate] = useState('');
  const [wizardEndDate, setWizardEndDate] = useState('');
  const [calcMethod, setCalcMethod] = useState<'MONTHLY' | 'PRORATED'>('MONTHLY');
  const [extraCharges, setExtraCharges] = useState<{ id: string; category: string; customName: string; quantity: number; unitPrice: number }[]>([]);

  // 마법사 청구귀속월 & 청구발행일자 수동 지정 상태 (기본값: 생성 연월/오늘)
  const [wizardBillingYm, setWizardBillingYm] = useState(() => new Date().toISOString().slice(0, 7));
  const [wizardBillingDate, setWizardBillingDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  // 마법사 연동 수리비 ID 목록
  
  // 마법사 연동 미수금 목록
  const [selectedReceivablesForWizard, setSelectedReceivablesForWizard] = useState<{ receivableId: string; amount: number; displayName: string }[]>([]);

  // 청구 생성 입력
  const [billingYm, setBillingYm] = useState(() => new Date().toISOString().slice(0, 7));
  const [billingDate, setBillingDate] = useState(() => new Date().toISOString().split('T')[0]);

  // 청구귀속월 수동 변경 핸들러
  const handleEditBillingYm = async (billingId: string, currentYmVal: string) => {
    const newYm = prompt('✏️ 변경할 청구귀속월을 입력해 주세요 (형식: YYYY-MM, 예: 2026-08):', currentYmVal);
    if (!newYm || !newYm.trim() || newYm.trim() === currentYmVal) return;
    
    if (!/^\d{4}-\d{2}$/.test(newYm.trim())) {
      alert('⚠️ 입력 형식이 올바르지 않습니다. YYYY-MM (예: 2026-07) 형식으로 입력해 주세요.');
      return;
    }

    try {
      db.updateRow<Billing>('billings', billingId, {
        billingYm: newYm.trim(),
        updatedAt: new Date().toISOString()
      });
      refreshAllData();
      await db.awaitPendingWrites();
      alert(`✅ 청구귀속월이 [${newYm.trim()}]으로 성공적으로 변경되었습니다.`);
    } catch (err: any) {
      showErrorModal(`⚠️ 청구귀속월 변경 중 DB 저장 실패:\n\n${err?.message || err}`, '청구월 수정 오류');
    }
  };

  // 선택된 청구서 상세
  const [selectedBillingId, setSelectedBillingId] = useState<string | null>(null);

  // 수납 입력 모달
  const [showPayModal, setShowPayModal] = useState(false);
  const [payBillingId, setPayBillingId] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payMethod, setPayMethod] = useState('BANK_TRANSFER');
  const [payMemo, setPayMemo] = useState('');
  // v2: 다중 입금건 선택 상태 { txId → usedAmount } + 선수금(예치금) 상계 모드
  const [payMode, setPayMode] = useState<'DEPOSIT' | 'DIRECT' | 'PREPAID'>('DEPOSIT');
  const [depositLinkDraft, setDepositLinkDraft] = useState<Record<string, number>>({}); // txId -> usedAmount
  const [directAmount, setDirectAmount] = useState(0); // 직접입력 모드 금액
  const [prepaidAmount, setPrepaidAmount] = useState(0); // 선수금 상계 모드 금액
  // 마법사 연동 수리비 ID 목록
  const [selectedRepairIdsForWizard, setSelectedRepairIdsForWizard] = useState<string[]>([]);
  // 통합 검색 필터 (고객명/입금자명/계좌번호/비고)
  const [depSearchQuery, setDepSearchQuery] = useState(''); // 통합 검색어


  // 메일 전송 모달 (거래명세서 메일 발송)
  const [showMailModal, setShowMailModal] = useState(false);
  const [mailBillingId, setMailBillingId] = useState('');
  const [mailTo, setMailTo] = useState(''); // 수신인 (기본값 자동입력 & 수동 수정/추가 지정 가능)
  const [mailCc, setMailCc] = useState(''); // 참조인 (CC 추가 지정 가능)
  const [mailSubject, setMailSubject] = useState(''); // 메일 제목
  const [isSending, setIsSending] = useState(false);


  const getCustName = (id: string) => customers.find(c => c.id === id)?.name || '-';

  // 고유 청구월 목록 추출
  const billingMonths = Array.from(new Set(billings.map(b => b.billingYm))).sort().reverse();

  const handleSearchClick = () => {
    setSearchTerm(tempSearchTerm);
    setContractNoFilter(tempContractNoFilter);
    setStartBillingYmFilter(tempStartBillingYmFilter);
    setEndBillingYmFilter(tempEndBillingYmFilter);
    setPaymentFilter(tempPaymentFilter);
    setMailSentFilter(tempMailSentFilter);
  };

  const handleResetFilters = () => {
    setTempSearchTerm('');
    setTempContractNoFilter('');
    setTempStartBillingYmFilter('');
    setTempEndBillingYmFilter('');
    setTempPaymentFilter('ALL');
    setTempMailSentFilter('ALL');

    setSearchTerm('');
    setContractNoFilter('');
    setStartBillingYmFilter('');
    setEndBillingYmFilter('');
    setPaymentFilter('ALL');
    setMailSentFilter('ALL');
  };

  const filteredBillings = billings.filter(b => {
    const custName = getCustName(b.customerId).toLowerCase();
    const contractObj = contracts.find(c => c.id === b.contractId);
    const contractNoStr = (contractObj?.contractNo || b.contractId || '').toLowerCase();

    // 1. 고객사명 검색
    if (searchTerm && !custName.includes(searchTerm.toLowerCase())) return false;
    // 2. 계약번호 검색
    if (contractNoFilter && !contractNoStr.includes(contractNoFilter.trim().toLowerCase())) return false;
    // 3. 청구 시작월 ~ 종료월 범위 (YYYY-MM)
    if (startBillingYmFilter && b.billingYm < startBillingYmFilter) return false;
    if (endBillingYmFilter && b.billingYm > endBillingYmFilter) return false;

    // 4. 수납 상태 필터 (완료: PAID 또는 미납액 0 이하 / 미완료: PAID가 아니거나 미납액 > 0)
    const unpaid = (b.totalAmount || 0) - (b.paidAmount || 0);
    const isPaid = b.status === 'PAID' || unpaid <= 0;
    if (paymentFilter === 'PAID' && !isPaid) return false;
    if (paymentFilter === 'UNPAID_ANY' && isPaid) return false;

    // 5. 청구서메일 발송 여부 필터 (발송: UNPAID가 아닌 상태 즉 REQUESTED/PARTIAL/PAID 등 / 미발송: UNPAID)
    const isMailSent = b.status !== 'UNPAID';
    if (mailSentFilter === 'SENT' && !isMailSent) return false;
    if (mailSentFilter === 'UNSENT' && isMailSent) return false;

    return true;
  });

  const handleExportExcel = () => {
    const excelData = filteredBillings.map((b, idx) => {
      const unpaid = b.totalAmount - b.paidAmount;
      return {
        'No': idx + 1,
        '청구월': b.billingYm,
        '고객사': getCustName(b.customerId),
        '청구 일자': b.billingDate || '-',
        '청구 금액': `${b.totalAmount.toLocaleString()}원`,
        '수납 금액': `${b.paidAmount.toLocaleString()}원`,
        '미납 금액': `${unpaid.toLocaleString()}원`,
        '결제 상태': b.status === 'UNPAID'     ? '미발송' :
                   b.status === 'REQUESTED' ? '발송완료(미납)' :
                   b.status === 'REJECTED'  ? '이의제기(취소)' :
                   b.status === 'PAID'      ? '완납' :
                   b.status === 'PARTIAL'   ? '일부납' : b.status,
        '수납 최종일': b.status === 'PAID' ? b.updatedAt.split('T')[0] : '-',
        '등록일': b.createdAt ? b.createdAt.split('T')[0] : '-'
      };
    });

    exportToExcel(excelData, `청구수납대장_${new Date().toISOString().split('T')[0]}`, '청구목록');
  };

  const activeBilling = billings.find(b => b.id === selectedBillingId);
  const activeBillingDetails = selectedBillingId 
    ? [...billingDetails.filter(bd => bd.billingId === selectedBillingId)].sort((a, b) => {
        const aIsRental = (a.contractAssetId || a.itemName?.includes('렌탈료')) ? 0 : 1;
        const bIsRental = (b.contractAssetId || b.itemName?.includes('렌탈료')) ? 0 : 1;
        return aIsRental - bIsRental;
      })
    : [];

  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    
    // 청구 생성 호출
    generateBillingsForMonth(billingYm, billingDate);
    
    alert(`${billingYm} 마감일 기준 청구 데이터가 성공적으로 생성되었습니다.`);
    setActiveTab('LIST');
  };

  // 도래 계약 청구 일괄 생성 상태 & 핸들러
  const [isGeneratingDue, setIsGeneratingDue] = useState(false);
  const [skippedContracts, setSkippedContracts] = useState<{ contractId: string; customerId: string; reason: string }[]>([]);

  const handleGenerateDue = async () => {
    if (isGeneratingDue) return;
    setIsGeneratingDue(true);
    try {
      const result = await generateDueBillings();
      setSkippedContracts(result.skippedContracts || []);

      if (result.successCount > 0) {
        alert(`✅ ${result.successCount}건의 도래 계약 기본 청구서가 성공적으로 생성되었습니다.`);
      } else if (result.skippedContracts.length === 0) {
        alert('생성할 도래 계약이 없거나 이미 모두 생성되었습니다.');
      }

      if (result.skippedContracts.length > 0) {
        alert(`⚠️ 외상미수금 존재 등으로 인해 ${result.skippedContracts.length}건의 청구가 보류(SKIP)되었습니다.\n상단의 [일괄 청구 보류 대시보드]를 확인하여 단건 처리하세요.`);
      }
    } catch (err: any) {
      showErrorModal(`⚠️ 일괄 생성 오류:\n\n${err?.message || err}`, '도래 계약 청구 생성 실패');
    } finally {
      setIsGeneratingDue(false);
    }
  };

  // 청구 수정 재생성 모달 상태 & 핸들러
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [regenBillingId, setRegenBillingId] = useState('');
  const [regenBillingYm, setRegenBillingYm] = useState('');
  const [regenBillingDate, setRegenBillingDate] = useState('');
  const [regenMemo, setRegenMemo] = useState('');
  const [regenDetails, setRegenDetails] = useState<Omit<BillingDetail, 'id' | 'billingId' | 'createdAt'>[]>([]);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleOpenRegenerate = (billingId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const targetB = billings.find(b => b.id === billingId);
    if (!targetB) return;
    const targetDetails = billingDetails.filter(bd => bd.billingId === billingId);
    setRegenBillingId(billingId);
    setRegenBillingYm(targetB.billingYm);
    setRegenBillingDate(targetB.billingDate || new Date().toISOString().split('T')[0]);
    setRegenMemo('담당자 검토 후 단가/항목 수정 재생성');
    setRegenDetails(targetDetails.map(td => ({
      contractAssetId: td.contractAssetId,
      itemName: td.itemName,
      quantity: td.quantity || 1,
      unitPrice: td.unitPrice || 0,
      amount: td.amount || ((td.quantity || 1) * (td.unitPrice || 0)),
      description: td.description || ''
    })));
    setShowRegenerateModal(true);
  };

  const handleRegenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regenBillingId || regenDetails.length === 0) return;
    setIsRegenerating(true);
    try {
      const newId = await regenerateBilling(regenBillingId, regenDetails, {
        billingYm: regenBillingYm,
        billingDate: regenBillingDate,
        memo: regenMemo
      });
      setShowRegenerateModal(false);
      setSelectedBillingId(newId);
      alert('✅ 수정사항이 반영되어 새 청구서가 발행되었습니다. (기존 건은 취소 마감)');
    } catch (err: any) {
      showErrorModal(`⚠️ 청구서 수정 재생성 실패:\n\n${err?.message || err}`, '재생성 오류');
    } finally {
      setIsRegenerating(false);
    }
  };

  // 거래명세서 발송: UNPAID → REQUESTED (F-2 원칙)
  const handleApprove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    approveBilling(id);
  };

  // 청구 취소: 환불/비환불 2-path (J-2 원칙)
  const handleCancel = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const billing = billings.find(b => b.id === id);
    const hasPaid = billing && billing.paidAmount > 0;

    if (!confirm('이 청구를 취소하시겠습니까?\n취소된 청구서는 REJECTED 상태로 이력이 보존됩니다.')) return;

    if (hasPaid) {
      const refund = confirm(
        `수납 금액(${billing.paidAmount.toLocaleString()}원)이 있습니다.\n\n` +
        `[확인] 환불 처리 — 수납 취소 + 입금잔액 소멸\n` +
        `[취소] 비환불 처리 — 청구만 취소, 입금잔액 잔류`
      );
      cancelBilling(id, refund);
    } else {
      cancelBilling(id, false);
    }
  };

  // v2: 미납액 기준으로 입금잔액 자동 할당
  const getDepositBalance = (txId: string) => {
    const tx = bankTransactions.find(t => t.id === txId);
    const used = paymentDepositLinks
      .filter(l => l.bankTransactionId === txId)
      .reduce((s, l) => s + l.usedAmount, 0);
    return (tx?.depositAmount || 0) - used;
  };

  const handleOpenPay = (bId: string, unpaidAmount: number) => {
    const billing = billings.find(b => b.id === bId);
    const custId = billing?.customerId;
    const custName = customers.find(c => c.id === custId)?.name || '';

    // 검색어 초기값: 고객명 → 고객명으로 매핑된 입금내역 자동 표시
    setDepSearchQuery(custName);
    setPayBillingId(bId);
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayMethod('BANK_TRANSFER');
    setPayMemo('');
    setPayMode('DEPOSIT');
    setDirectAmount(unpaidAmount);

    // 고객명 기준 검색 및 등록 계좌 일치 건 매핑 후 오래된 것부터 자동 할당
    const targetCust = customers.find(c => c.id === custId);
    const regAccounts = targetCust?.bankAccounts || [];
    const query = custName.trim().toLowerCase();

    const matchedDeposits = bankTransactions
      .filter(t => {
        if (!t.isDeposit) return false;

        // 1) 고객사 등록 계좌번호와 일치 여부 검화
        const senderAccNorm = (t.senderAccount || '').replace(/[^0-9]/g, '');
        const isRegAccMatch = senderAccNorm && regAccounts.some(a => {
          const norm = a.accountNumber.replace(/[^0-9]/g, '');
          return norm && (norm === senderAccNorm || senderAccNorm.includes(norm) || norm.includes(senderAccNorm));
        });
        if (isRegAccMatch) return true;

        // 2) 고객명, 입금자명, 계좌번호, 비고 검색어 기준
        const mappedCustName = customers.find(c => c.id === t.customerId)?.name || '';
        return (
          (query && t.senderName.toLowerCase().includes(query)) ||
          (query && mappedCustName.toLowerCase().includes(query)) ||
          (query && (t.senderAccount || '').toLowerCase().includes(query)) ||
          (query && (t.memo || '').toLowerCase().includes(query))
        );
      })
      .map(t => ({ ...t, balance: getDepositBalance(t.id) }))
      .filter(t => t.balance > 0)
      .sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));


    const draft: Record<string, number> = {};
    let remaining = unpaidAmount;
    for (const dep of matchedDeposits) {
      if (remaining <= 0) break;
      const use = Math.min(dep.balance, remaining);
      draft[dep.id] = use;
      remaining -= use;
    }
    setDepositLinkDraft(draft);
    setShowPayModal(true);
  };


  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !payBillingId) return;

    if (payMode === 'PREPAID') {
      if (prepaidAmount <= 0) {
        showErrorModal('상계할 선수금 금액을 입력해 주십시오.', '수납 오류');
        return;
      }
      try {
        await applyPrepaidBalanceForBilling(payBillingId, prepaidAmount, payMemo);
        alert('선수금(예치금) 상계 수납 처리가 완료되었습니다.');
        setShowPayModal(false);
        setPayBillingId('');
      } catch (err: any) {
        // applyPrepaidBalanceForBilling 내부에서 showErrorModal 호출됨
      }
      return;
    }

    if (payMode === 'DEPOSIT') {
      const links = Object.entries(depositLinkDraft)
        .filter(([, amt]) => amt > 0)
        .map(([txId, amt]) => ({ bankTransactionId: txId, usedAmount: amt }));

      if (links.length === 0) {
        showErrorModal('수납할 입금건을 선택하고 금액을 입력하세요.', '수납 오류');
        return;
      }

      // 각 입금건 잔액 초과 검증
      for (const link of links) {
        const bal = getDepositBalance(link.bankTransactionId);
        if (link.usedAmount > bal) {
          const tx = bankTransactions.find(t => t.id === link.bankTransactionId);
          showErrorModal(
            `[${tx?.senderName}] 입금잔액 부족\n잔액: ${bal.toLocaleString()}원 / 입력 금액: ${link.usedAmount.toLocaleString()}원`,
            '수납 오류'
          );
          return;
        }
      }

      const totalAmount = links.reduce((s, l) => s + l.usedAmount, 0);
      receivePayment(payBillingId, {
        paymentDate: payDate,
        amount: totalAmount,
        method: 'BANK_TRANSFER',
        memo: payMemo || `통장입금 연동 ${links.length}건 합산`,
        depositLinks: links
      });
    } else {
      if (directAmount <= 0) return;
      receivePayment(payBillingId, {
        paymentDate: payDate,
        amount: directAmount,
        method: payMethod,
        memo: payMemo
      });
    }

    alert('수납 등록 처리가 완료되었습니다.');
    setShowPayModal(false);
    setPayBillingId('');
  };

  const handleOpenMail = (billingId: string) => {
    setMailBillingId(billingId);
    const billing = billings.find(b => b.id === billingId);
    if (!billing) return;

    const customer = customers.find(c => c.id === billing.customerId);
    
    // 💡 수신인 후보군 자동 추출 (고객사 대표 이메일 + 해당 고객사 담당자 이메일 목록)
    const emails: string[] = [];
    if (customer?.repEmail && customer.repEmail !== '미상') {
      emails.push(customer.repEmail.trim());
    }

    const custContacts = contacts.filter(cc => cc.customerId === billing.customerId && cc.email && cc.email !== '미상' && cc.isActive !== false);
    custContacts.forEach(cc => {
      if (!emails.includes(cc.email.trim())) {
        emails.push(cc.email.trim());
      }
    });

    setMailTo(emails.join(', '));
    setMailCc('');
    setMailSubject(`[(주)기연엘리베이터] ${getCustName(billing.customerId)} ${billing.billingYm} 거래명세서 및 청구서 안내`);
    setShowMailModal(true);
  };

  // 거래명세서 PDF 직접 생성 (시스템 Excel→PDF 변환)
  const printStatementAsPdf = async () => {
    const billing = billings.find(b => b.id === mailBillingId);
    const details = billingDetails.filter(d => d.billingId === mailBillingId);
    const customer = customers.find(c => c.id === billing?.customerId);
    const contract = contracts.find(c => c.id === billing?.contractId);
    const site = sites.find(s => s.id === contract?.siteId);
    const salesperson = users.find((u: any) => u.id === contract?.salespersonId);
    const templateUrl = undefined /* CF R2 마스터 xlsx로 대체됨 */;
    const custName = customer?.name || '고객사';
    const sName = site?.name || '현장';
    const ym = billing?.billingYm || '';

    try {
      showErrorModal('브라우저 렌더러가 폐기되었습니다. 향후 거래명세서도 정품 엑셀(로컬 에이전트) 기반으로 일괄 개편될 예정입니다.');
    } catch (err: any) {
      showErrorModal('PDF 생성 실패: ' + (err?.message || String(err)));
    }
  };

  const handleSendStatementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mailTo) {
      alert('수신인 메일을 지정해 주세요.');
      return;
    }

    const config = googleConfigs[0];
    const isDev = config?.isDevMode !== false;
    if (isDev) {
      const confirmSend = window.confirm(
        "현재 시스템이 개발 모드입니다. 메일은 실제 수신인이 아닌 개발용 주소(77.victor.lee@gmail.com)로 우회되어 안전하게 발송됩니다. 발송하시겠습니까?"
      );
      if (!confirmSend) return;
    }

    setIsSending(true);
    const billing = billings.find(b => b.id === mailBillingId);
    const details = billingDetails.filter(d => d.billingId === mailBillingId);
    const customer = customers.find(c => c.id === billing?.customerId);
    const contract = contracts.find(c => c.id === billing?.contractId);
    const site = sites.find(s => s.id === contract?.siteId);
    const salesperson = users.find((u: any) => u.id === contract?.salespersonId);
    const templateUrl = undefined /* CF R2 마스터 xlsx로 대체됨 */;

    const details_supply = details.reduce((sum, d) => sum + (d.unitPrice || 0) * (d.quantity || 1), 0);
    const details_vat = Math.round(details_supply * 0.1);

    const spName = salesperson?.name || (contract as any)?.salespersonName || '-';
    const spPhone = (salesperson as any)?.mobile || salesperson?.phone || '-';
    const siteManagerName = (site as any)?.managerName || (site as any)?.contactPerson || (customer as any)?.managerName || (customer as any)?.contactPerson || '-';
    const siteManagerPhone = (site as any)?.managerPhone || (site as any)?.contactPhone || (customer as any)?.phone || (customer as any)?.contactPhone || '-';
    const billingManagerName = (customer as any)?.billingManagerName || (customer as any)?.managerName || (customer as any)?.contactPerson || '-';
    const billingManagerPhone = (customer as any)?.billingManagerPhone || (customer as any)?.phone || (customer as any)?.contactPhone || '-';
    const billingEmail = (customer as any)?.billingEmail || (customer as any)?.email || '-';

    const body =
`========================================================================================
                        (주) 기 연 리 프 트   거 래 명 세 서
========================================================================================

안녕하세요, ${getCustName(billing?.customerId || '')} 귀하.
당사 리프트 임대 계약(계약번호: ${contract?.contractNo || '-'})에 따른 ${billing?.billingYm} 거래명세서 및 청구 내역을 아래와 같이 송부해 드립니다.

[1. 공급자 정보]
- 사업자등록번호: 138-81-83251 | 상호: (주)기연리프트 | 대표자: 이수용
- 계약담당자(영업): ${spName} (연락처: ${spPhone})
- 계산서담당자(경영): 정수아 (연락처: 031-334-5295)
- 이메일: giyeonlift@naver.com

[2. 공급받는 자 정보]
- 상호(법인명): ${customer?.name || '-'} | 대표자명: ${customer?.representative || '-'}
- 사업자등록번호: ${customer?.bizRegNo || '-'} | 사업장주소: ${customer?.address || '-'}
- 현장명: ${site?.name || '-'}
- 현장담당자: ${siteManagerName} (연락처: ${siteManagerPhone})
- 계산서담당자: ${billingManagerName} (연락처: ${billingManagerPhone})
- 계산서메일: ${billingEmail}

[3. 거래 세부 내역]
----------------------------------------------------------------------------------------
${details.map((d, idx) => {
  const itemSupply = (d.unitPrice || 0) * (d.quantity || 1);
  const itemVat = Math.round(itemSupply * 0.1);
  const category = (d as any).billingCategory || (d as any).itemType || '렌탈료';
  const period = calcServicePeriod(d, billing, contract);
  return `${idx + 1}. [${category}] ${d.itemName} (관리번호: ${(d as any).assetNo || '-'})
   - 현장투입일: ${(d as any).siteInputDate || contract?.startDate || '-'} | 정산사용기간: ${period}
   - 공급가액: ${itemSupply.toLocaleString()}원 | 부가세: ${itemVat.toLocaleString()}원 | 합계: ${(itemSupply + itemVat).toLocaleString()}원`;
}).join('\n----------------------------------------------------------------------------------------\n')}
----------------------------------------------------------------------------------------

[4. 청구 합계 금액]
- 공급가액: ${details_supply.toLocaleString()}원
- 부가가치세(10%): ${details_vat.toLocaleString()}원
- 최종 청구 총액: ${(details_supply + details_vat).toLocaleString()}원 (기수금: ${(billing?.paidAmount || 0).toLocaleString()}원 / 미수잔액: ${(details_supply + details_vat - (billing?.paidAmount || 0)).toLocaleString()}원)

[5. 입금 계좌 안내]
- 신한은행 140-010-007060 (주)기연리프트

감사합니다.
(주)기연리프트 올림
========================================================================================`;

    try {
      const toList = mailTo.split(',').map(e => e.trim()).filter(Boolean);
      const ccList = mailCc ? mailCc.split(',').map(e => e.trim()).filter(Boolean) : [];

      // 💡 브라우저 렌더러 폐기로 인해 현재 거래명세서 첨부 이메일 발송 중단
      throw new Error("브라우저 렌더러가 폐기되었습니다. 향후 거래명세서도 정품 엑셀 엔진으로 개편된 후 재활성화됩니다.");

    } catch (err: any) {
      showErrorModal(`⚠️ 이메일 발송 실패:\n\n${err?.message || err}`, '메일 발송 오류');
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
    const isNotExpired = normalizeEndDate(c.endDate) >= todayStr;
    if (!isNotExpired) return false;

    const hasBillingThisMonth = billings.some(b => b.contractId === c.id && b.billingYm === currentYm);
    return !hasBillingThisMonth;
  });

  const isDuePeriod = (c: any) => {
    if (!wizardSearchStartDate || !wizardSearchEndDate) return true;
    
    const startDateObj = new Date(wizardSearchStartDate);
    const endDateObj = new Date(wizardSearchEndDate);
    const startDay = startDateObj.getDate();
    const endDay = endDateObj.getDate();
    
    // 💡 31일(말일) 지정 건을 해당 월의 실제 마지막 날(30일/28일 등)로 동적 보정
    const getEffectiveDay = (targetDay: number | undefined) => {
      if (!targetDay) return undefined;
      const lastDayOfMonth = new Date(startDateObj.getFullYear(), startDateObj.getMonth() + 1, 0).getDate();
      return Math.min(targetDay, lastDayOfMonth);
    };

    const effectiveBillingDay = getEffectiveDay(c.billingDay);
    const effectiveStatementDay = getEffectiveDay(c.statementClosingDay);

    const isDayInRange = (day: number | undefined) => {
      if (!day) return false;
      if (startDay <= endDay) {
        return day >= startDay && day <= endDay;
      } else {
        return day >= startDay || day <= endDay;
      }
    };
    
    const billingDayMatch = isDayInRange(effectiveBillingDay);
    const statementDayMatch = isDayInRange(effectiveStatementDay);
    
    return billingDayMatch || statementDayMatch;
  };

  const handleWizardSearchClick = () => {
    setWizardCustomerFilter(wizardTempCustomerFilter);
    setWizardContractNoFilter(wizardTempContractNoFilter);
    setWizardSiteFilter(wizardTempSiteFilter);
  };

  const filteredWizardContracts = activeContractsForWizard.filter(c => {
    const custName = getCustName(c.customerId).toLowerCase();
    const siteName = getSiteName(c.siteId).toLowerCase();
    const contractNoStr = c.contractNo.toLowerCase();

    const matchesDue = isDuePeriod(c);
    const matchesCustomer = !wizardCustomerFilter || custName.includes(wizardCustomerFilter.trim().toLowerCase());
    const matchesContractNo = !wizardContractNoFilter || contractNoStr.includes(wizardContractNoFilter.trim().toLowerCase());
    const matchesSite = !wizardSiteFilter || siteName.includes(wizardSiteFilter.trim().toLowerCase());

    return matchesDue && matchesCustomer && matchesContractNo && matchesSite;
  });

  const handleSelectContractForWizard = (c: any) => {
    setSelectedContractIdForWizard(c.id);
    setExtraCharges([]);
    setWizardBillingYm(getCurrentYm());
    setWizardBillingDate(getTodayStr());
    
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    
    const firstOfM = new Date(year, month, 1);
    const lastOfM = new Date(year, month + 1, 0);
    
    const startStr = firstOfM.toISOString().split('T')[0];
    const endStr = lastOfM.toISOString().split('T')[0];
    
    const calcStart = c.startDate > startStr ? c.startDate : startStr;
    const normalEnd = normalizeEndDate(c.endDate);
    const calcEnd = normalEnd < endStr ? normalEnd : endStr;
    
    setWizardStartDate(calcStart);
    setWizardEndDate(calcEnd);
    
    if (calcStart > startStr || normalEnd < endStr) {
      setCalcMethod('PRORATED');
    } else {
      setCalcMethod('MONTHLY');
    }
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

  const [isWizardGenerating, setIsWizardGenerating] = useState(false);

  const handleGenerateWizardBilling = async () => {
    if (isWizardGenerating) return;
    if (!selectedContractForWizard || !wizardStartDate || !wizardEndDate) return;

    const extraChargesTotal = extraCharges.reduce((sum, ec) => sum + (ec.quantity * ec.unitPrice), 0);
    const overallTotal = totalAmountForWizard + extraChargesTotal;

    if (overallTotal <= 0) {
      alert('청구 금액이 0원 이하이므로 청구서를 발행할 수 없습니다.');
      return;
    }

    setIsWizardGenerating(true);

    // 중복 청구 경고 (6단계)
    const existing = billings.find(b => 
      b.contractId === selectedContractForWizard.id && 
      b.billingYm === wizardBillingYm && 
      b.status !== 'REJECTED'
    );
    if (existing) {
      const confirmDuplicate = confirm(
        `⚠️ 중복 발행 경고\n\n` +
        `해당 계약의 ${wizardBillingYm} 귀속월 청구서가 이미 존재합니다.\n` +
        `이대로 추가 청구서를 생성하시겠습니까?`
      );
      if (!confirmDuplicate) {
        setIsWizardGenerating(false);
        return;
      }
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

    try {
      const targetYm = wizardBillingYm.trim() || currentYm;
      const targetDate = wizardBillingDate.trim() || todayStr;

      const billing = db.insertRow<Billing>('billings', {
        customerId: selectedContractForWizard.customerId,
        contractId: selectedContractForWizard.id,
        billingYm: targetYm,
        billingDate: targetDate,
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

      // 연동된 수리비가 있다면 billingId 바인딩
      for (const rId of selectedRepairIdsForWizard) {
        await linkRepairToBilling(rId, billing.id);
      }

      // K-3: 연동된 미수금이 있다면, 위자드에서 최종 수정된 단가(amount)를 정확히 추출하여 연동
      for (const r of selectedReceivablesForWizard) {
        const ec = extraCharges.find(c => c.id === `EXTRA-RCV-${r.receivableId}`);
        const finalAmount = ec ? (ec.unitPrice * ec.quantity) : r.amount;
        await linkReceivableToBilling(billing.id, r.receivableId, finalAmount, r.displayName);
      }

      // 💡 헌장 5.2 준수: 원격 DB 저장을 동기로 대기하여 데이터 누락 및 무음 실패 100% 방지
      await db.awaitPendingWrites();

      // 계약이력 기록
      db.insertRow<ContractHistory>('contractHistory', {
        contractId: selectedContractForWizard.id,
        changeType: 'BILLING_CREATED',
        changeDate: targetDate,
        description: `청구 생성: ${targetYm} / ${finalBillingAmount.toLocaleString()}원 (청구번호: ${billing.id})`,
        createdAt: new Date().toISOString()
      });
      await db.awaitPendingWrites();

      refreshAllData();
      setSelectedContractIdForWizard(null);
      setExtraCharges([]);
      setSelectedRepairIdsForWizard([]);
      setSelectedReceivablesForWizard([]);
      alert(`[${getCustName(selectedContractForWizard.customerId)}] 고객사에 대해 청구귀속월(${targetYm}) 기준 총 ${overallTotal.toLocaleString()}원 청구 생성이 DB에 성공적으로 저장되었습니다.`);
    } catch (err: any) {
      showErrorModal(`⚠️ 청구서 DB 저장 실패:\n\n${err?.message || err}`, '청구 생성 오류');
    } finally {
      setIsWizardGenerating(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: '24px', fontWeight: '700' }}>청구 및 수납 수금 관리</h2>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {canSave && (
          <button className={activeTab === 'WIZARD' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('WIZARD')}>
            <Calendar size={14} /> 미청구 계약 정산 마법사
          </button>
        )}
        <button className={activeTab === 'LIST' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('LIST')}>
          청구 및 수납 내역
        </button>
      </div>

      {activeTab === 'LIST' && (() => {
        const dueContracts = getDueContractsForBilling();

        return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* ⚠️ K-1: 일괄 청구 보류(SKIP) 대시보드 (1행 1건 컴팩트 테이블 형태) */}
          {skippedContracts.length > 0 && (
            <div style={{
              padding: '14px 18px',
              borderRadius: '8px',
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>⚠️</span>
                <strong style={{ color: '#d97706', fontSize: '14px' }}>
                  일괄 청구 보류 (Action Required) - {skippedContracts.length}건
                </strong>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  미수금 존재 등 수동 확인이 필요하여 일괄 생성에서 제외된 계약입니다.
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary ms-auto"
                  style={{ fontSize: '11px', padding: '2px 8px' }}
                  onClick={() => setSkippedContracts([])}
                >
                  닫기
                </button>
              </div>
              <table className="table table-sm table-bordered mb-0 align-middle" style={{ backgroundColor: 'white', fontSize: '12.5px' }}>
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '20%' }}>고객사</th>
                    <th style={{ width: '25%' }}>계약명(현장)</th>
                    <th style={{ width: '40%' }}>보류 사유</th>
                    <th style={{ width: '15%', textAlign: 'center' }}>조치</th>
                  </tr>
                </thead>
                <tbody>
                  {skippedContracts.map((skip, idx) => {
                    const c = contracts.find(ct => ct.id === skip.contractId);
                    if (!c) return null;
                    return (
                      <tr key={idx}>
                        <td className="fw-bold text-primary">{getCustName(skip.customerId)}</td>
                        <td>{c.contractNo}</td>
                        <td className="text-danger fw-bold">{skip.reason}</td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm py-0"
                            style={{ fontSize: '11px', height: '24px' }}
                            onClick={() => {
                              setSelectedContractIdForWizard(skip.contractId);
                              setActiveTab('WIZARD');
                            }}
                          >
                            수동 병합 발행 ➔
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 📢 청구 도래 미생성 계약 실시간 감지 알림 바 */}
          {dueContracts.length > 0 && (
            <div style={{
              padding: '14px 18px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>📢</span>
                  <strong style={{ color: '#dc2626', fontSize: '14px' }}>
                    오늘 기준 청구 도래 미생성 계약: {dueContracts.length}건
                  </strong>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    (고객 요청 청구기준일 도래 및 전월 미청구 건 실시간 감지)
                  </span>
                </div>
                {canSave && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleGenerateDue}
                    disabled={isGeneratingDue}
                    style={{ padding: '6px 14px', fontSize: '12.5px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus size={14} />
                    {isGeneratingDue ? '기본 청구 생성 중...' : `도래 계약 기본 청구 일괄 생성 (${dueContracts.length}건)`}
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
                {dueContracts.slice(0, 6).map((item, idx) => (
                  <div key={idx} style={{ padding: '8px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{item.customer.name}</strong> <span style={{ color: 'var(--text-muted)' }}>({item.contract.contractNo})</span>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {item.site?.name || '직납'} | 매월 {item.billingDay}일
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: '600', padding: '2px 6px', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                      {item.dueReason}
                    </span>
                  </div>
                ))}
              </div>
              {dueContracts.length > 6 && (
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                  외 {dueContracts.length - 6}건 더 있음
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'flex-start' }}>
          
          {/* 청구 목록 */}
          <div className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title" style={{ margin: 0 }}>청구서 리스트</h3>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={handleExportExcel}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '6px 12px' }}
              >
                <Download size={12} /> 엑셀 다운로드
              </button>
            </div>

            {/* 필터 바 (상하 헤더 세로 스택 및 다중 정밀 필터) */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap', backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '120px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>고객사 검색</label>
                <input 
                  type="text" 
                  value={tempSearchTerm} 
                  onChange={e => setTempSearchTerm(e.target.value)} 
                  placeholder="고객사명..."
                  style={{ width: '100%', padding: '6px 8px', fontSize: '12px', borderRadius: '5px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '110px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>계약번호 검색</label>
                <input 
                  type="text" 
                  value={tempContractNoFilter} 
                  onChange={e => setTempContractNoFilter(e.target.value)} 
                  placeholder="계약번호..."
                  style={{ width: '100%', padding: '6px 8px', fontSize: '12px', borderRadius: '5px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                />
              </div>

              {/* 📅 청구 시작월 ~ 종료월 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>청구 시작월</label>
                <input 
                  type="month"
                  value={tempStartBillingYmFilter} 
                  onChange={e => setTempStartBillingYmFilter(e.target.value)} 
                  style={{ width: '120px', padding: '6px 8px', fontSize: '12px', borderRadius: '5px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>청구 종료월</label>
                <input 
                  type="month"
                  value={tempEndBillingYmFilter} 
                  onChange={e => setTempEndBillingYmFilter(e.target.value)} 
                  style={{ width: '120px', padding: '6px 8px', fontSize: '12px', borderRadius: '5px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                />
              </div>

              {/* 💰 수납 상태 (완료 / 미완료) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>수납 상태</label>
                <select 
                  value={tempPaymentFilter} 
                  onChange={e => setTempPaymentFilter(e.target.value as any)} 
                  style={{ width: '110px', padding: '6px 8px', fontSize: '12px', borderRadius: '5px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                >
                  <option value="ALL">전체</option>
                  <option value="PAID">수납 완료</option>
                  <option value="UNPAID_ANY">수납 미완료</option>
                </select>
              </div>

              {/* ✉️ 메일 발송 상태 (발송 / 미발송) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>메일 발송</label>
                <select 
                  value={tempMailSentFilter} 
                  onChange={e => setTempMailSentFilter(e.target.value as any)} 
                  style={{ width: '100px', padding: '6px 8px', fontSize: '12px', borderRadius: '5px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                >
                  <option value="ALL">전체</option>
                  <option value="SENT">발송</option>
                  <option value="UNSENT">미발송</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                <button 
                  type="button" 
                  className="btn-primary" 
                  onClick={handleSearchClick}
                  style={{ padding: '6px 14px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px', whiteSpace: 'nowrap' }}
                >
                  조회
                </button>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={handleResetFilters}
                  style={{ padding: '6px 10px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px', whiteSpace: 'nowrap' }}
                >
                  초기화
                </button>
              </div>
            </div>

            {/* 📊 청구 및 수납 실시간 종합 집계 위젯 */}
            {(() => {
              const totalSupply = filteredBillings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
              const totalVat = Math.round(totalSupply * 0.1);
              const totalGrand = totalSupply + totalVat;
              const totalPaid = filteredBillings.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
              const totalUnpaid = Math.max(0, totalGrand - totalPaid);

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ padding: '12px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px' }}>조회 청구건수</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--primary)' }}>{filteredBillings.length}건</div>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px' }}>공급가액 합계</div>
                    <div style={{ fontSize: '16px', fontWeight: 800 }}>₩{totalSupply.toLocaleString()}</div>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px' }}>총 청구금액 (VAT포함)</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#0070C0' }}>₩{totalGrand.toLocaleString()}</div>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px' }}>수납 완료액</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--success)' }}>₩{totalPaid.toLocaleString()}</div>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px' }}>미수 채권 잔액</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: totalUnpaid > 0 ? '#dc2626' : 'var(--text-muted)' }}>₩{totalUnpaid.toLocaleString()}</div>
                  </div>
                </div>
              );
            })()}

            <div className="table-container" style={{ border: 'none', boxShadow: 'none', overflowX: 'auto' }}>
              <table style={{ minWidth: '650px', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr>
                    <th style={{ whiteSpace: 'nowrap' }}>관리</th>
                    <th style={{ whiteSpace: 'nowrap' }}>청구월</th>
                    <th style={{ whiteSpace: 'nowrap' }}>고객사</th>
                    <th style={{ whiteSpace: 'nowrap' }}>청구액</th>
                    <th style={{ whiteSpace: 'nowrap' }}>미납액</th>
                    <th style={{ whiteSpace: 'nowrap' }}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBillings.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                        조회 결과가 없습니다.
                      </td>
                    </tr>
                  ) : filteredBillings.map(b => {
                    const unpaid = b.totalAmount - b.paidAmount;
                    return (
                      <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedBillingId(b.id)}>
                        <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            {b.status === 'REQUESTED' ? (
                              <>
                                <button 
                                  type="button"
                                  className="btn-secondary" 
                                  onClick={() => setSelectedBillingId(b.id)} 
                                  style={{ padding: '3px 6px', fontSize: '11px', whiteSpace: 'nowrap' }}
                                  title="상세 내역 검토"
                                >
                                  검토
                                </button>
                                {isAdmin && (
                                  <button 
                                    type="button"
                                    className="btn-success" 
                                    onClick={(e) => handleApprove(b.id, e)} 
                                    style={{ padding: '3px 6px', fontSize: '11px', whiteSpace: 'nowrap' }}
                                    title="청구 완료 (승인)"
                                  >
                                    완료
                                  </button>
                                )}
                                {canSave && (
                                  <button 
                                    type="button"
                                    className="btn-secondary" 
                                    onClick={(e) => handleOpenRegenerate(b.id, e)} 
                                    style={{ padding: '3px 6px', fontSize: '11px', color: 'var(--primary)', fontWeight: '600', whiteSpace: 'nowrap' }}
                                    title="내역 수정 및 재생성"
                                  >
                                    취소/재생성
                                  </button>
                                )}
                                {isAdmin && (
                                  <button 
                                    type="button"
                                    className="btn-danger" 
                                    onClick={(e) => handleCancel(b.id, e)} 
                                    style={{ padding: '3px 6px', fontSize: '11px', whiteSpace: 'nowrap' }}
                                    title="청구 취소"
                                  >
                                    취소
                                  </button>
                                )}
                              </>
                            ) : (
                              <>
                                {canSave && (b.status === 'UNPAID' || b.status === 'PARTIAL') && (
                                  <button className="btn-success" onClick={() => handleOpenPay(b.id, unpaid)} style={{ padding: '3px 6px', fontSize: '11px', whiteSpace: 'nowrap' }}>
                                    수납
                                  </button>
                                )}
                                {(b.status === 'UNPAID' || b.status === 'PARTIAL' || b.status === 'PAID') && (
                                  <button className="btn-secondary" onClick={() => handleOpenMail(b.id)} style={{ padding: '3px 6px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap' }}>
                                    <Mail size={10} /> 발송
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}><strong>{b.billingYm}</strong></td>
                        <td style={{ whiteSpace: 'nowrap' }}>{getCustName(b.customerId)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{b.totalAmount.toLocaleString()}원</td>
                        <td style={{ whiteSpace: 'nowrap', color: unpaid > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                          {unpaid.toLocaleString()}원
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span className={`badge ${
                            b.status === 'UNPAID'    ? 'badge-secondary' :
                            b.status === 'REQUESTED' ? 'badge-warning' :
                            b.status === 'REJECTED'  ? 'badge-danger' :
                            b.status === 'PAID'      ? 'badge-success' :
                            b.status === 'PARTIAL'   ? 'badge-info' : 'badge-secondary'
                          }`}>
                            {b.status === 'UNPAID'    ? '미발송' :
                             b.status === 'REQUESTED' ? '발송완료' :
                             b.status === 'REJECTED'  ? '이의제기' :
                             b.status === 'PAID'      ? '완납' :
                             b.status === 'PARTIAL'   ? '일부납' : b.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 청구 상세 정보 (거래명세서 고밀도 정밀 데이터 테이블) */}
          <div>
            {activeBilling ? (() => {
              const contractObj = contracts.find(c => c.id === activeBilling.contractId);
              const siteObj = sites.find(s => s.id === contractObj?.siteId);
              const custObj = customers.find(cu => cu.id === activeBilling.customerId);

              const totalSupply = activeBillingDetails.reduce((sum, bd) => sum + (bd.amount || 0), 0);
              const totalVat = Math.round(totalSupply * 0.1);
              const totalGrand = totalSupply + totalVat;
              const paidAmt = activeBilling.paidAmount || 0;
              const unpaidAmt = Math.max(0, totalGrand - paidAmt);

              return (
                <div className="card" style={{ margin: 0, padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* 상단 헤더: 타이틀, 발행일자, 버튼 */}
                  <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 className="card-title" style={{ margin: 0, fontSize: '16px' }}>청구 명세서 ({activeBilling.billingYm})</h3>
                      {canSave && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleEditBillingYm(activeBilling.id, activeBilling.billingYm)}
                          style={{ padding: '2px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          title="청구귀속월 변경"
                        >
                          <Edit3 size={11} /> 청구월 수정
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>발행일자: {activeBilling.billingDate}</span>
                      <button 
                        type="button" 
                        className="btn-primary"
                        onClick={() => handleOpenMail(activeBilling.id)}
                        style={{ padding: '5px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}
                      >
                        <Mail size={13} /> 거래명세서 메일 발송
                      </button>
                    </div>
                  </div>

                  {/* 반려/취소 사유 알림 */}
                  {activeBilling.status === 'REJECTED' && (
                    <div style={{ padding: '10px 12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid var(--danger)', borderRadius: '4px' }}>
                      <strong style={{ color: 'var(--danger)', fontSize: '13px', display: 'block', marginBottom: '2px' }}>[취소/이의제기 사유]</strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{activeBilling.rejectReason || '사유 미기재'}</span>
                    </div>
                  )}

                  {/* 기본 계약/고객 정보 프로필 */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', padding: '10px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', fontSize: '12px' }}>
                    <div>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block' }}>고객사명</span>
                      <strong style={{ fontSize: '12.5px' }}>{custObj?.name || getCustName(activeBilling.customerId)}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block' }}>현장명</span>
                      <strong style={{ fontSize: '12.5px' }}>{siteObj?.name || '-'}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block' }}>계약번호</span>
                      <strong style={{ fontSize: '12.5px' }}>{contractObj?.contractNo || activeBilling.contractId || '-'}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block' }}>사업자번호</span>
                      <strong style={{ fontSize: '12.5px' }}>{custObj?.businessNo || '-'}</strong>
                    </div>
                  </div>

                  {/* 4분할 회계 지표 바 */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    <div style={{ padding: '8px 10px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>공급가액 계</div>
                      <div style={{ fontSize: '14px', fontWeight: 800 }}>₩{totalSupply.toLocaleString()}</div>
                    </div>
                    <div style={{ padding: '8px 10px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>부가세 (10%)</div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#0070C0' }}>₩{totalVat.toLocaleString()}</div>
                    </div>
                    <div style={{ padding: '8px 10px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>총 청구금액 (VAT포함)</div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--primary)' }}>₩{totalGrand.toLocaleString()}</div>
                    </div>
                    <div style={{ padding: '8px 10px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>미수 잔액 (미납액)</div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: unpaidAmt > 0 ? '#dc2626' : 'var(--success)' }}>
                        ₩{unpaidAmt.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* 명세서 본문 테이블 (거래명세서 고밀도 그리드) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '700', margin: 0 }}>세부 청구 명세 ({activeBillingDetails.length}건)</h4>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>단위: 원 / VAT별도 기준 산출</span>
                    </div>

                    <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflowX: 'auto', margin: 0, maxHeight: '420px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', fontSize: '11.5px', whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'var(--bg-app)' }}>
                          <tr>
                            <th style={{ padding: '6px 8px', textAlign: 'center', width: '32px' }}>No</th>
                            <th style={{ padding: '6px 8px' }}>구분</th>
                            <th style={{ padding: '6px 8px' }}>모델명 / 자산번호</th>
                            <th style={{ padding: '6px 8px' }}>적용 기간 / 산출 근거</th>
                            <th style={{ padding: '6px 8px', textAlign: 'right' }}>수량</th>
                            <th style={{ padding: '6px 8px', textAlign: 'right' }}>단가</th>
                            <th style={{ padding: '6px 8px', textAlign: 'right' }}>공급가액</th>
                            <th style={{ padding: '6px 8px', textAlign: 'right' }}>세액</th>
                            <th style={{ padding: '6px 8px', textAlign: 'right' }}>합계</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeBillingDetails.length === 0 ? (
                            <tr>
                              <td colSpan={9} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                                등록된 세부 청구 내역이 없습니다.
                              </td>
                            </tr>
                          ) : (
                            activeBillingDetails.map((bd, idx) => {
                              const ca = contractAssets.find(cAsset => cAsset.id === bd.contractAssetId);
                              const asset = ca?.assetId 
                                ? assets.find(a => a.id === ca.assetId) 
                                : (bd.assetId ? assets.find(a => a.id === bd.assetId) : null);
                              
                              const modelName = asset?.modelName || ca?.expectedModel || (bd.itemName !== '렌탈 장비 렌탈료' ? bd.itemName : '장비');
                              const assetNo = asset?.assetNo ? asset.assetNo : (ca?.assetId ? ca.assetId : '-');
                              const isRental = Boolean(bd.contractAssetId || bd.itemName?.includes('렌탈'));
                              const category = isRental ? '렌탈료' : (bd.itemName || '부대비용');
                              
                              const supply = bd.amount || 0;
                              const vat = Math.round(supply * 0.1);
                              const lineTotal = supply + vat;
                              const unitPrice = bd.unitPrice || (ca?.monthlyRentalFee) || supply;

                              return (
                                <tr key={bd.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                  <td style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                  <td style={{ padding: '6px 8px' }}>
                                    <span style={{ 
                                      padding: '2px 6px', 
                                      borderRadius: '4px', 
                                      fontSize: '10.5px', 
                                      fontWeight: 600,
                                      backgroundColor: isRental ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                      color: isRental ? '#2563eb' : '#059669'
                                    }}>
                                      {category}
                                    </span>
                                  </td>
                                  <td style={{ padding: '6px 8px' }}>
                                    <strong>{modelName}</strong>
                                    {assetNo !== '-' && (
                                      <span style={{ marginLeft: '6px', color: 'var(--text-muted)', fontSize: '11px' }}>
                                        ({assetNo})
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>
                                    {bd.description || (isRental ? '2026-08 정기 월렌탈' : bd.itemName)}
                                  </td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{bd.quantity || 1}</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{unitPrice.toLocaleString()}원</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{supply.toLocaleString()}원</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-muted)' }}>{vat.toLocaleString()}원</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{lineTotal.toLocaleString()}원</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                        <tfoot style={{ position: 'sticky', bottom: 0, backgroundColor: 'var(--bg-app)', borderTop: '2px solid var(--border-color)', fontWeight: 800 }}>
                          <tr>
                            <td colSpan={4} style={{ padding: '8px', textAlign: 'center' }}>합계 ({activeBillingDetails.length}건)</td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>{activeBillingDetails.reduce((s, bd) => s + (bd.quantity || 1), 0)}</td>
                            <td style={{ padding: '8px' }}>-</td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>₩{totalSupply.toLocaleString()}</td>
                            <td style={{ padding: '8px', textAlign: 'right', color: '#0070C0' }}>₩{totalVat.toLocaleString()}</td>
                            <td style={{ padding: '8px', textAlign: 'right', color: 'var(--primary)' }}>₩{totalGrand.toLocaleString()}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })() : (
              <div className="card" style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', margin: 0 }}>
                상세 청구 항목을 조회할 청구서를 왼쪽 목록에서 선택해 주세요.
              </div>
            )}
          </div>

        </div>
        </div>
        );
      })()}



      {activeTab === 'WIZARD' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px', alignItems: 'flex-start' }}>
          {/* 왼쪽: 계약 카드 목록 */}
          <div>
            <div className="card" style={{ margin: 0, marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 className="card-title" style={{ margin: 0 }}>정산 대상 계약 목록</h3>
              
              {/* 1행: 마감일 기준 검색 기간 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>마감일 기준 검색 기간</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="date"
                    value={wizardSearchStartDate}
                    onChange={e => setWizardSearchStartDate(e.target.value)}
                    style={{ flex: 1, padding: '5px 8px', fontSize: '12.5px', borderRadius: '5px', border: '1px solid var(--border-color)' }}
                  />
                  <span style={{ color: 'var(--text-muted)' }}>~</span>
                  <input
                    type="date"
                    value={wizardSearchEndDate}
                    onChange={e => setWizardSearchEndDate(e.target.value)}
                    style={{ flex: 1, padding: '5px 8px', fontSize: '12.5px', borderRadius: '5px', border: '1px solid var(--border-color)' }}
                  />
                </div>
              </div>

              {/* 2행: 고객사, 계약번호, 현장명 세부 필터 & [조회] 버튼 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '8px', alignItems: 'end', backgroundColor: 'var(--bg-app)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', overflowX: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>고객사 검색</label>
                  <input
                    type="text"
                    value={wizardTempCustomerFilter}
                    onChange={e => setWizardTempCustomerFilter(e.target.value)}
                    placeholder="고객사명..."
                    style={{ width: '100%', padding: '5px 8px', fontSize: '12px', borderRadius: '5px', border: '1px solid var(--border-color)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>계약번호 검색</label>
                  <input
                    type="text"
                    value={wizardTempContractNoFilter}
                    onChange={e => setWizardTempContractNoFilter(e.target.value)}
                    placeholder="계약번호..."
                    style={{ width: '100%', padding: '5px 8px', fontSize: '12px', borderRadius: '5px', border: '1px solid var(--border-color)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>현장명 검색</label>
                  <input
                    type="text"
                    value={wizardTempSiteFilter}
                    onChange={e => setWizardTempSiteFilter(e.target.value)}
                    placeholder="현장명..."
                    style={{ width: '100%', padding: '5px 8px', fontSize: '12px', borderRadius: '5px', border: '1px solid var(--border-color)' }}
                  />
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleWizardSearchClick}
                  style={{ padding: '5px 12px', height: '30px', fontWeight: 'bold', fontSize: '12px', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  조회
                </button>
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

                  {/* 💡 청구귀속월 & 청구 발행일자 지정 컨트롤 (담당자 휴가/고객 요청 시 월 변경 가능) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--primary-light, #bfdbfe)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>
                        🗓️ 청구귀속월 (변경 가능)
                      </label>
                      <input
                        type="month"
                        value={wizardBillingYm}
                        onChange={e => setWizardBillingYm(e.target.value)}
                        style={{ width: '100%', padding: '7px 10px', fontSize: '13px', fontWeight: 700, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                      />
                      <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                        ※ 기본값: 당월 ({currentYm}) / 담당자 휴가·고객 요청 시 수정
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>
                        📅 청구 발행 일자
                      </label>
                      <input
                        type="date"
                        value={wizardBillingDate}
                        onChange={e => setWizardBillingDate(e.target.value)}
                        style={{ width: '100%', padding: '7px 10px', fontSize: '13px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                      />
                      <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                        ※ 기본값: 오늘 ({todayStr})
                      </span>
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
                  
                  {/* 💡 미청구 고객 과실 수리비 자동 추천 패널 */}
                  {(() => {
                    const contractAssetIds = wizardContractAssets.map(ca => ca.assetId).filter(Boolean);
                    const unbilledRepairs = repairs.filter(r => 
                      r.billableToCustomer && 
                      !r.billingId && 
                      contractAssetIds.includes(r.assetId) &&
                      !selectedRepairIdsForWizard.includes(r.id)
                    );

                    if (unbilledRepairs.length === 0) return null;

                    return (
                      <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', marginBottom: '14px' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '12.5px', color: '#dc2626', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>⚠️ 고객 부담 미청구 정비/수리비 {unbilledRepairs.length}건 발견</span>
                          {unbilledRepairs.length > 1 && (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: '#dc2626', borderColor: '#dc2626' }}
                              onClick={() => {
                                const newRepairIds = unbilledRepairs.map(r => r.id);
                                const newCharges = unbilledRepairs.map(rep => {
                                  const ast = assets.find(a => a.id === rep.assetId);
                                  const cost = rep.totalCost || 0;
                                  return {
                                    id: `EXTRA-REP-${rep.id}`,
                                    category: 'REPAIR',
                                    customName: `[고객부담 수리비] ${ast?.assetNo} ${rep.details || ''}`,
                                    quantity: 1,
                                    unitPrice: cost
                                  };
                                });
                                setSelectedRepairIdsForWizard([...selectedRepairIdsForWizard, ...newRepairIds]);
                                setExtraCharges([...extraCharges, ...newCharges]);
                              }}
                            >
                              전체 일괄 추가
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {unbilledRepairs.map(rep => {
                            const ast = assets.find(a => a.id === rep.assetId);
                            const cost = rep.totalCost || 0;
                            return (
                              <div key={rep.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', backgroundColor: 'var(--bg-card)', padding: '6px 10px', borderRadius: '6px' }}>
                                <div>
                                  <strong>{ast?.modelName || '장비'} ({ast?.assetNo})</strong> — {rep.details || '현장 수리'} ({cost.toLocaleString()}원)
                                </div>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => {
                                    setSelectedRepairIdsForWizard([...selectedRepairIdsForWizard, rep.id]);
                                    setExtraCharges([...extraCharges, {
                                      id: `EXTRA-REP-${rep.id}`,
                                      category: 'REPAIR',
                                      customName: `[고객부담 수리비] ${ast?.assetNo} ${rep.details || ''}`,
                                      quantity: 1,
                                      unitPrice: cost
                                    }]);
                                  }}
                                  style={{ fontSize: '11.5px', padding: '3px 8px', color: 'var(--primary)', fontWeight: 'bold' }}
                                >
                                  + 청구 항목에 추가
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* 💡 미청구 외상미수금 대장 자동 추천 패널 */}
                  {(() => {
                    const unbilledReceivables = receivables.filter(r => 
                      r.status !== 'CLEARED' &&
                      (r.contractId === selectedContractForWizard.id || r.contractId === undefined) &&
                      r.customerId === selectedContractForWizard.customerId &&
                      !selectedReceivablesForWizard.find(sr => sr.receivableId === r.id)
                    );

                    if (unbilledReceivables.length === 0) return null;

                    return (
                      <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.25)', marginBottom: '14px' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '12.5px', color: '#2563eb', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>ℹ️ 이 계약/고객사의 미청구 외상미수금 {unbilledReceivables.length}건 발견</span>
                          {unbilledReceivables.length > 1 && (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              style={{ fontSize: '11px', padding: '2px 8px' }}
                              onClick={() => {
                                const newReceivables = unbilledReceivables.map(rcv => {
                                  const remaining = rcv.totalAmount - rcv.billedAmount;
                                  return {
                                    receivableId: rcv.id,
                                    amount: remaining,
                                    displayName: rcv.displayName || rcv.internalDescription
                                  };
                                });
                                const newCharges = unbilledReceivables.map(rcv => {
                                  const remaining = rcv.totalAmount - rcv.billedAmount;
                                  return {
                                    id: `EXTRA-RCV-${rcv.id}`,
                                    category: rcv.type === 'TRANSPORT' ? 'TRANSPORT_ONEWAY' : rcv.type === 'REPAIR' ? 'REPAIR' : 'OTHER',
                                    customName: `[외상청구] ${rcv.displayName || rcv.internalDescription}`,
                                    quantity: 1,
                                    unitPrice: remaining
                                  };
                                });
                                setSelectedReceivablesForWizard([...selectedReceivablesForWizard, ...newReceivables]);
                                setExtraCharges([...extraCharges, ...newCharges]);
                              }}
                            >
                              전체 일괄 추가
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {unbilledReceivables.map(rcv => {
                            const remaining = rcv.totalAmount - rcv.billedAmount;
                            return (
                              <div key={rcv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', backgroundColor: 'var(--bg-card)', padding: '6px 10px', borderRadius: '6px' }}>
                                <div>
                                  <strong>[{rcv.type}]</strong> {rcv.internalDescription} <span className="text-muted">(잔액: {remaining.toLocaleString()}원)</span>
                                </div>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => {
                                    setSelectedReceivablesForWizard([...selectedReceivablesForWizard, {
                                      receivableId: rcv.id,
                                      amount: remaining,
                                      displayName: rcv.displayName || rcv.internalDescription
                                    }]);
                                    setExtraCharges([...extraCharges, {
                                      id: `EXTRA-RCV-${rcv.id}`,
                                      category: rcv.type === 'TRANSPORT' ? 'TRANSPORT_ONEWAY' : rcv.type === 'REPAIR' ? 'REPAIR' : 'OTHER',
                                      customName: `[외상청구] ${rcv.displayName || rcv.internalDescription}`,
                                      quantity: 1,
                                      unitPrice: remaining
                                    }]);
                                  }}
                                  style={{ fontSize: '11.5px', padding: '3px 8px', color: 'var(--primary)', fontWeight: 'bold' }}
                                >
                                  + 청구 항목에 추가
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      ➕ 추가 청구 등록 (운송료, 수리비 등)
                    </h4>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setExtraCharges([...extraCharges, {
                        id: `EXTRA-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
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
                              const newCharges = extraCharges.filter(item => item.id !== ec.id);
                              setExtraCharges(newCharges);
                              
                              if (ec.id.startsWith('EXTRA-REP-')) {
                                const rId = ec.id.replace('EXTRA-REP-', '');
                                setSelectedRepairIdsForWizard(selectedRepairIdsForWizard.filter(id => id !== rId));
                              } else if (ec.id.startsWith('EXTRA-RCV-')) {
                                const rcvId = ec.id.replace('EXTRA-RCV-', '');
                                setSelectedReceivablesForWizard(selectedReceivablesForWizard.filter(r => r.receivableId !== rcvId));
                              }
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
      {showPayModal && (() => {
        const payBilling = billings.find(b => b.id === payBillingId);
        const unpaid = payBilling ? payBilling.totalAmount - payBilling.paidAmount : 0;
        const custId = payBilling?.customerId;
        const billingNo = payBillingId;

        // ── 통합 검색 필터: 고객명 / 입금자명 / 계좌번호 / 비고 ──
        const searchQ = depSearchQuery.trim().toLowerCase();
        const filteredDeposits = bankTransactions
          .filter(t => {
            if (!t.isDeposit) return false;
            if (!searchQ) return true; // 검색어 없으면 전체 표시
            const mappedCustName = customers.find(c => c.id === t.customerId)?.name || '';
            return (
              t.senderName.toLowerCase().includes(searchQ) ||
              mappedCustName.toLowerCase().includes(searchQ) ||
              (t.senderAccount || '').toLowerCase().includes(searchQ) ||
              (t.memo || '').toLowerCase().includes(searchQ)
            );
          })
          .map(dep => ({ ...dep, balance: getDepositBalance(dep.id) }))
          .sort((a, b) => a.transactionDate.localeCompare(b.transactionDate)); // 오래된 것 먼저

        // 선택 합계
        const selectedTotal = Object.values(depositLinkDraft).reduce((s, v) => s + v, 0);
        const availableTotal = filteredDeposits.filter(d => d.balance > 0).reduce((s, d) => s + d.balance, 0);

        // 체크박스 토글: 체크하면 잔액 있는 건들을 오래된 것 부터 자동 재분배
        const toggleDep = (depId: string) => {
          setDepositLinkDraft(prev => {
            const next = { ...prev };
            if (next[depId] !== undefined) {
              delete next[depId]; // 해제
            } else {
              next[depId] = 0; // 체크 추가
            }
            // 체크된 모든 항목을 날짜 오름차순으로 정렬 후 oldest-first 재분배
            const checkedSorted = filteredDeposits
              .filter(d => next[d.id] !== undefined)
              .sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));
            let rem = unpaid;
            for (const d of checkedSorted) {
              const use = Math.min(d.balance, Math.max(0, rem));
              next[d.id] = use;
              rem -= use;
            }
            return next;
          });
        };

        // 매핑 근거 판별
        const getMatchReason = (dep: typeof filteredDeposits[0]) => {
          const targetCust = customers.find(c => c.id === custId);
          const regAccs = targetCust?.bankAccounts || [];
          const senderAccNorm = (dep.senderAccount || '').replace(/[^0-9]/g, '');

          // 1) 등록 계좌 일치 여부 (최우선)
          const matchedRegAcc = senderAccNorm ? regAccs.find(a => {
            const norm = a.accountNumber.replace(/[^0-9]/g, '');
            return norm && (norm === senderAccNorm || senderAccNorm.includes(norm) || norm.includes(senderAccNorm));
          }) : null;
          if (matchedRegAcc) return { label: `등록계좌(${matchedRegAcc.bankName})`, color: '#EC4899' };

          // 2) 기존 매핑/검색어 근거
          const mappedCustName = customers.find(c => c.id === dep.customerId)?.name || '';
          if (dep.customerId === custId) return { label: '고객사 매핑', color: '#10B981' };
          const custName = targetCust?.name?.toLowerCase() || '';
          if (dep.senderName.toLowerCase().includes(custName) || (custName && custName.includes(dep.senderName.toLowerCase()))) return { label: '입금자명 일치', color: '#6366F1' };
          if (searchQ && mappedCustName.toLowerCase().includes(searchQ)) return { label: '고객명 검색', color: '#F59E0B' };
          if (searchQ && (dep.senderAccount || '').toLowerCase().includes(searchQ)) return { label: '계좌번호 검색', color: '#8B5CF6' };
          return { label: '비고 검색', color: '#64748B' };
        };

        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px'
          }}>
            <form onSubmit={handlePaySubmit} className="card" style={{ width: '100%', maxWidth: '620px', backgroundColor: 'var(--bg-card)', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0' }}>

              {/* 헤더 */}
              <div style={{ marginBottom: '16px' }}>
                <h3 className="card-title" style={{ marginBottom: '4px' }}>수납 처리</h3>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {getCustName(custId || '')} — 청구번호: <strong>{billingNo}</strong> — 미납액: <strong style={{ color: '#EF4444' }}>{unpaid.toLocaleString()}원</strong>
                </div>
              </div>

              {/* 모드 탭 */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
                <button type="button" onClick={() => setPayMode('DEPOSIT')}
                  style={{ padding: '7px 16px', fontSize: '13px', fontWeight: '600', border: 'none', background: 'none', cursor: 'pointer',
                    borderBottom: payMode === 'DEPOSIT' ? '2px solid var(--primary)' : '2px solid transparent',
                    color: payMode === 'DEPOSIT' ? 'var(--primary)' : 'var(--text-secondary)' }}>
                  🏦 통장입금 연동
                </button>
                <button type="button" onClick={() => {
                  setPayMode('PREPAID');
                  const targetCust = customers.find(c => c.id === custId);
                  const bal = targetCust?.prepaidBalance || 0;
                  setPrepaidAmount(Math.min(unpaid, bal));
                }}
                  style={{ padding: '7px 16px', fontSize: '13px', fontWeight: '600', border: 'none', background: 'none', cursor: 'pointer',
                    borderBottom: payMode === 'PREPAID' ? '2px solid var(--primary)' : '2px solid transparent',
                    color: payMode === 'PREPAID' ? 'var(--primary)' : 'var(--text-secondary)' }}>
                  💰 선수금(예치금) 상계
                </button>
                <button type="button" onClick={() => setPayMode('DIRECT')}
                  style={{ padding: '7px 16px', fontSize: '13px', fontWeight: '600', border: 'none', background: 'none', cursor: 'pointer',
                    borderBottom: payMode === 'DIRECT' ? '2px solid var(--primary)' : '2px solid transparent',
                    color: payMode === 'DIRECT' ? 'var(--primary)' : 'var(--text-secondary)' }}>
                  ✏️ 직접 입력
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>

                {payMode === 'DEPOSIT' ? (
                  <>
                    {/* ── 통합 검색 필터 ── */}
                    <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                        통합 검색 — 고객명 · 입금자명 · 계좌번호 · 비고 중 하나를 입력
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input type="text" value={depSearchQuery} onChange={e => {
                          setDepSearchQuery(e.target.value);
                          setDepositLinkDraft({}); // 검색 변경 시 선택 초기화
                        }}
                          placeholder="예: 세보엠이씨 / 123-456-789012 / 7월 렌탈료"
                          style={{ flex: 1 }} />
                        <button type="button" onClick={() => { setDepSearchQuery(''); setDepositLinkDraft({}); }}
                          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-app)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          초기화
                        </button>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '5px' }}>
                        검색 결과: <strong>{filteredDeposits.length}건</strong>
                        {filteredDeposits.filter(d => d.balance > 0).length > 0 && (
                          <span> / 사용가능 잔액: <strong style={{ color: '#10B981' }}>{availableTotal.toLocaleString()}원</strong></span>
                        )}
                      </div>
                    </div>

                    {/* ── 입금 목록 ── */}
                    {filteredDeposits.length === 0 ? (
                      <div style={{ padding: '20px', borderRadius: '8px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', fontSize: '13px', textAlign: 'center' }}>
                        검색 결과가 없습니다.<br />
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>고객명, 입금자명, 계좌번호, 비고 등으로 검색하거나 직접 입력 탭을 사용하세요.</span>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <label style={{ margin: 0 }}>입금건 선택 (복수 선택 가능 · 오래된 입금부터 자동 차감)</label>
                          {Object.keys(depositLinkDraft).length > 0 && (
                            <button type="button" onClick={() => setDepositLinkDraft({})}
                              style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                              선택 초기화
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                          {filteredDeposits.map(dep => {
                            const isChecked = depositLinkDraft[dep.id] !== undefined;
                            const inputVal = depositLinkDraft[dep.id] ?? 0;
                            const isExhausted = dep.balance <= 0;
                            const matchReason = getMatchReason(dep);
                            const mappedCustName = customers.find(c => c.id === dep.customerId)?.name;

                            return (
                              <div key={dep.id} style={{
                                display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', borderRadius: '8px',
                                border: `1px solid ${isChecked ? 'var(--primary)' : isExhausted ? 'var(--border)' : 'var(--border)'}`,
                                background: isChecked ? 'rgba(99,102,241,0.07)' : isExhausted ? 'rgba(0,0,0,0.02)' : 'var(--bg-app)',
                                opacity: isExhausted && !isChecked ? 0.45 : 1
                              }}>
                                <input type="checkbox" checked={isChecked}
                                  disabled={isExhausted}
                                  onChange={() => toggleDep(dep.id)}
                                  style={{ accentColor: 'var(--primary)', width: '16px', height: '16px', marginTop: '2px', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap' }}>{dep.senderName}</span>
                                    <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', fontWeight: '600', whiteSpace: 'nowrap',
                                      background: `${matchReason.color}18`, color: matchReason.color, border: `1px solid ${matchReason.color}40` }}>
                                      {matchReason.label}
                                    </span>
                                    {mappedCustName && (
                                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>({mappedCustName})</span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <span>입금일: {dep.transactionDate.split(' ')[0]}</span>
                                    <span>원금: {dep.depositAmount.toLocaleString()}원</span>
                                    {dep.senderAccount && <span>계좌: {dep.senderAccount}</span>}
                                    {dep.memo && <span>비고: {dep.memo}</span>}
                                    {dep.balance < dep.depositAmount && (
                                      <span style={{ color: '#F59E0B' }}>기소진: {(dep.depositAmount - dep.balance).toLocaleString()}원</span>
                                    )}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                                  <span style={{ fontSize: '12px', fontWeight: '700', color: isExhausted ? 'var(--text-muted)' : '#10B981', whiteSpace: 'nowrap' }}>
                                    {isExhausted ? '소진완료' : `잔액 ${dep.balance.toLocaleString()}원`}
                                  </span>
                                  {isChecked && (
                                    <input type="number"
                                      value={inputVal || ''}
                                      max={dep.balance}
                                      min={1}
                                      onChange={e => {
                                        const v = Math.min(parseInt(e.target.value) || 0, dep.balance);
                                        setDepositLinkDraft(prev => ({ ...prev, [dep.id]: v }));
                                      }}
                                      onClick={e => e.stopPropagation()}
                                      style={{ width: '115px', padding: '4px 8px', fontSize: '12px', textAlign: 'right', borderRadius: '4px', border: '1px solid var(--primary)' }}
                                      placeholder="사용금액(원)"
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* 선택 합계 바 */}
                        <div style={{ marginTop: '10px', padding: '10px 16px', borderRadius: '8px', background: 'var(--bg-app)', border: `1px solid ${selectedTotal > unpaid ? '#EF4444' : selectedTotal === unpaid ? '#10B981' : 'var(--border)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>선택 합계</span>
                            <span style={{ marginLeft: '8px', fontSize: '16px', fontWeight: '700',
                              color: selectedTotal > unpaid ? '#EF4444' : selectedTotal === unpaid ? '#10B981' : 'var(--text-primary)' }}>
                              {selectedTotal.toLocaleString()}원
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>미납 {unpaid.toLocaleString()}원</span>
                            {selectedTotal === unpaid && <span style={{ fontSize: '12px', color: '#10B981', fontWeight: '700' }}>✅ 완납</span>}
                            {selectedTotal > unpaid && <span style={{ fontSize: '12px', color: '#EF4444', fontWeight: '700' }}>⚠️ 미납 초과</span>}
                            {selectedTotal > 0 && selectedTotal < unpaid && <span style={{ fontSize: '12px', color: '#F59E0B', fontWeight: '600' }}>⚡ 부분수납</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <label>수납 방법</label>
                      <select value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                        <option value="BANK_TRANSFER">통장 송금 (Bank Transfer)</option>
                        <option value="CARD">카드 결제</option>
                        <option value="CASH">현금 수납</option>
                      </select>
                    </div>
                    <div>
                      <label>수납 처리액 (원) *</label>
                      <input type="number" value={directAmount || ''} onChange={e => setDirectAmount(parseInt(e.target.value) || 0)} required />
                    </div>
                  </>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label>수납 일자</label>
                    <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} required />
                  </div>
                  <div>
                    <label>비고</label>
                    <input type="text" value={payMemo} onChange={e => setPayMemo(e.target.value)}
                      placeholder={payMode === 'DEPOSIT' ? '(자동 입력됨)' : '예: 김민수 현금 납부'} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '4px', borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowPayModal(false)}>취소</button>
                <button type="submit" className="btn-primary"
                  disabled={payMode === 'DEPOSIT' && selectedTotal <= 0}>
                  수납 완료 처리
                </button>
              </div>
            </form>
          </div>
        );
      })()}




      {/* (주)기연엘리베이터 표준 거래명세서 메일 발송 모달 */}
      {showMailModal && (() => {
        const targetBilling = billings.find(b => b.id === mailBillingId);
        const targetDetails = billingDetails.filter(d => d.billingId === mailBillingId);
        const targetCust = customers.find(c => c.id === targetBilling?.customerId);
        const targetContract = contracts.find(c => c.id === targetBilling?.contractId);
        
        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
          }}>
            <form onSubmit={handleSendStatementSubmit} className="card" style={{ width: '100%', maxWidth: '680px', backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '12px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <h3 className="card-title" style={{ margin: 0, fontSize: '17px', fontWeight: '700' }}>
                  📄 (주)기연리프트 표준 거래명세서 이메일 발송
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>메일 제목 *</label>
                  <input
                    type="text"
                    value={mailSubject}
                    onChange={e => setMailSubject(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                    수신인 이메일 (To) * <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 'normal' }}>(고객대표 및 담당자 이메일 자동 채움 / 자유 수정 및 쉼표 추가 가능)</span>
                  </label>
                  <input
                    type="text"
                    value={mailTo}
                    onChange={e => setMailTo(e.target.value)}
                    placeholder="email1@company.com, email2@company.com"
                    required
                    style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                    참조인 이메일 (CC) <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'normal' }}>(선택 입력 / 쉼표로 다수 지정 가능)</span>
                  </label>
                  <input
                    type="text"
                    value={mailCc}
                    onChange={e => setMailCc(e.target.value)}
                    placeholder="cc1@company.com, cc2@company.com"
                    style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', marginTop: '4px' }}
                  />
                </div>

                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontWeight: '600' }}>💡 거래명세서 메일 자동 생성 안내</span>
                  <span>- 발송 시 (주)기연리프트 표준 거래명세서 양식(공급자/공급받는자 정보, 세부 품목별 날짜/적용단가/공급가액/부가세)이 메일 본문에 100% 자동 생성되어 전달됩니다.</span>
                </div>
              </div>


              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowMailModal(false)}>취소</button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={async () => {
                    const site = sites.find(s => s.id === targetContract?.siteId);
                    const salesperson = users.find((u: any) => u.id === targetContract?.salespersonId);
                    const custName = targetCust?.name || '고객사';
                    const sName = site?.name || '현장';
                    const ym = targetBilling?.billingYm || '';
                    const fileName = `${custName}_${sName}_${ym}`;
                    // Supabase google_configs 에 저장된 구글 드라이브 양식 URL 사용
                    const templateUrl = undefined /* CF R2 마스터 xlsx로 대체됨 */;
                    try {
                      await exportTransactionStatementExcel(
                        targetBilling,
                        targetDetails,
                        targetCust,
                        targetContract,
                        site,
                        salesperson,
                        fileName,
                        templateUrl
                      );
                    } catch (e: any) {
                      showErrorModal('엑셀 거래명세서 생성 실패: ' + (e?.message || String(e)));
                    }
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}
                >
                  <FileText size={14} /> 엑셀 다운로드 (.xlsx)
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={printStatementAsPdf}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}
                >
                  <Download size={14} /> PDF 다운로드
                </button>
                <button type="submit" className="btn-success" disabled={isSending} style={{ fontWeight: 'bold' }}>
                  {isSending ? '발송 중...' : <><Send size={14} /> 거래명세서 이메일 전송</>}
                </button>
              </div>
            </form>
          </div>
        );
      })()}

      {/* 🔄 청구 수정 및 재생성 모달 (Regenerate Modal) */}
      {showRegenerateModal && (() => {
        const targetB = billings.find(b => b.id === regenBillingId);
        const targetCust = customers.find(c => c.id === targetB?.customerId);
        const totalCalcAmount = regenDetails.reduce((sum, d) => sum + (d.amount || ((d.quantity || 1) * (d.unitPrice || 0))), 0);

        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px'
          }}>
            <form onSubmit={handleRegenerateSubmit} className="card" style={{ width: '100%', maxWidth: '780px', backgroundColor: 'var(--bg-card)', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', borderRadius: '12px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <div>
                  <h3 className="card-title" style={{ margin: 0, fontSize: '17px', fontWeight: '700' }}>
                    🔄 청구서 내역 수정 및 재생성
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    고객사: <strong>{targetCust?.name || '고객사'}</strong> | 기존 청구: <strong style={{ color: 'var(--text-muted)' }}>{targetB?.id}</strong> ({targetB?.billingYm})
                  </div>
                </div>
                <span className="badge badge-warning">기존 건 자동 취소 후 재발행</span>
              </div>

              {/* 청구 연월 및 발행일자 수정 패널 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '12px', padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)' }}>청구귀속월 (YYYY-MM)</label>
                  <input
                    type="month"
                    value={regenBillingYm}
                    onChange={e => setRegenBillingYm(e.target.value)}
                    required
                    style={{ width: '100%', padding: '6px 8px', fontSize: '12.5px', borderRadius: '5px', border: '1px solid var(--border-color)' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)' }}>청구 발행일자</label>
                  <input
                    type="date"
                    value={regenBillingDate}
                    onChange={e => setRegenBillingDate(e.target.value)}
                    required
                    style={{ width: '100%', padding: '6px 8px', fontSize: '12.5px', borderRadius: '5px', border: '1px solid var(--border-color)' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)' }}>수정 재생성 사유</label>
                  <input
                    type="text"
                    value={regenMemo}
                    onChange={e => setRegenMemo(e.target.value)}
                    placeholder="예: 고객 요청에 따른 운송료 할인 조정"
                    style={{ width: '100%', padding: '6px 8px', fontSize: '12.5px', borderRadius: '5px', border: '1px solid var(--border-color)' }}
                  />
                </div>
              </div>

              {/* 세부 청구 품목 리스트 & 수정 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', margin: 0 }}>
                    📋 청구 항목 목록 ({regenDetails.length}건)
                  </label>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setRegenDetails([...regenDetails, {
                        contractAssetId: undefined,
                        itemName: '기타 추가/할인 항목',
                        quantity: 1,
                        unitPrice: 0,
                        amount: 0,
                        description: '수동 추가 항목'
                      }]);
                    }}
                    style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={12} /> + 항목 추가
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
                  {regenDetails.map((det, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '8px', alignItems: 'center', padding: '10px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <input
                          type="text"
                          value={det.itemName}
                          onChange={e => {
                            const updated = [...regenDetails];
                            updated[idx].itemName = e.target.value;
                            setRegenDetails(updated);
                          }}
                          placeholder="항목명"
                          style={{ padding: '4px 8px', fontSize: '12px', fontWeight: '600', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                        />
                        <input
                          type="text"
                          value={det.description || ''}
                          onChange={e => {
                            const updated = [...regenDetails];
                            updated[idx].description = e.target.value;
                            setRegenDetails(updated);
                          }}
                          placeholder="적용 기간/상세 설명"
                          style={{ padding: '3px 6px', fontSize: '11px', color: 'var(--text-secondary)', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>수량</label>
                        <input
                          type="number"
                          value={det.quantity || 1}
                          onChange={e => {
                            const q = parseInt(e.target.value) || 1;
                            const updated = [...regenDetails];
                            updated[idx].quantity = q;
                            updated[idx].amount = q * (updated[idx].unitPrice || 0);
                            setRegenDetails(updated);
                          }}
                          style={{ width: '100%', padding: '4px 6px', fontSize: '12px', textAlign: 'right', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>단가(원)</label>
                        <input
                          type="number"
                          value={det.unitPrice ?? 0}
                          onChange={e => {
                            const p = parseInt(e.target.value) || 0;
                            const updated = [...regenDetails];
                            updated[idx].unitPrice = p;
                            updated[idx].amount = (updated[idx].quantity || 1) * p;
                            setRegenDetails(updated);
                          }}
                          style={{ width: '100%', padding: '4px 6px', fontSize: '12px', textAlign: 'right', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                        />
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>금액</label>
                        <strong style={{ fontSize: '13px', color: (det.amount || 0) < 0 ? '#dc2626' : 'var(--text-primary)' }}>
                          {(det.amount || ((det.quantity || 1) * (det.unitPrice || 0))).toLocaleString()}원
                        </strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setRegenDetails(regenDetails.filter((_, i) => i !== idx));
                        }}
                        style={{ padding: '4px 8px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px' }}
                        title="항목 삭제"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 총액 요약 바 */}
              <div style={{ padding: '14px 18px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>재생성 최종 청구 합계</span>
                  <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>(VAT 별도 공급가액 기준)</span>
                </div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)' }}>
                  {totalCalcAmount.toLocaleString()}원
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowRegenerateModal(false)}>
                  취소
                </button>
                <button type="submit" className="btn-primary" disabled={isRegenerating || regenDetails.length === 0} style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <RotateCcw size={14} />
                  {isRegenerating ? '재생성 처리 중...' : '수정사항 반영 청구서 재생성'}
                </button>
              </div>

            </form>
          </div>
        );
      })()}

    </div>
  );
};
