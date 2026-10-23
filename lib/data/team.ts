// Data halaman tim (Stories & Briefs): Story / Brief per bulan + pasangannya (TeamMatch).
// "Matched" hanya confirmed / tracker / auto; suggested ditampilkan sebagai saran dan tidak pernah dihitung.
import { prisma } from "../db";
import { briefKey } from "../team/parse";

export type MatchState = "confirmed" | "tracker" | "auto" | "suggested";

export interface LinkView {
  id: string;
  state: MatchState;
  title: string;
  date: string | null;
  format: string | null;
  url: string | null;
}

/** Pasangan terpakai: confirmed/auto (satu), atau daftar saran jika belum ada. */
export interface Linked {
  match: LinkView | null;
  suggestions: LinkView[];
}

type MatchRow = Awaited<ReturnType<typeof prisma.teamMatch.findMany>>[number];

function linked(rows: MatchRow[]): Linked {
  const view = (m: MatchRow): LinkView => ({ id: m.id, state: m.status as MatchState, title: m.toTitle, date: m.toDate, format: m.toFormat, url: m.toUrl });
  const match = rows.find((m) => m.status === "confirmed") ?? rows.find((m) => m.status === "tracker") ?? rows.find((m) => m.status === "auto");
  return { match: match ? view(match) : null, suggestions: match ? [] : rows.filter((m) => m.status === "suggested").map(view) };
}

async function matchesFor(fromType: string, keys: string[]) {
  const rows = await prisma.teamMatch.findMany({ where: { fromType, fromKey: { in: keys }, status: { not: "rejected" } }, orderBy: { score: "desc" } });
  return (key: string, toType: string) => linked(rows.filter((m) => m.fromKey === key && m.toType === toType));
}

const dayDiff = (from: string, to: string | null) => (to ? Math.round((Date.parse(to) - Date.parse(from)) / 864e5) : null);

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export async function getStories(month: string) {
  const stories = await prisma.story.findMany({ where: { month }, orderBy: [{ date: "desc" }, { n: "asc" }] });
  const of = await matchesFor("story", stories.map((s) => s.code));
  return stories.map((s) => {
    const article = of(s.code, "article");
    return { ...s, article, lag: article.match ? dayDiff(s.date, article.match.date) : null };
  });
}

/** Kelompok status Task Progress (lihat tab Ref). */
export type TaskStage = "published" | "review" | "production" | "stopped";
const STAGE: Record<string, TaskStage> = {
  published: "published",
  submitted: "review",
  reviewing: "review",
  approved: "review",
  draft: "production",
  "in progress": "production",
  revision: "production",
  unpublished: "stopped",
  rejected: "stopped",
};
export const taskStage = (status: string | null): TaskStage | null => (status ? (STAGE[status] ?? null) : null);

/** Status gabungan satu brief — urutan: posted > needs confirmation > in review > belum. */
export type BriefState = "posted" | "check" | "review" | "waiting";

export async function getBriefs(month: string) {
  const [briefs, tasks] = await Promise.all([prisma.brief.findMany({ where: { month }, orderBy: [{ date: "desc" }, { fileName: "asc" }] }), prisma.briefTask.findMany()]);
  const of = await matchesFor("brief", briefs.map((b) => b.fileId));
  const taskByKey = new Map(tasks.map((t) => [t.briefKey, t]));
  // satu link IG dipakai beberapa brief di tracker = salah tempel; link-nya tidak ditampilkan sebagai bukti
  const linkUse = new Map<string, number>();
  for (const t of tasks) if (t.igUrl) linkUse.set(t.igUrl, (linkUse.get(t.igUrl) ?? 0) + 1);
  return briefs.map((b) => {
    const social = of(b.fileId, "social");
    const t = taskByKey.get(briefKey(b.fileName)) ?? null;
    const task = t && { ...t, stage: taskStage(t.status), linkShared: !!t.igUrl && (linkUse.get(t.igUrl) ?? 0) > 1 };
    const posted = !!social.match || task?.stage === "published";
    const state: BriefState = posted ? "posted" : social.suggestions.length ? "check" : task?.stage === "review" ? "review" : "waiting";
    const postedOn = social.match?.date ?? (task?.stage === "published" ? task.published : null);
    return { ...b, outlineLines: b.outline?.split("\n").filter(Boolean) ?? [], social, article: of(b.fileId, "article"), task, state, lag: postedOn ? dayDiff(b.date, postedOn) : null };
  });
}

/** Bulan yang punya Story atau Brief, terbaru dulu (untuk pilihan bulan). */
export async function teamMonths(): Promise<string[]> {
  const [s, b] = await Promise.all([prisma.story.findMany({ distinct: ["month"], select: { month: true } }), prisma.brief.findMany({ distinct: ["month"], select: { month: true } })]);
  return [...new Set([...s, ...b].map((x) => x.month))].sort().reverse();
}
