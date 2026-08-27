// d:\Kiyeun_Lift\src\pages\Products.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Download, Search, RefreshCw, FileText, X } from 'lucide-react';
import { exportToExcel } from '../services/excel';
import { db, Product } from '../services/db';

export const Products: React.FC = () => {
  const { products, saveProduct, hasPermission, assets, refreshAllData } = useApp();
  const canSave = hasPermission('product', 'save');

  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAllData();
      alert("최신 데이터를 성공적으로 불러왔습니다.");
    } catch (err: any) {
      console.error("Failed to sync from Supabase:", err);
      alert("최신 데이터를 가져오는 데 실패했습니다.");
    } finally {
      setRefreshing(false);
    }
  };

  type ProductSortField = 'modelName' | 'feet' | 'spec' | 'manufacturer' | 'isActive' | 'assetCount' | 'createdAt';
  const [sortField, setSortField] = useState<ProductSortField>('modelName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: ProductSortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleOpenAdd = () => {
    setEditingProduct({
      modelName: '',
      feet: 19,
      spec: '',
      manufacturer: '',
      isActive: true,
      powerSource: '배터리',
      asContact: '031-334-5296',
      maxWindSpeed: '12.5 m/s 이내',
      safetyCertUrl: '',
      specSheetUrl: '',
      emergencyGuideUrl: ''
    });
    setShowModal(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setShowModal(true);
  };

  const handleOpenPreview = (p: Product) => {
    setPreviewProduct(p);
    setShowPreviewModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editingProduct.modelName) return;

    // 피트(Feet) 실수 제약 조건 검증
    const feetValue = Number(editingProduct.feet);
    if (isNaN(feetValue) || feetValue <= 0) {
      alert("피트 규격은 0보다 큰 숫자(실수 가능, 예: 3.6, 12, 19 등)로 입력해야 합니다.");
      return;
    }

    try {
      await saveProduct(editingProduct as Omit<Product, 'id' | 'createdAt'>);
      alert("데이터 저장 및 동기화 완료");
      setShowModal(false);
      setEditingProduct(null);
    } catch (err: any) {
      const errMsg = err?.message || JSON.stringify(err);
      alert(`저장 실패: ${errMsg}`);
    }
  };

  const handleExport = () => {
    const excelData = filtered.map((p, idx) => {
      const count = assets.filter(a => a.modelName === p.modelName).length;
      return {
        '번호': idx + 1,
        '모델명': p.modelName,
        '피트(Feet)': p.feet ? `${p.feet} ft` : '-',
        '동력': p.powerSource || '-',
        '작업높이': p.workingHeight || '-',
        '발판높이': p.platformHeight || '-',
        '장비중량': p.weight || '-',
        '적재중량': p.capacityPreExt || '-',
        '장비크기': p.machineDimensions || '-',
        '플랫폼크기': p.platformDimensions || '-',
        '등판능력': p.gradeability || '-',
        '주행속도': p.speed || '-',
        '확장후본체': p.capacityPostExtMain || '-',
        '확장후확장부': p.capacityPostExtDeck || '-',
        '최대풍속': p.maxWindSpeed || '-',
        'A/S접수': p.asContact || '031-334-5296',
        '제조사': p.manufacturer || '-',
        '사용여부': p.isActive !== false ? '사용' : '미사용',
        '보유대수': `${count}대`,
        '등록일': p.createdAt.substring(0, 10)
      };
    });

    exportToExcel(excelData, `제품목록_${new Date().toISOString().split('T')[0]}`, '제품목록');
  };

  const filtered = products
    .filter(p => 
      (p.modelName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.manufacturer || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.spec || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.powerSource || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aVal: any = a[sortField as keyof Product];
      let bVal: any = b[sortField as keyof Product];

      if (sortField === 'assetCount') {
        aVal = assets.filter(x => x.modelName === a.modelName).length;
        bVal = assets.filter(x => x.modelName === b.modelName).length;
      } else if (sortField === 'isActive') {
        aVal = a.isActive !== false ? 1 : 0;
        bVal = b.isActive !== false ? 1 : 0;
      }

      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';

      let cmp = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal), 'ko');
      }

      return sortDirection === 'asc' ? cmp : -cmp;
    });

  const renderSortArrow = (field: ProductSortField) => {
    if (sortField !== field) return <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '4px' }}>↕</span>;
    return <span style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '12px', marginLeft: '4px' }}>{sortDirection === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <div>
      <div className="card-header" style={{ marginBottom: '16px' }}>
        <div>
          <h2 className="card-title">제품 모델 관리</h2>
          <p className="card-subtitle">장비 모델 및 제원표 규격 관리</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            새로고침
          </button>
          <button className="btn-secondary" onClick={handleExport}>
            <Download size={16} />
            내보내기
          </button>
          {canSave && (
            <button className="btn-primary" onClick={handleOpenAdd}>
              <Plus size={16} />
              모델 등록
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="모델명, 제조사, 동력, 제원 검색..."
            style={{ paddingLeft: '36px' }}
          />
        </div>
      </div>

      {/* 수직 전용 독립 스크롤 컨테이너 (고정 스티키 헤더 탑재) */}
      <div className="table-container" style={{ maxHeight: 'calc(850px - 260px)', overflowY: 'auto', overscrollBehavior: 'contain' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-sidebar)' }}>
            <tr>
              <th style={{ width: '60px', textAlign: 'center', whiteSpace: 'nowrap' }}>NO</th>
              <th onClick={() => handleSort('modelName')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                모델명 {renderSortArrow('modelName')}
              </th>
              <th onClick={() => handleSort('feet')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                피트 (FEET) {renderSortArrow('feet')}
              </th>
              <th style={{ whiteSpace: 'nowrap' }}>동력</th>
              <th style={{ whiteSpace: 'nowrap' }}>작업높이</th>
              <th style={{ whiteSpace: 'nowrap' }}>발판높이</th>
              <th style={{ whiteSpace: 'nowrap' }}>장비중량</th>
              <th style={{ whiteSpace: 'nowrap' }}>적재중량</th>
              <th style={{ whiteSpace: 'nowrap' }}>장비크기</th>
              <th style={{ whiteSpace: 'nowrap' }}>주행속도</th>
              <th onClick={() => handleSort('manufacturer')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                제조사 {renderSortArrow('manufacturer')}
              </th>
              <th onClick={() => handleSort('isActive')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                사용 여부 {renderSortArrow('isActive')}
              </th>
              <th onClick={() => handleSort('assetCount')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                보유 대수 {renderSortArrow('assetCount')}
              </th>
              <th onClick={() => handleSort('createdAt')} style={{ width: '110px', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                등록일 {renderSortArrow('createdAt')}
              </th>
              <th style={{ width: '130px', textAlign: 'center', whiteSpace: 'nowrap' }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={15} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  {products.length === 0 ? '등록된 제품 모델이 없습니다.' : '조회 조건에 맞는 제품 모델이 없습니다.'}
                </td>
              </tr>
            ) : (
              filtered.map((p, idx) => {
                const count = assets.filter(a => a.modelName === p.modelName).length;
                return (
                  <tr key={p.id} style={{ opacity: p.isActive !== false ? 1 : 0.6 }}>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{idx + 1}</td>
                    <td style={{ whiteSpace: 'nowrap' }}><strong style={{ color: 'var(--primary)' }}>{p.modelName}</strong></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.feet} ft</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.powerSource || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.workingHeight || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.platformHeight || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.weight || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.capacityPreExt || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.machineDimensions || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.speed || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.manufacturer || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span className={`badge ${p.isActive !== false ? 'badge-success' : 'badge-secondary'}`}>
                        {p.isActive !== false ? '사용' : '미사용'}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <strong style={{ color: count > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>{count}대</strong>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.createdAt.substring(0, 10)}</td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button
                          className="btn-secondary"
                          onClick={() => handleOpenPreview(p)}
                          style={{ padding: '3px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                          title="제원표 보기"
                        >
                          <FileText size={12} />
                          제원표
                        </button>
                        {canSave && (
                          <button
                            className="btn-secondary"
                            onClick={() => handleOpenEdit(p)}
                            style={{ padding: '3px 8px', fontSize: '11px' }}
                          >
                            수정
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 🌟 제원표 미리보기 모달 (규격표 디자인) */}
      {showPreviewModal && previewProduct && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
          padding: '20px'
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto',
            backgroundColor: '#ffffff', color: '#111827', padding: '24px', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>
                장비 제원표 미리보기
              </h3>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* 상단: 작업대 확장 전/후 적재중량 그래픽 헤더 */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}>
                작업대 확장 전 / 후 적재중량
              </div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#4b5563', marginBottom: '16px' }}>
                장비 모델 : <span style={{ color: '#1d4ed8', fontWeight: 'bold' }}>{previewProduct.modelName}</span>
              </div>

              {/* 하중 분배 다이어그램 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                {/* 확장 전 */}
                <div style={{ textAlign: 'center', borderRight: '1px dashed #d1d5db', paddingRight: '12px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}>
                    {previewProduct.capacityPreExt || '272 kg'}
                  </div>
                  <div style={{ fontSize: '20px', color: '#3b82f6', marginBottom: '4px' }}>⬇️</div>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151', backgroundColor: '#e5e7eb', padding: '6px', borderRadius: '4px' }}>
                    작업대 확장 전 (작업자 2인)
                  </div>
                </div>

                {/* 확장 후 */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '4px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#111827' }}>
                        {previewProduct.capacityPostExtMain || '159 kg'}
                      </div>
                      <div style={{ fontSize: '16px', color: '#3b82f6' }}>⬇️</div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>본체</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#111827' }}>
                        {previewProduct.capacityPostExtDeck || '113 kg'}
                      </div>
                      <div style={{ fontSize: '16px', color: '#3b82f6' }}>⬇️</div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>확장부</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151', backgroundColor: '#e5e7eb', padding: '6px', borderRadius: '4px' }}>
                    작업대 확장 후 (각 1인)
                  </div>
                </div>
              </div>

              {/* 최대풍속 배너 */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <div style={{ backgroundColor: '#dc2626', color: '#ffffff', fontWeight: 'bold', padding: '6px 14px', borderRadius: '4px', fontSize: '13px' }}>
                  최대풍속 : {previewProduct.maxWindSpeed || '12.5 m/s 이내'}
                </div>
              </div>
            </div>

            {/* 하단: 장비 제원표 테이블 */}
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', marginBottom: '8px', letterSpacing: '2px' }}>
              장 비 제 원 표
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #111827', fontSize: '13px', color: '#111827', textAlign: 'center' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #111827' }}>
                  <td style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', width: '22%', padding: '8px', borderRight: '1px solid #111827' }}>사용업체명</td>
                  <td style={{ width: '28%', padding: '8px', borderRight: '1px solid #111827', color: '#6b7280' }}>(계약처 자동출력)</td>
                  <td style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', width: '22%', padding: '8px', borderRight: '1px solid #111827' }}>임대업체명</td>
                  <td style={{ width: '28%', padding: '8px', fontWeight: 'bold' }}>㈜ 기연리프트</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #111827' }}>
                  <td style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', padding: '8px', borderRight: '1px solid #111827' }}>장 비 명</td>
                  <td style={{ padding: '8px', borderRight: '1px solid #111827', fontWeight: 'bold' }}>{previewProduct.modelName}</td>
                  <td style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', padding: '8px', borderRight: '1px solid #111827' }}>동 력</td>
                  <td style={{ padding: '8px' }}>{previewProduct.powerSource || '배터리'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #111827' }}>
                  <td style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', padding: '8px', borderRight: '1px solid #111827' }}>작업 높이</td>
                  <td style={{ padding: '8px', borderRight: '1px solid #111827' }}>{previewProduct.workingHeight || '-'}</td>
                  <td style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', padding: '8px', borderRight: '1px solid #111827' }}>발판 높이</td>
                  <td style={{ padding: '8px' }}>{previewProduct.platformHeight || '-'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #111827' }}>
                  <td style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', padding: '8px', borderRight: '1px solid #111827' }}>장비 중량</td>
                  <td style={{ padding: '8px', borderRight: '1px solid #111827' }}>{previewProduct.weight || '-'}</td>
                  <td style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', padding: '8px', borderRight: '1px solid #111827' }}>적재 중량</td>
                  <td style={{ padding: '8px' }}>{previewProduct.capacityPreExt || '-'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #111827' }}>
                  <td style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', padding: '8px', borderRight: '1px solid #111827' }}>장비 크기</td>
                  <td style={{ padding: '8px', borderRight: '1px solid #111827' }}>{previewProduct.machineDimensions || '-'}</td>
                  <td style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', padding: '8px', borderRight: '1px solid #111827' }}>등판 능력</td>
                  <td style={{ padding: '8px' }}>{previewProduct.gradeability || '-'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #111827' }}>
                  <td style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', padding: '8px', borderRight: '1px solid #111827' }}>플랫폼크기</td>
                  <td style={{ padding: '8px', borderRight: '1px solid #111827' }}>{previewProduct.platformDimensions || '-'}</td>
                  <td style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', padding: '8px', borderRight: '1px solid #111827' }}>주행 속도</td>
                  <td style={{ padding: '8px' }}>{previewProduct.speed || '-'}</td>
                </tr>
                <tr>
                  <td style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', padding: '8px', borderRight: '1px solid #111827' }}>A/S 접수</td>
                  <td colSpan={3} style={{ padding: '8px', fontWeight: 'bold', letterSpacing: '1px' }}>
                    {previewProduct.asContact || '031-334-5296'}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowPreviewModal(false)}
                style={{ padding: '6px 16px', fontSize: '13px' }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 등록 / 수정 모달 */}
      {showModal && editingProduct && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: '20px'
        }}>
          <form onSubmit={handleSubmit} className="card" style={{ width: '100%', maxWidth: '780px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>{editingProduct.id ? '제품 모델 및 제원 수정' : '신규 제품 모델 등록'}</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
              {/* 섹션 1: 기본 식별 정보 */}
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', color: 'var(--primary)' }}>기본 모델 정보</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>모델명 *</label>
                    <input
                      type="text"
                      value={editingProduct.modelName || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, modelName: e.target.value })}
                      placeholder="예: SJ3215"
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>피트 규격 (Feet) *</label>
                    <input
                      type="number"
                      step="any"
                      value={editingProduct.feet || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, feet: parseFloat(e.target.value) })}
                      placeholder="예: 15, 19, 32"
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>제조사</label>
                    <input
                      type="text"
                      value={editingProduct.manufacturer || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, manufacturer: e.target.value })}
                      placeholder="예: Skyjack, Genie"
                    />
                  </div>
                </div>
              </div>

              {/* 섹션 2: 제원표 13대 상세 규격 */}
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', color: 'var(--primary)' }}>장비 제원표 상세 규격 (PDF 자동 출력 항목)</h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>동력 방식</label>
                    <input
                      type="text"
                      value={editingProduct.powerSource || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, powerSource: e.target.value })}
                      placeholder="예: 배터리, 디젤, 전동"
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>A/S 접수 전화번호</label>
                    <input
                      type="text"
                      value={editingProduct.asContact || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, asContact: e.target.value })}
                      placeholder="예: 031-334-5296"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>작업 높이 (M)</label>
                    <input
                      type="text"
                      value={editingProduct.workingHeight || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, workingHeight: e.target.value })}
                      placeholder="예: 6.57 M"
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>발판 높이 (M)</label>
                    <input
                      type="text"
                      value={editingProduct.platformHeight || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, platformHeight: e.target.value })}
                      placeholder="예: 4.57 M"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>장비 중량 (Kg)</label>
                    <input
                      type="text"
                      value={editingProduct.weight || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, weight: e.target.value })}
                      placeholder="예: 1,148 Kg"
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>적재 중량 / 확장 전 (Kg)</label>
                    <input
                      type="text"
                      value={editingProduct.capacityPreExt || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, capacityPreExt: e.target.value })}
                      placeholder="예: 272 kg"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>장비 크기 (전장 x 전폭 x 전고)</label>
                    <input
                      type="text"
                      value={editingProduct.machineDimensions || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, machineDimensions: e.target.value })}
                      placeholder="예: 1.80 x 0.81 x 1.92 M"
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>등판 능력 (%)</label>
                    <input
                      type="text"
                      value={editingProduct.gradeability || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, gradeability: e.target.value })}
                      placeholder="예: 25 %"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>플랫폼 크기 (길이 x 폭)</label>
                    <input
                      type="text"
                      value={editingProduct.platformDimensions || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, platformDimensions: e.target.value })}
                      placeholder="예: 1.55 x 0.66 M"
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>주행 속도 (Km/h)</label>
                    <input
                      type="text"
                      value={editingProduct.speed || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, speed: e.target.value })}
                      placeholder="예: 3.4 Km/h"
                    />
                  </div>
                </div>
              </div>

              {/* 섹션 3: 확장 후 하중 및 안전 풍속 */}
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', color: 'var(--primary)' }}>작업대 확장 적재 하중 및 허용 풍속</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>확장 후 본체 하중 (1인)</label>
                    <input
                      type="text"
                      value={editingProduct.capacityPostExtMain || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, capacityPostExtMain: e.target.value })}
                      placeholder="예: 159 kg"
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>확장 후 확장부 하중 (1인)</label>
                    <input
                      type="text"
                      value={editingProduct.capacityPostExtDeck || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, capacityPostExtDeck: e.target.value })}
                      placeholder="예: 113 kg"
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>최대 허용 풍속</label>
                    <input
                      type="text"
                      value={editingProduct.maxWindSpeed || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, maxWindSpeed: e.target.value })}
                      placeholder="예: 12.5 m/s 이내"
                    />
                  </div>
                </div>
              </div>

              {/* 섹션 4: 안전인증 및 클라우드 링크 */}
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', color: 'var(--primary)' }}>안전인증 및 매뉴얼 링크</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>작업최대높이 / 적재용량</label>
                    <input
                      type="text"
                      value={editingProduct.maxHeightCapacity || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, maxHeightCapacity: e.target.value })}
                      placeholder="예: 6.57 M / 272 kg"
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>안전인증년월일 (KCs)</label>
                    <input
                      type="date"
                      value={editingProduct.safetyCertDate || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, safetyCertDate: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>안전인증서 클라우드 파일 링크</label>
                    <input
                      type="text"
                      value={editingProduct.safetyCertUrl || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, safetyCertUrl: e.target.value })}
                      placeholder="예: https://..."
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>제원표 원본 파일 링크</label>
                    <input
                      type="text"
                      value={editingProduct.specSheetUrl || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, specSheetUrl: e.target.value })}
                      placeholder="예: https://..."
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>비상조작방법 매뉴얼 링크</label>
                    <input
                      type="text"
                      value={editingProduct.emergencyGuideUrl || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, emergencyGuideUrl: e.target.value })}
                      placeholder="예: https://..."
                    />
                  </div>
                </div>
              </div>

              {/* 섹션 5: 제원 요약 메모 및 사용 여부 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>기타 비고 및 제원 특징</label>
                <textarea
                  value={editingProduct.spec || ''}
                  onChange={e => setEditingProduct({ ...editingProduct, spec: e.target.value })}
                  placeholder="작업 높이, 적재 용량 등 제원 기재"
                  rows={2}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border)', width: 'fit-content' }}>
                <input
                  type="checkbox"
                  id="productIsActive"
                  checked={editingProduct.isActive !== false}
                  onChange={e => setEditingProduct({ ...editingProduct, isActive: e.target.checked })}
                  style={{ width: '16px', height: '16px', cursor: 'pointer', margin: 0, padding: 0 }}
                />
                <label 
                  htmlFor="productIsActive" 
                  style={{ 
                    margin: 0, 
                    padding: 0, 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    cursor: 'pointer', 
                    color: 'var(--text-primary)', 
                    display: 'inline-block', 
                    whiteSpace: 'nowrap' 
                  }}
                >
                  사용 여부 (단종/매각 시 체크 해제)
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>취소</button>
              <button type="submit" className="btn-primary">저장</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
