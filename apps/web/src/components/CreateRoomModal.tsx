'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Lock, Globe, EyeOff, Users, Sparkles } from 'lucide-react';
import {
  ROOM_THEME_LIST,
  RoomCategory,
  RoomPrivacy,
  RoomThemeId,
} from '@luma/shared';
import { useLumaStore } from '@/stores/useLumaStore';

interface CreateRoomModalProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORIES: Array<{ id: RoomCategory; label: string }> = [
  { id: 'cinema', label: 'Sinema' },
  { id: 'lounge', label: 'Lounge & Sohbet' },
  { id: 'watch-party', label: 'Watch Party' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'iptv', label: 'IPTV / Canlı' },
];

export function CreateRoomModal({ open, onClose }: CreateRoomModalProps) {
  const router = useRouter();
  const user = useLumaStore((s) => s.user);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState<RoomThemeId>('premium-cinema');
  const [category, setCategory] = useState<RoomCategory>('cinema');
  const [privacy, setPrivacy] = useState<RoomPrivacy>('public');
  const [password, setPassword] = useState('');
  const [maxUsers, setMaxUsers] = useState(24);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/auth');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          theme,
          category,
          privacy,
          password: privacy === 'password' ? password : undefined,
          maxUsers,
          thumbnailUrl: thumbnailUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Oda oluşturulamadı.');
        return;
      }
      onClose();
      router.push(`/room/${data.room.id}`);
    } catch {
      setError('Bağlantı hatası oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#10121A] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Yeni 3D Oda Oluştur</h2>
            <p className="text-xs text-zinc-400">
              Odanız oluşturulduğunda doğrudan 3D sahneye aktarılırsınız.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!user && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-[#7C5CFF]/30 bg-[#7C5CFF]/10 px-4 py-3 text-xs text-zinc-200">
            <span>Kendi odanızı açmak için ücretsiz bir Luma hesabı oluşturun.</span>
            <button
              type="button"
              onClick={() => router.push('/auth')}
              className="rounded-lg bg-[#7C5CFF] px-3 py-1.5 font-medium text-white"
            >
              Giriş / Kayıt
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                Oda Adı
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn. Gece Sineması"
                className="w-full rounded-xl border border-white/10 bg-[#090A0F] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#7C5CFF] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                Oda Türü
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as RoomCategory)}
                className="w-full rounded-xl border border-white/10 bg-[#090A0F] px-3.5 py-2.5 text-sm text-white focus:border-[#7C5CFF] focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">
              Açıklama
            </label>
            <input
              type="text"
              maxLength={240}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bu odada ne izliyoruz veya konuşuyoruz?"
              className="w-full rounded-xl border border-white/10 bg-[#090A0F] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#7C5CFF] focus:outline-none"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-300">
                3D Oda Teması (10 Ortam)
              </label>
              <span className="text-[11px] text-zinc-500">Oda içinde canlı değiştirilebilir</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ROOM_THEME_LIST.map((t) => {
                const selected = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition ${
                      selected
                        ? 'border-[#7C5CFF] bg-[#7C5CFF]/15'
                        : 'border-white/[0.07] bg-[#090A0F] hover:border-white/20'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: t.accentColor }}
                      />
                      <span className="font-mono text-[10px] text-zinc-500">{t.badge}</span>
                    </div>
                    <span className="mt-1.5 text-xs font-medium text-white">{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                Gizlilik
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'public' as const, label: 'Herkese Açık', icon: Globe },
                  { id: 'private' as const, label: 'Davetli', icon: EyeOff },
                  { id: 'password' as const, label: 'Şifreli', icon: Lock },
                ].map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPrivacy(opt.id)}
                      className={`flex flex-col items-center gap-1 rounded-xl border py-2 text-[11px] font-medium transition ${
                        privacy === opt.id
                          ? 'border-[#7C5CFF] bg-[#7C5CFF]/15 text-white'
                          : 'border-white/10 bg-[#090A0F] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                Maksimum Kullanıcı: <span className="font-mono text-white">{maxUsers}</span>
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#090A0F] px-3.5 py-2.5">
                <Users className="h-4 w-4 text-zinc-500" />
                <input
                  type="range"
                  min={2}
                  max={48}
                  value={maxUsers}
                  onChange={(e) => setMaxUsers(Number(e.target.value))}
                  className="w-full accent-[#7C5CFF]"
                />
              </div>
            </div>
          </div>

          {privacy === 'password' && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                Oda Şifresi
              </label>
              <input
                type="password"
                required
                minLength={3}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="En az 3 karakter"
                className="w-full rounded-xl border border-white/10 bg-[#090A0F] px-3.5 py-2.5 text-sm text-white focus:border-[#7C5CFF] focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">
              Kapak Görseli URL (İsteğe bağlı)
            </label>
            <input
              type="url"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-white/10 bg-[#090A0F] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#7C5CFF] focus:outline-none"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-white/[0.06] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-white/[0.04]"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={submitting || !user}
              className="flex items-center gap-2 rounded-xl bg-[#7C5CFF] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#6D4AF5] disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              <span>{submitting ? 'Oda Açılıyor...' : 'Odayı Oluştur ve Gir'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
