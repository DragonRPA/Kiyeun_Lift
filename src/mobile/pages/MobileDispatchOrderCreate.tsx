// src/mobile/pages/MobileDispatchOrderCreate.tsx
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Building2, MapPin, Phone, Calendar, Clock, Plus, Minus, 
  Send, AlertTriangle, CheckCircle2, ChevronRight, ArrowLeft 
} from 'lucide-react';
import { matchHangul } from '../../utils/hangulSearch';

interface MobileDispatchOrderCreateProps {
  onBack: () => void;
  onSuccess: () => void;
}

interface EquipmentOrderItem {
  ft: string;
  modelName: string;
  count: number;
}

const SPEC_OPTIONS = [
  { ft: '19ft', defaultModel: '1930' },
  { ft: '26ft', defaultModel: '2632' },
  { ft: '32ft', defaultModel: '3246' },
  { ft: '40ft', defaultModel: '4047' },
  { ft: '46ft', defaultModel: '1412' },
  { ft: '53ft', defaultModel: '1612' },
];

export const MobileDispatchOrderCreate: React.FC<MobileDispatchOrderCreateProps> = ({ onBack, onSuccess }) => {
  const { customers, sites, currentUser, saveSmartDispatch } = useApp();

  // 폼 상태
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [siteContactName, setSiteContactName] = useState('');
  const [siteContactPhone, setSiteContactPhone] = useState('');
  
  // 납품 일시 (기본값: 내일 08:00)
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  const [deliveryDate, setDeliveryDate] = useState(tomorrow);
  const [deliveryTime, setDeliveryTime] = useState('08:00');

  // 요구 장비 목록 (최초 19ft 1대 기본)
  const [orders, setOrders] = useState<EquipmentOrderItem[]>([
    { ft: '19ft', modelName: '1930', count: 1 }
  ]);

  const [memo, setMemo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const [customerSearchText, setCustomerSearchText] = useState('');
  const [siteSearchText, setSiteSearchText] = useState('');

  // 선택된 고객사의 등록 현장 목록
  const customerSites = useMemo(() => {
    if (!selectedCustomerId) return [];
    return sites.filter(s => s.customerId === selectedCustomerId);
  }, [sites, selectedCustomerId]);

  const filteredCustomersList = useMemo(() => {
    return customers
      .filter(c => c.transactionStatus !== 'BLOCKED')
      .filter(c => !customerSearchText.trim() || matchHangul(c.name, customerSearchText) || matchHangul(c.representative, customerSearchText));
  }, [customers, customerSearchText]);

  const filteredCustomerSites = useMemo(() => {
    return customerSites.filter(s => !siteSearchText.trim() || matchHangul(s.name, siteSearchText) || matchHangul(s.address, siteSearchText));
  }, [customerSites, siteSearchText]);

  // 고객사 변경 핸들러
  const handleCustomerChange = (custId: string) => {
    setSelectedCustomerId(custId);
    setSelectedSiteId('');
    setSiteAddress('');
    setSiteContactName('');
    setSiteContactPhone('');
  };

  // 현장 변경 핸들러
  const handleSiteChange = (siteId: string) => {
    setSelectedSiteId(siteId);
    if (siteId === 'NEW') {
      setSiteAddress('');
      setSiteContactName('');
      setSiteContactPhone('');
      return;
    }
    const found = sites.find(s => s.id === siteId);
    if (found) {
      setSiteAddress(found.address || '');
      setSiteContactName(found.contactName || '');
      setSiteContactPhone(found.contact || '');
    }
  };

  // 규격 수량 변경
  const handleCountChange = (index: number, delta: number) => {
    setOrders(prev => {
      const next = [...prev];
      const newCount = Math.max(1, next[index].count + delta);
      next[index].count = newCount;
      return next;
    });
  };

  // 규격 추가
  const handleAddSpec = (spec: typeof SPEC_OPTIONS[0]) => {
    setOrders(prev => {
      const existsIdx = prev.findIndex(o => o.ft === spec.ft);
      if (existsIdx >= 0) {
        const next = [...prev];
        next[existsIdx].count += 1;
        return next;
      }
      return [...prev, { ft: spec.ft, modelName: spec.defaultModel, count: 1 }];
    });
  };

  // 규격 삭제
  const handleRemoveOrder = (index: number) => {
    if (orders.length <= 1) return;
    setOrders(prev => prev.filter((_, i) => i !== index));
  };

  // 저장 및 출고의뢰 발송 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomerId) {
      showToast('고객사를 선택해주세요.', 'error');
      return;
    }

    const selectedCust = customers.find(c => c.id === selectedCustomerId);
    if (!selectedCust) return;

    if (selectedCust.transactionStatus === 'BLOCKED') {
      showToast('경영진 처분으로 인해 거래 정지(BLOCKED)된 거래처입니다.', 'error');
      return;
    }

    let finalSiteName = '';
    if (selectedSiteId === 'NEW') {
      if (!newSiteName.trim()) {
        showToast('신규 현장명을 입력해주세요.', 'error');
        return;
      }
      finalSiteName = newSiteName.trim();
    } else {
      const foundSite = sites.find(s => s.id === selectedSiteId);
      if (!foundSite) {
        showToast('납품 현장을 선택해주세요.', 'error');
        return;
      }
      finalSiteName = foundSite.name;
    }

    if (!siteAddress.trim()) {
      showToast('현장 상세 주소를 입력해주세요.', 'error');
      return;
    }

    if (!siteContactPhone.trim()) {
      showToast('현장 담당자 연락처를 입력해주세요.', 'error');
      return;
    }

    const totalEquipCount = orders.reduce((sum, o) => sum + o.count, 0);
    if (totalEquipCount === 0) {
      showToast('출고 장비를 1대 이상 추가해주세요.', 'error');
      return;
    }

    // 스마트 출고 데이터 조립 (헌장 2.1 영업 R&R: 자산번호 미지정, 규격/수량만 의뢰)
    const equipmentsList: any[] = [];
    orders.forEach(o => {
      for (let i = 0; i < o.count; i++) {
        equipmentsList.push({
          modelName: o.modelName || o.ft,
          spec: o.ft,
          monthlyRent: 0,
          dailyRent: 0,
        });
      }
    });

    const payload = {
      customerName: selectedCust.name,
      siteName: finalSiteName,
      siteAddress: siteAddress.trim(),
      salespersonName: currentUser?.name || '영업담당',
      salespersonPhone: currentUser?.phone || '',
      siteContactName: siteContactName.trim() || '현장소장',
      siteContactPhone: siteContactPhone.trim(),
      loadingTime: `${deliveryDate} ${deliveryTime}`,
      unloadingTime: `${deliveryDate} ${deliveryTime}`,
      equipments: equipmentsList,
      note: `[모바일 외근 출고의뢰] ${memo}`.trim(),
      rawText: `모바일 출고요청: ${selectedCust.name} / ${finalSiteName} (${totalEquipCount}대)`,
      paidOptions: {},
      protection: {},
      checkedSpecs: {},
      isSetAsCustomerDefault: false,
      applyToAllSites: false
    };

    setIsSubmitting(true);
    try {
      const res = await saveSmartDispatch(payload as any, true);
      if (res && res.success) {
        showToast('출고 의뢰가 정상 접수되었습니다.');
        setTimeout(() => {
          onSuccess();
        }, 1200);
      } else {
        showToast(res?.errorMessage || '출고 의뢰 접수에 실패했습니다.', 'error');
      }
    } catch (err: any) {
      showToast('저장 중 오류가 발생했습니다: ' + (err?.message || ''), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3.5 pb-24 p-4 font-sans text-slate-100">
      {/* 토스트 알림 */}
      {toastMessage && (
        <div 
          style={{
            position: 'fixed',
            top: '70px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            padding: '10px 18px',
            borderRadius: '12px',
            backgroundColor: toastMessage.type === 'success' ? '#065f46' : '#991b1b',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: '700',
            boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {toastMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* 헤더 바 */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>취소</span>
        </button>
        <h2 className="text-base font-bold text-white">모바일 출고 의뢰</h2>
        <div className="w-10" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* 1. 고객사 & 현장 선택 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
          <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            거래처 및 현장 정보
          </span>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-slate-400">거래처 (고객사) 선택 *</label>
              {customerSearchText && (
                <button
                  type="button"
                  onClick={() => setCustomerSearchText('')}
                  className="text-[10px] text-sky-400 font-bold"
                >
                  초기화
                </button>
              )}
            </div>
            <input
              type="text"
              value={customerSearchText}
              onChange={(e) => setCustomerSearchText(e.target.value)}
              placeholder="🔍 고객사명 / 초성 검색 (예: ㅅㅅ, ㅇㅈㅇ)"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-white placeholder-slate-500 mb-0.5"
            />
            <select
              value={selectedCustomerId}
              onChange={(e) => handleCustomerChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
              required
            >
              <option value="">
                {customerSearchText ? `검색 결과 (${filteredCustomersList.length}개사)` : '고객사를 선택하세요'}
              </option>
              {filteredCustomersList.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {selectedCustomerId && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-slate-400">납품 현장 선택 *</label>
                {siteSearchText && (
                  <button
                    type="button"
                    onClick={() => setSiteSearchText('')}
                    className="text-[10px] text-sky-400 font-bold"
                  >
                    초기화
                  </button>
                )}
              </div>
              {customerSites.length > 3 && (
                <input
                  type="text"
                  value={siteSearchText}
                  onChange={(e) => setSiteSearchText(e.target.value)}
                  placeholder="🔍 현장명 초성 검색 (예: ㅍㅌ)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-white placeholder-slate-500 mb-0.5"
                />
              )}
              <select
                value={selectedSiteId}
                onChange={(e) => handleSiteChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                required
              >
                <option value="">현장을 선택하세요</option>
                {filteredCustomerSites.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.address || '주소미상'})</option>
                ))}
                <option value="NEW">+ [신규 현장 직접 입력]</option>
              </select>
            </div>
          )}

          {selectedSiteId === 'NEW' && (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-slate-400">신규 현장명 *</label>
              <input
                type="text"
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                placeholder="예: 판교 제2테크노밸리 오피스 신축"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                required
              />
            </div>
          )}

          {selectedSiteId && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-slate-400">현장 상세 주소 *</label>
                <input
                  type="text"
                  value={siteAddress}
                  onChange={(e) => setSiteAddress(e.target.value)}
                  placeholder="예: 경기 성남시 수정구 창업로 42"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-400">현장 담당자</label>
                  <input
                    type="text"
                    value={siteContactName}
                    onChange={(e) => setSiteContactName(e.target.value)}
                    placeholder="소장/반장명"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-400">현장 연락처 *</label>
                  <input
                    type="tel"
                    value={siteContactPhone}
                    onChange={(e) => setSiteContactPhone(e.target.value)}
                    placeholder="010-0000-0000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                    required
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* 2. 요구 장비 규격 및 수량 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            출고 요청 장비 규격 (영업 R&R: 규격 의뢰)
          </span>

          {/* 규격 퀵 추가 버튼들 */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {SPEC_OPTIONS.map(spec => (
              <button
                key={spec.ft}
                type="button"
                onClick={() => handleAddSpec(spec)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 hover:border-emerald-500 whitespace-nowrap active:scale-95 transition-all"
              >
                <Plus className="w-3 h-3 text-emerald-400" />
                <span>{spec.ft}</span>
              </button>
            ))}
          </div>

          {/* 선택된 규격 목록 */}
          <div className="flex flex-col gap-2 mt-1">
            {orders.map((item, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-sm font-black text-white">{item.ft}</span>
                  <span className="text-[11px] text-slate-400 ml-2">동급 모델 ({item.modelName})</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-slate-900 rounded-lg p-1 border border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleCountChange(idx, -1)}
                      className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-slate-300 active:scale-90"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold text-white">{item.count}</span>
                    <button
                      type="button"
                      onClick={() => handleCountChange(idx, 1)}
                      className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-slate-300 active:scale-90"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {orders.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOrder(idx)}
                      className="text-xs text-rose-400 hover:text-rose-300 ml-1"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. 납품 희망 일시 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
          <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            납품 희망 일시
          </span>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-slate-400">납품 희망일 *</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-slate-400">도착 희망시간 *</label>
              <input
                type="time"
                value={deliveryTime}
                onChange={(e) => setDeliveryTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                required
              />
            </div>
          </div>
        </div>

        {/* 4. 현장 특이사항 및 메모 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2">
          <label className="text-[11px] text-slate-400">현장 특이사항 / 배차 지시 메모</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="예: 지하2층 진입제한 2.1m, 안전모/안전화 필수 지참, 상차 전 완충 요망"
            rows={2}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white resize-none"
          />
        </div>

        {/* 제출 버튼 */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 active:scale-98 transition-all disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          <span>{isSubmitting ? '출고 의뢰 발송 중...' : '출고 의뢰 발송'}</span>
        </button>
      </form>
    </div>
  );
};
