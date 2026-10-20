// Engine rekomendasi rule-based.
// Tambah rule baru: push objek ke array RULES. Rule dengan `mom: true` hanya dijalankan
// jika data bulan sebelumnya untuk channel tersebut tersedia.
import type { MonthBundle } from "./data/summary";
import type { Channel } from "./parsers/types";
import { fmtDate, fmtDuration, fmtNum, fmtPct, truncate } from "./format";
import { monthLabel } from "./month";
import { FORMAT_LABEL, PLATFORM_LABEL } from "./sources";

export type Priority = "tinggi" | "sedang" | "rendah";

export interface Recommendation {
  id: string;
  channel: Channel;
  priority: Priority;
  title: string;
  text: string;
}

export interface RuleContext {
  cur: MonthBundle;
  prev: MonthBundle | null;
}

interface Rule {
  id: string;
  channel: Channel;
  /** butuh data bulan sebelumnya */
  mom?: boolean;
  run: (ctx: RuleContext) => Omit<Recommendation, "id" | "channel">[] | Omit<Recommendation, "id" | "channel"> | null;
}

const pctChange = (cur: number | null | undefined, prev: number | null | undefined) =>
  cur == null || prev == null || prev === 0 ? null : (cur - prev) / prev;

const fmtChange = (r: number) => `${r > 0 ? "naik" : "turun"} ${fmtPct(Math.abs(r))}`;

const formatName = (platform: string, format: string) =>
  `${FORMAT_LABEL[format] ?? format} ${PLATFORM_LABEL[platform] ?? platform}`.trim();

/** Channel dianggap punya data bulan lalu? */
function hasPrev(ctx: RuleContext, channel: Channel): boolean {
  return !!ctx.prev?.[channel].hasData;
}

