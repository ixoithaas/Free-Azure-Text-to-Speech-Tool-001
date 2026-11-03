"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type WaveformProps = {
  peaks: number[] | null;
  durationSec: number;
  currentTime: number;
  loading?: boolean;
  onSeek: (seconds: number) => void;
};

const BAR_WIDTH = 3;
const BAR_GAP = 2;

function placeholderPeaks(count: number): number[] {
  const peaks: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const wave = Math.sin(i / 6.5) * 0.32 + Math.sin(i / 2.3) * 0.18;
    peaks.push(0.34 + Math.abs(wave) * 0.5);
  }
  return peaks;
}

export default function Waveform({ peaks, durationSec, currentTime, loading, onSeek }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 96 });
  const [scrubbing, setScrubbing] = useState(false);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({ width: Math.max(entry.contentRect.width, 40), height: Math.max(entry.contentRect.height, 60) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(size.width * dpr);
    canvas.height = Math.floor(size.height * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);

    const slots = Math.floor(size.width / (BAR_WIDTH + BAR_GAP));
    const source = peaks && peaks.length > 0 ? peaks : placeholderPeaks(slots);
    const progress = durationSec > 0 ? Math.min(Math.max(currentTime / durationSec, 0), 1) : 0;
    const midY = size.height / 2;

    for (let i = 0; i < slots; i += 1) {
      const ratio = slots === 1 ? 0 : i / (slots - 1);
      const sampleIndex = Math.floor(ratio * (source.length - 1));
      const value = Math.min(Math.max(source[sampleIndex] ?? 0.05, 0.04), 1);
      const barHeight = Math.max(value * (size.height - 10), 3);
      const x = i * (BAR_WIDTH + BAR_GAP);
      const played = ratio <= progress;

      ctx.beginPath();
      ctx.roundRect(x, midY - barHeight / 2, BAR_WIDTH, barHeight, BAR_WIDTH / 2);
      if (played) {
        const gradient = ctx.createLinearGradient(0, midY - barHeight / 2, 0, midY + barHeight / 2);
        gradient.addColorStop(0, "#ffbe8f");
        gradient.addColorStop(0.5, "#ff7a3d");
        gradient.addColorStop(1, "#e5601f");
        ctx.fillStyle = gradient;
      } else {
        ctx.fillStyle = loading ? "rgba(255,255,255,0.16)" : "rgba(155,168,190,0.24)";
      }
      ctx.fill();
    }

    // playhead
    if (durationSec > 0) {
      const x = Math.min(Math.max(progress * size.width, 0), size.width - 1);
      ctx.fillStyle = "rgba(63,224,195,0.9)";
      ctx.fillRect(x, 4, 1.5, size.height - 8);
      ctx.beginPath();
      ctx.arc(x + 0.75, 5, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [currentTime, durationSec, loading, peaks, size.height, size.width]);

  useEffect(() => {
    draw();
  }, [draw]);

  const seekFromEvent = useCallback(
    (clientX: number) => {
      const element = wrapRef.current;
      if (!element || durationSec <= 0) return;
      const rect = element.getBoundingClientRect();
      const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      onSeek(ratio * durationSec);
    },
    [durationSec, onSeek],
  );

  return (
    <div
      ref={wrapRef}
      className="relative h-24 w-full cursor-pointer select-none overflow-hidden rounded-xl border border-white/[0.06] bg-ink-950/70"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setScrubbing(true);
        seekFromEvent(event.clientX);
      }}
      onPointerMove={(event) => {
        if (scrubbing) seekFromEvent(event.clientX);
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        setScrubbing(false);
      }}
      onPointerCancel={() => setScrubbing(false)}
      role="slider"
      aria-label="Seek audio"
      aria-valuemin={0}
      aria-valuemax={Math.round(durationSec)}
      aria-valuenow={Math.round(currentTime)}
      tabIndex={0}
      onKeyDown={(event) => {
        if (durationSec <= 0) return;
        if (event.key === "ArrowRight") onSeek(Math.min(currentTime + 1, durationSec));
        if (event.key === "ArrowLeft") onSeek(Math.max(currentTime - 1, 0));
      }}
    >
      <canvas ref={canvasRef} style={{ width: size.width, height: size.height }} className="block" />
      {loading && <div className="shimmer pointer-events-none absolute inset-0 opacity-70" />}
      {durationSec === 0 && !loading && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p className="text-xs tracking-wide text-mist-600">Generate speech to see the waveform</p>
        </div>
      )}
    </div>
  );
}
