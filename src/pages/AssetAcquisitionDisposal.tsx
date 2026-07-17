// d:\Kiyeun_Lift\src\pages\AssetAcquisitionDisposal.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShoppingBag, TrendingDown, DollarSign } from 'lucide-react';

export const AssetAcquisitionDisposal: React.FC = () => {
  const { assets, products, acquireAsset, disposeAsset, hasPermission } = useApp();
  const canSave = hasPermission('acquisition_disposal', 'save');

  const [activeTab, setActiveTab] = useState<'ACQUIRE' | 'DISPOSE'>('ACQUIRE');

  // 취득 폼 상태
  const [modelName, setModelName] = useState(products[0]?.modelName || '');
  const [assetNo, setAssetNo] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [acquisitionDate, setAcquisitionDate] = useState(new Date().toISOString().split('T')[0]);
  const [acquisitionPrice, setAcquisitionPrice] = useState(0);
  const [depreciationMonths, setDepreciationMonths] = useState(60);
  const [residualValueRate, setResidualValueRate] = useState(10); // %
  const [supplier, setSupplier] = useState('');
  const [memo1, setMemo1] = useState('');

  // 매각 폼 상태
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [disposalDate, setDisposalDate] = useState(new Date().toISOString().split('T')[0]);
  const [disposalPrice, setDisposalPrice] = useState(0);
  const [buyer, setBuyer] = useState('');

  // 매각 가능한 당사자산 목록 (대기 상태 자산만 매각 가능)
  const disposableAssets = assets.filter(a => a.ownerType === 'OWNED' && a.status === 'AVAILABLE');
  const activeAssetToDispose = assets.find(a => a.id === selectedAssetId);

  const handleAcquireSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) {
      alert('자산을 취득할 수 있는 저장 권한이 없습니다.');
      return;
    }
    if (!assetNo || !modelName) {
      alert('관리번호와 모델명은 필수 선택 항목입니다.');
      return;
    }

    // 이미 존재하는 관리번호인지 체크
    const dup = assets.find(a => a.assetNo === assetNo);
    if (dup) {
      alert('이미 등록된 관리번호입니다.');
      return;
    }

    acquireAsset({
      modelName,
      assetNo,
      serialNo,
      manufacturer,
      acquisitionDate,
      acquisitionPrice,
      depreciationMonths,
      residualValueRate,
      supplier,
      memo1,
      ownerType: 'OWNED'
    });

    alert(`신규 자산 ${assetNo} 취득 등록이 완료되었습니다.`);
    // 폼 리셋
    setAssetNo('');
    setSerialNo('');
    setAcquisitionPrice(0);
  };

  const handleDisposeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) {
      alert('매각 처리할 수 있는 저장 권한이 없습니다.');
      return;
    }
    if (!selectedAssetId || !buyer || disposalPrice <= 0) {
      alert('매각 대상 자산, 매각가, 매각처는 필수 입력 사항입니다.');
      return;
    }

    disposeAsset(selectedAssetId, {
      disposalDate,
      disposalPrice,
      buyer
    });

    alert(`자산 매각 및 매각처(${buyer}) 청구 생성 처리가 완료되었습니다.`);
    setSelectedAssetId('');
    setDisposalPrice(0);
    setBuyer('');
  };

  return (
    <div>
      <h2 style={{ marginBottom: '24px', fontWeight: '700' }}>당사자산 취득 / 매각 관리</h2>

      {/* 탭 네비게이션 */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
        <button
          className={activeTab === 'ACQUIRE' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setActiveTab('ACQUIRE')}
          style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <ShoppingBag size={16} /> 신규 자산 취득 (Acquisition)
        </button>
        <button
          className={activeTab === 'DISPOSE' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setActiveTab('DISPOSE')}
          style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <TrendingDown size={16} /> 기존 자산 매각 (Disposal)
        </button>
      </div>

      {!canSave && (
        <div className="card" style={{ color: 'var(--danger)', backgroundColor: 'var(--danger-light)', marginBottom: '20px', padding: '14px' }}>
          * 현재 조회 권한만 있습니다. 취득 및 매각을 수행하려면 저장 권한을 획득해야 합니다.
        </div>
      )}

      {activeTab === 'ACQUIRE' ? (
        <div className="card" style={{ maxWidth: '700px' }}>
          <div className="card-header" style={{ marginBottom: '20px' }}>
            <h3 className="card-title">신규 장비 자산 취득 등록</h3>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>당사 소유 자산으로 대장에 기본값을 저장합니다.</span>
          </div>

          <form onSubmit={handleAcquireSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label>제품 모델 선택 *</label>
                <select value={modelName} onChange={e => setModelName(e.target.value)} required disabled={!canSave}>
                  {products.map(p => (
                    <option key={p.id} value={p.modelName}>{p.modelName} ({p.manufacturer})</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label>관리번호 (Asset No.) *</label>
                <input
                  type="text"
                  value={assetNo}
                  onChange={e => setAssetNo(e.target.value)}
                  placeholder="예: SJ19-105"
                  required
                  disabled={!canSave}
                />
              </div>

              <div>
                <label>제조번호 (Serial No.)</label>
                <input
                  type="text"
                  value={serialNo}
                  onChange={e => setSerialNo(e.target.value)}
                  placeholder="예: S-8329482"
                  disabled={!canSave}
                />
              </div>

              <div>
                <label>제조사</label>
                <input
                  type="text"
                  value={manufacturer}
                  onChange={e => setManufacturer(e.target.value)}
                  placeholder="예: Skyjack (미입력시 제품기본값)"
                  disabled={!canSave}
                />
              </div>

              <div>
                <label>취득 일자 *</label>
                <input
                  type="date"
                  value={acquisitionDate}
                  onChange={e => setAcquisitionDate(e.target.value)}
                  required
                  disabled={!canSave}
                />
              </div>

              <div>
                <label>취득 금액 (원) *</label>
                <input
                  type="number"
                  value={acquisitionPrice || ''}
                  onChange={e => setAcquisitionPrice(parseInt(e.target.value) || 0)}
                  placeholder="취득 가격"
                  required
                  disabled={!canSave}
                />
              </div>

              <div>
                <label>감가상각 개월수 *</label>
                <input
                  type="number"
                  value={depreciationMonths}
                  onChange={e => setDepreciationMonths(parseInt(e.target.value) || 60)}
                  placeholder="보통 60개월 (5년)"
                  required
                  disabled={!canSave}
                />
              </div>

              <div>
                <label>잔존가치율 (%) *</label>
                <input
                  type="number"
                  value={residualValueRate}
                  onChange={e => setResidualValueRate(parseFloat(e.target.value) || 10)}
                  placeholder="보통 10%"
                  required
                  disabled={!canSave}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label>구입처 (납품업체)</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={e => setSupplier(e.target.value)}
                  placeholder="예: 스카이잭 대리점"
                  disabled={!canSave}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label>자산 비고 (특기사항)</label>
                <textarea
                  value={memo1}
                  onChange={e => setMemo1(e.target.value)}
                  placeholder="배터리 사양, 부착품 정보 등 기재"
                  rows={2}
                  disabled={!canSave}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn-primary" disabled={!canSave}>
                자산 취득 확정
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="card" style={{ maxWidth: '700px' }}>
          <div className="card-header" style={{ marginBottom: '20px' }}>
            <h3 className="card-title">기존 장비 자산 매각 처리</h3>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>자산 가치를 계산하고 매각처에 대금을 청구합니다.</span>
          </div>

          <form onSubmit={handleDisposeSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label>매각 대상 자산 선택 *</label>
                <select
                  value={selectedAssetId}
                  onChange={e => setSelectedAssetId(e.target.value)}
                  required
                  disabled={!canSave}
                >
                  <option value="">-- 매각 가능한 대기 장비 선택 --</option>
                  {disposableAssets.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.assetNo} - {a.modelName} (장부가치: {(a.bookValue || 0).toLocaleString()}원)
                    </option>
                  ))}
                </select>
                <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  * 현재 임대중이거나 수리중인 장비는 매각할 수 없습니다. (대기 AVAILABLE 상태만 가능)
                </small>
              </div>

              {activeAssetToDispose && (
                <div style={{
                  padding: '16px',
                  backgroundColor: 'var(--bg-app)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  fontSize: '14px'
                }}>
                  <div><label>취득가액</label><strong>{(activeAssetToDispose.acquisitionPrice || 0).toLocaleString()}원</strong></div>
                  <div><label>감가상각누계액</label><strong>{(activeAssetToDispose.accumDepreciation || 0).toLocaleString()}원</strong></div>
                  <div style={{ gridColumn: 'span 2' }}><label>현재 장부가치</label><strong style={{ color: 'var(--success)', fontSize: '16px' }}>{(activeAssetToDispose.bookValue || 0).toLocaleString()}원</strong></div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label>매각 일자 *</label>
                  <input
                    type="date"
                    value={disposalDate}
                    onChange={e => setDisposalDate(e.target.value)}
                    required
                    disabled={!canSave}
                  />
                </div>

                <div>
                  <label>매각 가격 (공급가액, 원) *</label>
                  <input
                    type="number"
                    value={disposalPrice || ''}
                    onChange={e => setDisposalPrice(parseInt(e.target.value) || 0)}
                    placeholder="매각 가격 입력"
                    required
                    disabled={!canSave}
                  />
                </div>
              </div>

              <div>
                <label>매각처 (인수 고객명) *</label>
                <input
                  type="text"
                  value={buyer}
                  onChange={e => setBuyer(e.target.value)}
                  placeholder="예: (주)한국중고기계"
                  required
                  disabled={!canSave}
                />
                <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  * 입력하신 매각처로 매각 대금 청구서가 자동 생성됩니다.
                </small>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn-danger" disabled={!canSave || !selectedAssetId}>
                매각 처리 및 청구생성
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
