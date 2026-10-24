// Parser dokumen tim di Drive: panduan liputan harian (→ Story) dan brief turunan Content & Creative (→ Brief).
// Murni (tanpa I/O) supaya bisa dites; file .docx dibaca lewat docxParagraphs.
import { strFromU8, unzipSync } from "fflate";

/** Paragraf teks dari .docx (word/document.xml), sudah dirapikan spasi & entitasnya. */
export function docxParagraphs(data: Uint8Array): string[] {
  const xml = unzipSync(data, { filter: (f) => f.name === "word/document.xml" })["word/document.xml"];
  if (!xml) return [];
  return strFromU8(xml)
    .split(/<\/w:p>/)
    .map((p) =>
      p
        .replace(/<w:(tab|br)\/>/g, " ")
        .replace(/<[^>]+>/g, "")
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

/** "260922" → "2026-09-22" (null jika bukan tanggal valid). */
function yymmdd(s: string): string | null {
  const [y, m, d] = [s.slice(0, 2), s.slice(2, 4), s.slice(4, 6)].map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `20${String(y).padStart(2, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// ── Panduan liputan ─────────────────────────────────────────────────────────

const PANDUAN_NAME = /^(\d{6})_\s*PANDUAN LIPUTAN/i;

/** Tanggal panduan dari nama file "YYMMDD_PANDUAN LIPUTAN …" (null = bukan panduan harian). */
export function panduanDate(fileName: string): string | null {
  const m = fileName.match(PANDUAN_NAME);
  return m ? yymmdd(m[1]) : null;
}

export interface PlannedArticle {
  n: number;
  title: string;
  angle: string | null;
}

// "Artikel 1 — Judul", "Artikel 1: Judul", "ARTIKEL 1 | Judul", "Panduan Liputan Artikel 1" (judul di baris berikutnya)
const ARTICLE_HEAD = /^(?:panduan liputan\s+)?artikel\s*(\d+)\s*(?:[—–\-:|.]\s*(.*))?$/i;
// label sel tabel (format Juli) yang bukan judul
const LABEL = /^(judul( kerja)?|keterangan|detail|artikel \d+)\s*:?\s*$/i;
const stripJudul = (s: string) => s.replace(/^(usulan\s+)?judul( kerja)?\s*:\s*/i, "").replace(/^[“"]|[”"]$/g, "").trim();

/** Rencana artikel ("Artikel N") di satu panduan. Nomor yang muncul lagi di isi dokumen diabaikan. */
export function parsePanduan(paras: string[]): PlannedArticle[] {
  const out: PlannedArticle[] = [];
  const seen = new Set<number>();
  paras.forEach((p, i) => {
    const m = p.length < 200 ? p.match(ARTICLE_HEAD) : null;
    if (!m) return;
    const n = Number(m[1]);
    if (seen.has(n)) return;
    let title = stripJudul(m[2] ?? "");
    for (let k = i + 1; (!title || LABEL.test(title)) && k < Math.min(paras.length, i + 5); k++) title = stripJudul(paras[k]);
    if (!title || LABEL.test(title) || /^(angle|narasumber|pertanyaan)/i.test(title)) return;
    const a = paras.findIndex((q, j) => j > i && /^angle\b/i.test(q));
    const next = paras.findIndex((q, j) => j > i && ARTICLE_HEAD.test(q) && q.length < 200);
    const angle = a > 0 && (next < 0 || a < next) ? paras[a].replace(/^angle\s*:?\s*/i, "") || paras[a + 1] || null : null;
    seen.add(n);
    out.push({ n, title, angle: angle ? angle.slice(0, 500) : null });
  });
  return out;
}

// ── Brief turunan ───────────────────────────────────────────────────────────

const BRIEF_NAME = /^(\d{6})_\s*(.+?)(?:\.docx)?$/i;
const NAME_WORDS = /\b(?:revised|creative|brief|carousel|reels?|instagram|ig)\b/gi;

export interface BriefMeta {
  date: string;
  /** carousel | reel | jenis lain (huruf kecil) */
  type: string;
  /** bisa kosong untuk nama lama ("260704_Brief Carousel.docx") */
  topic: string;
}

/**
 * "261022_ Brief Carousel - Berlian Sports Centre.docx" → { date, type: "carousel", topic }. Nama ditulis bervariasi:
 * "CREATIVE BRIEF CAROUSEL IG - …", "BRIEF REEL- …", "Brief Reel-Ada Doa", "REVISED REEL BRIEF - …",
 * "Brief Carousel Persahabatan Atlet" (tanpa tanda hubung), "Brief Carousel.docx" (tanpa topik).
 */
export function parseBriefName(fileName: string): BriefMeta | null {
  const m = fileName.trim().match(BRIEF_NAME);
  const date = m ? yymmdd(m[1]) : null;
  if (!m || !date || !/\bbrief\b/i.test(m[2])) return null;
  // jenis di depan tanda hubung pertama, topik sesudahnya (topik sendiri boleh berisi tanda hubung)
  const d = m[2].match(/^(.*?)\s*[-–—]\s*(.+)$/);
  const head = d ? d[1] : m[2];
  const type = /carousel/i.test(head) ? "carousel" : /reel/i.test(head) ? "reel" : head.replace(NAME_WORDS, " ").trim().toLowerCase();
  if (!type) return null;
  const topic = d ? d[2] : m[2].replace(NAME_WORDS, " ");
  return { date, type, topic: topic.replace(/\s+/g, " ").trim() };
}

const SECTION_HEAD = /^(?:#+\s*)?(slide|scene)\s*(\d+)\s*(?:[|:—–-]\s*(.*))?$/i;
const JUDUL = /^judul(?:\s+(?:utama|slide))?\s*:\s*(.+)$/i;

/** Judul utama + outline per slide/scene ("S1 · Cover · Judul", "Scene 2 · Narasi …"). */
export function parseBriefOutline(paras: string[]): { headline: string | null; outline: string[] } {
  const firstJudul = paras.map((p) => p.match(JUDUL)?.[1]?.trim()).find(Boolean) ?? null;
  const outline: string[] = [];
  paras.forEach((p, i) => {
    const m = p.match(SECTION_HEAD);
    if (!m) return;
    const end = paras.findIndex((q, j) => j > i && SECTION_HEAD.test(q));
    const body = paras.slice(i + 1, end < 0 ? undefined : end);
    const judul = body.map((q) => q.match(JUDUL)?.[1]?.trim()).find(Boolean);
    const first = body.find((q) => !/^(narasi|visual|copy|text overlay|durasi|informasi grafis)\s*:?\s*$/i.test(q));
    const label = m[3]?.trim();
    const what = judul ?? first?.replace(/^(narasi|copy|text overlay)\s*:\s*/i, "") ?? "";
    outline.push([`${m[1][0].toUpperCase()}${m[2]}`, label, what.slice(0, 140)].filter(Boolean).join(" · "));
  });
  return { headline: firstJudul, outline };
}

/** Kunci nama file brief: huruf kecil, tanpa .docx, spasi di sekitar "_" / "-" diabaikan (tracker sering beda spasi). */
export function briefKey(fileName: string): string {
  return fileName
    .toLowerCase()
    .replace(/\.docx\s*$/, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([_-])\s*/g, "$1")
    .trim();
}

/** Isi kolom Instagram Link → URL post (tanpa query) atau catatan teks. */
export function trackerLink(raw: string | null): { url: string | null; note: string | null } {
  const s = raw?.trim() ?? "";
  if (!s) return { url: null, note: null };
  const m = s.match(/https?:\/\/(?:www\.)?instagram\.com\/[^\s?#]+/i);
  if (m) return { url: m[0].endsWith("/") ? m[0] : `${m[0]}/`, note: null };
  return { url: null, note: s };
}
