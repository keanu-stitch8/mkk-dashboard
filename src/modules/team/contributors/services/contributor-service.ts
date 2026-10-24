import "server-only";
import { buildContributors } from "../lib/contributors";
import { toContributorTaskEntry } from "../mappers/contributor-mapper";
import { findContributorTabs, findContributors, findContributorTasks, findStoryTitles } from "../repositories/contributor-repository";
import type { ContributorsData } from "../types/contributors";

/** Tab bulan yang sudah ada di Local Contributor - Task Progress, terbaru dulu. */
export async function contributorMonths(): Promise<string[]> {
  return (await findContributorTabs()).map((r) => r.tab).sort().reverse();
}

export async function getContributors(month: string): Promise<ContributorsData> {
  const [rows, names, stories] = await Promise.all([findContributorTasks(month), findContributors(), findStoryTitles()]);
  return buildContributors(rows.map(toContributorTaskEntry), names, stories);
}
