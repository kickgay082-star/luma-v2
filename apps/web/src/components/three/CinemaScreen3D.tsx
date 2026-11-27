'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import Hls from 'hls.js';
import { VideoState } from '@luma/shared';
import { AlertCircle, ExternalLink, Radio, Volume2, VolumeX } from 'lucide-react';
import {
  computeSyncedTime,
  getYouTubeErrorMessage,
  loadYouTubeIframeApi,
  YTPlayerInstance,
} from '@/lib/video/youtubeApi';

interface CinemaScreen3DProps {
  position: [number, number, number];
  width: number;
  height: number;
  video: VideoState | null;
  accentColor: string;
  screenVolume?: number;
  interactiveHtml?: boolean;
  suspended?: boolean;
  canControlVideo?: boolean;
  onPlayerSyncAction?: (payload: {
    action: 'play' | 'pause' | 'seek' | 'rate';
    currentTime?: number;
    playbackRate?: number;
  }) => void;
  onVideoEnded?: () => void;
}

export function CinemaScreen3D({
  position,
  width,
  height,
  video,
  accentColor,
  screenVolume = 0.8,
  interactiveHtml = false,
  suspended = false,
  canControlVideo = true,
  onPlayerSyncAction,
  onVideoEnded,
}: CinemaScreen3DProps) {
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [useHtmlVideoFallback, setUseHtmlVideoFallback] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [ytError, setYtError] = useState<string | null>(null);
  const [mutedPrompt, setMutedPrompt] = useState(false);
  const hlsRef = useRef<Hls | null>(null);
  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<YTPlayerInstance | null>(null);
  const ytReadyRef = useRef(false);
  const suppressSyncUntilRef = useRef(0);
  const latestVideoRef = useRef<VideoState | null>(video);
  const canControlRef = useRef(canControlVideo);
  const syncActionRef = useRef(onPlayerSyncAction);

  latestVideoRef.current = video;
  canControlRef.current = canControlVideo;
  syncActionRef.current = onPlayerSyncAction;

  // Standby procedural canvas texture when no video is playing
  const standbyTexture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 1280, 720);
      grad.addColorStop(0, '#090A10');
      grad.addColorStop(0.5, '#111420');
      grad.addColorStop(1, '#090A10');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1280, 720);

      ctx.strokeStyle = 'rgba(124, 92, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(48, 48, 1184, 624);

      ctx.fillStyle = '#F3F4F6';
      ctx.font = '600 54px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LUMA CINEMA', 640, 325);

      ctx.fillStyle = '#9CA3AF';
      ctx.font = '400 24px system-ui, sans-serif';
      ctx.fillText(
        'Alt menüdeki Medya veya IPTV panelinden YouTube, HLS veya M3U8 yayını başlatın.',
        640,
        385,
      );
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  // Native/HLS video element lifecycle for MP4, HLS, IPTV
  const isNativeOrHls =
    !suspended &&
    Boolean(video?.url) &&
    (video?.sourceType === 'mp4' ||
      video?.sourceType === 'hls' ||
      video?.sourceType === 'iptv');

  useEffect(() => {
    setStreamError(null);
    setUseHtmlVideoFallback(false);

    if (!isNativeOrHls || !video?.url) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      setVideoEl(null);
      return;
    }

    const el = document.createElement('video');
    el.crossOrigin = 'anonymous';
    el.playsInline = true;
    el.preload = 'auto';
    el.volume = Math.max(0, Math.min(1, screenVolume));

    const handleEnded = () => {
      onVideoEnded?.();
    };
    const handleError = () => {
      // Retry without crossOrigin inside Html overlay if CORS failed
      if (el.crossOrigin) {
        setUseHtmlVideoFallback(true);
      } else {
        setStreamError('Video akışı yüklenemedi veya kaynak erişime kapalı.');
      }
    };

    el.addEventListener('ended', handleEnded);
    el.addEventListener('error', handleError);

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
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // Try HTML fallback without CORS tainting or recover
            setUseHtmlVideoFallback(true);
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            setStreamError('Canlı akış bağlantısı kesildi.');
          }
        }
      });
    } else {
      el.src = video.url;
    }

    setVideoEl(el);

    return () => {
      el.removeEventListener('ended', handleEnded);
      el.removeEventListener('error', handleError);
      el.pause();
      el.src = '';
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.url, video?.sourceType]);

  // Synchronize playback state for native/HLS video
  useEffect(() => {
    if (!videoEl || !video || !isNativeOrHls) return;
    videoEl.volume = Math.max(0, Math.min(1, screenVolume));
    if (!video.isLive && Number.isFinite(video.playbackRate)) {
      videoEl.playbackRate = video.playbackRate;
    }

    const now = Date.now();
    const expectedTime = video.isPlaying
      ? video.currentTime + Math.max(0, (now - video.updatedAt) / 1000) * video.playbackRate
      : video.currentTime;

    if (!video.isLive && Math.abs((videoEl.currentTime || 0) - expectedTime) > 1.4) {
      try {
        videoEl.currentTime = expectedTime;
      } catch {
        // ignore before metadata
      }
    }

    if (video.isPlaying) {
      videoEl.play().catch(() => {
        videoEl.muted = true;
        setMutedPrompt(true);
        videoEl.play().catch(() => {});
      });
    } else {
      videoEl.pause();
    }
  }, [
    videoEl,
    video,
    isNativeOrHls,
    screenVolume,
  ]);

  const videoTexture = useMemo(() => {
    if (!videoEl || useHtmlVideoFallback) return null;
    const tex = new THREE.VideoTexture(videoEl);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }, [videoEl, useHtmlVideoFallback]);

  // YouTube IFrame Player API Integration
  const isYoutube = !suspended && video?.sourceType === 'youtube' && Boolean(video.youtubeId);

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
      if (cancelled || !ytContainerRef.current || !window.YT?.Player) return;
      if (ytPlayerRef.current) {
        ytPlayerRef.current.loadVideoById(video.youtubeId!, computeSyncedTime(video));
        return;
      }

      ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
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
            suppressSyncUntilRef.current = Date.now() + 900;
            try {
              const iframe = e.target.getIframe?.();
              if (iframe) iframe.referrerPolicy = 'strict-origin-when-cross-origin';
            } catch {
              // ignore
            }
            e.target.setVolume(Math.round(screenVolume * 100));
            if (!video.isLive && Number.isFinite(video.playbackRate)) {
              try {
                e.target.setPlaybackRate(video.playbackRate);
              } catch {
                // ignore
              }
            }
            const target = computeSyncedTime(video);
            if (!video.isLive && target > 0.5) {
              e.target.seekTo(target, true);
            }
            if (video.isPlaying) {
              e.target.playVideo();
            } else {
              e.target.pauseVideo();
            }
          },
          onStateChange: (e) => {
            const ps = window.YT?.PlayerState;
            if (!ps) return;
            if (e.data === ps.ENDED) {
              onVideoEnded?.();
              return;
            }
            if (Date.now() < suppressSyncUntilRef.current) return;
            const srv = latestVideoRef.current;
            if (!srv) return;
            if (e.data === ps.PLAYING || e.data === ps.PAUSED) {
              const wantsPlay = e.data === ps.PLAYING;
              if (wantsPlay === srv.isPlaying) return;
              if (!canControlRef.current) {
                suppressSyncUntilRef.current = Date.now() + 700;
                if (srv.isPlaying) e.target.playVideo();
                else e.target.pauseVideo();
                return;
              }
              syncActionRef.current?.({
                action: wantsPlay ? 'play' : 'pause',
                currentTime: e.target.getCurrentTime?.() || srv.currentTime,
              });
            }
          },
          onPlaybackRateChange: (e) => {
            if (Date.now() < suppressSyncUntilRef.current) return;
            const srv = latestVideoRef.current;
            if (!srv || e.data === srv.playbackRate) return;
            if (!canControlRef.current) {
              suppressSyncUntilRef.current = Date.now() + 700;
              try {
                e.target.setPlaybackRate(srv.playbackRate);
              } catch {
                // ignore
              }
              return;
            }
            syncActionRef.current?.({ action: 'rate', playbackRate: e.data });
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

  // Sync YouTube play/pause/seek/volume
  useEffect(() => {
    const player = ytPlayerRef.current;
    if (!isYoutube || !player || !ytReadyRef.current || !video) return;

    suppressSyncUntilRef.current = Date.now() + 850;
    player.setVolume(Math.round(screenVolume * 100));
    if (!video.isLive && Number.isFinite(video.playbackRate)) {
      try {
        player.setPlaybackRate(video.playbackRate);
      } catch {
        // ignore unsupported rate
      }
    }

    const expectedTime = computeSyncedTime(video);
    const actual = player.getCurrentTime?.() || 0;
    if (!video.isLive && Math.abs(actual - expectedTime) > 1.6) {
      player.seekTo(expectedTime, true);
    }

    if (video.isPlaying) {
      player.playVideo();
    } else {
      player.pauseVideo();
    }
  }, [isYoutube, video, screenVolume]);

  // Calculate HTML scale so 1280x720 fits the 3D screen cleanly
  const htmlDistanceFactor = width / 3.2;

  return (
    <group position={position}>
      {/* Screen Outer Architectural Bezel */}
      <mesh position={[0, 0, -0.14]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.5, height + 0.5, 0.22]} />
        <meshStandardMaterial color="#0A0B10" metalness={0.5} roughness={0.35} />
      </mesh>

      {/* Subtle Ambient Screen Bounce Light */}
      <pointLight
        position={[0, 0, 2.5]}
        color={video?.url ? '#A5B4FC' : accentColor}
        intensity={video?.isPlaying ? 1.8 : 0.7}
        distance={18}
        decay={1.6}
      />

      {/* Base Screen Surface */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[width, height]} />
        {videoTexture ? (
          <meshBasicMaterial map={videoTexture} toneMapped={false} />
        ) : standbyTexture && !isYoutube && !useHtmlVideoFallback ? (
          <meshBasicMaterial map={standbyTexture} />
        ) : (
          <meshBasicMaterial color="#05060A" />
        )}
      </mesh>

      {/* Live YouTube or Non-CORS Video Html Surface Mapped to 3D Screen */}
      {(isYoutube || useHtmlVideoFallback) && (
        <Html
          transform
          position={[0, 0, 0.03]}
          distanceFactor={htmlDistanceFactor}
          style={{
            width: '1280px',
            height: '720px',
            pointerEvents: interactiveHtml ? 'auto' : 'none',
          }}
        >
          <div className="relative h-full w-full overflow-hidden rounded-sm bg-black">
            {isYoutube && <div ref={ytContainerRef} className="h-full w-full" />}
            {useHtmlVideoFallback && video?.url && (
              <HtmlFallbackHlsVideo
                url={video.url}
                isLive={video.isLive}
                isPlaying={video.isPlaying}
                currentTime={video.currentTime}
                updatedAt={video.updatedAt}
                playbackRate={video.playbackRate}
                volume={screenVolume}
              />
            )}
            {ytError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/92 p-10 text-center text-zinc-200">
                <AlertCircle className="h-16 w-16 text-amber-400" />
                <p className="mt-4 max-w-2xl text-2xl font-medium">{ytError}</p>
                {video?.youtubeId && (
                  <a
                    href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-lg font-semibold text-black"
                  >
                    <ExternalLink className="h-5 w-5" />
                    <span>YouTube&apos;da Aç</span>
                  </a>
                )}
              </div>
            )}
            {streamError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-6 text-center text-zinc-200">
                <AlertCircle className="h-12 w-12 text-amber-400" />
                <p className="mt-3 text-xl font-medium">{streamError}</p>
              </div>
            )}
          </div>
        </Html>
      )}

      {/* Unmute prompt badge if browser autoplay forced mute */}
      {mutedPrompt && videoEl && (
        <Html position={[0, -height / 2 + 0.45, 0.1]} center>
          <button
            type="button"
            onClick={() => {
              videoEl.muted = false;
              videoEl.volume = screenVolume;
              setMutedPrompt(false);
            }}
            className="flex items-center gap-2 rounded-full border border-white/20 bg-[#10121A]/90 px-4 py-1.5 text-xs font-medium text-white shadow-lg"
          >
            <VolumeX className="h-3.5 w-3.5 text-amber-400" />
            <span>Tarayıcı sesi susturdu — Perde Sesini Aç</span>
            <Volume2 className="h-3.5 w-3.5 text-[#7C5CFF]" />
          </button>
        </Html>
      )}

      {/* Live IPTV Indicator Badge on Screen Frame */}
      {video?.isLive && video.url && (
        <Html position={[-width / 2 + 0.9, height / 2 - 0.3, 0.08]} center>
          <div className="flex items-center gap-1.5 rounded-full border border-red-500/40 bg-black/75 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-400">
            <Radio className="h-3 w-3 animate-pulse" />
            <span>CANLI</span>
          </div>
        </Html>
      )}
    </group>
  );
}

function HtmlFallbackHlsVideo({
  url,
  isLive,
  isPlaying,
  currentTime,
  updatedAt,
  playbackRate,
  volume,
}: {
  url: string;
  isLive: boolean;
  isPlaying: boolean;
  currentTime: number;
  updatedAt: number;
  playbackRate: number;
  volume: number;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let hls: Hls | null = null;
    if (url.toLowerCase().includes('.m3u8') && Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: isLive });
      hls.loadSource(url);
      hls.attachMedia(el);
    } else {
      el.src = url;
    }
    return () => {
      hls?.destroy();
    };
  }, [url, isLive]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.volume = Math.max(0, Math.min(1, volume));
    if (!isLive) {
      const target = isPlaying
        ? currentTime + Math.max(0, (Date.now() - updatedAt) / 1000) * playbackRate
        : currentTime;
      if (Math.abs((el.currentTime || 0) - target) > 1.5) {
        try {
          el.currentTime = target;
        } catch {
          // ignore
        }
      }
    }
    if (isPlaying) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [isLive, isPlaying, currentTime, updatedAt, playbackRate, volume]);

  return <video ref={ref} className="h-full w-full bg-black object-contain" playsInline />;
}
