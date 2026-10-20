import { PageHeader } from "@/components/PageHeader";
import { EmptyState, Section } from "@/components/blocks";
import { PublishingLogTable, type LogColumn, type LogRow } from "@/components/PublishingLogTable";
import { BADGE } from "@/components/log-badges";
import { prisma } from "@/lib/db";
import { resolveMonth } from "@/lib/data/summary";
import { fmtNum } from "@/lib/format";
import { monthLabel } from "@/lib/month";

export const dynamic = "force-dynamic";

const COLUMNS: LogColumn[] = [
  { key: "format", label: "Format", badges: { "editorial feature video": BADGE.blue, recap: BADGE.violet } },
  { key: "category", label: "Kategori" },
];

/** Log video YouTube per bulan — Summary (Calendar Timeline) + in review dari Gantt, tanpa views/metrics. */
export default async function YoutubeLogsPage({ searchParams }: PageProps<"/youtube/logs">) {
  const { month, months } = await resolveMonth((await searchParams).m);
  const [logs, reviewItems] = await Promise.all([
    prisma.ytLog.findMany({ where: { month }, select: { date: true, title: true, url: true, videoId: true, format: true, category: true, status: true } }),
    prisma.breakdown.findMany({ where: { month, channel: "youtube", dimension: "yt_in_review", import: { source: "yt_review" } }, select: { label: true } }),
  ]);

  const rows: LogRow[] = logs.map((l) => ({
    date: l.date,
    title: l.title,
    url: l.url,
    status: l.status,
    fields: { format: l.format, category: l.category },
    // thumbnail "medium" YouTube Data API = 320×180 (16:9); high/standard 4:3
    thumb: l.videoId ? `https://i.ytimg.com/vi/${l.videoId}/mqdefault.jpg` : null,
  }));
  // video in review (Gantt) yang sudah ada di Summary cukup ditandai review; sisanya ditambahkan tanpa tanggal
  const byTitle = new Map(rows.map((r) => [r.title.trim().toLowerCase(), r]));
  for (const { label } of reviewItems) {
    const hit = byTitle.get(label.trim().toLowerCase());
    if (hit && hit.status !== "publish") hit.status = "review";
    else if (!hit) rows.push({ date: null, title: label, url: null, status: "review", fields: { format: null, category: null } });
  }

  if (!rows.length) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader title="Publishing Log" month={month} months={months} />
        <EmptyState channel="YouTube" month={month} source="MKK Internal - Youtube Calendar Timeline" />
      </div>
    );
  }

  const count = (s: string) => rows.filter((r) => r.status === s).length;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader title="Publishing Log" description={`Semua video YouTube di Calendar Timeline ${monthLabel(month)}. Klik judul untuk membuka video.`} month={month} months={months} />

      <Section title="Semua video" subtitle={`${fmtNum(rows.length)} video · ${fmtNum(count("publish"))} published · ${fmtNum(count("review"))} in review`}>
        <PublishingLogTable columns={COLUMNS} rows={rows} thumbnails />
      </Section>
    </div>
  );
}
