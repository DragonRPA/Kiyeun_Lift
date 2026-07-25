// d:\Kiyeun_Lift\src\pages\Vendors.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Plus, Edit2, Trash2, Download, Building2 } from 'lucide-react';
import { exportToExcel } from '../services/excel';
import { Vendor } from '../services/db';

export const Vendors: React.FC = () => {
  const { vendors, saveVendor, deleteVendor, hasPermission } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  
  // 등록/수정 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Partial<Vendor> | null>(null);

  type VendorSortField = 'name' | 'bizRegNo' | 'representative' | 'type' | 'contactName' | 'createdAt';
  const [sortField, setSortField] = useState<VendorSortField>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const canSave = hasPermission('vendors', 'save');

  const handleSort = (field: VendorSortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortArrow = (field: VendorSortField) => {
    if (sortField !== field) return <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '4px' }}>↕</span>;
    return <span style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '12px', marginLeft: '4px' }}>{sortDirection === 'asc' ? '▲' : '▼'}</span>;
  };

  const handleOpenAddModal = () => {
    setEditingVendor({
      name: '',
      bizRegNo: '',
      representative: '',
      contactName: '',
      contact: '',
      email: '',
      address: '',
      type: 'RENTAL',
      isActive: true,
      memo: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (v: Vendor) => {
    setEditingVendor({ ...v });
    setIsModalOpen(true);
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVendor || !editingVendor.name) {
      alert('상호명(매입처명)은 필수 입력 항목입니다.');
      return;
    }

    const payload: Vendor = {
      id: editingVendor.id || `VND-${Date.now().toString().slice(-6)}`,
      name: editingVendor.name,
      bizRegNo: editingVendor.bizRegNo || '',
      representative: editingVendor.representative || '',
      contactName: editingVendor.contactName || '',
      contact: editingVendor.contact || '',
      email: editingVendor.email || '',
      address: editingVendor.address || '',
      type: editingVendor.type || 'RENTAL',
      isActive: editingVendor.isActive ?? true,
      memo: editingVendor.memo || '',
      createdAt: editingVendor.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    saveVendor(payload);
    alert('매입처(공급자) 정보가 성공적으로 저장되었습니다.');
    setIsModalOpen(false);
    setEditingVendor(null);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`'${name}' 매입처를 정말 삭제하시겠습니까?`)) {
      deleteVendor(id);
    }
  };

  const filtered = vendors.filter(v => {
    const matchesSearch = 
      v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.bizRegNo && v.bizRegNo.includes(searchTerm)) ||
      (v.representative && v.representative.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (v.contactName && v.contactName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = typeFilter === 'ALL' || v.type === typeFilter;
    return matchesSearch && matchesType;
  }).sort((a, b) => {
    let aVal = a[sortField as keyof Vendor] || '';
    let bVal = b[sortField as keyof Vendor] || '';

    let cmp = String(aVal).localeCompare(String(bVal), 'ko', { numeric: true });
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  const handleExport = () => {
    const data = filtered.map(v => ({
      '매입처ID': v.id,
      '상호명': v.name,
      '사업자등록번호': v.bizRegNo || '-',
      '대표자명': v.representative || '-',
      '담당자명': v.contactName || '-',
      '연락처': v.contact || '-',
      '이메일': v.email || '-',
      '주소': v.address || '-',
      '매입구분': v.type === 'RENTAL' ? '장비임대 원사' : v.type === 'CONSUMABLE' ? '소모품 공급사' : v.type === 'REPAIR' ? '외주 수리정비사' : '기타',
      '사용여부': v.isActive ? '사용중' : '미사용',
      '등록일': v.createdAt.slice(0, 10)
    }));

    exportToExcel(data, `매입처공급자목록_${new Date().toISOString().split('T')[0]}`, '매입처목록');
  };

  const getTypeBadge = (type?: string) => {
    switch (type) {
      case 'RENTAL': return <span className="badge badge-info">장비임대 원사</span>;
      case 'CONSUMABLE': return <span className="badge badge-success">소모품 공급사</span>;
      case 'REPAIR': return <span className="badge badge-warning">외주 수리정비사</span>;
      default: return <span className="badge">기타</span>;
    }
  };

  return (
    <div>
      <div className="card-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 className="text-primary" /> 매입처 (공급자 / 외주처) 관리
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            장비 재임차 원사, 소모품 구매처 및 외주 정비 수리 업체의 마스터 정보를 통합 관리합니다.
          </p>
        </div>
        {canSave && (
          <button className="btn-primary" onClick={handleOpenAddModal} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} /> 신규 매입처 등록
          </button>
        )}
      </div>

      {/* 검색 및 필터 바 */}
      <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '300px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="상호명, 사업자번호, 대표자, 담당자 검색..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '32px', width: '100%' }}
              />
            </div>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ width: '160px' }}>
              <option value="ALL">전체 매입구분</option>
              <option value="RENTAL">장비임대 원사</option>
              <option value="CONSUMABLE">소모품 공급사</option>
              <option value="REPAIR">외주 수리정비사</option>
              <option value="OTHER">기타</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>
              전체 <strong style={{ color: 'var(--primary)' }}>{vendors.length}</strong>개 매입처 (검색: {filtered.length}건)
            </span>
            <button className="btn-secondary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Download size={14} /> 엑셀 다운로드
            </button>
          </div>
        </div>
      </div>

      {/* 매입처 목록 테이블 */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-container" style={{ maxHeight: 'calc(850px - 260px)', overflowY: 'auto', overscrollBehavior: 'contain' }}>
          <table className="table" style={{ width: '100%', margin: 0 }}>
            <thead>
              <tr>
                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                  상호명 (매입처명) {renderSortArrow('name')}
                </th>
                <th onClick={() => handleSort('type')} style={{ cursor: 'pointer' }}>
                  매입구분 {renderSortArrow('type')}
                </th>
                <th onClick={() => handleSort('bizRegNo')} style={{ cursor: 'pointer' }}>
                  사업자등록번호 {renderSortArrow('bizRegNo')}
                </th>
                <th onClick={() => handleSort('representative')} style={{ cursor: 'pointer' }}>
                  대표자명 {renderSortArrow('representative')}
                </th>
                <th onClick={() => handleSort('contactName')} style={{ cursor: 'pointer' }}>
                  담당자 및 연락처 {renderSortArrow('contactName')}
                </th>
                <th>주소 및 이메일</th>
                <th>상태</th>
                {canSave && <th style={{ width: '90px', textAlign: 'center' }}>관리</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    등록된 매입처(공급자) 정보가 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map(v => (
                  <tr key={v.id}>
                    <td>
                      <strong style={{ color: 'var(--primary)', display: 'block' }}>{v.name}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{v.id}</span>
                    </td>
                    <td>{getTypeBadge(v.type)}</td>
                    <td>{v.bizRegNo || '-'}</td>
                    <td>{v.representative || '-'}</td>
                    <td>
                      <div><strong>{v.contactName || '-'}</strong></div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{v.contact || '-'}</div>
                    </td>
                    <td style={{ fontSize: '12.5px' }}>
                      <div>{v.address || '-'}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{v.email}</div>
                    </td>
                    <td>
                      <span className={`badge ${v.isActive !== false ? 'badge-success' : 'badge-danger'}`}>
                        {v.isActive !== false ? '거래중' : '중단'}
                      </span>
                    </td>
                    {canSave && (
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button className="btn-secondary" onClick={() => handleOpenEditModal(v)} style={{ padding: '4px 6px' }} title="수정">
                            <Edit2 size={13} />
                          </button>
                          <button className="btn-danger" onClick={() => handleDelete(v.id, v.name)} style={{ padding: '4px 6px' }} title="삭제">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 등록 / 수정 모달 */}
      {isModalOpen && editingVendor && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '90%', maxWidth: '600px', backgroundColor: 'var(--bg-card)', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              {editingVendor.id ? '매입처(공급자) 정보 수정' : '신규 매입처(공급자) 등록'}
            </h3>

            <form onSubmit={handleSaveSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>상호명 (매입처명) *</label>
                  <input
                    type="text"
                    value={editingVendor.name || ''}
                    onChange={e => setEditingVendor({ ...editingVendor, name: e.target.value })}
                    placeholder="예: (주)한국크레인엔지니어링"
                    required
                    style={{ width: '100%', padding: '8px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>매입 구분 *</label>
                  <select
                    value={editingVendor.type || 'EQUIPMENT_RENTAL'}
                    onChange={e => setEditingVendor({ ...editingVendor, type: e.target.value as any })}
                    style={{ width: '100%', padding: '8px' }}
                  >
                    <option value="RENTAL">장비임대 원사</option>
                    <option value="CONSUMABLE">소모품 공급사</option>
                    <option value="REPAIR">외주 수리정비사</option>
                    <option value="OTHER">기타</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>사업자등록번호</label>
                  <input
                    type="text"
                    value={editingVendor.bizRegNo || ''}
                    onChange={e => setEditingVendor({ ...editingVendor, bizRegNo: e.target.value })}
                    placeholder="예: 123-81-94820"
                    style={{ width: '100%', padding: '8px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>대표자명</label>
                  <input
                    type="text"
                    value={editingVendor.representative || ''}
                    onChange={e => setEditingVendor({ ...editingVendor, representative: e.target.value })}
                    placeholder="예: 홍길동"
                    style={{ width: '100%', padding: '8px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>담당자명</label>
                  <input
                    type="text"
                    value={editingVendor.contactName || ''}
                    onChange={e => setEditingVendor({ ...editingVendor, contactName: e.target.value })}
                    placeholder="예: 김철수 부장"
                    style={{ width: '100%', padding: '8px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>연락처</label>
                  <input
                    type="text"
                    value={editingVendor.contact || ''}
                    onChange={e => setEditingVendor({ ...editingVendor, contact: e.target.value })}
                    placeholder="예: 010-1234-5678"
                    style={{ width: '100%', padding: '8px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>이메일</label>
                  <input
                    type="email"
                    value={editingVendor.email || ''}
                    onChange={e => setEditingVendor({ ...editingVendor, email: e.target.value })}
                    placeholder="예: vendor@example.com"
                    style={{ width: '100%', padding: '8px' }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>사업장 주소</label>
                  <input
                    type="text"
                    value={editingVendor.address || ''}
                    onChange={e => setEditingVendor({ ...editingVendor, address: e.target.value })}
                    placeholder="예: 경기도 화성시 팔탄면 123번지"
                    style={{ width: '100%', padding: '8px' }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>비고 / 특기사항</label>
                  <textarea
                    rows={2}
                    value={editingVendor.memo || ''}
                    onChange={e => setEditingVendor({ ...editingVendor, memo: e.target.value })}
                    placeholder="주요 취급 장비 및 단가 조건 등"
                    style={{ width: '100%', padding: '8px', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>취소</button>
                <button type="submit" className="btn-primary">저장 (적용)</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
