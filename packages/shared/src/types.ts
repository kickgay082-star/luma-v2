export type RoomThemeId =
  | 'premium-cinema'
  | 'modern-lounge'
  | 'luxury-home'
  | 'minimalist'
  | 'gaming-room'
  | 'retro-cinema'
  | 'space-room'
  | 'beach-house'
  | 'dark-cinema'
  | 'neon-city';

export type RoomPrivacy = 'public' | 'private' | 'password';

export type RoomCategory =
  | 'cinema'
  | 'lounge'
  | 'watch-party'
  | 'gaming'
  | 'iptv';

export type SeatLayoutType = 'theater' | 'lounge-u' | 'circle' | 'duo-rows';

export type DecorPreset = 'classic' | 'minimal' | 'lush';

export type AmbientMusicPreset =
  | 'none'
  | 'lofi-cinema'
  | 'deep-ambient'
  | 'synth-soft';

export type VoiceAcousticsPreset = 'studio' | 'cinema-hall' | 'intimate';

export type GraphicsQuality = 'low' | 'medium' | 'high' | '2d-lite';

export type HairStyle =
  | 'short-fade'
  | 'side-part'
  | 'long-wavy'
  | 'bob'
  | 'ponytail'
  | 'buzz'
  | 'curly'
  | 'mohawk';

export type FaceShape = 'oval' | 'angular' | 'soft' | 'square';
export type EyeStyle = 'almond' | 'round' | 'focused' | 'expressive';
export type EyebrowStyle = 'natural' | 'arched' | 'thick' | 'minimal';
export type TopStyle = 'tshirt' | 'hoodie' | 'blazer' | 'jacket' | 'sweater';
export type BottomStyle = 'jeans' | 'chinos' | 'joggers' | 'shorts';
export type ShoeStyle = 'sneakers' | 'boots' | 'loafers';
export type GlassesStyle = 'none' | 'aviator' | 'round' | 'minimal-frame' | 'visor';
export type HatStyle = 'none' | 'beanie' | 'cap' | 'fedora' | 'headphones';
export type BodyPreset = 'slim' | 'standard' | 'athletic' | 'tall';

export interface AvatarConfig {
  presetId: string;
  bodyPreset: BodyPreset;
  heightScale: number; // 0.92 - 1.1
  shoulderScale: number; // 0.9 - 1.15
  skinTone: string;
  hairStyle: HairStyle;
  hairColor: string;
  faceShape: FaceShape;
  eyeStyle: EyeStyle;
  eyeColor: string;
  eyebrowStyle: EyebrowStyle;
  topStyle: TopStyle;
  topColor: string;
  bottomStyle: BottomStyle;
  bottomColor: string;
  shoeStyle: ShoeStyle;
  shoeColor: string;
  glasses: GlassesStyle;
  hat: HatStyle;
  accessoryColor: string;
}

