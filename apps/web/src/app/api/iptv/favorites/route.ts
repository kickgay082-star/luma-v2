import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { dbExecute, dbQueryAll, dbQueryOne } from '@/lib/server/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ favorites: [], recents: [] });
  }
  const favRows = await dbQueryAll<{ channel_json: string }>(
    'SELECT channel_json FROM iptv_favorites WHERE user_id = ? ORDER BY created_at DESC',
    [user.id],
  );
  const recRows = await dbQueryAll<{ channel_json: string }>(
    'SELECT channel_json FROM iptv_recents WHERE user_id = ? ORDER BY watched_at DESC LIMIT 20',
    [user.id],
  );

  return NextResponse.json({
    favorites: favRows.map((r) => JSON.parse(r.channel_json)),
    recents: recRows.map((r) => JSON.parse(r.channel_json)),
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    kind?: 'favorite' | 'recent';
    channel?: { id: string; name: string; url: string; group: string; logo?: string; isLive?: boolean };
  } | null;

  if (!body?.channel?.id || !body?.channel?.url) {
    return NextResponse.json({ error: 'Kanal verisi eksik.' }, { status: 400 });
  }

  const now = Date.now();
  if (body.kind === 'recent') {
    await dbExecute(
      `INSERT INTO iptv_recents (user_id, channel_id, channel_json, watched_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, channel_id) DO UPDATE SET channel_json = EXCLUDED.channel_json, watched_at = EXCLUDED.watched_at`,
      [user.id, body.channel.id, JSON.stringify(body.channel), now],
    );
  } else {
    const existing = await dbQueryOne(
      'SELECT 1 as ok FROM iptv_favorites WHERE user_id = ? AND channel_id = ?',
      [user.id, body.channel.id],
    );
    if (existing) {
      await dbExecute('DELETE FROM iptv_favorites WHERE user_id = ? AND channel_id = ?', [
        user.id,
        body.channel.id,
      ]);
      return NextResponse.json({ favorited: false });
    }
    await dbExecute(
      `INSERT INTO iptv_favorites (user_id, channel_id, channel_json, created_at) VALUES (?, ?, ?, ?)`,
      [user.id, body.channel.id, JSON.stringify(body.channel), now],
    );
    return NextResponse.json({ favorited: true });
  }

  return NextResponse.json({ ok: true });
}
