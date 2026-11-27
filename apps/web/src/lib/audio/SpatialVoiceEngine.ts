'use client';

import { Socket } from 'socket.io-client';
import {
  ClientToServerEvents,
  computeSpatialAttenuation,
  PlayerState,
  ServerToClientEvents,
  SpatialVoiceSettings,
  Vec3,
  WebRTCSignalPayload,
} from '@luma/shared';

interface PeerNodeBundle {
  peerId: string;
  pc: RTCPeerConnection;
  audioSender: RTCRtpSender;
  pendingIceCandidates: RTCIceCandidateInit[];
  remoteStream: MediaStream | null;
  hiddenAudioEl: HTMLAudioElement | null;
  sourceNode: MediaStreamAudioSourceNode | null;
  pannerNode: PannerNode | null;
  gainNode: GainNode | null;
  filterNode: BiquadFilterNode | null;
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

export class SpatialVoiceEngine {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  private localPlayerId: string;
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private rawMicStream: MediaStream | null = null;
  private processedMicStream: MediaStream | null = null;
  private micGainNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private peers = new Map<string, PeerNodeBundle>();
  private settings: SpatialVoiceSettings;
  private micEnabled = false;
  private vadTimer: number | null = null;
  private lastVoiceEmit = 0;
  private unlockHandler: (() => void) | null = null;

  private onLocalVoiceUpdate: (micEnabled: boolean, isSpeaking: boolean, level: number) => void;
  private onError: (msg: string) => void;

