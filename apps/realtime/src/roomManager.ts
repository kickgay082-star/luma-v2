import crypto from 'node:crypto';
import {
  AdminActionType,
  AvatarConfig,
  avatarConfigSchema,
  buildRoomGeometry,
  ChatMessage,
  DEFAULT_ROOM_CUSTOMIZATION,
  extractYouTubeId,
  GameActionPayload,
  getFloorElevationAt,
  pickDiverseAvatarPreset,
  PlayerRole,
  PlayerState,
  PlayerTransformUpdate,
  QueueItem,
  resolvePlayerMovement,
  RoomCustomization,
  roomCustomizationSchema,
  RoomGeometry,
  RoomGamesState,
  RoomStateSnapshot,
  RoomSummary,
  sanitizeText,
  ScreenShareState,
  SeatState,
  UnoCard,
  validateExternalHttpUrl,
  Vec3,
  VideoControlPayload,
  VideoState,
} from '@luma/shared';
import {
  applyGameAction,
  createInitialRoomGames,
  ServerRoomGames,
} from './gameEngine.js';
import { verifyPasswordScrypt } from './auth.js';
import {
  deleteChatMessageRecord,
  insertChatMessage,
  loadRecentChatMessages,
  loadRoomByIdOrCode,
  PersistedRoomRecord,
  saveRoomCustomization,
  updateChatMessageRecord,
  updateRoomOwner,
} from './db.js';

export interface ActiveRoom {
  summary: RoomSummary;
  passwordHash: string | null;
  customization: RoomCustomization;
  geometry: RoomGeometry;
  players: Map<string, PlayerState>;
  seats: SeatState[];
  video: VideoState;
  screenShare: ScreenShareState;
  queue: QueueItem[];
  chatHistory: ChatMessage[];
  mutedChatUserIds: Set<string>;
  mutedVoiceUserIds: Set<string>;
  bannedUserIds: Set<string>;
  moderators: Set<string>;
  videoAllowedUserIds: Set<string>;
  videoDeniedUserIds: Set<string>;
  games: ServerRoomGames;
}

export class RoomManager {
  private rooms = new Map<string, ActiveRoom>();
  private socketToRoom = new Map<string, string>();

  async getOrLoadRoom(roomIdOrCode: string): Promise<ActiveRoom | null> {
    // Search active rooms by id or code
    for (const room of this.rooms.values()) {
      if (
        room.summary.id === roomIdOrCode ||
        room.summary.code.toUpperCase() === roomIdOrCode.toUpperCase()
      ) {
        return room;
      }
    }

    const persisted: PersistedRoomRecord | null = await loadRoomByIdOrCode(roomIdOrCode);
    if (!persisted) return null;

    // Check again in case another concurrent join loaded it while awaiting
    const concurrent = this.rooms.get(persisted.summary.id);
    if (concurrent) return concurrent;

    const geometry = buildRoomGeometry(persisted.customization.theme, persisted.customization);
    const active: ActiveRoom = {
      summary: persisted.summary,
      passwordHash: persisted.passwordHash,
      customization: persisted.customization,
      geometry,
      players: new Map(),
      seats: geometry.seats,
      video: {
        sourceType: null,
        url: null,
        youtubeId: null,
        title: 'İçerik Seçilmedi',
        channelLogo: null,
        isLive: false,
        isPlaying: false,
        currentTime: 0,
        playbackRate: 1,
        updatedAt: Date.now(),
        updatedBy: null,
        hostOnlyControl: false,
      },
      screenShare: {
        active: false,
        sharerId: null,
        sharerName: null,
      },
      queue: [],
      chatHistory: await loadRecentChatMessages(persisted.summary.id, 60),
      mutedChatUserIds: new Set(),
      mutedVoiceUserIds: new Set(),
      bannedUserIds: new Set(),
      moderators: new Set(),
      videoAllowedUserIds: new Set(),
      videoDeniedUserIds: new Set(),
      games: createInitialRoomGames(),
    };

    this.rooms.set(active.summary.id, active);
    return active;
  }

  private canPlayerControlVideo(room: ActiveRoom, role: PlayerRole, userId: string): boolean {
    if (role === 'owner' || role === 'moderator') return true;
    if (room.videoDeniedUserIds.has(userId)) return false;
    if (room.video.hostOnlyControl) return room.videoAllowedUserIds.has(userId);
    return true;
  }

  getRoomBySocket(socketId: string): ActiveRoom | null {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return null;
    return this.rooms.get(roomId) ?? null;
  }

  getLiveSummaries(): Array<{
    id: string;
    onlineCount: number;
    currentlyPlaying: string | null;
  }> {
    const list: Array<{ id: string; onlineCount: number; currentlyPlaying: string | null }> = [];
    for (const room of this.rooms.values()) {
      list.push({
        id: room.summary.id,
        onlineCount: room.players.size,
        currentlyPlaying: room.video.url ? room.video.title : null,
      });
    }
    return list;
  }

