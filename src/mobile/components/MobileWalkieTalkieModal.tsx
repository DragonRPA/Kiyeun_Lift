// src/mobile/components/MobileWalkieTalkieModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, Volume2, VolumeX, Mic, MicOff, Play, 
  X, Clock, Layers 
} from 'lucide-react';
import { 
  walkieService, WalkieTalkieChannel, WalkieMessage, soundEngine, TalkingStatus 
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

    const unQueue = walkieService.onQueueChange((len) => {
      setQueueLength(len);
    });

    const unTalking = walkieService.onTalkingStatusChange((status) => {
      setTalkingStatus(status);
    });

    return () => {
      unMsg();
      unQueue();
      unTalking();
    };
  }, [currentUser]);

  // 타이머 정리
  useEffect(() => {
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  // 전원 토글
  const handleTogglePower = () => {
    const next = !isPowerOn;
    setIsPowerOn(next);
    walkieService.setPower(next);
  };

  // 채널 변경
  const handleSelectChannel = (ch: WalkieTalkieChannel) => {
    setCurrentChannel(ch);
    walkieService.setChannel(ch);
    soundEngine.playStartBeep();
  };

  // PTT 버튼 누름 (송신 시작)
  const handlePttDown = async (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isPowerOn) return;
    if (isTransmitting) return;

    const started = await walkieService.startRecording(
      currentUser ? {
        id: currentUser.id,
        name: currentUser.name,
        deptName: currentUser.department || '기연리프트'
      } : undefined
    );

    if (started) {
      setIsTransmitting(true);
      setRecordDuration(0);
      durationTimerRef.current = setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);
    }
  };

  // PTT 버튼 뗌 (송신 완료 및 전송)
  const handlePttUp = async (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isTransmitting) return;

    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

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
    if (playingMessageId) return;
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
          maxWidth: '420px',
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
          padding: '16px 20px',
          backgroundColor: '#1e293b',
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Radio size={20} color={isPowerOn ? '#38bdf8' : '#64748b'} />
            <span style={{ fontSize: '15px', fontWeight: '900', color: '#f8fafc' }}>
              현장 무전기 (PTT)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* 전원 ON / OFF 버튼 */}
            <button
              type="button"
              onClick={handleTogglePower}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '9999px',
                border: 'none',
                backgroundColor: isPowerOn ? '#059669' : '#475569',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              {isPowerOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
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
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* 2. 채널 선택 세그먼트 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '4px',
          padding: '8px 12px',
          backgroundColor: '#090d16',
          borderBottom: '1px solid #1e293b'
        }}>
          {CHANNELS.map((ch) => {
            const isSelected = currentChannel === ch.id;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => handleSelectChannel(ch.id)}
                style={{
                  padding: '8px 4px',
                  borderRadius: '10px',
                  border: isSelected ? '1px solid #38bdf8' : '1px solid transparent',
                  backgroundColor: isSelected ? '#1e293b' : 'transparent',
                  color: isSelected ? '#38bdf8' : '#94a3b8',
                  fontSize: '12px',
                  fontWeight: isSelected ? '800' : '600',
                  cursor: 'pointer',
                  textAlign: 'center',
                  whiteSpace: 'nowrap'
                }}
              >
                <div>{ch.code}</div>
                <div style={{ fontSize: '11px', marginTop: '2px' }}>{ch.name}</div>
              </button>
            );
          })}
        </div>

        {/* 3. 레트로 LCD 무전 상태 액정 화면 */}
        <div style={{
          margin: '16px',
          padding: '14px 16px',
          backgroundColor: isSomeoneElseTalking ? '#2a0808' : '#021814',
          border: isSomeoneElseTalking ? '2px solid #ef4444' : '2px solid #065f46',
          borderRadius: '16px',
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
              {/* 순차 재생 큐 대기 배지 */}
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
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '9999px',
                backgroundColor: isSomeoneElseTalking ? '#7f1d1d' : isPowerOn ? '#064e3b' : '#334155',
                color: isSomeoneElseTalking ? '#fecaca' : isPowerOn ? '#a7f3d0' : '#94a3b8'
              }}>
                {isSomeoneElseTalking ? '통화 중' : isPowerOn ? '수신 대기중' : '전원 꺼짐'}
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
                <span style={{ fontSize: '14px', fontWeight: '900' }}>
                  🔴 내가 송신 중... ({recordDuration}초) [말씀하세요]
                </span>
              </div>
            ) : isSomeoneElseTalking ? (
              // 🌟 "누가 말하고 있습니다" 인디케이터
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171' }}>
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '9999px',
                  backgroundColor: '#ef4444',
                  boxShadow: '0 0 10px #ef4444',
                  animation: 'pulse 1s infinite'
                }} />
                <span style={{ fontSize: '14px', fontWeight: '900' }}>
                  🔴 [{talkingStatus?.senderDept} {talkingStatus?.senderName}] 말하고 있습니다...
                </span>
              </div>
            ) : (
              <span style={{ fontSize: '12px', color: isPowerOn ? '#6ee7b7' : '#64748b' }}>
                {isPowerOn ? currentChInfo.desc : '무전기 전원을 켜면 실시간 음성을 수신할 수 있습니다.'}
              </span>
            )}
          </div>
        </div>

        {/* 4. 중앙 대형 원형 PTT (Push-To-Talk) 버튼 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 0 24px'
        }}>
          <button
            type="button"
            disabled={!isPowerOn}
            onTouchStart={handlePttDown}
            onTouchEnd={handlePttUp}
            onMouseDown={handlePttDown}
            onMouseUp={handlePttUp}
            onMouseLeave={handlePttUp}
            style={{
              width: '140px',
              height: '140px',
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
              gap: '6px',
              cursor: isPowerOn ? 'pointer' : 'not-allowed',
              userSelect: 'none',
              WebkitUserSelect: 'none',
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
              <Mic size={42} color="#ffffff" />
            ) : isSomeoneElseTalking ? (
              <Volume2 size={38} color="#fde68a" />
            ) : isPowerOn ? (
              <Radio size={38} color="#ffffff" />
            ) : (
              <MicOff size={38} color="#94a3b8" />
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

          <span style={{ fontSize: '11px', color: isSomeoneElseTalking ? '#fbbf24' : '#64748b', marginTop: '12px' }}>
            {isTransmitting 
              ? '마이크로 말씀하신 후 손을 떼시면 전송됩니다'
              : isSomeoneElseTalking 
              ? '동료가 말하고 있습니다. 발언이 끝나면 버튼을 눌러주세요'
              : isPowerOn 
              ? '버튼을 누르고 있는 동안 마이크로 말씀하세요' 
              : '상단 무전 ON 스위치를 먼저 켜주세요'}
          </span>
        </div>

        {/* 5. 최근 무전 이력 타임라인 (다시듣기) */}
        <div style={{
          borderTop: '1px solid #1e293b',
          backgroundColor: '#090d16',
          padding: '16px',
          maxHeight: '190px',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={13} />
              <span>최근 무전 내역 (다시듣기)</span>
            </span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              {history.length}건
            </span>
          </div>

          {history.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: '#475569' }}>
              아직 수신된 무전 내역이 없습니다.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {history.map((msg) => {
                const isPlaying = playingMessageId === msg.id;
                const timeStr = new Date(msg.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div
                    key={msg.id}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '12px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '12px'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '800', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: '#38bdf8', fontSize: '10px' }}>[{msg.channel}]</span>
                        <span>{msg.senderDept} {msg.senderName}</span>
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                        {timeStr} • {msg.durationSec}초 음성
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePlayAudio(msg)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: isPlaying ? '#0284c7' : '#334155',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Play size={11} fill="#ffffff" />
                      <span>{isPlaying ? '재생 중' : '다시듣기'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
