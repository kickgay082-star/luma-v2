import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import {
  parseM3uPlaylist,
  sanitizeText,
  validateExternalHttpUrl,
} from '@luma/shared';
import { checkApiRateLimit, getCurrentUser } from '@/lib/server/auth';
import { dbExecute, dbQueryAll } from '@/lib/server/db';

const MAX_PLAYLIST_BYTES = 4 * 1024 * 1024; // 4 MB limit

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ playlists: [], authenticated: false });
  }

  const rows = await dbQueryAll<Record<string, unknown>>(
    `SELECT id, name, source_url, channels_json, created_at FROM iptv_playlists WHERE user_id = ? ORDER BY created_at DESC`,
    [user.id],
  );

  const playlists = rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    sourceUrl: r.source_url ? String(r.source_url) : null,
    channels: JSON.parse(String(r.channels_json || '[]')),
    createdAt: Number(r.created_at),
  }));

  return NextResponse.json({ playlists, authenticated: true });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Playlist kaydetmek için giriş yapın.' }, { status: 401 });
  }

  if (!checkApiRateLimit(`iptv:${user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Çok sık playlist isteği.' }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    sourceUrl?: string;
    m3uText?: string;
  } | null;

  if (!body) {
    return NextResponse.json({ error: 'Geçersiz veri.' }, { status: 400 });
  }

  let rawM3u = body.m3uText || '';
  let safeSourceUrl: string | null = null;

  if (body.sourceUrl && body.sourceUrl.trim()) {
    const check = validateExternalHttpUrl(body.sourceUrl);
    if (!check.ok || !check.url) {
      return NextResponse.json({ error: check.error || 'Geçersiz URL.' }, { status: 400 });
    }
    safeSourceUrl = check.url;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(safeSourceUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': 'Luma-IPTV-Parser/2.0',
        },
      });
      clearTimeout(timer);

      if (res.status >= 300 && res.status < 400) {
        return NextResponse.json(
          { error: 'Güvenlik nedeniyle doğrudan olmayan yönlendirmeler engellendi.' },
          { status: 400 },
        );
      }
      if (!res.ok) {
        return NextResponse.json(
          { error: `Playlist sunucusu yanıt vermedi (HTTP ${res.status}).` },
          { status: 400 },
        );
      }

      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_PLAYLIST_BYTES) {
        return NextResponse.json(
          { error: 'Playlist dosyası 4 MB sınırını aşıyor.' },
          { status: 400 },
        );
      }
      rawM3u = new TextDecoder('utf-8').decode(buf);
    } catch {
      return NextResponse.json(
        { error: 'Playlist URL adresinden indirilemedi.' },
        { status: 400 },
      );
    }
  }

  if (!rawM3u.trim()) {
    return NextResponse.json(
      { error: 'Lütfen geçerli bir M3U/M3U8 içeriği veya URL sağlayın.' },
      { status: 400 },
    );
  }

  const parsed = parseM3uPlaylist(rawM3u);
  if (parsed.channels.length === 0) {
    return NextResponse.json(
      { error: 'Playlist içinde geçerli yayın kanalı bulunamadı.' },
      { status: 400 },
    );
  }

  const id = `pl-${crypto.randomUUID().slice(0, 10)}`;
  const name = sanitizeText(body.name || 'Benim IPTV Listem', 60) || 'Benim IPTV Listem';
  const now = Date.now();

  await dbExecute(
    `INSERT INTO iptv_playlists (id, user_id, name, source_url, channels_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, user.id, name, safeSourceUrl, JSON.stringify(parsed.channels), now],
  );

  return NextResponse.json({
    playlist: {
      id,
      name,
      sourceUrl: safeSourceUrl,
      channels: parsed.channels,
      groups: parsed.groups,
      skippedCount: parsed.skippedCount,
      createdAt: now,
    },
  });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID eksik.' }, { status: 400 });
  await dbExecute('DELETE FROM iptv_playlists WHERE id = ? AND user_id = ?', [id, user.id]);
  return NextResponse.json({ ok: true });
}
