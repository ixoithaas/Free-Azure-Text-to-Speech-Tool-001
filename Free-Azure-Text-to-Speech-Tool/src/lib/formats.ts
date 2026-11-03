/** Client-safe metadata for the audio formats the Edge service accepts. */

export type FormatId =
  | "audio-24khz-48kbitrate-mono-mp3"
  | "audio-24khz-96kbitrate-mono-mp3"
  | "webm-24khz-16bit-mono-opus";

export type FormatInfo = {
  id: FormatId;
  label: string;
  detail: string;
  extension: string;
  mime: string;
};

export const OUTPUT_FORMAT_LABELS: FormatInfo[] = [
  {
    id: "audio-24khz-48kbitrate-mono-mp3",
    label: "MP3 · 24 kHz · 48 kbps",
    detail: "Smallest file, great for voice",
    extension: "mp3",
    mime: "audio/mpeg",
  },
  {
    id: "audio-24khz-96kbitrate-mono-mp3",
    label: "MP3 · 24 kHz · 96 kbps",
    detail: "Higher fidelity, still universal",
    extension: "mp3",
    mime: "audio/mpeg",
  },
  {
    id: "webm-24khz-16bit-mono-opus",
    label: "WebM · Opus 16-bit",
    detail: "Efficient, best for web playback",
    extension: "webm",
    mime: "audio/webm",
  },
];

export const FORMAT_BY_ID: Record<FormatId, FormatInfo> = OUTPUT_FORMAT_LABELS.reduce(
  (accumulator, entry) => {
    accumulator[entry.id] = entry;
    return accumulator;
  },
  {} as Record<FormatId, FormatInfo>,
);

export const DEFAULT_FORMAT: FormatId = "audio-24khz-48kbitrate-mono-mp3";
