// d:\Kiyeun_Lift\src\pages\SmartReturn.tsx
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Zap, Clipboard, FileText, Copy, Printer, Check, Plus, Trash2 } from 'lucide-react';
import { SmartReturnData } from '../context/AppContext';

export const SmartReturn: React.FC = () => {
  const { hasPermission, saveSmartReturn, contracts, customers, sites, contractAssets, assets } = useApp();
  const canSave = hasPermission('delivery', 'save');

  // 원본 텍스트 입력 상태
  const [rawText, setRawText] = useState<string>(
`* 회수 요청 *

고객명 : 현대건설(주)
현장명 : 삼성동 현장
회수일 : 2026-07-25
회수 장비번호 : EQ-0001, EQ-0002

특이사항 : 현장 종료로 인한 장비 조기 반납 및 회수 처리 요청.`
  );

  // 구조화된 폼 데이터 상태
  const [selectedContractId, setSelectedContractId] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [loadingTime, setLoadingTime] = useState('');
  const [unloadingTime, setUnloadingTime] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [note, setNote] = useState('');

  // 1. 파싱 함수
  const handleParse = () => {
    const lines = rawText.split('\n');
    let parsedCust = '';
    let parsedSite = '';
    let parsedDate = '';
    let parsedAssets: string[] = [];
    let parsedMemo = '';

    lines.forEach(line => {
      const clean = line.trim();
      if (clean.includes('고객명') || clean.includes('고객')) {
        parsedCust = clean.split(':')[1]?.trim() || '';
      } else if (clean.includes('현장명') || clean.includes('현장')) {
        parsedSite = clean.split(':')[1]?.trim() || '';
      } else if (clean.includes('회수일') || clean.includes('상차시간') || clean.includes('스케줄')) {
        const val = clean.split(':')[1]?.trim() || '';
        const dateMatch = val.match(/\d{4}-\d{2}-\d{2}/);
        if (dateMatch) {
          parsedDate = dateMatch[0];
        } else {
          parsedDate = val;
        }
      } else if (clean.includes('장비번호') || clean.includes('관리번호') || clean.includes('장비')) {
        const val = clean.split(':')[1]?.trim() || '';
        parsedAssets = val.split(',').map(v => v.trim()).filter(Boolean);
      } else if (clean.includes('특이사항') || clean.includes('비고') || clean.includes('메모')) {
        parsedMemo = clean.split(':')[1]?.trim() || '';
      }
    });

    // 고객 및 현장에 해당되는 활성 계약 자동 매칭
    const customer = customers.find(c => c.name.replace(/\s/g, '').includes(parsedCust.replace(/\s/g, '')) || parsedCust.replace(/\s/g, '').includes(c.name.replace(/\s/g, '')));
    const site = sites.find(s => s.name.replace(/\s/g, '').includes(parsedSite.replace(/\s/g, '')) || parsedSite.replace(/\s/g, '').includes(s.name.replace(/\s/g, '')));

    let matchedContract = null;
    if (customer) {
      matchedContract = contracts.find(c => c.customerId === customer.id && (site ? c.siteId === site.id : true) && c.status !== 'COMPLETED');
    }

    if (matchedContract) {
      setSelectedContractId(matchedContract.id);
      
      // 해당 계약에 배정되어 있는 실 자산 매칭
      const cAssets = contractAssets.filter(ca => ca.contractId === matchedContract.id);
      const mappedAssetIds: string[] = [];
      
      parsedAssets.forEach(aNo => {
        const realAsset = assets.find(ast => ast.assetNo === aNo || ast.assetNo.includes(aNo));
        if (realAsset && cAssets.some(ca => ca.assetId === realAsset.id)) {
          mappedAssetIds.push(realAsset.id);
        }
      });

      setSelectedAssetIds(mappedAssetIds);
    } else {
      setSelectedContractId('');
      setSelectedAssetIds([]);
    }

    if (parsedDate) setReturnDate(parsedDate);
    if (parsedMemo) setNote(parsedMemo);
  };

  // 계약 선택 시 해당 계약의 대여 중인 자산 목록 로드
  const activeContractAssets = contractAssets.filter(ca => ca.contractId === selectedContractId && ca.assetId);
  
  const handleAssetCheckboxChange = (assetId: string) => {
    if (selectedAssetIds.includes(assetId)) {
      setSelectedAssetIds(selectedAssetIds.filter(id => id !== assetId));
    } else {
      setSelectedAssetIds([...selectedAssetIds, assetId]);
    }
  };

  const handleSelectAllAssets = () => {
    const allIds = activeContractAssets.map(ca => ca.assetId!).filter(Boolean);
    if (selectedAssetIds.length === allIds.length) {
      setSelectedAssetIds([]);
    } else {
      setSelectedAssetIds(allIds);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    if (!selectedContractId) {
      alert('회수 처리할 대상 계약을 선택해야 합니다.');
      return;
    }
    if (selectedAssetIds.length === 0) {
      alert('회수할 장비를 최소 하나 이상 선택해 주세요.');
      return;
    }
    if (!returnDate) {
      alert('회수 예정일자를 입력해 주세요.');
      return;
    }

    saveSmartReturn({
      contractId: selectedContractId,
      returnDate,
      assetIds: selectedAssetIds,
      loadingTime,
      unloadingTime,
      note
    });

    alert('스마트 회수의뢰 등록이 성공적으로 완료되었습니다.\n배차/운송 관리 메뉴에 회수(INBOUND) 의뢰가 등록되었습니다.');
    setSelectedContractId('');
    setSelectedAssetIds([]);
    setReturnDate('');
    setNote('');
  };

  return (
    <div>
      <div className="card-header" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontWeight: '700' }}>스마트 회수 요청 생성</h2>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          카카오톡이나 메일의 텍스트 오더 내용을 파싱하여 신속하게 장비 회수 지시와 정산 계약 만료를 등록합니다.
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
        {/* 좌측: 원본 텍스트 입력 및 파서 */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', minHeight: '32px' }}>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
              <FileText size={18} style={{ color: 'var(--primary)' }} />
              원본 오더 텍스트 입력
            </h3>
            <button 
              type="button" 
              className="btn-primary" 
              onClick={handleParse} 
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', fontSize: '13px', fontWeight: 'bold' }}
            >
              <Zap size={14} /> 스마트 변환 (추출)
            </button>
          </div>
          <textarea
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            style={{ width: '100%', height: '300px', fontFamily: 'monospace', fontSize: '13px', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', margin: 0 }}
            placeholder="여기에 회수 요청 카톡/이메일 텍스트를 붙여넣으세요..."
          />
        </div>

        {/* 우측: 구조화된 회수의뢰 폼 */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', minHeight: '32px' }}>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
              <Clipboard size={18} style={{ color: 'var(--success)' }} />
              구조화된 회수 정보 등록
            </h3>
            <button 
              type="submit" 
              form="smart-return-form"
              className="btn-success" 
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', fontSize: '13px', fontWeight: 'bold' }}
              disabled={!canSave || !selectedContractId || selectedAssetIds.length === 0}
            >
              <Check size={14} /> 회수의뢰 생성 확정
            </button>
          </div>
          
          <form id="smart-return-form" onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label>회수 대상 계약 선택 *</label>
                <select 
                  value={selectedContractId} 
                  onChange={e => {
                    setSelectedContractId(e.target.value);
                    setSelectedAssetIds([]);
                  }} 
                  required
                >
                  <option value="">-- 회수할 고객사/현장 계약 선택 --</option>
                  {contracts.filter(c => c.status === 'ACTIVE' || c.status === 'EXTENDED' || c.status === 'SHORTENED').map(c => {
                    const cust = customers.find(cust => cust.id === c.customerId);
                    const site = sites.find(s => s.id === c.siteId);
                    return (
                      <option key={c.id} value={c.id}>
                        {c.contractNo} - {cust?.name} ({site?.name || '현장명 없음'})
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedContractId && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ margin: 0 }}>회수할 장비 선택 *</label>
                    <button 
                      type="button" 
                      onClick={handleSelectAllAssets}
                      style={{ fontSize: '11px', padding: '2px 6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)', cursor: 'pointer', borderRadius: '4px' }}
                    >
                      전체 선택 / 해제
                    </button>
                  </div>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border)', padding: '10px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'var(--bg-input)' }}>
                    {activeContractAssets.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '12.5px', textAlign: 'center', padding: '10px 0' }}>
                        이 계약에 등록 및 대여 중인 실물 자산이 없습니다.
                      </div>
                    ) : (
                      activeContractAssets.map(ca => {
                        const asset = assets.find(a => a.id === ca.assetId);
                        if (!asset) return null;
                        return (
                          <label key={ca.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', margin: 0 }}>
                            <input 
                              type="checkbox" 
                              checked={selectedAssetIds.includes(asset.id)}
                              onChange={() => handleAssetCheckboxChange(asset.id)}
                            />
                            <strong>{asset.assetNo}</strong> - {asset.modelName} ({asset.manufacturer || '제조사 미상'})
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>회수 희망일자 *</label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={e => setReturnDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label>상차 희망시간</label>
                  <input
                    type="text"
                    value={loadingTime}
                    onChange={e => setLoadingTime(e.target.value)}
                    placeholder="예: 오전 10시"
                  />
                </div>
              </div>

              <div>
                <label>회수 관련 특이사항 (비고)</label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="예: 조기 반납 합의 완료. 운송 편도 청구 예정."
                  rows={3}
                />
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
