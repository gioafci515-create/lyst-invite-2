"use client";

import { useEffect, useRef } from "react";

/** Bars driven by the live microphone level. Static low bars when idle/paused or when reduced motion is on. */
export default function LiveWave({ stream, active }: { stream: MediaStream | null; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const BARS = 28;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const color = getComputedStyle(canvas).color || "#111";
    const w = (canvas.width = canvas.clientWidth * 2);
    const h = (canvas.height = canvas.clientHeight * 2);
    const draw = (levels: number[]) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      const bw = w / BARS;
      levels.forEach((v, i) => {
        const bh = Math.max(4, v * h);
        ctx.fillRect(i * bw + bw * 0.2, (h - bh) / 2, bw * 0.6, bh);
      });
    };
    const idle = Array.from({ length: BARS }, () => 0.06);
    draw(idle);
    if (!stream || !active || reduce) return;

    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    let raf = 0;
    let audio: AudioContext | null = null;
    try {
      audio = new AC();
      const src = audio.createMediaStreamSource(stream);
      const an = audio.createAnalyser();
      an.fftSize = 64;
      src.connect(an);
      const data = new Uint8Array(an.frequencyBinCount);
      const levels = [...idle];
      const tick = () => {
        an.getByteFrequencyData(data);
        let sum = 0;
        for (const d of data) sum += d;
        const level = Math.min(1, (sum / data.length / 255) * 2.2);
        levels.shift();
        levels.push(Math.max(0.06, level));
        draw(levels);
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* no analyser: keep idle bars */
    }
    return () => {
      cancelAnimationFrame(raf);
      audio?.close().catch(() => {});
    };
  }, [stream, active]);

  return <canvas ref={ref} aria-hidden style={{ width: "100%", height: 36, display: "block" }} />;
}
