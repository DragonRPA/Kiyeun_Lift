// src/services/walkieTalkieService.ts
// Build.140 - Full redesign
// STT: Gemini 2.0 Flash (webm direct), no SpeechRecognition, self=false bypass

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
  textTranscript?: string;
  createdAt: string;
}

export interface TalkingStatus {
  isTalking: boolean;
  channel: WalkieTalkieChannel;
  senderId: string;
  senderName: string;
  senderDept: string;
}

class WalkieSoundEngine {
  private ctx: AudioContext | null = null;

  getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  unlockAudioOnUserGesture() {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const dummy = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
      dummy.volume = 0.01;
      dummy.play().then(() => dummy.pause()).catch(() => {});
    } catch { /* ignore */ }
  }

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
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1);
    } catch (e) { console.warn('beep failed:', e); }
  }

  playEndBeep() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1320, now);
      osc.frequency.setValueAtTime(660, now + 0.05);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.1);
      const bufferSize = ctx.sampleRate * 0.06;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.05, now + 0.02);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      noise.connect(nGain); nGain.connect(ctx.destination);
      noise.start(now + 0.02); noise.stop(now + 0.08);
    } catch (e) { console.warn('end beep failed:', e); }
  }

  playReceiveChime() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(987.77, now);
      osc.frequency.setValueAtTime(1318.51, now + 0.06);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.15);
    } catch (e) { console.warn('chime failed:', e); }
  }

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
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.2);
    } catch (e) { console.warn('error beep failed:', e); }
  }
}

export const soundEngine = new WalkieSoundEngine();

