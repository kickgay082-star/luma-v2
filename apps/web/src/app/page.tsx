'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Compass,
  Film,
  Hash,
  Lock,
  Play,
  Plus,
  Radio,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { ROOM_THEMES, RoomSummary, FriendSummary } from '@luma/shared';
import { Navbar } from '@/components/Navbar';
import { CreateRoomModal } from '@/components/CreateRoomModal';
import { useLumaStore } from '@/stores/useLumaStore';

const CATEGORY_TABS = [
  { id: 'all', label: 'Tümü' },
  { id: 'cinema', label: 'Sinema' },
  { id: 'lounge', label: 'Lounge' },
  { id: 'watch-party', label: 'Watch Party' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'iptv', label: 'IPTV / Canlı' },
];

function RoomCard({ room }: { room: RoomSummary }) {
  const theme = ROOM_THEMES[room.theme] ?? ROOM_THEMES['premium-cinema'];
  return (
    <Link
      href={`/room/${room.id}`}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.08] bg-[#10121A] p-4 transition duration-200 hover:border-white/20 hover:bg-[#141722]"
    >
      <div>
        <div
          className="relative mb-3.5 h-32 overflow-hidden rounded-xl border border-white/[0.06]"
          style={{
            background: room.thumbnailUrl
              ? `url(${room.thumbnailUrl}) center/cover`
              : `radial-gradient(circle at 75% 20%, ${theme.accentColor}26, transparent 60%), linear-gradient(145deg, ${theme.wallColor}, #0A0B10)`,
          }}
        >
          <div className="absolute inset-0 flex flex-col justify-between p-3">
            <div className="flex items-center justify-between">
              <span className="rounded-md border border-white/10 bg-black/50 px-2 py-0.5 text-[11px] font-medium text-zinc-200 backdrop-blur-sm">
                {theme.name}
              </span>
              <span className="flex items-center gap-1 rounded-md border border-white/10 bg-black/55 px-2 py-0.5 font-mono text-[11px] text-zinc-200">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    room.onlineCount > 0 ? 'bg-emerald-400' : 'bg-zinc-500'
                  }`}
                />
                {room.onlineCount}/{room.maxUsers}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] tracking-wider text-zinc-400">
                #{room.code}
              </span>
              {room.hasPassword && (
                <span className="flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-amber-300">
                  <Lock className="h-3 w-3" /> Şifreli
                </span>
              )}
            </div>
          </div>
        </div>

        <h3 className="line-clamp-1 text-base font-semibold text-white group-hover:text-[#C4B5FD]">
          {room.name}
        </h3>
        <p className="mt-1 line-clamp-2 min-h-[34px] text-xs leading-relaxed text-zinc-400">
          {room.description || theme.subtitle}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          {room.currentlyPlaying ? (
            <>
              <Play className="h-3.5 w-3.5 text-[#7C5CFF]" />
              <span className="max-w-[140px] truncate text-zinc-300">
                {room.currentlyPlaying}
              </span>
            </>
          ) : (
            <span>Sahip: {room.ownerName}</span>
          )}
        </div>
        <span className="flex items-center gap-1 text-xs font-medium text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-white">
          Katıl
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useLumaStore((s) => s.user);
  const [createOpen, setCreateOpen] = useState(false);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [popularRooms, setPopularRooms] = useState<RoomSummary[]>([]);
  const [recentRooms, setRecentRooms] = useState<RoomSummary[]>([]);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setCreateOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchQuery.trim()) params.set('q', searchQuery.trim());
        if (category !== 'all') params.set('category', category);

        const [roomsRes, friendsRes] = await Promise.all([
          fetch(`/api/rooms?${params.toString()}`, { cache: 'no-store' }),
          fetch('/api/friends', { cache: 'no-store' }),
        ]);

        if (roomsRes.ok && active) {
          const data = await roomsRes.json();
          setRooms(data.rooms ?? []);
          setPopularRooms(data.popularRooms ?? []);
          setRecentRooms(data.recentRooms ?? []);
        }
        if (friendsRes.ok && active) {
          const fData = await friendsRes.json();
          setFriends(fData.friends ?? []);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    const timer = setTimeout(load, 120);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, category, user?.id]);

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCode.trim();
    if (!cleaned) return;
    router.push(`/room/${encodeURIComponent(cleaned)}`);
  };

  const friendsInRooms = friends.filter(
    (f) => f.status === 'accepted' && f.online && f.currentRoomId,
  );

  return (
    <div className="min-h-screen bg-[#090A0F]">
      <Navbar onCreateRoomClick={() => setCreateOpen(true)} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Hero Bar */}
        <section className="rounded-2xl border border-white/[0.08] bg-[#10121A] p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full bg-[#7C5CFF]" />
                Gerçek Zamanlı 3D Sosyal Sinema Dünyası
              </div>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-4xl">
                Aynı salonda buluş, koltuğunu seç ve birlikte izle.
              </h1>
              <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
                Kişiselleştirilmiş 3D avatarınla odalarda dolaş, yakınsal konumsal ses ile
                konuş, YouTube ve IPTV M3U8 yayınlarını milisaniye senkronizasyonuyla izle.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="flex items-center gap-2 rounded-xl bg-[#7C5CFF] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#6D4AF5]"
                >
                  <Plus className="h-4 w-4" />
                  <span>3D Oda Oluştur</span>
                </button>
                <Link
                  href="/avatar"
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#151823] px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-white/20"
                >
                  <Sparkles className="h-4 w-4 text-[#7C5CFF]" />
                  <span>Avatar Stüdyosu</span>
                </Link>
                <Link
                  href="/iptv"
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#151823] px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-white/20"
                >
                  <Radio className="h-4 w-4 text-[#3B82F6]" />
                  <span>IPTV Listelerim</span>
                </Link>
              </div>
            </div>

            {/* Join by Code Box */}
            <div className="w-full max-w-sm rounded-xl border border-white/[0.08] bg-[#090A0F] p-4">
              <p className="text-xs font-medium text-zinc-300">Oda Koduyla Doğrudan Katıl</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Örnek kodlar: <span className="font-mono text-zinc-300">LUMA01</span>,{' '}
                <span className="font-mono text-zinc-300">LOUNGE</span>
              </p>
              <form onSubmit={handleJoinByCode} className="mt-3 flex gap-2">
                <div className="relative flex-1">
                  <Hash className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="Oda kodu veya ID"
                    className="w-full rounded-lg border border-white/10 bg-[#10121A] py-2 pl-9 pr-3 font-mono text-xs uppercase text-white placeholder:normal-case placeholder:text-zinc-600 focus:border-[#7C5CFF] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-lg bg-white px-3.5 py-2 text-xs font-semibold text-black transition hover:bg-zinc-200"
                >
                  Gir
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Friends in Rooms */}
        {friendsInRooms.length > 0 && (
          <section className="mt-8">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <Users className="h-4 w-4 text-[#3B82F6]" />
              <h2>Arkadaşlarının Bulunduğu Odalar</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {friendsInRooms.map((f) => (
                <Link
                  key={f.id}
                  href={`/room/${f.currentRoomId}`}
                  className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-[#10121A] p-3.5 transition hover:border-[#3B82F6]/40"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{f.displayName}</p>
                    <p className="text-xs text-zinc-400">{f.currentRoomName}</p>
                  </div>
                  <span className="rounded-lg bg-[#3B82F6]/15 px-2.5 py-1 text-xs font-medium text-[#93C5FD]">
                    Katıl
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Recent Rooms */}
        {recentRooms.length > 0 && (
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Son Ziyaret Ettiğin Odalar</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentRooms.slice(0, 3).map((room) => (
                <RoomCard key={`rec-${room.id}`} room={room} />
              ))}
            </div>
          </section>
        )}

        {/* Featured & Popular */}
        <section className="mt-8">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-[#7C5CFF]" />
              <h2 className="text-base font-semibold text-white">
                Popüler ve Öne Çıkan Odalar
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Oda ara..."
                  className="rounded-lg border border-white/10 bg-[#10121A] py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-zinc-500 focus:border-[#7C5CFF] focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-[#10121A] p-1">
                {CATEGORY_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCategory(tab.id)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      category === tab.id
                        ? 'bg-[#7C5CFF] text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-64 animate-pulse rounded-2xl border border-white/[0.06] bg-[#10121A]"
                />
              ))}
            </div>
          ) : rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-[#10121A] py-14 text-center">
              <Film className="h-8 w-8 text-zinc-600" />
              <p className="mt-3 text-sm font-medium text-zinc-300">
                Aramanızla eşleşen oda bulunamadı.
              </p>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mt-4 rounded-xl bg-[#7C5CFF] px-4 py-2 text-xs font-medium text-white"
              >
                Yeni Oda Oluştur
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(searchQuery || category !== 'all' ? rooms : popularRooms.length ? popularRooms : rooms).map(
                (room) => (
                  <RoomCard key={room.id} room={room} />
                ),
              )}
            </div>
          )}
        </section>
      </main>

      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#090A0F]" />}>
      <HomeContent />
    </Suspense>
  );
}
