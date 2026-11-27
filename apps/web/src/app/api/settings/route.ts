import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/server/auth';
import { dbExecute } from '@/lib/server/db';

const settingsSchema = z.object({
  graphicsQuality: z.enum(['low', 'medium', 'high', '2d-lite']).optional(),
  spatialVoice: z
    .object({
      micDeviceId: z.string().optional(),
      outputDeviceId: z.string().optional(),
      noiseSuppression: z.boolean().optional(),
      echoCancellation: z.boolean().optional(),
      autoGainControl: z.boolean().optional(),
      inputGain: z.number().min(0).max(2).optional(),
      masterVolume: z.number().min(0).max(1.5).optional(),
      maxDistance: z.number().min(8).max(30).optional(),
      refDistance: z.number().min(1).max(6).optional(),
      acoustics: z.enum(['studio', 'cinema-hall', 'intimate']).optional(),
    })
    .optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ settings: { graphicsQuality: 'high' } });
  }
  return NextResponse.json({ settings: user.settings });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Ayarları kaydetmek için giriş yapın.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz ayar verisi.' }, { status: 400 });
  }

  const merged = { ...user.settings, ...parsed.data };
  await dbExecute('UPDATE users SET settings_json = ? WHERE id = ?', [
    JSON.stringify(merged),
    user.id,
  ]);
  return NextResponse.json({ ok: true, settings: merged });
}
