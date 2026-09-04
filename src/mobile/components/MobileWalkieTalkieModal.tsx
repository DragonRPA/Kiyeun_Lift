// src/mobile/components/MobileWalkieTalkieModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, Volume2, VolumeX, Mic, MicOff, Play, Square,
  X, Clock, Layers, MessageSquare, ListFilter, ArrowLeft, Bell, BellOff,
  FileText, ChevronRight
} from 'lucide-react';
import { 
  walkieService, WalkieTalkieChannel, WalkieReceiveMode, WalkieMessage, soundEngine, TalkingStatus, WalkieSttEngine 
} from '../../services/walkieTalkieService';
import { useApp } from '../../context/AppContext';
import { 
  loadVoiceOrderDraft, 
  saveVoiceOrderDraft, 
  mergeVoiceFragmentToDraft, 
  VoiceOrderDraft, 
  createEmptyDraft 
} from '../../services/voiceOrderDraftService';

interface MobileWalkieTalkieModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToDispatchOrder?: () => void;
}

const CHANNELS: { id: WalkieTalkieChannel; name: string; code: string; desc: string }[] = [
  { id: 'ALL', name: '전사공용', code: 'CH-01', desc: '전사 긴급 공지 및 공통 통신망' },
  { id: 'DISPATCH', name: '출고배차', code: 'CH-02', desc: '주기장 상차 및 배차 기사 통신망' },
  { id: 'AS', name: '현장AS', code: 'CH-03', desc: '외근 출동 및 긴급 정비 통신망' },
  { id: 'SALES', name: '영업', code: 'CH-04', desc: '외근 영업 재고 및 출고 소통망' },
];

