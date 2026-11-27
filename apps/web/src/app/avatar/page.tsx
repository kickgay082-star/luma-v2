'use client';

import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import Link from 'next/link';
import {
  AVATAR_PRESETS,
  AvatarConfig,
  DEFAULT_AVATAR_CONFIG,
  PlayerAnimState,
} from '@luma/shared';
import { ArrowRight, Check, Dices, RotateCcw, Save, Sparkles } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Avatar3D } from '@/components/three/Avatar3D';
import { getEffectiveAvatar, useLumaStore } from '@/stores/useLumaStore';

const SKIN_TONES = ['#F7D5C4', '#F1C7B0', '#D9A78B', '#C6865C', '#8D5534', '#5A3622'];
const HAIR_COLORS = ['#141318', '#3B2820', '#7C4B2A', '#D1A054', '#E5E7EB', '#7C5CFF', '#B91C1C'];
const GARMENT_COLORS = ['#161822', '#232736', '#312E81', '#4C1D95', '#1E3A5F', '#14532D', '#7F1D1D', '#E5E7EB'];
const ACCENT_COLORS = ['#7C5CFF', '#3B82F6', '#34D399', '#F59E0B', '#EC4899', '#E5E7EB', '#18181B'];

const HAIR_STYLES: Array<{ id: AvatarConfig['hairStyle']; label: string }> = [
  { id: 'short-fade', label: 'Kısa Fade' },
  { id: 'side-part', label: 'Yandan Ayrık' },
  { id: 'long-wavy', label: 'Uzun Dalgalı' },
  { id: 'bob', label: 'Bob Kesim' },
  { id: 'ponytail', label: 'At Kuyruğu' },
  { id: 'curly', label: 'Kıvırcık' },
  { id: 'buzz', label: 'Kısa Kesim' },
  { id: 'mohawk', label: 'Mohawk' },
];

const TOP_STYLES: Array<{ id: AvatarConfig['topStyle']; label: string }> = [
  { id: 'tshirt', label: 'Tişört' },
  { id: 'hoodie', label: 'Kapüşonlu' },
  { id: 'jacket', label: 'Ceket' },
  { id: 'blazer', label: 'Blazer' },
  { id: 'sweater', label: 'Kazak' },
];

const BOTTOM_STYLES: Array<{ id: AvatarConfig['bottomStyle']; label: string }> = [
  { id: 'chinos', label: 'Chino' },
  { id: 'jeans', label: 'Kot' },
  { id: 'joggers', label: 'Jogger' },
  { id: 'shorts', label: 'Şort' },
];

const SHOE_STYLES: Array<{ id: AvatarConfig['shoeStyle']; label: string }> = [
  { id: 'sneakers', label: 'Sneaker' },
  { id: 'boots', label: 'Bot' },
  { id: 'loafers', label: 'Loafer' },
];

const GLASSES_STYLES: Array<{ id: AvatarConfig['glasses']; label: string }> = [
  { id: 'none', label: 'Yok' },
  { id: 'minimal-frame', label: 'Minimal' },
  { id: 'round', label: 'Yuvarlak' },
  { id: 'aviator', label: 'Aviator' },
  { id: 'visor', label: 'Vizör' },
];

const HAT_STYLES: Array<{ id: AvatarConfig['hat']; label: string }> = [
  { id: 'none', label: 'Yok' },
  { id: 'headphones', label: 'Kulaklık' },
  { id: 'beanie', label: 'Bere' },
  { id: 'cap', label: 'Kep' },
  { id: 'fedora', label: 'Şapka' },
];

