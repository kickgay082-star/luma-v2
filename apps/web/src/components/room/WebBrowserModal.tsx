'use client';

import { useEffect, useState } from 'react';
import { VideoSourceType } from '@luma/shared';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  Film,
  Globe,
  Play,
  Puzzle,
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

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
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
  const [address, setAddress] = useState('');
  const [mode, setMode] = useState<'home' | 'browse'>('home');
  const [activeProxyUrl, setActiveProxyUrl] = useState<string>('');
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [pageTitle, setPageTitle] = useState('Luma Arama & Video Yakalayıcı');
  const [history, setHistory] = useState<string[]>([]);
  const [detectedVideos, setDetectedVideos] = useState<DetectedVideo[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [extInstalled, setExtInstalled] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    if (!open) return;
    if (typeof document !== 'undefined' && document.documentElement.dataset.lumaExt === '1') {
      setExtInstalled(true);
    }

    const onMsg = (ev: MessageEvent) => {
      const d = ev.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === 'LUMA_EXTENSION_READY') {
        setExtInstalled(true);
      } else if (d.type === 'LUMA_PAGE_META') {
        if (typeof d.url === 'string') {
          setCurrentUrl(d.url);
          setAddress(d.url);
        }
        if (typeof d.title === 'string' && d.title) setPageTitle(d.title);
      } else if (d.type === 'LUMA_NAVIGATE' && typeof d.url === 'string') {
        setCurrentUrl(d.url);
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

  const openProxiedUrl = (url: string) => {
    setCurrentUrl(url);
    setAddress(url);
    setDetectedVideos([]);
    setHistory((prev) => [...prev.slice(-19), url]);
    setActiveProxyUrl(`/api/browser/proxy?url=${encodeURIComponent(url)}`);
    setMode('browse');
  };

  const handleSubmit = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    const looksLikeUrl =
      /^https?:\/\//i.test(trimmed) ||
      (!trimmed.includes(' ') && /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed));

    if (looksLikeUrl) {
      const target = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      openProxiedUrl(target);
      return;
    }

    // Native server-side web search (never hits DuckDuckGo X-Frame-Options!)
    setMode('home');
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/browser/search?q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      const list = Array.isArray(data?.results) ? (data.results as SearchResult[]) : [];
      setSearchResults(list);
      if (list.length === 0) {
        setSearchError('Arama sonucu bulunamadı veya motor kısıtladı. Direkt site linki yazabilir veya eklentiyi kullanabilirsin.');
      }
    } catch {
      setSearchError('Arama sırasında bağlantı hatası oluştu.');
    } finally {
      setSearching(false);
    }
  };

  const handleBack = () => {
    if (mode === 'browse' && history.length <= 1) {
      setMode('home');
      setHistory([]);
      setCurrentUrl('');
      setActiveProxyUrl('');
      return;
    }
    if (history.length > 1) {
      const nextHist = history.slice(0, -1);
      const prevUrl = nextHist[nextHist.length - 1];
      setHistory(nextHist);
      setCurrentUrl(prevUrl);
      setAddress(prevUrl);
      setDetectedVideos([]);
      setActiveProxyUrl(`/api/browser/proxy?url=${encodeURIComponent(prevUrl)}`);
    } else {
      setMode('home');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#07080D]/95 p-3 backdrop-blur-md sm:p-5">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0D0F17] shadow-2xl">
        {/* Top Browser Bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] bg-[#10121C] px-3 py-2.5">
          <button
            type="button"
            onClick={handleBack}
            disabled={mode === 'home' && history.length === 0}
            className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-zinc-300 hover:bg-white/10 disabled:opacity-35"
            title="Geri"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          {mode === 'browse' && (
            <button
              type="button"
              onClick={() => setReloadNonce((n) => n + 1)}
              className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-zinc-300 hover:bg-white/10"
              title="Yenile"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit(address);
            }}
            className="flex flex-1 items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Film/dizi ara (örn: prison break) veya site adresi yaz (https://...)"
                className="w-full rounded-xl border border-white/10 bg-[#090A0F] py-2 pl-9 pr-3 text-xs text-white placeholder:text-zinc-500 focus:border-[#7C5CFF] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-[#7C5CFF] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#6D4AF5]"
            >
              {searching ? 'Aranıyor...' : 'Ara / Git'}
            </button>
          </form>

          {mode === 'browse' && currentUrl && (
            <>
              <a
                href={currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/10 md:flex"
                title="Site içi proxy engellenirse normal sekmede açıp Luma Eklentisiyle perdeye gönder"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Yeni Sekmede Aç</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  onBroadcastVideo({
                    sourceType: 'embed',
                    url: currentUrl,
                    title: pageTitle || 'Web Sayfası',
                  });
                  onClose();
                }}
                className="hidden items-center gap-1.5 rounded-xl border border-blue-500/35 bg-blue-500/15 px-3 py-2 text-xs font-medium text-blue-200 hover:bg-blue-500/25 md:flex"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>Sayfayı Perdeye Ver</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
            title="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        {mode === 'home' ? (
          <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
            {/* Extension Download & Status Card */}
            <div className="rounded-2xl border border-[#7C5CFF]/35 bg-gradient-to-br from-[#7C5CFF]/15 via-[#11131E] to-[#0B0D14] p-4 sm:p-5">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Puzzle className="h-5 w-5 text-[#A78BFA]" />
                    <h3 className="text-sm font-semibold text-white">
                      Luma Video Köprüsü Eklentisi (Chrome / Edge / Opera)
                    </h3>
                    {extInstalled && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> Kurulu
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed text-zinc-300">
                    Bazı siteler güvenlik koruması nedeniyle site içi tarayıcıya bağlanmayı reddeder. Luma Eklentisini bir kere kurduğunda, kendi normal tarayıcı sekmesinde açtığın film/dizi/X videosunu ekran paylaşmadan tek tıkla 3D sinema perdesine gönderir.
                  </p>
                </div>

                <a
                  href="/api/extension/download"
                  download="luma-video-koprusu-eklentisi.zip"
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#7C5CFF] px-4 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:bg-[#6D4AF5]"
                >
                  <Download className="h-4 w-4" />
                  <span>Eklentiyi İndir (.zip)</span>
                </a>
              </div>

              <div className="mt-4 grid gap-2 text-[11px] text-zinc-300 sm:grid-cols-3">
                <div className="rounded-xl border border-white/[0.07] bg-black/30 p-2.5">
                  <span className="font-semibold text-white">1. ZIP&apos;i Klasöre Çıkar</span>
                  <p className="mt-0.5 text-zinc-400">
                    İndirdiğin ZIP dosyasına sağ tıklayıp &quot;Tümünü Ayıkla&quot; de.
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-black/30 p-2.5">
                  <span className="font-semibold text-white">2. Tarayıcıya Yükle</span>
                  <p className="mt-0.5 text-zinc-400">
                    <span className="font-mono text-zinc-200">chrome://extensions</span> aç → sağ üstten <b>Geliştirici Modu</b>&apos;nu aç → <b>Paketlenmemiş öğe yükle</b> ile klasörü seç.
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-black/30 p-2.5">
                  <span className="font-semibold text-white">3. Tek Tıkla İzlet</span>
                  <p className="mt-0.5 text-zinc-400">
                    Herhangi bir sitede videoyu başlat, sağ üstten <b>Luma Video Köprüsü</b> eklentisine basıp <b>Perdeye Gönder</b>&apos;e tıkla!
                  </p>
                </div>
              </div>
            </div>

            {/* Search Results inside Luma */}
            {searchError && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-200">
                {searchError}
              </div>
            )}

            {searchResults.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-zinc-200">
                  Arama Sonuçları ({searchResults.length})
                </p>
                <div className="space-y-2">
                  {searchResults.map((res, idx) => (
                    <div
                      key={`${res.url}-${idx}`}
                      className="flex flex-col justify-between gap-2 rounded-xl border border-white/[0.08] bg-[#10121C] p-3 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="truncate text-xs font-semibold text-white">{res.title}</p>
                        <p className="truncate font-mono text-[10px] text-[#A78BFA]">{res.url}</p>
                        {res.snippet && (
                          <p className="line-clamp-2 text-[11px] text-zinc-400">{res.snippet}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openProxiedUrl(res.url)}
                          className="rounded-lg bg-[#7C5CFF] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#6D4AF5]"
                        >
                          Site İçinde Aç
                        </button>
                        <a
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-1.5 text-[11px] text-zinc-200 hover:bg-white/10"
                          title="Yeni sekmede aç ve Luma Eklentisiyle yakala"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>Yeni Sekme</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.07] bg-[#0B0D14] p-6 text-center text-xs text-zinc-400">
                <Sparkles className="mx-auto mb-2 h-6 w-6 text-[#7C5CFF]" />
                Yukarıdaki kutuya dizi/film adı yazıp <b>Ara / Git</b> diyebilir veya direkt eklentiyi indirip tarayıcından istediğin siteyi açabilirsin.
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Info Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-[#0B0D14] px-4 py-1.5 text-[11px] text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#7C5CFF]" />
                Videoyu oynattığında aşağıda yakalanır. Site bağlanmayı reddederse &quot;Yeni Sekmede Aç&quot; deyip Luma Eklentisini kullan.
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
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                  <span className="flex items-center gap-2">
                    <Film className="h-4 w-4 text-zinc-500" />
                    Henüz video akışı yakalanmadı — sayfadan videoyu oynat veya eklentiyi kullan.
                  </span>
                  <a
                    href={currentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-white/10"
                  >
                    <ExternalLink className="h-3 w-3" /> Yeni Sekmede Aç
                  </a>
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
          </>
        )}
      </div>
    </div>
  );
}
