import "server-only";
import { buildStoryRows } from "../lib/team-links";
import { toStoryEntry, toTeamMatchEntry } from "../mappers/team-mapper";
import { findMatchesFrom, findStories } from "../repositories/team-repository";
import type { StoryRow } from "../types/team";

/** Story bulan ini + artikel pasangannya. */
export async function getStories(month: string): Promise<StoryRow[]> {
  const stories = (await findStories(month)).map(toStoryEntry);
  const matches = (await findMatchesFrom("story", stories.map((s) => s.code))).map(toTeamMatchEntry);
  return buildStoryRows(stories, matches);
}
