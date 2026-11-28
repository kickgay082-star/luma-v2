'use client';

import { Socket } from 'socket.io-client';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  WebRTCSignalPayload,
} from '@luma/shared';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

interface ViewerBundle {
  pc: RTCPeerConnection;
  pendingIce: RTCIceCandidateInit[];
}

export class ScreenShareEngine {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  private localPlayerId: string;
  private localStream: MediaStream | null = null;
  private monitorAudioCtx: AudioContext | null = null;
  private monitorGain: GainNode | null = null;
  private outgoingPeers = new Map<string, ViewerBundle>();
  private incomingPc: RTCPeerConnection | null = null;
  private incomingSharerId: string | null = null;
  private incomingPendingIce: RTCIceCandidateInit[] = [];
  private onRemoteStream: (stream: MediaStream | null) => void;
  private onStopped: () => void;

  constructor(params: {
    socket: Socket<ServerToClientEvents, ClientToServerEvents>;
    localPlayerId: string;
    onRemoteStream: (stream: MediaStream | null) => void;
    onStopped: () => void;
  }) {
    this.socket = params.socket;
    this.localPlayerId = params.localPlayerId;
    this.onRemoteStream = params.onRemoteStream;
    this.onStopped = params.onStopped;
  }

  getLocalPlayerId(): string {
    return this.localPlayerId;
  }

  isSharing(): boolean {
    return Boolean(this.localStream);
  }

  async startSharing(remotePlayerIds: string[]): Promise<MediaStream | null> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 60 } },
        audio: true,
      });

      this.stopSharingInternal(false);
      this.localStream = stream;

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          this.stopSharing();
        };
      }

      this.syncViewers(remotePlayerIds);
      return stream;
    } catch {
      return null;
    }
  }

  /**
   * Starts capturing a background browser tab via an extension tabCapture streamId
   * without triggering an OS screen-picker dialog or touching Render/Vercel proxy IPs.
   */
  async startFromExtensionStreamId(
    streamId: string,
    remotePlayerIds: string[],
    monitorVolume = 0.85,
  ): Promise<MediaStream | null> {
    try {
      const constraints = {
        audio: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: streamId,
          },
        },
        video: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: streamId,
            maxWidth: 1920,
            maxHeight: 1080,
            maxFrameRate: 30,
          },
        },
      } as unknown as MediaStreamConstraints;

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.stopSharingInternal(false);
      this.localStream = stream;

      // Chrome mutes a captured tab locally; pipe audio back cleanly for the host
      if (stream.getAudioTracks().length > 0 && typeof AudioContext !== 'undefined') {
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const gain = ctx.createGain();
        gain.gain.value = Math.max(0, Math.min(1, monitorVolume));
        source.connect(gain);
        gain.connect(ctx.destination);
        this.monitorAudioCtx = ctx;
        this.monitorGain = gain;
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          this.stopSharing();
        };
      }

      this.syncViewers(remotePlayerIds);
      return stream;
    } catch {
      return null;
    }
  }

  setLocalMonitorVolume(volume: number): void {
    if (this.monitorGain && this.monitorAudioCtx) {
      this.monitorGain.gain.setTargetAtTime(
        Math.max(0, Math.min(1, volume)),
        this.monitorAudioCtx.currentTime,
        0.04,
      );
    }
  }

  syncViewers(remotePlayerIds: string[]): void {
    if (!this.localStream) return;
    const activeSet = new Set(remotePlayerIds.filter((id) => id !== this.localPlayerId));

    for (const [viewerId, bundle] of this.outgoingPeers.entries()) {
      if (!activeSet.has(viewerId)) {
        bundle.pc.close();
        this.outgoingPeers.delete(viewerId);
      }
    }

    for (const viewerId of activeSet) {
      if (!this.outgoingPeers.has(viewerId)) {
        void this.createOutgoingPeer(viewerId);
      }
    }
  }

  private async createOutgoingPeer(viewerId: string): Promise<void> {
    if (!this.localStream) return;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const bundle: ViewerBundle = { pc, pendingIce: [] };
    this.outgoingPeers.set(viewerId, bundle);

    for (const track of this.localStream.getTracks()) {
      pc.addTrack(track, this.localStream);
    }

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.socket.emit('screenshare:ice', {
          targetPlayerId: viewerId,
          candidate: ev.candidate.toJSON(),
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        pc.restartIce?.();
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (pc.localDescription) {
        this.socket.emit('screenshare:offer', {
          targetPlayerId: viewerId,
          sdp: { type: 'offer', sdp: pc.localDescription.sdp },
        });
      }
    } catch {
      // ignore
    }
  }

  async handleSignal(
    kind: 'offer' | 'answer' | 'ice',
    payload: WebRTCSignalPayload,
  ): Promise<void> {
    const peerId = payload.fromPlayerId;
    if (!peerId || peerId === this.localPlayerId) return;

    try {
      if (kind === 'offer' && payload.sdp) {
        this.closeIncoming();
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        this.incomingPc = pc;
        this.incomingSharerId = peerId;
        this.incomingPendingIce = [];

        const assembledStream = new MediaStream();
        pc.ontrack = (ev) => {
          if (ev.streams[0]) {
            this.onRemoteStream(ev.streams[0]);
          } else {
            assembledStream.addTrack(ev.track);
            this.onRemoteStream(assembledStream);
          }
        };

        pc.onicecandidate = (ev) => {
          if (ev.candidate) {
            this.socket.emit('screenshare:ice', {
              targetPlayerId: peerId,
              candidate: ev.candidate.toJSON(),
            });
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        for (const c of this.incomingPendingIce) {
          await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        this.incomingPendingIce = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (pc.localDescription) {
          this.socket.emit('screenshare:answer', {
            targetPlayerId: peerId,
            sdp: { type: 'answer', sdp: pc.localDescription.sdp },
          });
        }
      } else if (kind === 'answer' && payload.sdp) {
        const bundle = this.outgoingPeers.get(peerId);
        if (!bundle) return;
        await bundle.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        for (const c of bundle.pendingIce) {
          await bundle.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        bundle.pendingIce = [];
      } else if (kind === 'ice' && payload.candidate) {
        const outBundle = this.outgoingPeers.get(peerId);
        if (outBundle) {
          if (!outBundle.pc.remoteDescription) outBundle.pendingIce.push(payload.candidate);
          else await outBundle.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          return;
        }
        if (this.incomingPc && this.incomingSharerId === peerId) {
          if (!this.incomingPc.remoteDescription) this.incomingPendingIce.push(payload.candidate);
          else await this.incomingPc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        }
      }
    } catch {
      // ignore ICE race
    }
  }

  closeIncoming(): void {
    if (this.incomingPc) {
      this.incomingPc.close();
      this.incomingPc = null;
    }
    this.incomingSharerId = null;
    this.incomingPendingIce = [];
    this.onRemoteStream(null);
  }

  stopSharing(): void {
    this.stopSharingInternal(true);
  }

  private stopSharingInternal(emitStop: boolean): void {
    if (this.monitorAudioCtx) {
      this.monitorAudioCtx.close().catch(() => {});
      this.monitorAudioCtx = null;
      this.monitorGain = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    for (const bundle of this.outgoingPeers.values()) {
      bundle.pc.close();
    }
    this.outgoingPeers.clear();
    if (emitStop) {
      this.socket.emit('screenshare:stop');
      this.onStopped();
    }
  }

  destroy(): void {
    this.stopSharingInternal(false);
    this.closeIncoming();
  }
}
