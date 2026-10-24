import { median } from "../../shared/lib/team-links";
import type { BriefRow, BriefState } from "../../shared/types/team";
import type { BriefsPage } from "../types/briefs-page";

export function buildBriefsPage(month: string, months: string[], briefs: BriefRow[]): BriefsPage {
  const by = (s: BriefState) => briefs.filter((b) => b.state === s);
  const groups = { posted: by("posted"), check: by("check"), review: by("review"), waiting: by("waiting") };
  return {
    month,
    months,
    briefs,
    groups,
    lag: median(groups.posted.map((b) => b.lag).filter((x): x is number => x != null)),
    byType: Object.entries(Object.groupBy(briefs, (b) => b.type)).map(([t, list]) => `${list?.length ?? 0} ${t}`),
    tracked: briefs.filter((b) => b.task).length,
  };
}
