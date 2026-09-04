// src/services/walkieTalkieService.ts
// Build.142 - DEBUG mode: inline debug log messages in history
// Design:
//   1. MediaRecorder only. SpeechRecognition removed (avoids mic conflict)
//   2. STT: raw blob -> Gemini 2.5 Flash (supports audio/webm natively)
//   3. self=false bypass: sender applies transcript locally via applyTranscriptLocally()
//      receivers get transcript_update broadcast
//   4. [DEBUG] addDebugLog() injects console-style messages into history feed

import { supabase } from './db';


export type WalkieTalkieChannel = 'ALL' | 'DISPATCH' | 'AS' | 'SALES';
export type WalkieReceiveMode = 'VOICE' | 'BEEP' | 'MUTE';
export type WalkieSttEngine = 'GROQ' | 'CLOUDFLARE' | 'BROWSER';

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
  // [DEBUG] temporary flag — remove after verification
  isDebug?: boolean;
}

export interface TalkingStatus {
  isTalking: boolean;
  channel: WalkieTalkieChannel;
  senderId: string;
  senderName: string;
  senderDept: string;
}

// ── Sound engine ──────────────────────────────────────────────────────────────
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

// ── Walkie-Talkie Service (singleton) ─────────────────────────────────────────
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
  private sttEngine: WalkieSttEngine = 'GROQ';
  private sttEngineListeners: ((engine: WalkieSttEngine) => void)[] = [];
  private browserRecognizer: any = null;
  private browserTranscript: string = '';

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
      const savedEngine = localStorage.getItem('walkie_stt_engine') as WalkieSttEngine;
      if (savedEngine && ['GROQ', 'CLOUDFLARE', 'BROWSER'].includes(savedEngine)) this.sttEngine = savedEngine; else this.sttEngine = 'GROQ';
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

  getSttEngine(): WalkieSttEngine { return this.sttEngine; }
  setSttEngine(engine: WalkieSttEngine) {
    this.sttEngine = engine;
    localStorage.setItem('walkie_stt_engine', engine);
    this.sttEngineListeners.forEach(l => l(engine));
    const engineLabel = engine === 'GROQ' ? 'Groq LPU' : engine === 'CLOUDFLARE' ? 'Cloudflare AI' : '브라우저 STT';
    this.addDebugLog(`[STT ENGINE] switched to: ${engineLabel}`);
  }
  onSttEngineChange(l: (engine: WalkieSttEngine) => void) {
    this.sttEngineListeners.push(l);
    return () => { this.sttEngineListeners = this.sttEngineListeners.filter(x => x !== l); };
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

  // [DEBUG] Inject a debug log entry into the history feed (visible in UI, not broadcast)
  addDebugLog(text: string) {
    const msg: WalkieMessage = {
      id: `dbg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      channel: this.currentChannel,
      senderId: '__debug__',
      senderName: 'DEBUG',
      senderRole: 'debug',
      senderDept: '',
      audioBase64: '',
      durationSec: 0,
      textTranscript: text,
      createdAt: new Date().toISOString(),
      isDebug: true
    };
    this.history = [msg, ...this.history];
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

  // ── Supabase Realtime channel subscription ───────────────────────────────────
  subscribe(_user?: { id: string; name: string; role: string; deptName?: string }) {
    if (!supabase) { console.warn('Supabase unavailable'); return; }

    const allChannels: WalkieTalkieChannel[] = ['ALL', 'DISPATCH', 'AS', 'SALES'];
    allChannels.forEach(ch => {
      if (this.channels.has(ch)) return;

      // NOTE: self:false means sender does NOT receive their own broadcast.
      // STT transcript for the sender is applied via applyTranscriptLocally() directly.
      // Receivers get it via transcript_update broadcast.
      const channel = supabase!.channel(`walkie_${ch}`, {
        config: { broadcast: { self: false } }
      });

      // 1. Receive voice message (receiver side only - sender excluded by self:false)
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

      // 2. Receive talking status indicator
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

      // 3. Receive STT transcript (receiver side)
      // Sender uses applyTranscriptLocally() directly to bypass self:false
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

  // ── Playback queue ────────────────────────────────────────────────────────────
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

  // ── PTT record start ──────────────────────────────────────────────────────────
  // options.sttOnly: monologue-order mode — record audio for STT only, do not broadcast voice
  async startRecording(
    sender?: { id: string; name: string; deptName?: string },
    options?: { sttOnly?: boolean }
  ): Promise<boolean> {
    const sttOnly = options?.sttOnly ?? false;
    this.addDebugLog(`[PTT] startRecording() called | sttOnly=${sttOnly} | sender=${sender?.name ?? 'none'}`);
    try {
      soundEngine.unlockAudioOnUserGesture();
      soundEngine.playStartBeep();
      this.audioChunks = [];
      this.recordingStartTime = Date.now();

      if (sttOnly) {
        // 🎙️ [독백의뢰 모드]: MediaRecorder를 아예 켜지 않고 Web Speech API 단독 구동
        // 안드로이드 마이크 독점 충돌이 원천 차단되어 0원/무제한으로 100% 정상 인식됨!
        this.addDebugLog('[STT ONLY] Starting browser speech recognition exclusively (no MediaRecorder)...');
        this.startBrowserRecognition();
        this.liveTranscriptListeners.forEach(l => { try { l('', 'LISTENING'); } catch {} });
        return true;
      }

      // 🔊 [일반 무전기 모드]: 음성 녹음을 위해 MediaRecorder 구동
      this.addDebugLog('[PTT] getUserMedia() requesting mic...');
      if (!this.currentStream) {
        this.currentStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      }
      this.addDebugLog('[PTT] mic granted: ' + (this.currentStream.getAudioTracks()[0]?.label || 'unknown'));

      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      const candidates = isSafari
        ? ['audio/mp4', 'audio/aac']
        : ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      const mimeType = candidates.find(t => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) || '';
      this.addDebugLog(`[PTT] MediaRecorder mimeType="${mimeType || '(browser default)'}"`);

      try {
        this.mediaRecorder = new MediaRecorder(this.currentStream, {
          ...(mimeType ? { mimeType } : {}),
          audioBitsPerSecond: 32000
        });
      } catch (recErr) {
        this.addDebugLog(`[PTT] MediaRecorder fallback without audioBitsPerSecond: ${recErr}`);
        this.mediaRecorder = new MediaRecorder(this.currentStream, mimeType ? { mimeType } : undefined);
      }
      this.mediaRecorder.ondataavailable = (e) => { if (e.data?.size > 0) this.audioChunks.push(e.data); };
      this.mediaRecorder.start();
      this.addDebugLog('[PTT] recording started (32kbps mono voice)');

      // Broadcast talking status
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
              senderDept: sender.deptName || 'KiyeunLift'
            }
          });
          this.addDebugLog(`[PTT] talking_status broadcast sent (ch=${this.currentChannel})`);
        }
      }

      this.liveTranscriptListeners.forEach(l => { try { l('', 'LISTENING'); } catch {} });
      return true;
    } catch (err: any) {
      this.addDebugLog(`[PTT] startRecording FAILED: ${err?.name} — ${err?.message}`);
      console.error('startRecording failed:', err);
      return false;
    }
  }

  // ── PTT record stop and send ──────────────────────────────────────────────────
  async stopAndSend(
    sender: { id: string; name: string; role: string; deptName?: string },
    targetChannel?: WalkieTalkieChannel,
    opts?: { sttOnly?: boolean }
  ): Promise<WalkieMessage | null> {
    soundEngine.playEndBeep();
    const ch = targetChannel || this.currentChannel;
    const activeCh = this.channels.get(ch);
    const sttOnly = opts?.sttOnly ?? false;
    this.addDebugLog(`[PTT] stopAndSend() called | ch=${ch} | sttOnly=${sttOnly} | engine=${this.sttEngine}`);

    if (!sttOnly && activeCh) {
      activeCh.send({
        type: 'broadcast',
        event: 'talking_status',
        payload: { isTalking: false, channel: ch, senderId: sender.id }
      });
    }

    const durationSec = Math.max(1, Math.round((Date.now() - this.recordingStartTime) / 1000));

    // 1. [독백의뢰 모드] MediaRecorder가 없으므로 브라우저 STT 완료 후 즉시 메시지 생성
    if (sttOnly) {
      this.addDebugLog('[STT ONLY] finalizing browser speech recognition...');
      const transcriptText = await this.stopBrowserRecognition();
      this.addDebugLog(`[STT ONLY] transcript result: "${transcriptText || '(empty)'}"`);

      const msg: WalkieMessage = {
        id: `walkie-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        channel: ch,
        senderId: sender.id,
        senderName: sender.name,
        senderRole: sender.role,
        senderDept: sender.deptName || 'KiyeunLift',
        audioBase64: '',
        durationSec,
        textTranscript: transcriptText || undefined,
        createdAt: new Date().toISOString()
      };

      if (transcriptText) {
        this.addHistory(msg);
      }
      this.liveTranscriptListeners.forEach(l => { try { l('', 'IDLE'); } catch {} });
      return msg;
    }

    // 2. [일반 무전기 모드] MediaRecorder 종료 및 Cloudflare AI Whisper 전사
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      this.addDebugLog('[PTT] ERROR: mediaRecorder is null or inactive — nothing to stop');
      return null;
    }

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = async () => {
        try {
          // Release mic immediately
          if (this.currentStream) {
            this.currentStream.getTracks().forEach(t => t.stop());
            this.currentStream = null;
          }
          this.addDebugLog('[PTT] mic released');

          const mime = this.mediaRecorder?.mimeType || 'audio/webm';
          const blob = new Blob(this.audioChunks, { type: mime });
          this.addDebugLog(`[PTT] blob ready: chunks=${this.audioChunks.length}, size=${blob.size}B, mime="${mime}"`);

          if (blob.size < 200) {
            this.addDebugLog(`[PTT] ERROR: blob too small (${blob.size}B) — mic permission or stream issue`);
            this.liveTranscriptListeners.forEach(l => { try { l('', 'ERROR', 'blob_too_small'); } catch {} });
            resolve(null);
            return;
          }

          const base64 = await this.blobToBase64(blob);
          this.addDebugLog(`[PTT] base64 encoded: length=${base64.length} chars`);

          const msg: WalkieMessage = {
            id: `walkie-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            channel: ch,
            senderId: sender.id,
            senderName: sender.name,
            senderRole: sender.role,
            senderDept: sender.deptName || 'KiyeunLift',
            audioBase64: base64,
            durationSec,
            textTranscript: undefined,
            createdAt: new Date().toISOString()
          };

          // ⚡ [1] 로컬 화면에 음성 카드 즉시 표출 (0초 반응)
          this.addHistory(msg);
          this.addDebugLog(`[PTT] msg added to local history: id=${msg.id}`);

          // 🚀 [2] 음성 브로드캐스트 즉시 전송 (상대방도 0초 즉시 청취 가능)
          if (activeCh) {
            activeCh.send({ type: 'broadcast', event: 'voice', payload: msg })
              .then(() => this.addDebugLog('[PTT] voice broadcast sent to receivers'))
              .catch((e: any) => this.addDebugLog(`[PTT] voice broadcast err: ${e?.message}`));
          }

          // ⚡ [3] Groq LPU Whisper (기본) 및 Cloudflare 백그라운드 전사 호출
          this.runStt(msg.id, base64, mime, ch);

          this.liveTranscriptListeners.forEach(l => { try { l('', 'IDLE'); } catch {} });
          resolve(msg);
        } catch (e: any) {
          this.addDebugLog(`[PTT] stopAndSend onstop ERROR: ${e?.message}`);
          console.error('stopAndSend error:', e);
          resolve(null);
        }
      };

      this.mediaRecorder!.stop();
      this.addDebugLog('[PTT] mediaRecorder.stop() called — waiting for onstop...');
    });
  }

  // ── Cancel recording ──────────────────────────────────────────────────────────
  cancelRecording(senderId?: string) {
    this.addDebugLog('[PTT] cancelRecording() called');
    this.stopBrowserRecognition();
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

  // ── Browser STT Engine (Web Speech API — LabelPrintStation style) ────────────
  private startBrowserRecognition() {
    this.browserTranscript = '';
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.addDebugLog('[BROWSER STT] SpeechRecognition not supported on this browser');
      return;
    }
    try {
      if (this.browserRecognizer) {
        try { this.browserRecognizer.stop(); } catch {}
        this.browserRecognizer = null;
      }
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'ko-KR';
      rec.onresult = (event: any) => {
        let full = '';
        for (let i = 0; i < event.results.length; ++i) {
          full += event.results[i][0].transcript;
        }
        if (full.trim()) {
          this.browserTranscript = full.trim();
          this.addDebugLog(`[BROWSER STT] interim: "${this.browserTranscript}"`);
          this.liveTranscriptListeners.forEach(l => { try { l(this.browserTranscript, 'LISTENING'); } catch {} });
        }
      };
      rec.onerror = (e: any) => {
        this.addDebugLog(`[BROWSER STT] event error: ${e?.error}`);
      };
      rec.start();
      this.browserRecognizer = rec;
      this.addDebugLog('[BROWSER STT] SpeechRecognition started');
    } catch (e: any) {
      this.addDebugLog(`[BROWSER STT] start failed: ${e?.message}`);
    }
  }

  // ── Unified STT Dispatcher (Groq LPU primary, Cloudflare Workers AI fallback) ─
  private async runStt(messageId: string, base64Data: string, mimeType: string, channelId: WalkieTalkieChannel) {
    if (this.sttEngine === 'GROQ') {
      const ok = await this.runGroqStt(messageId, base64Data, mimeType, channelId);
      if (!ok) {
        this.addDebugLog('[STT] Groq returned empty or error — fallback to Cloudflare Workers AI...');
        await this.runCloudflareStt(messageId, base64Data, mimeType, channelId);
      }
    } else {
      await this.runCloudflareStt(messageId, base64Data, mimeType, channelId);
    }
  }

  // ── Groq LPU Whisper STT (whisper-large-v3-turbo, sub-second latency) ───────
  private async runGroqStt(messageId: string, base64Data: string, mimeType: string, channelId: WalkieTalkieChannel): Promise<boolean> {
    if (this.sttInProgress) {
      this.addDebugLog('[GROQ STT] another STT in progress, waiting...');
    }
    this.sttInProgress = true;
    const t0 = Date.now();
    this.addDebugLog('[GROQ STT] sending audio to Groq LPU Whisper (/api/groq-stt)...');

    try {
      const res = await fetch('/api/groq-stt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64Data,
          mimeType,
          language: 'ko',
          prompt: '기연리프트 무전 통신.'
        })
      });

      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
      this.addDebugLog(`[GROQ STT] response: HTTP ${res.status} (${elapsed}s)`);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const errText = errJson?.details || errJson?.error || (await res.text().catch(() => ''));
        this.addDebugLog(`[GROQ STT] ERROR body: ${String(errText).slice(0, 150)}`);
        return false;
      }

      const data = await res.json();
      const text = data?.textTranscript?.trim();

      if (text) {
        this.addDebugLog(`[GROQ STT] transcript OK (${elapsed}s) [${data?.model || 'large-v3'}]: "${text}"`);
        this.applyTranscriptLocally(messageId, text);

        const activeCh = this.channels.get(channelId);
        if (activeCh) {
          activeCh.send({
            type: 'broadcast',
            event: 'transcript_update',
            payload: { messageId, textTranscript: text }
          });
          this.addDebugLog('[GROQ STT] transcript_update broadcast sent to receivers');
        }

        this.liveTranscriptListeners.forEach(l => { try { l(text, 'IDLE'); } catch {} });
        return true;
      } else {
        const bBytes = data?.bufferBytes ?? 0;
        this.addDebugLog(`[GROQ STT] empty transcript (${elapsed}s) | bytes=${bBytes}B`);
        this.liveTranscriptListeners.forEach(l => { try { l('', 'IDLE'); } catch {} });
        return false;
      }
    } catch (e: any) {
      this.addDebugLog(`[GROQ STT] fetch EXCEPTION: ${e?.message}`);
      console.warn('[GROQ STT] request failed:', e);
      return false;
    } finally {
      this.sttInProgress = false;
      this.addDebugLog('[GROQ STT] done (sttInProgress=false)');
    }
  }

  // ── Cloudflare Workers AI Whisper STT (@cf/openai/whisper) ─────────────────
  // 10,000 Neurons/day 100% Free on Cloudflare, converts recorded WebM audio to text
  private async runCloudflareStt(messageId: string, base64Data: string, mimeType: string, channelId: WalkieTalkieChannel) {
    if (this.sttInProgress) {
      this.addDebugLog('[CF STT] another STT in progress, waiting...');
    }
    this.sttInProgress = true;
    const t0 = Date.now();
    this.addDebugLog('[CF STT] sending audio to Cloudflare Workers AI (/api/cf-stt)...');

    try {
      const res = await fetch('/api/cf-stt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64: base64Data, mimeType })
      });

      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
      this.addDebugLog(`[CF STT] response: HTTP ${res.status} (${elapsed}s)`);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const errText = errJson?.details || errJson?.error || (await res.text().catch(() => ''));
        this.addDebugLog(`[CF STT] ERROR body: ${String(errText).slice(0, 150)}`);
        return;
      }

      const data = await res.json();
      const text = data?.textTranscript?.trim();

      if (text) {
        this.addDebugLog(`[CF STT] transcript OK (${elapsed}s): "${text}"`);
        this.applyTranscriptLocally(messageId, text);

        const activeCh = this.channels.get(channelId);
        if (activeCh) {
          activeCh.send({
            type: 'broadcast',
            event: 'transcript_update',
            payload: { messageId, textTranscript: text }
          });
          this.addDebugLog('[CF STT] transcript_update broadcast sent to receivers');
        }

        this.liveTranscriptListeners.forEach(l => { try { l(text, 'IDLE'); } catch {} });
      } else {
        const wCount = data?.wordCount ?? 0;
        const bBytes = data?.bufferBytes ?? 0;
        this.addDebugLog(`[CF STT] empty transcript (${elapsed}s) | words=${wCount} | bytes=${bBytes}B`);
        this.liveTranscriptListeners.forEach(l => { try { l('', 'IDLE'); } catch {} });
      }
    } catch (e: any) {
      this.addDebugLog(`[CF STT] fetch EXCEPTION: ${e?.message}`);
      console.warn('[CF STT] request failed:', e);
    } finally {
      this.sttInProgress = false;
      this.addDebugLog('[CF STT] done (sttInProgress=false)');
    }
  }

  private async stopBrowserRecognition(): Promise<string> {
    if (!this.browserRecognizer) {
      return this.browserTranscript.trim();
    }
    return new Promise((resolve) => {
      let resolved = false;
      const finish = () => {
        if (resolved) return;
        resolved = true;
        const text = this.browserTranscript.trim();
        this.browserRecognizer = null;
        resolve(text);
      };

      this.browserRecognizer.onend = finish;
      setTimeout(finish, 500); // 500ms safety timeout

      try {
        this.browserRecognizer.stop();
      } catch {
        finish();
      }
    });
  }

  // Apply STT transcript to local history (used by both sender and receiver)
  private applyTranscriptLocally(messageId: string, text: string) {

    const target = this.history.find(m => m.id === messageId);
    if (target) {
      target.textTranscript = text;
      this.saveHistoryToStorage();
      this.notifyHistoryChange();
    }
  }

  // ── Audio playback ────────────────────────────────────────────────────────────
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

  // ── Utilities ─────────────────────────────────────────────────────────────────
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
