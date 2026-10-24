// Sinkronisasi dokumen tim dari Drive (panduan liputan → Story, brief → Brief) dan pencocokan antar tahap.
// Pencocokan diulang dari nol setiap kali, tapi keputusan tim (confirmed / rejected) tidak pernah ditimpa.
import type { drive_v3 } from "googleapis";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { readTables } from "../parsers/tabular";
import { readTrackerTab } from "../parsers/logs";
import { pickTrackerFile } from "../connectors/sheets/map";
import { briefKey, docxParagraphs, panduanDate, parseBriefName, parseBriefOutline, parsePanduan, trackerLink } from "./parse";
import { GENERATED_MATCH_STATUSES, matchItems, tokens, withTracker, type MatchItem, type TrackedResult, type TrackerHint } from "./match";
import { readContributorNames, readContributorTab, rowGuideDate, type ContributorRow } from "./contributors";

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

// ── Task Progress (tracker editor) ──────────────────────────────────────────

const SHEET = "application/vnd.google-apps.spreadsheet";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export interface TrackerSyncResult {
  file: string | null;
  rows: number;
  /** baris tracker yang file brief-nya tidak ditemukan di brief yang sudah di-sync */
  unknown: string[];
  warnings: string[];
}

/** Baca "Social Media - Task Progress" (semua tab bulan) lalu ganti seluruh BriefTask. */
export async function syncBriefTracker(drive: drive_v3.Drive): Promise<TrackerSyncResult> {
  const { data } = await drive.files.list({
    q: `name contains 'Task Progress' and mimeType = '${SHEET}' and trashed = false`,
    fields: "files(id,name,modifiedTime)",
    pageSize: 100,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });
  const file = pickTrackerFile(
    (data.files ?? []).flatMap((f) => (f.id && f.name ? [{ id: f.id, name: f.name.trim(), modifiedTime: f.modifiedTime ?? undefined }] : [])),
    "social",
  );
  if (!file) return { file: null, rows: 0, unknown: [], warnings: ["“Social Media - Task Progress” not found in Google Drive — editor status wasn't updated."] };

  const res = await drive.files.export({ fileId: file.id, mimeType: XLSX }, { responseType: "arraybuffer" });
  const tabs = readTables({ name: `${file.name}.xlsx`, data: new Uint8Array(res.data as ArrayBuffer) }).tables.flatMap((t) => readTrackerTab(t) ?? []);
  const tasks = new Map<string, Prisma.BriefTaskCreateManyInput>();
  const warnings: string[] = [];
  for (const tab of tabs) {
    for (const r of tab.rows) {
      if (!r.brief) continue;
      const key = briefKey(r.brief);
      if (tasks.has(key)) warnings.push(`Task Progress: “${r.brief}” appears more than once — using the first row.`);
      else
        tasks.set(key, {
          briefKey: key,
          briefName: r.brief,
          tab: tab.tabMonth,
          planned: r.planned,
          article: r.title,
          format: r.format,
          status: r.status || null,
          assignee: r.assignee,
          submitted: r.submitted,
          published: r.published,
          ...(({ url, note }) => ({ igUrl: url, note }))(trackerLink(r.link)),
        });
    }
  }
  await prisma.$transaction([prisma.briefTask.deleteMany(), prisma.briefTask.createMany({ data: [...tasks.values()] })]);

  const known = new Set((await prisma.brief.findMany({ select: { fileName: true } })).map((b) => briefKey(b.fileName)));
  const unknown = [...tasks.values()].filter((t) => !known.has(t.briefKey)).map((t) => t.briefName);
  return { file: file.name, rows: tasks.size, unknown, warnings };
}

// ── Task Progress kontributor lokal ────────────────────────────────────────

/**
 * Rencana artikel di panduan hari yang sama dengan judul paling mirip. Hanya jika jelas: ≥2 kata sama, ≥50% judul
 * yang lebih pendek, dan tidak ada kandidat lain yang sama kuat. Urutan baris di sheet tidak dipakai sebagai bukti.
 */
export function linkContributorStory(row: ContributorRow, stories: { code: string; date: string; title: string }[]): string | null {
  const day = rowGuideDate(row);
  const A = tokens(row.title);
  const scored = stories
    .filter((s) => s.date === day)
    .map((s) => {
      const B = tokens(s.title);
      const common = [...A].filter((w) => B.has(w)).length;
      return { code: s.code, common, sim: common / Math.max(1, Math.min(A.size, B.size)) };
    })
    .filter((x) => x.common >= 2 && x.sim >= 0.5)
    .sort((a, b) => b.common + b.sim - (a.common + a.sim));
  if (!scored.length || (scored[1] && scored[0].common + scored[0].sim - (scored[1].common + scored[1].sim) < 1)) return null;
  return scored[0].code;
}

