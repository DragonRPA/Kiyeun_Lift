// d:\Kiyeun_Lift\src\pages\Consumables.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShoppingCart, Hammer, ListCollapse, Layers } from 'lucide-react';

export const Consumables: React.FC = () => {
  const {
    consumables, consumableLogs, assets, purchaseConsumable, useConsumable, hasPermission, users
  } = useApp();

  const canSave = hasPermission('consumable', 'save');
  const [activeTab, setActiveTab] = useState<'STOCK' | 'PURCHASE' | 'USE' | 'LOGS'>('STOCK');

  // 입고 폼 상태
  const [inModel, setInModel] = useState('');
  const [inQty, setInQty] = useState(1);
  const [inUnit, setInUnit] = useState('개');
  const [inPrice, setInPrice] = useState(0);
  const [inSupplier, setInSupplier] = useState('');

  // 사용 폼 상태
  const [useConsumableId, setUseConsumableId] = useState('');
  const [useQty, setUseQty] = useState(1);
  const [useAssetId, setUseAssetId] = useState('');
  const [useDesc, setUseDesc] = useState('');

  const getUserName = (id?: string) => {
    if (!id) return '시스템';
    return users.find(u => u.id === id)?.name || '정비 담당자';
  };

  const getAssetNo = (id?: string) => {
    if (!id) return '-';
    return assets.find(a => a.id === id)?.assetNo || '-';
  };

  const handlePurchaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    if (!inModel || inQty <= 0 || inPrice <= 0) {
      alert('필수 값을 정확하게 입력해 주세요.');
      return;
    }

    purchaseConsumable({
      modelName: inModel,
      qty: inQty,
      unit: inUnit,
      unitPrice: inPrice,
      supplier: inSupplier
    });

    alert('소모품 구입 입고가 완료되었습니다.');
    setInModel('');
    setInQty(1);
    setInPrice(0);
    setInSupplier('');
  };

  const handleUseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    if (!useConsumableId || useQty <= 0 || !useAssetId) {
      alert('필수 값을 선택해 주세요.');
      return;
    }

    const selectedConsumable = consumables.find(c => c.id === useConsumableId);
    if (!selectedConsumable || selectedConsumable.stockQty < useQty) {
      alert('재고가 부족하여 소모품을 사용할 수 없습니다.');
      return;
    }

    useConsumable({
      consumableId: useConsumableId,
      quantity: useQty,
      targetAssetId: useAssetId,
      description: useDesc || '정비 소모품 수동 등록 사용'
    });

    alert('소모품 사용 등록이 완료되었습니다. 재고가 차감되고 자산 정비 누적비용이 반영되었습니다.');
    setUseConsumableId('');
    setUseQty(1);
    setUseAssetId('');
    setUseDesc('');
  };

  return (
    <div>
      <h2 style={{ marginBottom: '24px', fontWeight: '700' }}>소모품 및 자재 관리</h2>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
        <button className={activeTab === 'STOCK' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('STOCK')}>
          보유 재고 현황
        </button>
        {canSave && (
          <>
            <button className={activeTab === 'PURCHASE' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('PURCHASE')}>
              <ShoppingCart size={14} /> 소모품 구입 (입고)
            </button>
            <button className={activeTab === 'USE' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('USE')}>
              <Hammer size={14} /> 소모품 사용 (출고)
            </button>
          </>
        )}
        <button className={activeTab === 'LOGS' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('LOGS')}>
          <ListCollapse size={14} /> 입출고 이력 로그
        </button>
      </div>

      {activeTab === 'STOCK' && (
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header">
            <h3 className="card-title">소모품 보유 수량 목록</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>* 재고 5개 이하 시 위험 경보</span>
          </div>

          <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>자재 품목명</th>
                  <th style={{ textAlign: 'center' }}>구입수량</th>
                  <th style={{ textAlign: 'center' }}>사용수량</th>
                  <th style={{ textAlign: 'center' }}>현재 재고수량</th>
                  <th>단위</th>
                  <th>단가</th>
                  <th>최근 구입처</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {consumables.map(c => {
                  const logs = consumableLogs.filter(l => l.consumableId === c.id);
                  const totalUsed = logs.filter(l => l.type === 'OUTBOUND').reduce((sum, l) => sum + l.quantity, 0);
                  const totalPurchased = c.stockQty + totalUsed;

                  return (
                    <tr key={c.id}>
                      <td><strong style={{ color: 'var(--primary)' }}>{c.modelName}</strong></td>
                      <td style={{ textAlign: 'center' }}>{totalPurchased}</td>
                      <td style={{ textAlign: 'center', color: 'var(--danger)', fontWeight: '500' }}>{totalUsed}</td>
                      <td style={{ textAlign: 'center', fontWeight: '700', fontSize: '15px', color: 'var(--success)' }}>{c.stockQty}</td>
                      <td>{c.unit}</td>
                      <td>{c.unitPrice.toLocaleString()}원</td>
                      <td>{c.supplier || '-'}</td>
                    <td>
                      {c.stockQty <= 2 ? (
                        <span className="badge badge-danger">재고 부족 (긴급)</span>
                      ) : c.stockQty < 5 ? (
                        <span className="badge badge-warning">보충 필요</span>
                      ) : (
                        <span className="badge badge-success">여유</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'PURCHASE' && (
        <div className="card" style={{ maxWidth: '600px', margin: 0 }}>
          <h3 className="card-title" style={{ marginBottom: '20px' }}>소모품 신규 구입 / 추가 등록</h3>
          <form onSubmit={handlePurchaseSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label>소모품 모델명 *</label>
                <input
                  type="text"
                  value={inModel}
                  onChange={e => setInModel(e.target.value)}
                  placeholder="예:USUS-2200 딥사이클 배터리"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>입고 수량 *</label>
                  <input
                    type="number"
                    value={inQty || ''}
                    onChange={e => setInQty(parseInt(e.target.value) || 1)}
                    min={1}
                    required
                  />
                </div>
                <div>
                  <label>단위 *</label>
                  <select value={inUnit} onChange={e => setInUnit(e.target.value)}>
                    <option value="개">개 (ea)</option>
                    <option value="박스">박스 (box)</option>
                    <option value="드럼">드럼 (drum)</option>
                    <option value="세트">세트 (set)</option>
                  </select>
                </div>
              </div>

              <div>
                <label>매입 단가 (원) *</label>
                <input
                  type="number"
                  value={inPrice || ''}
                  onChange={e => setInPrice(parseInt(e.target.value) || 0)}
                  placeholder="개당 단가 입력"
                  required
                />
              </div>

              <div>
                <label>구입처 (자재상사)</label>
                <input
                  type="text"
                  value={inSupplier}
                  onChange={e => setInSupplier(e.target.value)}
                  placeholder="예: 세방전지 경기총판"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn-primary">입고 처리</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'USE' && (
        <div className="card" style={{ maxWidth: '600px', margin: 0 }}>
          <h3 className="card-title" style={{ marginBottom: '20px' }}>소모품 수리 정비 사용 등록</h3>
          <form onSubmit={handleUseSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label>자재 품목 선택 *</label>
                <select value={useConsumableId} onChange={e => setUseConsumableId(e.target.value)} required>
                  <option value="">-- 소모품 품목 선택 --</option>
                  {consumables.map(c => (
                    <option key={c.id} value={c.id}>{c.modelName} (현재고: {c.stockQty}{c.unit})</option>
                  ))}
                </select>
              </div>

              <div>
                <label>사용 수량 *</label>
                <input
                  type="number"
                  value={useQty || ''}
                  onChange={e => setUseQty(parseInt(e.target.value) || 1)}
                  min={1}
                  required
                />
              </div>

              <div>
                <label>장착 자산 (관리번호) *</label>
                <select value={useAssetId} onChange={e => setUseAssetId(e.target.value)} required>
                  <option value="">-- 대상 장비 자산 선택 --</option>
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>{a.assetNo} ({a.modelName}) - {a.status}</option>
                  ))}
                </select>
              </div>

              <div>
                <label>사용 내역 설명</label>
                <textarea
                  value={useDesc}
                  onChange={e => setUseDesc(e.target.value)}
                  placeholder="사용 목적 및 교체 사유 기술..."
                  rows={2}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn-primary">사용 확정</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'LOGS' && (
        <div className="card" style={{ margin: 0 }}>
          <h3 className="card-title" style={{ marginBottom: '20px' }}>입출고 변동 상세 이력</h3>
          
          <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>구분</th>
                  <th>변동일자</th>
                  <th>자재 품목명</th>
                  <th>수량</th>
                  <th>단가</th>
                  <th>소계</th>
                  <th>대상장비</th>
                  <th>처리담당자</th>
                  <th>설명</th>
                </tr>
              </thead>
              <tbody>
                {consumableLogs.map(log => {
                  const item = consumables.find(c => c.id === log.consumableId);
                  return (
                    <tr key={log.id}>
                      <td>
                        <span className={`badge ${log.type === 'INBOUND' ? 'badge-success' : 'badge-danger'}`}>
                          {log.type === 'INBOUND' ? '구입입고' : '자재사용'}
                        </span>
                      </td>
                      <td>{log.actionDate}</td>
                      <td>{item?.modelName || '삭제된 소모품'}</td>
                      <td>
                        {log.type === 'INBOUND' ? '+' : '-'}{log.quantity}
                      </td>
                      <td>{log.unitPrice.toLocaleString()}원</td>
                      <td style={{ fontWeight: '600' }}>
                        {(log.quantity * log.unitPrice).toLocaleString()}원
                      </td>
                      <td>{log.targetAssetId ? getAssetNo(log.targetAssetId) : '-'}</td>
                      <td>{getUserName(log.userId)}</td>
                      <td style={{ fontSize: '13px' }}>{log.description}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
