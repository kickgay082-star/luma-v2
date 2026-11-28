'use client';

import { useEffect, useState } from 'react';
import {
  BoardGameId,
  GameActionPayload,
  RoomGamesState,
  UnoCard,
} from '@luma/shared';
import { Crown, Dices, RotateCcw, Sparkles, Users, X } from 'lucide-react';

interface BoardGamesModalProps {
  open: boolean;
  initialGame: BoardGameId;
  games: RoomGamesState | null;
  unoHand: UnoCard[];
  localPlayerId: string | null;
  onClose: () => void;
  onAction: (payload: GameActionPayload) => void;
}

const CHESS_GLYPHS: Record<string, string> = {
  wK: '♔',
  wQ: '♕',
  wR: '♖',
  wB: '♗',
  wN: '♘',
  wP: '♙',
  bK: '♚',
  bQ: '♛',
  bR: '♜',
  bB: '♝',
  bN: '♞',
  bP: '♟',
};

const UNO_BG: Record<string, string> = {
  red: 'bg-red-600 border-red-400',
  blue: 'bg-blue-600 border-blue-400',
  green: 'bg-emerald-600 border-emerald-400',
  yellow: 'bg-amber-500 border-amber-300 text-black',
  wild: 'bg-gradient-to-br from-red-500 via-purple-600 to-blue-600 border-white/60',
};

function formatUnoVal(v: string): string {
  if (v === 'skip') return '⊘';
  if (v === 'reverse') return '⇄';
  if (v === 'draw2') return '+2';
  if (v === 'wild') return '★';
  if (v === 'wild4') return '+4';
  return v;
}

