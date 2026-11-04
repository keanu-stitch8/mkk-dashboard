import type { ContributorIgOutput, ContributorRecap, ContributorsData } from "../types/contributors";
import type { ContributorsPage } from "../types/contributors-page";

/** Kontributor lokal wajib mengirim 60 konten per bulan. */
export const CONTENT_TARGET = 60;

export function buildContributorsPage(month: string, months: string[], data: ContributorsData, recap: ContributorRecap, ig: ContributorIgOutput): ContributorsPage {
  const { items } = data;
  const count = (f: (i: (typeof items)[number]) => boolean) => items.filter(f).length;
  return {
    month,
    months,
    ...data,
    target: CONTENT_TARGET,
    content: count((i) => i.content),
    extra: count((i) => i.content && i.extra),
    complete: count((i) => i.content && i.complete),
    articles: count((i) => i.articleDone),
    reported: count((i) => i.reported),
    carousel: count((i) => i.carouselReady),
    reel: count((i) => i.reelReady),
    ig,
    recap,
  };
}
