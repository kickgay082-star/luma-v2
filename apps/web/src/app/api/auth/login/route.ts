import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DEFAULT_AVATAR_CONFIG } from '@luma/shared';
import { dbQueryOne } from '@/lib/server/db';
import {
  checkApiRateLimit,
  SESSION_COOKIE_NAME,
  signSessionToken,
  verifyPasswordScrypt,
} from '@/lib/server/auth';

const loginSchema = z.object({
  identifier: z.string().min(2).max(100),
  password: z.string().min(1).max(100),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'local';
  if (!checkApiRateLimit(`login:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Çok fazla giriş denemesi.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz giriş bilgileri.' }, { status: 400 });
  }

  const idf = parsed.data.identifier.trim().toLowerCase();
  const row = await dbQueryOne<Record<string, unknown>>(
    `SELECT id, username, display_name, email, password_hash, avatar_json FROM users WHERE username = ? OR email = ? LIMIT 1`,
    [idf, idf],
  );

  if (!row || !verifyPasswordScrypt(parsed.data.password, String(row.password_hash))) {
    return NextResponse.json({ error: 'Kullanıcı adı veya şifre hatalı.' }, { status: 401 });
  }

  const user = {
    id: String(row.id),
    username: String(row.username),
    displayName: String(row.display_name),
    email: row.email ? String(row.email) : null,
  };

  let avatar = DEFAULT_AVATAR_CONFIG;
  try {
    avatar = { ...DEFAULT_AVATAR_CONFIG, ...JSON.parse(String(row.avatar_json || '{}')) };
  } catch {
    // default
  }

  const token = signSessionToken({
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
  });

  const res = NextResponse.json({
    user: { ...user, avatar, token },
  });

  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  });

  return res;
}
