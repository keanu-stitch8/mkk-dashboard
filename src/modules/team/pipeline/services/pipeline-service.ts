import "server-only";
import { COUNTED } from "../../shared/lib/team-links";
import { toTeamMatchEntry } from "../../shared/mappers/team-mapper";
import { findMatches } from "../../shared/repositories/team-repository";
import { loadBriefs } from "../../shared/services/brief-service";
import { derivativesByArticle } from "./derivatives-service";
import { getStories } from "../../shared/services/story-service";
import { briefLite, buildPipelineRows } from "../lib/pipeline";
import type { PipelineRow } from "../types/pipeline";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

export async function getPipeline(month: string): Promise<PipelineRow[]> {
  const stories = await getStories(month);
  const articleDates = new Map(stories.flatMap((s) => (s.article.match?.date ? [[s.article.match.key, s.article.match.date] as const] : [])));
  const codes = stories.map((s) => s.code);
  const [byArticle, coded, briefStory] = await Promise.all([
    derivativesByArticle(articleDates),
    findMatches({ fromType: "story", toType: "social", status: "coded", fromKey: { in: codes } }).then((r) => r.map(toTeamMatchEntry)),
    findMatches({ fromType: "brief", toType: "story", toKey: { in: codes }, status: { in: [...COUNTED] } }).then((r) => r.map(toTeamMatchEntry)),
  ]);
  const directBriefs = briefStory.length ? briefLite(await loadBriefs({ fileId: { in: briefStory.map((l) => l.fromKey) } })) : [];
  return buildPipelineRows(stories, byArticle, coded, briefStory, directBriefs, today());
}
