// d:\Kiyeun_Lift\src\pages\Customers.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Search, MapPin, Phone, User, Mail, PlusCircle, Building } from 'lucide-react';
import { Customer, CustomerContact, CustomerSite } from '../services/db';

export const Customers: React.FC = () => {
  const {
    customers, contacts, sites, saveCustomer, saveContact, saveSite, hasPermission
  } = useApp();

  const canSave = hasPermission('customer', 'save');

  // 검색 상태
  const [searchTerm, setSearchTerm] = useState('');

  // 선택된 고객 상태 (담당자 및 현장 조회를 위함)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(customers[0]?.id || null);

  // 등록/수정 폼 관련 모달/바인딩 상태
  const [showCustModal, setShowCustModal] = useState(false);
  const [editingCust, setEditingCust] = useState<Partial<Customer> | null>(null);

  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Partial<CustomerContact> | null>(null);

  const [showSiteModal, setShowSiteModal] = useState(false);
  const [editingSite, setEditingSite] = useState<Partial<CustomerSite> | null>(null);

  const activeCustomer = customers.find(c => c.id === selectedCustomerId);
  const customerContacts = contacts.filter(cc => cc.customerId === selectedCustomerId);
  const customerSites = sites.filter(cs => cs.customerId === selectedCustomerId);

  // 검색 필터링된 고객 목록
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.bizRegNo.includes(searchTerm) ||
    c.representative.includes(searchTerm)
  );

  const handleOpenAddCust = () => {
    setEditingCust({ name: '', bizRegNo: '', isClosed: false, address: '', representative: '', repContact: '', repEmail: '' });
    setShowCustModal(true);
  };

  const handleOpenEditCust = (cust: Customer) => {
    setEditingCust(cust);
    setShowCustModal(true);
  };

  const handleSaveCustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCust || !editingCust.name) return;
    
    const saved = saveCustomer(editingCust as Omit<Customer, 'id' | 'createdAt'>);
    setShowCustModal(false);
    setEditingCust(null);
    if (!selectedCustomerId) {
      setSelectedCustomerId(saved.id);
    }
  };

  // 담당자 폼
  const handleOpenAddContact = () => {
    if (!selectedCustomerId) return;
    setEditingContact({ customerId: selectedCustomerId, name: '', position: '', contact: '', email: '' });
    setShowContactModal(true);
  };

  const handleOpenEditContact = (cc: CustomerContact) => {
    setEditingContact(cc);
    setShowContactModal(true);
  };

  const handleSaveContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact || !editingContact.name || !editingContact.customerId) return;
    saveContact(editingContact as Omit<CustomerContact, 'id' | 'createdAt'>);
    setShowContactModal(false);
    setEditingContact(null);
  };

  // 현장 폼
  const handleOpenAddSite = () => {
    if (!selectedCustomerId) return;
    setEditingSite({ customerId: selectedCustomerId, name: '', address: '', contactName: '', contact: '', email: '' });
    setShowSiteModal(true);
  };

  const handleOpenEditSite = (cs: CustomerSite) => {
    setEditingSite(cs);
    setShowSiteModal(true);
  };

  const handleSaveSiteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSite || !editingSite.name || !editingSite.customerId) return;
    saveSite(editingSite as Omit<CustomerSite, 'id' | 'createdAt'>);
    setShowSiteModal(false);
    setEditingSite(null);
  };

  return (
    <div>
      <h2 style={{ marginBottom: '24px', fontWeight: '700' }}>고객 관리</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', alignItems: 'flex-start' }}>
        
        {/* 왼쪽: 고객 목록 */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title">고객사 리스트</h3>
              {canSave && (
                <button className="btn-primary" onClick={handleOpenAddCust} style={{ padding: '6px 12px', fontSize: '13px' }}>
                  <Plus size={16} /> 신규 고객
                </button>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="고객명, 사업자번호 등으로 검색..."
                style={{ paddingLeft: '32px' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '550px', overflowY: 'auto', paddingRight: '4px' }}>
            {filteredCustomers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>등록된 고객이 없습니다.</div>
            ) : (
              filteredCustomers.map(cust => (
                <div
                  key={cust.id}
                  onClick={() => setSelectedCustomerId(cust.id)}
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    border: selectedCustomerId === cust.id ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    backgroundColor: selectedCustomerId === cust.id ? 'var(--primary-light)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <h4 style={{ fontWeight: '700', fontSize: '15px' }}>{cust.name}</h4>
                    {cust.isClosed && <span className="badge badge-danger">폐업</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>대표: {cust.representative}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>등록번호: {cust.bizRegNo || '없음'}</div>
                  {canSave && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                      <button
                        className="btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditCust(cust);
                        }}
                        style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '4px' }}
                      >
                        상세/수정
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 오른쪽: 상세 정보 (담당자 및 현장관리) */}
        <div>
          {activeCustomer ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* 고객 기본 상세 */}
              <div className="card" style={{ margin: 0 }}>
                <h3 className="card-title" style={{ marginBottom: '16px' }}>고객사 기본 정보</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div>
                    <label>대표자</label>
                    <div style={{ fontSize: '15px', fontWeight: '500' }}>{activeCustomer.representative}</div>
                  </div>
                  <div>
                    <label>대표 연락처</label>
                    <div style={{ fontSize: '15px', fontWeight: '500' }}>{activeCustomer.repContact || '-'}</div>
                  </div>
                  <div>
                    <label>대표 이메일</label>
                    <div style={{ fontSize: '15px', fontWeight: '500' }}>{activeCustomer.repEmail || '-'}</div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label>사업장 주소</label>
                    <div style={{ fontSize: '15px', fontWeight: '500' }}>{activeCustomer.address || '-'}</div>
                  </div>
                </div>
              </div>

              {/* 하위 탭 1: 고객 담당자 관리 */}
              <div className="card" style={{ margin: 0 }}>
                <div className="card-header">
                  <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <User size={18} className="text-primary" /> 고객 담당자 목록
                  </h3>
                  {canSave && (
                    <button className="btn-secondary" onClick={handleOpenAddContact} style={{ padding: '6px 12px', fontSize: '13px' }}>
                      <PlusCircle size={14} /> 담당자 추가
                    </button>
                  )}
                </div>

                <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
                  <table style={{ minWidth: '500px' }}>
                    <thead>
                      <tr>
                        <th>담당자명</th>
                        <th>직급</th>
                        <th>연락처</th>
                        <th>이메일</th>
                        <th>관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerContacts.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>등록된 담당자가 없습니다.</td>
                        </tr>
                      ) : (
                        customerContacts.map(cc => (
                          <tr key={cc.id}>
                            <td><strong>{cc.name}</strong></td>
                            <td>{cc.position || '-'}</td>
                            <td>{cc.contact}</td>
                            <td>{cc.email || '-'}</td>
                            <td>
                              {canSave && (
                                <button className="btn-secondary" onClick={() => handleOpenEditContact(cc)} style={{ padding: '4px 8px', fontSize: '11px' }}>수정</button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 하위 탭 2: 고객 현장 관리 */}
              <div className="card" style={{ margin: 0 }}>
                <div className="card-header">
                  <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={18} className="text-success" /> 고객 현장 목록
                  </h3>
                  {canSave && (
                    <button className="btn-secondary" onClick={handleOpenAddSite} style={{ padding: '6px 12px', fontSize: '13px' }}>
                      <PlusCircle size={14} /> 현장 추가
                    </button>
                  )}
                </div>

                <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
                  <table style={{ minWidth: '500px' }}>
                    <thead>
                      <tr>
                        <th>현장명</th>
                        <th>현장 주소</th>
                        <th>현장 담당자</th>
                        <th>연락처</th>
                        <th>관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerSites.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>등록된 현장이 없습니다.</td>
                        </tr>
                      ) : (
                        customerSites.map(cs => (
                          <tr key={cs.id}>
                            <td><strong>{cs.name}</strong></td>
                            <td style={{ fontSize: '13px' }}>{cs.address}</td>
                            <td>{cs.contactName || '-'}</td>
                            <td>{cs.contact || '-'}</td>
                            <td>
                              {canSave && (
                                <button className="btn-secondary" onClick={() => handleOpenEditSite(cs)} style={{ padding: '4px 8px', fontSize: '11px' }}>수정</button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
              왼쪽 목록에서 고객사를 선택하거나 새 고객을 등록해 주세요.
            </div>
          )}
        </div>

      </div>

      {/* 고객 모달 */}
      {showCustModal && editingCust && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleSaveCustSubmit} className="card" style={{ width: '100%', maxWidth: '500px', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>{editingCust.id ? '고객사 정보 수정' : '신규 고객사 등록'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label>고객사명 *</label>
                <input
                  type="text"
                  value={editingCust.name || ''}
                  onChange={e => setEditingCust({ ...editingCust, name: e.target.value })}
                  placeholder="예: (주)한라건설"
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>사업자등록번호</label>
                  <input
                    type="text"
                    value={editingCust.bizRegNo || ''}
                    onChange={e => setEditingCust({ ...editingCust, bizRegNo: e.target.value })}
                    placeholder="000-00-00000"
                  />
                </div>
                <div>
                  <label>폐업 여부</label>
                  <select
                    value={editingCust.isClosed ? 'true' : 'false'}
                    onChange={e => setEditingCust({ ...editingCust, isClosed: e.target.value === 'true' })}
                  >
                    <option value="false">운영중</option>
                    <option value="true">폐업</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>대표자명</label>
                  <input
                    type="text"
                    value={editingCust.representative || ''}
                    onChange={e => setEditingCust({ ...editingCust, representative: e.target.value })}
                    placeholder="홍길동"
                  />
                </div>
                <div>
                  <label>대표 연락처</label>
                  <input
                    type="text"
                    value={editingCust.repContact || ''}
                    onChange={e => setEditingCust({ ...editingCust, repContact: e.target.value })}
                    placeholder="02-000-0000"
                  />
                </div>
              </div>
              <div>
                <label>대표 이메일</label>
                <input
                  type="email"
                  value={editingCust.repEmail || ''}
                  onChange={e => setEditingCust({ ...editingCust, repEmail: e.target.value })}
                  placeholder="contact@company.com"
                />
              </div>
              <div>
                <label>본사 주소</label>
                <textarea
                  value={editingCust.address || ''}
                  onChange={e => setEditingCust({ ...editingCust, address: e.target.value })}
                  placeholder="도로명 주소"
                  rows={2}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowCustModal(false)}>취소</button>
              <button type="submit" className="btn-primary">저장</button>
            </div>
          </form>
        </div>
      )}

      {/* 담당자 모달 */}
      {showContactModal && editingContact && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleSaveContactSubmit} className="card" style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>{editingContact.id ? '담당자 수정' : '신규 담당자 등록'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label>담당자명 *</label>
                <input
                  type="text"
                  value={editingContact.name || ''}
                  onChange={e => setEditingContact({ ...editingContact, name: e.target.value })}
                  placeholder="이름"
                  required
                />
              </div>
              <div>
                <label>직급</label>
                <input
                  type="text"
                  value={editingContact.position || ''}
                  onChange={e => setEditingContact({ ...editingContact, position: e.target.value })}
                  placeholder="예: 대리, 현장소장"
                />
              </div>
              <div>
                <label>연락처 *</label>
                <input
                  type="text"
                  value={editingContact.contact || ''}
                  onChange={e => setEditingContact({ ...editingContact, contact: e.target.value })}
                  placeholder="휴대폰 또는 일반번호"
                  required
                />
              </div>
              <div>
                <label>이메일</label>
                <input
                  type="email"
                  value={editingContact.email || ''}
                  onChange={e => setEditingContact({ ...editingContact, email: e.target.value })}
                  placeholder="email@company.com"
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowContactModal(false)}>취소</button>
              <button type="submit" className="btn-primary">저장</button>
            </div>
          </form>
        </div>
      )}

      {/* 현장 모달 */}
      {showSiteModal && editingSite && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleSaveSiteSubmit} className="card" style={{ width: '100%', maxWidth: '450px', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>{editingSite.id ? '현장 수정' : '신규 현장 등록'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label>현장명 *</label>
                <input
                  type="text"
                  value={editingSite.name || ''}
                  onChange={e => setEditingSite({ ...editingSite, name: e.target.value })}
                  placeholder="예: 여의도동 현대 아파트 현장"
                  required
                />
              </div>
              <div>
                <label>현장 주소 *</label>
                <input
                  type="text"
                  value={editingSite.address || ''}
                  onChange={e => setEditingSite({ ...editingSite, address: e.target.value })}
                  placeholder="현장 자재 보관소 및 납품 주소"
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>현장 담당자명</label>
                  <input
                    type="text"
                    value={editingSite.contactName || ''}
                    onChange={e => setEditingSite({ ...editingSite, contactName: e.target.value })}
                    placeholder="이름"
                  />
                </div>
                <div>
                  <label>연락처</label>
                  <input
                    type="text"
                    value={editingSite.contact || ''}
                    onChange={e => setEditingSite({ ...editingSite, contact: e.target.value })}
                    placeholder="전화번호"
                  />
                </div>
              </div>
              <div>
                <label>이메일</label>
                <input
                  type="email"
                  value={editingSite.email || ''}
                  onChange={e => setEditingSite({ ...editingSite, email: e.target.value })}
                  placeholder="현장 메일 주소"
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowSiteModal(false)}>취소</button>
              <button type="submit" className="btn-primary">저장</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
