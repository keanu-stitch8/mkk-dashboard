import "server-only";
import { getPipeline } from "../../pipeline/services/pipeline-service";
import { buildContributorRecap, buildContributors } from "../lib/contributors";
import { toContributorTaskEntry } from "../mappers/contributor-mapper";
import { findAllContributorTasks, findContributorTabs, findContributors, findContributorTasks, findPublishedNews, findPublishedSocial, findSocialInReview, findStoryTitles } from "../repositories/contributor-repository";
import { socialFormatKey } from "@/modules/shared/lib/taxonomy";
import type { ContributorIgOutput, ContributorRecap, ContributorsData, StoryIg } from "../types/contributors";

/** Tab bulan yang sudah ada di Local Contributor - Task Progress, terbaru dulu. */
export async function contributorMonths(): Promise<string[]> {
  return (await findContributorTabs()).map((r) => r.tab).sort().reverse();
}

/** Berita web + carousel / reel IG per kode Story, dari Content Pipeline bulan panduannya (kode "YYMMDD-n"). */
async function storyIg(codes: string[]): Promise<StoryIg> {
  const months = [...new Set(codes.map((c) => `20${c.slice(0, 2)}-${c.slice(2, 4)}`))];
  const rows = (await Promise.all(months.map(getPipeline))).flat();
  return new Map(
    rows.map((r) => {
      const m = r.article.match;
      return [
        r.code,
        {
          carousel: r.derivs.some((d) => d.kind === "feed"),
          reel: r.derivs.some((d) => d.kind === "reel"),
          web: m ? { title: m.title, url: m.url, date: m.date } : null,
        },
      ];
    }),
  );
}

export async function getContributors(month: string): Promise<ContributorsData> {
  const [rows, names, stories, news] = await Promise.all([findContributorTasks(month), findContributors(), findStoryTitles(), findPublishedNews(month)]);
  const ig = await storyIg(rows.flatMap((r) => (r.storyCode ? [r.storyCode] : [])));
  return buildContributors(rows.map(toContributorTaskEntry), names, stories, ig, news);
}

/** Rekap semua bulan (konten per penulis + footage), seperti tab Master Report. */
export async function getContributorRecap(): Promise<ContributorRecap> {
  const [rows, refs] = await Promise.all([findAllContributorTasks(), findContributors()]);
  return buildContributorRecap(rows.map(toContributorTaskEntry), refs);
}

/** Carousel (Feed) & Reel IG bulan itu, sama dengan Social report: live dari Publishing Log, in review dari Task Progress. */
export async function getIgOutput(month: string): Promise<ContributorIgOutput> {
  const [live, review] = await Promise.all([findPublishedSocial(month), findSocialInReview(month)]);
  const fmt = (f: string) => socialFormatKey(f.trim());
  const reviewFmt = review.map((r) => fmt(r.label.split("·")[0] ?? ""));
  const count = (list: string[], f: string) => list.filter((x) => x === f).length;
  const liveFmt = live.map((r) => fmt(r.format));
  return {
    feedLive: count(liveFmt, "feeds"),
    feedReview: count(reviewFmt, "feeds"),
    reelLive: count(liveFmt, "reels"),
    reelReview: count(reviewFmt, "reels"),
  };
}
