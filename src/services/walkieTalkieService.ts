// src/services/walkieTalkieService.ts
import { supabase } from './db';
import { getGeminiApiKey } from './geminiGemsService';

export type WalkieTalkieChannel = 'ALL' | 'DISPATCH' | 'AS' | 'SALES';

export type WalkieReceiveMode = 'VOICE' | 'BEEP' | 'MUTE';

export interface WalkieMessage {
  id: string;
  channel: WalkieTalkieChannel;
  senderId: string;
  senderName: string;
  senderRole: string;
  senderDept: string;
  audioBase64: string;
  durationSec: number;
  textTranscript?: string; // 🌟 STT 한국어 음성인식 전사 텍스트
  createdAt: string;
}

export interface TalkingStatus {
  isTalking: boolean;
  channel: WalkieTalkieChannel;
  senderId: string;
  senderName: string;
  senderDept: string;
}

// 1. Web Audio API 기반 무전기 효과음 및 음성 합성 재생 엔진
class WalkieSoundEngine {
  private ctx: AudioContext | null = null;

  public getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // 사용자 인터랙션(터치/클릭) 시 브라우저 오디오 권한 즉시 언락 (Web Audio + HTML5 Audio)
  unlockAudioOnUserGesture() {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      // 모바일 브라우저 HTMLAudioElement 자동재생 권한 동시 언락
      const dummy = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
      dummy.volume = 0.01;
      dummy.play().then(() => {
        dummy.pause();
      }).catch(() => {});
    } catch {
      // ignore
    }
  }

  // 송신 시작 버튼 누름음 (경쾌한 비프음)
  playStartBeep() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      console.warn('AudioContext beep failed:', e);
    }
  }

  // 송신 종료 손뗌음 (치-익 찰나 노이즈 + 비프)
  playEndBeep() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      // 1. 비프
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1320, now);
      osc.frequency.setValueAtTime(660, now + 0.05);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);

      // 2. 미세한 무전 화이트 노이즈 (버튼 뗄 때 치-익)
      const bufferSize = ctx.sampleRate * 0.06;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.05, now + 0.02);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      whiteNoise.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      whiteNoise.start(now + 0.02);
      whiteNoise.stop(now + 0.08);
    } catch (e) {
      console.warn('AudioContext end beep failed:', e);
    }
  }

  // 무전 수신 도착 시 알림음 (수신 삐빅!)
  playReceiveChime() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.setValueAtTime(1318.51, now + 0.06); // E6

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {
      console.warn('AudioContext chime failed:', e);
    }
  }

  // 발언 충돌 또는 오류 경고음 (삐-익)
  playErrorBeep() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.setValueAtTime(200, now + 0.08);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {
      console.warn('AudioContext error beep failed:', e);
    }
  }
}

export const soundEngine = new WalkieSoundEngine();

