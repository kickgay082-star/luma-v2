'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import {
  ClientToServerEvents,
  PlayerState,
  PlayerTransformUpdate,
  ROOM_THEMES,
  RoomCustomization,
  RoomSummary,
  SeatState,
  ServerToClientEvents,
  SpatialVoiceSettings,
  Vec3,
  VideoSourceType,
  GraphicsQuality,
} from '@luma/shared';
import {
  Armchair,
  ArrowLeft,
  Camera,
  Check,
  Copy,
  Eye,
  Lock,
  Maximize,
  MessageSquare,
  Mic,
  MicOff,
  Minimize,
  MonitorUp,
  MousePointerClick,
  Paintbrush,
  Pause,
  Play,
  Radio,
  Settings,
  SkipForward,
  Tv,
  UserPlus,
  Users,
  Volume2,
  Wifi,
  ZoomIn,
  ZoomOut,
  X,
} from 'lucide-react';
import { getEffectiveAvatar, useLumaStore } from '@/stores/useLumaStore';
import { CameraMode, MobileInputState } from '@/components/three/PlayerControllers3D';
import { RoomHudDrawers, ActiveDrawer } from '@/components/room/RoomHudDrawers';
import { TheaterVideoOverlay } from '@/components/room/TheaterVideoOverlay';
import { Lite2DRoomView } from '@/components/room/Lite2DRoomView';
import { SpatialVoiceEngine } from '@/lib/audio/SpatialVoiceEngine';
import { AmbientMusicEngine } from '@/lib/audio/AmbientMusicEngine';
import { ScreenShareEngine } from '@/lib/video/ScreenShareEngine';

const RoomCanvasScene = dynamic(
  () => import('@/components/room/RoomCanvasScene').then((m) => m.RoomCanvasScene),
  { ssr: false },
);

const REALTIME_URL =
  process.env.NEXT_PUBLIC_REALTIME_URL || 'http://localhost:4001';

