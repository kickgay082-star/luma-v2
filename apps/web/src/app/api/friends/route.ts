import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { DEFAULT_AVATAR_CONFIG, FriendSummary } from '@luma/shared';
import { getCurrentUser } from '@/lib/server/auth';
import { dbExecute, dbQueryAll, dbQueryOne } from '@/lib/server/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ friends: [], invites: [], authenticated: false });
  }

  const rows = await dbQueryAll<Record<string, unknown>>(
    `SELECT f.id, f.requester_id, f.addressee_id, f.status,
            u.id as friend_uid, u.username, u.display_name, u.avatar_json, u.last_seen_at
     FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
     WHERE (f.requester_id = ? OR f.addressee_id = ?) AND f.status != 'blocked'
     ORDER BY f.created_at DESC`,
    [user.id, user.id, user.id],
  );

  const now = Date.now();
  const friends: FriendSummary[] = await Promise.all(
    rows.map(async (r) => {
      const reqId = String(r.requester_id);
      const rawStatus = String(r.status);
      let status: FriendSummary['status'] = 'accepted';
      if (rawStatus === 'pending') {
        status = reqId === user.id ? 'pending_outgoing' : 'pending_incoming';
      }

      const friendUid = String(r.friend_uid);
      const recentVisit = await dbQueryOne<{ id?: string; name?: string }>(
        `SELECT rm.id, rm.name FROM room_visits v
         JOIN rooms rm ON rm.id = v.room_id
         WHERE v.user_id = ? ORDER BY v.visited_at DESC LIMIT 1`,
        [friendUid],
      );

      let avatar = DEFAULT_AVATAR_CONFIG;
      try {
        avatar = { ...DEFAULT_AVATAR_CONFIG, ...JSON.parse(String(r.avatar_json || '{}')) };
      } catch {
        // default
      }

      const lastSeen = Number(r.last_seen_at || 0);
      const online = now - lastSeen < 5 * 60_000;

      return {
        id: String(r.id),
        userId: friendUid,
        username: String(r.username),
        displayName: String(r.display_name),
        status,
        online,
        currentRoomId: online && recentVisit?.id ? recentVisit.id : null,
        currentRoomName: online && recentVisit?.name ? recentVisit.name : null,
        avatar,
      };
    }),
  );

  const inviteRows = await dbQueryAll<Record<string, unknown>>(
    `SELECT i.id, i.room_id, i.created_at, u.display_name as sender_name, r.name as room_name, r.code as room_code
     FROM room_invites i
     JOIN users u ON u.id = i.sender_id
     JOIN rooms r ON r.id = i.room_id
     WHERE i.recipient_id = ?
     ORDER BY i.created_at DESC LIMIT 15`,
    [user.id],
  );

  return NextResponse.json({
    authenticated: true,
    friends,
    invites: inviteRows.map((i) => ({
      id: String(i.id),
      roomId: String(i.room_id),
      roomCode: String(i.room_code),
      roomName: String(i.room_name),
      senderName: String(i.sender_name),
      createdAt: Number(i.created_at),
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Giriş yapmalısınız.' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    action?: string;
    username?: string;
    friendshipId?: string;
    targetUserId?: string;
    roomId?: string;
  } | null;

  if (!body?.action) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  if (body.action === 'add' && body.username) {
    const targetUsername = body.username.trim().toLowerCase();
    const target = await dbQueryOne<{ id?: string }>(
      'SELECT id FROM users WHERE username = ? LIMIT 1',
      [targetUsername],
    );

    if (!target?.id) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı.' }, { status: 404 });
    }
    if (target.id === user.id) {
      return NextResponse.json({ error: 'Kendinizi arkadaş olarak ekleyemezsiniz.' }, { status: 400 });
    }

    const existing = await dbQueryOne<{ id?: string }>(
      `SELECT id FROM friendships
       WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`,
      [user.id, target.id, target.id, user.id],
    );

    if (existing) {
      return NextResponse.json({ error: 'Zaten arkadaşsınız veya bekleyen istek var.' }, { status: 409 });
    }

    await dbExecute(
      `INSERT INTO friendships (id, requester_id, addressee_id, status, created_at) VALUES (?, ?, ?, 'pending', ?)`,
      [`fr-${crypto.randomUUID().slice(0, 10)}`, user.id, target.id, Date.now()],
    );

    return NextResponse.json({ ok: true });
  }

  if (body.action === 'accept' && body.friendshipId) {
    await dbExecute(
      `UPDATE friendships SET status = 'accepted' WHERE id = ? AND addressee_id = ?`,
      [body.friendshipId, user.id],
    );
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'remove' && body.friendshipId) {
    await dbExecute(
      `DELETE FROM friendships WHERE id = ? AND (requester_id = ? OR addressee_id = ?)`,
      [body.friendshipId, user.id, user.id],
    );
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'block' && body.targetUserId) {
    await dbExecute(
      `DELETE FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`,
      [user.id, body.targetUserId, body.targetUserId, user.id],
    );
    await dbExecute(
      `INSERT INTO friendships (id, requester_id, addressee_id, status, created_at) VALUES (?, ?, ?, 'blocked', ?)`,
      [`fr-${crypto.randomUUID().slice(0, 10)}`, user.id, body.targetUserId, Date.now()],
    );
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'invite' && body.targetUserId && body.roomId) {
    await dbExecute(
      `INSERT INTO room_invites (id, room_id, sender_id, recipient_id, created_at) VALUES (?, ?, ?, ?, ?)`,
      [`inv-${crypto.randomUUID().slice(0, 10)}`, body.roomId, user.id, body.targetUserId, Date.now()],
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Desteklenmeyen işlem.' }, { status: 400 });
}
