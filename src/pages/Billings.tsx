// d:\Kiyeun_Lift\src\pages\Billings.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { db, Asset, Billing, BillingDetail } from '../services/db';
import { Plus, Download, Mail, CheckCircle, Search, DollarSign, Calendar, FileText, Send, Edit3 } from 'lucide-react';
import { emailService } from '../services/email';
import { exportToExcel, exportTransactionStatementExcel, exportTransactionStatementExcelBuffer, calcServicePeriod } from '../services/excel';
import { downloadTransactionStatementPDF, generateTransactionStatementPdfBase64 } from '../services/pdf';

export const Billings: React.FC = () => {
  const {
    billings, billingDetails, customers, contacts, contracts, contractAssets, assets, sites, users, googleConfigs,
    generateBillingsForMonth, receivePayment, cancelPayment, hasPermission, currentUser, approveBilling, cancelBilling,
    refreshAllData, showErrorModal, bankTransactions, paymentDepositLinks, saveBankDeposit, deleteBankDeposit, payments
  } = useApp();


  const canSave = hasPermission('billing', 'save');
  const isAdmin = currentUser?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'LIST' | 'GENERATE' | 'WIZARD' | 'DEPOSIT_MGMT'>('LIST');

  // 통장입금 관리 탭 폼 상태
  const [depDate, setDepDate] = useState(new Date().toISOString().split('T')[0]);
  const [depSender, setDepSender] = useState('');
  const [depSenderAccount, setDepSenderAccount] = useState(''); // 입금자 계좌번호
  const [depCustomerId, setDepCustomerId] = useState('');
  const [depAmount, setDepAmount] = useState(0);
  const [depMemo, setDepMemo] = useState('');

  // --- 청구 조회 필터 상태 ---
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempContractNoFilter, setTempContractNoFilter] = useState('');
  const [tempBillingYmFilter, setTempBillingYmFilter] = useState('ALL');
  const [tempStatusFilter, setTempStatusFilter] = useState('ALL');

  const [searchTerm, setSearchTerm] = useState('');
  const [contractNoFilter, setContractNoFilter] = useState('');
  const [billingYmFilter, setBillingYmFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

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
  // v2: 다중 입금건 선택 상태 { txId → usedAmount }
  const [payMode, setPayMode] = useState<'DEPOSIT' | 'DIRECT'>('DEPOSIT');
  const [depositLinkDraft, setDepositLinkDraft] = useState<Record<string, number>>({}); // txId -> usedAmount
  const [directAmount, setDirectAmount] = useState(0); // 직접입력 모드 금액
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
    setBillingYmFilter(tempBillingYmFilter);
    setStatusFilter(tempStatusFilter);
  };

  const filteredBillings = billings.filter(b => {
    const custName = getCustName(b.customerId).toLowerCase();
    const contractObj = contracts.find(c => c.id === b.contractId);
    const contractNoStr = (contractObj?.contractNo || b.contractId || '').toLowerCase();

    const matchesSearch = custName.includes(searchTerm.toLowerCase());
    const matchesContractNo = !contractNoFilter || contractNoStr.includes(contractNoFilter.trim().toLowerCase());
    const matchesBillingYm = billingYmFilter === 'ALL' || b.billingYm === billingYmFilter;
    const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;

    return matchesSearch && matchesContractNo && matchesBillingYm && matchesStatus;
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
        '결제 상태': b.status === 'REQUESTED' ? '결재대기' : 
                   b.status === 'REJECTED' ? '취소됨' : 
                   b.status === 'PAID' ? '완납' : 
                   b.status === 'PARTIAL' ? '일부납' : '승인(미납)',
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


  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !payBillingId) return;

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
    const templateUrl = googleConfigs[0]?.transactionStatementTemplateUrl;
    const custName = customer?.name || '고객사';
    const sName = site?.name || '현장';
    const ym = billing?.billingYm || '';

    try {
      await downloadTransactionStatementPDF(
        billing, details, customer, contract, site, salesperson, templateUrl,
        `${custName}_${sName}_${ym}`
      );
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
    const templateUrl = googleConfigs[0]?.transactionStatementTemplateUrl;

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

      // 💡 100% 동일한 거래명세서 PDF 파일 자동 생성 (첨부파일용 Base64)
      const pdfResult = await generateTransactionStatementPdfBase64(
        billing, details, customer, contract, site, salesperson, templateUrl
      );

      await emailService.sendEmail(
        toList.join(', '),
        mailSubject,
        body,
        [{ filename: pdfResult.filename, content: pdfResult.base64 }],
        ccList.join(', ')
      );

      alert(`🎉 [${toList.join(', ')}] 수신자에게 거래명세서 PDF 파일이 첨부되어 성공적으로 실제 발송되었습니다.`);
      setShowMailModal(false);
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
    const isNotExpired = !c.endDate || c.endDate >= todayStr;
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
    const calcEnd = c.endDate && c.endDate < endStr ? c.endDate : endStr;
    
    setWizardStartDate(calcStart);
    setWizardEndDate(calcEnd);
    
    if (calcStart > startStr || (c.endDate && c.endDate < endStr)) {
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

      // 💡 헌장 5.2 준수: 원격 DB 저장을 동기로 대기하여 데이터 누락 및 무음 실패 100% 방지
      await db.awaitPendingWrites();

      refreshAllData();
      setSelectedContractIdForWizard(null);
      setExtraCharges([]);
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
        <button className={activeTab === 'LIST' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('LIST')}>
          청구 및 수납 내역
        </button>
        <button className={activeTab === 'DEPOSIT_MGMT' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('DEPOSIT_MGMT')}>
          🏦 통장입금 관리
        </button>
        {canSave && (
          <button className={activeTab === 'WIZARD' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('WIZARD')}>
            <Calendar size={14} /> 미청구 계약 정산 마법사
          </button>
        )}
      </div>

      {/* ═══ 통장입금 관리 탭 ═══ */}
      {activeTab === 'DEPOSIT_MGMT' && (() => {
        // 모든 입금 건 (isDeposit=true)
        const allDeposits = bankTransactions.filter(t => t.isDeposit);
        // 입금건별 잔액 계산 (PaymentDepositLinks 기반 — v2)
        const depositsWithBalance = allDeposits.map(dep => {
          const usedSoFar = paymentDepositLinks
            .filter(l => l.bankTransactionId === dep.id)
            .reduce((s, l) => s + l.usedAmount, 0);
          return { ...dep, usedAmount: usedSoFar, balance: dep.depositAmount - usedSoFar };
        }).sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));


        const handleDepositSubmit = (e: React.FormEvent) => {
          e.preventDefault();
          if (!depSender.trim() || depAmount <= 0) return;
          saveBankDeposit({
            transactionDate: depDate,
            senderName: depSender,
            senderAccount: depSenderAccount || undefined,
            depositAmount: depAmount,
            memo: depMemo,
            customerId: depCustomerId || undefined,
            isDeposit: true,
            matchedBillingId: undefined,
          });
          setDepSender('');
          setDepSenderAccount('');
          setDepAmount(0);
          setDepMemo('');
          setDepCustomerId('');
          alert('✅ 입금 내역이 등록되었습니다.');
        };

        return (
          <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px', alignItems: 'flex-start' }}>
            {/* 입금 등록 폼 */}
            <div className="card" style={{ margin: 0 }}>
              <h3 className="card-title" style={{ marginBottom: '16px' }}>통장입금 등록</h3>
              <form onSubmit={handleDepositSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label>입금일</label>
                  <input type="date" value={depDate} onChange={e => setDepDate(e.target.value)} required />
                </div>
                <div>
                  <label>입금인명 (통장 표시명) *</label>
                  <input type="text" value={depSender} onChange={e => setDepSender(e.target.value)} placeholder="예: 세보엠이씨" required />
                </div>
                <div>
                  <label>입금자 계좌번호 (선택)</label>
                  <input type="text" value={depSenderAccount} onChange={e => setDepSenderAccount(e.target.value)} placeholder="예: 110-123-456789" />
                </div>
                <div>
                  <label>고객사 매핑</label>
                  <select value={depCustomerId} onChange={e => setDepCustomerId(e.target.value)}>
                    <option value="">— 선택 안함 —</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label>입금액 (원) *</label>
                  <input type="number" value={depAmount || ''} onChange={e => setDepAmount(parseInt(e.target.value) || 0)} required />
                </div>
                <div>
                  <label>메모</label>
                  <input type="text" value={depMemo} onChange={e => setDepMemo(e.target.value)} placeholder="예: 7월 렌탈료" />
                </div>
                <button type="submit" className="btn-primary" style={{ marginTop: '4px' }}>
                  <Plus size={14} /> 입금 등록
                </button>
              </form>
            </div>

            {/* 입금 목록 + 잔액 */}
            <div className="card" style={{ margin: 0 }}>
              <h3 className="card-title" style={{ marginBottom: '16px' }}>
                입금 내역 및 잔액 현황
                <span style={{ marginLeft: '8px', fontSize: '12px', fontWeight: '400', color: 'var(--text-secondary)' }}>
                  총 {depositsWithBalance.length}건 | 미소진 잔액 합계: {depositsWithBalance.reduce((s, d) => s + d.balance, 0).toLocaleString()}원
                </span>
              </h3>
              {depositsWithBalance.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                  등록된 통장 입금 내역이 없습니다.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['입금일', '입금인', '계좌번호', '고객사', '입금액', '소진액', '잔액', '연결 청구번호', '상태', '삭제'].map(h => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {depositsWithBalance.map(dep => {
                        const custName = customers.find(c => c.id === dep.customerId)?.name || '미매핑';
                        const isExhausted = dep.balance <= 0;
                        // 이 입금건에 연결된 청구번호 목록 (PDL → Payment → Billing)
                        const linkedBillingNos = paymentDepositLinks
                          .filter(l => l.bankTransactionId === dep.id)
                          .map(l => payments.find(p => p.id === l.paymentId)?.billingId)
                          .map(bId => billings.find(b => b.id === bId)?.id || bId)
                          .filter((v, i, a): v is string => Boolean(v) && a.indexOf(v) === i); // 중복 제거
                        return (
                          <tr key={dep.id} style={{ borderBottom: '1px solid var(--border)', opacity: isExhausted ? 0.6 : 1 }}>
                            <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{dep.transactionDate.split(' ')[0]}</td>
                            <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                              <div style={{ fontWeight: '600' }}>{dep.senderName}</div>
                              {dep.memo && <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{dep.memo}</div>}
                            </td>
                            <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {dep.senderAccount || <span style={{ color: 'var(--text-muted)' }}>-</span>}
                            </td>
                            <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{custName}</td>
                            <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', textAlign: 'right' }}>{dep.depositAmount.toLocaleString()}원</td>
                            <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', textAlign: 'right', color: '#EF4444' }}>
                              {dep.usedAmount > 0 ? `-${dep.usedAmount.toLocaleString()}원` : '-'}
                            </td>
                            <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', textAlign: 'right', fontWeight: '700', color: isExhausted ? 'var(--text-muted)' : '#10B981' }}>
                              {dep.balance.toLocaleString()}원
                            </td>
                            <td style={{ padding: '8px 10px', minWidth: '100px' }}>
                              {linkedBillingNos.length > 0
                                ? linkedBillingNos.map(no => (
                                    <span key={no} style={{ fontSize: '11px', display: 'inline-block', marginRight: '4px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', border: '1px solid rgba(99,102,241,0.25)' }}>{no}</span>
                                  ))
                                : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>-</span>
                              }
                            </td>
                            <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                              {isExhausted
                                ? <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 7px' }}>소진완료</span>
                                : <span style={{ fontSize: '11px', color: '#10B981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '4px', padding: '2px 7px' }}>잔액있음</span>
                              }
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              {canSave && (
                                <button type="button"
                                  onClick={() => { try { deleteBankDeposit(dep.id); } catch (err: any) { showErrorModal(err.message, '삭제 불가'); } }}
                                  style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.07)', color: '#EF4444', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                  삭제
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {activeTab === 'LIST' && (

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

            {/* 필터 바 (상하 헤더 세로 스택 및 5열 배치) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '10px', alignItems: 'end', backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px', overflowX: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>고객사 검색</label>
                <input 
                  type="text" 
                  value={tempSearchTerm} 
                  onChange={e => setTempSearchTerm(e.target.value)} 
                  placeholder="고객사명 검색..."
                  style={{ width: '100%', padding: '6px 8px', fontSize: '12.5px', borderRadius: '5px', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>계약번호 검색</label>
                <input 
                  type="text" 
                  value={tempContractNoFilter} 
                  onChange={e => setTempContractNoFilter(e.target.value)} 
                  placeholder="계약번호 검색..."
                  style={{ width: '100%', padding: '6px 8px', fontSize: '12.5px', borderRadius: '5px', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>청구 월</label>
                <select 
                  value={tempBillingYmFilter} 
                  onChange={e => setTempBillingYmFilter(e.target.value)} 
                  style={{ width: '100%', padding: '6px 8px', fontSize: '12.5px', borderRadius: '5px', border: '1px solid var(--border-color)', backgroundColor: '#fff' }}
                >
                  <option value="ALL">전체 월</option>
                  {billingMonths.map(ym => (
                    <option key={ym} value={ym}>{ym}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>결제 상태</label>
                <select 
                  value={tempStatusFilter} 
                  onChange={e => setTempStatusFilter(e.target.value)} 
                  style={{ width: '100%', padding: '6px 8px', fontSize: '12.5px', borderRadius: '5px', border: '1px solid var(--border-color)', backgroundColor: '#fff' }}
                >
                  <option value="ALL">전체 상태</option>
                  <option value="REQUESTED">결재대기 (REQUESTED)</option>
                  <option value="UNPAID">미납 (UNPAID)</option>
                  <option value="PARTIAL">일부납 (PARTIAL)</option>
                  <option value="PAID">완납 (PAID)</option>
                  <option value="REJECTED">취소됨 (REJECTED)</option>
                </select>
              </div>
              <button 
                type="button" 
                className="btn-primary" 
                onClick={handleSearchClick}
                style={{ padding: '6px 14px', height: '33px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12.5px', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                조회
              </button>
            </div>

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
                      <td colSpan={6} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
                        {billings.length === 0
                          ? '📭 등록된 청구 내역이 없습니다.'
                          : '🔍 조회 조건에 맞는 청구 내역이 없습니다. 검색 조건을 변경해 보세요.'}
                      </td>
                    </tr>
                  ) : filteredBillings.map(b => {
                    const unpaid = b.totalAmount - b.paidAmount;
                    return (
                      <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedBillingId(b.id)}>
                        <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
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
                        <td style={{ whiteSpace: 'nowrap' }}><strong>{b.billingYm}</strong></td>
                        <td style={{ whiteSpace: 'nowrap' }}>{getCustName(b.customerId)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{b.totalAmount.toLocaleString()}원</td>
                        <td style={{ whiteSpace: 'nowrap', color: unpaid > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                          {unpaid.toLocaleString()}원
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
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
                <div className="card-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 className="card-title" style={{ margin: 0 }}>청구 명세서 ({activeBilling.billingYm})</h3>
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
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>발행일자: {activeBilling.billingDate}</span>
                  <button 
                    type="button" 
                    className="btn-primary"
                    onClick={() => handleOpenMail(activeBilling.id)}
                    style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}
                  >
                    <Mail size={13} /> 거래명세서 메일 발송
                  </button>
                </div>
                {activeBilling.status === 'REJECTED' && (
                  <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', borderLeft: '4px solid var(--danger)', marginBottom: '16px', borderRadius: '4px' }}>
                    <strong style={{ color: 'var(--danger)', fontSize: '14px', display: 'block', marginBottom: '4px' }}>[취소 사유]</strong>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{activeBilling.rejectReason || '사유 미기재'}</span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px', marginBottom: '20px' }}>
                  <div><label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>고객사명</label><strong>{getCustName(activeBilling.customerId)}</strong></div>
                  <div><label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>총 청구 금액</label><strong className="text-primary">{activeBilling.totalAmount.toLocaleString()}원</strong></div>
                  <div><label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>기수금액 (수납)</label>{activeBilling.paidAmount.toLocaleString()}원</div>
                  <div><label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>미수금 잔액</label><strong style={{ color: 'var(--danger)' }}>{(activeBilling.totalAmount - activeBilling.paidAmount).toLocaleString()}원</strong></div>
                </div>

                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px' }}>세부 청구 내역 및 생성 기준값</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {activeBillingDetails.map(bd => {
                    const ca = contractAssets.find(cAsset => cAsset.id === bd.contractAssetId);
                    const isMonthly = bd.description?.includes('월렌탈');
                    
                    return (
                      <div key={bd.id} style={{ padding: '12px 14px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px', backgroundColor: 'var(--bg-card)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '14px', marginBottom: '6px' }}>
                          <span>{bd.itemName}</span>
                          <span style={{ color: 'var(--primary)' }}>{bd.amount.toLocaleString()}원</span>
                        </div>
                        
                        {/* 청구 생성 기준값 명시적 표기 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 10px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', fontSize: '12px', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>📅 적용 기간/날짜:</span>
                            <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{bd.description || '정기 렌탈 기간'}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>💰 적용 렌탈 단가:</span>
                            {ca ? (
                              <span style={{ fontWeight: '600', color: isMonthly ? '#2563eb' : '#059669' }}>
                                {isMonthly
                                  ? `월단가 ${ca.monthlyRentalFee.toLocaleString()}원 적용 (월 정기)`
                                  : `일단가 ${ca.dailyRentalFee.toLocaleString()}원 적용 (일할 계산)`}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)' }}>{isMonthly ? '월단가 적용' : '일단가 일할 적용'}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '8px', alignItems: 'end', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
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
                    const templateUrl = googleConfigs[0]?.transactionStatementTemplateUrl;
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

    </div>
  );
};
