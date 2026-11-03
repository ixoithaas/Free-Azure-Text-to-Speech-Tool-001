import { getVoiceCatalog } from "@/lib/tts/voices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const refresh = new URL(request.url).searchParams.get("refresh") === "1";

  try {
    const catalog = await getVoiceCatalog(refresh);
    return Response.json(catalog);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load voices";
    return Response.json({ error: message }, { status: 502 });
  }
}
