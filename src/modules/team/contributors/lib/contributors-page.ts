import { median } from "../../shared/lib/team-links";
import type { ContributorsData } from "../types/contributors";
import type { ContributorsPage } from "../types/contributors-page";

export function buildContributorsPage(month: string, months: string[], data: ContributorsData): ContributorsPage {
  const { items } = data;
  return {
    month,
    months,
    ...data,
    complete: items.filter((i) => i.complete).length,
    reported: items.filter((i) => i.reported).length,
    reel: items.filter((i) => i.reelReady).length,
    lag: median(items.map((i) => i.assetLag).filter((x): x is number => x != null && x >= 0)),
  };
}
