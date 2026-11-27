'use client';

import { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import {
  PlayerState,
  PlayerTransformUpdate,
  ROOM_THEMES,
  RoomCustomization,
  SeatState,
  VideoState,
} from '@luma/shared';
import { Armchair, Mic, MicOff, Radio } from 'lucide-react';

interface Lite2DRoomViewProps {
  customization: RoomCustomization;
  localPlayer: PlayerState | null;
  players: PlayerState[];
  seats: SeatState[];
  video: VideoState | null;
  onMoveClick: (update: PlayerTransformUpdate) => void;
  onClaimSeat: (seatId: string) => void;
  onLeaveSeat: () => void;
}

export function Lite2DRoomView({
  customization,
  localPlayer,
  players,
  seats,
  video,
  onMoveClick,
  onClaimSeat,
  onLeaveSeat,
}: Lite2DRoomViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const meta = ROOM_THEMES[customization.theme];

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !video?.url || video.sourceType === 'youtube') return;
    let hls: Hls | null = null;
    if ((video.sourceType === 'hls' || video.sourceType === 'iptv') && Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: video.isLive });
      hls.loadSource(video.url);
      hls.attachMedia(el);
    } else {
      el.src = video.url;
    }
    return () => {
      hls?.destroy();
    };
  }, [video?.url, video?.sourceType, video?.isLive]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !video || video.sourceType === 'youtube') return;
    if (video.isPlaying) el.play().catch(() => {});
    else el.pause();
  }, [video]);

  const handleStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!localPlayer) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const nz = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    const targetX = nx * 10;
    const targetZ = nz * 10;
    onMoveClick({
      position: [targetX, 0, targetZ],
      rotationY: Math.PI,
      headYaw: 0,
      headPitch: 0,
      velocity: [0, 0, 0],
      animState: 'walk',
      seq: Date.now(),
    });
  };

  return (
    <div className="flex h-full w-full flex-col gap-4 bg-[#08090E] p-4 pt-20 pb-24 lg:flex-row">
      {/* 2D Video Theater Pane */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black">
        <div className="flex items-center justify-between border-b border-white/[0.07] bg-[#10121A] px-4 py-2.5 text-xs">
          <span className="font-medium text-white">
            {video?.title || 'İçerik Seçilmedi'} (2D Lite Modu)
          </span>
          {video?.isLive && (
            <span className="flex items-center gap-1 text-red-400">
              <Radio className="h-3.5 w-3.5" /> CANLI
            </span>
          )}
        </div>
        <div className="relative flex flex-1 items-center justify-center bg-black">
          {video?.sourceType === 'youtube' && video.youtubeId ? (
            <iframe
              className="h-full w-full"
              src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=${
                video.isPlaying ? 1 : 0
              }`}
              allow="autoplay; encrypted-media"
              allowFullScreen
              title={video.title}
            />
          ) : video?.url ? (
            <video ref={videoRef} className="h-full w-full object-contain" controls playsInline />
          ) : (
            <p className="text-sm text-zinc-500">
              Alt menüdeki Medya panelinden YouTube veya IPTV yayını başlatabilirsiniz.
            </p>
          )}
        </div>
      </div>

      {/* 2D Interactive Spatial Floor Plan */}
      <div className="flex w-full flex-col rounded-2xl border border-white/10 bg-[#10121A] p-4 lg:w-96">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-white">{meta.name} — 2D Harita</p>
            <p className="text-[11px] text-zinc-400">
              Hareket etmek için alana, oturmak için koltuğa tıklayın.
            </p>
          </div>
          {localPlayer?.seatedSeatId && (
            <button
              type="button"
              onClick={onLeaveSeat}
              className="rounded-lg bg-white/10 px-2.5 py-1 text-xs text-white"
            >
              Kalk
            </button>
          )}
        </div>

        <div
          onClick={handleStageClick}
          className="relative flex-1 min-h-[280px] cursor-crosshair overflow-hidden rounded-xl border border-white/10 bg-[#090A0F]"
        >
          <div className="absolute left-1/2 top-2 -translate-x-1/2 rounded bg-white/10 px-4 py-0.5 text-[10px] tracking-widest text-zinc-400">
            PERDE
          </div>

          {seats.map((s) => {
            const leftPct = ((s.position[0] + 12) / 24) * 100;
            const topPct = ((s.position[2] + 12) / 24) * 100;
            const occupied = Boolean(s.occupiedBy);
            return (
              <button
                key={s.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClaimSeat(s.id);
                }}
                title={s.label}
                style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded p-1 transition ${
                  s.occupiedBy === localPlayer?.id
                    ? 'bg-emerald-500 text-black'
                    : occupied
                      ? 'bg-amber-500/30 text-amber-300'
                      : 'bg-white/10 text-zinc-300 hover:bg-[#7C5CFF] hover:text-white'
                }`}
              >
                <Armchair className="h-3 w-3" />
              </button>
            );
          })}

          {players.map((p) => {
            const leftPct = ((p.position[0] + 12) / 24) * 100;
            const topPct = ((p.position[2] + 12) / 24) * 100;
            const isLocal = p.id === localPlayer?.id;
            return (
              <div
                key={p.id}
                style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
              >
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-bold ${
                    isLocal
                      ? 'border-white bg-[#7C5CFF] text-white'
                      : p.isSpeaking
                        ? 'border-emerald-300 bg-emerald-500 text-black'
                        : 'border-white/30 bg-[#3B82F6] text-white'
                  }`}
                >
                  {p.micEnabled ? <Mic className="h-2.5 w-2.5" /> : <MicOff className="h-2.5 w-2.5" />}
                </div>
                <span className="mt-0.5 rounded bg-black/75 px-1 text-[9px] text-zinc-200">
                  {p.displayName}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