  async joinRoom(params: {
    socketId: string;
    roomId: string;
    userId: string;
    username: string;
    displayName: string;
    password?: string;
    avatar?: AvatarConfig;
  }): Promise<{ ok: true; room: ActiveRoom; player: PlayerState; snapshot: RoomStateSnapshot } | { ok: false; error: string }> {
    const room = await this.getOrLoadRoom(params.roomId);
    if (!room) {
      return { ok: false, error: 'Oda bulunamadı.' };
    }

    if (room.bannedUserIds.has(params.userId)) {
      return { ok: false, error: 'Bu odadan uzaklaştırıldınız.' };
    }

    if (room.customization.locked && room.summary.ownerId !== params.userId) {
      return { ok: false, error: 'Bu oda şu anda kilitli.' };
    }

    if (room.players.size >= room.customization.maxUsers) {
      return { ok: false, error: 'Oda kapasitesi dolu.' };
    }

    if (room.summary.privacy === 'password' && room.passwordHash && room.summary.ownerId !== params.userId) {
      if (!params.password || !verifyPasswordScrypt(params.password, room.passwordHash)) {
        return { ok: false, error: 'Oda şifresi hatalı.' };
      }
    }

    // Remove previous session if same socket was in another room
    this.leaveRoom(params.socketId);

    // If same userId reconnects on a new socket, cleanly evict stale socket
    for (const [existingId, existingPlayer] of room.players.entries()) {
      if (existingPlayer.userId === params.userId && existingId !== params.socketId) {
        this.releasePlayerSeat(room, existingId);
        room.players.delete(existingId);
        this.socketToRoom.delete(existingId);
      }
    }

    const spawnList = room.geometry.meta.spawnPoints;
    const spawnBase = spawnList[room.players.size % spawnList.length] ?? [0, 0, 8.5];
    const jitterX = ((room.players.size % 3) - 1) * 0.65;
    const safePos = resolvePlayerMovement(
      spawnBase,
      [spawnBase[0] + jitterX, 0, spawnBase[2]],
      room.geometry.colliders,
      room.geometry.bounds,
    );

    let role: PlayerRole = 'member';
    const hasActiveOwner = Array.from(room.players.values()).some((p) => p.role === 'owner');
    if (room.summary.ownerId === params.userId) {
      role = 'owner';
    } else if (room.summary.ownerId === 'luma-studio' && !hasActiveOwner) {
      role = 'owner';
    } else if (room.moderators.has(params.userId)) {
      role = 'moderator';
    }

    const validatedAvatar = params.avatar
      ? avatarConfigSchema.safeParse(params.avatar)
      : null;

    const player: PlayerState = {
      id: params.socketId,
      userId: params.userId,
      username: params.username,
      displayName: params.displayName,
      role,
      position: safePos,
      rotationY: Math.PI, // face toward cinema screen (-Z)
      headYaw: 0,
      headPitch: 0,
      velocity: [0, 0, 0],
      animState: 'enter',
      seatedSeatId: null,
      micEnabled: false,
      isSpeaking: false,
      audioLevel: 0,
      mutedByMod: room.mutedVoiceUserIds.has(params.userId),
      canControlVideo: this.canPlayerControlVideo(room, role, params.userId),
      avatar: validatedAvatar?.success
        ? validatedAvatar.data
        : pickDiverseAvatarPreset(params.userId || params.displayName),
      connectedAt: Date.now(),
      latencyMs: 0,
      status: 'active',
    };

    room.players.set(params.socketId, player);
    this.socketToRoom.set(params.socketId, room.summary.id);
    room.summary.onlineCount = room.players.size;

    const snapshot = this.buildSnapshot(room);
    return { ok: true, room, player, snapshot };
  }

  leaveRoom(socketId: string): {
    room: ActiveRoom;
    leftPlayer: PlayerState;
    seatsChanged: boolean;
    screenShareStopped: boolean;
    promotedOwner?: PlayerState;
  } | null {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    this.socketToRoom.delete(socketId);
    if (!room) return null;

    const player = room.players.get(socketId);
    if (!player) return null;

    const seatsChanged = this.releasePlayerSeat(room, socketId);
    applyGameAction(room.games, player, { game: 'chess', op: 'leave' });
    applyGameAction(room.games, player, { game: 'uno', op: 'leave' });
    applyGameAction(room.games, player, { game: 'monopoly', op: 'leave' });
    let screenShareStopped = false;
    if (room.screenShare.active && room.screenShare.sharerId === socketId) {
      room.screenShare = { active: false, sharerId: null, sharerName: null };
      screenShareStopped = true;
    }
    room.players.delete(socketId);
    room.summary.onlineCount = room.players.size;

    let promotedOwner: PlayerState | undefined;
    if (player.role === 'owner' && room.players.size > 0) {
      // Transfer ownership smoothly to moderator first, otherwise longest-connected member
      const candidates = Array.from(room.players.values()).sort((a, b) => {
        if (a.role === 'moderator' && b.role !== 'moderator') return -1;
        if (b.role === 'moderator' && a.role !== 'moderator') return 1;
        return a.connectedAt - b.connectedAt;
      });
      const nextOwner = candidates[0];
      if (nextOwner) {
        nextOwner.role = 'owner';
        nextOwner.canControlVideo = true;
        if (!room.summary.id.startsWith('luma-')) {
          room.summary.ownerId = nextOwner.userId;
          room.summary.ownerName = nextOwner.displayName;
          updateRoomOwner(room.summary.id, nextOwner.userId, nextOwner.displayName).catch(console.error);
        }
        promotedOwner = nextOwner;
      }
    }

    if (room.players.size === 0) {
      // Pause playback when everyone leaves so playback doesn't drift forever
      if (room.video.isPlaying) {
        room.video.currentTime = this.getEffectiveVideoTime(room.video);
        room.video.isPlaying = false;
        room.video.updatedAt = Date.now();
      }
    }

    return { room, leftPlayer: player, seatsChanged, screenShareStopped, promotedOwner };
  }

