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
  const [manufactureYear, setManufactureYear] = useState('');
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
      manufactureYear,
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

  const [disposalBillingYm, setDisposalBillingYm] = useState(() => new Date().toISOString().slice(0, 7));

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
      buyer,
      billingYm: disposalBillingYm
    });

    alert(`자산 매각 및 매각처(${buyer}) 청구 생성 처리가 완료되었습니다.`);
    setSelectedAssetId('');
    setDisposalPrice(0);
    setBuyer('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <h2 style={{ marginBottom: 0, fontWeight: '700', fontSize: '18px' }}>당사자산 취득 / 매각 관리</h2>

      {/* 📊 자산 취득 및 매각 현황 실시간 요약 바 */}
      {(() => {
        const ownedList = assets.filter(a => a.ownerType === 'OWNED');
        const soldList = assets.filter(a => a.status === 'SOLD');
        const totalAcqPrice = ownedList.reduce((sum, a) => sum + (a.acquisitionPrice || 0), 0);

        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', marginBottom: 0 }}>
            <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>보유 당사자산</span>
              <strong style={{ fontSize: '14px', color: 'var(--primary)' }}>{ownedList.length}대</strong>
            </div>
            <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>총 취득원가 합계</span>
              <strong style={{ fontSize: '14px', color: '#0070C0' }}>₩{totalAcqPrice.toLocaleString()}원</strong>
            </div>
            <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>매각 처분 완료</span>
              <strong style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{soldList.length}대</strong>
            </div>
          </div>
        );
      })()}

      {/* 탭 네비게이션 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: 0 }}>
        <button
          className={activeTab === 'ACQUIRE' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setActiveTab('ACQUIRE')}
          style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}
        >
          <ShoppingBag size={14} /> 신규 자산 취득 (Acquisition)
        </button>
        <button
          className={activeTab === 'DISPOSE' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setActiveTab('DISPOSE')}
          style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}
        >
          <TrendingDown size={14} /> 기존 자산 매각 (Disposal)
        </button>
      </div>

      {!canSave && (
        <div className="card" style={{ color: 'var(--danger)', backgroundColor: 'var(--danger-light)', marginBottom: 0, padding: '10px 14px', fontSize: '12px' }}>
          * 현재 조회 권한만 있습니다. 취득 및 매각을 수행하려면 저장 권한을 획득해야 합니다.
        </div>
      )}

      {activeTab === 'ACQUIRE' ? (
        <div className="card" style={{ maxWidth: '820px', padding: '14px 18px', margin: 0 }}>
          <div className="card-header" style={{ marginBottom: '10px', paddingBottom: '6px' }}>
            <h3 className="card-title" style={{ fontSize: '15px', margin: 0 }}>신규 장비 자산 취득 등록</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>당사 소유 자산으로 대장에 기본값을 저장합니다.</span>
          </div>

          <form onSubmit={handleAcquireSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
              
              {/* Row 1 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>제품 모델 선택 *</label>
                <select value={modelName} onChange={e => setModelName(e.target.value)} required disabled={!canSave} style={{ padding: '5px 8px', fontSize: '12.5px' }}>
                  {products.map(p => (
                    <option key={p.id} value={p.modelName}>{p.modelName} ({p.manufacturer})</option>
                  ))}
                </select>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>관리번호 (Asset No.) *</label>
                <input
                  type="text"
                  value={assetNo}
                  onChange={e => setAssetNo(e.target.value)}
                  placeholder="예: SJ19-105"
                  required
                  disabled={!canSave}
                  style={{ padding: '5px 8px', fontSize: '12.5px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>제조사</label>
                <input
                  type="text"
                  value={manufacturer}
                  onChange={e => setManufacturer(e.target.value)}
                  placeholder="예: Skyjack (미입력시 제품기본값)"
                  disabled={!canSave}
                  style={{ padding: '5px 8px', fontSize: '12.5px' }}
                />
              </div>

              {/* Row 2 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>제조번호 (Serial No.)</label>
                <input
                  type="text"
                  value={serialNo}
                  onChange={e => setSerialNo(e.target.value)}
                  placeholder="예: S-8329482"
                  disabled={!canSave}
                  style={{ padding: '5px 8px', fontSize: '12.5px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>제조년도</label>
                <input
                  type="text"
                  value={manufactureYear}
                  onChange={e => setManufactureYear(e.target.value)}
                  placeholder="예: 2023"
                  disabled={!canSave}
                  style={{ padding: '5px 8px', fontSize: '12.5px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>취득 일자 *</label>
                <input
                  type="date"
                  value={acquisitionDate}
                  onChange={e => setAcquisitionDate(e.target.value)}
                  required
                  disabled={!canSave}
                  style={{ padding: '5px 8px', fontSize: '12.5px' }}
                />
              </div>

              {/* Row 3 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>취득 금액 (원) *</label>
                <input
                  type="number"
                  value={acquisitionPrice || ''}
                  onChange={e => setAcquisitionPrice(parseInt(e.target.value) || 0)}
                  placeholder="취득 가격"
                  required
                  disabled={!canSave}
                  style={{ padding: '5px 8px', fontSize: '12.5px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>감가상각 개월수 *</label>
                <input
                  type="number"
                  value={depreciationMonths}
                  onChange={e => setDepreciationMonths(parseInt(e.target.value) || 60)}
                  placeholder="보통 60개월"
                  required
                  disabled={!canSave}
                  style={{ padding: '5px 8px', fontSize: '12.5px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>잔존가치율 (%) *</label>
                <input
                  type="number"
                  value={residualValueRate}
                  onChange={e => setResidualValueRate(parseFloat(e.target.value) || 10)}
                  placeholder="보통 10%"
                  required
                  disabled={!canSave}
                  style={{ padding: '5px 8px', fontSize: '12.5px' }}
                />
              </div>

              {/* Row 4 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', gridColumn: 'span 1' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>구입처 (납품업체)</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={e => setSupplier(e.target.value)}
                  placeholder="예: 스카이잭 대리점"
                  disabled={!canSave}
                  style={{ padding: '5px 8px', fontSize: '12.5px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', gridColumn: 'span 2' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>자산 비고 (특기사항)</label>
                <input
                  type="text"
                  value={memo1}
                  onChange={e => setMemo1(e.target.value)}
                  placeholder="배터리 사양, 부착품 정보 등 기재"
                  disabled={!canSave}
                  style={{ padding: '5px 8px', fontSize: '12.5px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
              <button type="submit" className="btn-primary" disabled={!canSave} style={{ padding: '6px 18px', fontSize: '13px', fontWeight: 'bold' }}>
                자산 취득 확정
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="card" style={{ maxWidth: '820px', padding: '14px 18px', margin: 0 }}>
          <div className="card-header" style={{ marginBottom: '10px', paddingBottom: '6px' }}>
            <h3 className="card-title" style={{ fontSize: '15px', margin: 0 }}>기존 장비 자산 매각 처리</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>자산 가치를 계산하고 매각처에 대금을 청구합니다.</span>
          </div>

          <form onSubmit={handleDisposeSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>매각 대상 자산 선택 *</label>
                <select
                  value={selectedAssetId}
                  onChange={e => setSelectedAssetId(e.target.value)}
                  required
                  disabled={!canSave}
                  style={{ padding: '5px 8px', fontSize: '12.5px', width: '100%' }}
                >
                  <option value="">-- 매각 가능한 대기 장비 선택 --</option>
                  {disposableAssets.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.assetNo} - {a.modelName} (장부가치: {(a.bookValue || 0).toLocaleString()}원)
                    </option>
                  ))}
                </select>
                <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '2px', fontSize: '11px' }}>
                  * 현재 임대중이거나 수리중인 장비는 매각할 수 없습니다. (대기 AVAILABLE 상태만 가능)
                </small>
              </div>

              {activeAssetToDispose && (
                <div style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-app)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                  fontSize: '12.5px'
                }}>
                  <div><span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>취득가액</span><div><strong>{(activeAssetToDispose.acquisitionPrice || 0).toLocaleString()}원</strong></div></div>
                  <div><span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>감가상각누계액</span><div><strong>{(activeAssetToDispose.accumDepreciation || 0).toLocaleString()}원</strong></div></div>
                  <div><span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>현재 장부가치</span><div><strong style={{ color: 'var(--success)', fontSize: '14px' }}>{(activeAssetToDispose.bookValue || 0).toLocaleString()}원</strong></div></div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>매각 일자 *</label>
                  <input
                    type="date"
                    value={disposalDate}
                    onChange={e => setDisposalDate(e.target.value)}
                    required
                    disabled={!canSave}
                    style={{ padding: '5px 8px', fontSize: '12.5px' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>매각 가격 (공급가액, 원) *</label>
                  <input
                    type="number"
                    value={disposalPrice || ''}
                    onChange={e => setDisposalPrice(parseInt(e.target.value) || 0)}
                    placeholder="매각 가격 입력"
                    required
                    disabled={!canSave}
                    style={{ padding: '5px 8px', fontSize: '12.5px' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>청구 귀속월</label>
                  <input
                    type="month"
                    value={disposalBillingYm}
                    onChange={e => setDisposalBillingYm(e.target.value)}
                    required
                    disabled={!canSave}
                    style={{ padding: '5px 8px', fontSize: '12.5px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>매각처 (인수 고객명) *</label>
                <input
                  type="text"
                  value={buyer}
                  onChange={e => setBuyer(e.target.value)}
                  placeholder="예: (주)한국중고기계"
                  required
                  disabled={!canSave}
                  style={{ padding: '5px 8px', fontSize: '12.5px' }}
                />
                <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '2px', fontSize: '11px' }}>
                  * 입력하신 매각처로 매각 대금 청구서가 자동 생성됩니다.
                </small>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
              <button type="submit" className="btn-danger" disabled={!canSave || !selectedAssetId} style={{ padding: '6px 18px', fontSize: '13px', fontWeight: 'bold' }}>
                매각 처리 및 청구생성
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
