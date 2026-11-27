'use client';

import { useEffect, useState } from 'react';
import { VideoSourceType } from '@luma/shared';
import {
  ArrowLeft,
  Film,
  Globe,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';

interface DetectedVideo {
  url: string;
  sourceType: VideoSourceType;
  title: string;
}

interface WebBrowserModalProps {
  open: boolean;
  onClose: () => void;
  onBroadcastVideo: (payload: {
    sourceType: VideoSourceType;
    url: string;
    title: string;
  }) => void;
}

export function WebBrowserModal({
  open,
  onClose,
  onBroadcastVideo,
}: WebBrowserModalProps) {
  const [address, setAddress] = useState('https://duckduckgo.com/');
  const [activeProxyUrl, setActiveProxyUrl] = useState<string>(
    '/api/browser/proxy?url=' + encodeURIComponent('https://duckduckgo.com/'),
  );
  const [pageTitle, setPageTitle] = useState('Luma Site İçi Tarayıcı');
  const [history, setHistory] = useState<string[]>(['https://duckduckgo.com/']);
  const [detectedVideos, setDetectedVideos] = useState<DetectedVideo[]>([]);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onMsg = (ev: MessageEvent) => {
      const d = ev.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === 'LUMA_PAGE_META') {
        if (typeof d.url === 'string') setAddress(d.url);
        if (typeof d.title === 'string' && d.title) setPageTitle(d.title);
      } else if (d.type === 'LUMA_NAVIGATE' && typeof d.url === 'string') {
        setAddress(d.url);
        setHistory((prev) => [...prev.slice(-19), d.url]);
      } else if (d.type === 'LUMA_VIDEO_FOUND' && typeof d.url === 'string') {
        setDetectedVideos((prev) => {
          if (prev.some((v) => v.url === d.url)) return prev;
          return [
            {
              url: d.url,
              sourceType: (d.sourceType as VideoSourceType) || 'mp4',
              title: typeof d.title === 'string' && d.title ? d.title : 'Bulunan Video',
            },
            ...prev,
          ].slice(0, 12);
        });
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [open]);

  if (!open) return null;

  const navigateTo = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    let target = trimmed;
    if (!/^https?:\/\//i.test(target)) {
      target =
        target.includes('.') && !target.includes(' ')
          ? `https://${target}`
          : `https://duckduckgo.com/?q=${encodeURIComponent(target)}`;
    }
    setAddress(target);
    setDetectedVideos([]);
    setHistory((prev) => [...prev.slice(-19), target]);
    setActiveProxyUrl(`/api/browser/proxy?url=${encodeURIComponent(target)}`);
  };

  const handleBack = () => {
    if (history.length <= 1) return;
    const nextHist = history.slice(0, -1);
    const prevUrl = nextHist[nextHist.length - 1];
    setHistory(nextHist);
    setAddress(prevUrl);
    setDetectedVideos([]);
    setActiveProxyUrl(`/api/browser/proxy?url=${encodeURIComponent(prevUrl)}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#07080D]/95 p-3 backdrop-blur-md sm:p-5">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0D0F17] shadow-2xl">
        {/* Top Browser Bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] bg-[#10121C] px-3 py-2.5">
          <button
            type="button"
            onClick={handleBack}
            disabled={history.length <= 1}
            className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-zinc-300 hover:bg-white/10 disabled:opacity-35"
            title="Geri"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-zinc-300 hover:bg-white/10"
            title="Yenile"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigateTo(address);
            }}
            className="flex flex-1 items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Site adresi (https://...) veya arama kelimesi yaz (örn: prison break)"
                className="w-full rounded-xl border border-white/10 bg-[#090A0F] py-2 pl-9 pr-3 text-xs text-white placeholder:text-zinc-500 focus:border-[#7C5CFF] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-[#7C5CFF] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#6D4AF5]"
            >
              Git
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              onBroadcastVideo({
                sourceType: 'embed',
                url: address,
                title: pageTitle || 'Web Sayfası',
              });
              onClose();
            }}
            className="hidden items-center gap-1.5 rounded-xl border border-blue-500/35 bg-blue-500/15 px-3 py-2 text-xs font-medium text-blue-200 hover:bg-blue-500/25 md:flex"
            title="Açık olan sayfayı doğrudan perdeye yansıt"
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Sayfayı Perdeye Ver</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
            title="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-[#0B0D14] px-4 py-1.5 text-[11px] text-zinc-400">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[#7C5CFF]" />
            Sayfada gezinip videoya tıkladığında oynatılan video aşağıda otomatik yakalanır.
          </span>
          <span className="truncate font-mono text-[10px] text-zinc-500">{pageTitle}</span>
        </div>

        {/* Proxied Webpage Frame */}
        <div className="relative flex-1 bg-white">
          <iframe
            key={`${activeProxyUrl}-${reloadNonce}`}
            src={activeProxyUrl}
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-forms allow-same-origin allow-presentation"
            allow="autoplay; fullscreen"
          />
        </div>

        {/* Captured Videos Tray */}
        <div className="border-t border-white/10 bg-[#0B0D14] px-4 py-2.5">
          {detectedVideos.length === 0 ? (
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="flex items-center gap-2">
                <Film className="h-4 w-4 text-zinc-500" />
                Henüz video akışı yakalanmadı — sayfadan videoyu aç/oynat.
              </span>
              <button
                type="button"
                onClick={() => {
                  onBroadcastVideo({
                    sourceType: 'embed',
                    url: address,
                    title: pageTitle || 'Web Oynatıcı',
                  });
                  onClose();
                }}
                className="rounded-lg bg-white/10 px-3 py-1 text-[11px] font-medium text-zinc-200 hover:bg-white/15 md:hidden"
              >
                Sayfayı Perdeye Ver
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-emerald-300">
                Yakalanan Videolar ({detectedVideos.length}):
              </span>
              {detectedVideos.map((v, idx) => (
                <button
                  key={`${v.url}-${idx}`}
                  type="button"
                  onClick={() => {
                    onBroadcastVideo(v);
                    onClose();
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-[#7C5CFF] px-3 py-1.5 text-xs font-medium text-white shadow hover:bg-[#6D4AF5]"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span className="max-w-[200px] truncate">{v.title}</span>
                  <span className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[10px]">
                    {v.sourceType.toUpperCase()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