  startScreenShare(
    socketId: string,
  ): { ok: true; room: ActiveRoom; screenShare: ScreenShareState } | { ok: false; error: string } {
    const room = this.getRoomBySocket(socketId);
    if (!room) return { ok: false, error: 'Odada değilsiniz.' };
    const player = room.players.get(socketId);
    if (!player) return { ok: false, error: 'Oyuncu bulunamadı.' };
    if (!this.canPlayerControlVideo(room, player.role, player.userId)) {
      return { ok: false, error: 'Ekran/sekme paylaşma yetkiniz yok.' };
    }
    room.screenShare = {
      active: true,
      sharerId: socketId,
      sharerName: player.displayName,
    };
    return { ok: true, room, screenShare: room.screenShare };
  }

  stopScreenShare(socketId: string): { room: ActiveRoom; screenShare: ScreenShareState } | null {
    const room = this.getRoomBySocket(socketId);
    if (!room || !room.screenShare.active) return null;
    const player = room.players.get(socketId);
    const isPrivileged = player?.role === 'owner' || player?.role === 'moderator';
    if (room.screenShare.sharerId !== socketId && !isPrivileged) return null;
    room.screenShare = { active: false, sharerId: null, sharerName: null };
    return { room, screenShare: room.screenShare };
  }

  updatePlayerTransform(
    socketId: string,
    payload: PlayerTransformUpdate,
  ): { room: ActiveRoom; player: PlayerState } | null {
    const room = this.getRoomBySocket(socketId);
    if (!room) return null;
    const player = room.players.get(socketId);
    if (!player) return null;

    // Validate finite coordinates
    if (
      !Array.isArray(payload.position) ||
      payload.position.length !== 3 ||
      payload.position.some((n) => typeof n !== 'number' || !Number.isFinite(n))
    ) {
      return null;
    }

    // While seated, lock positional movement and only allow subtle head rotation
    if (player.seatedSeatId) {
      player.headYaw = clamp(payload.headYaw || 0, -1.2, 1.2);
      player.headPitch = clamp(payload.headPitch || 0, -0.6, 0.6);
      player.animState = 'sit';
      player.velocity = [0, 0, 0];
      return { room, player };
    }

    // Anti-teleport speed check (max step 2.4m per update packet)
    const dx = payload.position[0] - player.position[0];
    const dz = payload.position[2] - player.position[2];
    const stepDist = Math.hypot(dx, dz);
    let targetPos: Vec3 = payload.position;
    if (stepDist > 2.4) {
      const scale = 2.4 / stepDist;
      targetPos = [
        player.position[0] + dx * scale,
        payload.position[1],
        player.position[2] + dz * scale,
      ];
    }

    const resolved = resolvePlayerMovement(
      player.position,
      targetPos,
      room.geometry.colliders,
      room.geometry.bounds,
    );

    const floorY = getFloorElevationAt(resolved[2], room.customization.seatLayout);
    player.position = [resolved[0], floorY, resolved[2]];
    player.rotationY = Number.isFinite(payload.rotationY) ? payload.rotationY : player.rotationY;
    player.headYaw = clamp(payload.headYaw || 0, -1.2, 1.2);
    player.headPitch = clamp(payload.headPitch || 0, -0.6, 0.6);
    player.velocity = Array.isArray(payload.velocity) ? payload.velocity : [0, 0, 0];
    player.animState =
      payload.animState === 'walk' ||
      payload.animState === 'run' ||
      payload.animState === 'idle' ||
      payload.animState === 'wave'
        ? payload.animState
        : 'idle';

    return { room, player };
  }

  claimSeat(
    socketId: string,
    seatId: string,
  ): { ok: true; room: ActiveRoom; player: PlayerState; seat: SeatState } | { ok: false; error: string } {
    const room = this.getRoomBySocket(socketId);
    if (!room) return { ok: false, error: 'Odada değilsiniz.' };
    const player = room.players.get(socketId);
    if (!player) return { ok: false, error: 'Oyuncu bulunamadı.' };

    const targetSeat = room.seats.find((s) => s.id === seatId);
    if (!targetSeat) {
      return { ok: false, error: 'Koltuk bulunamadı.' };
    }

    // Atomic check in single-threaded Node loop
    if (targetSeat.occupiedBy !== null && targetSeat.occupiedBy !== socketId) {
      return { ok: false, error: 'Bu koltuk az önce başka bir kullanıcı tarafından alındı.' };
    }

    const dist = Math.hypot(
      player.position[0] - targetSeat.position[0],
      player.position[2] - targetSeat.position[2],
    );
    if (dist > 3.2 && player.seatedSeatId !== seatId) {
      return { ok: false, error: 'Oturmak için koltuğa biraz daha yaklaşın.' };
    }

    // Vacate previous seat if any
    this.releasePlayerSeat(room, socketId);

    targetSeat.occupiedBy = socketId;
    targetSeat.occupiedByName = player.displayName;
    player.seatedSeatId = targetSeat.id;
    player.position = [...targetSeat.position];
    player.rotationY = targetSeat.rotationY;
    player.velocity = [0, 0, 0];
    player.animState = 'sit';

    return { ok: true, room, player, seat: targetSeat };
  }