function detectWebGLSupport(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')),
    );
  } catch {
    return false;
  }
}

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const roomIdOrCode = params.id;

  const user = useLumaStore((s) => s.user);
  const authLoaded = useLumaStore((s) => s.authLoaded);
  const graphicsQuality = useLumaStore((s) => s.graphicsQuality);
  const setGraphicsQuality = useLumaStore((s) => s.setGraphicsQuality);
  const spatialSettings = useLumaStore((s) => s.spatialSettings);
  const setSpatialSettings = useLumaStore((s) => s.setSpatialSettings);

  const connectionStatus = useLumaStore((s) => s.connectionStatus);
  const connectionError = useLumaStore((s) => s.connectionError);
  const latencyMs = useLumaStore((s) => s.latencyMs);
  const localPlayerId = useLumaStore((s) => s.localPlayerId);
  const room = useLumaStore((s) => s.room);
  const customization = useLumaStore((s) => s.customization);
  const playersMap = useLumaStore((s) => s.players);
  const seats = useLumaStore((s) => s.seats);
  const video = useLumaStore((s) => s.video);
  const screenShare = useLumaStore((s) => s.screenShare);
  const screenShareStream = useLumaStore((s) => s.screenShareStream);
  const queue = useLumaStore((s) => s.queue);
  const chatHistory = useLumaStore((s) => s.chatHistory);
  const micEnabled = useLumaStore((s) => s.micEnabled);
  const localAudioLevel = useLumaStore((s) => s.localAudioLevel);

  const setConnectionState = useLumaStore((s) => s.setConnectionState);
  const setLatencyMs = useLumaStore((s) => s.setLatencyMs);
  const applyRoomSnapshot = useLumaStore((s) => s.applyRoomSnapshot);
  const resetRoomState = useLumaStore((s) => s.resetRoomState);
  const upsertPlayer = useLumaStore((s) => s.upsertPlayer);
  const removePlayer = useLumaStore((s) => s.removePlayer);
  const applyRemoteMove = useLumaStore((s) => s.applyRemoteMove);
  const updatePeerVoiceState = useLumaStore((s) => s.updatePeerVoiceState);
  const setSeats = useLumaStore((s) => s.setSeats);
  const setVideo = useLumaStore((s) => s.setVideo);
  const setScreenShare = useLumaStore((s) => s.setScreenShare);
  const setScreenShareStream = useLumaStore((s) => s.setScreenShareStream);
  const setQueue = useLumaStore((s) => s.setQueue);
  const setCustomization = useLumaStore((s) => s.setCustomization);
  const addChatMessage = useLumaStore((s) => s.addChatMessage);
  const updateChatMessage = useLumaStore((s) => s.updateChatMessage);
  const deleteChatMessage = useLumaStore((s) => s.deleteChatMessage);
  const setLocalVoice = useLumaStore((s) => s.setLocalVoice);
  const setPeerDistances = useLumaStore((s) => s.setPeerDistances);

  const [roomMeta, setRoomMeta] = useState<RoomSummary | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [joinPassword, setJoinPassword] = useState('');
  const [guestName, setGuestName] = useState('');
  const [readyToConnect, setReadyToConnect] = useState(false);

  const [drawer, setDrawer] = useState<ActiveDrawer>('none');
  const [cameraMode, setCameraMode] = useState<CameraMode>('follow');
  const [cameraZoom, setCameraZoom] = useState<number>(4.8);
  const [screenVolume, setScreenVolume] = useState<number>(0.85);
  const [interactiveScreen, setInteractiveScreen] = useState<boolean>(false);
  const [nearestSeat, setNearestSeat] = useState<SeatState | null>(null);
  const [selectedRemote, setSelectedRemote] = useState<PlayerState | null>(null);
  const [hudVisible, setHudVisible] = useState<boolean>(true);
  const [theaterMode, setTheaterMode] = useState<boolean>(false);
  const [copiedInvite, setCopiedInvite] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [webglSupported, setWebglSupported] = useState<boolean>(true);
  const [displayTime, setDisplayTime] = useState<number>(0);

  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const voiceEngineRef = useRef<SpatialVoiceEngine | null>(null);
  const screenShareEngineRef = useRef<ScreenShareEngine | null>(null);
  const ambientEngineRef = useRef<AmbientMusicEngine | null>(null);
  const hudTimeoutRef = useRef<number | null>(null);
  const mobileInputRef = useRef<MobileInputState>({ moveX: 0, moveY: 0, run: false });
  const listenerTransformRef = useRef<{ position: Vec3; forward: Vec3; up: Vec3 }>({
    position: [0, 2, 10],
    forward: [0, 0, -1],
    up: [0, 1, 0],
  });
  const localPositionRef = useRef<Vec3>([0, 0, 8.5]);

  const players = useMemo(() => Object.values(playersMap), [playersMap]);
  const localPlayer = localPlayerId ? playersMap[localPlayerId] ?? null : null;
  const themeMeta = ROOM_THEMES[customization.theme] ?? ROOM_THEMES['premium-cinema'];

  useEffect(() => {
    setWebglSupported(detectWebGLSupport());
  }, []);

  // Load room metadata first to check privacy/password requirement
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(roomIdOrCode)}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          if (active) setMetaError('Oda bulunamadı veya kapatıldı.');
          return;
        }
        const data = await res.json();
        if (!active) return;
        setRoomMeta(data.room);
      } catch {
        if (active) setMetaError('Oda bilgisi alınamadı.');
      }
    })();
    return () => {
      active = false;
    };
  }, [roomIdOrCode]);

  // Auto-connect if authenticated and room doesn't require password (or user is owner)
  useEffect(() => {
    if (!authLoaded || !roomMeta) return;
    const isOwner = user && roomMeta.ownerId === user.id;
    if (user && (!roomMeta.hasPassword || isOwner)) {
      setReadyToConnect(true);
    }
  }, [authLoaded, roomMeta, user]);

  // Show temporary notice toast
  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => {
      setNotice((curr) => (curr === msg ? null : curr));
    }, 3600);
  }, []);

  // Auto-hide HUD on idle
  const bumpHud = useCallback(() => {
    setHudVisible(true);
    if (hudTimeoutRef.current) window.clearTimeout(hudTimeoutRef.current);
    hudTimeoutRef.current = window.setTimeout(() => {
      if (drawer === 'none' && !selectedRemote) {
        setHudVisible(false);
      }
    }, 4200);
  }, [drawer, selectedRemote]);

  useEffect(() => {
    if (drawer !== 'none' || selectedRemote) {
      setHudVisible(true);
      if (hudTimeoutRef.current) window.clearTimeout(hudTimeoutRef.current);
    } else {
      bumpHud();
    }
  }, [drawer, selectedRemote, bumpHud]);

  // ESC closes open overlays
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedRemote) setSelectedRemote(null);
        else if (drawer !== 'none') setDrawer('none');
        else if (interactiveScreen) setInteractiveScreen(false);
        else setHudVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [drawer, selectedRemote, interactiveScreen]);

  // Connect Socket.IO + Spatial Voice Engine
  useEffect(() => {
    if (!readyToConnect || !roomMeta) return;

    setConnectionState('connecting');
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(REALTIME_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1200,
    });
    socketRef.current = socket;

    const ambient = new AmbientMusicEngine();
    ambientEngineRef.current = ambient;

    const joinNow = () => {
      socket.emit(
        'room:join',
        {
          roomId: roomMeta.id,
          password: joinPassword || undefined,
          token: user?.token,
          guestName: guestName.trim() || undefined,
          avatar: getEffectiveAvatar(user),
        },
        (ack) => {
          if (!ack.ok || !ack.snapshot || !ack.playerId) {
            setConnectionState('error', ack.error || 'Odaya katılınamadı.');
            setReadyToConnect(false);
            return;
          }
          applyRoomSnapshot(ack.playerId, ack.snapshot);

          const self = ack.snapshot.players.find((p) => p.id === ack.playerId);
          if (self) localPositionRef.current = [...self.position];

          const hadMic = voiceEngineRef.current?.isMicEnabled() ?? false;
          if (
            voiceEngineRef.current &&
            voiceEngineRef.current.getLocalPlayerId() !== ack.playerId
          ) {
            voiceEngineRef.current.destroy();
            voiceEngineRef.current = null;
          }

          if (!voiceEngineRef.current) {
            const voice = new SpatialVoiceEngine({
              socket,
              localPlayerId: ack.playerId,
              settings: useLumaStore.getState().spatialSettings,
              onLocalVoiceUpdate: (enabled, speaking, lvl) => {
                setLocalVoice(enabled, speaking, lvl);
              },
              onError: (msg) => showNotice(msg),
            });
            voiceEngineRef.current = voice;
            if (hadMic) {
              voice.enableMicrophone(false).catch(() => {});
            }
          }
          voiceEngineRef.current.syncPeers(ack.snapshot.players.map((p) => p.id));

          if (
            screenShareEngineRef.current &&
            screenShareEngineRef.current.getLocalPlayerId() !== ack.playerId
          ) {
            screenShareEngineRef.current.destroy();
            screenShareEngineRef.current = null;
          }
          if (!screenShareEngineRef.current) {
            screenShareEngineRef.current = new ScreenShareEngine({
              socket,
              localPlayerId: ack.playerId,
              onRemoteStream: (stream) => setScreenShareStream(stream),
              onStopped: () => setScreenShareStream(null),
            });
          }
          screenShareEngineRef.current.syncViewers(ack.snapshot.players.map((p) => p.id));
        },
      );
    };

    socket.on('connect', joinNow);
    socket.on('reconnect_attempt' as never, () => setConnectionState('reconnecting'));
    socket.on('connect_error', () => {
      setConnectionState('reconnecting', 'Gerçek zamanlı sunucuya bağlanılıyor...');
    });

    socket.on('player:joined', (p) => {
      upsertPlayer(p);
      const allIds = Object.keys(useLumaStore.getState().players);
      voiceEngineRef.current?.syncPeers(allIds);
      screenShareEngineRef.current?.syncViewers(allIds);
      showNotice(`${p.displayName} odaya katıldı.`);
    });

    socket.on('player:left', ({ playerId }) => {
      const leaving = useLumaStore.getState().players[playerId];
      removePlayer(playerId);
      const allIds = Object.keys(useLumaStore.getState().players);
      voiceEngineRef.current?.syncPeers(allIds);
      screenShareEngineRef.current?.syncViewers(allIds);
      if (leaving) showNotice(`${leaving.displayName} odadan ayrıldı.`);
    });

    socket.on('player:moved', applyRemoteMove);
    socket.on('player:updated', upsertPlayer);
    socket.on('seats:synced', setSeats);
    socket.on('voice:peer_state', updatePeerVoiceState);

    socket.on('webrtc:offer', (payload) => {
      voiceEngineRef.current?.handleSignal('offer', payload);
    });
    socket.on('webrtc:answer', (payload) => {
      voiceEngineRef.current?.handleSignal('answer', payload);
    });
    socket.on('webrtc:ice', (payload) => {
      voiceEngineRef.current?.handleSignal('ice', payload);
    });
    socket.on('voice:pcm', (payload) => {
      voiceEngineRef.current?.handleIncomingPcm(payload);
    });
    socket.on('screenshare:state', (st) => {
      setScreenShare(st);
      if (!st.active) {
        screenShareEngineRef.current?.closeIncoming();
        setScreenShareStream(null);
      }
    });
    socket.on('screenshare:offer', (payload) => {
      screenShareEngineRef.current?.handleSignal('offer', payload);
    });
    socket.on('screenshare:answer', (payload) => {
      screenShareEngineRef.current?.handleSignal('answer', payload);
    });
    socket.on('screenshare:ice', (payload) => {
      screenShareEngineRef.current?.handleSignal('ice', payload);
    });

    socket.on('video:synced', setVideo);
    socket.on('queue:synced', setQueue);
    socket.on('room:customized', ({ customization: nextCustom, seats: nextSeats }) => {
      setCustomization(nextCustom, nextSeats);
    });
    socket.on('chat:message', addChatMessage);
    socket.on('chat:updated', updateChatMessage);
    socket.on('chat:deleted', deleteChatMessage);
    socket.on('room:notice', ({ message }) => showNotice(message));
    socket.on('mod:kicked', (reason) => {
      showNotice(reason);
      router.push('/');
    });

    const hbTimer = window.setInterval(() => {
      if (!socket.connected) return;
      const sentAt = performance.now();
      socket.emit('room:heartbeat', Date.now(), () => {
        setLatencyMs(Math.round(performance.now() - sentAt));
      });
    }, 3500);

    return () => {
      window.clearInterval(hbTimer);
      socket.emit('room:leave');
      socket.disconnect();
      socketRef.current = null;
      voiceEngineRef.current?.destroy();
      voiceEngineRef.current = null;
      screenShareEngineRef.current?.destroy();
      screenShareEngineRef.current = null;
      ambient.stop();
      ambientEngineRef.current = null;
      resetRoomState();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyToConnect, roomMeta?.id]);

  // Ambient Music Preset Sync
  useEffect(() => {
    ambientEngineRef.current?.setPreset(customization.ambientMusic);
  }, [customization.ambientMusic]);

  // Spatial Audio 15Hz Update Loop
  useEffect(() => {
    const timer = window.setInterval(() => {
      const voice = voiceEngineRef.current;
      const state = useLumaStore.getState();
      if (!voice || !state.localPlayerId) return;

      const distances = voice.updateSpatialPositions({
        listenerPosition: listenerTransformRef.current.position,
        listenerForward: listenerTransformRef.current.forward,
        listenerUp: listenerTransformRef.current.up,
        localPlayerPosition: localPositionRef.current,
        players: state.players,
        peerVolumes: state.peerVolumes,
        peerLocalMutes: state.peerLocalMutes,
        blockedUserIds: state.blockedUserIds,
        roomMaxDistance: state.customization.spatialVoiceMaxDistance,
      });
      setPeerDistances(distances);
    }, 65);
    return () => window.clearInterval(timer);
  }, [setPeerDistances]);

  // Live video timeline ticker
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!video) {
        setDisplayTime(0);
        return;
      }
      if (!video.isPlaying || video.isLive) {
        setDisplayTime(video.currentTime);
        return;
      }
      const elapsed = Math.max(0, (Date.now() - video.updatedAt) / 1000) * video.playbackRate;
      setDisplayTime(video.currentTime + elapsed);
    }, 450);
    return () => window.clearInterval(timer);
  }, [video]);

  const handleClaimSeat = useCallback(
    (seatId: string) => {
      socketRef.current?.emit('seat:claim', seatId, (res) => {
        if (!res.ok && res.error) showNotice(res.error);
      });
    },
    [showNotice],
  );

  const handleLeaveSeat = useCallback(() => {
    socketRef.current?.emit('seat:leave');
  }, []);

  const handleInteractSeat = useCallback(
    (seat: SeatState | null) => {
      if (localPlayer?.seatedSeatId) {
        handleLeaveSeat();
        return;
      }
      if (seat && !seat.occupiedBy) {
        handleClaimSeat(seat.id);
      }
    },
    [localPlayer?.seatedSeatId, handleClaimSeat, handleLeaveSeat],
  );

  const handleToggleMic = async () => {
    const voice = voiceEngineRef.current;
    if (!voice) return;
    if (localPlayer?.mutedByMod) {
      showNotice('Oda yöneticisi mikrofonunuzu kilitledi.');
      return;
    }
    await voice.toggleMicrophone();
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleCopyInvite = () => {
    const inviteUrl = `${window.location.origin}/room/${room?.code || roomIdOrCode}`;
    navigator.clipboard?.writeText(inviteUrl).catch(() => {});
    setCopiedInvite(true);
    window.setTimeout(() => setCopiedInvite(false), 2000);
  };

  const handleUpdateSpatial = (patch: Partial<SpatialVoiceSettings>) => {
    setSpatialSettings(patch);
    const next = { ...useLumaStore.getState().spatialSettings, ...patch };
    voiceEngineRef.current?.updateSettings(next);
    if (user) {
      fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spatialVoice: next }),
      }).catch(() => {});
    }
  };

  const handleUpdateGraphics = (q: GraphicsQuality) => {
    setGraphicsQuality(q);
    try {
      window.localStorage.setItem('luma_graphics_quality', q);
    } catch {
      // ignore
    }
  };

  if (metaError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#090A0F] p-6 text-center">
        <p className="text-lg font-semibold text-white">{metaError}</p>
        <Link
          href="/"
          className="mt-4 rounded-xl bg-[#7C5CFF] px-5 py-2.5 text-sm font-medium text-white"
        >
          Ana Sayfaya Dön
        </Link>
      </div>
    );
  }

  // Entry gate for password-protected room or guest name entry
  if (!readyToConnect) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090A0F] p-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#10121A] p-7">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Odalara Dön
          </Link>

          <h1 className="mt-4 text-xl font-semibold text-white">
            {roomMeta?.name || 'Odaya Katıl'}
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            {roomMeta ? `${ROOM_THEMES[roomMeta.theme]?.name || '3D Salon'} · #${roomMeta.code}` : 'Oda yükleniyor...'}
          </p>

          {connectionError && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {connectionError}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setReadyToConnect(true);
            }}
            className="mt-5 space-y-4"
          >
            {!user && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                  Oda İçi Görünen Adın
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={24}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Örn. Misafir Sinemacı"
                  className="w-full rounded-xl border border-white/10 bg-[#090A0F] px-3.5 py-2.5 text-sm text-white focus:border-[#7C5CFF] focus:outline-none"
                />
              </div>
            )}

            {roomMeta?.hasPassword && (!user || roomMeta.ownerId !== user.id) && (
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-300">
                  <Lock className="h-3.5 w-3.5 text-amber-400" /> Oda Şifresi
                </label>
                <input
                  type="password"
                  required
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  placeholder="Şifreyi girin"
                  className="w-full rounded-xl border border-white/10 bg-[#090A0F] px-3.5 py-2.5 text-sm text-white focus:border-[#7C5CFF] focus:outline-none"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={!roomMeta}
              className="w-full rounded-xl bg-[#7C5CFF] py-2.5 text-sm font-medium text-white transition hover:bg-[#6D4AF5] disabled:opacity-50"
            >
              3D Salona Gir
            </button>
          </form>
        </div>
      </div>
    );
  }

  const use2DLite = graphicsQuality === '2d-lite' || !webglSupported;
  const isPrivileged = localPlayer?.role === 'owner' || localPlayer?.role === 'moderator';
  const canControlVideo = localPlayer
    ? (localPlayer.canControlVideo ?? (isPrivileged || !video?.hostOnlyControl))
    : false;

  const emitVideoControl = (payload: {
    action: 'play' | 'pause' | 'seek' | 'rate';
    currentTime?: number;
    playbackRate?: number;
  }) => {
    socketRef.current?.emit('video:control', payload, (r) => {
      if (!r.ok && r.error) showNotice(r.error);
    });
  };

  const isLocalScreenSharer = Boolean(
    localPlayerId && screenShare.active && screenShare.sharerId === localPlayerId,
  );

  const handleToggleScreenShare = async () => {
    const engine = screenShareEngineRef.current;
    const sock = socketRef.current;
    if (!engine || !sock) return;

    if (engine.isSharing() || isLocalScreenSharer) {
      engine.stopSharing();
      setScreenShareStream(null);
      return;
    }

    const viewerIds = Object.keys(useLumaStore.getState().players);
    sock.emit('screenshare:start', async (res) => {
      if (!res?.ok) {
        showNotice(res?.error || 'Sekme/ekran paylaşımı başlatılamadı.');
        return;
      }
      const stream = await engine.startSharing(viewerIds);
      if (!stream) {
        sock.emit('screenshare:stop');
        showNotice('Ekran veya sekme seçimi iptal edildi.');
        return;
      }
      setScreenShareStream(stream);
      showNotice('Sekme/ekran yayını 3D perdeye aktarıldı!');
    });
  };

  return (
    <div
      onMouseMove={bumpHud}
      onTouchStart={bumpHud}
      className="relative h-screen w-screen overflow-hidden bg-[#05060A] select-none"
    >
      {/* Main 3D World OR 2D Lite Fallback */}
      {use2DLite ? (
        <Lite2DRoomView
          customization={customization}
          localPlayer={localPlayer}
          players={players}
          seats={seats}
          video={video}
          onMoveClick={(u) => socketRef.current?.emit('player:move', u)}
          onClaimSeat={handleClaimSeat}
          onLeaveSeat={handleLeaveSeat}
        />
      ) : (
        <RoomCanvasScene
          graphicsQuality={graphicsQuality}
          customization={customization}
          seats={seats}
          players={players}
          localPlayer={localPlayer}
          nearestSeat={nearestSeat}
          video={video}
          cameraMode={cameraMode}
          cameraZoom={cameraZoom}
          screenVolume={screenVolume}
          interactiveScreen={interactiveScreen}
          suspended={theaterMode}
          screenShareStream={screenShareStream}
          isLocalScreenSharer={isLocalScreenSharer}
          canControlVideo={canControlVideo}
          inputLocked={drawer !== 'none' || theaterMode}
          mobileInputRef={mobileInputRef}
          listenerTransformRef={listenerTransformRef}
          localPositionRef={localPositionRef}
          onTransformEmit={(u: PlayerTransformUpdate) =>
            socketRef.current?.emit('player:move', u)
          }
          onNearestSeatChange={setNearestSeat}
          onInteractSeat={handleInteractSeat}
          onClaimSeat={handleClaimSeat}
          onSelectRemotePlayer={(p) => setSelectedRemote(p)}
          onPlayerSyncAction={emitVideoControl}
          onVideoEnded={() => socketRef.current?.emit('queue:next')}
        />
      )}

      {/* Top Minimal HUD Bar */}
      <header
        className={`fixed left-0 right-0 top-0 z-20 flex items-center justify-between px-4 py-3 transition-opacity duration-300 ${
          hudVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0B0D14]/85 px-3.5 py-2 backdrop-blur-md">
          <Link
            href="/"
            className="rounded-lg p-1 text-zinc-400 transition hover:bg-white/10 hover:text-white"
            title="Odadan Ayrıl"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-semibold text-white sm:text-sm">
                {room?.name || roomMeta?.name}
              </h1>
              <span className="hidden rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 sm:inline">
                {themeMeta.name}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Connection & Latency Pill */}
          <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-[#0B0D14]/85 px-3 py-2 text-xs backdrop-blur-md sm:flex">
            <span
              className={`h-2 w-2 rounded-full ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-400'
                  : connectionStatus === 'reconnecting'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-red-400'
              }`}
            />
            <span className="font-mono text-[11px] text-zinc-300">
              {connectionStatus === 'connected' ? `${latencyMs} ms` : 'Bağlanıyor'}
            </span>
            <span className="text-zinc-600">·</span>
            <Users className="h-3.5 w-3.5 text-zinc-400" />
            <span className="font-mono text-[11px] text-zinc-200">{players.length}</span>
          </div>

          <button
            type="button"
            onClick={handleCopyInvite}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#0B0D14]/85 px-3 py-2 text-xs font-medium text-zinc-200 backdrop-blur-md hover:border-white/25"
          >
            {copiedInvite ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Kopyalandı</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-[#7C5CFF]" />
                <span className="hidden sm:inline">Davet</span>
              </>
            )}
          </button>

          {isPrivileged && (
            <button
              type="button"
              onClick={() => setDrawer(drawer === 'customize' ? 'none' : 'customize')}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium backdrop-blur-md transition ${
                drawer === 'customize'
                  ? 'border-[#7C5CFF] bg-[#7C5CFF] text-white'
                  : 'border-white/10 bg-[#0B0D14]/85 text-zinc-200 hover:text-white'
              }`}
              title="Mekan ve Oda Özelleştirme"
            >
              <Paintbrush className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Mekan</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setDrawer(drawer === 'settings' ? 'none' : 'settings')}
            className={`rounded-xl border p-2 backdrop-blur-md transition ${
              drawer === 'settings'
                ? 'border-[#7C5CFF] bg-[#7C5CFF] text-white'
                : 'border-white/10 bg-[#0B0D14]/85 text-zinc-300 hover:text-white'
            }`}
            title="Ses & Grafik Ayarları"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Transient Toast Notice */}
      {notice && (
        <div className="fixed left-1/2 top-16 z-30 -translate-x-1/2 rounded-full border border-white/15 bg-[#10121A]/95 px-4 py-1.5 text-xs font-medium text-zinc-100 shadow-lg backdrop-blur-md">
          {notice}
        </div>
      )}

      {/* Seat Interaction Prompt */}
      {(localPlayer?.seatedSeatId || (nearestSeat && !nearestSeat.occupiedBy)) && (
        <div className="fixed bottom-24 left-1/2 z-20 -translate-x-1/2">
          <button
            type="button"
            onClick={() =>
              localPlayer?.seatedSeatId
                ? handleLeaveSeat()
                : nearestSeat && handleClaimSeat(nearestSeat.id)
            }
            className="flex items-center gap-2 rounded-full border border-[#7C5CFF]/50 bg-[#10121A]/90 px-4 py-2 text-xs font-medium text-white shadow-xl backdrop-blur-md transition hover:bg-[#7C5CFF]"
          >
            <Armchair className="h-4 w-4" />
            {localPlayer?.seatedSeatId ? (
              <span>Koltuktan Kalk [E / F]</span>
            ) : (
              <span>{nearestSeat?.label} — Otur [E / F]</span>
            )}
          </button>
        </div>
      )}

      {/* Selected Avatar Quick Social Popover */}
      {selectedRemote && (
        <div className="fixed bottom-24 left-4 z-30 w-64 rounded-2xl border border-white/10 bg-[#10121A]/95 p-3.5 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white">{selectedRemote.displayName}</p>
              <p className="font-mono text-[10px] text-zinc-400">@{selectedRemote.username}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedRemote(null)}
              className="rounded p-1 text-zinc-500 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                useLumaStore.getState().togglePeerLocalMute(selectedRemote.userId);
              }}
              className="flex-1 rounded-lg border border-white/10 bg-[#090A0F] py-1.5 text-[11px] text-zinc-200 hover:bg-white/5"
            >
              {useLumaStore.getState().peerLocalMutes[selectedRemote.userId]
                ? 'Sesi Aç'
                : 'Sustur'}
            </button>
            {isPrivileged && selectedRemote.role === 'member' && (
              <button
                type="button"
                onClick={() => {
                  const nextAllow = !selectedRemote.canControlVideo;
                  socketRef.current?.emit('mod:action', {
                    targetPlayerId: selectedRemote.id,
                    action: nextAllow ? 'allow_video' : 'deny_video',
                  });
                  setSelectedRemote({ ...selectedRemote, canControlVideo: nextAllow });
                  showNotice(
                    nextAllow
                      ? `${selectedRemote.displayName} artık video açıp kontrol edebilir.`
                      : `${selectedRemote.displayName} video kontrol yetkisi kaldırıldı.`,
                  );
                }}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${
                  selectedRemote.canControlVideo
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {selectedRemote.canControlVideo ? 'Video İzni ✓' : 'Video İzni Ver'}
              </button>
            )}
            {user && !selectedRemote.userId.startsWith('guest-') && (
              <button
                type="button"
                onClick={async () => {
                  await fetch('/api/friends', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'add',
                      username: selectedRemote.username,
                    }),
                  });
                  showNotice(`${selectedRemote.displayName} kullanıcısına arkadaşlık isteği gönderildi.`);
                }}
                className="flex items-center justify-center gap-1 rounded-lg bg-[#7C5CFF] px-3 py-1.5 text-[11px] font-medium text-white"
              >
                <UserPlus className="h-3 w-3" /> Ekle
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mobile Touch Pad (visible on touch/small screens) */}
      {!use2DLite && (
        <div className="fixed bottom-24 left-4 z-20 grid grid-cols-3 gap-1 md:hidden">
          <div />
          <TouchMoveBtn
            label="▲"
            onHold={(down) => {
              mobileInputRef.current.moveY = down ? 1 : 0;
            }}
          />
          <div />
          <TouchMoveBtn
            label="◀"
            onHold={(down) => {
              mobileInputRef.current.moveX = down ? -1 : 0;
            }}
          />
          <TouchMoveBtn
            label="▼"
            onHold={(down) => {
              mobileInputRef.current.moveY = down ? -1 : 0;
            }}
          />
          <TouchMoveBtn
            label="▶"
            onHold={(down) => {
              mobileInputRef.current.moveX = down ? 1 : 0;
            }}
          />
        </div>
      )}

      {/* Bottom Minimal Cinema HUD Dock */}
      <footer
        className={`fixed bottom-3 left-1/2 z-20 flex w-[calc(100%-1.5rem)] max-w-4xl -translate-x-1/2 flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#0B0D14]/90 px-3 py-2 shadow-2xl backdrop-blur-xl transition-all duration-300 ${
          hudVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
        }`}
      >
        {/* Left: Voice + Camera */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleToggleMic}
            className={`relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
              micEnabled
                ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                : 'bg-white/[0.06] text-zinc-300 hover:bg-white/10'
            }`}
          >
            {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            <span className="hidden sm:inline">{micEnabled ? 'Mikrofon Açık' : 'Sessiz'}</span>
            {micEnabled && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-emerald-400 transition-transform"
                style={{ transform: `scale(${1 + localAudioLevel * 1.4})` }}
              />
            )}
          </button>

          {!use2DLite && (
            <>
              <button
                type="button"
                onClick={() =>
                  setCameraMode((m) =>
                    m === 'follow' ? 'orbit' : m === 'orbit' ? 'cinema' : 'follow',
                  )
                }
                className="flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-2.5 py-2 text-xs text-zinc-300 hover:bg-white/10"
                title="Kamera Açısı"
              >
                <Camera className="h-4 w-4" />
                <span className="hidden lg:inline">
                  {cameraMode === 'follow'
                    ? 'Takip'
                    : cameraMode === 'orbit'
                      ? 'Orbit'
                      : 'Perde'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setCameraZoom((z) => Math.max(2.4, z - 0.8))}
                className="hidden rounded-xl bg-white/[0.06] p-2 text-zinc-300 hover:bg-white/10 sm:inline-flex"
                title="Yakınlaş"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCameraZoom((z) => Math.min(9.2, z + 0.8))}
                className="hidden rounded-xl bg-white/[0.06] p-2 text-zinc-300 hover:bg-white/10 sm:inline-flex"
                title="Uzaklaş"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {/* Center: Synchronized Video Playback Controls */}
        <div className="flex flex-1 items-center justify-center gap-2 px-2">
          {video?.url ? (
            <>
              <button
                type="button"
                onClick={() =>
                  emitVideoControl({
                    action: video.isPlaying ? 'pause' : 'play',
                  })
                }
                className={`rounded-xl p-2 text-white transition ${
                  canControlVideo
                    ? 'bg-[#7C5CFF] hover:bg-[#6D4AF5]'
                    : 'bg-white/10 text-zinc-400 hover:bg-white/15'
                }`}
                title={canControlVideo ? 'Oynat / Duraklat' : 'Sadece Host / Yetkililer kontrol edebilir'}
              >
                {video.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>

              {!video.isLive ? (
                <div className="hidden items-center gap-1.5 sm:flex">
                  <span className="font-mono text-[11px] text-zinc-400">
                    {formatClock(displayTime)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      emitVideoControl({
                        action: 'seek',
                        currentTime: Math.max(0, displayTime - 15),
                      })
                    }
                    className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-white/10"
                  >
                    -15s
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      emitVideoControl({
                        action: 'seek',
                        currentTime: displayTime + 15,
                      })
                    }
                    className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-white/10"
                  >
                    +15s
                  </button>
                  <select
                    aria-label="Oynatma Hızı"
                    value={video.playbackRate}
                    disabled={!canControlVideo}
                    onChange={(e) =>
                      emitVideoControl({
                        action: 'rate',
                        playbackRate: Number(e.target.value),
                      })
                    }
                    className="rounded-md border border-white/10 bg-[#090A0F] px-1.5 py-0.5 font-mono text-[10px] text-zinc-200 outline-none focus:border-[#7C5CFF] disabled:opacity-50"
                    title="Oynatma Hızı (Tüm odada senkronize olur)"
                  >
                    {[0.5, 1, 1.25, 1.5, 2].map((r) => (
                      <option key={r} value={r}>
                        {r}x
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="flex items-center gap-1 rounded-md bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                  <Radio className="h-3 w-3" /> CANLI
                </span>
              )}

              {queue.length > 0 && (
                <button
                  type="button"
                  onClick={() => socketRef.current?.emit('queue:next')}
                  className="rounded-xl bg-white/[0.06] p-2 text-zinc-300 hover:bg-white/10"
                  title="Sıradaki"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
              )}

              <div className="hidden items-center gap-1.5 md:flex">
                <Volume2 className="h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={screenVolume}
                  onChange={(e) => setScreenVolume(Number(e.target.value))}
                  className="w-16 accent-[#7C5CFF]"
                />
              </div>

              {video.sourceType === 'youtube' && !use2DLite && (
                <button
                  type="button"
                  onClick={() => setInteractiveScreen((v) => !v)}
                  className={`hidden items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-medium lg:flex ${
                    interactiveScreen
                      ? 'bg-[#3B82F6] text-white'
                      : 'bg-white/[0.06] text-zinc-300'
                  }`}
                  title="YouTube oynatıcıya doğrudan tıkla"
                >
                  <MousePointerClick className="h-3.5 w-3.5" />
                  <span>Perde Kontrolü</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setTheaterMode(true)}
                className="flex items-center gap-1.5 rounded-xl bg-[#3B82F6]/20 px-2.5 py-1.5 text-[11px] font-medium text-blue-200 ring-1 ring-blue-500/35 transition hover:bg-[#3B82F6]/30"
                title="Videoyu 3D sahne olmadan normal tam ekran modunda izle"
              >
                <Tv className="h-3.5 w-3.5" />
                <span>Normal İzle</span>
              </button>
            </>
          ) : screenShareStream ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 rounded-md bg-emerald-500/20 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                <MonitorUp className="h-3.5 w-3.5" />
                {screenShare.sharerName ? `${screenShare.sharerName} Yayında` : 'Sekme Yayını'}
              </span>
              <button
                type="button"
                onClick={() => setTheaterMode(true)}
                className="flex items-center gap-1.5 rounded-xl bg-[#3B82F6]/20 px-2.5 py-1.5 text-[11px] font-medium text-blue-200 ring-1 ring-blue-500/35 transition hover:bg-[#3B82F6]/30"
              >
                <Tv className="h-3.5 w-3.5" />
                <span>Normal İzle</span>
              </button>
            </div>
          ) : (
            <span className="hidden text-xs text-zinc-500 sm:inline">
              WASD ile yürü · Fare ile dön · E/F ile otur
            </span>
          )}
        </div>

        {/* Right: Drawers & Fullscreen */}
        <div className="flex items-center gap-1.5">
          {canControlVideo && (
            <button
              type="button"
              onClick={handleToggleScreenShare}
              className={`hidden items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition md:flex ${
                isLocalScreenSharer
                  ? 'bg-red-500/80 text-white hover:bg-red-500'
                  : 'bg-[#3B82F6]/20 text-blue-200 ring-1 ring-blue-500/30 hover:bg-[#3B82F6]/30'
              }`}
              title="Kendi tarayıcından bir sekmeyi sesle 3D perdeye yansıt"
            >
              <MonitorUp className="h-4 w-4" />
              <span>{isLocalScreenSharer ? 'Yayını Durdur' : 'Sekme Paylaş'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setDrawer(drawer === 'media' ? 'none' : 'media')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
              drawer === 'media'
                ? 'bg-[#7C5CFF] text-white'
                : 'bg-white/[0.06] text-zinc-200 hover:bg-white/10'
            }`}
          >
            <Radio className="h-4 w-4" />
            <span className="hidden sm:inline">Medya / IPTV</span>
          </button>

          <button
            type="button"
            onClick={() => setDrawer(drawer === 'social' ? 'none' : 'social')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
              drawer === 'social'
                ? 'bg-[#7C5CFF] text-white'
                : 'bg-white/[0.06] text-zinc-200 hover:bg-white/10'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Sohbet</span>
          </button>

          <button
            type="button"
            onClick={() => setHudVisible(false)}
            className="hidden rounded-xl bg-white/[0.06] p-2 text-zinc-400 hover:text-white md:inline-flex"
            title="Arayüzü Gizle"
          >
            <Eye className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="rounded-xl bg-white/[0.06] p-2 text-zinc-300 hover:bg-white/10"
            title="Tam Ekran"
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </footer>

      {/* Normal Fullscreen Video Mode (2D Theater Overlay) */}
      {theaterMode && (
        <TheaterVideoOverlay
          roomName={room?.name || roomMeta?.name || 'Luma'}
          onlineCount={players.length}
          video={video}
          screenShareStream={screenShareStream}
          screenShareName={screenShare.sharerName}
          isLocalScreenSharer={isLocalScreenSharer}
          displayTime={displayTime}
          hasQueue={queue.length > 0}
          screenVolume={screenVolume}
          micEnabled={micEnabled}
          localAudioLevel={localAudioLevel}
          canControlVideo={canControlVideo}
          onChangeVolume={setScreenVolume}
          onStopScreenShare={handleToggleScreenShare}
          onTogglePlay={() =>
            emitVideoControl({
              action: video?.isPlaying ? 'pause' : 'play',
            })
          }
          onSeek={(targetSec) =>
            emitVideoControl({
              action: 'seek',
              currentTime: targetSec,
            })
          }
          onChangeRate={(rate) =>
            emitVideoControl({
              action: 'rate',
              playbackRate: rate,
            })
          }
          onPlayerSyncAction={emitVideoControl}
          onNextQueue={() => socketRef.current?.emit('queue:next')}
          onVideoEnded={() => socketRef.current?.emit('queue:next')}
          onToggleMic={handleToggleMic}
          onOpenMedia={() => setDrawer(drawer === 'media' ? 'none' : 'media')}
          onOpenSocial={() => setDrawer(drawer === 'social' ? 'none' : 'social')}
          onExitTheater={() => {
            if (document.fullscreenElement) {
              document.exitFullscreen().catch(() => {});
            }
            setTheaterMode(false);
          }}
        />
      )}

      {/* Slide-Over HUD Drawers */}
      <RoomHudDrawers
        drawer={drawer}
        onClose={() => setDrawer('none')}
        localPlayer={localPlayer}
        players={players}
        customization={customization}
        video={video}
        screenShareActive={screenShare.active}
        screenShareName={screenShare.sharerName}
        isLocalScreenSharer={isLocalScreenSharer}
        onToggleScreenShare={handleToggleScreenShare}
        queue={queue}
        chatHistory={chatHistory}
        onLoadVideo={(p) =>
          socketRef.current?.emit(
            'video:control',
            { action: 'load', ...p },
            (r) => {
              if (!r.ok && r.error) showNotice(r.error);
            },
          )
        }
        onAddQueue={(p) =>
          socketRef.current?.emit('queue:add', p, (r) => {
            if (!r.ok && r.error) showNotice(r.error);
          })
        }
        onRemoveQueue={(id) => socketRef.current?.emit('queue:remove', id)}
        onPlayNextQueue={() => socketRef.current?.emit('queue:next')}
        onToggleHostLock={(hostOnlyControl) =>
          socketRef.current?.emit('video:control', {
            action: 'host_lock',
            hostOnlyControl,
          })
        }
        onSendChat={(content) =>
          socketRef.current?.emit('chat:send', content, (r) => {
            if (!r.ok && r.error) showNotice(r.error);
          })
        }
        onReactChat={(messageId, emoji) =>
          socketRef.current?.emit('chat:react', { messageId, emoji })
        }
        onPinChat={(messageId) => socketRef.current?.emit('chat:pin', messageId)}
        onDeleteChat={(messageId) => socketRef.current?.emit('chat:delete', messageId)}
        onCustomizeRoom={(patch: Partial<RoomCustomization>) =>
          socketRef.current?.emit('room:customize', patch, (r) => {
            if (!r.ok && r.error) showNotice(r.error);
          })
        }
        onModAction={(targetPlayerId, action) =>
          socketRef.current?.emit('mod:action', { targetPlayerId, action })
        }
        onUpdateSpatialSettings={handleUpdateSpatial}
        onUpdateGraphicsQuality={handleUpdateGraphics}
      />
    </div>
  );
}

function TouchMoveBtn({
  label,
  onHold,
}: {
  label: string;
  onHold: (down: boolean) => void;
}) {
  return (
    <button
      type="button"
      onPointerDown={() => onHold(true)}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onPointerLeave={() => onHold(false)}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-[#0B0D14]/85 text-xs text-white active:bg-[#7C5CFF]"
    >
      {label}
    </button>
  );
}
