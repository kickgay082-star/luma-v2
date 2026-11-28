import crypto from 'node:crypto';
import {
  ChessGameState,
  GameActionPayload,
  MonopolyGameState,
  MonopolySpace,
  PlayerState,
  RoomGamesState,
  UnoCard,
  UnoColor,
  UnoGameState,
} from '@luma/shared';

export interface ServerRoomGames {
  publicState: RoomGamesState;
  unoDeck: UnoCard[];
  unoDiscard: UnoCard[];
  unoHands: Map<string, UnoCard[]>;
  monopolyRolledThisTurn: boolean;
}

const CHESS_INITIAL_BOARD: (string | null)[] = [
  'bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR',
  'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP',
  null, null, null, null, null, null, null, null,
  null, null, null, null, null, null, null, null,
  null, null, null, null, null, null, null, null,
  null, null, null, null, null, null, null, null,
  'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP',
  'wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR',
];

const MONOPOLY_INITIAL_BOARD: MonopolySpace[] = [
  { index: 0, name: 'Başlangıç (+200M)', kind: 'go' },
  { index: 1, name: 'Kadıköy', kind: 'prop', color: '#8B5CF6', price: 120, rent: 24, ownerId: null, ownerName: null, houses: 0 },
  { index: 2, name: 'Beşiktaş', kind: 'prop', color: '#8B5CF6', price: 140, rent: 28, ownerId: null, ownerName: null, houses: 0 },
  { index: 3, name: 'Şans Kartı', kind: 'chance' },
  { index: 4, name: 'Taksim', kind: 'prop', color: '#0EA5E9', price: 180, rent: 36, ownerId: null, ownerName: null, houses: 0 },
  { index: 5, name: 'Gelir Vergisi (-150M)', kind: 'tax' },
  { index: 6, name: 'Moda Sahil', kind: 'prop', color: '#0EA5E9', price: 200, rent: 42, ownerId: null, ownerName: null, houses: 0 },
  { index: 7, name: 'Bebek', kind: 'prop', color: '#EC4899', price: 240, rent: 50, ownerId: null, ownerName: null, houses: 0 },
  { index: 8, name: 'Dinlenme Molası', kind: 'jail' },
  { index: 9, name: 'Etiler', kind: 'prop', color: '#F97316', price: 280, rent: 60, ownerId: null, ownerName: null, houses: 0 },
  { index: 10, name: 'Levent Plaza', kind: 'prop', color: '#F97316', price: 300, rent: 65, ownerId: null, ownerName: null, houses: 0 },
  { index: 11, name: 'Şans Kartı', kind: 'chance' },
  { index: 12, name: 'İstinye Park', kind: 'prop', color: '#10B981', price: 340, rent: 75, ownerId: null, ownerName: null, houses: 0 },
  { index: 13, name: 'Nişantaşı', kind: 'prop', color: '#10B981', price: 380, rent: 85, ownerId: null, ownerName: null, houses: 0 },
  { index: 14, name: 'Lüks Vergisi (-200M)', kind: 'tax' },
  { index: 15, name: 'Boğaz Yalısı', kind: 'prop', color: '#F59E0B', price: 450, rent: 110, ownerId: null, ownerName: null, houses: 0 },
];

const PLAYER_TOKENS = ['#7C5CFF', '#38BDF8', '#F59E0B', '#EC4899', '#10B981', '#EF4444'];

function makeChessState(): ChessGameState {
  return {
    board: [...CHESS_INITIAL_BOARD],
    turn: 'w',
    whiteId: null,
    whiteName: null,
    blackId: null,
    blackName: null,
    status: 'waiting',
    winner: null,
    lastMove: null,
    capturedW: [],
    capturedB: [],
  };
}

function makeUnoState(): UnoGameState {
  return {
    status: 'lobby',
    players: [],
    turnIndex: 0,
    direction: 1,
    topCard: null,
    activeColor: 'red',
    deckCount: 0,
    winnerName: null,
    lastEvent: 'Oyuncular katıldığında oyunu başlatın.',
  };
}

