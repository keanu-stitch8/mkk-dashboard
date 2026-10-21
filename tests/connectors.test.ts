// Tes connector API memakai fixture JSON — tidak memanggil API asli.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mapGa4Month, rowsOf, type Ga4MonthReports } from "../lib/connectors/ga4/map";
import { monthRange } from "../lib/connectors/common";
import { googleErrorMessage } from "../lib/connectors/google-errors";
import { decrypt, encrypt } from "../lib/crypto";
import { DATASETS } from "../lib/sources";
import type { Dataset, DatasetKey } from "../lib/parsers/types";

const fixture = <T>(path: string): T => JSON.parse(readFileSync(join(__dirname, "fixtures", path), "utf8")) as T;
const get = (ds: Dataset[], key: DatasetKey) => ds.find((d) => d.key === key)!;
const metric = (d: Dataset, key: string) => d.metrics.find((m) => m.key === key)?.value;

/** Kolom tiap model Prisma yang diisi dari Dataset.rows (harus sama dengan hasil parser CSV). */
const MODEL_FIELDS: Partial<Record<DatasetKey, string[]>> = {
  ga4_traffic: ["channel", "sessions", "engagedSessions", "engagementRate", "avgEngagementTime", "eventCount", "users", "newUsers"],
  ga4_pages: ["path", "title", "views", "activeUsers", "avgEngagementTime", "eventCount"],
  ga4_landing: ["path", "sessions", "activeUsers", "newUsers", "avgEngagementTime"],
};

describe("GA4 connector: mapping runReport → dataset", () => {
  let ds: Dataset[];
  beforeAll(() => {
    const names = ["totals", "channels", "pages", "pageTitles", "landing", "firstChannel", "city"] as const;
    const reports = Object.fromEntries(names.map((n) => [n, fixture(`ga4/${n}.json`)])) as unknown as Ga4MonthReports;
    ds = mapGa4Month(reports, "2026-09", "API GA4 · properti 123");
  });

  it("menghasilkan dataset dengan key yang sama seperti import CSV", () => {
    expect(ds.map((d) => d.key).sort()).toEqual(["ga4_city", "ga4_landing", "ga4_overview", "ga4_pages", "ga4_traffic"]);
    for (const d of ds) {
      expect(DATASETS[d.key].group).toBe("ga4");
      expect(d.month).toBe("2026-09");
      expect(d.rowDated).toBe(false);
    }
  });

  it("baris punya kolom persis sesuai model Prisma", () => {
    for (const [key, fields] of Object.entries(MODEL_FIELDS)) {
      for (const row of get(ds, key as DatasetKey).rows) expect(Object.keys(row).sort()).toEqual([...fields].sort());
    }
  });

  it("traffic per channel: avg engagement per sesi = userEngagementDuration / sessions", () => {
    const direct = get(ds, "ga4_traffic").rows[0];
    expect(direct).toMatchObject({ channel: "Direct", sessions: 905, engagedSessions: 408, eventCount: 5634, users: 420, newUsers: 390 });
    expect(direct.engagementRate).toBeCloseTo(0.4508, 4);
    expect(direct.avgEngagementTime).toBeCloseTo(60197 / 905, 6);
  });

  it("pages: path dinormalisasi seperti parser CSV (trailing slash & query string digabung) + judul terbanyak", () => {
    const pages = get(ds, "ga4_pages").rows;
    expect(pages).toHaveLength(3);
    const wushu = pages.find((p) => p.path === "/news/wushu-indonesia-kudus")!;
    expect(wushu).toMatchObject({ views: 102, activeUsers: 66, eventCount: 220, title: "Wushu Indonesia Kudus - Main ke Kudus" });
    expect(wushu.avgEngagementTime).toBeCloseTo(4500 / 66, 6);
  });

  it("overview: users & new users dari total (bukan jumlah breakdown) + first channel", () => {
    const ov = get(ds, "ga4_overview");
    expect(metric(ov, "users")).toBe(835);
    expect(metric(ov, "newUsers")).toBe(773);
    expect(ov.breakdowns.map((b) => [b.label, b.value])).toEqual([["Direct", 483], ["Organic Social", 202], ["Organic Search", 76]]);
  });

  it("landing & city", () => {
    const landing = get(ds, "ga4_landing");
    expect(landing.rows[1]).toMatchObject({ path: "(not set)", sessions: 147 });
    expect(metric(landing, "landing_sessions")).toBe(663);
    const city = get(ds, "ga4_city");
    expect(city.breakdowns[0]).toMatchObject({ dimension: "city", label: "Kudus", metric: "activeUsers", value: 301 });
    expect(metric(city, "users_est")).toBe(469);
  });

  it("rowsOf tahan terhadap response kosong", () => {
    expect(rowsOf({})).toEqual([]);
    expect(rowsOf({ dimensionHeaders: [{ name: "city" }], metricHeaders: [{ name: "activeUsers" }], rows: null })).toEqual([]);
  });
});

