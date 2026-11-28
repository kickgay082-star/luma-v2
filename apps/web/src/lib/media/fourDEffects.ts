export interface FourDEffects {
  water: number; // 0..1 rising water & splash droplets
  rain: number; // 0..1 falling rain & wet mist
  fire: number; // 0..1 rising embers & heat glow
  snow: number; // 0..1 falling snow & frost rim
  wind: number; // 0..1 speed lines & wind sway
  shake: number; // 0..1 seat & camera rumble/explosion shake
  lightning: number; // 0..1 flash pulse
  ambilightColor: string;
  sceneLabel: string;
}

export interface FourDTimelineCue {
  at: number; // seconds
  dur: number; // seconds
  label: string;
  effects: Partial<FourDEffects>;
}

export interface FourDVideoProfile {
  videoKey: string;
  base: Partial<FourDEffects>;
  cues: FourDTimelineCue[];
  biomeLabel: string;
}

export const ZERO_4D_EFFECTS: FourDEffects = {
  water: 0,
  rain: 0,
  fire: 0,
  snow: 0,
  wind: 0,
  shake: 0,
  lightning: 0,
  ambilightColor: '#7C5CFF',
  sceneLabel: 'Standart',
};

const CUE_RULES: Array<{
  pattern: RegExp;
  label: string;
  effects: Partial<FourDEffects>;
}> = [
  {
    pattern:
      /\b(water|ocean|sea|wave|tsunami|swim|dive|underwater|splash|river|flood|aqua|pool|ship|titanic|submarine|su|deniz|okyanus|dalga|sel|yüz|dalış|gemi|nehir|şelale)\b/i,
    label: 'Su & Dalga',
    effects: { water: 0.82, wind: 0.25, shake: 0.28, ambilightColor: '#0EA5E9' },
  },
  {
    pattern:
      /\b(rain|storm|thunder|lightning|hurricane|tornado|tempest|wet|yağmur|fırtına|şimşek|gök gürültüsü|kasırga|sağanak)\b/i,
    label: 'Fırtına & Şimşek',
    effects: {
      rain: 0.88,
      water: 0.35,
      wind: 0.65,
      lightning: 0.85,
      shake: 0.45,
      ambilightColor: '#38BDF8',
    },
  },
  {
    pattern:
      /\b(fire|flame|burn|explosion|explode|bomb|blast|volcano|lava|inferno|boom|rocket|shoot|gun|ateş|alev|yan|patlama|bomba|volkan|lav)\b/i,
    label: 'Alev & Patlama',
    effects: { fire: 0.9, shake: 0.85, wind: 0.45, ambilightColor: '#F97316' },
  },
  {
    pattern:
      /\b(snow|ice|winter|blizzard|freeze|frost|cold|arctic|glacier|kar|buz|kış|tipi|don|soğuk)\b/i,
    label: 'Kar & Tipi',
    effects: { snow: 0.88, wind: 0.55, ambilightColor: '#BAE6FD' },
  },
  {
    pattern:
      /\b(coaster|roller|speed|fast|race|drift|chase|crash|earthquake|fall|fly|jet|space|4dx|4d|hız|yarış|kovalamaca|kaza|deprem|uçuş|lunapark|hız treni)\b/i,
    label: 'Hız & Sarsıntı',
    effects: { wind: 0.85, shake: 0.72, ambilightColor: '#A855F7' },
  },
];

export function matchFourDEffectsFromText(text: string): {
  label: string;
  effects: Partial<FourDEffects>;
} | null {
  if (!text) return null;
  const combined: Partial<FourDEffects> = {};
  const labels: string[] = [];

  for (const rule of CUE_RULES) {
    if (rule.pattern.test(text)) {
      labels.push(rule.label);
      for (const [k, v] of Object.entries(rule.effects)) {
        if (typeof v === 'number') {
          const key = k as keyof FourDEffects;
          const prev = typeof combined[key] === 'number' ? (combined[key] as number) : 0;
          (combined[key] as number) = Math.max(prev, v);
        } else if (k === 'ambilightColor' && typeof v === 'string') {
          combined.ambilightColor = v;
        }
      }
    }
  }

  if (labels.length === 0) return null;
  return { label: labels.slice(0, 2).join(' · '), effects: combined };
}