  leaveSeat(socketId: string): {
    room: ActiveRoom;
    player: PlayerState;
  } | null {
    const room = this.getRoomBySocket(socketId);
    if (!room) return null;
    const player = room.players.get(socketId);
    if (!player || !player.seatedSeatId) return null;

    const currentSeat = room.seats.find((s) => s.id === player.seatedSeatId);
    this.releasePlayerSeat(room, socketId);

    if (currentSeat) {
      // Step slightly forward/back into aisle clear of seat collider
      const forwardX = Math.sin(currentSeat.rotationY) * 0.95;
      const forwardZ = Math.cos(currentSeat.rotationY) * 0.95;
      const candidate: Vec3 = [
        currentSeat.position[0] + forwardX,
        currentSeat.position[1],
        currentSeat.position[2] + forwardZ,
      ];
      const safeStand = resolvePlayerMovement(
        currentSeat.position,
        candidate,
        room.geometry.colliders,
        room.geometry.bounds,
      );
      player.position = [
        safeStand[0],
        getFloorElevationAt(safeStand[2], room.customization.seatLayout),
        safeStand[2],
      ];
    }

    player.seatedSeatId = null;
    player.animState = 'idle';
    return { room, player };
  }

  updateAvatar(socketId: string, avatar: AvatarConfig): { room: ActiveRoom; player: PlayerState } | null {
    const parsed = avatarConfigSchema.safeParse(avatar);
    if (!parsed.success) return null;
    const room = this.getRoomBySocket(socketId);
    if (!room) return null;
    const player = room.players.get(socketId);
    if (!player) return null;
    player.avatar = parsed.data;
    return { room, player };
  }

  customizeRoom(
    socketId: string,
    patch: Partial<RoomCustomization>,
  ): { ok: true; room: ActiveRoom; affectedPlayers: PlayerState[] } | { ok: false; error: string } {
    const room = this.getRoomBySocket(socketId);
    if (!room) return { ok: false, error: 'Odada değilsiniz.' };
    const player = room.players.get(socketId);
    if (!player || (player.role !== 'owner' && player.role !== 'moderator')) {
      return { ok: false, error: 'Oda ayarlarını yalnızca oda sahibi veya moderatör değiştirebilir.' };
    }

    const parsed = roomCustomizationSchema.safeParse(patch);
    if (!parsed.success) {
      return { ok: false, error: 'Geçersiz oda özelleştirme parametreleri.' };
    }

    const next: RoomCustomization = {
      ...room.customization,
      ...parsed.data,
    };

    const layoutOrThemeChanged =
      next.theme !== room.customization.theme ||
      next.seatLayout !== room.customization.seatLayout ||
      next.decorPreset !== room.customization.decorPreset ||
      next.screenScale !== room.customization.screenScale;

    room.customization = next;
    room.summary.theme = next.theme;
    room.summary.maxUsers = next.maxUsers;
    saveRoomCustomization(room.summary.id, next).catch(console.error);

    const affectedPlayers: PlayerState[] = [];
    if (layoutOrThemeChanged) {
      const prevOccupied = new Map<string, string>();
      for (const s of room.seats) {
        if (s.occupiedBy) prevOccupied.set(s.id, s.occupiedBy);
      }

      const nextGeom = buildRoomGeometry(next.theme, next);
      room.geometry = nextGeom;
      room.seats = nextGeom.seats;

      // Re-attach seated players if matching seat ID exists, otherwise stand safely
      for (const p of room.players.values()) {
        if (p.seatedSeatId) {
          const matching = room.seats.find((s) => s.id === p.seatedSeatId);
          if (matching && !matching.occupiedBy) {
            matching.occupiedBy = p.id;
            matching.occupiedByName = p.displayName;
            p.position = [...matching.position];
            p.rotationY = matching.rotationY;
          } else {
            p.seatedSeatId = null;
            p.animState = 'idle';
            p.position = resolvePlayerMovement(
              p.position,
              p.position,
              room.geometry.colliders,
              room.geometry.bounds,
            );
          }
          affectedPlayers.push(p);
        }
      }
    }

    return { ok: true, room, affectedPlayers };
  }

