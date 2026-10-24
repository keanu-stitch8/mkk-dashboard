import type { ContributorTask } from "@prisma/client";
import type { AssetState } from "@/lib/team/contributors";
import type { ContributorTaskEntry } from "../types/contributors";

const asset = (v: string | null) => v as AssetState;

export const toContributorTaskEntry = (r: ContributorTask): ContributorTaskEntry => ({
  id: r.id,
  tab: r.tab,
  no: r.no,
  planned: r.planned,
  guideFile: r.guideFile,
  n: r.n,
  title: r.title,
  status: r.status,
  articleBy: r.articleBy,
  articleAt: r.articleAt,
  landscape: asset(r.landscape),
  landscapeBy: r.landscapeBy,
  landscapeAt: r.landscapeAt,
  portrait: asset(r.portrait),
  portraitBy: r.portraitBy,
  portraitAt: r.portraitAt,
  video: asset(r.video),
  videoBy: r.videoBy,
  videoAt: r.videoAt,
  interview: asset(r.interview),
  interviewBy: r.interviewBy,
  interviewAt: r.interviewAt,
  storyCode: r.storyCode,
});
