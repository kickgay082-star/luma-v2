'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Hls from 'hls.js';
import { IptvChannel, IptvPlaylist } from '@luma/shared';
import {
  AlertCircle,
  Heart,
  Play,
  Plus,
  Radio,
  Search,
  Trash2,
  Upload,
  Clock,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { useLumaStore } from '@/stores/useLumaStore';

export default function IptvPage() {
  const user = useLumaStore((s) => s.user);
  const [playlists, setPlaylists] = useState<IptvPlaylist[]>([]);
  const [favorites, setFavorites] = useState<IptvChannel[]>([]);
  const [recents, setRecents] = useState<IptvChannel[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [group, setGroup] = useState<string>('Tümü');
  const [search, setSearch] = useState<string>('');
  const [previewChannel, setPreviewChannel] = useState<IptvChannel | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formText, setFormText] = useState('');
  const [inputMode, setInputMode] = useState<'url' | 'file' | 'text'>('url');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const loadAll = async () => {
    const [plRes, favRes] = await Promise.all([
      fetch('/api/iptv/playlists', { cache: 'no-store' }),
      fetch('/api/iptv/favorites', { cache: 'no-store' }),
    ]);
    if (plRes.ok) {
      const data = await plRes.json();
      setPlaylists(data.playlists ?? []);
      if ((data.playlists ?? []).length > 0 && !activeId) {
        setActiveId(data.playlists[0].id);
      }
    }
    if (favRes.ok) {
      const f = await favRes.json();
      setFavorites(f.favorites ?? []);
      setRecents(f.recents ?? []);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // HLS Preview Player
  useEffect(() => {
    const el = videoRef.current;
    setPreviewError(null);
    if (!el || !previewChannel) return;

    let hls: Hls | null = null;
    if (previewChannel.url.toLowerCase().includes('.m3u8') && Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: true });
      hls.loadSource(previewChannel.url);
      hls.attachMedia(el);
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setPreviewError('Yayın akışına erişilemedi veya akış çevrimdışı.');
        }
      });
    } else {
      el.src = previewChannel.url;
    }
    el.play().catch(() => {});

    fetch('/api/iptv/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'recent', channel: previewChannel }),
    }).catch(() => {});

    return () => {
      hls?.destroy();
    };
  }, [previewChannel]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setFormText(text);
    if (!formName) setFormName(file.name.replace(/\.(m3u8?|txt)$/i, ''));
  };

  const handleAddPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setLoading(true);
    try {
      const res = await fetch('/api/iptv/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName || 'Benim IPTV Listem',
          sourceUrl: inputMode === 'url' ? formUrl : undefined,
          m3uText: inputMode !== 'url' ? formText : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg(data.error || 'Playlist eklenemedi.');
        return;
      }
      setFormName('');
      setFormUrl('');
      setFormText('');
      setActiveId(data.playlist.id);
      setStatusMsg(`${data.playlist.channels.length} kanal başarıyla ayrıştırıldı.`);
      await loadAll();
    } catch {
      setStatusMsg('Bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    await fetch(`/api/iptv/playlists?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    setActiveId('');
    await loadAll();
  };

  const toggleFavorite = async (ch: IptvChannel) => {
    await fetch('/api/iptv/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'favorite', channel: ch }),
    });
    await loadAll();
  };

  const activePlaylist = playlists.find((p) => p.id === activeId) ?? playlists[0];
  const groups = activePlaylist
    ? ['Tümü', 'Favoriler', 'Son İzlenen', ...Array.from(new Set(activePlaylist.channels.map((c) => c.group)))]
    : ['Tümü', 'Favoriler', 'Son İzlenen'];

  const sourceList =
    group === 'Favoriler'
      ? favorites
      : group === 'Son İzlenen'
        ? recents
        : activePlaylist?.channels ?? [];

  const filtered = sourceList.filter((ch) => {
    if (group !== 'Tümü' && group !== 'Favoriler' && group !== 'Son İzlenen' && ch.group !== group) {
      return false;
    }
    if (search.trim() && !ch.name.toLowerCase().includes(search.trim().toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#090A0F]">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-semibold text-white">IPTV M3U / M3U8 Merkezi</h1>
            <p className="mt-1 text-xs text-zinc-400">
              Kendi sağladığınız yasal ve telif haklarına uygun M3U/M3U8 yayın listelerinizi
              yönetin ve 3D odalarda arkadaşlarınızla izleyin.
            </p>
          </div>
          <Link
            href="/?create=1"
            className="inline-flex items-center gap-2 rounded-xl bg-[#7C5CFF] px-4 py-2 text-xs font-medium text-white hover:bg-[#6D4AF5]"
          >
            <Plus className="h-4 w-4" />
            <span>IPTV İzleme Odası Aç</span>
          </Link>
        </div>

        {!user ? (
          <div className="rounded-2xl border border-white/10 bg-[#10121A] p-8 text-center">
            <Radio className="mx-auto h-8 w-8 text-[#7C5CFF]" />
            <p className="mt-3 text-sm font-medium text-white">
              Kişisel IPTV listelerinizi ve favorilerinizi saklamak için önce isminizi girin.
            </p>
            <Link
              href="/auth"
              className="mt-4 inline-block rounded-xl bg-[#7C5CFF] px-5 py-2.5 text-xs font-medium text-white"
            >
              İsim Gir
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left: Add & Manage Playlists */}
            <div className="space-y-4 lg:col-span-4">
              <form
                onSubmit={handleAddPlaylist}
                className="rounded-2xl border border-white/[0.08] bg-[#10121A] p-4 space-y-3"
              >
                <h2 className="text-sm font-semibold text-white">Yeni Playlist Ekle</h2>

                <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/[0.06] bg-[#090A0F] p-1">
                  {[
                    { id: 'url' as const, label: 'URL' },
                    { id: 'file' as const, label: 'Dosya' },
                    { id: 'text' as const, label: 'Metin' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setInputMode(m.id)}
                      className={`rounded-lg py-1.5 text-xs font-medium ${
                        inputMode === m.id ? 'bg-[#7C5CFF] text-white' : 'text-zinc-400'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Playlist Adı"
                  className="w-full rounded-xl border border-white/10 bg-[#090A0F] px-3 py-2 text-xs text-white"
                />

                {inputMode === 'url' && (
                  <input
                    type="url"
                    required
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    placeholder="https://ornek.com/liste.m3u8"
                    className="w-full rounded-xl border border-white/10 bg-[#090A0F] px-3 py-2 text-xs text-white"
                  />
                )}

                {inputMode === 'file' && (
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-[#090A0F] py-5 text-xs text-zinc-400 hover:border-[#7C5CFF]">
                    <Upload className="h-4 w-4" />
                    <span>.m3u veya .m3u8 dosyası seç</span>
                    <input
                      type="file"
                      accept=".m3u,.m3u8,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                )}

                {inputMode === 'text' && (
                  <textarea
                    rows={5}
                    value={formText}
                    onChange={(e) => setFormText(e.target.value)}
                    placeholder="#EXTM3U&#10;#EXTINF:-1,Kanal Adı&#10;https://..."
                    className="w-full rounded-xl border border-white/10 bg-[#090A0F] p-3 font-mono text-[11px] text-white"
                  />
                )}

                {statusMsg && <p className="text-xs text-zinc-300">{statusMsg}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-[#7C5CFF] py-2.5 text-xs font-medium text-white hover:bg-[#6D4AF5] disabled:opacity-50"
                >
                  {loading ? 'Ayrıştırılıyor...' : 'Playlisti İçe Aktar'}
                </button>
              </form>

              <div className="rounded-2xl border border-white/[0.08] bg-[#10121A] p-4">
                <h2 className="mb-3 text-sm font-semibold text-white">Kayıtlı Listeler</h2>
                {playlists.length === 0 ? (
                  <p className="text-xs text-zinc-500">Henüz kayıtlı liste yok.</p>
                ) : (
                  <div className="space-y-2">
                    {playlists.map((pl) => (
                      <div
                        key={pl.id}
                        className={`flex items-center justify-between rounded-xl border p-2.5 ${
                          activePlaylist?.id === pl.id
                            ? 'border-[#7C5CFF] bg-[#7C5CFF]/10'
                            : 'border-white/[0.06] bg-[#090A0F]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveId(pl.id);
                            setGroup('Tümü');
                          }}
                          className="flex-1 text-left"
                        >
                          <p className="text-xs font-semibold text-white">{pl.name}</p>
                          <p className="text-[11px] text-zinc-400">
                            {pl.channels.length} kanal
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePlaylist(pl.id)}
                          className="p-1.5 text-zinc-500 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Preview + Channel Grid */}
            <div className="space-y-4 lg:col-span-8">
              {previewChannel && (
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
                  <div className="flex items-center justify-between bg-[#10121A] px-4 py-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="font-semibold text-white">{previewChannel.name}</span>
                      <span className="text-zinc-400">· {previewChannel.group}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewChannel(null)}
                      className="text-zinc-400 hover:text-white"
                    >
                      Kapat
                    </button>
                  </div>
                  <div className="relative aspect-video bg-black">
                    <video
                      ref={videoRef}
                      controls
                      playsInline
                      className="h-full w-full object-contain"
                    />
                    {previewError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-4 text-center text-xs text-amber-300">
                        <AlertCircle className="mb-2 h-6 w-6" />
                        {previewError}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-white/[0.08] bg-[#10121A] p-4">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Kanal ara..."
                      className="w-full rounded-xl border border-white/10 bg-[#090A0F] py-2 pl-9 pr-3 text-xs text-white"
                    />
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {groups.slice(0, 10).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGroup(g)}
                        className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                          group === g
                            ? 'bg-[#7C5CFF] text-white'
                            : 'bg-[#090A0F] text-zinc-400 hover:text-white'
                        }`}
                      >
                        {g === 'Son İzlenen' ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {g}
                          </span>
                        ) : (
                          g
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {filtered.length === 0 ? (
                  <p className="py-12 text-center text-xs text-zinc-500">
                    Görüntülenecek kanal bulunamadı.
                  </p>
                ) : (
                  <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3">
                    {filtered.slice(0, 90).map((ch) => {
                      const isFav = favorites.some((f) => f.id === ch.id);
                      return (
                        <div
                          key={ch.id}
                          className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-[#090A0F] p-2.5 hover:border-white/20"
                        >
                          <button
                            type="button"
                            onClick={() => setPreviewChannel(ch)}
                            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#151823] text-[10px] text-zinc-400">
                              {ch.logo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={ch.logo} alt="" className="h-full w-full object-contain" />
                              ) : (
                                <Play className="h-3.5 w-3.5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-white">{ch.name}</p>
                              <p className="truncate text-[10px] text-zinc-500">{ch.group}</p>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleFavorite(ch)}
                            className="p-1.5 text-zinc-500 hover:text-rose-400"
                          >
                            <Heart
                              className={`h-3.5 w-3.5 ${
                                isFav ? 'fill-rose-500 text-rose-500' : ''
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
