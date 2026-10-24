// Content Pipeline: perjalanan tiap Story (rencana artikel di panduan liputan) sampai turunan Instagram.
// Hanya sambungan yang dihitung (confirmed / Story code / Task Progress / auto) yang membentuk tahap; saran tidak.
import { prisma } from "../db";
import { socialKey } from "../team/store";
import { COUNTED, dayDiff, getStories, loadBriefs } from "./team";

export type DerivKind = "feed" | "reel" | "story";

export interface Derivative {
  kind: DerivKind;
  date: string;
  title: string;
  /** asal sambungan: lewat brief, IG story yang judulnya cocok dengan artikel, atau kolom Story di log */
  via: "brief" | "match" | "code";
  /** IG story yang tayang sebelum artikel */
  teaser: boolean;
}

export interface BriefLite {
  fileId: string;
  type: string;
  title: string;
  date: string;
  webViewLink: string | null;
  postedOn: string | null;
}

const BRIEF_KIND: Record<string, DerivKind> = { carousel: "feed", reel: "reel" };

/** Brief → ringkasan + turunan IG-nya (jika sudah tayang). */
function briefLite(briefs: Awaited<ReturnType<typeof loadBriefs>>) {
  return briefs.map((b) => {
    const title = b.topic || b.task?.article || b.headline || b.fileName;
    const kind = BRIEF_KIND[b.type];
    const lite: BriefLite = { fileId: b.fileId, type: b.type, title, date: b.date, webViewLink: b.webViewLink, postedOn: b.postedOn };
    const deriv: Derivative | null = kind && b.postedOn ? { kind, date: b.postedOn, title: b.social.match?.title ?? title, via: "brief", teaser: false } : null;
    return { lite, deriv };
  });
}
const SOCIAL_KIND: Record<string, DerivKind> = { feeds: "feed", carousel: "feed", reels: "reel", story: "story" };

/**
 * Brief & turunan IG per artikel (kunci artikel dari TeamMatch). Dipakai halaman pipeline dan Team Scorecard.
 * `articleDates` dipakai untuk menandai teaser (IG story sebelum artikel tayang).
 */
export async function derivativesByArticle(articleDates: Map<string, string>) {
  const keys = [...articleDates.keys()];
  const links = await prisma.teamMatch.findMany({
    where: { toType: "article", toKey: { in: keys }, fromType: { in: ["brief", "igstory"] }, status: { in: [...COUNTED] } },
  });
  const briefLinks = links.filter((l) => l.fromType === "brief");
  const briefs = await loadBriefs({ fileId: { in: briefLinks.map((l) => l.fromKey) } });

  const out = new Map<string, { briefs: BriefLite[]; derivs: Derivative[] }>(keys.map((k) => [k, { briefs: [], derivs: [] }]));
  const lites = new Map(briefLite(briefs).map((x) => [x.lite.fileId, x]));
  for (const l of briefLinks) {
    const b = lites.get(l.fromKey);
    const slot = out.get(l.toKey);
    if (!b || !slot) continue;
    slot.briefs.push(b.lite);
    if (b.deriv) slot.derivs.push(b.deriv);
  }
  // lewat Story: artikel ← rencana artikel → brief yang cocok langsung, dan log IG berkode Story
  const viaStory = await prisma.teamMatch.findMany({ where: { fromType: "story", toType: "article", toKey: { in: keys }, status: { in: [...COUNTED] } } });
  if (viaStory.length) {
    const codes = viaStory.map((l) => l.fromKey);
    const [briefStory, coded] = await Promise.all([
      prisma.teamMatch.findMany({ where: { fromType: "brief", toType: "story", toKey: { in: codes }, status: { in: [...COUNTED] } } }),
      prisma.teamMatch.findMany({ where: { fromType: "story", toType: "social", status: "coded", fromKey: { in: codes } } }),
    ]);
    const direct = new Map(briefLite(await loadBriefs({ fileId: { in: briefStory.map((l) => l.fromKey) } })).map((x) => [x.lite.fileId, x]));
    for (const v of viaStory) {
      const slot = out.get(v.toKey)!;
      for (const l of briefStory.filter((l) => l.toKey === v.fromKey)) {
        const b = direct.get(l.fromKey);
        if (!b || slot.briefs.some((x) => x.fileId === b.lite.fileId)) continue;
        slot.briefs.push(b.lite);
        if (b.deriv) slot.derivs.push(b.deriv);
      }
      for (const c of coded.filter((c) => c.fromKey === v.fromKey)) {
        const kind = SOCIAL_KIND[c.toFormat ?? ""];
        if (kind && c.toDate) slot.derivs.push({ kind, date: c.toDate, title: c.toTitle, via: "code", teaser: c.toDate < (articleDates.get(v.toKey) ?? c.toDate) });
      }
    }
  }

  const storyLinks = links.filter((l) => l.fromType === "igstory");
  if (storyLinks.length) {
    const logs = await prisma.socialLog.findMany({ where: { format: "story", platform: { contains: "instagram" }, date: { not: null } }, select: { date: true, format: true, title: true, url: true } });
    const logByKey = new Map(logs.map((x) => [socialKey(x), x]));
    for (const l of storyLinks) {
      const slot = out.get(l.toKey);
      const log = logByKey.get(l.fromKey);
      if (!slot || !log?.date) continue;
      slot.derivs.push({ kind: "story", date: log.date, title: log.title ?? "", via: "match", teaser: log.date < (articleDates.get(l.toKey) ?? log.date) });
    }
  }
  return out;
}

export type PipelineStage = "done" | "brief" | "article" | "check" | "missing";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

export async function getPipeline(month: string) {
  const stories = await getStories(month);
  const articleDates = new Map(stories.flatMap((s) => (s.article.match?.date ? [[s.article.match.key, s.article.match.date] as const] : [])));
  const codes = stories.map((s) => s.code);
  const [byArticle, coded, briefStory] = await Promise.all([
    derivativesByArticle(articleDates),
    prisma.teamMatch.findMany({ where: { fromType: "story", toType: "social", status: "coded", fromKey: { in: codes } } }),
    prisma.teamMatch.findMany({ where: { fromType: "brief", toType: "story", toKey: { in: codes }, status: { in: [...COUNTED] } } }),
  ]);
  const directBriefs = briefStory.length ? briefLite(await loadBriefs({ fileId: { in: briefStory.map((l) => l.fromKey) } })) : [];
  const now = today();

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
      /** artikel → turunan IG pertama (teaser tidak dihitung) */
      repurposeLag: art?.date && firstAfter ? dayDiff(art.date, firstAfter.date) : null,
    };
  });
}

export type PipelineRow = Awaited<ReturnType<typeof getPipeline>>[number];
