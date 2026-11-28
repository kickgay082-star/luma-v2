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
      /(water|ocean|sea|wave|tsunami|swim|dive|underwater|splash|river|flood|aqua|pool|ship|titanic|submarine|waterfall|su\b|deniz|okyanus|dalga|sel\b|yüzme|dalış|gemi|nehir|şelale|havuz|yağmurdan|batık)/i,
    label: 'Su & Dalga',
    effects: { water: 0.88, wind: 0.35, shake: 0.35, ambilightColor: '#0EA5E9' },
  },
  {
    pattern:
      /(rain|storm|thunder|lightning|hurricane|tornado|tempest|wet|yağmur|fırtına|şimşek|gök gürültüsü|kasırga|sağanak|gökgürültü|korku|horror|scary)/i,
    label: 'Fırtına & Şimşek',
    effects: {
      rain: 0.9,
      water: 0.4,
      wind: 0.65,
      lightning: 0.9,
      shake: 0.5,
      ambilightColor: '#38BDF8',
    },
  },
  {
    pattern:
      /(fire|flame|burn|explosion|explode|bomb|blast|volcano|lava|inferno|boom|rocket|shoot|gun|action|war|fight|aksiyon|savaş|kavga|ateş|alev|yangın|patlama|bomba|volkan|lav|silah|fragman|trailer)/i,
    label: 'Alev & Patlama',
    effects: { fire: 0.9, shake: 0.85, wind: 0.5, ambilightColor: '#F97316' },
  },
  {
    pattern:
      /(snow|ice|winter|blizzard|freeze|frost|cold|arctic|glacier|kar\b|buz\b|kış\b|tipi|don\b|soğuk|buzul)/i,
    label: 'Kar & Tipi',
    effects: { snow: 0.9, wind: 0.55, ambilightColor: '#BAE6FD' },
  },
  {
    pattern:
      /(coaster|roller|speed|fast|race|drift|chase|crash|earthquake|fall|fly|jet|space|4dx|4d|music|clip|klip|şarkı|rap|concert|konser|hız|yarış|kovalamaca|kaza|deprem|uçuş|lunapark|araba|motor)/i,
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

/**
 * Generates timed dynamic 4DX cues when YouTube doesn't expose subtitles or
 * doesn't list explicit environment words in the title, so 4D Mode always stays alive.
 */
export function buildProceduralFourDCues(
  base: Partial<FourDEffects>,
  biomeLabel: string,
): FourDTimelineCue[] {
  const cues: FourDTimelineCue[] = [];
  const hasWater = (base.water || 0) > 0.2;
  const hasFire = (base.fire || 0) > 0.2;
  const hasRain = (base.rain || 0) > 0.2;
  const hasSnow = (base.snow || 0) > 0.2;

  for (let sec = 4; sec < 1200; sec += 14) {
    const phase = (sec / 14) % 4;
    if (hasWater) {
      cues.push({
        at: sec,
        dur: 6,
        label: phase % 2 === 0 ? 'Dev Dalga!' : 'Su Sıçraması',
        effects: { water: 0.95, wind: 0.5, shake: 0.55, ambilightColor: '#0EA5E9' },
      });
    } else if (hasFire) {
      cues.push({
        at: sec,
        dur: 5,
        label: phase % 2 === 0 ? 'Patlama Şoku!' : 'Alev Dalgası',
        effects: { fire: 0.95, shake: 0.9, wind: 0.6, ambilightColor: '#F97316' },
      });
    } else if (hasRain) {
      cues.push({
        at: sec,
        dur: 5,
        label: 'Şimşek & Gök Gürültüsü',
        effects: { rain: 0.95, lightning: 0.95, shake: 0.65, water: 0.45, ambilightColor: '#38BDF8' },
      });
    } else if (hasSnow) {
      cues.push({
        at: sec,
        dur: 6,
        label: 'Soğuk Rüzgar Tipisi',
        effects: { snow: 0.95, wind: 0.8, shake: 0.2, ambilightColor: '#BAE6FD' },
      });
    } else {
      // Dynamic multi-sensory 4DX cycle for generic YouTube videos (music, clips, scenes)
      if (phase === 0) {
        cues.push({
          at: sec,
          dur: 5,
          label: `${biomeLabel} · Rüzgar & Sarsıntı`,
          effects: { wind: 0.75, shake: 0.55, ambilightColor: '#7C5CFF' },
        });
      } else if (phase === 1) {
        cues.push({
          at: sec,
          dur: 5,
          label: '4D Su & Yağmur Dalgası',
          effects: { rain: 0.65, water: 0.5, wind: 0.45, ambilightColor: '#38BDF8' },
        });
      } else if (phase === 2) {
        cues.push({
          at: sec,
          dur: 4.5,
          label: '4D Alev & Bas Titreşimi',
          effects: { fire: 0.72, shake: 0.68, wind: 0.4, ambilightColor: '#FB923C' },
        });
      } else {
        cues.push({
          at: sec,
          dur: 5,
          label: '4D Şimşek & Hız',
          effects: { lightning: 0.85, shake: 0.62, wind: 0.8, ambilightColor: '#A855F7' },
        });
      }
    }
  }
  return cues;
}
