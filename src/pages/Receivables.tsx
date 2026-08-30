import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Receivable } from '../services/db';
import { Plus, Search, DollarSign, Calendar, FileText, CheckCircle, AlertTriangle } from 'lucide-react';

export const Receivables: React.FC = () => {
  const {
    receivables, contracts, customers, sites,
    addReceivable, generateStandaloneBillingForReceivable, hasPermission
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('PENDING_PARTIAL'); // 미청구+일부청구
  const [showAddModal, setShowAddModal] = useState(false);

  // 폼 상태
  const [formContractId, setFormContractId] = useState('');
  const [formType, setFormType] = useState<'TRANSPORT' | 'REPAIR' | 'CLEANING' | 'OTHER'>('OTHER');
  const [formTotalAmount, setFormTotalAmount] = useState(0);
  const [formInternalDescription, setFormInternalDescription] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formOccurredDate, setFormOccurredDate] = useState(new Date().toISOString().split('T')[0]);

  const canWrite = hasPermission('BILLING', 'WRITE');

  const filtered = receivables.filter(r => {
    // 텍스트 검색
    if (searchTerm) {
      const c = contracts.find(x => x.id === r.contractId);
      const cu = customers.find(x => x.id === r.customerId);
      const matchText = (
        r.internalDescription.includes(searchTerm) ||
        (r.displayName || '').includes(searchTerm) ||
        (c?.contractNo || '').includes(searchTerm) ||
        (cu?.name || '').includes(searchTerm)
      );
      if (!matchText) return false;
    }

    // 유형 필터
    if (filterType !== 'ALL' && r.type !== filterType) return false;

    // 상태 필터
    if (filterStatus === 'PENDING_PARTIAL') {
      if (r.status === 'CLEARED') return false;
    } else if (filterStatus !== 'ALL') {
      if (r.status !== filterStatus) return false;
    }

    return true;
  }).sort((a, b) => new Date(b.occurredDate).getTime() - new Date(a.occurredDate).getTime());

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
      // 연속 등록 모드일 때는 간단한 피드백만 제공하고 폼만 초기화
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
    <div className="space-y-6">
      <div className="d-flex justify-content-between align-items-center">
        <div>
          <h2 className="mb-1 text-2xl font-bold">외상미수금 대장</h2>
          <p className="text-gray-500 text-sm mb-0">렌탈료 외 부대비용(운송료, 수리비 등) 분할 청산 관리</p>
        </div>
        <div>
          {canWrite && (
            <button className="btn btn-primary d-flex align-items-center" onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              외상 건 등록
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {/* 필터부 */}
          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <label className="form-label text-xs fw-bold text-gray-500 mb-1">통합 검색</label>
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white"><Search className="w-4 h-4 text-gray-400" /></span>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="계약번호, 고객명, 내용..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-2">
              <label className="form-label text-xs fw-bold text-gray-500 mb-1">유형</label>
              <select className="form-select form-select-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="ALL">전체 유형</option>
                <option value="TRANSPORT">운송료</option>
                <option value="REPAIR">수리비</option>
                <option value="CLEANING">청소비</option>
                <option value="OTHER">기타</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label text-xs fw-bold text-gray-500 mb-1">상태</label>
              <select className="form-select form-select-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="ALL">전체 상태</option>
                <option value="PENDING_PARTIAL">미청구 잔액 있음</option>
                <option value="PENDING">미청구</option>
                <option value="PARTIAL">일부청구</option>
                <option value="CLEARED">청구완료 (전액)</option>
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-hover table-bordered mb-0 align-middle text-sm">
              <thead className="table-light text-center">
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>발생일</th>
                  <th style={{ whiteSpace: 'nowrap' }}>고객사 / 계약</th>
                  <th style={{ whiteSpace: 'nowrap' }}>유형</th>
                  <th style={{ whiteSpace: 'nowrap' }}>내부 기재명 (실제 내역)</th>
                  <th style={{ whiteSpace: 'nowrap' }}>명세서 표기명</th>
                  <th style={{ whiteSpace: 'nowrap' }}>외상 총액</th>
                  <th style={{ whiteSpace: 'nowrap' }}>기청구액</th>
                  <th style={{ whiteSpace: 'nowrap' }}>미청구 잔액</th>
                  <th style={{ whiteSpace: 'nowrap' }}>상태</th>
                  <th style={{ whiteSpace: 'nowrap' }}>조치</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const c = contracts.find(x => x.id === r.contractId);
                  const cu = customers.find(x => x.id === r.customerId);
                  const s = c?.siteId ? sites.find(x => x.id === c.siteId) : null;
                  const remaining = r.totalAmount - r.billedAmount;

                  return (
                    <tr key={r.id}>
                      <td className="text-center">{r.occurredDate}</td>
                      <td>
                        {cu ? (
                          <>
                            <div className="fw-bold text-gray-800">{cu.name}</div>
                            <div className="text-xs text-gray-500">{c?.contractNo || '-'} {s ? `(${s.name})` : ''}</div>
                          </>
                        ) : (
                          <span className="text-muted text-xs">고객 미지정</span>
                        )}
                      </td>
                      <td className="text-center">
                        {r.type === 'TRANSPORT' ? '운송료' :
                         r.type === 'REPAIR' ? '수리비' :
                         r.type === 'CLEANING' ? '청소비' : '기타'}
                      </td>
                      <td>{r.internalDescription}</td>
                      <td className="text-gray-500">{r.displayName || '-'}</td>
                      <td className="text-end fw-bold">{r.totalAmount.toLocaleString()}원</td>
                      <td className="text-end text-success">{r.billedAmount.toLocaleString()}원</td>
                      <td className="text-end text-danger fw-bold">{remaining.toLocaleString()}원</td>
                      <td className="text-center">
                        <span className={`badge ${
                          r.status === 'PENDING' ? 'badge-secondary' :
                          r.status === 'PARTIAL' ? 'badge-warning' : 'badge-success'
                        }`}>
                          {r.status === 'PENDING' ? '미청구' :
                           r.status === 'PARTIAL' ? '일부청구' : '청구완료'}
                        </span>
                      </td>
                      <td className="text-center">
                        {r.status !== 'CLEARED' && (
                          <button
                            className="btn btn-sm btn-outline-primary"
                            style={{ fontSize: '11px', padding: '2px 6px' }}
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
                    <td colSpan={10} className="text-center text-muted py-5">조회된 내역이 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
