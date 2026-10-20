import { PageHeader } from "@/components/PageHeader";
import { EmptyState, Section } from "@/components/blocks";
import { PublishingLogTable, type LogColumn, type LogRow } from "@/components/PublishingLogTable";
import { BADGE } from "@/components/log-badges";
import { prisma } from "@/lib/db";
import { getSocialSummary, resolveMonth } from "@/lib/data/summary";
import { matchStoryArticle } from "@/lib/data/story-links";
import { fmtNum } from "@/lib/format";
import { monthLabel } from "@/lib/month";

export const dynamic = "force-dynamic";

const COLUMNS: LogColumn[] = [
  { key: "format", label: "Format", badges: { reels: BADGE.violet, feeds: BADGE.blue, carousel: BADGE.blue, story: BADGE.orange, video: BADGE.red } },
  { key: "category", label: "Kategori" },
  { key: "platform", label: "Platform" },
  { key: "admin", label: "Admin" },
  { key: "designer", label: "Designer" },
];

const PLATFORMS: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", threads: "Threads", youtube: "YouTube" };
const ORDER = Object.keys(PLATFORMS);
const platforms = (s: string) =>
  s
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))
    .map((p) => PLATFORMS[p] ?? p)
    .join(", ");
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Log konten Social Media per bulan — publishing log + in review dari Task Progress, tanpa views/metrics. */
export default async function SocialLogsPage({ searchParams }: PageProps<"/social/logs">) {
  const { month, months } = await resolveMonth((await searchParams).m);
  const [s, articles] = await Promise.all([
    getSocialSummary(month),
    prisma.newsArticle.findMany({ where: { url: { not: null }, status: "publish" }, select: { title: true, url: true, date: true } }),
  ]);
  // story tanpa caption tidak bisa dipasangkan ke story IG tertentu → story Featured News di-link ke artikel News-nya
  const storyLink = (l: (typeof s.logs)[number]) =>
    l.format === "story" && l.category === "Featured News" ? (matchStoryArticle(l, articles)?.url ?? null) : null;

  const rows: LogRow[] = s.logs.map((l) => ({
    date: l.date,
    title: l.title ?? "(tanpa judul)",
    url: l.link ?? storyLink(l),
    status: l.status,
    fields: { format: capitalize(l.format), category: l.category, platform: platforms(l.platform), admin: l.admin, designer: l.designer },
  }));
  // in review dari tracker Task Progress: label "format · judul", tanpa tanggal tayang
  for (const label of s.inReviewItems) {
    const [format, ...title] = label.split(" · ");
    rows.push({ date: null, title: title.join(" · ") || "(tanpa judul)", url: null, status: "review", fields: { format: capitalize(format), category: null, platform: null, admin: null, designer: null } });
  }

  if (!rows.length) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader title="Publishing Log" month={month} months={months} />
        <EmptyState channel="Social Media" month={month} source="MKK Kudus Social Media - Publishing Log" />
      </div>
    );
  }

  const count = (st: string) => rows.filter((r) => r.status === st).length;
  const linked = rows.filter((r) => r.url).length;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Publishing Log"
        description={`Semua konten Social Media di publishing log ${monthLabel(month)}. Judul bisa diklik: post Instagram yang cocok, atau artikel News untuk story Featured News.`}
        month={month}
        months={months}
      />

      <Section
        title="Semua konten"
        subtitle={`${fmtNum(rows.length)} konten · ${fmtNum(count("publish"))} published · ${fmtNum(count("review"))} in review · ${fmtNum(linked)} dengan link`}
      >
        <PublishingLogTable columns={COLUMNS} rows={rows} />
      </Section>
    </div>
  );
}