export const MobileWalkieTalkieModal: React.FC<MobileWalkieTalkieModalProps> = ({
  isOpen,
  onClose,
  onNavigateToDispatchOrder
}) => {
  const { currentUser, customers, sites } = useApp();
  const [isMonologueOrderMode, setIsMonologueOrderMode] = useState<boolean>(false);
  const [currentOrderDraft, setCurrentOrderDraft] = useState<VoiceOrderDraft | null>(() => loadVoiceOrderDraft());

  const [activeTab, setActiveTab] = useState<'PTT' | 'LOGS'>('PTT');
  const [isPowerOn, setIsPowerOn] = useState<boolean>(() => walkieService.getIsPowerOn());
  const [currentChannel, setCurrentChannel] = useState<WalkieTalkieChannel>(() => walkieService.getCurrentChannel());
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [history, setHistory] = useState<WalkieMessage[]>(() => walkieService.getHistory());
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [recordDuration, setRecordDuration] = useState<number>(0);

  // 🛠️ 디버그 로그 표시 토글 (기본값: OFF — 필요 시 켤 수 있음)
  const [showDebugLogs, setShowDebugLogs] = useState<boolean>(() => localStorage.getItem('walkie_show_debug') === 'true');
  // 🎙️ STT 엔진 선택 ('GEMINI' | 'BROWSER')
  const [sttEngine, setSttEngine] = useState<WalkieSttEngine>(() => walkieService.getSttEngine());

  // 🌟 순차 재생 큐 대기 건수
  const [queueLength, setQueueLength] = useState<number>(() => walkieService.getQueueLength());

  // 🌟 실시간 발언자 인디케이터 ("누가 말하고 있습니다")
  const [talkingStatus, setTalkingStatus] = useState<TalkingStatus | null>(() => walkieService.getCurrentTalkingStatus());
  const [receiveMode, setReceiveMode] = useState<WalkieReceiveMode>(() => walkieService.getReceiveMode());
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [sttStatus, setSttStatus] = useState<'IDLE' | 'LISTENING' | 'ERROR' | 'UNSUPPORTED'>('IDLE');
  const [sttErrorDetail, setSttErrorDetail] = useState<string>('');

  // 🔒 PTT 비동기 트리거 레이스 컨디션 원천 방지용 Refs
  const isTransmittingRef = useRef<boolean>(false);
  const isStartingRef = useRef<boolean>(false);
  const stopRequestedRef = useRef<boolean>(false);
  const durationTimerRef = useRef<any>(null);

  // 📜 최신 대화 하단 자동 스크롤용 Refs
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const pttFeedContainerRef = useRef<HTMLDivElement | null>(null);

  // 초기화 및 실시간 메시지 / 발언 상태 / 큐 리스너 등록
  useEffect(() => {
    if (!currentUser) return;

    walkieService.subscribe({
      id: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
      deptName: currentUser.department || '기연리프트'
    });

    const unMsg = walkieService.onMessage(() => {
      setHistory([...walkieService.getHistory()]);
    });

    const unHist = walkieService.onHistoryChange((newHist) => {
      setHistory([...newHist]);
    });

    const unQueue = walkieService.onQueueChange((len) => {
      setQueueLength(len);
    });

    const unTalking = walkieService.onTalkingStatusChange((status) => {
      setTalkingStatus(status);
    });

    const unRecMode = walkieService.onReceiveModeChange((mode) => {
      setReceiveMode(mode);
    });

    const unLiveStt = walkieService.onLiveTranscript((txt, status, err) => {
      setLiveTranscript(txt);
      setSttStatus(status);
      if (err) setSttErrorDetail(err);
    });

    const unEngine = walkieService.onSttEngineChange((eng) => {
      setSttEngine(eng);
    });

    return () => {
      unMsg();
      unHist();
      unQueue();
      unTalking();
      unRecMode();
      unLiveStt();
      unEngine();
    };
  }, [currentUser]);

  // 디버그 토글 & STT 엔진 토글 핸들러
  const handleToggleDebug = () => {
    setShowDebugLogs(prev => {
      const next = !prev;
      localStorage.setItem('walkie_show_debug', String(next));
      return next;
    });
  };

  const handleToggleSttEngine = () => {
    const next: WalkieSttEngine = sttEngine === 'GROQ' ? 'CLOUDFLARE' : 'GROQ';
    walkieService.setSttEngine(next);
    setSttEngine(next);
  };

  // 🛠️ 디버그 메시지 필터링 (showDebugLogs가 false이면 디버그 로그 숨김)
  const displayHistory = history.filter(m => showDebugLogs || !m.isDebug);

  // 모달 오픈 시 오디오 컨텍스트 언락 & 닫힐 때 오디오 정지
  useEffect(() => {
    if (isOpen) {
      walkieService.unlockAudio();
      setHistory([...walkieService.getHistory()]);
    } else {
      walkieService.stopAudio();
      setPlayingMessageId(null);
    }
  }, [isOpen]);

  // 최신 대화(하단) 자동 스크롤
  useEffect(() => {
    if (activeTab === 'LOGS' && logContainerRef.current) {
      setTimeout(() => {
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [history, activeTab]);

  useEffect(() => {
    if (activeTab === 'PTT' && pttFeedContainerRef.current) {
      setTimeout(() => {
        if (pttFeedContainerRef.current) {
          pttFeedContainerRef.current.scrollTop = pttFeedContainerRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [history, activeTab]);

  // 전역 pointerup 안전망 (화면 밖 릴리즈 대응)
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isStartingRef.current) {
        stopRequestedRef.current = true;
      }
      if (isTransmittingRef.current) {
        finishRecordingAndSend();
      }
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);

    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  // 전원 토글
  const handleTogglePower = () => {
    const next = !isPowerOn;
    setIsPowerOn(next);
    walkieService.setPower(next);
    if (next) {
      walkieService.unlockAudio();
    }
  };

  // 수신 모드 1-Click 순환 변경 (실시간음성 -> 비프알림 -> 완전무음)
  const handleCycleReceiveMode = () => {
    const nextMode: WalkieReceiveMode = 
      receiveMode === 'VOICE' ? 'BEEP' : (receiveMode === 'BEEP' ? 'MUTE' : 'VOICE');
    walkieService.setReceiveMode(nextMode);
  };

  // 수신 모드 변경 (실시간음성 / 비프알림 / 완전무음)
  const handleSelectReceiveMode = (mode: WalkieReceiveMode) => {
    walkieService.setReceiveMode(mode);
  };

  // 채널 변경
  const handleSelectChannel = (ch: WalkieTalkieChannel) => {
    setCurrentChannel(ch);
    walkieService.setChannel(ch);
    soundEngine.playStartBeep();
  };

  // ── 🌟 토글형 PTT 터치 핸들러 (터치하고 말하고 다시 터치해서 종료 및 전송) ──
  const handleTogglePtt = async () => {
    if (!isPowerOn) return;

    if (isSomeoneElseTalking) {
      soundEngine.playErrorBeep();
      return;
    }

    // 1. 이미 발언 중이거나 마이크 기동 중인 경우: 다시 터치했으므로 즉시 종료 및 전송!
    if (isTransmittingRef.current || isStartingRef.current) {
      if (isStartingRef.current) {
        stopRequestedRef.current = true;
        return;
      }
      await finishRecordingAndSend();
      return;
    }

    // 2. 발언 시작 (첫 터치)
    walkieService.unlockAudio();
    isStartingRef.current = true;
    stopRequestedRef.current = false;

    const started = await walkieService.startRecording(
      currentUser ? {
        id: currentUser.id,
        name: currentUser.name,
        deptName: currentUser.department || '기연리프트'
      } : undefined,
      { sttOnly: isMonologueOrderMode }
    );

    isStartingRef.current = false;

    if (started) {
      if (stopRequestedRef.current) {
        await finishRecordingAndSend();
        return;
      }

      isTransmittingRef.current = true;
      setIsTransmitting(true);
      setRecordDuration(0);

      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      durationTimerRef.current = setInterval(() => {
        setRecordDuration(prev => {
          if (prev >= 45) {
            // 최대 45초 초과 시 자동 종료 및 전송 세이프가드
            finishRecordingAndSend();
            return 45;
          }
          return prev + 1;
        });
      }, 1000);
    }
  };

  // ── 송신 완료 및 전송 실행 함수 ──
  const finishRecordingAndSend = async () => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    isTransmittingRef.current = false;
    setIsTransmitting(false);

    if (currentUser) {
      const sent = await walkieService.stopAndSend(
        {
          id: currentUser.id,
          name: currentUser.name,
          role: currentUser.role,
          deptName: currentUser.department || '기연리프트'
        },
        currentChannel
      );
      if (sent) {
        setHistory([...walkieService.getHistory()]);
        if (isMonologueOrderMode && sent.textTranscript) {
          const base = currentOrderDraft || loadVoiceOrderDraft() || createEmptyDraft();
          const { updatedDraft } = mergeVoiceFragmentToDraft(base, sent.textTranscript, customers, sites);
          setCurrentOrderDraft(updatedDraft);
          saveVoiceOrderDraft(updatedDraft);
        }
      }
    }
    setRecordDuration(0);
  };

  // 다시듣기 재생 (토글 정지 및 빈 오디오/오류 검증 피드백)
  const handlePlayAudio = async (msg: WalkieMessage) => {
    if (playingMessageId === msg.id) {
      walkieService.stopAudio();
      setPlayingMessageId(null);
      return;
    }
    if (!msg.audioBase64 || msg.audioBase64.trim().length < 50) {
      alert('음성 데이터가 비어있거나 저장되지 않은 메시지입니다.');
      return;
    }
    setPlayingMessageId(msg.id);
    try {
      await walkieService.playAudio(msg.audioBase64);
    } catch (e: any) {
      console.warn('Playback error:', e);
      alert('음성 재생 실패: ' + (e?.message || '알 수 없는 오류'));
    } finally {
      setPlayingMessageId(null);
    }
  };

  const currentChInfo = CHANNELS.find(c => c.id === currentChannel) || CHANNELS[0];
  const todayStr = walkieService.getTodayDateStr();

  // 다른 동료가 현재 채널에서 말하고 있는지 여부
  const isSomeoneElseTalking = Boolean(
    talkingStatus && 
    talkingStatus.isTalking && 
    talkingStatus.senderId !== currentUser?.id && 
    (talkingStatus.channel === currentChannel || talkingStatus.channel === 'ALL')
  );

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(2, 6, 23, 0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 6px'
      }}
    >
      {/* ── 무전기 본체 카드 (상하 여백 제거 & 화면 최대 활용) ── */}
      <div 
        style={{
          width: '100%',
          maxWidth: '440px',
          height: '100%',
          maxHeight: 'calc(100dvh - 8px)',
          backgroundColor: '#0f172a',
          border: '1.5px solid #334155',
          borderRadius: '18px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* 1. 상단 무전기 슬림 헤더 (공간 최소화) */}
        <div style={{
          padding: '6px 12px',
          backgroundColor: '#1e293b',
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Radio size={14} color={isPowerOn ? '#38bdf8' : '#64748b'} />
            <span style={{ fontSize: '13px', fontWeight: '900', color: '#f8fafc' }}>
              현장 무전기
            </span>
            {/* 전원 ON / OFF 버튼 */}
            <button
              type="button"
              onClick={handleTogglePower}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2.5px 7px',
                borderRadius: '9999px',
                border: 'none',
                backgroundColor: isPowerOn ? '#059669' : '#475569',
                color: '#ffffff',
                fontSize: '10.5px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              {isPowerOn ? <Volume2 size={11} /> : <VolumeX size={11} />}
              <span>{isPowerOn ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            {/* 수신 모드 1-Click 원터치 순환 버튼 (음성 ➔ 비프 ➔ 무음) */}
            <button
              type="button"
              onClick={handleCycleReceiveMode}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2.5px 7px',
                borderRadius: '6px',
                border: receiveMode === 'VOICE' ? '1px solid #10b981' : receiveMode === 'BEEP' ? '1px solid #f59e0b' : '1px solid #475569',
                backgroundColor: receiveMode === 'VOICE' ? 'rgba(16, 185, 129, 0.2)' : receiveMode === 'BEEP' ? 'rgba(245, 158, 11, 0.2)' : '#1e293b',
                color: receiveMode === 'VOICE' ? '#34d399' : receiveMode === 'BEEP' ? '#fbbf24' : '#94a3b8',
                fontSize: '10.5px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
              title="수신 모드 전환 (음성 ➔ 비프 ➔ 무음)"
            >
              {receiveMode === 'VOICE' ? <Volume2 size={11} /> : receiveMode === 'BEEP' ? <Bell size={11} /> : <BellOff size={11} />}
              <span>{receiveMode === 'VOICE' ? '음성' : receiveMode === 'BEEP' ? '비프' : '무음'}</span>
            </button>

            {/* 독백의뢰 모드 토글 버튼 */}
            <button
              type="button"
              onClick={() => {
                const next = !isMonologueOrderMode;
                setIsMonologueOrderMode(next);
                if (next) {
                  setCurrentOrderDraft(loadVoiceOrderDraft() || createEmptyDraft());
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2.5px 7px',
                borderRadius: '6px',
                border: isMonologueOrderMode ? '1px solid #38bdf8' : '1px solid #334155',
                backgroundColor: isMonologueOrderMode ? '#0284c7' : '#0f172a',
                color: isMonologueOrderMode ? '#ffffff' : '#94a3b8',
                fontSize: '10.5px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
              title="독백 모드로 출고의뢰 음성 조각 수집"
            >
              <FileText size={11} />
              <span>{isMonologueOrderMode ? '독백 ON' : '독백의뢰'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '2px',
                marginLeft: '2px'
              }}
              title="닫기"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 2. 채널 선택 바 (가로 1줄 컴팩트 4분할 바) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '4px',
          padding: '5px 8px',
          backgroundColor: '#0f172a',
          borderBottom: '1px solid #1e293b',
          flexShrink: 0
        }}>
          {CHANNELS.map(ch => {
            const isSelected = currentChannel === ch.id;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => handleSelectChannel(ch.id)}
                style={{
                  padding: '5px 2px',
                  borderRadius: '6px',
                  border: isSelected ? '1px solid #38bdf8' : '1px solid #1e293b',
                  backgroundColor: isSelected ? '#0369a1' : '#1e293b',
                  color: isSelected ? '#ffffff' : '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  fontSize: '11px',
                  fontWeight: isSelected ? '900' : '700',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ fontSize: '9px', opacity: 0.75 }}>{ch.code}</span>
                <span>{ch.name}</span>
              </button>
            );
          })}
        </div>

        {/* ── [뷰 1] 실시간 무전 (PTT 화면) ── */}
        {activeTab === 'PTT' ? (
          <>
            {/* 3. 동적 상태 알림 바 (발언 중이거나 독백 모드일 때만 슬림 표출) */}
            {isTransmitting ? (
              <div style={{
                padding: '5px 12px',
                backgroundColor: 'rgba(239, 68, 68, 0.25)',
                borderBottom: '1px solid #ef4444',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#f87171',
                fontSize: '11.5px',
                fontWeight: '900',
                flexShrink: 0
              }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '9999px', backgroundColor: '#ef4444', boxShadow: '0 0 6px #ef4444' }} />
                <span>송신 중 ({recordDuration}s) [말씀하세요]</span>
              </div>
            ) : isSomeoneElseTalking ? (
              <div style={{
                padding: '5px 12px',
                backgroundColor: 'rgba(239, 68, 68, 0.25)',
                borderBottom: '1px solid #ef4444',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#f87171',
                fontSize: '11.5px',
                fontWeight: '900',
                flexShrink: 0
              }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '9999px', backgroundColor: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
                <span>🔴 [{talkingStatus?.senderDept} {talkingStatus?.senderName}] 발언 중...</span>
              </div>
            ) : isMonologueOrderMode ? (
              <div style={{
                padding: '5px 12px',
                backgroundColor: 'rgba(2, 132, 199, 0.15)',
                borderBottom: '1px solid rgba(56, 189, 248, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '6px',
                flexShrink: 0
              }}>
                <div style={{ fontSize: '10.5px', color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ color: '#38bdf8', fontWeight: '800', marginRight: '4px' }}>📝 독백의뢰:</span>
                  {currentOrderDraft?.customerName || '고객사'} / {currentOrderDraft?.siteName || '현장'} | {currentOrderDraft?.orders?.map(o => `${o.modelName}(${o.count}대)`).join(', ') || '1930(1대)'}
                </div>
                {onNavigateToDispatchOrder && (
                  <button
                    type="button"
                    onClick={onNavigateToDispatchOrder}
                    style={{
                      padding: '2px 7px',
                      borderRadius: '5px',
                      border: 'none',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    작성 ➔
                  </button>
                )}
              </div>
            ) : null}

            {/* ── 실시간 당일 무전 피드 (화면 세로 영역의 대부분을 최대로 확보!) ── */}
            <div style={{
              flex: 1,
              minHeight: 0,
              backgroundColor: '#090d16',
              display: 'flex',
              flexDirection: 'column',
              padding: '6px 10px',
              overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', flexShrink: 0, gap: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                  <MessageSquare size={11} color="#38bdf8" />
                  <span>대화 피드 ({displayHistory.length}건)</span>
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '3.5px', flexWrap: 'nowrap' }}>
                  {/* 🎙️ 100% 무료 Groq LPU / Cloudflare AI Whisper STT 뱃지 */}
                  <button
                    type="button"
                    onClick={handleToggleSttEngine}
                    style={{
                      backgroundColor: sttEngine === 'GROQ' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(249, 115, 22, 0.15)',
                      border: sttEngine === 'GROQ' ? '1px solid #10b981' : '1px solid #f97316',
                      color: sttEngine === 'GROQ' ? '#34d399' : '#fb923c',
                      padding: '2px 5.5px',
                      borderRadius: '5px',
                      fontSize: '9.5px',
                      fontWeight: '800',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer'
                    }}
                    title={sttEngine === 'GROQ' ? 'Groq LPU Whisper (0.3초) - 클릭 시 Cloudflare 전환' : 'Cloudflare Workers AI Whisper - 클릭 시 Groq 전환'}
                  >
                    {sttEngine === 'GROQ' ? '⚡ Groq STT' : '☁️ Cloudflare STT'}
                  </button>

                  {/* 🐞 디버그 로그 ON/OFF 토글 버튼 */}
                  <button
                    type="button"
                    onClick={handleToggleDebug}
                    style={{
                      backgroundColor: showDebugLogs ? 'rgba(239, 68, 68, 0.2)' : '#1e293b',
                      border: showDebugLogs ? '1px solid #ef4444' : '1px solid #334155',
                      color: showDebugLogs ? '#f87171' : '#64748b',
                      padding: '2px 5.5px',
                      borderRadius: '5px',
                      fontSize: '9.5px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                    title="디버깅 로그 화면 출력 켜기 / 끄기"
                  >
                    {showDebugLogs ? '🐞 디버그ON' : '디버그OFF'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('LOGS')}
                    style={{
                      backgroundColor: 'rgba(56, 189, 248, 0.1)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      color: '#38bdf8',
                      padding: '2px 6px',
                      borderRadius: '5px',
                      fontSize: '9.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    로그 ➔
                  </button>
                </div>
              </div>

              {displayHistory.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#64748b' }}>
                  오늘 무전 내역이 없습니다. (하단 버튼을 터치하여 말씀하세요)
                </div>
              ) : (
                <div 
                  ref={pttFeedContainerRef}
                  style={{ 
                    flex: 1,
                    minHeight: 0,
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '4px',
                    overflowY: 'auto',
                    paddingRight: '2px'
                  }}
                >
                  {/* Latest messages at bottom (reverse order, max 80 items) */}
                  {displayHistory.slice(0, 80).reverse().map(msg => {
                    // ── [DEBUG] Console-style debug log entry ──
                    if (msg.isDebug) {
                      const ts = new Date(msg.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      const isErr = msg.textTranscript?.includes('ERROR') || msg.textTranscript?.includes('FAIL') || msg.textTranscript?.includes('EXCEPTION');
                      const isWarn = msg.textTranscript?.includes('WARNING') || msg.textTranscript?.includes('skipped');
                      const isOk = msg.textTranscript?.includes('OK') || msg.textTranscript?.includes('done') || msg.textTranscript?.includes('ready') || msg.textTranscript?.includes('sent') || msg.textTranscript?.includes('granted') || msg.textTranscript?.includes('started');
                      return (
                        <div
                          key={msg.id}
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: '#020617',
                            border: `1px solid ${isErr ? '#7f1d1d' : isWarn ? '#78350f' : '#1e3a5f'}`,
                            fontFamily: 'monospace',
                            fontSize: '10px',
                            lineHeight: 1.4,
                            color: isErr ? '#f87171' : isWarn ? '#fbbf24' : isOk ? '#4ade80' : '#94a3b8',
                            wordBreak: 'break-all',
                            whiteSpace: 'pre-wrap'
                          }}
                        >
                          <span style={{ color: '#475569', marginRight: '6px' }}>{ts}</span>
                          {msg.textTranscript}
                        </div>
                      );
                    }

                    const isPlaying = playingMessageId === msg.id;
                    const isMine = msg.senderId === currentUser?.id;
                    const timeStr = new Date(msg.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
                    return (

                      <div
                        key={msg.id}
                        style={{
                          padding: '5px 8px',
                          borderRadius: '8px',
                          backgroundColor: isMine ? 'rgba(30, 58, 138, 0.35)' : '#1e293b',
                          border: isMine ? '1px solid #2563eb' : '1px solid #334155',
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: '6px'
                        }}
                      >
                        {/* 좌측: [채널] 화자명 시간 💬 줄바꿈 허용 풀텍스트 */}
                        <div style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: '11px',
                          lineHeight: 1.35,
                          wordBreak: 'break-all',
                          whiteSpace: 'pre-wrap'
                        }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.5px 3.5px',
                            borderRadius: '3px',
                            backgroundColor: '#0f172a',
                            color: '#38bdf8',
                            fontSize: '9px',
                            fontWeight: '800',
                            marginRight: '4px',
                            verticalAlign: 'baseline'
                          }}>
                            {msg.channel}
                          </span>
                          <span style={{ fontSize: '10px', fontWeight: '700', color: isMine ? '#93c5fd' : '#cbd5e1', marginRight: '4px' }}>
                            {isMine ? '나' : `${msg.senderDept} ${msg.senderName}`}
                          </span>
                          <span style={{ fontSize: '9px', color: '#64748b', marginRight: '5px' }}>
                            {timeStr}
                          </span>
                          <span style={{
                            color: msg.textTranscript ? '#ffffff' : '#94a3b8',
                            fontWeight: msg.textTranscript ? '600' : '400'
                          }}>
                            {msg.textTranscript ? (
                              <span>
                                <span style={{ color: '#f8fafc', fontWeight: '600' }}>{msg.textTranscript}</span>
                                <span style={{ color: '#64748b', marginLeft: '4px', fontSize: '9px' }}>({msg.durationSec}s)</span>
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>({msg.durationSec}s)</span>
                            )}
                          </span>
                        </div>

                        {/* 우측: 초소형 '>' 재생 버튼 */}
                        <button
                          type="button"
                          onClick={() => handlePlayAudio(msg)}
                          title={isPlaying ? '정지' : `재생 (${msg.durationSec}s)`}
                          style={{
                            flexShrink: 0,
                            width: '20px',
                            height: '20px',
                            borderRadius: '5px',
                            border: 'none',
                            backgroundColor: isPlaying ? '#ef4444' : isMine ? '#2563eb' : '#0284c7',
                            color: '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                            marginTop: '1px'
                          }}
                        >
                          {isPlaying ? <Square size={8} fill="#ffffff" /> : <Play size={8} fill="#ffffff" style={{ marginLeft: '1px' }} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── 최하단 인체공학적 가로 와이드 PTT 버튼 (오른손 엄지 영역) ── */}
            <div style={{
              padding: '10px 14px 14px',
              backgroundColor: '#0f172a',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              {/* 발언 중 실시간 STT 라이브 버블 */}
              {isTransmitting && (
                <div style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(2, 6, 23, 0.95)',
                  border: sttStatus === 'ERROR' ? '1px solid #ef4444' : sttStatus === 'UNSUPPORTED' ? '1px solid #f59e0b' : '1px solid #38bdf8',
                  textAlign: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
                }}>
                  {sttStatus === 'UNSUPPORTED' ? (
                    <span style={{ fontSize: '10.5px', color: '#fbbf24', fontWeight: '700' }}>
                      ⚠️ 브라우저 음성인식 미지원 (음성은 정상 녹음·전송됨)
                    </span>
                  ) : sttStatus === 'ERROR' ? (
                    <span style={{ fontSize: '10.5px', color: '#f87171', fontWeight: '700' }}>
                      ⚠️ 음성인식 대기중 ({sttErrorDetail || '마이크 확인'})
                    </span>
                  ) : liveTranscript ? (
                    <div style={{ fontSize: '12px', color: '#fef08a', fontWeight: '800', wordBreak: 'break-all' }}>
                      💬 "{liveTranscript}"
                    </div>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#38bdf8' }}>
                      한국어 실시간 인식 중... (말씀하세요)
                    </span>
                  )}
                </div>
              )}

              {/* 가로 와이드 PTT 바 버튼 */}
              <button
                type="button"
                disabled={!isPowerOn}
                onClick={handleTogglePtt}
                style={{
                  width: '100%',
                  height: '52px',
                  borderRadius: '14px',
                  border: isTransmitting 
                    ? '2px solid #f87171' 
                    : isSomeoneElseTalking
                    ? '2px solid #f59e0b'
                    : isPowerOn 
                    ? '1.5px solid #38bdf8' 
                    : '1px solid #475569',
                  background: isTransmitting 
                    ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)' 
                    : isSomeoneElseTalking
                    ? 'linear-gradient(135deg, #78350f 0%, #451a03 100%)'
                    : isPowerOn 
                    ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' 
                    : '#334155',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: isPowerOn ? 'pointer' : 'not-allowed',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  boxShadow: isTransmitting 
                    ? '0 0 20px rgba(239, 68, 68, 0.7)' 
                    : isSomeoneElseTalking
                    ? '0 0 15px rgba(245, 158, 11, 0.4)'
                    : isPowerOn 
                    ? '0 4px 14px rgba(2, 132, 199, 0.35)' 
                    : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {isTransmitting ? (
                  <>
                    <Mic size={20} color="#ffffff" />
                    <span style={{ fontSize: '14.5px', fontWeight: '900', letterSpacing: '0.5px' }}>
                      발언 중 ({recordDuration}s) [터치하여 전송]
                    </span>
                  </>
                ) : isSomeoneElseTalking ? (
                  <>
                    <Volume2 size={20} color="#fde68a" />
                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#fef08a' }}>
                      [{talkingStatus?.senderName}] 발언 중... (잠시 대기)
                    </span>
                  </>
                ) : isPowerOn ? (
                  <>
                    <Radio size={20} color="#ffffff" />
                    <span style={{ fontSize: '14.5px', fontWeight: '800' }}>
                      터치하고 말하기
                    </span>
                    <span style={{ fontSize: '11px', opacity: 0.85, fontWeight: '500' }}>
                      (완료 시 다시 터치)
                    </span>
                  </>
                ) : (
                  <>
                    <MicOff size={18} color="#94a3b8" />
                    <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#94a3b8' }}>
                      무전기 전원 OFF (상단 전원을 켜주세요)
                    </span>
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          // ── [뷰 2] 당일 대화 로그 타임라인 (카카오톡형 STT 말풍선 목록) ──
          <div style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#090d16',
            overflow: 'hidden'
          }}>
            {/* 로그 상단 바 */}
            <div style={{
              padding: '10px 16px',
              backgroundColor: '#1e293b',
              borderBottom: '1px solid #334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <button
                type="button"
                onClick={() => setActiveTab('PTT')}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#38bdf8',
                  fontSize: '12px',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
              >
                <ArrowLeft size={14} />
                <span>무전기로 복귀</span>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                  당일 • {displayHistory.length}건
                </span>

                {/* 🐞 디버그 로그 ON/OFF 토글 버튼 */}
                <button
                  type="button"
                  onClick={handleToggleDebug}
                  style={{
                    backgroundColor: showDebugLogs ? 'rgba(239, 68, 68, 0.2)' : '#0f172a',
                    border: showDebugLogs ? '1px solid #ef4444' : '1px solid #475569',
                    borderRadius: '5px',
                    color: showDebugLogs ? '#f87171' : '#94a3b8',
                    fontSize: '10px',
                    fontWeight: '700',
                    padding: '2.5px 6px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                  title="디버깅 로그 화면 출력 켜기 / 끄기"
                >
                  {showDebugLogs ? '🐞 디버그ON' : '디버그OFF'}
                </button>

                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('오늘의 무전 대화 기록을 모두 비우시겠습니까?')) {
                        walkieService.clearTodayHistory();
                      }
                    }}
                    style={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #475569',
                      borderRadius: '5px',
                      color: '#cbd5e1',
                      fontSize: '10px',
                      padding: '2.5px 6px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    대화 비우기
                  </button>
                )}
              </div>
            </div>

            {/* 대화 말풍선 스크롤 영역 (최신 대화가 아래에 위치하도록 역전) */}
            <div 
              ref={logContainerRef}
              style={{
                flex: 1,
                padding: '14px 16px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              {displayHistory.length === 0 ? (
                <div style={{
                  padding: '40px 16px',
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: '12px',
                  lineHeight: 1.6
                }}>
                  <MessageSquare size={28} color="#334155" style={{ margin: '0 auto 8px' }} />
                  <div>오늘 주고받은 무전 대화가 없습니다.</div>
                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
                    무전으로 말한 내용은 음성과 함께 실시간 텍스트로 자동 기록됩니다.
                  </div>
                </div>
              ) : (
                [...displayHistory].reverse().map(msg => {
                  // ── [DEBUG] Console-style debug log entry ──
                  if (msg.isDebug) {
                    const ts = new Date(msg.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    const isErr = msg.textTranscript?.includes('ERROR') || msg.textTranscript?.includes('FAIL') || msg.textTranscript?.includes('EXCEPTION');
                    const isWarn = msg.textTranscript?.includes('WARNING') || msg.textTranscript?.includes('skipped');
                    const isOk = msg.textTranscript?.includes('OK') || msg.textTranscript?.includes('done') || msg.textTranscript?.includes('ready') || msg.textTranscript?.includes('sent') || msg.textTranscript?.includes('granted') || msg.textTranscript?.includes('started');
                    return (
                      <div
                        key={msg.id}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          backgroundColor: '#020617',
                          border: `1px solid ${isErr ? '#7f1d1d' : isWarn ? '#78350f' : '#1e3a5f'}`,
                          fontFamily: 'monospace',
                          fontSize: '10px',
                          lineHeight: 1.4,
                          color: isErr ? '#f87171' : isWarn ? '#fbbf24' : isOk ? '#4ade80' : '#94a3b8',
                          wordBreak: 'break-all',
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        <span style={{ color: '#475569', marginRight: '6px' }}>{ts}</span>
                        {msg.textTranscript}
                      </div>
                    );
                  }

                  const isPlaying = playingMessageId === msg.id;
                  const isMine = msg.senderId === currentUser?.id;
                  const timeStr = new Date(msg.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={msg.id}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '8px',
                        backgroundColor: isMine ? 'rgba(30, 58, 138, 0.35)' : '#1e293b',
                        border: isMine ? '1px solid #2563eb' : '1px solid #334155',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '6px'
                      }}
                    >
                      {/* 좌측: [채널] 화자명 시간 💬 줄바꿈 허용 풀텍스트 */}
                      <div style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: '11.5px',
                        lineHeight: 1.4,
                        wordBreak: 'break-all',
                        whiteSpace: 'pre-wrap'
                      }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '0.5px 4px',
                          borderRadius: '3px',
                          backgroundColor: '#0f172a',
                          color: '#38bdf8',
                          fontSize: '9px',
                          fontWeight: '800',
                          marginRight: '4px',
                          verticalAlign: 'baseline'
                        }}>
                          {msg.channel}
                        </span>
                        <span style={{ fontSize: '10.5px', fontWeight: '700', color: isMine ? '#93c5fd' : '#cbd5e1', marginRight: '4px' }}>
                          {isMine ? '나' : `${msg.senderDept} ${msg.senderName}`}
                        </span>
                        <span style={{ fontSize: '9.5px', color: '#64748b', marginRight: '6px' }}>
                          {timeStr}
                        </span>
                        <span style={{
                          color: msg.textTranscript ? '#ffffff' : '#94a3b8',
                          fontWeight: msg.textTranscript ? '600' : '400'
                        }}>
                          {msg.textTranscript ? (
                          <span>
                            <span style={{ color: '#f8fafc', fontWeight: '600' }}>{msg.textTranscript}</span>
                            <span style={{ color: '#64748b', marginLeft: '4px', fontSize: '9.5px' }}>({msg.durationSec}s)</span>
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>({msg.durationSec}s)</span>
                        )}
                        </span>
                      </div>

                      {/* 우측: 초소형 '>' 재생 버튼 */}
                      <button
                        type="button"
                        onClick={() => handlePlayAudio(msg)}
                        title={isPlaying ? '정지' : `재생 (${msg.durationSec}s)`}
                        style={{
                          flexShrink: 0,
                          width: '22px',
                          height: '22px',
                          borderRadius: '5px',
                          border: 'none',
                          backgroundColor: isPlaying ? '#ef4444' : isMine ? '#2563eb' : '#0284c7',
                          color: '#ffffff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                          marginTop: '1px'
                        }}
                      >
                        {isPlaying ? <Square size={9} fill="#ffffff" /> : <Play size={9} fill="#ffffff" style={{ marginLeft: '1px' }} />}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
