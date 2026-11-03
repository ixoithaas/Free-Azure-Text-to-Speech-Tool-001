import { clearClips, listClips, stats } from "@/lib/clips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [clips, totals] = await Promise.all([listClips(), stats()]);
    return Response.json({ clips, stats: totals });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load clips";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const onlyUnstarred = new URL(request.url).searchParams.get("unstarred") === "1";
  try {
    const removed = await clearClips(onlyUnstarred);
    return Response.json({ removed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to clear clips";
    return Response.json({ error: message }, { status: 500 });
  }
}
