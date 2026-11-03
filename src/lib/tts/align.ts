import type { AlignedWord } from "../types";
import type { Boundary } from "./edge-client";

export type { AlignedWord };

function stripEdges(word: string): { lead: number; trail: number; core: string } {
  const lead = word.length - word.replace(/^\s+/, "").length;
  const trail = word.length - word.replace(/\s+$/, "").length;
  return { lead, trail, core: word.slice(lead, word.length - trail || undefined) };
}

const PUNCT = /[.,!?;:"'`()\[\]{}<>/\\|@#$%^&*_+=~\-]/g;

function normalizeForMatch(value: string): string {
  return value.replace(PUNCT, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * The Edge read-aloud service reports each word boundary with the spoken word and
 * its timing, but not the character offset. Walk the source text once and match the
 * reported words in order so the UI can highlight the exact span being spoken.
 */
export function alignBoundaries(text: string, boundaries: Boundary[]): AlignedWord[] {
  const aligned: AlignedWord[] = [];
  let cursor = 0;

  for (const boundary of boundaries) {
    if (boundary.kind !== "WordBoundary") continue;

    const { core } = stripEdges(boundary.word);
    if (!core) continue;

    const startSec = boundary.offsetTicks / 1e7;
    const endSec = (boundary.offsetTicks + boundary.durationTicks) / 1e7;

    const target = normalizeForMatch(core);
    let charOffset = -1;
    let charLength = core.length;

    if (target.length > 0) {
      // Scan forward from the cursor for a run of characters whose normalized form
      // matches the reported word (punctuation and spacing differences allowed).
      const searchFrom = cursor;
      const haystack = text.slice(searchFrom);
      let index = 0;
      while (index < haystack.length) {
        const absolute = searchFrom + index;
        const slice = text.slice(absolute, absolute + core.length + 4);
        if (normalizeForMatch(slice).startsWith(target)) {
          // Grow the span until its normalized form equals the target word.
          let end = absolute + 1;
          while (end <= absolute + core.length + 4 && normalizeForMatch(text.slice(absolute, end)) !== target) {
            end += 1;
          }
          charOffset = absolute;
          charLength = Math.min(Math.max(end - absolute, 1), text.length - absolute);
          break;
        }
        index += 1;
      }
    }

    if (charOffset === -1) {
      // Best effort fallback: consume the same number of characters from the cursor.
      let at = cursor;
      while (at < text.length && /\s/.test(text[at])) at += 1;
      charOffset = at;
      charLength = Math.min(core.length, Math.max(text.length - at, 1));
    }

    // Keep the highlighted span tight: drop surrounding whitespace.
    let spanStart = charOffset;
    let spanEnd = Math.min(charOffset + charLength, text.length);
    while (spanStart < spanEnd && /\s/.test(text[spanStart])) spanStart += 1;
    while (spanEnd > spanStart && /\s/.test(text[spanEnd - 1])) spanEnd -= 1;
    charOffset = spanStart;
    charLength = Math.max(spanEnd - spanStart, 1);

    cursor = Math.min(charOffset + charLength, text.length);
    aligned.push({
      word: text.slice(charOffset, charOffset + charLength) || core,
      charOffset,
      charLength,
      startSec,
      endSec,
    });
  }

  return aligned;
}

/** Audio duration in seconds derived from the final word boundary. */
export function estimateDurationSec(boundaries: Boundary[]): number {
  if (boundaries.length === 0) return 0;
  return boundaries.reduce((max, b) => Math.max(max, (b.offsetTicks + b.durationTicks) / 1e7), 0);
}
