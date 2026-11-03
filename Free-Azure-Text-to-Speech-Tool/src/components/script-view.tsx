"use client";

import { useEffect, useMemo, useRef } from "react";

import type { AlignedWord } from "@/lib/types";

type ScriptViewProps = {
  text: string;
  words: AlignedWord[];
  currentTime: number;
};

type Segment = { text: string; wordIndex: number | null };

function buildSegments(text: string, words: AlignedWord[]): Segment[] {
  const ordered = words
    .map((word, index) => ({ ...word, index }))
    .filter((word) => word.charOffset >= 0 && word.charOffset <= text.length)
    .sort((a, b) => a.charOffset - b.charOffset || a.index - b.index);

  const segments: Segment[] = [];
  let cursor = 0;

  for (const word of ordered) {
    if (word.charOffset < cursor) continue; // overlapping safety
    if (word.charOffset > cursor) {
      segments.push({ text: text.slice(cursor, word.charOffset), wordIndex: null });
    }
    const end = Math.min(word.charOffset + Math.max(word.charLength, 1), text.length);
    segments.push({ text: text.slice(word.charOffset, end), wordIndex: word.index });
    cursor = end;
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor), wordIndex: null });
  return segments;
}

export default function ScriptView({ text, words, currentTime }: ScriptViewProps) {
  const segments = useMemo(() => buildSegments(text, words), [text, words]);
  const wordRefs = useRef<Map<number, HTMLSpanElement>>(new Map());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<number>(-1);
  const spokenRef = useRef<number>(-1);

  useEffect(() => {
    // Reset the painted state whenever the script changes.
    activeRef.current = -1;
    spokenRef.current = -1;
    for (const element of wordRefs.current.values()) {
      element.classList.remove("is-active", "is-spoken");
    }
  }, [text, words]);

  useEffect(() => {
    if (words.length === 0) return;

    // binary search for the word currently being spoken
    let low = 0;
    let high = words.length - 1;
    let active = -1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const word = words[mid];
      if (currentTime < word.startSec) {
        high = mid - 1;
      } else if (currentTime > word.endSec) {
        low = mid + 1;
      } else {
        active = mid;
        break;
      }
    }
    if (active === -1) {
      // between words: keep the last spoken word marked as "spoken"
      active = high;
    }

    let lastSpoken = -1;
    for (let i = 0; i <= Math.min(active, words.length - 1); i += 1) {
      if (words[i].endSec <= currentTime) lastSpoken = i;
    }

    if (active !== activeRef.current) {
      if (activeRef.current >= 0) {
        wordRefs.current.get(activeRef.current)?.classList.remove("is-active");
      }
      const element = active >= 0 ? wordRefs.current.get(active) : undefined;
      element?.classList.add("is-active");
      activeRef.current = active;

      if (element && containerRef.current) {
        const box = containerRef.current;
        const elementBox = element.getBoundingClientRect();
        const boxRect = box.getBoundingClientRect();
        if (elementBox.top < boxRect.top + 12 || elementBox.bottom > boxRect.bottom - 12) {
          box.scrollTop += elementBox.top - boxRect.top - boxRect.height / 2;
        }
      }
    }

    if (lastSpoken !== spokenRef.current) {
      const from = Math.max(spokenRef.current, 0);
      const to = lastSpoken;
      if (to < from) {
        for (const element of wordRefs.current.values()) element.classList.remove("is-spoken");
      } else {
        for (let i = from; i <= to; i += 1) wordRefs.current.get(i)?.classList.add("is-spoken");
      }
      spokenRef.current = lastSpoken;
    }
  }, [currentTime, words]);

  return (
    <div
      ref={containerRef}
      className="max-h-56 overflow-y-auto rounded-xl border border-white/[0.06] bg-ink-950/60 p-4 text-[0.95rem] leading-[1.85] text-mist-500"
    >
      {segments.map((segment, index) => {
        if (segment.wordIndex === null) {
          return (
            <span key={`${index}-gap`} className="whitespace-pre-wrap">
              {segment.text}
            </span>
          );
        }
        const wordIndex = segment.wordIndex;
        return (
          <span
            key={`${index}-w${wordIndex}`}
            ref={(element) => {
              if (element) wordRefs.current.set(wordIndex, element);
              else wordRefs.current.delete(wordIndex);
            }}
            className="spoken-word px-[2px] text-mist-400"
          >
            {segment.text}
          </span>
        );
      })}
    </div>
  );
}
