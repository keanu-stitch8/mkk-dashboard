import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { briefKey, docxParagraphs, panduanDate, parseBriefName, parseBriefOutline, parsePanduan, trackerLink } from "../lib/team/parse";
import { matchItems, withTracker } from "../lib/team/match";
import { readTrackerTab } from "../lib/parsers/logs";

const docx = (paras: string[]) =>
  zipSync({ "word/document.xml": strToU8(`<w:document><w:body>${paras.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join("")}</w:body></w:document>`) });

describe("docx & nama file", () => {
  it("paragraf .docx + entitas", () => {
    expect(docxParagraphs(docx(["Artikel 1 &#x2014; Kopi &amp; Teh", "  ", "Angle: x"]))).toEqual(["Artikel 1 — Kopi & Teh", "Angle: x"]);
  });
  it("tanggal panduan & brief", () => {
    expect(panduanDate("260922_PANDUAN LIPUTAN WAWANCARA SHOTLIST.docx")).toBe("2026-09-22");
    expect(panduanDate("22 JUNI_PANDUAN WAWANCARA.docx")).toBeNull();
    expect(parseBriefName("261022_ Brief Carousel - Berlian Sports Centre.docx")).toEqual({ date: "2026-10-22", type: "carousel", topic: "Berlian Sports Centre" });
    expect(parseBriefName("261021_Brief Reel - Entok Rica-rica Mbak Ngatri.docx")?.type).toBe("reel");
    expect(parseBriefName("260715_Brief Carousel Instagram - Kopi.docx")?.type).toBe("carousel");
    expect(parseBriefName("260930_Brief Reels - Tari.docx")?.type).toBe("reel");
    expect(parseBriefName("Brief tanpa tanggal.docx")).toBeNull();
    // variasi nama lama
    expect(parseBriefName("260902_BRIEF CAROUSEL- Hydroplus Bupati Cup XX 2026.docx")).toEqual({ date: "2026-09-02", type: "carousel", topic: "Hydroplus Bupati Cup XX 2026" });
    expect(parseBriefName("260707_Brief Reel-Ada Doa.docx")).toMatchObject({ type: "reel", topic: "Ada Doa" });
    expect(parseBriefName("260702_CREATIVE BRIEF CAROUSEL IG - Markas Sport Center.docx")).toMatchObject({ type: "carousel", topic: "Markas Sport Center" });
    expect(parseBriefName("260828_REVISED REEL BRIEF - Batik Kudus.docx")).toMatchObject({ type: "reel", topic: "Batik Kudus" });
    expect(parseBriefName("260706_Brief Carousel Persahabatan Atlet.docx")).toMatchObject({ type: "carousel", topic: "Persahabatan Atlet" });
    expect(parseBriefName("260704_BRIEF REEL.docx")).toMatchObject({ type: "reel", topic: "" });
    expect(parseBriefName("261019_Brief Carousel - MLSC Kudus Seri 1 2026 - 2027.docx")?.topic).toBe("MLSC Kudus Seri 1 2026 - 2027");
    expect(parseBriefName("260922_PANDUAN LIPUTAN.docx")).toBeNull();
  });
});

describe("parsePanduan", () => {
  it("format Oktober: Artikel N — judul + angle per artikel", () => {
    const p = parsePanduan(["Panduan Liputan 22/09", "Artikel 1 — Pembinaan Tinju Kudus", "Angle: Menelisik pembinaan", "Pertanyaan inti", "Artikel 2 — Faisal Rizki, Emas 54 Kg", "Angle: Profil Faisal"]);
    expect(p).toEqual([
      { n: 1, title: "Pembinaan Tinju Kudus", angle: "Menelisik pembinaan" },
      { n: 2, title: "Faisal Rizki, Emas 54 Kg", angle: "Profil Faisal" },
    ]);
  });
  it("judul di baris berikutnya / sel tabel; nomor yang terulang di isi diabaikan; angle artikel lain tidak terbawa", () => {
    expect(parsePanduan(["Artikel 1 — Usulan judul: Kangen Masakan Rumah?"])[0].title).toBe("Kangen Masakan Rumah?");
    const p = parsePanduan(["ARTIKEL 1", "Judul", "Nasi Pindang", "Artikel 1", "Artikel 2: Ojek Muria", "Angle", "Ojek di lereng"]);
    expect(p).toEqual([
      { n: 1, title: "Nasi Pindang", angle: null },
      { n: 2, title: "Ojek Muria", angle: "Ojek di lereng" },
    ]);
  });
});

