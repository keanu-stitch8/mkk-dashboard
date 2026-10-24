import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/blocks";
import { HistoryPager } from "@/components/HistoryPager";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CHANNEL_LABEL, DATASETS } from "@/modules/shared/lib/sources";
import { monthLabel } from "@/modules/shared/lib/month";
import type { DatasetKey } from "@/modules/import/parsers/types";
import type { ImportHistory } from "../types/import-history";
import { DeleteImportButton } from "./delete-import-button";

const fmtTime = (d: Date) => d.toLocaleString("en-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

export function ImportHistoryContent({ history: h }: { history: ImportHistory }) {
  return (
    <>
      <PageHeader
        title="Import History"
        description={`${h.total} dataset(s) stored, grouped by the session that saved them. Re-importing a month & source replaces the old data, so older sessions only show what's still stored.`}
      />

      {h.total === 0 && (
        <Section>
          <p className="text-sm text-muted-foreground">No data yet. Upload files or sync from APIs on the Import Data page.</p>
        </Section>
      )}

      {h.sessions.map((s) => {
        const { totalRows: rows, origins, months } = s;
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

      <HistoryPager page={h.page} pages={h.pages} path="/import/history" />
    </>
  );
}
