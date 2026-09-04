// src/mobile/components/MobileWalkieTalkieModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, Volume2, VolumeX, Mic, MicOff, Play, Square,
  X, Clock, Layers, MessageSquare, ListFilter, ArrowLeft, Bell, BellOff,
  FileText, ChevronRight
} from 'lucide-react';
import { 
  walkieService, WalkieTalkieChannel, WalkieReceiveMode, WalkieMessage, soundEngine, TalkingStatus 
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

    return () => {
      unMsg();
      unHist();
      unQueue();
      unTalking();
      unRecMode();
      unLiveStt();
    };
  }, [currentUser]);

  // 모달 오픈 시 오디오 컨텍스트 언락
  useEffect(() => {
    if (isOpen) {
      walkieService.unlockAudio();
      setHistory([...walkieService.getHistory()]);
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
      } : undefined
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

  // 다시듣기 재생
  const handlePlayAudio = async (msg: WalkieMessage) => {
    if (playingMessageId === msg.id) {
      setPlayingMessageId(null);
      return;
    }
    setPlayingMessageId(msg.id);
    try {
      await walkieService.playAudio(msg.audioBase64);
    } catch (e) {
      console.warn('Playback error:', e);
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
        padding: '16px'
      }}
    >
      {/* ── 무전기 본체 카드 ── */}
      <div 
        style={{
          width: '100%',
          maxWidth: '430px',
          maxHeight: 'calc(100dvh - 24px)',
          backgroundColor: '#0f172a',
          border: '2px solid #334155',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* 1. 상단 무전기 헤더 & 전원 스위치 (공간 축소 슬림화) */}
        <div style={{
          padding: '8px 14px',
          backgroundColor: '#1e293b',
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Radio size={16} color={isPowerOn ? '#38bdf8' : '#64748b'} />
            <span style={{ fontSize: '13.5px', fontWeight: '900', color: '#f8fafc' }}>
              현장 무전기 (PTT)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* 전원 ON / OFF 버튼 */}
            <button
              type="button"
              onClick={handleTogglePower}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 9px',
                borderRadius: '9999px',
                border: 'none',
                backgroundColor: isPowerOn ? '#059669' : '#475569',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              {isPowerOn ? <Volume2 size={12} /> : <VolumeX size={12} />}
              <span>{isPowerOn ? '무전 ON' : '무전 OFF'}</span>
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
                gap: '4px',
                padding: '4px 9px',
                borderRadius: '9999px',
                border: isMonologueOrderMode ? '1px solid #38bdf8' : '1px solid #334155',
                backgroundColor: isMonologueOrderMode ? '#0284c7' : '#1e293b',
                color: isMonologueOrderMode ? '#ffffff' : '#94a3b8',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
              title="독백 모드로 출고의뢰 음성 조각 수집"
            >
              <FileText size={12} />
              <span>{isMonologueOrderMode ? '독백의뢰 ON' : '독백의뢰'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '2px'
              }}
              title="닫기"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 🌟 1.5. 수신 모드 3단 셀렉터 (실시간음성 / 비프알림 / 완전무음) */}
        <div style={{
          padding: '4px 12px',
          backgroundColor: '#090d16',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px'
        }}>
          <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', whiteSpace: 'nowrap' }}>
            수신 모드
          </span>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '3px',
            flex: 1
          }}>
            <button
              type="button"
              onClick={() => handleSelectReceiveMode('VOICE')}
              style={{
                padding: '3px 2px',
                borderRadius: '5px',
                border: receiveMode === 'VOICE' ? '1px solid #10b981' : '1px solid #334155',
                backgroundColor: receiveMode === 'VOICE' ? 'rgba(16, 185, 129, 0.2)' : '#1e293b',
                color: receiveMode === 'VOICE' ? '#34d399' : '#94a3b8',
                fontSize: '10px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                transition: 'all 0.15s ease'
              }}
              title="도착 즉시 스피커로 음성 자동 방송"
            >
              <Volume2 size={10} />
              <span>실시간 음성</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectReceiveMode('BEEP')}
              style={{
                padding: '3px 2px',
                borderRadius: '5px',
                border: receiveMode === 'BEEP' ? '1px solid #f59e0b' : '1px solid #334155',
                backgroundColor: receiveMode === 'BEEP' ? 'rgba(245, 158, 11, 0.2)' : '#1e293b',
                color: receiveMode === 'BEEP' ? '#fbbf24' : '#94a3b8',
                fontSize: '10px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                transition: 'all 0.15s ease'
              }}
              title="음성 없이 '삑' 알림음만 울려 텍스트 확인 유도"
            >
              <Bell size={10} />
              <span>비프 알림음</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectReceiveMode('MUTE')}
              style={{
                padding: '3px 2px',
                borderRadius: '5px',
                border: receiveMode === 'MUTE' ? '1px solid #64748b' : '1px solid #334155',
                backgroundColor: receiveMode === 'MUTE' ? 'rgba(100, 116, 139, 0.25)' : '#1e293b',
                color: receiveMode === 'MUTE' ? '#cbd5e1' : '#64748b',
                fontSize: '10px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                transition: 'all 0.15s ease'
              }}
              title="소리 일절 없음, 화면 텍스트만 실시간 적재"
            >
              <BellOff size={10} />
              <span>완전 무음</span>
            </button>
          </div>
        </div>

        {/* 2. 상단 뷰 모드 탭 (실시간 무전 vs 당일 대화 로그) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          backgroundColor: '#090d16',
          borderBottom: '1px solid #1e293b'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('PTT')}
            style={{
              padding: '8px',
              border: 'none',
              borderBottom: activeTab === 'PTT' ? '2px solid #38bdf8' : '2px solid transparent',
              backgroundColor: activeTab === 'PTT' ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
              color: activeTab === 'PTT' ? '#38bdf8' : '#94a3b8',
              fontSize: '12px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px'
            }}
          >
            <Mic size={13} />
            <span>실시간 무전 (PTT)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('LOGS')}
            style={{
              padding: '8px',
              border: 'none',
              borderBottom: activeTab === 'LOGS' ? '2px solid #38bdf8' : '2px solid transparent',
              backgroundColor: activeTab === 'LOGS' ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
              color: activeTab === 'LOGS' ? '#38bdf8' : '#94a3b8',
              fontSize: '12px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px'
            }}
          >
            <MessageSquare size={13} />
            <span>당일 대화 로그 ({history.length})</span>
          </button>
        </div>

        {/* ── [뷰 1] 실시간 무전 (PTT 화면) ── */}
        {activeTab === 'PTT' ? (
          <>
            {/* 채널 셀렉터 버튼바 (컴팩트 그리드) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: '#0f172a',
              borderBottom: '1px solid #1e293b'
            }}>
              {CHANNELS.map(ch => {
                const isSelected = currentChannel === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => handleSelectChannel(ch.id)}
                    style={{
                      padding: '6px 2px',
                      borderRadius: '8px',
                      border: isSelected ? '1px solid #38bdf8' : '1px solid #334155',
                      backgroundColor: isSelected ? '#0369a1' : '#1e293b',
                      color: isSelected ? '#ffffff' : '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '1px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ fontSize: '9.5px', opacity: 0.8, letterSpacing: '0.5px' }}>{ch.code}</span>
                    <span style={{ fontSize: '11.5px', fontWeight: '800' }}>{ch.name}</span>
                  </button>
                );
              })}
            </div>

            {/* 디지털 LCD 패널 (슬림 상태바 형태) */}
            <div style={{
              margin: '8px 12px 6px',
              padding: '8px 12px',
              borderRadius: '12px',
              backgroundColor: '#020617',
              border: isSomeoneElseTalking 
                ? '1px solid #ef4444' 
                : isTransmitting 
                ? '1px solid #f87171' 
                : '1px solid #1e293b',
              boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.8)',
              transition: 'all 0.2s ease'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ 
                  fontSize: '11.5px', 
                  fontWeight: '900', 
                  color: isSomeoneElseTalking ? '#fca5a5' : '#34d399', 
                  letterSpacing: '0.5px' 
                }}>
                  {currentChInfo.code} • {currentChInfo.name}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {queueLength > 0 && (
                    <span style={{
                      fontSize: '9.5px',
                      fontWeight: '800',
                      padding: '1.5px 5px',
                      borderRadius: '5px',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}>
                      <Layers size={10} />
                      <span>대기 {queueLength}</span>
                    </span>
                  )}

                  <span style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    padding: '1.5px 6px',
                    borderRadius: '9999px',
                    backgroundColor: isSomeoneElseTalking ? '#7f1d1d' : isPowerOn ? '#064e3b' : '#334155',
                    color: isSomeoneElseTalking ? '#fecaca' : isPowerOn ? '#a7f3d0' : '#94a3b8'
                  }}>
                    {isSomeoneElseTalking ? '통화 중' : isPowerOn ? (
                      receiveMode === 'VOICE' ? '🔊 음성' : receiveMode === 'BEEP' ? '🔔 알림' : '🔕 무음'
                    ) : '전원 꺼짐'}
                  </span>
                </div>
              </div>

              {/* 하단 상태 또는 발언자 표시 */}
              <div style={{ marginTop: '4px', minHeight: '22px', display: 'flex', alignItems: 'center' }}>
                {isTransmitting ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171' }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '9999px',
                      backgroundColor: '#ef4444',
                      boxShadow: '0 0 6px #ef4444'
                    }} />
                    <span style={{ fontSize: '12px', fontWeight: '900' }}>
                      🔴 내가 송신 중... ({recordDuration}초) [말씀하세요]
                    </span>
                  </div>
                ) : isSomeoneElseTalking ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171' }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '9999px',
                      backgroundColor: '#ef4444',
                      boxShadow: '0 0 8px #ef4444'
                    }} />
                    <span style={{ fontSize: '12px', fontWeight: '900' }}>
                      🔴 [{talkingStatus?.senderDept} {talkingStatus?.senderName}] 발언 중...
                    </span>
                  </div>
                ) : history.length > 0 && history[0].textTranscript ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden', width: '100%' }}>
                    <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '800', flexShrink: 0 }}>최신:</span>
                    <span style={{ fontSize: '11px', color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {history[0].textTranscript}
                    </span>
                  </div>
                ) : (
                  <span style={{ fontSize: '11px', color: isPowerOn ? '#6ee7b7' : '#64748b' }}>
                    {isPowerOn ? currentChInfo.desc : '전원을 켜면 실시간 음성을 수신할 수 있습니다.'}
                  </span>
                )}
              </div>
            </div>

            {/* 🌟 독백 의뢰 모드 실시간 수집 패널 */}
            {isMonologueOrderMode && (
              <div style={{
                margin: '0 12px 6px',
                padding: '8px 12px',
                backgroundColor: 'rgba(2, 132, 199, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '800', color: '#38bdf8' }}>
                    <FileText size={12} />
                    <span>출고의뢰 조각 수집 중</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentOrderDraft?.customerName || '고객사 미정'} / {currentOrderDraft?.siteName || '현장 미정'} | 장비: {currentOrderDraft?.orders?.map(o => `${o.modelName}(${o.count}대)`).join(', ') || '1930(1대)'}
                  </div>
                </div>

                {onNavigateToDispatchOrder && (
                  <button
                    type="button"
                    onClick={onNavigateToDispatchOrder}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      padding: '5px 9px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    <span>의뢰서 작성</span>
                    <ChevronRight size={12} />
                  </button>
                )}
              </div>
            )}

            {/* ── 실시간 당일 무전 피드 (LCD 바로 아래 선행 배치) ── */}
            <div style={{
              flex: 1,
              minHeight: '180px',
              maxHeight: '260px',
              backgroundColor: '#090d16',
              borderTop: '1px solid #1e293b',
              borderBottom: '1px solid #1e293b',
              display: 'flex',
              flexDirection: 'column',
              padding: '8px 12px',
              overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MessageSquare size={12} color="#38bdf8" />
                  <span>실시간 대화 피드 ({history.length}건)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('LOGS')}
                  style={{
                    backgroundColor: 'rgba(56, 189, 248, 0.1)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    color: '#38bdf8',
                    padding: '2px 7px',
                    borderRadius: '5px',
                    fontSize: '10.5px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  전체 로그 ➔
                </button>
              </div>

              {history.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11.5px', color: '#64748b' }}>
                  오늘 무전 내역이 없습니다. (하단 버튼을 터치하여 말씀하세요)
                </div>
              ) : (
                <div 
                  ref={pttFeedContainerRef}
                  style={{ 
                    flex: 1,
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '5px',
                    overflowY: 'auto',
                    paddingRight: '2px'
                  }}
                >
                  {/* 최신 대화가 맨 아래에 오도록 reverse */}
                  {history.slice(0, 6).reverse().map(msg => {
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
                          fontSize: '11px',
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
                            {msg.textTranscript ? `💬 ${msg.textTranscript}` : `🎙️ 음성 (${msg.durationSec}초)`}
                          </span>
                        </div>

                        {/* 우측: 초소형 '>' 재생 버튼 */}
                        <button
                          type="button"
                          onClick={() => handlePlayAudio(msg)}
                          title={isPlaying ? '정지' : `음성 재생 (${msg.durationSec}초)`}
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
                      🎙️ 한국어 실시간 인식 중... (말씀하세요)
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
                      🔴 발언 중... ({recordDuration}초) [터치하여 전송]
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
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#090d16',
            height: '420px',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  당일 ({todayStr}) • {history.length}건
                </span>
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
                      fontSize: '10.5px',
                      padding: '3px 7px',
                      cursor: 'pointer'
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
              {history.length === 0 ? (
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
                [...history].reverse().map(msg => {
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
                          {msg.textTranscript ? `💬 ${msg.textTranscript}` : `🎙️ 음성 (${msg.durationSec}초)`}
                        </span>
                      </div>

                      {/* 우측: 초소형 '>' 재생 버튼 */}
                      <button
                        type="button"
                        onClick={() => handlePlayAudio(msg)}
                        title={isPlaying ? '정지' : `음성 재생 (${msg.durationSec}초)`}
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
