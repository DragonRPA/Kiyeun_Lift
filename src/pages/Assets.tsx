// d:\Kiyeun_Lift\src\pages\Assets.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Download, Eye, Layers } from 'lucide-react';
import { exportToExcel } from '../services/excel';
import { Asset } from '../services/db';

export const Assets: React.FC = () => {
  const { assets, customers, sites, setActiveTab, setNavigationPayload, saveAsset } = useApp();

  // 임시 필터 입력 상태 (조회 버튼을 누르기 전까지 홀드)
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempStatusFilter, setTempStatusFilter] = useState('ALL');
  const [tempOwnerFilter, setTempOwnerFilter] = useState('ALL');
  const [tempManufacturerFilter, setTempManufacturerFilter] = useState('ALL');
  const [tempCustomerFilter, setTempCustomerFilter] = useState('ALL');

  // 확정 필터 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [ownerFilter, setOwnerFilter] = useState('ALL');
  const [manufacturerFilter, setManufacturerFilter] = useState('ALL');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  
  // 상세조회 모달 상태
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  // 문서 지정용 편집 상태
  const [editInspectionUrl, setEditInspectionUrl] = useState('');
  const [editChecklistUrl, setEditChecklistUrl] = useState('');

  const handleSelectAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setEditInspectionUrl(asset.safetyInspectionUrl || '');
    setEditChecklistUrl(asset.preDeliveryChecklistUrl || '');
  };

  // 고유 제조사 목록 추출
  const uniqueManufacturers = Array.from(new Set(assets.map(a => a.manufacturer).filter(Boolean))) as string[];

  // 필터링 적용
  const filtered = assets.filter(a => {
    const matchesSearch = 
      a.assetNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.modelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.serialNo && a.serialNo.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
    const matchesOwner = ownerFilter === 'ALL' || a.ownerType === ownerFilter;
    const matchesManufacturer = manufacturerFilter === 'ALL' || a.manufacturer === manufacturerFilter;
    const matchesCustomer = customerFilter === 'ALL' || a.currentCustomerId === customerFilter;

    return matchesSearch && matchesStatus && matchesOwner && matchesManufacturer && matchesCustomer;
  });

  const handleSearchClick = () => {
    setSearchTerm(tempSearchTerm);
    setStatusFilter(tempStatusFilter);
    setOwnerFilter(tempOwnerFilter);
    setManufacturerFilter(tempManufacturerFilter);
    setCustomerFilter(tempCustomerFilter);
  };

  const handleSaveDocs = () => {
    if (!selectedAsset) return;
    saveAsset({
      ...selectedAsset,
      safetyInspectionUrl: editInspectionUrl,
      preDeliveryChecklistUrl: editChecklistUrl
    });
    alert('장비의 안전점검결과서 및 반입전체크리스트 경로가 성공적으로 저장되었습니다.');
    setSelectedAsset(null);
  };

  const getCustomerName = (id?: string) => {
    if (!id) return '-';
    return customers.find(c => c.id === id)?.name || '-';
  };

  const getSiteName = (id?: string) => {
    if (!id) return '-';
    return sites.find(s => s.id === id)?.name || '-';
  };

  const handleExport = () => {
    const excelData = filtered.map((a, idx) => ({
      '순번': idx + 1,
      '관리번호': a.assetNo,
      '모델명': a.modelName,
      '제조번호': a.serialNo || '',
      '제조사': a.manufacturer || '',
      '자산구분': a.ownerType === 'OWNED' ? '당사자산' : '임차자산',
      '상태': a.status === 'AVAILABLE' ? '대기중' :
             a.status === 'RENTED' ? '대여중' :
             a.status === 'REPAIRING' ? '수리중' :
             a.status === 'RENTED_RETURNED' ? '임차반납' : '매각완료',
      '현재고객': getCustomerName(a.currentCustomerId),
      '현재현장': getSiteName(a.currentSiteId),
      '계약개시일': a.contractStart || '',
      '계약만료일': a.contractEnd || '',
      '청구마감일(일)': a.billingDay || '',
      '월렌탈료(원)': a.monthlyRentalFee,
      '일렌탈료(원)': a.dailyRentalFee,
      '취득일': a.acquisitionDate || '',
      '취득가(원)': a.acquisitionPrice,
      '상각개월수': a.depreciationMonths || '',
      '잔존가치율(%)': a.residualValueRate || '',
      '감가상각누계액(원)': a.accumDepreciation,
      '장부가치(원)': a.bookValue,
      '누적렌탈수입(원)': a.cumRentalFee,
      '누적수리비용(원)': a.cumRepairCost,
      '매각일': a.disposalDate || '',
      '매각가(원)': a.disposalPrice,
      '구입처': a.supplier || '',
      '임차처': a.renter || '',
      '임차개시일': a.rentStart || '',
      '임차만료일': a.rentEnd || '',
      '월임차료(원)': a.monthlyRentFee,
      '일임차료(원)': a.dailyRentFee,
      '매각처': a.buyer || '',
      '비고1': a.memo1 || '',
      '비고2': a.memo2 || ''
    }));

    exportToExcel(excelData, `자산대장_${new Date().toISOString().split('T')[0]}`, '자산목록');
  };

  return (
    <div>
      <div className="card-header" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontWeight: '700' }}>장비 자산 대장</h2>
        <button className="btn-secondary" onClick={handleExport}>
          <Download size={16} /> 자산대장 엑셀 다운로드
        </button>
      </div>

      {/* 다차원 필터 제어부 */}
      <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', marginBottom: '6px', display: 'block' }}>자산 검색</label>
            <input
              type="text"
              value={tempSearchTerm}
              onChange={e => setTempSearchTerm(e.target.value)}
              placeholder="관리번호, 모델명, 제조번호 검색..."
              style={{ width: '100%', padding: '8px' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', marginBottom: '6px', display: 'block' }}>자산 구분</label>
            <select value={tempOwnerFilter} onChange={e => setTempOwnerFilter(e.target.value)} style={{ width: '100%', padding: '8px' }}>
              <option value="ALL">전체 자산</option>
              <option value="OWNED">당사 자산 (Owned)</option>
              <option value="RENTED">임차 자산 (Rented)</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', marginBottom: '6px', display: 'block' }}>장비 상태</label>
            <select value={tempStatusFilter} onChange={e => setTempStatusFilter(e.target.value)} style={{ width: '100%', padding: '8px' }}>
              <option value="ALL">전체 상태</option>
              <option value="AVAILABLE">대기중 (AVAILABLE)</option>
              <option value="RENTED">대여중 (RENTED)</option>
              <option value="REPAIRING">수리중 (REPAIRING)</option>
              <option value="RENTED_RETURNED">임차반납 (RENTED_RETURNED)</option>
              <option value="SOLD">매각완료 (SOLD)</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', marginBottom: '6px', display: 'block' }}>제조사</label>
            <select value={tempManufacturerFilter} onChange={e => setTempManufacturerFilter(e.target.value)} style={{ width: '100%', padding: '8px' }}>
              <option value="ALL">전체 제조사</option>
              {uniqueManufacturers.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', marginBottom: '6px', display: 'block' }}>현재 고객사</label>
            <select value={tempCustomerFilter} onChange={e => setTempCustomerFilter(e.target.value)} style={{ width: '100%', padding: '8px' }}>
              <option value="ALL">전체 고객사</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex' }}>
            <button 
              type="button" 
              className="btn-primary" 
              onClick={handleSearchClick}
              style={{ width: '100%', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 'bold' }}
            >
              <Search size={16} /> 조회
            </button>
          </div>
        </div>
      </div>

      {/* 자산 목록 */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>관리번호</th>
              <th>모델명</th>
              <th>자산 구분</th>
              <th>상태</th>
              <th>현재 고객사</th>
              <th>월 렌탈료</th>
              <th>장부가치</th>
              <th>누적렌탈 / 수리비</th>
              <th style={{ width: '80px' }}>조회</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                  대장에 등록된 자산이 없거나 검색 결과가 존재하지 않습니다.
                </td>
              </tr>
            ) : (
              filtered.map(a => (
                <tr key={a.id}>
                  <td><strong style={{ color: 'var(--primary)' }}>{a.assetNo}</strong></td>
                  <td>{a.modelName}</td>
                  <td>
                    <span className={`badge ${a.ownerType === 'OWNED' ? 'badge-success' : 'badge-info'}`}>
                      {a.ownerType === 'OWNED' ? '당사' : '임차'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${
                      a.status === 'AVAILABLE' ? 'badge-success' :
                      a.status === 'RENTED' ? 'badge-info' :
                      a.status === 'REPAIRING' ? 'badge-warning' : 'badge-danger'
                    }`}>
                      {a.status === 'AVAILABLE' ? '대기중' :
                       a.status === 'RENTED' ? '대여중' :
                       a.status === 'REPAIRING' ? '수리중' :
                       a.status === 'RENTED_RETURNED' ? '임차반납' : '매각'}
                    </span>
                  </td>
                  <td>{getCustomerName(a.currentCustomerId)}</td>
                  <td>{a.monthlyRentalFee ? `${a.monthlyRentalFee.toLocaleString()}원` : '0원'}</td>
                  <td>{a.ownerType === 'OWNED' ? `${(a.bookValue || 0).toLocaleString()}원` : '-'}</td>
                  <td style={{ fontSize: '13px' }}>
                    <span className="text-primary">{(a.cumRentalFee || 0).toLocaleString()}원</span>
                    <span style={{ margin: '0 4px', color: 'var(--border-color)' }}>/</span>
                    <span className="text-danger">{(a.cumRepairCost || 0).toLocaleString()}원</span>
                  </td>
                  <td>
                    <button
                      className="btn-secondary"
                      onClick={() => handleSelectAsset(a)}
                      style={{ padding: '6px', borderRadius: '50%' }}
                      title="상세내역 전체보기"
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 자산 세부 속성 팝업 모달 */}
      {selectedAsset && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-card)' }}>
            <div className="card-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Layers className="text-primary" /> 자산 상세 명세서 - {selectedAsset.assetNo}
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn-success"
                  onClick={handleSaveDocs}
                  style={{ padding: '4px 10px', fontSize: '12.5px', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                >
                  💾 점검서류 저장
                </button>
                <button
                  className="btn-primary"
                  onClick={() => {
                    setActiveTab('asset_inout_history');
                    setNavigationPayload({ assetId: selectedAsset.id });
                    setSelectedAsset(null);
                  }}
                  style={{ padding: '4px 10px', fontSize: '12.5px', backgroundColor: 'var(--primary)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '4px' }}
                >
                  📈 이력/정비 타임라인 보기
                </button>
                <button className="btn-secondary" onClick={() => setSelectedAsset(null)} style={{ padding: '4px 10px', fontSize: '12.5px' }}>닫기</button>
              </div>
            </div>

            <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* 기본 제원 */}
              <div>
                <h4 style={{ fontWeight: '600', marginBottom: '10px', color: 'var(--primary)' }}>1. 기본 장비 정보</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '14px' }}>
                  <div><label>관리번호</label><strong>{selectedAsset.assetNo}</strong></div>
                  <div><label>모델명</label><strong>{selectedAsset.modelName}</strong></div>
                  <div><label>제조번호 (Serial)</label>{selectedAsset.serialNo || '-'}</div>
                  <div><label>제조사</label>{selectedAsset.manufacturer || '-'}</div>
                  <div><label>자산유형</label>{selectedAsset.ownerType === 'OWNED' ? '당사자산' : '임차자산'}</div>
                  <div><label>현재상태</label>{selectedAsset.status}</div>
                </div>

                {/* 점검 서류 지정 */}
                <div style={{ marginTop: '16px', padding: '14px', border: '1px dashed var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-app)' }}>
                  <h5 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>📋 호기별 구글 드라이브 점검 서류 파일 경로 지정</h5>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>안전점검결과서 파일 경로 (절대경로 또는 구글드라이브 링크)</label>
                      <input
                        type="text"
                        value={editInspectionUrl}
                        onChange={e => setEditInspectionUrl(e.target.value)}
                        placeholder="예: d:/GoogleDrive/안전점검결과서_G06004.pdf"
                        style={{ width: '100%', padding: '6px', fontSize: '12.5px', marginTop: '4px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>반입전체크리스트 파일 경로 (절대경로 또는 구글드라이브 링크)</label>
                      <input
                        type="text"
                        value={editChecklistUrl}
                        onChange={e => setEditChecklistUrl(e.target.value)}
                        placeholder="예: d:/GoogleDrive/반입전체크리스트_G06004.pdf"
                        style={{ width: '100%', padding: '6px', fontSize: '12.5px', marginTop: '4px' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

              {/* 현재 계약 상태 */}
              <div>
                <h4 style={{ fontWeight: '600', marginBottom: '10px', color: 'var(--info)' }}>2. 현재 운용 / 임대 현황</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '14px' }}>
                  <div><label>현재 고객사</label>{getCustomerName(selectedAsset.currentCustomerId)}</div>
                  <div><label>사용 현장</label>{getSiteName(selectedAsset.currentSiteId)}</div>
                  <div><label>계약 기간</label>{selectedAsset.contractStart ? `${selectedAsset.contractStart} ~ ${selectedAsset.contractEnd}` : '-'}</div>
                  <div><label>청구 마감일</label>매달 {selectedAsset.billingDay}일</div>
                  <div><label>월 렌탈료</label>{(selectedAsset.monthlyRentalFee || 0).toLocaleString()}원</div>
                  <div><label>일할 렌탈료</label>{(selectedAsset.dailyRentalFee || 0).toLocaleString()}원</div>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

              {/* 당사자산 재무정보 */}
              {selectedAsset.ownerType === 'OWNED' && (
                <div>
                  <h4 style={{ fontWeight: '600', marginBottom: '10px', color: 'var(--success)' }}>3. 당사자산 감가상각 및 재무 가치</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '14px' }}>
                    <div><label>취득일자</label>{selectedAsset.acquisitionDate || '-'}</div>
                    <div><label>취득가액</label>{(selectedAsset.acquisitionPrice || 0).toLocaleString()}원</div>
                    <div><label>구입처</label>{selectedAsset.supplier || '-'}</div>
                    <div><label>내용수명(상각개월)</label>{selectedAsset.depreciationMonths}개월</div>
                    <div><label>잔존가치율 (%)</label>{selectedAsset.residualValueRate}%</div>
                    <div><label>감가상각누계액</label>{(selectedAsset.accumDepreciation || 0).toLocaleString()}원</div>
                    <div><label>현재 장부가치</label><strong style={{ color: 'var(--success)' }}>{(selectedAsset.bookValue || 0).toLocaleString()}원</strong></div>
                  </div>
                </div>
              )}

              {/* 임차자산 정보 */}
              {selectedAsset.ownerType === 'RENTED' && (
                <div>
                  <h4 style={{ fontWeight: '600', marginBottom: '10px', color: 'var(--warning)' }}>3. 재임차 계약 정보</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '14px' }}>
                    <div><label>임차처 (소유원사)</label>{selectedAsset.renter || '-'}</div>
                    <div><label>임차 개시일</label>{selectedAsset.rentStart || '-'}</div>
                    <div><label>임차 만료일</label>{selectedAsset.rentEnd || '-'}</div>
                    <div><label>월 임차료 (지급)</label>{(selectedAsset.monthlyRentFee || 0).toLocaleString()}원</div>
                    <div><label>일 임차료</label>{(selectedAsset.dailyRentFee || 0).toLocaleString()}원</div>
                  </div>
                </div>
              )}

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

              {/* 영업성과 및 관리 */}
              <div>
                <h4 style={{ fontWeight: '600', marginBottom: '10px', color: 'var(--text-main)' }}>4. 누적 손익 및 비고</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '14px' }}>
                  <div><label>누적 렌탈 수익</label><span className="text-primary" style={{ fontWeight: '600' }}>{(selectedAsset.cumRentalFee || 0).toLocaleString()}원</span></div>
                  <div><label>누적 정비 수리비</label><span className="text-danger" style={{ fontWeight: '600' }}>{(selectedAsset.cumRepairCost || 0).toLocaleString()}원</span></div>
                  <div><label>누적 순익 (수익-수리비)</label><strong style={{ color: ((selectedAsset.cumRentalFee || 0) - (selectedAsset.cumRepairCost || 0)) >= 0 ? 'var(--success)' : 'var(--danger)' }}>{((selectedAsset.cumRentalFee || 0) - (selectedAsset.cumRepairCost || 0)).toLocaleString()}원</strong></div>
                  <div><label>비고 1 (장비특기)</label>{selectedAsset.memo1 || '-'}</div>
                  <div><label>비고 2 (작업지시등)</label>{selectedAsset.memo2 || '-'}</div>
                </div>
              </div>

              {/* 매각 처리된 경우 매각 정보 표시 */}
              {selectedAsset.status === 'SOLD' && (
                <div>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '16px 0' }} />
                  <h4 style={{ fontWeight: '600', marginBottom: '10px', color: 'var(--danger)' }}>5. 장비 매각 상세 내역</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '14px' }}>
                    <div><label>매각일자</label>{selectedAsset.disposalDate}</div>
                    <div><label>매각가격</label>{(selectedAsset.disposalPrice || 0).toLocaleString()}원</div>
                    <div><label>매각인수처</label>{selectedAsset.buyer}</div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
};
