import { ASSETS, assetSummary, type AssetCell, type AssetKey } from "@/lib/team/contributors";
import { dayDiff, median } from "../../shared/lib/team-links";
import type { ContributorPerson, ContributorsData, ContributorTaskEntry } from "../types/contributors";

/** Kelengkapan aset liputan per rencana + rekap per kontributor (alias → nama dari tab Ref). */
export function buildContributors(rows: ContributorTaskEntry[], names: { alias: string; name: string }[], stories: { code: string; title: string }[]): ContributorsData {
  const nameOf = new Map(names.map((n) => [n.alias.toUpperCase(), n.name]));
  const storyTitle = new Map(stories.map((s) => [s.code, s.title]));

  const items = rows.map((r) => {
    const assets = Object.fromEntries(ASSETS.map((a) => [a.key, { state: r[a.key], by: r[`${a.key}By`], at: r[`${a.key}At`] }])) as Record<AssetKey, AssetCell>;
    const sum = assetSummary(assets);
    return {
      ...r,
      assets,
      ...sum,
      storyTitle: r.storyCode ? (storyTitle.get(r.storyCode) ?? null) : null,
      assetLag: r.planned && sum.lastAsset ? dayDiff(r.planned, sum.lastAsset) : null,
    };
  });

  // per kontributor: berapa artikel & aset yang dikirim bulan ini
  const people = new Map<string, Omit<ContributorPerson, "lag">>();
  const person = (alias: string) => {
    const k = alias.toUpperCase();
    if (!people.has(k)) people.set(k, { alias: k, name: nameOf.get(k) ?? null, articles: 0, assets: 0, lags: [] });
    return people.get(k)!;
  };
  for (const it of items) {
    if (it.articleBy && it.articleAt) person(it.articleBy).articles++;
    for (const a of ASSETS) {
      const c = it.assets[a.key];
      if (c.by && c.state === "available") {
        const p = person(c.by);
        p.assets++;
        if (it.planned && c.at) p.lags.push(dayDiff(it.planned, c.at)!);
      }
    }
  }

  return {
    items,
    people: [...people.values()].map((p) => ({ ...p, lag: median(p.lags) })).sort((a, b) => b.articles + b.assets - (a.articles + a.assets)),
    nameOf: Object.fromEntries(nameOf),
  };
}
