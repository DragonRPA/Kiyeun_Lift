// src/services/walkieTalkieService.ts
import { supabase } from './db';

export type WalkieTalkieChannel = 'ALL' | 'DISPATCH' | 'AS' | 'SALES';

export interface WalkieMessage {
  id: string;
  channel: WalkieTalkieChannel;
  senderId: string;
  senderName: string;
  senderRole: string;
  senderDept: string;
  audioBase64: string;
  durationSec: number;
  createdAt: string;
}

export interface TalkingStatus {
  isTalking: boolean;
  channel: WalkieTalkieChannel;
  senderId: string;
  senderName: string;
  senderDept: string;
}

// 1. Web Audio API 기반 무전기 효과음 합성 엔진 (외부 오디오 파일 없이 100% 자체 합성)
class WalkieSoundEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'suspended') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

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

  // Supabase Realtime 채널 관리
  private channels: Map<WalkieTalkieChannel, any> = new Map();
  private isPowerOn = false;
  private currentChannel: WalkieTalkieChannel = 'ALL';
  private messageListeners: ((msg: WalkieMessage) => void)[] = [];

  // 🌟 순차 재생 큐 (FIFO Audio Queue) - 동시 발언 시 소리 겹침 원천 방지
  private playbackQueue: WalkieMessage[] = [];
  private isQueueProcessing = false;
  private queueListeners: ((queueLength: number) => void)[] = [];

  // 🌟 실시간 발언 상태 인디케이터 ("누가 말하고 있습니다")
  private currentTalkingStatus: TalkingStatus | null = null;
  private talkingStatusListeners: ((status: TalkingStatus | null) => void)[] = [];
  private talkingTimeoutRef: any = null;

  // 최근 무전 히스토리 (메모리 + localStorage 20건 캐시)
  private history: WalkieMessage[] = [];

  constructor() {
    try {
      const savedHist = localStorage.getItem('walkie_history_v1');
      if (savedHist) {
        this.history = JSON.parse(savedHist).slice(0, 20);
      }
      const savedPower = localStorage.getItem('walkie_power_on');
      this.isPowerOn = savedPower === 'true';
      const savedChannel = localStorage.getItem('walkie_channel') as WalkieTalkieChannel;
      if (savedChannel) {
        this.currentChannel = savedChannel;
      }
    } catch (e) {
      console.warn('Failed to load walkie storage:', e);
    }
  }

  getIsPowerOn(): boolean {
    return this.isPowerOn;
  }

  setPower(on: boolean) {
    this.isPowerOn = on;
    localStorage.setItem('walkie_power_on', on ? 'true' : 'false');
    if (on) {
      soundEngine.playStartBeep();
    } else {
      soundEngine.playEndBeep();
      this.playbackQueue = []; // 전원 끄면 대기열 초기화
    }
  }

  getCurrentChannel(): WalkieTalkieChannel {
    return this.currentChannel;
  }

  setChannel(ch: WalkieTalkieChannel) {
    this.currentChannel = ch;
    localStorage.setItem('walkie_channel', ch);
  }

  getHistory(): WalkieMessage[] {
    return this.history;
  }

  getCurrentTalkingStatus(): TalkingStatus | null {
    return this.currentTalkingStatus;
  }

  getQueueLength(): number {
    return this.playbackQueue.length;
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

        // 히스토리에 추가
        this.addHistory(msg);

        // 리스너 호출
        this.messageListeners.forEach(l => l(msg));

        // 무전기가 켜져 있고 수신 대상 채널이면 순차 재생 큐에 삽입
        if (this.isPowerOn && (this.currentChannel === msg.channel || msg.channel === 'ALL')) {
          this.enqueuePlayback(msg);
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

  private addHistory(msg: WalkieMessage) {
    this.history = [msg, ...this.history.filter(h => h.id !== msg.id)].slice(0, 20);
    try {
      localStorage.setItem('walkie_history_v1', JSON.stringify(this.history));
    } catch {
      // ignore
    }
  }

  // ── 3. PTT 음성 녹음 제어 ──
  async startRecording(sender?: { id: string; name: string; deptName?: string }): Promise<boolean> {
    try {
      soundEngine.playStartBeep();
      this.audioChunks = [];
      this.recordingStartTime = Date.now();

      if (!this.currentStream) {
        this.currentStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          } 
        });
      }

      // iOS 사파리 및 안드로이드/PC 크롬 상호 교차 재생 호환성을 위한 MIME 스마트 탐색
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

      // 🌟 다른 동료들에게 "내가 지금 말하고 있습니다" 브로드캐스트
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

    // 🌟 발언 종료 브로드캐스트
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

    const durationSec = Math.max(1, Math.round((Date.now() - this.recordingStartTime) / 1000));

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

  // 음성 재생 (Base64)
  playAudio(base64: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        const audio = new Audio(base64);
        audio.onended = () => resolve();
        audio.onerror = (err) => {
          console.warn('Audio playback error on this device/format:', err);
          resolve(); // 순차 큐 락업 방지
        };
        const playPromise = audio.play();
        if (playPromise) {
          playPromise.catch((err) => {
            console.warn('Audio play() blocked or rejected:', err);
            resolve();
          });
        }
      } catch (e) {
        console.warn('playAudio exception:', e);
        resolve();
      }
    });
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
