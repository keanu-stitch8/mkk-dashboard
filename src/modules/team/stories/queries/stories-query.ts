import "server-only";
import { cache } from "react";
import { resolveTeamMonth } from "../../shared/queries/team-month-query";
import { getStories } from "../../shared/services/story-service";
import { buildStoriesPage } from "../lib/stories-page";
import type { StoriesPage } from "../types/stories-page";

export const getStoriesPage = cache(async (monthParam: string | undefined): Promise<StoriesPage> => {
  const { month, months } = await resolveTeamMonth(monthParam);
  return buildStoriesPage(month, months, await getStories(month));
});
