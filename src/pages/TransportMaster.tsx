import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Settings, Users, Truck, Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { TransportCompany, TransportDriver, db } from '../services/db';

export const TransportMaster: React.FC = () => {
  const { transportCompanies, transportDrivers, hasPermission, refreshAllData } = useApp();
  const canSave = hasPermission('delivery', 'save');

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // 업체가 선택되지 않으면 전체, 선택되면 해당 업체 기사만
  const filteredDrivers = selectedCompanyId 
    ? transportDrivers.filter(d => d.companyId === selectedCompanyId)
    : transportDrivers;

  const handleDeleteCompany = (id: string) => {
    if (!canSave || !window.confirm('운송사를 삭제하시겠습니까? 연관된 기사 정보는 유지되나 소속이 해제될 수 있습니다.')) return;
    const list = transportCompanies.filter(c => c.id !== id);
    localStorage.setItem('erp_transportCompanies', JSON.stringify(list));
    refreshAllData();
    if (selectedCompanyId === id) setSelectedCompanyId(null);
  };

  const handleDeleteDriver = (id: string) => {
    if (!canSave || !window.confirm('이 기사 정보를 삭제하시겠습니까?')) return;
    const list = transportDrivers.filter(d => d.id !== id);
    localStorage.setItem('erp_transportDrivers', JSON.stringify(list));
    refreshAllData();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontWeight: '700', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={22} color="var(--primary)" /> 운송 거래처 및 기사 마스터 관리
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
        
        {/* 왼쪽: 운송 거래처 목록 */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Truck size={16} /> 운송 거래처 (물류사)
            </h3>
            {canSave && (
              <button className="btn-primary" style={{ padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Plus size={14} /> 신규 추가
              </button>
            )}
          </div>
          
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div 
              onClick={() => setSelectedCompanyId(null)}
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: selectedCompanyId === null ? 'var(--bg-active)' : 'transparent',
                border: selectedCompanyId === null ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                fontWeight: selectedCompanyId === null ? '700' : '500'
              }}
            >
              전체 기사 보기
            </div>
            {transportCompanies.map(comp => (
              <div 
                key={comp.id}
                onClick={() => setSelectedCompanyId(comp.id)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: selectedCompanyId === comp.id ? 'var(--bg-active)' : 'transparent',
                  border: selectedCompanyId === comp.id ? '1px solid var(--primary)' : '1px solid var(--border-color)'
                }}
              >
                <div>
                  <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>{comp.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{comp.contact || '연락처 없음'}</div>
                </div>
                {canSave && (
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteCompany(comp.id); }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 오른쪽: 소속 기사 목록 */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={16} /> 소속 운송 기사 및 차량 정보
            </h3>
            {canSave && selectedCompanyId && (
              <button className="btn-primary" style={{ padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Plus size={14} /> 기사 추가
              </button>
            )}
          </div>

          <div className="table-container" style={{ marginTop: '16px' }}>
            <table>
              <thead>
                <tr>
                  <th>기사명</th>
                  <th>소속 업체</th>
                  <th>차량 종류</th>
                  <th>차량 번호</th>
                  <th>연락처</th>
                  {canSave && <th style={{ width: '80px', textAlign: 'center' }}>관리</th>}
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      등록된 기사 정보가 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredDrivers.map(d => {
                    const comp = transportCompanies.find(c => c.id === d.companyId);
                    return (
                      <tr key={d.id}>
                        <td style={{ fontWeight: '700' }}>{d.driverName}</td>
                        <td><span className="badge badge-secondary">{comp?.name || '미상'}</span></td>
                        <td>{d.vehicleType || '-'}</td>
                        <td>{d.vehicleNo || '-'}</td>
                        <td>{d.driverContact || '-'}</td>
                        {canSave && (
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              <button style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}><Edit2 size={14} /></button>
                              <button onClick={() => handleDeleteDriver(d.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={14} /></button>
                            </div>
                          </td>
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
    </div>
  );
};
