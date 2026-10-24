import { ExternalLink } from "lucide-react";
import { Section } from "@/components/blocks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { monthLabel } from "@/lib/month";
import { sourceLogKey } from "../lib/source-logs";
import type { SourceLogs } from "../types/source-logs";

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

export function SourceLogsContent({ logs }: { logs: SourceLogs }) {
  const { month, history, sources: LOG_SOURCES, imports } = logs;
  const find = (m: string, key: string) => imports[sourceLogKey(m, key)];

  return (
    <>
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
              const count = imp?.count;
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
    </>
  );
}