export interface ContributorSyncResult {
  file: string | null;
  tabs: string[];
  rows: number;
  linked: number;
  warnings: string[];
}

/** Baca "Local Contributor - Task Progress" (semua tab) lalu ganti seluruh ContributorTask + alias kontributor. */
export async function syncContributors(drive: drive_v3.Drive): Promise<ContributorSyncResult> {
  const { data } = await drive.files.list({
    q: `name contains 'Task Progress' and mimeType = '${SHEET}' and trashed = false`,
    fields: "files(id,name,modifiedTime)",
    pageSize: 100,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });
  const file = pickTrackerFile(
    (data.files ?? []).flatMap((f) => (f.id && f.name ? [{ id: f.id, name: f.name.trim(), modifiedTime: f.modifiedTime ?? undefined }] : [])),
    "contributor",
  );
  if (!file) return { file: null, tabs: [], rows: 0, linked: 0, warnings: ["“Local Contributor - Task Progress” not found in Google Drive — contributor assets weren't updated."] };

  const res = await drive.files.export({ fileId: file.id, mimeType: XLSX }, { responseType: "arraybuffer" });
  const tables = readTables({ name: `${file.name}.xlsx`, data: new Uint8Array(res.data as ArrayBuffer) }).tables;
  const tabs = tables.flatMap((t) => readContributorTab(t) ?? []);
  const names = tables.map(readContributorNames).find((x) => !!x) ?? new Map<string, string>();
  const stories = await prisma.story.findMany({ select: { code: true, date: true, title: true } });

  const rows = tabs.flatMap(({ tab, rows }) =>
    rows.map((r) => ({
      id: `${tab}#${r.no}`,
      tab,
      no: r.no,
      planned: r.planned,
      guideFile: r.guideFile,
      n: r.n,
      title: r.title,
      status: r.status,
      articleBy: r.articleBy,
      articleAt: r.articleAt,
      ...Object.fromEntries(Object.entries(r.assets).flatMap(([k, a]) => [[k, a.state], [`${k}By`, a.by], [`${k}At`, a.at]])),
      storyCode: linkContributorStory(r, stories),
    })),
  ) as Prisma.ContributorTaskCreateManyInput[];
  const ids = new Set<string>();
  const unique = rows.filter((r) => !ids.has(r.id) && ids.add(r.id));

  await prisma.$transaction([
    prisma.contributorTask.deleteMany(),
    prisma.contributorTask.createMany({ data: unique }),
    prisma.contributor.deleteMany(),
    prisma.contributor.createMany({ data: [...names].map(([alias, name]) => ({ alias, name })) }),
  ]);
  const empty = tabs.filter((t) => !t.rows.length).map((t) => t.tab);
  return {
    file: file.name,
    tabs: tabs.filter((t) => t.rows.length).map((t) => t.tab),
    rows: unique.length,
    linked: unique.filter((r) => r.storyCode).length,
    warnings: empty.length ? [`Local Contributor - Task Progress: no stories filled in yet for ${empty.join(", ")}.`] : [],
  };
}

// ── Pencocokan ──────────────────────────────────────────────────────────────

interface Target extends MatchItem {
  title: string;
  url: string | null;
}

/** Kunci stabil (baris log diganti tiap sync, jadi ID database tidak bisa dipakai). */
export const articleKey = (a: { url: string | null; date: string | null; title: string }) => a.url?.trim() || `${a.date}|${a.title.trim()}`;
export const socialKey = (s: { url: string | null; date: string | null; format: string; title: string | null }) => s.url?.trim() || `${s.date}|${s.format}|${(s.title ?? "").trim()}`;

/** Format post IG yang dihasilkan tiap jenis brief. */
const BRIEF_FORMATS: Record<string, string[]> = { carousel: ["feeds", "carousel"], reel: ["reels"] };

export interface MatchSummary {
  coded: number;
  auto: number;
  tracker: number;
  suggested: number;
}

/** Status yang dibuat mesin (dihapus & dihitung ulang tiap rebuild); confirmed / rejected adalah keputusan tim. */

type CodedResult = { fromKey: string; toKey: string; score: number; status: "coded" };

