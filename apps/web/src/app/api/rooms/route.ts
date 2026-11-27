import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import {
  createRoomSchema,
  DEFAULT_ROOM_CUSTOMIZATION,
  ROOM_THEMES,
  RoomSummary,
  sanitizeText,
  validateExternalHttpUrl,
} from '@luma/shared';
import {
  checkApiRateLimit,
  getCurrentUser,
  hashPasswordScrypt,
} from '@/lib/server/auth';
import { dbExecute, dbQueryAll } from '@/lib/server/db';

const REALTIME_INTERNAL_URL =
  process.env.REALTIME_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_REALTIME_URL ||
  'http://localhost:4001';

async function fetchLiveRoomsMap(): Promise<
  Map<string, { onlineCount: number; currentlyPlaying: string | null }>
> {
  const map = new Map<string, { onlineCount: number; currentlyPlaying: string | null }>();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${REALTIME_INTERNAL_URL}/api/live-rooms`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return map;
    const data = (await res.json()) as {
      rooms?: Array<{ id: string; onlineCount: number; currentlyPlaying: string | null }>;
    };
    for (const r of data.rooms ?? []) {
      map.set(r.id, {
        onlineCount: r.onlineCount,
        currentlyPlaying: r.currentlyPlaying,
      });
    }
  } catch {
    // Realtime server may not be started yet
  }
  return map;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const q = req.nextUrl.searchParams.get('q')?.trim().toLowerCase() || '';
  const category = req.nextUrl.searchParams.get('category')?.trim() || '';

  const liveMap = await fetchLiveRoomsMap();

  const rows = await dbQueryAll<Record<string, unknown>>(
    `SELECT * FROM rooms
     WHERE privacy = 'public' OR owner_id = ?
     ORDER BY is_featured DESC, created_at DESC
     LIMIT 80`,
    [user?.id ?? ''],
  );

  let rooms: RoomSummary[] = rows.map((row) => {
    const id = String(row.id);
    const live = liveMap.get(id);
    return {
      id,
      code: String(row.code),
      name: String(row.name),
      description: String(row.description || ''),
      ownerId: String(row.owner_id),
      ownerName: String(row.owner_name),
      theme: String(row.theme) as RoomSummary['theme'],
      category: String(row.category) as RoomSummary['category'],
      privacy: String(row.privacy) as RoomSummary['privacy'],
      hasPassword: Boolean(row.password_hash),
      maxUsers: Number(row.max_users || 24),
      onlineCount: live?.onlineCount ?? 0,
      currentlyPlaying: live?.currentlyPlaying ?? null,
      thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : null,
      createdAt: Number(row.created_at),
      isFeatured: Boolean(row.is_featured),
    };
  });

  if (q) {
    rooms = rooms.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
    );
  }

  if (category && category !== 'all') {
    rooms = rooms.filter((r) => r.category === category);
  }

  let recentRooms: RoomSummary[] = [];
  if (user) {
    const visitRows = await dbQueryAll<Record<string, unknown>>(
      `SELECT r.* FROM room_visits v
       JOIN rooms r ON r.id = v.room_id
       WHERE v.user_id = ?
       ORDER BY v.visited_at DESC
       LIMIT 6`,
      [user.id],
    );

    recentRooms = visitRows.map((row) => {
      const id = String(row.id);
      const live = liveMap.get(id);
      return {
        id,
        code: String(row.code),
        name: String(row.name),
        description: String(row.description || ''),
        ownerId: String(row.owner_id),
        ownerName: String(row.owner_name),
        theme: String(row.theme) as RoomSummary['theme'],
        category: String(row.category) as RoomSummary['category'],
        privacy: String(row.privacy) as RoomSummary['privacy'],
        hasPassword: Boolean(row.password_hash),
        maxUsers: Number(row.max_users || 24),
        onlineCount: live?.onlineCount ?? 0,
        currentlyPlaying: live?.currentlyPlaying ?? null,
        thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : null,
        createdAt: Number(row.created_at),
        isFeatured: Boolean(row.is_featured),
      };
    });
  }

  const popularRooms = [...rooms]
    .sort((a, b) => b.onlineCount - a.onlineCount || Number(b.isFeatured) - Number(a.isFeatured))
    .slice(0, 8);

  return NextResponse.json({ rooms, popularRooms, recentRooms });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Oda oluşturmak için lütfen giriş yapın veya hesap oluşturun.' },
      { status: 401 },
    );
  }

  if (!checkApiRateLimit(`create-room:${user.id}`, 8, 60_000)) {
    return NextResponse.json({ error: 'Çok sık oda oluşturma isteği.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createRoomSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Oda bilgileri geçersiz.' }, { status: 400 });
  }

  const data = parsed.data;
  if (data.privacy === 'password' && (!data.password || data.password.length < 3)) {
    return NextResponse.json(
      { error: 'Şifreli oda için en az 3 karakterli şifre girin.' },
      { status: 400 },
    );
  }

  let safeThumb: string | null = null;
  if (data.thumbnailUrl && data.thumbnailUrl.trim()) {
    const check = validateExternalHttpUrl(data.thumbnailUrl);
    if (!check.ok || !check.url) {
      return NextResponse.json({ error: 'Geçersiz oda görseli URL.' }, { status: 400 });
    }
    safeThumb = check.url;
  }

  const id = `rm-${crypto.randomUUID().slice(0, 10)}`;
  const code = crypto.randomBytes(3).toString('hex').toUpperCase();
  const now = Date.now();
  const meta = ROOM_THEMES[data.theme];

  const customization = {
    ...DEFAULT_ROOM_CUSTOMIZATION,
    theme: data.theme,
    lightColor: meta.defaultLightColor,
    ambientIntensity: meta.defaultAmbient,
    maxUsers: data.maxUsers,
  };

  const passwordHash =
    data.privacy === 'password' && data.password
      ? hashPasswordScrypt(data.password)
      : null;

  await dbExecute(
    `INSERT INTO rooms (id, code, name, description, owner_id, owner_name, theme, category, privacy, password_hash, max_users, thumbnail_url, customization_json, is_featured, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      id,
      code,
      sanitizeText(data.name, 60),
      sanitizeText(data.description, 240),
      user.id,
      user.displayName,
      data.theme,
      data.category,
      data.privacy,
      passwordHash,
      data.maxUsers,
      safeThumb,
      JSON.stringify(customization),
      now,
    ],
  );

  await dbExecute(
    `INSERT INTO room_visits (user_id, room_id, visited_at) VALUES (?, ?, ?)
     ON CONFLICT (user_id, room_id) DO UPDATE SET visited_at = EXCLUDED.visited_at`,
    [user.id, id, now],
  );

  return NextResponse.json({
    room: {
      id,
      code,
      name: sanitizeText(data.name, 60),
      description: sanitizeText(data.description, 240),
      ownerId: user.id,
      ownerName: user.displayName,
      theme: data.theme,
      category: data.category,
      privacy: data.privacy,
      hasPassword: Boolean(passwordHash),
      maxUsers: data.maxUsers,
      onlineCount: 0,
      thumbnailUrl: safeThumb,
      createdAt: now,
    },
  });
}
