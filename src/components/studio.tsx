"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import DeliveryPanel from "./delivery-panel";
import HistoryPanel from "./history-panel";
import ScriptView from "./script-view";
import VoicePicker from "./voice-picker";
import Waveform from "./waveform";
import {
  AlertIcon,
  CheckIcon,
  CloseIcon,
  DocumentIcon,
  DownloadIcon,
  MicIcon,
  PauseIcon,
  PlayIcon,
  RefreshIcon,
  SpinnerIcon,
  StopIcon,
  WaveMark,
} from "./icons";
import { formatClock, formatDuration, estimateSeconds } from "@/lib/format";
import { DEFAULT_FORMAT, FORMAT_BY_ID, type FormatId } from "@/lib/formats";
import type { AlignedWord, ClipStats, ClipSummary, VoiceCatalog } from "@/lib/types";

const MAX_CHARS = 10000;

const DEFAULT_TEXT = `Welcome to Cadence. Paste any script here, choose one of Microsoft's free neural voices, and generate broadcast-quality narration in seconds.

Every clip is stored in your own database with word-level timings, so the script below lights up in perfect sync with the audio. Long scripts are split, synthesized, and stitched back together automatically.`;

const SAMPLES = [
  {
    label: "Product launch",
    text: `Introducing Lumen — the notebook that thinks with you.\n\nLumen turns scattered notes into a living knowledge base. Ask it anything, and it answers with sources, summaries, and next steps. No setup. No servers. Just you and your best ideas.`,
  },
  {
    label: "Audiobook",
    text: `The harbour was quiet that morning, save for the slow complaint of ropes against wet wood. Elena counted the boats twice, as she always did, and found one more than yesterday — a thin grey sloop with no name on her bow, rocking gently, as though it had been waiting a very long time to be noticed.`,
  },
  {
    label: "News bulletin",
    text: `Good evening. City council has approved the riverside transit plan, clearing the way for construction to begin next spring. Officials say the new line will cut commute times by nearly twenty minutes. In weather: expect clear skies through the weekend, with a cold front arriving Monday.`,
  },
  {
    label: "E-learning",
    text: `Lesson four: photosynthesis. Plants capture light energy and convert it into chemical energy stored in glucose. The process happens in two stages — the light-dependent reactions in the thylakoid membrane, and the Calvin cycle in the stroma. Remember: six molecules of carbon dioxide plus six of water yield one glucose and six of oxygen.`,
  },
];

const PREVIEW_TEXT = "Hi — this is how I sound. Every voice here is a free Microsoft neural voice.";

type ActiveClip = {
  key: string;
  clipId: string | null;
  audioUrl: string;
  words: AlignedWord[];
  durationSec: number;
  title: string;
  voiceId: string;
  voiceName: string;
  locale: string;
  format: FormatId;
  /** The exact script this audio was generated from (independent of the editor). */
  text: string;
  objectUrl: string | null;
};

type Toast = { id: number; kind: "success" | "error" | "info"; message: string };

type SynthOutcome = {
  blob: Blob | null;
  clip: ClipSummary | null;
  audioUrl: string | null;
  words: AlignedWord[];
  durationSec: number;
};

type StudioProps = {
  catalog: VoiceCatalog;
  initialClips: ClipSummary[];
  initialStats: ClipStats;
};

function computePeaks(buffer: AudioBuffer, buckets: number): number[] {
  const data = buffer.getChannelData(0);
  const blockSize = Math.max(1, Math.floor(data.length / buckets));
  const peaks: number[] = [];

  for (let i = 0; i < buckets; i += 1) {
    const start = i * blockSize;
    let sum = 0;
    let samples = 0;
    for (let j = 0; j < blockSize; j += 24) {
      const value = data[start + j] ?? 0;
      sum += value * value;
      samples += 1;
    }
    peaks.push(samples > 0 ? Math.sqrt(sum / samples) : 0);
  }

  const max = peaks.reduce((highest, value) => Math.max(highest, value), 0.0001);
  return peaks.map((value) => Math.min(Math.max(value / max, 0.05), 1));
}