class WalkieTalkieService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recordingStartTime = 0;
  private currentStream: MediaStream | null = null;
  private activeAudio: HTMLAudioElement | null = null;
  private playbackQueue: WalkieMessage[] = [];
  private isQueueProcessing = false;
  private queueListeners: ((len: number) => void)[] = [];
  private channels: Map<WalkieTalkieChannel, any> = new Map();
  private isPowerOn = true;
  private currentChannel: WalkieTalkieChannel = 'ALL';
  private receiveMode: WalkieReceiveMode = 'VOICE';
  private currentTalkingStatus: TalkingStatus | null = null;
  private talkingStatusListeners: ((status: TalkingStatus | null) => void)[] = [];
  private talkingTimeoutRef: any = null;
  private messageListeners: ((msg: WalkieMessage) => void)[] = [];
  private historyListeners: ((history: WalkieMessage[]) => void)[] = [];
  private receiveModeListeners: ((mode: WalkieReceiveMode) => void)[] = [];
  private liveTranscriptListeners: ((t: string, s: 'IDLE'|'LISTENING'|'ERROR'|'UNSUPPORTED', e?: string) => void)[] = [];
  private sttInProgress = false;
  private history: WalkieMessage[] = [];

  constructor() {
    try {
      const today = this.getTodayDateStr();
      const saved = localStorage.getItem('walkie_today_history');
      if (saved) {
        const parsed = JSON.parse(saved) as WalkieMessage[];
        this.history = parsed.filter(m => m.createdAt?.slice(0, 10) === today);
        if (parsed.length !== this.history.length) this.saveHistoryToStorage();
      }
      const savedPower = localStorage.getItem('walkie_power_on');
      this.isPowerOn = savedPower === 'false' ? false : true;
      const savedMode = localStorage.getItem('walkie_receive_mode') as WalkieReceiveMode;
      if (savedMode && ['VOICE', 'BEEP', 'MUTE'].includes(savedMode)) this.receiveMode = savedMode;
      const savedCh = localStorage.getItem('walkie_channel') as WalkieTalkieChannel;
      if (savedCh) this.currentChannel = savedCh;
      if (typeof window !== 'undefined') {
        setInterval(() => this.purgeOldHistoryIfNeeded(), 60000);
      }
    } catch (e) { console.warn('walkie init error:', e); }
  }

  getTodayDateStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  purgeOldHistoryIfNeeded(): boolean {
    const today = this.getTodayDateStr();
    const hasOld = this.history.some(m => !m.createdAt || m.createdAt.slice(0,10) !== today);
    if (hasOld) {
      this.history = this.history.filter(m => m.createdAt?.slice(0,10) === today);
      this.saveHistoryToStorage();
      this.notifyHistoryChange();
      return true;
    }
    return false;
  }

  getIsPowerOn() { return this.isPowerOn; }
  setPower(on: boolean) {
    this.isPowerOn = on;
    localStorage.setItem('walkie_power_on', on ? 'true' : 'false');
    if (on) { soundEngine.unlockAudioOnUserGesture(); soundEngine.playStartBeep(); }
    else { soundEngine.playEndBeep(); this.playbackQueue = []; }
  }

  getCurrentChannel() { return this.currentChannel; }
  setChannel(ch: WalkieTalkieChannel) { this.currentChannel = ch; localStorage.setItem('walkie_channel', ch); }

  getReceiveMode() { return this.receiveMode; }
  setReceiveMode(mode: WalkieReceiveMode) {
    this.receiveMode = mode;
    localStorage.setItem('walkie_receive_mode', mode);
    this.receiveModeListeners.forEach(l => l(mode));
    if (mode === 'BEEP') soundEngine.playStartBeep();
    else if (mode === 'VOICE') soundEngine.playReceiveChime();
  }

  getHistory() { this.purgeOldHistoryIfNeeded(); return this.history; }

  private addHistory(msg: WalkieMessage) {
    this.purgeOldHistoryIfNeeded();
    const today = this.getTodayDateStr();
    if (msg.createdAt?.slice(0,10) === today) {
      this.history = [msg, ...this.history.filter(h => h.id !== msg.id)];
      this.saveHistoryToStorage();
      this.notifyHistoryChange();
    }
  }

  private saveHistoryToStorage() {
    try {
      localStorage.setItem('walkie_today_history', JSON.stringify(this.history));
    } catch {
      try {
        const compressed = this.history.map((m, i) => i < 20 ? m : { ...m, audioBase64: '' });
        localStorage.setItem('walkie_today_history', JSON.stringify(compressed));
      } catch (e2) { console.error('walkie save failed:', e2); }
    }
  }

  clearTodayHistory() {
    this.history = [];
    try { localStorage.removeItem('walkie_today_history'); } catch {}
    this.notifyHistoryChange();
  }

  private notifyHistoryChange() { this.historyListeners.forEach(l => { try { l(this.history); } catch {} }); }

  onHistoryChange(l: (h: WalkieMessage[]) => void) {
    this.historyListeners.push(l);
    return () => { this.historyListeners = this.historyListeners.filter(x => x !== l); };
  }
  onMessage(l: (m: WalkieMessage) => void) {
    this.messageListeners.push(l);
    return () => { this.messageListeners = this.messageListeners.filter(x => x !== l); };
  }
  onReceiveModeChange(l: (m: WalkieReceiveMode) => void) {
    this.receiveModeListeners.push(l);
    return () => { this.receiveModeListeners = this.receiveModeListeners.filter(x => x !== l); };
  }
  onTalkingStatusChange(l: (s: TalkingStatus | null) => void) {
    this.talkingStatusListeners.push(l);
    return () => { this.talkingStatusListeners = this.talkingStatusListeners.filter(x => x !== l); };
  }
  onQueueChange(l: (n: number) => void) {
    this.queueListeners.push(l);
    return () => { this.queueListeners = this.queueListeners.filter(x => x !== l); };
  }
  onLiveTranscript(l: (t: string, s: 'IDLE'|'LISTENING'|'ERROR'|'UNSUPPORTED', e?: string) => void) {
    this.liveTranscriptListeners.push(l);
    return () => { this.liveTranscriptListeners = this.liveTranscriptListeners.filter(x => x !== l); };
  }

  getCurrentTalkingStatus() { return this.currentTalkingStatus; }
  getQueueLength() { return this.playbackQueue.length; }
  isSttSupported() { return true; }
  unlockAudio() { soundEngine.unlockAudioOnUserGesture(); }

  subscribe(_user?: { id: string; name: string; role: string; deptName?: string }) {
    if (!supabase) { console.warn('Supabase unavailable'); return; }

    const allChannels: WalkieTalkieChannel[] = ['ALL', 'DISPATCH', 'AS', 'SALES'];
    allChannels.forEach(ch => {
      if (this.channels.has(ch)) return;

      const channel = supabase!.channel(`walkie_${ch}`, {
        config: { broadcast: { self: false } }
      });

      channel.on('broadcast', { event: 'voice' }, async ({ payload }: { payload: any }) => {
        const msg = payload as WalkieMessage;
        if (!msg?.id || !msg?.audioBase64) return;
        this.addHistory(msg);
        this.messageListeners.forEach(l => l(msg));
        if (this.isPowerOn && (this.currentChannel === msg.channel || msg.channel === 'ALL')) {
          if (this.receiveMode === 'VOICE') {
            this.enqueuePlayback(msg);
          } else if (this.receiveMode === 'BEEP') {
            try { soundEngine.playStartBeep(); if (navigator.vibrate) navigator.vibrate(150); } catch {}
          } else if (this.receiveMode === 'MUTE') {
            try { if (navigator.vibrate) navigator.vibrate([80, 50, 80]); } catch {}
          }
        }
      });

      channel.on('broadcast', { event: 'talking_status' }, ({ payload }: { payload: any }) => {
        const status = payload as TalkingStatus;
        if (status?.isTalking) {
          this.currentTalkingStatus = status;
          this.talkingStatusListeners.forEach(l => l(status));
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

      // STT 전사 수신 (수신자 측 처리)
      // 발신자 자신은 self=false라서 이 이벤트를 받지 못하므로
      // 발신자는 runGeminiStt 내에서 applyTranscriptLocally()로 직접 처리
      channel.on('broadcast', { event: 'transcript_update' }, ({ payload }: { payload: any }) => {
        const { messageId, textTranscript } = payload || {};
        if (!messageId || !textTranscript) return;
        this.applyTranscriptLocally(messageId, textTranscript);
      });

      channel.subscribe((status: any) => {
        if (status === 'SUBSCRIBED') console.log(`[Walkie] walkie_${ch} subscribed`);
      });

      this.channels.set(ch, channel);
    });
  }

  private enqueuePlayback(msg: WalkieMessage) {
    this.playbackQueue.push(msg);
    this.queueListeners.forEach(l => l(this.playbackQueue.length));
    this.processPlaybackQueue();
  }

  private async processPlaybackQueue() {
    if (this.isQueueProcessing || this.playbackQueue.length === 0) return;
    this.isQueueProcessing = true;
    const msg = this.playbackQueue.shift()!;
    this.queueListeners.forEach(l => l(this.playbackQueue.length));
    try {
      soundEngine.playReceiveChime();
      await new Promise(r => setTimeout(r, 180));
      await this.playAudio(msg.audioBase64);
      await new Promise(r => setTimeout(r, 220));
    } catch (e) { console.warn('playback failed:', e); }
    this.isQueueProcessing = false;
    if (this.playbackQueue.length > 0) this.processPlaybackQueue();
  }

  // options.sttOnly: 음성 전송 없이 STT 텍스트만 추출하는 독백의뢰 모드
  async startRecording(
    sender?: { id: string; name: string; deptName?: string },
    options?: { sttOnly?: boolean }
  ): Promise<boolean> {
    const sttOnly = options?.sttOnly ?? false;
    try {
      soundEngine.unlockAudioOnUserGesture();
      soundEngine.playStartBeep();
      this.audioChunks = [];
      this.recordingStartTime = Date.now();

      if (!this.currentStream) {
        this.currentStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
      }

      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      const candidates = isSafari
        ? ['audio/mp4', 'audio/aac']
        : ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      const mimeType = candidates.find(t => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) || '';

      this.mediaRecorder = new MediaRecorder(this.currentStream, mimeType ? { mimeType } : undefined);
      this.mediaRecorder.ondataavailable = (e) => { if (e.data?.size > 0) this.audioChunks.push(e.data); };
      this.mediaRecorder.start(100);

      // sttOnly 모드가 아닐 때만 발언 상태 브로드캐스트
      if (!sttOnly && sender) {
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
              senderDept: sender.deptName || '\uae30\uc5f0\ub9ac\ud504\ud2b8'
            }
          });
        }
      }

      this.liveTranscriptListeners.forEach(l => { try { l('', 'LISTENING'); } catch {} });
      return true;
    } catch (err) {
      console.error('startRecording failed:', err);
      return false;
    }
  }

  async stopAndSend(
    sender: { id: string; name: string; role: string; deptName?: string },
    targetChannel?: WalkieTalkieChannel,
    opts?: { sttOnly?: boolean }
  ): Promise<WalkieMessage | null> {
    soundEngine.playEndBeep();
    const ch = targetChannel || this.currentChannel;
    const activeCh = this.channels.get(ch);
    const sttOnly = opts?.sttOnly ?? false;

    if (!sttOnly && activeCh) {
      activeCh.send({
        type: 'broadcast',
        event: 'talking_status',
        payload: { isTalking: false, channel: ch, senderId: sender.id }
      });
    }

    const durationSec = Math.max(1, Math.round((Date.now() - this.recordingStartTime) / 1000));

    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return null;

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = async () => {
        try {
          if (this.currentStream) {
            this.currentStream.getTracks().forEach(t => t.stop());
            this.currentStream = null;
          }

          const mime = this.mediaRecorder?.mimeType || 'audio/webm';
          const blob = new Blob(this.audioChunks, { type: mime });
          console.log(`[PTT] chunks=${this.audioChunks.length} size=${blob.size}B mime=${mime}`);

          if (blob.size < 200) {
            console.error('[PTT] blob too small — check mic permission');
            this.liveTranscriptListeners.forEach(l => { try { l('', 'ERROR', 'blob_too_small'); } catch {} });
            resolve(null);
            return;
          }

          const base64 = await this.blobToBase64(blob);

          const msg: WalkieMessage = {
            id: `walkie-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            channel: ch,
            senderId: sender.id,
            senderName: sender.name,
            senderRole: sender.role,
            senderDept: sender.deptName || '\uae30\uc5f0\ub9ac\ud504\ud2b8',
            audioBase64: base64,
            durationSec,
            textTranscript: undefined,
            createdAt: new Date().toISOString()
          };

          // 발신자 자신의 히스토리에 즉시 추가
          this.addHistory(msg);

          // sttOnly가 아닐 때만 수신자들에게 음성 broadcast
          if (!sttOnly && activeCh) {
            await activeCh.send({ type: 'broadcast', event: 'voice', payload: msg });
          }

          this.liveTranscriptListeners.forEach(l => { try { l('', 'IDLE'); } catch {} });

          // STT 비동기 실행 (blob 복사본 사용)
          const sttBlob = new Blob([blob], { type: mime });
          this.runGeminiStt(msg.id, sttBlob, ch);

          resolve(msg);
        } catch (e) {
          console.error('stopAndSend error:', e);
          resolve(null);
        }
      };

      this.mediaRecorder!.stop();
    });
  }

  cancelRecording(senderId?: string) {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.stop();
    }
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(t => t.stop());
      this.currentStream = null;
    }
    this.audioChunks = [];
    if (senderId) {
      const activeCh = this.channels.get(this.currentChannel);
      if (activeCh) {
        activeCh.send({
          type: 'broadcast',
          event: 'talking_status',
          payload: { isTalking: false, channel: this.currentChannel, senderId }
        });
      }
    }
    this.liveTranscriptListeners.forEach(l => { try { l('', 'IDLE'); } catch {} });
    soundEngine.playEndBeep();
  }

  // STT: Gemini 2.0 Flash (audio/webm 직접 지원, WAV 변환 없음)
  private async runGeminiStt(messageId: string, blob: Blob, channelId: WalkieTalkieChannel) {
    const geminiKey = getGeminiApiKey();
    if (!geminiKey) {
      console.warn('[STT] Gemini API key not found');
      return;
    }
    if (this.sttInProgress) return;
    this.sttInProgress = true;

    try {
      const fullBase64 = await this.blobToBase64(blob);
      const base64Data = fullBase64.includes(',') ? fullBase64.split(',')[1] : fullBase64;
      const mimeType = blob.type || 'audio/webm';

      // gemini-2.0-flash supports audio/webm directly
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
      const payload = {
        contents: [{
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: '\uc774 \uc74c\uc131 \uba54\uc2dc\uc9c0\uc758 \ud55c\uad6d\uc5b4 \ubc1c\uc5b8 \ub0b4\uc6a9\uc744 \uc0ac\uc871 \uc5c6\uc774 \ub9d0\ud55c \ub0b4\uc6a9 \uadf8\ub300\ub85c\ub9cc \ud14d\uc2a4\ud2b8\ub85c \uc801\uc5b4\uc918.' }
          ]
        }]
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn(`[STT] Gemini HTTP ${res.status}:`, errText);
        return;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (text) {
        console.log(`[STT] done (${messageId}): "${text}"`);

        // 발신자 자신에게 직접 반영 (self=false 우회)
        this.applyTranscriptLocally(messageId, text);

        // 수신자들에게 broadcast
        const activeCh = this.channels.get(channelId);
        if (activeCh) {
          activeCh.send({
            type: 'broadcast',
            event: 'transcript_update',
            payload: { messageId, textTranscript: text }
          });
        }

        this.liveTranscriptListeners.forEach(l => { try { l(text, 'IDLE'); } catch {} });
      } else {
        console.warn('[STT] empty response');
        this.liveTranscriptListeners.forEach(l => { try { l('', 'IDLE'); } catch {} });
      }
    } catch (e) {
      console.warn('[STT] failed:', e);
    } finally {
      this.sttInProgress = false;
    }
  }

  private applyTranscriptLocally(messageId: string, text: string) {
    const target = this.history.find(m => m.id === messageId);
    if (target) {
      target.textTranscript = text;
      this.saveHistoryToStorage();
      this.notifyHistoryChange();
    }
  }

  stopAudio() {
    if (this.activeAudio) {
      try { this.activeAudio.pause(); this.activeAudio.currentTime = 0; } catch {}
      this.activeAudio = null;
    }
  }

  async playAudio(base64: string): Promise<void> {
    if (!base64 || base64.trim().length < 50) throw new Error('empty audio');
    this.stopAudio();
    return new Promise((resolve, reject) => {
      try {
        const audio = new Audio();
        this.activeAudio = audio;
        audio.preload = 'auto';
        audio.volume = 1.0;
        let done = false;
        const cleanup = () => {
          if (done) return;
          done = true;
          if (this.activeAudio === audio) this.activeAudio = null;
        };
        audio.onended = () => { cleanup(); resolve(); };
        audio.onerror = (e) => {
          cleanup();
          const code = audio.error?.code ?? 'unknown';
          console.error(`Audio error (code ${code}):`, e);
          reject(new Error(`audio play failed (${code})`));
        };
        audio.src = base64;
        const p = audio.play();
        if (p) p.catch(err => { cleanup(); reject(err); });
      } catch (err) { this.activeAudio = null; reject(err); }
    });
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

export const walkieService = new WalkieTalkieService();
