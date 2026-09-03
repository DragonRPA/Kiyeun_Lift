import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Plus, Edit2, Trash2, Download, Building2, Check, RefreshCw } from 'lucide-react';
import { exportToExcel } from '../services/excel';
import { Vendor } from '../services/db';

type VendorTypeOption = 'RENTAL' | 'PURCHASE' | 'TRANSPORT' | 'REPAIR' | 'OTHER';

const VENDOR_TYPE_CONFIG: Record<VendorTypeOption, { label: string; color: string; bg: string }> = {
  RENTAL: { label: '임차', color: '#2563eb', bg: '#dbeafe' },
  PURCHASE: { label: '구매', color: '#16a34a', bg: '#dcfce7' },
  TRANSPORT: { label: '운송', color: '#d97706', bg: '#fef3c7' },
  REPAIR: { label: '정비', color: '#dc2626', bg: '#fee2e2' },
  OTHER: { label: '기타', color: '#6b7280', bg: '#f3f4f6' }
};

export const Vendors: React.FC = () => {
  const { vendors, saveVendor, deleteVendor, hasPermission, showErrorModal } = useApp();

  const [searchInput, setSearchInput] = useState('');   // 입력 중인 값
  const [searchTerm, setSearchTerm] = useState('');      // 실제 조회에 사용되는 값
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  
  // 등록/수정 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Partial<Vendor> | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<VendorTypeOption[]>(['RENTAL']);

  type VendorSortField = 'name' | 'bizRegNo' | 'representative' | 'contactName' | 'createdAt';
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
      types: ['RENTAL'],
      isActive: true,
      memo: ''
    });
    setSelectedTypes(['RENTAL']);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (v: Vendor) => {
    setEditingVendor({ ...v });
    // v.types가 문자열/배열/PG배열 등 어떤 형식이든 키워드 스캔으로 안전하게 파싱
    const TYPE_KEYS: VendorTypeOption[] = ['RENTAL', 'PURCHASE', 'TRANSPORT', 'REPAIR', 'OTHER'];
    const raw = JSON.stringify(v.types ?? v.type ?? '');
    const parsedTypes = TYPE_KEYS.filter(k => raw.includes(k));
    setSelectedTypes(parsedTypes.length > 0 ? parsedTypes : [(v.type as VendorTypeOption) || 'RENTAL']);
    setIsModalOpen(true);
  };

  const toggleVendorType = (type: VendorTypeOption) => {
    setSelectedTypes(prev => {
      if (prev.includes(type)) {
        // 최소 1개는 선택 유지
        if (prev.length === 1) return prev;
        return prev.filter(t => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVendor || !editingVendor.name) {
      alert('상호명(매입처명)은 필수 입력 항목입니다.');
      return;
    }

    const payloadTypes = selectedTypes.length > 0 ? selectedTypes : ['RENTAL' as VendorTypeOption];

    const payload: Vendor = {
      id: editingVendor.id || (() => {
        const maxNum = vendors.reduce((max, v) => {
          const match = v.id.match(/VND-(\d+)/);
          return match ? Math.max(max, parseInt(match[1])) : max;
        }, 0);
        return `VND-${String(maxNum + 1).padStart(7, '0')}`;
      })(),
      name: editingVendor.name,
      bizRegNo: editingVendor.bizRegNo || '',
      representative: editingVendor.representative || '',
      contactName: editingVendor.contactName || '',
      contact: editingVendor.contact || '',
      email: editingVendor.email || '',
      address: editingVendor.address || '',
      type: payloadTypes[0], // 하위 호환 primary type
      types: payloadTypes, // 복수 선택 속성
      isActive: editingVendor.isActive ?? true,
      memo: editingVendor.memo || '',
      createdAt: editingVendor.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await saveVendor(payload);
      alert('매입처(공급자) 정보가 성공적으로 저장되었습니다.');
      setIsModalOpen(false);
      setEditingVendor(null);
    } catch (err: any) {
      showErrorModal(`⚠️ 매입처 저장 중 오류가 발생했습니다:\n\n${err?.message || err}`);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`'${name}' 매입처를 정말 삭제하시겠습니까?`)) {
      deleteVendor(id);
    }
  };

  // 어떤 형식의 Supabase 반환값이든 알려진 키워드를 스캔해 컬러 pill JSX 배열 반환
  const renderTypePills = (v: Vendor): React.ReactNode[] => {
    const TYPE_MAP: { key: string; label: string; color: string; bg: string }[] = [
      { key: 'RENTAL',    label: '임차', color: '#2563eb', bg: '#dbeafe' },
      { key: 'PURCHASE',  label: '구매', color: '#16a34a', bg: '#dcfce7' },
      { key: 'TRANSPORT', label: '운송', color: '#d97706', bg: '#fef3c7' },
      { key: 'REPAIR',    label: '정비', color: '#dc2626', bg: '#fee2e2' },
      { key: 'OTHER',     label: '기타', color: '#6b7280', bg: '#f3f4f6' },
    ];
    // 원시 데이터를 문자열로 직렬화하여 키워드 존재 여부 스캔
    const raw = JSON.stringify(v.types ?? v.type ?? '');
    const found = TYPE_MAP.filter(({ key }) => raw.includes(key));
    if (found.length === 0 && v.type) {
      const m = TYPE_MAP.find(x => x.key === v.type) || { key: v.type, label: v.type, color: '#6b7280', bg: '#f3f4f6' };
      found.push(m);
    }
    return found.map(({ key, label, color, bg }) => (
      <span key={key} style={{
        display: 'inline-block', fontSize: '11px', fontWeight: '600',
        padding: '2px 7px', borderRadius: '999px',
        color, background: bg, border: `1px solid ${color}30`,
        letterSpacing: '0.02em'
      }}>{label}</span>
    ));
  };

  // 모달 거래유형 체크에서도 사용하는 기존 getVendorTypes 유지 (모달 내부 로직용)
  const getVendorTypes = (v: Vendor): VendorTypeOption[] => {
    const rawTypes = v.types;
    if (rawTypes) {
      if (Array.isArray(rawTypes) && rawTypes.length > 0)
        return rawTypes.map(s => String(s).replace(/^"|"$/g, '').trim()) as VendorTypeOption[];
      if (typeof rawTypes === 'string') {
        try {
          const json = JSON.parse(rawTypes as string);
          if (Array.isArray(json) && json.length > 0)
            return json.map((s: string) => String(s).replace(/^"|"$/g, '').trim()) as VendorTypeOption[];
        } catch {}
        const inner = (rawTypes as string).replace(/^\{|\}$/g, '');
        const parsed = inner.split(',').map(s => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
        if (parsed.length > 0) return parsed as VendorTypeOption[];
      }
    }
    if (v.type) return [v.type as VendorTypeOption];
    return ['RENTAL'];
  };

  const filtered = vendors.filter(v => {
    const matchesSearch = 
      v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.bizRegNo && v.bizRegNo.includes(searchTerm)) ||
      (v.representative && v.representative.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (v.contactName && v.contactName.toLowerCase().includes(searchTerm.toLowerCase()));

    const vTypes = getVendorTypes(v);
    const matchesType = typeFilter === 'ALL' || vTypes.includes(typeFilter as VendorTypeOption);
    return matchesSearch && matchesType;
  }).sort((a, b) => {
    let aVal = a[sortField as keyof Vendor] || '';
    let bVal = b[sortField as keyof Vendor] || '';

    let cmp = String(aVal).localeCompare(String(bVal), 'ko', { numeric: true });
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  const handleExport = () => {
    const data = filtered.map(v => {
      const vTypes = getVendorTypes(v);
      const typeLabels = vTypes.map(t => VENDOR_TYPE_CONFIG[t]?.label || t).join(', ');
      return {
        '매입처ID': v.id,
        '상호명': v.name,
        '사업자등록번호': v.bizRegNo || '-',
        '대표자명': v.representative || '-',
        '담당자명': v.contactName || '-',
        '연락처': v.contact || '-',
        '이메일': v.email || '-',
        '주소': v.address || '-',
        '매입/거래구분': typeLabels,
        '사용여부': v.isActive ? '사용중' : '미사용',
        '등록일': v.createdAt.slice(0, 10)
      };
    });

    exportToExcel(data, `매입처공급자목록_${new Date().toISOString().split('T')[0]}`, '매입처목록');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: '10px' }}>
      <div className="card-header" style={{ marginBottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 className="text-primary" /> 매입처 (공급자 / 외주처) 관리
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            장비 재임차 원사, 소모품/장비 구매처, 운송 협력사 및 외주 수리정비 업체의 마스터 정보를 통합 관리합니다.
          </p>
        </div>
        {canSave && (
          <button className="btn-primary" onClick={handleOpenAddModal} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} /> 신규 매입처 등록
          </button>
        )}
      </div>

      {/* 📊 매입처 등록 현황 실시간 요약 바 */}
      {(() => {
        const rentalCount = vendors.filter(v => JSON.stringify(v.types || v.type || '').includes('RENTAL')).length;
        const transportCount = vendors.filter(v => JSON.stringify(v.types || v.type || '').includes('TRANSPORT')).length;
        const repairCount = vendors.filter(v => JSON.stringify(v.types || v.type || '').includes('REPAIR')).length;
        const purchaseCount = vendors.filter(v => JSON.stringify(v.types || v.type || '').includes('PURCHASE')).length;

        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: 0, flexShrink: 0 }}>
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>총 매입 협력처</span>
              <strong style={{ fontSize: '15px', color: 'var(--primary)' }}>{vendors.length}개사</strong>
            </div>
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>임차 원사</span>
              <strong style={{ fontSize: '15px', color: '#2563eb' }}>{rentalCount}개사</strong>
            </div>
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>운송 물류사</span>
              <strong style={{ fontSize: '15px', color: '#d97706' }}>{transportCount}개사</strong>
            </div>
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>외주 정비/구매처</span>
              <strong style={{ fontSize: '15px', color: '#16a34a' }}>{repairCount + purchaseCount}개사</strong>
            </div>
          </div>
        );
      })()}

      {/* 검색 및 필터 바 */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 0, flexShrink: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '320px', alignItems: 'center' }}>
            {/* 검색어 입력 */}
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="상호명, 사업자번호, 대표자, 담당자 검색..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') setSearchTerm(searchInput); }}
                style={{ paddingLeft: '32px', width: '100%' }}
              />
            </div>
            {/* 거래구분 필터 드롭다운 */}
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ width: '160px', flexShrink: 0 }}>
              <option value="ALL">전체 거래구분</option>
              <option value="RENTAL">🏢 임차거래처</option>
              <option value="PURCHASE">🛒 구매처</option>
              <option value="TRANSPORT">🚚 운송거래처</option>
              <option value="REPAIR">🔧 외주정비처</option>
              <option value="OTHER">📌 기타</option>
            </select>
            {/* 🔍 조회 버튼 */}
            <button
              className="btn-primary"
              onClick={() => setSearchTerm(searchInput)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, padding: '8px 16px', fontWeight: '600' }}
            >
              <Search size={14} /> 조회
            </button>
            {/* 초기화 버튼 */}
            <button
              className="btn-secondary"
              onClick={() => { setSearchInput(''); setSearchTerm(''); setTypeFilter('ALL'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, padding: '8px 10px' }}
              title="검색 초기화"
            >
              <RefreshCw size={13} />
            </button>
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
      <div className="card" style={{ padding: 0, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="table-container" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto', maxHeight: 'none', overscrollBehavior: 'contain' }}>
          <table className="table" style={{ width: '100%', margin: 0, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '145px' }} />{/* 상호명 */}
              <col style={{ width: '150px' }} />{/* 매입/거래 속성 */}
              <col style={{ width: '105px' }} />{/* 사업자등록번호 */}
              <col style={{ width: '72px' }} /> {/* 대표자명 */}
              <col style={{ width: '80px' }} /> {/* 담당자 */}
              <col style={{ width: '100px' }} />{/* 연락처 */}
              <col style={{ width: '130px' }} />{/* 주소 */}
              <col style={{ width: '140px' }} />{/* 이메일 */}
              <col style={{ width: '52px' }} /> {/* 상태 */}
              {canSave && <col style={{ width: '62px' }} />}{/* 관리 */}
            </colgroup>
            <thead>
              <tr>
                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', padding: '8px 10px' }}>
                  상호명 (매입처명) {renderSortArrow('name')}
                </th>
                <th style={{ padding: '8px 6px' }}>매입/거래 속성 (다중)</th>
                <th onClick={() => handleSort('bizRegNo')} style={{ cursor: 'pointer', padding: '8px 6px' }}>
                  사업자등록번호 {renderSortArrow('bizRegNo')}
                </th>
                <th onClick={() => handleSort('representative')} style={{ cursor: 'pointer', padding: '8px 6px' }}>
                  대표자명 {renderSortArrow('representative')}
                </th>
                <th onClick={() => handleSort('contactName')} style={{ cursor: 'pointer', padding: '8px 6px' }}>
                  담당자 {renderSortArrow('contactName')}
                </th>
                <th style={{ padding: '8px 6px' }}>연락처</th>
                <th style={{ padding: '8px 6px' }}>주소</th>
                <th style={{ padding: '8px 6px' }}>이메일</th>
                <th style={{ padding: '8px 6px' }}>상태</th>
                {canSave && <th style={{ width: '72px', textAlign: 'center', padding: '8px 6px' }}>관리</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    {vendors.length === 0 ? '📭 등록된 매입처(공급자)가 없습니다.' : '🔍 조회 조건에 맞는 매입처가 없습니다. 검색 조건을 변경해 보세요.'}
                  </td>
                </tr>
              ) : (
                filtered.map(v => {
                  return (
                    <tr key={v.id}>
                      <td style={{ padding: '6px 10px' }}>
                        <strong style={{ color: 'var(--primary)', display: 'block', fontSize: '13px' }}>{v.name}</strong>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{v.id}</span>
                      </td>
                      <td style={{ padding: '6px 6px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                          {renderTypePills(v)}
                        </div>
                      </td>
                      <td style={{ fontSize: '12px', padding: '6px 6px' }}>{v.bizRegNo || '-'}</td>
                      <td style={{ fontSize: '12px', padding: '6px 6px' }}>{v.representative || '-'}</td>
                      <td style={{ fontSize: '12px', padding: '6px 6px', fontWeight: '600', color: 'var(--text-main)' }}>{v.contactName || '-'}</td>
                      <td style={{ fontSize: '12px', padding: '6px 6px', color: 'var(--text-secondary)' }}>{v.contact || '-'}</td>
                      <td style={{ fontSize: '11.5px', padding: '6px 6px', color: 'var(--text-secondary)' }}>
                        {v.address
                          ? <span style={{ lineHeight: '1.3' }}>{v.address}</span>
                          : <span style={{ color: 'var(--text-muted)' }}>-</span>
                        }
                      </td>
                      <td style={{ fontSize: '11.5px', padding: '6px 6px', color: 'var(--text-muted)' }}>
                        {v.email || '-'}
                      </td>
                      <td style={{ padding: '6px 6px' }}>
                        <span className={`badge ${v.isActive !== false ? 'badge-success' : 'badge-danger'}`}>
                          {v.isActive !== false ? '거래중' : '중단'}
                        </span>
                      </td>
                      {canSave && (
                        <td style={{ textAlign: 'center', padding: '6px 4px' }}>
                          <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
                            <button className="btn-secondary" onClick={() => handleOpenEditModal(v)} style={{ padding: '3px 5px' }} title="수정">
                              <Edit2 size={12} />
                            </button>
                            <button className="btn-danger" onClick={() => handleDelete(v.id, v.name)} style={{ padding: '3px 5px' }} title="삭제">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
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
          <div className="card" style={{ width: '90%', maxWidth: '640px', backgroundColor: 'var(--bg-card)', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              {editingVendor.id ? '매입처(공급자) 정보 수정' : '신규 매입처(공급자) 등록'}
            </h3>

            <form onSubmit={handleSaveSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                
                {/* 상호명 */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>상호명 (매입처명) *</label>
                  <input
                    type="text"
                    value={editingVendor.name || ''}
                    onChange={e => setEditingVendor({ ...editingVendor, name: e.target.value })}
                    placeholder="예: (주)한국중장비렌탈"
                    required
                    style={{ width: '100%', padding: '8px' }}
                  />
                </div>

                {/* 🌟 인터랙티브 세그먼트 멀티 토글 버튼 그룹 🌟 */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                    매입 / 거래 속성 (복수 토글 선택 가능) *
                  </label>
                  <div style={{
                    display: 'flex',
                    gap: '6px',
                    backgroundColor: 'var(--bg-app)',
                    padding: '6px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    flexWrap: 'wrap'
                  }}>
                    {(Object.keys(VENDOR_TYPE_CONFIG) as VendorTypeOption[]).map(typeKey => {
                      const cfg = VENDOR_TYPE_CONFIG[typeKey];
                      const isSelected = selectedTypes.includes(typeKey);
                      return (
                        <button
                          key={typeKey}
                          type="button"
                          onClick={() => toggleVendorType(typeKey)}
                          style={{
                            flex: '1 1 auto',
                            minWidth: '100px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '8px 12px',
                            fontSize: '12.5px',
                            fontWeight: isSelected ? '700' : '500',
                            borderRadius: '6px',
                            border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                            background: isSelected ? 'linear-gradient(135deg, var(--primary) 0%, #3b82f6 100%)' : 'var(--bg-card)',
                            color: isSelected ? '#ffffff' : 'var(--text-main)',
                            boxShadow: isSelected ? '0 2px 8px rgba(59, 130, 246, 0.35)' : 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                          }}
                        >
                          {isSelected && <Check size={14} style={{ color: '#fff', strokeWidth: 3 }} />}
                          <span>{cfg.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    💡 한 거래처가 임차 및 구매를 동시 수행할 경우, 관련 버튼들을 함께 눌러 복수로 활성화할 수 있습니다.
                  </span>
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

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>거래 상태</label>
                  <select
                    value={editingVendor.isActive !== false ? 'ACTIVE' : 'INACTIVE'}
                    onChange={e => setEditingVendor({ ...editingVendor, isActive: e.target.value === 'ACTIVE' })}
                    style={{ width: '100%', padding: '8px' }}
                  >
                    <option value="ACTIVE">거래중 (정상)</option>
                    <option value="INACTIVE">거래중단 (보류)</option>
                  </select>
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
