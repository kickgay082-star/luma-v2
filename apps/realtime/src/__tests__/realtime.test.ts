import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { io as createClient, Socket } from 'socket.io-client';
import {
  ClientToServerEvents,
  DEFAULT_ROOM_CUSTOMIZATION,
  ServerToClientEvents,
} from '@luma/shared';

const tempDbPath = path.join(os.tmpdir(), `luma-rt-test-${Date.now()}.db`);
process.env.LUMA_DB_PATH = tempDbPath;
process.env.LUMA_TEST_NO_AUTOSTART = '1';

const { createRealtimeServer } = await import('../index.js');
const { getRealtimeDbForTest } = await import('../db.js');

async function seedRoom(roomId: string, ownerId: string) {
  const { executeSql } = getRealtimeDbForTest();
  await executeSql(
    `INSERT INTO rooms (id, code, name, description, owner_id, owner_name, theme, category, privacy, max_users, customization_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [
      roomId,
      roomId.slice(0, 6).toUpperCase(),
      'Test Sinema Odası',
      'Test açıklaması',
      ownerId,
      'Test Sahibi',
      'premium-cinema',
      'cinema',
      'public',
      12,
      JSON.stringify(DEFAULT_ROOM_CUSTOMIZATION),
      Date.now(),
    ],
  );
}

async function walkClientTo(
  socket: Socket<ServerToClientEvents, ClientToServerEvents>,
  from: [number, number, number],
  to: [number, number, number],
) {
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    socket.emit('player:move', {
      position: [
        from[0] + (to[0] - from[0]) * t,
        to[1],
        from[2] + (to[2] - from[2]) * t,
      ],
      rotationY: Math.PI,
      headYaw: 0,
      headPitch: 0,
      velocity: [0, 0, -1],
      animState: 'walk',
      seq: i + 10,
    });
    await new Promise((r) => setTimeout(r, 20));
  }
}

test('Realtime multiplayer server handles movement sync, atomic seat claim, disconnect release, WebRTC relay, and video sync', { timeout: 10000 }, async (t) => {
  const server = createRealtimeServer({ port: 0 });
  await new Promise<void>((resolve) => {
    server.httpServer.listen(0, () => resolve());
  });
  const addr = server.httpServer.address();
  const port = typeof addr === 'object' && addr ? addr.port : 4001;
  const url = `http://localhost:${port}`;

  const roomId = `room-${crypto.randomUUID().slice(0, 6)}`;
  await seedRoom(roomId, 'owner-1');

  const c1: Socket<ServerToClientEvents, ClientToServerEvents> = createClient(url, {
    transports: ['websocket'],
    reconnection: false,
  });
  const c2: Socket<ServerToClientEvents, ClientToServerEvents> = createClient(url, {
    transports: ['websocket'],
    reconnection: false,
  });

  t.after(async () => {
    c1.disconnect();
    c2.disconnect();
    await new Promise<void>((resolve) => {
      server.io.close(() => resolve());
    });
    server.httpServer.closeAllConnections?.();
    await getRealtimeDbForTest().closeRealtimeDb();
    if (fs.existsSync(tempDbPath)) {
      try {
        fs.unlinkSync(tempDbPath);
      } catch {
        // ignore
      }
    }
  });

  console.log('[test] waiting connect');
  const join1 = await new Promise<any>((resolve) => {
    const go = () => c1.emit('room:join', { roomId, guestName: 'Kullanıcı Bir' }, resolve);
    if (c1.connected) go();
    else c1.once('connect', go);
  });
  assert.equal(join1.ok, true);
  assert.ok(join1.snapshot.seats.length > 0);
  console.log('[test] join1 ok');

  const join2 = await new Promise<any>((resolve) => {
    const go = () => c2.emit('room:join', { roomId, guestName: 'Kullanıcı İki' }, resolve);
    if (c2.connected) go();
    else c2.once('connect', go);
  });
  assert.equal(join2.ok, true);
  assert.equal(join2.snapshot.players.length, 2);
  console.log('[test] join2 ok');

  const p1 = join1.snapshot.players[0];
  const p2 = join2.snapshot.players.find((p: any) => p.id === c2.id);

  const movedPromise = new Promise<any>((resolve) => {
    c2.once('player:moved', resolve);
  });
  c1.emit('player:move', {
    position: [p1.position[0], 0, p1.position[2] - 1.0],
    rotationY: 3.1,
    headYaw: 0.1,
    headPitch: 0,
    velocity: [0, 0, -1],
    animState: 'walk',
    seq: 1,
  });
  const moved = await movedPromise;
  assert.equal(moved.playerId, c1.id);
  console.log('[test] move ok');

  const targetSeat = join1.snapshot.seats[0];
  const aisleStart: [number, number, number] = [-7.5, 0, 7.5];
  const aisleTurn: [number, number, number] = [-7.5, 0, targetSeat.position[2] + 1.1];
  const nearSeat: [number, number, number] = [
    targetSeat.position[0],
    0,
    targetSeat.position[2] + 1.1,
  ];
  await Promise.all([
    walkClientTo(c1, [p1.position[0], 0, p1.position[2] - 1.0], aisleTurn).then(() =>
      walkClientTo(c1, aisleTurn, nearSeat),
    ),
    walkClientTo(c2, p2.position, aisleStart)
      .then(() => walkClientTo(c2, aisleStart, aisleTurn))
      .then(() => walkClientTo(c2, aisleTurn, nearSeat)),
  ]);
  console.log('[test] walk ok');

  const [res1, res2] = await Promise.all([
    new Promise<any>((r) => c1.emit('seat:claim', targetSeat.id, r)),
    new Promise<any>((r) => c2.emit('seat:claim', targetSeat.id, r)),
  ]);
  const wins = [res1.ok, res2.ok].filter(Boolean).length;
  assert.equal(wins, 1, `Expected 1 seat winner, got res1=${JSON.stringify(res1)} res2=${JSON.stringify(res2)}`);
  console.log('[test] seat race ok');

  const signalPromise = new Promise<any>((resolve) => {
    c2.once('webrtc:offer', resolve);
  });
  c1.emit('webrtc:offer', {
    targetPlayerId: c2.id!,
    sdp: { type: 'offer', sdp: 'v=0\r\ntest-sdp' },
  });
  const relayedOffer = await signalPromise;
  assert.equal(relayedOffer.fromPlayerId, c1.id);
  console.log('[test] webrtc signal ok');

  const winner = res1.ok ? c1 : c2;
  const loser = res1.ok ? c2 : c1;
  const seatsResetPromise = new Promise<any[]>((resolve) => {
    loser.on('seats:synced', (seats) => {
      const seat = seats.find((s: any) => s.id === targetSeat.id);
      if (seat && seat.occupiedBy === null) resolve(seats);
    });
  });
  winner.disconnect();
  const releasedSeats = await seatsResetPromise;
  assert.equal(releasedSeats.find((s: any) => s.id === targetSeat.id)?.occupiedBy, null);
  console.log('[test] seat disconnect release ok');

  const videoRes = await new Promise<any>((resolve) => {
    loser.emit(
      'video:control',
      {
        action: 'load',
        sourceType: 'youtube',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'Test YouTube Videosu',
      },
      resolve,
    );
  });
  assert.equal(videoRes.ok, true);
  console.log('[test] video sync ok');
});
