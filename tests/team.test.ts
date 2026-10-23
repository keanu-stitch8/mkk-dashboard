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
