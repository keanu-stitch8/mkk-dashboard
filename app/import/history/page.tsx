import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/blocks";
import { HistoryPager } from "@/components/HistoryPager";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeleteImportButton } from "@/components/import/DeleteImportButton";
import { prisma } from "@/lib/db";
import { groupSessions, paginate } from "@/lib/data/history";
import { CHANNEL_LABEL, DATASETS } from "@/lib/sources";
import { monthLabel } from "@/lib/month";
import type { DatasetKey } from "@/lib/parsers/types";

export const dynamic = "force-dynamic";

const PER_PAGE = 10;
/** dataset dari satu sync / satu sesi upload ditulis beruntun; jeda > 5 menit = sesi baru */
const SESSION_GAP_MS = 5 * 60_000;

const fmtTime = (d: Date) => d.toLocaleString("en-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

/** Asal dataset dari nama file yang disimpan saat commit (API connector, Sheets connector, atau file upload). */
function origin(fileName: string) {
  if (fileName.startsWith("API ")) return "API sync";
  if (fileName.startsWith("Google Sheets · ")) return "Google Sheets";
  return "File upload";
}

export default async function ImportHistoryPage({ searchParams }: PageProps<"/import/history">) {
  const { page } = await searchParams;
  const imports = await prisma.import.findMany({
    select: { id: true, month: true, source: true, fileName: true, fileUrl: true, rowCount: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const sessions = groupSessions(imports, { start: (i) => i.createdAt, gapMs: SESSION_GAP_MS });
  const pg = paginate(sessions, Number(page ?? 1), PER_PAGE);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Import History"
        description={`${imports.length} dataset(s) stored, grouped by the session that saved them. Re-importing a month & source replaces the old data, so older sessions only show what's still stored.`}
      />

      {imports.length === 0 && (
        <Section>
          <p className="text-sm text-muted-foreground">No data yet. Upload files or sync from APIs on the Import Data page.</p>
        </Section>
      )}

      {pg.items.map((s) => {
        const rows = s.rows.reduce((n, i) => n + i.rowCount, 0);
        const origins = [...new Set(s.rows.map((i) => origin(i.fileName)))];
        const months = [...new Set(s.rows.map((i) => i.month))].sort().reverse();
        return (
          <Section
            key={s.rows[0].id}
            title={fmtTime(s.start)}
            subtitle={`${s.rows.length} dataset(s) · ${rows.toLocaleString("en-ID")} rows · ${months.map((m) => monthLabel(m)).join(", ")}`}
            action={
              <div className="flex flex-wrap gap-1.5">
                {origins.map((o) => (
                  <Badge key={o} variant="outline">
                    {o}
                  </Badge>
                ))}
              </div>
            }
          >
            {/* lebar kolom tetap supaya tabel antar sesi sejajar */}
            <Table className="min-w-[720px] table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Channel</TableHead>
                  <TableHead className="w-64">Dataset</TableHead>
                  <TableHead className="w-32">Month</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead className="w-20 text-right">Rows</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.rows.map((i) => {
                  const meta = DATASETS[i.source as DatasetKey];
                  return (
                    <TableRow key={i.id}>
                      <TableCell>
                        <Badge variant="outline">{meta ? CHANNEL_LABEL[meta.channel] : "?"}</Badge>
                      </TableCell>
                      <TableCell className="truncate" title={meta?.label ?? i.source}>{meta?.label ?? i.source}</TableCell>
                      <TableCell className="text-muted-foreground">{monthLabel(i.month)}</TableCell>
                      <TableCell className="truncate text-xs text-muted-foreground" title={i.fileName}>
                        {i.fileUrl ? (
                          <a href={i.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
                            {i.fileName}
                            <ExternalLink className="size-3 shrink-0" />
                          </a>
                        ) : (
                          i.fileName
                        )}
                      </TableCell>
                      <TableCell className="num text-right text-xs text-muted-foreground">{i.rowCount.toLocaleString("en-ID")}</TableCell>
                      <TableCell className="text-right">
                        <DeleteImportButton id={i.id} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Section>
        );
      })}

      <HistoryPager page={pg.page} pages={pg.pages} path="/import/history" />
    </div>
  );
}