  handleVideoControl(
    socketId: string,
    payload: VideoControlPayload,
  ): { ok: true; room: ActiveRoom; video: VideoState; updatedPlayers?: PlayerState[] } | { ok: false; error: string } {
    const room = this.getRoomBySocket(socketId);
    if (!room) return { ok: false, error: 'Odada değilsiniz.' };
    const player = room.players.get(socketId);
    if (!player) return { ok: false, error: 'Oyuncu bulunamadı.' };

    const isPrivileged = player.role === 'owner' || player.role === 'moderator';

    if (payload.action === 'host_lock') {
      if (!isPrivileged) {
        return { ok: false, error: 'Bu ayarı yalnızca oda sahibi (Host) değiştirebilir.' };
      }
      room.video.hostOnlyControl = Boolean(payload.hostOnlyControl);
      room.video.updatedAt = Date.now();
      room.video.updatedBy = player.displayName;
      const updatedPlayers: PlayerState[] = [];
      for (const p of room.players.values()) {
        p.canControlVideo = this.canPlayerControlVideo(room, p.role, p.userId);
        updatedPlayers.push(p);
      }
      return { ok: true, room, video: this.cloneEffectiveVideo(room.video), updatedPlayers };
    }

    if (!this.canPlayerControlVideo(room, player.role, player.userId)) {
      return {
        ok: false,
        error: 'Video kontrol yetkiniz yok. Oda sahibi (Host) size yetki vermelidir.',
      };
    }

    if (payload.action === 'load') {
      const rawUrl = (payload.url || '').trim();
      const sourceType = payload.sourceType || 'mp4';

      if (sourceType === 'youtube') {
        const ytId = extractYouTubeId(rawUrl);
        if (!ytId) {
          return { ok: false, error: 'Geçerli bir YouTube bağlantısı girin.' };
        }
        room.video = {
          ...room.video,
          sourceType: 'youtube',
          url: `https://www.youtube.com/watch?v=${ytId}`,
          youtubeId: ytId,
          title: sanitizeText(payload.title || 'YouTube Yayını', 120) || 'YouTube Yayını',
          channelLogo: null,
          isLive: Boolean(payload.isLive),
          isPlaying: true,
          currentTime: 0,
          playbackRate: 1,
          updatedAt: Date.now(),
          updatedBy: player.displayName,
        };
      } else {
        const urlCheck = validateExternalHttpUrl(rawUrl);
        if (!urlCheck.ok || !urlCheck.url) {
          return { ok: false, error: urlCheck.error || 'Geçersiz medya adresi.' };
        }
        room.video = {
          ...room.video,
          sourceType,
          url: urlCheck.url,
          youtubeId: null,
          title: sanitizeText(payload.title || 'Medya Akışı', 120) || 'Medya Akışı',
          channelLogo: payload.channelLogo || null,
          isLive: Boolean(payload.isLive || sourceType === 'iptv'),
          isPlaying: true,
          currentTime: 0,
          playbackRate: 1,
          updatedAt: Date.now(),
          updatedBy: player.displayName,
        };
      }
      room.summary.currentlyPlaying = room.video.title;
      return { ok: true, room, video: this.cloneEffectiveVideo(room.video) };
    }

    const now = Date.now();
    const effectiveTime = this.getEffectiveVideoTime(room.video, now);

    if (payload.action === 'play') {
      room.video.currentTime =
        typeof payload.currentTime === 'number' && Number.isFinite(payload.currentTime)
          ? Math.max(0, payload.currentTime)
          : effectiveTime;
      room.video.isPlaying = true;
      room.video.updatedAt = now;
      room.video.updatedBy = player.displayName;
    } else if (payload.action === 'pause') {
      room.video.currentTime =
        typeof payload.currentTime === 'number' && Number.isFinite(payload.currentTime)
          ? Math.max(0, payload.currentTime)
          : effectiveTime;
      room.video.isPlaying = false;
      room.video.updatedAt = now;
      room.video.updatedBy = player.displayName;
    } else if (payload.action === 'seek') {
      if (typeof payload.currentTime === 'number' && Number.isFinite(payload.currentTime)) {
        room.video.currentTime = Math.max(0, payload.currentTime);
        room.video.updatedAt = now;
        room.video.updatedBy = player.displayName;
      }
    } else if (payload.action === 'rate') {
      if (typeof payload.playbackRate === 'number' && payload.playbackRate >= 0.5 && payload.playbackRate <= 2) {
        room.video.currentTime = effectiveTime;
        room.video.playbackRate = payload.playbackRate;
        room.video.updatedAt = now;
        room.video.updatedBy = player.displayName;
      }
    }

    return { ok: true, room, video: this.cloneEffectiveVideo(room.video) };
  }

  addQueueItem(
    socketId: string,
    input: Omit<QueueItem, 'id' | 'addedBy' | 'addedByName' | 'addedAt'>,
  ): { ok: true; room: ActiveRoom; item: QueueItem; autoStarted?: VideoState } | { ok: false; error: string } {
    const room = this.getRoomBySocket(socketId);
    if (!room) return { ok: false, error: 'Odada değilsiniz.' };
    const player = room.players.get(socketId);
    if (!player) return { ok: false, error: 'Oyuncu bulunamadı.' };
    if (!this.canPlayerControlVideo(room, player.role, player.userId)) {
      return { ok: false, error: 'Video ekleme yetkiniz yok. Host izin vermelidir.' };
    }

    let finalUrl = input.url;
    let ytId: string | undefined;

    if (input.sourceType === 'youtube') {
      const parsed = extractYouTubeId(input.url);
      if (!parsed) return { ok: false, error: 'Geçersiz YouTube URL.' };
      ytId = parsed;
      finalUrl = `https://www.youtube.com/watch?v=${parsed}`;
    } else {
      const check = validateExternalHttpUrl(input.url);
      if (!check.ok || !check.url) return { ok: false, error: check.error || 'Geçersiz URL.' };
      finalUrl = check.url;
    }

    const item: QueueItem = {
      id: `q-${crypto.randomUUID().slice(0, 8)}`,
      sourceType: input.sourceType,
      url: finalUrl,
      youtubeId: ytId,
      title: sanitizeText(input.title || 'Sıradaki Medya', 120) || 'Sıradaki Medya',
      thumbnail: input.thumbnail,
      channelLogo: input.channelLogo,
      isLive: Boolean(input.isLive),
      addedBy: player.userId,
      addedByName: player.displayName,
      addedAt: Date.now(),
    };

    room.queue.push(item);

    // If nothing is currently loaded, auto-play the added item immediately
    let autoStarted: VideoState | undefined;
    if (!room.video.url) {
      const nextItem = room.queue.shift();
      if (nextItem) {
        room.video = {
          ...room.video,
          sourceType: nextItem.sourceType,
          url: nextItem.url,
          youtubeId: nextItem.youtubeId || null,
          title: nextItem.title,
          channelLogo: nextItem.channelLogo || null,
          isLive: Boolean(nextItem.isLive),
          isPlaying: true,
          currentTime: 0,
          playbackRate: 1,
          updatedAt: Date.now(),
          updatedBy: player.displayName,
        };
        room.summary.currentlyPlaying = room.video.title;
        autoStarted = this.cloneEffectiveVideo(room.video);
      }
    }

    return { ok: true, room, item, autoStarted };
  }

