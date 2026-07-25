// d:\Kiyeun_Lift\src\pages\Products.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Download, Search, RefreshCw } from 'lucide-react';
import { exportToExcel } from '../services/excel';
import { db, Product } from '../services/db';

export const Products: React.FC = () => {
  const { products, saveProduct, hasPermission, assets, refreshAllData } = useApp();
  const canSave = hasPermission('product', 'save');

  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAllData();
      alert("✨ 최신 데이터를 성공적으로 불러왔습니다.");
    } catch (err: any) {
      console.error("Failed to sync from Supabase:", err);
      alert("❌ 최신 데이터를 가져오는 데 실패했습니다.");
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
    setEditingProduct({ modelName: '', feet: 19, spec: '', manufacturer: '', isActive: true, safetyCertUrl: '', specSheetUrl: '', emergencyGuideUrl: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setShowModal(true);
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

    // 1. 송신 예정 쿼리 시뮬레이션 생성 및 팝업 안내
    const isEdit = !!editingProduct.id;
    const finalProduct = {
      ...editingProduct,
      isActive: editingProduct.isActive !== false,
    };
    
    let simulatedQuery = "";
    if (isEdit) {
      simulatedQuery = `UPDATE products \nSET "modelName" = '${finalProduct.modelName}', feet = ${finalProduct.feet}, manufacturer = '${finalProduct.manufacturer || ''}', spec = '${finalProduct.spec || ''}' \nWHERE id = '${finalProduct.id}';`;
    } else {
      const nextId = db.generateNextId('products', products);
      simulatedQuery = `INSERT INTO products (id, "modelName", feet, spec, manufacturer, "createdAt") \nVALUES ('${nextId}', '${finalProduct.modelName}', ${finalProduct.feet}, '${finalProduct.spec || ''}', '${finalProduct.manufacturer || ''}', '${new Date().toISOString()}');`;
    }

    alert(`[DB 전송 예정 SQL 쿼리 안내]\n\n${simulatedQuery}\n\n확인을 누르면 Supabase에 전송됩니다.`);

    try {
      await saveProduct(editingProduct as Omit<Product, 'id' | 'createdAt'>);
      alert("🎉 데이터 저장 및 Supabase 동기화 성공!");
      setShowModal(false);
      setEditingProduct(null);
    } catch (err: any) {
      const errMsg = err?.message || JSON.stringify(err);
      alert(`❌ Supabase 동기화 실패!\n\n에러 메시지: ${errMsg}`);
    }
  };

  const handleExport = () => {
    // 엑셀 저장용 데이터 형식화
    const excelData = filtered.map((p, idx) => {
      const count = assets.filter(a => a.modelName === p.modelName).length;
      return {
        '번호': idx + 1,
        '모델명': p.modelName,
        '피트(Feet)': p.feet ? `${p.feet} ft` : '-',
        '제원 및 특징': p.spec,
        '제조사': p.manufacturer,
        '사용 여부': p.isActive !== false ? '사용' : '미사용',
        '보유 대수': `${count}대`,
        '등록일': p.createdAt.substring(0, 10)
      };
    });

    exportToExcel(excelData, `제품목록_${new Date().toISOString().split('T')[0]}`, '제품목록');
  };

  const filtered = products
    .filter(p => 
      (p.modelName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.manufacturer || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.spec || '').toLowerCase().includes(searchTerm.toLowerCase())
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
          <h2 style={{ fontWeight: '700' }}>제품 모델 관리</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            전체 <strong>{products.length}</strong>개 제품 등록됨 (검색 결과: <strong>{filtered.length}</strong>건)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={handleRefresh} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} /> 조회
          </button>
          <button className="btn-secondary" onClick={handleExport}>
            <Download size={16} /> 엑셀 다운로드
          </button>
          {canSave && (
            <button className="btn-primary" onClick={handleOpenAdd}>
              <Plus size={16} /> 제품 등록
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: '12px 16px', marginBottom: '16px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="모델명, 제조사, 제원 특징 검색..."
            style={{ paddingLeft: '36px' }}
          />
        </div>
      </div>

      {/* 수직 전용 독립 스크롤 컨테이너 (고정 스티키 헤더 탑재) */}
      <div className="table-container" style={{ maxHeight: 'calc(850px - 260px)', overflowY: 'auto', overscrollBehavior: 'contain' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-sidebar)' }}>
            <tr>
              <th style={{ width: '60px', textAlign: 'center' }}>NO</th>
              <th onClick={() => handleSort('modelName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                모델명 {renderSortArrow('modelName')}
              </th>
              <th onClick={() => handleSort('feet')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                피트 (FEET) {renderSortArrow('feet')}
              </th>
              <th onClick={() => handleSort('spec')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                제원 및 특징 {renderSortArrow('spec')}
              </th>
              <th onClick={() => handleSort('manufacturer')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                제조사 {renderSortArrow('manufacturer')}
              </th>
              <th onClick={() => handleSort('isActive')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                사용 여부 {renderSortArrow('isActive')}
              </th>
              <th onClick={() => handleSort('assetCount')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                보유 대수 {renderSortArrow('assetCount')}
              </th>
              <th onClick={() => handleSort('createdAt')} style={{ width: '120px', cursor: 'pointer', userSelect: 'none' }}>
                등록일 {renderSortArrow('createdAt')}
              </th>
              {canSave && <th style={{ width: '80px', textAlign: 'center' }}>작업</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={canSave ? 9 : 8} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  등록되었거나 검색 조건에 부합하는 제품 모델이 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((p, idx) => {
                const count = assets.filter(a => a.modelName === p.modelName).length;
                return (
                  <tr key={p.id} style={{ opacity: p.isActive !== false ? 1 : 0.6 }}>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                    <td><strong style={{ color: 'var(--primary)' }}>{p.modelName}</strong></td>
                    <td>{p.feet} ft</td>
                    <td>{p.spec}</td>
                    <td>{p.manufacturer}</td>
                    <td>
                      <span className={`badge ${p.isActive !== false ? 'badge-success' : 'badge-secondary'}`}>
                        {p.isActive !== false ? '사용' : '미사용'}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: count > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>{count}대</strong>
                    </td>
                    <td>{p.createdAt.substring(0, 10)}</td>
                    {canSave && (
                      <td style={{ textAlign: 'center' }}>
                        <button className="btn-secondary" onClick={() => handleOpenEdit(p)} style={{ padding: '4px 8px', fontSize: '12px' }}>
                          수정
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showModal && editingProduct && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleSubmit} className="card" style={{ width: '100%', maxWidth: '450px', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>{editingProduct.id ? '제품 모델 수정' : '신규 제품 모델 등록'}</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label>모델명 *</label>
                <input
                  type="text"
                  value={editingProduct.modelName || ''}
                  onChange={e => setEditingProduct({ ...editingProduct, modelName: e.target.value })}
                  placeholder="예: SJ3219"
                  required
                />
              </div>
              <div>
                <label>피트 규격 (Feet) *</label>
                <input
                  type="number"
                  step="any"
                  value={editingProduct.feet || ''}
                  onChange={e => setEditingProduct({ ...editingProduct, feet: parseFloat(e.target.value) })}
                  placeholder="예: 3.6, 12, 19"
                  required
                />
              </div>
              <div>
                <label>제조사</label>
                <input
                  type="text"
                  value={editingProduct.manufacturer || ''}
                  onChange={e => setEditingProduct({ ...editingProduct, manufacturer: e.target.value })}
                  placeholder="예: Skyjack, Genie"
                />
              </div>
              <div>
                <label>제원 및 특징</label>
                <textarea
                  value={editingProduct.spec || ''}
                  onChange={e => setEditingProduct({ ...editingProduct, spec: e.target.value })}
                  placeholder="작업 높이, 적재 용량 등 제원 기재"
                  rows={3}
                />
              </div>
              <div>
                <label>안전인증서 구글드라이브 파일 링크</label>
                <input
                  type="text"
                  value={editingProduct.safetyCertUrl || ''}
                  onChange={e => setEditingProduct({ ...editingProduct, safetyCertUrl: e.target.value })}
                  placeholder="예: https://drive.google.com/file/d/..."
                />
              </div>
              <div>
                <label>제원표 구글드라이브 파일 링크</label>
                <input
                  type="text"
                  value={editingProduct.specSheetUrl || ''}
                  onChange={e => setEditingProduct({ ...editingProduct, specSheetUrl: e.target.value })}
                  placeholder="예: https://drive.google.com/file/d/..."
                />
              </div>
              <div>
                <label>비상조작방법 구글드라이브 파일 링크</label>
                <input
                  type="text"
                  value={editingProduct.emergencyGuideUrl || ''}
                  onChange={e => setEditingProduct({ ...editingProduct, emergencyGuideUrl: e.target.value })}
                  placeholder="예: https://drive.google.com/file/d/..."
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', padding: '10px 14px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border)', width: 'fit-content' }}>
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
