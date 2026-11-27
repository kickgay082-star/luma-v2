'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FriendSummary } from '@luma/shared';
import { ArrowRight, Check, Mail, UserPlus, Users, X } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { useLumaStore } from '@/stores/useLumaStore';

interface RoomInviteItem {
  id: string;
  roomId: string;
  roomCode: string;
  roomName: string;
  senderName: string;
  createdAt: number;
}

export default function FriendsPage() {
  const user = useLumaStore((s) => s.user);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [invites, setInvites] = useState<RoomInviteItem[]>([]);
  const [usernameInput, setUsernameInput] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch('/api/friends', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    setFriends(data.friends ?? []);
    setInvites(data.invites ?? []);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    const res = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', username: usernameInput }),
    });
    const data = await res.json();
    if (!res.ok) {
      setNotice(data.error || 'İstek gönderilemedi.');
      return;
    }
    setUsernameInput('');
    setNotice('Arkadaşlık isteği gönderildi.');
    await load();
  };

  const handleAction = async (action: 'accept' | 'remove', friendshipId: string) => {
    await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, friendshipId }),
    });
    await load();
  };

  const accepted = friends.filter((f) => f.status === 'accepted');
  const incoming = friends.filter((f) => f.status === 'pending_incoming');
  const outgoing = friends.filter((f) => f.status === 'pending_outgoing');

  return (
    <div className="min-h-screen bg-[#090A0F]">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold text-white">Arkadaşlar & Davetler</h1>
        <p className="mt-1 text-xs text-zinc-400">
          Arkadaş ekle, çevrimiçi durumlarını takip et ve bulundukları 3D odalara tek tıkla katıl.
        </p>

        {!user ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-[#10121A] p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-[#7C5CFF]" />
            <p className="mt-3 text-sm font-medium text-white">
              Arkadaş listeni yönetmek için giriş yapmalısın.
            </p>
            <Link
              href="/auth"
              className="mt-4 inline-block rounded-xl bg-[#7C5CFF] px-5 py-2.5 text-xs font-medium text-white"
            >
              Giriş Yap
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <form
              onSubmit={handleAdd}
              className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#10121A] p-4 sm:flex-row"
            >
              <input
                type="text"
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Arkadaşının kullanıcı adı (örn. deniz)"
                className="flex-1 rounded-xl border border-white/10 bg-[#090A0F] px-3.5 py-2 text-xs text-white focus:border-[#7C5CFF] focus:outline-none"
              />
              <button
                type="submit"
                className="flex items-center justify-center gap-2 rounded-xl bg-[#7C5CFF] px-5 py-2 text-xs font-medium text-white hover:bg-[#6D4AF5]"
              >
                <UserPlus className="h-4 w-4" />
                <span>Arkadaş Ekle</span>
              </button>
            </form>
            {notice && <p className="text-xs text-zinc-300">{notice}</p>}

            {invites.length > 0 && (
              <section className="rounded-2xl border border-[#7C5CFF]/30 bg-[#7C5CFF]/10 p-4">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                  <Mail className="h-4 w-4 text-[#C4B5FD]" /> Gelen Oda Davetleri
                </h2>
                <div className="space-y-2">
                  {invites.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between rounded-xl bg-[#090A0F] p-3"
                    >
                      <div>
                        <p className="text-xs font-medium text-white">{inv.roomName}</p>
                        <p className="text-[11px] text-zinc-400">
                          Davet eden: {inv.senderName} · #{inv.roomCode}
                        </p>
                      </div>
                      <Link
                        href={`/room/${inv.roomId}`}
                        className="rounded-lg bg-[#7C5CFF] px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Odaya Katıl
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {incoming.length > 0 && (
              <section className="rounded-2xl border border-white/[0.08] bg-[#10121A] p-4">
                <h2 className="mb-3 text-sm font-semibold text-white">Gelen İstekler</h2>
                <div className="space-y-2">
                  {incoming.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#090A0F] p-3"
                    >
                      <div>
                        <p className="text-xs font-semibold text-white">{f.displayName}</p>
                        <p className="font-mono text-[11px] text-zinc-500">@{f.username}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleAction('accept', f.id)}
                          className="rounded-lg bg-emerald-500/20 p-2 text-emerald-300 hover:bg-emerald-500/30"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAction('remove', f.id)}
                          className="rounded-lg bg-red-500/20 p-2 text-red-300 hover:bg-red-500/30"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-white/[0.08] bg-[#10121A] p-4">
              <h2 className="mb-3 text-sm font-semibold text-white">
                Arkadaş Listesi ({accepted.length})
              </h2>
              {accepted.length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-500">
                  Henüz arkadaşın yok. Kullanıcı adı yazarak ilk arkadaşını ekleyebilirsin.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {accepted.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-[#090A0F] p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            f.online ? 'bg-emerald-400' : 'bg-zinc-600'
                          }`}
                        />
                        <div>
                          <p className="text-xs font-semibold text-white">{f.displayName}</p>
                          <p className="text-[11px] text-zinc-400">
                            {f.currentRoomName ? `Odada: ${f.currentRoomName}` : `@${f.username}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {f.currentRoomId && (
                          <Link
                            href={`/room/${f.currentRoomId}`}
                            className="flex items-center gap-1 rounded-lg bg-[#3B82F6]/20 px-2.5 py-1.5 text-[11px] font-medium text-[#93C5FD]"
                          >
                            Katıl <ArrowRight className="h-3 w-3" />
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => handleAction('remove', f.id)}
                          className="rounded-lg p-1.5 text-zinc-500 hover:text-red-400"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {outgoing.length > 0 && (
                <div className="mt-4 border-t border-white/[0.06] pt-3">
                  <p className="mb-2 text-xs text-zinc-400">Bekleyen Giden İstekler</p>
                  <div className="flex flex-wrap gap-2">
                    {outgoing.map((f) => (
                      <span
                        key={f.id}
                        className="rounded-lg border border-white/10 bg-[#090A0F] px-2.5 py-1 text-xs text-zinc-300"
                      >
                        {f.displayName} (@{f.username})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
