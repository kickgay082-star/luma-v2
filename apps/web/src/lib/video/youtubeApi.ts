import { VideoState } from '@luma/shared';

export interface YTPlayerInstance {
  loadVideoById: (id: string, startSeconds?: number) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  getPlaybackRate?: () => number;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  setVolume: (vol: number) => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  getIframe?: () => HTMLIFrameElement | null;
  destroy: () => void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement | string,
        options: {
          videoId?: string;
          host?: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (e: { target: YTPlayerInstance }) => void;
            onStateChange?: (e: { data: number; target: YTPlayerInstance }) => void;
            onPlaybackRateChange?: (e: { data: number; target: YTPlayerInstance }) => void;
            onError?: (e: { data: number }) => void;
          };
        },
      ) => YTPlayerInstance;
      PlayerState?: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export function loadYouTubeIframeApi(onReady: () => void): void {
  if (typeof window === 'undefined') return;
  if (window.YT?.Player) {
    onReady();
    return;
  }
  if (!document.getElementById('luma-yt-api')) {
    const tag = document.createElement('script');
    tag.id = 'luma-yt-api';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(tag);
  }
  const prevReady = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    prevReady?.();
    onReady();
  };
}

export function getYouTubeErrorMessage(code: number): string {
  if (code === 101 || code === 150) {
    return 'Bu YouTube videosunun sahibi site içi oynatmayı devre dışı bırakmış. Başka bir video linki deneyebilirsiniz.';
  }
  if (code === 100) {
    return 'Bu YouTube videosu bulunamadı veya gizli.';
  }
  return `YouTube oynatıcı hatası (Kod: ${code}). Başka bir video deneyebilirsiniz.`;
}

export function computeSyncedTime(video: VideoState): number {
  if (!video.isPlaying) return video.currentTime;
  return (
    video.currentTime +
    Math.max(0, (Date.now() - video.updatedAt) / 1000) * video.playbackRate
  );
}
