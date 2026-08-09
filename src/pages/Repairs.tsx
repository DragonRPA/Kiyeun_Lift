// d:\Kiyeun_Lift\src\pages\Repairs.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Wrench, Plus, CheckCircle, Smartphone, User, Settings, Download, Search } from 'lucide-react';
import { Repair } from '../services/db';
import { exportToExcel } from '../services/excel';

export const Repairs: React.FC = () => {
  const {
    repairs, assets, consumables, repairConsumables, registerRepair, hasPermission, users, currentUser, vendors
  } = useApp();

  const canSave = hasPermission('repair', 'save');
  const isMechanic = currentUser?.role === 'MECHANIC';

  // --- 정비 조회 필터 상태 ---
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempTypeFilter, setTempTypeFilter] = useState('ALL');
  const [tempStatusFilter, setTempStatusFilter] = useState('ALL');

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // 정비 등록 모달 및 상태
  const [showModal, setShowModal] = useState(false);
  const [editingRepair, setEditingRepair] = useState<Partial<Repair> | null>(null);

  // 정비 상세 모달 상태
  const [selectedDetailRepair, setSelectedDetailRepair] = useState<Repair | null>(null);

  // 사용한 소모품 임시 추가 목록 (정비 등록 모달 내)
  const [selectedConsumables, setSelectedConsumables] = useState<{ consumableId: string; quantity: number }[]>([]);
  const [tempConsumableId, setTempConsumableId] = useState('');
  const [tempQty, setTempQty] = useState(1);

  const getAssetNo = (id: string) => assets.find(a => a.id === id)?.assetNo || '-';
  const getAssetModel = (id: string) => assets.find(a => a.id === id)?.modelName || '-';
  const getMechanicName = (id?: string) => users.find(u => u.id === id)?.name || '정비사';

  const handleSearchClick = () => {
    setSearchTerm(tempSearchTerm);
    setTypeFilter(tempTypeFilter);
    setStatusFilter(tempStatusFilter);
  };

  const filteredRepairs = repairs.filter(r => {
    const assetNo = getAssetNo(r.assetId).toLowerCase();
    const assetModel = getAssetModel(r.assetId).toLowerCase();
    const vendorName = r.vendorId ? (vendors.find(v => v.id === r.vendorId)?.name || '').toLowerCase() : '';
    
    const matchesSearch = 
      assetNo.includes(searchTerm.toLowerCase()) || 
      assetModel.includes(searchTerm.toLowerCase()) || 
      vendorName.includes(searchTerm.toLowerCase()) || 
      (r.details && r.details.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = typeFilter === 'ALL' || r.repairType === typeFilter;
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const handleExportExcel = () => {
    const excelData = filteredRepairs.map((r, idx) => ({
      'No': idx + 1,
      '자산번호': getAssetNo(r.assetId),
      '모델명': getAssetModel(r.assetId),
      '정비 구분': r.repairType === 'INTERNAL' ? '자사정비' : '외주정비',
      '외주 정비처': r.vendorId ? (vendors.find(v => v.id === r.vendorId)?.name || '-') : '-',
      '정비 상태': r.status === 'PENDING' ? '대기중' : r.status === 'IN_PROGRESS' ? '정비중' : '완료',
      '의뢰일': r.requestDate || '-',
      '완료일': r.repairDate || '-',
      '정비 내용': r.details || '',
      '정비 총비용': `${(r.totalCost || 0).toLocaleString()}원`,
      '고객사 청구여부': r.billableToCustomer ? '청구' : '미청구',
      '정비사': getMechanicName(r.mechanicId),
      '등록일': r.createdAt ? r.createdAt.split('T')[0] : '-'
    }));

    exportToExcel(excelData, `정비정리대장_${new Date().toISOString().split('T')[0]}`, '정비목록');
  };

  const handleOpenAdd = () => {
    setEditingRepair({
      assetId: assets[0]?.id || '',
      requestDate: new Date().toISOString().split('T')[0],
      repairDate: new Date().toISOString().split('T')[0],
      status: 'PENDING',
      details: '',
      totalCost: 0,
      billableToCustomer: false
    });
    setSelectedConsumables([]);
    setShowModal(true);
  };

  const handleAddConsumableToRepair = () => {
    if (!tempConsumableId) return;
    if (selectedConsumables.some(c => c.consumableId === tempConsumableId)) return;

    setSelectedConsumables([...selectedConsumables, {
      consumableId: tempConsumableId,
      quantity: tempQty
    }]);

    setTempConsumableId('');
    setTempQty(1);
  };

  const handleRemoveConsumableFromRepair = (cId: string) => {
    setSelectedConsumables(selectedConsumables.filter(c => c.consumableId !== cId));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !editingRepair || !editingRepair.assetId) {
      alert('정비 등록 내용을 확인해 주세요.');
      return;
    }

    // 소모품 재고 부족 체크
    for (const sc of selectedConsumables) {
      const item = consumables.find(c => c.id === sc.consumableId);
      if (item && item.stockQty < sc.quantity) {
        alert(`[재고 부족] ${item.modelName}의 재고가 부족합니다. (현재고: ${item.stockQty}개)`);
        return;
      }
    }

    registerRepair(editingRepair, selectedConsumables);
    alert('수리 보고가 접수 완료되었습니다. 소모품 재고 감산 및 비용 연동이 완료되었습니다.');
    setShowModal(false);
    setEditingRepair(null);
    setSelectedConsumables([]);
  };

  return (
    <div>
      {/* 모바일 뷰 뱃지 (외근 기능 안내용) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontWeight: '700' }}>장비 정비 및 수리 관리</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
            <Smartphone size={14} /> 모바일 현장 최적화 레이아웃
          </span>
          {canSave && (
            <button className="btn-primary" onClick={handleOpenAdd}>
              <Plus size={16} /> 수리 보고서 작성
            </button>
          )}
        </div>
      </div>

      {isMechanic && (
        <div className="card" style={{ backgroundColor: 'var(--primary-light)', borderColor: 'var(--primary)', marginBottom: '20px' }}>
          <h4 style={{ color: 'var(--primary)', fontWeight: '700', marginBottom: '6px' }}>안녕하세요, {currentUser.name} 정비사님</h4>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            외근 중 모바일 기기(핸드폰)로 접속하셨을 경우, 아래 수리 보고서 작성 버튼을 눌러 현장에서 사용된 작동유/배터리 소모품을 바로 등록하실 수 있습니다.
          </p>
        </div>
      )}

      {/* 수리 목록 카드 */}
      <div className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title" style={{ margin: 0 }}>정비수리 내역</h3>
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={handleExportExcel}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '6px 12px' }}
          >
            <Download size={12} /> 엑셀 다운로드
          </button>
        </div>

        {/* 필터 바 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px', alignItems: 'end', backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px', display: 'block' }}>자산/외주업체 검색</label>
            <input 
              type="text" 
              value={tempSearchTerm} 
              onChange={e => setTempSearchTerm(e.target.value)} 
              placeholder="자산번호, 모델명, 수리공장..."
              style={{ width: '100%', padding: '6px', fontSize: '12.5px' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px', display: 'block' }}>정비 구분</label>
            <select 
              value={tempTypeFilter} 
              onChange={e => setTempTypeFilter(e.target.value)} 
              style={{ width: '100%', padding: '6px', fontSize: '12.5px' }}
            >
              <option value="ALL">전체 정비구분</option>
              <option value="INTERNAL">자사 정비 (INTERNAL)</option>
              <option value="EXTERNAL">외주 정비 (EXTERNAL)</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px', display: 'block' }}>진행 상태</label>
            <select 
              value={tempStatusFilter} 
              onChange={e => setTempStatusFilter(e.target.value)} 
              style={{ width: '100%', padding: '6px', fontSize: '12.5px' }}
            >
              <option value="ALL">전체 진행상태</option>
              <option value="PENDING">대기중 (PENDING)</option>
              <option value="IN_PROGRESS">정비중 (IN_PROGRESS)</option>
              <option value="COMPLETED">정비완료 (COMPLETED)</option>
            </select>
          </div>
          <button 
            type="button" 
            className="btn-primary" 
            onClick={handleSearchClick}
            style={{ padding: '6px 12px', height: '33px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12.5px' }}
          >
            조회
          </button>
        </div>

        <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>정비장비</th>
                <th>의뢰일</th>
                <th>정비완료일</th>
                <th>정비 내용</th>
                <th>총 수리비</th>
                <th>청구 구분</th>
                <th>담당 정비사</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {filteredRepairs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                    {repairs.length === 0 ? '📭 등록된 정비 이력이 없습니다.' : '🔍 조회 조건에 맞는 정비 이력이 없습니다. 검색 조건을 변경해 보세요.'}
                  </td>
                </tr>
              ) : (
                filteredRepairs.map(r => (
                  <tr key={r.id} onDoubleClick={() => setSelectedDetailRepair(r)} style={{ cursor: 'pointer' }} title="더블클릭하여 수리 상세(소모품/공임) 조회">
                    <td>
                      <strong style={{ color: 'var(--primary)' }}>{getAssetNo(r.assetId)}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{getAssetModel(r.assetId)}</div>
                    </td>
                    <td>{r.requestDate}</td>
                    <td>{r.repairDate || '-'}</td>
                    <td style={{ maxWidth: '280px', fontSize: '12px' }}>
                      {r.inboundNo && (
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '2px' }}>
                          📥 연동 입고번호: {r.inboundNo}
                        </div>
                      )}
                      <div style={{ whiteSpace: 'pre-wrap' }}>{r.details}</div>
                      {r.defectsJson && (
                        <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: 'var(--bg-app)', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--warning)' }}>📸 입고 파손 사진 및 증상:</span>
                          {JSON.parse(r.defectsJson).map((d: any, idx: number) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px' }}>
                              <span className="badge badge-secondary" style={{ fontSize: '10px' }}>{d.subNo}</span>
                              <span>{d.checkitemName} (+{d.score}점)</span>
                              {d.photoUrl && (
                                <a href={d.photoUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                                  <img src={d.photoUrl} alt="사진" style={{ width: '26px', height: '26px', objectFit: 'cover', borderRadius: '3px', border: '1px solid var(--border-color)' }} />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ fontWeight: '600' }}>
                      {r.totalCost.toLocaleString()}원
                    </td>
                    <td>
                      <span className={`badge ${r.billableToCustomer ? 'badge-danger' : 'badge-secondary'}`}>
                        {r.billableToCustomer ? '고객사 청구' : '자사 비용'}
                      </span>
                    </td>
                    <td>{getMechanicName(r.mechanicId)}</td>
                    <td>
                      <span className={`badge ${
                        r.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'
                      }`}>
                        {r.status === 'COMPLETED' ? '정비완료' : '수리중'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 보고서 등록 모달 */}
      {showModal && editingRepair && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleSubmit} className="card" style={{ width: '90%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Wrench className="text-primary" /> 현장 정비수리 보고서 작성
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>정비 대상 자산 (관리번호) *</label>
                  <select value={editingRepair.assetId} onChange={e => setEditingRepair({ ...editingRepair, assetId: e.target.value })} required>
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>{a.assetNo} ({a.modelName})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>진행 상태 *</label>
                  <select value={editingRepair.status} onChange={e => setEditingRepair({ ...editingRepair, status: e.target.value as Repair['status'] })} required>
                    <option value="COMPLETED">정비 완료 (COMPLETED)</option>
                    <option value="IN_PROGRESS">정비 진행 중 (IN_PROGRESS)</option>
                    <option value="PENDING">대기 (PENDING)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>점검 의뢰일자</label>
                  <input type="date" value={editingRepair.requestDate || ''} onChange={e => setEditingRepair({ ...editingRepair, requestDate: e.target.value })} />
                </div>
                <div>
                  <label>정비 완료일자</label>
                  <input type="date" value={editingRepair.repairDate || ''} onChange={e => setEditingRepair({ ...editingRepair, repairDate: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>수리 공임비용 (공임합계) *</label>
                  <input
                    type="number"
                    value={editingRepair.totalCost || ''}
                    onChange={e => setEditingRepair({ ...editingRepair, totalCost: parseInt(e.target.value) || 0 })}
                    placeholder="공임 수리비 입력"
                    required
                  />
                </div>
                <div>
                  <label>고객사 청구 연동 여부</label>
                  <select
                    value={editingRepair.billableToCustomer ? 'true' : 'false'}
                    onChange={e => setEditingRepair({ ...editingRepair, billableToCustomer: e.target.value === 'true' })}
                  >
                    <option value="false">당사 비용 처리</option>
                    <option value="true">고객 렌탈료 청구서에 청구합산</option>
                  </select>
                </div>
              </div>

              <div>
                <label>정비 수리 상세 명세 *</label>
                <textarea
                  value={editingRepair.details || ''}
                  onChange={e => setEditingRepair({ ...editingRepair, details: e.target.value })}
                  placeholder="예: 실린더 씰 교체 및 US US-2200 배터리 장착 교체 보고"
                  rows={3}
                  required
                />
              </div>

              {/* 사용 소모품 연결 섹션 */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>정비용 소모품 사용 등록</h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '8px', alignItems: 'end', marginBottom: '10px' }}>
                  <div>
                    <label>자재 품목</label>
                    <select value={tempConsumableId} onChange={e => setTempConsumableId(e.target.value)}>
                      <option value="">-- 자재 선택 --</option>
                      {consumables.map(c => (
                        <option key={c.id} value={c.id}>{c.modelName} (재고: {c.stockQty})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>사용 수량</label>
                    <input type="number" value={tempQty} onChange={e => setTempQty(parseInt(e.target.value) || 1)} min={1} />
                  </div>
                  <button type="button" className="btn-secondary" onClick={handleAddConsumableToRepair}>
                    추가
                  </button>
                </div>

                {selectedConsumables.map(sc => {
                  const item = consumables.find(c => c.id === sc.consumableId);
                  return (
                    <div key={sc.consumableId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', backgroundColor: 'var(--bg-app)', borderRadius: '4px', marginBottom: '4px', fontSize: '13px' }}>
                      <span>{item?.modelName} : <strong>{sc.quantity}</strong>개</span>
                      <button type="button" className="btn-danger" onClick={() => handleRemoveConsumableFromRepair(sc.consumableId)} style={{ padding: '2px 6px', fontSize: '11px' }}>삭제</button>
                    </div>
                  );
                })}
              </div>

            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>취소</button>
              <button type="submit" className="btn-primary">정비 보고 등록</button>
            </div>
          </form>
        </div>
      )}

      {/* 정비이력 상세 더블클릭 조회 모달 */}
      {selectedDetailRepair && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '95%', maxWidth: '500px', backgroundColor: 'var(--bg-card)' }}>
            <div className="card-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wrench className="text-primary" /> 정비수리 상세 내역 조회
              </h3>
              <button className="btn-secondary" onClick={() => setSelectedDetailRepair(null)} style={{ padding: '4px 10px' }}>닫기</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label>장비 관리번호</label><strong>{getAssetNo(selectedDetailRepair.assetId)}</strong></div>
                <div><label>장비 모델명</label>{getAssetModel(selectedDetailRepair.assetId)}</div>
                <div><label>점검 의뢰일</label>{selectedDetailRepair.requestDate}</div>
                <div><label>정비 완료일</label>{selectedDetailRepair.repairDate || '-'}</div>
                <div><label>담당 정비사</label>{getMechanicName(selectedDetailRepair.mechanicId)}</div>
                <div><label>청구 방식</label>
                  <span className={`badge ${selectedDetailRepair.billableToCustomer ? 'badge-danger' : 'badge-secondary'}`}>
                    {selectedDetailRepair.billableToCustomer ? '고객사 청구' : '자사 비용처리'}
                  </span>
                </div>
              </div>

              <div>
                <label>정비 작업 내용</label>
                <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', whiteSpace: 'pre-wrap' }}>
                  {selectedDetailRepair.details}
                </div>
              </div>

              {/* 사용한 소모품 명세 */}
              <div>
                <label>정비 투입 소모품 명세</label>
                <div className="table-container" style={{ border: 'none', boxShadow: 'none', margin: 0 }}>
                  <table style={{ minWidth: '100%' }}>
                    <thead>
                      <tr>
                        <th>소모품명</th>
                        <th style={{ textAlign: 'center' }}>수량</th>
                        <th style={{ textAlign: 'right' }}>단가</th>
                        <th style={{ textAlign: 'right' }}>합계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const rcList = repairConsumables.filter(rc => rc.repairId === selectedDetailRepair.id);
                        if (rcList.length === 0) {
                          return (
                            <tr>
                              <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '10px 0' }}>투입된 소모품 자재가 없습니다.</td>
                            </tr>
                          );
                        }
                        return rcList.map(rc => {
                          const item = consumables.find(c => c.id === rc.consumableId);
                          return (
                            <tr key={rc.id}>
                              <td>{item?.modelName || '기타 자재'}</td>
                              <td style={{ textAlign: 'center' }}>{rc.quantity}</td>
                              <td style={{ textAlign: 'right' }}>{rc.unitPrice.toLocaleString()}원</td>
                              <td style={{ textAlign: 'right', fontWeight: '600' }}>{rc.cost.toLocaleString()}원</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 비용 정산 요약 */}
              <div style={{ padding: '14px', backgroundColor: 'var(--primary-light)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                {(() => {
                  const rcList = repairConsumables.filter(rc => rc.repairId === selectedDetailRepair.id);
                  const consumablesTotal = rcList.reduce((sum, rc) => sum + rc.cost, 0);
                  const laborCost = Math.max(0, selectedDetailRepair.totalCost - consumablesTotal);
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>기술 공임료 (Labor Fee) :</span>
                        <strong>{laborCost.toLocaleString()}원</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>자재 소모품비 :</span>
                        <strong>{consumablesTotal.toLocaleString()}원</strong>
                      </div>
                      <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '6px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '700', color: 'var(--primary)' }}>
                        <span>총 정비비용 합계 :</span>
                        <span>{selectedDetailRepair.totalCost.toLocaleString()}원</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};
