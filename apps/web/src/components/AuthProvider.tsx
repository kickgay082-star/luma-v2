'use client';

import { useEffect } from 'react';
import { useLumaStore } from '@/stores/useLumaStore';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useLumaStore((s) => s.setUser);
  const setAuthLoaded = useLumaStore((s) => s.setAuthLoaded);
  const setGraphicsQuality = useLumaStore((s) => s.setGraphicsQuality);
  const setSpatialSettings = useLumaStore((s) => s.setSpatialSettings);

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

    // Also load local graphics preference if unauthenticated
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

  return <>{children}</>;
}