describe("helper connector", () => {
  it("monthRange: bulan penuh, bulan berjalan dipotong, bulan depan ditolak", () => {
    const now = new Date("2026-10-16T03:00:00Z");
    expect(monthRange("2026-09", now)).toEqual({ start: "2026-09-01", end: "2026-09-30", partial: false });
    expect(monthRange("2026-10", now)).toEqual({ start: "2026-10-01", end: "2026-10-16", partial: true });
    expect(() => monthRange("2026-11", now)).toThrow(/hasn't started yet/);
    expect(() => monthRange("2026-9", now)).toThrow(/Invalid month format/);
  });

  it("enkripsi AES-256-GCM: round-trip & menolak data yang diubah", () => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const secret = JSON.stringify({ refresh_token: "1//abc" });
    const enc = encrypt(secret);
    expect(enc.startsWith("v1.")).toBe(true);
    expect(enc).not.toContain("abc");
    expect(decrypt(enc)).toBe(secret);
    // ubah satu karakter di tengah ciphertext (selalu berbeda dari aslinya, apa pun hasil IV acak)
    const i = Math.floor(enc.length / 2);
    const tampered = enc.slice(0, i) + (enc[i] === "A" ? "B" : "A") + enc.slice(i + 1);
    expect(() => decrypt(tampered)).toThrow(/can't be decrypted/);
  });

  it("error Google diterjemahkan ke pesan yang bisa ditindaklanjuti", () => {
    const sa = "dashboard@proj.iam.gserviceaccount.com";
    expect(googleErrorMessage({ code: 7, message: "User does not have sufficient permissions for this property." }, { api: "ga4", serviceAccount: sa, propertyId: "123" })).toMatch(
      /The service account hasn't been added to GA4 property 123.*dashboard@proj/,
    );
    expect(
      googleErrorMessage({ code: 7, message: "Google Analytics Data API has not been used in project 42 before or it is disabled." }, { api: "ga4" }),
    ).toMatch(/isn't enabled/);
    expect(googleErrorMessage({ code: 5, message: "Property not found" }, { api: "ga4", propertyId: "G-ABC" })).toMatch(/Measurement ID/);
    expect(googleErrorMessage({ code: 8, message: "Exhausted property tokens" }, { api: "ga4" })).toMatch(/quota/);
    expect(googleErrorMessage({ code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND" }, { api: "ga4" })).toMatch(/internet connection/);
  });
});

describe("OAuth Google", () => {
  it("URL consent: offline access + prompt consent + scope read-only + state", async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = "123.apps.googleusercontent.com";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "secret";
    delete process.env.GOOGLE_OAUTH_REDIRECT_URI;
    const { authUrl } = await import("../lib/connectors/google-oauth");
    const url = new URL(authUrl("ga4", "ga4.nonce123", "http://localhost:3000"));
    expect(url.host).toBe("accounts.google.com");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("ga4.nonce123");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/google/callback");
    expect(url.searchParams.get("scope")?.split(" ")).toEqual(["https://www.googleapis.com/auth/analytics.readonly", "openid", "email"]);
    const yt = new URL(authUrl("youtube", "youtube.x"));
    expect(yt.searchParams.get("scope")).toContain("yt-analytics.readonly");
  });

  it("putuskan: token hanya dicabut di Google jika akunnya tidak dipakai connector lain", async () => {
    const { shouldRevoke } = await import("../lib/connectors/google-oauth");
    const me = "riski@example.com";
    expect(shouldRevoke(me, [])).toEqual({ revoke: true, sharedWith: [] });
    expect(shouldRevoke(me, [{ connector: "gsc", account: "Riski@Example.com" }, { connector: "youtube", account: "owner@example.com" }])).toEqual({ revoke: false, sharedWith: ["gsc"] });
    expect(shouldRevoke(me, [{ connector: "youtube", account: "owner@example.com" }])).toEqual({ revoke: true, sharedWith: [] });
    // akun tidak diketahui → anggap bisa sama, jangan cabut
    expect(shouldRevoke(null, [{ connector: "ga4", account: me }]).revoke).toBe(false);
    expect(shouldRevoke(me, [{ connector: "ga4", account: null }]).revoke).toBe(false);
  });

  it("pesan error mode OAuth berbeda dari service account", () => {
    const denied = { code: 7, message: "User does not have sufficient permissions for this property." };
    expect(googleErrorMessage(denied, { api: "ga4", authMode: "oauth", account: "riski@example.com", propertyId: "123" })).toMatch(
      /Google account riski@example.com has no access to GA4 property 123/,
    );
    expect(googleErrorMessage({ message: "invalid_grant: Token has been expired or revoked." }, { api: "ga4", authMode: "oauth" })).toMatch(/Connect Google account/);
    expect(googleErrorMessage({ status: 401, message: "invalid_client" }, { api: "ga4", authMode: "oauth" })).toMatch(/Google rejected the OAuth client/);
  });
});

describe("GSC connector: mapping searchanalytics → dataset", () => {
  const load = async () => {
    const { mapGscMonth } = await import("../lib/connectors/gsc/map");
    const names = ["totals", "queries", "pages", "dates", "devices", "countries"] as const;
    const res = Object.fromEntries(names.map((n) => [n, fixture(`gsc/${n}.json`)]));
    return mapGscMonth(res as never, "2026-09", "API Search Console · sc-domain:mainkekudus.com");
  };

  it("dataset & kolom sama dengan import CSV/XLSX GSC", async () => {
    const ds = await load();
    expect(ds.map((d) => d.key).sort()).toEqual(["gsc_countries", "gsc_dates", "gsc_devices", "gsc_pages", "gsc_queries"]);
    for (const d of ds) expect(DATASETS[d.key].group).toBe("gsc");
    expect(Object.keys(get(ds, "gsc_queries").rows[0]).sort()).toEqual(["clicks", "ctr", "impressions", "position", "query"]);
    expect(Object.keys(get(ds, "gsc_pages").rows[0]).sort()).toEqual(["clicks", "ctr", "impressions", "path", "position", "url"]);
  });

  it("queries, pages (path ternormalisasi), dates terurut + total resmi", async () => {
    const ds = await load();
    expect(get(ds, "gsc_queries").rows[0]).toMatchObject({ query: "main ke kudus", clicks: 64, impressions: 75, ctr: 0.8533, position: 1.2 });
    expect(get(ds, "gsc_pages").rows[1]).toMatchObject({ path: "/news/wushu-indonesia-kudus", impressions: 40 });
    const dates = get(ds, "gsc_dates");
    expect(dates.rowDated).toBe(true);
    expect(dates.rows.map((r) => r.date)).toEqual(["2026-09-01", "2026-09-02"]);
    expect(dates.rows[0]._date).toBe("2026-09-01");
    expect(metric(dates, "gsc_clicks")).toBe(98);
    expect(metric(dates, "gsc_position")).toBe(7.92);
  });

  it("device & negara diberi label seperti export GSC", async () => {
    const ds = await load();
    const dev = get(ds, "gsc_devices").breakdowns.filter((b) => b.metric === "clicks");
    expect(dev.map((b) => [b.label, b.value])).toEqual([["Mobile", 77], ["Desktop", 21]]);
    const ctry = get(ds, "gsc_countries").breakdowns.filter((b) => b.metric === "impressions");
    expect(ctry.map((b) => b.label)).toEqual(["Indonesia", "Malaysia", "XKX"]);
  });
});

describe("YouTube connector: mapping API → dataset", () => {
  const read = (p: string) => readFileSync(join(__dirname, "fixtures", p), "utf8");

  it("durasi ISO 8601 & tanggal publish WIB", async () => {
    const { isoDuration, wibDate } = await import("../lib/connectors/youtube/map");
    expect(isoDuration("PT5M41S")).toBe(341);
    expect(isoDuration("PT1H2M3S")).toBe(3723);
    expect(isoDuration("P1DT1S")).toBe(86401);
    expect(isoDuration("bukan")).toBeNull();
    expect(wibDate("2026-09-30T20:00:00Z")).toBe("2026-10-01"); // 03:00 WIB 1 Okt
  });

  it("CSV laporan Reach → impressions per video + CTR tertimbang", async () => {
    const { aggregateReach, parseReachCsv } = await import("../lib/connectors/youtube/map");
    const rows = parseReachCsv(read("youtube/reach.csv"));
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual({ date: "2026-09-09", videoId: "-qgU4zJuOpU", impressions: 1000, ctr: 0.05 });
    const agg = aggregateReach(rows);
    expect(agg.get("-qgU4zJuOpU")!.impressions).toBe(2874);
    expect(agg.get("-qgU4zJuOpU")!.ctr).toBeCloseTo((1000 * 0.05 + 1874 * 0.0636) / 2874, 6);
  });

  it("yt_table & yt_daily berbentuk sama dengan import YouTube Studio", async () => {
    const { aggregateReach, mapYoutubeMonth, parseReachCsv } = await import("../lib/connectors/youtube/map");
    const ds = mapYoutubeMonth(
      {
        videos: fixture("youtube/videos.json"),
        perVideo: fixture("youtube/per-video.json"),
        daily: fixture("youtube/daily.json"),
        reach: aggregateReach(parseReachCsv(read("youtube/reach.csv"))),
      },
      "2026-09",
      "API YouTube",
    );
    const table = get(ds, "yt_table");
    expect(table.rows).toHaveLength(3);
    expect(table.rows[0]).toMatchObject({ videoId: "-qgU4zJuOpU", publishedDate: "2026-09-09", durationSec: 341, views: 350, avgViewDurationSec: 128, impressions: 2874, subsGained: 1, likes: 21 });
    expect(table.rows[0].watchHours).toBeCloseTo(8.1457, 4);
    // video tanpa views tetap tercatat (dipublish bulan ini), impressions 0 karena tidak ada di laporan Reach
    expect(table.rows[2]).toMatchObject({ videoId: "NOVIEWS0000", views: 0, avgViewDurationSec: null, impressions: 0 });
    expect(metric(table, "views")).toBe(540);
    expect(metric(table, "impressions")).toBe(3629);
    expect(metric(table, "subsLost")).toBe(1);
    const daily = get(ds, "yt_daily");
    expect(daily.rowDated).toBe(true);
    expect(daily.rows.map((r) => r.date)).toEqual(["2026-09-09", "2026-09-10"]);
    expect(daily.rows[0].watchHours).toBeCloseTo(50.994 / 60, 6);
  });

  it("total kohort dari query agregat = baris Total YouTube Studio (avg view duration ≠ watch time ÷ views)", async () => {
    const { mapYoutubeMonth } = await import("../lib/connectors/youtube/map");
    const input = { videos: fixture("youtube/videos.json"), perVideo: fixture("youtube/per-video.json"), daily: { rows: [] }, reach: null } as never;
    const withTotals = get(mapYoutubeMonth({ ...(input as object), totals: fixture("youtube/totals.json") } as never, "2026-09", "API YouTube"), "yt_table");
    expect(metric(withTotals, "views")).toBe(732);
    expect(metric(withTotals, "watchHours")).toBeCloseTo(729 / 60, 6);
    expect(metric(withTotals, "avgViewDurationSec")).toBe(104);
    // per video tetap dari query per video
    expect(withTotals.rows[0]).toMatchObject({ videoId: "-qgU4zJuOpU", views: 350, avgViewDurationSec: 128 });
    // tanpa totals: fallback watch time ÷ views
    const without = get(mapYoutubeMonth(input, "2026-09", "API YouTube"), "yt_table");
    expect(metric(without, "avgViewDurationSec")).toBeCloseTo((metric(without, "watchHours")! * 3600) / metric(without, "views")!, 6);
  });

  it("unique viewers dari import sebelumnya: per video jika sama, total hanya jika daftar video persis sama", async () => {
    const { keepUniqueViewers, mapYoutubeMonth } = await import("../lib/connectors/youtube/map");
    const prev = [
      { videoId: "-qgU4zJuOpU", uniqueViewers: 180 },
      { videoId: "w6jFZhBhHpI", uniqueViewers: 60 },
      { videoId: "NOVIEWS0000", uniqueViewers: null },
    ];
    const ids = ["-qgU4zJuOpU", "w6jFZhBhHpI", "NOVIEWS0000"];
    expect(keepUniqueViewers(ids, prev, 256)).toEqual({ perVideo: new Map([["-qgU4zJuOpU", 180], ["w6jFZhBhHpI", 60]]), total: 256 });
    // ada video baru → total lama tidak berlaku lagi
    expect(keepUniqueViewers([...ids, "BARU0000000"], prev, 256).total).toBeNull();
    // video lama hilang → total juga tidak dipakai
    expect(keepUniqueViewers(ids.slice(0, 2), prev, 256)).toMatchObject({ total: null });
    expect(keepUniqueViewers(ids, [], null)).toEqual({ perVideo: new Map(), total: null });

    const table = get(
      mapYoutubeMonth(
        { videos: fixture("youtube/videos.json"), perVideo: fixture("youtube/per-video.json"), daily: { rows: [] }, reach: null, uniqueViewers: keepUniqueViewers(ids, prev, 256) },
        "2026-09",
        "API YouTube",
      ),
      "yt_table",
    );
    expect(table.rows.map((r) => r.uniqueViewers)).toEqual([180, 60, null]);
    expect(metric(table, "uniqueViewers")).toBe(256);
  });

  it("tanpa data Reach: impressions & CTR kosong (bukan 0)", async () => {
    const { mapYoutubeMonth } = await import("../lib/connectors/youtube/map");
    const ds = mapYoutubeMonth({ videos: fixture("youtube/videos.json"), perVideo: fixture("youtube/per-video.json"), daily: { rows: [] }, reach: null }, "2026-09", "API YouTube");
    const table = get(ds, "yt_table");
    expect(table.rows[0].impressions).toBeNull();
    expect(table.rows[0].ctr).toBeNull();
    expect(metric(table, "impressions")).toBeUndefined();
  });
});

describe("Meta connector: mapping Graph API → dataset", () => {
  /** Kolom model SocialPost yang diisi dari Dataset.rows (sama dengan parser CSV Meta). */
  const SOCIAL_POST_FIELDS = [
    "platform", "account", "postId", "date", "publishedAt", "format", "rawType", "caption", "permalink",
    "views", "reach", "likes", "comments", "shares", "saves", "follows", "interactions", "durationSec", "_date",
  ];
  const insightsMap = (path: string) => new Map(Object.entries(fixture<Record<string, unknown>>(path)).map(([id, res]) => [id, insightValuesOf(res)]));
  let insightValuesOf: (res: unknown) => Record<string, number>;
  beforeAll(async () => {
    const { insightValues } = await import("../lib/connectors/meta/map");
    insightValuesOf = (res) => insightValues(res as never);
  });

  it("wibDateTime: offset +0000 Graph API → WIB (bisa pindah tanggal/bulan)", async () => {
    const { wibDateTime } = await import("../lib/connectors/meta/map");
    expect(wibDateTime("2026-09-30T20:00:00+0000")).toEqual({ date: "2026-10-01", publishedAt: "2026-10-01 03:00" });
    expect(wibDateTime("2026-08-31T18:30:00+0000")).toEqual({ date: "2026-09-01", publishedAt: "2026-09-01 01:30" });
  });

  it("insightValues: bentuk values[0].value, total_value, dan breakdown objek", async () => {
    const { insightValues } = await import("../lib/connectors/meta/map");
    expect(insightValues(fixture("meta/ig-account.json"))).toEqual({ reach: 15800, views: 48200, total_interactions: 1390, accounts_engaged: 610 });
    expect(insightValues({ data: [{ name: "x", values: [{ value: { a: 2, b: 3 } }] }] })).toEqual({ x: 5 });
    expect(insightValues(undefined)).toEqual({});
  });

  it("insightValues: metrik muncul dua kali (lifetime + harian) → nilai lifetime yang dipakai", async () => {
    const { insightValues } = await import("../lib/connectors/meta/map");
    // bentuk respons asli Graph API v26.0 untuk post FB saat dua metrik diminta sekaligus
    const res = {
      data: [
        { name: "post_media_view", period: "lifetime", values: [{ value: 200 }] },
        { name: "post_total_media_view_unique", period: "lifetime", values: [{ value: 188 }] },
        { name: "post_total_media_view_unique", period: "day", values: [{ value: 0, end_time: "2026-10-16T07:00:00+0000" }, { value: 0, end_time: "2026-10-17T07:00:00+0000" }] },
      ],
    };
    expect(insightValues(res)).toEqual({ post_media_view: 200, post_total_media_view_unique: 188 });
    // urutan terbalik pun tetap lifetime
    expect(insightValues({ data: [res.data[2], res.data[1]] })).toEqual({ post_total_media_view_unique: 188 });
  });

  it("followBreakdown: follows_and_unfollows (breakdown follow_type) → follow & unfollow", async () => {
    const { followBreakdown } = await import("../lib/connectors/meta/map");
    // bentuk respons asli Graph API v26.0 (akun main_ke_kudus, 1–16 Sep 2026)
    const res = {
      data: [
        {
          name: "follows_and_unfollows",
          period: "day",
          total_value: { breakdowns: [{ dimension_keys: ["follow_type"], results: [{ dimension_values: ["FOLLOWER"], value: 314 }, { dimension_values: ["NON_FOLLOWER"], value: 11 }] }] },
        },
      ],
    };
    expect(followBreakdown(res)).toEqual({ follows: 314, unfollows: 11 });
    expect(followBreakdown({ data: [] })).toBeNull();
    expect(followBreakdown({ data: [{ name: "follows_and_unfollows", period: "day", total_value: {} }] })).toBeNull();
  });

  it("metrik insight IG per jenis media: REELS tanpa follows, tanpa metrik deprecated", async () => {
    const { igMetricsFor, igPostType } = await import("../lib/connectors/meta/map");
    const reel = { id: "1", timestamp: "", media_type: "VIDEO", media_product_type: "REELS" };
    const carousel = { id: "2", timestamp: "", media_type: "CAROUSEL_ALBUM", media_product_type: "FEED" };
    expect(igMetricsFor(reel)).toEqual(["reach", "views", "likes", "comments", "shares", "saved", "total_interactions"]);
    expect(igMetricsFor(carousel)).toContain("follows");
    for (const m of [...igMetricsFor(reel), ...igMetricsFor(carousel)]) expect(["impressions", "plays", "video_views"]).not.toContain(m);
    expect([igPostType(reel), igPostType(carousel), igPostType({ id: "3", timestamp: "", media_type: "IMAGE", media_product_type: "FEED" })]).toEqual(["IG reel", "IG carousel", "IG image"]);
  });

  it("Instagram: baris sama dengan import CSV, format & interaksi, filter bulan WIB, metrik akun", async () => {
    const { mapInstagram, insightValues } = await import("../lib/connectors/meta/map");
    const { applyMonth } = await import("../lib/parsers");
    const media = fixture<{ data: never[] }>("meta/ig-media.json").data;
    const ds = mapInstagram(media, insightsMap("meta/ig-insights.json"), "2026-09", "API Meta", insightValues(fixture("meta/ig-account.json")));
    expect(ds.key).toBe("meta_instagram");
    expect(DATASETS[ds.key].group).toBe("meta");
    expect(ds.rowDated).toBe(true);
    for (const r of ds.rows) expect(Object.keys(r).sort()).toEqual([...SOCIAL_POST_FIELDS].sort());

    const sep = applyMonth(ds, "2026-09").rows;
    // 30 Sep 20:00 UTC = 1 Okt WIB (dibuang); 31 Agu 18:30 UTC = 1 Sep WIB (masuk)
    expect(sep.map((r) => r.postId)).toEqual(["18000000000000002", "18000000000000003", "18000000000000004"]);
    expect(sep[0]).toMatchObject({ format: "carousel", rawType: "IG carousel", account: "main_ke_kudus", publishedAt: "2026-09-20 12:27", reach: 2500, views: 6100, saves: 95, follows: 6, interactions: 347 });
    // tanpa insight: likes/comments dari field media, shares/saves kosong
    expect(sep[1]).toMatchObject({ format: "feeds", likes: 88, comments: 4, shares: null, saves: null, reach: null, interactions: 92 });
    expect(sep[2]).toMatchObject({ format: "reels", date: "2026-09-01", follows: null, interactions: 505 + 30 + 120 + 80 });
    expect(ds.metrics.map((m) => [m.key, m.value])).toEqual([
      ["ig_account_reach", 15800],
      ["ig_account_views", 48200],
      ["ig_account_total_interactions", 1390],
      ["ig_account_accounts_engaged", 610],
    ]);
    expect(ds.metrics.every((m) => m.channel === "social")).toBe(true);
  });

  it("snapshotRows: metrik lifetime per post untuk tabel IgMediaSnapshot", async () => {
    const { snapshotRows } = await import("../lib/connectors/meta/map");
    const media = fixture<{ data: never[] }>("meta/ig-media.json").data;
    const rows = snapshotRows(media, insightsMap("meta/ig-insights.json"), "2026-10-19");
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.date === "2026-10-19")).toBe(true);
    expect(rows.find((r) => r.mediaId === "18000000000000002")).toEqual({
      date: "2026-10-19",
      mediaId: "18000000000000002",
      publishedDate: "2026-09-20",
      format: "carousel",
      views: 6100,
      reach: 2500,
      likes: 210,
      comments: 12,
      shares: 30,
      saves: 95,
      interactions: 347,
    });
    // tanggal publish WIB (30 Sep 20:00 UTC = 1 Okt WIB)
    expect(rows.find((r) => r.mediaId === "18000000000000001")?.publishedDate).toBe("2026-10-01");
  });

  it("Instagram: Stories & iklan tidak ikut", async () => {
    const { mapInstagram } = await import("../lib/connectors/meta/map");
    const ds = mapInstagram(
      [
        { id: "s", timestamp: "2026-09-02T01:00:00+0000", media_product_type: "STORY", media_type: "IMAGE" },
        { id: "a", timestamp: "2026-09-02T01:00:00+0000", media_product_type: "AD", media_type: "IMAGE" },
      ],
      new Map(),
      "2026-09",
      "API Meta",
    );
    expect(ds.rows).toHaveLength(0);
  });

  it("Facebook: format, reactions/comments/shares, views & reach dari post_media_view", async () => {
    const { mapFacebook } = await import("../lib/connectors/meta/map");
    const posts = fixture<{ data: never[] }>("meta/fb-posts.json").data;
    const ds = mapFacebook(posts, insightsMap("meta/fb-insights.json"), "2026-09", "API Meta", "mainkekudus");
    expect(ds.key).toBe("meta_facebook");
    for (const r of ds.rows) expect(Object.keys(r).sort()).toEqual([...SOCIAL_POST_FIELDS].sort());
    expect(ds.rows.map((r) => r.format)).toEqual(["reels", "photo", "text"]);
    expect(ds.rows[0]).toMatchObject({ platform: "facebook", account: "mainkekudus", publishedAt: "2026-09-25 16:00", views: 950, reach: 610, likes: 33, comments: 4, shares: 2, interactions: 39 });
    expect(ds.rows[2]).toMatchObject({ views: null, reach: null, shares: 0, interactions: 6 });
  });
});

describe("Meta connector: Graph API client & error", () => {
  const graphError = async (code: number, message: string, subcode?: number) => {
    const { GraphError } = await import("../lib/connectors/meta/errors");
    return new GraphError(message, code, subcode, 400);
  };

  it("versi Graph API di satu konstanta", async () => {
    const { GRAPH_VERSION } = await import("../lib/connectors/meta/graph");
    expect(GRAPH_VERSION).toBe("v26.0");
  });

  it("error diterjemahkan ke pesan yang bisa ditindaklanjuti", async () => {
    const { metaErrorMessage } = await import("../lib/connectors/meta/errors");
    expect(metaErrorMessage(await graphError(190, "Error validating access token: Session has expired", 463))).toMatch(/expired.*Generate a new token/);
    expect(metaErrorMessage(await graphError(190, "Invalid OAuth access token."))).toMatch(/META_ACCESS_TOKEN is invalid/);
    expect(metaErrorMessage(await graphError(10, "(#10) Application does not have permission for this action"), { pageId: "123" })).toMatch(/The Meta token lacks permissions for Page 123.*instagram_manage_insights.*assigned/);
    expect(metaErrorMessage(await graphError(200, "(#200) Requires pages_read_engagement permission"))).toMatch(/The Meta token lacks permissions/);
    expect(metaErrorMessage(await graphError(803, "(#803) Some of the aliases you requested do not exist: abc"), { pageId: "abc" })).toMatch(/ID Page abc wasn't found/);
    expect(metaErrorMessage(await graphError(100, "Unsupported get request. Object with ID '99' does not exist", 33), { igUserId: "99" })).toMatch(/IG account 99 wasn't found.*META_IG_USER_ID/);
    expect(metaErrorMessage(await graphError(4, "(#4) Application request limit reached"))).toMatch(/rate limit/);
    expect(metaErrorMessage(new TypeError("fetch failed"))).toMatch(/internet connection/);
  });

  it("retry hanya untuk rate limit / error sementara / 5xx / jaringan", async () => {
    const { GraphError, isRetryableMetaError } = await import("../lib/connectors/meta/errors");
    for (const code of [1, 2, 4, 17, 32, 341, 613, 80001]) expect(isRetryableMetaError(await graphError(code, "x"))).toBe(true);
    for (const code of [10, 100, 190, 200, 803]) expect(isRetryableMetaError(await graphError(code, "x"))).toBe(false);
    expect(isRetryableMetaError(new GraphError("x", 100, undefined, 400, true))).toBe(true);
    expect(isRetryableMetaError(new GraphError("Internal", undefined, undefined, 503))).toBe(true);
    expect(isRetryableMetaError(new TypeError("fetch failed"))).toBe(true);
  });

  describe("dengan fetch palsu (tanpa hit API)", () => {
    const calls: URL[] = [];
    const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    afterEach(() => {
      vi.unstubAllGlobals();
      calls.length = 0;
    });

    it("insights: metrik yang ditolak (kode 100) diminta satu per satu, sisanya tetap terambil", async () => {
      vi.stubGlobal("fetch", async (input: URL) => {
        calls.push(input);
        const metric = input.searchParams.get("metric");
        if (metric?.includes(",") || metric === "post_impressions_unique") {
          return respond({ error: { message: "(#100) The value must be a valid insights metric", type: "OAuthException", code: 100 } }, 400);
        }
        return respond({ data: [{ name: metric, period: "lifetime", values: [{ value: 7 }] }] });
      });
      const { graphInsights } = await import("../lib/connectors/meta/graph");
      const res = await graphInsights("1000_2001", "tok", ["post_media_view", "post_impressions_unique"]);
      expect(res).toEqual({ values: { post_media_view: 7 }, rejected: ["post_impressions_unique"] });
      expect(calls).toHaveLength(3);
      expect(calls[0].pathname).toBe("/v26.0/1000_2001/insights");
      expect(calls[0].searchParams.get("access_token")).toBe("tok");
    });

    it("insights: error izin tidak ditelan", async () => {
      vi.stubGlobal("fetch", async () => respond({ error: { message: "(#10) Application does not have permission", code: 10 } }, 403));
      const { graphInsights } = await import("../lib/connectors/meta/graph");
      await expect(graphInsights("1", "tok", ["reach", "views"])).rejects.toMatchObject({ name: "GraphError", code: 10 });
    });

    it("rangeChunks: bulan 30 hari = 1 potongan, 31 hari = 30 + 1 hari", async () => {
      const { rangeChunks } = await import("../lib/connectors/meta");
      const t = (d: string) => Date.parse(`${d}T00:00:00+07:00`) / 1000;
      expect(rangeChunks({ since: t("2026-09-01"), until: t("2026-10-01") })).toEqual([[t("2026-09-01"), t("2026-10-01")]]);
      expect(rangeChunks({ since: t("2026-08-01"), until: t("2026-09-01") })).toEqual([
        [t("2026-08-01"), t("2026-08-31")],
        [t("2026-08-31"), t("2026-09-01")],
      ]);
    });

    it("follows akun: bulan 31 hari dipecah jadi potongan ≤ 30 hari lalu dijumlah", async () => {
      const ranges: [number, number][] = [];
      vi.stubGlobal("fetch", async (input: URL) => {
        calls.push(input);
        ranges.push([Number(input.searchParams.get("since")), Number(input.searchParams.get("until"))]);
        const follows = ranges.length === 1 ? 500 : 20;
        return respond({ data: [{ name: "follows_and_unfollows", period: "day", total_value: { breakdowns: [{ dimension_keys: ["follow_type"], results: [{ dimension_values: ["FOLLOWER"], value: follows }, { dimension_values: ["NON_FOLLOWER"], value: 3 }] }] } }] });
      });
      const { igFollows } = await import("../lib/connectors/meta");
      const since = Date.parse("2026-07-01T00:00:00+07:00") / 1000;
      const until = Date.parse("2026-08-01T00:00:00+07:00") / 1000;
      const res = await igFollows("tok", "1784", { start: "2026-07-01", end: "2026-07-31", partial: false, since, until });
      expect(res).toEqual({ follows: 520, unfollows: 6 });
      expect(ranges).toEqual([[since, since + 30 * 86400], [since + 30 * 86400, until]]);
      for (const [a, b] of ranges) expect(b - a).toBeLessThanOrEqual(30 * 86400);
      expect(calls[0].searchParams.get("breakdown")).toBe("follow_type");
    });

    it("paginasi: ikuti paging.next, berhenti setelah halaman yang item terakhirnya sebelum awal bulan (post di-pin tidak menghentikan)", async () => {
      const pages: Record<string, unknown> = {
        // "pin" = post lama yang di-pin di urutan atas
        first: { data: [{ id: "pin", t: 2 }, { id: "a", t: 30 }, { id: "b", t: 20 }], paging: { next: "https://graph.facebook.com/v26.0/1784/media?after=X" } },
        second: { data: [{ id: "c", t: 15 }, { id: "d", t: 5 }, { id: "e", t: 1 }], paging: { next: "https://graph.facebook.com/v26.0/1784/media?after=Y" } },
      };
      vi.stubGlobal("fetch", async (input: URL) => {
        calls.push(input);
        return respond(input.searchParams.get("after") === "X" ? pages.second : pages.first);
      });
      const { graphPaginate } = await import("../lib/connectors/meta/graph");
      const items = await graphPaginate<{ id: string; t: number }>("/1784/media", "tok", { limit: 2 }, (m) => m.t < 10);
      expect(items.map((i) => i.id)).toEqual(["pin", "a", "b", "c", "d", "e"]);
      expect(calls).toHaveLength(2);
      expect(calls[1].searchParams.get("access_token")).toBe("tok");
    });
  });
});

describe("Sync cron", () => {
  it("slot terakhir tanggal 3 jam 07:00 WIB → sync bulan sebelumnya", async () => {
    const { cronSlot } = await import("../lib/connectors/cron");
    const at = (iso: string) => cronSlot(new Date(iso));
    expect(at("2026-10-16T03:00:00Z")).toEqual({ slot: new Date("2026-10-03T00:00:00Z"), month: "2026-09" });
    // 3 Okt 06:59 WIB → slot masih 3 Sep
    expect(at("2026-10-02T23:59:00Z")).toEqual({ slot: new Date("2026-09-03T00:00:00Z"), month: "2026-08" });
    expect(at("2026-10-03T00:00:00Z").month).toBe("2026-09");
    // awal Januari → slot 3 Des, sync November
    expect(at("2026-01-02T10:00:00Z")).toEqual({ slot: new Date("2025-12-03T00:00:00Z"), month: "2025-11" });
  });
});

describe("Google Sheets connector: cari Publishing Log per nama file + bulan", () => {
  // nama file asli di Google Drive (September 2026)
  const files = [
    { id: "news09", name: "MKK - News Content Logs - September 2026", modifiedTime: "2026-10-15T02:09:14Z" },
    { id: "soc09", name: "Socmed Content Logs - September 2026", modifiedTime: "2026-10-01T08:09:58Z" },
    { id: "yt09", name: "MKK Youtube Monthly Performance Report - September 2026", modifiedTime: "2026-10-02T00:00:00Z" },
    { id: "news08", name: "MKK - News Content Logs - Agustus 2026", modifiedTime: "2026-09-01T00:00:00Z" },
    { id: "newsrep09", name: "MKK News Monthly Performance Report - September 2026", modifiedTime: "2026-10-02T00:00:00Z" },
    { id: "copy", name: "Copy of Socmed Content Logs - September 2026", modifiedTime: "2026-10-18T00:00:00Z" },
  ];

  it("nama bulan Inggris, Indonesia, singkatan, dan angka", async () => {
    const { nameHasMonth } = await import("../lib/connectors/sheets/map");
    expect(nameHasMonth("MKK - News Content Logs - September 2026", "2026-09")).toBe(true);
    expect(nameHasMonth("Socmed Content Logs - Oktober 2026", "2026-10")).toBe(true);
    expect(nameHasMonth("Socmed Content Logs - October 2026", "2026-10")).toBe(true);
    expect(nameHasMonth("Socmed Content Logs - Sept 2026", "2026-09")).toBe(true);
    expect(nameHasMonth("Logs 202609", "2026-09")).toBe(true);
    expect(nameHasMonth("Logs 2026-09", "2026-09")).toBe(true);
    expect(nameHasMonth("MKK - News Content Logs - September 2025", "2026-09")).toBe(false);
    expect(nameHasMonth("MKK - News Content Logs - November 2026", "2026-09")).toBe(false);
  });

  it("pilih file per jenis log; performance report News tidak dipakai; salinan kalah dari asli", async () => {
    const { pickLogFile } = await import("../lib/connectors/sheets/map");
    expect(pickLogFile(files, "news", "2026-09").file?.id).toBe("news09");
    expect(pickLogFile(files, "news", "2026-08").file?.id).toBe("news08");
    const { pickTrackerFile } = await import("../lib/connectors/sheets/map");
    const trackers = [
      { id: "x", name: "Socmed Content Logs - September 2026" },
      { id: "tp", name: "MKK Kudus Social Media - Task Progress" },
      { id: "cal", name: "MKK Internal - Youtube Calendar Timeline" },
      { id: "rep", name: "MKK YouTube Monthly Performance Report – September 2026" },
    ];
    expect(pickTrackerFile(trackers, "social")?.id).toBe("tp");
    expect(pickTrackerFile(trackers, "youtube")?.id).toBe("cal");
    const social = pickLogFile(files, "social", "2026-09");
    expect(social.file?.id).toBe("soc09");
    expect(social.others.map((f) => f.id)).toEqual(["copy"]);
    expect(pickLogFile(files, "social", "2026-10").file).toBeNull();
  });
});