export function BoardGamesModal({
  open,
  initialGame,
  games,
  unoHand,
  localPlayerId,
  onClose,
  onAction,
}: BoardGamesModalProps) {
  const [tab, setTab] = useState<BoardGameId>(initialGame);
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null);
  const [wildPickerCardId, setWildPickerCardId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTab(initialGame);
      setSelectedSquare(null);
      setWildPickerCardId(null);
    }
  }, [initialGame, open]);

  if (!open || !games) return null;

  const activeTab = tab;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-5">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0D0F17] shadow-2xl">
        {/* Header & Game Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] bg-[#10131E] px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#A78BFA]" />
            <span className="text-sm font-semibold text-white">Arka Oyun Salonu</span>
          </div>

          <div className="flex gap-1 rounded-xl border border-white/10 bg-[#090A0F] p-1">
            {[
              { id: 'chess' as const, label: '♟️ Satranç' },
              { id: 'uno' as const, label: '🃏 UNO' },
              { id: 'monopoly' as const, label: '🎲 Monopoly' },
            ].map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setTab(g.id);
                  setSelectedSquare(null);
                  setWildPickerCardId(null);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === g.id
                    ? 'bg-[#7C5CFF] text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Game Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {activeTab === 'chess' && (
            <ChessPanel
              chess={games.chess}
              localPlayerId={localPlayerId}
              selectedSquare={selectedSquare}
              onSelectSquare={setSelectedSquare}
              onAction={onAction}
            />
          )}

          {activeTab === 'uno' && (
            <UnoPanel
              uno={games.uno}
              hand={unoHand}
              localPlayerId={localPlayerId}
              wildPickerCardId={wildPickerCardId}
              onSetWildPicker={setWildPickerCardId}
              onAction={onAction}
            />
          )}

          {activeTab === 'monopoly' && (
            <MonopolyPanel
              monopoly={games.monopoly}
              localPlayerId={localPlayerId}
              onAction={onAction}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ChessPanel({
  chess,
  localPlayerId,
  selectedSquare,
  onSelectSquare,
  onAction,
}: {
  chess: RoomGamesState['chess'];
  localPlayerId: string | null;
  selectedSquare: number | null;
  onSelectSquare: (idx: number | null) => void;
  onAction: (payload: GameActionPayload) => void;
}) {
  const mySide =
    chess.whiteId === localPlayerId ? 'w' : chess.blackId === localPlayerId ? 'b' : null;

  const handleSquareClick = (idx: number) => {
    if (!mySide || chess.status === 'finished') return;
    const piece = chess.board[idx];
    if (selectedSquare === null) {
      if (piece && piece[0] === mySide && chess.turn === mySide) {
        onSelectSquare(idx);
      }
      return;
    }
    if (selectedSquare === idx) {
      onSelectSquare(null);
      return;
    }
    if (piece && piece[0] === mySide) {
      onSelectSquare(idx);
      return;
    }
    onAction({ game: 'chess', op: 'move', from: selectedSquare, to: idx });
    onSelectSquare(null);
  };

  return (
    <div className="grid gap-5 md:grid-cols-12">
      <div className="flex justify-center md:col-span-7">
        <div className="grid aspect-square w-full max-w-[400px] grid-cols-8 overflow-hidden rounded-xl border-4 border-[#3F2E21] shadow-2xl">
          {chess.board.map((piece, idx) => {
            const r = Math.floor(idx / 8);
            const c = idx % 8;
            const dark = (r + c) % 2 === 1;
            const isSel = selectedSquare === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSquareClick(idx)}
                className={`flex items-center justify-center text-2xl sm:text-3xl transition ${
                  isSel
                    ? 'bg-amber-400 text-black'
                    : dark
                      ? 'bg-[#6B4A35] hover:bg-[#7A563E]'
                      : 'bg-[#EAD9C4] hover:bg-[#F5E6D3]'
                }`}
              >
                <span className={piece?.startsWith('w') ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]' : 'text-zinc-950'}>
                  {piece ? CHESS_GLYPHS[piece] || piece : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 md:col-span-5">
        <div className="rounded-xl border border-white/10 bg-[#090A0F] p-3.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">Durum</span>
            <span className="rounded-full bg-[#7C5CFF]/20 px-2.5 py-0.5 text-[11px] font-medium text-[#C4B5FD]">
              {chess.status === 'finished'
                ? `Kazanan: ${chess.winner}`
                : chess.turn === 'w'
                  ? 'Sıra: Beyaz'
                  : 'Sıra: Siyah'}
            </span>
          </div>
          {chess.lastMove && (
            <p className="mt-1.5 font-mono text-[11px] text-zinc-400">
              Son Hamle: {chess.lastMove}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => onAction({ game: 'chess', op: 'join', side: 'w' })}
            className={`rounded-xl border p-3 text-left ${
              mySide === 'w'
                ? 'border-emerald-400 bg-emerald-500/15'
                : 'border-white/10 bg-[#090A0F] hover:border-white/25'
            }`}
          >
            <p className="font-semibold text-white">♔ Beyaz</p>
            <p className="mt-0.5 truncate text-[11px] text-zinc-400">
              {chess.whiteName || 'Boş — Otur'}
            </p>
          </button>
          <button
            type="button"
            onClick={() => onAction({ game: 'chess', op: 'join', side: 'b' })}
            className={`rounded-xl border p-3 text-left ${
              mySide === 'b'
                ? 'border-emerald-400 bg-emerald-500/15'
                : 'border-white/10 bg-[#090A0F] hover:border-white/25'
            }`}
          >
            <p className="font-semibold text-white">♚ Siyah</p>
            <p className="mt-0.5 truncate text-[11px] text-zinc-400">
              {chess.blackName || 'Boş — Otur'}
            </p>
          </button>
        </div>

        <div className="flex gap-2">
          {mySide && (
            <button
              type="button"
              onClick={() => onAction({ game: 'chess', op: 'leave' })}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2 text-xs text-zinc-200 hover:bg-white/10"
            >
              Masadan Kalk
            </button>
          )}
          <button
            type="button"
            onClick={() => onAction({ game: 'chess', op: 'reset' })}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/15 py-2 text-xs font-medium text-amber-200 hover:bg-amber-500/25"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Yeniden Başlat
          </button>
        </div>
      </div>
    </div>
  );
}

function UnoPanel({
  uno,
  hand,
  localPlayerId,
  wildPickerCardId,
  onSetWildPicker,
  onAction,
}: {
  uno: RoomGamesState['uno'];
  hand: UnoCard[];
  localPlayerId: string | null;
  wildPickerCardId: string | null;
  onSetWildPicker: (id: string | null) => void;
  onAction: (payload: GameActionPayload) => void;
}) {
  const joined = uno.players.some((p) => p.playerId === localPlayerId);
  const currentTurn = uno.players[uno.turnIndex];
  const isMyTurn = Boolean(currentTurn && currentTurn.playerId === localPlayerId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#090A0F] p-3 text-xs">
        <div>
          <p className="font-semibold text-white">{uno.lastEvent}</p>
          {uno.winnerName && (
            <p className="mt-0.5 flex items-center gap-1 text-amber-300">
              <Crown className="h-3.5 w-3.5" /> Kazanan: {uno.winnerName}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {!joined && uno.status === 'lobby' && (
            <button
              type="button"
              onClick={() => onAction({ game: 'uno', op: 'join' })}
              className="rounded-lg bg-[#7C5CFF] px-3 py-1.5 font-semibold text-white"
            >
              Masaya Katıl
            </button>
          )}
          {joined && uno.status === 'lobby' && uno.players.length >= 2 && (
            <button
              type="button"
              onClick={() => onAction({ game: 'uno', op: 'start' })}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 font-semibold text-black"
            >
              Oyunu Başlat ({uno.players.length} Kişi)
            </button>
          )}
          {joined && (
            <button
              type="button"
              onClick={() => onAction({ game: 'uno', op: 'leave' })}
              className="rounded-lg border border-white/10 px-2.5 py-1.5 text-zinc-300"
            >
              Ayrıl
            </button>
          )}
          <button
            type="button"
            onClick={() => onAction({ game: 'uno', op: 'reset' })}
            className="rounded-lg border border-white/10 px-2.5 py-1.5 text-zinc-300"
          >
            Sıfırla
          </button>
        </div>
      </div>

      {/* Players & Center Pile */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 rounded-xl border border-white/10 bg-[#090A0F] p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
            <Users className="h-3.5 w-3.5" /> Masadaki Oyuncular ({uno.players.length}/6)
          </p>
          {uno.players.map((p, i) => (
            <div
              key={p.playerId}
              className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs ${
                uno.status === 'playing' && i === uno.turnIndex
                  ? 'border border-[#7C5CFF] bg-[#7C5CFF]/20 text-white'
                  : 'bg-white/[0.03] text-zinc-300'
              }`}
            >
              <span className="font-medium">
                {p.displayName} {p.calledUno ? '🔥 UNO!' : ''}
              </span>
              <span className="font-mono text-[11px]">{p.cardCount} kart</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-4 rounded-xl border border-white/10 bg-[#090A0F] p-4">
          {uno.topCard ? (
            <div className="flex items-center gap-4">
              <div
                className={`flex h-28 w-20 flex-col items-center justify-center rounded-xl border-2 font-bold text-white shadow-xl ${UNO_BG[uno.topCard.color]}`}
              >
                <span className="text-2xl">{formatUnoVal(uno.topCard.value)}</span>
              </div>
              <div className="space-y-2 text-xs">
                <p className="text-zinc-400">
                  Aktif Renk:{' '}
                  <span className="font-bold uppercase text-white">{uno.activeColor}</span>
                </p>
                <p className="text-zinc-400">Deste: {uno.deckCount} kart</p>
                {isMyTurn && (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => onAction({ game: 'uno', op: 'draw' })}
                      className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-black hover:bg-zinc-200"
                    >
                      Kart Çek
                    </button>
                    {hand.length <= 2 && (
                      <button
                        type="button"
                        onClick={() => onAction({ game: 'uno', op: 'uno' })}
                        className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-black"
                      >
                        UNO!
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">En az 2 kişi katıldığında oyunu başlatabilirsiniz.</p>
          )}
        </div>
      </div>

      {/* Color Picker for Wild Card */}
      {wildPickerCardId && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-[#141724] p-3 text-xs">
          <span className="font-medium text-white">Renk Seçin:</span>
          {(['red', 'blue', 'green', 'yellow'] as const).map((col) => (
            <button
              key={col}
              type="button"
              onClick={() => {
                onAction({ game: 'uno', op: 'play', cardId: wildPickerCardId, chosenColor: col });
                onSetWildPicker(null);
              }}
              className={`rounded-lg border px-3 py-1.5 font-bold uppercase text-white ${UNO_BG[col]}`}
            >
              {col}
            </button>
          ))}
        </div>
      )}

      {/* Local Player Hand */}
      {uno.status === 'playing' && joined && (
        <div>
          <p className="mb-2 text-xs font-semibold text-zinc-300">
            Elinizdeki Kartlar ({hand.length}) {isMyTurn ? '— SIRA SİZDE' : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            {hand.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={!isMyTurn}
                onClick={() => {
                  if (c.color === 'wild') {
                    onSetWildPicker(c.id);
                  } else {
                    onAction({ game: 'uno', op: 'play', cardId: c.id });
                  }
                }}
                className={`flex h-24 w-16 flex-col items-center justify-center rounded-xl border-2 text-xl font-bold text-white shadow transition hover:-translate-y-1 disabled:opacity-50 ${UNO_BG[c.color]}`}
              >
                <span>{formatUnoVal(c.value)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MonopolyPanel({
  monopoly,
  localPlayerId,
  onAction,
}: {
  monopoly: RoomGamesState['monopoly'];
  localPlayerId: string | null;
  onAction: (payload: GameActionPayload) => void;
}) {
  const joined = monopoly.players.some((p) => p.playerId === localPlayerId);
  const curr = monopoly.players[monopoly.turnIndex];
  const isMyTurn = Boolean(curr && curr.playerId === localPlayerId && monopoly.status === 'playing');
  const currSpace = curr ? monopoly.board[curr.position] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#090A0F] p-3 text-xs">
        <div>
          <p className="font-semibold text-white">{monopoly.lastEvent}</p>
          {monopoly.lastDice && (
            <p className="mt-0.5 font-mono text-[11px] text-emerald-300">
              Son Zar: [{monopoly.lastDice[0]}] + [{monopoly.lastDice[1]}]
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {!joined && monopoly.status === 'lobby' && (
            <button
              type="button"
              onClick={() => onAction({ game: 'monopoly', op: 'join' })}
              className="rounded-lg bg-[#7C5CFF] px-3 py-1.5 font-semibold text-white"
            >
              Masaya Katıl
            </button>
          )}
          {joined && monopoly.status === 'lobby' && monopoly.players.length >= 2 && (
            <button
              type="button"
              onClick={() => onAction({ game: 'monopoly', op: 'start' })}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 font-semibold text-black"
            >
              Başlat ({monopoly.players.length} Kişi)
            </button>
          )}
          {joined && (
            <button
              type="button"
              onClick={() => onAction({ game: 'monopoly', op: 'leave' })}
              className="rounded-lg border border-white/10 px-2.5 py-1.5 text-zinc-300"
            >
              Ayrıl
            </button>
          )}
          <button
            type="button"
            onClick={() => onAction({ game: 'monopoly', op: 'reset' })}
            className="rounded-lg border border-white/10 px-2.5 py-1.5 text-zinc-300"
          >
            Sıfırla
          </button>
        </div>
      </div>

      {/* Turn Controls */}
      {isMyTurn && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
          <span className="font-bold text-emerald-300">SIRA SİZDE:</span>
          <button
            type="button"
            onClick={() => onAction({ game: 'monopoly', op: 'roll' })}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 font-bold text-black hover:bg-emerald-400"
          >
            <Dices className="h-3.5 w-3.5" /> Zar At
          </button>
          {currSpace?.kind === 'prop' && !currSpace.ownerId && (
            <button
              type="button"
              onClick={() => onAction({ game: 'monopoly', op: 'buy' })}
              className="rounded-lg bg-amber-400 px-3 py-1.5 font-bold text-black hover:bg-amber-300"
            >
              Satın Al ({currSpace.price}M)
            </button>
          )}
          {currSpace?.kind === 'prop' && currSpace.ownerId === localPlayerId && (currSpace.houses || 0) < 3 && (
            <button
              type="button"
              onClick={() => onAction({ game: 'monopoly', op: 'build' })}
              className="rounded-lg bg-sky-500 px-3 py-1.5 font-bold text-black"
            >
              Ev Kur (50M)
            </button>
          )}
          <button
            type="button"
            onClick={() => onAction({ game: 'monopoly', op: 'end_turn' })}
            className="rounded-lg bg-white/15 px-3 py-1.5 font-medium text-white hover:bg-white/25"
          >
            Turu Bitir
          </button>
        </div>
      )}

      {/* Players Bar */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {monopoly.players.map((p, idx) => (
          <div
            key={p.playerId}
            className={`rounded-xl border p-2.5 text-xs ${
              monopoly.status === 'playing' && idx === monopoly.turnIndex
                ? 'border-emerald-400 bg-emerald-500/10'
                : 'border-white/10 bg-[#090A0F]'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="truncate font-semibold text-white">{p.displayName}</span>
            </div>
            <p className="mt-1 font-mono text-emerald-300">{p.bankrupt ? 'İFLAS' : `${p.cash}M`}</p>
            <p className="text-[10px] text-zinc-400">{monopoly.board[p.position]?.name}</p>
          </div>
        ))}
      </div>

      {/* 16-Square Board Grid */}
      <div className="grid grid-cols-4 gap-2">
        {monopoly.board.map((sp) => {
          const here = monopoly.players.filter((p) => !p.bankrupt && p.position === sp.index);
          return (
            <div
              key={sp.index}
              className="flex min-h-[78px] flex-col justify-between rounded-xl border border-white/10 bg-[#10131E] p-2 text-[11px]"
            >
              <div>
                {sp.color && (
                  <div className="mb-1 h-1.5 w-full rounded" style={{ backgroundColor: sp.color }} />
                )}
                <p className="font-semibold text-white leading-tight">{sp.name}</p>
                {sp.price && (
                  <p className="font-mono text-[10px] text-zinc-400">
                    {sp.price}M {sp.ownerName ? `· ${sp.ownerName}` : ''}
                    {sp.houses ? ` · ${'🏠'.repeat(sp.houses)}` : ''}
                  </p>
                )}
              </div>
              {here.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {here.map((p) => (
                    <span
                      key={p.playerId}
                      className="inline-block h-3 w-3 rounded-full border border-white"
                      style={{ backgroundColor: p.color }}
                      title={p.displayName}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
