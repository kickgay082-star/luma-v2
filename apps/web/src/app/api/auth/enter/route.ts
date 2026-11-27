import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';
import { DEFAULT_AVATAR_CONFIG, sanitizeText } from '@luma/shared';
import { dbExecute } from '@/lib/server/db';
import {
  checkApiRateLimit,
  getCurrentUser,
  SESSION_COOKIE_NAME,
  signSessionToken,
} from '@/lib/server/auth';

const enterSchema = z.object({
  displayName: z.string().trim().min(2, 'İsim en az 2 karakter olmalıdır.').max(24, 'İsim en fazla 24 karakter olabilir.'),
});

function slugifyUsername(name: string): string {
  const ascii = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 16);
  const suffix = crypto.randomBytes(2).toString('hex');
  return `${ascii || 'luma'}_${suffix}`;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'local';
  if (!checkApiRateLimit(`enter:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Çok fazla deneme, biraz bekleyin.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = enterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Geçerli bir isim girin (en az 2 karakter).' },
      { status: 400 },
    );
  }

  const displayName = sanitizeText(parsed.data.displayName, 24);
  if (displayName.length < 2) {
    return NextResponse.json({ error: 'İsim en az 2 karakter olmalıdır.' }, { status: 400 });
  }

  const existing = await getCurrentUser();
  if (existing) {
    await dbExecute(`UPDATE users SET display_name = ?, last_seen_at = ? WHERE id = ?`, [
      displayName,
      Date.now(),
      existing.id,
    ]);
    const token = signSessionToken({
      userId: existing.id,
      username: existing.username,
      displayName,
    });
    const res = NextResponse.json({
      user: {
        id: existing.id,
        username: existing.username,
        displayName,
        email: null,
        avatar: existing.avatar,
        token,
      },
    });
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 14,
    });
    return res;
  }

  const id = `usr-${crypto.randomUUID().slice(0, 12)}`;
  const username = slugifyUsername(displayName);
  const now = Date.now();
  const dummyHash = `nameonly:${crypto.randomBytes(16).toString('hex')}`;

  await dbExecute(
    `INSERT INTO users (id, username, display_name, email, password_hash, avatar_json, settings_json, last_seen_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      username,
      displayName,
      null,
      dummyHash,
      JSON.stringify(DEFAULT_AVATAR_CONFIG),
      JSON.stringify({ graphicsQuality: 'high' }),
      now,
      now,
    ],
  );

  const token = signSessionToken({ userId: id, username, displayName });
  const res = NextResponse.json({
    user: {
      id,
      username,
      displayName,
      email: null,
      avatar: DEFAULT_AVATAR_CONFIG,
      token,
    },
  });

  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  });

  return res;
}
