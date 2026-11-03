"use client";

import { SlidersIcon, SparkIcon, SpinnerIcon } from "./icons";
import { OUTPUT_FORMAT_LABELS, type FormatId } from "@/lib/formats";

type DeliveryPanelProps = {
  rate: number;
  pitch: number;
  volume: number;
  format: FormatId;
  charCount: number;
  estimatedSec: number;
  busy: boolean;
  onRateChange: (value: number) => void;
  onPitchChange: (value: number) => void;
  onVolumeChange: (value: number) => void;
  onFormatChange: (value: FormatId) => void;
  onGenerate: () => void;
};

const PRESETS = [
  { label: "Natural", rate: 0, pitch: 0, volume: 0 },
  { label: "Narration", rate: -8, pitch: -6, volume: -4 },
  { label: "Announcer", rate: 4, pitch: -12, volume: 8 },
  { label: "Brisk", rate: 22, pitch: 4, volume: 0 },
  { label: "Calm", rate: -18, pitch: -2, volume: -8 },
];

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  const progress = ((value - min) / (max - min)) * 100;
  const display = `${value > 0 ? "+" : ""}${value}${suffix}`;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label className="text-xs tracking-wide text-mist-400">{label}</label>
        <span className="font-mono text-xs text-ember-300">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ ["--range-progress" as string]: `${progress}%` }}
        aria-label={label}
      />
      <div className="mt-0.5 flex justify-between font-mono text-[0.62rem] text-mist-600">
        <span>
          {min > 0 ? "+" : ""}
          {min}
          {suffix}
        </span>
        <span>
          {max > 0 ? "+" : ""}
          {max}
          {suffix}
        </span>
      </div>
    </div>
  );
}

export default function DeliveryPanel({
  rate,
  pitch,
  volume,
  format,
  charCount,
  estimatedSec,
  busy,
  onRateChange,
  onPitchChange,
  onVolumeChange,
  onFormatChange,
  onGenerate,
}: DeliveryPanelProps) {
  const activePreset = PRESETS.find((preset) => preset.rate === rate && preset.pitch === pitch && preset.volume === volume);

  return (
    <section className="panel">
      <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
        <div className="flex items-center gap-2">
          <SlidersIcon className="h-4 w-4 text-ember-400" />
          <h2 className="font-display text-sm font-semibold tracking-wide text-mist-50">Delivery</h2>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {charCount > 1400 && (
            <span className="chip" title="Long scripts are split, synthesized in sequence and stitched back together">
              {Math.ceil(charCount / 1400)} parts
            </span>
          )}
          <span className="chip">
            {charCount.toLocaleString()} chars · ~{Math.round(estimatedSec)}s
          </span>
        </div>
      </header>

      <div className="space-y-5 px-5 py-5">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                onRateChange(preset.rate);
                onPitchChange(preset.pitch);
                onVolumeChange(preset.volume);
              }}
              className={`rounded-lg border px-2.5 py-1 text-[0.7rem] transition ${
                activePreset?.label === preset.label
                  ? "border-ember-500/50 bg-ember-500/15 text-ember-300"
                  : "border-white/[0.07] bg-white/[0.02] text-mist-500 hover:border-white/15 hover:text-mist-200"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <Slider label="Speed" value={rate} min={-50} max={100} step={1} suffix="%" onChange={onRateChange} />
        <Slider label="Pitch" value={pitch} min={-50} max={50} step={1} suffix="Hz" onChange={onPitchChange} />
        <Slider label="Volume" value={volume} min={-50} max={50} step={1} suffix="%" onChange={onVolumeChange} />

        <div>
          <label className="mb-1.5 block text-xs tracking-wide text-mist-400">Audio format</label>
          <div className="grid gap-1.5">
            {OUTPUT_FORMAT_LABELS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => onFormatChange(entry.id)}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition ${
                  format === entry.id
                    ? "border-ember-500/45 bg-ember-500/10"
                    : "border-white/[0.07] bg-ink-950/50 hover:border-white/15"
                }`}
              >
                <span>
                  <span className={`block text-xs font-medium ${format === entry.id ? "text-ember-300" : "text-mist-200"}`}>
                    {entry.label}
                  </span>
                  <span className="mt-0.5 block text-[0.68rem] text-mist-600">{entry.detail}</span>
                </span>
                <span
                  className={`h-3.5 w-3.5 shrink-0 rounded-full border ${
                    format === entry.id ? "border-ember-400 bg-ember-500" : "border-white/20"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.06] px-5 py-4">
        <button
          type="button"
          onClick={onGenerate}
          disabled={busy || charCount === 0}
          className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-b from-ember-400 to-ember-600 px-4 py-3 font-display text-sm font-semibold text-ink-950 shadow-[0_18px_40px_-18px_rgba(255,122,61,0.9)] transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:from-ink-700 disabled:to-ink-800 disabled:text-mist-600 disabled:shadow-none"
        >
          {busy ? (
            <>
              <SpinnerIcon className="h-4 w-4" />
              Synthesizing…
            </>
          ) : (
            <>
              <SparkIcon className="h-4 w-4" />
              Generate speech
              <kbd className="ml-1 rounded border border-ink-950/25 bg-ink-950/10 px-1.5 py-0.5 font-mono text-[0.6rem] tracking-tight">
                ⌘↵
              </kbd>
            </>
          )}
        </button>
        <p className="mt-2 text-center text-[0.68rem] text-mist-600">
          Streams through the free Microsoft Edge read-aloud endpoint — no key, no cost.
        </p>
      </div>
    </section>
  );
}
