import { NextRequest, NextResponse } from 'next/server';
import { avatarConfigSchema, DEFAULT_AVATAR_CONFIG } from '@luma/shared';
import { getCurrentUser } from '@/lib/server/auth';
import { dbExecute } from '@/lib/server/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ avatar: DEFAULT_AVATAR_CONFIG, authenticated: false });
  }
  return NextResponse.json({ avatar: user.avatar, authenticated: true });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Avatar kaydetmek için giriş yapın.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = avatarConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz avatar yapılandırması.' }, { status: 400 });
  }

  await dbExecute('UPDATE users SET avatar_json = ? WHERE id = ?', [
    JSON.stringify(parsed.data),
    user.id,
  ]);

  return NextResponse.json({ ok: true, avatar: parsed.data });
}
