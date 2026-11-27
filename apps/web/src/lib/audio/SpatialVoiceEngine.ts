'use client';

import { Socket } from 'socket.io-client';
import {
  ClientToServerEvents,
  computeSpatialAttenuation,
  PlayerState,
  ServerToClientEvents,
  SpatialVoiceSettings,
  Vec3,
  VoicePcmPayload,
  WebRTCSignalPayload,
} from '@luma/shared';

interface PeerNodeBundle {
  peerId: string;
  pc: RTCPeerConnection;
  audioSender: RTCRtpSender;
  pendingIceCandidates: RTCIceCandidateInit[];
  remoteStream: MediaStream | null;
  audioEl: HTMLAudioElement | null;
  createdAt: number;
  iceConnected: boolean;
  lastGain: number;
  pcmGainNode: GainNode | null;
  nextPlayTime: number;
  makingOffer: boolean;
  ignoreOffer: boolean;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

function getIceServers(): RTCIceServer[] {
  const servers = [...DEFAULT_ICE_SERVERS];
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
  }
  return servers;
}

function downsampleToInt16(input: Float32Array, inputRate: number, targetRate: number): ArrayBuffer {
  if (inputRate <= targetRate) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out.buffer;
  }
  const ratio = inputRate / targetRate;
  const outLength = Math.floor(input.length / ratio);
  const out = new Int16Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      sum += input[j];
      count++;
    }
    const avg = count > 0 ? sum / count : 0;
    const s = Math.max(-1, Math.min(1, avg));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out.buffer;
}

export class SpatialVoiceEngine {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  private localPlayerId: string;
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private rawMicStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private micGainNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private relayProcessor: ScriptProcessorNode | null = null;
  private relaySilenceGain: GainNode | null = null;
  private peers = new Map<string, PeerNodeBundle>();
  private settings: SpatialVoiceSettings;
  private micEnabled = false;
  private relayMode: 'auto' | 'server' = 'auto';
  private vadTimer: number | null = null;
  private lastVoiceEmit = 0;
  private unlockHandler: (() => void) | null = null;
  private audioLocked = false;

  private onLocalVoiceUpdate: (micEnabled: boolean, isSpeaking: boolean, level: number) => void;
  private onAudioLockChange?: (locked: boolean) => void;
  private onError: (msg: string) => void;

  constructor(params: {
    socket: Socket<ServerToClientEvents, ClientToServerEvents>;
    localPlayerId: string;
    settings: SpatialVoiceSettings;
    onLocalVoiceUpdate: (micEnabled: boolean, isSpeaking: boolean, level: number) => void;
    onAudioLockChange?: (locked: boolean) => void;
    onError: (msg: string) => void;
  }) {
    this.socket = params.socket;
    this.localPlayerId = params.localPlayerId;
    this.settings = params.settings;
    this.onLocalVoiceUpdate = params.onLocalVoiceUpdate;
    this.onAudioLockChange = params.onAudioLockChange;
    this.onError = params.onError;

    if (typeof window !== 'undefined') {
      this.unlockHandler = () => {
        void this.unlockAudio();
      };
      window.addEventListener('pointerdown', this.unlockHandler, { passive: true });
      window.addEventListener('keydown', this.unlockHandler, { passive: true });
    }
  }

  getLocalPlayerId(): string {
    return this.localPlayerId;
  }

  isMicEnabled(): boolean {
    return this.micEnabled;
  }

  getRelayMode(): 'auto' | 'server' {
    return this.relayMode;
  }

  setRelayMode(mode: 'auto' | 'server'): void {
    this.relayMode = mode;
    for (const bundle of this.peers.values()) {
      if (bundle.audioEl) {
        bundle.audioEl.muted = mode === 'server';
      }
    }
  }

  private setAudioLocked(locked: boolean): void {
    if (this.audioLocked === locked) return;
    this.audioLocked = locked;
    this.onAudioLockChange?.(locked);
  }

