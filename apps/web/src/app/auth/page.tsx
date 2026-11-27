'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, User, Sparkles } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { useLumaStore } from '@/stores/useLumaStore';

export default function AuthPage() {
  const router = useRouter();
  const user = useLumaStore((s) => s.user);
  const setUser = useLumaStore((s) => s.setUser);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (trimmed.length < 2) {
      setError('İsim en az 2 karakter olmalıdır.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/enter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'İşlem başarısız.');
        return;
      }
      setUser(data.user);
      router.push('/');
    } catch {
      setError('Sunucuya bağlanılamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090A0F]">
      <Navbar />
      <main className="mx-auto flex max-w-md flex-col px-4 py-14">
        <div className="rounded-2xl border border-white/[0.08] bg-[#10121A] p-7">
          <h1 className="text-xl font-semibold tracking-tight text-white">
            {user ? 'İsmini Güncelle' : 'Luma Dünyasına Katıl'}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-400">
            Kayıt veya şifre gerekmez. Sadece odalarda görünecek ismini yaz.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                required
                minLength={2}
                maxLength={24}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Adını yaz..."
                className="w-full rounded-xl border border-white/10 bg-[#090A0F] py-3 pl-10 pr-4 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-[#7C5CFF]"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C5CFF] py-3 text-sm font-medium text-white transition hover:bg-[#6D4AF5] disabled:opacity-50"
            >
              <span>{loading ? 'Kaydediliyor...' : user ? 'İsmi Kaydet' : 'Başla'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {user && (
            <div className="mt-5 flex flex-col gap-2 border-t border-white/[0.06] pt-5">
              <Link
                href="/avatar"
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.06]"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#7C5CFF]" />
                  Avatarını Düzenle
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
