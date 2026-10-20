import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyMonth, parseFiles, suggestedMonth } from "../lib/parsers";
import { matchHeaderRow } from "../lib/parsers/headers";
import { normalizePath, parseDate, parseDuration, parseNumber, parseRate } from "../lib/parsers/values";
import type { Dataset, DatasetKey } from "../lib/parsers/types";

const SAMPLES = join(__dirname, "..", "data-samples");
const file = (rel: string) => ({ name: rel, data: new Uint8Array(readFileSync(join(SAMPLES, rel))) });
const text = (name: string, content: string) => ({ name, data: new TextEncoder().encode(content) });
const get = (ds: Dataset[], key: DatasetKey) => {
  const d = ds.find((x) => x.key === key);
  if (!d) throw new Error(`dataset ${key} tidak ditemukan; ada: ${ds.map((x) => x.key).join(", ")}`);
  return d;
};
const metric = (d: Dataset, key: string) => d.metrics.find((m) => m.key === key)?.value;
const hasSamples = existsSync(SAMPLES);

describe("values", () => {
  it("parseNumber mendukung format en & id", () => {
    expect(parseNumber("1,839")).toBe(1839);
    expect(parseNumber("1.353", "id")).toBe(1353);
    expect(parseNumber("1.234.567")).toBe(1234567);
    expect(parseNumber("88,3")).toBe(88.3);
    expect(parseNumber("1.234,5")).toBe(1234.5);
    expect(parseNumber("0.450828729281768")).toBeCloseTo(0.4508, 4);
    expect(parseNumber("+5")).toBe(5);
    expect(parseNumber("Rp0")).toBe(0);
    expect(parseNumber("N/A")).toBeNull();
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("1.2K")).toBe(1200);
  });

  it("parseRate membedakan persen dan pecahan", () => {
    expect(parseRate("4.43", "percent")).toBeCloseTo(0.0443);
    expect(parseRate(0.2069, "auto")).toBeCloseTo(0.2069);
    expect(parseRate("52,75%")).toBeCloseTo(0.5275);
    expect(parseRate("20.69%", "fraction")).toBeCloseTo(0.2069);
  });

  it("parseDuration", () => {
    expect(parseDuration("0:01:44")).toBe(104);
    expect(parseDuration("0:47")).toBe(47);
    expect(parseDuration("1m 01s")).toBe(61);
    expect(parseDuration("2m 3d")).toBe(123);
    expect(parseDuration(66.5)).toBe(66.5);
  });

  it("parseDate berbagai format", () => {
    expect(parseDate("09/30/2026 05:27", "mdy")).toEqual({ date: "2026-09-30", time: "05:27" });
    expect(parseDate("01/09/2026")?.date).toBe("2026-09-01");
    expect(parseDate("Sep 9, 2026")?.date).toBe("2026-09-09");
    expect(parseDate("01 Sep 2026")?.date).toBe("2026-09-01");
    expect(parseDate("15 Agustus 2026")?.date).toBe("2026-08-15");
    expect(parseDate("20260901")?.date).toBe("2026-09-01");
    expect(parseDate(46266)?.date).toBe("2026-09-01"); // serial Excel
  });

  it("normalizePath untuk mencocokkan URL artikel", () => {
    expect(normalizePath("https://mainkekudus.com/news/abc/?utm_source=ig#x")).toBe("/news/abc");
    expect(normalizePath("/News/ABC/")).toBe("/news/abc");
    expect(normalizePath("mainkekudus.com/news/abc")).toBe("/news/abc");
    expect(normalizePath("https://mainkekudus.com/")).toBe("/");
  });

  it("normalizePath membiarkan nilai GA4 '(not set)' / '(other)'", () => {
    expect(normalizePath("(not set)")).toBe("(not set)");
    expect(normalizePath("(other)")).toBe("(other)");
  });
});

describe("header matching", () => {
  it("case-insensitive, trim, dan alias Indonesia", () => {
    const spec = { sessions: ["Sessions", "Sesi"], users: ["Active users", "Pengguna aktif"] } as const;
    const m = matchHeaderRow(["  SESI ", "pengguna AKTIF", "Lainnya"], spec);
    expect(m.columns).toEqual({ sessions: 0, users: 1 });
    expect(m.unmatched).toEqual(["Lainnya"]);
  });
});