  removeQueueItem(socketId: string, itemId: string): ActiveRoom | null {
    const room = this.getRoomBySocket(socketId);
    if (!room) return null;
    const player = room.players.get(socketId);
    if (!player) return null;
    const item = room.queue.find((q) => q.id === itemId);
    if (!item) return null;

    if (
      item.addedBy !== player.userId &&
      player.role !== 'owner' &&
      player.role !== 'moderator'
    ) {
      return null;
    }

    room.queue = room.queue.filter((q) => q.id !== itemId);
    return room;
  }

  playNextInQueue(socketId: string): { room: ActiveRoom; video: VideoState } | null {
    const room = this.getRoomBySocket(socketId);
    if (!room) return null;
    const player = room.players.get(socketId);
    if (!player) return null;
    if (!this.canPlayerControlVideo(room, player.role, player.userId)) return null;

    const nextItem = room.queue.shift();
    if (!nextItem) return null;

    room.video = {
      ...room.video,
      sourceType: nextItem.sourceType,
      url: nextItem.url,
      youtubeId: nextItem.youtubeId || null,
      title: nextItem.title,
      channelLogo: nextItem.channelLogo || null,
      isLive: Boolean(nextItem.isLive),
      isPlaying: true,
      currentTime: 0,
      playbackRate: 1,
      updatedAt: Date.now(),
      updatedBy: player.displayName,
    };
    room.summary.currentlyPlaying = room.video.title;
    return { room, video: this.cloneEffectiveVideo(room.video) };
  }

  addChatMessage(
    socketId: string,
    rawContent: string,
  ): { ok: true; room: ActiveRoom; message: ChatMessage } | { ok: false; error: string } {
    const room = this.getRoomBySocket(socketId);
    if (!room) return { ok: false, error: 'Odada değilsiniz.' };
    const player = room.players.get(socketId);
    if (!player) return { ok: false, error: 'Oyuncu bulunamadı.' };

    if (room.mutedChatUserIds.has(player.userId)) {
      return { ok: false, error: 'Bu odada sohbet yazma yetkiniz kısıtlandı.' };
    }
    if (room.customization.chatLocked && player.role === 'member') {
      return { ok: false, error: 'Sohbet şu anda yönetici tarafından kilitlendi.' };
    }

    const content = sanitizeText(rawContent, 420);
    if (!content) return { ok: false, error: 'Boş mesaj gönderilemez.' };

    const msg: ChatMessage = {
      id: `msg-${crypto.randomUUID().slice(0, 10)}`,
      roomId: room.summary.id,
      userId: player.userId,
      username: player.username,
      displayName: player.displayName,
      content,
      createdAt: Date.now(),
      pinned: false,
      reactions: {},
      type: 'chat',
    };

    room.chatHistory.push(msg);
    if (room.chatHistory.length > 120) {
      room.chatHistory.shift();
    }
    insertChatMessage(msg).catch(console.error);
    return { ok: true, room, message: msg };
  }

  toggleReaction(socketId: string, messageId: string, emoji: string): { room: ActiveRoom; message: ChatMessage } | null {
    const room = this.getRoomBySocket(socketId);
    if (!room) return null;
    const player = room.players.get(socketId);
    if (!player) return null;
    const msg = room.chatHistory.find((m) => m.id === messageId);
    if (!msg) return null;

    const cleanEmoji = sanitizeText(emoji, 8);
    if (!cleanEmoji) return null;

    const list = msg.reactions[cleanEmoji] ?? [];
    if (list.includes(player.userId)) {
      const filtered = list.filter((u) => u !== player.userId);
      if (filtered.length === 0) delete msg.reactions[cleanEmoji];
      else msg.reactions[cleanEmoji] = filtered;
    } else {
      msg.reactions[cleanEmoji] = [...list, player.userId];
    }

    updateChatMessageRecord(msg).catch(console.error);
    return { room, message: msg };
  }

  togglePinMessage(socketId: string, messageId: string): { room: ActiveRoom; message: ChatMessage } | null {
    const room = this.getRoomBySocket(socketId);
    if (!room) return null;
    const player = room.players.get(socketId);
    if (!player || (player.role !== 'owner' && player.role !== 'moderator')) return null;

    const msg = room.chatHistory.find((m) => m.id === messageId);
    if (!msg) return null;
    msg.pinned = !msg.pinned;
    updateChatMessageRecord(msg).catch(console.error);
    return { room, message: msg };
  }

  deleteMessage(socketId: string, messageId: string): { room: ActiveRoom; messageId: string } | null {
    const room = this.getRoomBySocket(socketId);
    if (!room) return null;
    const player = room.players.get(socketId);
    if (!player) return null;

    const idx = room.chatHistory.findIndex((m) => m.id === messageId);
    if (idx === -1) return null;
    const target = room.chatHistory[idx];
    if (
      target.userId !== player.userId &&
      player.role !== 'owner' &&
      player.role !== 'moderator'
    ) {
      return null;
    }

    room.chatHistory.splice(idx, 1);
    deleteChatMessageRecord(messageId).catch(console.error);
    return { room, messageId };
  }

