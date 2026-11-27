'use client';

import { AmbientMusicPreset } from '@luma/shared';

export class AmbientMusicEngine {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private oscs: OscillatorNode[] = [];
  private currentPreset: AmbientMusicPreset = 'none';

  setPreset(preset: AmbientMusicPreset, volume: number = 0.08): void {
    if (preset === this.currentPreset) {
      if (this.gain && this.ctx) {
        this.gain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.25);
      }
      return;
    }

    this.stop();
    this.currentPreset = preset;
    if (preset === 'none') return;

    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const gain = ctx.createGain();
    gain.gain.value = 0;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = preset === 'synth-soft' ? 680 : 420;

    gain.connect(filter);
    filter.connect(ctx.destination);

    const freqs =
      preset === 'lofi-cinema'
        ? [130.81, 196.0, 246.94] // C3, G3, B3 warm pad
        : preset === 'deep-ambient'
          ? [98.0, 146.83, 220.0] // G2, D3, A3
          : [110.0, 164.81, 246.94]; // A2, E3, B3

    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = preset === 'synth-soft' ? 'triangle' : 'sine';
      osc.frequency.value = f;
      osc.connect(gain);
      osc.start();
      this.oscs.push(osc);
    }

    gain.gain.setTargetAtTime(volume, ctx.currentTime, 0.8);
    this.ctx = ctx;
    this.gain = gain;
  }

  stop(): void {
    for (const o of this.oscs) {
      try {
        o.stop();
        o.disconnect();
      } catch {
        // ignore
      }
    }
    this.oscs = [];
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.gain = null;
    }
    this.currentPreset = 'none';
  }
}
