'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Lock, Mail, User, Sparkles } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { useLumaStore } from '@/stores/useLumaStore';

export default function AuthPage() {
  const router = useRouter();
  const user = useLumaStore((s) => s.user);
  const setUser = useLumaStore((s) => s.setUser);
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body =
        mode === 'register'
          ? { username, displayName, email, password }
          : { identifier, password };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'İşlem başarısız.');
        return;
      }
      setUser(data.user);
      router.push(mode === 'register' ? '/avatar' : '/');
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
        {user ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#10121A] p-7">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Aktif Hesap
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white">{user.displayName}</h1>
            <p className="mt-1 font-mono text-sm text-zinc-400">@{user.username}</p>
            <div className="mt-6 flex flex-col gap-2.5">
              <Link
                href="/avatar"
                className="flex items-center justify-between rounded-xl bg-[#7C5CFF] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#6D4AF5]"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Avatarını Düzenle
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/"
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.06]"
              >
                <span>Odalara Dön</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.08] bg-[#10121A] p-7">
            <div className="flex rounded-xl border border-white/[0.06] bg-[#090A0F] p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                  mode === 'register'
                    ? 'bg-[#181B28] text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Hesap Oluştur
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                  mode === 'login'
                    ? 'bg-[#181B28] text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Giriş Yap
              </button>
            </div>

            <h1 className="mt-6 text-xl font-semibold tracking-tight text-white">
              {mode === 'register' ? 'Luma Dünyasına Katıl' : 'Tekrar Hoş Geldin'}
            </h1>
            <p className="mt-1.5 text-sm text-zinc-400">
              {mode === 'register'
                ? '3D avatarını kaydet, kendi sinema odanı kur ve arkadaşlarınla izle.'
                : 'Kayıtlı avatarın, arkadaşların ve IPTV listelerinle devam et.'}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === 'register' ? (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                      Kullanıcı Adı
                    </label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="ornek_sinemaci"
                        className="w-full rounded-xl border border-white/10 bg-[#090A0F] py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-zinc-600 focus:border-[#7C5CFF] focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                      Görünen Ad
                    </label>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Deniz Yılmaz"
                      className="w-full rounded-xl border border-white/10 bg-[#090A0F] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#7C5CFF] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                      E-posta (İsteğe bağlı)
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="deniz@ornek.com"
                        className="w-full rounded-xl border border-white/10 bg-[#090A0F] py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-zinc-600 focus:border-[#7C5CFF] focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                    Kullanıcı Adı veya E-posta
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="ornek_sinemaci"
                      className="w-full rounded-xl border border-white/10 bg-[#090A0F] py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-zinc-600 focus:border-[#7C5CFF] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                  Şifre
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full rounded-xl border border-white/10 bg-[#090A0F] py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-zinc-600 focus:border-[#7C5CFF] focus:outline-none"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C5CFF] py-2.5 text-sm font-medium text-white transition hover:bg-[#6D4AF5] disabled:opacity-50"
              >
                <span>
                  {loading
                    ? 'İşleniyor...'
                    : mode === 'register'
                      ? 'Hesap Oluştur ve Avatar Tasarla'
                      : 'Giriş Yap'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
