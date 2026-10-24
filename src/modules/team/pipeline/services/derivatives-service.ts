import "server-only";
import { socialKey } from "@/lib/team/store";
import { briefLite, SOCIAL_KIND } from "../lib/pipeline";
import type { ArticleDerivatives } from "../types/pipeline";
import { COUNTED } from "../../shared/lib/team-links";
import { toTeamMatchEntry } from "../../shared/mappers/team-mapper";
import { findInstagramStoryLogs, findMatches } from "../../shared/repositories/team-repository";
import { loadBriefs } from "../../shared/services/brief-service";

/**
 * Brief & turunan IG per artikel (kunci artikel dari TeamMatch). Dipakai halaman pipeline dan Team Scorecard.
 * `articleDates` dipakai untuk menandai teaser (IG story sebelum artikel tayang).
 */
export async function derivativesByArticle(articleDates: Map<string, string>): Promise<Map<string, ArticleDerivatives>> {
  const keys = [...articleDates.keys()];
  const links = (await findMatches({ toType: "article", toKey: { in: keys }, fromType: { in: ["brief", "igstory"] }, status: { in: [...COUNTED] } })).map(toTeamMatchEntry);
  const briefLinks = links.filter((l) => l.fromType === "brief");
  const briefs = await loadBriefs({ fileId: { in: briefLinks.map((l) => l.fromKey) } });

  const out = new Map<string, ArticleDerivatives>(keys.map((k) => [k, { briefs: [], derivs: [] }]));
  const lites = new Map(briefLite(briefs).map((x) => [x.lite.fileId, x]));
  for (const l of briefLinks) {
    const b = lites.get(l.fromKey);
    const slot = out.get(l.toKey);
    if (!b || !slot) continue;
    slot.briefs.push(b.lite);
    if (b.deriv) slot.derivs.push(b.deriv);
  }
  // lewat Story: artikel ← rencana artikel → brief yang cocok langsung, dan log IG berkode Story
  const viaStory = (await findMatches({ fromType: "story", toType: "article", toKey: { in: keys }, status: { in: [...COUNTED] } })).map(toTeamMatchEntry);
  if (viaStory.length) {
    const codes = viaStory.map((l) => l.fromKey);
    const [briefStory, coded] = await Promise.all([
      findMatches({ fromType: "brief", toType: "story", toKey: { in: codes }, status: { in: [...COUNTED] } }).then((r) => r.map(toTeamMatchEntry)),
      findMatches({ fromType: "story", toType: "social", status: "coded", fromKey: { in: codes } }).then((r) => r.map(toTeamMatchEntry)),
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
    const logs = await findInstagramStoryLogs();
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
