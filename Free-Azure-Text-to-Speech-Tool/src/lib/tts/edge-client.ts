import WebSocket from "ws";

import {
  EDGE_ORIGIN,
  EDGE_USER_AGENT,
  SEC_MS_GEC_VERSION,
  TRUSTED_CLIENT_TOKEN,
  generateSecMsGec,
} from "./sec-ms-gec";

export type OutputFormat =
  | "audio-24khz-48kbitrate-mono-mp3"
  | "audio-24khz-96kbitrate-mono-mp3"
  | "webm-24khz-16bit-mono-opus";

export const OUTPUT_FORMATS: OutputFormat[] = [
  "audio-24khz-48kbitrate-mono-mp3",
  "audio-24khz-96kbitrate-mono-mp3",
  "webm-24khz-16bit-mono-opus",
];

export const MIME_BY_FORMAT: Record<OutputFormat, string> = {
  "audio-24khz-48kbitrate-mono-mp3": "audio/mpeg",
  "audio-24khz-96kbitrate-mono-mp3": "audio/mpeg",
  "webm-24khz-16bit-mono-opus": "audio/webm",
};

export const EXTENSION_BY_FORMAT: Record<OutputFormat, string> = {
  "audio-24khz-48kbitrate-mono-mp3": "mp3",
  "audio-24khz-96kbitrate-mono-mp3": "mp3",
  "webm-24khz-16bit-mono-opus": "webm",
};

export type EdgeVoice = {
  Name: string;
  ShortName: string;
  Gender: string;
  Locale: string;
  SuggestedCodec: string;
  FriendlyName: string;
  Status: string;
  VoiceTag?: { ContentCategories?: string[]; VoicePersonalities?: string[] };
};

/** A word boundary, all timings in 100ns ticks. */
export type Boundary = {
  kind: "WordBoundary" | "SentenceBoundary";
  /** Absolute offset from the start of the synthesized audio, in 100ns ticks. */
  offsetTicks: number;
  durationTicks: number;
  /** The spoken word as reported by the service (may include punctuation). */
  word: string;
};

export type Prosody = {
  /** e.g. "+0%", "-15%" */
  rate: string;
  /** e.g. "+0Hz", "-20Hz" */
  pitch: string;
  /** e.g. "+0%" */
  volume: string;
};

export type SynthesisResult = {
  audio: Buffer;
  boundaries: Boundary[];
  chunkCount: number;
  format: OutputFormat;
};