describe("parseBriefOutline", () => {
  it("carousel: judul utama + judul per slide", () => {
    const o = parseBriefOutline(["BRIEF CAROUSEL", "SLIDE 1 | COVER", "Judul Utama: 16 Negara Bertanding", "Copy: …", "SLIDE 2", "Judul Slide: Berebut Gelar", "Visual: x"]);
    expect(o.headline).toBe("16 Negara Bertanding");
    expect(o.outline).toEqual(["S1 · COVER · 16 Negara Bertanding", "S2 · Berebut Gelar"]);
  });
  it("reel: judul di atas, scene tanpa judul memakai baris pertama", () => {
    const o = parseBriefOutline(["BRIEF REEL", "Judul: Garang Asem Legendaris", "SCENE 1", "Narasi:", "Dibungkus daun pisang"]);
    expect(o).toEqual({ headline: "Garang Asem Legendaris", outline: ["S1 · Dibungkus daun pisang"] });
  });
});

describe("matchItems", () => {
  const opts = { minDays: -1, maxDays: 45 };
  it("auto hanya jika ≥2 kata langka sama; kata nama event saja → suggested", () => {
    const from = [
      { key: "a", date: "2026-09-01", text: "Berlian Sports Centre" },
      { key: "b", date: "2026-08-07", text: "GOR Djarum Menjadi Rumah Pembinaan Atlet Bulu Tangkis" },
    ];
    const to = [
      { key: "x", date: "2026-09-01", text: "Berlian Sports Centre Venue Berlatih Futsal Favorit" },
      { key: "y", date: "2026-08-12", text: "PB Djarum Melahirkan Legenda Bulu Tangkis Indonesia" },
      { key: "z1", date: "2026-08-12", text: "Djarum Bulu Tangkis Atlet" },
      { key: "z2", date: "2026-08-12", text: "Djarum Bulu Tangkis Legenda" },
      { key: "z3", date: "2026-08-12", text: "Djarum Bulu Tangkis Pembinaan" },
    ];
    const r = matchItems(from, to, opts);
    expect(r.find((m) => m.fromKey === "a")).toMatchObject({ toKey: "x", status: "auto" });
    expect(r.find((m) => m.fromKey === "b")?.status).toBe("suggested");
  });
  it("di luar jendela tanggal, ditolak, atau sudah terkonfirmasi → tidak dicocokkan", () => {
    const from = [{ key: "a", date: "2026-09-01", text: "Pecel Lung Siyem Desa Japan" }];
    const to = [{ key: "x", date: "2026-11-30", text: "Pecel Lung Siyem Desa Japan" }];
    expect(matchItems(from, to, opts)).toEqual([]);
    const near = [{ ...to[0], date: "2026-09-03" }];
    expect(matchItems(from, near, { ...opts, rejected: new Set(["a→x"]) })).toEqual([]);
    expect(matchItems(from, near, { ...opts, takenTo: new Set(["x"]) })).toEqual([]);
    expect(matchItems(from, near, opts)[0].status).toBe("auto");
  });
  it("dua kandidat auto yang sama kuat → ambigu, jadi suggested", () => {
    const from = [{ key: "a", date: "2026-10-12", text: "Hydroplus Bitingan Masters 2026" }];
    const to = [
      { key: "x", date: "2026-10-07", text: "Adu Talenta di Ajang Hydroplus Bitingan Masters 2026" },
      { key: "y", date: "2026-10-12", text: "Panggung Final Hydroplus Bitingan Masters 2026" },
    ];
    const r = matchItems(from, to, { minDays: -90, maxDays: 7 });
    expect(r).toHaveLength(1);
    expect(r[0].status).toBe("suggested");
  });
  it("teks tambahan (angle) hanya bisa jadi suggested; format harus cocok", () => {
    const from = [{ key: "a", date: "2026-10-01", text: "Kopi Muria", extra: "warisan kolonial kebun kopi lereng muria rahtawu", format: "carousel" }];
    const to = [{ key: "x", date: "2026-10-03", text: "Kebun Kopi Rahtawu di Lereng Muria", format: "feeds" }];
    expect(matchItems(from, to, opts)[0]?.status).toBe("suggested");
    expect(matchItems(from, to, { ...opts, compatible: (f, t) => f.format === "carousel" && t.format === "reels" })).toEqual([]);
  });
});

