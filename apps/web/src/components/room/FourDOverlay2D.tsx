'use client';

import { useState } from 'react';
import {
  CloudLightning,
  Droplets,
  Flame,
  Snowflake,
  Sparkles,
  Waves,
  Wind,
  Zap,
} from 'lucide-react';
import { useFourDStore } from '@/stores/useFourDStore';

const DROPLET_POSITIONS = [
  { left: '6%', top: '12%', size: 12 },
  { left: '14%', top: '28%', size: 16 },
  { left: '9%', top: '64%', size: 11 },
  { left: '22%', top: '82%', size: 14 },
  { left: '84%', top: '18%', size: 15 },
  { left: '91%', top: '38%', size: 12 },
  { left: '78%', top: '71%', size: 17 },
  { left: '93%', top: '79%', size: 11 },
  { left: '36%', top: '9%', size: 10 },
  { left: '63%', top: '14%', size: 13 },
];

export function FourDOverlay2D({ canTriggerEffects }: { canTriggerEffects: boolean }) {
  const enabled = useFourDStore((s) => s.enabled);
  const intensity = useFourDStore((s) => s.intensity);
  const current = useFourDStore((s) => s.current);
  const profile = useFourDStore((s) => s.profile);
  const setEnabled = useFourDStore((s) => s.setEnabled);
  const setIntensity = useFourDStore((s) => s.setIntensity);
  const triggerManualBurst = useFourDStore((s) => s.triggerManualBurst);
  const clearManual = useFourDStore((s) => s.clearManual);

  const [panelOpen, setPanelOpen] = useState(false);

  const waterStrength = enabled ? Math.min(1, Math.max(current.water, current.rain * 0.85) * intensity) : 0;
  const fireStrength = enabled ? Math.min(1, current.fire * intensity) : 0;
  const snowStrength = enabled ? Math.min(1, current.snow * intensity) : 0;
  const lightningStrength = enabled ? Math.min(1, current.lightning * intensity) : 0;
  const windStrength = enabled ? Math.min(1, current.wind * intensity) : 0;
  const shakeStrength = enabled ? Math.min(1, current.shake * intensity) : 0;

  const activeTags: string[] = [];
  if (waterStrength > 0.18) activeTags.push('Su');
  if (current.rain * intensity > 0.2) activeTags.push('Yağmur');
  if (fireStrength > 0.18) activeTags.push('Alev');
  if (snowStrength > 0.18) activeTags.push('Kar');
  if (lightningStrength > 0.25) activeTags.push('Şimşek');
  if (shakeStrength > 0.22) activeTags.push('Sarsıntı');
  if (windStrength > 0.35) activeTags.push('Rüzgar');

  return (
    <>
      {/* 1. Screen Water Droplets + Wet Blue Mist */}
      {waterStrength > 0.12 && (
        <div
          className="pointer-events-none fixed inset-0 z-10 overflow-hidden transition-opacity duration-500"
          style={{
            opacity: Math.min(0.95, waterStrength * 0.9),
            boxShadow: `inset 0 0 ${Math.round(70 + waterStrength * 80)}px rgba(14, 165, 233, ${0.22 + waterStrength * 0.25})`,
          }}
        >
          {DROPLET_POSITIONS.map((d, idx) => (
            <span
              key={idx}
              className="absolute rounded-full border border-sky-200/50 bg-sky-300/20 backdrop-blur-[1px]"
              style={{
                left: d.left,
                top: d.top,
                width: d.size,
                height: d.size * 1.35,
                boxShadow: 'inset 2px 2px 4px rgba(255,255,255,0.45)',
              }}
            />
          ))}
        </div>
      )}

      {/* 2. Fire Heat Glow Border */}
      {fireStrength > 0.15 && (
        <div
          className="pointer-events-none fixed inset-0 z-10 transition-opacity duration-300"
          style={{
            opacity: Math.min(0.9, fireStrength * 0.85),
            boxShadow: `inset 0 0 ${Math.round(80 + fireStrength * 90)}px rgba(249, 115, 22, ${0.28 + fireStrength * 0.3})`,
          }}
        />
      )}

      {/* 3. Frost Ice Rim */}
      {snowStrength > 0.15 && (
        <div
          className="pointer-events-none fixed inset-0 z-10 transition-opacity duration-500"
          style={{
            opacity: Math.min(0.85, snowStrength * 0.8),
            boxShadow: `inset 0 0 ${Math.round(65 + snowStrength * 70)}px rgba(186, 230, 253, 0.38)`,
          }}
        />
      )}

      {/* 4. Lightning Flash */}
      {lightningStrength > 0.35 && (
        <div
          className="pointer-events-none fixed inset-0 z-10 bg-sky-100 transition-opacity duration-75"
          style={{ opacity: Math.min(0.32, (lightningStrength - 0.3) * 0.4) }}
        />
      )}

      {/* 5. Wind Speed Vignette */}
      {windStrength > 0.35 && (
        <div
          className="pointer-events-none fixed inset-0 z-10"
          style={{
            background:
              'radial-gradient(circle at center, transparent 58%, rgba(255,255,255,0.08) 100%)',
            opacity: Math.min(0.85, (windStrength - 0.3) * 1.1),
          }}
        />
      )}

      {/* 6. Floating 4DX Control Pill (Top-Left below header) */}
      <div className="fixed left-4 top-16 z-20 flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold shadow-lg backdrop-blur-md transition ${
            enabled
              ? 'border-[#7C5CFF]/50 bg-[#0B0D14]/85 text-white hover:border-[#7C5CFF]'
              : 'border-white/10 bg-[#0B0D14]/75 text-zinc-400'
          }`}
          title="4D Sinema Efekt Ayarları ve Manuel Tetikleme"
        >
          <Sparkles className={`h-3.5 w-3.5 ${enabled ? 'text-[#A78BFA]' : 'text-zinc-500'}`} />
          <span>4D {enabled ? 'Aktif' : 'Kapalı'}</span>
          {enabled && activeTags.length > 0 && (
            <span className="rounded-full bg-[#7C5CFF]/25 px-2 py-0.5 text-[10px] text-[#DDD6FE]">
              {activeTags.slice(0, 3).join(' · ')}
            </span>
          )}
        </button>

        {panelOpen && (
          <div className="w-72 rounded-2xl border border-white/12 bg-[#0D0F17]/95 p-3.5 text-xs shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">4D Sinema Deneyimi</span>
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                  enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-zinc-400'
                }`}
              >
                {enabled ? 'Açık' : 'Kapalı'}
              </button>
            </div>

            {profile?.biomeLabel && (
              <p className="mt-1.5 text-[11px] text-zinc-400">
                Algılanan Sahne: <span className="text-[#C4B5FD]">{profile.biomeLabel}</span>
              </p>
            )}

            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[11px] text-zinc-300">
                <span>Efekt Şiddeti</span>
                <span className="font-mono">{Math.round(intensity * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.3}
                max={1.5}
                step={0.1}
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="w-full accent-[#7C5CFF]"
              />
            </div>

            {canTriggerEffects && (
              <div className="mt-3 space-y-1.5 border-t border-white/[0.08] pt-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-zinc-300">Anlık 4D Test Et</span>
                  <button
                    type="button"
                    onClick={clearManual}
                    className="text-[10px] text-[#A78BFA] hover:underline"
                  >
                    Otomatiğe Dön
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      triggerManualBurst({
                        water: 0.95,
                        wind: 0.35,
                        shake: 0.35,
                        ambilightColor: '#0EA5E9',
                        sceneLabel: 'Su Baskını',
                      })
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/15 px-2 py-1.5 text-[11px] text-sky-200 hover:bg-sky-500/25"
                  >
                    <Waves className="h-3.5 w-3.5" /> Su Baskını
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      triggerManualBurst({
                        rain: 0.95,
                        water: 0.35,
                        wind: 0.7,
                        lightning: 0.95,
                        shake: 0.55,
                        ambilightColor: '#38BDF8',
                        sceneLabel: 'Fırtına & Şimşek',
                      })
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/15 px-2 py-1.5 text-[11px] text-blue-200 hover:bg-blue-500/25"
                  >
                    <CloudLightning className="h-3.5 w-3.5" /> Fırtına
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      triggerManualBurst({
                        fire: 0.95,
                        shake: 0.85,
                        wind: 0.5,
                        ambilightColor: '#F97316',
                        sceneLabel: 'Alev & Patlama',
                      })
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/15 px-2 py-1.5 text-[11px] text-orange-200 hover:bg-orange-500/25"
                  >
                    <Flame className="h-3.5 w-3.5" /> Alev & Patlama
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      triggerManualBurst({
                        snow: 0.95,
                        wind: 0.6,
                        ambilightColor: '#BAE6FD',
                        sceneLabel: 'Kar Fırtınası',
                      })
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/15 px-2 py-1.5 text-[11px] text-cyan-100 hover:bg-cyan-500/25"
                  >
                    <Snowflake className="h-3.5 w-3.5" /> Kar Fırtınası
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      triggerManualBurst({
                        wind: 0.95,
                        shake: 0.9,
                        ambilightColor: '#A855F7',
                        sceneLabel: 'Deprem / Hız',
                      })
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/15 px-2 py-1.5 text-[11px] text-purple-200 hover:bg-purple-500/25"
                  >
                    <Zap className="h-3.5 w-3.5" /> Deprem / Hız
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      triggerManualBurst({
                        rain: 0.7,
                        wind: 0.95,
                        ambilightColor: '#60A5FA',
                        sceneLabel: 'Rüzgar & Yağmur',
                      })
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 text-[11px] text-zinc-200 hover:bg-white/15"
                  >
                    <Wind className="h-3.5 w-3.5" /> Rüzgar & Çise
                  </button>
                </div>
                <p className="flex items-center gap-1 pt-1 text-[10px] text-zinc-500">
                  <Droplets className="h-3 w-3" /> Video oynarken sahneye göre otomatik çalışır.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
