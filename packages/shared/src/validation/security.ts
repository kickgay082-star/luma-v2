import { z } from 'zod';
import { AvatarConfig, RoomThemeId } from '../types.js';

const PRIVATE_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^0\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^\[?::1\]?$/,
  /^\[?fe80:/i,
  /^\[?fc/i,
  /^\[?fd/i,
  /\.local$/i,
  /\.internal$/i,
  /\.localhost$/i,
];

/**
 * Validates user-supplied external media / playlist URLs and blocks SSRF targets
 * (loopback, link-local metadata endpoints, private LAN CIDRs, non-HTTP schemes).
 */
export function validateExternalHttpUrl(rawUrl: string): {
  ok: boolean;
  url?: string;
  error?: string;
} {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 2048) {
    return { ok: false, error: 'Geçersiz veya çok uzun URL.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: 'URL biçimi geçersiz.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Yalnızca HTTP ve HTTPS bağlantıları desteklenir.' };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, error: 'URL içinde kimlik bilgisi kullanılamaz.' };
  }

  const host = parsed.hostname.toLowerCase();
  if (!host) {
    return { ok: false, error: 'Alan adı bulunamadı.' };
  }

  for (const pattern of PRIVATE_HOSTNAME_PATTERNS) {
    if (pattern.test(host)) {
      return { ok: false, error: 'Özel ağ veya yerel sunucu adreslerine izin verilmez.' };
    }
  }

  // Reject integer/hex IP bypasses like http://2130706433 or http://0x7f000001
  if (/^(0x[\da-f]+|\d+)$/i.test(host)) {
    return { ok: false, error: 'Sayısal IP adreslerine izin verilmez.' };
  }

  return { ok: true, url: parsed.toString() };
}

export function extractYouTubeId(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be') {
      const seg = url.pathname.split('/').filter(Boolean)[0];
      return seg && /^[a-zA-Z0-9_-]{11}$/.test(seg) ? seg : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const v = url.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && ['embed', 'shorts', 'live', 'v'].includes(parts[0])) {
        return /^[a-zA-Z0-9_-]{11}$/.test(parts[1]) ? parts[1] : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function sanitizeText(input: string, maxLength: number = 400): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[<>]/g, (c) => (c === '<' ? '‹' : '›'))
    .trim()
    .slice(0, maxLength);
}

export const ROOM_THEME_IDS: [RoomThemeId, ...RoomThemeId[]] = [
  'premium-cinema',
  'modern-lounge',
  'luxury-home',
  'minimalist',
  'gaming-room',
  'retro-cinema',
  'space-room',
  'beach-house',
  'dark-cinema',
  'neon-city',
];

export const createRoomSchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(240).default(''),
  theme: z.enum(ROOM_THEME_IDS).default('premium-cinema'),
  category: z.enum(['cinema', 'lounge', 'watch-party', 'gaming', 'iptv']).default('cinema'),
  privacy: z.enum(['public', 'private', 'password']).default('public'),
  password: z.string().max(64).optional(),
  maxUsers: z.number().int().min(2).max(48).default(24),
  thumbnailUrl: z.string().max(500).optional(),
});

export const roomCustomizationSchema = z.object({
  theme: z.enum(ROOM_THEME_IDS).optional(),
  lightColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  ambientIntensity: z.number().min(0.15).max(1.2).optional(),
  screenScale: z.number().min(0.75).max(1.3).optional(),
  seatLayout: z.enum(['theater', 'lounge-u', 'circle', 'duo-rows']).optional(),
  decorPreset: z.enum(['classic', 'minimal', 'lush']).optional(),
  ambientMusic: z.enum(['none', 'lofi-cinema', 'deep-ambient', 'synth-soft']).optional(),
  locked: z.boolean().optional(),
  maxUsers: z.number().int().min(2).max(48).optional(),
  spatialVoiceMaxDistance: z.number().min(8).max(30).optional(),
  voiceAcoustics: z.enum(['studio', 'cinema-hall', 'intimate']).optional(),
});

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const avatarConfigSchema: z.ZodType<AvatarConfig> = z.object({
  presetId: z.string().min(1).max(40),
  bodyPreset: z.enum(['slim', 'standard', 'athletic', 'tall']),
  heightScale: z.number().min(0.9).max(1.12),
  shoulderScale: z.number().min(0.88).max(1.16),
  skinTone: hexColor,
  hairStyle: z.enum([
    'short-fade',
    'side-part',
    'long-wavy',
    'bob',
    'ponytail',
    'buzz',
    'curly',
    'mohawk',
  ]),
  hairColor: hexColor,
  faceShape: z.enum(['oval', 'angular', 'soft', 'square']),
  eyeStyle: z.enum(['almond', 'round', 'focused', 'expressive']),
  eyeColor: hexColor,
  eyebrowStyle: z.enum(['natural', 'arched', 'thick', 'minimal']),
  topStyle: z.enum(['tshirt', 'hoodie', 'blazer', 'jacket', 'sweater']),
  topColor: hexColor,
  bottomStyle: z.enum(['jeans', 'chinos', 'joggers', 'shorts']),
  bottomColor: hexColor,
  shoeStyle: z.enum(['sneakers', 'boots', 'loafers']),
  shoeColor: hexColor,
  glasses: z.enum(['none', 'aviator', 'round', 'minimal-frame', 'visor']),
  hat: z.enum(['none', 'beanie', 'cap', 'fedora', 'headphones']),
  accessoryColor: hexColor,
});