  moderatePlayer(
    socketId: string,
    targetPlayerId: string,
    action:
      | 'kick'
      | 'kick_seat'
      | 'mute_voice'
      | 'unmute_voice'
      | 'mute_chat'
      | 'unmute_chat'
      | 'promote_mod'
      | 'demote_mod'
      | 'transfer_owner'
      | 'allow_video'
      | 'deny_video',
  ): {
    room: ActiveRoom;
    target: PlayerState;
    kicked?: boolean;
    seatsChanged?: boolean;
    updatedPlayers: PlayerState[];
  } | null {
    const room = this.getRoomBySocket(socketId);
    if (!room) return null;
    const actor = room.players.get(socketId);
    const target = room.players.get(targetPlayerId);
    if (!actor || !target || actor.id === target.id) return null;

    const isOwner = actor.role === 'owner';
    const isMod = actor.role === 'moderator';
    if (!isOwner && !isMod) return null;
    if (!isOwner && target.role !== 'member') return null;

    const updatedPlayers: PlayerState[] = [];
    let seatsChanged = false;

    if (action === 'kick') {
      room.bannedUserIds.add(target.userId);
      this.leaveRoom(target.id);
      return { room, target, kicked: true, updatedPlayers };
    }
    if (action === 'kick_seat') {
      if (this.releasePlayerSeat(room, target.id)) {
        seatsChanged = true;
      }
      target.seatedSeatId = null;
      target.animState = 'idle';
      updatedPlayers.push(target);
    } else if (action === 'mute_voice') {
      room.mutedVoiceUserIds.add(target.userId);
      target.mutedByMod = true;
      target.micEnabled = false;
      target.isSpeaking = false;
      target.audioLevel = 0;
      updatedPlayers.push(target);
    } else if (action === 'unmute_voice') {
      room.mutedVoiceUserIds.delete(target.userId);
      target.mutedByMod = false;
      updatedPlayers.push(target);
    } else if (action === 'mute_chat') {
      room.mutedChatUserIds.add(target.userId);
    } else if (action === 'unmute_chat') {
      room.mutedChatUserIds.delete(target.userId);
    } else if (action === 'allow_video') {
      room.videoAllowedUserIds.add(target.userId);
      room.videoDeniedUserIds.delete(target.userId);
      target.canControlVideo = this.canPlayerControlVideo(room, target.role, target.userId);
      updatedPlayers.push(target);
    } else if (action === 'deny_video') {
      room.videoAllowedUserIds.delete(target.userId);
      room.videoDeniedUserIds.add(target.userId);
      target.canControlVideo = this.canPlayerControlVideo(room, target.role, target.userId);
      updatedPlayers.push(target);
    } else if (action === 'promote_mod' && isOwner) {
      room.moderators.add(target.userId);
      target.role = 'moderator';
      target.canControlVideo = true;
      updatedPlayers.push(target);
    } else if (action === 'demote_mod' && isOwner) {
      room.moderators.delete(target.userId);
      target.role = 'member';
      target.canControlVideo = this.canPlayerControlVideo(room, target.role, target.userId);
      updatedPlayers.push(target);
    } else if (action === 'transfer_owner' && isOwner) {
      actor.role = 'moderator';
      room.moderators.add(actor.userId);
      actor.canControlVideo = true;
      target.role = 'owner';
      target.canControlVideo = true;
      if (!room.summary.id.startsWith('luma-')) {
        room.summary.ownerId = target.userId;
        room.summary.ownerName = target.displayName;
        updateRoomOwner(room.summary.id, target.userId, target.displayName).catch(console.error);
      }
      updatedPlayers.push(actor, target);
    }

    return { room, target, seatsChanged, updatedPlayers };
  }

