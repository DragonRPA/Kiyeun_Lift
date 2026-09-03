// src/pages/SmartAsRequest.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Wrench, Send, AlertTriangle, CheckCircle2, Search, Building2, MapPin, Phone, User, Tag, HelpCircle } from 'lucide-react';

const QUICK_ISSUE_PRESETS = [
  '협착 방지봉 단선 및 파손',
  '과상승 감지봉 파손',
  '상승 / 하강 작동 불가',
  '배터리 충전 안됨 / 충전선 파손',
  '에러코드 발생 (LD / U038)',
  '유압 오일 누유 / 작동유 부족',
  '키박스 / 키스위치 불량',
  '현장 배관 / 파이프 장비 걸림',
  '정기 순회 점검 요청',
  '조종기 레버 센서 불량',
  '타이어 휠 파손',
  '경광등 / 후진 부저 불량'
];

export const SmartAsRequest: React.FC = () => {
  const { customers, sites, contracts, contractAssets, assets, createFieldAsTicket, currentUser, showErrorModal, setActiveTab } = useApp();

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedAssetNo, setSelectedAssetNo] = useState('');
  const [customAssetNo, setCustomAssetNo] = useState('');
  const [locationDetail, setLocationDetail] = useState('');
  const [reporterName, setReporterName] = useState(currentUser?.name || '');
  const [reporterContact, setReporterContact] = useState(currentUser?.phone || '');
  const [selectedCategory, setSelectedCategory] = useState('방지봉/협착');
  const [issueDescription, setIssueDescription] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccessTicket, setSubmitSuccessTicket] = useState<any | null>(null);

  // 선택된 고객사의 계약 현장 목록 필터링
  const availableSites = selectedCustomerId 
    ? sites.filter(s => s.customerId === selectedCustomerId)
    : sites;

  // 선택된 현장에서 대여중인 활성 계약 장비 목록 필터링
  const activeContractsForSite = contracts.filter(c => 
    c.status === 'ACTIVE' && 
    (!selectedCustomerId || c.customerId === selectedCustomerId) &&
    (!selectedSiteId || c.siteId === selectedSiteId)
  );

  const activeContractAssetIds = contractAssets
    .filter(ca => activeContractsForSite.some(c => c.id === ca.contractId) && ca.status !== 'RETURNED')
    .map(ca => ca.assetId);

  const siteRentedAssets = assets.filter(a => activeContractAssetIds.includes(a.id));

  const handlePresetClick = (preset: string) => {
    if (!issueDescription) {
      setIssueDescription(preset);
    } else if (!issueDescription.includes(preset)) {
      setIssueDescription(prev => `${prev}\n${preset}`);
    }

    if (preset.includes('방지봉') || preset.includes('감지봉')) setSelectedCategory('방지봉/협착');
    else if (preset.includes('상승') || preset.includes('하강')) setSelectedCategory('상하강불량');
    else if (preset.includes('충전') || preset.includes('배터리')) setSelectedCategory('충전/전원');
    else if (preset.includes('오일') || preset.includes('누유')) setSelectedCategory('오일누유');
    else if (preset.includes('키박스') || preset.includes('키스위치')) setSelectedCategory('키박스/스위치');
    else if (preset.includes('에러')) setSelectedCategory('에러코드');
    else if (preset.includes('점검')) setSelectedCategory('점검요청');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId && !selectedSiteId && !customAssetNo) {
      showErrorModal('고객사, 현장 또는 관리번호 중 최소 1개 이상을 입력해 주세요.');
      return;
    }
    if (!issueDescription.trim()) {
      showErrorModal('고장 증상 및 요청 내용을 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const customer = customers.find(c => c.id === selectedCustomerId);
      const site = sites.find(s => s.id === selectedSiteId);
      const finalAssetNo = selectedAssetNo === 'CUSTOM' ? (customAssetNo || '현장확인') : (selectedAssetNo || customAssetNo || '현장확인');
      const matchedAsset = assets.find(a => a.assetNo === finalAssetNo);

      const ticket = await createFieldAsTicket({
        source: 'SALES_REQUEST',
        customerId: customer?.id || '',
        customerName: customer?.name || (site?.name ? `${site.name} 협력사` : '영업 의뢰 고객사'),
        siteId: site?.id || '',
        siteName: site?.name || '현장 지정 요청',
        assetId: matchedAsset?.id || '',
        assetNo: finalAssetNo,
        locationDetail: locationDetail.trim(),
        reporterName: reporterName.trim(),
        reporterContact: reporterContact.trim(),
        issueCategory: selectedCategory,
        issueDescription: issueDescription.trim(),
        errorCode: errorCode.trim(),
        priority,
        status: 'REQUESTED',
        billableType: 'FREE',
        billableAmount: 0
      });

      setSubmitSuccessTicket(ticket);
    } catch (err: any) {
      // showErrorModal handled in context
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedCustomerId('');
    setSelectedSiteId('');
    setSelectedAssetNo('');
    setCustomAssetNo('');
    setLocationDetail('');
    setIssueDescription('');
    setErrorCode('');
    setPriority('NORMAL');
    setSubmitSuccessTicket(null);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* 타이틀 및 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wrench size={24} color="#3b82f6" />
            현장 AS 의뢰 접수
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            영업사원 및 고객 유선 접수 건을 AS팀으로 신속하게 의뢰 전달합니다.
          </p>
        </div>
        <button
          onClick={() => setActiveTab('field_as')}
          style={{
            padding: '8px 14px',
            backgroundColor: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#475569',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          AS 현황 대장 이동 ➔
        </button>
      </div>

      {submitSuccessTicket ? (
        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
          <CheckCircle2 size={48} color="#16a34a" style={{ margin: '0 auto 16px auto' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#166534', margin: '0 0 8px 0' }}>
            AS 의뢰가 성공적으로 접수되었습니다!
          </h2>
          <p style={{ fontSize: '14px', color: '#15803d', margin: '0 0 20px 0' }}>
            접수번호: <strong>{submitSuccessTicket.ticketNo}</strong> (현장: {submitSuccessTicket.siteName} / 장비: {submitSuccessTicket.assetNo})
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <button
              onClick={handleReset}
              style={{
                padding: '10px 20px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer'
              }}
            >
              추가 AS 의뢰 작성
            </button>
            <button
              onClick={() => setActiveTab('field_as')}
              style={{
                padding: '10px 20px',
                backgroundColor: '#2563eb',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#ffffff',
                cursor: 'pointer'
              }}
            >
              AS 출동 스튜디오에서 확인
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 1. 현장 및 대상 장비 스코핑 카드 */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-main)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building2 size={18} color="var(--primary)" />
              1. 현장 및 대상 장비 선택
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              {/* 고객사 선택 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  고객사 (업체명)
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => {
                    setSelectedCustomerId(e.target.value);
                    setSelectedSiteId('');
                    setSelectedAssetNo('');
                  }}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '14px',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)'
                  }}
                >
                  <option value="">고객사 선택 (선택 안 함 가능)</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* 공사 현장 선택 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  공사 현장명 <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <select
                  value={selectedSiteId}
                  onChange={(e) => {
                    setSelectedSiteId(e.target.value);
                    setSelectedAssetNo('');
                  }}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '14px',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)'
                  }}
                >
                  <option value="">현장 선택</option>
                  {availableSites.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.address || '주소미등록'})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 관리번호 선택 (대여중 장비 드롭다운 + 직접/유연 입력) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  해당 현장 대여 장비 목록
                </label>
                <select
                  value={selectedAssetNo}
                  onChange={(e) => {
                    setSelectedAssetNo(e.target.value);
                    if (e.target.value !== 'CUSTOM') setCustomAssetNo('');
                  }}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '14px',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)'
                  }}
                >
                  <option value="">대여 장비 선택</option>
                  {siteRentedAssets.map(a => (
                    <option key={a.id} value={a.assetNo}>
                      {a.assetNo} ({a.modelName})
                    </option>
                  ))}
                  <option value="CUSTOM">직접 입력 (전체장비 / 미확인 / 다수 장비)</option>
                </select>
              </div>

              {/* 장비번호 직접입력 또는 위치 상세 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {selectedAssetNo === 'CUSTOM' || !selectedAssetNo ? '장비번호 직접입력 (예: G10032, 14002 외 3대, 전체장비)' : '장비 세부 위치 (층/구역/열)'}
                </label>
                {selectedAssetNo === 'CUSTOM' || !selectedAssetNo ? (
                  <input
                    type="text"
                    value={customAssetNo}
                    onChange={(e) => setCustomAssetNo(e.target.value)}
                    placeholder="예: G19190, 팹동 전체장비, 확인필요"
                    style={{
                      padding: '9px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      fontSize: '14px',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-main)'
                    }}
                  />
                ) : (
                  <input
                    type="text"
                    value={locationDetail}
                    onChange={(e) => setLocationDetail(e.target.value)}
                    placeholder="예: 팹동 8층 X27 Y17, 지원동 B2"
                    style={{
                      padding: '9px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      fontSize: '14px',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-main)'
                    }}
                  />
                )}
              </div>
            </div>

            {selectedAssetNo && selectedAssetNo !== 'CUSTOM' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  현장 장비 위치 상세 (선택)
                </label>
                <input
                  type="text"
                  value={locationDetail}
                  onChange={(e) => setLocationDetail(e.target.value)}
                  placeholder="예: 팹동 8층 X27 Y17, 지원동 2공구 B2 몽골텐트옆"
                  style={{
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '14px',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>
            )}
          </div>

          {/* 2. 고장 증상 및 요청 내용 입력 카드 */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-main)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Tag size={18} color="var(--primary)" />
              2. 고장 증상 및 요청 내용
            </h3>

            {/* 다빈도 고장 1-Click 프리셋 태그 버튼군 */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                ⚡ 자주 접수되는 고장 증상 (클릭 시 자동 입력)
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {QUICK_ISSUE_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePresetClick(preset)}
                    style={{
                      padding: '6px 10px',
                      backgroundColor: 'var(--bg-app)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '16px',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  고장 분류
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '14px',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)'
                  }}
                >
                  <option value="방지봉/협착">방지봉 / 협착 센서</option>
                  <option value="상하강불량">상승 / 하강 작동 불량</option>
                  <option value="충전/전원">충전 불량 / 충전선 단선</option>
                  <option value="오일누유">유압 오일 누유</option>
                  <option value="키박스/스위치">키박스 / 키스위치 불량</option>
                  <option value="에러코드">에러코드 점등 (LD / U038)</option>
                  <option value="파이프걸림">현장 배관/파이프 걸림</option>
                  <option value="점검요청">정기 순회 점검</option>
                  <option value="기타">기타 고장</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  계기판 표시 에러코드 (선택)
                </label>
                <input
                  type="text"
                  value={errorCode}
                  onChange={(e) => setErrorCode(e.target.value)}
                  placeholder="예: LD, U038, CH02, 02 등"
                  style={{
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '14px',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                상세 증상 및 전달 사항 <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <textarea
                rows={4}
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                placeholder="현장에서 전달받은 구체적인 고장 내용과 방문 시 주의사항을 적어주세요. (예: 도착 전 소장님께 전화 요망, 안전모 지참 필수 등)"
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  fontSize: '14px',
                  resize: 'vertical',
                  lineHeight: '1.5',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)'
                }}
              />
            </div>
          </div>

          {/* 3. 접수자 정보 및 긴급도 */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-main)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={18} color="var(--primary)" />
              3. 접수자 연락처 및 우선순위
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  현장 접수자 성명
                </label>
                <input
                  type="text"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  placeholder="예: 김소장, 이민우 대리"
                  style={{
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '14px',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  접수자 연락처
                </label>
                <input
                  type="text"
                  value={reporterContact}
                  onChange={(e) => setReporterContact(e.target.value)}
                  placeholder="예: 010-1234-5678"
                  style={{
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '14px',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  출동 긴급도
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: priority === 'URGENT' ? '2px solid var(--danger)' : '1px solid var(--border-color)',
                    fontSize: '14px',
                    backgroundColor: priority === 'URGENT' ? 'var(--danger-light)' : 'var(--bg-card)',
                    fontWeight: priority === 'URGENT' ? 700 : 400,
                    color: priority === 'URGENT' ? 'var(--danger)' : 'var(--text-main)'
                  }}
                >
                  <option value="NORMAL">보통 (일반 순회/익일 일정)</option>
                  <option value="URGENT">🚨 긴급 (당일 현장 작업 중단)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 하단 최종 발행 버튼 (우하단 배치 - 헌장 3.5 Gutenberg Z-Pattern) */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={handleReset}
              style={{
                padding: '12px 20px',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              초기화
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 28px',
                backgroundColor: priority === 'URGENT' ? 'var(--danger)' : 'var(--primary)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--text-on-primary)',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            >
              <Send size={18} />
              {isSubmitting ? '의뢰 전송 중...' : 'AS 의뢰 전송'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
