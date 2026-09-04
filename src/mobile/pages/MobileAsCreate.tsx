// src/mobile/pages/MobileAsCreate.tsx
import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { CameraUploader } from '../components/CameraUploader';
import { 
  ArrowLeft, Check, Plus, AlertTriangle, Mic, MicOff, 
  FileText, RotateCcw, Sparkles, X, CheckCircle2 
} from 'lucide-react';
import { parseAsCallTranscript } from '../../services/voiceOrderDraftService';

interface MobileAsCreateProps {
  onBack: () => void;
  onCreated: (ticketId: string) => void;
}

const CATEGORIES = [
  '방지봉/협착',
  '상하강불량',
  '충전/전원',
  '오일누유',
  '키박스/스위치',
  '에러코드',
  '파이프걸림',
  '점검요청',
  '기타',
];

export const MobileAsCreate: React.FC<MobileAsCreateProps> = ({ onBack, onCreated }) => {
  const { createFieldAsTicket, showErrorModal, customers, sites, assets } = useApp();

  const [customerName, setCustomerName] = useState('');
  const [siteName, setSiteName] = useState('');
  const [assetNo, setAssetNo] = useState('');
  const [locationDetail, setLocationDetail] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterContact, setReporterContact] = useState('');
  const [issueCategory, setIssueCategory] = useState('상하강불량');
  const [issueDescription, setIssueDescription] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 음성 및 통화 텍스트 파싱 상태
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedTranscript, setPastedTranscript] = useState('');
  const [recentModifiedFields, setRecentModifiedFields] = useState<string[]>([]);
  const recognitionRef = useRef<any>(null);

  // 통화 텍스트 파싱 및 폼 자동 반영 공통 함수
  const applyTranscript = (text: string) => {
    if (!text.trim()) return;
    const result = parseAsCallTranscript(text, customers || [], sites || [], assets || []);

    if (result.customerName) setCustomerName(result.customerName);
    if (result.siteName) setSiteName(result.siteName);
    if (result.assetNo) setAssetNo(result.assetNo);
    if (result.locationDetail) setLocationDetail(result.locationDetail);
    if (result.reporterName) setReporterName(result.reporterName);
    if (result.reporterContact) setReporterContact(result.reporterContact);
    if (result.issueCategory && CATEGORIES.includes(result.issueCategory)) {
      setIssueCategory(result.issueCategory);
    }
    if (result.issueDescription) setIssueDescription(result.issueDescription);
    if (result.priority) setPriority(result.priority);

    setRecentModifiedFields(result.modifiedFields);
  };

  // Web Speech API 음성 인식 제어
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showErrorModal('이 브라우저는 음성 인식을 지원하지 않습니다. 크롬 또는 최신 모바일 브라우저를 이용하세요.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ko-KR';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        setInterimText('음성 듣는 중... (말씀해 주세요)');
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let finalChunk = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalChunk += transcript;
          } else {
            currentInterim += transcript;
          }
        }

        if (finalChunk.trim()) {
          applyTranscript(finalChunk.trim());
          setInterimText('');
        } else if (currentInterim.trim()) {
          setInterimText(currentInterim);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setInterimText('');
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimText('');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      showErrorModal('음성 인식 시작 실패: ' + err.message);
      setIsListening(false);
    }
  };

  const handlePasteSubmit = () => {
    if (!pastedTranscript.trim()) return;
    applyTranscript(pastedTranscript);
    setShowPasteModal(false);
    setPastedTranscript('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !assetNo.trim()) {
      showErrorModal('고객사명과 장비번호는 필수 입력 항목입니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      const ticket = await createFieldAsTicket({
        customerName,
        siteName,
        assetNo: assetNo.toUpperCase(),
        locationDetail,
        reporterName,
        reporterContact,
        issueCategory,
        issueDescription,
        priority,
        faultImageUrl: images[0] || '',
        evidenceImages: images,
      });

      alert('AS 접수가 등록되었습니다.');
      onCreated(ticket.id);
    } catch (err: any) {
      showErrorModal('접수 등록 실패: ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-28 p-4 bg-slate-950 min-h-screen">
      {/* 상단 헤더 */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-300 py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-4 h-4" />
          뒤로가기
        </button>
        <span className="text-sm font-black text-white">현장 AS 접수</span>
      </div>

      {/* 🎙️ 음성 & 통화 텍스트 입력 바 */}
      <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border border-blue-800/40 flex flex-col gap-2 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-blue-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              통화 음성/텍스트 자동 입력
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowPasteModal(true)}
              className="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 border border-slate-700 active:scale-95"
            >
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              통화 텍스트
            </button>
            <button
              type="button"
              onClick={toggleListening}
              className={`py-1 px-3 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
                isListening
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-3.5 h-3.5" />
                  듣는중...
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  음성 접수
                </>
              )}
            </button>
          </div>
        </div>

        {/* 실시간 음성 수신 미리보기 */}
        {isListening && interimText && (
          <div className="p-2 rounded-xl bg-rose-950/30 border border-rose-800/40 text-rose-200 text-xs font-medium">
            🎙️ {interimText}
          </div>
        )}

        {/* 최근 인식/추출된 필드 태그 */}
        {recentModifiedFields.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-800/80">
            {recentModifiedFields.map((field, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-bold flex items-center gap-1"
              >
                <Check className="w-3 h-3 text-blue-400" />
                {field}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* AS 접수 폼 */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* 장비번호 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-300">
            장비번호 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={assetNo}
            onChange={(e) => setAssetNo(e.target.value)}
            placeholder="예: 102, G19-01, 1001"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono uppercase focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 고객사명 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-300">
            고객사명 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="고객사 상호명 입력"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 현장명 / 상세 위치 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300">현장명</label>
            <input
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="현장 이름 또는 주소"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300">상세 위치</label>
            <input
              type="text"
              value={locationDetail}
              onChange={(e) => setLocationDetail(e.target.value)}
              placeholder="예: 지하 1층, 하역장"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* 고장 분류 */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300">고장 분류</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">우선순위:</span>
              <button
                type="button"
                onClick={() => setPriority(priority === 'NORMAL' ? 'URGENT' : 'NORMAL')}
                className={`px-2 py-0.5 rounded text-[11px] font-black border transition-colors ${
                  priority === 'URGENT'
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {priority === 'URGENT' ? '🚨 긴급(URGENT)' : '일반'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setIssueCategory(cat)}
                className={`py-2 px-1 rounded-xl text-xs font-bold transition-all ${
                  issueCategory === cat
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 고장 상세 증상 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-300">고장 상세 내용</label>
          <textarea
            rows={3}
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            placeholder="현장 작업자의 구체적 고장 호소 내용..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 접수자 성함 및 연락처 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300">접수자 성함</label>
            <input
              type="text"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              placeholder="예: 김반장, 이소장"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300">연락처</label>
            <input
              type="tel"
              value={reporterContact}
              onChange={(e) => setReporterContact(e.target.value)}
              placeholder="010-0000-0000"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white"
            />
          </div>
        </div>

        {/* 고장 현장 사진 첨부 */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <CameraUploader
            label="고장 현장 사진 촬영"
            images={images}
            onChange={setImages}
            maxImages={4}
          />
        </div>

        {/* 접수 등록 버튼 */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-base shadow-xl active:scale-98 transition-all"
        >
          {isSubmitting ? '접수 등록 중...' : '현장 AS 접수 등록'}
        </button>
      </form>

      {/* 📋 통화 텍스트 붙여넣기 모달 */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                고객 통화 녹음 텍스트 입력
              </h3>
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              rows={5}
              value={pastedTranscript}
              onChange={(e) => setPastedTranscript(e.target.value)}
              placeholder="갤럭시 통화 요약 텍스트 또는 통화 내용을 붙여넣으세요...\n예: 102호기 상승이 안되고 삐소리 남, 내일 오전 김반장 010-1234-5678 판교 현장 급해요"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-sans leading-relaxed"
            />

            {/* 빠른 테스트용 예시 버튼 */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-slate-400">빠른 테스트 예시:</span>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setPastedTranscript('102호기 상승이 안되고 삐소리 남, 김반장 010-1234-5678 지하 1층 급해요')}
                  className="text-left py-1.5 px-2.5 rounded-lg bg-slate-800 text-[11px] text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  "102호기 상승이 안되고 삐소리 남, 김반장 010-1234-5678 지하 1층 급해요"
                </button>
                <button
                  type="button"
                  onClick={() => setPastedTranscript('205호 배터리 방전 시동 안걸림 하역장 이소장 010-9876-5432 점검요청')}
                  className="text-left py-1.5 px-2.5 rounded-lg bg-slate-800 text-[11px] text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  "205호 배터리 방전 시동 안걸림 하역장 이소장 010-9876-5432 점검요청"
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handlePasteSubmit}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-lg"
              >
                파싱 및 자동 반영
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
