import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/blocks";
import { HistoryPager } from "@/components/HistoryPager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BADGE } from "@/components/log-badges";
import { monthLabel } from "@/lib/month";
import { CONNECTORS, connectorLabel } from "@/lib/connectors/catalog";
import { isTrigger, TRIGGERS } from "../lib/sync-history";
import type { SyncHistory, SyncTrigger } from "../types/sync-history";

const STATUS: Record<string, { label: string; className: string }> = {
  success: { label: "Success", className: BADGE.green },
  error: { label: "Error", className: BADGE.red },
  running: { label: "Running", className: BADGE.blue },
};

const fmtTime = (d: Date) => d.toLocaleString("en-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
function fmtDuration(ms: number) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

const PATH = "/settings/connectors/history";
const filterHref = (params: { trigger?: string; connector?: string }) => {
  const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => e[1] != null));
  return q.size ? `${PATH}?${q}` : PATH;
};

/** Baris tombol filter; tombol aktif = secondary. */
function FilterRow({ label, options }: { label: string; options: { key: string; label: string; href: string; active: boolean; hint?: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-20 text-xs font-medium text-muted-foreground">{label}</span>
      {options.map((o) => (
        <Button key={o.key} asChild size="sm" variant={o.active ? "secondary" : "ghost"} title={o.hint}>
          <Link href={o.href}>{o.label}</Link>
        </Button>
      ))}
    </div>
  );
}

/** Status satu sesi: semua sukses, sebagian gagal, semua gagal, atau masih berjalan. */
function sessionStatus(statuses: string[]) {
  if (statuses.includes("running")) return STATUS.running;
  const errors = statuses.filter((s) => s === "error").length;
  if (errors === 0) return STATUS.success;
  if (errors === statuses.length) return { label: "Failed", className: BADGE.red };
  return { label: "Partial", className: BADGE.orange };
}

export function SyncHistoryContent({ history: h }: { history: SyncHistory }) {
  const { trigger, connector } = h;

  return (
    <>
      <PageHeader title="Sync History" description="Every API sync run — automatic cron, the Sync button, or npm run sync — grouped per session." />

      <div className="no-print flex flex-col gap-2">
        <FilterRow
          label="Trigger"
          options={[undefined, ...(Object.keys(TRIGGERS) as SyncTrigger[])].map((t) => ({
            key: t ?? "all",
            label: t ? TRIGGERS[t].label : "All",
            hint: t && TRIGGERS[t].hint,
            href: filterHref({ trigger: t, connector }),
            active: t === trigger,
          }))}
        />
        <FilterRow
          label="Connector"
          options={[undefined, ...CONNECTORS.map((c) => c.id)].map((c) => ({
            key: c ?? "all",
            label: c ? connectorLabel(c) : "All",
            href: filterHref({ trigger, connector: c }),
            active: c === connector,
          }))}
        />
      </div>

      {h.total === 0 && (
        <Section>
          <p className="text-sm text-muted-foreground">No sync runs match this filter yet.</p>
        </Section>
      )}

      {h.sessions.map((s) => {
        const status = sessionStatus(s.rows.map((l) => l.status));
        const { ok, failed, totalRows: rows, months } = s;
        const trig = isTrigger(s.rows[0].trigger) ? TRIGGERS[s.rows[0].trigger] : { label: s.rows[0].trigger, hint: "" };
        return (
          <Section
            key={s.rows[0].id}
            title={fmtTime(s.start)}
            subtitle={[
              `${s.rows.length} run(s)`,
              `${ok} success`,
              failed ? `${failed} error` : null,
              `${rows.toLocaleString("en-ID")} rows`,
              months.map((m) => monthLabel(m)).join(", "),
              fmtDuration(s.end.getTime() - s.start.getTime()),
            ]
              .filter(Boolean)
              .join(" · ")}
            action={
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" title={trig.hint}>
                  {trig.label}
                </Badge>
                <Badge variant="secondary" className={status.className}>
                  {status.label}
                </Badge>
              </div>
            }
          >
            {/* lebar kolom tetap supaya tabel antar sesi sejajar */}
            <Table className="min-w-[720px] table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-56">Connector</TableHead>
                  <TableHead className="w-32">Month</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-20 text-right">Rows</TableHead>
                  <TableHead className="w-24 text-right">Duration</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.rows.map((l) => {
                  const st = STATUS[l.status] ?? { label: l.status, className: BADGE.gray };
                  const lines = l.detail?.split("\n").filter(Boolean) ?? [];
                  return (
                    <TableRow key={l.id} className="align-top">
                      <TableCell className="truncate" title={connectorLabel(l.connector)}>{connectorLabel(l.connector)}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{monthLabel(l.month)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={st.className}>
                          {st.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="num text-right text-xs text-muted-foreground">{l.rows.toLocaleString("en-ID")}</TableCell>
                      <TableCell className="num text-right text-xs text-muted-foreground">{l.finishedAt ? fmtDuration(l.finishedAt.getTime() - l.startedAt.getTime()) : "–"}</TableCell>
                      <TableCell className="text-xs whitespace-normal">
                        {l.error ? (
                          <span className="text-destructive">{l.error}</span>
                        ) : lines.length ? (
                          <details>
                            <summary className="cursor-pointer text-muted-foreground">{lines.length} dataset line(s)</summary>
                            <ul className="mt-1 space-y-0.5 text-muted-foreground">
                              {lines.map((d, i) => (
                                <li key={i} className={d.startsWith("⚠") ? "text-attention" : undefined}>
                                  {d}
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Section>
        );
      })}

      <HistoryPager page={h.page} pages={h.pages} path={PATH} params={{ trigger, connector }} />
    </>
  );
}