describe("Task Progress", () => {
  it("baris tracker: brief, editor, link, Planned Date diteruskan; baris berbrief tanpa status tetap ada", () => {
    const head = ["No.", "Planned Date", "Artikel", null, "Brief", "Published Date", "Status", "Assignee", "Google Drive Link", "Submitted Date", "Status", "Instagram Link"];
    const tab = readTrackerTab({
      file: "t.xlsx",
      sheet: "Oktober",
      blockCount: 1,
      comments: [],
      rows: [
        head,
        head,
        [9, 46300, "Akomodasi", "Carousel", "261005_Brief Carousel - Akomodasi.docx", null, "Reviewing", "Nana", null, "06 Okt 2026", "Submitted", " "],
        [10, null, null, "Reel", "261005_Brief Reel - UTMM 2026.docx", "08 Okt 2026", "Published", "Veno", "x.mov", "06 Okt 2026", "Submitted", "https://www.instagram.com/p/DeOhkaWlA-0/"],
        [11, 46301, null, "Carousel", null, null, null, null, null, null, null, null],
        [12, null, "Garang Asem", "Reel", "261022_Brief Reel - Garang Asem.docx", null, null, null, null, null, null, null],
      ],
    })!;
    expect(tab.rows).toHaveLength(3);
    expect(tab.rows[1]).toMatchObject({ format: "reels", status: "published", planned: "2026-10-05", brief: "261005_Brief Reel - UTMM 2026.docx", assignee: "Veno", published: "2026-10-08", link: "https://www.instagram.com/p/DeOhkaWlA-0/" });
    expect(tab.rows[2]).toMatchObject({ status: "", planned: "2026-10-06", assignee: null });
  });
  it("kunci nama brief & kolom link", () => {
    expect(briefKey("261022_ Brief Carousel - Berlian Sports Centre.docx")).toBe(briefKey("261022_Brief Carousel -  Berlian Sports Centre"));
    expect(trackerLink("https://www.instagram.com/reel/DegAgkGhGc7/?dlrf=MW")).toEqual({ url: "https://www.instagram.com/reel/DegAgkGhGc7/", note: null });
    expect(trackerLink("Unpublished by client")).toEqual({ url: null, note: "Unpublished by client" });
    expect(trackerLink("  ")).toEqual({ url: null, note: null });
  });

  const reel = (key: string, date: string, text: string) => ({ key, date, text, format: "reels" });
  const to = [reel("x", "2026-10-15", "Tanpa Pengalaman Tetap Bisa Main Tenis"), reel("y", "2026-10-15", "Teaser Gokil"), reel("z", "2026-10-08", "Jejak Pelari Trail Muria")];
  const from = [{ key: "a", date: "2026-10-06", text: "Sweet Swing Tennis", format: "reel" }];

  it("tracker + judul sepakat (±1 hari) → tracker; tanggal saja → tetap suggested", () => {
    const res = [{ fromKey: "a", toKey: "x", score: 2, status: "suggested" as const }];
    expect(withTracker(res, from, to, new Map([["a", { status: "published", published: "2026-10-16" }]]), {})).toEqual([{ ...res[0], status: "tracker" }]);
    // judul tidak menemukan apa-apa: post di tanggal itu jadi saran, bukan cocok
    const r = withTracker([], from, to, new Map([["a", { status: "published", published: "2026-10-15" }]]), {});
    expect(r.map((m) => [m.toKey, m.status])).toEqual([["x", "suggested"], ["y", "suggested"]]);
  });
  it("tracker bilang belum tayang tapi judul auto → bertentangan, jadi suggested", () => {
    const res = [{ fromKey: "a", toKey: "x", score: 104, status: "auto" as const }];
    expect(withTracker(res, from, to, new Map([["a", { status: "reviewing", published: null }]]), {})[0].status).toBe("suggested");
    // tanggal tracker jauh dari post hasil judul → juga diragukan
    const r = withTracker(res, from, to, new Map([["a", { status: "published", published: "2026-10-08" }]]), {});
    expect(r.map((m) => [m.toKey, m.status])).toEqual([["x", "suggested"], ["z", "suggested"]]);
    expect(withTracker(res, from, to, new Map(), {})[0].status).toBe("auto");
  });
});

