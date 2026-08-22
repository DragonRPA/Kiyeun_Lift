import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { db, Todo, DelinquencyActionLog, Customer } from '../services/db';
import { 
  AlertTriangle, PhoneCall, Mail, CheckCircle, 
  Clock, Plus, Upload, Trash2, ArrowRight, UserCheck, ShieldAlert,
  Calendar, DollarSign, Award, ThumbsUp, ThumbsDown, Lock, Unlock, Search
} from 'lucide-react';

interface CalculatedDelinquency {
  id: string;
  customerId: string;
  customerName: string;
  bizRegNo?: string;
  transactionStatus: 'ALLOWED' | 'BLOCKED';
  responsibleEmployeeId: string;
  responsibleEmployeeName: string;
  totalOverdueAmount: number;
  oldestOverdueDate: string;
  overdueDays: number;
  status: 'ACTIVE' | 'RESOLVED';
  lastActionDate?: string;
  lastActionType?: string;
  unpaidBillingCount: number;
}

export const DelinquencyPage: React.FC = () => {
  const { 
    currentUser, hasPermission, billings, customers, users, contracts, 
    delinquencyActionLogs, saveDelinquencyAction, updateDelinquencyActionPromise,
    saveCustomer, refreshAllData, showErrorModal, todos
  } = useApp();
  const canSave = hasPermission('billing', 'save');

  // 선택된 연체 고객사
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OVERDUE_30' | 'OVERDUE_60' | 'BLOCKED'>('ALL');

  const [salesFilter, setSalesFilter] = useState('ALL');
  const [amountRangeFilter, setAmountRangeFilter] = useState('ALL');
  const [overdueStartDate, setOverdueStartDate] = useState('');
  const [overdueEndDate, setOverdueEndDate] = useState('');

  // 신규 조치 입력 폼
  const [newActionType, setNewActionType] = useState<'CALL' | 'NOTICE_SENT' | 'VISIT' | 'LEGAL'>('CALL');
  const [newActionDetails, setNewActionDetails] = useState('');
  const [proofFile, setProofFile] = useState<string>('');

  // 입금 약속 기입 폼
  const [hasPromise, setHasPromise] = useState(false);
  const [promiseDate, setPromiseDate] = useState('');
  const [promiseAmount, setPromiseAmount] = useState(0);
  const [promiseContactPerson, setPromiseContactPerson] = useState('');

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // 1. 실시간 DB(billings) 기반 연체 채권 고객사 집계
  const calculatedDelinquencies = useMemo(() => {
    const custMap = new Map<string, {
      totalOverdueAmount: number;
      oldestOverdueDate: string;
      unpaidBillingCount: number;
      salespersonId?: string;
    }>();

    // 미수금이 남아있는 청구서 추출
    billings.forEach(b => {
      if (b.status === 'REJECTED' || b.status === 'PAID') return;
      const unpaid = (b.totalAmount || 0) - (b.paidAmount || 0);
      if (unpaid <= 0) return;

      const billDate = b.billingDate || b.createdAt.split('T')[0];
      const custId = b.customerId;

      // 계약에서 영업담당자 추출
      const contract = contracts.find(c => c.id === b.contractId);
      const spId = contract?.salespersonId;

      if (!custMap.has(custId)) {
        custMap.set(custId, {
          totalOverdueAmount: unpaid,
          oldestOverdueDate: billDate,
          unpaidBillingCount: 1,
          salespersonId: spId
        });
      } else {
        const item = custMap.get(custId)!;
        item.totalOverdueAmount += unpaid;
        item.unpaidBillingCount += 1;
        if (billDate < item.oldestOverdueDate) {
          item.oldestOverdueDate = billDate;
        }
        if (!item.salespersonId && spId) {
          item.salespersonId = spId;
        }
      }
    });

    const result: CalculatedDelinquency[] = [];
    custMap.forEach((val, custId) => {
      const customer = customers.find(c => c.id === custId);
      if (!customer) return;

      const oldestDate = new Date(val.oldestOverdueDate);
      const diffMs = today.getTime() - oldestDate.getTime();
      const overdueDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      // 최근 조치 내역
      const custLogs = delinquencyActionLogs
        .filter(l => l.customerId === custId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const lastLog = custLogs[0];

      const salesperson = users.find(u => u.id === val.salespersonId);

      result.push({
        id: `del-${custId}`,
        customerId: custId,
        customerName: customer.name,
        bizRegNo: customer.bizRegNo,
        transactionStatus: customer.transactionStatus || 'ALLOWED',
        responsibleEmployeeId: val.salespersonId || 'unassigned',
        responsibleEmployeeName: salesperson?.name || '영업부',
        totalOverdueAmount: val.totalOverdueAmount,
        oldestOverdueDate: val.oldestOverdueDate,
        overdueDays,
        status: val.totalOverdueAmount > 0 ? 'ACTIVE' : 'RESOLVED',
        lastActionDate: lastLog ? lastLog.createdAt.split('T')[0] : undefined,
        lastActionType: lastLog ? (
          lastLog.actionType === 'CALL' ? '전화 독촉' :
          lastLog.actionType === 'NOTICE_SENT' ? '최고장 송달' :
          lastLog.actionType === 'VISIT' ? '방문 실사' : '법적 조치'
        ) : undefined,
        unpaidBillingCount: val.unpaidBillingCount
      });
    });

    return result.sort((a, b) => b.overdueDays - a.overdueDays);
  }, [billings, customers, users, contracts, delinquencyActionLogs, today]);

  // 필터링된 연체 목록
  const filteredDelinquencies = useMemo(() => {
    return calculatedDelinquencies.filter(d => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch = !q || 
        d.customerName.toLowerCase().includes(q) || 
        (d.bizRegNo && d.bizRegNo.includes(q)) ||
        d.responsibleEmployeeName.toLowerCase().includes(q);

      let matchesStatus = true;
      if (statusFilter === 'OVERDUE_30') matchesStatus = d.overdueDays >= 30;
      else if (statusFilter === 'OVERDUE_60') matchesStatus = d.overdueDays >= 60;
      else if (statusFilter === 'BLOCKED') matchesStatus = d.transactionStatus === 'BLOCKED';

      const matchesSales = salesFilter === 'ALL' || d.responsibleEmployeeId === salesFilter;
      
      let matchesAmount = true;
      if (amountRangeFilter === 'LT100') matchesAmount = d.totalOverdueAmount < 1000000;
      else if (amountRangeFilter === '100TO500') matchesAmount = d.totalOverdueAmount >= 1000000 && d.totalOverdueAmount <= 5000000;
      else if (amountRangeFilter === 'GT500') matchesAmount = d.totalOverdueAmount > 5000000;

      const matchesStartDate = !overdueStartDate || d.oldestOverdueDate >= overdueStartDate;
      const matchesEndDate = !overdueEndDate || d.oldestOverdueDate <= overdueEndDate;

      return matchesSearch && matchesStatus && matchesSales && matchesAmount && matchesStartDate && matchesEndDate;
    });
  }, [calculatedDelinquencies, searchTerm, statusFilter, salesFilter, amountRangeFilter, overdueStartDate, overdueEndDate]);

  const selectedDelinquency = calculatedDelinquencies.find(d => d.customerId === selectedCustomerId) || null;
  const selectedCustLogs = useMemo(() => {
    if (!selectedCustomerId) return [];
    return delinquencyActionLogs
      .filter(l => l.customerId === selectedCustomerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [delinquencyActionLogs, selectedCustomerId]);

  const handleSelectDelinquency = (del: CalculatedDelinquency) => {
    setSelectedCustomerId(del.customerId);
    setNewActionDetails('');
    setProofFile('');
    setHasPromise(false);
    setPromiseDate('');
    setPromiseAmount(0);
    setPromiseContactPerson('');
  };

  // 조치 기록 및 상담 약속 등록
  const handleRegisterAction = async () => {
    if (!selectedDelinquency) return;
    if (!newActionDetails.trim()) {
      alert('상담 조치 상세 내역을 입력해 주십시오.');
      return;
    }

    try {
      await saveDelinquencyAction({
        customerId: selectedDelinquency.customerId,
        actionType: newActionType,
        actionDetails: `${promiseContactPerson ? `[대상: ${promiseContactPerson}] ` : ''}${newActionDetails}`,
        proofFileName: proofFile || undefined,
        recordedBy: currentUser?.name || '담당영업',
        mandateType: 'CEO_AUTO_MANDATE',
        promiseDate: hasPromise ? promiseDate : undefined,
        promiseAmount: hasPromise ? promiseAmount : undefined,
        promiseStatus: hasPromise ? 'PENDING' : undefined,
        promiseContactPerson: promiseContactPerson || undefined
      });

      // 관련 미완료 ToDo가 있다면 완료 처리
      const relatedTodos = db.todos.filter(t => t.relatedEntityId === selectedDelinquency.customerId && !t.isCompleted);
      relatedTodos.forEach(t => {
        db.updateRow<Todo>('todos', t.id, { isCompleted: true });
      });
      await db.awaitPendingWrites();

      alert(`✅ 상담 및 조치사항이 등록되었습니다.${hasPromise ? '\n지정된 수납 약속일정에 맞게 자동 입금 대조 엔진이 가동됩니다.' : ''}`);
      setNewActionDetails('');
      setProofFile('');
      setHasPromise(false);
    } catch (err: any) {
      showErrorModal(`조치 등록 실패: ${err?.message || err}`);
    }
  };

  // 거래 차단(BLOCKED) 상태 토글
  const handleToggleCustomerBlock = async (cust: CalculatedDelinquency) => {
    const isCurrentlyBlocked = cust.transactionStatus === 'BLOCKED';
    const nextStatus = isCurrentlyBlocked ? 'ALLOWED' : 'BLOCKED';
    const confirmMsg = isCurrentlyBlocked
      ? `[${cust.customerName}] 거래처의 거래 차단을 해제하고 정상 거래(ALLOWED)로 전환하시겠습니까?`
      : `⚠️ [${cust.customerName}] 거래처를 거래 불가(BLOCKED) 상태로 전환하시겠습니까?\n\n차단 시 신규 계약 체결 및 스마트 출고가 원천 금지됩니다.`;

    try {
      const existingCustomer = customers.find(c => c.id === cust.customerId);
      if (!existingCustomer) throw new Error('고객사를 찾을 수 없습니다.');

      await saveCustomer({
        ...existingCustomer,
        transactionStatus: nextStatus
      });
      alert(`거래처 상태가 [${nextStatus === 'BLOCKED' ? '거래 불가(BLOCKED)' : '정상 거래(ALLOWED)'}]로 변경되었습니다.`);
    } catch (err: any) {
      showErrorModal(`거래처 상태 변경 실패: ${err?.message || err}`);
    }
  };

  // 입금 약속 준수/파기 상태 변경
  const handleUpdatePromiseStatus = async (logId: string, status: 'KEPT' | 'BROKEN') => {
    try {
      await updateDelinquencyActionPromise(logId, status);
      if (status === 'BROKEN') {
        alert(`🚨 [입금 약속 위반 처리]\n약속 상태가 [위반(BROKEN)]으로 기록되었습니다.`);
      } else {
        alert(`🟢 [입금 약속 이행 완료]\n약속 상태가 [이행 완료(KEPT)]로 기록되었습니다.`);
      }
    } catch (err: any) {
      showErrorModal(`약속 상태 갱신 실패: ${err?.message || err}`);
    }
  };

  // 통계 지표 연산
  const totalPromises = delinquencyActionLogs.filter(l => l.promiseStatus).length;
  const keptPromises = delinquencyActionLogs.filter(l => l.promiseStatus === 'KEPT').length;
  const brokenPromises = delinquencyActionLogs.filter(l => l.promiseStatus === 'BROKEN').length;
  const pendingPromises = delinquencyActionLogs.filter(l => l.promiseStatus === 'PENDING').length;
  const totalDecided = keptPromises + brokenPromises;
  const promiseKeptRate = totalDecided > 0 ? Math.round((keptPromises / totalDecided) * 100) : 0;

  const totalOverdueSum = calculatedDelinquencies.reduce((acc, d) => acc + d.totalOverdueAmount, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontSize: '13px' }}>
      
      {/* 상단 타이틀 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={24} color="var(--danger)" />
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>연체 채권 관리</h2>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary" onClick={() => refreshAllData()} style={{ fontSize: '12px', padding: '6px 12px' }}>
            새로고침
          </button>
        </div>
      </div>

      {/* KPI 지표 요약판 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>총 연체 채권액</span>
            <DollarSign size={16} color="var(--danger)" />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '4px 0', color: 'var(--danger)' }}>
            ₩ {totalOverdueSum.toLocaleString()}원
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>연체 거래처 {calculatedDelinquencies.length}개사</span>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>입금 약속 등록</span>
            <Calendar size={16} color="var(--primary)" />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '4px 0' }}>
            {totalPromises}건
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>진행중: {pendingPromises}건</span>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>약속 준수 (Kept)</span>
            <ThumbsUp size={16} color="var(--success)" />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '4px 0', color: 'var(--success)' }}>
            {keptPromises}건
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>정상 이행 완료 건</span>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>약속 위반 (Broken)</span>
            <ThumbsDown size={16} color="var(--danger)" />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '4px 0', color: 'var(--danger)' }}>
            {brokenPromises}건
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>기한 초과 위반 건</span>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>약속 이행률</span>
            <Award size={16} color="var(--primary)" />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '4px 0', color: promiseKeptRate >= 70 ? 'var(--success)' : 'var(--danger)' }}>
            {promiseKeptRate}%
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>확정 {totalDecided}건 중 준수율</span>
        </div>
      </div>

      {/* 2열 메인 레이아웃 (좌측: 연체 대장 목록 / 우측: 상담 조치 및 약속 등록) */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedDelinquency ? '1.2fr 1fr' : '1fr', gap: '16px' }}>
        
        {/* [좌측 패널] 연체 채권 관리 대장 */}
        <div className="card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={16} color="var(--danger)" /> 연체 채권 관리 대장 ({filteredDelinquencies.length}건)
            </h3>

            {/* 필터 칩 */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button 
                className={statusFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'} 
                onClick={() => setStatusFilter('ALL')}
                style={{ fontSize: '11.5px', padding: '4px 8px' }}
              >
                전체
              </button>
              <button 
                className={statusFilter === 'OVERDUE_30' ? 'btn-primary' : 'btn-secondary'} 
                onClick={() => setStatusFilter('OVERDUE_30')}
                style={{ fontSize: '11.5px', padding: '4px 8px' }}
              >
                30일 이상
              </button>
              <button 
                className={statusFilter === 'OVERDUE_60' ? 'btn-primary' : 'btn-secondary'} 
                onClick={() => setStatusFilter('OVERDUE_60')}
                style={{ fontSize: '11.5px', padding: '4px 8px' }}
              >
                60일 이상
              </button>
              <button 
                className={statusFilter === 'BLOCKED' ? 'btn-primary' : 'btn-secondary'} 
                onClick={() => setStatusFilter('BLOCKED')}
                style={{ fontSize: '11.5px', padding: '4px 8px', color: 'var(--danger)' }}
              >
                거래차단(BLOCKED)
              </button>
            </div>
          </div>

          {/* 검색창 */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="고객사명, 사업자번호, 담당영업사원 검색..."
              style={{ width: '100%', padding: '7px 10px 7px 30px', fontSize: '12.5px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
            />
          </div>

          {/* 확장 필터 UI */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: '10px', backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', display: 'block', whiteSpace: 'nowrap', flexShrink: 0 }}>담당영업사원</label>
              <select value={salesFilter} onChange={e => setSalesFilter(e.target.value)} style={{ padding: '6px', fontSize: '12.5px', width: '100%' }}>
                <option value="ALL">전체</option>
                {users.filter(u => u.role === 'SALES').map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', display: 'block', whiteSpace: 'nowrap', flexShrink: 0 }}>연체총액구간</label>
              <select value={amountRangeFilter} onChange={e => setAmountRangeFilter(e.target.value)} style={{ padding: '6px', fontSize: '12.5px', width: '100%' }}>
                <option value="ALL">전체</option>
                <option value="LT100">100만미만</option>
                <option value="100TO500">100~500만</option>
                <option value="GT500">500만초과</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', display: 'block', whiteSpace: 'nowrap', flexShrink: 0 }}>최초연체일</label>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input type="date" value={overdueStartDate} onChange={e => setOverdueStartDate(e.target.value)} style={{ padding: '6px', fontSize: '12.5px', width: '100%' }} />
                <span>~</span>
                <input type="date" value={overdueEndDate} onChange={e => setOverdueEndDate(e.target.value)} style={{ padding: '6px', fontSize: '12.5px', width: '100%' }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '4px' }}>
              <button 
                type="button" 
                className="btn-secondary"
                onClick={() => {
                  setSalesFilter('ALL');
                  setAmountRangeFilter('ALL');
                  setOverdueStartDate('');
                  setOverdueEndDate('');
                }}
                style={{ padding: '6px 12px', height: '31px', fontSize: '12.5px' }}
              >
                초기화
              </button>
            </div>
          </div>

          {/* 데이터 테이블 */}
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', whiteSpace: 'nowrap' }}>고객사</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>연체 총액</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>최초 연체일</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>경과일</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>담당 영업</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>거래 상태</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>최근 조치</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {filteredDelinquencies.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      현재 기준 연체 중인 고객사 채권이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredDelinquencies.map(del => {
                    const isSelected = selectedCustomerId === del.customerId;
                    return (
                      <tr 
                        key={del.id}
                        onClick={() => handleSelectDelinquency(del)}
                        style={{ 
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'rgba(59,130,246,0.08)' : undefined,
                          borderBottom: '1px solid var(--border-color)'
                        }}
                      >
                        <td style={{ padding: '8px 10px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                          {del.customerName}
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block' }}>
                            미수 {del.unpaidBillingCount}건
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: 'var(--danger)', whiteSpace: 'nowrap' }}>
                          ₩ {del.totalOverdueAmount.toLocaleString()}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                          {del.oldestOverdueDate}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{ 
                            padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold',
                            backgroundColor: del.overdueDays >= 60 ? 'rgba(239,68,68,0.15)' : del.overdueDays >= 30 ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.1)',
                            color: del.overdueDays >= 60 ? '#dc2626' : del.overdueDays >= 30 ? '#d97706' : '#2563eb'
                          }}>
                            {del.overdueDays}일
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {del.responsibleEmployeeName}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {del.transactionStatus === 'BLOCKED' ? (
                            <span style={{ color: '#dc2626', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Lock size={12} /> 차단됨
                            </span>
                          ) : (
                            <span style={{ color: '#16a34a', fontSize: '11px' }}>정상</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {del.lastActionDate ? (
                            <span style={{ fontSize: '11px' }}>
                              {del.lastActionType} ({del.lastActionDate.slice(5)})
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>미조치</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button
                            className="btn-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleCustomerBlock(del);
                            }}
                            title={del.transactionStatus === 'BLOCKED' ? '차단 해제' : '거래 차단'}
                            style={{ padding: '3px 6px', fontSize: '11px', color: del.transactionStatus === 'BLOCKED' ? 'var(--success)' : 'var(--danger)' }}
                          >
                            {del.transactionStatus === 'BLOCKED' ? <Unlock size={12} /> : <Lock size={12} />}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* [우측 패널] 상담 조치 등록 및 약속 이행 타임라인 */}
        {selectedDelinquency && (
          <div className="card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: 'var(--primary)' }}>
                  {selectedDelinquency.customerName}
                </h3>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  연체 {selectedDelinquency.overdueDays}일차 | 미수 총액: ₩{selectedDelinquency.totalOverdueAmount.toLocaleString()}원
                </span>
              </div>
              <button 
                className="btn-secondary" 
                onClick={() => setSelectedCustomerId(null)}
                style={{ fontSize: '11px', padding: '3px 8px' }}
              >
                닫기
              </button>
            </div>

            {/* 신규 상담 조치 등록 폼 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 'bold', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={14} color="var(--primary)" /> 채권 상담 및 조치사항 기록
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>조치 유형</label>
                  <select 
                    value={newActionType} 
                    onChange={e => setNewActionType(e.target.value as any)}
                    style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                  >
                    <option value="CALL">전화 독촉 (CALL)</option>
                    <option value="NOTICE_SENT">최고장 송달 (NOTICE)</option>
                    <option value="VISIT">현장 방문 실사 (VISIT)</option>
                    <option value="LEGAL">법적 조치 착수 (LEGAL)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>면담/통화 상대방</label>
                  <input
                    type="text"
                    value={promiseContactPerson}
                    onChange={e => setPromiseContactPerson(e.target.value)}
                    placeholder="예: 현장 박소장, 본사 회계팀"
                    style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>조치 상세 내용</label>
                <textarea
                  value={newActionDetails}
                  onChange={e => setNewActionDetails(e.target.value)}
                  placeholder="통화 내용, 회수 협의 사항, 방문 실사 결과 등 상세 기록..."
                  rows={3}
                  style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                />
              </div>

              {/* 입금 약속 체크박스 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                <input
                  type="checkbox"
                  id="hasPromiseCheck"
                  checked={hasPromise}
                  onChange={e => setHasPromise(e.target.checked)}
                />
                <label htmlFor="hasPromiseCheck" style={{ fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                  📌 거래처에서 특정 일자 입금을 약속함 (입금 약속 추적 등록)
                </label>
              </div>

              {hasPromise && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '8px', borderRadius: '6px', backgroundColor: 'var(--bg-app)', border: '1px dashed var(--primary)' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>약속 입금일자</label>
                    <input
                      type="date"
                      value={promiseDate}
                      onChange={e => setPromiseDate(e.target.value)}
                      style={{ width: '100%', padding: '5px', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>약속 입금금액 (원)</label>
                    <input
                      type="number"
                      value={promiseAmount}
                      onChange={e => setPromiseAmount(Number(e.target.value))}
                      placeholder="0"
                      style={{ width: '100%', padding: '5px', fontSize: '12px' }}
                    />
                  </div>
                </div>
              )}

              <button
                className="btn-primary"
                onClick={handleRegisterAction}
                style={{ padding: '8px', fontSize: '12.5px', fontWeight: 'bold', marginTop: '4px' }}
              >
                <CheckCircle size={14} /> 조치사항 저장 및 등록
              </button>
            </div>

            {/* 상담 및 약속 이행 이력 타임라인 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={14} /> 상담 및 조치 이력 ({selectedCustLogs.length}건)
              </div>

              {selectedCustLogs.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  아직 등록된 상담 조치 이력이 없습니다.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                  {selectedCustLogs.map(log => {
                    const isPromise = Boolean(log.promiseStatus);
                    return (
                      <div 
                        key={log.id}
                        style={{ 
                          padding: '10px 12px', borderRadius: '6px', 
                          backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                          fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                            [{log.actionType === 'CALL' ? '전화 독촉' : log.actionType === 'NOTICE_SENT' ? '최고장 송달' : log.actionType === 'VISIT' ? '방문 실사' : '법적 조치'}] {log.recordedBy}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {log.createdAt.substring(0, 16).replace('T', ' ')}
                          </span>
                        </div>

                        <div style={{ color: 'var(--text-main)', lineHeight: '1.4' }}>
                          {log.actionDetails}
                        </div>

                        {/* 입금 약속 배지 및 조작 */}
                        {isPromise && (
                          <div style={{ 
                            marginTop: '6px', padding: '6px 8px', borderRadius: '4px',
                            backgroundColor: log.promiseStatus === 'KEPT' ? 'rgba(34,197,94,0.1)' : log.promiseStatus === 'BROKEN' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
                            border: `1px solid ${log.promiseStatus === 'KEPT' ? 'rgba(34,197,94,0.3)' : log.promiseStatus === 'BROKEN' ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)'}`,
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                          }}>
                            <div>
                              <strong style={{ color: log.promiseStatus === 'KEPT' ? '#16a34a' : log.promiseStatus === 'BROKEN' ? '#dc2626' : '#2563eb' }}>
                                📌 입금 약속: {log.promiseDate} (₩{log.promiseAmount?.toLocaleString()}원)
                              </strong>
                              <span style={{ fontSize: '11px', marginLeft: '6px' }}>
                                [{log.promiseStatus === 'KEPT' ? '이행 완료' : log.promiseStatus === 'BROKEN' ? '약속 파기' : '대기중'}]
                              </span>
                            </div>

                            {log.promiseStatus === 'PENDING' && (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                  className="btn-secondary"
                                  onClick={() => handleUpdatePromiseStatus(log.id, 'KEPT')}
                                  style={{ padding: '2px 6px', fontSize: '11px', color: 'var(--success)' }}
                                >
                                  준수(KEPT)
                                </button>
                                <button
                                  className="btn-secondary"
                                  onClick={() => handleUpdatePromiseStatus(log.id, 'BROKEN')}
                                  style={{ padding: '2px 6px', fontSize: '11px', color: 'var(--danger)' }}
                                >
                                  파기(BROKEN)
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

      </div>

    </div>
  );
};
