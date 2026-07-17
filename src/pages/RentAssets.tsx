// d:\Kiyeun_Lift\src\pages\RentAssets.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, CheckCircle, Search, RefreshCw } from 'lucide-react';
import { Asset } from '../services/db';

export const RentAssets: React.FC = () => {
  const { assets, products, registerRentedAsset, returnRentedAsset, hasPermission } = useApp();
  const canSave = hasPermission('rent_asset', 'save');

  // 검색/필터 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [renterFilter, setRenterFilter] = useState('');

  // 등록/수정 및 반납 상태
  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Partial<Asset> | null>(null);

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnAssetId, setReturnAssetId] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);

  // 임차자산 리스트 추출
  const rentedAssets = assets.filter(a => a.ownerType === 'RENTED');

  const filtered = rentedAssets.filter(a => {
    const matchesSearch = 
      a.assetNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.modelName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRenter = !renterFilter || (a.renter && a.renter.toLowerCase().includes(renterFilter.toLowerCase()));

    return matchesSearch && matchesRenter;
  });

  // 유니크 임차처 목록 생성 (필터용)
  const rentersList = Array.from(new Set(rentedAssets.map(a => a.renter).filter(Boolean)));

  const handleOpenAdd = () => {
    setEditingAsset({
      modelName: products[0]?.modelName || '',
      assetNo: '',
      serialNo: '',
      manufacturer: '',
      renter: '',
      rentStart: new Date().toISOString().split('T')[0],
      rentEnd: new Date(new Date().getTime() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      monthlyRentFee: 0,
      dailyRentFee: 0,
      memo1: ''
    });
    setShowModal(true);
  };

  const handleOpenEdit = (a: Asset) => {
    setEditingAsset(a);
    setShowModal(true);
  };

  const handleOpenReturn = (id: string) => {
    setReturnAssetId(id);
    setReturnDate(new Date().toISOString().split('T')[0]);
    setShowReturnModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !editingAsset || !editingAsset.assetNo || !editingAsset.modelName) {
      alert('필수 입력을 확인해 주세요.');
      return;
    }

    registerRentedAsset(editingAsset);
    alert(`임차 자산(${editingAsset.assetNo}) 등록/수정이 완료되었습니다.`);
    setShowModal(false);
    setEditingAsset(null);
  };

  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !returnAssetId) return;

    returnRentedAsset(returnAssetId, returnDate);
    alert('임차 장비의 반납 처리가 완료되었습니다.');
    setShowReturnModal(false);
    setReturnAssetId('');
  };

  return (
    <div>
      <div className="card-header" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontWeight: '700' }}>임차자산 (타사 장비 재임대) 관리</h2>
        {canSave && (
          <button className="btn-primary" onClick={handleOpenAdd}>
            <Plus size={16} /> 임차자산 등록
          </button>
        )}
      </div>

      {/* 검색 필터 */}
      <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div>
            <label>자산 검색</label>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="관리번호, 모델명 검색..."
            />
          </div>
          <div>
            <label>임차처 (소유사) 필터</label>
            <select value={renterFilter} onChange={e => setRenterFilter(e.target.value)}>
              <option value="">전체 임차처</option>
              {rentersList.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 임차 자산 표 */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>관리번호</th>
              <th>모델명</th>
              <th>임차처 (소유원사)</th>
              <th>임차 기간</th>
              <th>월 임차료</th>
              <th>상태</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                  등록되었거나 검색 조건에 부합하는 임차 자산이 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map(a => (
                <tr key={a.id}>
                  <td><strong style={{ color: 'var(--primary)' }}>{a.assetNo}</strong></td>
                  <td>{a.modelName}</td>
                  <td>{a.renter}</td>
                  <td style={{ fontSize: '13px' }}>
                    {a.rentStart} ~ {a.rentEnd}
                  </td>
                  <td>{(a.monthlyRentFee || 0).toLocaleString()}원</td>
                  <td>
                    <span className={`badge ${
                      a.status === 'AVAILABLE' ? 'badge-success' :
                      a.status === 'RENTED' ? 'badge-info' : 'badge-danger'
                    }`}>
                      {a.status === 'AVAILABLE' ? '대기중' :
                       a.status === 'RENTED' ? '대여중' :
                       a.status === 'REPAIRING' ? '수리중' :
                       a.status === 'RENTED_RETURNED' ? '반납완료' : a.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {canSave && (
                        <button className="btn-secondary" onClick={() => handleOpenEdit(a)} style={{ padding: '4px 8px', fontSize: '12px' }}>
                          수정
                        </button>
                      )}
                      {canSave && a.status !== 'RENTED_RETURNED' && (
                        <button className="btn-danger" onClick={() => handleOpenReturn(a.id)} style={{ padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <CheckCircle size={12} /> 반납
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 등록/수정 모달 */}
      {showModal && editingAsset && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleSubmit} className="card" style={{ width: '100%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>
              {editingAsset.id ? '임차자산 정보 수정' : '신규 임차자산(재임대용) 등록'}
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>관리번호 *</label>
                  <input
                    type="text"
                    value={editingAsset.assetNo || ''}
                    disabled={!!editingAsset.id}
                    onChange={e => setEditingAsset({ ...editingAsset, assetNo: e.target.value })}
                    placeholder="예: RENT-001"
                    required
                  />
                </div>
                <div>
                  <label>제품 모델 선택 *</label>
                  <select
                    value={editingAsset.modelName || ''}
                    onChange={e => setEditingAsset({ ...editingAsset, modelName: e.target.value })}
                    required
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.modelName}>{p.modelName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>제조번호 (Serial)</label>
                  <input
                    type="text"
                    value={editingAsset.serialNo || ''}
                    onChange={e => setEditingAsset({ ...editingAsset, serialNo: e.target.value })}
                  />
                </div>
                <div>
                  <label>제조사 (영문)</label>
                  <input
                    type="text"
                    value={editingAsset.manufacturer || ''}
                    onChange={e => setEditingAsset({ ...editingAsset, manufacturer: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label>임차처 (소유 원렌탈사) *</label>
                <input
                  type="text"
                  value={editingAsset.renter || ''}
                  onChange={e => setEditingAsset({ ...editingAsset, renter: e.target.value })}
                  placeholder="예: (주)한국종합렌탈"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>임차 개시일 *</label>
                  <input
                    type="date"
                    value={editingAsset.rentStart || ''}
                    onChange={e => setEditingAsset({ ...editingAsset, rentStart: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label>임차 만료일 *</label>
                  <input
                    type="date"
                    value={editingAsset.rentEnd || ''}
                    onChange={e => setEditingAsset({ ...editingAsset, rentEnd: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>월 지불 임차료 (원) *</label>
                  <input
                    type="number"
                    value={editingAsset.monthlyRentFee || ''}
                    onChange={e => setEditingAsset({ ...editingAsset, monthlyRentFee: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div>
                  <label>일 지불 임차료 (원) *</label>
                  <input
                    type="number"
                    value={editingAsset.dailyRentFee || ''}
                    onChange={e => setEditingAsset({ ...editingAsset, dailyRentFee: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>

              <div>
                <label>메모 (임차조건 등)</label>
                <textarea
                  value={editingAsset.memo1 || ''}
                  onChange={e => setEditingAsset({ ...editingAsset, memo1: e.target.value })}
                  rows={2}
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

      {/* 반납 모달 */}
      {showReturnModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleReturnSubmit} className="card" style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>임차 장비 반납 확정</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              선택하신 장비를 소유원사에 최종 반납 처리하고, 장비 상태를 반납 완료로 업데이트합니다.
            </p>
            <div style={{ marginBottom: '20px' }}>
              <label>반납 처리일자</label>
              <input
                type="date"
                value={returnDate}
                onChange={e => setReturnDate(e.target.value)}
                required
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowReturnModal(false)}>취소</button>
              <button type="submit" className="btn-danger">반납 확정</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