describe.skipIf(!hasSamples)("data-samples", () => {
  it("GA4 Traffic acquisition CSV (baris # di-skip)", () => {
    const r = parseFiles([file("2026-09/Traffic_acquisition_Session_primary_channel_group_(Default_Channel_Group).csv")], "ga4");
    const d = get(r.datasets, "ga4_traffic");
    expect(d.month).toBe("2026-09");
    expect(d.rows).toHaveLength(7);
    expect(d.rows[0]).toMatchObject({ channel: "Direct", sessions: 905, engagedSessions: 408 });
    expect(d.rows.reduce((a, b) => a + Number(b.sessions), 0)).toBe(1843);
  });

  it("GA4 Landing page, City, dan overview multi-blok", () => {
    const r = parseFiles([file("2026-09/Landing_page_Landing_page.csv"), file("2026-09/Demographic_details_City.csv"), file("2026-09/Generate_leads_overview.csv")], "ga4");
    expect(get(r.datasets, "ga4_landing").rows).toHaveLength(179);
    const city = get(r.datasets, "ga4_city");
    expect(city.breakdowns[0]).toMatchObject({ label: "Kudus", value: 301 });
    const ov = get(r.datasets, "ga4_overview");
    expect(metric(ov, "users")).toBe(835);
    expect(metric(ov, "newUsers")).toBe(773);
  });

  it("GA4 Pages and screens CSV: semua baris + path ternormalisasi", () => {
    const r = parseFiles([file("2026-09/Pages_and_screens_Page_path_and_screen_class.csv")], "ga4");
    const d = get(r.datasets, "ga4_pages");
    expect(d.month).toBe("2026-09");
    expect(d.rows).toHaveLength(431);
    expect(d.rows[0]).toMatchObject({ path: "/", views: 894, activeUsers: 271 });
    expect(d.rows.reduce((a, b) => a + Number(b.views), 0)).toBe(7203);
  });

  it("GSC XLSX: semua sheet + bulan dari sheet Filters", () => {
    const r = parseFiles([file("2026-09/mainkekudus.com-Performance-on-Search-September-2026.xlsx")], "gsc");
    expect(get(r.datasets, "gsc_queries").rows).toHaveLength(61);
    expect(get(r.datasets, "gsc_pages").rows).toHaveLength(109);
    const dates = get(r.datasets, "gsc_dates");
    expect(dates.rows).toHaveLength(30);
    expect(dates.month).toBe("2026-09");
    expect(dates.rows.reduce((a, b) => a + Number(b.clicks), 0)).toBe(98);
    expect(get(r.datasets, "gsc_queries").rows[0]).toMatchObject({ query: "main ke kudus", clicks: 64, ctr: 0.8533 });
  });

  it("YouTube Studio: Table data (Total row) + Totals harian", () => {
    const dir = "2026-09/Content 2026-09-01_2026-10-01 September";
    const r = parseFiles([file(`${dir}/Table data.csv`), file(`${dir}/Chart data.csv`), file(`${dir}/Totals.csv`)], "youtube");
    const t = get(r.datasets, "yt_table");
    expect(t.rows).toHaveLength(4);
    expect(t.rows[0]).toMatchObject({ videoId: "-qgU4zJuOpU", views: 350, durationSec: 341, avgViewDurationSec: 128, publishedDate: "2026-09-09" });
    expect(t.rows[0].ctr).toBeCloseTo(0.0578);
    expect(metric(t, "views")).toBe(732);
    expect(metric(t, "impressions")).toBe(6203);
    expect(metric(t, "ctr")).toBeCloseTo(0.0443);
    expect(t.month).toBe("2026-09");
    const daily = get(r.datasets, "yt_daily");
    expect(daily.rows).toHaveLength(30);
    expect(daily.file).toContain("Totals.csv");
  });

  it("Meta: Instagram terdeteksi dari isi file", () => {
    const r = parseFiles([file("2026-08/Insight IG Agustus.csv")], "meta");
    const ig = get(r.datasets, "meta_instagram");
    expect(ig.month).toBe("2026-08");
    expect(ig.rows).toHaveLength(25);
    expect(ig.rows.filter((x) => x.format === "reels")).toHaveLength(11);
    expect(ig.rows.filter((x) => x.format === "carousel")).toHaveLength(14);
    expect(ig.rows.reduce((a, b) => a + Number(b.reach), 0)).toBe(76101);
    // 1 post 31 Agu 22:23 Pacific = 1 Sep WIB → bukan milik Agustus
    expect(applyMonth(ig, "2026-08").rows).toHaveLength(24);
  });

  it("Meta: IG September — waktu Pacific dikonversi ke WIB (reel 31 Agu 22:23 PT = 1 Sep WIB)", () => {
    const ig = get(parseFiles([file("2026-09/Insight IG September.csv")], "meta").datasets, "meta_instagram");
    expect(ig.rows).toHaveLength(32);
    const sep = applyMonth(ig, "2026-09");
    expect(sep.rows).toHaveLength(31);
    expect(sep.rows.find((r) => String(r.caption).startsWith("Batik Kudus tak hanya"))).toMatchObject({ date: "2026-09-01", publishedAt: "2026-09-01 12:23" });
    // post kolaborasi milik akun lain tetap terbaca, dengan akun pemiliknya
    const accounts = sep.rows.reduce<Record<string, number>>((a, r) => ((a[String(r.account)] = (a[String(r.account)] ?? 0) + 1), a), {});
    expect(accounts).toEqual({ main_ke_kudus: 27, "kudus.asik": 2, opiniid: 1, pbdjarumofficial: 1 });
  });

  it("GSC ZIP (CSV): bulan diambil dari Filters.csv untuk semua tabel", () => {
    const r = parseFiles([file("2026-07/mainkekudus.com-Performance-on-Search-July-2026.zip")], "gsc");
    for (const key of ["gsc_queries", "gsc_pages", "gsc_dates", "gsc_countries", "gsc_devices"] as const) expect(get(r.datasets, key).month).toBe("2026-07");
  });

  it("Report Social Media: Publishing Log 54 post", () => {
    const log = get(parseFiles([file("2026-09/MKK Social Media Monthly Performance Report - September 2026.xlsx")], "social_log").datasets, "social_log");
    expect(log.rows).toHaveLength(54);
    const byFormat = log.rows.reduce<Record<string, number>>((a, x) => ((a[String(x.format)] = (a[String(x.format)] ?? 0) + 1), a), {});
    expect(byFormat).toEqual({ reels: 15, feeds: 10, story: 28, video: 1 });
  });

  it("Report News XLSX: publishing log + under review + views per artikel", () => {
    const r = parseFiles([file("2026-09/MKK News Monthly Performance Report - September 2026.xlsx")], "news");
    const log = get(r.datasets, "news_log");
    expect(log.rows.filter((x) => x.status === "publish")).toHaveLength(42);
    expect(log.rows.filter((x) => x.status === "review")).toHaveLength(11);
    expect(log.month).toBe("2026-09");
    const views = get(r.datasets, "news_views");
    expect(views.rows.reduce((a, b) => a + Number(b.views), 0)).toBe(1353);
    // sheet Ref & Executive Summary tidak boleh jadi data
    expect(r.datasets.map((d) => d.key).sort()).toEqual(["news_log", "news_views"]);
  });

  it("Report YouTube XLSX: publishing log dengan kolom URL tanpa header", () => {
    const r = parseFiles([file("2026-09/MKK Youtube Monthly Performance Report - September 2026.xlsx")], "youtube");
    const log = get(r.datasets, "yt_log");
    expect(log.rows).toHaveLength(4);
    expect(log.rows[0]).toMatchObject({ videoId: "-qgU4zJuOpU", category: "Event", status: "publish" });
    expect(r.datasets.map((d) => d.key)).toEqual(["yt_log"]);
  });

  it("PDF ditolak dengan pesan jelas", () => {
    const r = parseFiles([text("Pages_and_screens_Page_path_and_screen_class.pdf", "%PDF-1.4\n%dummy")]);
    expect(r.datasets).toHaveLength(0);
    expect(r.errors[0]).toMatch(/CSV/);
  });

  it("sumber yang dipilih membatasi deteksi", () => {
    const r = parseFiles([file("2026-08/Insight IG Agustus.csv")], "ga4");
    expect(r.datasets).toHaveLength(0);
    expect(r.skipped[0].reason).toMatch(/Instagram/);
  });
});