function makeMonopolyState(): MonopolyGameState {
  return {
    status: 'lobby',
    players: [],
    turnIndex: 0,
    lastDice: null,
    board: MONOPOLY_INITIAL_BOARD.map((s) => ({ ...s })),
    winnerName: null,
    lastEvent: 'Oyuncular katıldığında oyunu başlatın.',
  };
}

export function createInitialRoomGames(): ServerRoomGames {
  return {
    publicState: {
      chess: makeChessState(),
      uno: makeUnoState(),
      monopoly: makeMonopolyState(),
    },
    unoDeck: [],
    unoDiscard: [],
    unoHands: new Map(),
    monopolyRolledThisTurn: false,
  };
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildUnoDeck(): UnoCard[] {
  const colors: Array<Exclude<UnoColor, 'wild'>> = ['red', 'blue', 'green', 'yellow'];
  const cards: UnoCard[] = [];
  for (const color of colors) {
    cards.push({ id: crypto.randomUUID(), color, value: '0' });
    for (const val of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2']) {
      cards.push({ id: crypto.randomUUID(), color, value: val });
      cards.push({ id: crypto.randomUUID(), color, value: val });
    }
  }
  for (let i = 0; i < 4; i++) {
    cards.push({ id: crypto.randomUUID(), color: 'wild', value: 'wild' });
    cards.push({ id: crypto.randomUUID(), color: 'wild', value: 'wild4' });
  }
  return shuffle(cards);
}

function isLegalChessMove(board: (string | null)[], from: number, to: number, side: 'w' | 'b'): boolean {
  if (from < 0 || from > 63 || to < 0 || to > 63 || from === to) return false;
  const piece = board[from];
  if (!piece || piece[0] !== side) return false;
  const target = board[to];
  if (target && target[0] === side) return false;

  const r1 = Math.floor(from / 8);
  const c1 = from % 8;
  const r2 = Math.floor(to / 8);
  const c2 = to % 8;
  const dr = r2 - r1;
  const dc = c2 - c1;
  const adr = Math.abs(dr);
  const adc = Math.abs(dc);
  const type = piece[1];

  const pathClear = () => {
    const stepR = dr === 0 ? 0 : dr > 0 ? 1 : -1;
    const stepC = dc === 0 ? 0 : dc > 0 ? 1 : -1;
    let cr = r1 + stepR;
    let cc = c1 + stepC;
    while (cr !== r2 || cc !== c2) {
      if (board[cr * 8 + cc]) return false;
      cr += stepR;
      cc += stepC;
    }
    return true;
  };

  if (type === 'P') {
    const dir = side === 'w' ? -1 : 1;
    const startRow = side === 'w' ? 6 : 1;
    if (dc === 0 && dr === dir && !target) return true;
    if (dc === 0 && r1 === startRow && dr === 2 * dir && !target && !board[(r1 + dir) * 8 + c1]) {
      return true;
    }
    if (adc === 1 && dr === dir && Boolean(target)) return true;
    return false;
  }
  if (type === 'N') return (adr === 2 && adc === 1) || (adr === 1 && adc === 2);
  if (type === 'B') return adr === adc && pathClear();
  if (type === 'R') return (dr === 0 || dc === 0) && pathClear();
  if (type === 'Q') return (adr === adc || dr === 0 || dc === 0) && pathClear();
  if (type === 'K') return adr <= 1 && adc <= 1;
  return false;
}

function drawUnoCards(games: ServerRoomGames, count: number): UnoCard[] {
  const out: UnoCard[] = [];
  for (let i = 0; i < count; i++) {
    if (games.unoDeck.length === 0 && games.unoDiscard.length > 1) {
      const top = games.unoDiscard.pop()!;
      games.unoDeck = shuffle(games.unoDiscard);
      games.unoDiscard = [top];
    }
    const card = games.unoDeck.pop();
    if (card) out.push(card);
  }
  return out;
}

export function applyGameAction(
  games: ServerRoomGames,
  actor: PlayerState,
  payload: GameActionPayload,
): { ok: true; handPlayerIds?: string[] } | { ok: false; error: string } {
  if (payload.game === 'chess') {
    const c = games.publicState.chess;
    if (payload.op === 'reset') {
      games.publicState.chess = makeChessState();
      return { ok: true };
    }
    if (payload.op === 'join') {
      const side = payload.side || (!c.whiteId ? 'w' : 'b');
      if (side === 'w') {
        if (c.whiteId && c.whiteId !== actor.id) return { ok: false, error: 'Beyaz taş koltuğu dolu.' };
        if (c.blackId === actor.id) {
          c.blackId = null;
          c.blackName = null;
        }
        c.whiteId = actor.id;
        c.whiteName = actor.displayName;
      } else {
        if (c.blackId && c.blackId !== actor.id) return { ok: false, error: 'Siyah taş koltuğu dolu.' };
        if (c.whiteId === actor.id) {
          c.whiteId = null;
          c.whiteName = null;
        }
        c.blackId = actor.id;
        c.blackName = actor.displayName;
      }
      if (c.whiteId && c.blackId && c.status === 'waiting') c.status = 'playing';
      return { ok: true };
    }
    if (payload.op === 'leave') {
      if (c.whiteId === actor.id) {
        c.whiteId = null;
        c.whiteName = null;
      }
      if (c.blackId === actor.id) {
        c.blackId = null;
        c.blackName = null;
      }
      return { ok: true };
    }
    if (payload.op === 'move') {
      if (c.status === 'finished') return { ok: false, error: 'Oyun bitti, sıfırlayın.' };
      if (typeof payload.from !== 'number' || typeof payload.to !== 'number') {
        return { ok: false, error: 'Geçersiz hamle.' };
      }
      const actorSide = c.whiteId === actor.id ? 'w' : c.blackId === actor.id ? 'b' : null;
      if (!actorSide) return { ok: false, error: 'Önce Beyaz veya Siyah tarafa oturun.' };
      if (actorSide !== c.turn) return { ok: false, error: 'Sıra rakipte.' };
      if (!isLegalChessMove(c.board, payload.from, payload.to, actorSide)) {
        return { ok: false, error: 'Kurallara aykırı satranç hamlesi.' };
      }
      const moving = c.board[payload.from]!;
      const captured = c.board[payload.to];
      if (captured) {
        if (captured[0] === 'w') c.capturedW.push(captured);
        else c.capturedB.push(captured);
      }
      c.board[payload.to] = moving;
      c.board[payload.from] = null;

      // Auto-promote pawn to queen
      const rowTo = Math.floor(payload.to / 8);
      if (moving === 'wP' && rowTo === 0) c.board[payload.to] = 'wQ';
      if (moving === 'bP' && rowTo === 7) c.board[payload.to] = 'bQ';

      const files = 'abcdefgh';
      c.lastMove = `${files[payload.from % 8]}${8 - Math.floor(payload.from / 8)} → ${files[payload.to % 8]}${8 - rowTo}`;
      if (captured?.[1] === 'K') {
        c.status = 'finished';
        c.winner = actor.displayName;
      } else {
        c.status = 'playing';
        c.turn = c.turn === 'w' ? 'b' : 'w';
      }
      return { ok: true };
    }
  }

  if (payload.game === 'uno') {
    const u = games.publicState.uno;
    if (payload.op === 'reset') {
      games.publicState.uno = makeUnoState();
      games.unoDeck = [];
      games.unoDiscard = [];
      games.unoHands.clear();
      return { ok: true, handPlayerIds: Array.from(games.unoHands.keys()) };
    }
    if (payload.op === 'join') {
      if (u.status === 'playing') return { ok: false, error: 'UNO oyunu devam ediyor.' };
      if (u.players.some((p) => p.playerId === actor.id)) return { ok: true };
      if (u.players.length >= 6) return { ok: false, error: 'Masa dolu (en fazla 6 kişi).' };
      u.players.push({
        playerId: actor.id,
        displayName: actor.displayName,
        cardCount: 0,
        calledUno: false,
      });
      u.lastEvent = `${actor.displayName} UNO masasına katıldı.`;
      return { ok: true };
    }
    if (payload.op === 'leave') {
      const idx = u.players.findIndex((p) => p.playerId === actor.id);
      if (idx === -1) return { ok: true };
      u.players.splice(idx, 1);
      games.unoHands.delete(actor.id);
      if (u.players.length < 2 && u.status === 'playing') {
        u.status = 'lobby';
        u.lastEvent = 'Yeterli oyuncu kalmadığı için oyun lobiye döndü.';
      } else if (u.players.length > 0) {
        u.turnIndex = u.turnIndex % u.players.length;
      }
      return { ok: true };
    }
    if (payload.op === 'start') {
      if (u.players.length < 2) return { ok: false, error: 'UNO başlatmak için en az 2 oyuncu gerekir.' };
      games.unoDeck = buildUnoDeck();
      games.unoHands.clear();
      for (const p of u.players) {
        const hand = drawUnoCards(games, 7);
        games.unoHands.set(p.playerId, hand);
        p.cardCount = hand.length;
        p.calledUno = false;
      }
      let starter = drawUnoCards(games, 1)[0];
      while (starter && starter.color === 'wild') {
        games.unoDeck.unshift(starter);
        games.unoDeck = shuffle(games.unoDeck);
        starter = drawUnoCards(games, 1)[0];
      }
      games.unoDiscard = starter ? [starter] : [];
      u.topCard = starter || null;
      u.activeColor = starter && starter.color !== 'wild' ? starter.color : 'red';
      u.turnIndex = 0;
      u.direction = 1;
      u.status = 'playing';
      u.winnerName = null;
      u.deckCount = games.unoDeck.length;
      u.lastEvent = `UNO başladı! İlk sıra: ${u.players[0].displayName}`;
      return { ok: true, handPlayerIds: u.players.map((p) => p.playerId) };
    }
    if (payload.op === 'uno') {
      const p = u.players.find((pl) => pl.playerId === actor.id);
      if (!p) return { ok: false, error: 'Masada değilsiniz.' };
      p.calledUno = true;
      u.lastEvent = `🔥 ${actor.displayName} UNO dedi!`;
      return { ok: true };
    }
    if (payload.op === 'draw') {
      if (u.status !== 'playing') return { ok: false, error: 'Oyun başlamadı.' };
      const curr = u.players[u.turnIndex];
      if (!curr || curr.playerId !== actor.id) return { ok: false, error: 'Sıra sizde değil.' };
      const hand = games.unoHands.get(actor.id) || [];
      const drawn = drawUnoCards(games, 1);
      hand.push(...drawn);
      games.unoHands.set(actor.id, hand);
      curr.cardCount = hand.length;
      curr.calledUno = false;
      u.turnIndex = (u.turnIndex + u.direction + u.players.length) % u.players.length;
      u.deckCount = games.unoDeck.length;
      u.lastEvent = `${actor.displayName} 1 kart çekti.`;
      return { ok: true, handPlayerIds: [actor.id] };
    }
    if (payload.op === 'play') {
      if (u.status !== 'playing') return { ok: false, error: 'Oyun başlamadı.' };
      const curr = u.players[u.turnIndex];
      if (!curr || curr.playerId !== actor.id) return { ok: false, error: 'Sıra sizde değil.' };
      const hand = games.unoHands.get(actor.id) || [];
      const cardIdx = hand.findIndex((c) => c.id === payload.cardId);
      if (cardIdx === -1) return { ok: false, error: 'Kart elinizde değil.' };
      const card = hand[cardIdx];
      const top = u.topCard;
      const matches =
        card.color === 'wild' ||
        card.color === u.activeColor ||
        (top && card.value === top.value);
      if (!matches) return { ok: false, error: 'Bu kart üstteki kartla uyuşmuyor.' };

      hand.splice(cardIdx, 1);
      games.unoHands.set(actor.id, hand);
      curr.cardCount = hand.length;
      games.unoDiscard.push(card);
      u.topCard = card;
      u.activeColor =
        card.color === 'wild' ? payload.chosenColor || 'red' : card.color;

      if (hand.length === 0) {
        u.status = 'finished';
        u.winnerName = actor.displayName;
        u.lastEvent = `🏆 ${actor.displayName} UNO oyununu kazandı!`;
        return { ok: true, handPlayerIds: [actor.id] };
      }

      let step = 1;
      const changedHands: string[] = [actor.id];
      if (card.value === 'reverse') {
        if (u.players.length === 2) step = 2;
        else u.direction = u.direction === 1 ? -1 : 1;
      } else if (card.value === 'skip') {
        step = 2;
      } else if (card.value === 'draw2' || card.value === 'wild4') {
        const victimIdx = (u.turnIndex + u.direction + u.players.length) % u.players.length;
        const victim = u.players[victimIdx];
        const count = card.value === 'wild4' ? 4 : 2;
        const victimHand = games.unoHands.get(victim.playerId) || [];
        victimHand.push(...drawUnoCards(games, count));
        games.unoHands.set(victim.playerId, victimHand);
        victim.cardCount = victimHand.length;
        victim.calledUno = false;
        changedHands.push(victim.playerId);
        step = 2;
      }

      u.turnIndex =
        (((u.turnIndex + step * u.direction) % u.players.length) + u.players.length) %
        u.players.length;
      u.deckCount = games.unoDeck.length;
      u.lastEvent = `${actor.displayName} ${card.color === 'wild' ? u.activeColor : card.color} ${card.value} oynadı.`;
      return { ok: true, handPlayerIds: changedHands };
    }
  }

  if (payload.game === 'monopoly') {
    const m = games.publicState.monopoly;
    if (payload.op === 'reset') {
      games.publicState.monopoly = makeMonopolyState();
      games.monopolyRolledThisTurn = false;
      return { ok: true };
    }
    if (payload.op === 'join') {
      if (m.status === 'playing') return { ok: false, error: 'Monopoly devam ediyor.' };
      if (m.players.some((p) => p.playerId === actor.id)) return { ok: true };
      if (m.players.length >= 4) return { ok: false, error: 'Monopoly en fazla 4 kişiliktir.' };
      m.players.push({
        playerId: actor.id,
        displayName: actor.displayName,
        cash: 1500,
        position: 0,
        color: PLAYER_TOKENS[m.players.length % PLAYER_TOKENS.length],
        bankrupt: false,
      });
      m.lastEvent = `${actor.displayName} Monopoly masasına oturdu.`;
      return { ok: true };
    }
    if (payload.op === 'leave') {
      const idx = m.players.findIndex((p) => p.playerId === actor.id);
      if (idx === -1) return { ok: true };
      m.players.splice(idx, 1);
      for (const sp of m.board) {
        if (sp.ownerId === actor.id) {
          sp.ownerId = null;
          sp.ownerName = null;
          sp.houses = 0;
        }
      }
      if (m.players.length < 2 && m.status === 'playing') {
        m.status = 'lobby';
      } else if (m.players.length > 0) {
        m.turnIndex = m.turnIndex % m.players.length;
      }
      return { ok: true };
    }
    if (payload.op === 'start') {
      if (m.players.length < 2) return { ok: false, error: 'Başlatmak için en az 2 oyuncu gerekir.' };
      m.status = 'playing';
      m.turnIndex = 0;
      games.monopolyRolledThisTurn = false;
      m.lastEvent = `Monopoly başladı! İlk zar: ${m.players[0].displayName}`;
      return { ok: true };
    }
    const curr = m.players[m.turnIndex];
    if (!curr || curr.playerId !== actor.id || m.status !== 'playing') {
      return { ok: false, error: 'Şu an sizin sıranız değil.' };
    }
    if (payload.op === 'roll') {
      if (games.monopolyRolledThisTurn) return { ok: false, error: 'Bu tur zar zaten atıldı.' };
      const d1 = 1 + Math.floor(Math.random() * 6);
      const d2 = 1 + Math.floor(Math.random() * 6);
      m.lastDice = [d1, d2];
      games.monopolyRolledThisTurn = true;
      const oldPos = curr.position;
      curr.position = (oldPos + d1 + d2) % m.board.length;
      let msg = `${curr.displayName} [${d1}+${d2}] attı`;
      if (curr.position < oldPos) {
        curr.cash += 200;
        msg += ' (+200M Başlangıç)';
      }
      const space = m.board[curr.position];
      msg += ` → ${space.name}`;
      if (space.kind === 'tax') {
        const fee = curr.position === 5 ? 150 : 200;
        curr.cash -= fee;
        msg += ` (-${fee}M vergi)`;
      } else if (space.kind === 'chance') {
        const bonus = Math.random() > 0.45 ? 150 : -100;
        curr.cash += bonus;
        msg += bonus > 0 ? ` (Şans +${bonus}M)` : ` (Şans ${bonus}M)`;
      } else if (space.kind === 'prop' && space.ownerId && space.ownerId !== curr.playerId) {
        const rent = (space.rent || 30) * (1 + (space.houses || 0));
        curr.cash -= rent;
        const owner = m.players.find((o) => o.playerId === space.ownerId);
        if (owner) owner.cash += rent;
        msg += ` (${space.ownerName} kira: -${rent}M)`;
      }

      if (curr.cash < 0) {
        curr.bankrupt = true;
        for (const sp of m.board) {
          if (sp.ownerId === curr.playerId) {
            sp.ownerId = null;
            sp.ownerName = null;
            sp.houses = 0;
          }
        }
        msg += ` — İFLAS ETTİ!`;
        const alive = m.players.filter((p) => !p.bankrupt);
        if (alive.length <= 1) {
          m.status = 'finished';
          m.winnerName = alive[0]?.displayName || 'Kazanan';
          msg = `🏆 ${m.winnerName} Monopoly oyununu kazandı!`;
        }
      }
      m.lastEvent = msg;
      return { ok: true };
    }
    if (payload.op === 'buy') {
      const sp = m.board[curr.position];
      if (!sp || sp.kind !== 'prop' || sp.ownerId) {
        return { ok: false, error: 'Bu kare satın alınamaz.' };
      }
      if (curr.cash < (sp.price || 0)) return { ok: false, error: 'Yeterli bakiye yok.' };
      curr.cash -= sp.price || 0;
      sp.ownerId = curr.playerId;
      sp.ownerName = curr.displayName;
      m.lastEvent = `${curr.displayName}, ${sp.name} mülkünü ${sp.price}M karşılığında satın aldı!`;
      return { ok: true };
    }
    if (payload.op === 'build') {
      const sp = m.board[curr.position];
      if (!sp || sp.kind !== 'prop' || sp.ownerId !== curr.playerId) {
        return { ok: false, error: 'Buraya ev kuramazsınız.' };
      }
      if ((sp.houses || 0) >= 3) return { ok: false, error: 'En fazla 3 ev kurulabilir.' };
      if (curr.cash < 50) return { ok: false, error: 'Ev kurmak için 50M gerekir.' };
      curr.cash -= 50;
      sp.houses = (sp.houses || 0) + 1;
      m.lastEvent = `${curr.displayName}, ${sp.name} üzerine ${sp.houses}. evi kurdu!`;
      return { ok: true };
    }
    if (payload.op === 'end_turn') {
      games.monopolyRolledThisTurn = false;
      for (let step = 1; step <= m.players.length; step++) {
        const nextIdx = (m.turnIndex + step) % m.players.length;
        if (!m.players[nextIdx].bankrupt) {
          m.turnIndex = nextIdx;
          break;
        }
      }
      m.lastEvent = `Sıra ${m.players[m.turnIndex]?.displayName} oyuncusunda.`;
      return { ok: true };
    }
  }

  return { ok: false, error: 'Desteklenmeyen oyun komutu.' };
}
