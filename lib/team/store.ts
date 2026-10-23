// Sinkronisasi dokumen tim dari Drive (panduan liputan → Story, brief → Brief) dan pencocokan antar tahap.
// Pencocokan diulang dari nol setiap kali, tapi keputusan tim (confirmed / rejected) tidak pernah ditimpa.
import type { drive_v3 } from "googleapis";
import { prisma } from "../db";
import { docxParagraphs, panduanDate, parseBriefName, parseBriefOutline, parsePanduan } from "./parse";
import { matchItems, type MatchItem } from "./match";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

interface DriveDoc {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

/** Semua .docx yang namanya diawali YYMM bulan ini (panduan & brief memakai prefiks tanggal yang sama). */
async function listMonthDocs(drive: drive_v3.Drive, month: string): Promise<DriveDoc[]> {
  const prefix = month.slice(2, 4) + month.slice(5, 7);
  const out: DriveDoc[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 20; i++) {
    const { data } = await drive.files.list({
      q: `name contains '${prefix}' and mimeType = '${DOCX}' and trashed = false`,
      fields: "nextPageToken, files(id,name,modifiedTime,webViewLink)",
      pageSize: 1000,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      pageToken,
    });
    for (const f of data.files ?? []) if (f.id && f.name?.startsWith(prefix)) out.push({ id: f.id, name: f.name.trim(), modifiedTime: f.modifiedTime ?? undefined, webViewLink: f.webViewLink ?? undefined });
    pageToken = data.nextPageToken ?? undefined;
    if (!pageToken) break;
  }
  return out;
}

async function download(drive: drive_v3.Drive, id: string): Promise<Uint8Array> {
  const res = await drive.files.get({ fileId: id, alt: "media" }, { responseType: "arraybuffer" });
  return new Uint8Array(res.data as ArrayBuffer);
}

export interface DocsSyncResult {
  panduan: number;
  stories: number;
  briefs: number;
  briefTypes: Record<string, number>;
  warnings: string[];
}

/** Tarik panduan & brief satu bulan dari Drive lalu ganti Story / Brief bulan itu. */
export async function syncTeamDocs(drive: drive_v3.Drive, month: string): Promise<DocsSyncResult> {
  const docs = await listMonthDocs(drive, month);
  const warnings: string[] = [];

  const panduan = docs.filter((d) => panduanDate(d.name)?.startsWith(month)).sort((a, b) => a.name.localeCompare(b.name));
  const stories: { code: string; date: string; month: string; n: number; title: string; angle: string | null; fileId: string; fileName: string }[] = [];
  for (const f of panduan) {
    const date = panduanDate(f.name)!;
    const planned = parsePanduan(docxParagraphs(await download(drive, f.id)));
    if (!planned.length) warnings.push(`${f.name}: no “Artikel N” heading found — skipped.`);
    for (const a of planned) {
      // file tambahan di hari yang sama (mis. "… - ARTIKEL 3") bisa memakai nomor yang sudah ada
      let code = `${date.slice(2).replaceAll("-", "")}-${a.n}`;
      while (stories.some((s) => s.code === code)) code += "b";
      stories.push({ code, date, month, n: a.n, title: a.title, angle: a.angle, fileId: f.id, fileName: f.name });
    }
  }

  const known = new Map((await prisma.brief.findMany({ where: { month }, select: { fileId: true, modifiedTime: true } })).map((b) => [b.fileId, b.modifiedTime]));
  const briefDocs = docs.map((d) => ({ d, meta: parseBriefName(d.name) })).filter((x) => x.meta?.date.startsWith(month));
  const briefs = [];
  for (const { d, meta } of briefDocs) {
    // isi brief hanya diunduh ulang jika file berubah sejak sync terakhir
    const unchanged = known.has(d.id) && known.get(d.id) === (d.modifiedTime ?? null);
    const parsed = unchanged ? null : parseBriefOutline(docxParagraphs(await download(drive, d.id)));
    briefs.push({ fileId: d.id, fileName: d.name, date: meta!.date, month, type: meta!.type, topic: meta!.topic, webViewLink: d.webViewLink ?? null, modifiedTime: d.modifiedTime ?? null, parsed });
  }

  await prisma.$transaction([
    prisma.story.deleteMany({ where: { month, code: { notIn: stories.map((s) => s.code) } } }),
    ...stories.map((s) => prisma.story.upsert({ where: { code: s.code }, create: s, update: s })),
    prisma.brief.deleteMany({ where: { month, fileId: { notIn: briefs.map((b) => b.fileId) } } }),
    ...briefs.map(({ parsed, ...b }) => {
      const content = parsed ? { headline: parsed.headline, outline: parsed.outline.join("\n") || null } : {};
      return prisma.brief.upsert({ where: { fileId: b.fileId }, create: { ...b, ...content }, update: { ...b, ...content } });
    }),
  ]);

  const briefTypes: Record<string, number> = {};
  for (const b of briefs) briefTypes[b.type] = (briefTypes[b.type] ?? 0) + 1;
  return { panduan: panduan.length, stories: stories.length, briefs: briefs.length, briefTypes, warnings };
}

// ── Pencocokan ──────────────────────────────────────────────────────────────

interface Target extends MatchItem {
  title: string;
  url: string | null;
}

/** Kunci stabil (baris log diganti tiap sync, jadi ID database tidak bisa dipakai). */
const articleKey = (a: { url: string | null; date: string | null; title: string }) => a.url?.trim() || `${a.date}|${a.title.trim()}`;
const socialKey = (s: { url: string | null; date: string | null; format: string; title: string | null }) => s.url?.trim() || `${s.date}|${s.format}|${(s.title ?? "").trim()}`;

/** Format post IG yang dihasilkan tiap jenis brief. */
const BRIEF_FORMATS: Record<string, string[]> = { carousel: ["feeds", "carousel"], reel: ["reels"] };

export interface MatchSummary {
  auto: number;
  suggested: number;
}

/** Hitung ulang semua pasangan auto / suggested. Keputusan tim (confirmed / rejected) dipertahankan. */
export async function rebuildMatches(): Promise<MatchSummary> {
  const [stories, briefs, articles, socials, decided] = await Promise.all([
    prisma.story.findMany({ select: { code: true, date: true, title: true, angle: true } }),
    prisma.brief.findMany({ select: { fileId: true, date: true, type: true, topic: true, headline: true } }),
    prisma.newsArticle.findMany({ where: { import: { source: "news_log" }, date: { not: null } }, select: { date: true, title: true, url: true } }),
    prisma.socialLog.findMany({ where: { platform: { contains: "instagram" }, date: { not: null } }, select: { date: true, format: true, title: true, url: true } }),
    prisma.teamMatch.findMany({ where: { status: { in: ["confirmed", "rejected"] } } }),
  ]);

  const articleTargets: Target[] = articles.map((a) => ({ key: articleKey(a), date: a.date!, text: a.title, title: a.title, url: a.url }));
  const socialTargets: Target[] = socials
    .filter((s) => s.title)
    .map((s) => ({ key: socialKey(s), date: s.date!, text: s.title!, title: s.title!, url: s.url, format: s.format }));

  const decisions = (fromType: string, toType: string) => {
    const d = decided.filter((m) => m.fromType === fromType && m.toType === toType);
    const ok = d.filter((m) => m.status === "confirmed");
    return {
      rejected: new Set(d.filter((m) => m.status === "rejected").map((m) => `${m.fromKey}→${m.toKey}`)),
      takenFrom: new Set(ok.map((m) => m.fromKey)),
      takenTo: new Set(ok.map((m) => m.toKey)),
    };
  };

  const runs = [
    {
      fromType: "story",
      toType: "article",
      targets: articleTargets,
      res: matchItems(
        stories.map((s) => ({ key: s.code, date: s.date, text: s.title, extra: s.angle })),
        articleTargets,
        { minDays: -1, maxDays: 45, ...decisions("story", "article") },
      ),
    },
    {
      fromType: "brief",
      toType: "social",
      targets: socialTargets,
      res: matchItems(
        briefs.map((b) => ({ key: b.fileId, date: b.date, text: [b.headline, b.topic].filter(Boolean).join(" "), format: b.type })),
        socialTargets,
        { minDays: -3, maxDays: 45, compatible: (f, t) => (BRIEF_FORMATS[f.format ?? ""] ?? []).includes(t.format ?? ""), ...decisions("brief", "social") },
      ),
    },
    {
      fromType: "brief",
      toType: "article",
      targets: articleTargets,
      // brief turunan biasanya dibuat setelah artikel tayang
      res: matchItems(
        briefs.map((b) => ({ key: b.fileId, date: b.date, text: [b.topic, b.headline].filter(Boolean).join(" ") })),
        articleTargets,
        { minDays: -90, maxDays: 7, ...decisions("brief", "article") },
      ),
    },
  ];

  const rows = runs.flatMap(({ fromType, toType, targets, res }) => {
    const byKey = new Map(targets.map((t) => [t.key, t]));
    return res.map((m) => {
      const t = byKey.get(m.toKey)!;
      return { fromType, fromKey: m.fromKey, toType, toKey: m.toKey, toTitle: t.title, toDate: t.date, toFormat: t.format ?? null, toUrl: t.url, score: m.score, status: m.status };
    });
  });

  await prisma.$transaction([prisma.teamMatch.deleteMany({ where: { status: { in: ["auto", "suggested"] } } }), prisma.teamMatch.createMany({ data: rows })]);
  return { auto: rows.filter((r) => r.status === "auto").length, suggested: rows.filter((r) => r.status === "suggested").length };
}

/** Keputusan tim atas satu pasangan. Konfirmasi menyingkirkan saran lain untuk item yang sama. */
export async function decideMatch(id: string, decision: "confirmed" | "rejected"): Promise<void> {
  const m = await prisma.teamMatch.update({ where: { id }, data: { status: decision } });
  if (decision === "confirmed") {
    await prisma.teamMatch.deleteMany({
      where: { id: { not: id }, status: { in: ["auto", "suggested"] }, toType: m.toType, fromType: m.fromType, OR: [{ fromKey: m.fromKey }, { toKey: m.toKey }] },
    });
  }
}
