'use client';

import { useEffect, useState } from 'react';
import {
  AdminActionType,
  IptvChannel,
  IptvPlaylist,
  PlayerState,
  QueueItem,
  ROOM_THEME_LIST,
  RoomCustomization,
  RoomThemeId,
  SpatialVoiceSettings,
  VideoSourceType,
  VideoState,
  ChatMessage,
  GraphicsQuality,
  extractYouTubeId,
} from '@luma/shared';
import {
  Armchair,
  Check,
  Crown,
  Heart,
  ListVideo,
  Lock,
  Megaphone,
  Mic,
  MicOff,
  Pin,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Send,
  Shield,
  Sliders,
  Trash2,
  Unlock,
  UserX,
  Volume2,
  VolumeX,
  X,
  Tv,
  Film,
  SkipForward,
  Ban,
  Globe,
  MonitorUp,
} from 'lucide-react';
import { useLumaStore } from '@/stores/useLumaStore';

export type ActiveDrawer = 'none' | 'media' | 'social' | 'customize' | 'admin' | 'settings';

interface RoomHudDrawersProps {
  drawer: ActiveDrawer;
  onClose: () => void;
  localPlayer: PlayerState | null;
  players: PlayerState[];
  customization: RoomCustomization;
  video: VideoState | null;
  screenShareActive?: boolean;
  screenShareName?: string | null;
  isLocalScreenSharer?: boolean;
  onToggleScreenShare?: () => void;
  onOpenWebBrowser?: () => void;
  queue: QueueItem[];
  chatHistory: ChatMessage[];
  onLoadVideo: (payload: {
    sourceType: VideoSourceType;
    url: string;
    title: string;
    channelLogo?: string;
    isLive?: boolean;
  }) => void;
  onAddQueue: (payload: {
    sourceType: VideoSourceType;
    url: string;
    title: string;
    channelLogo?: string;
    isLive?: boolean;
  }) => void;
  onRemoveQueue: (id: string) => void;
  onPlayNextQueue: () => void;
  onToggleHostLock: (locked: boolean) => void;
  onSendChat: (text: string) => void;
  onReactChat: (messageId: string, emoji: string) => void;
  onPinChat: (messageId: string) => void;
  onDeleteChat: (messageId: string) => void;
  onCustomizeRoom: (patch: Partial<RoomCustomization>) => void;
  onModAction: (
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
  ) => void;
  onAdminAction?: (action: AdminActionType, message?: string) => void;
  onUpdateSpatialSettings: (patch: Partial<SpatialVoiceSettings>) => void;
  onUpdateGraphicsQuality: (q: GraphicsQuality) => void;
}

const QUICK_EMOJIS = ['👍', '🔥', '❤️', '😂', '👏', '🎬'];

export function RoomHudDrawers({
  drawer,
  onClose,
  localPlayer,
  players,
  customization,
  video,
  screenShareActive = false,
  screenShareName = null,
  isLocalScreenSharer = false,
  onToggleScreenShare,
  onOpenWebBrowser,
  queue,
  chatHistory,
  onLoadVideo,
  onAddQueue,
  onRemoveQueue,
  onPlayNextQueue,
  onToggleHostLock,
  onSendChat,
  onReactChat,
  onPinChat,
  onDeleteChat,
  onCustomizeRoom,
  onModAction,
  onAdminAction,
  onUpdateSpatialSettings,
  onUpdateGraphicsQuality,
}: RoomHudDrawersProps) {
  if (drawer === 'none') return null;

  return (
    <aside className="fixed right-3 top-16 bottom-20 z-40 flex w-[calc(100%-1.5rem)] max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0D0F17]/95 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <span className="text-sm font-semibold text-white">
          {drawer === 'media'
            ? 'Medya, Web Tarayıcı & IPTV'
            : drawer === 'social'
              ? `Sohbet & Katılımcılar (${players.length})`
              : drawer === 'customize'
                ? 'Oda Özelleştirme'
                : drawer === 'admin'
                  ? 'Admin / Host Kontrol Merkezi'
                  : 'Ses & Grafik Ayarları'}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {drawer === 'media' && (
          <MediaDrawerContent
            localPlayer={localPlayer}
            video={video}
            screenShareActive={screenShareActive}
            screenShareName={screenShareName}
            isLocalScreenSharer={isLocalScreenSharer}
            onToggleScreenShare={onToggleScreenShare}
            onOpenWebBrowser={onOpenWebBrowser}
            queue={queue}
            onLoadVideo={onLoadVideo}
            onAddQueue={onAddQueue}
            onRemoveQueue={onRemoveQueue}
            onPlayNextQueue={onPlayNextQueue}
            onToggleHostLock={onToggleHostLock}
          />
        )}

        {drawer === 'social' && (
          <SocialDrawerContent
            localPlayer={localPlayer}
            players={players}
            chatHistory={chatHistory}
            onSendChat={onSendChat}
            onReactChat={onReactChat}
            onPinChat={onPinChat}
            onDeleteChat={onDeleteChat}
            onModAction={onModAction}
          />
        )}

        {drawer === 'customize' && (
          <CustomizeDrawerContent
            customization={customization}
            onCustomizeRoom={onCustomizeRoom}
          />
        )}

        {drawer === 'admin' && (
          <AdminDrawerContent
            localPlayer={localPlayer}
            players={players}
            customization={customization}
            video={video}
            onCustomizeRoom={onCustomizeRoom}
            onModAction={onModAction}
            onAdminAction={onAdminAction}
          />
        )}

        {drawer === 'settings' && (
          <SettingsDrawerContent
            onUpdateSpatialSettings={onUpdateSpatialSettings}
            onUpdateGraphicsQuality={onUpdateGraphicsQuality}
          />
        )}
      </div>
    </aside>
  );
}