describe("kolom Story & IG story", () => {
  it("kode Story dari sel log", async () => {
    const { parseStoryCode } = await import("../lib/parsers/logs");
    expect(parseStoryCode("261022-1")).toBe("261022-1");
    expect(parseStoryCode("Story 261022 - 2")).toBe("261022-2");
    expect(parseStoryCode("261022-1B")).toBe("261022-1b");
    expect(parseStoryCode("22 Okt")).toBeNull();
    expect(parseStoryCode(null)).toBeNull();
  });
  it("multiTo: beberapa IG story boleh ke satu artikel", () => {
    const from = [
      { key: "s1", date: "2026-10-20", text: "Peserta MLSC Kudus Seri 1 Bertambah" },
      { key: "s2", date: "2026-10-21", text: "Potret Sportivitas Final MLSC Kudus Seri 1" },
    ];
    const to = [{ key: "a", date: "2026-10-19", text: "Jumlah Peserta MLSC Kudus Seri 1 Bertambah, Potret Sportivitas Final" }];
    expect(matchItems(from, to, { minDays: -30, maxDays: 7 })).toHaveLength(1);
    expect(matchItems(from, to, { minDays: -30, maxDays: 7, multiTo: true }).map((m) => m.fromKey).sort()).toEqual(["s1", "s2"]);
  });
});

describe("Task Progress kontributor", () => {
  const head1 = ["No.", "Planned Date", "Artikel", "Brief", "Status", "Article", null, null, "Footage", null, null, null, null, null, null, null, null, null, null, null, null, null, null, null];
  const head2 = [null, null, null, null, null, "Assignee", "Link", "Submitted Date", "Landscape Photo", "Assignee", "Google Drive", "Submitted Date", "Portrait Photo", "Assignee", "Google Drive", "Submitted Date", "Portrait Video", "Assignee", "Google Drive", "Submitted Date", "Interview Video", "Assignee", "Google Drive", "Submitted Date"];
  const table = {
    file: "c.xlsx",
    sheet: "September",
    blockCount: 1,
    comments: [],
    rows: [
      head1,
      head2,
      [1, 46266, "POP Kids Climbing Club Kudus", "260901_PANDUAN LIPUTAN WAWANCARA SHOTLIST.docx", null, null, null, null, "Not Available", null, null, null, "-", null, null, null, "Available", "YSR", "x", "22 Sept 2026", "Available", "YSR", "y", "22 Sept 2026"],
      [2, null, "Venue Wall Climbing", null, "Submitted", "FZ", "z", 46273, "Available", "YSR", "a", 46280, null, null, null, null, "Available", "YSR", "b", 46280, "Not Available", null, null, null],
      [3, 46267, null, null, null, null, null, null, "-", null, null, null, "-", null, null, null, "-", null, null, null, "-", null, null, null],
    ],
  };
  it("baris, aset, Planned Date & file panduan diteruskan", async () => {
    const { readContributorTab, assetSummary } = await import("../lib/team/contributors");
    const tab = readContributorTab(table)!;
    expect(tab.tab).toBe("2026-09");
    expect(tab.rows).toHaveLength(2);
    const [a, b] = tab.rows;
    expect(a).toMatchObject({ planned: "2026-09-01", n: 1, title: "POP Kids Climbing Club Kudus", status: null });
    expect(a.assets.landscape.state).toBe("missing");
    expect(a.assets.portrait.state).toBeNull();
    expect(a.assets.video).toEqual({ state: "available", by: "YSR", at: "2026-09-22" });
    expect(b).toMatchObject({ planned: "2026-09-01", n: 2, guideFile: "260901_PANDUAN LIPUTAN WAWANCARA SHOTLIST.docx", status: "submitted", articleBy: "FZ", articleAt: "2026-09-08" });
    // lengkap = foto + video portrait + wawancara
    expect(assetSummary(a.assets)).toMatchObject({ complete: false, reelReady: true, lastAsset: "2026-09-22" });
    expect(assetSummary(b.assets)).toMatchObject({ complete: false, reelReady: true });
  });
  it("alias kontributor & sambungan ke panduan hanya lewat judul", async () => {
    const { readContributorNames, readContributorTab } = await import("../lib/team/contributors");
    const { linkContributorStory } = await import("../lib/team/store");
    expect(readContributorNames({ file: "c", sheet: "Ref", blockCount: 1, comments: [], rows: [["Journalist", "Journalist Alias", "Status"], ["Yasril Faza Aftoni", "YSR", "Draft"]] })?.get("YSR")).toBe("Yasril Faza Aftoni");
    const [a, b] = readContributorTab(table)!.rows;
    const stories = [
      { code: "260901-1", date: "2026-09-01", title: "POP Kids Climbing Club Kudus, Wadah Atlet Cilik" },
      { code: "260901-2", date: "2026-09-01", title: "Pembinaan Panjat Tebing" },
    ];
    expect(linkContributorStory(a, stories)).toBe("260901-1");
    // judul tidak cocok → tidak ditebak dari urutan baris
    expect(linkContributorStory(b, stories)).toBeNull();
  });
});

