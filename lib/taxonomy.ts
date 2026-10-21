// Taksonomi konten bersama dashboard & laporan: kategori (mengikuti tipe akun website mainkekudus), format per
// channel, dan platform. Nilai mentah di database tidak diubah — dinormalisasi saat dibaca, jadi data lama ikut.

/** Kategori bersama (tipe akun website) + kategori khusus channel. Label English dipakai di semua tampilan. */
export const CATEGORIES = [
  "Accommodation",
  "Arena",
  "Attraction",
  "Club",
  "Community",
  "Culinary",
  "Event",
  "Health",
  "Profile",
  "Sport Gears",
  "Transportation",
  "About Kudus",
  "Sports",
  "UMKM",
] as const;

/** Alias (huruf kecil) dari log News (Indonesia) & YouTube → label kategori. */
const CATEGORY_ALIASES: Record<string, string> = {
  akomodasi: "Accommodation",
  accommodation: "Accommodation",
  arena: "Arena",
  venue: "Arena",
  atraksi: "Attraction",
  attraction: "Attraction",
  club: "Club",
  komunitas: "Community",
  community: "Community",
  kuliner: "Culinary",
  culinary: "Culinary",
  kegiatan: "Event",
  event: "Event",
  kesehatan: "Health",
  health: "Health",
  profil: "Profile",
  profile: "Profile",
  atlet: "Profile",
  pelatih: "Profile",
  perlengkapan: "Sport Gears",
  "sport gears": "Sport Gears",
  gears: "Sport Gears",
  transportasi: "Transportation",
  transportation: "Transportation",
  "tentang kudus": "About Kudus",
  "about kudus": "About Kudus",
  olahraga: "Sports",
  sports: "Sports",
  umkm: "UMKM",
};

/** Kategori "Hero" di Calendar Timeline YouTube = jenis video (Hero Video), bukan kategori. */
const NOT_A_CATEGORY = new Set(["hero"]);

const key = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/** Label kategori standar; nilai tak dikenal dikembalikan apa adanya (tetap terlihat), kosong → null. */
export function categoryLabel(raw: string | null | undefined): string | null {
  const k = key(raw);
  if (!k || NOT_A_CATEGORY.has(k)) return null;
  return CATEGORY_ALIASES[k] ?? raw!.trim();
}

export const isKnownCategory = (label: string) => (CATEGORIES as readonly string[]).includes(label);

/**
 * Baris tetap tabel kategori laporan (pie chart menunjuk baris-baris ini): hanya kategori yang sudah pernah dipakai
 * channel itu. Kategori baru → peringatan saat generate, lalu tambahkan di sini + patch template.
 */
export const NEWS_REPORT_CATEGORIES = ["Accommodation", "Arena", "Attraction", "Community", "Culinary", "Event", "Health", "Profile", "Sport Gears", "About Kudus", "Sports", "UMKM"];
export const YOUTUBE_REPORT_CATEGORIES = ["Accommodation", "Arena", "Attraction", "Club", "Culinary", "Event", "Profile", "Sport Gears"];

/** Jenis video YouTube (urutan = baris laporan). */
export const YOUTUBE_FORMATS = ["Editorial Feature Video", "Event Recap", "Hero Video"] as const;
export type YoutubeFormat = (typeof YOUTUBE_FORMATS)[number];

/**
 * Jenis video: recap → Event Recap; Teaser / kategori Hero (mirror hero video homepage website) → Hero Video;
 * selain itu Editorial Feature Video (seri produksi). `recap` = hasil isRecap (judul/format) dari pemanggil.
 */
export function youtubeFormat(format: string | null | undefined, category: string | null | undefined, recap: boolean): YoutubeFormat {
  if (recap) return "Event Recap";
  const f = key(format);
  if (f === "teaser" || f === "hero video" || f === "hero" || NOT_A_CATEGORY.has(key(category))) return "Hero Video";
  return "Editorial Feature Video";
}

export const NEWS_FORMATS = ["Features", "Hard News", "Editorial"] as const;

/** Format artikel News; nilai tak dikenal dikembalikan apa adanya. */
export function newsFormat(raw: string | null | undefined): string | null {
  const k = key(raw);
  if (!k) return null;
  return NEWS_FORMATS.find((f) => f.toLowerCase() === k) ?? (k === "feature" ? "Features" : raw!.trim());
}

/** Format sosmed: key internal (feeds/reels/story/video) → label tunggal. Carousel & foto = Feed. */
export const SOCIAL_FORMAT_LABEL: Record<string, string> = {
  feeds: "Feed",
  carousel: "Feed",
  photo: "Feed",
  reels: "Reel",
  story: "Story",
  video: "Video",
};
export const socialFormatLabel = (f: string) => SOCIAL_FORMAT_LABEL[key(f)] ?? f;
/** Key format sosmed setelah carousel/foto digabung ke feeds. */
export const socialFormatKey = (f: string) => (["carousel", "photo"].includes(key(f)) ? "feeds" : key(f));

export const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  threads: "Threads",
  youtube: "YouTube",
};
const PLATFORM_ORDER = Object.keys(PLATFORM_LABEL);

/** "instagram,tiktok,facebook" → ["Instagram", "Facebook", "TikTok"] (urutan tetap). */
export function platformLabels(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((p) => key(p))
    .filter(Boolean)
    .sort((a, b) => PLATFORM_ORDER.indexOf(a) - PLATFORM_ORDER.indexOf(b))
    .map((p) => PLATFORM_LABEL[p] ?? p);
}
