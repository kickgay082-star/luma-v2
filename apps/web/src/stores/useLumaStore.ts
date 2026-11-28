'use client';

import { create } from 'zustand';
import {
  AvatarConfig,
  ChatMessage,
  DEFAULT_AVATAR_CONFIG,
  DEFAULT_ROOM_CUSTOMIZATION,
  GraphicsQuality,
  PlayerState,
  QueueItem,
  RoomCustomization,
  RoomGamesState,
  RoomStateSnapshot,
  RoomSummary,
  ScreenShareState,
  SeatState,
  SpatialVoiceSettings,
  UnoCard,
  Vec3,
  VideoState,
} from '@luma/shared';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  avatar: AvatarConfig;
  token: string;
}

export interface RemoteTargetTransform {
  position: Vec3;
  rotationY: number;
  headYaw: number;
  headPitch: number;
  velocity: Vec3;
  animState: PlayerState['animState'];
  serverTs: number;
}

interface LumaStoreState {
  user: AuthUser | null;
  authLoaded: boolean;
  graphicsQuality: GraphicsQuality;
  spatialSettings: SpatialVoiceSettings;

  // Active Multiplayer Room State
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  connectionError: string | null;
  latencyMs: number;
  localPlayerId: string | null;
  room: RoomSummary | null;
  customization: RoomCustomization;
  players: Record<string, PlayerState>;
  remoteTargets: Record<string, RemoteTargetTransform>;
  seats: SeatState[];
  video: VideoState | null;
  screenShare: ScreenShareState;
  screenShareStream: MediaStream | null;
  queue: QueueItem[];
  chatHistory: ChatMessage[];
  mutedChatUserIds: string[];
  games: RoomGamesState | null;
  unoHand: UnoCard[];

  // Client-local spatial audio & social controls
  micEnabled: boolean;
  localSpeaking: boolean;
  localAudioLevel: number;
  peerVolumes: Record<string, number>;
  peerLocalMutes: Record<string, boolean>;
  peerDistances: Record<string, number>;
  blockedUserIds: string[];

  setUser: (user: AuthUser | null) => void;
  setAuthLoaded: (loaded: boolean) => void;
  setUserAvatar: (avatar: AvatarConfig) => void;
  setGraphicsQuality: (q: GraphicsQuality) => void;
  setSpatialSettings: (patch: Partial<SpatialVoiceSettings>) => void;

  setConnectionState: (
    status: LumaStoreState['connectionStatus'],
    error?: string | null,
  ) => void;
  setLatencyMs: (ms: number) => void;
  applyRoomSnapshot: (playerId: string, snapshot: RoomStateSnapshot) => void;
  resetRoomState: () => void;

  upsertPlayer: (player: PlayerState) => void;
  removePlayer: (playerId: string) => void;
  applyRemoteMove: (payload: {
    playerId: string;
    position: Vec3;
    rotationY: number;
    headYaw: number;
    headPitch: number;
    velocity: Vec3;
    animState: PlayerState['animState'];
    serverTs: number;
  }) => void;
  updatePeerVoiceState: (payload: {
    playerId: string;
    micEnabled: boolean;
    isSpeaking: boolean;
    audioLevel: number;
  }) => void;
  setSeats: (seats: SeatState[]) => void;
  setVideo: (video: VideoState) => void;
  setScreenShare: (screenShare: ScreenShareState) => void;
  setScreenShareStream: (stream: MediaStream | null) => void;
  setQueue: (queue: QueueItem[]) => void;
  setCustomization: (customization: RoomCustomization, seats: SeatState[]) => void;
  addChatMessage: (msg: ChatMessage) => void;
  updateChatMessage: (msg: ChatMessage) => void;
  deleteChatMessage: (messageId: string) => void;
  clearChat: () => void;
  setGames: (games: RoomGamesState) => void;
  setUnoHand: (cards: UnoCard[]) => void;

  setLocalVoice: (micEnabled: boolean, isSpeaking: boolean, audioLevel: number) => void;
  setPeerVolume: (userId: string, volume: number) => void;
  togglePeerLocalMute: (userId: string) => void;
  toggleBlockUser: (userId: string) => void;
  setPeerDistances: (distances: Record<string, number>) => void;
}

