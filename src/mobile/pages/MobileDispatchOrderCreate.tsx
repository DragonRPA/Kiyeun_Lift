// src/mobile/pages/MobileDispatchOrderCreate.tsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Building2, MapPin, Phone, Calendar, Clock, Plus, Minus, 
  Send, AlertTriangle, CheckCircle2, ChevronRight, ArrowLeft, Bot,
  Mic, MicOff, RotateCcw, FileText, Check, Sparkles, ClipboardList
} from 'lucide-react';
import { matchHangul } from '../../utils/hangulSearch';
import { 
  loadVoiceOrderDraft, 
  saveVoiceOrderDraft, 
  clearVoiceOrderDraft, 
  mergeVoiceFragmentToDraft, 
  VoiceOrderDraft, 
  EquipmentOrderItem 
} from '../../services/voiceOrderDraftService';

interface MobileDispatchOrderCreateProps {
  onBack: () => void;
  onSuccess: () => void;
  onOpenGems?: () => void;
}

const SPEC_OPTIONS = [
  { ft: '19ft', defaultModel: '1930' },
  { ft: '26ft', defaultModel: '2632' },
  { ft: '32ft', defaultModel: '3246' },
  { ft: '40ft', defaultModel: '4047' },
  { ft: '46ft', defaultModel: '1412' },
  { ft: '53ft', defaultModel: '1612' },
];

