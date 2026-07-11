'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Swiggy-partner-style new-order alert. Browsers block audio until a user
 * gesture, so the pharmacist clicks "Enable sound" once to prime an
 * AudioContext; after that we synthesize a two-tone chime with the Web Audio
 * API — no audio asset to bundle or fail to load.
 */
export function useOrderAlert() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [enabled, setEnabled] = useState(false);

  const enable = useCallback(() => {
    if (ctxRef.current) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    ctxRef.current = new Ctx();
    setEnabled(true);
  }, []);

  const beep = useCallback((ctx: AudioContext, startAt: number, freq: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.3, startAt + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + 0.36);
  }, []);

  const play = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime;
    // Rising two-tone chime, repeated twice so it carries across a busy shop.
    [0, 0.45, 1.1, 1.55].forEach((offset, i) => beep(ctx, now + offset, i % 2 === 0 ? 880 : 1174));
  }, [beep]);

  useEffect(() => {
    return () => {
      void ctxRef.current?.close();
    };
  }, []);

  return { enabled, enable, play };
}
