"use client";

import { ClockIcon, DownloadIcon, DocumentIcon, PlayIcon, SpinnerIcon, StarIcon, TrashIcon } from "./icons";
import { formatBytes, formatDuration, formatRelative } from "@/lib/format";
import type { ClipStats, ClipSummary } from "@/lib/types";

type HistoryPanelProps = {
  clips: ClipSummary[];
  stats: ClipStats;
  activeClipId: string | null;
  busyId: string | null;
  onPlay: (clip: ClipSummary) => void;
  onLoad: (clip: ClipSummary) => void;
  onDownload: (clip: ClipSummary) => void;
  onStar: (clip: ClipSummary) => void;
  onDelete: (clip: ClipSummary) => void;
  onClear: () => void;
};

export default function HistoryPanel({
  clips,
  stats,
  activeClipId,
  busyId,
  onPlay,
  onLoad,
  onDownload,
  onStar,
  onDelete,
  onClear,
}: HistoryPanelProps) {
  return (
    <section className="panel overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
        <div className="flex items-center gap-2">
          <ClockIcon className="h-4 w-4 text-signal-400" />
          <h2 className="font-display text-sm font-semibold tracking-wide text-mist-50">Saved clips</h2>
          <span className="chip">{clips.length}</span>
        </div>

        <div className="flex items-center gap-4 text-[0.7rem] text-mist-600">
          <span>
            {formatDuration(stats.seconds)} of audio
          </span>
          <span>{formatBytes(stats.bytes)} stored</span>
          <span>{stats.chars.toLocaleString()} chars</span>
          {clips.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="rounded-lg border border-white/[0.07] px-2 py-1 text-[0.68rem] text-mist-500 transition hover:border-ember-500/40 hover:text-ember-300"
            >
              Clear all
            </button>
          )}
        </div>
      </header>

      {clips.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <DocumentIcon className="h-7 w-7 text-ink-600" />
          <p className="max-w-sm text-sm text-mist-500">
            Nothing recorded yet. Write a script, pick a voice, and your first clip will be stored here with its
            word timings.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.04]">
          {clips.map((clip) => {
            const active = clip.id === activeClipId;
            const busy = clip.id === busyId;
            return (
              <li
                key={clip.id}
                className={`group flex flex-wrap items-center gap-3 px-5 py-3 transition ${
                  active ? "bg-ember-500/[0.07]" : "hover:bg-white/[0.025]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onPlay(clip)}
                  disabled={busy}
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition ${
                    active
                      ? "border-ember-500/50 bg-ember-500/15 text-ember-300"
                      : "border-white/[0.08] bg-white/[0.03] text-mist-400 hover:border-ember-500/40 hover:text-ember-300"
                  } disabled:opacity-60`}
                  title="Play clip"
                  aria-label={`Play ${clip.title}`}
                >
                  {busy ? <SpinnerIcon className="h-4 w-4" /> : <PlayIcon className="h-3.5 w-3.5" />}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-mist-50">{clip.title}</p>
                    {clip.starred && <StarIcon className="h-3.5 w-3.5 shrink-0 text-ember-400" filled />}
                  </div>
                  <p className="mt-0.5 truncate text-[0.72rem] text-mist-600">{clip.preview}</p>
                </div>

                <div className="hidden shrink-0 flex-col items-end gap-0.5 text-[0.7rem] text-mist-500 md:flex">
                  <span className="font-mono text-mist-300">
                    {clip.voiceName} <span className="text-mist-600">· {clip.locale}</span>
                  </span>
                  <span className="font-mono text-mist-600">
                    {formatDuration(clip.durationSec)} · {formatBytes(clip.audioBytes)} · {clip.rate} {clip.pitch}
                  </span>
                </div>

                <span className="hidden shrink-0 font-mono text-[0.68rem] text-mist-600 lg:block">
                  {formatRelative(clip.createdAt)}
                </span>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onLoad(clip)}
                    className="rounded-lg border border-white/[0.07] px-2.5 py-1.5 text-[0.7rem] text-mist-400 transition hover:border-signal-400/40 hover:text-signal-300"
                    title="Load script and settings into the editor"
                  >
                    Edit
                  </button>
                  <IconButton label="Download audio" onClick={() => onDownload(clip)}>
                    <DownloadIcon className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton
                    label={clip.starred ? "Unpin clip" : "Pin clip"}
                    onClick={() => onStar(clip)}
                    active={clip.starred}
                  >
                    <StarIcon className="h-3.5 w-3.5" filled={clip.starred} />
                  </IconButton>
                  <IconButton label="Delete clip" onClick={() => onDelete(clip)} danger>
                    <TrashIcon className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function IconButton({
  children,
  label,
  onClick,
  active,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`grid h-8 w-8 place-items-center rounded-lg border transition ${
        active
          ? "border-ember-500/45 bg-ember-500/15 text-ember-300"
          : danger
            ? "border-white/[0.07] text-mist-500 hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300"
            : "border-white/[0.07] text-mist-500 hover:border-white/20 hover:text-mist-100"
      }`}
    >
      {children}
    </button>
  );
}
