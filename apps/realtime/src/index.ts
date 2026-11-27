import http from 'node:http';
import crypto from 'node:crypto';
import { Server, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@luma/shared';
import { verifySessionToken } from './auth.js';
import { loadUserAvatar } from './db.js';
import { SocketRateLimiter } from './rateLimiter.js';
import { RoomManager } from './roomManager.js';

export interface RealtimeServerHandle {
  httpServer: http.Server;
  io: Server<ClientToServerEvents, ServerToClientEvents>;
  roomManager: RoomManager;
  close: () => Promise<void>;
}

export function createRealtimeServer(options?: {
  port?: number;
  corsOrigin?: string;
}): RealtimeServerHandle {
  const corsOrigin = options?.corsOrigin || process.env.CORS_ORIGIN || '*';
  const roomManager = new RoomManager();
  const rateLimiter = new SocketRateLimiter();

  const httpServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          service: 'luma-realtime',
          timestamp: Date.now(),
        }),
      );
      return;
    }

    if (req.url === '/api/live-rooms') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ rooms: roomManager.getLiveSummaries() }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: corsOrigin === '*' ? true : corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 20000,
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    socket.on('room:join', async (payload, ack) => {
      try {
        if (!rateLimiter.consume(`${socket.id}:join`, 6, 1)) {
          ack({ ok: false, error: 'Çok sık deneme yaptınız.' });
          return;
        }

        const verified = verifySessionToken(payload.token);
        const userId = verified?.userId || `guest-${crypto.randomUUID().slice(0, 8)}`;
        const username = verified?.username || `misafir_${userId.slice(-4)}`;
        const displayName =
          verified?.displayName ||
          (payload.guestName && payload.guestName.trim().slice(0, 28)) ||
          `Misafir ${userId.slice(-4)}`;

        const avatar =
          payload.avatar || (verified ? await loadUserAvatar(verified.userId) : undefined);

        const res = await roomManager.joinRoom({
          socketId: socket.id,
          roomId: payload.roomId,
          userId,
          username,
          displayName,
          password: payload.password,
          avatar,
        });

        if (!res.ok) {
          ack({ ok: false, error: res.error });
          return;
        }

        socket.join(res.room.summary.id);
        socket.to(res.room.summary.id).emit('player:joined', res.player);
        ack({
          ok: true,
          playerId: socket.id,
          snapshot: res.snapshot,
        });
      } catch (err) {
        console.error('[room:join] error:', err);
        ack({ ok: false, error: 'Odaya katılım sırasında sunucu hatası oluştu.' });
      }
    });

    socket.on('room:heartbeat', (clientTs, ack) => {
      const room = roomManager.getRoomBySocket(socket.id);
      const player = room?.players.get(socket.id);
      if (player && typeof clientTs === 'number' && Number.isFinite(clientTs)) {
        const approx = Math.max(0, Math.min(999, Math.round(Date.now() - clientTs)));
        player.latencyMs = approx;
      }
      if (typeof ack === 'function') ack(Date.now());
    });

    socket.on('player:move', (payload) => {
      if (!rateLimiter.consume(`${socket.id}:move`, 35, 28)) return;
      const updated = roomManager.updatePlayerTransform(socket.id, payload);
      if (!updated) return;

      socket.to(updated.room.summary.id).emit('player:moved', {
        playerId: socket.id,
        position: updated.player.position,
        rotationY: updated.player.rotationY,
        headYaw: updated.player.headYaw,
        headPitch: updated.player.headPitch,
        velocity: updated.player.velocity,
        animState: updated.player.animState,
        serverTs: Date.now(),
      });
    });

    socket.on('player:avatar', (avatar) => {
      if (!rateLimiter.consume(`${socket.id}:avatar`, 5, 1)) return;
      const updated = roomManager.updateAvatar(socket.id, avatar);
      if (!updated) return;
      io.to(updated.room.summary.id).emit('player:updated', updated.player);
    });

    socket.on('player:status', (status) => {
      const room = roomManager.getRoomBySocket(socket.id);
      const player = room?.players.get(socket.id);
      if (!room || !player) return;
      player.status = status === 'away' ? 'away' : 'active';
      io.to(room.summary.id).emit('player:updated', player);
    });

    socket.on('seat:claim', (seatId, ack) => {
      if (!rateLimiter.consume(`${socket.id}:seat`, 8, 2)) {
        ack?.({ ok: false, error: 'Koltuk değiştirme sınırı aşıldı.' });
        return;
      }
      const res = roomManager.claimSeat(socket.id, seatId);
      if (!res.ok) {
        ack?.({ ok: false, error: res.error });
        return;
      }
      io.to(res.room.summary.id).emit('seats:synced', res.room.seats);
      io.to(res.room.summary.id).emit('player:updated', res.player);
      ack?.({ ok: true, seatId: res.seat.id });
    });

    socket.on('seat:leave', (ack) => {
      const res = roomManager.leaveSeat(socket.id);
      if (!res) {
        ack?.({ ok: false, error: 'Oturduğunuz bir koltuk yok.' });
        return;
      }
      io.to(res.room.summary.id).emit('seats:synced', res.room.seats);
      io.to(res.room.summary.id).emit('player:updated', res.player);
      ack?.({ ok: true, seatId: null });
    });

    socket.on('voice:state', (payload) => {
      if (!rateLimiter.consume(`${socket.id}:voice`, 25, 18)) return;
      const room = roomManager.getRoomBySocket(socket.id);
      const player = room?.players.get(socket.id);
      if (!room || !player) return;

      const micAllowed = !player.mutedByMod;
      player.micEnabled = micAllowed ? Boolean(payload.micEnabled) : false;
      player.isSpeaking = player.micEnabled && Boolean(payload.isSpeaking);
      player.audioLevel = player.micEnabled
        ? Math.max(0, Math.min(1, Number(payload.audioLevel) || 0))
        : 0;

      socket.to(room.summary.id).emit('voice:peer_state', {
        playerId: socket.id,
        micEnabled: player.micEnabled,
        isSpeaking: player.isSpeaking,
        audioLevel: player.audioLevel,
      });
    });

    socket.on('webrtc:offer', (payload) => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room || !room.players.has(payload.targetPlayerId)) return;
      io.to(payload.targetPlayerId).emit('webrtc:offer', {
        ...payload,
        fromPlayerId: socket.id,
      });
    });

    socket.on('webrtc:answer', (payload) => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room || !room.players.has(payload.targetPlayerId)) return;
      io.to(payload.targetPlayerId).emit('webrtc:answer', {
        ...payload,
        fromPlayerId: socket.id,
      });
    });

    socket.on('webrtc:ice', (payload) => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room || !room.players.has(payload.targetPlayerId)) return;
      io.to(payload.targetPlayerId).emit('webrtc:ice', {
        ...payload,
        fromPlayerId: socket.id,
      });
    });

    socket.on('voice:pcm', (payload) => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;
      const player = room.players.get(socket.id);
      if (!player || player.mutedByMod) return;
      if (!Array.isArray(payload?.targetPlayerIds) || payload.targetPlayerIds.length === 0) return;
      for (const targetId of payload.targetPlayerIds.slice(0, 24)) {
        if (targetId !== socket.id && room.players.has(targetId)) {
          io.to(targetId).emit('voice:pcm', {
            targetPlayerIds: [],
            fromPlayerId: socket.id,
            sampleRate: payload.sampleRate,
            pcm: payload.pcm,
          });
        }
      }
    });

    socket.on('video:control', (payload, ack) => {
      if (!rateLimiter.consume(`${socket.id}:video`, 10, 3)) {
        ack?.({ ok: false, error: 'Çok hızlı video kontrolü.' });
        return;
      }
      const res = roomManager.handleVideoControl(socket.id, payload);
      if (!res.ok) {
        ack?.({ ok: false, error: res.error });
        return;
      }
      io.to(res.room.summary.id).emit('video:synced', res.video);
      if (res.updatedPlayers) {
        for (const p of res.updatedPlayers) {
          io.to(res.room.summary.id).emit('player:updated', p);
        }
      }
      ack?.({ ok: true });
    });

    socket.on('queue:add', (payload, ack) => {
      if (!rateLimiter.consume(`${socket.id}:queue`, 8, 2)) {
        ack?.({ ok: false, error: 'Sıra ekleme sınırı aşıldı.' });
        return;
      }
      const res = roomManager.addQueueItem(socket.id, payload);
      if (!res.ok) {
        ack?.({ ok: false, error: res.error });
        return;
      }
      io.to(res.room.summary.id).emit('queue:synced', res.room.queue);
      if (res.autoStarted) {
        io.to(res.room.summary.id).emit('video:synced', res.autoStarted);
      }
      ack?.({ ok: true });
    });

    socket.on('queue:remove', (itemId) => {
      const room = roomManager.removeQueueItem(socket.id, itemId);
      if (!room) return;
      io.to(room.summary.id).emit('queue:synced', room.queue);
    });

    socket.on('queue:next', () => {
      const res = roomManager.playNextInQueue(socket.id);
      if (!res) return;
      io.to(res.room.summary.id).emit('queue:synced', res.room.queue);
      io.to(res.room.summary.id).emit('video:synced', res.video);
    });

    socket.on('room:customize', (patch, ack) => {
      if (!rateLimiter.consume(`${socket.id}:custom`, 8, 2)) {
        ack?.({ ok: false, error: 'Çok sık oda düzenlemesi.' });
        return;
      }
      const res = roomManager.customizeRoom(socket.id, patch);
      if (!res.ok) {
        ack?.({ ok: false, error: res.error });
        return;
      }
      io.to(res.room.summary.id).emit('room:customized', {
        customization: res.room.customization,
        seats: res.room.seats,
      });
      for (const affected of res.affectedPlayers) {
        io.to(res.room.summary.id).emit('player:updated', affected);
      }
      ack?.({ ok: true });
    });

    socket.on('chat:send', (content, ack) => {
      if (!rateLimiter.consume(`${socket.id}:chat`, 6, 1.5)) {
        ack?.({ ok: false, error: 'Mesaj hız sınırına ulaşıldı.' });
        return;
      }
      const res = roomManager.addChatMessage(socket.id, content);
      if (!res.ok) {
        ack?.({ ok: false, error: res.error });
        return;
      }
      io.to(res.room.summary.id).emit('chat:message', res.message);
      ack?.({ ok: true });
    });

    socket.on('chat:react', ({ messageId, emoji }) => {
      const res = roomManager.toggleReaction(socket.id, messageId, emoji);
      if (!res) return;
      io.to(res.room.summary.id).emit('chat:updated', res.message);
    });

    socket.on('chat:pin', (messageId) => {
      const res = roomManager.togglePinMessage(socket.id, messageId);
      if (!res) return;
      io.to(res.room.summary.id).emit('chat:updated', res.message);
    });

    socket.on('chat:delete', (messageId) => {
      const res = roomManager.deleteMessage(socket.id, messageId);
      if (!res) return;
      io.to(res.room.summary.id).emit('chat:deleted', res.messageId);
    });

    socket.on('mod:action', ({ targetPlayerId, action }) => {
      const res = roomManager.moderatePlayer(socket.id, targetPlayerId, action);
      if (!res) return;
      if (res.kicked) {
        io.to(targetPlayerId).emit('mod:kicked', 'Oda yöneticisi tarafından odadan çıkarıldınız.');
        io.sockets.sockets.get(targetPlayerId)?.leave(res.room.summary.id);
        io.to(res.room.summary.id).emit('player:left', {
          playerId: targetPlayerId,
          userId: res.target.userId,
          reason: 'kicked',
        });
        io.to(res.room.summary.id).emit('seats:synced', res.room.seats);
      }
      for (const updated of res.updatedPlayers) {
        io.to(res.room.summary.id).emit('player:updated', updated);
      }
    });

    const handleDisconnect = () => {
      rateLimiter.clearPrefix(`${socket.id}:`);
      const res = roomManager.leaveRoom(socket.id);
      if (!res) return;

      socket.leave(res.room.summary.id);
      io.to(res.room.summary.id).emit('player:left', {
        playerId: socket.id,
        userId: res.leftPlayer.userId,
      });
      if (res.seatsChanged) {
        io.to(res.room.summary.id).emit('seats:synced', res.room.seats);
      }
      if (res.promotedOwner) {
        io.to(res.room.summary.id).emit('player:updated', res.promotedOwner);
        io.to(res.room.summary.id).emit('room:notice', {
          level: 'info',
          message: `Oda sahipliği ${res.promotedOwner.displayName} kullanıcısına devredildi.`,
        });
      }
    };

    socket.on('room:leave', handleDisconnect);
    socket.on('disconnect', handleDisconnect);
  });

  const port =
    options?.port ??
    Number(
      process.env.RENDER
        ? process.env.PORT || 10000
        : process.env.REALTIME_PORT || process.env.PORT || 4001,
    );
  if (port > 0) {
    httpServer.listen(port, () => {
      console.log(`[Luma Realtime] listening on http://localhost:${port}`);
    });
  }

  return {
    httpServer,
    io,
    roomManager,
    close: async () => {
      await new Promise<void>((resolve) => {
        io.close(() => {
          httpServer.closeAllConnections?.();
          httpServer.close(() => resolve());
        });
      });
    },
  };
}

// Start server when run as entrypoint
const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'));

if (isMain && !process.env.LUMA_TEST_NO_AUTOSTART) {
  createRealtimeServer();
}
