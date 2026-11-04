import { ASSETS, articleCredit, assetSummary, footageBy, isDelivered, isFootageOnly, monthCredit, reporterAliases, splitAliases, type AssetCell, type AssetKey } from "@/modules/team/ingest/contributors";
import { dayDiff, median } from "../../shared/lib/team-links";
import type { ContributorPerson, ContributorRecap, ContributorRef, ContributorsData, ContributorTaskEntry, StoryIg } from "../types/contributors";

const assetsOf = (r: ContributorTaskEntry) =>
  Object.fromEntries(ASSETS.map((a) => [a.key, { state: r[a.key], by: r[`${a.key}By`], at: r[`${a.key}At`] }])) as Record<AssetKey, AssetCell>;

const footageOnlySet = (refs: ContributorRef[]) => new Set(refs.filter((r) => isFootageOnly(r.role)).map((r) => r.alias.toUpperCase()));

/**
 * Kelengkapan aset liputan per rencana + rekap per kontributor (alias → nama & peran dari tab Ref).
 * 1 konten = 1 artikel Submitted (dibayar per konten; aset boleh tidak lengkap), sama dengan tab Master Report.
 */
export function buildContributors(
  rows: ContributorTaskEntry[],
  refs: ContributorRef[],
  stories: { code: string; title: string }[],
  ig: StoryIg = new Map(),
  /** berita status publish bulan ini dari News Content Logs */
  news: { reporter: string | null }[] = [],
): ContributorsData {
  const nameOf = new Map(refs.map((n) => [n.alias.toUpperCase(), n.name]));
  const roleOf = new Map(refs.map((n) => [n.alias.toUpperCase(), n.role]));
  const activeOf = new Map(refs.map((n) => [n.alias.toUpperCase(), n.active ?? true]));
  const footageOnly = footageOnlySet(refs);
  const storyTitle = new Map(stories.map((s) => [s.code, s.title]));

  const items = rows.map((r) => {
    const assets = assetsOf(r);
    const sum = assetSummary(assets);
    const delivered = isDelivered(r.status);
    const derivs = r.storyCode ? ig.get(r.storyCode) : undefined;
    return {
      ...r,
      assets,
      ...sum,
      articleDone: delivered || !!r.articleAt,
      content: delivered,
      credit: delivered ? articleCredit(r.articleBy, footageOnly) : [],
      igCarousel: !!derivs?.carousel,
      igReel: !!derivs?.reel,
      web: derivs?.web ?? null,
      storyTitle: r.storyCode ? (storyTitle.get(r.storyCode) ?? null) : null,
      assetLag: r.planned && sum.lastAsset ? dayDiff(r.planned, sum.lastAsset) : null,
    };
  });

  const people = new Map<string, Omit<ContributorPerson, "lag">>();
  const person = (alias: string) => {
    const k = alias.toUpperCase();
    if (!people.has(k)) people.set(k, { alias: k, name: nameOf.get(k) ?? null, role: roleOf.get(k) ?? null, footageOnly: footageOnly.has(k), content: 0, footage: 0, assets: 0, web: 0, active: activeOf.get(k) ?? true, lags: [] });
    return people.get(k)!;
  };
  // orang aktif di Ref tampil walau belum ada kiriman bulan ini; yang tidak aktif hanya jika ada kiriman
  refs.filter((r) => r.active ?? true).forEach((r) => person(r.alias));
  for (const it of items) {
    for (const [a, share] of it.credit) person(a).content += share;
    for (const a of footageBy(it.assets)) person(a).footage++;
    for (const a of ASSETS) {
      const c = it.assets[a.key];
      if (c.state !== "available") continue;
      for (const alias of splitAliases(c.by)) {
        const p = person(alias);
        p.assets++;
        if (it.planned && c.at) p.lags.push(dayDiff(it.planned, c.at)!);
      }
    }
  }

  const others: Record<string, number> = {};
  let byContributors = 0;
  for (const n of news) {
    const { aliases, others: rest } = reporterAliases(n.reporter, refs);
    if (aliases.length) byContributors++;
    aliases.forEach((a) => person(a).web++);
    rest.forEach((o) => (others[o] = (others[o] ?? 0) + 1));
  }

  const score = (p: Omit<ContributorPerson, "lag">) => (p.footageOnly ? p.footage : p.content);
  return {
    news: { published: news.length, byContributors, others },
    items,
    people: [...people.values()]
      .map((p) => ({ ...p, lag: median(p.lags) }))
      .sort((a, b) => Number(a.footageOnly) - Number(b.footageOnly) || score(b) - score(a) || a.alias.localeCompare(b.alias)),
    nameOf: Object.fromEntries(nameOf),
  };
}

/** Rekap semua bulan (seperti tab Master Report): konten per penulis, footage per orang Footage-only. */
export function buildContributorRecap(rows: ContributorTaskEntry[], refs: ContributorRef[]): ContributorRecap {
  const footageOnly = footageOnlySet(refs);
  const tabs = [...new Set(rows.map((r) => r.tab))].sort();
  const months = tabs.map((month) => ({ month, ...monthCredit(rows.filter((r) => r.tab === month).map((r) => ({ ...r, assets: assetsOf(r) })), footageOnly) }));
  const writers = new Set(refs.filter((r) => !footageOnly.has(r.alias.toUpperCase())).map((r) => r.alias.toUpperCase()));
  months.forEach((m) => Object.keys(m.content).forEach((a) => writers.add(a)));
  return { months, writers: [...writers], footage: [...footageOnly] };
}