const DEFAULT_SPATIAL: SpatialVoiceSettings = {
  micDeviceId: 'default',
  outputDeviceId: 'default',
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  inputGain: 1.0,
  masterVolume: 1.0,
  maxDistance: 15,
  refDistance: 3,
  acoustics: 'cinema-hall',
};

export const useLumaStore = create<LumaStoreState>((set) => ({
  user: null,
  authLoaded: false,
  graphicsQuality: 'high',
  spatialSettings: DEFAULT_SPATIAL,

  connectionStatus: 'disconnected',
  connectionError: null,
  latencyMs: 0,
  localPlayerId: null,
  room: null,
  customization: DEFAULT_ROOM_CUSTOMIZATION,
  players: {},
  remoteTargets: {},
  seats: [],
  video: null,
  screenShare: { active: false, sharerId: null, sharerName: null },
  screenShareStream: null,
  queue: [],
  chatHistory: [],
  mutedChatUserIds: [],
  games: null,
  unoHand: [],

  micEnabled: false,
  localSpeaking: false,
  localAudioLevel: 0,
  peerVolumes: {},
  peerLocalMutes: {},
  peerDistances: {},
  blockedUserIds: [],

  setUser: (user) => set({ user }),
  setAuthLoaded: (authLoaded) => set({ authLoaded }),
  setUserAvatar: (avatar) =>
    set((s) => ({
      user: s.user ? { ...s.user, avatar } : null,
      players:
        s.localPlayerId && s.players[s.localPlayerId]
          ? {
              ...s.players,
              [s.localPlayerId]: { ...s.players[s.localPlayerId], avatar },
            }
          : s.players,
    })),
  setGraphicsQuality: (graphicsQuality) => set({ graphicsQuality }),
  setSpatialSettings: (patch) =>
    set((s) => ({
      spatialSettings: { ...s.spatialSettings, ...patch },
    })),

  setConnectionState: (connectionStatus, error = null) =>
    set({ connectionStatus, connectionError: error }),
  setLatencyMs: (latencyMs) => set({ latencyMs }),

  applyRoomSnapshot: (playerId, snapshot) => {
    const playersMap: Record<string, PlayerState> = {};
    const remoteMap: Record<string, RemoteTargetTransform> = {};
    for (const p of snapshot.players) {
      playersMap[p.id] = p;
      if (p.id !== playerId) {
        remoteMap[p.id] = {
          position: p.position,
          rotationY: p.rotationY,
          headYaw: p.headYaw,
          headPitch: p.headPitch,
          velocity: p.velocity,
          animState: p.animState,
          serverTs: snapshot.serverTime,
        };
      }
    }
    set({
      connectionStatus: 'connected',
      connectionError: null,
      localPlayerId: playerId,
      room: snapshot.room,
      customization: snapshot.customization,
      players: playersMap,
      remoteTargets: remoteMap,
      seats: snapshot.seats,
      video: snapshot.video,
      screenShare: snapshot.screenShare ?? { active: false, sharerId: null, sharerName: null },
      queue: snapshot.queue,
      chatHistory: snapshot.chatHistory,
      mutedChatUserIds: snapshot.mutedChatUserIds,
      games: snapshot.games ?? null,
      unoHand: [],
    });
  },

  resetRoomState: () =>
    set({
      connectionStatus: 'disconnected',
      connectionError: null,
      localPlayerId: null,
      room: null,
      players: {},
      remoteTargets: {},
      seats: [],
      video: null,
      screenShare: { active: false, sharerId: null, sharerName: null },
      screenShareStream: null,
      queue: [],
      chatHistory: [],
      games: null,
      unoHand: [],
      micEnabled: false,
      localSpeaking: false,
      localAudioLevel: 0,
      peerDistances: {},
    }),

  upsertPlayer: (player) =>
    set((s) => ({
      players: { ...s.players, [player.id]: player },
      remoteTargets:
        player.id !== s.localPlayerId
          ? {
              ...s.remoteTargets,
              [player.id]: {
                position: player.position,
                rotationY: player.rotationY,
                headYaw: player.headYaw,
                headPitch: player.headPitch,
                velocity: player.velocity,
                animState: player.animState,
                serverTs: Date.now(),
              },
            }
          : s.remoteTargets,
    })),

  removePlayer: (playerId) =>
    set((s) => {
      const nextPlayers = { ...s.players };
      delete nextPlayers[playerId];
      const nextTargets = { ...s.remoteTargets };
      delete nextTargets[playerId];
      return { players: nextPlayers, remoteTargets: nextTargets };
    }),

  applyRemoteMove: (payload) =>
    set((s) => {
      const existing = s.players[payload.playerId];
      if (!existing) return s;
      return {
        remoteTargets: {
          ...s.remoteTargets,
          [payload.playerId]: {
            position: payload.position,
            rotationY: payload.rotationY,
            headYaw: payload.headYaw,
            headPitch: payload.headPitch,
            velocity: payload.velocity,
            animState: payload.animState,
            serverTs: payload.serverTs,
          },
        },
        players: {
          ...s.players,
          [payload.playerId]: {
            ...existing,
            position: payload.position,
            rotationY: payload.rotationY,
            headYaw: payload.headYaw,
            headPitch: payload.headPitch,
            velocity: payload.velocity,
            animState: payload.animState,
          },
        },
      };
    }),

  updatePeerVoiceState: ({ playerId, micEnabled, isSpeaking, audioLevel }) =>
    set((s) => {
      const p = s.players[playerId];
      if (!p) return s;
      return {
        players: {
          ...s.players,
          [playerId]: { ...p, micEnabled, isSpeaking, audioLevel },
        },
      };
    }),

  setSeats: (seats) => set({ seats }),
  setVideo: (video) => set({ video }),
  setScreenShare: (screenShare) => set({ screenShare }),
  setScreenShareStream: (screenShareStream) => set({ screenShareStream }),
  setQueue: (queue) => set({ queue }),
  setCustomization: (customization, seats) =>
    set((s) => ({
      customization,
      seats,
      room: s.room ? { ...s.room, theme: customization.theme } : null,
    })),

  addChatMessage: (msg) =>
    set((s) => ({
      chatHistory: [...s.chatHistory.slice(-119), msg],
    })),

  updateChatMessage: (msg) =>
    set((s) => ({
      chatHistory: s.chatHistory.map((m) => (m.id === msg.id ? msg : m)),
    })),

  deleteChatMessage: (messageId) =>
    set((s) => ({
      chatHistory: s.chatHistory.filter((m) => m.id !== messageId),
    })),

  clearChat: () => set({ chatHistory: [] }),
  setGames: (games) => set({ games }),
  setUnoHand: (unoHand) => set({ unoHand }),

  setLocalVoice: (micEnabled, localSpeaking, localAudioLevel) =>
    set((s) => ({
      micEnabled,
      localSpeaking,
      localAudioLevel,
      players:
        s.localPlayerId && s.players[s.localPlayerId]
          ? {
              ...s.players,
              [s.localPlayerId]: {
                ...s.players[s.localPlayerId],
                micEnabled,
                isSpeaking: localSpeaking,
                audioLevel: localAudioLevel,
              },
            }
          : s.players,
    })),

  setPeerVolume: (userId, volume) =>
    set((s) => ({
      peerVolumes: { ...s.peerVolumes, [userId]: volume },
    })),

  togglePeerLocalMute: (userId) =>
    set((s) => ({
      peerLocalMutes: {
        ...s.peerLocalMutes,
        [userId]: !s.peerLocalMutes[userId],
      },
    })),

  toggleBlockUser: (userId) =>
    set((s) => ({
      blockedUserIds: s.blockedUserIds.includes(userId)
        ? s.blockedUserIds.filter((id) => id !== userId)
        : [...s.blockedUserIds, userId],
    })),

  setPeerDistances: (peerDistances) => set({ peerDistances }),
}));

export function getEffectiveAvatar(user: AuthUser | null): AvatarConfig {
  if (user?.avatar) return user.avatar;
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem('luma_guest_avatar');
      if (saved) return { ...DEFAULT_AVATAR_CONFIG, ...JSON.parse(saved) };
    } catch {
      // ignore
    }
  }
  return DEFAULT_AVATAR_CONFIG;
}