/** Hitung ulang semua pasangan auto / tracker / suggested. Keputusan tim (confirmed / rejected) dipertahankan. */
export async function rebuildMatches(): Promise<MatchSummary> {
  const [stories, briefs, articles, socials, decided, tasks] = await Promise.all([
    prisma.story.findMany({ select: { code: true, date: true, title: true, angle: true } }),
    prisma.brief.findMany({ select: { fileId: true, fileName: true, date: true, type: true, topic: true, headline: true } }),
    prisma.newsArticle.findMany({ where: { import: { source: "news_log" }, date: { not: null } }, select: { date: true, title: true, url: true, status: true, story: true } }),
    prisma.socialLog.findMany({ where: { platform: { contains: "instagram" }, date: { not: null } }, select: { date: true, format: true, title: true, url: true, story: true } }),
    prisma.teamMatch.findMany({ where: { status: { in: ["confirmed", "rejected"] } } }),
    prisma.briefTask.findMany({ select: { briefKey: true, status: true, published: true } }),
  ]);
  const taskByKey = new Map(tasks.map((t) => [t.briefKey, t]));
  const hints = new Map<string, TrackerHint>(
    briefs.flatMap((b) => {
      const t = taskByKey.get(briefKey(b.fileName));
      return t ? [[b.fileId, { status: t.status, published: t.published }] as const] : [];
    }),
  );

  // satu artikel bisa muncul dua kali (baris "in review" bulan submit + baris publish) → satu target, versi publish
  const articleByKey = new Map<string, (typeof articles)[number]>();
  for (const a of articles) {
    const k = articleKey(a);
    if (!articleByKey.has(k) || a.status === "publish") articleByKey.set(k, a);
  }
  const articleTargets: Target[] = [...articleByKey].map(([key, a]) => ({ key, date: a.date!, text: a.title, title: a.title, url: a.url }));
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

  const briefFrom = briefs.map((b) => ({ key: b.fileId, date: b.date, text: [b.headline, b.topic].filter(Boolean).join(" "), format: b.type }));
  const briefSocialOpts = {
    minDays: -3,
    maxDays: 45,
    compatible: (f: MatchItem, t: MatchItem) => (BRIEF_FORMATS[f.format ?? ""] ?? []).includes(t.format ?? ""),
    ...decisions("brief", "social"),
  };

  // kolom Story di log = sambungan pasti (ditulis tim); judul tidak perlu dicocokkan lagi
  const codes = new Set(stories.map((s) => s.code));
  const codedArticles = articleTargets.flatMap((t) => {
    const story = articleByKey.get(t.key)!.story;
    return story && codes.has(story) ? [{ fromKey: story, toKey: t.key, score: 0, status: "coded" as const }] : [];
  });
  const socialAll: Target[] = socials.map((s) => ({ key: socialKey(s), date: s.date!, text: s.title ?? "", title: s.title ?? `(${s.format})`, url: s.url, format: s.format }));
  const codedSocial = socials.flatMap((s) => (s.story && codes.has(s.story) ? [{ fromKey: s.story, toKey: socialKey(s), score: 0, status: "coded" as const }] : []));
  const storyArticle = decisions("story", "article");
  for (const c of codedArticles) {
    storyArticle.takenFrom.add(c.fromKey);
    storyArticle.takenTo.add(c.toKey);
  }

  const storyTargets: Target[] = stories.map((s) => ({ key: s.code, date: s.date, text: s.title, title: s.title, url: null }));

  const runs: { fromType: string; toType: string; targets: Target[]; res: (TrackedResult | CodedResult)[] }[] = [
    {
      fromType: "story",
      toType: "article",
      targets: articleTargets,
      res: [...codedArticles, ...matchItems(stories.map((s) => ({ key: s.code, date: s.date, text: s.title, extra: s.angle })), articleTargets, { minDays: -1, maxDays: 45, ...storyArticle })],
    },
    { fromType: "story", toType: "social", targets: socialAll, res: codedSocial },
    {
      // brief langsung ke rencana artikel di panduan (berguna saat artikelnya belum tersambung)
      fromType: "brief",
      toType: "story",
      targets: storyTargets,
      res: matchItems(briefFrom, storyTargets, { minDays: -90, maxDays: 7, ...decisions("brief", "story") }),
    },
    {
      // IG story yang mengarah ke artikel: teaser sampai 7 hari sebelum artikel, atau sampai 30 hari sesudahnya.
      // Satu artikel boleh punya beberapa story; satu story hanya ke satu artikel.
      fromType: "igstory",
      toType: "article",
      targets: articleTargets,
      res: matchItems(
        socialTargets.filter((t) => t.format === "story"),
        articleTargets,
        { minDays: -30, maxDays: 7, multiTo: true, ...decisions("igstory", "article") },
      ),
    },
    {
      fromType: "brief",
      toType: "social",
      targets: socialTargets,
      res: withTracker(matchItems(briefFrom, socialTargets, briefSocialOpts), briefFrom, socialTargets, hints, briefSocialOpts),
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

  await prisma.$transaction([prisma.teamMatch.deleteMany({ where: { status: { in: GENERATED_MATCH_STATUSES } } }), prisma.teamMatch.createMany({ data: rows })]);
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  return { coded: count("coded"), auto: count("auto"), tracker: count("tracker"), suggested: count("suggested") };
}
