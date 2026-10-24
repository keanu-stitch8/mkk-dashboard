import { PageHeader } from "@/components/PageHeader";
import { EmptyState, Section } from "@/components/blocks";
import { PublishingLogTable, type LogColumn } from "@/components/PublishingLogTable";
import { categoryLabel, newsFormat } from "@/lib/taxonomy";
import { prisma } from "@/lib/db";
import { firstParam } from "@/modules/shared/lib/month-param";
import { resolveMonth } from "@/modules/shared/queries/month-query";
import { ogImages } from "@/lib/data/page-meta";
import { fmtNum } from "@/lib/format";
import { monthLabel } from "@/lib/month";

export const dynamic = "force-dynamic";

const COLUMNS: LogColumn[] = [
  { key: "type", label: "Format", badge: "format" },
  { key: "category", label: "Category", badge: "outline" },
  { key: "reporter", label: "Reporter" },
];

/** Log artikel News per bulan — murni catatan publish, tanpa views/metrics. */
export default async function NewsLogsPage({ searchParams }: PageProps<"/news/logs">) {
  const { month, months } = await resolveMonth(firstParam((await searchParams).m));
  const articles = await prisma.newsArticle.findMany({
    where: { month },
    select: { date: true, submittedDate: true, title: true, url: true, reporter: true, category: true, type: true, status: true },
  });

  if (!articles.length) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Publishing Log" month={month} months={months} />
        <EmptyState channel="News" month={month} source="News Content Logs" />
      </div>
    );
  }

  const count = (s: string) => articles.filter((a) => a.status === s).length;
  // thumbnail = og:image halaman artikel (1024×576 di mainkekudus.com), di-cache per URL
  const thumbs = await ogImages(articles.flatMap((a) => (a.url ? [a.url] : [])));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Publishing Log" description={`All News articles in the ${monthLabel(month)} content log. Click a title to open the article.`} month={month} months={months} />

      <Section title="All articles" subtitle={`${fmtNum(articles.length)} articles · ${fmtNum(count("publish"))} published · ${fmtNum(count("review"))} in review`}>
        <PublishingLogTable
          columns={COLUMNS}
          rows={articles.map((a) => ({
            date: a.date ?? a.submittedDate,
            title: a.title,
            url: a.url,
            status: a.status,
            fields: { reporter: a.reporter, category: categoryLabel(a.category), type: newsFormat(a.type) },
            thumb: a.url ? (thumbs.get(a.url) ?? null) : null,
          }))}
          thumbnails
        />
      </Section>
    </div>
  );
}