export const RULES: Rule[] = [
  // ─────────── Website / SEO ───────────
  {
    id: "gsc-impr-up-ctr-down",
    channel: "website",
    mom: true,
    run: ({ cur, prev }) => {
      const w = cur.website, p = prev!.website;
      const ri = pctChange(w.gscImpressions, p.gscImpressions);
      if (ri == null || ri <= 0 || w.gscCtr == null || p.gscCtr == null || w.gscCtr >= p.gscCtr) return null;
      return {
        priority: "tinggi",
        title: "Impressions naik, CTR turun",
        text: `Impressions Google ${fmtChange(ri)} (${fmtNum(p.gscImpressions)} → ${fmtNum(w.gscImpressions)}), tapi CTR turun dari ${fmtPct(p.gscCtr)} ke ${fmtPct(w.gscCtr)}. Optimasi judul (title tag) dan meta description halaman dengan impressions terbesar supaya lebih menarik diklik.`,
      };
    },
  },
  {
    id: "gsc-striking-distance",
    channel: "website",
    run: ({ cur }) => {
      const qs = cur.website.opportunityQueries.filter((q) => q.impressions >= 5).slice(0, 3);
      if (!qs.length) return null;
      const list = qs.map((q) => `"${q.query}" (posisi ${fmtNum(q.position, 1)}, ${fmtNum(q.impressions)} impressions)`).join(", ");
      return {
        priority: "sedang",
        title: "Query di posisi 4–10: peluang naik ke top 3",
        text: `${cur.website.opportunityQueries.length} query berada di posisi 4–10, mis. ${list}. Perkuat konten terkait (tambah subjudul yang memuat query, internal link dari halaman populer, perbarui isi) agar naik ke top 3.`,
      };
    },
  },
  {
    id: "gsc-low-ctr-pages",
    channel: "website",
    run: ({ cur }) => {
      const pages = cur.website.lowCtrPages.slice(0, 3);
      if (!pages.length) return null;
      return {
        priority: "rendah",
        title: "Halaman sering tampil tapi jarang diklik",
        text: `Halaman ${pages.map((p) => `${p.path} (${fmtNum(p.impressions)} impressions, CTR ${fmtPct(p.ctr)})`).join(", ")} punya CTR di bawah 2%. Tulis ulang title & meta description-nya.`,
      };
    },
  },
  {
    id: "web-er-drop",
    channel: "website",
    mom: true,
    run: ({ cur, prev }) => {
      const r = pctChange(cur.website.engagementRate, prev!.website.engagementRate);
      if (r == null || r > -0.1) return null;
      return {
        priority: "tinggi",
        title: "Engagement rate website turun",
        text: `Engagement rate website turun ${fmtPct(-r)} MoM (${fmtPct(prev!.website.engagementRate)} → ${fmtPct(cur.website.engagementRate)}). Cek halaman landing teratas: kecepatan loading, relevansi konten dengan sumber traffic, dan CTA ke artikel terkait.`,
      };
    },
  },
  {
    id: "web-traffic-change",
    channel: "website",
    mom: true,
    run: ({ cur, prev }) => {
      const r = pctChange(cur.website.sessions, prev!.website.sessions);
      if (r == null || Math.abs(r) < 0.2) return null;
      return {
        priority: r < 0 ? "sedang" : "rendah",
        title: r < 0 ? "Sesi website turun signifikan" : "Sesi website naik signifikan",
        text: `Sesi website ${fmtChange(r)} (${fmtNum(prev!.website.sessions)} → ${fmtNum(cur.website.sessions)}). ${
          r < 0 ? "Bandingkan sumber traffic untuk melihat channel mana yang menurun." : "Identifikasi konten/channel pendorongnya dan ulangi polanya."
        }`,
      };
    },
  },
  {
    id: "web-source-dependence",
    channel: "website",
    run: ({ cur }) => {
      const top = cur.website.sourceBreakdown[0];
      if (!top || top.share == null || top.share < 0.5) return null;
      return {
        priority: "rendah",
        title: "Traffic bergantung pada satu sumber",
        text: `${fmtPct(top.share)} sesi berasal dari ${top.label}. Diversifikasi: dorong Organic Search lewat SEO dan Organic Social lewat link di bio/story.`,
      };
    },
  },

  // ─────────── News ───────────
  {
    id: "news-quota",
    channel: "news",
    run: ({ cur }) => {
      const n = cur.news;
      // kuota dinilai dari delivered (published + in review)
      if (!n.hasData || n.achievement == null || n.achievement >= 0.9) return null;
      const gap = Math.max(0, n.quota.value - n.delivered);
      return {
        priority: n.achievement < 0.7 ? "tinggi" : "sedang",
        title: "Kuota artikel belum tercapai",
        text: `Delivered ${fmtNum(n.delivered)} dari ${fmtNum(n.quota.value)} artikel (${fmtPct(n.achievement)}): ${fmtNum(n.published)} published + ${fmtNum(n.inReview)} in review; kurang ${fmtNum(gap)}.${
          n.inReview ? ` Percepat approval ${fmtNum(n.inReview)} artikel yang masih review supaya cepat terbit.` : ""
        }`,
      };
    },
  },
  {
    id: "news-best-category",
    channel: "news",
    run: ({ cur }) => {
      const cats = cur.news.byCategory.filter((c) => c.count >= 2 && c.perContent != null);
      if (cats.length < 2 || cur.news.viewsPerArticle == null) return null;
      const best = [...cats].sort((a, b) => b.perContent! - a.perContent!)[0];
      if (best.perContent! < cur.news.viewsPerArticle * 1.2) return null;
      return {
        priority: "sedang",
        title: `Kategori "${best.label}" paling efektif`,
        text: `Kategori ${best.label} rata-rata ${fmtNum(best.perContent)} views per artikel (${fmtNum(best.count)} artikel), di atas rata-rata ${fmtNum(cur.news.viewsPerArticle)}. Perbanyak porsi kategori ini bulan depan.`,
      };
    },
  },
  {
    id: "news-unmatched",
    channel: "news",
    run: ({ cur }) => {
      const n = cur.news;
      const out: Omit<Recommendation, "id" | "channel">[] = [];
      if (n.unmatched.length) {
        out.push({
          priority: "sedang",
          title: "Artikel published tidak ditemukan di GA4",
          text: `${fmtNum(n.unmatched.length)} artikel published tidak cocok dengan data views (${n.unmatched
            .slice(0, 3)
            .map((a) => `"${truncate(a.title, 40)}"`)
            .join(", ")}${n.unmatched.length > 3 ? ", …" : ""}). Cek URL di log (typo, slug berubah) atau pastikan export GA4 Pages and screens memuat semua baris.`,
        });
      }
      if (n.zeroViews.length) {
        out.push({
          priority: "sedang",
          title: "Artikel dengan 0 views",
          text: `${fmtNum(n.zeroViews.length)} artikel published tercatat 0 views. Distribusikan ulang lewat sosmed dan tambahkan internal link.`,
        });
      }
      return out;
    },
  },
  {
    id: "news-empty-days",
    channel: "news",
    run: ({ cur }) => {
      const s = cur.news.emptyStreak;
      if (!cur.news.hasData || s.length < 4) return null;
      return {
        priority: "rendah",
        title: "Hari tanpa artikel berturut-turut",
        text: `Tidak ada artikel terbit selama ${fmtNum(s.length)} hari berturut-turut (${fmtDate(s.from, false)}–${fmtDate(s.to, false)}). Siapkan stok artikel evergreen untuk mengisi jeda.`,
      };
    },
  },
  {
    id: "news-views-drop",
    channel: "news",
    mom: true,
    run: ({ cur, prev }) => {
      const r = pctChange(cur.news.viewsPerArticle, prev!.news.viewsPerArticle);
      if (r == null || r > -0.15) return null;
      return {
        priority: "sedang",
        title: "Views per artikel turun",
        text: `Views per artikel ${fmtChange(r)} (${fmtNum(prev!.news.viewsPerArticle)} → ${fmtNum(cur.news.viewsPerArticle)}). Evaluasi judul dan distribusi artikel bulan ini.`,
      };
    },
  },

  // ─────────── YouTube ───────────
  {
    id: "yt-low-ctr",
    channel: "youtube",
    run: ({ cur }) => {
      const y = cur.youtube;
      if (!y.hasData) return null;
      const out: Omit<Recommendation, "id" | "channel">[] = [];
      if (y.ctr != null && y.ctr < 0.04) {
        out.push({
          priority: "tinggi",
          title: "CTR thumbnail YouTube di bawah 4%",
          text: `CTR impressions channel ${fmtPct(y.ctr, 2)} dari ${fmtNum(y.impressions)} impressions. Uji thumbnail dengan wajah/teks besar dan judul yang lebih spesifik.`,
        });
      }
      const low = y.lowCtrVideos.slice(0, 3);
      if (low.length) {
        out.push({
          priority: "sedang",
          title: "Video dengan CTR thumbnail rendah",
          text: `${low.map((v) => `"${truncate(v.title, 40)}" (CTR ${fmtPct(v.ctr, 2)}, ${fmtNum(v.impressions)} impressions)`).join(", ")}. Ganti thumbnail/judul video ini.`,
        });
      }
      return out;
    },
  },
  {
    id: "yt-retention",
    channel: "youtube",
    run: ({ cur }) => {
      const vids = cur.youtube.videos.filter((v) => v.durationSec && v.avgViewDurationSec && v.views >= 30 && v.avgViewDurationSec / v.durationSec < 0.25);
      if (!vids.length) return null;
      const v = vids[0];
      return {
        priority: "rendah",
        title: "Retensi video rendah",
        text: `"${truncate(v.title, 50)}" rata-rata ditonton ${fmtDuration(v.avgViewDurationSec)} dari durasi ${fmtDuration(v.durationSec)} (${fmtPct(v.avgViewDurationSec! / v.durationSec!)}). Perkuat 15 detik pertama dan pertimbangkan versi lebih pendek.`,
      };
    },
  },
  {
    id: "yt-quota",
    channel: "youtube",
    run: ({ cur }) => {
      const y = cur.youtube;
      if (!y.hasData || y.deliveredRate == null || y.deliveredRate >= 0.9) return null;
      return {
        priority: "sedang",
        title: "Kuota video YouTube belum tercapai",
        text: `Delivered ${fmtNum(y.delivered)} dari ${fmtNum(y.quota.value)} video (${fmtPct(y.deliveredRate)}): ${fmtNum(y.published)} published + ${fmtNum(y.inReview)} in review.${
          y.inReview ? ` Percepat approval ${fmtNum(y.inReview)} video yang masih review supaya cepat tayang.` : ""
        }`,
      };
    },
  },
  {
    id: "yt-views-change",
    channel: "youtube",
    mom: true,
    run: ({ cur, prev }) => {
      const r = pctChange(cur.youtube.views, prev!.youtube.views);
      if (r == null || r > -0.2) return null;
      return {
        priority: "sedang",
        title: "Views YouTube turun",
        text: `Views YouTube ${fmtChange(r)} (${fmtNum(prev!.youtube.views)} → ${fmtNum(cur.youtube.views)}). Promosikan video lewat Shorts/Reels potongan dan end screen.`,
      };
    },
  },

  // ─────────── Social ───────────
  {
    id: "social-quota",
    channel: "social",
    run: ({ cur }) => {
      const q = cur.social.quotaProgress[0];
      if (!cur.social.hasData || !q?.available || q.rate == null || q.rate >= 0.9) return null;
      const gap = Math.max(0, q.quota.value - q.count);
      return {
        priority: q.rate < 0.7 ? "tinggi" : "sedang",
        title: "Kuota post sosmed belum tercapai",
        text: `Delivered ${fmtNum(q.count)} dari ${fmtNum(q.quota.value)} post (${fmtPct(q.rate)}): ${fmtNum(q.published)} published + ${fmtNum(q.inReview)} in review; kurang ${fmtNum(gap)}.${
          q.inReview ? ` Percepat approval ${fmtNum(q.inReview)} konten yang masih review supaya cepat tayang.` : ""
        }${
          cur.social.countSource === "meta" ? " Dihitung dari export Meta tanpa Stories — import Publishing Log untuk angka resmi." : ""
        }`,
      };
    },
  },
  {
    id: "social-er-drop",
    channel: "social",
    mom: true,
    run: ({ cur, prev }) => {
      // bandingkan per platform supaya IG vs FB tidak tercampur
      const out: Omit<Recommendation, "id" | "channel">[] = [];
      for (const p of cur.social.byPlatform) {
        const q = prev!.social.byPlatform.find((x) => x.platform === p.platform);
        const r = pctChange(p.er, q?.er);
        if (r == null || r > -0.1) continue;
        out.push({
          priority: "tinggi",
          title: `Engagement rate ${PLATFORM_LABEL[p.platform] ?? p.platform} turun`,
          text: `Engagement rate ${PLATFORM_LABEL[p.platform] ?? p.platform} turun ${fmtPct(-r)} MoM (${fmtPct(q!.er)} → ${fmtPct(p.er)}). Perkuat hook di 3 detik pertama, ajak audiens berkomentar/menyimpan, dan evaluasi jam posting.`,
        });
      }
      return out;
    },
  },
  {
    id: "social-best-format",
    channel: "social",
    run: ({ cur }) => {
      const out: Omit<Recommendation, "id" | "channel">[] = [];
      for (const platform of cur.social.platforms) {
        const formats = cur.social.byFormat.filter((f) => f.platform === platform && f.posts >= 2 && f.avgReach != null);
        if (formats.length < 2) continue;
        const sorted = [...formats].sort((a, b) => b.avgReach! - a.avgReach!);
        const [best, worst] = [sorted[0], sorted[sorted.length - 1]];
        const ratio = best.avgReach! / Math.max(1, worst.avgReach!);
        if (ratio < 1.5) continue;
        out.push({
          priority: ratio >= 2 ? "sedang" : "rendah",
          title: `${formatName(platform, best.format)} unggul jauh dari ${FORMAT_LABEL[worst.format] ?? worst.format}`,
          text: `Rata-rata reach ${formatName(platform, best.format)} ${fmtNum(best.avgReach)} per post vs ${formatName(platform, worst.format)} ${fmtNum(worst.avgReach)} (${fmtNum(ratio, 1)}×). Perbanyak ${FORMAT_LABEL[best.format] ?? best.format}; untuk ${FORMAT_LABEL[worst.format] ?? worst.format}, uji ulang cover dan caption.`,
        });
      }
      return out;
    },
  },
  {
    id: "social-best-category",
    channel: "social",
    run: ({ cur }) => {
      const cats = cur.social.byCategory.filter((c) => c.posts >= 2 && c.avgReach != null && !c.label.startsWith("("));
      if (cats.length < 2) return null;
      const best = [...cats].sort((a, b) => b.avgReach! - a.avgReach!)[0];
      return {
        priority: "rendah",
        title: `Kategori sosmed "${best.label}" paling menjangkau`,
        text: `Kategori ${best.label} rata-rata ${fmtNum(best.avgReach)} reach per post (${fmtNum(best.posts)} post). Perbanyak konten kategori ini.`,
      };
    },
  },
  {
    id: "social-empty-days",
    channel: "social",
    run: ({ cur }) => {
      const s = cur.social.emptyStreak;
      if (!cur.social.hasData || s.length < 3) return null;
      return {
        priority: s.length >= 5 ? "sedang" : "rendah",
        title: "Hari publish kosong berturut-turut",
        text: `Tidak ada posting selama ${fmtNum(s.length)} hari berturut-turut (${fmtDate(s.from, false)}–${fmtDate(s.to, false)}). Aktif ${fmtNum(cur.social.activeDays)} hari di ${monthLabel(cur.month)}. Jadwalkan konten cadangan supaya ritme posting stabil.`,
      };
    },
  },
];

const ORDER: Record<Priority, number> = { tinggi: 0, sedang: 1, rendah: 2 };

export function generateRecommendations(ctx: RuleContext): Recommendation[] {
  const out: Recommendation[] = [];
  for (const rule of RULES) {
    if (!ctx.cur[rule.channel].hasData) continue;
    if (rule.mom && !hasPrev(ctx, rule.channel)) continue;
    let res;
    try {
      res = rule.run(ctx);
    } catch (e) {
      console.error(`Rule ${rule.id} gagal:`, e);
      continue;
    }
    if (!res) continue;
    const list = Array.isArray(res) ? res : [res];
    list.forEach((r, i) => out.push({ ...r, id: list.length > 1 ? `${rule.id}-${i}` : rule.id, channel: rule.channel }));
  }
  return out.sort((a, b) => ORDER[a.priority] - ORDER[b.priority]);
}
