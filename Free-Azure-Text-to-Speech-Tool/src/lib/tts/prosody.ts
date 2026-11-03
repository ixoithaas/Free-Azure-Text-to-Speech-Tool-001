export const RATE_RE = /^[+-]?\d{1,3}%$/;
export const PITCH_RE = /^[+-]?\d{1,3}Hz$/;
export const VOLUME_RE = /^[+-]?\d{1,3}%$/;
export const VOICE_ID_RE = /^[a-zA-Z]{2,10}-[A-Za-z0-9]{2,10}-[A-Za-z0-9]+$/;

export function formatPercent(value: number): string {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

export function formatHertz(value: number): string {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}Hz`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
