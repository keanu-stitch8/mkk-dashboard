import { PageHeader } from "@/components/PageHeader";
import { EmptyState, Section } from "@/components/blocks";
import { PublishingLogTable, type LogColumn, type LogRow } from "@/components/PublishingLogTable";
import { isRecap } from "@/lib/reports/youtube-series";
import { categoryLabel, youtubeFormat } from "@/lib/taxonomy";
import { prisma } from "@/lib/db";
import { resolveMonth } from "@/lib/data/summary";
import { fmtNum } from "@/lib/format";
import { monthLabel } from "@/lib/month";

export const dynamic = "force-dynamic";

const COLUMNS: LogColumn[] = [
  { key: "format", label: "Format", badge: "format" },
  { key: "category", label: "Category", badge: "outline" },
  { key: "editor", label: "Video Editor" },
];

/** Log video YouTube per bulan — Summary (Calendar Timeline) + in review dari Gantt, tanpa views/metrics. */
export default async function YoutubeLogsPage({ searchParams }: PageProps<"/youtube/logs">) {
  const { month, months } = await resolveMonth((await searchParams).m);
  const [logs, reviewItems] = await Promise.all([
    prisma.ytLog.findMany({ where: { month }, select: { date: true, title: true, url: true, videoId: true, format: true, category: true, editor: true, status: true } }),
    prisma.breakdown.findMany({ where: { month, channel: "youtube", dimension: "yt_in_review", import: { source: "yt_review" } }, select: { label: true } }),
  ]);

  const rows: LogRow[] = logs.map((l) => ({
    date: l.date,
    title: l.title,
    url: l.url,
    status: l.status,
    fields: { format: youtubeFormat(l.format, l.category, isRecap(l.title, l.format)), category: categoryLabel(l.category), editor: l.editor },
    // thumbnail "medium" YouTube Data API = 320×180 (16:9); high/standard 4:3
    thumb: l.videoId ? `https://i.ytimg.com/vi/${l.videoId}/mqdefault.jpg` : null,
  }));
  // video in review (Gantt) yang sudah ada di Summary cukup ditandai review; sisanya ditambahkan tanpa tanggal
  const byTitle = new Map(rows.map((r) => [r.title.trim().toLowerCase(), r]));
  for (const { label } of reviewItems) {
    const hit = byTitle.get(label.trim().toLowerCase());
    if (hit && hit.status !== "publish") hit.status = "review";
    else if (!hit) rows.push({ date: null, title: label, url: null, status: "review", fields: { format: null, category: null, editor: null } });
  }

  if (!rows.length) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Publishing Log" month={month} months={months} />
        <EmptyState channel="YouTube" month={month} source="MKK Internal - Youtube Calendar Timeline" />
      </div>
    );
  }

  const count = (s: string) => rows.filter((r) => r.status === s).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Publishing Log" description={`All YouTube videos in the ${monthLabel(month)} Calendar Timeline. Click a title to open the video.`} month={month} months={months} />

      <Section title="All videos" subtitle={`${fmtNum(rows.length)} videos · ${fmtNum(count("publish"))} published · ${fmtNum(count("review"))} in review`}>
        <PublishingLogTable columns={COLUMNS} rows={rows} thumbnails />
      </Section>
    </div>
  );
}