export interface AvatarPreset {
  id: string;
  name: string;
  subtitle: string;
  config: AvatarConfig;
}

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  presetId: 'noir-director',
  bodyPreset: 'standard',
  heightScale: 1,
  shoulderScale: 1,
  skinTone: '#D9A78B',
  hairStyle: 'side-part',
  hairColor: '#1E1D24',
  faceShape: 'oval',
  eyeStyle: 'almond',
  eyeColor: '#3B5998',
  eyebrowStyle: 'natural',
  topStyle: 'jacket',
  topColor: '#232736',
  bottomStyle: 'chinos',
  bottomColor: '#161822',
  shoeStyle: 'sneakers',
  shoeColor: '#E5E7EB',
  glasses: 'minimal-frame',
  hat: 'none',
  accessoryColor: '#7C5CFF',
};

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: 'noir-director',
    name: 'Noir Yönetmen',
    subtitle: 'Minimalist siyah ceket ve modern çerçeve',
    config: DEFAULT_AVATAR_CONFIG,
  },
  {
    id: 'midnight-critic',
    name: 'Gece Eleştirmeni',
    subtitle: 'Kapüşonlu ve stüdyo kulaklık kombini',
    config: {
      ...DEFAULT_AVATAR_CONFIG,
      presetId: 'midnight-critic',
      bodyPreset: 'athletic',
      heightScale: 1.03,
      shoulderScale: 1.06,
      skinTone: '#C6865C',
      hairStyle: 'curly',
      hairColor: '#141318',
      topStyle: 'hoodie',
      topColor: '#312E81',
      bottomStyle: 'joggers',
      bottomColor: '#111827',
      shoeStyle: 'sneakers',
      shoeColor: '#7C5CFF',
      glasses: 'none',
      hat: 'headphones',
      accessoryColor: '#3B82F6',
    },
  },
  {
    id: 'velvet-guest',
    name: 'Galaya Hazır',
    subtitle: 'Şık blazer ve yumuşak dalgalı stil',
    config: {
      ...DEFAULT_AVATAR_CONFIG,
      presetId: 'velvet-guest',
      bodyPreset: 'slim',
      heightScale: 0.97,
      shoulderScale: 0.94,
      skinTone: '#F1C7B0',
      hairStyle: 'long-wavy',
      hairColor: '#4A2C2A',
      eyeStyle: 'expressive',
      eyeColor: '#1F6F78',
      eyebrowStyle: 'arched',
      topStyle: 'blazer',
      topColor: '#4C1D95',
      bottomStyle: 'jeans',
      bottomColor: '#1E293B',
      shoeStyle: 'loafers',
      shoeColor: '#1F1B24',
      glasses: 'round',
      hat: 'none',
      accessoryColor: '#C4B5FD',
    },
  },
  {
    id: 'cyber-lounge',
    name: 'Siber Yolcu',
    subtitle: 'Vizör gözlük ve teknik sokak stili',
    config: {
      ...DEFAULT_AVATAR_CONFIG,
      presetId: 'cyber-lounge',
      bodyPreset: 'tall',
      heightScale: 1.07,
      shoulderScale: 1.02,
      skinTone: '#8D5534',
      hairStyle: 'short-fade',
      hairColor: '#E5E7EB',
      eyeStyle: 'focused',
      eyeColor: '#60A5FA',
      topStyle: 'sweater',
      topColor: '#0F172A',
      bottomStyle: 'joggers',
      bottomColor: '#18181B',
      shoeStyle: 'boots',
      shoeColor: '#27272A',
      glasses: 'visor',
      hat: 'beanie',
      accessoryColor: '#3B82F6',
    },
  },
  {
    id: 'beach-surfer',
    name: 'Sahil Sörfçüsü',
    subtitle: 'Turkuaz tişört, şort ve aviator güneş gözlüğü',
    config: {
      ...DEFAULT_AVATAR_CONFIG,
      presetId: 'beach-surfer',
      bodyPreset: 'athletic',
      heightScale: 1.02,
      shoulderScale: 1.05,
      skinTone: '#C6865C',
      hairStyle: 'long-wavy',
      hairColor: '#D1A054',
      eyeStyle: 'almond',
      eyeColor: '#0F766E',
      topStyle: 'tshirt',
      topColor: '#0E7490',
      bottomStyle: 'shorts',
      bottomColor: '#D97706',
      shoeStyle: 'sneakers',
      shoeColor: '#F8FAFC',
      glasses: 'aviator',
      hat: 'cap',
      accessoryColor: '#F59E0B',
    },
  },
  {
    id: 'mansion-vip',
    name: 'Malikane VIP',
    subtitle: 'Bordo blazer, fedora şapka ve altın detaylar',
    config: {
      ...DEFAULT_AVATAR_CONFIG,
      presetId: 'mansion-vip',
      bodyPreset: 'tall',
      heightScale: 1.06,
      shoulderScale: 1.04,
      skinTone: '#F7D5C4',
      hairStyle: 'side-part',
      hairColor: '#3B2820',
      eyeStyle: 'focused',
      eyeColor: '#4B5563',
      topStyle: 'blazer',
      topColor: '#7F1D1D',
      bottomStyle: 'chinos',
      bottomColor: '#18181B',
      shoeStyle: 'loafers',
      shoeColor: '#111827',
      glasses: 'minimal-frame',
      hat: 'fedora',
      accessoryColor: '#F59E0B',
    },
  },
  {
    id: 'street-rebel',
    name: 'Sokak Stili',
    subtitle: 'Mohawk kesim, kırmızı kapüşonlu ve botlar',
    config: {
      ...DEFAULT_AVATAR_CONFIG,
      presetId: 'street-rebel',
      bodyPreset: 'athletic',
      heightScale: 1.01,
      shoulderScale: 1.08,
      skinTone: '#5A3622',
      hairStyle: 'mohawk',
      hairColor: '#B91C1C',
      eyeStyle: 'focused',
      eyeColor: '#F59E0B',
      topStyle: 'hoodie',
      topColor: '#991B1B',
      bottomStyle: 'jeans',
      bottomColor: '#1E293B',
      shoeStyle: 'boots',
      shoeColor: '#09090B',
      glasses: 'none',
      hat: 'none',
      accessoryColor: '#EF4444',
    },
  },
  {
    id: 'atelier-artist',
    name: 'Stüdyo Sanatçısı',
    subtitle: 'At kuyruğu, yuvarlak gözlük ve zümrüt kazak',
    config: {
      ...DEFAULT_AVATAR_CONFIG,
      presetId: 'atelier-artist',
      bodyPreset: 'slim',
      heightScale: 0.96,
      shoulderScale: 0.94,
      skinTone: '#F1C7B0',
      hairStyle: 'ponytail',
      hairColor: '#7C4B2A',
      eyeStyle: 'expressive',
      eyeColor: '#15803D',
      topStyle: 'sweater',
      topColor: '#14532D',
      bottomStyle: 'jeans',
      bottomColor: '#1E3A5F',
      shoeStyle: 'loafers',
      shoeColor: '#3B2820',
      glasses: 'round',
      hat: 'none',
      accessoryColor: '#34D399',
    },
  },
];

