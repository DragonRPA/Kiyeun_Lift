// src/mobile/components/MobileWalkieTalkieModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, Volume2, VolumeX, Mic, MicOff, Play, Square,
  X, Clock, Layers, MessageSquare, ListFilter, ArrowLeft, Bell, BellOff
} from 'lucide-react';
import { 
  walkieService, WalkieTalkieChannel, WalkieReceiveMode, WalkieMessage, soundEngine, TalkingStatus 
} from '../../services/walkieTalkieService';
import { useApp } from '../../context/AppContext';

interface MobileWalkieTalkieModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CHANNELS: { id: WalkieTalkieChannel; name: string; code: string; desc: string }[] = [
  { id: 'ALL', name: '전사공용', code: 'CH-01', desc: '전사 긴급 공지 및 공통 통신망' },
  { id: 'DISPATCH', name: '출고배차', code: 'CH-02', desc: '주기장 상차 및 배차 기사 통신망' },
  { id: 'AS', name: '현장AS', code: 'CH-03', desc: '외근 출동 및 긴급 정비 통신망' },
  { id: 'SALES', name: '영업', code: 'CH-04', desc: '외근 영업 재고 및 출고 소통망' },
];

export const MobileWalkieTalkieModal: React.FC<MobileWalkieTalkieModalProps> = ({
  isOpen,
  onClose
}) => {
  const { currentUser } = useApp();

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

  // 🔒 PTT 비동기 트리거 레이스 컨디션 원천 방지용 Refs
  const isTransmittingRef = useRef<boolean>(false);
  const isStartingRef = useRef<boolean>(false);
  const stopRequestedRef = useRef<boolean>(false);
  const activePointerIdRef = useRef<number | null>(null);
  const durationTimerRef = useRef<any>(null);

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

    return () => {
      unMsg();
      unHist();
      unQueue();
      unTalking();
      unRecMode();
    };
  }, [currentUser]);

  // 모달 오픈 시 오디오 컨텍스트 언락
  useEffect(() => {
    if (isOpen) {
      walkieService.unlockAudio();
      setHistory([...walkieService.getHistory()]);
    }
  }, [isOpen]);

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

  // ── 🌟 PTT 눌렀을 때 (Pointer Down) ──
  const handlePttDown = async (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!isPowerOn) return;
    if (isTransmittingRef.current || isStartingRef.current) return;

    walkieService.unlockAudio();

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
      activePointerIdRef.current = e.pointerId;
    } catch {
      // ignore
    }

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
      // 만약 startRecording 대기 도중에 사용자가 이미 손을 뗐다면 즉시 전송 후 종료!
      if (stopRequestedRef.current) {
        await finishRecordingAndSend();
        return;
      }

      isTransmittingRef.current = true;
      setIsTransmitting(true);
      setRecordDuration(0);

      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      durationTimerRef.current = setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);
    }
  };

  // ── 🌟 PTT 손 뗐을 때 (Pointer Up) ──
  const handlePttUp = async (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();

    if (activePointerIdRef.current !== null) {
      try {
        e.currentTarget.releasePointerCapture(activePointerIdRef.current);
      } catch {
        // ignore
      }
      activePointerIdRef.current = null;
    }

    // 마이크 초기화 대기 중에 손을 뗀 경우: 플래그 세팅으로 초기화 완료 즉시 중지 유도
    if (isStartingRef.current) {
      stopRequestedRef.current = true;
      return;
    }

    if (!isTransmittingRef.current) return;
    await finishRecordingAndSend();
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
          backgroundColor: '#0f172a',
          border: '2px solid #334155',
          borderRadius: '28px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* 1. 상단 무전기 헤더 & 전원 스위치 */}
        <div style={{
          padding: '14px 18px',
          backgroundColor: '#1e293b',
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Radio size={19} color={isPowerOn ? '#38bdf8' : '#64748b'} />
            <span style={{ fontSize: '15px', fontWeight: '900', color: '#f8fafc' }}>
              현장 무전기 (PTT)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* 전원 ON / OFF 버튼 */}
            <button
              type="button"
              onClick={handleTogglePower}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 11px',
                borderRadius: '9999px',
                border: 'none',
                backgroundColor: isPowerOn ? '#059669' : '#475569',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              {isPowerOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
              <span>{isPowerOn ? '무전 ON' : '무전 OFF'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px'
              }}
              title="닫기"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 🌟 1.5. 수신 모드 3단 셀렉터 (실시간음성 / 비프알림 / 완전무음) */}
        <div style={{
          padding: '6px 14px',
          backgroundColor: '#090d16',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748b', whiteSpace: 'nowrap' }}>
            수신 모드
          </span>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '4px',
            flex: 1
          }}>
            <button
              type="button"
              onClick={() => handleSelectReceiveMode('VOICE')}
              style={{
                padding: '5px 4px',
                borderRadius: '6px',
                border: receiveMode === 'VOICE' ? '1px solid #10b981' : '1px solid #334155',
                backgroundColor: receiveMode === 'VOICE' ? 'rgba(16, 185, 129, 0.2)' : '#1e293b',
                color: receiveMode === 'VOICE' ? '#34d399' : '#94a3b8',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                transition: 'all 0.15s ease'
              }}
              title="도착 즉시 스피커로 음성 자동 방송"
            >
              <Volume2 size={11} />
              <span>실시간 음성</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectReceiveMode('BEEP')}
              style={{
                padding: '5px 4px',
                borderRadius: '6px',
                border: receiveMode === 'BEEP' ? '1px solid #f59e0b' : '1px solid #334155',
                backgroundColor: receiveMode === 'BEEP' ? 'rgba(245, 158, 11, 0.2)' : '#1e293b',
                color: receiveMode === 'BEEP' ? '#fbbf24' : '#94a3b8',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                transition: 'all 0.15s ease'
              }}
              title="음성 없이 '삑' 알림음만 울려 텍스트 확인 유도"
            >
              <Bell size={11} />
              <span>비프 알림음</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectReceiveMode('MUTE')}
              style={{
                padding: '5px 4px',
                borderRadius: '6px',
                border: receiveMode === 'MUTE' ? '1px solid #64748b' : '1px solid #334155',
                backgroundColor: receiveMode === 'MUTE' ? 'rgba(100, 116, 139, 0.25)' : '#1e293b',
                color: receiveMode === 'MUTE' ? '#cbd5e1' : '#64748b',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                transition: 'all 0.15s ease'
              }}
              title="소리 일절 없음, 화면 텍스트만 실시간 적재"
            >
              <BellOff size={11} />
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
              padding: '10px',
              border: 'none',
              borderBottom: activeTab === 'PTT' ? '2px solid #38bdf8' : '2px solid transparent',
              backgroundColor: activeTab === 'PTT' ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
              color: activeTab === 'PTT' ? '#38bdf8' : '#94a3b8',
              fontSize: '12.5px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Mic size={14} />
            <span>실시간 무전 (PTT)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('LOGS')}
            style={{
              padding: '10px',
              border: 'none',
              borderBottom: activeTab === 'LOGS' ? '2px solid #38bdf8' : '2px solid transparent',
              backgroundColor: activeTab === 'LOGS' ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
              color: activeTab === 'LOGS' ? '#38bdf8' : '#94a3b8',
              fontSize: '12.5px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <MessageSquare size={14} />
            <span>당일 대화 로그 ({history.length})</span>
          </button>
        </div>

        {/* ── [뷰 1] 실시간 무전 (PTT 화면) ── */}
        {activeTab === 'PTT' ? (
          <>
            {/* 채널 셀렉터 버튼바 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '6px',
              padding: '12px 16px',
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
                      padding: '8px 4px',
                      borderRadius: '10px',
                      border: isSelected ? '1px solid #38bdf8' : '1px solid #334155',
                      backgroundColor: isSelected ? '#0369a1' : '#1e293b',
                      color: isSelected ? '#ffffff' : '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ fontSize: '10px', opacity: 0.8, letterSpacing: '0.5px' }}>{ch.code}</span>
                    <span style={{ fontSize: '12px', fontWeight: '800' }}>{ch.name}</span>
                  </button>
                );
              })}
            </div>

            {/* 디지털 LCD 패널 */}
            <div style={{
              margin: '12px 16px',
              padding: '12px 14px',
              borderRadius: '16px',
              backgroundColor: '#020617',
              border: isSomeoneElseTalking 
                ? '1px solid #ef4444' 
                : isTransmitting 
                ? '1px solid #f87171' 
                : '1px solid #1e293b',
              boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.8)',
              transition: 'all 0.2s ease'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ 
                  fontSize: '12px', 
                  fontWeight: '900', 
                  color: isSomeoneElseTalking ? '#fca5a5' : '#34d399', 
                  letterSpacing: '1px' 
                }}>
                  {currentChInfo.code} • {currentChInfo.name}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {queueLength > 0 && (
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '800',
                      padding: '2px 6px',
                      borderRadius: '6px',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}>
                      <Layers size={11} />
                      <span>대기 {queueLength}건</span>
                    </span>
                  )}

                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: '700',
                    padding: '2px 7px',
                    borderRadius: '9999px',
                    backgroundColor: isSomeoneElseTalking ? '#7f1d1d' : isPowerOn ? '#064e3b' : '#334155',
                    color: isSomeoneElseTalking ? '#fecaca' : isPowerOn ? '#a7f3d0' : '#94a3b8'
                  }}>
                    {isSomeoneElseTalking ? '통화 중' : isPowerOn ? (
                      receiveMode === 'VOICE' ? '🔊 음성방송' : receiveMode === 'BEEP' ? '🔔 삑 알림' : '🔕 완전무음'
                    ) : '전원 꺼짐'}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '8px', minHeight: '34px', display: 'flex', alignItems: 'center' }}>
                {isTransmitting ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171' }}>
                    <span style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '9999px',
                      backgroundColor: '#ef4444',
                      boxShadow: '0 0 8px #ef4444'
                    }} />
                    <span style={{ fontSize: '13.5px', fontWeight: '900' }}>
                      🔴 내가 송신 중... ({recordDuration}초) [말씀하세요]
                    </span>
                  </div>
                ) : isSomeoneElseTalking ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171' }}>
                    <span style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '9999px',
                      backgroundColor: '#ef4444',
                      boxShadow: '0 0 10px #ef4444'
                    }} />
                    <span style={{ fontSize: '13.5px', fontWeight: '900' }}>
                      🔴 [{talkingStatus?.senderDept} {talkingStatus?.senderName}] 말하고 있습니다...
                    </span>
                  </div>
                ) : history.length > 0 && history[0].textTranscript ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', width: '100%' }}>
                    <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: '800', flexShrink: 0 }}>💬 최신:</span>
                    <span style={{ fontSize: '12px', color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {history[0].textTranscript}
                    </span>
                  </div>
                ) : (
                  <span style={{ fontSize: '12px', color: isPowerOn ? '#6ee7b7' : '#64748b' }}>
                    {isPowerOn ? currentChInfo.desc : '무전기 전원을 켜면 실시간 음성을 수신할 수 있습니다.'}
                  </span>
                )}
              </div>
            </div>

            {/* 대형 원형 PTT (Push-To-Talk) 버튼 */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 0 16px'
            }}>
              <button
                type="button"
                disabled={!isPowerOn}
                onPointerDown={handlePttDown}
                onPointerUp={handlePttUp}
                onPointerCancel={handlePttUp}
                style={{
                  width: '136px',
                  height: '136px',
                  borderRadius: '9999px',
                  border: isTransmitting 
                    ? '6px solid #ef4444' 
                    : isSomeoneElseTalking
                    ? '6px solid #f59e0b'
                    : isPowerOn 
                    ? '6px solid #0284c7' 
                    : '6px solid #475569',
                  backgroundColor: isTransmitting 
                    ? '#b91c1c' 
                    : isSomeoneElseTalking
                    ? '#78350f'
                    : isPowerOn 
                    ? '#0369a1' 
                    : '#334155',
                  color: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  cursor: isPowerOn ? 'pointer' : 'not-allowed',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  touchAction: 'none',
                  transform: isTransmitting ? 'scale(0.94)' : 'scale(1)',
                  transition: 'all 0.1s ease',
                  boxShadow: isTransmitting 
                    ? '0 0 35px rgba(239, 68, 68, 0.8)' 
                    : isSomeoneElseTalking
                    ? '0 0 25px rgba(245, 158, 11, 0.5)'
                    : isPowerOn 
                    ? '0 10px 25px rgba(2, 132, 199, 0.4)' 
                    : 'none'
                }}
              >
                {isTransmitting ? (
                  <Mic size={40} color="#ffffff" />
                ) : isSomeoneElseTalking ? (
                  <Volume2 size={36} color="#fde68a" />
                ) : isPowerOn ? (
                  <Radio size={36} color="#ffffff" />
                ) : (
                  <MicOff size={36} color="#94a3b8" />
                )}
                <span style={{ fontSize: '13px', fontWeight: '900', letterSpacing: '0.5px' }}>
                  {isTransmitting 
                    ? '손을 떼면 전송' 
                    : isSomeoneElseTalking
                    ? `[${talkingStatus?.senderName}] 발언 중`
                    : isPowerOn 
                    ? '누르고 말하기' 
                    : '무전 OFF'}
                </span>
                {isTransmitting && (
                  <span style={{ fontSize: '11px', color: '#fecaca', fontWeight: '800' }}>
                    {recordDuration}초
                  </span>
                )}
              </button>

              <span style={{ fontSize: '11px', color: isSomeoneElseTalking ? '#fbbf24' : '#64748b', marginTop: '10px' }}>
                {isTransmitting 
                  ? '마이크로 말씀하신 후 손을 떼시면 즉시 상대방에게 전송됩니다'
                  : isSomeoneElseTalking 
                  ? '동료가 말하고 있습니다. 발언이 끝나면 버튼을 눌러주세요'
                  : isPowerOn 
                  ? '버튼을 누른 채 말씀하시고 손을 떼면 자동 전송됩니다' 
                  : '상단 무전 ON 스위치를 먼저 켜주세요'}
              </span>
            </div>

            {/* 실시간 당일 무전 피드 (최근 대화 & STT 전사 텍스트 상시 노출) */}
            <div style={{
              borderTop: '1px solid #1e293b',
              backgroundColor: '#090d16',
              padding: '12px 16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <MessageSquare size={13} color="#38bdf8" />
                  <span>실시간 대화 피드 (당일 {history.length}건)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('LOGS')}
                  style={{
                    backgroundColor: 'rgba(56, 189, 248, 0.1)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    color: '#38bdf8',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  전체 대화록 ➔
                </button>
              </div>

              {history.length === 0 ? (
                <div style={{ padding: '12px', textAlign: 'center', fontSize: '11.5px', color: '#64748b' }}>
                  오늘 주고받은 무전 내역이 없습니다. (PTT 버튼을 눌러 말씀하세요)
                </div>
              ) : (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '6px',
                  maxHeight: '170px',
                  overflowY: 'auto'
                }}>
                  {history.slice(0, 4).map(msg => {
                    const isPlaying = playingMessageId === msg.id;
                    const timeStr = new Date(msg.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div
                        key={msg.id}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '10px',
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px'
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '11px', fontWeight: '800', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ color: '#38bdf8' }}>[{msg.channel}]</span>
                            <span>{msg.senderDept} {msg.senderName}</span>
                            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '500' }}>{timeStr}</span>
                          </div>
                          {msg.textTranscript ? (
                            <div style={{ 
                              fontSize: '12px', 
                              color: '#ffffff', 
                              fontWeight: '600',
                              marginTop: '2px', 
                              lineHeight: 1.35,
                              wordBreak: 'break-all'
                            }}>
                              💬 {msg.textTranscript}
                            </div>
                          ) : (
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                              🎙️ 음성 메시지 ({msg.durationSec}초)
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handlePlayAudio(msg)}
                          style={{
                            padding: '5px 8px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: isPlaying ? '#0284c7' : '#334155',
                            color: '#ffffff',
                            fontSize: '11px',
                            fontWeight: '800',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            flexShrink: 0
                          }}
                        >
                          {isPlaying ? <Square size={10} fill="#ffffff" /> : <Play size={10} fill="#ffffff" />}
                          <span>{isPlaying ? '정지' : '듣기'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
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
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                당일 대화 ({todayStr}) • 총 {history.length}건
              </span>
            </div>

            {/* 대화 말풍선 스크롤 영역 */}
            <div style={{
              flex: 1,
              padding: '14px 16px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
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
                history.map(msg => {
                  const isPlaying = playingMessageId === msg.id;
                  const isMine = msg.senderId === currentUser?.id;
                  const timeStr = new Date(msg.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMine ? 'flex-end' : 'flex-start'
                      }}
                    >
                      {/* 발신자 정보 및 시간 */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '4px',
                        fontSize: '11px',
                        color: '#94a3b8'
                      }}>
                        <span style={{
                          padding: '1px 5px',
                          borderRadius: '4px',
                          backgroundColor: '#1e293b',
                          color: '#38bdf8',
                          fontSize: '10px',
                          fontWeight: '800'
                        }}>
                          {msg.channel}
                        </span>
                        <span style={{ fontWeight: '800', color: isMine ? '#60a5fa' : '#f8fafc' }}>
                          {isMine ? '나' : `${msg.senderDept} ${msg.senderName}`}
                        </span>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>{timeStr}</span>
                      </div>

                      {/* 말풍선 본문 */}
                      <div style={{
                        maxWidth: '85%',
                        padding: '10px 12px',
                        borderRadius: isMine ? '14px 2px 14px 14px' : '2px 14px 14px 14px',
                        backgroundColor: isMine ? '#1e3a8a' : '#1e293b',
                        border: isMine ? '1px solid #2563eb' : '1px solid #334155',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.25)'
                      }}>
                        {/* STT 텍스트 */}
                        <div style={{
                          fontSize: '13px',
                          color: '#f8fafc',
                          lineHeight: 1.45,
                          fontWeight: '600'
                        }}>
                          {msg.textTranscript ? msg.textTranscript : `🎙️ [음성 메시지: ${msg.durationSec}초]`}
                        </div>

                        {/* 음성 다시듣기 플레이어 바 */}
                        <div style={{
                          marginTop: '8px',
                          paddingTop: '6px',
                          borderTop: isMine ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.08)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px'
                        }}>
                          <span style={{ fontSize: '10.5px', color: isMine ? '#93c5fd' : '#94a3b8' }}>
                            음성 {msg.durationSec}초
                          </span>

                          <button
                            type="button"
                            onClick={() => handlePlayAudio(msg)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: isPlaying ? '#ef4444' : isMine ? '#2563eb' : '#0284c7',
                              color: '#ffffff',
                              fontSize: '11px',
                              fontWeight: '800',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            {isPlaying ? <Square size={10} fill="#ffffff" /> : <Play size={10} fill="#ffffff" />}
                            <span>{isPlaying ? '정지' : '다시듣기'}</span>
                          </button>
                        </div>
                      </div>
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
