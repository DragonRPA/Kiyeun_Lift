// d:\Kiyeun_Lift\src\pages\Contracts.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Mail, Calendar, ArrowRight, FileText, Check, Send } from 'lucide-react';
import { drive } from '../services/drive';
import { emailService } from '../services/email';
import { Contract } from '../services/db';

export const Contracts: React.FC = () => {
  const {
    contracts, contractAssets, contractHistory, customers, contacts, sites, assets,
    createContract, extendContract, shortenContract, succeedContract, hasPermission
  } = useApp();

  const canSave = hasPermission('contract', 'save');

  const [activeTab, setActiveTab] = useState<'LIST' | 'CREATE' | 'MODIFY' | 'TRANSFER' | 'EMAIL'>('LIST');

  // 선택된 계약 상세 조회 상태
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

  // --- 계약 등록 상태 ---
  const [custSelect, setCustSelect] = useState(customers[0]?.id || '');
  const [contactSelect, setContactSelect] = useState('');
  const [siteSelect, setSiteSelect] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(new Date().getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [billingDay, setBillingDay] = useState(30);
  
  // 계약 등록 중 자산 바스켓
  const [basket, setBasket] = useState<{ assetId: string; monthlyRentalFee: number; dailyRentalFee: number }[]>([]);
  const [selectedAssetToAdd, setSelectedAssetToAdd] = useState('');
  const [customMonthly, setCustomMonthly] = useState(400000);
  const [customDaily, setCustomDaily] = useState(15000);

  // --- 계약 연장/단축 상태 ---
  const [modContractId, setModContractId] = useState('');
  const [modType, setModType] = useState<'EXTEND' | 'SHORTEN'>('EXTEND');
  const [newEndDate, setNewEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [modDesc, setModDesc] = useState('');

  // --- 계약 승계 상태 ---
  const [succContractId, setSuccContractId] = useState('');
  const [succCustId, setSuccCustId] = useState('');
  const [succContactId, setSuccContactId] = useState('');
  const [succSiteId, setSuccSiteId] = useState('');
  const [succDate, setSuccDate] = useState(new Date().toISOString().split('T')[0]);
  const [succDesc, setSuccDesc] = useState('');

  // --- 이메일 전송 상태 ---
  const [mailContractId, setMailContractId] = useState('');
  const [mailTo, setMailTo] = useState('');
  const [mailCc, setMailCc] = useState('');
  const [mailSubject, setMailSubject] = useState('');
  const [mailBody, setMailBody] = useState('');
  const [mailAttachmentIds, setMailAttachmentIds] = useState<string[]>([]);
  const [isSendingMail, setIsSendingMail] = useState(false);

  const getCustName = (id: string) => customers.find(c => c.id === id)?.name || '-';
  const getSiteName = (id?: string) => sites.find(s => s.id === id)?.name || '-';
  const getContactName = (id?: string) => contacts.find(c => c.id === id)?.name || '-';

  const activeContract = contracts.find(c => c.id === selectedContractId);
  const activeContractHistory = contractHistory.filter(h => h.contractId === selectedContractId);
  const activeContractAssets = contractAssets.filter(ca => ca.contractId === selectedContractId);

  // 대기상태 장비 목록 (계약 추가용)
  const availableAssets = assets.filter(a => a.status === 'AVAILABLE');

  // 계약 등록 중 자산 추가
  const handleAddToBasket = () => {
    if (!selectedAssetToAdd) return;
    if (basket.some(b => b.assetId === selectedAssetToAdd)) return;

    setBasket([...basket, {
      assetId: selectedAssetToAdd,
      monthlyRentalFee: customMonthly,
      dailyRentalFee: customDaily
    }]);

    setSelectedAssetToAdd('');
  };

  const handleRemoveFromBasket = (id: string) => {
    setBasket(basket.filter(b => b.assetId !== id));
  };

  const handleCreateContractSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    if (!custSelect || basket.length === 0) {
      alert('고객사 선택 및 최소 한 대 이상의 자산을 추가해 주세요.');
      return;
    }

    createContract({
      customerId: custSelect,
      contactId: contactSelect || undefined,
      siteId: siteSelect || undefined,
      startDate,
      endDate,
      billingDay,
      status: 'ACTIVE'
    }, basket);

    alert('계약 등록이 완료되었으며, 출고 배차 의뢰가 자동 생성되었습니다.');
    // 초기화
    setBasket([]);
    setActiveTab('LIST');
  };

  const handlePeriodModSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !modContractId) return;

    if (modType === 'EXTEND') {
      extendContract(modContractId, newEndDate, modDesc);
      alert('계약 기간 연장 처리가 완료되었습니다.');
    } else {
      shortenContract(modContractId, newEndDate, modDesc);
      alert('계약 기간 단축 처리 및 회수 의뢰가 자동 등록되었습니다.');
    }

    setModContractId('');
    setModDesc('');
    setActiveTab('LIST');
  };

  const handleSuccessionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !succContractId || !succCustId) return;

    succeedContract(succContractId, succCustId, succContactId, succSiteId, succDate, succDesc);
    alert('계약 잔여기간 승계 처리가 승인되었습니다. 승계 대상 신규계약이 발행되었습니다.');
    setSuccContractId('');
    setSuccCustId('');
    setSuccContactId('');
    setSuccSiteId('');
    setSuccDesc('');
    setActiveTab('LIST');
  };

  const handleMailContractChange = (cid: string) => {
    setMailContractId(cid);
    const contract = contracts.find(c => c.id === cid);
    if (!contract) return;

    // 수신 이메일 디폴트 설정 (고객 담당자 및 현장 담당자)
    const cc = contacts.find(contact => contact.id === contract.contactId);
    const site = sites.find(s => s.id === contract.siteId);
    
    setMailTo(cc?.email || '');
    setMailCc(site?.email || '');
    setMailSubject(`[렌탈계약 알림] ${getCustName(contract.customerId)} 계약 정보 안내 (${contract.contractNo})`);
    setMailBody(
      `안녕하세요, ${getCustName(contract.customerId)} 담당자님.\n\n` +
      `당사 렌탈 장비 계약이 체결 완료되어 안내드립니다.\n` +
      `계약번호: ${contract.contractNo}\n` +
      `계약기간: ${contract.startDate} ~ ${contract.endDate}\n\n` +
      `구글드라이브에 업로드된 계약 및 인수 서류를 첨부하여 전송합니다.\n` +
      `상세 내용은 첨부파일을 확인해 주시기 바랍니다.\n\n` +
      `감사합니다.\n(주)기연리프트`
    );

    // 디폴트 구글드라이브 첨부파일 선택 (계약 폴더 내에 있는 임대계약서 날인본 등 매핑)
    const folderFiles = drive.listFiles(contract.driveFolderId || '');
    const defaultPublic = drive.listAllFiles().filter(f => f.folderId === 'root'); // 공용양식
    const autoSelects = [...folderFiles, ...defaultPublic].map(f => f.id);
    setMailAttachmentIds(autoSelects);
  };

  const handleSendEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mailTo) {
      alert('수신자 이메일을 입력해 주세요.');
      return;
    }
    
    setIsSendingMail(true);
    try {
      await emailService.sendEmail(mailTo, mailSubject, mailBody, mailAttachmentIds, mailCc);
      alert('구글 드라이브 첨부파일 포함 이메일이 성공적으로 발송되었습니다.');
      setMailTo('');
      setMailSubject('');
      setMailBody('');
      setMailAttachmentIds([]);
      setActiveTab('LIST');
    } catch (err) {
      alert('메일 전송에 실패했습니다.');
    } finally {
      setIsSendingMail(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: '24px', fontWeight: '700' }}>렌탈 계약 및 연동 관리</h2>

      {/* 대메뉴 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button className={activeTab === 'LIST' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('LIST')}>
          계약 리스트 / 조회
        </button>
        {canSave && (
          <>
            <button className={activeTab === 'CREATE' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('CREATE')}>
              <Plus size={14} /> 계약 등록 (출고의뢰 자동연동)
            </button>
            <button className={activeTab === 'MODIFY' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('MODIFY')}>
              <Calendar size={14} /> 계약 연장 / 단축 (회수의뢰 연동)
            </button>
            <button className={activeTab === 'TRANSFER' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('TRANSFER')}>
              <ArrowRight size={14} /> 계약 승계 (타사 잔여 승계)
            </button>
            <button className={activeTab === 'EMAIL' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('EMAIL')}>
              <Mail size={14} /> 계약 통지 메일 발송 (구글드라이브 연동)
            </button>
          </>
        )}
      </div>

      {activeTab === 'LIST' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'flex-start' }}>
          {/* 계약 목록 */}
          <div className="card" style={{ margin: 0 }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>전체 계약 목록</h3>
            <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
              <table style={{ minWidth: '400px' }}>
                <thead>
                  <tr>
                    <th>계약번호</th>
                    <th>고객사</th>
                    <th>계약기간</th>
                    <th>상태</th>
                    <th>선택</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map(c => (
                    <tr key={c.id}>
                      <td><strong>{c.contractNo}</strong></td>
                      <td>{getCustName(c.customerId)}</td>
                      <td style={{ fontSize: '12px' }}>{c.startDate} ~ {c.endDate}</td>
                      <td>
                        <span className={`badge ${
                          c.status === 'ACTIVE' ? 'badge-success' :
                          c.status === 'EXTENDED' ? 'badge-info' :
                          c.status === 'SUCCEEDED' ? 'badge-warning' : 'badge-danger'
                        }`}>
                          {c.status === 'ACTIVE' ? '진행중' :
                           c.status === 'EXTENDED' ? '연장됨' :
                           c.status === 'SHORTENED' ? '단축됨' :
                           c.status === 'SUCCEEDED' ? '승계됨' : '종료'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn-secondary"
                          onClick={() => setSelectedContractId(c.id)}
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                        >
                          보기
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 계약 세부 내용 */}
          <div>
            {activeContract ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="card" style={{ margin: 0 }}>
                  <h3 className="card-title" style={{ marginBottom: '16px', color: 'var(--primary)' }}>
                    계약 상세 명세: {activeContract.contractNo}
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px', marginBottom: '20px' }}>
                    <div><label>고객사</label><strong>{getCustName(activeContract.customerId)}</strong></div>
                    <div><label>현장구분</label>{getSiteName(activeContract.siteId)}</div>
                    <div><label>계약시작일</label>{activeContract.startDate}</div>
                    <div><label>계약만료일</label>{activeContract.endDate}</div>
                    <div><label>마감 기준일</label>매월 {activeContract.billingDay}일</div>
                    <div><label>구글드라이브 폴더</label>
                      <a href={`https://drive.google.com/drive/folders/${activeContract.driveFolderId}`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: '600' }}>
                        구글드라이브 열기 (링크)
                      </a>
                    </div>
                  </div>

                  <h4 style={{ fontWeight: '600', marginBottom: '10px', fontSize: '14px' }}>계약 체결 장비 목록</h4>
                  <div className="table-container" style={{ border: 'none', boxShadow: 'none', marginBottom: '20px' }}>
                    <table style={{ minWidth: '350px' }}>
                      <thead>
                        <tr>
                          <th>자산번호</th>
                          <th>모델명</th>
                          <th>월 렌탈료</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeContractAssets.map(ca => {
                          const assetInfo = assets.find(a => a.id === ca.assetId);
                          return (
                            <tr key={ca.id}>
                              <td><strong>{assetInfo?.assetNo}</strong></td>
                              <td>{assetInfo?.modelName}</td>
                              <td>{ca.monthlyRentalFee.toLocaleString()}원</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 계약 변동 이력 */}
                <div className="card" style={{ margin: 0 }}>
                  <h3 className="card-title" style={{ marginBottom: '12px' }}>계약 변경 이력</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {activeContractHistory.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>변동 이력이 없습니다.</div>
                    ) : (
                      activeContractHistory.map(h => (
                        <div key={h.id} style={{ padding: '8px', borderLeft: '3px solid var(--primary)', backgroundColor: 'var(--bg-app)', fontSize: '13px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}>
                            <span>{h.changeType === 'REGISTER' ? '신규등록' : h.changeType === 'EXTEND' ? '계약연장' : '계약단축/승계'}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{h.changeDate}</span>
                          </div>
                          <div style={{ marginTop: '4px' }}>{h.description}</div>
                          {h.prevEndDate && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              만료일 변경: {h.prevEndDate} → {h.newEndDate}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', margin: 0 }}>
                상세 정보를 조회할 계약을 왼쪽에서 선택해 주세요.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'CREATE' && (
        <div className="card" style={{ maxWidth: '800px', margin: 0 }}>
          <h3 className="card-title" style={{ marginBottom: '20px' }}>신규 렌탈 계약 체결</h3>
          <form onSubmit={handleCreateContractSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label>계약 고객사 선택 *</label>
                <select value={custSelect} onChange={e => {
                  setCustSelect(e.target.value);
                  setContactSelect('');
                  setSiteSelect('');
                }} required>
                  {customers.filter(c => !c.isClosed).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label>청구 마감일자 기준 (일) *</label>
                <input
                  type="number"
                  value={billingDay}
                  onChange={e => setBillingDay(parseInt(e.target.value) || 30)}
                  min={1}
                  max={30}
                  required
                />
              </div>

              <div>
                <label>고객 담당자 선택</label>
                <select value={contactSelect} onChange={e => setContactSelect(e.target.value)}>
                  <option value="">-- 담당자 선택 안함 --</option>
                  {contacts.filter(co => co.customerId === custSelect).map(co => (
                    <option key={co.id} value={co.id}>{co.name} ({co.position})</option>
                  ))}
                </select>
              </div>

              <div>
                <label>출고 대상 현장 선택</label>
                <select value={siteSelect} onChange={e => setSiteSelect(e.target.value)}>
                  <option value="">-- 직납 (현장 없음) --</option>
                  {sites.filter(s => s.customerId === custSelect).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label>임대 시작일자 *</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
              </div>

              <div>
                <label>임대 종료일자 *</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
              </div>
            </div>

            {/* 리프트 장비 추가 바스켓 세션 */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>임대 투입 리프트 장비 바스켓 추가</h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '12px', alignItems: 'end', marginBottom: '16px' }}>
                <div>
                  <label>임대 가능 장비 목록</label>
                  <select value={selectedAssetToAdd} onChange={e => {
                    setSelectedAssetToAdd(e.target.value);
                    const asset = assets.find(a => a.id === e.target.value);
                    if (asset) {
                      setCustomMonthly(asset.monthlyRentalFee || 0);
                      setCustomDaily(asset.dailyRentalFee || 0);
                    }
                  }}>
                    <option value="">-- 대기 장비 선택 --</option>
                    {availableAssets.map(a => (
                      <option key={a.id} value={a.id}>{a.assetNo} - {a.modelName} (기준 월 {(a.monthlyRentalFee || 0).toLocaleString()}원)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>합의 월 렌탈료 (원)</label>
                  <input type="number" value={customMonthly} onChange={e => setCustomMonthly(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label>합의 일 렌탈료 (원)</label>
                  <input type="number" value={customDaily} onChange={e => setCustomDaily(parseInt(e.target.value) || 0)} />
                </div>
                <button type="button" className="btn-secondary" onClick={handleAddToBasket}>
                  추가
                </button>
              </div>

              {/* 추가된 자재 바스켓 */}
              {basket.length > 0 && (
                <div className="table-container" style={{ border: 'none', boxShadow: 'none', margin: 0 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>장비번호</th>
                        <th>합의 월렌탈료</th>
                        <th>합의 일렌탈료</th>
                        <th style={{ width: '80px' }}>취소</th>
                      </tr>
                    </thead>
                    <tbody>
                      {basket.map(item => {
                        const asset = assets.find(a => a.id === item.assetId);
                        return (
                          <tr key={item.assetId}>
                            <td><strong>{asset?.assetNo}</strong> ({asset?.modelName})</td>
                            <td>{item.monthlyRentalFee.toLocaleString()}원</td>
                            <td>{item.dailyRentalFee.toLocaleString()}원</td>
                            <td>
                              <button type="button" className="btn-danger" onClick={() => handleRemoveFromBasket(item.assetId)} style={{ padding: '2px 6px', fontSize: '11px' }}>삭제</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" className="btn-secondary" onClick={() => setActiveTab('LIST')}>취소</button>
              <button type="submit" className="btn-primary" disabled={basket.length === 0}>계약 체결 및 확정</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'MODIFY' && (
        <div className="card" style={{ maxWidth: '600px', margin: 0 }}>
          <h3 className="card-title" style={{ marginBottom: '20px' }}>계약 기간 임대 연장 / 단축 변경</h3>
          <form onSubmit={handlePeriodModSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label>변경할 계약 건 선택 *</label>
                <select value={modContractId} onChange={e => setModContractId(e.target.value)} required>
                  <option value="">-- 활성 렌탈 계약 선택 --</option>
                  {contracts.filter(c => c.status === 'ACTIVE' || c.status === 'EXTENDED').map(c => (
                    <option key={c.id} value={c.id}>{c.contractNo} - {getCustName(c.customerId)} (종료일: {c.endDate})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>변경 처리 구분 *</label>
                  <select value={modType} onChange={e => setModType(e.target.value as 'EXTEND' | 'SHORTEN')}>
                    <option value="EXTEND">계약 기간 연장 (Extend)</option>
                    <option value="SHORTEN">계약 조기 단축 (Shorten)</option>
                  </select>
                </div>
                <div>
                  <label>신규 만료 일자 *</label>
                  <input type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} required />
                </div>
              </div>

              <div>
                <label>변경 사유 명세 *</label>
                <textarea
                  value={modDesc}
                  onChange={e => setModDesc(e.target.value)}
                  placeholder="예: 공사 기간 증가에 따른 2달 추가 연장 합의 완료"
                  rows={3}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" className="btn-secondary" onClick={() => setActiveTab('LIST')}>취소</button>
              <button type="submit" className="btn-primary" disabled={!modContractId}>변경 실행</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'TRANSFER' && (
        <div className="card" style={{ maxWidth: '650px', margin: 0 }}>
          <h3 className="card-title" style={{ marginBottom: '20px' }}>계약 잔여 기간 타사 승계 (인수)</h3>
          <form onSubmit={handleSuccessionSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              
              {/* 기존 계약 */}
              <div>
                <label>승계할 기존 계약건 선택 *</label>
                <select value={succContractId} onChange={e => setSuccContractId(e.target.value)} required>
                  <option value="">-- 기존 진행 계약 선택 --</option>
                  {contracts.filter(c => c.status === 'ACTIVE' || c.status === 'EXTENDED').map(c => (
                    <option key={c.id} value={c.id}>{c.contractNo} - {getCustName(c.customerId)} (기간: ~{c.endDate})</option>
                  ))}
                </select>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

              {/* 신규 계약처 */}
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--primary)' }}>승계 인수 고객사 지정</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label>인수 고객사 *</label>
                    <select value={succCustId} onChange={e => {
                      setSuccCustId(e.target.value);
                      setSuccContactId('');
                      setSuccSiteId('');
                    }} required>
                      <option value="">-- 신규 인수사 선택 --</option>
                      {customers.filter(c => c.id !== contracts.find(co => co.id === succContractId)?.customerId).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label>승계 기준 일자 *</label>
                    <input type="date" value={succDate} onChange={e => setSuccDate(e.target.value)} required />
                    <small style={{ color: 'var(--text-muted)' }}>* 기존계약은 해당일에 종료, 신규계약은 다음날 자동개시</small>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>인수사 담당자</label>
                  <select value={succContactId} onChange={e => setSuccContactId(e.target.value)}>
                    <option value="">-- 선택 안함 --</option>
                    {contacts.filter(cc => cc.customerId === succCustId).map(cc => (
                      <option key={cc.id} value={cc.id}>{cc.name} ({cc.position})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>인수사 현장지정</label>
                  <select value={succSiteId} onChange={e => setSuccSiteId(e.target.value)}>
                    <option value="">-- 선택 안함 --</option>
                    {sites.filter(s => s.customerId === succCustId).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label>승계 특기 사유 *</label>
                <textarea
                  value={succDesc}
                  onChange={e => setSuccDesc(e.target.value)}
                  placeholder="예: 현대건설 하도급 사 변경에 따른 잔여 계약 기간 및 장비 승계 인계"
                  rows={2}
                  required
                />
              </div>

            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" className="btn-secondary" onClick={() => setActiveTab('LIST')}>취소</button>
              <button type="submit" className="btn-primary" disabled={!succContractId || !succCustId}>승계 처리 실행</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'EMAIL' && (
        <div className="card" style={{ maxWidth: '700px', margin: 0 }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <Mail className="text-primary" /> 구글 드라이브 문서 첨부 이메일 전송
          </h3>

          <form onSubmit={handleSendEmailSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label>대상 계약 건 선택 *</label>
                <select value={mailContractId} onChange={e => handleMailContractChange(e.target.value)} required>
                  <option value="">-- 계약 선택시 구글드라이브 폴더와 이메일이 연동됩니다 --</option>
                  {contracts.map(c => (
                    <option key={c.id} value={c.id}>{c.contractNo} - {getCustName(c.customerId)} (시작일: {c.startDate})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>수신자 이메일 (To) *</label>
                  <input type="email" value={mailTo} onChange={e => setMailTo(e.target.value)} placeholder="recipient@company.com" required />
                </div>
                <div>
                  <label>참조 이메일 (Cc)</label>
                  <input type="email" value={mailCc} onChange={e => setMailCc(e.target.value)} placeholder="cc@company.com" />
                </div>
              </div>

              <div>
                <label>이메일 제목 *</label>
                <input type="text" value={mailSubject} onChange={e => setMailSubject(e.target.value)} required />
              </div>

              <div>
                <label>이메일 본문 내용</label>
                <textarea value={mailBody} onChange={e => setMailBody(e.target.value)} rows={6} />
              </div>

              {/* 구글 드라이브 첨부파일 선택 체크박스 */}
              {mailContractId && (
                <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-app)' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px' }}>구글 드라이브 계약 연동 파일 목록 (첨부할 파일 선택)</h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* 해당 계약 하위 폴더의 파일 */}
                    {drive.listFiles(contracts.find(c => c.id === mailContractId)?.driveFolderId || '').map(f => (
                      <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'normal', margin: 0, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={mailAttachmentIds.includes(f.id)}
                          onChange={e => {
                            if (e.target.checked) setMailAttachmentIds([...mailAttachmentIds, f.id]);
                            else setMailAttachmentIds(mailAttachmentIds.filter(id => id !== f.id));
                          }}
                          style={{ width: '16px', height: '16px' }}
                        />
                        <FileText size={14} className="text-primary" /> {f.name} ({f.size}) - [계약업무폴더]
                      </label>
                    ))}

                    {/* 공용 루트의 폴더 파일 */}
                    {drive.listAllFiles().filter(f => f.folderId === 'root').map(f => (
                      <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'normal', margin: 0, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={mailAttachmentIds.includes(f.id)}
                          onChange={e => {
                            if (e.target.checked) setMailAttachmentIds([...mailAttachmentIds, f.id]);
                            else setMailAttachmentIds(mailAttachmentIds.filter(id => id !== f.id));
                          }}
                          style={{ width: '16px', height: '16px' }}
                        />
                        <FileText size={14} className="text-secondary" /> {f.name} ({f.size}) - [ERP공용양식]
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" className="btn-secondary" onClick={() => setActiveTab('LIST')}>취소</button>
              <button type="submit" className="btn-success" disabled={isSendingMail || !mailContractId}>
                {isSendingMail ? '발송 중...' : <><Send size={14} /> 메일 발송하기</>}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