export function pickDiverseAvatarPreset(seed: string): AvatarConfig {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const preset = AVATAR_PRESETS[hash % AVATAR_PRESETS.length] ?? AVATAR_PRESETS[0];
  return { ...preset.config };
}

export type Vec3 = [number, number, number];

export interface ColliderBox {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY?: number;
  maxY?: number;
  kind: 'wall' | 'screen' | 'seat' | 'decor';
}

export type SeatVisualType = 'cinema' | 'sofa' | 'lounge' | 'gaming';

export interface SeatState {
  id: string;
  label: string;
  row: number;
  position: Vec3;
  rotationY: number;
  seatType: SeatVisualType;
  occupiedBy: string | null; // userId or playerId
  occupiedByName: string | null;
}

export interface RoomCustomization {
  theme: RoomThemeId;
  lightColor: string;
  ambientIntensity: number; // 0.15 - 1.2
  screenScale: number; // 0.75 - 1.3
  seatLayout: SeatLayoutType;
  decorPreset: DecorPreset;
  ambientMusic: AmbientMusicPreset;
  locked: boolean;
  chatLocked?: boolean;
  maxUsers: number;
  spatialVoiceMaxDistance: number; // 8 - 30m, default 15
  voiceAcoustics: VoiceAcousticsPreset;
}

export const DEFAULT_ROOM_CUSTOMIZATION: RoomCustomization = {
  theme: 'premium-cinema',
  lightColor: '#7C5CFF',
  ambientIntensity: 0.45,
  screenScale: 1,
  seatLayout: 'theater',
  decorPreset: 'classic',
  ambientMusic: 'none',
  locked: false,
  maxUsers: 24,
  spatialVoiceMaxDistance: 15,
  voiceAcoustics: 'cinema-hall',
};

