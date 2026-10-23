import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { docxParagraphs, panduanDate, parseBriefName, parseBriefOutline, parsePanduan } from "../lib/team/parse";
import { matchItems } from "../lib/team/match";

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
