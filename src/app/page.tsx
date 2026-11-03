import Studio from "@/components/studio";
import { listClips, stats } from "@/lib/clips";
import { getVoiceCatalog } from "@/lib/tts/voices";
import type { ClipStats, ClipSummary, VoiceCatalog } from "@/lib/types";

export const dynamic = "force-dynamic";

const EMPTY_CATALOG: VoiceCatalog = { voices: [], languages: [], source: "fallback", fetchedAt: new Date().toISOString() };
const EMPTY_STATS: ClipStats = { clips: 0, seconds: 0, bytes: 0, chars: 0 };

export default async function HomePage() {
  const [catalog, clips, totals] = await Promise.all([
    getVoiceCatalog().catch((error) => {
      console.error("[home] voice catalog unavailable:", error);
      return EMPTY_CATALOG;
    }),
    listClips().catch((error) => {
      console.error("[home] clip list unavailable:", error);
      return [] as ClipSummary[];
    }),
    stats().catch(() => EMPTY_STATS),
  ]);

  return <Studio catalog={catalog} initialClips={clips} initialStats={totals} />;
}
