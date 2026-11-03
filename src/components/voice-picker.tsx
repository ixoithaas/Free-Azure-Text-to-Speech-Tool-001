"use client";

import { useMemo, useState } from "react";

import { PlayIcon, SearchIcon, SpinnerIcon, StarIcon } from "./icons";
import type { CatalogVoice } from "@/lib/types";

type VoicePickerProps = {
  voices: CatalogVoice[];
  languages: { label: string; count: number }[];
  source: "live" | "fallback";
  selectedId: string;
  onSelect: (voiceId: string) => void;
  onPreview: (voiceId: string) => void;
  previewingId: string | null;
};

const GENDERS = ["all", "Female", "Male"] as const;
type GenderFilter = (typeof GENDERS)[number];

export default function VoicePicker({
  voices,
  languages,
  source,
  selectedId,
  onSelect,
  onPreview,
  previewingId,
}: VoicePickerProps) {
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("all");
  const [gender, setGender] = useState<GenderFilter>("all");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return voices.filter((voice) => {
      if (language !== "all" && voice.language !== language) return false;
      if (gender !== "all" && voice.gender !== gender) return false;
      if (!needle) return true;
      return (
        voice.name.toLowerCase().includes(needle) ||
        voice.id.toLowerCase().includes(needle) ||
        voice.language.toLowerCase().includes(needle) ||
        voice.locale.toLowerCase().includes(needle) ||
        voice.personalities.some((personality) => personality.toLowerCase().includes(needle))
      );
    });
  }, [gender, language, query, voices]);

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogVoice[]>();
    for (const voice of filtered) {
      const bucket = map.get(voice.language);
      if (bucket) bucket.push(voice);
      else map.set(voice.language, [voice]);
    }
    return [...map.entries()].map(([label, items]) => ({ label, items }));
  }, [filtered]);

  return (
    <section className="panel flex min-h-0 flex-col overflow-hidden">
      <header className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
        <div>
          <h2 className="font-display text-sm font-semibold tracking-wide text-mist-50">Neural voices</h2>
          <p className="mt-1 text-xs text-mist-500">
            {filtered.length} of {voices.length} free Microsoft voices
          </p>
        </div>
        <span className="chip" title={source === "live" ? "Loaded from Microsoft" : "Cached fallback list"}>
          <span className={`h-1.5 w-1.5 rounded-full ${source === "live" ? "bg-signal-400" : "bg-ember-400"}`} />
          {source === "live" ? "Live catalog" : "Offline list"}
        </span>
      </header>

      <div className="space-y-3 border-b border-white/[0.06] px-5 py-4">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-mist-600" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search voice, language or style…"
            className="w-full rounded-xl border border-white/[0.07] bg-ink-950/70 py-2.5 pr-3 pl-9 text-sm text-mist-50 placeholder:text-mist-600 focus:border-ember-500/60 focus:ring-2 focus:ring-ember-500/20 focus:outline-none"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-white/[0.07] bg-ink-950/70 px-3 py-2 text-xs text-mist-200 focus:border-ember-500/60 focus:outline-none"
          >
            <option value="all">All languages ({languages.length})</option>
            {languages.map((entry) => (
              <option key={entry.label} value={entry.label}>
                {entry.label} ({entry.count})
              </option>
            ))}
          </select>

          <div className="flex rounded-xl border border-white/[0.07] bg-ink-950/70 p-0.5">
            {GENDERS.map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setGender(entry)}
                className={`rounded-[0.6rem] px-2.5 py-1.5 text-xs font-medium transition ${
                  gender === entry ? "bg-ember-500/15 text-ember-300" : "text-mist-500 hover:text-mist-200"
                }`}
              >
                {entry === "all" ? "All" : entry}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2" style={{ maxHeight: "26rem" }}>
        {voices.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-mist-200">Voice catalog unavailable</p>
            <p className="mt-2 text-xs leading-relaxed text-mist-600">
              Microsoft&apos;s voice list could not be reached from this server. Speech generation still works with
              the default voice — press <span className="text-mist-400">Refresh voices</span> to retry.
            </p>
          </div>
        ) : grouped.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-mist-600">No voices match those filters.</p>
        ) : null}

        {grouped.map((group) => (
          <div key={group.label} className="mb-1">
            <div className="sticky top-0 z-10 flex items-center gap-2 bg-ink-900/95 px-3 py-1.5 backdrop-blur">
              <span className="font-display text-[0.68rem] tracking-[0.14em] text-mist-600 uppercase">
                {group.label}
              </span>
              <span className="h-px flex-1 bg-white/[0.06]" />
              <span className="text-[0.65rem] text-mist-600">{group.items.length}</span>
            </div>

            <ul>
              {group.items.map((voice) => {
                const selected = voice.id === selectedId;
                const previewing = voice.id === previewingId;
                return (
                  <li key={voice.id}>
                    <div
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2 transition ${
                        selected ? "bg-ember-500/10 ring-1 ring-ember-500/35" : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(voice.id)}
                        className="min-w-0 flex-1 text-left"
                        title={voice.id}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`truncate font-display text-sm font-medium ${
                              selected ? "text-ember-300" : "text-mist-50"
                            }`}
                          >
                            {voice.name}
                          </span>
                          {voice.multilingual && <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-px text-[0.6rem] text-mist-400">Multi</span>}
                          {voice.gallery && <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-px text-[0.6rem] text-mist-400">Studio</span>}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[0.7rem] text-mist-600">
                          <span className="font-mono">{voice.locale}</span>
                          <span className="h-1 w-1 rounded-full bg-ink-600" />
                          <span>{voice.gender}</span>
                          {voice.personalities.slice(0, 2).map((personality) => (
                            <span key={personality} className="hidden truncate text-mist-500 sm:inline">
                              · {personality}
                            </span>
                          ))}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => onPreview(voice.id)}
                        disabled={previewing}
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition ${
                          previewing
                            ? "border-ember-500/50 bg-ember-500/20 text-ember-300"
                            : selected
                              ? "border-ember-500/40 bg-ember-500/10 text-ember-300 hover:bg-ember-500/20"
                              : "border-white/[0.08] bg-white/[0.03] text-mist-500 opacity-0 group-hover:opacity-100 hover:text-mist-50"
                        }`}
                        title={`Preview ${voice.name}`}
                        aria-label={`Preview ${voice.name}`}
                      >
                        {previewing ? <SpinnerIcon className="h-3.5 w-3.5" /> : <PlayIcon className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-5 py-3 text-[0.7rem] text-mist-600">
        <span className="flex items-center gap-1.5">
          <StarIcon className="h-3 w-3" filled={false} />
          Azure neural quality, no API key
        </span>
        <span className="font-mono">{selectedId}</span>
      </footer>
    </section>
  );
}
