import { asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { speechClips, type NewSpeechClip, type SpeechClip } from "@/db/schema";
import type { AlignedWord, ClipStats, ClipSummary } from "@/lib/types";

/** Clips kept in the database; the oldest unstarred audio blobs are pruned past this. */
export const MAX_STORED_CLIPS = 120;

type ClipRow = {
  id: string;
  title: string;
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
  createdAt: Date | string;
  preview?: string;
  text?: string;
};

function summarize(row: ClipRow, text?: string): ClipSummary {
  const source = text ?? row.preview ?? row.title;
  return {
    id: row.id,
    title: row.title,
    preview: source.length > 180 ? `${source.slice(0, 180).trimEnd()}…` : source,
    voiceId: row.voiceId,
    voiceName: row.voiceName,
    language: row.language,
    locale: row.locale,
    gender: row.gender,
    rate: row.rate,
    pitch: row.pitch,
    volume: row.volume,
    format: row.format,
    mimeType: row.mimeType,
    charCount: row.charCount,
    durationSec: row.durationSec,
    audioBytes: row.audioBytes,
    chunks: row.chunks,
    words: row.words,
    starred: row.starred,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export function toSummary(clip: SpeechClip): ClipSummary {
  const { audio: _audio, text, ...rest } = clip;
  return summarize({ ...rest, preview: text }, text);
}

const summaryColumns = {
  id: speechClips.id,
  title: speechClips.title,
  preview: sql<string>`left(${speechClips.text}, 200)`,
  voiceId: speechClips.voiceId,
  voiceName: speechClips.voiceName,
  language: speechClips.language,
  locale: speechClips.locale,
  gender: speechClips.gender,
  rate: speechClips.rate,
  pitch: speechClips.pitch,
  volume: speechClips.volume,
  format: speechClips.format,
  mimeType: speechClips.mimeType,
  charCount: speechClips.charCount,
  durationSec: speechClips.durationSec,
  audioBytes: speechClips.audioBytes,
  chunks: speechClips.chunks,
  words: speechClips.words,
  starred: speechClips.starred,
  createdAt: speechClips.createdAt,
};

export async function listClips(): Promise<ClipSummary[]> {
  const rows = await db
    .select(summaryColumns)
    .from(speechClips)
    .orderBy(desc(speechClips.starred), desc(speechClips.createdAt))
    .limit(MAX_STORED_CLIPS);

  return rows.map((row) => summarize(row));
}

export async function getClip(id: string): Promise<{ clip: SpeechClip } | null> {
  const rows = await db.select().from(speechClips).where(eq(speechClips.id, id)).limit(1);
  const clip = rows[0];
  return clip ? { clip } : null;
}

export async function createClip(values: NewSpeechClip): Promise<ClipSummary> {
  const rows = await db.insert(speechClips).values(values).returning();
  await pruneClips();
  return toSummary(rows[0]);
}

export async function deleteClip(id: string): Promise<boolean> {
  const rows = await db.delete(speechClips).where(eq(speechClips.id, id)).returning({ id: speechClips.id });
  return rows.length > 0;
}

export async function clearClips(onlyUnstarred = false): Promise<number> {
  const deleted = onlyUnstarred
    ? await db.delete(speechClips).where(eq(speechClips.starred, false)).returning({ id: speechClips.id })
    : await db.delete(speechClips).returning({ id: speechClips.id });
  return deleted.length;
}

export async function setStarred(id: string, starred: boolean): Promise<ClipSummary | null> {
  const rows = await db
    .update(speechClips)
    .set({ starred })
    .where(eq(speechClips.id, id))
    .returning(summaryColumns);

  const row = rows[0];
  return row ? summarize(row) : null;
}

export async function stats(): Promise<ClipStats> {
  const rows = await db
    .select({
      clips: sql<number>`count(*)::int`,
      seconds: sql<number>`coalesce(sum(${speechClips.durationSec}), 0)::float8`,
      bytes: sql<number>`coalesce(sum(${speechClips.audioBytes}), 0)::bigint`,
      chars: sql<number>`coalesce(sum(${speechClips.charCount}), 0)::bigint`,
    })
    .from(speechClips);

  const row = rows[0];
  return {
    clips: Number(row?.clips ?? 0),
    seconds: Number(row?.seconds ?? 0),
    bytes: Number(row?.bytes ?? 0),
    chars: Number(row?.chars ?? 0),
  };
}

async function pruneClips(): Promise<void> {
  const total = await db.select({ count: sql<number>`count(*)::int` }).from(speechClips);
  const count = Number(total[0]?.count ?? 0);
  if (count <= MAX_STORED_CLIPS) return;

  const overflow = count - MAX_STORED_CLIPS;
  const victims = await db
    .select({ id: speechClips.id })
    .from(speechClips)
    .where(eq(speechClips.starred, false))
    .orderBy(asc(speechClips.createdAt))
    .limit(overflow);

  if (victims.length === 0) return;
  await db.delete(speechClips).where(
    sql`${speechClips.id} = ANY(${sql.raw(`ARRAY[${victims.map((v) => `'${v.id}'::uuid`).join(",")}]`)})`,
  );
}
