/** Shared, client-safe types (no server-only imports allowed in this file). */

export type AlignedWord = {
  word: string;
  charOffset: number;
  charLength: number;
  startSec: number;
  endSec: number;
};

export type CatalogVoice = {
  id: string;
  name: string;
  language: string;
  locale: string;
  gender: "Female" | "Male" | "Other";
  personalities: string[];
  categories: string[];
  multilingual: boolean;
  gallery: boolean;
};

export type VoiceCatalog = {
  voices: CatalogVoice[];
  languages: { label: string; count: number }[];
  source: "live" | "fallback";
  fetchedAt: string;
};

export type ClipSummary = {
  id: string;
  title: string;
  preview: string;
  voiceId: string;
  voiceName: string;
  language: string;
  locale: string;
  gender: string;
  rate: string;
  pitch: string;
  volume: string;
  format: string;
  mimeType: string;
  charCount: number;
  durationSec: number;
  audioBytes: number;
  chunks: number;
  words: AlignedWord[];
  starred: boolean;
  createdAt: string;
};

export type ClipStats = {
  clips: number;
  seconds: number;
  bytes: number;
  chars: number;
};

export type SynthesizeResponse = {
  clip?: ClipSummary;
  audioUrl?: string;
  words: AlignedWord[];
  durationSec: number;
  elapsedMs?: number;
  transient?: boolean;
  audioBytes?: number;
  chunks?: number;
  error?: string;
  hint?: string;
};
