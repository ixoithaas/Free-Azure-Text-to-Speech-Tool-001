import { EXTENSION_BY_FORMAT, MIME_BY_FORMAT, OUTPUT_FORMATS, synthesizeSpeech, type OutputFormat } from "@/lib/tts/edge-client";
import { alignBoundaries, estimateDurationSec } from "@/lib/tts/align";
import { PITCH_RE, RATE_RE, VOICE_ID_RE, VOLUME_RE } from "@/lib/tts/prosody";
import { getVoiceCatalog } from "@/lib/tts/voices";
import { createClip } from "@/lib/clips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_CHARS = 10000;

type Body = {
  text?: unknown;
  voiceId?: unknown;
  rate?: unknown;
  pitch?: unknown;
  volume?: unknown;
  format?: unknown;
  save?: unknown;
};

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return badRequest("Expected a JSON body");
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length === 0) return badRequest("Text is required");
  if (text.length > MAX_CHARS) return badRequest(`Text must be ${MAX_CHARS} characters or fewer`);

  const voiceId = typeof body.voiceId === "string" ? body.voiceId.trim() : "";
  if (!VOICE_ID_RE.test(voiceId)) return badRequest("A valid Microsoft voice id is required");

  const rate = typeof body.rate === "string" && RATE_RE.test(body.rate) ? body.rate : "+0%";
  const pitch = typeof body.pitch === "string" && PITCH_RE.test(body.pitch) ? body.pitch : "+0Hz";
  const volume = typeof body.volume === "string" && VOLUME_RE.test(body.volume) ? body.volume : "+0%";

  const format: OutputFormat = OUTPUT_FORMATS.includes(body.format as OutputFormat)
    ? (body.format as OutputFormat)
    : "audio-24khz-48kbitrate-mono-mp3";

  const save = body.save !== false;

  try {
    const started = Date.now();
    const result = await synthesizeSpeech({
      text,
      voice: voiceId,
      format,
      prosody: { rate, pitch, volume },
      wordBoundaries: true,
    });

    const words = alignBoundaries(text, result.boundaries);
    const durationSec = Math.max(estimateDurationSec(result.boundaries), result.audio.length > 0 ? 0.2 : 0);
    const elapsedMs = Date.now() - started;

    if (!save) {
      // Voice previews stream straight back as audio and are never persisted.
      return new Response(new Uint8Array(result.audio), {
        status: 200,
        headers: {
          "Content-Type": MIME_BY_FORMAT[format],
          "Cache-Control": "no-store",
          "X-Synthesis-Ms": String(elapsedMs),
          "X-Audio-Duration": durationSec.toFixed(3),
          "X-Word-Boundaries": String(words.length),
        },
      });
    }

    const catalog = await getVoiceCatalog();
    const voice = catalog.voices.find((candidate) => candidate.id === voiceId);

    const firstLine = text.split(/\n/).find((line) => line.trim().length > 0) ?? text;
    const title = firstLine.length > 60 ? `${firstLine.slice(0, 60).trimEnd()}…` : firstLine.trim();

    const clip = await createClip({
      title,
      text,
      voiceId,
      voiceName: voice?.name ?? voiceId,
      language: voice?.language ?? voiceId.split("-").slice(0, 2).join("-"),
      locale: voice?.locale ?? voiceId.split("-").slice(0, 2).join("-"),
      gender: voice?.gender ?? "Female",
      rate,
      pitch,
      volume,
      format,
      mimeType: MIME_BY_FORMAT[format],
      charCount: text.length,
      durationSec,
      audioBytes: result.audio.length,
      chunks: result.chunkCount,
      words,
      audio: result.audio,
    });

    return Response.json(
      {
        clip,
        audioUrl: `/api/clips/${clip.id}/audio?ext=${EXTENSION_BY_FORMAT[format]}`,
        words,
        durationSec,
        elapsedMs,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Speech synthesis failed";
    console.error("[synthesize]", message);
    const status = message.includes("status 403") || message.includes("handshake") ? 502 : 500;
    return Response.json(
      {
        error: message,
        hint: "The free Microsoft Edge read-aloud endpoint can rate-limit or rotate its DRM token. Retry in a moment.",
      },
      { status },
    );
  }
}
