import "server-only";
import { getPipeline } from "../../pipeline/services/pipeline-service";
import { buildContributors } from "../lib/contributors";
import { toContributorTaskEntry } from "../mappers/contributor-mapper";
import { findContributorTabs, findContributors, findContributorTasks, findStoryTitles } from "../repositories/contributor-repository";
import type { ContributorsData, StoryIg } from "../types/contributors";

/** Tab bulan yang sudah ada di Local Contributor - Task Progress, terbaru dulu. */
export async function contributorMonths(): Promise<string[]> {
  return (await findContributorTabs()).map((r) => r.tab).sort().reverse();
}

/** Carousel / reel IG per kode Story, dari Content Pipeline bulan panduannya (kode "YYMMDD-n"). */
async function storyIg(codes: string[]): Promise<StoryIg> {
  const months = [...new Set(codes.map((c) => `20${c.slice(0, 2)}-${c.slice(2, 4)}`))];
  const rows = (await Promise.all(months.map(getPipeline))).flat();
  return new Map(rows.map((r) => [r.code, { carousel: r.derivs.some((d) => d.kind === "feed"), reel: r.derivs.some((d) => d.kind === "reel") }]));
}

export async function getContributors(month: string): Promise<ContributorsData> {
  const [rows, names, stories] = await Promise.all([findContributorTasks(month), findContributors(), findStoryTitles()]);
  const ig = await storyIg(rows.flatMap((r) => (r.storyCode ? [r.storyCode] : [])));
  return buildContributors(rows.map(toContributorTaskEntry), names, stories, ig);
}
