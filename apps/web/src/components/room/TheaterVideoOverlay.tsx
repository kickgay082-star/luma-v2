'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { VideoState } from '@luma/shared';
import {
  AlertCircle,
  Box,
  ExternalLink,
  Maximize,
  MessageSquare,
  Mic,
  MicOff,
  Minimize,
  Pause,
  Play,
  Radio,
  SkipForward,
  Volume2,
} from 'lucide-react';
import {
  computeSyncedTime,
  getYouTubeErrorMessage,
  loadYouTubeIframeApi,
  YTPlayerInstance,
} from '@/lib/video/youtubeApi';

interface TheaterVideoOverlayProps {
  roomName: string;
  onlineCount: number;
  video: VideoState | null;
  displayTime: number;
  hasQueue: boolean;
  screenVolume: number;
  micEnabled: boolean;
  localAudioLevel: number;
  onChangeVolume: (vol: number) => void;
  onTogglePlay: () => void;
  onSeek: (targetSec: number) => void;
  onNextQueue: () => void;
  onVideoEnded: () => void;
  onToggleMic: () => void;
  onOpenMedia: () => void;
  onOpenSocial: () => void;
  onExitTheater: () => void;
}

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function TheaterVideoOverlay({
  roomName,
  onlineCount,
  video,
  displayTime,
  hasQueue,
  screenVolume,
  micEnabled,
  localAudioLevel,
  onChangeVolume,
  onTogglePlay,
  onSeek,
  onNextQueue,
  onVideoEnded,
  onToggleMic,
  onOpenMedia,
  onOpenSocial,
  onExitTheater,
}: TheaterVideoOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const ytRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<YTPlayerInstance | null>(null);
  const ytReadyRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [ytError, setYtError] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);

  const isYoutube = video?.sourceType === 'youtube' && Boolean(video.youtubeId);
  const isNativeOrHls =
    Boolean(video?.url) &&
    (video?.sourceType === 'mp4' ||
      video?.sourceType === 'hls' ||
      video?.sourceType === 'iptv');

  useEffect(() => {
    const onFsChange = () => setNativeFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // YouTube Player lifecycle
  useEffect(() => {
    setYtError(null);
    if (!isYoutube || !video?.youtubeId) {
      if (ytPlayerRef.current) {
        ytPlayerRef.current.destroy();
        ytPlayerRef.current = null;
        ytReadyRef.current = false;
      }
      return;
    }

    let cancelled = false;
    const mountPlayer = () => {
      if (cancelled || !ytRef.current || !window.YT?.Player) return;
      if (ytPlayerRef.current) {
        ytPlayerRef.current.loadVideoById(video.youtubeId!, computeSyncedTime(video));
        return;
      }

      ytPlayerRef.current = new window.YT.Player(ytRef.current, {
        videoId: video.youtubeId!,
        host: 'https://www.youtube.com',
        playerVars: {
          autoplay: video.isPlaying ? 1 : 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          fs: 1,
          enablejsapi: 1,
          origin: typeof window !== 'undefined' ? window.location.origin : '',
        },
        events: {
          onReady: (e) => {
            ytReadyRef.current = true;
            try {
              const iframe = e.target.getIframe?.();
              if (iframe) iframe.referrerPolicy = 'strict-origin-when-cross-origin';
            } catch {
              // ignore
            }
            e.target.setVolume(Math.round(screenVolume * 100));
            const target = computeSyncedTime(video);
            if (!video.isLive && target > 0.5) {
              e.target.seekTo(target, true);
            }
            if (video.isPlaying) e.target.playVideo();
            else e.target.pauseVideo();
          },
          onStateChange: (e) => {
            if (window.YT?.PlayerState && e.data === window.YT.PlayerState.ENDED) {
              onVideoEnded();
            }
          },
          onError: (e) => {
            setYtError(getYouTubeErrorMessage(e.data));
          },
        },
      });
    };

    loadYouTubeIframeApi(mountPlayer);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isYoutube, video?.youtubeId]);

  useEffect(() => {
    return () => {
      if (ytPlayerRef.current) {
        ytPlayerRef.current.destroy();
        ytPlayerRef.current = null;
        ytReadyRef.current = false;
      }
    };
  }, []);

  // Sync YouTube playback state
  useEffect(() => {
    const player = ytPlayerRef.current;
    if (!isYoutube || !player || !ytReadyRef.current || !video) return;
    player.setVolume(Math.round(screenVolume * 100));
    const expected = computeSyncedTime(video);
    const actual = player.getCurrentTime?.() || 0;
    if (!video.isLive && Math.abs(actual - expected) > 1.6) {
      player.seekTo(expected, true);
    }
    if (video.isPlaying) player.playVideo();
    else player.pauseVideo();
  }, [isYoutube, video, screenVolume]);

  // Native / HLS video lifecycle
  useEffect(() => {
    setStreamError(null);
    const el = videoRef.current;
    if (!isNativeOrHls || !video?.url || !el) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    const isHlsSource =
      video.sourceType === 'hls' ||
      video.sourceType === 'iptv' ||
      video.url.toLowerCase().includes('.m3u8');

    if (isHlsSource && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: Boolean(video.isLive),
        backBufferLength: 30,
      });
      hlsRef.current = hls;
      hls.loadSource(video.url);
      hls.attachMedia(el);
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else setStreamError('Canlı akış bağlantısı kesildi veya oynatılamadı.');
        }
      });
    } else {
      el.src = video.url;
    }

    return () => {
      el.pause();
      el.removeAttribute('src');
      el.load();
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNativeOrHls, video?.url, video?.sourceType]);

  // Sync Native / HLS playback state
  useEffect(() => {
    const el = videoRef.current;
    if (!isNativeOrHls || !el || !video) return;
    el.volume = Math.max(0, Math.min(1, screenVolume));
    if (!video.isLive && Number.isFinite(video.playbackRate)) {
      el.playbackRate = video.playbackRate;
    }
    const expected = computeSyncedTime(video);
    if (!video.isLive && Math.abs((el.currentTime || 0) - expected) > 1.5) {
      try {
        el.currentTime = expected;
      } catch {
        // ignore
      }
    }
    if (video.isPlaying) el.play().catch(() => {});
    else el.pause();
  }, [isNativeOrHls, video, screenVolume]);

  const toggleBrowserFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-30 flex flex-col bg-[#05060A] text-white"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#0B0D14]/95 px-4 py-2.5 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-md bg-[#7C5CFF]/20 px-2 py-0.5 text-[11px] font-medium text-[#C4B5FD]">
            {roomName} · {onlineCount} kişi
          </span>
          <p className="truncate text-sm font-medium text-white">
            {video?.title || 'İçerik Seçilmedi'}
          </p>
          {video?.isLive && video.url && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-400">
              <Radio className="h-3 w-3 animate-pulse" />
              CANLI
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleBrowserFullscreen}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-white/10"
            title="Tam Ekran Yap"
          >
            {nativeFullscreen ? (
              <Minimize className="h-3.5 w-3.5" />
            ) : (
              <Maximize className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {nativeFullscreen ? 'Küçült' : 'Tam Ekran'}
            </span>
          </button>

          <button
            type="button"
            onClick={onExitTheater}
            className="flex items-center gap-1.5 rounded-xl bg-[#7C5CFF] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#6D4AF5]"
          >
            <Box className="h-3.5 w-3.5" />
            <span>3D Odaya Dön</span>
          </button>
        </div>
      </div>

      {/* Main Video Viewport */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
        {isYoutube && (
          <div className="relative h-full w-full">
            <div ref={ytRef} className="h-full w-full" />
            {ytError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/92 p-6 text-center">
                <AlertCircle className="h-12 w-12 text-amber-400" />
                <p className="mt-3 max-w-md text-sm font-medium text-zinc-100">{ytError}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {video?.youtubeId && (
                    <a
                      href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      YouTube&apos;da Aç
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={onOpenMedia}
                    className="rounded-xl bg-[#7C5CFF] px-4 py-2 text-xs font-medium text-white"
                  >
                    Başka Video Seç
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {isNativeOrHls && (
          <div className="relative flex h-full w-full items-center justify-center">
            <video
              ref={videoRef}
              controls
              playsInline
              onEnded={onVideoEnded}
              onError={() => setStreamError('Video akışı yüklenemedi veya erişime kapalı.')}
              className="h-full w-full bg-black object-contain"
            />
            {streamError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-6 text-center">
                <AlertCircle className="h-10 w-10 text-amber-400" />
                <p className="mt-3 text-sm text-zinc-200">{streamError}</p>
              </div>
            )}
          </div>
        )}

        {!video?.url && (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <p className="text-base font-medium text-zinc-300">Şu an oynatılan bir video yok.</p>
            <p className="mt-1 text-xs text-zinc-500">
              Alttaki Medya / IPTV butonundan YouTube, MP4 veya M3U8 yayını başlatabilirsin.
            </p>
            <button
              type="button"
              onClick={onOpenMedia}
              className="mt-4 rounded-xl bg-[#7C5CFF] px-4 py-2 text-xs font-medium text-white hover:bg-[#6D4AF5]"
            >
              Medya / IPTV Seç
            </button>
          </div>
        )}
      </div>

      {/* Bottom Sync + Voice + Chat Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] bg-[#0B0D14]/95 px-4 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleMic}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
              micEnabled
                ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                : 'bg-white/[0.06] text-zinc-300 hover:bg-white/10'
            }`}
          >
            {micEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
            <span>{micEnabled ? 'Mikrofon Açık' : 'Sessiz'}</span>
            {micEnabled && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                style={{ transform: `scale(${1 + localAudioLevel * 1.4})` }}
              />
            )}
          </button>
        </div>

        {video?.url && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTogglePlay}
              className="rounded-xl bg-[#7C5CFF] p-2 text-white hover:bg-[#6D4AF5]"
            >
              {video.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>

            {!video.isLive && (
              <>
                <span className="font-mono text-xs text-zinc-400">
                  {formatClock(displayTime)}
                </span>
                <button
                  type="button"
                  onClick={() => onSeek(Math.max(0, displayTime - 15))}
                  className="rounded-lg bg-white/[0.06] px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/10"
                >
                  -15s
                </button>
                <button
                  type="button"
                  onClick={() => onSeek(displayTime + 15)}
                  className="rounded-lg bg-white/[0.06] px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/10"
                >
                  +15s
                </button>
              </>
            )}

            {hasQueue && (
              <button
                type="button"
                onClick={onNextQueue}
                className="rounded-xl bg-white/[0.06] p-2 text-zinc-300 hover:bg-white/10"
                title="Sıradaki"
              >
                <SkipForward className="h-4 w-4" />
              </button>
            )}

            <div className="hidden items-center gap-1.5 sm:flex">
              <Volume2 className="h-3.5 w-3.5 text-zinc-400" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={screenVolume}
                onChange={(e) => onChangeVolume(Number(e.target.value))}
                className="w-20 accent-[#7C5CFF]"
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenMedia}
            className="flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/10"
          >
            <Radio className="h-3.5 w-3.5" />
            <span>Medya / IPTV</span>
          </button>
          <button
            type="button"
            onClick={onOpenSocial}
            className="flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/10"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Sohbet</span>
          </button>
        </div>
      </div>
    </div>
  );
}
