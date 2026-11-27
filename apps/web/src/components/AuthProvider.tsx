'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowRight, User } from 'lucide-react';
import { useLumaStore } from '@/stores/useLumaStore';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useLumaStore((s) => s.user);
  const authLoaded = useLumaStore((s) => s.authLoaded);
  const setUser = useLumaStore((s) => s.setUser);
  const setAuthLoaded = useLumaStore((s) => s.setAuthLoaded);
  const setGraphicsQuality = useLumaStore((s) => s.setGraphicsQuality);
  const setSpatialSettings = useLumaStore((s) => s.setSpatialSettings);

  const [nameInput, setNameInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setUser(data.user ?? null);
        if (data.user?.settings?.graphicsQuality) {
          setGraphicsQuality(data.user.settings.graphicsQuality);
        }
        if (data.user?.settings?.spatialVoice) {
          setSpatialSettings(data.user.settings.spatialVoice);
        }
      } catch {
        // offline fallback
      } finally {
        if (active) setAuthLoaded(true);
      }
    })();

    try {
      const localQ = window.localStorage.getItem('luma_graphics_quality');
      if (localQ === 'low' || localQ === 'medium' || localQ === 'high' || localQ === '2d-lite') {
        setGraphicsQuality(localQ);
      }
    } catch {
      // ignore
    }

    return () => {
      active = false;
    };
  }, [setUser, setAuthLoaded, setGraphicsQuality, setSpatialSettings]);

  const showNameGate =
    authLoaded &&
    !user &&
    pathname !== '/auth' &&
    !pathname.startsWith('/room/');

  const handleEnter = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (trimmed.length < 2) {
      setError('Lütfen en az 2 harfli bir isim gir.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/enter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Bir hata oluştu.');
        return;
      }
      setUser(data.user);
    } catch {
      setError('Sunucuya bağlanılamadı.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {children}
      {showNameGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-md">
          <form
            onSubmit={handleEnter}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#10121A] p-7 shadow-2xl"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#151823]">
                <span className="h-3 w-3 rounded-full bg-[#7C5CFF] ring-4 ring-[#7C5CFF]/20" />
              </span>
              <span className="text-base font-semibold text-white">Luma V2</span>
            </div>

            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">
              Hoş geldin, ismin ne?
            </h1>
            <p className="mt-1.5 text-sm text-zinc-400">
              Kayıt veya şifre gerekmez. Sadece odalarda görünecek ismini yaz ve başla.
            </p>

            <div className="relative mt-5">
              <User className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                autoFocus
                required
                minLength={2}
                maxLength={24}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Örn: Taha"
                className="w-full rounded-xl border border-white/10 bg-[#090A0F] py-3 pl-10 pr-4 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-[#7C5CFF]"
              />
            </div>

            {error && (
              <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C5CFF] py-3 text-sm font-medium text-white transition hover:bg-[#6D4AF5] disabled:opacity-50"
            >
              <span>{submitting ? 'Hazırlanıyor...' : 'Devam Et'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
