import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Receivable } from '../services/db';
import { Plus, Search, DollarSign, Calendar, FileText, CheckCircle, AlertTriangle, RotateCcw } from 'lucide-react';

export const Receivables: React.FC = () => {
  const {
    receivables, contracts, customers, sites,
    addReceivable, generateStandaloneBillingForReceivable, hasPermission
  } = useApp();

  // 임시 필터 상태
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempFilterType, setTempFilterType] = useState<string>('ALL');
  const [tempFilterStatus, setTempFilterStatus] = useState<string>('PENDING_PARTIAL'); // 미청구+일부청구
  const [tempCustomerId, setTempCustomerId] = useState<string>('ALL');
  const [tempStartDate, setTempStartDate] = useState<string>('');
  const [tempEndDate, setTempEndDate] = useState<string>('');

  // 적용된 필터 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('PENDING_PARTIAL');
  const [customerId, setCustomerId] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [showAddModal, setShowAddModal] = useState(false);

  // 폼 상태
  const [formContractId, setFormContractId] = useState('');
  const [formType, setFormType] = useState<'TRANSPORT' | 'REPAIR' | 'CLEANING' | 'OTHER'>('OTHER');
  const [formTotalAmount, setFormTotalAmount] = useState(0);
  const [formInternalDescription, setFormInternalDescription] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formOccurredDate, setFormOccurredDate] = useState(new Date().toISOString().split('T')[0]);

  const canWrite = hasPermission('BILLING', 'save');

  const handleApplyFilter = () => {
    setSearchTerm(tempSearchTerm);
    setFilterType(tempFilterType);
    setFilterStatus(tempFilterStatus);
    setCustomerId(tempCustomerId);
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
  };

  const handleResetFilter = () => {
    setTempSearchTerm('');
    setTempFilterType('ALL');
    setTempFilterStatus('PENDING_PARTIAL');
    setTempCustomerId('ALL');
    setTempStartDate('');
    setTempEndDate('');

    setSearchTerm('');
    setFilterType('ALL');
    setFilterStatus('PENDING_PARTIAL');
    setCustomerId('ALL');
    setStartDate('');
    setEndDate('');
  };

  const filtered = receivables.filter(r => {
    // 텍스트 검색
    if (searchTerm) {
      const c = contracts.find(x => x.id === r.contractId);
      const cu = customers.find(x => x.id === r.customerId);
      const s = c?.siteId ? sites.find(x => x.id === c.siteId) : null;
      const term = searchTerm.toLowerCase();
      const matchText = (
        r.internalDescription.toLowerCase().includes(term) ||
        (r.displayName || '').toLowerCase().includes(term) ||
        (c?.contractNo || '').toLowerCase().includes(term) ||
        (cu?.name || '').toLowerCase().includes(term) ||
        (s?.name || '').toLowerCase().includes(term)
      );
      if (!matchText) return false;
    }

    // 고객사 필터
    if (customerId !== 'ALL') {
      const c = contracts.find(x => x.id === r.contractId);
      const actualCustId = r.customerId || c?.customerId;
      if (actualCustId !== customerId) return false;
    }

    // 유형 필터
    if (filterType !== 'ALL' && r.type !== filterType) return false;

    // 상태 필터
    if (filterStatus === 'PENDING_PARTIAL') {
      if (r.status === 'CLEARED') return false;
    } else if (filterStatus !== 'ALL') {
      if (r.status !== filterStatus) return false;
    }

    // 기간 필터 (발생일 기준)
    if (startDate && r.occurredDate < startDate) return false;
    if (endDate && r.occurredDate > endDate) return false;

    return true;
  }).sort((a: any, b: any) => new Date(b.occurredDate).getTime() - new Date(a.occurredDate).getTime());

  // 집계 데이터
  const totalReceivableSum = filtered.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
  const totalBilledSum = filtered.reduce((sum, r) => sum + (r.billedAmount || 0), 0);
  const totalRemainingSum = Math.max(0, totalReceivableSum - totalBilledSum);

  const [continuousMode, setContinuousMode] = useState(false);

  const handleStandaloneIssue = async (receivableId: string) => {
    if (!hasPermission('billing', 'save')) {
      alert('청구 권한이 없습니다.');
      return;
    }

    const rcv = receivables.find(r => r.id === receivableId);
    if (!rcv) return;
    if (rcv.status === 'CLEARED') {
      alert('이미 전액 청구 완료된 항목입니다.');
      return;
    }

    const remaining = rcv.totalAmount - rcv.billedAmount;
    const reason = prompt(`[긴급 단독 청구 발행]\n\n해당 부대비용(${remaining.toLocaleString()}원)을 렌탈료 정기 청구서와 별개로 '단독 청구서'로 즉시 발행합니다.\n단독 발행 사유를 간략히 입력해주세요. (예: 파손수리비 긴급 수금건)`);
    if (reason === null) return; // 취소

    try {
      await generateStandaloneBillingForReceivable(receivableId, reason || '부대비용 단독 청구');
      alert('✅ 단독 청구서가 성공적으로 생성되었습니다.\n[청구 및 수납 내역] 탭에서 확인하실 수 있습니다.');
    } catch (err: any) {
      alert(`⚠️ 단독 청구서 발행 실패:\n\n${err?.message || err}`);
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    
    if (formTotalAmount <= 0) {
      alert('외상 총액은 0원보다 커야 합니다.');
      return;
    }
    if (!formInternalDescription.trim()) {
      alert('내부 장부 기재명을 입력해주세요.');
      return;
    }

    const c = contracts.find(x => x.id === formContractId);
    
    addReceivable({
      contractId: formContractId || undefined,
      customerId: c ? c.customerId : undefined,
      type: formType,
      totalAmount: formTotalAmount,
      billedAmount: 0,
      internalDescription: formInternalDescription,
      displayName: formDisplayName || undefined,
      occurredDate: formOccurredDate,
      status: 'PENDING'
    });

    if (!continuousMode) {
      alert('외상미수금이 등록되었습니다.');
      setShowAddModal(false);
    } else {
      const toast = document.createElement('div');
      toast.innerText = '✅ 등록 완료 (연속 등록 모드)';
      toast.style.cssText = 'position:fixed; bottom:20px; right:20px; background:#4ade80; color:white; padding:10px 20px; border-radius:8px; z-index:9999; font-weight:bold;';
      document.body.appendChild(toast);
      setTimeout(() => document.body.removeChild(toast), 2000);
    }
    
    // 폼 초기화
    setFormContractId('');
    setFormType('OTHER');
    setFormTotalAmount(0);
    setFormInternalDescription('');
    setFormDisplayName('');
    setFormOccurredDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 상단 타이틀 & 등록 버튼 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>외상미수금 대장</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            렌탈료 외 부대비용 (운송료, 수리비, 청소비 등) 분할 청산 관리
          </p>
        </div>
        <div>
          {canWrite && (
            <button className="btn-primary" onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={16} /> 신규 외상 등록
            </button>
          )}
        </div>
      </div>

      {/* 요약 현황 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div className="card" style={{ padding: '14px 18px', margin: 0 }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>조회 건수</div>
          <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '4px' }}>{filtered.length}건</div>
        </div>
        <div className="card" style={{ padding: '14px 18px', margin: 0 }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>외상 총액</div>
          <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '4px', color: 'var(--text-primary)' }}>₩{totalReceivableSum.toLocaleString()}</div>
        </div>
        <div className="card" style={{ padding: '14px 18px', margin: 0 }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>기청구액</div>
          <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '4px', color: 'var(--success)' }}>₩{totalBilledSum.toLocaleString()}</div>
        </div>
        <div className="card" style={{ padding: '14px 18px', margin: 0 }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>미청구 잔액</div>
          <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '4px', color: totalRemainingSum > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
            ₩{totalRemainingSum.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 조회 필터 패널 (카테고리 III 레이블 상하 스택 표준) */}
      <div className="card" style={{ margin: 0, padding: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* 통합 검색창 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)' }}>통합 검색</label>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="계약번호, 고객사명, 현장명, 내부 기재명..."
                value={tempSearchTerm}
                onChange={e => setTempSearchTerm(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleApplyFilter(); }}
                style={{ width: '100%', padding: '7px 10px 7px 32px', fontSize: '12.5px' }}
              />
            </div>
          </div>

          {/* 세부 필터 그리드 (상하 세로 스택 & 기간 추가) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', alignItems: 'flex-end' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>고객사</label>
              <select
                value={tempCustomerId}
                onChange={e => setTempCustomerId(e.target.value)}
                style={{ padding: '6px 8px', fontSize: '12px', width: '100%' }}
              >
                <option value="ALL">전체 고객사</option>
                {customers.map(cu => (
                  <option key={cu.id} value={cu.id}>{cu.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>비용 유형</label>
              <select
                value={tempFilterType}
                onChange={e => setTempFilterType(e.target.value)}
                style={{ padding: '6px 8px', fontSize: '12px', width: '100%' }}
              >
                <option value="ALL">전체 유형</option>
                <option value="TRANSPORT">운송료</option>
                <option value="REPAIR">수리비</option>
                <option value="CLEANING">청소비</option>
                <option value="OTHER">기타</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>청구 상태</label>
              <select
                value={tempFilterStatus}
                onChange={e => setTempFilterStatus(e.target.value)}
                style={{ padding: '6px 8px', fontSize: '12px', width: '100%' }}
              >
                <option value="PENDING_PARTIAL">미청구 잔액 있음</option>
                <option value="ALL">전체 상태</option>
                <option value="PENDING">미청구</option>
                <option value="PARTIAL">일부청구</option>
                <option value="CLEARED">청구완료 (전액)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>발생 시작일 (이후)</label>
              <input
                type="date"
                value={tempStartDate}
                onChange={e => setTempStartDate(e.target.value)}
                style={{ padding: '5px 8px', fontSize: '12px', width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>발생 종료일 (이전)</label>
              <input
                type="date"
                value={tempEndDate}
                onChange={e => setTempEndDate(e.target.value)}
                style={{ padding: '5px 8px', fontSize: '12px', width: '100%' }}
              />
            </div>

            {/* 조회 & 초기화 액션 버튼 */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={handleApplyFilter}
                style={{ padding: '6px 14px', fontSize: '12px', flex: 1, whiteSpace: 'nowrap' }}
              >
                조회
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleResetFilter}
                style={{ padding: '6px 10px', fontSize: '12px', whiteSpace: 'nowrap' }}
                title="필터 초기화"
              >
                <RotateCcw size={13} />
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* 데이터 테이블 카드 */}
      <div className="card" style={{ padding: 0, margin: 0, overflowX: 'auto' }}>
        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '1100px', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-app)', whiteSpace: 'nowrap' }}>
                <th style={{ whiteSpace: 'nowrap', textAlign: 'center', width: '90px' }}>발생일</th>
                <th style={{ whiteSpace: 'nowrap' }}>고객사명</th>
                <th style={{ whiteSpace: 'nowrap' }}>계약번호 / 현장</th>
                <th style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>유형</th>
                <th style={{ whiteSpace: 'nowrap' }}>내부 기재명 (실제 내역)</th>
                <th style={{ whiteSpace: 'nowrap' }}>명세서 표기명</th>
                <th style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>외상 총액</th>
                <th style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>기청구액</th>
                <th style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>미청구 잔액</th>
                <th style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>상태</th>
                <th style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>조치</th>
              </tr>
            </thead>
            <tbody style={{ whiteSpace: 'nowrap' }}>
              {filtered.map(r => {
                const c = contracts.find(x => x.id === r.contractId);
                const cu = customers.find(x => x.id === (r.customerId || c?.customerId));
                const s = c?.siteId ? sites.find(x => x.id === c.siteId) : null;
                const remaining = r.totalAmount - r.billedAmount;

                return (
                  <tr key={r.id}>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{r.occurredDate}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{cu?.name || '고객 미지정'}</strong>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {c ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{c.contractNo}</span>
                          {s && <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{s.name}</span>}
                        </div>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span className={`badge ${
                        r.type === 'REPAIR' ? 'badge-danger' :
                        r.type === 'TRANSPORT' ? 'badge-info' :
                        r.type === 'CLEANING' ? 'badge-warning' : 'badge-secondary'
                      }`} style={{ fontSize: '10.5px' }}>
                        {r.type === 'TRANSPORT' ? '운송료' :
                         r.type === 'REPAIR' ? '수리비' :
                         r.type === 'CLEANING' ? '청소비' : '기타'}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.internalDescription}</td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{r.displayName || '-'}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {r.totalAmount.toLocaleString()}원
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--success)' }}>
                      {r.billedAmount.toLocaleString()}원
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700, color: remaining > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                      {remaining.toLocaleString()}원
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span className={`badge ${
                        r.status === 'PENDING' ? 'badge-secondary' :
                        r.status === 'PARTIAL' ? 'badge-warning' : 'badge-success'
                      }`} style={{ fontSize: '10.5px' }}>
                        {r.status === 'PENDING' ? '미청구' :
                         r.status === 'PARTIAL' ? '일부청구' : '청구완료'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {r.status !== 'CLEARED' && (
                        <button
                          className="btn-secondary"
                          style={{ fontSize: '11px', padding: '2px 8px', color: 'var(--primary)', fontWeight: 600 }}
                          onClick={() => handleStandaloneIssue(r.id)}
                        >
                          단독 청구
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                    조회된 외상미수금 내역이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="modal-backdrop-custom">
          <div className="modal-content-custom" style={{ maxWidth: '600px' }}>
            <div className="modal-header-custom border-bottom pb-3 mb-3 d-flex justify-content-between align-items-center">
              <h5 className="mb-0 fw-bold">외상미수금 수동 등록</h5>
              <button type="button" className="btn-close" onClick={() => setShowAddModal(false)}></button>
            </div>
            
            <form onSubmit={handleAddSubmit}>
              <div className="row g-3 mb-4">
                <div className="col-12">
                  <label className="form-label text-sm fw-bold">발생일</label>
                  <input type="date" className="form-control form-control-sm" value={formOccurredDate} onChange={e => setFormOccurredDate(e.target.value)} required />
                </div>
                
                <div className="col-12">
                  <label className="form-label text-sm fw-bold">귀속 계약 (선택)</label>
                  <select className="form-select form-select-sm" value={formContractId} onChange={e => setFormContractId(e.target.value)}>
                    <option value="">계약 미지정 (고객사 공통)</option>
                    {contracts.filter(c => c.status !== 'COMPLETED').map(c => {
                      const cu = customers.find(x => x.id === c.customerId);
                      const s = sites.find(x => x.id === c.siteId);
                      return (
                        <option key={c.id} value={c.id}>
                          {cu?.name || '알수없음'} - {c.contractNo} {s ? `(${s.name})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label text-sm fw-bold">비용 유형</label>
                  <select className="form-select form-select-sm" value={formType} onChange={e => setFormType(e.target.value as any)}>
                    <option value="TRANSPORT">운송료</option>
                    <option value="REPAIR">수리비</option>
                    <option value="CLEANING">청소비</option>
                    <option value="OTHER">기타</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label text-sm fw-bold">외상 총액</label>
                  <div className="input-group input-group-sm">
                    <input type="number" className="form-control" value={formTotalAmount || ''} onChange={e => setFormTotalAmount(Number(e.target.value))} required />
                    <span className="input-group-text">원</span>
                  </div>
                </div>

                <div className="col-12">
                  <label className="form-label text-sm fw-bold">내부 장부 기재명 (실제 발생 내역)</label>
                  <input type="text" className="form-control form-control-sm" placeholder="예: 스카이잭 3219 현장 파손 수리비 (조이스틱 교체)" value={formInternalDescription} onChange={e => setFormInternalDescription(e.target.value)} required />
                </div>

                <div className="col-12">
                  <label className="form-label text-sm fw-bold text-primary">명세서 표기명 (고객 노출용 - 선택)</label>
                  <input type="text" className="form-control form-control-sm" placeholder="예: 렌탈 장비 정비료 (입력 안하면 내부 기재명 사용됨)" value={formDisplayName} onChange={e => setFormDisplayName(e.target.value)} />
                  <div className="form-text text-xs text-muted mt-1">고객에게 파손 등 민감한 단어를 노출하지 않을 때 우회 표기할 명칭을 적습니다.</div>
                </div>
              </div>

              <div className="d-flex justify-content-between align-items-center">
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" id="continuousMode" checked={continuousMode} onChange={e => setContinuousMode(e.target.checked)} />
                  <label className="form-check-label text-sm" htmlFor="continuousMode">저장 후 계속 등록 (연속 모드)</label>
                </div>
                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-light btn-sm" onClick={() => setShowAddModal(false)}>닫기</button>
                  <button type="submit" className="btn btn-primary btn-sm px-4">등록</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
