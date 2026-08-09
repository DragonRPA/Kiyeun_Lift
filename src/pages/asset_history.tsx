// src/pages/asset_history.tsx
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Download, Calendar, Layers, Wrench, ArrowUpRight, ArrowDownLeft, Shield } from 'lucide-react';
import { exportToExcel } from '../services/excel';

export const AssetHistory: React.FC = () => {
  const { 
    assetInOutLogs, assets, customers, sites, deliveries, repairs, repairConsumables, consumables, navigationPayload, setNavigationPayload 
  } = useApp();

  // 1. 탭 상태: 'OUTBOUND' (출고 조회) | 'INBOUND' (입고 조회) | 'REPAIR' (정비 이력 조회)
  const [activeTab, setActiveTab] = useState<'OUTBOUND' | 'INBOUND' | 'REPAIR'>('OUTBOUND');

  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const todayStr = getTodayStr();

  // 2. 검색 및 조회기간 필터 상태 (입출고/정비 이력은 과거/현재 사건이므로 종료일 기본값 오늘)
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(todayStr);
  const [selectedAssetId, setSelectedAssetId] = useState('');

  // 0. 타 탭 이동 페이로드(특정 자산 이력 조회) 감지
  useEffect(() => {
    if (navigationPayload && navigationPayload.assetId) {
      setSelectedAssetId(navigationPayload.assetId);
      setNavigationPayload(null); // 페이로드 소비 후 소멸
    }
  }, [navigationPayload]);

  // 💡 [사장님 지시] 기간 빠른 선택 (오늘 / 1주 / 1개월 / 전체) - 종료일은 항상 오늘로 고정 (미래 조회 불가)
  const setQuickRange = (rangeType: 'TODAY' | 'WEEK' | 'MONTH' | 'ALL') => {
    const today = new Date();
    setEndDate(todayStr);

    if (rangeType === 'TODAY') {
      setStartDate(todayStr);
    } else if (rangeType === 'WEEK') {
      const pastWeek = new Date(today);
      pastWeek.setDate(today.getDate() - 7);
      setStartDate(pastWeek.toISOString().split('T')[0]);
    } else if (rangeType === 'MONTH') {
      const pastMonth = new Date(today);
      pastMonth.setMonth(today.getMonth() - 1);
      setStartDate(pastMonth.toISOString().split('T')[0]);
    } else if (rangeType === 'ALL') {
      setStartDate('');
    }
  };

  // 3. 탭별 및 필터조건별 로그 데이터 집계
  const filteredTabLogs = assetInOutLogs.filter(log => {
    // 탭 매칭
    if (log.type !== activeTab) return false;

    // 💡 비즈니스 논리: 출고/입고/정비는 발생 완료 건이므로 미래 사건은 조회 차단
    if (log.eventDate > todayStr) return false;

    // 개별 자산 필터
    if (selectedAssetId && log.assetId !== selectedAssetId) return false;

    // 조회기간 필터
    if (startDate && log.eventDate < startDate) return false;
    if (endDate && log.eventDate > endDate) return false;

    // 통합 검색 필터 (모델명, 자산번호, 고객사명, 현장명, 비고)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchesAssetNo = log.assetNo.toLowerCase().includes(term);
      const matchesModel = log.modelName.toLowerCase().includes(term);
      const matchesCustomer = log.customerName && log.customerName.toLowerCase().includes(term);
      const matchesSite = log.siteName && log.siteName.toLowerCase().includes(term);
      const matchesMemo = log.memo && log.memo.toLowerCase().includes(term);

      if (!matchesAssetNo && !matchesModel && !matchesCustomer && !matchesSite && !matchesMemo) {
        return false;
      }
    }

    return true;
  }).sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());

  // 4. 수리 디테일 및 소모품 사용량 조회 헬퍼
  const getRepairDetail = (repairId: string) => {
    const rep = repairs.find(r => r.id === repairId);
    if (!rep) return null;

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
      repairType: rep.repairType || 'SELF',
      vendorId: rep.vendorId,
      usedConsumables: used
    };
  };

  // 5. 선택된 자산 정보 및 통합 타임라인
  const selectedAsset = assets.find(a => a.id === selectedAssetId);
  const selectedAssetTimeline = assetInOutLogs
    .filter(l => l.assetId === selectedAssetId)
    .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());

  // 6. 엑셀 다운로드
  const handleExport = () => {
    const tabName = activeTab === 'OUTBOUND' ? '출고이력' : activeTab === 'INBOUND' ? '입고이력' : '정비이력';
    const excelData = filteredTabLogs.map((log, idx) => ({
      'No': idx + 1,
      '발생일자': log.eventDate,
      '관리번호': log.assetNo,
      '모델명': log.modelName,
      '거래처(고객사)': log.customerName || '-',
      '연관 현장': log.siteName || '-',
      '상태/점수': log.type === 'INBOUND' ? `${log.maintenanceScore || 0}점` : log.type,
      '메모 / 비고': log.memo || '-'
    }));

    exportToExcel(excelData, `자산_${tabName}_${new Date().toISOString().split('T')[0]}`, tabName);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 1. 페이지 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontWeight: '700', marginBottom: '4px' }}>자산 입출고 및 정비 이력</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            장비의 출고(출하), 반납 입고 및 검수, 정비/수리 완료까지의 라이프사이클을 탭별로 조회 추적합니다.
          </p>
        </div>
        <button className="btn-secondary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
          <Download size={14} /> 엑셀 다운로드
        </button>
      </div>

      {/* 2. 3대 탭 메뉴 (출고조회 / 입고조회 / 정비이력조회) */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '2px solid var(--border-color)', paddingBottom: '10px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('OUTBOUND')}
          className={activeTab === 'OUTBOUND' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '8px 20px', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowUpRight size={16} /> 출고 조회
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('INBOUND')}
          className={activeTab === 'INBOUND' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '8px 20px', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowDownLeft size={16} /> 입고 조회
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('REPAIR')}
          className={activeTab === 'REPAIR' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '8px 20px', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Wrench size={16} /> 정비 이력 조회
        </button>
      </div>

      {/* 3. 통합 필터 패널 (상하 세로 스택 배치 원칙 Category III 3.4 이행) */}
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', alignItems: 'end' }}>
          
          {/* 조회 기간 설정 필터 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              조회 기간 설정 (상한: 오늘)
            </label>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="date"
                value={startDate}
                max={todayStr}
                onChange={e => setStartDate(e.target.value)}
                style={{ flex: 1, padding: '7px', fontSize: '12.5px' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>~</span>
              <input
                type="date"
                value={endDate}
                max={todayStr}
                onChange={e => {
                  const val = e.target.value;
                  setEndDate(val > todayStr ? todayStr : val);
                }}
                style={{ flex: 1, padding: '7px', fontSize: '12.5px' }}
              />
            </div>
          </div>

          {/* 조회기간 빠른 선택 버튼 (오늘 / 1주 / 1개월 / 전체) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              기간 빠른 선택
            </label>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setQuickRange('TODAY')}
                style={{ flex: 1, padding: '6px 4px', fontSize: '12px', whiteSpace: 'nowrap' }}
              >
                오늘
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setQuickRange('WEEK')}
                style={{ flex: 1, padding: '6px 4px', fontSize: '12px', whiteSpace: 'nowrap' }}
              >
                1주
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setQuickRange('MONTH')}
                style={{ flex: 1, padding: '6px 4px', fontSize: '12px', whiteSpace: 'nowrap' }}
              >
                1개월
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setQuickRange('ALL')}
                style={{ flex: 1, padding: '6px 4px', fontSize: '12px', whiteSpace: 'nowrap' }}
              >
                전체
              </button>
            </div>
          </div>

          {/* 통합 검색 필터 (모델명 / 관리번호 / 거래처 / 현장명) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              통합 검색 (모델명 / 관리번호 / 거래처)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="모델명, 관리번호, 거래처명, 현장 검색..."
                style={{ width: '100%', padding: '7px 10px 7px 32px', fontSize: '12.5px' }}
              />
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          {/* 개별 자산 필터 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              특정 자산 지정 필터
            </label>
            <select
              value={selectedAssetId}
              onChange={e => setSelectedAssetId(e.target.value)}
              style={{ width: '100%', padding: '7px', fontSize: '12.5px' }}
            >
              <option value="">전체 장비 (자산 전체)</option>
              {assets.map(a => (
                <option key={a.id} value={a.id}>[{a.assetNo}] {a.modelName}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* 4. 자산 개별 선택 정보 및 연대기 타임라인 (자산이 선택된 경우에만 렌더링) */}
      {selectedAssetId && selectedAsset && (
        <div className="card" style={{ padding: '20px', border: '1px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontWeight: '700', fontSize: '15px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} />
              자산 통합 이력 연대기: [{selectedAsset.assetNo}] {selectedAsset.modelName}
            </h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedAssetId('')}
                style={{ fontSize: '11px', padding: '2px 8px' }}
              >
                ✕ 전체 보기로 복귀
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '24px', alignItems: 'start' }}>
            {/* 자산 사양 요약 */}
            <div style={{ backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '8px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border-color)' }}>
              <div><strong>관리번호:</strong> <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{selectedAsset.assetNo}</span></div>
              <div><strong>모델명:</strong> {selectedAsset.modelName}</div>
              <div><strong>제조번호 (SN):</strong> {selectedAsset.serialNo || '-'}</div>
              <div><strong>소유 형태:</strong> {selectedAsset.ownerType === 'OWNED' ? '자사자산' : '외부임차장비'}</div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />
              <div><strong>누적 렌탈 기여액:</strong> {(selectedAsset.cumRentalFee || 0).toLocaleString()}원</div>
              <div><strong>누적 수리비 지출:</strong> {(selectedAsset.cumRepairCost || 0).toLocaleString()}원</div>
            </div>

            {/* 자산 타임라인 */}
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '13.5px', fontWeight: '700' }}>장비 생애주기 이력 로그 ({selectedAssetTimeline.length}건)</h4>
              {selectedAssetTimeline.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                  등록된 이력 로그가 없습니다.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '2px solid var(--border-color)', paddingLeft: '14px', marginLeft: '6px' }}>
                  {selectedAssetTimeline.map(log => (
                    <div key={log.id} style={{ position: 'relative' }}>
                      <div style={{
                        position: 'absolute', left: '-21px', top: '3px', width: '12px', height: '12px', borderRadius: '50%',
                        backgroundColor: 
                          log.type === 'OUTBOUND' ? 'var(--primary)' : 
                          log.type === 'INBOUND' ? 'var(--success)' : 'var(--warning)',
                        border: '2px solid var(--bg-card)'
                      }} />
                      <div style={{ padding: '10px', fontSize: '12.5px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <strong style={{ color: log.type === 'OUTBOUND' ? 'var(--primary)' : log.type === 'INBOUND' ? 'var(--success)' : 'var(--warning)' }}>
                            {log.type === 'OUTBOUND' ? '📤 출고 (OUTBOUND)' : log.type === 'INBOUND' ? '📥 입고 (INBOUND)' : '🛠️ 정비 (REPAIR)'}
                          </strong>
                          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{log.eventDate}</span>
                        </div>
                        <div>고객사/거래처: <strong>{log.customerName || '-'}</strong> {log.siteName ? `(${log.siteName})` : ''}</div>
                        {log.memo && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>비고: {log.memo}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. 탭별 조회 결과 안내 텍스트 & 데이터 테이블 */}
      <div className="card" style={{ padding: '16px' }}>
        
        {/* 결과 건수 텍스트 안내 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
            {activeTab === 'OUTBOUND' && <span>📤 출고 이력 목록</span>}
            {activeTab === 'INBOUND' && <span>📥 입고 이력 목록</span>}
            {activeTab === 'REPAIR' && <span>🛠️ 정비 이력 목록</span>}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            총 <strong style={{ color: 'var(--primary)', fontSize: '15px' }}>{filteredTabLogs.length}</strong>건의 이력이 조회되었습니다.
          </div>
        </div>

        {/* 데이터 테이블 */}
        <div className="table-container">
          <table>
            <thead>
              {activeTab === 'OUTBOUND' && (
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>번호</th>
                  <th style={{ whiteSpace: 'nowrap' }}>출고일자</th>
                  <th style={{ whiteSpace: 'nowrap' }}>관리번호</th>
                  <th style={{ whiteSpace: 'nowrap' }}>모델명</th>
                  <th style={{ whiteSpace: 'nowrap' }}>고객사 (거래처)</th>
                  <th style={{ whiteSpace: 'nowrap' }}>현장명</th>
                  <th style={{ whiteSpace: 'nowrap' }}>비고 / 메모</th>
                </tr>
              )}
              {activeTab === 'INBOUND' && (
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>번호</th>
                  <th style={{ whiteSpace: 'nowrap' }}>입고일자</th>
                  <th style={{ whiteSpace: 'nowrap' }}>관리번호</th>
                  <th style={{ whiteSpace: 'nowrap' }}>모델명</th>
                  <th style={{ whiteSpace: 'nowrap' }}>고객사 (거래처)</th>
                  <th style={{ whiteSpace: 'nowrap' }}>현장명</th>
                  <th style={{ whiteSpace: 'nowrap' }}>정비 점수</th>
                  <th style={{ whiteSpace: 'nowrap' }}>검수 메모 / 비고</th>
                </tr>
              )}
              {activeTab === 'REPAIR' && (
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>번호</th>
                  <th style={{ whiteSpace: 'nowrap' }}>정비일자</th>
                  <th style={{ whiteSpace: 'nowrap' }}>관리번호</th>
                  <th style={{ whiteSpace: 'nowrap' }}>모델명</th>
                  <th style={{ whiteSpace: 'nowrap' }}>정비 구분</th>
                  <th style={{ whiteSpace: 'nowrap' }}>정비 내역 및 사유</th>
                  <th style={{ whiteSpace: 'nowrap' }}>정비 비용</th>
                </tr>
              )}
            </thead>
            <tbody>
              {filteredTabLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
                    선택한 탭 및 검색 조건에 부합하는 자산 이력 데이터가 존재하지 않습니다.
                  </td>
                </tr>
              ) : (
                filteredTabLogs.map((log, idx) => {
                  const repDetail = log.type === 'REPAIR' && log.repairId ? getRepairDetail(log.repairId) : null;
                  return (
                    <tr
                      key={log.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedAssetId(log.assetId)}
                      title="클릭 시 자산별 생애주기 통합 연대기를 확인합니다."
                    >
                      <td style={{ whiteSpace: 'nowrap' }}>{idx + 1}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{log.eventDate}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <strong style={{ color: 'var(--primary)' }}>[{log.assetNo}]</strong>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{log.modelName}</td>
                      
                      {activeTab === 'OUTBOUND' && (
                        <>
                          <td style={{ whiteSpace: 'nowrap' }}><strong>{log.customerName || '-'}</strong></td>
                          <td style={{ whiteSpace: 'nowrap' }}>{log.siteName || '-'}</td>
                          <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{log.memo || '-'}</td>
                        </>
                      )}

                      {activeTab === 'INBOUND' && (
                        <>
                          <td style={{ whiteSpace: 'nowrap' }}><strong>{log.customerName || '-'}</strong></td>
                          <td style={{ whiteSpace: 'nowrap' }}>{log.siteName || '-'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span className="badge badge-success">
                              {log.maintenanceScore !== undefined ? `${log.maintenanceScore}점` : '정상'}
                            </span>
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{log.memo || '-'}</td>
                        </>
                      )}

                      {activeTab === 'REPAIR' && (
                        <>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span className={`badge ${repDetail?.repairType === 'VENDOR' ? 'badge-warning' : 'badge-info'}`}>
                              {repDetail?.repairType === 'VENDOR' ? '외주정비' : '자체정비'}
                            </span>
                          </td>
                          <td style={{ fontSize: '12.5px' }}>
                            {repDetail ? repDetail.details : (log.memo || '정비 작업')}
                          </td>
                          <td style={{ whiteSpace: 'nowrap', fontWeight: 'bold', color: 'var(--primary)' }}>
                            {repDetail ? `${(repDetail.cost || 0).toLocaleString()}원` : '-'}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

