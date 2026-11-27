import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { dbExecute, dbQueryOne } from '@/lib/server/db';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const row = await dbQueryOne<Record<string, unknown>>(
    `SELECT * FROM rooms WHERE id = ? OR UPPER(code) = UPPER(?) LIMIT 1`,
    [id, id],
  );

  if (!row) {
    return NextResponse.json({ error: 'Oda bulunamadı.' }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (user) {
    await dbExecute(
      `INSERT INTO room_visits (user_id, room_id, visited_at) VALUES (?, ?, ?)
       ON CONFLICT (user_id, room_id) DO UPDATE SET visited_at = EXCLUDED.visited_at`,
      [user.id, String(row.id), Date.now()],
    );
  }

  return NextResponse.json({
    room: {
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      description: String(row.description || ''),
      ownerId: String(row.owner_id),
      ownerName: String(row.owner_name),
      theme: String(row.theme),
      category: String(row.category),
      privacy: String(row.privacy),
      hasPassword: Boolean(row.password_hash),
      maxUsers: Number(row.max_users || 24),
      thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : null,
      createdAt: Number(row.created_at),
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });
  }

  const { id } = await context.params;
  const row = await dbQueryOne<{ id?: string; owner_id?: string }>(
    'SELECT id, owner_id FROM rooms WHERE id = ? LIMIT 1',
    [id],
  );

  if (!row) {
    return NextResponse.json({ error: 'Oda bulunamadı.' }, { status: 404 });
  }

  if (row.owner_id !== user.id) {
    return NextResponse.json({ error: 'Odayı yalnızca sahibi silebilir.' }, { status: 403 });
  }

  await dbExecute('DELETE FROM rooms WHERE id = ?', [id]);
  return NextResponse.json({ ok: true });
}