  async unlockAudio(): Promise<void> {
    let anyBlocked = false;
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch {
        anyBlocked = true;
      }
    }
    for (const bundle of this.peers.values()) {
      if (bundle.audioEl) {
        bundle.audioEl.muted = this.relayMode === 'server';
        if (bundle.audioEl.paused) {
          try {
            await bundle.audioEl.play();
          } catch {
            anyBlocked = true;
          }
        }
      }
    }
    if (!anyBlocked && (!this.audioCtx || this.audioCtx.state === 'running')) {
      this.setAudioLocked(false);
    }
  }

  ensureAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new Ctx({ latencyHint: 'interactive' });
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = this.settings.masterVolume;
      this.masterGain.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {
        this.setAudioLocked(true);
      });
    }
    return this.audioCtx;
  }

  updateSettings(next: SpatialVoiceSettings): void {
    const deviceChanged = next.micDeviceId !== this.settings.micDeviceId;
    const outputChanged = next.outputDeviceId !== this.settings.outputDeviceId;
    const dspChanged =
      next.noiseSuppression !== this.settings.noiseSuppression ||
      next.echoCancellation !== this.settings.echoCancellation ||
      next.autoGainControl !== this.settings.autoGainControl;

    this.settings = next;
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setTargetAtTime(
        next.masterVolume,
        this.audioCtx.currentTime,
        0.04,
      );
    }
    if (this.micGainNode && this.audioCtx) {
      this.micGainNode.gain.setTargetAtTime(
        next.inputGain,
        this.audioCtx.currentTime,
        0.04,
      );
    }

    if (outputChanged && next.outputDeviceId !== 'default') {
      this.applyOutputDevice(next.outputDeviceId);
    }

    if (this.micEnabled && (deviceChanged || dspChanged)) {
      this.enableMicrophone(true);
    }
  }

  private applyOutputDevice(deviceId: string): void {
    const ctx = this.audioCtx as unknown as { setSinkId?: (id: string) => Promise<void> } | null;
    if (ctx?.setSinkId) {
      ctx.setSinkId(deviceId).catch(() => {});
    }
    for (const bundle of this.peers.values()) {
      const el = bundle.audioEl as unknown as { setSinkId?: (id: string) => Promise<void> } | null;
      if (el?.setSinkId) {
        el.setSinkId(deviceId).catch(() => {});
      }
    }
  }

  async toggleMicrophone(): Promise<boolean> {
    if (this.micEnabled) {
      this.disableMicrophone();
      return false;
    }
    return this.enableMicrophone(false);
  }

  async enableMicrophone(forceRestart: boolean): Promise<boolean> {
    try {
      const ctx = this.ensureAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      this.setAudioLocked(ctx.state === 'suspended');

      if (forceRestart && this.rawMicStream) {
        this.rawMicStream.getTracks().forEach((t) => t.stop());
      }

      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: this.settings.echoCancellation,
        noiseSuppression: this.settings.noiseSuppression,
        autoGainControl: this.settings.autoGainControl,
      };
      if (this.settings.micDeviceId && this.settings.micDeviceId !== 'default') {
        audioConstraints.deviceId = { exact: this.settings.micDeviceId };
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false,
      });

      this.cleanupMicAudioNodes();
      this.rawMicStream = stream;

      const rawTrack = stream.getAudioTracks()[0];
      if (rawTrack) {
        for (const bundle of this.peers.values()) {
          await bundle.audioSender.replaceTrack(rawTrack).catch(() => {});
        }
      }

      const source = ctx.createMediaStreamSource(stream);
      const gain = ctx.createGain();
      gain.gain.value = this.settings.inputGain;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const processor = ctx.createScriptProcessor(2048, 1, 1);
      const silence = ctx.createGain();
      silence.gain.value = 0;

      source.connect(gain);
      gain.connect(analyser);
      gain.connect(processor);
      processor.connect(silence);
      silence.connect(ctx.destination);

      processor.onaudioprocess = (ev) => {
        if (!this.micEnabled) return;
        const now = Date.now();
        const relayTargets: string[] = [];
        for (const [peerId, bundle] of this.peers.entries()) {
          if (
            this.relayMode === 'server' ||
            (!bundle.iceConnected && now - bundle.createdAt > 2000)
          ) {
            relayTargets.push(peerId);
          }
        }
        if (relayTargets.length === 0) return;

        const input = ev.inputBuffer.getChannelData(0);
        let sq = 0;
        for (let i = 0; i < input.length; i += 4) {
          sq += input[i] * input[i];
        }
        const rms = Math.sqrt(sq / (input.length / 4));
        if (rms < 0.0025) return;

        const pcm = downsampleToInt16(input, ctx.sampleRate, 16000);
        this.socket.emit('voice:pcm', {
          targetPlayerIds: relayTargets,
          sampleRate: 16000,
          pcm,
        });
      };

      this.micSourceNode = source;
      this.micGainNode = gain;
      this.analyser = analyser;
      this.relayProcessor = processor;
      this.relaySilenceGain = silence;
      this.micEnabled = true;

      this.startVadLoop();
      this.onLocalVoiceUpdate(true, false, 0);
      this.socket.emit('voice:state', {
        micEnabled: true,
        isSpeaking: false,
        audioLevel: 0,
      });
      return true;
    } catch {
      this.onError('Mikrofon izni alınamadı veya cihaz bulunamadı.');
      this.micEnabled = false;
      this.onLocalVoiceUpdate(false, false, 0);
      return false;
    }
  }

  private cleanupMicAudioNodes(): void {
    if (this.relayProcessor) {
      this.relayProcessor.onaudioprocess = null;
      this.relayProcessor.disconnect();
      this.relayProcessor = null;
    }
    this.relaySilenceGain?.disconnect();
    this.relaySilenceGain = null;
    this.micSourceNode?.disconnect();
    this.micSourceNode = null;
    this.micGainNode?.disconnect();
    this.micGainNode = null;
    this.analyser = null;
  }

  disableMicrophone(): void {
    this.micEnabled = false;
    if (this.vadTimer !== null) {
      window.clearInterval(this.vadTimer);
      this.vadTimer = null;
    }
    this.cleanupMicAudioNodes();
    if (this.rawMicStream) {
      this.rawMicStream.getTracks().forEach((t) => t.stop());
      this.rawMicStream = null;
    }
    for (const bundle of this.peers.values()) {
      bundle.audioSender.replaceTrack(null).catch(() => {});
    }
    this.onLocalVoiceUpdate(false, false, 0);
    this.socket.emit('voice:state', {
      micEnabled: false,
      isSpeaking: false,
      audioLevel: 0,
    });
  }

  private startVadLoop(): void {
    if (this.vadTimer !== null) window.clearInterval(this.vadTimer);
    const data = new Uint8Array(128);

    this.vadTimer = window.setInterval(() => {
      if (!this.micEnabled || !this.analyser) return;
      this.analyser.getByteTimeDomainData(data);
      let sumSq = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / data.length);
      const level = Math.min(1, rms * 5.2);
      const isSpeaking = level > 0.08;

      this.onLocalVoiceUpdate(true, isSpeaking, level);
      const now = performance.now();
      if (now - this.lastVoiceEmit > 110) {
        this.lastVoiceEmit = now;
        this.socket.emit('voice:state', {
          micEnabled: true,
          isSpeaking,
          audioLevel: Number(level.toFixed(2)),
        });
      }
    }, 65);
  }

  syncPeers(remotePlayerIds: string[]): void {
    const activeSet = new Set(remotePlayerIds.filter((id) => id !== this.localPlayerId));

    for (const peerId of this.peers.keys()) {
      if (!activeSet.has(peerId)) {
        this.removePeer(peerId);
      }
    }

    for (const peerId of activeSet) {
      if (!this.peers.has(peerId)) {
        this.createPeer(peerId);
      }
    }
  }

  private createPeer(peerId: string): PeerNodeBundle {
    const pc = new RTCPeerConnection({ iceServers: getIceServers() });
    const rawTrack = this.rawMicStream?.getAudioTracks()[0] ?? null;

    const transceiver = pc.addTransceiver('audio', {
      direction: 'sendrecv',
      streams: this.rawMicStream ? [this.rawMicStream] : undefined,
    });
    if (rawTrack) {
      transceiver.sender.replaceTrack(rawTrack).catch(() => {});
    }

    const bundle: PeerNodeBundle = {
      peerId,
      pc,
      audioSender: transceiver.sender,
      pendingIceCandidates: [],
      remoteStream: null,
      audioEl: null,
      createdAt: Date.now(),
      iceConnected: false,
      lastGain: 1,
      pcmGainNode: null,
      nextPlayTime: 0,
      makingOffer: false,
      ignoreOffer: false,
    };
    this.peers.set(peerId, bundle);

    const isPolite = this.localPlayerId < peerId;

    const sendOffer = async () => {
      if (isPolite || bundle.makingOffer || pc.signalingState !== 'stable') return;
      try {
        bundle.makingOffer = true;
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);
        if (pc.localDescription) {
          this.socket.emit('webrtc:offer', {
            targetPlayerId: peerId,
            sdp: {
              type: pc.localDescription.type as 'offer' | 'answer',
              sdp: pc.localDescription.sdp,
            },
          });
        }
      } catch {
        // ignore transient negotiation errors
      } finally {
        bundle.makingOffer = false;
      }
    };

    pc.onnegotiationneeded = () => {
      void sendOffer();
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.socket.emit('webrtc:ice', {
          targetPlayerId: peerId,
          candidate: ev.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (ev) => {
      const stream = ev.streams[0] || new MediaStream([ev.track]);
      ev.track.onunmute = () => {
        bundle.audioEl?.play().catch(() => {
          this.setAudioLocked(true);
        });
      };
      this.attachRemoteAudioStream(bundle, stream);
    };

    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState;
      bundle.iceConnected = st === 'connected' || st === 'completed';
      if (st === 'failed') {
        pc.restartIce?.();
      }
    };

    return bundle;
  }

  private attachRemoteAudioStream(bundle: PeerNodeBundle, stream: MediaStream): void {
    bundle.remoteStream = stream;

    if (!bundle.audioEl) {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.muted = this.relayMode === 'server';
      audio.volume = Math.max(0, Math.min(1, bundle.lastGain * this.settings.masterVolume));
      audio.style.display = 'none';
      audio.setAttribute('playsinline', 'true');
      audio.srcObject = stream;
      if (this.settings.outputDeviceId && this.settings.outputDeviceId !== 'default') {
        const elWithSink = audio as unknown as { setSinkId?: (id: string) => Promise<void> };
        elWithSink.setSinkId?.(this.settings.outputDeviceId).catch(() => {});
      }
      document.body?.appendChild(audio);
      audio.play().catch(() => {
        this.setAudioLocked(true);
      });
      bundle.audioEl = audio;
    } else {
      bundle.audioEl.srcObject = stream;
      bundle.audioEl.muted = this.relayMode === 'server';
      bundle.audioEl.play().catch(() => {
        this.setAudioLocked(true);
      });
    }
  }

  handleIncomingPcm(payload: VoicePcmPayload): void {
    const peerId = payload.fromPlayerId;
    if (!peerId || peerId === this.localPlayerId) return;
    const bundle = this.peers.get(peerId);
    if (!bundle) return;
    if (this.relayMode === 'auto' && bundle.iceConnected) return;

    const ctx = this.ensureAudioContext();
    if (ctx.state !== 'running') {
      ctx.resume().catch(() => {});
      this.setAudioLocked(true);
      return;
    }
    if (!this.masterGain) return;

    if (!bundle.pcmGainNode) {
      const gain = ctx.createGain();
      gain.gain.value = bundle.lastGain;
      gain.connect(this.masterGain);
      bundle.pcmGainNode = gain;
    }

    const int16 = new Int16Array(payload.pcm);
    if (int16.length === 0) return;
    const sampleRate = payload.sampleRate || 16000;
    const buf = ctx.createBuffer(1, int16.length, sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < int16.length; i++) {
      ch[i] = int16[i] / 32768;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(bundle.pcmGainNode);

    const now = ctx.currentTime;
    if (bundle.nextPlayTime < now || bundle.nextPlayTime > now + 0.35) {
      bundle.nextPlayTime = now + 0.04;
    }
    src.start(bundle.nextPlayTime);
    bundle.nextPlayTime += buf.duration;
  }

  private async flushPendingIce(bundle: PeerNodeBundle): Promise<void> {
    if (!bundle.pc.remoteDescription || bundle.pendingIceCandidates.length === 0) return;
    const queued = bundle.pendingIceCandidates.splice(0, bundle.pendingIceCandidates.length);
    for (const candidate of queued) {
      try {
        await bundle.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // ignore stale ICE
      }
    }
  }

  async handleSignal(
    kind: 'offer' | 'answer' | 'ice',
    payload: WebRTCSignalPayload,
  ): Promise<void> {
    const peerId = payload.fromPlayerId;
    if (!peerId || peerId === this.localPlayerId) return;

    const bundle = this.peers.get(peerId) || this.createPeer(peerId);
    const pc = bundle.pc;
    const isPolite = this.localPlayerId < peerId;

    try {
      if (kind === 'offer' && payload.sdp) {
        const offerCollision =
          bundle.makingOffer || pc.signalingState !== 'stable';
        bundle.ignoreOffer = !isPolite && offerCollision;
        if (bundle.ignoreOffer) return;

        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await this.flushPendingIce(bundle);

        const rawTrack = this.rawMicStream?.getAudioTracks()[0] ?? null;
        if (rawTrack && bundle.audioSender.track !== rawTrack) {
          await bundle.audioSender.replaceTrack(rawTrack).catch(() => {});
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (pc.localDescription) {
          this.socket.emit('webrtc:answer', {
            targetPlayerId: peerId,
            sdp: { type: 'answer', sdp: pc.localDescription.sdp },
          });
        }
      } else if (kind === 'answer' && payload.sdp) {
        if (pc.signalingState !== 'have-local-offer') return;
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await this.flushPendingIce(bundle);
      } else if (kind === 'ice' && payload.candidate) {
        if (!pc.remoteDescription) {
          bundle.pendingIceCandidates.push(payload.candidate);
        } else {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        }
      }
    } catch {
      // ignore transient ICE race errors
    }
  }

  updateSpatialPositions(params: {
    listenerPosition: Vec3;
    listenerForward: Vec3;
    listenerUp: Vec3;
    localPlayerPosition: Vec3;
    players: Record<string, PlayerState>;
    peerVolumes: Record<string, number>;
    peerLocalMutes: Record<string, boolean>;
    blockedUserIds: string[];
    roomMaxDistance: number;
  }): Record<string, number> {
    const distances: Record<string, number> = {};
    const ctx = this.audioCtx;
    const maxDist = this.settings.maxDistance || params.roomMaxDistance || 15;
    const refDist = this.settings.refDistance || 3;

    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    for (const [peerId, player] of Object.entries(params.players)) {
      if (peerId === this.localPlayerId) continue;

      const dist = Math.hypot(
        player.position[0] - params.localPlayerPosition[0],
        player.position[1] - params.localPlayerPosition[1],
        player.position[2] - params.localPlayerPosition[2],
      );
      distances[peerId] = Number(dist.toFixed(1));

      const bundle = this.peers.get(peerId);
      if (!bundle) continue;

      const isBlocked = params.blockedUserIds.includes(player.userId);
      const isLocalMuted = Boolean(params.peerLocalMutes[player.userId]);
      const userVol = params.peerVolumes[player.userId] ?? 1.0;

      const attenuation = computeSpatialAttenuation(dist, refDist, maxDist);
      const effectiveGain =
        isBlocked || isLocalMuted || player.mutedByMod
          ? 0
          : attenuation * userVol;

      bundle.lastGain = effectiveGain;

      if (bundle.audioEl) {
        bundle.audioEl.volume = Math.max(
          0,
          Math.min(1, effectiveGain * this.settings.masterVolume),
        );
      }
      if (bundle.pcmGainNode && ctx) {
        bundle.pcmGainNode.gain.setTargetAtTime(effectiveGain, ctx.currentTime, 0.05);
      }
    }

    return distances;
  }

  private removePeer(peerId: string): void {
    const bundle = this.peers.get(peerId);
    if (!bundle) return;
    bundle.pcmGainNode?.disconnect();
    if (bundle.audioEl) {
      bundle.audioEl.pause();
      bundle.audioEl.srcObject = null;
      bundle.audioEl.remove();
    }
    bundle.pc.close();
    this.peers.delete(peerId);
  }

  destroy(): void {
    if (typeof window !== 'undefined' && this.unlockHandler) {
      window.removeEventListener('pointerdown', this.unlockHandler);
      window.removeEventListener('keydown', this.unlockHandler);
      this.unlockHandler = null;
    }
    this.disableMicrophone();
    for (const peerId of Array.from(this.peers.keys())) {
      this.removePeer(peerId);
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }
}
