import { boolean, customType, doublePrecision, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import type { AlignedWord } from "@/lib/types";

/** PostgreSQL `bytea` column (drizzle-orm/pg-core has no built-in equivalent). */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
  fromDriver(value) {
    return Buffer.isBuffer(value) ? value : Buffer.from(value as unknown as ArrayBuffer);
  },
  toDriver(value) {
    return value;
  },
});

export const speechClips = pgTable("speech_clips", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  text: text("text").notNull(),
  voiceId: text("voice_id").notNull(),
  voiceName: text("voice_name").notNull(),
  language: text("language").notNull(),
  locale: text("locale").notNull(),
  gender: text("gender").notNull().default("Female"),
  rate: text("rate").notNull().default("+0%"),
  pitch: text("pitch").notNull().default("+0Hz"),
  volume: text("volume").notNull().default("+0%"),
  format: text("format").notNull().default("audio-24khz-48kbitrate-mono-mp3"),
  mimeType: text("mime_type").notNull().default("audio/mpeg"),
  charCount: integer("char_count").notNull().default(0),
  durationSec: doublePrecision("duration_sec").notNull().default(0),
  audioBytes: integer("audio_bytes").notNull().default(0),
  chunks: integer("chunks").notNull().default(1),
  words: jsonb("words").$type<AlignedWord[]>().notNull().default([]),
  starred: boolean("starred").notNull().default(false),
  audio: bytea("audio").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SpeechClip = typeof speechClips.$inferSelect;
export type NewSpeechClip = typeof speechClips.$inferInsert;
