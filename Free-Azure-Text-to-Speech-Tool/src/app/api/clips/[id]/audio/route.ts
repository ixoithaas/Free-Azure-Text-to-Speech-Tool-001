import { getClip } from "@/lib/clips";
import { EXTENSION_BY_FORMAT, type OutputFormat } from "@/lib/tts/edge-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

function filenameFor(title: string, format: string): string {
  const ext = EXTENSION_BY_FORMAT[(format as OutputFormat) ?? "audio-24khz-48kbitrate-mono-mp3"] ?? "mp3";
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${slug || "speech"}.${ext}`;
}

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  const found = await getClip(id);
  if (!found) return Response.json({ error: "Clip not found" }, { status: 404 });

  const { clip } = found;
  const audio = clip.audio;
  const filename = filenameFor(clip.title, clip.format);

  const headers = new Headers({
    "Content-Type": clip.mimeType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=86400",
    "Content-Disposition": `inline; filename="${filename}"`,
  });

  const range = request.headers.get("range");
  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (match) {
      const total = audio.length;
      const startRaw = match[1];
      const endRaw = match[2];
      let start = startRaw === "" ? -1 : Number.parseInt(startRaw, 10);
      let end = endRaw === "" ? total - 1 : Number.parseInt(endRaw, 10);

      if (start === -1) {
        // suffix range: bytes=-500 → last 500 bytes
        const suffix = Number.parseInt(endRaw, 10) || 0;
        start = Math.max(total - suffix, 0);
        end = total - 1;
      }

      start = Math.max(0, Math.min(start, total - 1));
      end = Math.max(start, Math.min(end, total - 1));
      const slice = audio.subarray(start, end + 1);

      headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
      headers.set("Content-Length", String(slice.length));

      return new Response(new Uint8Array(slice), { status: 206, headers });
    }
  }

  headers.set("Content-Length", String(audio.length));
  return new Response(new Uint8Array(audio), { status: 200, headers });
}