function MediaDrawerContent({
  localPlayer,
  video,
  screenShareActive = false,
  screenShareName = null,
  isLocalScreenSharer = false,
  onToggleScreenShare,
  onOpenWebBrowser,
  queue,
  onLoadVideo,
  onAddQueue,
  onRemoveQueue,
  onPlayNextQueue,
  onToggleHostLock,
}: {
  localPlayer: PlayerState | null;
  video: VideoState | null;
  screenShareActive?: boolean;
  screenShareName?: string | null;
  isLocalScreenSharer?: boolean;
  onToggleScreenShare?: () => void;
  onOpenWebBrowser?: () => void;
  queue: QueueItem[];
  onLoadVideo: RoomHudDrawersProps['onLoadVideo'];
  onAddQueue: RoomHudDrawersProps['onAddQueue'];
  onRemoveQueue: RoomHudDrawersProps['onRemoveQueue'];
  onPlayNextQueue: RoomHudDrawersProps['onPlayNextQueue'];
  onToggleHostLock: RoomHudDrawersProps['onToggleHostLock'];
}) {
  const [tab, setTab] = useState<'url' | 'queue' | 'iptv'>('url');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaTitle, setMediaTitle] = useState('');
  const [sourceKind, setSourceKind] = useState<VideoSourceType | 'web'>('youtube');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolvedItems, setResolvedItems] = useState<
    Array<{ title: string; url: string; sourceType: VideoSourceType; quality?: string }>
  >([]);
  const [playlists, setPlaylists] = useState<IptvPlaylist[]>([]);
  const [favorites, setFavorites] = useState<IptvChannel[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('');
  const [iptvSearch, setIptvSearch] = useState('');
  const [iptvGroup, setIptvGroup] = useState('Tümü');
  const [quickM3uUrl, setQuickM3uUrl] = useState('');
  const [quickM3uName, setQuickM3uName] = useState('');
  const [iptvNotice, setIptvNotice] = useState<string | null>(null);

  const isPrivileged = localPlayer?.role === 'owner' || localPlayer?.role === 'moderator';
  const canControlVideo = localPlayer
    ? (localPlayer.canControlVideo ?? (isPrivileged || !video?.hostOnlyControl))
    : false;

  const loadIptv = async () => {
    try {
      const [plRes, favRes] = await Promise.all([
        fetch('/api/iptv/playlists', { cache: 'no-store' }),
        fetch('/api/iptv/favorites', { cache: 'no-store' }),
      ]);
      if (plRes.ok) {
        const d = await plRes.json();
        setPlaylists(d.playlists ?? []);
        if ((d.playlists ?? []).length > 0 && !selectedPlaylistId) {
          setSelectedPlaylistId(d.playlists[0].id);
        }
      }
      if (favRes.ok) {
        const f = await favRes.json();
        setFavorites(f.favorites ?? []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (tab === 'iptv') loadIptv();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const isTwitterOrWebUrl = (u: string) => {
    try {
      const parsed = new URL(u);
      const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
      if (host === 'x.com' || host === 'twitter.com' || host === 'mobile.twitter.com') {
        return true;
      }
      if (sourceKind === 'web') return true;
      return false;
    } catch {
      return false;
    }
  };

  const handleResolveMedia = async (autoPlayFirst = false, mode: 'play' | 'queue' = 'play') => {
    const trimmed = mediaUrl.trim();
    if (!trimmed) return;
    setResolving(true);
    setResolveError(null);
    setResolvedItems([]);
    try {
      const res = await fetch('/api/media/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResolveError(data.error || 'Video çözümlenemedi.');
        return;
      }
      const items = data.items ?? [];
      if (autoPlayFirst && items.length > 0) {
        const first = items[0];
        const payload = {
          sourceType: first.sourceType as VideoSourceType,
          url: first.url,
          title: mediaTitle.trim() || first.title,
          isLive: false,
        };
        if (mode === 'play') onLoadVideo(payload);
        else onAddQueue(payload);
        setMediaUrl('');
        setMediaTitle('');
        return;
      }
      setResolvedItems(items);
    } catch {
      setResolveError('Bağlantı hatası oluştu.');
    } finally {
      setResolving(false);
    }
  };

  const handleSubmitUrl = async (mode: 'play' | 'queue') => {
    const trimmed = mediaUrl.trim();
    if (!trimmed) return;

    if (isTwitterOrWebUrl(trimmed)) {
      await handleResolveMedia(true, mode);
      return;
    }

    let detected: VideoSourceType = sourceKind === 'web' ? 'mp4' : sourceKind;
    if (extractYouTubeId(trimmed)) detected = 'youtube';
    else if (trimmed.toLowerCase().includes('.m3u8')) detected = 'hls';

    const payload = {
      sourceType: detected,
      url: trimmed,
      title:
        mediaTitle.trim() ||
        (detected === 'youtube' ? 'YouTube Videosu' : detected === 'hls' ? 'HLS Yayını' : 'Video'),
      isLive: detected === 'iptv',
    };

    if (mode === 'play') onLoadVideo(payload);
    else onAddQueue(payload);

    setMediaUrl('');
    setMediaTitle('');
  };

  const handleQuickAddPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    setIptvNotice(null);
    const res = await fetch('/api/iptv/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: quickM3uName || 'Oda IPTV Listesi',
        sourceUrl: quickM3uUrl,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setIptvNotice(data.error || 'Playlist eklenemedi.');
      return;
    }
    setQuickM3uUrl('');
    setQuickM3uName('');
    setSelectedPlaylistId(data.playlist.id);
    await loadIptv();
  };

  const activePlaylist = playlists.find((p) => p.id === selectedPlaylistId) ?? playlists[0];
  const groups = activePlaylist
    ? ['Tümü', ...Array.from(new Set(activePlaylist.channels.map((c) => c.group)))]
    : ['Tümü'];

  const filteredChannels = (activePlaylist?.channels ?? []).filter((ch) => {
    if (iptvGroup !== 'Tümü' && ch.group !== iptvGroup) return false;
    if (iptvSearch.trim() && !ch.name.toLowerCase().includes(iptvSearch.trim().toLowerCase())) {
      return false;
    }
    return true;
  });

  const handleWatchChannel = async (ch: IptvChannel) => {
    onLoadVideo({
      sourceType: 'iptv',
      url: ch.url,
      title: ch.name,
      channelLogo: ch.logo,
      isLive: true,
    });
    fetch('/api/iptv/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'recent', channel: ch }),
    }).catch(() => {});
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/[0.07] bg-[#090A0F] p-1">
        <button
          type="button"
          onClick={() => setTab('url')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition ${
            tab === 'url' ? 'bg-[#7C5CFF] text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Tv className="h-3.5 w-3.5" />
          <span>URL / Video</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('queue')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition ${
            tab === 'queue' ? 'bg-[#7C5CFF] text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <ListVideo className="h-3.5 w-3.5" />
          <span>Sıra ({queue.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('iptv')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition ${
            tab === 'iptv' ? 'bg-[#7C5CFF] text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Radio className="h-3.5 w-3.5" />
          <span>IPTV</span>
        </button>
      </div>

      {isPrivileged && (
        <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-[#090A0F] px-3 py-2 text-xs">
          <div>
            <span className="text-zinc-200 font-medium">Genel Video Kontrolü</span>
            <p className="text-[10px] text-zinc-500">
              Katılımcılar sekmesinden kişi bazlı yetki de verebilirsin.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onToggleHostLock(!video?.hostOnlyControl)}
            className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 font-medium ${
              video?.hostOnlyControl
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-white/[0.06] text-zinc-300'
            }`}
          >
            {video?.hostOnlyControl ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            <span>{video?.hostOnlyControl ? 'Sadece Host & İzinliler' : 'Herkese Açık'}</span>
          </button>
        </div>
      )}

      {!canControlVideo && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <Lock className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <span>Video açma ve kontrol yetkiniz kısıtlı. Oda sahibi (Host) size izin vermelidir.</span>
        </div>
      )}

      {tab === 'url' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {[
              { id: 'youtube' as const, label: 'YouTube' },
              { id: 'web' as const, label: 'X / Web Link' },
              { id: 'mp4' as const, label: 'MP4' },
              { id: 'hls' as const, label: 'M3U8' },
            ].map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => {
                  setSourceKind(k.id);
                  setResolveError(null);
                }}
                className={`rounded-lg border py-1.5 text-xs font-medium ${
                  sourceKind === k.id
                    ? 'border-[#7C5CFF] bg-[#7C5CFF]/15 text-white'
                    : 'border-white/10 bg-[#090A0F] text-zinc-400'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder={
              sourceKind === 'youtube'
                ? 'https://www.youtube.com/watch?v=...'
                : sourceKind === 'web'
                  ? 'https://x.com/.../status/... veya film sayfası linki'
                  : 'https://.../video.mp4 veya stream.m3u8'
            }
            className="w-full rounded-xl border border-white/10 bg-[#090A0F] px-3 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:border-[#7C5CFF] focus:outline-none"
          />

          <input
            type="text"
            value={mediaTitle}
            onChange={(e) => setMediaTitle(e.target.value)}
            placeholder="Başlık (İsteğe bağlı)"
            className="w-full rounded-xl border border-white/10 bg-[#090A0F] px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-[#7C5CFF] focus:outline-none"
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={resolving || !canControlVideo}
              onClick={() => handleSubmitUrl('play')}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-[#7C5CFF] py-2.5 text-xs font-medium text-white hover:bg-[#6D4AF5] disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              <span>{resolving ? 'Bulunuyor...' : 'Şimdi Oynat'}</span>
            </button>
            {sourceKind === 'web' ? (
              <button
                type="button"
                disabled={resolving || !canControlVideo}
                onClick={() => handleResolveMedia(false)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#151823] py-2.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.06] disabled:opacity-50"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>Videoları Tara</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={resolving || !canControlVideo}
                onClick={() => handleSubmitUrl('queue')}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#151823] py-2.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.06] disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Sıraya Ekle</span>
              </button>
            )}
          </div>

          {resolveError && (
            <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
              {resolveError}
            </p>
          )}

          {resolvedItems.length > 0 && (
            <div className="space-y-1.5 rounded-xl border border-white/10 bg-[#090A0F] p-2.5">
              <p className="text-[11px] font-medium text-zinc-300">
                Sayfada Bulunan Videolar ({resolvedItems.length})
              </p>
              {resolvedItems.map((item, idx) => (
                <div
                  key={`${item.url}-${idx}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-[#10121A] px-2.5 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-white">{item.title}</p>
                    <p className="truncate text-[10px] text-zinc-400">
                      {item.quality || item.sourceType.toUpperCase()}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        onLoadVideo({
                          sourceType: item.sourceType,
                          url: item.url,
                          title: mediaTitle.trim() || item.title,
                        })
                      }
                      className="rounded-lg bg-[#7C5CFF] px-2.5 py-1 text-[10px] font-medium text-white"
                    >
                      Oynat
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onAddQueue({
                          sourceType: item.sourceType,
                          url: item.url,
                          title: mediaTitle.trim() || item.title,
                        })
                      }
                      className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-zinc-300"
                    >
                      Sıra
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* In-App Co-Browser (No Screen Share Required) */}
          {onOpenWebBrowser && (
            <div className="rounded-xl border border-[#7C5CFF]/30 bg-[#7C5CFF]/[0.08] p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-white">
                <Globe className="h-3.5 w-3.5 text-[#A78BFA]" />
                Site İçi Tarayıcı (Ekran Paylaşmadan İzlet)
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">
                Film/dizi sitesine uygulama içinden gir, sayfayı kaydır ve seçtiğin videoyu tek tıkla 3D perdeye ver.
              </p>
              <button
                type="button"
                disabled={!canControlVideo}
                onClick={onOpenWebBrowser}
                className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#7C5CFF] py-2 text-xs font-medium text-white transition hover:bg-[#6D4AF5] disabled:opacity-45"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>Site İçi Tarayıcıyı Aç</span>
              </button>
            </div>
          )}

          {isLocalScreenSharer && onToggleScreenShare && (
            <button
              type="button"
              onClick={onToggleScreenShare}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-red-500/80 py-2 text-xs font-medium text-white hover:bg-red-500"
            >
              <MonitorUp className="h-3.5 w-3.5" />
              <span>Aktif Ekran Yayınını Durdur ({screenShareActive ? screenShareName || 'Aktif' : ''})</span>
            </button>
          )}
        </div>
      )}

      {tab === 'queue' && (
        <div className="space-y-3">
          {queue.length > 0 && (
            <button
              type="button"
              onClick={onPlayNextQueue}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#3B82F6] py-2 text-xs font-medium text-white hover:bg-[#2563EB]"
            >
              <SkipForward className="h-3.5 w-3.5" />
              <span>Sıradaki İçeriğe Geç</span>
            </button>
          )}
          {queue.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-[#090A0F] py-10 text-center text-xs text-zinc-500">
              <Film className="mx-auto mb-2 h-6 w-6 opacity-50" />
              Sırada bekleyen içerik yok.
            </div>
          ) : (
            <div className="space-y-2">
              {queue.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-[#090A0F] p-2.5"
                >
                  <div className="min-w-0 pr-2">
                    <p className="truncate text-xs font-medium text-white">
                      {idx + 1}. {item.title}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      {item.sourceType.toUpperCase()} · {item.addedByName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveQueue(item.id)}
                    className="rounded-md p-1 text-zinc-500 hover:bg-white/[0.06] hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'iptv' && (
        <div className="space-y-3">
          <form onSubmit={handleQuickAddPlaylist} className="space-y-2 rounded-xl border border-white/[0.07] bg-[#090A0F] p-3">
            <p className="text-[11px] font-medium text-zinc-300">Kendi M3U / M3U8 Listeni Ekle</p>
            <input
              type="text"
              value={quickM3uName}
              onChange={(e) => setQuickM3uName(e.target.value)}
              placeholder="Liste adı"
              className="w-full rounded-lg border border-white/10 bg-[#10121A] px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-600"
            />
            <div className="flex gap-1.5">
              <input
                type="url"
                required
                value={quickM3uUrl}
                onChange={(e) => setQuickM3uUrl(e.target.value)}
                placeholder="https://.../playlist.m3u8"
                className="flex-1 rounded-lg border border-white/10 bg-[#10121A] px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-600"
              />
              <button
                type="submit"
                className="rounded-lg bg-[#7C5CFF] px-3 py-1.5 text-xs font-medium text-white"
              >
                Ekle
              </button>
            </div>
            {iptvNotice && <p className="text-[11px] text-amber-300">{iptvNotice}</p>}
          </form>

          {playlists.length > 0 && (
            <>
              <select
                value={activePlaylist?.id || ''}
                onChange={(e) => setSelectedPlaylistId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#090A0F] px-3 py-2 text-xs text-white"
              >
                {playlists.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name} ({pl.channels.length} kanal)
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-500" />
                  <input
                    type="text"
                    value={iptvSearch}
                    onChange={(e) => setIptvSearch(e.target.value)}
                    placeholder="Kanal ara..."
                    className="w-full rounded-lg border border-white/10 bg-[#090A0F] py-1.5 pl-8 pr-2.5 text-xs text-white"
                  />
                </div>
                <select
                  value={iptvGroup}
                  onChange={(e) => setIptvGroup(e.target.value)}
                  className="max-w-[130px] rounded-lg border border-white/10 bg-[#090A0F] px-2 py-1.5 text-xs text-zinc-200"
                >
                  {groups.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {filteredChannels.slice(0, 120).map((ch) => {
                  const isFav = favorites.some((f) => f.id === ch.id);
                  return (
                    <div
                      key={ch.id}
                      className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#090A0F] p-2 hover:border-white/20"
                    >
                      <button
                        type="button"
                        onClick={() => handleWatchChannel(ch)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#151823] text-[10px] font-semibold text-zinc-400">
                          {ch.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={ch.logo} alt="" className="h-full w-full object-contain" />
                          ) : (
                            'TV'
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-white">{ch.name}</p>
                          <p className="truncate text-[10px] text-zinc-500">{ch.group}</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch('/api/iptv/favorites', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ kind: 'favorite', channel: ch }),
                          });
                          loadIptv();
                        }}
                        className="p-1.5 text-zinc-500 hover:text-rose-400"
                      >
                        <Heart
                          className={`h-3.5 w-3.5 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SocialDrawerContent({
  localPlayer,
  players,
  chatHistory,
  onSendChat,
  onReactChat,
  onPinChat,
  onDeleteChat,
  onModAction,
}: {
  localPlayer: PlayerState | null;
  players: PlayerState[];
  chatHistory: ChatMessage[];
  onSendChat: RoomHudDrawersProps['onSendChat'];
  onReactChat: RoomHudDrawersProps['onReactChat'];
  onPinChat: RoomHudDrawersProps['onPinChat'];
  onDeleteChat: RoomHudDrawersProps['onDeleteChat'];
  onModAction: RoomHudDrawersProps['onModAction'];
}) {
  const [subTab, setSubTab] = useState<'chat' | 'peers'>('chat');
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);

  const peerDistances = useLumaStore((s) => s.peerDistances);
  const peerVolumes = useLumaStore((s) => s.peerVolumes);
  const peerLocalMutes = useLumaStore((s) => s.peerLocalMutes);
  const blockedUserIds = useLumaStore((s) => s.blockedUserIds);
  const setPeerVolume = useLumaStore((s) => s.setPeerVolume);
  const togglePeerLocalMute = useLumaStore((s) => s.togglePeerLocalMute);
  const toggleBlockUser = useLumaStore((s) => s.toggleBlockUser);

  const isPrivileged = localPlayer?.role === 'owner' || localPlayer?.role === 'moderator';
  const pinnedMsgs = chatHistory.filter((m) => m.pinned);
  const visibleChat = chatHistory.filter((m) => !blockedUserIds.includes(m.userId));

  const submitChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendChat(text.trim());
    setText('');
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.07] bg-[#090A0F] p-1">
        <button
          type="button"
          onClick={() => setSubTab('chat')}
          className={`rounded-lg py-1.5 text-xs font-medium ${
            subTab === 'chat' ? 'bg-[#7C5CFF] text-white' : 'text-zinc-400'
          }`}
        >
          Oda Sohbeti
        </button>
        <button
          type="button"
          onClick={() => setSubTab('peers')}
          className={`rounded-lg py-1.5 text-xs font-medium ${
            subTab === 'peers' ? 'bg-[#7C5CFF] text-white' : 'text-zinc-400'
          }`}
        >
          Katılımcılar & Ses ({players.length})
        </button>
      </div>

      {subTab === 'chat' ? (
        <div className="flex flex-1 flex-col justify-between gap-2 overflow-hidden">
          {pinnedMsgs.length > 0 && (
            <div className="rounded-xl border border-[#7C5CFF]/30 bg-[#7C5CFF]/10 px-3 py-2 text-xs">
              <p className="flex items-center gap-1 font-medium text-[#C4B5FD]">
                <Pin className="h-3 w-3" /> Sabitlenen Mesaj
              </p>
              <p className="mt-0.5 text-zinc-200">{pinnedMsgs[pinnedMsgs.length - 1].content}</p>
            </div>
          )}

          <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
            {visibleChat.length === 0 ? (
              <p className="py-12 text-center text-xs text-zinc-500">
                Henüz mesaj yok. Selam vererek başla!
              </p>
            ) : (
              visibleChat.map((m) => (
                <div
                  key={m.id}
                  className="group rounded-xl border border-white/[0.06] bg-[#090A0F] p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-zinc-200">{m.displayName}</span>
                    <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      {isPrivileged && (
                        <button
                          type="button"
                          onClick={() => onPinChat(m.id)}
                          title="Sabitle"
                          className="rounded p-1 text-zinc-500 hover:text-[#7C5CFF]"
                        >
                          <Pin className="h-3 w-3" />
                        </button>
                      )}
                      {(m.userId === localPlayer?.userId || isPrivileged) && (
                        <button
                          type="button"
                          onClick={() => onDeleteChat(m.id)}
                          title="Sil"
                          className="rounded p-1 text-zinc-500 hover:text-red-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 break-words text-xs text-zinc-300">{m.content}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {Object.entries(m.reactions).map(([emoji, uids]) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => onReactChat(m.id, emoji)}
                        className={`rounded-full border px-1.5 py-0.5 text-[10px] ${
                          localPlayer && uids.includes(localPlayer.userId)
                            ? 'border-[#7C5CFF]/60 bg-[#7C5CFF]/20 text-white'
                            : 'border-white/10 bg-white/[0.03] text-zinc-400'
                        }`}
                      >
                        {emoji} {uids.length}
                      </button>
                    ))}
                    {QUICK_EMOJIS.slice(0, 3).map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => onReactChat(m.id, em)}
                        className="rounded px-1 text-[10px] opacity-0 transition hover:bg-white/10 group-hover:opacity-75"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-1.5 border-t border-white/[0.06] pt-2">
            {emojiOpen && (
              <div className="flex flex-wrap gap-1.5 rounded-xl border border-white/10 bg-[#090A0F] p-2">
                {QUICK_EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => {
                      setText((prev) => `${prev}${em}`);
                      setEmojiOpen(false);
                    }}
                    className="rounded-md px-1.5 py-0.5 text-sm hover:bg-white/10"
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={submitChat} className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setEmojiOpen((o) => !o)}
                className="rounded-xl border border-white/10 bg-[#090A0F] px-2.5 text-sm"
              >
                😊
              </button>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Mesaj yaz..."
                className="flex-1 rounded-xl border border-white/10 bg-[#090A0F] px-3 py-2 text-xs text-white focus:border-[#7C5CFF] focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-xl bg-[#7C5CFF] px-3 text-white hover:bg-[#6D4AF5]"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {players.map((p) => {
            const isSelf = p.id === localPlayer?.id;
            const dist = peerDistances[p.id];
            const vol = peerVolumes[p.userId] ?? 1;
            const localMuted = Boolean(peerLocalMutes[p.userId]);
            const blocked = blockedUserIds.includes(p.userId);
            const zoneLabel =
              dist === undefined
                ? ''
                : dist <= 3
                  ? `${dist}m · Net`
                  : dist <= 8
                    ? `${dist}m · Normal`
                    : dist <= 15
                      ? `${dist}m · Azalan`
                      : `${dist}m · Menzil Dışı`;

            return (
              <div
                key={p.id}
                className="rounded-xl border border-white/[0.07] bg-[#090A0F] p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        p.isSpeaking ? 'bg-emerald-400' : 'bg-zinc-600'
                      }`}
                    />
                    <span className="text-xs font-semibold text-white">
                      {p.displayName} {isSelf ? '(Sen)' : ''}
                    </span>
                    {p.role === 'owner' && <Crown className="h-3.5 w-3.5 text-amber-400" />}
                    {p.role === 'moderator' && <Shield className="h-3.5 w-3.5 text-[#7C5CFF]" />}
                  </div>

                  <div className="flex items-center gap-2">
                    {zoneLabel && (
                      <span className="font-mono text-[10px] text-zinc-400">{zoneLabel}</span>
                    )}
                    {p.micEnabled && !p.mutedByMod ? (
                      <Mic className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <MicOff className="h-3.5 w-3.5 text-zinc-500" />
                    )}
                  </div>
                </div>

                {!isSelf && (
                  <div className="mt-2.5 space-y-2 border-t border-white/[0.05] pt-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => togglePeerLocalMute(p.userId)}
                        className="rounded-md bg-white/[0.05] p-1 text-zinc-300 hover:text-white"
                        title={localMuted ? 'Sesini Aç' : 'Bende Sustur'}
                      >
                        {localMuted ? (
                          <VolumeX className="h-3.5 w-3.5 text-red-400" />
                        ) : (
                          <Volume2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={1.5}
                        step={0.05}
                        value={localMuted ? 0 : vol}
                        onChange={(e) => setPeerVolume(p.userId, Number(e.target.value))}
                        className="flex-1 accent-[#7C5CFF]"
                      />
                      <span className="w-8 text-right font-mono text-[10px] text-zinc-400">
                        {Math.round((localMuted ? 0 : vol) * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleBlockUser(p.userId)}
                        title={blocked ? 'Engeli Kaldır' : 'Engelle'}
                        className={`rounded-md p-1 ${
                          blocked ? 'bg-red-500/20 text-red-300' : 'text-zinc-500 hover:text-red-400'
                        }`}
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {isPrivileged && (
                      <div className="flex flex-wrap gap-1.5">
                        {p.role === 'member' && (
                          <button
                            type="button"
                            onClick={() =>
                              onModAction(
                                p.id,
                                p.canControlVideo ? 'deny_video' : 'allow_video',
                              )
                            }
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-medium transition ${
                              p.canControlVideo
                                ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                                : 'border-amber-500/35 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                            }`}
                          >
                            {p.canControlVideo ? 'Video İzni: Açık' : 'Video İzni: Kapalı'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            onModAction(p.id, p.mutedByMod ? 'unmute_voice' : 'mute_voice')
                          }
                          className="rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-white/10"
                        >
                          {p.mutedByMod ? 'Sesi Aç' : 'Mikrofonu Kilitle'}
                        </button>
                        {p.seatedSeatId && (
                          <button
                            type="button"
                            onClick={() => onModAction(p.id, 'kick_seat')}
                            className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-white/10"
                          >
                            <Armchair className="h-3 w-3" /> Kaldır
                          </button>
                        )}
                        {localPlayer?.role === 'owner' && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                onModAction(
                                  p.id,
                                  p.role === 'moderator' ? 'demote_mod' : 'promote_mod',
                                )
                              }
                              className="rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-white/10"
                            >
                              {p.role === 'moderator' ? 'Mod Al' : 'Mod Yap'}
                            </button>
                            <button
                              type="button"
                              onClick={() => onModAction(p.id, 'transfer_owner')}
                              className="rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-amber-300 hover:bg-amber-500/10"
                            >
                              Odayı Devret
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => onModAction(p.id, 'kick')}
                          className="flex items-center gap-1 rounded-md border border-red-500/30 px-2 py-0.5 text-[10px] text-red-300 hover:bg-red-500/10"
                        >
                          <UserX className="h-3 w-3" /> At
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CustomizeDrawerContent({
  customization,
  onCustomizeRoom,
}: {
  customization: RoomCustomization;
  onCustomizeRoom: (patch: Partial<RoomCustomization>) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-medium text-zinc-300">Oda Teması (10 Ortam)</p>
        <div className="grid grid-cols-2 gap-1.5">
          {ROOM_THEME_LIST.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                const defaultLayout =
                  t.id === 'beach-house'
                    ? 'circle'
                    : t.id === 'modern-lounge' || t.id === 'neon-city'
                      ? 'lounge-u'
                      : t.id === 'luxury-home'
                        ? 'duo-rows'
                        : 'theater';
                onCustomizeRoom({
                  theme: t.id as RoomThemeId,
                  lightColor: t.defaultLightColor,
                  ambientIntensity: t.defaultAmbient,
                  seatLayout: defaultLayout,
                });
              }}
              className={`rounded-xl border px-2.5 py-2 text-left text-xs transition ${
                customization.theme === t.id
                  ? 'border-[#7C5CFF] bg-[#7C5CFF]/15 text-white'
                  : 'border-white/[0.08] bg-[#090A0F] text-zinc-400 hover:text-white'
              }`}
            >
              <span className="block font-medium">{t.name}</span>
              <span className="text-[10px] text-zinc-500">{t.badge}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-zinc-300">Koltuk Düzeni</p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { id: 'theater' as const, label: 'Sinema Sıraları' },
            { id: 'lounge-u' as const, label: 'U Lounge' },
            { id: 'circle' as const, label: 'Yarım Çember' },
            { id: 'duo-rows' as const, label: 'İkili VIP' },
          ].map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => onCustomizeRoom({ seatLayout: l.id })}
              className={`rounded-xl border py-2 text-xs ${
                customization.seatLayout === l.id
                  ? 'border-[#7C5CFF] bg-[#7C5CFF]/15 text-white'
                  : 'border-white/10 bg-[#090A0F] text-zinc-400'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-zinc-300">Işık Rengi</p>
        <div className="flex flex-wrap gap-2">
          {['#7C5CFF', '#3B82F6', '#38BDF8', '#A78BFA', '#D97706', '#10B981', '#EC4899'].map(
            (c) => (
              <button
                key={c}
                type="button"
                onClick={() => onCustomizeRoom({ lightColor: c })}
                className={`h-7 w-7 rounded-full border-2 ${
                  customization.lightColor === c ? 'border-white' : 'border-white/20'
                }`}
                style={{ backgroundColor: c }}
              />
            ),
          )}
        </div>
      </div>

      <div>
        <div className="mb-1 flex justify-between text-xs text-zinc-300">
          <span>Ortam Işığı</span>
          <span className="font-mono">{Math.round(customization.ambientIntensity * 100)}%</span>
        </div>
        <input
          type="range"
          min={0.15}
          max={1.1}
          step={0.05}
          value={customization.ambientIntensity}
          onChange={(e) => onCustomizeRoom({ ambientIntensity: Number(e.target.value) })}
          className="w-full accent-[#7C5CFF]"
        />
      </div>

      <div>
        <div className="mb-1 flex justify-between text-xs text-zinc-300">
          <span>Perde Boyutu</span>
          <span className="font-mono">{Math.round(customization.screenScale * 100)}%</span>
        </div>
        <input
          type="range"
          min={0.8}
          max={1.25}
          step={0.05}
          value={customization.screenScale}
          onChange={(e) => onCustomizeRoom({ screenScale: Number(e.target.value) })}
          className="w-full accent-[#7C5CFF]"
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-zinc-300">Dekorasyon Seviyesi</p>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: 'minimal' as const, label: 'Minimal' },
            { id: 'classic' as const, label: 'Klasik' },
            { id: 'lush' as const, label: 'Zengin' },
          ].map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onCustomizeRoom({ decorPreset: d.id })}
              className={`rounded-lg border py-1.5 text-xs ${
                customization.decorPreset === d.id
                  ? 'border-[#7C5CFF] bg-[#7C5CFF]/15 text-white'
                  : 'border-white/10 bg-[#090A0F] text-zinc-400'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-zinc-300">Oda Ambiyans Müziği</p>
        <select
          value={customization.ambientMusic}
          onChange={(e) =>
            onCustomizeRoom({
              ambientMusic: e.target.value as RoomCustomization['ambientMusic'],
            })
          }
          className="w-full rounded-xl border border-white/10 bg-[#090A0F] px-3 py-2 text-xs text-white"
        >
          <option value="none">Kapalı</option>
          <option value="lofi-cinema">Lo-Fi Sinema Pad</option>
          <option value="deep-ambient">Derin Ambiyans</option>
          <option value="synth-soft">Yumuşak Synth</option>
        </select>
      </div>

      <div>
        <div className="mb-1 flex justify-between text-xs text-zinc-300">
          <span>Konumsal Ses Menzili</span>
          <span className="font-mono">{customization.spatialVoiceMaxDistance}m</span>
        </div>
        <input
          type="range"
          min={8}
          max={28}
          step={1}
          value={customization.spatialVoiceMaxDistance}
          onChange={(e) => onCustomizeRoom({ spatialVoiceMaxDistance: Number(e.target.value) })}
          className="w-full accent-[#7C5CFF]"
        />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#090A0F] p-3 text-xs">
        <span className="text-zinc-200">Odayı Kilitle</span>
        <button
          type="button"
          onClick={() => onCustomizeRoom({ locked: !customization.locked })}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1 font-medium ${
            customization.locked ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-zinc-300'
          }`}
        >
          {customization.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          <span>{customization.locked ? 'Kilitli' : 'Açık'}</span>
        </button>
      </div>
    </div>
  );
}

function SettingsDrawerContent({
  onUpdateSpatialSettings,
  onUpdateGraphicsQuality,
}: {
  onUpdateSpatialSettings: (patch: Partial<SpatialVoiceSettings>) => void;
  onUpdateGraphicsQuality: (q: GraphicsQuality) => void;
}) {
  const spatial = useLumaStore((s) => s.spatialSettings);
  const graphics = useLumaStore((s) => s.graphicsQuality);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices
      .enumerateDevices()
      .then((list) => {
        setMics(list.filter((d) => d.kind === 'audioinput'));
        setOutputs(list.filter((d) => d.kind === 'audiooutput'));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-300">
          <Sliders className="h-3.5 w-3.5 text-[#7C5CFF]" /> Grafik Modu
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'high' as const, label: 'Yüksek (3D)' },
            { id: 'medium' as const, label: 'Orta (3D)' },
            { id: 'low' as const, label: 'Düşük (3D)' },
            { id: '2d-lite' as const, label: '3D Kapalı (2D)' },
          ].map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => onUpdateGraphicsQuality(q.id)}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${
                graphics === q.id
                  ? 'border-[#7C5CFF] bg-[#7C5CFF]/15 text-white'
                  : 'border-white/10 bg-[#090A0F] text-zinc-400'
              }`}
            >
              <span>{q.label}</span>
              {graphics === q.id && <Check className="h-3.5 w-3.5 text-[#7C5CFF]" />}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-300">Mikrofon Cihazı</label>
        <select
          value={spatial.micDeviceId}
          onChange={(e) => onUpdateSpatialSettings({ micDeviceId: e.target.value })}
          className="w-full rounded-xl border border-white/10 bg-[#090A0F] px-3 py-2 text-xs text-white"
        >
          <option value="default">Varsayılan Mikrofon</option>
          {mics.map((m, idx) => (
            <option key={m.deviceId || idx} value={m.deviceId}>
              {m.label || `Mikrofon ${idx + 1}`}
            </option>
          ))}
        </select>
      </div>

      {outputs.length > 0 && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-300">
            Ses Çıkış Cihazı
          </label>
          <select
            value={spatial.outputDeviceId}
            onChange={(e) => onUpdateSpatialSettings({ outputDeviceId: e.target.value })}
            className="w-full rounded-xl border border-white/10 bg-[#090A0F] px-3 py-2 text-xs text-white"
          >
            <option value="default">Varsayılan Hoparlör / Kulaklık</option>
            {outputs.map((o, idx) => (
              <option key={o.deviceId || idx} value={o.deviceId}>
                {o.label || `Çıkış ${idx + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2 rounded-xl border border-white/10 bg-[#090A0F] p-3 text-xs">
        {[
          { key: 'noiseSuppression' as const, label: 'Gürültü Azaltma' },
          { key: 'echoCancellation' as const, label: 'Yankı Engelleme (Echo Cancel)' },
          { key: 'autoGainControl' as const, label: 'Otomatik Kazanç (AGC)' },
        ].map((item) => (
          <label key={item.key} className="flex items-center justify-between text-zinc-300">
            <span>{item.label}</span>
            <input
              type="checkbox"
              checked={spatial[item.key]}
              onChange={(e) => onUpdateSpatialSettings({ [item.key]: e.target.checked })}
              className="h-4 w-4 accent-[#7C5CFF]"
            />
          </label>
        ))}
      </div>

      <div>
        <div className="mb-1 flex justify-between text-xs text-zinc-300">
          <span>Genel Konumsal Ses Düzeyi</span>
          <span className="font-mono">{Math.round(spatial.masterVolume * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1.5}
          step={0.05}
          value={spatial.masterVolume}
          onChange={(e) => onUpdateSpatialSettings({ masterVolume: Number(e.target.value) })}
          className="w-full accent-[#7C5CFF]"
        />
      </div>

      <div>
        <div className="mb-1 flex justify-between text-xs text-zinc-300">
          <span>Kişisel Ses Duyma Mesafesi</span>
          <span className="font-mono">{spatial.maxDistance}m</span>
        </div>
        <input
          type="range"
          min={8}
          max={30}
          step={1}
          value={spatial.maxDistance}
          onChange={(e) => onUpdateSpatialSettings({ maxDistance: Number(e.target.value) })}
          className="w-full accent-[#7C5CFF]"
        />
      </div>
    </div>
  );
}

function AdminDrawerContent({
  localPlayer,
  players,
  customization,
  video,
  onCustomizeRoom,
  onModAction,
  onAdminAction,
}: {
  localPlayer: PlayerState | null;
  players: PlayerState[];
  customization: RoomCustomization;
  video: VideoState | null;
  onCustomizeRoom: RoomHudDrawersProps['onCustomizeRoom'];
  onModAction: RoomHudDrawersProps['onModAction'];
  onAdminAction?: RoomHudDrawersProps['onAdminAction'];
}) {
  const [announceText, setAnnounceText] = useState('');
  const isOwner = localPlayer?.role === 'owner';
  const isPrivileged = isOwner || localPlayer?.role === 'moderator';

  if (!isPrivileged) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-200">
        Bu panel sadece Oda Sahibi (Host) ve Moderatörler içindir.
      </div>
    );
  }

  const sendAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = announceText.trim();
    if (!msg || !onAdminAction) return;
    onAdminAction('announce', msg);
    setAnnounceText('');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-200">
          <Crown className="h-3.5 w-3.5 text-amber-400" />
          <span>{isOwner ? 'Tam Host Yetkisi Aktif' : 'Moderatör Yetkisi Aktif'}</span>
        </p>
        <p className="mt-1 text-[11px] text-zinc-300">
          Odadaki ses, sohbet, koltuk, perde kontrolü ve tüm katılımcılar üzerinde tam yetkiye sahipsiniz.
        </p>
      </div>

      {/* Room-Wide Announcement */}
      <form onSubmit={sendAnnouncement} className="space-y-2 rounded-xl border border-white/10 bg-[#090A0F] p-3">
        <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-200">
          <Megaphone className="h-3.5 w-3.5 text-[#7C5CFF]" />
          <span>Tüm Odaya Sistem Duyurusu Gönder</span>
        </label>
        <div className="flex gap-2">
          <input
            value={announceText}
            onChange={(e) => setAnnounceText(e.target.value)}
            maxLength={160}
            placeholder="Örn: Birazdan film başlıyor!"
            className="flex-1 rounded-xl border border-white/10 bg-[#12141E] px-3 py-2 text-xs text-white outline-none focus:border-[#7C5CFF]"
          />
          <button
            type="submit"
            disabled={!announceText.trim()}
            className="rounded-xl bg-[#7C5CFF] px-3 py-2 text-xs font-medium text-white hover:bg-[#6D4AF5] disabled:opacity-45"
          >
            Yayınla
          </button>
        </div>
      </form>

      {/* Global Room Toggles & Actions */}
      <div className="space-y-2 rounded-xl border border-white/10 bg-[#090A0F] p-3">
        <p className="text-xs font-semibold text-zinc-200">Hızlı Oda Kontrolleri</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onAdminAction?.('mute_all_voice')}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-red-500/25 bg-red-500/10 px-2.5 py-2 text-[11px] font-medium text-red-200 hover:bg-red-500/20"
          >
            <MicOff className="h-3.5 w-3.5" /> Herkesi Sustur
          </button>
          <button
            type="button"
            onClick={() => onAdminAction?.('unmute_all_voice')}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-2 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/20"
          >
            <Mic className="h-3.5 w-3.5" /> Tüm Sesleri Aç
          </button>

          <button
            type="button"
            onClick={() =>
              onAdminAction?.(customization.chatLocked ? 'unlock_chat' : 'lock_chat')
            }
            className={`flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-[11px] font-medium ${
              customization.chatLocked
                ? 'border-amber-500/35 bg-amber-500/15 text-amber-200'
                : 'border-white/10 bg-[#12141E] text-zinc-200 hover:bg-white/10'
            }`}
          >
            {customization.chatLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {customization.chatLocked ? 'Sohbet Kilidini Aç' : 'Sohbeti Kilitle'}
          </button>

          <button
            type="button"
            onClick={() => onAdminAction?.('clear_chat')}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#12141E] px-2.5 py-2 text-[11px] font-medium text-zinc-200 hover:bg-white/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Sohbeti Temizle
          </button>

          <button
            type="button"
            onClick={() => onAdminAction?.('allow_all_video')}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#12141E] px-2.5 py-2 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/15"
          >
            <Unlock className="h-3.5 w-3.5" /> Video Kontrolünü Aç
          </button>

          <button
            type="button"
            onClick={() => onAdminAction?.('deny_all_video')}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#12141E] px-2.5 py-2 text-[11px] font-medium text-amber-300 hover:bg-amber-500/15"
          >
            <Lock className="h-3.5 w-3.5" /> Sadece Host Video
          </button>

          <button
            type="button"
            onClick={() => onAdminAction?.('eject_all_seats')}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#12141E] px-2.5 py-2 text-[11px] font-medium text-zinc-200 hover:bg-white/10"
          >
            <Armchair className="h-3.5 w-3.5" /> Koltukları Boşalt
          </button>

          <button
            type="button"
            onClick={() => onAdminAction?.('reset_video')}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-red-500/25 bg-red-500/10 px-2.5 py-2 text-[11px] font-medium text-red-200 hover:bg-red-500/20"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Perdeyi Sıfırla
          </button>
        </div>

        <label className="mt-2 flex items-center justify-between rounded-xl border border-white/[0.07] bg-[#12141E] px-3 py-2 text-xs text-zinc-200">
          <span>Odaya Yeni Girişi Kilitle ({customization.locked ? 'Kilitli' : 'Açık'})</span>
          <input
            type="checkbox"
            checked={Boolean(customization.locked)}
            onChange={(e) => onCustomizeRoom({ locked: e.target.checked })}
            className="h-4 w-4 accent-[#7C5CFF]"
          />
        </label>

        {video?.url && (
          <p className="truncate text-[10px] text-zinc-400">
            Şu an oynayan: <span className="text-zinc-200">{video.title}</span>
          </p>
        )}
      </div>

      {/* Per-User Full Control Matrix */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-zinc-200">
          Kullanıcı Yetki Yönetimi ({players.length})
        </p>
        {players.map((p) => {
          const isSelf = p.id === localPlayer?.id;
          return (
            <div
              key={p.id}
              className="rounded-xl border border-white/[0.08] bg-[#090A0F] p-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-white">{p.displayName}</span>
                  {p.role === 'owner' && <Crown className="h-3.5 w-3.5 text-amber-400" />}
                  {p.role === 'moderator' && <Shield className="h-3.5 w-3.5 text-[#7C5CFF]" />}
                </div>
                <span className="text-[10px] text-zinc-400">
                  {p.seatedSeatId ? 'Oturuyor' : 'Ayakta'}
                </span>
              </div>

              {!isSelf && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => onModAction(p.id, p.canControlVideo ? 'deny_video' : 'allow_video')}
                    className={`rounded-md border px-2 py-1 text-[10px] font-medium ${
                      p.canControlVideo
                        ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-300'
                        : 'border-amber-500/35 bg-amber-500/15 text-amber-300'
                    }`}
                  >
                    {p.canControlVideo ? 'Video İzni: Açık' : 'Video İzni: Kapalı'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onModAction(p.id, p.mutedByMod ? 'unmute_voice' : 'mute_voice')}
                    className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-zinc-200 hover:bg-white/10"
                  >
                    {p.mutedByMod ? 'Mikrofonu Aç' : 'Mikrofonu Kilitle'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onModAction(p.id, 'mute_chat')}
                    className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-zinc-200 hover:bg-white/10"
                  >
                    Sohbet Sustur
                  </button>
                  <button
                    type="button"
                    onClick={() => onModAction(p.id, 'unmute_chat')}
                    className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-zinc-200 hover:bg-white/10"
                  >
                    Sohbeti Aç
                  </button>
                  {p.seatedSeatId && (
                    <button
                      type="button"
                      onClick={() => onModAction(p.id, 'kick_seat')}
                      className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-zinc-200 hover:bg-white/10"
                    >
                      Koltuktan Kaldır
                    </button>
                  )}
                  {isOwner && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          onModAction(p.id, p.role === 'moderator' ? 'demote_mod' : 'promote_mod')
                        }
                        className="rounded-md border border-[#7C5CFF]/35 px-2 py-1 text-[10px] text-[#C4B5FD] hover:bg-[#7C5CFF]/15"
                      >
                        {p.role === 'moderator' ? 'Modu Al' : 'Mod Yap'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onModAction(p.id, 'transfer_owner')}
                        className="rounded-md border border-amber-500/35 px-2 py-1 text-[10px] text-amber-300 hover:bg-amber-500/15"
                      >
                        Host Devret
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => onModAction(p.id, 'kick')}
                    className="flex items-center gap-1 rounded-md border border-red-500/35 px-2 py-1 text-[10px] text-red-300 hover:bg-red-500/15"
                  >
                    <Ban className="h-3 w-3" /> Odadan At
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
