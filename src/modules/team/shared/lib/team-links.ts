import { isMonth } from "@/lib/month";
import { briefKey } from "@/lib/team/parse";
import type { BriefEntry, BriefRow, BriefState, BriefTaskEntry, Linked, LinkView, MatchState, StoryEntry, StoryRow, TaskStage, TeamMatchEntry } from "../types/team";

// "Matched" hanya confirmed / coded / tracker / auto; suggested ditampilkan sebagai saran dan tidak pernah dihitung.

/** Status yang dihitung sebagai tersambung, urut dari bukti terkuat. */
export const COUNTED = ["confirmed", "coded", "tracker", "auto"] as const;

export const dayDiff = (from: string, to: string | null) => (to ? Math.round((Date.parse(to) - Date.parse(from)) / 864e5) : null);

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

const view = (m: TeamMatchEntry): LinkView => ({
  id: m.id,
  key: m.toKey,
  state: m.status as MatchState,
  title: m.toTitle,
  date: m.toDate,
  format: m.toFormat,
  url: m.toUrl,
  decidedBy: m.decidedBy,
  decidedAt: m.decidedAt,
});

/** Pasangan satu item ke satu jenis target: bukti terkuat yang dihitung, atau saran jika belum ada. */
export function linked(rows: TeamMatchEntry[]): Linked {
  const match = COUNTED.map((st) => rows.find((m) => m.status === st)).find(Boolean);
  return { match: match ? view(match) : null, suggestions: match ? [] : rows.filter((m) => m.status === "suggested").map(view) };
}

/** (kunci asal, jenis target) → Linked dari baris pasangan yang sudah dimuat (urut skor). */
export const linksOf = (rows: TeamMatchEntry[]) => (key: string, toType: string) => linked(rows.filter((m) => m.fromKey === key && m.toType === toType));

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

export function buildStoryRows(stories: StoryEntry[], matches: TeamMatchEntry[]): StoryRow[] {
  const of = linksOf(matches);
  return stories.map((s) => {
    const article = of(s.code, "article");
    return { ...s, article, lag: article.match ? dayDiff(s.date, article.match.date) : null };
  });
}

/** Brief + pasangan + status Task Progress (disambung lewat briefKey nama file). */
export function buildBriefRows(briefs: BriefEntry[], tasks: BriefTaskEntry[], matches: TeamMatchEntry[]): BriefRow[] {
  const of = linksOf(matches);
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
    return { ...b, outlineLines: b.outline?.split("\n").filter(Boolean) ?? [], social, article: of(b.fileId, "article"), task, state, postedOn, lag: postedOn ? dayDiff(b.date, postedOn) : null };
  });
}

/** Bulan dari query string jika valid, selain itu kandidat pertama yang ada (bulan terbaru dengan data), atau bulan berjalan. */
export const pickTeamMonth = (param: string | undefined, candidates: (string | undefined)[], current: string): string =>
  isMonth(param) ? param : (candidates.find((m) => m != null) ?? current);
