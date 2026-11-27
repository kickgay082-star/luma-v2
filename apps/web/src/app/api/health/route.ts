import { NextResponse } from 'next/server';
import { dbQueryOne } from '@/lib/server/db';

export async function GET() {
  try {
    const count = await dbQueryOne<{ c: number | string }>('SELECT COUNT(*) as c FROM rooms');
    return NextResponse.json({
      ok: true,
      dbRooms: Number(count?.c ?? 0),
      mode: process.env.DATABASE_URL ? 'postgres' : 'sqlite',
      timestamp: Date.now(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'DB error' },
      { status: 500 },
    );
  }
}