describe("format sintetis (UI Indonesia / Google Sheets)", () => {
  it("GA4 CSV berbahasa Indonesia", () => {
    const csv = [
      "# ----------------------------------------",
      "# Akuisisi traffic: Grup saluran utama sesi (Grup Saluran Default)",
      "# ----------------------------------------",
      "# Tanggal mulai: 20261001",
      "# Tanggal akhir: 20261031",
      "Grup saluran utama sesi (Grup Saluran Default),Sesi,Sesi engaged,Rasio engagement,Rata-rata waktu engagement per sesi",
      "Direct,100,50,0.5,60",
      "Organic Search,50,40,0.8,90",
    ].join("\n");
    const r = parseFiles([text("akuisisi.csv", csv)], "ga4");
    const d = get(r.datasets, "ga4_traffic");
    expect(d.month).toBe("2026-10");
    expect(d.rows[1]).toMatchObject({ channel: "Organic Search", sessions: 50, engagedSessions: 40 });
  });

  it("Pages and screens CSV → path ternormalisasi", () => {
    const csv = ["# Start date: 20261001", "# End date: 20261031", "Page path and screen class,Views,Active users", "/news/abc/,120,80", "/,300,200"].join("\n");
    const d = get(parseFiles([text("pages.csv", csv)]).datasets, "ga4_pages");
    expect(d.rows[0]).toMatchObject({ path: "/news/abc", views: 120 });
  });

  it("News log dari Google Sheets (header Indonesia, banyak bulan)", () => {
    const csv = [
      "Tanggal,Judul,URL,Kategori,Kontributor,Status,Tipe,Metode",
      "28/09/2026,Artikel A,https://mainkekudus.com/news/a,Kuliner,OEB,Publish,Features,Remote",
      "02/10/2026,Artikel B,https://mainkekudus.com/news/b/,Arena,YSR,Published,Hard News,Event",
      "05/10/2026,Artikel C,,Arena,YSR,Review,Editorial,Remote",
    ].join("\n");
    const r = parseFiles([text("log.csv", csv)], "news");
    const d = get(r.datasets, "news_log");
    expect(suggestedMonth(r)).toBe("2026-10");
    const oct = applyMonth(d, "2026-10");
    expect(oct.rows).toHaveLength(2);
    expect(oct.rows[0]).toMatchObject({ path: "/news/b", status: "publish", reporter: "YSR" });
    expect(oct.warnings.join(" ")).toMatch(/1 baris di luar Oktober 2026/);
  });

  it("Publishing log sosmed (Tanggal, Channel, Tipe, Kategori, Admin, Designer, Status)", () => {
    const csv = [
      "Tanggal;Channel;Tipe;Kategori;Admin;Designer;Status",
      "01/10/2026;Instagram;Reels;Kuliner;Lucky;Helmi;Published",
      "01/10/2026;Instagram;Carousel;Event;Lucky;Helmi;Draft",
      "02/10/2026;TikTok;Shorts;Event;Lucky;Helmi;Published",
      "03/10/2026;Facebook;Feeds;Event;Lucky;Helmi;Published",
    ].join("\n");
    const d = get(parseFiles([text("sosmed.csv", csv)], "social_log").datasets, "social_log");
    expect(d.rows.map((x) => [x.platform, x.format, x.status])).toEqual([
      ["instagram", "reels", "publish"],
      ["instagram", "carousel", "draft"],
      ["tiktok", "reels", "publish"],
      ["facebook", "feeds", "publish"],
    ]);
  });

  it("Publishing log report sosmed: Channels multi-platform & Format 'Reels, Shorts' — 1 baris = 1 post", () => {
    const csv = [
      "No.,Publish Date,Content,Category,Channels,Format,Status,Method",
      '1,"Sep 1, 2026",Batik Kudus,Featured Video,"Instagram, TikTok, Facebook, Threads, Youtube","Reels, Shorts",Publish,Remote',
      '2,"Sep 3, 2026",Sate Kerbau,Featured News,"Instagram, Facebook",Stories,Publish,Remote',
      '3,"Sep 3, 2026",7 Kuliner,Featured News,"Instagram, TikTok, Facebook, Threads",Feeds,Publish,Remote',
      '4,"Sep 10, 2026",SMC Recap,Teaser Recap,"Instagram, Facebook",Videos,Publish,Remote',
      // Shorts = mirror Reels: urutan terbalik atau Shorts saja tetap dihitung Reels
      '5,"Sep 16, 2026",PB Sahabat,Featured Video,"Instagram, Facebook, TikTok, Youtube","Shorts, Reels",Publish,Remote',
      '6,"Sep 17, 2026",Mirror,Featured Video,Youtube,Shorts,Publish,Remote',
    ].join("\n");
    const d = get(parseFiles([text("log.csv", csv)], "social_log").datasets, "social_log");
    expect(d.rows).toHaveLength(6);
    expect(d.rows.map((x) => x.format)).toEqual(["reels", "story", "feeds", "video", "reels", "reels"]);
    expect(d.rows[0]).toMatchObject({ platform: "instagram,tiktok,facebook,threads,youtube", title: "Batik Kudus", category: "Featured Video", date: "2026-09-01" });
  });

  it("Meta export berbahasa Indonesia", () => {
    const csv = [
      "ID Postingan,ID Akun,Nama pengguna akun,Deskripsi,Waktu publikasi,Tautan permanen,Jenis postingan,Tayangan,Jangkauan,Suka,Komentar,Dibagikan,Disimpan,Ikuti",
      "1,9,main_ke_kudus,halo,10/02/2026 08:00,https://www.instagram.com/reel/x/,Reel IG,1.000,800,50,5,3,2,1",
    ].join("\n");
    const d = get(parseFiles([text("ig.csv", csv)], "meta").datasets, "meta_instagram");
    expect(d.rows[0]).toMatchObject({ date: "2026-10-02", format: "reels", views: 1000, reach: 800, interactions: 60 });
  });
});

