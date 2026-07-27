// d:\Kiyeun_Lift\src\pages\AssetHistory.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Download, Clock, Layers, ArrowUpRight, ArrowDownLeft, Wrench, Settings, AlertCircle } from 'lucide-react';
import { exportToExcel } from '../services/excel';

export const AssetHistory: React.FC = () => {
  const { 
    assetInOutLogs, assets, customers, sites, deliveries, repairs, repairConsumables, consumables, navigationPayload, setNavigationPayload 
  } = useApp();

  // 검색/필터 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');

  // 0. 타 탭 이동 페이로드(특정 자산 이력 조회) 감지
  React.useEffect(() => {
    if (navigationPayload && navigationPayload.assetId) {
      setSelectedAssetId(navigationPayload.assetId);
      setNavigationPayload(null); // 페이로드 소비 후 소멸
    }
  }, [navigationPayload]);

  // 1. 입출고 및 정비 이력 필터링
  const filteredLogs = assetInOutLogs.filter(log => {
    const matchesSearch = 
      log.assetNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.modelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.customerName && log.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.memo && log.memo.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = !typeFilter || log.type === typeFilter;
    const matchesAsset = !selectedAssetId || log.assetId === selectedAssetId;

    return matchesSearch && matchesType && matchesAsset;
  }).sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());

  // 2. 이력 통계 카드 데이터
  const totalOutbound = assetInOutLogs.filter(l => l.type === 'OUTBOUND').length;
  const totalInbound = assetInOutLogs.filter(l => l.type === 'INBOUND').length;
  const totalRepair = assetInOutLogs.filter(l => l.type === 'REPAIR').length;
  
  // 평균 장비 점수 산정 (입고된 장비 기준)
  const inboundLogsWithScore = assetInOutLogs.filter(l => l.type === 'INBOUND' && typeof l.maintenanceScore === 'number');
  const avgMaintenanceScore = inboundLogsWithScore.length > 0 
    ? Math.round(inboundLogsWithScore.reduce((sum, l) => sum + (l.maintenanceScore || 0), 0) / inboundLogsWithScore.length) 
    : 0;

  // 3. 자산 개별 선택 정보 및 해당 자산의 모든 타임라인
  const selectedAsset = assets.find(a => a.id === selectedAssetId);
  const selectedAssetTimeline = assetInOutLogs
    .filter(l => l.assetId === selectedAssetId)
    .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());

  // 4. 수리 디테일 및 소모품 사용량 조회 헬퍼
  const getRepairDetail = (repairId: string) => {
    const rep = repairs.find(r => r.id === repairId);
    if (!rep) return null;

    // 사용된 소모품 조회
    const used = repairConsumables.filter(rc => rc.repairId === repairId).map(rc => {
      const item = consumables.find(c => c.id === rc.consumableId);
      return {
        name: item?.modelName || '소모품',
        qty: rc.quantity,
        price: rc.unitPrice
      };
    });

    return {
      description: rep.details,
      details: rep.details,
      cost: rep.totalCost,
      date: rep.repairDate,
      usedConsumables: used
    };
  };

  // 5. 엑셀 다운로드
  const handleExport = () => {
    const excelData = filteredLogs.map((log, idx) => ({
      'No': idx + 1,
      '관리번호': log.assetNo,
      '모델명': log.modelName,
      '이벤트 구분': log.type === 'OUTBOUND' ? '출고 (OUTBOUND)' : log.type === 'INBOUND' ? '입고 (INBOUND)' : '정비 (REPAIR)',
      '발생 일자': log.eventDate,
      '연관 거래처': log.customerName || '-',
      '연관 현장': log.siteName || '-',
      '장비 점수': log.type === 'INBOUND' ? `${log.maintenanceScore}점` : '-',
      '비고': log.memo || '-'
    }));

    exportToExcel(excelData, `자산_입출고정비이력_${new Date().toISOString().split('T')[0]}`, '이력목록');
  };

  return (
    <div>
      <div className="card-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontWeight: '700' }}>자산 입출고 및 정비 이력 현황</h2>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            장비의 출고(출하), 반납 입고 및 검수, 정비 완료까지의 전체 라이프사이클을 단일 타임라인으로 추적합니다.
          </span>
        </div>
        <button className="btn-secondary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Download size={14} /> 엑셀 다운로드
        </button>
      </div>

      {/* 상단 통계 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--primary)', display: 'flex', flexDirection: 'column', justifyItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>누적 출고 횟수</span>
          <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '6px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowUpRight size={20} />
            {totalOutbound} <span style={{ fontSize: '13px', fontWeight: 'normal', color: 'var(--text-secondary)' }}>건</span>
          </div>
        </div>
        <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--success)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>누적 입고 횟수</span>
          <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '6px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowDownLeft size={20} />
            {totalInbound} <span style={{ fontSize: '13px', fontWeight: 'normal', color: 'var(--text-secondary)' }}>건</span>
          </div>
        </div>
        <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--warning)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>누적 정비/수리 건수</span>
          <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '6px', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Wrench size={20} />
            {totalRepair} <span style={{ fontSize: '13px', fontWeight: 'normal', color: 'var(--text-secondary)' }}>건</span>
          </div>
        </div>
        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #ef4444' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>반납 평균 정비소요점수</span>
          <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '6px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={20} />
            {avgMaintenanceScore} <span style={{ fontSize: '13px', fontWeight: 'normal', color: 'var(--text-secondary)' }}>점 (0점 최상)</span>
          </div>
        </div>
      </div>

      {/* 중간 필터 보드 */}
      <div className="card" style={{ padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div>
            <label>통합 검색</label>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="장비번호, 모델, 거래처 검색..."
            />
          </div>
          <div>
            <label>이벤트 구분 필터</label>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="">전체 이력 구분</option>
              <option value="OUTBOUND">출고 (OUTBOUND)</option>
              <option value="INBOUND">입고 (INBOUND)</option>
              <option value="REPAIR">정비 (REPAIR)</option>
            </select>
          </div>
          <div>
            <label>개별 자산별 이력 필터</label>
            <select value={selectedAssetId} onChange={e => setSelectedAssetId(e.target.value)}>
              <option value="">전체 장비 (자산선택)</option>
              {assets.map(a => (
                <option key={a.id} value={a.id}>{a.assetNo} ({a.modelName})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 자산 개별 타임라인 (자산이 선택되었을 때만 노출) */}
      {selectedAssetId && selectedAsset && (
        <div className="card" style={{ padding: '20px', marginBottom: '24px', border: '1px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontWeight: '700', fontSize: '16px', color: 'var(--primary)' }}>
              🛠️ 자산별 통합 이력 현황: {selectedAsset.assetNo} ({selectedAsset.modelName})
            </h3>
            <span className={`badge ${
              selectedAsset.status === 'AVAILABLE' ? 'badge-success' :
              selectedAsset.status === 'RENTED' ? 'badge-info' : 'badge-danger'
            }`}>
              현재상태: {
                selectedAsset.status === 'AVAILABLE' ? '임대가능' :
                selectedAsset.status === 'ASSIGNED' ? '출고대기' :
                selectedAsset.status === 'RENTED' ? '대여중' :
                selectedAsset.status === 'REPAIRING' ? '정비중' :
                selectedAsset.status === 'RENTED_RETURNED' ? '반납완료' : selectedAsset.status
              }
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', alignItems: 'start' }}>
            {/* 자산 사양 정보 */}
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div><strong>모델명:</strong> {selectedAsset.modelName}</div>
              <div><strong>제조번호 (SN):</strong> {selectedAsset.serialNo || '-'}</div>
              <div><strong>제조사:</strong> {selectedAsset.manufacturer || '-'}</div>
              <div><strong>소유 형태:</strong> {selectedAsset.ownerType === 'OWNED' ? '당사자산' : '임차자산'}</div>
              {selectedAsset.ownerType === 'RENTED' && (
                <>
                  <div><strong>임차처:</strong> {selectedAsset.renter}</div>
                  <div><strong>임차 계약기간:</strong> {selectedAsset.rentStart} ~ {selectedAsset.rentEnd}</div>
                </>
              )}
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />
              <div><strong>누적 렌탈 수수료 매출:</strong> {(selectedAsset.cumRentalFee || 0).toLocaleString()}원</div>
              <div><strong>누적 수리비 지출:</strong> {(selectedAsset.cumRepairCost || 0).toLocaleString()}원</div>
              <div>
                <strong>현재 정비 필요 점수:</strong>{' '}
                <span style={{ color: selectedAsset.maintenanceScore && selectedAsset.maintenanceScore > 30 ? 'var(--danger)' : 'inherit', fontWeight: '700' }}>
                  {selectedAsset.maintenanceScore || 0}점
                </span>{' '}
                (0점에 가까울수록 이상 무)
              </div>
            </div>

            {/* 자산 타임라인 */}
            <div>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700' }}>연대기별 이력 타임라인</h4>
              {selectedAssetTimeline.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  등록된 이력 로그가 없습니다. (출고 배차 완료, 반납 입고 확정 시 자동 기록됩니다)
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '2px solid var(--border)', paddingLeft: '16px', marginLeft: '8px' }}>
                  {selectedAssetTimeline.map(log => {
                    const repDetail = log.repairId ? getRepairDetail(log.repairId) : null;
                    return (
                      <div key={log.id} style={{ position: 'relative' }}>
                        {/* 타임라인 원형 마커 */}
                        <div style={{
                          position: 'absolute', left: '-25px', top: '2px', width: '16px', height: '16px', borderRadius: '50%',
                          backgroundColor: 
                            log.type === 'OUTBOUND' ? 'var(--primary)' : 
                            log.type === 'INBOUND' ? 'var(--success)' : 'var(--warning)',
                          border: '3px solid var(--bg-card)'
                        }} />

                        <div className="card" style={{ padding: '12px', fontSize: '13px', backgroundColor: 'var(--bg-secondary)', border: 'none' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <strong style={{
                              color: 
                                log.type === 'OUTBOUND' ? 'var(--primary)' : 
                                log.type === 'INBOUND' ? 'var(--success)' : 'var(--warning)'
                            }}>
                              {log.type === 'OUTBOUND' ? '📤 출고 (OUTBOUND)' : log.type === 'INBOUND' ? '📥 입고 (INBOUND)' : '🛠️ 정비 완료 (REPAIR)'}
                            </strong>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{log.eventDate}</span>
                          </div>

                          {log.type === 'OUTBOUND' && (
                            <div>
                              <div>고객사: <strong>{log.customerName}</strong> / 현장: {log.siteName}</div>
                              {log.memo && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>비고: {log.memo}</div>}
                            </div>
                          )}

                          {log.type === 'INBOUND' && (
                            <div>
                              <div>반납처: <strong>{log.customerName}</strong> ({log.siteName})</div>
                              <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '12px' }}>
                                <span>정비 상태 점수: <strong>{log.maintenanceScore}점</strong></span>
                                <span>검수 메모: <span style={{ color: 'var(--text-primary)' }}>{log.memo || '없음'}</span></span>
                              </div>
                            </div>
                          )}

                          {log.type === 'REPAIR' && repDetail && (
                            <div>
                              <div style={{ fontWeight: '600' }}>정비 명세: {repDetail.details || repDetail.description}</div>
                              <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
                                총 정비 비용: <strong>{(repDetail.cost || 0).toLocaleString()}원</strong>
                              </div>
                              {repDetail.usedConsumables.length > 0 && (
                                <div style={{ marginTop: '6px', fontSize: '11.5px', borderTop: '1px dashed var(--border)', paddingTop: '6px' }}>
                                  <div style={{ color: 'var(--text-secondary)', marginBottom: '3px' }}>🛠️ 투입된 교체 소모품 목록:</div>
                                  <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                    {repDetail.usedConsumables.map((c, cidx) => (
                                      <li key={cidx}>
                                        {c.name} - {c.qty}개 (단가: {c.price.toLocaleString()}원)
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 이력 대장 테이블 */}
      <div className="card-title" style={{ fontSize: '15px', fontWeight: '700', marginBottom: '10px' }}>전체 입출고 및 정비 이력 대장</div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>번호</th>
              <th>발생일자</th>
              <th>이벤트 구분</th>
              <th>장비번호</th>
              <th>모델명</th>
              <th>연관 거래처</th>
              <th>연관 현장</th>
              <th>정비 점수</th>
              <th>메모 / 특이사항</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                  기록되었거나 검색 조건에 부합하는 자산 이력이 존재하지 않습니다.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log, idx) => (
                <tr key={log.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedAssetId(log.assetId)}>
                  <td>{idx + 1}</td>
                  <td>{log.eventDate}</td>
                  <td>
                    <span className={`badge ${
                      log.type === 'OUTBOUND' ? 'badge-info' : 
                      log.type === 'INBOUND' ? 'badge-success' : 'badge-warning'
                    }`}>
                      {log.type === 'OUTBOUND' ? '출고' : log.type === 'INBOUND' ? '입고' : '정비완료'}
                    </span>
                  </td>
                  <td><strong style={{ color: 'var(--primary)' }}>{log.assetNo}</strong></td>
                  <td>{log.modelName}</td>
                  <td>{log.customerName || '-'}</td>
                  <td>{log.siteName || '-'}</td>
                  <td>{log.type === 'INBOUND' ? `${log.maintenanceScore}점` : '-'}</td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{log.memo || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
