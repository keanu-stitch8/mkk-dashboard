import { PageHeader } from "@/components/PageHeader";
import { EmptyState, Section } from "@/components/blocks";
import { PublishingLogTable, type LogColumn, type LogRow, type ThumbRatio } from "@/components/PublishingLogTable";
import { platformLabels, socialFormatLabel } from "@/lib/taxonomy";
import { getSocialSummary, resolveMonth } from "@/lib/data/summary";
import { igThumbs } from "@/lib/data/ig-thumbs";
import { fmtNum } from "@/lib/format";
import { monthLabel } from "@/lib/month";

export const dynamic = "force-dynamic";

// kategori sosmed = pilar konten (khusus channel ini), tetap nilai Publishing Log
const COLUMNS: LogColumn[] = [
  { key: "format", label: "Format", badge: "format" },
  { key: "category", label: "Category", badge: "outline" },
  { key: "platform", label: "Platform", badge: "outline", multi: true },
  { key: "designer", label: "Designer" },
];
/** Kotak thumbnail Instagram 4:5 (rasio feed); reels 9:16 dipotong di tengah. */
const IG_RATIO: ThumbRatio = "4:5";

/** Log konten Social Media per bulan — publishing log + in review dari Task Progress, tanpa views/metrics. */
export default async function SocialLogsPage({ searchParams }: PageProps<"/social/logs">) {
  const { month, months } = await resolveMonth((await searchParams).m);
  const s = await getSocialSummary(month);
  // thumbnail = gambar post IG pasangannya (diunduh & disimpan lokal). Story tidak punya caption sehingga tidak bisa
  // dipasangkan ke story IG tertentu, dan API tidak memberi gambar story yang sudah lewat 24 jam → story tanpa link/gambar.
  const igThumb = await igThumbs(s.logs.flatMap((l) => (l.igMediaId ? [l.igMediaId] : [])));

  const rows: LogRow[] = s.logs.map((l) => ({
    date: l.date,
    title: l.title ?? "(untitled)",
    url: l.link,
    status: l.status,
    fields: { format: socialFormatLabel(l.format), category: l.category, platform: platformLabels(l.platform).join(", ") || null, designer: l.designer },
    thumb: l.igMediaId ? (igThumb.get(l.igMediaId) ?? null) : null,
    thumbRatio: IG_RATIO,
  }));
  // in review dari tracker Task Progress: label "format · judul", tanpa tanggal tayang
  for (const label of s.inReviewItems) {
    const [format, ...title] = label.split(" · ");
    rows.push({ date: null, title: title.join(" · ") || "(untitled)", url: null, status: "review", fields: { format: socialFormatLabel(format), category: null, platform: null, designer: null }, thumbRatio: IG_RATIO });
  }

  if (!rows.length) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Publishing Log" month={month} months={months} />
        <EmptyState channel="Social Media" month={month} source="MKK Kudus Social Media - Publishing Log" />
      </div>
    );
  }

  const count = (st: string) => rows.filter((r) => r.status === st).length;
  const withLink = rows.filter((r) => r.url).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Publishing Log"
        description={`All Social Media content in the ${monthLabel(month)} publishing log. Titles are clickable when the post matches an Instagram post (stories can't be matched).`}
        month={month}
        months={months}
      />

      <Section
        title="All content"
        subtitle={`${fmtNum(rows.length)} items · ${fmtNum(count("publish"))} published · ${fmtNum(count("review"))} in review · ${fmtNum(withLink)} with link`}
      >
        <PublishingLogTable columns={COLUMNS} rows={rows} thumbnails />
      </Section>
    </div>
  );
}
