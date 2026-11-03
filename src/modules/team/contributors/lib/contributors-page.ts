import type { ContributorsData } from "../types/contributors";
import type { ContributorsPage } from "../types/contributors-page";

/** Kontributor lokal wajib mengirim 60 konten per bulan. */
export const CONTENT_TARGET = 60;

export function buildContributorsPage(month: string, months: string[], data: ContributorsData): ContributorsPage {
  const { items } = data;
  const count = (f: (i: (typeof items)[number]) => boolean) => items.filter(f).length;
  return {
    month,
    months,
    ...data,
    target: CONTENT_TARGET,
    content: count((i) => i.content),
    articles: count((i) => i.articleDone),
    reported: count((i) => i.reported),
    carousel: count((i) => i.carouselReady),
    reel: count((i) => i.reelReady),
    toIg: count((i) => i.igCarousel || i.igReel),
    igCarousel: count((i) => i.igCarousel),
    igReel: count((i) => i.igReel),
  };
}