export const MobileDispatchOrderCreate: React.FC<MobileDispatchOrderCreateProps> = ({ onBack, onSuccess, onOpenGems }) => {
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

  // 음성 조각 입력 및 임시저장 상태
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [recentModifiedFields, setRecentModifiedFields] = useState<string[]>([]);
  const [snippetsHistory, setSnippetsHistory] = useState<{ text: string; timestamp: string }[]>([]);
  const [createdResult, setCreatedResult] = useState<{ contractNo: string; siteName: string; totalCount: number } | null>(null);
  const recognitionRef = useRef<any>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const [customerSearchText, setCustomerSearchText] = useState('');
  const [siteSearchText, setSiteSearchText] = useState('');

  // 1. 마운트 시 이전 임시저장 의뢰서 복원 (이어하기 지원)
  useEffect(() => {
    const saved = loadVoiceOrderDraft();
    if (saved) {
      if (saved.customerId) setSelectedCustomerId(saved.customerId);
      if (saved.siteId) setSelectedSiteId(saved.siteId);
      if (saved.newSiteName) setNewSiteName(saved.newSiteName);
      if (saved.siteAddress) setSiteAddress(saved.siteAddress);
      if (saved.siteContactName) setSiteContactName(saved.siteContactName);
      if (saved.siteContactPhone) setSiteContactPhone(saved.siteContactPhone);
      if (saved.deliveryDate) setDeliveryDate(saved.deliveryDate);
      if (saved.deliveryTime) setDeliveryTime(saved.deliveryTime);
      if (saved.orders && saved.orders.length > 0) setOrders(saved.orders);
      if (saved.memo) setMemo(saved.memo);
      if (saved.snippets && saved.snippets.length > 0) setSnippetsHistory(saved.snippets);
      setHasRestoredDraft(true);
    }
  }, []);

  // 2. 값 변경 시 로컬스토리지 자동 임시저장
  useEffect(() => {
    if (selectedCustomerId || siteAddress || siteContactPhone || memo || orders.length > 1 || orders[0]?.count > 1 || snippetsHistory.length > 0) {
      const cust = customers.find(c => c.id === selectedCustomerId);
      const site = sites.find(s => s.id === selectedSiteId);
      const draft: VoiceOrderDraft = {
        customerId: selectedCustomerId,
        customerName: cust?.name || '',
        siteId: selectedSiteId,
        siteName: site?.name || newSiteName,
        newSiteName,
        siteAddress,
        siteContactName,
        siteContactPhone,
        deliveryDate,
        deliveryTime,
        orders,
        memo,
        snippets: snippetsHistory,
        updatedAt: new Date().toISOString()
      };
      saveVoiceOrderDraft(draft);
      setHasRestoredDraft(true);
    }
  }, [selectedCustomerId, selectedSiteId, newSiteName, siteAddress, siteContactName, siteContactPhone, deliveryDate, deliveryTime, orders, memo, snippetsHistory, customers, sites]);

  // 임시저장 초기화 핸들러
  const handleResetDraft = () => {
    if (!window.confirm('작성 중인 임시저장 내용을 모두 초기화하시겠습니까?')) return;
    clearVoiceOrderDraft();
    setSelectedCustomerId('');
    setSelectedSiteId('');
    setNewSiteName('');
    setSiteAddress('');
    setSiteContactName('');
    setSiteContactPhone('');
    setDeliveryDate(tomorrow);
    setDeliveryTime('08:00');
    setOrders([{ ft: '19ft', modelName: '1930', count: 1 }]);
    setMemo('');
    setSnippetsHistory([]);
    setRecentModifiedFields([]);
    setHasRestoredDraft(false);
    showToast('임시저장이 초기화되었습니다.');
  };

  // 음성 조각 증분 병합 처리 함수
  const processSpokenFragment = (text: string) => {
    const cust = customers.find(c => c.id === selectedCustomerId);
    const site = sites.find(s => s.id === selectedSiteId);
    const currentDraft: VoiceOrderDraft = {
      customerId: selectedCustomerId,
      customerName: cust?.name || '',
      siteId: selectedSiteId,
      siteName: site?.name || newSiteName,
      newSiteName,
      siteAddress,
      siteContactName,
      siteContactPhone,
      deliveryDate,
      deliveryTime,
      orders,
      memo,
      snippets: snippetsHistory,
      updatedAt: new Date().toISOString()
    };

    const { updatedDraft, modifiedFields } = mergeVoiceFragmentToDraft(
      currentDraft,
      text,
      customers,
      sites
    );

    if (updatedDraft.customerId) setSelectedCustomerId(updatedDraft.customerId);
    if (updatedDraft.siteId) setSelectedSiteId(updatedDraft.siteId);
    if (updatedDraft.newSiteName) setNewSiteName(updatedDraft.newSiteName);
    if (updatedDraft.siteAddress) setSiteAddress(updatedDraft.siteAddress);
    if (updatedDraft.siteContactName) setSiteContactName(updatedDraft.siteContactName);
    if (updatedDraft.siteContactPhone) setSiteContactPhone(updatedDraft.siteContactPhone);
    if (updatedDraft.deliveryDate) setDeliveryDate(updatedDraft.deliveryDate);
    if (updatedDraft.deliveryTime) setDeliveryTime(updatedDraft.deliveryTime);
    if (updatedDraft.orders && updatedDraft.orders.length > 0) setOrders(updatedDraft.orders);
    if (updatedDraft.memo) setMemo(updatedDraft.memo);
    if (updatedDraft.snippets) setSnippetsHistory(updatedDraft.snippets);

    setRecentModifiedFields(modifiedFields);
    setHasRestoredDraft(true);

    if (modifiedFields.length > 0) {
      showToast(`음성 반영: ${modifiedFields.join(' | ')}`);
    } else {
      showToast('음성을 인식했습니다.');
    }
  };

  // 음성인식 토글 핸들러
  const handleToggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('이 브라우저는 음성인식을 지원하지 않습니다.', 'error');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsListening(false);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.lang = 'ko-KR';
      rec.continuous = false;
      rec.interimResults = true;
      recognitionRef.current = rec;

      rec.onstart = () => {
        setIsListening(true);
        setInterimText('');
      };

      rec.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInterimText(transcript);
      };

      rec.onerror = (event: any) => {
        console.warn('SpeechRecognition error:', event.error);
        setIsListening(false);
        if (event.error !== 'no-speech') {
          showToast('음성 인식 오류: ' + event.error, 'error');
        }
      };

      rec.onend = () => {
        setIsListening(false);
        if (interimText.trim()) {
          processSpokenFragment(interimText.trim());
          setInterimText('');
        }
      };

      rec.start();
    } catch (err: any) {
      console.error('Failed to start SpeechRecognition:', err);
      setIsListening(false);
      showToast('마이크 시작 실패: ' + err.message, 'error');
    }
  };

  // 클립보드 통화 텍스트 읽어서 자동 완성 핸들러 (갤럭시 통화녹음 텍스트 연동)
  const handlePasteCallTranscript = async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        showToast('클립보드 읽기를 지원하지 않는 브라우저입니다.', 'error');
        return;
      }
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        showToast('클립보드에 복사된 통화 텍스트가 없습니다.', 'error');
        return;
      }
      processSpokenFragment(text.trim());
      showToast('복사된 통화 텍스트를 파싱하여 반영했습니다.');
    } catch (err: any) {
      console.warn('Clipboard read error:', err);
      showToast('클립보드 읽기 권한이 필요합니다.', 'error');
    }
  };

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
        clearVoiceOrderDraft();
        setCreatedResult({
          contractNo: res.contractNo || '신규 계약 생성됨',
          siteName: finalSiteName,
          totalCount: totalEquipCount
        });
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

      {/* 완료 모달 */}
      {createdResult && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            backgroundColor: 'rgba(2, 6, 23, 0.9)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div className="w-full max-w-sm bg-slate-900 border border-emerald-500/40 rounded-2xl p-5 flex flex-col gap-4 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 mx-auto">
              <Check className="w-6 h-6" />
            </div>

            <div className="text-center">
              <div className="text-base font-bold text-white">출고 의뢰 접수 완료</div>
              <div className="text-xs text-slate-400 mt-1">임대차 계약서 및 출고 배차가 자동 생성되었습니다.</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">발급 계약번호</span>
                <span className="font-mono font-bold text-emerald-400">{createdResult.contractNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">납품 현장</span>
                <span className="font-bold text-white">{createdResult.siteName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">출고 장비 수량</span>
                <span className="font-bold text-white">{createdResult.totalCount}대</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">배차 상태</span>
                <span className="text-amber-400 font-bold">출고대기 (REQUESTED)</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-800/40 p-2.5 rounded-lg border border-slate-800">
              배차 관리 대장에서 기사를 배정하고, 출고 검수 대장에서 장비 번호를 매핑할 수 있습니다.
            </div>

            <button
              type="button"
              onClick={onSuccess}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all"
            >
              확인 및 계약 목록 이동
            </button>
          </div>
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

      {/* 🎙️ 음성 조각 입력 및 임시저장 패널 */}
      <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-bold text-slate-200">음성 조각 입력 (임시저장 및 이어하기)</span>
          </div>
          {hasRestoredDraft && (
            <button
              type="button"
              onClick={handleResetDraft}
              className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 active:scale-95"
            >
              <RotateCcw className="w-3 h-3" />
              <span>초기화</span>
            </button>
          )}
        </div>

        {/* 큰 터치 녹음 버튼 */}
        <button
          type="button"
          onClick={handleToggleListening}
          className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition-all active:scale-[0.98] ${
            isListening
              ? 'bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-900/50'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/30'
          }`}
        >
          {isListening ? (
            <>
              <MicOff className="w-4 h-4" />
              <span>듣는 중... (터치 시 완료)</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              <span>터치하여 말하기 (단문/조각 이어하기 가능)</span>
            </>
          )}
        </button>

        {/* 클립보드 통화 녹음 텍스트 붙여넣기 버튼 (갤럭시 AI 통화 텍스트 연동) */}
        <button
          type="button"
          onClick={handlePasteCallTranscript}
          className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
        >
          <ClipboardList className="w-3.5 h-3.5 text-sky-400" />
          <span>통화 텍스트 붙여넣기 (갤럭시 통화녹음 복사본)</span>
        </button>

        {/* 실시간 말풍선 */}
        {(isListening || interimText) && (
          <div className="bg-slate-950 border border-blue-500/40 rounded-xl p-2.5 text-xs text-blue-200 animate-in fade-in duration-150">
            <div className="text-[10px] text-slate-400 mb-0.5">실시간 음성 전사:</div>
            <div className="font-mono">{interimText || '말씀하시면 텍스트가 표시됩니다...'}</div>
          </div>
        )}

        {/* 최근 반영된 항목 뱃지 */}
        {recentModifiedFields.length > 0 && (
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-lg px-2.5 py-1.5 text-[11px] text-emerald-300 flex items-center gap-1.5 flex-wrap">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-bold">반영 항목:</span>
            {recentModifiedFields.map((f, i) => (
              <span key={i} className="bg-emerald-900/50 px-1.5 py-0.5 rounded text-[10px] text-emerald-200 font-mono">{f}</span>
            ))}
          </div>
        )}

        {/* 임시저장 상태 안내 */}
        {hasRestoredDraft && (
          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 px-0.5">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              임시저장 보존 중 (앱을 닫아도 유지됨)
            </span>
            <span>누적 발화: {snippetsHistory.length}회</span>
          </div>
        )}
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