export default function Studio({ catalog: initialCatalog, initialClips, initialStats }: StudioProps) {
  const [catalog, setCatalog] = useState<VoiceCatalog>(initialCatalog);
  const [clips, setClips] = useState<ClipSummary[]>(initialClips);
  const [stats, setStats] = useState<ClipStats>(initialStats);

  const [text, setText] = useState(DEFAULT_TEXT);
  const [voiceId, setVoiceId] = useState(() => {
    const preferred = ["en-US-AriaNeural", "en-US-JennyNeural", "en-GB-SoniaNeural"];
    return (
      preferred.find((candidate) => initialCatalog.voices.some((voice) => voice.id === candidate)) ??
      initialCatalog.voices[0]?.id ??
      "en-US-AriaNeural"
    );
  });
  const [rate, setRate] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [volume, setVolume] = useState(0);
  const [format, setFormat] = useState<FormatId>(DEFAULT_FORMAT);

  const [busy, setBusy] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const [active, setActive] = useState<ActiveClip | null>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [decoding, setDecoding] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackVolume, setPlaybackVolume] = useState(1);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const toastId = useRef(0);

  const selectedVoice = useMemo(
    () => catalog.voices.find((voice) => voice.id === voiceId) ?? null,
    [catalog.voices, voiceId],
  );

  const charCount = text.length;
  const estimated = estimateSeconds(charCount, rate);

  const notify = useCallback((kind: Toast["kind"], message: string) => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((current) => [...current, { id, kind, message }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4200);
  }, []);

  const revokeObjectUrl = useCallback((clip: ActiveClip | null) => {
    if (clip?.objectUrl) URL.revokeObjectURL(clip.objectUrl);
  }, []);

  /* ---------------------------------------------------------------- playback */

  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (audio) setCurrentTime(audio.currentTime);
    frameRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (playing) {
      frameRef.current = requestAnimationFrame(tick);
    } else if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [playing, tick]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!active) {
      audio.removeAttribute("src");
      audio.load();
      setPeaks(null);
      setCurrentTime(0);
      setPlaying(false);
      return;
    }

    audio.src = active.audioUrl;
    audio.volume = playbackVolume;
    audio.load();

    let cancelled = false;
    setDecoding(true);
    setPeaks(null);
    setCurrentTime(0);

    (async () => {
      try {
        const response = await fetch(active.audioUrl);
        if (!response.ok) throw new Error("audio fetch failed");
        const bytes = await response.arrayBuffer();
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const context = contextRef.current ?? new Ctx();
        contextRef.current = context;
        if (context.state === "suspended") await context.resume();
        const decoded = await context.decodeAudioData(bytes);
        if (cancelled) return;
        setPeaks(computePeaks(decoded, 260));
        setActive((current) =>
          current && current.key === active.key ? { ...current, durationSec: decoded.duration } : current,
        );
      } catch {
        if (!cancelled) setPeaks(null);
      } finally {
        if (!cancelled) setDecoding(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // playbackVolume is applied separately below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.audioUrl, active?.key]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = playbackVolume;
  }, [playbackVolume]);

  useEffect(() => {
    return () => {
      revokeObjectUrl(active);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !active) return;
    void audio.play().then(
      () => setPlaying(true),
      () => notify("error", "Playback was blocked by the browser. Press play again."),
    );
  }, [active, notify]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (playing) pause();
    else play();
  }, [pause, play, playing]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    setPlaying(false);
  }, []);

  /* ------------------------------------------------------------- synthesis */

  const synthesize = useCallback(
    async (options: { voiceId: string; save: boolean; sample?: string }): Promise<SynthOutcome> => {
      const body = {
        text: options.sample ?? text,
        voiceId: options.voiceId,
        rate: `${rate > 0 ? "+" : ""}${rate}%`,
        pitch: `${pitch > 0 ? "+" : ""}${pitch}Hz`,
        volume: `${volume > 0 ? "+" : ""}${volume}%`,
        format,
        save: options.save,
      };

      const response = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!options.save) {
        if (!response.ok) {
          const detail = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(detail?.error ?? `Preview failed (${response.status})`);
        }
        const blob = await response.blob();
        return { blob, clip: null, audioUrl: null, words: [], durationSec: 0 };
      }

      const payload = (await response.json()) as {
        clip?: ClipSummary;
        audioUrl?: string;
        words?: AlignedWord[];
        durationSec?: number;
        error?: string;
        hint?: string;
      };

      if (!response.ok || !payload.clip || !payload.audioUrl) {
        throw new Error(payload.error ?? `Synthesis failed (${response.status})`);
      }

      return {
        blob: null,
        clip: payload.clip,
        audioUrl: payload.audioUrl,
        words: payload.words ?? [],
        durationSec: payload.durationSec ?? 0,
      };
    },
    [format, pitch, rate, text, volume],
  );

  const handleGenerate = useCallback(async () => {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      setError("Write something first — the script is empty.");
      notify("error", "Script is empty");
      return;
    }
    if (trimmed.length > MAX_CHARS) {
      setError(`Scripts are limited to ${MAX_CHARS.toLocaleString()} characters.`);
      return;
    }

    setError(null);
    setBusy(true);
    setElapsed(0);
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 100);

    try {
      const result = await synthesize({ voiceId, save: true });
      const clip = result.clip;
      const audioUrl = result.audioUrl;
      if (!clip || !audioUrl) throw new Error("Synthesis returned no clip");
      revokeObjectUrl(active);

      setActive({
        key: `${clip.id}-${Date.now()}`,
        clipId: clip.id,
        audioUrl,
        words: result.words ?? [],
        durationSec: result.durationSec ?? clip.durationSec,
        title: clip.title,
        voiceId: clip.voiceId,
        voiceName: clip.voiceName,
        locale: clip.locale,
        format,
        text,
        objectUrl: null,
      });
      setClips((current) => [clip, ...current.filter((item) => item.id !== clip.id)]);
      setStats((current) => ({
        clips: current.clips + 1,
        seconds: current.seconds + clip.durationSec,
        bytes: current.bytes + clip.audioBytes,
        chars: current.chars + clip.charCount,
      }));
      notify("success", `Generated ${formatDuration(clip.durationSec)} with ${clip.voiceName}`);
      window.setTimeout(() => play(), 260);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Speech synthesis failed";
      setError(message);
      notify("error", message);
    } finally {
      window.clearInterval(timer);
      setBusy(false);
    }
  }, [active, notify, play, revokeObjectUrl, synthesize, text, voiceId]);

  const handlePreview = useCallback(
    async (previewVoice: string) => {
      setPreviewingId(previewVoice);
      try {
        const result = await synthesize({ voiceId: previewVoice, save: false, sample: PREVIEW_TEXT });
        if (!result.blob) throw new Error("Preview returned no audio");
        const objectUrl = URL.createObjectURL(result.blob);
        revokeObjectUrl(active);
        const voice = catalog.voices.find((item) => item.id === previewVoice);
        setActive({
          key: `preview-${previewVoice}-${Date.now()}`,
          clipId: null,
          audioUrl: objectUrl,
          words: [],
          durationSec: 0,
          title: `${voice?.name ?? previewVoice} preview`,
          voiceId: previewVoice,
          voiceName: voice?.name ?? previewVoice,
          locale: voice?.locale ?? "",
          format,
          text: PREVIEW_TEXT,
          objectUrl,
        });
        window.setTimeout(() => play(), 240);
      } catch (cause) {
        notify("error", cause instanceof Error ? cause.message : "Preview failed");
      } finally {
        setPreviewingId(null);
      }
    },
    [active, catalog.voices, notify, play, revokeObjectUrl, synthesize],
  );

  const playClip = useCallback(
    (clip: ClipSummary) => {
      if (active?.clipId === clip.id) {
        togglePlay();
        return;
      }
      revokeObjectUrl(active);
      const key = `${clip.id}-${Date.now()}`;
      const clipFormat = (clip.format as FormatId) ?? DEFAULT_FORMAT;
      setActive({
        key,
        clipId: clip.id,
        audioUrl: `/api/clips/${clip.id}/audio?ext=${FORMAT_BY_ID[clipFormat]?.extension ?? "mp3"}`,
        words: clip.words ?? [],
        durationSec: clip.durationSec,
        title: clip.title,
        voiceId: clip.voiceId,
        voiceName: clip.voiceName,
        locale: clip.locale,
        format: clipFormat,
        text: clip.preview,
        objectUrl: null,
      });
      window.setTimeout(() => play(), 240);

      // The list payload only carries a truncated preview: pull the full script so
      // word highlighting lines up with the stored timings.
      void fetch(`/api/clips/${clip.id}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: { text?: string } | null) => {
          if (typeof payload?.text === "string") {
            setActive((current) => (current && current.key === key ? { ...current, text: payload.text! } : current));
          }
        })
        .catch(() => undefined);
    },
    [active, play, revokeObjectUrl, togglePlay],
  );

  const loadClip = useCallback(
    async (clip: ClipSummary) => {
      try {
        const response = await fetch(`/api/clips/${clip.id}`);
        const payload = (await response.json()) as { text?: string; error?: string };
        if (!response.ok || typeof payload.text !== "string") {
          throw new Error(payload.error ?? "Could not load clip");
        }
        setText(payload.text);
        setVoiceId(clip.voiceId);
        setRate(Number.parseInt(clip.rate, 10) || 0);
        setPitch(Number.parseInt(clip.pitch, 10) || 0);
        setVolume(Number.parseInt(clip.volume, 10) || 0);
        setFormat((clip.format as FormatId) ?? DEFAULT_FORMAT);
        playClip(clip);
        notify("info", "Script and settings restored");
      } catch (cause) {
        notify("error", cause instanceof Error ? cause.message : "Could not load clip");
      }
    },
    [notify, playClip],
  );

  const downloadClip = useCallback(
    async (target: { clipId: string | null; audioUrl: string; title: string; format: string }) => {
      try {
        const response = await fetch(target.audioUrl);
        if (!response.ok) throw new Error("Download failed");
        const blob = await response.blob();
        const info = FORMAT_BY_ID[(target.format as FormatId) ?? DEFAULT_FORMAT];
        const extension = info?.extension ?? "mp3";
        const slug = target.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 48);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${slug || "cadence-speech"}.${extension}`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 4000);
        notify("success", "Audio downloaded");
      } catch (cause) {
        notify("error", cause instanceof Error ? cause.message : "Download failed");
      }
    },
    [notify],
  );

  const starClip = useCallback(
    async (clip: ClipSummary) => {
      const next = !clip.starred;
      setClips((current) => current.map((item) => (item.id === clip.id ? { ...item, starred: next } : item)));
      try {
        const response = await fetch(`/api/clips/${clip.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ starred: next }),
        });
        if (!response.ok) throw new Error("Could not update clip");
      } catch {
        setClips((current) => current.map((item) => (item.id === clip.id ? { ...item, starred: !next } : item)));
        notify("error", "Could not update clip");
      }
    },
    [notify],
  );

  const deleteClip = useCallback(
    async (clip: ClipSummary) => {
      const snapshot = clips;
      setClips((current) => current.filter((item) => item.id !== clip.id));
      try {
        const response = await fetch(`/api/clips/${clip.id}`, { method: "DELETE" });
        if (!response.ok) throw new Error("Could not delete clip");
        if (active?.clipId === clip.id) {
          stop();
          setActive(null);
        }
        notify("info", "Clip deleted");
      } catch {
        setClips(snapshot);
        notify("error", "Could not delete clip");
      }
    },
    [active, clips, notify, stop],
  );

  const clearClips = useCallback(async () => {
    const snapshot = clips;
    setClips([]);
    try {
      const response = await fetch("/api/clips", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not clear clips");
      stop();
      setActive(null);
      notify("info", "All clips cleared");
    } catch {
      setClips(snapshot);
      notify("error", "Could not clear clips");
    }
  }, [clips, notify, stop]);

  const refreshVoices = useCallback(async () => {
    try {
      const response = await fetch("/api/voices?refresh=1");
      const payload = (await response.json()) as VoiceCatalog & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not refresh voices");
      setCatalog(payload);
      notify("success", `${payload.voices.length} voices loaded from Microsoft`);
    } catch (cause) {
      notify("error", cause instanceof Error ? cause.message : "Could not refresh voices");
    }
  }, [notify]);

  /* ------------------------------------------------------------- shortcuts */

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void handleGenerate();
        return;
      }
      if (event.code === "Space" && !typing && active) {
        event.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, handleGenerate, togglePlay]);

  const duration = active?.durationSec ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      {/* ------------------------------------------------------------- header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-ember-400 to-ember-600 text-ink-950 shadow-[0_16px_36px_-16px_rgba(255,122,61,0.95)]">
            <WaveMark className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl leading-none font-bold tracking-tight text-mist-50">Cadence</h1>
            <p className="mt-1.5 text-xs text-mist-500">
              Text-to-speech studio · free Microsoft Edge neural voices
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="chip">
            <span className={`h-1.5 w-1.5 rounded-full ${catalog.source === "live" ? "bg-signal-400" : "bg-ember-400"}`} />
            {catalog.voices.length} voices · {catalog.languages.length} languages
          </span>
          <span className="chip">
            <DocumentIcon className="h-3 w-3" />
            {clips.length} clips saved
          </span>
          <button
            type="button"
            onClick={() => void refreshVoices()}
            className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-mist-400 transition hover:border-white/20 hover:text-mist-100"
          >
            <RefreshIcon className="h-3.5 w-3.5" />
            Refresh voices
          </button>
        </div>
      </header>

      {/* --------------------------------------------------------------- body */}
      <div className="mt-7 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0 space-y-5">
          {/* editor */}
          <section className="panel">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
              <div className="flex items-center gap-2">
                <DocumentIcon className="h-4 w-4 text-ember-400" />
                <h2 className="font-display text-sm font-semibold tracking-wide text-mist-50">Script</h2>
                {selectedVoice && (
                  <span className="chip">
                    <MicIcon className="h-3 w-3" />
                    {selectedVoice.name} · {selectedVoice.locale}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {SAMPLES.map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => setText(sample.text)}
                    className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-[0.7rem] text-mist-500 transition hover:border-ember-500/40 hover:text-ember-300"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </header>

            <div className="px-5 py-4">
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value.slice(0, MAX_CHARS))}
                spellCheck
                rows={11}
                placeholder="Paste or write the script you want narrated…"
                className="w-full rounded-xl border border-white/[0.07] bg-ink-950/70 p-4 font-sans text-[0.95rem] leading-relaxed text-mist-50 placeholder:text-mist-600 focus:border-ember-500/50 focus:ring-2 focus:ring-ember-500/15 focus:outline-none"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[0.72rem] text-mist-600">
                <span>
                  {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters ·{" "}
                  {text.trim().split(/\s+/).filter(Boolean).length.toLocaleString()} words · ~
                  {formatDuration(estimated)} of audio
                </span>
                <span className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setText("")}
                    className="transition hover:text-mist-200"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setText(DEFAULT_TEXT)}
                    className="transition hover:text-mist-200"
                  >
                    Reset sample
                  </button>
                </span>
              </div>
            </div>
          </section>

          {/* player */}
          <section className="panel">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
              <div className="min-w-0">
                <h2 className="truncate font-display text-sm font-semibold tracking-wide text-mist-50">
                  {active ? active.title : "Player"}
                </h2>
                <p className="mt-1 truncate text-[0.72rem] text-mist-600">
                  {active
                    ? `${active.voiceName}${active.locale ? ` · ${active.locale}` : ""}${active.clipId ? "" : " · preview (not saved)"}`
                    : "Nothing loaded yet"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-mist-400">
                  {formatClock(currentTime)} <span className="text-mist-600">/ {formatClock(duration)}</span>
                </span>
                {active && (
                  <button
                    type="button"
                    onClick={() =>
                      void downloadClip({
                        clipId: active.clipId,
                        audioUrl: active.audioUrl,
                        title: active.title,
                        format: active.format,
                      })
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[0.72rem] text-mist-300 transition hover:border-signal-400/40 hover:text-signal-300"
                  >
                    <DownloadIcon className="h-3.5 w-3.5" />
                    Download
                  </button>
                )}
              </div>
            </header>

            <div className="space-y-4 px-5 py-5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  disabled={!active}
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-b from-ember-400 to-ember-600 text-ink-950 shadow-[0_14px_30px_-14px_rgba(255,122,61,0.95)] transition hover:brightness-110 active:scale-95 disabled:from-ink-700 disabled:to-ink-800 disabled:text-mist-600 disabled:shadow-none"
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
                </button>
                <button
                  type="button"
                  onClick={stop}
                  disabled={!active}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.03] text-mist-400 transition hover:text-mist-50 disabled:opacity-40"
                  aria-label="Stop"
                >
                  <StopIcon className="h-3.5 w-3.5" />
                </button>

                <div className="min-w-0 flex-1">
                  <Waveform
                    peaks={peaks}
                    durationSec={duration}
                    currentTime={currentTime}
                    loading={decoding}
                    onSeek={(seconds) => {
                      const audio = audioRef.current;
                      if (!audio) return;
                      audio.currentTime = seconds;
                      setCurrentTime(seconds);
                    }}
                  />
                </div>

                <div className="hidden w-28 shrink-0 sm:block">
                  <label className="mb-1 block text-[0.65rem] tracking-wide text-mist-600">Monitor</label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={playbackVolume}
                    onChange={(event) => setPlaybackVolume(Number(event.target.value))}
                    style={{ ["--range-progress" as string]: `${playbackVolume * 100}%` }}
                    aria-label="Playback volume"
                  />
                </div>
              </div>

              {busy && (
                <div className="flex items-center gap-3 rounded-xl border border-ember-500/25 bg-ember-500/[0.07] px-4 py-3">
                  <SpinnerIcon className="h-4 w-4 shrink-0 text-ember-400" />
                  <p className="text-xs text-ember-300">
                    Synthesizing {charCount.toLocaleString()} characters with {selectedVoice?.name ?? voiceId}…
                  </p>
                  <span className="ml-auto font-mono text-xs text-ember-300/80">{elapsed.toFixed(1)}s</span>
                </div>
              )}

              {error && !busy && (
                <div className="flex items-start gap-3 rounded-xl border border-red-400/25 bg-red-500/[0.07] px-4 py-3">
                  <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                  <div className="text-xs text-red-200/90">
                    <p>{error}</p>
                    <p className="mt-1 text-red-200/60">
                      Microsoft rotates the read-aloud DRM token and occasionally rate-limits; retry in a moment or
                      refresh the voice list.
                    </p>
                  </div>
                  <button type="button" onClick={() => setError(null)} className="ml-auto text-red-200/60 hover:text-red-100">
                    <CloseIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {active && active.words.length > 0 && (
                <div className="animate-rise">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-display text-[0.7rem] tracking-[0.14em] text-mist-600 uppercase">
                      Synced script
                    </h3>
                    <span className="text-[0.68rem] text-mist-600">
                      {active.words.length} word timings from the service
                    </span>
                  </div>
                  <ScriptView text={active.text} words={active.words} currentTime={currentTime} />
                </div>
              )}
            </div>
          </section>
        </div>

        {/* sidebar */}
        <div className="min-w-0 space-y-5">
          <VoicePicker
            voices={catalog.voices}
            languages={catalog.languages}
            source={catalog.source}
            selectedId={voiceId}
            onSelect={setVoiceId}
            onPreview={(id) => void handlePreview(id)}
            previewingId={previewingId}
          />
          <DeliveryPanel
            rate={rate}
            pitch={pitch}
            volume={volume}
            format={format}
            charCount={charCount}
            estimatedSec={estimated}
            busy={busy}
            onRateChange={setRate}
            onPitchChange={setPitch}
            onVolumeChange={setVolume}
            onFormatChange={setFormat}
            onGenerate={() => void handleGenerate()}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------ history */}
      <div className="mt-5">
        <HistoryPanel
          clips={clips}
          stats={stats}
          activeClipId={active?.clipId ?? null}
          busyId={null}
          onPlay={playClip}
          onLoad={(clip) => void loadClip(clip)}
          onDownload={(clip) =>
            void downloadClip({
              clipId: clip.id,
              audioUrl: `/api/clips/${clip.id}/audio?ext=${FORMAT_BY_ID[(clip.format as FormatId) ?? DEFAULT_FORMAT]?.extension ?? "mp3"}`,
              title: clip.title,
              format: clip.format,
            })
          }
          onStar={(clip) => void starClip(clip)}
          onDelete={(clip) => void deleteClip(clip)}
          onClear={() => void clearClips()}
        />
      </div>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-6 text-[0.72rem] text-mist-600">
        <p>
          Audio is generated by the free Microsoft Edge read-aloud service (Azure neural voices) — no API key or
          subscription required.
        </p>
        <p className="font-mono">
          {catalog.source === "live" ? "catalog: live" : "catalog: cached"} · clips stored in PostgreSQL
        </p>
      </footer>

      {/* hidden transport element */}
      <audio
        ref={audioRef}
        className="hidden"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
          const audio = audioRef.current;
          if (audio) audio.currentTime = 0;
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onError={() => {
          if (active) notify("error", "The audio could not be played.");
          setPlaying(false);
        }}
      />

      {/* toasts */}
      <div className="pointer-events-none fixed right-5 bottom-5 z-50 flex w-[min(22rem,calc(100vw-2.5rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`animate-toast pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs shadow-[0_24px_50px_-24px_rgba(0,0,0,0.95)] backdrop-blur ${
              toast.kind === "success"
                ? "border-signal-400/30 bg-signal-500/10 text-signal-300"
                : toast.kind === "error"
                  ? "border-red-400/30 bg-red-500/10 text-red-200"
                  : "border-white/10 bg-ink-800/90 text-mist-200"
            }`}
          >
            {toast.kind === "success" ? (
              <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : toast.kind === "error" ? (
              <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <WaveMark className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            <p className="flex-1">{toast.message}</p>
            <button
              type="button"
              onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
              className="shrink-0 opacity-60 transition hover:opacity-100"
              aria-label="Dismiss"
            >
              <CloseIcon className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