const WSS_URL = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
const VOICES_URL = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}`;

const JSON_XML_DELIM = "\r\n\r\n";
const AUDIO_DELIM = "Path:audio\r\n";
const CONNECTION_TIMEOUT_MS = 15000;
const SYNTHESIS_TIMEOUT_MS = 60000;
const MAX_CHUNK_CHARS = 1400;

/** Learned from a 403 `Date` header; shared across requests in the process. */
let clockOffsetMs = 0;

let voicesCache: { at: number; voices: EdgeVoice[] } | null = null;

function randomHex(bytes: number): string {
  const out = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(out);
  return Array.from(out, (b) => b.toString(16).padStart(2, "0")).join("");
}

function connectionId(): string {
  const hex = randomHex(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function buildSynthUrl(): Promise<string> {
  const secMsGec = await generateSecMsGec(clockOffsetMs);
  const params = new URLSearchParams({
    TrustedClientToken: TRUSTED_CLIENT_TOKEN,
    "Sec-MS-GEC": secMsGec,
    "Sec-MS-GEC-Version": SEC_MS_GEC_VERSION,
    ConnectionId: connectionId(),
  });
  return `${WSS_URL}?${params.toString()}`;
}

/** Fetches the full list of Microsoft Edge / Azure neural voices. */
export async function fetchVoices(force = false): Promise<EdgeVoice[]> {
  if (!force && voicesCache && Date.now() - voicesCache.at < 10 * 60 * 1000) {
    return voicesCache.voices;
  }

  const response = await fetch(VOICES_URL, {
    headers: { "User-Agent": EDGE_USER_AGENT, Origin: EDGE_ORIGIN },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  if (!response.ok) {
    throw new Error(`Voice list request failed with status ${response.status}`);
  }

  const voices = (await response.json()) as EdgeVoice[];
  if (!Array.isArray(voices) || voices.length === 0) {
    throw new Error("Voice list response was empty");
  }

  voicesCache = { at: Date.now(), voices };
  return voices;
}

type Collector = {
  audio: Buffer[];
  boundaries: Boundary[];
  turnEnded: boolean;
  resolve: (value: { audio: Buffer[]; boundaries: Boundary[] }) => void;
  reject: (reason: Error) => void;
};

class EdgeSession {
  private ws: WebSocket | null = null;
  private readonly collectors = new Map<string, Collector>();
  private readonly format: OutputFormat;
  private readonly wordBoundaries: boolean;
  private idleTimer: NodeJS.Timeout | null = null;

  constructor(format: OutputFormat, wordBoundaries: boolean) {
    this.format = format;
    this.wordBoundaries = wordBoundaries;
  }

  async open(): Promise<void> {
    const url = await buildSynthUrl();
    const ws = new WebSocket(url, {
      headers: { "User-Agent": EDGE_USER_AGENT, Origin: EDGE_ORIGIN, "Pragma": "no-cache", "Cache-Control": "no-cache" },
    });
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Edge TTS connection timed out after ${CONNECTION_TIMEOUT_MS}ms`));
        ws.terminate();
      }, CONNECTION_TIMEOUT_MS);

      ws.once("unexpected-response", (_req, res) => {
        clearTimeout(timeout);
        const serverDate = res.headers?.date;
        const status = res.statusCode;
        if (status === 403 && typeof serverDate === "string") {
          const parsed = Date.parse(serverDate);
          if (Number.isFinite(parsed)) {
            clockOffsetMs = parsed - Date.now();
          }
        }
        res.destroy();
        reject(new Error(`Edge TTS handshake failed with status ${status}${status === 403 ? " (token rejected)" : ""}`));
      });

      ws.once("error", (error: Error) => {
        clearTimeout(timeout);
        reject(new Error(`Edge TTS WebSocket error: ${error.message}`));
      });

      ws.once("open", () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    this.attachHandlers();

    await this.sendRaw(
      `Content-Type:application/json; charset=utf-8\r\nPath:speech.config${JSON_XML_DELIM}` +
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: {
                  sentenceBoundaryEnabled: "false",
                  wordBoundaryEnabled: this.wordBoundaries ? "true" : "false",
                },
                outputFormat: this.format,
              },
            },
          },
        }),
    );
  }

  private attachHandlers(): void {
    const ws = this.ws;
    if (!ws) return;

    ws.on("message", (raw: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
      const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
      let message: string;
      try {
        message = buffer.toString("utf8");
      } catch {
        return;
      }

      const requestId = /X-RequestId:(.*?)\r\n/.exec(message)?.[1];
      const collector = requestId ? this.collectors.get(requestId) : undefined;
      if (!collector || collector.turnEnded) return;

      this.resetIdleTimer();

      if (message.includes("Path:turn.end")) {
        collector.turnEnded = true;
        this.collectors.delete(requestId!);
        collector.resolve({ audio: collector.audio, boundaries: collector.boundaries });
        return;
      }

      if (message.includes("Path:turn.start") || message.includes("Path:response")) {
        return;
      }

      if (message.includes("Path:audio.metadata")) {
        const dataStart = buffer.indexOf(JSON_XML_DELIM) + JSON_XML_DELIM.length;
        try {
          const parsed = JSON.parse(buffer.subarray(dataStart).toString("utf8")) as {
            Metadata?: Array<{
              Type?: string;
              Data?: { Offset?: number; Duration?: number; text?: { Text?: string; Length?: number } };
            }>;
          };
          for (const item of parsed.Metadata ?? []) {
            const kind = item.Type === "SentenceBoundary" ? "SentenceBoundary" : "WordBoundary";
            collector.boundaries.push({
              kind,
              offsetTicks: item.Data?.Offset ?? 0,
              durationTicks: item.Data?.Duration ?? 0,
              word: item.Data?.text?.Text ?? "",
            });
          }
        } catch {
          /* ignore malformed metadata */
        }
        return;
      }

      if (isBinary || message.includes(AUDIO_DELIM)) {
        const index = buffer.indexOf(AUDIO_DELIM);
        if (index === -1) return;
        const data = buffer.subarray(index + AUDIO_DELIM.length);
        if (data.length > 0) collector.audio.push(Buffer.from(data));
      }
    });

    ws.on("error", (error: Error) => {
      this.failAll(new Error(`Edge TTS WebSocket error: ${error.message}`));
    });

    ws.on("close", () => {
      this.failAll(new Error("Edge TTS connection closed before synthesis completed"));
    });
  }

  private failAll(error: Error): void {
    for (const [requestId, collector] of this.collectors) {
      if (collector.turnEnded) continue;
      this.collectors.delete(requestId);
      collector.reject(error);
    }
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.collectors.size === 0) {
      this.idleTimer = null;
      return;
    }
    this.idleTimer = setTimeout(() => {
      this.failAll(new Error(`Edge TTS synthesis timed out after ${SYNTHESIS_TIMEOUT_MS}ms without data`));
      this.close();
    }, SYNTHESIS_TIMEOUT_MS);
  }

  private async sendRaw(message: string): Promise<void> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error("Edge TTS WebSocket is not open");
    }
    await new Promise<void>((resolve, reject) => {
      ws.send(message, (error) => (error ? reject(error) : resolve()));
    });
  }

  /** Sends one SSML document and resolves once `turn.end` arrives. */
  async request(ssml: string): Promise<{ audio: Buffer[]; boundaries: Boundary[] }> {
    const requestId = randomHex(16);
    const collector: Collector = {
      audio: [],
      boundaries: [],
      turnEnded: false,
      resolve: () => {},
      reject: () => {},
    };

    const promise = new Promise<{ audio: Buffer[]; boundaries: Boundary[] }>((resolve, reject) => {
      collector.resolve = resolve;
      collector.reject = reject;
    });

    this.collectors.set(requestId, collector);
    this.resetIdleTimer();

    try {
      await this.sendRaw(
        `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml${JSON_XML_DELIM}${ssml.trim()}`,
      );
    } catch (error) {
      this.collectors.delete(requestId);
      throw error;
    }

    return promise;
  }

  close(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    const ws = this.ws;
    this.ws = null;
    if (!ws) return;
    try {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.terminate();
    } catch {
      /* noop */
    }
  }
}

