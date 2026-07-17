// d:\Kiyeun_Lift\src\pages\Products.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Download, Search } from 'lucide-react';
import { exportToExcel } from '../services/excel';
import { Product } from '../services/db';

export const Products: React.FC = () => {
  const { products, saveProduct, hasPermission } = useApp();
  const canSave = hasPermission('product', 'save');

  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

  const filtered = products.filter(p => 
    p.modelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.spec.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenAdd = () => {
    setEditingProduct({ modelName: '', feet: 19, spec: '', manufacturer: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editingProduct.modelName) return;
    saveProduct(editingProduct as Omit<Product, 'id' | 'createdAt'>);
    setShowModal(false);
    setEditingProduct(null);
  };

  const handleExport = () => {
    // 엑셀 저장용 데이터 형식화
    const excelData = filtered.map((p, idx) => ({
      '번호': idx + 1,
      '모델명': p.modelName,
      '피트(Feet)': p.feet ? `${p.feet} ft` : '-',
      '제원 및 특징': p.spec,
      '제조사': p.manufacturer,
      '등록일': p.createdAt.substring(0, 10)
    }));

    exportToExcel(excelData, `제품목록_${new Date().toISOString().split('T')[0]}`, '제품목록');
  };

  return (
    <div>
      <div className="card-header" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontWeight: '700' }}>제품 모델 관리</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
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

      <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
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

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '80px' }}>No</th>
              <th>모델명</th>
              <th>피트 (Feet)</th>
              <th>제원 및 특징</th>
              <th>제조사</th>
              <th style={{ width: '120px' }}>등록일</th>
              {canSave && <th style={{ width: '100px' }}>작업</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={canSave ? 7 : 6} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                  등록되었거나 검색 조건에 부합하는 제품 모델이 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((p, idx) => (
                <tr key={p.id}>
                  <td>{idx + 1}</td>
                  <td><strong style={{ color: 'var(--primary)' }}>{p.modelName}</strong></td>
                  <td>{p.feet} ft</td>
                  <td>{p.spec}</td>
                  <td>{p.manufacturer}</td>
                  <td>{p.createdAt.substring(0, 10)}</td>
                  {canSave && (
                    <td>
                      <button className="btn-secondary" onClick={() => handleOpenEdit(p)} style={{ padding: '4px 8px', fontSize: '12px' }}>
                        수정
                      </button>
                    </td>
                  )}
                </tr>
              ))
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
                  value={editingProduct.feet || 0}
                  onChange={e => setEditingProduct({ ...editingProduct, feet: parseFloat(e.target.value) })}
                  placeholder="예: 19"
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