export default function AvatarStudioPage() {
  const user = useLumaStore((s) => s.user);
  const setUserAvatar = useLumaStore((s) => s.setUserAvatar);
  const [config, setConfig] = useState<AvatarConfig>(DEFAULT_AVATAR_CONFIG);
  const [previewAnim, setPreviewAnim] = useState<PlayerAnimState>('idle');
  const [activeTab, setActiveTab] = useState<'face' | 'style' | 'accessories' | 'body'>('face');
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    setConfig(getEffectiveAvatar(user));
  }, [user]);

  const update = <K extends keyof AvatarConfig>(key: K, val: AvatarConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedNotice(null);
    try {
      if (user) {
        const res = await fetch('/api/avatar', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        });
        if (!res.ok) throw new Error('Kayıt başarısız');
        setUserAvatar(config);
        setSavedNotice('Avatar hesabına kaydedildi.');
      } else {
        window.localStorage.setItem('luma_guest_avatar', JSON.stringify(config));
        setSavedNotice('Tarayıcıya kaydedildi (kalıcı olması için giriş yapabilirsin).');
      }
    } catch {
      setSavedNotice('Kaydetme sırasında hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090A0F]">
      <Navbar />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-12">
        {/* Left: Live 3D Avatar Stage */}
        <section className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#10121A] p-4 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div>
              <h1 className="text-base font-semibold text-white">3D Avatar Stüdyosu</h1>
              <p className="text-xs text-zinc-400">
                Fareyle sürükleyerek döndürün, tekerlekle yakınlaşın.
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#090A0F] p-1">
              {(['idle', 'walk', 'sit', 'wave'] as PlayerAnimState[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setPreviewAnim(a)}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                    previewAnim === a
                      ? 'bg-[#7C5CFF] text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {a === 'idle' ? 'Duruş' : a === 'walk' ? 'Yürü' : a === 'sit' ? 'Otur' : 'Selam'}
                </button>
              ))}
            </div>
          </div>

          <div className="relative mt-3 h-[440px] w-full overflow-hidden rounded-xl border border-white/[0.06] bg-[#08090D]">
            <Canvas shadows camera={{ position: [0, 1.5, 3.1], fov: 40 }}>
              <color attach="background" args={['#08090D']} />
              <ambientLight intensity={0.65} />
              <directionalLight position={[3, 5, 4]} intensity={1.1} castShadow />
              <pointLight position={[-3, 2, 2]} intensity={0.8} color="#7C5CFF" />
              <pointLight position={[3, 2, -2]} intensity={0.7} color="#3B82F6" />

              <group position={[0, -0.75, 0]}>
                <Avatar3D
                  config={config}
                  animState={previewAnim}
                  showLabel={false}
                />
                <ContactShadows
                  position={[0, 0.01, 0]}
                  opacity={0.55}
                  scale={4}
                  blur={2}
                  far={2.5}
                />
              </group>

              <OrbitControls
                enablePan={false}
                minDistance={1.6}
                maxDistance={4.8}
                target={[0, 0.2, 0]}
              />
            </Canvas>
          </div>

          {/* Presets */}
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-zinc-400">Hazır Avatar Presetleri</p>
            <div className="grid grid-cols-2 gap-2">
              {AVATAR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setConfig(preset.config)}
                  className={`rounded-xl border p-2.5 text-left transition ${
                    config.presetId === preset.id
                      ? 'border-[#7C5CFF] bg-[#7C5CFF]/15'
                      : 'border-white/[0.07] bg-[#090A0F] hover:border-white/20'
                  }`}
                >
                  <p className="text-xs font-semibold text-white">{preset.name}</p>
                  <p className="mt-0.5 line-clamp-1 text-[10px] text-zinc-400">
                    {preset.subtitle}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Right: Modular Customization Controls */}
        <section className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#10121A] p-5 lg:col-span-7">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
              <div className="flex gap-1.5 rounded-xl border border-white/[0.07] bg-[#090A0F] p-1">
                {[
                  { id: 'face' as const, label: 'Yüz & Saç' },
                  { id: 'style' as const, label: 'Kıyafet' },
                  { id: 'accessories' as const, label: 'Aksesuar' },
                  { id: 'body' as const, label: 'Vücut & Oran' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      activeTab === tab.id
                        ? 'bg-[#7C5CFF] text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
                    setConfig({
                      presetId: 'custom',
                      bodyPreset: pick(['slim', 'standard', 'athletic', 'tall']),
                      heightScale: Number((0.94 + Math.random() * 0.14).toFixed(2)),
                      shoulderScale: Number((0.92 + Math.random() * 0.18).toFixed(2)),
                      skinTone: pick(SKIN_TONES),
                      hairStyle: pick(HAIR_STYLES).id,
                      hairColor: pick(HAIR_COLORS),
                      faceShape: pick(['oval', 'angular', 'soft', 'square']),
                      eyeStyle: pick(['almond', 'round', 'focused', 'expressive']),
                      eyeColor: pick(['#3B5998', '#1F6F78', '#4B3621', '#1E293B', '#7C5CFF']),
                      eyebrowStyle: pick(['natural', 'arched', 'thick', 'minimal']),
                      topStyle: pick(TOP_STYLES).id,
                      topColor: pick(GARMENT_COLORS),
                      bottomStyle: pick(BOTTOM_STYLES).id,
                      bottomColor: pick(GARMENT_COLORS),
                      shoeStyle: pick(SHOE_STYLES).id,
                      shoeColor: pick(['#111827', '#E5E7EB', '#3B2820', '#7F1D1D', '#7C5CFF']),
                      glasses: pick(GLASSES_STYLES).id,
                      hat: pick(HAT_STYLES).id,
                      accessoryColor: pick(ACCENT_COLORS),
                    });
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-[#7C5CFF]/40 bg-[#7C5CFF]/15 px-3 py-1.5 text-xs font-medium text-[#C4B5FD] hover:bg-[#7C5CFF]/25"
                >
                  <Dices className="h-3.5 w-3.5" />
                  <span>Rastgele Stil</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfig(DEFAULT_AVATAR_CONFIG)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.04]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Sıfırla</span>
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-5">
              {activeTab === 'face' && (
                <>
                  <ColorRow
                    label="Ten Tonu"
                    colors={SKIN_TONES}
                    value={config.skinTone}
                    onChange={(c) => update('skinTone', c)}
                  />
                  <OptionGrid
                    label="Saç Modeli"
                    options={HAIR_STYLES}
                    value={config.hairStyle}
                    onChange={(v) => update('hairStyle', v)}
                  />
                  <ColorRow
                    label="Saç Rengi"
                    colors={HAIR_COLORS}
                    value={config.hairColor}
                    onChange={(c) => update('hairColor', c)}
                  />
                  <div className="grid gap-4 sm:grid-cols-3">
                    <OptionGrid
                      label="Yüz Hatları"
                      options={[
                        { id: 'oval', label: 'Oval' },
                        { id: 'angular', label: 'Keskin' },
                        { id: 'soft', label: 'Yumuşak' },
                        { id: 'square', label: 'Kare' },
                      ]}
                      value={config.faceShape}
                      onChange={(v) => update('faceShape', v)}
                      compact
                    />
                    <OptionGrid
                      label="Göz Şekli"
                      options={[
                        { id: 'almond', label: 'Badem' },
                        { id: 'round', label: 'Yuvarlak' },
                        { id: 'focused', label: 'Odaklı' },
                        { id: 'expressive', label: 'İfadeli' },
                      ]}
                      value={config.eyeStyle}
                      onChange={(v) => update('eyeStyle', v)}
                      compact
                    />
                    <OptionGrid
                      label="Kaş Stili"
                      options={[
                        { id: 'natural', label: 'Doğal' },
                        { id: 'arched', label: 'Kavisli' },
                        { id: 'thick', label: 'Kalın' },
                        { id: 'minimal', label: 'İnce' },
                      ]}
                      value={config.eyebrowStyle}
                      onChange={(v) => update('eyebrowStyle', v)}
                      compact
                    />
                  </div>
                  <ColorRow
                    label="Göz Rengi"
                    colors={['#1F2937', '#4B3621', '#3B5998', '#1F6F78', '#60A5FA', '#7C5CFF']}
                    value={config.eyeColor}
                    onChange={(c) => update('eyeColor', c)}
                  />
                </>
              )}

              {activeTab === 'style' && (
                <>
                  <OptionGrid
                    label="Üst Giyim"
                    options={TOP_STYLES}
                    value={config.topStyle}
                    onChange={(v) => update('topStyle', v)}
                  />
                  <ColorRow
                    label="Üst Rengi"
                    colors={GARMENT_COLORS}
                    value={config.topColor}
                    onChange={(c) => update('topColor', c)}
                  />
                  <OptionGrid
                    label="Alt Giyim"
                    options={BOTTOM_STYLES}
                    value={config.bottomStyle}
                    onChange={(v) => update('bottomStyle', v)}
                  />
                  <ColorRow
                    label="Alt Rengi"
                    colors={GARMENT_COLORS}
                    value={config.bottomColor}
                    onChange={(c) => update('bottomColor', c)}
                  />
                  <OptionGrid
                    label="Ayakkabı"
                    options={SHOE_STYLES}
                    value={config.shoeStyle}
                    onChange={(v) => update('shoeStyle', v)}
                  />
                  <ColorRow
                    label="Ayakkabı Rengi"
                    colors={GARMENT_COLORS}
                    value={config.shoeColor}
                    onChange={(c) => update('shoeColor', c)}
                  />
                </>
              )}

              {activeTab === 'accessories' && (
                <>
                  <OptionGrid
                    label="Gözlük"
                    options={GLASSES_STYLES}
                    value={config.glasses}
                    onChange={(v) => update('glasses', v)}
                  />
                  <OptionGrid
                    label="Şapka / Kulaklık"
                    options={HAT_STYLES}
                    value={config.hat}
                    onChange={(v) => update('hat', v)}
                  />
                  <ColorRow
                    label="Aksesuar Rengi"
                    colors={ACCENT_COLORS}
                    value={config.accessoryColor}
                    onChange={(c) => update('accessoryColor', c)}
                  />
                </>
              )}

              {activeTab === 'body' && (
                <>
                  <OptionGrid
                    label="Vücut Tipi"
                    options={[
                      { id: 'slim', label: 'İnce' },
                      { id: 'standard', label: 'Standart' },
                      { id: 'athletic', label: 'Atletik' },
                      { id: 'tall', label: 'Uzun' },
                    ]}
                    value={config.bodyPreset}
                    onChange={(v) => update('bodyPreset', v)}
                  />
                  <div>
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span className="text-zinc-300">Boy Oranı</span>
                      <span className="font-mono text-zinc-400">
                        {Math.round(config.heightScale * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.92}
                      max={1.1}
                      step={0.01}
                      value={config.heightScale}
                      onChange={(e) => update('heightScale', Number(e.target.value))}
                      className="w-full accent-[#7C5CFF]"
                    />
                  </div>
                  <div>
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span className="text-zinc-300">Omuz Genişliği</span>
                      <span className="font-mono text-zinc-400">
                        {Math.round(config.shoulderScale * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.9}
                      max={1.14}
                      step={0.01}
                      value={config.shoulderScale}
                      onChange={(e) => update('shoulderScale', Number(e.target.value))}
                      className="w-full accent-[#7C5CFF]"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
            <div className="text-xs text-zinc-400">
              {savedNotice ? (
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Check className="h-4 w-4" />
                  {savedNotice}
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#7C5CFF]" />
                  Değişiklikler tüm odalarda anlık güncellenir.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <Link
                href="/"
                className="flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.04]"
              >
                <span>Odalara Git</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-[#7C5CFF] px-5 py-2.5 text-xs font-medium text-white transition hover:bg-[#6D4AF5] disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? 'Kaydediliyor...' : 'Avatarı Kaydet'}</span>
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function ColorRow({
  label,
  colors,
  value,
  onChange,
}: {
  label: string;
  colors: string[];
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-zinc-300">{label}</p>
      <div className="flex flex-wrap gap-2">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`h-7 w-7 rounded-full border-2 transition ${
              value.toLowerCase() === c.toLowerCase()
                ? 'scale-110 border-white ring-2 ring-[#7C5CFF]/60'
                : 'border-white/15 hover:scale-105'
            }`}
            style={{ backgroundColor: c }}
            aria-label={c}
          />
        ))}
      </div>
    </div>
  );
}

function OptionGrid<T extends string>({
  label,
  options,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  compact?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-zinc-300">{label}</p>
      <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition ${
              value === opt.id
                ? 'border-[#7C5CFF] bg-[#7C5CFF]/15 text-white'
                : 'border-white/[0.08] bg-[#090A0F] text-zinc-400 hover:border-white/20 hover:text-zinc-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