// 2. 실시간 무전기 서비스 싱글톤
class WalkieTalkieService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recordingStartTime = 0;
  private currentStream: MediaStream | null = null;
  private activeAudio: HTMLAudioElement | null = null;

  // STT 실시간 음성 인식기 (Web Speech API)
  private speechRecognition: any = null;
  private currentTranscript = '';
  private sttStatus: 'IDLE' | 'LISTENING' | 'ERROR' | 'UNSUPPORTED' = 'IDLE';
  private lastSttErrorDetail = '';
  private liveTranscriptListeners: ((transcript: string, status: 'IDLE' | 'LISTENING' | 'ERROR' | 'UNSUPPORTED', errorDetail?: string) => void)[] = [];
  private isSttOnlyMode: boolean = false;

  // Supabase Realtime 채널 관리
  private channels: Map<WalkieTalkieChannel, any> = new Map();
  private isPowerOn = true; // 기본값 ON으로 설정하여 수신 누락 방지
  private currentChannel: WalkieTalkieChannel = 'ALL';
  private receiveMode: WalkieReceiveMode = 'VOICE';
  private receiveModeListeners: ((mode: WalkieReceiveMode) => void)[] = [];
  private messageListeners: ((msg: WalkieMessage) => void)[] = [];

  // 🌟 순차 재생 큐 (FIFO Audio Queue) - 동시 발언 시 소리 겹침 원천 방지
  private playbackQueue: WalkieMessage[] = [];
  private isQueueProcessing = false;
  private queueListeners: ((queueLength: number) => void)[] = [];

  // 🌟 실시간 발언 상태 인디케이터 ("누가 말하고 있습니다")
  private currentTalkingStatus: TalkingStatus | null = null;
  private talkingStatusListeners: ((status: TalkingStatus | null) => void)[] = [];
  private talkingTimeoutRef: any = null;

  // 당일 대화 히스토리 (메모리 + localStorage 당일 누적 캐시, 건수 제한 없음)
  private history: WalkieMessage[] = [];
  private historyListeners: Array<(history: WalkieMessage[]) => void> = [];
  private dateCheckIntervalRef: any = null;

  constructor() {
    try {
      const today = this.getTodayDateStr();
      const savedHist = localStorage.getItem('walkie_today_history') || localStorage.getItem('walkie_history_v1');
      if (savedHist) {
        const parsed = JSON.parse(savedHist) as WalkieMessage[];
        // 당일 대화만 필터링 (자정 넘어가면 이전 날짜 대화 자동 소멸, 당일 건수 무제한 관리)
        this.history = parsed.filter(m => m.createdAt && m.createdAt.slice(0, 10) === today);
        // 이전 일자 잔여 데이터가 존재하면 스토리지 즉시 정비 동기화
        if (parsed.length !== this.history.length) {
          this.saveHistoryToStorage();
        }
      }
      const savedPower = localStorage.getItem('walkie_power_on');
      // 기본값: 사용자가 명시적으로 끈 적 없으면 켜진 상태 유지
      this.isPowerOn = savedPower === 'false' ? false : true;
      const savedRecMode = localStorage.getItem('walkie_receive_mode') as WalkieReceiveMode;
      if (savedRecMode && ['VOICE', 'BEEP', 'MUTE'].includes(savedRecMode)) {
        this.receiveMode = savedRecMode;
      }
      const savedChannel = localStorage.getItem('walkie_channel') as WalkieTalkieChannel;
      if (savedChannel) {
        this.currentChannel = savedChannel;
      }

      // 일자 변경(자정) 자동 감지: 1분마다 주기 점검하여 날짜 변경 시 이전 날짜 대화 즉시 제거
      if (typeof window !== 'undefined') {
        this.dateCheckIntervalRef = setInterval(() => {
          this.purgeOldHistoryIfNeeded();
        }, 60000);
      }
    } catch (e) {
      console.warn('Failed to load walkie storage:', e);
    }
  }

  // 오늘 날짜 YYYY-MM-DD 문자열 반환 (로컬 시간 기준)
  public getTodayDateStr(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getIsPowerOn(): boolean {
    return this.isPowerOn;
  }

  setPower(on: boolean) {
    this.isPowerOn = on;
    localStorage.setItem('walkie_power_on', on ? 'true' : 'false');
    if (on) {
      soundEngine.unlockAudioOnUserGesture();
      soundEngine.playStartBeep();
    } else {
      soundEngine.playEndBeep();
      this.playbackQueue = []; // 전원 끄면 대기열 초기화
    }
  }

  getReceiveMode(): WalkieReceiveMode {
    return this.receiveMode;
  }

  setReceiveMode(mode: WalkieReceiveMode) {
    this.receiveMode = mode;
    localStorage.setItem('walkie_receive_mode', mode);
    this.receiveModeListeners.forEach(l => l(mode));
    if (mode === 'BEEP') {
      soundEngine.playStartBeep();
    } else if (mode === 'VOICE') {
      soundEngine.playReceiveChime();
    }
  }

  onReceiveModeChange(listener: (mode: WalkieReceiveMode) => void) {
    this.receiveModeListeners.push(listener);
    return () => {
      this.receiveModeListeners = this.receiveModeListeners.filter(l => l !== listener);
    };
  }

  getCurrentChannel(): WalkieTalkieChannel {
    return this.currentChannel;
  }

  setChannel(ch: WalkieTalkieChannel) {
    this.currentChannel = ch;
    localStorage.setItem('walkie_channel', ch);
  }

  getHistory(): WalkieMessage[] {
    this.purgeOldHistoryIfNeeded();
    return this.history;
  }

  getCurrentTalkingStatus(): TalkingStatus | null {
    return this.currentTalkingStatus;
  }

  getQueueLength(): number {
    return this.playbackQueue.length;
  }

  unlockAudio() {
    soundEngine.unlockAudioOnUserGesture();
  }

  // Supabase Realtime 채널 구독
  subscribe(_user?: { id: string; name: string; role: string; deptName?: string }) {
    const client = supabase;
    if (!client) {
      console.warn('Supabase client not available for Walkie-Talkie');
      return;
    }

    const channelList: WalkieTalkieChannel[] = ['ALL', 'DISPATCH', 'AS', 'SALES'];

    channelList.forEach(ch => {
      if (this.channels.has(ch)) return;

      const chName = `walkie_${ch}`;
      const channel = client.channel(chName, {
        config: {
          broadcast: { self: false }
        }
      });

      // 1. 음성 메시지 브로드캐스트 수신 ➔ 순차 큐(Queue)로 인입
      channel.on('broadcast', { event: 'voice' }, async ({ payload }) => {
        const msg = payload as WalkieMessage;
        if (!msg || !msg.audioBase64) return;

        // 당일 히스토리에 무조건 추가
        this.addHistory(msg);

        // 리스너 호출 (UI 업데이트: 채팅로그에 즉시 말풍선 노출)
        this.messageListeners.forEach(l => l(msg));

        // 🌟 수신자 트리거 조건 및 3대 수신 모드 분기:
        // 1. 무전기 전원이 ON 상태여야 함 (isPowerOn)
        // 2. 메시지 채널이 내 채널과 일치하거나 전체(ALL) 공용 무전이어야 함
        if (this.isPowerOn && (this.currentChannel === msg.channel || msg.channel === 'ALL')) {
          if (this.receiveMode === 'VOICE') {
            // 1) 실시간 음성 모드: 차임 후 스피커 자동 방송
            this.enqueuePlayback(msg);
          } else if (this.receiveMode === 'BEEP') {
            // 2) 비프 알림 모드: 음성은 스피커로 내지 않고 "삑" 알림음만 울려 텍스트 확인 유도
            try {
              soundEngine.playStartBeep();
              if (navigator.vibrate) navigator.vibrate(150);
            } catch {}
          } else if (this.receiveMode === 'MUTE') {
            // 3) 완전 무음 모드: 소리 일절 없음 (조용한 미세 진동만 지원)
            try {
              if (navigator.vibrate) navigator.vibrate([80, 50, 80]);
            } catch {}
          }
        }
      });

      // 2. 실시간 발언 상태 ("누가 말하고 있습니다") 수신
      channel.on('broadcast', { event: 'talking_status' }, ({ payload }) => {
        const status = payload as TalkingStatus;
        if (status && status.isTalking) {
          this.currentTalkingStatus = status;
          this.talkingStatusListeners.forEach(l => l(status));

          // 15초 이상 릴리즈 안 되면 안전 타임아웃
          if (this.talkingTimeoutRef) clearTimeout(this.talkingTimeoutRef);
          this.talkingTimeoutRef = setTimeout(() => {
            this.currentTalkingStatus = null;
            this.talkingStatusListeners.forEach(l => l(null));
          }, 15000);
        } else {
          if (this.currentTalkingStatus?.senderId === status?.senderId) {
            this.currentTalkingStatus = null;
            this.talkingStatusListeners.forEach(l => l(null));
            if (this.talkingTimeoutRef) clearTimeout(this.talkingTimeoutRef);
          }
        }
      });

      // 3. 🌟 STT 전사 텍스트 비동기 후속 업데이트 수신
      channel.on('broadcast', { event: 'transcript_update' }, ({ payload }) => {
        const { messageId, textTranscript } = payload || {};
        if (!messageId || !textTranscript) return;
        const target = this.history.find(m => m.id === messageId);
        if (target) {
          target.textTranscript = textTranscript;
          this.saveHistoryToStorage();
          this.notifyHistoryChange();
        }
      });

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Walkie channel ${chName} subscribed.`);
        }
      });

      this.channels.set(ch, channel);
    });
  }

  // ── 🌟 순차 재생 큐 (FIFO Queue) 처리 ──
  private enqueuePlayback(msg: WalkieMessage) {
    this.playbackQueue.push(msg);
    this.notifyQueueChange();
    this.processPlaybackQueue();
  }

  private async processPlaybackQueue() {
    if (this.isQueueProcessing) return;
    if (this.playbackQueue.length === 0) return;

    this.isQueueProcessing = true;
    const nextMsg = this.playbackQueue.shift();
    this.notifyQueueChange();

    if (nextMsg) {
      try {
        soundEngine.playReceiveChime();
        await new Promise(r => setTimeout(r, 180));
        await this.playAudio(nextMsg.audioBase64);
        await new Promise(r => setTimeout(r, 220)); // 메시지 간 0.22초 자연스러운 여운
      } catch (e) {
        console.warn('Queue playback audio failed:', e);
      }
    }

    this.isQueueProcessing = false;

    // 대기열에 다음 음성이 남아있으면 즉시 이어서 재생!
    if (this.playbackQueue.length > 0) {
      this.processPlaybackQueue();
    }
  }

  private notifyQueueChange() {
    this.queueListeners.forEach(l => l(this.playbackQueue.length));
  }

  onQueueChange(listener: (queueLength: number) => void) {
    this.queueListeners.push(listener);
    return () => {
      this.queueListeners = this.queueListeners.filter(l => l !== listener);
    };
  }

  onTalkingStatusChange(listener: (status: TalkingStatus | null) => void) {
    this.talkingStatusListeners.push(listener);
    return () => {
      this.talkingStatusListeners = this.talkingStatusListeners.filter(l => l !== listener);
    };
  }

  onMessage(listener: (msg: WalkieMessage) => void) {
    this.messageListeners.push(listener);
    return () => {
      this.messageListeners = this.messageListeners.filter(l => l !== listener);
    };
  }

  // 날짜 변경 시 이전 날짜 대화 즉시 일괄 제거 (당일 대화만 전량 보존)
  public purgeOldHistoryIfNeeded(): boolean {
    const today = this.getTodayDateStr();
    const hasOld = this.history.some(m => !m.createdAt || m.createdAt.slice(0, 10) !== today);
    if (hasOld) {
      this.history = this.history.filter(m => m.createdAt && m.createdAt.slice(0, 10) === today);
      this.saveHistoryToStorage();
      this.notifyHistoryChange();
      return true;
    }
    return false;
  }

  // 스토리지 안전 저장 (브라우저 할당량 초과 시 과거 음성은 경량화하되 텍스트/메타데이터는 당일 전량 100% 보존)
  private saveHistoryToStorage() {
    try {
      localStorage.setItem('walkie_today_history', JSON.stringify(this.history));
    } catch (e) {
      console.warn('localStorage quota exceeded, saving full metadata with compressed older audios:', e);
      try {
        // 용량 초과 시 최근 25건만 음성 유지하고 이전 대화는 audioBase64만 비워 텍스트/시간/발신자 전량 영구 유지
        const compressed = this.history.map((m, idx) => {
          if (idx < 25) return m;
          return { ...m, audioBase64: '' };
        });
        localStorage.setItem('walkie_today_history', JSON.stringify(compressed));
      } catch (e2) {
        console.error('Failed to save compressed walkie history:', e2);
      }
    }
  }

  private notifyHistoryChange() {
    for (const listener of this.historyListeners) {
      try {
        listener(this.history);
      } catch (e) {
        console.warn('Error in historyListener:', e);
      }
    }
  }

  onHistoryChange(listener: (history: WalkieMessage[]) => void) {
    this.historyListeners.push(listener);
    return () => {
      this.historyListeners = this.historyListeners.filter(l => l !== listener);
    };
  }

  clearTodayHistory() {
    this.history = [];
    try {
      localStorage.removeItem('walkie_today_history');
    } catch {}
    this.notifyHistoryChange();
  }

  isSttSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  onLiveTranscript(callback: (transcript: string, status: 'IDLE' | 'LISTENING' | 'ERROR' | 'UNSUPPORTED', errorDetail?: string) => void) {
    this.liveTranscriptListeners.push(callback);
    return () => {
      this.liveTranscriptListeners = this.liveTranscriptListeners.filter(cb => cb !== callback);
    };
  }

  private notifyLiveTranscript(text: string, status: 'IDLE' | 'LISTENING' | 'ERROR' | 'UNSUPPORTED', errorDetail?: string) {
    this.sttStatus = status;
    if (errorDetail) this.lastSttErrorDetail = errorDetail;
    this.liveTranscriptListeners.forEach(cb => {
      try {
        cb(text, status, errorDetail);
      } catch {}
    });
  }

  private addHistory(msg: WalkieMessage) {
    this.purgeOldHistoryIfNeeded();
    const today = this.getTodayDateStr();
    // 당일 대화만 누적 보존 (건수 제한 없이 전건 관리)
    if (msg.createdAt && msg.createdAt.slice(0, 10) === today) {
      this.history = [msg, ...this.history.filter(h => h.id !== msg.id)];
      this.saveHistoryToStorage();
      this.notifyHistoryChange();
    }
  }

  // ── 3. PTT 음성 녹음 제어 ──
  async startRecording(
    sender?: { id: string; name: string; deptName?: string },
    options?: { sttOnly?: boolean }
  ): Promise<boolean> {
    try {
      soundEngine.unlockAudioOnUserGesture();
      soundEngine.playStartBeep();
      this.audioChunks = [];
      this.recordingStartTime = Date.now();
      this.currentTranscript = '';
      this.isSttOnlyMode = Boolean(options?.sttOnly);

      // 1. 일반 무전 모드(!isSttOnlyMode): 마이크 하드웨어 스트림 및 MediaRecorder를 최우선 선제 가동
      // (안드로이드 OS 마이크 하드웨어 파이프라인을 미디어레코더가 안정적으로 확보하도록 보장)
      if (!this.isSttOnlyMode) {
        if (!this.currentStream) {
          this.currentStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            } 
          });
        }

        // 🌟 모바일 OS별 최적 코덱 선별:
        // 안드로이드 크롬/PC는 WebM Opus가 절대 표준 (audio/mp4는 크롬에서 재생 불가 fMP4를 생성하므로 제외)
        // iOS 사파리만 audio/mp4 선별
        const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const candidates = isSafari
          ? ['audio/mp4', 'audio/aac']
          : ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];

        let mimeType = '';
        if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
          mimeType = candidates.find(type => {
            try {
              return MediaRecorder.isTypeSupported(type);
            } catch {
              return false;
            }
          }) || '';
        }

        const opts = mimeType ? { mimeType } : undefined;
        this.mediaRecorder = new MediaRecorder(this.currentStream, opts);

        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            this.audioChunks.push(e.data);
          }
        };

        this.mediaRecorder.start(100);
      }

      // 2. 🌟 STT 실시간 음성인식 초기화 (Web Speech API)
      // 독백의뢰 모드에서는 단독 구동되며, 일반 무전 모드에서도 지원 시 보조 전사로 작동
      try {
        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRec) {
          const rec = new SpeechRec();
          rec.lang = 'ko-KR';
          rec.continuous = false;
          rec.interimResults = true;
          rec.maxAlternatives = 1;

          rec.onstart = () => {
            this.notifyLiveTranscript('', 'LISTENING');
          };

          rec.onresult = (event: any) => {
            let transcriptStr = '';
            for (let i = 0; i < event.results.length; ++i) {
              transcriptStr += event.results[i][0].transcript;
            }
            this.currentTranscript = transcriptStr.trim();
            this.notifyLiveTranscript(this.currentTranscript, 'LISTENING');
          };

          rec.onerror = (e: any) => {
            const err = e?.error || 'error';
            console.warn('STT SpeechRec error:', err);
            // 안드로이드에서 getUserMedia와의 마이크 경합으로 인한 audio-capture 등 발생 시 상태 알림
            this.notifyLiveTranscript(this.currentTranscript, 'ERROR', err);
          };

          rec.onend = () => {
            // 발화 감지 종료 시 유지
          };

          try {
            rec.start();
            this.speechRecognition = rec;
            this.notifyLiveTranscript('', 'LISTENING');
          } catch (sttStartErr: any) {
            console.warn('rec.start failed:', sttStartErr);
            this.notifyLiveTranscript('', 'ERROR', sttStartErr?.message || 'start_failed');
          }
        } else {
          this.notifyLiveTranscript('', 'UNSUPPORTED', '브라우저 음성인식 미지원');
        }
      } catch (sttErr: any) {
        console.warn('STT SpeechRecognition init error:', sttErr);
        this.notifyLiveTranscript('', 'ERROR', sttErr?.message || 'init_failed');
      }

      // 3. 🌟 다른 동료들에게 "내가 지금 말하고 있습니다" 브로드캐스트
      if (sender) {
        const activeCh = this.channels.get(this.currentChannel);
        if (activeCh) {
          activeCh.send({
            type: 'broadcast',
            event: 'talking_status',
            payload: {
              isTalking: true,
              channel: this.currentChannel,
              senderId: sender.id,
              senderName: sender.name,
              senderDept: sender.deptName || '기연리프트'
            }
          });
        }
      }

      return true;
    } catch (err) {
      console.error('Failed to start recording:', err);
      return false;
    }
  }

  // PTT 버튼 뗐을 때: 녹음 중지 후 Supabase 전송
  async stopAndSend(
    sender: { id: string; name: string; role: string; deptName?: string },
    targetChannel?: WalkieTalkieChannel
  ): Promise<WalkieMessage | null> {
    soundEngine.playEndBeep();

    // 1. 발언 종료 브로드캐스트
    const ch = targetChannel || this.currentChannel;
    const activeCh = this.channels.get(ch);
    if (activeCh) {
      activeCh.send({
        type: 'broadcast',
        event: 'talking_status',
        payload: {
          isTalking: false,
          channel: ch,
          senderId: sender.id
        }
      });
    }

    // 2. 🌟 STT 음성인식기 강제 플러시 (종료 명령을 내려야 구글 음성인식이 최종 텍스트를 방출함)
    const recInstance = this.speechRecognition;
    if (recInstance) {
      try {
        recInstance.stop();
      } catch {}
      if (!this.currentTranscript) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 450);
          recInstance.onresult = (event: any) => {
            let transcriptStr = '';
            for (let i = 0; i < event.results.length; ++i) {
              transcriptStr += event.results[i][0].transcript;
            }
            if (transcriptStr.trim()) {
              this.currentTranscript = transcriptStr.trim();
            }
            clearTimeout(timer);
            resolve();
          };
          recInstance.onend = () => {
            clearTimeout(timer);
            resolve();
          };
        });
      }
    }

    const durationSec = Math.max(1, Math.round((Date.now() - this.recordingStartTime) / 1000));
    const initialTranscript = this.currentTranscript.trim();
    this.currentTranscript = '';

    // 3. 🌟 sttOnly 모드 (독백의뢰 등) 즉시 완료 처리
    if (this.isSttOnlyMode) {
      this.isSttOnlyMode = false;
      this.speechRecognition = null;
      this.notifyLiveTranscript('', 'IDLE');

      const msg: WalkieMessage = {
        id: `walkie-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        channel: ch,
        senderId: sender.id,
        senderName: sender.name,
        senderRole: sender.role,
        senderDept: sender.deptName || '기연리프트',
        audioBase64: '',
        durationSec: durationSec,
        textTranscript: initialTranscript || undefined,
        createdAt: new Date().toISOString()
      };

      this.addHistory(msg);
      if (activeCh) {
        await activeCh.send({
          type: 'broadcast',
          event: 'voice',
          payload: msg
        });
      }
      return msg;
    }

    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      return null;
    }

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = async () => {
        try {
          // 마이크 스트림 트랙 완전 해제 (안드로이드 OS 마이크 영구 독점 방지)
          if (this.currentStream) {
            try {
              this.currentStream.getTracks().forEach(t => t.stop());
            } catch {}
            this.currentStream = null;
          }

          const mime = this.mediaRecorder?.mimeType || 'audio/webm';
          const blob = new Blob(this.audioChunks, { type: mime });
          console.log(`🎙️ [PTT] Recorded chunks: ${this.audioChunks.length}, total blob size: ${blob.size} bytes (${mime})`);

          if (blob.size < 200) {
            console.error(`🚨 [PTT] Recorded audio is too small (${blob.size} bytes)! Microphone may have been muted or blocked.`);
          }

          const base64 = await this.blobToBase64(blob);

          const msg: WalkieMessage = {
            id: `walkie-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            channel: ch,
            senderId: sender.id,
            senderName: sender.name,
            senderRole: sender.role,
            senderDept: sender.deptName || '기연리프트',
            audioBase64: base64,
            durationSec: durationSec,
            textTranscript: initialTranscript || undefined,
            createdAt: new Date().toISOString()
          };

          this.addHistory(msg);

          if (activeCh) {
            await activeCh.send({
              type: 'broadcast',
              event: 'voice',
              payload: msg
            });
          }

          this.speechRecognition = null;
          this.notifyLiveTranscript('', 'IDLE');

          // 🌟 Web Speech API에서 전사 텍스트가 추출되지 않았을 때, Gemini API 키가 있으면 비동기 음성 전사(STT) 보강 수행
          if (!msg.textTranscript && blob.size >= 500) {
            this.tryGeminiTranscription(msg.id, base64, ch);
          }

          resolve(msg);
        } catch (e) {
          console.error('Failed to encode and send walkie message:', e);
          resolve(null);
        }
      };

      this.mediaRecorder?.stop();
    });
  }

  // 녹음 취소
  cancelRecording(senderId?: string) {
    if (this.speechRecognition) {
      try {
        this.speechRecognition.stop();
      } catch {}
      this.speechRecognition = null;
    }
    this.currentTranscript = '';

    if (senderId) {
      const activeCh = this.channels.get(this.currentChannel);
      if (activeCh) {
        activeCh.send({
          type: 'broadcast',
          event: 'talking_status',
          payload: {
            isTalking: false,
            channel: this.currentChannel,
            senderId: senderId
          }
        });
      }
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.stop();
    }
    soundEngine.playEndBeep();
  }

  // 재생 중인 오디오 즉시 정지
  stopAudio() {
    if (this.activeAudio) {
      try {
        this.activeAudio.pause();
        this.activeAudio.currentTime = 0;
      } catch {}
      this.activeAudio = null;
    }
  }

  // 🌟 모바일 브라우저 즉시 재생 (사용자 인터랙션 제스처 토큰 보존 & WebM Opus / MP4 네이티브 다이렉트 재생)
  async playAudio(base64: string): Promise<void> {
    if (!base64 || base64.trim().length < 50) {
      throw new Error('음성 데이터가 비어있습니다.');
    }

    // 기존 재생 중인 오디오가 있다면 정지
    this.stopAudio();

    return new Promise<void>((resolve, reject) => {
      try {
        const audio = new Audio();
        this.activeAudio = audio;
        audio.preload = 'auto';
        audio.volume = 1.0;

        let isFinished = false;
        const cleanup = () => {
          if (isFinished) return;
          isFinished = true;
          if (this.activeAudio === audio) {
            this.activeAudio = null;
          }
        };

        audio.onended = () => {
          cleanup();
          resolve();
        };

        audio.onerror = (e) => {
          cleanup();
          const errCode = audio.error ? audio.error.code : 'unknown';
          const errMsg = audio.error ? audio.error.message : '';
          console.error(`Audio playback error (code ${errCode}):`, errMsg, e);
          reject(new Error(`오디오 재생 실패 (코드: ${errCode})`));
        };

        // base64 src 설정 및 즉시 동기 재생 (사용자 제스처 컨텍스트 100% 유지)
        audio.src = base64;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((playErr) => {
            cleanup();
            console.error('audio.play() rejected:', playErr);
            reject(playErr);
          });
        }
      } catch (err) {
        if (this.activeAudio) {
          this.activeAudio = null;
        }
        reject(err);
      }
    });
  }

  // 🌟 Gemini 1.5 Flash를 활용한 고정밀 비동기 한국어 음성 전사(STT) 헬퍼
  private async tryGeminiTranscription(messageId: string, audioBase64: string, channel: WalkieTalkieChannel) {
    try {
      const apiKey = getGeminiApiKey();
      if (!apiKey) return;

      const base64Data = audioBase64.replace(/^data:audio\/[^;]+;base64,/, '');
      const mimeMatch = audioBase64.match(/^data:(audio\/[^;]+);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'audio/webm';

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              },
              {
                text: "이 음성 메시지의 한국어 발언 내용을 사족 없이 말한 내용 그대로만 텍스트로 적어줘."
              }
            ]
          }
        ]
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) return;
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (text) {
        console.log(`🎙️ [Gemini STT] Transcription for ${messageId}: "${text}"`);
        const target = this.history.find(m => m.id === messageId);
        if (target) {
          target.textTranscript = text;
          this.saveHistoryToStorage();
          this.notifyHistoryChange();
        }

        const activeCh = this.channels.get(channel);
        if (activeCh) {
          activeCh.send({
            type: 'broadcast',
            event: 'transcript_update',
            payload: { messageId, textTranscript: text }
          });
        }
      }
    } catch (e) {
      console.warn('Gemini audio transcription failed:', e);
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

export const walkieService = new WalkieTalkieService();
