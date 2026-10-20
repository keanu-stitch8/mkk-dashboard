import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/blocks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { resolveMonth } from "@/lib/data/summary";
import { LOG_FILES, TRACKER_FILES } from "@/lib/connectors/sheets/map";
import { lastMonths, monthLabel } from "@/lib/month";
import type { DatasetKey } from "@/lib/parsers/types";

export const dynamic = "force-dynamic";

/** Data log yang ditarik dari Google Sheets, urut per channel. */
const LOG_SOURCES: { key: DatasetKey; channel: string; data: string; file: string }[] = [
  { key: "news_log", channel: "News", data: "Artikel (published + in review)", file: LOG_FILES.news.label },
  { key: "social_log", channel: "Social", data: "Konten published", file: LOG_FILES.social.label },
  { key: "social_review", channel: "Social", data: "In review", file: TRACKER_FILES.social.label },
  { key: "yt_log", channel: "YouTube", data: "Video published", file: `${TRACKER_FILES.youtube.label} · tab Summary` },
  { key: "yt_review", channel: "YouTube", data: "In review", file: `${TRACKER_FILES.youtube.label} · tab Tracker (Gantt)` },
];

const fmtTime = (d: Date) => d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
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
  const { month, months } = await resolveMonth((await searchParams).m);
  const history = lastMonths(month, 6).reverse();
  const imports = await prisma.import.findMany({
    where: { month: { in: history }, source: { in: LOG_SOURCES.map((s) => s.key) } },
    select: { month: true, source: true, fileName: true, fileUrl: true, rowCount: true, note: true, createdAt: true, metrics: { select: { key: true, value: true } } },
  });
  const find = (m: string, key: DatasetKey) => imports.find((i) => i.month === m && i.source === key);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Sumber Logs"
        description="File Google Sheets yang ditarik connector Sheets sebagai log, per bulan. Klik nama file untuk membukanya."
        month={month}
        months={months}
      />

      <Section title={`Dipakai untuk ${monthLabel(month)}`} subtitle="In review = snapshot akhir bulan: diserahkan bulan ini, belum tayang per akhir bulan">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Channel</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>File</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
              <TableHead>Terakhir sync</TableHead>
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
                    {imp ? <FileLink name={imp.fileName} url={imp.fileUrl} /> : <span className="text-muted-foreground">Belum ada · dicari: {s.file}</span>}
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

      <Section title="6 bulan terakhir" subtitle="File yang tersimpan per bulan; “—” = belum di-sync atau file tidak ditemukan">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bulan</TableHead>
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
