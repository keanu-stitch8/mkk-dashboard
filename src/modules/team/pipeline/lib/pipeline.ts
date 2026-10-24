import type { BriefRow, StoryRow, TeamMatchEntry } from "../../shared/types/team";
import { dayDiff } from "../../shared/lib/team-links";
import type { BriefLite, Derivative, DerivKind, PipelineRow, PipelineStage } from "../types/pipeline";

// Content Pipeline: perjalanan tiap Story (rencana artikel di panduan liputan) sampai turunan Instagram.
// Hanya sambungan yang dihitung (confirmed / Story code / Task Progress / auto) yang membentuk tahap; saran tidak.

const BRIEF_KIND: Record<string, DerivKind> = { carousel: "feed", reel: "reel" };
export const SOCIAL_KIND: Record<string, DerivKind> = { feeds: "feed", carousel: "feed", reels: "reel", story: "story" };

/** Brief → ringkasan + turunan IG-nya (jika sudah tayang). */
export function briefLite(briefs: BriefRow[]): { lite: BriefLite; deriv: Derivative | null }[] {
  return briefs.map((b) => {
    const title = b.topic || b.task?.article || b.headline || b.fileName;
    const kind = BRIEF_KIND[b.type];
    const lite: BriefLite = { fileId: b.fileId, type: b.type, title, date: b.date, webViewLink: b.webViewLink, postedOn: b.postedOn };
    const deriv: Derivative | null = kind && b.postedOn ? { kind, date: b.postedOn, title: b.social.match?.title ?? title, via: "brief", teaser: false } : null;
    return { lite, deriv };
  });
}

/** Baris pipeline per Story. `now` = tanggal hari ini (WIB) untuk hari tertahan. */
export function buildPipelineRows(
  stories: StoryRow[],
  byArticle: Map<string, { briefs: BriefLite[]; derivs: Derivative[] }>,
  coded: TeamMatchEntry[],
  briefStory: TeamMatchEntry[],
  directBriefs: ReturnType<typeof briefLite>,
  now: string,
): PipelineRow[] {
  return stories.map((s) => {
    const art = s.article.match;
    const slot = art ? byArticle.get(art.key) : undefined;
    // brief lewat artikel + brief yang langsung cocok dengan rencana artikel (tanpa dobel)
    const briefs = [...(slot?.briefs ?? [])];
    for (const l of briefStory.filter((l) => l.toKey === s.code)) {
      const b = directBriefs.find((x) => x.lite.fileId === l.fromKey);
      if (b && !briefs.some((x) => x.fileId === b.lite.fileId)) briefs.push(b.lite);
    }
    const derivs: Derivative[] = [...(slot?.derivs ?? []), ...directBriefs.filter((b) => briefs.includes(b.lite) && b.deriv).map((b) => b.deriv!)];
    for (const c of art ? [] : coded.filter((c) => c.fromKey === s.code)) {
      const kind = SOCIAL_KIND[c.toFormat ?? ""];
      if (kind && c.toDate) derivs.push({ kind, date: c.toDate, title: c.toTitle, via: "code", teaser: !!art?.date && c.toDate < art.date });
    }
    derivs.sort((a, b) => a.date.localeCompare(b.date));
    const stage: PipelineStage = derivs.length ? "done" : briefs.length ? "brief" : art ? "article" : s.article.suggestions.length ? "check" : "missing";
    // hari tertahan sejak tahap terakhir yang selesai (panduan → artikel → brief)
    const last = [s.date, art?.date, ...briefs.map((b) => b.date)].filter((d): d is string => !!d).sort().at(-1)!;
    const firstAfter = derivs.find((d) => !d.teaser);
    return {
      ...s,
      briefs,
      derivs,
      stage,
      stuck: stage === "done" ? null : dayDiff(last, now),
      repurposeLag: art?.date && firstAfter ? dayDiff(art.date, firstAfter.date) : null,
    };
  });
}