export type PlayerRole = 'owner' | 'moderator' | 'member';
export type PlayerAnimState = 'idle' | 'walk' | 'run' | 'sit' | 'wave' | 'enter';

export interface PlayerState {
  id: string; // socket/player session id
  userId: string;
  username: string;
  displayName: string;
  role: PlayerRole;
  position: Vec3;
  rotationY: number;
  headYaw: number;
  headPitch: number;
  velocity: Vec3;
  animState: PlayerAnimState;
  seatedSeatId: string | null;
  micEnabled: boolean;
  isSpeaking: boolean;
  audioLevel: number; // 0 - 1
  mutedByMod: boolean;
  canControlVideo?: boolean;
  avatar: AvatarConfig;
  connectedAt: number;
  latencyMs: number;
  status: 'active' | 'away';
}

export interface PlayerTransformUpdate {
  position: Vec3;
  rotationY: number;
  headYaw: number;
  headPitch: number;
  velocity: Vec3;
  animState: PlayerAnimState;
  seq: number;
}

export type VideoSourceType = 'youtube' | 'mp4' | 'hls' | 'iptv' | 'embed';

export interface QueueItem {
  id: string;
  sourceType: VideoSourceType;
  url: string;
  youtubeId?: string;
  title: string;
  thumbnail?: string;
  channelLogo?: string;
  isLive?: boolean;
  addedBy: string;
  addedByName: string;
  addedAt: number;
}

export interface VideoState {
  sourceType: VideoSourceType | null;
  url: string | null;
  youtubeId: string | null;
  title: string;
  channelLogo?: string | null;
  isLive: boolean;
  isPlaying: boolean;
  currentTime: number;
  playbackRate: number;
  updatedAt: number;
  updatedBy: string | null;
  hostOnlyControl: boolean;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  displayName: string;
  content: string;
  createdAt: number;
  pinned: boolean;
  reactions: Record<string, string[]>; // emoji -> userIds
  type: 'chat' | 'system';
}

export interface RoomSummary {
  id: string;
  code: string;
  name: string;
  description: string;
  ownerId: string;
  ownerName: string;
  theme: RoomThemeId;
  category: RoomCategory;
  privacy: RoomPrivacy;
  hasPassword: boolean;
  maxUsers: number;
  onlineCount: number;
  thumbnailUrl?: string | null;
  currentlyPlaying?: string | null;
  createdAt: number;
  isFeatured?: boolean;
}

export interface ScreenShareState {
  active: boolean;
  sharerId: string | null;
  sharerName: string | null;
}

export interface RoomStateSnapshot {
  room: RoomSummary;
  customization: RoomCustomization;
  players: PlayerState[];
  seats: SeatState[];
  video: VideoState;
  screenShare: ScreenShareState;
  queue: QueueItem[];
  chatHistory: ChatMessage[];
  mutedChatUserIds: string[];
  serverTime: number;
}

export interface SpatialVoiceSettings {
  micDeviceId: string;
  outputDeviceId: string;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  inputGain: number;
  masterVolume: number;
  maxDistance: number;
  refDistance: number;
  acoustics: VoiceAcousticsPreset;
}

export interface IptvChannel {
  id: string;
  name: string;
  url: string;
  logo?: string;
  group: string;
  tvgId?: string;
  isLive: boolean;
}

export interface IptvPlaylist {
  id: string;
  name: string;
  sourceUrl?: string | null;
  channels: IptvChannel[];
  createdAt: number;
}

export interface FriendSummary {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  status: 'accepted' | 'pending_incoming' | 'pending_outgoing';
  online: boolean;
  currentRoomId?: string | null;
  currentRoomName?: string | null;
  avatar: AvatarConfig;
}