describe("Team Scorecard", () => {
  it("target naik / turun", async () => {
    const { onTarget, SCORE_DEFS } = await import("../lib/data/scorecard");
    const repurpose = SCORE_DEFS.find((d) => d.key === "repurpose")!;
    const backlog = SCORE_DEFS.find((d) => d.key === "backlog")!;
    expect(onTarget(repurpose, 80)).toBe(true);
    expect(onTarget(repurpose, 41.7)).toBe(false);
    expect(onTarget(backlog, 3)).toBe(true);
    expect(onTarget(backlog, 12)).toBe(false);
    expect(onTarget(backlog, null)).toBeNull();
  });
});

describe("login tim", () => {
  const env = { ...process.env };
  const setEnv = (pw: string | undefined) => {
    process.env.DASHBOARD_PASSWORD = pw;
    process.env.SESSION_SECRET = "test-secret";
  };
  it("token sah, dipalsukan, kedaluwarsa, password diganti", async () => {
    const auth = await import("../lib/auth");
    setEnv("rahasia-tim");
    const t = auth.createSessionToken("Indah", 1_000);
    expect(auth.readSession(t, 2_000)).toEqual({ name: "Indah" });
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), name: "Admin" })).toString("base64url");
    expect(auth.readSession(`${forged}.${sig}`, 2_000)).toBeNull();
    expect(auth.readSession(t, 1_000 + 31 * 864e5)).toBeNull();
    setEnv("password-baru");
    expect(auth.readSession(t, 2_000)).toBeNull();
    expect(auth.checkPassword("password-baru")).toBe(true);
    expect(auth.checkPassword("rahasia-tim")).toBe(false);
    process.env = env;
  });
  it("tujuan setelah login hanya path internal; batas percobaan", async () => {
    const auth = await import("../lib/auth");
    expect(auth.safeNext("/team/briefs?m=2026-10")).toBe("/team/briefs?m=2026-10");
    expect(auth.safeNext("//evil.example")).toBe("/");
    expect(auth.safeNext("https://evil.example")).toBe("/");
    expect(auth.safeNext("/login?next=/x")).toBe("/");
    expect(auth.cleanName("  Indah   Permata ")).toBe("Indah Permata");
    for (let i = 0; i < 10; i++) auth.recordFailedLogin("1.2.3.4", 0);
    expect(auth.loginAllowed("1.2.3.4", 1_000)).toBe(false);
    expect(auth.loginAllowed("1.2.3.4", 16 * 60_000)).toBe(true);
  });
  it("tanpa password: terbuka di dev, tertutup di produksi", async () => {
    const auth = await import("../lib/auth");
    setEnv(undefined);
    expect(auth.authConfigured()).toBe(false);
    expect(auth.readSession("x.y")).toBeNull();
    expect(auth.authRequired()).toBe(process.env.NODE_ENV === "production");
    process.env = env;
  });
});
