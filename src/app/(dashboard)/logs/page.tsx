import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/blocks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { firstParam } from "@/modules/shared/lib/month-param";
import { resolveMonth } from "@/modules/shared/queries/month-query";
import { LOG_FILES, TRACKER_FILES } from "@/lib/connectors/sheets/map";
import { lastMonths, monthLabel } from "@/lib/month";
import type { DatasetKey } from "@/lib/parsers/types";

export const dynamic = "force-dynamic";

/** Data log yang ditarik dari Google Sheets, urut per channel. */
const LOG_SOURCES: { key: DatasetKey; channel: string; data: string; file: string }[] = [
  { key: "news_log", channel: "News", data: "Articles (published + in review)", file: LOG_FILES.news.label },
  { key: "social_log", channel: "Social", data: "Published content", file: LOG_FILES.social.label },
  { key: "social_review", channel: "Social", data: "In review", file: TRACKER_FILES.social.label },
  { key: "yt_log", channel: "YouTube", data: "Video published", file: `${TRACKER_FILES.youtube.label} · tab Summary` },
  { key: "yt_review", channel: "YouTube", data: "In review", file: `${TRACKER_FILES.youtube.label} · tab Tracker (Gantt)` },
];

const fmtTime = (d: Date) => d.toLocaleString("en-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
const shortName = (fileName: string) => fileName.replace(/^Google Sheets · /, "");

function FileLink({ name, url }: { name: string; url: string | null }) {
  if (!url) return <span>{shortName(name)}</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
      {shortName(name)}
      <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
    </a>
  );
}

export default async function LogsPage({ searchParams }: PageProps<"/logs">) {
  const { month, months } = await resolveMonth(firstParam((await searchParams).m));
  const history = lastMonths(month, 6).reverse();
  const imports = await prisma.import.findMany({
    where: { month: { in: history }, source: { in: LOG_SOURCES.map((s) => s.key) } },
    select: { month: true, source: true, fileName: true, fileUrl: true, rowCount: true, note: true, createdAt: true, metrics: { select: { key: true, value: true } } },
  });
  const find = (m: string, key: DatasetKey) => imports.find((i) => i.month === m && i.source === key);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Source Logs"
        description="Google Sheets files pulled by the Sheets connector as logs, per month. Click a file name to open it."
        month={month}
        months={months}
      />

      <Section title={`Used for ${monthLabel(month)}`} subtitle="In review = end-of-month snapshot: submitted this month, not yet published by month end">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Channel</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>File</TableHead>
              <TableHead className="text-right">Count</TableHead>
              <TableHead>Last sync</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {LOG_SOURCES.map((s) => {
              const imp = find(month, s.key);
              const count = s.key.endsWith("_review") ? imp?.metrics.find((m) => m.key.endsWith("_in_review"))?.value : imp?.rowCount;
              return (
                <TableRow key={s.key}>
                  <TableCell className="font-medium">{s.channel}</TableCell>
                  <TableCell>{s.data}</TableCell>
                  <TableCell className="max-w-md whitespace-normal">
                    {imp ? <FileLink name={imp.fileName} url={imp.fileUrl} /> : <span className="text-muted-foreground">None yet · looking for: {s.file}</span>}
                    {imp?.note && <p className="mt-1 text-xs whitespace-pre-line text-muted-foreground">{imp.note}</p>}
                  </TableCell>
                  <TableCell className="num text-right">{count ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{imp ? fmtTime(imp.createdAt) : "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Section>

      <Section title="Last 6 months" subtitle="Files stored per month; “—” = not synced yet or file not found">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              {LOG_SOURCES.map((s) => (
                <TableHead key={s.key}>
                  {s.channel} · {s.data}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((m) => (
              <TableRow key={m}>
                <TableCell className="font-medium">{monthLabel(m)}</TableCell>
                {LOG_SOURCES.map((s) => {
                  const imp = find(m, s.key);
                  return (
                    <TableCell key={s.key} className="max-w-56 text-xs whitespace-normal">
                      {imp ? <FileLink name={imp.fileName} url={imp.fileUrl} /> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    </div>
  );
}
