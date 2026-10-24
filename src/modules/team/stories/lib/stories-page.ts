import { median } from "../../shared/lib/team-links";
import type { StoryRow } from "../../shared/types/team";
import type { StoriesPage } from "../types/stories-page";

export function buildStoriesPage(month: string, months: string[], stories: StoryRow[]): StoriesPage {
  const done = stories.filter((s) => s.article.match);
  const check = stories.filter((s) => !s.article.match && s.article.suggestions.length);
  const missing = stories.filter((s) => !s.article.match && !s.article.suggestions.length);
  const lag = median(done.map((s) => s.lag).filter((x): x is number => x != null));
  return { month, months, stories, done, check, missing, lag };
}
