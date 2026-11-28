'use client';

import { create } from 'zustand';
import {
  FourDEffects,
  FourDVideoProfile,
  ZERO_4D_EFFECTS,
  matchFourDEffectsFromText,
} from '@/lib/media/fourDEffects';

export type { FourDEffects, FourDVideoProfile };
export type { FourDTimelineCue } from '@/lib/media/fourDEffects';
export { ZERO_4D_EFFECTS, matchFourDEffectsFromText };

interface FourDStoreState {
  enabled: boolean;
  intensity: number; // 0.3..1.5
  current: FourDEffects;
  manualOverride: Partial<FourDEffects> | null;
  manualUntil: number;
  profile: FourDVideoProfile | null;

  setEnabled: (enabled: boolean) => void;
  setIntensity: (intensity: number) => void;
  setProfile: (profile: FourDVideoProfile | null) => void;
  setCurrent: (patch: Partial<FourDEffects>) => void;
  triggerManualBurst: (patch: Partial<FourDEffects>, durationMs?: number) => void;
  clearManual: () => void;
  reset4D: () => void;
}

export const useFourDStore = create<FourDStoreState>((set) => ({
  enabled: true,
  intensity: 1.0,
  current: ZERO_4D_EFFECTS,
  manualOverride: null,
  manualUntil: 0,
  profile: null,

  setEnabled: (enabled) =>
    set((s) => ({
      enabled,
      current: enabled ? s.current : ZERO_4D_EFFECTS,
    })),

  setIntensity: (intensity) =>
    set({ intensity: Math.max(0.25, Math.min(1.6, intensity)) }),

  setProfile: (profile) => set({ profile }),

  setCurrent: (patch) =>
    set((s) => ({
      current: {
        ...s.current,
        ...patch,
      },
    })),

  triggerManualBurst: (patch, durationMs = 7000) =>
    set({
      manualOverride: patch,
      manualUntil: Date.now() + durationMs,
    }),

  clearManual: () => set({ manualOverride: null, manualUntil: 0 }),

  reset4D: () =>
    set({
      current: ZERO_4D_EFFECTS,
      manualOverride: null,
      manualUntil: 0,
      profile: null,
    }),
}));
