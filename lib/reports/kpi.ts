// Definisi kartu KPI per channel — dipakai grid KPI dashboard dan blok kartu KPI di laporan Google Sheets.
import type { Cell, Tone } from "./types";

export type KpiKind = "count" | "rate" | "decimal" | "duration";

export interface KpiDef<S> {
  key: string;
  label: string;
  kind: KpiKind;
  /** false: turun = bagus (bounce rate, posisi) */
  goodWhenUp?: boolean;
  /** arah tidak dinilai (mis. artikel in review): perubahan tetap ditulis, warna abu-abu, tanpa (up)/(down) */
  neutral?: boolean;
  get: (s: S) => number | null | undefined;
  /** teks nilai pengganti angka (mis. "53 / 60"); perubahan tetap dihitung dari `get` */
  display?: (s: S) => string | null;
  /** keterangan dashboard (tooltip) */
  hint?: string;
}

const MINUS = "−";
const en1 = (v: number) => Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

/** Durasi detik → "1m 44s" / "45s" (laporan EN). */
export function fmtDurationEn(sec: number): string {
  const s = Math.round(sec);
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

/** Perubahan vs bulan lalu dalam bahasa Inggris + tone warna (aturan sama dengan DeltaBadge dashboard). */
export function kpiChange(kind: KpiKind, cur: number | null | undefined, prev: number | null | undefined, goodWhenUp = true): { text: string; tone: Tone } {
  if (cur == null || prev == null) return { text: "No data last month", tone: "none" };
  const diff = cur - prev;
  // persen dari 0 tidak terdefinisi → sebut saja "dari 0" (mis. artikel in review 0 bulan lalu)
  if (kind !== "rate" && prev === 0 && cur !== 0) {
    const good = diff > 0 === goodWhenUp;
    return { text: `${diff > 0 ? "↑" : "↓"} from 0 last month${goodWhenUp ? "" : good ? " (up)" : " (down)"}`, tone: good ? "good" : "bad" };
  }
  if (kind !== "rate" && prev === 0) return { text: "→ 0.0% vs last month", tone: "flat" };
  const flat = kind === "rate" ? Math.abs(diff) < 0.0005 : Math.abs(diff / prev) < 0.0005;
  if (flat) return { text: `→ ${kind === "rate" ? "0.0 percentage points" : "0.0%"} vs last month`, tone: "flat" };
  const sign = diff > 0 ? "+" : MINUS;
  // laporan client: "percentage points" ditulis lengkap (bukan "pp") supaya tidak membingungkan
  const body = kind === "rate" ? `${sign}${en1(diff * 100)} percentage points` : `${sign}${en1((diff / prev) * 100)}%`;
  const good = diff > 0 === goodWhenUp;
  // metrik "turun = bagus" (bounce rate, posisi): panah = arah angka, kata dalam kurung = arah performanya
  // (posisi turun = naik peringkat → "(up)"), supaya ↓ hijau tidak membingungkan
  const meaning = goodWhenUp ? "" : good ? " (up)" : " (down)";
  return { text: `${diff > 0 ? "↑" : "↓"} ${body} vs last month${meaning}`, tone: good ? "good" : "bad" };
}

/** Nilai kartu KPI untuk laporan: kpi.<key>.label / .value / .change (+ tone). */
export function kpiData<S>(defs: KpiDef<S>[], cur: S, prev: S | null): { values: Record<string, Cell>; tones: Record<string, Tone> } {
  const values: Record<string, Cell> = {};
  const tones: Record<string, Tone> = {};
  for (const d of defs) {
    const v = d.get(cur) ?? null;
    values[`kpi.${d.key}.label`] = d.label;
    values[`kpi.${d.key}.value`] = d.display?.(cur) ?? (v == null ? null : d.kind === "duration" ? fmtDurationEn(v) : v);
    const ch = kpiChange(d.kind, v, prev ? d.get(prev) : null, d.goodWhenUp ?? true);
    values[`kpi.${d.key}.change`] = ch.text;
    tones[`kpi.${d.key}.change`] = d.neutral && ch.tone !== "none" ? "flat" : ch.tone;
  }
  return { values, tones };
}

/** Field summary Website yang dipakai kartu KPI. */
export interface WebsiteKpiSource {
  users: number | null;
  newUsers: number | null;
  sessions: number | null;
  pageviews: number | null;
  engagementRate: number | null;
  bounceRate: number | null;
  avgEngagementTime: number | null;
  gscClicks: number | null;
  gscImpressions: number | null;
  gscCtr: number | null;
  gscPosition: number | null;
  engagedSessions: number | null;
}

/** Kartu KPI Website (urutan = grid dashboard & blok kartu laporan). */
export const WEBSITE_KPIS: KpiDef<WebsiteKpiSource>[] = [
  { key: "users", label: "Users", kind: "count", get: (s) => s.users },
  { key: "new_users", label: "New users", kind: "count", get: (s) => s.newUsers },
  { key: "sessions", label: "Sessions", kind: "count", get: (s) => s.sessions, hint: "Jumlah sesi semua channel (Traffic acquisition)." },
  { key: "views", label: "Views", kind: "count", get: (s) => s.pageviews },
  { key: "engagement_rate", label: "Engagement rate", kind: "rate", get: (s) => s.engagementRate, hint: "Engaged sessions ÷ sessions." },
  { key: "bounce_rate", label: "Bounce rate", kind: "rate", goodWhenUp: false, get: (s) => s.bounceRate, hint: "1 − engagement rate (definisi GA4)." },
  { key: "avg_engagement_time", label: "Avg engagement time", kind: "duration", get: (s) => s.avgEngagementTime, hint: "Rata-rata waktu engagement per sesi." },
  { key: "gsc_clicks", label: "GSC clicks", kind: "count", get: (s) => s.gscClicks },
  { key: "gsc_impressions", label: "GSC impressions", kind: "count", get: (s) => s.gscImpressions },
  { key: "gsc_ctr", label: "GSC CTR", kind: "rate", get: (s) => s.gscCtr },
  { key: "gsc_position", label: "Avg position", kind: "decimal", goodWhenUp: false, get: (s) => s.gscPosition, hint: "Rata-rata posisi tertimbang impressions. Makin kecil makin baik." },
  { key: "engaged_sessions", label: "Engaged sessions", kind: "count", get: (s) => s.engagedSessions },
];

/** Field summary News yang dipakai kartu KPI. */
export interface NewsKpiSource {
  published: number;
  inReview: number;
  delivered: number;
  quota: { value: number };
  achievement: number | null;
  totalViews: number | null;
  viewsPerArticle: number | null;
  readers: number | null;
  avgEngagementTime: number | null;
}

/** Kartu KPI News (urutan = grid dashboard & blok kartu laporan): baris 1 produksi, baris 2 pembaca. */
export const NEWS_KPIS: KpiDef<NewsKpiSource>[] = [
  { key: "published", label: "Articles published", kind: "count", get: (s) => s.published },
  { key: "in_review", label: "Articles in review", kind: "count", neutral: true, get: (s) => s.inReview, hint: "Artikel yang sudah dikirim tapi belum dipublish." },
  { key: "delivered", label: "Delivered vs quota", kind: "count", get: (s) => s.delivered, display: (s) => `${s.delivered} / ${s.quota.value}`, hint: "Published + in review (definisi 'Delivered' di report News)." },
  { key: "achievement", label: "Quota achievement", kind: "rate", get: (s) => s.achievement, hint: "Delivered ÷ kuota." },
  { key: "views", label: "Article views", kind: "count", get: (s) => s.totalViews, hint: "Jumlah views artikel yang dipublish bulan ini (cocok via URL)." },
  { key: "views_per_article", label: "Views per article", kind: "decimal", get: (s) => s.viewsPerArticle },
  { key: "readers", label: "Readers", kind: "count", get: (s) => s.readers, hint: "Jumlah active users per artikel (satu orang bisa terhitung di beberapa artikel)." },
  { key: "avg_engagement_time", label: "Avg engagement time", kind: "duration", get: (s) => s.avgEngagementTime, hint: "Rata-rata waktu engagement per pembaca, tertimbang jumlah pembaca." },
];

/** Field summary YouTube yang dipakai kartu KPI. */
export interface YoutubeKpiSource {
  published: number;
  quota: { value: number };
  views: number | null;
  viewsPerVideo: number | null;
  impressions: number | null;
  ctr: number | null;
  watchHours: number | null;
  avgViewDurationSec: number | null;
  subsNet: number | null;
}

const signed = (v: number | null) => (v == null ? null : `${v > 0 ? "+" : ""}${v.toLocaleString("en-US")}`);

/** Kartu KPI YouTube (urutan = grid dashboard & blok kartu laporan): baris 1 produksi & jangkauan, baris 2 tontonan. */
export const YOUTUBE_KPIS: KpiDef<YoutubeKpiSource>[] = [
  { key: "published", label: "Videos published", kind: "count", get: (s) => s.published, display: (s) => `${s.published} / ${s.quota.value}`, hint: "Video di publishing log berstatus Publish (termasuk recap) vs kuota bulanan." },
  { key: "views", label: "Views", kind: "count", get: (s) => s.views },
  { key: "views_per_video", label: "Views per video", kind: "decimal", get: (s) => s.viewsPerVideo },
  { key: "impressions", label: "Impressions", kind: "count", get: (s) => s.impressions, hint: "Berapa kali thumbnail ditampilkan di YouTube." },
  { key: "ctr", label: "Impressions CTR", kind: "rate", get: (s) => s.ctr, hint: "Rasio klik thumbnail. Di bawah 4% = perlu perbaikan thumbnail/judul." },
  { key: "watch_hours", label: "Watch time (hours)", kind: "decimal", get: (s) => s.watchHours },
  { key: "avg_view_duration", label: "Avg view duration", kind: "duration", get: (s) => s.avgViewDurationSec },
  { key: "subs_net", label: "Subscribers (net)", kind: "count", get: (s) => s.subsNet, display: (s) => signed(s.subsNet) },
];

/** Field kartu KPI Social (lib/data/summary.ts socialKpiSources). */
export interface SocialKpiSource {
  published: number;
  quota: { value: number };
  views: number | null;
  viewsPerPost: number | null;
  reach: number | null;
  engagementRate: number | null;
  interactions: number | null;
  follows: number | null;
  activeDays: number;
}

/** Kartu KPI Social / Instagram (urutan = grid dashboard & blok kartu laporan). */
export const SOCIAL_KPIS: KpiDef<SocialKpiSource>[] = [
  { key: "published", label: "Posts published", kind: "count", get: (s) => s.published, display: (s) => `${s.published} / ${s.quota.value}`, hint: "Satu baris publishing log = satu konten (semua format, termasuk Stories) vs kuota bulanan." },
  { key: "views", label: "Views", kind: "count", get: (s) => s.views, hint: "Insight akun Instagram selama bulan ini (API) — termasuk Stories & post lama, bukan hanya post yang dipublish bulan ini." },
  { key: "views_per_post", label: "Views per post", kind: "count", get: (s) => s.viewsPerPost, hint: "Rata-rata views lifetime per post feed/Reels yang dipublish bulan ini (sejak publish)." },
  { key: "reach", label: "Reach", kind: "count", get: (s) => s.reach, hint: "Akun unik yang melihat konten selama bulan ini (insight akun). Untuk bulan 31 hari Meta hanya memberi 30 hari pertama." },
  { key: "engagement_rate", label: "Engagement rate", kind: "rate", get: (s) => s.engagementRate, hint: "Interactions ÷ reach akun selama bulan ini. Lebih tinggi dari ER per post karena pembaginya akun unik." },
  { key: "interactions", label: "Interactions", kind: "count", get: (s) => s.interactions, hint: "Total interaksi (likes, comments, shares, saves, replies) di semua konten selama bulan ini — insight akun." },
  { key: "follows", label: "Follows", kind: "count", get: (s) => s.follows, hint: "Follow baru ke akun Instagram selama bulan ini (insight akun via API)." },
  { key: "active_days", label: "Active publishing days", kind: "count", get: (s) => s.activeDays, display: (s) => `${s.activeDays} days`, hint: "Hari dengan minimal satu konten dipublish (publishing log)." },
];
