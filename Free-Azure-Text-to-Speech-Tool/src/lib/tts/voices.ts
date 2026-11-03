import type { CatalogVoice, VoiceCatalog } from "../types";
import { fetchVoices, type EdgeVoice } from "./edge-client";

export type { CatalogVoice, VoiceCatalog };

const FALLBACK_VOICES: CatalogVoice[] = [
  { id: "en-US-AriaNeural", name: "Aria", language: "English (United States)", locale: "en-US", gender: "Female", personalities: ["Positive", "Confident"], categories: ["General"], multilingual: false, gallery: false },
  { id: "en-US-JennyNeural", name: "Jenny", language: "English (United States)", locale: "en-US", gender: "Female", personalities: ["Friendly", "Caring"], categories: ["General"], multilingual: false, gallery: false },
  { id: "en-US-GuyNeural", name: "Guy", language: "English (United States)", locale: "en-US", gender: "Male", personalities: ["Newscaster", "Casual"], categories: ["General"], multilingual: false, gallery: false },
  { id: "en-US-ChristopherNeural", name: "Christopher", language: "English (United States)", locale: "en-US", gender: "Male", personalities: ["Deep", "Narration"], categories: ["General"], multilingual: false, gallery: false },
  { id: "en-GB-SoniaNeural", name: "Sonia", language: "English (United Kingdom)", locale: "en-GB", gender: "Female", personalities: ["Cheerful", "Optimistic"], categories: ["General"], multilingual: false, gallery: false },
  { id: "en-GB-RyanNeural", name: "Ryan", language: "English (United Kingdom)", locale: "en-GB", gender: "Male", personalities: ["Witty", "Charismatic"], categories: ["General"], multilingual: false, gallery: false },
  { id: "en-AU-NatashaNeural", name: "Natasha", language: "English (Australia)", locale: "en-AU", gender: "Female", personalities: ["Friendly", "Conversational"], categories: ["General"], multilingual: false, gallery: false },
  { id: "en-IN-NeerjaNeural", name: "Neerja", language: "English (India)", locale: "en-IN", gender: "Female", personalities: ["Expressive", "Warm"], categories: ["General"], multilingual: false, gallery: false },
  { id: "es-ES-ElviraNeural", name: "Elvira", language: "Spanish (Spain)", locale: "es-ES", gender: "Female", personalities: ["Friendly", "Casual"], categories: ["General"], multilingual: false, gallery: false },
  { id: "es-MX-DaliaNeural", name: "Dalia", language: "Spanish (Mexico)", locale: "es-MX", gender: "Female", personalities: ["Friendly", "Casual"], categories: ["General"], multilingual: false, gallery: false },
  { id: "fr-FR-DeniseNeural", name: "Denise", language: "French (France)", locale: "fr-FR", gender: "Female", personalities: ["Cheerful", "Optimistic"], categories: ["General"], multilingual: false, gallery: false },
  { id: "fr-FR-HenriNeural", name: "Henri", language: "French (France)", locale: "fr-FR", gender: "Male", personalities: ["Narration", "Casual"], categories: ["General"], multilingual: false, gallery: false },
  { id: "de-DE-KatjaNeural", name: "Katja", language: "German (Germany)", locale: "de-DE", gender: "Female", personalities: ["Friendly", "Casual"], categories: ["General"], multilingual: false, gallery: false },
  { id: "it-IT-ElsaNeural", name: "Elsa", language: "Italian (Italy)", locale: "it-IT", gender: "Female", personalities: ["Elegant", "Narration"], categories: ["General"], multilingual: false, gallery: false },
  { id: "pt-BR-FranciscaNeural", name: "Francisca", language: "Portuguese (Brazil)", locale: "pt-BR", gender: "Female", personalities: ["Casual", "Friendly"], categories: ["General"], multilingual: false, gallery: false },
  { id: "ja-JP-NanamiNeural", name: "Nanami", language: "Japanese (Japan)", locale: "ja-JP", gender: "Female", personalities: ["Cheerful", "Energetic"], categories: ["General"], multilingual: false, gallery: false },
  { id: "ko-KR-SunHiNeural", name: "Sun-Hi", language: "Korean (Korea)", locale: "ko-KR", gender: "Female", personalities: ["Friendly", "Casual"], categories: ["General"], multilingual: false, gallery: false },
  { id: "zh-CN-XiaoxiaoNeural", name: "Xiaoxiao", language: "Chinese (Mandarin, Simplified)", locale: "zh-CN", gender: "Female", personalities: ["Warm", "Expressive"], categories: ["General"], multilingual: false, gallery: false },
  { id: "hi-IN-SwaraNeural", name: "Swara", language: "Hindi (India)", locale: "hi-IN", gender: "Female", personalities: ["Conversational", "Friendly"], categories: ["General"], multilingual: false, gallery: false },
  { id: "ar-SA-ZariyahNeural", name: "Zariyah", language: "Arabic (Saudi Arabia)", locale: "ar-SA", gender: "Female", personalities: ["Casual", "Friendly"], categories: ["General"], multilingual: false, gallery: false },
];

function toCatalogVoice(voice: EdgeVoice): CatalogVoice {
  const friendly = voice.FriendlyName || voice.Name || voice.ShortName;
  // "Microsoft Aria Online (Natural) - English (United States)"
  const dash = friendly.lastIndexOf(" - ");
  const language = dash === -1 ? voice.Locale : friendly.slice(dash + 3).trim();
  const rawName = dash === -1 ? voice.Name || voice.ShortName : friendly.slice(0, dash);
  const name = rawName.replace(/^Microsoft\s+/i, "").replace(/\s+Online.*$/i, "").trim() || voice.ShortName;

  const gender: CatalogVoice["gender"] =
    voice.Gender?.toLowerCase() === "female"
      ? "Female"
      : voice.Gender?.toLowerCase() === "male"
        ? "Male"
        : "Other";

  return {
    id: voice.ShortName,
    name,
    language,
    locale: voice.Locale,
    gender,
    personalities: voice.VoiceTag?.VoicePersonalities ?? [],
    categories: voice.VoiceTag?.ContentCategories ?? [],
    multilingual: voice.ShortName.toLowerCase().includes("multilingual"),
    gallery: voice.ShortName.toLowerCase().includes("gallery"),
  };
}

let catalogCache: { at: number; catalog: VoiceCatalog } | null = null;

function buildCatalog(voices: CatalogVoice[], source: "live" | "fallback"): VoiceCatalog {
  const counts = new Map<string, number>();
  for (const voice of voices) {
    counts.set(voice.language, (counts.get(voice.language) ?? 0) + 1);
  }
  const languages = [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    voices: voices
      .slice()
      .sort((a, b) => a.language.localeCompare(b.language) || a.name.localeCompare(b.name)),
    languages,
    source,
    fetchedAt: new Date().toISOString(),
  };
}

/** Returns the full catalog of free Microsoft/Azure neural voices. */
export async function getVoiceCatalog(force = false): Promise<VoiceCatalog> {
  if (!force && catalogCache && Date.now() - catalogCache.at < 15 * 60 * 1000) {
    return catalogCache.catalog;
  }

  try {
    const live = await fetchVoices(force);
    const catalog = buildCatalog(live.map(toCatalogVoice), "live");
    catalogCache = { at: Date.now(), catalog };
    return catalog;
  } catch (error) {
    console.error("[tts] voice catalog fetch failed:", error instanceof Error ? error.message : error);
    if (catalogCache) return catalogCache.catalog;
    return buildCatalog(FALLBACK_VOICES, "fallback");
  }
}