  handleAdminAction(
    socketId: string,
    action: AdminActionType,
    rawMessage?: string,
  ):
    | {
        ok: true;
        room: ActiveRoom;
        updatedPlayers?: PlayerState[];
        seatsChanged?: boolean;
        videoChanged?: boolean;
        chatCleared?: boolean;
        customChanged?: boolean;
        noticeMessage?: string;
      }
    | { ok: false; error: string } {
    const room = this.getRoomBySocket(socketId);
    if (!room) return { ok: false, error: 'Odada değilsiniz.' };
    const actor = room.players.get(socketId);
    if (!actor || (actor.role !== 'owner' && actor.role !== 'moderator')) {
      return { ok: false, error: 'Bu işlem için yönetici (Admin) yetkisi gereklidir.' };
    }

    const updatedPlayers: PlayerState[] = [];
    let seatsChanged = false;
    let videoChanged = false;
    let chatCleared = false;
    let customChanged = false;
    let noticeMessage: string | undefined;

    if (action === 'mute_all_voice') {
      for (const p of room.players.values()) {
        if (p.role === 'member') {
          room.mutedVoiceUserIds.add(p.userId);
          p.mutedByMod = true;
          p.micEnabled = false;
          p.isSpeaking = false;
          p.audioLevel = 0;
          updatedPlayers.push(p);
        }
      }
      noticeMessage = 'Yönetici tüm üyelerin mikrofonlarını kapattı.';
    } else if (action === 'unmute_all_voice') {
      room.mutedVoiceUserIds.clear();
      for (const p of room.players.values()) {
        if (p.mutedByMod) {
          p.mutedByMod = false;
          updatedPlayers.push(p);
        }
      }
      noticeMessage = 'Tüm mikrofon kilitleri kaldırıldı.';
    } else if (action === 'clear_chat') {
      room.chatHistory = [];
      chatCleared = true;
      noticeMessage = 'Sohbet geçmişi yönetici tarafından temizlendi.';
    } else if (action === 'eject_all_seats') {
      for (const s of room.seats) {
        if (s.occupiedBy) {
          s.occupiedBy = null;
          s.occupiedByName = null;
          seatsChanged = true;
        }
      }
      for (const p of room.players.values()) {
        if (p.seatedSeatId) {
          p.seatedSeatId = null;
          p.animState = 'idle';
          updatedPlayers.push(p);
        }
      }
      noticeMessage = 'Yönetici tüm koltukları boşalttı.';
    } else if (action === 'allow_all_video') {
      room.video.hostOnlyControl = false;
      room.videoDeniedUserIds.clear();
      videoChanged = true;
      for (const p of room.players.values()) {
        p.canControlVideo = true;
        updatedPlayers.push(p);
      }
      noticeMessage = 'Herkes video açıp kontrol edebilir.';
    } else if (action === 'deny_all_video') {
      room.video.hostOnlyControl = true;
      room.videoAllowedUserIds.clear();
      videoChanged = true;
      for (const p of room.players.values()) {
        p.canControlVideo = this.canPlayerControlVideo(room, p.role, p.userId);
        updatedPlayers.push(p);
      }
      noticeMessage = 'Video kontrolü yalnızca Admin/Host yetkisine alındı.';
    } else if (action === 'lock_chat' || action === 'unlock_chat') {
      room.customization.chatLocked = action === 'lock_chat';
      customChanged = true;
      saveRoomCustomization(room.summary.id, room.customization).catch(console.error);
      noticeMessage =
        action === 'lock_chat'
          ? 'Sohbet yalnızca yöneticilere açık olacak şekilde kilitlendi.'
          : 'Sohbet herkese açıldı.';
    } else if (action === 'reset_video') {
      room.video = {
        ...room.video,
        sourceType: null,
        url: null,
        youtubeId: null,
        title: 'İçerik Seçilmedi',
        channelLogo: null,
        isLive: false,
        isPlaying: false,
        currentTime: 0,
        playbackRate: 1,
        updatedAt: Date.now(),
        updatedBy: actor.displayName,
      };
      room.summary.currentlyPlaying = null;
      videoChanged = true;
      noticeMessage = 'Perde yönetici tarafından temizlendi.';
    } else if (action === 'announce') {
      const clean = sanitizeText(rawMessage || '', 180);
      if (!clean) return { ok: false, error: 'Duyuru metni boş olamaz.' };
      noticeMessage = `📢 ${actor.displayName}: ${clean}`;
    }

    return {
      ok: true,
      room,
      updatedPlayers,
      seatsChanged,
      videoChanged,
      chatCleared,
      customChanged,
      noticeMessage,
    };
  }

  handleGameAction(
    socketId: string,
    payload: GameActionPayload,
  ):
    | {
        ok: true;
        room: ActiveRoom;
        games: RoomGamesState;
        handUpdates: Array<{ playerId: string; cards: UnoCard[] }>;
      }
    | { ok: false; error: string } {
    const room = this.getRoomBySocket(socketId);
    if (!room) return { ok: false, error: 'Odada değilsiniz.' };
    const actor = room.players.get(socketId);
    if (!actor) return { ok: false, error: 'Oyuncu bulunamadı.' };

    const res = applyGameAction(room.games, actor, payload);
    if (!res.ok) return res;

    const handUpdates: Array<{ playerId: string; cards: UnoCard[] }> = [];
    if (res.handPlayerIds) {
      for (const pid of res.handPlayerIds) {
        handUpdates.push({
          playerId: pid,
          cards: [...(room.games.unoHands.get(pid) || [])],
        });
      }
    }

    return {
      ok: true,
      room,
      games: room.games.publicState,
      handUpdates,
    };
  }

  buildSnapshot(room: ActiveRoom): RoomStateSnapshot {
    return {
      room: {
        ...room.summary,
        onlineCount: room.players.size,
        currentlyPlaying: room.video.url ? room.video.title : null,
      },
      customization: room.customization,
      players: Array.from(room.players.values()),
      seats: room.seats,
      video: this.cloneEffectiveVideo(room.video),
      screenShare: room.screenShare,
      queue: room.queue,
      chatHistory: room.chatHistory,
      mutedChatUserIds: Array.from(room.mutedChatUserIds),
      games: room.games.publicState,
      serverTime: Date.now(),
    };
  }

  getEffectiveVideoTime(video: VideoState, now: number = Date.now()): number {
    if (!video.isPlaying || video.isLive) return video.currentTime;
    const elapsedSec = Math.max(0, (now - video.updatedAt) / 1000);
    return video.currentTime + elapsedSec * video.playbackRate;
  }

  private cloneEffectiveVideo(video: VideoState): VideoState {
    const now = Date.now();
    return {
      ...video,
      currentTime: this.getEffectiveVideoTime(video, now),
      updatedAt: now,
    };
  }

  private releasePlayerSeat(room: ActiveRoom, socketId: string): boolean {
    let changed = false;
    for (const seat of room.seats) {
      if (seat.occupiedBy === socketId) {
        seat.occupiedBy = null;
        seat.occupiedByName = null;
        changed = true;
      }
    }
    return changed;
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