function buildSsml(params: {
  text: string;
  voice: string;
  locale: string;
  prosody: Prosody;
}): string {
  const { text, voice, locale, prosody } = params;
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${locale}">
  <voice name="${voice}">
    <prosody pitch="${prosody.pitch}" rate="${prosody.rate}" volume="${prosody.volume}">
      ${escapeXml(text)}
    </prosody>
  </voice>
</speak>`;
}

/**
 * Splits text into <= MAX_CHUNK_CHARS pieces on sentence boundaries so very long
 * scripts survive the per-request limits of the read-aloud service.
 */
export function splitIntoChunks(text: string, maxChars = MAX_CHUNK_CHARS): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (normalized.length <= maxChars) return normalized.length ? [normalized] : [];

  const sentences = normalized.match(/[^.!?\n]+[.!?]*[\n]?|[^.!?\n]+$/g) ?? [normalized];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + sentence).length <= maxChars) {
      current += sentence;
      continue;
    }
    if (current.trim().length > 0) chunks.push(current);
    if (sentence.length <= maxChars) {
      current = sentence;
    } else {
      // A single sentence longer than the limit: hard-split it.
      let rest = sentence;
      while (rest.length > maxChars) {
        const cut = rest.lastIndexOf(" ", maxChars);
        const at = cut > maxChars * 0.5 ? cut + 1 : maxChars;
        chunks.push(rest.slice(0, at));
        rest = rest.slice(at);
      }
      current = rest;
    }
  }
  if (current.trim().length > 0) chunks.push(current);
  return chunks;
}

export type SynthesizeOptions = {
  text: string;
  voice: string;
  locale?: string;
  format?: OutputFormat;
  prosody?: Partial<Prosody>;
  wordBoundaries?: boolean;
};

type RunResult = { audio: Buffer; boundaries: Boundary[]; chunkCount: number };

async function runSynthesis(options: SynthesizeOptions, chunks: string[]): Promise<RunResult> {
  const format = options.format ?? "audio-24khz-48kbitrate-mono-mp3";
  const prosody: Prosody = {
    rate: options.prosody?.rate ?? "+0%",
    pitch: options.prosody?.pitch ?? "+0Hz",
    volume: options.prosody?.volume ?? "+0%",
  };
  const locale = options.locale ?? /\b[a-z]{2,}-[A-Z]{2,}\b/.exec(options.voice)?.[0] ?? "en-US";
  const wordBoundaries = options.wordBoundaries ?? true;

  const session = new EdgeSession(format, wordBoundaries);
  const audio: Buffer[] = [];
  const boundaries: Boundary[] = [];
  let tickOffset = 0;

  try {
    await session.open();

    for (const chunk of chunks) {
      const ssml = buildSsml({ text: chunk, voice: options.voice, locale, prosody });
      const result = await session.request(ssml);

      if (result.audio.length === 0) {
        throw new Error("Edge TTS returned no audio for this request");
      }

      let chunkEnd = 0;
      for (const boundary of result.boundaries) {
        const absolute = boundary.offsetTicks + tickOffset;
        chunkEnd = Math.max(chunkEnd, absolute + boundary.durationTicks);
        boundaries.push({ ...boundary, offsetTicks: absolute });
      }

      // Boundaries stop slightly before the trailing silence, so pad the seam.
      tickOffset = chunkEnd + 1_500_000;
      audio.push(...result.audio);
    }
  } finally {
    session.close();
  }

  const combined = Buffer.concat(audio);
  if (combined.length === 0) {
    throw new Error("Edge TTS returned no audio");
  }

  return { audio: combined, boundaries, chunkCount: chunks.length };
}

/**
 * Synthesizes speech through the free Microsoft Edge Read Aloud service —
 * the same Azure neural voices that power Edge's built-in reader. No API key,
 * no subscription, no cost.
 */
export async function synthesizeSpeech(options: SynthesizeOptions): Promise<SynthesisResult> {
  const chunks = splitIntoChunks(options.text);
  if (chunks.length === 0) throw new Error("Nothing to synthesize");

  let result: RunResult;
  try {
    result = await runSynthesis(options, chunks);
  } catch (error) {
    // A rejected handshake is usually clock skew: `open()` has already learned the
    // server offset from the Date header, so retry once with a corrected token.
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("status 403")) throw error;
    result = await runSynthesis(options, chunks);
  }

  return {
    audio: result.audio,
    boundaries: result.boundaries,
    chunkCount: result.chunkCount,
    format: options.format ?? "audio-24khz-48kbitrate-mono-mp3",
  };
}

/** Exposes the learned server clock offset (useful for diagnostics). */
export function getClockOffsetMs(): number {
  return clockOffsetMs;
}
