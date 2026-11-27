import {
  AvatarConfig,
  ChatMessage,
  PlayerState,
  PlayerTransformUpdate,
  QueueItem,
  RoomCustomization,
  RoomStateSnapshot,
  SeatState,
  VideoSourceType,
  VideoState,
} from '../types.js';

export interface JoinRoomPayload {
  roomId: string;
  password?: string;
  token?: string;
  guestName?: string;
  avatar?: AvatarConfig;
}

export interface JoinRoomAck {
  ok: boolean;
  error?: string;
  playerId?: string;
  snapshot?: RoomStateSnapshot;
}

export interface SeatActionAck {
  ok: boolean;
  error?: string;
  seatId?: string | null;
}

export interface VideoControlPayload {
  action: 'load' | 'play' | 'pause' | 'seek' | 'rate' | 'host_lock';
  sourceType?: VideoSourceType;
  url?: string;
  title?: string;
  channelLogo?: string;
  isLive?: boolean;
  currentTime?: number;
  playbackRate?: number;
  hostOnlyControl?: boolean;
}

export interface WebRTCSignalPayload {
  targetPlayerId: string;
  fromPlayerId?: string;
  sdp?: { type: 'offer' | 'answer'; sdp?: string };
  candidate?: {
    candidate?: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    usernameFragment?: string | null;
  };
}

export interface ClientToServerEvents {
  'room:join': (payload: JoinRoomPayload, ack: (res: JoinRoomAck) => void) => void;
  'room:leave': () => void;
  'room:heartbeat': (clientTs: number, ack: (serverTs: number) => void) => void;
  'player:move': (payload: PlayerTransformUpdate) => void;
  'player:avatar': (avatar: AvatarConfig) => void;
  'player:status': (status: 'active' | 'away') => void;
  'seat:claim': (seatId: string, ack: (res: SeatActionAck) => void) => void;
  'seat:leave': (ack?: (res: SeatActionAck) => void) => void;
  'voice:state': (payload: { micEnabled: boolean; isSpeaking: boolean; audioLevel: number }) => void;
  'webrtc:offer': (payload: WebRTCSignalPayload) => void;
  'webrtc:answer': (payload: WebRTCSignalPayload) => void;
  'webrtc:ice': (payload: WebRTCSignalPayload) => void;
  'video:control': (payload: VideoControlPayload, ack?: (res: { ok: boolean; error?: string }) => void) => void;
  'queue:add': (
    payload: Omit<QueueItem, 'id' | 'addedBy' | 'addedByName' | 'addedAt'>,
    ack?: (res: { ok: boolean; error?: string }) => void,
  ) => void;
  'queue:remove': (itemId: string) => void;
  'queue:next': () => void;
  'room:customize': (
    patch: Partial<RoomCustomization>,
    ack?: (res: { ok: boolean; error?: string }) => void,
  ) => void;
  'chat:send': (content: string, ack?: (res: { ok: boolean; error?: string }) => void) => void;
  'chat:react': (payload: { messageId: string; emoji: string }) => void;
  'chat:pin': (messageId: string) => void;
  'chat:delete': (messageId: string) => void;
  'mod:action': (payload: {
    targetPlayerId: string;
    action: 'kick' | 'mute_voice' | 'unmute_voice' | 'mute_chat' | 'unmute_chat' | 'promote_mod' | 'demote_mod' | 'transfer_owner';
  }) => void;
}

export interface ServerToClientEvents {
  'player:joined': (player: PlayerState) => void;
  'player:left': (payload: { playerId: string; userId: string; reason?: string }) => void;
  'player:moved': (payload: {
    playerId: string;
    position: [number, number, number];
    rotationY: number;
    headYaw: number;
    headPitch: number;
    velocity: [number, number, number];
    animState: PlayerState['animState'];
    serverTs: number;
  }) => void;
  'player:updated': (player: PlayerState) => void;
  'seats:synced': (seats: SeatState[]) => void;
  'voice:peer_state': (payload: {
    playerId: string;
    micEnabled: boolean;
    isSpeaking: boolean;
    audioLevel: number;
  }) => void;
  'webrtc:offer': (payload: WebRTCSignalPayload) => void;
  'webrtc:answer': (payload: WebRTCSignalPayload) => void;
  'webrtc:ice': (payload: WebRTCSignalPayload) => void;
  'video:synced': (video: VideoState) => void;
  'queue:synced': (queue: QueueItem[]) => void;
  'room:customized': (payload: { customization: RoomCustomization; seats: SeatState[] }) => void;
  'chat:message': (msg: ChatMessage) => void;
  'chat:updated': (msg: ChatMessage) => void;
  'chat:deleted': (messageId: string) => void;
  'mod:kicked': (reason: string) => void;
  'room:notice': (payload: { level: 'info' | 'warning' | 'error'; message: string }) => void;
}
