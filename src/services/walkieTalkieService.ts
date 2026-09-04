// src/services/walkieTalkieService.ts
import { supabase } from './db';

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

  // 사용자 인터랙션(터치/클릭) 시 브라우저 오디오 권한 즉시 언락
  unlockAudioOnUserGesture() {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
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
}

export const soundEngine = new WalkieSoundEngine();

// 2. 실시간 무전기 서비스 싱글톤
class WalkieTalkieService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recordingStartTime = 0;
  private currentStream: MediaStream | null = null;

  // STT 음성 인식기 (Web Speech API)
  private speechRecognition: any = null;
  private currentTranscript = '';

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
  async startRecording(sender?: { id: string; name: string; deptName?: string }): Promise<boolean> {
    try {
      soundEngine.unlockAudioOnUserGesture();
      soundEngine.playStartBeep();
      this.audioChunks = [];
      this.recordingStartTime = Date.now();
      this.currentTranscript = '';

      // 1. 마이크 스트림 획득
      if (!this.currentStream) {
        this.currentStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          } 
        });
      }

      // 2. 🌟 STT 실시간 음성인식 초기화 (Web Speech API)
      try {
        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRec) {
          const rec = new SpeechRec();
          rec.lang = 'ko-KR';
          rec.continuous = false; // 모바일 단문 PTT 전용 (Google 음성인식 즉시 종결 모드)
          rec.interimResults = true;
          rec.maxAlternatives = 1;
          rec.onresult = (event: any) => {
            let transcriptStr = '';
            for (let i = 0; i < event.results.length; ++i) {
              transcriptStr += event.results[i][0].transcript;
            }
            this.currentTranscript = transcriptStr.trim();
          };
          rec.onerror = (e: any) => {
            console.warn('STT SpeechRec error:', e?.error);
          };
          rec.start();
          this.speechRecognition = rec;
        }
      } catch (sttErr) {
        console.warn('STT SpeechRecognition not supported or disabled:', sttErr);
      }

      // 3. 오디오 MIME 탐색
      const candidates = [
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/aac'
      ];
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

      const options = mimeType ? { mimeType } : undefined;
      this.mediaRecorder = new MediaRecorder(this.currentStream, options);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      this.mediaRecorder.start(100);

      // 4. 🌟 다른 동료들에게 "내가 지금 말하고 있습니다" 브로드캐스트
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

    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      return null;
    }

    // 2. 단기(최대 300ms) 초기 전사 대기
    const recInstance = this.speechRecognition;
    if (recInstance && !this.currentTranscript) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 300);
        const origResult = recInstance.onresult;
        recInstance.onresult = (e: any) => {
          if (origResult) origResult(e);
          clearTimeout(timer);
          resolve();
        };
      });
    }

    const durationSec = Math.max(1, Math.round((Date.now() - this.recordingStartTime) / 1000));
    const initialTranscript = this.currentTranscript.trim();
    this.currentTranscript = '';

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = async () => {
        try {
          const blob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
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

          // 3. 🌟 후속 STT 비동기 전사 완료 감지 (음성은 즉시 전송 후 텍스트 지연 도착 시 실시간 패치)
          if (recInstance) {
            const msgId = msg.id;
            const applyFinalText = (txt: string) => {
              const cleanTxt = txt.trim();
              if (cleanTxt && cleanTxt !== initialTranscript) {
                const target = this.history.find(m => m.id === msgId);
                if (target) {
                  target.textTranscript = cleanTxt;
                  this.saveHistoryToStorage();
                  this.notifyHistoryChange();
                }
                if (activeCh) {
                  activeCh.send({
                    type: 'broadcast',
                    event: 'transcript_update',
                    payload: { messageId: msgId, textTranscript: cleanTxt }
                  });
                }
              }
            };

            recInstance.onresult = (event: any) => {
              let transcriptStr = '';
              for (let i = 0; i < event.results.length; ++i) {
                transcriptStr += event.results[i][0].transcript;
              }
              applyFinalText(transcriptStr);
            };

            recInstance.onend = () => {
              this.speechRecognition = null;
            };

            // 4초 후 가비지 수거
            setTimeout(() => {
              if (this.speechRecognition === recInstance) {
                this.speechRecognition = null;
              }
            }, 4000);

            try {
              recInstance.stop();
            } catch {
              this.speechRecognition = null;
            }
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

  // 🌟 모바일 브라우저 자동재생 차단(NotAllowedError)을 원천 우회하는 Web Audio API 버퍼 재생
  async playAudio(base64: string): Promise<void> {
    try {
      // 1. DataURL -> ArrayBuffer 변환
      const res = await fetch(base64);
      const arrayBuffer = await res.arrayBuffer();

      // 2. 전역 AudioContext 획득 및 활성화
      const ctx = soundEngine.getContext();
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }

      // 3. 오디오 데이터 디코딩 (Opus, WebM, AAC, MP4 네이티브 디코딩)
      const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
        ctx.decodeAudioData(arrayBuffer, resolve, reject);
      });

      // 4. 버퍼 소스 노드를 통한 무차단 직접 출력
      return new Promise<void>((resolve) => {
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => resolve();
        source.start(0);
      });
    } catch (e) {
      console.warn('WebAudio decodeAudioData fallback to HTMLAudioElement:', e);
      // HTML5 Audio fallback
      return new Promise<void>((resolve) => {
        try {
          const audio = new Audio(base64);
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          const playPromise = audio.play();
          if (playPromise) {
            playPromise.catch(() => resolve());
          }
        } catch {
          resolve();
        }
      });
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
