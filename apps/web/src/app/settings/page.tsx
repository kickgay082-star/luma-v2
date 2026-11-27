'use client';

import { useEffect, useState } from 'react';
import { GraphicsQuality } from '@luma/shared';
import { Check, Monitor, Save, Volume2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { useLumaStore } from '@/stores/useLumaStore';

export default function SettingsPage() {
  const user = useLumaStore((s) => s.user);
  const graphicsQuality = useLumaStore((s) => s.graphicsQuality);
  const setGraphicsQuality = useLumaStore((s) => s.setGraphicsQuality);
  const spatialSettings = useLumaStore((s) => s.spatialSettings);
  const setSpatialSettings = useLumaStore((s) => s.setSpatialSettings);

  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((list) => {
        setMics(list.filter((d) => d.kind === 'audioinput'));
        setOutputs(list.filter((d) => d.kind === 'audiooutput'));
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    try {
      window.localStorage.setItem('luma_graphics_quality', graphicsQuality);
    } catch {
      // ignore
    }
    if (user) {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          graphicsQuality,
          spatialVoice: spatialSettings,
        }),
      });
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[#090A0F]">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold text-white">Platform Ayarları</h1>
        <p className="mt-1 text-xs text-zinc-400">
          3D grafik performans profili, mikrofon ve konumsal ses tercihlerini yapılandır.
        </p>

        <div className="mt-6 space-y-6">
          <section className="rounded-2xl border border-white/[0.08] bg-[#10121A] p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <Monitor className="h-4 w-4 text-[#7C5CFF]" /> 3D Grafik ve Performans Modu
            </h2>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {[
                {
                  id: 'high' as GraphicsQuality,
                  title: 'Yüksek Kalite',
                  desc: 'Yüksek çözünürlüklü gölgeler, tam yıldız/şehir detayı.',
                },
                {
                  id: 'medium' as GraphicsQuality,
                  title: 'Dengeli (Orta)',
                  desc: 'Akıcı 60 FPS ve optimize gölge haritaları.',
                },
                {
                  id: 'low' as GraphicsQuality,
                  title: 'Düşük Sistem Modu',
                  desc: 'Gölgesiz hafif rendering, düşük piksel oranı.',
                },
                {
                  id: '2d-lite' as GraphicsQuality,
                  title: '3D Kapalı (2D Lite Mod)',
                  desc: 'WebGL kapalı, doğrudan 2D harita ve sinema ekranı.',
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setGraphicsQuality(opt.id)}
                  className={`rounded-xl border p-3.5 text-left transition ${
                    graphicsQuality === opt.id
                      ? 'border-[#7C5CFF] bg-[#7C5CFF]/15'
                      : 'border-white/[0.08] bg-[#090A0F] hover:border-white/20'
                  }`}
                >
                  <p className="text-xs font-semibold text-white">{opt.title}</p>
                  <p className="mt-1 text-[11px] text-zinc-400">{opt.desc}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-white/[0.08] bg-[#10121A] p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Volume2 className="h-4 w-4 text-[#3B82F6]" /> Proximity Voice & Spatial Audio
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs text-zinc-300">Mikrofon Girişi</label>
                <select
                  value={spatialSettings.micDeviceId}
                  onChange={(e) => setSpatialSettings({ micDeviceId: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[#090A0F] px-3 py-2 text-xs text-white"
                >
                  <option value="default">Sistem Varsayılanı</option>
                  {mics.map((m, i) => (
                    <option key={m.deviceId || i} value={m.deviceId}>
                      {m.label || `Mikrofon ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-zinc-300">Ses Çıkışı</label>
                <select
                  value={spatialSettings.outputDeviceId}
                  onChange={(e) => setSpatialSettings({ outputDeviceId: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[#090A0F] px-3 py-2 text-xs text-white"
                >
                  <option value="default">Sistem Varsayılanı</option>
                  {outputs.map((o, i) => (
                    <option key={o.deviceId || i} value={o.deviceId}>
                      {o.label || `Hoparlör ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { key: 'noiseSuppression' as const, label: 'Gürültü Azaltma' },
                { key: 'echoCancellation' as const, label: 'Yankı Engelleme' },
                { key: 'autoGainControl' as const, label: 'Otomatik Kazanç' },
              ].map((t) => (
                <label
                  key={t.key}
                  className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-[#090A0F] p-3 text-xs text-zinc-200"
                >
                  <span>{t.label}</span>
                  <input
                    type="checkbox"
                    checked={spatialSettings[t.key]}
                    onChange={(e) => setSpatialSettings({ [t.key]: e.target.checked })}
                    className="h-4 w-4 accent-[#7C5CFF]"
                  />
                </label>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1 flex justify-between text-xs text-zinc-300">
                  <span>Yakın Ses Menzili (Tam Netlik)</span>
                  <span className="font-mono">{spatialSettings.refDistance}m</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={6}
                  step={0.5}
                  value={spatialSettings.refDistance}
                  onChange={(e) => setSpatialSettings({ refDistance: Number(e.target.value) })}
                  className="w-full accent-[#7C5CFF]"
                />
              </div>

              <div>
                <div className="mb-1 flex justify-between text-xs text-zinc-300">
                  <span>Maksimum Ses Menzili</span>
                  <span className="font-mono">{spatialSettings.maxDistance}m</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={30}
                  step={1}
                  value={spatialSettings.maxDistance}
                  onChange={(e) => setSpatialSettings({ maxDistance: Number(e.target.value) })}
                  className="w-full accent-[#7C5CFF]"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-zinc-300">Oda Akustiği Profili</label>
              <select
                value={spatialSettings.acoustics}
                onChange={(e) =>
                  setSpatialSettings({
                    acoustics: e.target.value as typeof spatialSettings.acoustics,
                  })
                }
                className="w-full rounded-xl border border-white/10 bg-[#090A0F] px-3 py-2 text-xs text-white"
              >
                <option value="cinema-hall">Sinema Salonu (Dengeli Sıcaklık)</option>
                <option value="studio">Stüdyo (Kristal Netlik)</option>
                <option value="intimate">Samimi Lounge (Yumuşak Tiz)</option>
              </select>
            </div>
          </section>

          <div className="flex items-center justify-end gap-3">
            {saved && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <Check className="h-4 w-4" /> Kaydedildi
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-2 rounded-xl bg-[#7C5CFF] px-5 py-2.5 text-xs font-medium text-white hover:bg-[#6D4AF5]"
            >
              <Save className="h-4 w-4" />
              <span>Ayarları Kaydet</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
