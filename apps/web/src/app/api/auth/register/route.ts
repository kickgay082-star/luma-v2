import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';
import { DEFAULT_AVATAR_CONFIG, sanitizeText } from '@luma/shared';
import { dbExecute, dbQueryOne } from '@/lib/server/db';
import {
  checkApiRateLimit,
  hashPasswordScrypt,
  SESSION_COOKIE_NAME,
  signSessionToken,
} from '@/lib/server/auth';

const registerSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().min(2).max(32),
  email: z.string().email().optional().or(z.literal('')),
  password: z.string().min(6).max(100),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'local';
  if (!checkApiRateLimit(`reg:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Çok fazla kayıt denemesi.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Kullanıcı adı (en az 3 harf/rakam), görünen ad ve en az 6 karakter şifre gereklidir.' },
      { status: 400 },
    );
  }

  const username = parsed.data.username.toLowerCase();
  const displayName = sanitizeText(parsed.data.displayName, 32);
  const email = parsed.data.email ? parsed.data.email.trim().toLowerCase() : null;

  const existing = email
    ? await dbQueryOne<{ id?: string }>(
        'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1',
        [username, email],
      )
    : await dbQueryOne<{ id?: string }>('SELECT id FROM users WHERE username = ? LIMIT 1', [
        username,
      ]);

  if (existing) {
    return NextResponse.json(
      { error: 'Bu kullanıcı adı veya e-posta zaten kayıtlı.' },
      { status: 409 },
    );
  }

  const id = `usr-${crypto.randomUUID().slice(0, 12)}`;
  const now = Date.now();
  const passwordHash = hashPasswordScrypt(parsed.data.password);

  await dbExecute(
    `INSERT INTO users (id, username, display_name, email, password_hash, avatar_json, settings_json, last_seen_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      username,
      displayName,
      email,
      passwordHash,
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
      email,
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