describe("parseCount", () => {
  it("pemisah ribuan en & id pada kolom hitungan", async () => {
    const { parseCount } = await import("../lib/parsers/values");
    expect(parseCount("1.000")).toBe(1000);
    expect(parseCount("12,345")).toBe(12345);
    expect(parseCount("1.234.567")).toBe(1234567);
    expect(parseCount("905")).toBe(905);
    expect(parseCount(42)).toBe(42);
  });
});

describe("YouTube: periode export vs bulan publish video", () => {
  it("ZIP September yang berisi video publish Agustus memberi peringatan yang jelas", async () => {
    const { zipSync, strToU8 } = await import("fflate");
    const zip = zipSync({
      "Table data.csv": strToU8(
        [
          "Content,Video title,Video publish time,Duration,Subscribers gained,Unique viewers,Views,Watch time (hours),Average view duration,Thumbnail impressions,Thumbnail click-through rate (%)",
          "Total,,,,0,167,345,5.7026,0:01:36,2198,5.78",
          'nMwU_6s8Oy8,Klub Sepak Bola Putri Kudus,"Aug 13, 2026",317,0,155,306,4.9616,0:01:39,1812,5.96',
        ].join("\n"),
      ),
      "Totals.csv": strToU8("Date,Subscribers gained\n2026-09-01,0\n2026-09-30,0"),
    });
    const r = parseFiles([{ name: "Content 2026-09-01_2026-10-01 Long-form Videos.zip", data: zip }], "youtube");
    const t = get(r.datasets, "yt_table");
    expect(t.month).toBe("2026-09");
    expect(t.range).toEqual({ start: "2026-09-01", end: "2026-09-30" });
    const w = applyMonth(t, "2026-08").warnings.join(" ");
    expect(w).toMatch(/periode 1 Sep 2026–30 Sep 2026/);
    expect(w).toMatch(/Pastikan bulan yang dipilih sudah benar/);
    // Totals berisi Subscribers gained → dilewati dengan alasan spesifik
    expect(r.skipped.some((s) => /Subscribers gained/.test(s.reason))).toBe(true);
    expect(applyMonth(t, "2026-09").warnings.join(" ")).not.toMatch(/periode/);
  });

  it("Totals/Chart data dengan metrik selain watch time dilewati dengan nama metriknya", () => {
    const r = parseFiles(
      [
        text("Content 2026-08-01_2026-09-01 x/Totals.csv", "Date,Average percentage viewed (%)\n2026-08-01,0\n2026-08-02,35.1"),
        text("Content 2026-08-01_2026-09-01 x/Chart data.csv", 'Date,Content,Video title,Video publish time,Duration,Average percentage viewed (%)\n2026-08-01,abc,Judul,"Aug 1, 2026",100,12'),
      ],
      "youtube",
    );
    expect(r.datasets).toHaveLength(0);
    expect(r.skipped).toHaveLength(2);
    for (const s of r.skipped) expect(s.reason).toMatch(/Average percentage viewed \(%\)".*Watch time/);
  });
});

describe("YouTube: laporan = video yang dipublish di bulan laporan", () => {
  const header =
    "Content,Video title,Video publish time,Duration,Unique viewers,Views,Watch time (hours),Average view duration,Thumbnail impressions,Thumbnail click-through rate (%),Subscribers gained";
  const table = (rows: string[]) =>
    text("Content 2026-08-01_2026-09-01 x/Table data.csv", [header, "Total,,,,900,1300,30,0:01:23,11000,5,10", ...rows].join("\n"));

  it("video publish bulan lain dibuang & total dihitung ulang", () => {
    const ds = get(
      parseFiles([table(['a1,Video Juli,"Jul 28, 2026",100,800,1000,20,0:01:12,10000,5,8', 'b2,Video Agustus,"Aug 13, 2026",100,100,300,10,0:02:00,1000,4,2'])], "youtube").datasets,
      "yt_table",
    );
    const aug = applyMonth(ds, "2026-08");
    expect(aug.rows.map((r) => r.videoId)).toEqual(["b2"]);
    expect(metric(aug, "views")).toBe(300);
    expect(metric(aug, "watchHours")).toBe(10);
    expect(metric(aug, "impressions")).toBe(1000);
    expect(metric(aug, "ctr")).toBeCloseTo(0.04);
    expect(metric(aug, "avgViewDurationSec")).toBeCloseTo(120);
    expect(metric(aug, "uniqueViewers")).toBeUndefined();
    expect(aug.warnings.join(" ")).toMatch(/1 video publish Juli 2026/);
  });

  it("hitung ulang: avg view duration = rata-rata per video tertimbang views (bukan watch time ÷ views)", () => {
    const ds = get(
      parseFiles(
        [
          table([
            'a1,Video Juli,"Jul 28, 2026",100,800,1000,20,0:01:12,10000,5,8',
            'b2,Video Agustus,"Aug 13, 2026",300,100,300,4,0:02:00,1000,4,2',
            'c3,Video Agustus 2,"Aug 20, 2026",300,50,100,1,0:01:00,500,2,1',
          ]),
        ],
        "youtube",
      ).datasets,
      "yt_table",
    );
    const aug = applyMonth(ds, "2026-08");
    expect(aug.rows.map((r) => r.videoId)).toEqual(["b2", "c3"]);
    // (120 × 300 + 60 × 100) / 400 = 105; watch time ÷ views = 5 jam × 3600 / 400 = 45
    expect(metric(aug, "avgViewDurationSec")).toBeCloseTo(105);
    expect(metric(aug, "watchHours")).toBe(5);
  });

  it("file berisi video bulan lain saja tidak disimpan & tidak menghapus data lama", async () => {
    const ds = get(parseFiles([table(['a1,Video Juli,"Jul 28, 2026",100,800,1000,20,0:01:12,10000,5,8'])], "youtube").datasets, "yt_table");
    const aug = applyMonth(ds, "2026-08");
    expect(aug.rows).toHaveLength(0);
    expect(aug.metrics).toHaveLength(0);
    const { commitDataset } = await import("../lib/import/commit");
    // prisma tidak boleh tersentuh: objek kosong akan error jika dipakai
    const res = await commitDataset({} as never, ds, "2026-08");
    expect(res).toMatchObject({ skipped: true, rows: 0, replaced: false });
  });

  it("file yang sudah sesuai tidak berubah (baris Total tetap dipakai)", () => {
    const ds = get(parseFiles([table(['b2,Video Agustus,"Aug 13, 2026",100,100,300,10,0:02:00,1000,4,2'])], "youtube").datasets, "yt_table");
    const aug = applyMonth(ds, "2026-08");
    expect(metric(aug, "views")).toBe(1300);
    expect(metric(aug, "uniqueViewers")).toBe(900);
  });
});

describe("News Content Logs (Google Sheets, logs only)", () => {
  // layout asli: 2 baris judul, baris kosong, lalu header; Planned Date + Published Date
  const csv = [
    "MAIN KE KUDUS,,,,,,,,,,",
    "September 2026 - News Content Logs - All,,,,,,,,,,",
    ",,,,,,,,,,",
    "No,Planned Date,Judul Berita,Submitted Article Date,Reporter,Category,Type,Status,Published Date,Link Berita,Method",
    '1,"Sep 1, 2026",Patiayam (liputan 16 agustus 2026),"Sep 1, 2026",OEB,Atraksi,Features,Review,,,Remote',
    '2,"Sep 1, 2026",Berlian Sports Centre,"Sep 1, 2026","OEB, YSR",Arena,Features,Publish,"Sep 1, 2026",https://mainkekudus.com/venues/berlian-sport-centre,Remote',
    '3,"Sep 29, 2026",Artikel Akhir Bulan,"Sep 29, 2026",FZ,Kegiatan,Hard News,Publish,"Sep 30, 2026",https://mainkekudus.com/news/akhir-bulan/,Remote',
  ].join("\n");

  it("header logs-only dikenali; tanggal = Published Date, review pakai Planned Date", () => {
    const ds = get(parseFiles([text("MKK - News Content Logs - September 2026.csv", csv)], "news").datasets, "news_log");
    expect(ds.rows).toHaveLength(3);
    expect(ds.rows[0]).toMatchObject({ title: "Patiayam (liputan 16 agustus 2026)", status: "review", date: "2026-09-01", submittedDate: "2026-09-01", url: null, category: "Atraksi" });
    expect(ds.rows[1]).toMatchObject({ status: "publish", path: "/venues/berlian-sport-centre", reporter: "OEB, YSR" });
    expect(ds.rows[2]).toMatchObject({ date: "2026-09-30", path: "/news/akhir-bulan" });
  });
});

describe("meta stories", () => {
  it("Story IG masuk dataset meta_ig_stories (bukan meta_instagram), jam Pacific → WIB, link clicks terbaca", () => {
    const csv = [
      `"Post ID","Account ID","Account username","Account name",Description,"Duration (sec)","Publish time",Permalink,"Post type","Data comment",Date,Views,Reach,Likes,Shares,Replies,Navigation,"Profile visits","Link clicks",Follows,"Sticker taps"`,
      `111,1,main_ke_kudus,MKK,,15,"09/02/2026 02:43",https://www.instagram.com/stories/main_ke_kudus/1,"IG story",,Lifetime,2460,1803,0,0,0,10,1,,,`,
      `222,1,main_ke_kudus,MKK,,11,"09/30/2026 18:25",https://www.instagram.com/stories/main_ke_kudus/2,"IG story",,Lifetime,124,93,1,0,0,5,3,4,,`,
    ].join("\n");
    const { datasets } = parseFiles([text("stories.csv", csv)], "auto");
    expect(datasets.map((d) => d.key)).toEqual(["meta_ig_stories"]);
    const rows = get(datasets, "meta_ig_stories").rows;
    expect(rows[0]).toMatchObject({ storyId: "111", date: "2026-09-02", publishedAt: "2026-09-02 16:43", views: 2460, linkClicks: null, source: "csv" });
    expect(rows[1]).toMatchObject({ storyId: "222", date: "2026-10-01", publishedAt: "2026-10-01 08:25", linkClicks: 4 });
  });
});

describe("social tracker (Task Progress)", () => {
  // serial Excel: 46266 = 1 Sep 2026, 46295 = 30 Sep, 46296 = 1 Okt
  const head = ["No.", "Planned Date", "Artikel", null, "Brief", "Published Date", "Status", "Assignee", "Google Drive Link", "Submitted Date", "Status", "Instagram Link"];
  const table = {
    file: "MKK Kudus Social Media - Task Progress.xlsx",
    sheet: "September",
    blockCount: 1,
    comments: [],
    rows: [
      head,
      head,
      [1, 46266, null, "Carousel", null, null, null, null, null, null, null, null],
      [2, null, "IFL 2026", "Reel", "brief", 46268, "Published", "Veno", null, 46268, "Submitted", null],
      [3, 46267, "Graha Fila Sport", "Carousel", "brief", null, "Reviewing", "Nana", null, null, "Submitted", null],
      [4, null, "Muria Trail Run", "Carousel", "brief", null, "Approved", null, null, 46270, "Submitted", null],
      [5, 46268, "Cultural Visit", "Reel", "brief", null, "Revision", "Veno", null, 46270, "Revision", null],
      [6, null, "Bupati Cup", "Carousel", "brief", 46267, "Unpublished", "Nana", null, 46267, "Submitted", null],
      [7, 46269, "Ikan Asap", "Reel", "brief", 46296, "Published", "Veno", null, 46295, "Submitted", null],
      [8, null, "Angkringan", "Reel", "brief", "5 Okt 2026", "Published", "Veno", null, "2 Okt 2026", "Submitted", null],
    ],
  };

  it("snapshot akhir bulan: diserahkan tapi belum tayang per akhir bulan, berbasis tanggal", async () => {
    const { readTrackerTab, socialReviewDataset } = await import("../lib/parsers/logs");
    const tab = readTrackerTab(table)!;
    expect(tab.tabMonth).toBe("2026-09");
    const sep = socialReviewDataset(tab.rows, "2026-09", "x");
    expect(sep.metrics).toEqual([{ channel: "social", key: "social_in_review", value: 3 }]);
    expect(sep.breakdowns.map((b) => b.label)).toEqual(["carousel · Graha Fila Sport", "carousel · Muria Trail Run", "reels · Ikan Asap"]);
    // disubmit & tayang Oktober (walau di tab September) → bukan in review Oktober
    expect(socialReviewDataset(tab.rows, "2026-10", "x").metrics[0].value).toBe(0);
  });
});

describe("YouTube Calendar Timeline", () => {
  // Gantt: baris bulan + baris tanggal di atas status harian; tahun dari Planned Date (46266 = 1 Sep 2026)
  const gantt = {
    file: "MKK Internal - Youtube Calendar Timeline.xlsx",
    sheet: "Tracker",
    blockCount: 1,
    comments: [],
    rows: [
      ["No.", "Planned Date", "Video", "Task", null, null, "AUGUST", null, "SEPTEMBER", null, null, "OCTOBER", null],
      [null, null, null, null, null, null, "Sat", "Mon", "Tue", "Wed", "Wed", "Thu", "Fri"],
      [null, null, null, null, null, null, 29, 31, 1, 2, 30, 1, 2],
      [1, 46266, "A", "Helmi", "Video Editor", "Published", "Review", null, "Approved", "Published", null, null, null],
      [null, null, null, "Arpan", "Thumbnail Designer", "Published", "In Progress", null, null, null, null, null, null],
      [2, 46270, "B", "Lucky", "Video Editor", "Published", null, null, "Review", "Revision", "Review", null, "Published"],
      [3, 46280, "C", "Salman", "Video Editor", "QC", null, null, null, null, "QC", null, null],
    ],
  };

  it("in review = Review/Approved di akhir bulan, diserahkan bulan itu; QC tidak dihitung", async () => {
    const { readYtCalendarGantt, ytReviewDataset } = await import("../lib/parsers/youtube-calendar");
    const videos = readYtCalendarGantt(gantt)!;
    expect(videos.map((v) => v.title)).toEqual(["A", "B", "C"]);
    expect(videos[0].timeline).toEqual([
      { date: "2026-08-29", status: "review" },
      { date: "2026-09-01", status: "approved" },
      { date: "2026-09-02", status: "published" },
    ]);
    const count = (m: string) => ytReviewDataset(videos, m, "x").breakdowns.map((b) => b.label);
    expect(count("2026-08")).toEqual(["A"]); // Review 29 Agu, tayang September
    expect(count("2026-09")).toEqual(["B"]); // diserahkan ulang 30 Sep setelah revisi, tayang Oktober
    expect(count("2026-10")).toEqual([]);
  });

  it("tab Summary → log; judul YouTube didahulukan, tanggal = Publish Date (Planned jika belum tayang)", async () => {
    const { readYtCalendarSummary, ytCalendarLogDataset } = await import("../lib/parsers/youtube-calendar");
    const rows = readYtCalendarSummary({
      file: "x.xlsx",
      sheet: "Summary",
      blockCount: 1,
      comments: [],
      rows: [
        ["MAIN KE KUDUS INTERNAL - YOUTUBE CALENDAR"],
        ["No.", "Planned Date", "Publish Date", "Video", "Youtube Title", "Youtube URL", "Format", "Category", "Status"],
        [1, 46262, 46274, "Caffino", "Lahirnya Para Srikandi", "https://youtu.be/-qgU4zJuOpU", "Recap", "Event", "Published"],
        [2, 46311, null, "And1 Sport", null, null, "Editorial Feature Video", "Sport Gears", null],
      ],
    })!;
    const sep = ytCalendarLogDataset(rows, "2026-09", "x");
    expect(sep.rows).toHaveLength(1);
    expect(sep.rows[0]).toMatchObject({ date: "2026-09-09", title: "Lahirnya Para Srikandi", videoId: "-qgU4zJuOpU", format: "Recap", status: "publish" });
    expect(ytCalendarLogDataset(rows, "2026-10", "x").rows[0]).toMatchObject({ title: "And1 Sport", status: "unknown" });
  });
});

describe("News in review snapshot", () => {
  it("disubmit September, tayang Oktober → review di September + publish di Oktober; Approved = review", () => {
    const head = ["Planned Date", "Judul Berita", "Kategori", "Status", "Submitted Date", "Published Date", "Link Berita"];
    const res = parseFiles([
      {
        name: "news.csv",
        data: new TextEncoder().encode(
          [head.join(","), "2026-09-28,Pasar Gaib,Culture,Publish,2026-09-28,2026-10-06,https://x.id/a", "2026-09-20,Moeria Jersey,Sport,Approved,2026-09-20,,", "2026-09-10,Soto,Food,Publish,2026-09-10,2026-09-11,https://x.id/b"].join("\n"),
        ),
      },
    ]);
    const ds = res.datasets.find((d) => d.key === "news_log")!;
    const sep = applyMonth(ds, "2026-09").rows.map((r) => `${r.title}:${r.status}`);
    expect(sep).toEqual(["Pasar Gaib:review", "Moeria Jersey:review", "Soto:publish"]);
    expect(applyMonth(ds, "2026-10").rows.map((r) => `${r.title}:${r.status}`)).toEqual(["Pasar Gaib:publish"]);
  });
});