  constructor(params: {
    socket: Socket<ServerToClientEvents, ClientToServerEvents>;
    localPlayerId: string;
    settings: SpatialVoiceSettings;
    onLocalVoiceUpdate: (micEnabled: boolean, isSpeaking: boolean, level: number) => void;
    onError: (msg: string) => void;
  }) {
    this.socket = params.socket;
    this.localPlayerId = params.localPlayerId;
    this.settings = params.settings;
    this.onLocalVoiceUpdate = params.onLocalVoiceUpdate;
    this.onError = params.onError;

    // Unlock Web Audio + hidden WebRTC audio elements on any user interaction
    if (typeof window !== 'undefined') {
      this.unlockHandler = () => {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
        for (const bundle of this.peers.values()) {
          if (bundle.hiddenAudioEl && bundle.hiddenAudioEl.paused) {
            bundle.hiddenAudioEl.play().catch(() => {});
          }
        }
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
      this.audioCtx.resume().catch(() => {});
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

      this.rawMicStream = stream;
      const source = ctx.createMediaStreamSource(stream);
      const gain = ctx.createGain();
      gain.gain.value = this.settings.inputGain;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const dest = ctx.createMediaStreamDestination();

      source.connect(gain);
      gain.connect(analyser);
      gain.connect(dest);

      this.micGainNode = gain;
      this.analyser = analyser;
      this.processedMicStream = dest.stream;
      this.micEnabled = true;

      // Replace track directly on the existing sendrecv audioSender (no renegotiation needed)
      const track = dest.stream.getAudioTracks()[0];
      if (track) {
        for (const bundle of this.peers.values()) {
          await bundle.audioSender.replaceTrack(track).catch(() => {});
        }
      }

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

  disableMicrophone(): void {
    this.micEnabled = false;
    if (this.vadTimer !== null) {
      window.clearInterval(this.vadTimer);
      this.vadTimer = null;
    }
    if (this.rawMicStream) {
      this.rawMicStream.getTracks().forEach((t) => t.stop());
      this.rawMicStream = null;
    }
    this.processedMicStream = null;
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
    const initialTrack = this.processedMicStream?.getAudioTracks()[0] ?? null;

    // Always allocate exactly ONE bidirectional audio transceiver
    const transceiver = pc.addTransceiver('audio', {
      direction: 'sendrecv',
      streams: this.processedMicStream ? [this.processedMicStream] : undefined,
    });
    if (initialTrack) {
      transceiver.sender.replaceTrack(initialTrack).catch(() => {});
    }

    const bundle: PeerNodeBundle = {
      peerId,
      pc,
      audioSender: transceiver.sender,
      pendingIceCandidates: [],
      remoteStream: null,
      hiddenAudioEl: null,
      sourceNode: null,
      pannerNode: null,
      gainNode: null,
      filterNode: null,
      makingOffer: false,
      ignoreOffer: false,
    };
    this.peers.set(peerId, bundle);

    const isPolite = this.localPlayerId < peerId;

    // Only the impolite side initiates the single initial offer via negotiationneeded
    pc.onnegotiationneeded = async () => {
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
      this.attachRemoteAudioStream(bundle, stream);
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        pc.restartIce?.();
      }
    };

    return bundle;
  }

  private attachRemoteAudioStream(bundle: PeerNodeBundle, stream: MediaStream): void {
    bundle.remoteStream = stream;

    // Chrome WebRTC stream activation anchor attached to DOM (muted so Web Audio PannerNode outputs sound)
    if (!bundle.hiddenAudioEl) {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.muted = true;
      audio.style.display = 'none';
      audio.setAttribute('playsinline', 'true');
      audio.srcObject = stream;
      document.body?.appendChild(audio);
      audio.play().catch(() => {});
      bundle.hiddenAudioEl = audio;
    } else {
      bundle.hiddenAudioEl.srcObject = stream;
      bundle.hiddenAudioEl.play().catch(() => {});
    }

    const ctx = this.ensureAudioContext();
    if (!this.masterGain) return;

    bundle.sourceNode?.disconnect();
    bundle.filterNode?.disconnect();
    bundle.pannerNode?.disconnect();
    bundle.gainNode?.disconnect();

    const source = ctx.createMediaStreamSource(stream);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 18000;

    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'linear';
    panner.refDistance = 1;
    panner.maxDistance = 100;
    panner.rolloffFactor = 0;

    const gain = ctx.createGain();
    gain.gain.value = 1;

    source.connect(filter);
    filter.connect(panner);
    panner.connect(gain);
    gain.connect(this.masterGain);

    bundle.sourceNode = source;
    bundle.filterNode = filter;
    bundle.pannerNode = panner;
    bundle.gainNode = gain;
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

        const track = this.processedMicStream?.getAudioTracks()[0] ?? null;
        if (track && bundle.audioSender.track !== track) {
          await bundle.audioSender.replaceTrack(track).catch(() => {});
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

  /**
   * Updates AudioListener from the 3D camera and every peer's PannerNode & distance GainNode.
   */
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

    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const listener = ctx.listener;
      const t = ctx.currentTime;
      if (listener.positionX) {
        listener.positionX.setTargetAtTime(params.listenerPosition[0], t, 0.03);
        listener.positionY.setTargetAtTime(params.listenerPosition[1], t, 0.03);
        listener.positionZ.setTargetAtTime(params.listenerPosition[2], t, 0.03);
        listener.forwardX.setTargetAtTime(params.listenerForward[0], t, 0.03);
        listener.forwardY.setTargetAtTime(params.listenerForward[1], t, 0.03);
        listener.forwardZ.setTargetAtTime(params.listenerForward[2], t, 0.03);
        listener.upX.setTargetAtTime(params.listenerUp[0], t, 0.03);
        listener.upY.setTargetAtTime(params.listenerUp[1], t, 0.03);
        listener.upZ.setTargetAtTime(params.listenerUp[2], t, 0.03);
      }
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
      if (!bundle || !ctx || !bundle.pannerNode || !bundle.gainNode) continue;

      const t = ctx.currentTime;
      const headY = player.position[1] + (player.seatedSeatId ? 1.2 : 1.55);
      if (bundle.pannerNode.positionX) {
        bundle.pannerNode.positionX.setTargetAtTime(player.position[0], t, 0.04);
        bundle.pannerNode.positionY.setTargetAtTime(headY, t, 0.04);
        bundle.pannerNode.positionZ.setTargetAtTime(player.position[2], t, 0.04);
      }

      const isBlocked = params.blockedUserIds.includes(player.userId);
      const isLocalMuted = Boolean(params.peerLocalMutes[player.userId]);
      const userVol = params.peerVolumes[player.userId] ?? 1.0;

      const attenuation = computeSpatialAttenuation(dist, refDist, maxDist);
      const effectiveGain =
        isBlocked || isLocalMuted || player.mutedByMod
          ? 0
          : attenuation * userVol;

      bundle.gainNode.gain.setTargetAtTime(effectiveGain, t, 0.05);

      if (bundle.filterNode) {
        const baseCutoff =
          this.settings.acoustics === 'intimate'
            ? 14500
            : this.settings.acoustics === 'cinema-hall'
              ? 16500
              : 20000;
        const distCutoff = Math.max(2200, baseCutoff * (1 - (dist / maxDist) * 0.55));
        bundle.filterNode.frequency.setTargetAtTime(distCutoff, t, 0.08);
      }
    }

    return distances;
  }

  private removePeer(peerId: string): void {
    const bundle = this.peers.get(peerId);
    if (!bundle) return;
    bundle.sourceNode?.disconnect();
    bundle.filterNode?.disconnect();
    bundle.pannerNode?.disconnect();
    bundle.gainNode?.disconnect();
    if (bundle.hiddenAudioEl) {
      bundle.hiddenAudioEl.pause();
      bundle.hiddenAudioEl.srcObject = null;
      bundle.hiddenAudioEl.remove();
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
