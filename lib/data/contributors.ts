// Halaman Contributors: kelengkapan aset liputan kontributor lokal per bulan (tab Task Progress kontributor).
import { prisma } from "../db";
import { ASSETS, assetSummary, type AssetCell, type AssetKey, type AssetState } from "../team/contributors";
import { dayDiff, median } from "./team";

export async function contributorMonths(): Promise<string[]> {
  const rows = await prisma.contributorTask.findMany({ distinct: ["tab"], select: { tab: true } });
  return rows.map((r) => r.tab).sort().reverse();
}

export async function getContributors(month: string) {
  const [rows, names, stories] = await Promise.all([
    prisma.contributorTask.findMany({ where: { tab: month }, orderBy: { no: "asc" } }),
    prisma.contributor.findMany(),
    prisma.story.findMany({ select: { code: true, title: true } }),
  ]);
  const nameOf = new Map(names.map((n) => [n.alias.toUpperCase(), n.name]));
  const storyTitle = new Map(stories.map((s) => [s.code, s.title]));

  const items = rows.map((r) => {
    const assets = Object.fromEntries(
      ASSETS.map((a) => [a.key, { state: r[a.key] as AssetState, by: r[`${a.key}By`], at: r[`${a.key}At`] }]),
    ) as Record<AssetKey, AssetCell>;
    const sum = assetSummary(assets);
    return {
      ...r,
      assets,
      ...sum,
      storyTitle: r.storyCode ? (storyTitle.get(r.storyCode) ?? null) : null,
      /** hari dari rencana liputan sampai aset terakhir masuk */
      assetLag: r.planned && sum.lastAsset ? dayDiff(r.planned, sum.lastAsset) : null,
    };
  });

  // per kontributor: berapa artikel & aset yang dikirim bulan ini
  const people = new Map<string, { alias: string; name: string | null; articles: number; assets: number; lags: number[] }>();
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

export type ContributorItem = Awaited<ReturnType<typeof getContributors>>["items"][number];
