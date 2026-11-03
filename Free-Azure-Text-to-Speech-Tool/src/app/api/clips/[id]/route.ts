import { deleteClip, getClip, setStarred, toSummary } from "@/lib/clips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  const found = await getClip(id);
  if (!found) return Response.json({ error: "Clip not found" }, { status: 404 });

  const { clip } = found;
  return Response.json({ clip: toSummary(clip), text: clip.text, words: clip.words });
}

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  let body: { starred?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const starred = body.starred === true;
  const clip = await setStarred(id, starred);
  if (!clip) return Response.json({ error: "Clip not found" }, { status: 404 });
  return Response.json({ clip });
}

export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params;
  const removed = await deleteClip(id);
  if (!removed) return Response.json({ error: "Clip not found" }, { status: 404 });
  return Response.json({ removed: true });
}
