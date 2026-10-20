import { PageHeader } from "@/components/PageHeader";
import { EmptyState, Section } from "@/components/blocks";
import { PublishingLogTable, type LogColumn } from "@/components/PublishingLogTable";
import { BADGE } from "@/components/log-badges";
import { prisma } from "@/lib/db";
import { resolveMonth } from "@/lib/data/summary";
import { ogImages } from "@/lib/data/page-meta";
import { fmtNum } from "@/lib/format";
import { monthLabel } from "@/lib/month";

export const dynamic = "force-dynamic";

const COLUMNS: LogColumn[] = [
  { key: "reporter", label: "Reporter" },
  { key: "category", label: "Kategori" },
  { key: "type", label: "Tipe", badges: { features: BADGE.blue, "hard news": BADGE.red, editorial: BADGE.orange } },
];

/** Log artikel News per bulan — murni catatan publish, tanpa views/metrics. */
export default async function NewsLogsPage({ searchParams }: PageProps<"/news/logs">) {
  const { month, months } = await resolveMonth((await searchParams).m);
  const articles = await prisma.newsArticle.findMany({
    where: { month },
    select: { date: true, submittedDate: true, title: true, url: true, reporter: true, category: true, type: true, status: true },
  });

  if (!articles.length) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader title="Publishing Log" month={month} months={months} />
        <EmptyState channel="News" month={month} source="News Content Logs" />
      </div>
    );
  }

  const count = (s: string) => articles.filter((a) => a.status === s).length;
  // thumbnail = og:image halaman artikel (1024×576 di mainkekudus.com), di-cache per URL
  const thumbs = await ogImages(articles.flatMap((a) => (a.url ? [a.url] : [])));

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader title="Publishing Log" description={`Semua artikel News di content log ${monthLabel(month)}. Klik judul untuk membuka artikel.`} month={month} months={months} />

      <Section title="Semua artikel" subtitle={`${fmtNum(articles.length)} artikel · ${fmtNum(count("publish"))} published · ${fmtNum(count("review"))} in review`}>
        <PublishingLogTable
          columns={COLUMNS}
          rows={articles.map((a) => ({
            date: a.date ?? a.submittedDate,
            title: a.title,
            url: a.url,
            status: a.status,
            fields: { reporter: a.reporter, category: a.category, type: a.type },
            thumb: a.url ? (thumbs.get(a.url) ?? null) : null,
          }))}
          thumbnails
        />
      </Section>
    </div>
  );
}
