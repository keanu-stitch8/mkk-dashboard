import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/blocks";
import { HistoryPager } from "@/components/HistoryPager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BADGE } from "@/components/log-badges";
import { prisma } from "@/lib/db";
import { groupSessions, paginate } from "@/lib/data/history";
import { CONNECTORS, connectorLabel } from "@/lib/connectors/catalog";
import { monthLabel } from "@/lib/month";

export const dynamic = "force-dynamic";

const PER_PAGE = 10;
/** syncMany menjalankan connector berurutan; log berikutnya mulai begitu yang sebelumnya selesai */
const SESSION_GAP_MS = 60_000;

const TRIGGERS = {
  cron: { label: "Cron", hint: "automatic schedule" },
  manual: { label: "Manual", hint: "Sync button in the dashboard" },
  script: { label: "Script", hint: "npm run sync" },
} as const;
type Trigger = keyof typeof TRIGGERS;
const isTrigger = (t: unknown): t is Trigger => typeof t === "string" && t in TRIGGERS;

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
const isConnector = (c: unknown): c is string => typeof c === "string" && CONNECTORS.some((x) => x.id === c);

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

export default async function SyncHistoryPage({ searchParams }: PageProps<"/settings/connectors/history">) {
  const sp = await searchParams;
  const trigger = isTrigger(sp.trigger) ? sp.trigger : undefined;
  const connector = isConnector(sp.connector) ? sp.connector : undefined;
  const logs = await prisma.syncLog.findMany({
    where: trigger ? { trigger } : undefined,
    select: { id: true, connector: true, month: true, status: true, rows: true, detail: true, error: true, trigger: true, startedAt: true, finishedAt: true },
    orderBy: { startedAt: "desc" },
  });
  // sesi dibentuk dari semua connector dulu, baru disaring: kalau disaring duluan, satu sesi backfill
  // multi-bulan bisa pecah karena jeda antar-run connector yang sama melebihi SESSION_GAP_MS
  const sessions = groupSessions(logs, { start: (l) => l.startedAt, end: (l) => l.finishedAt, gapMs: SESSION_GAP_MS, sameSession: (a, b) => a.trigger === b.trigger })
    .map((s) => {
      if (!connector) return s;
      const rows = s.rows.filter((l) => l.connector === connector);
      const start = new Date(Math.min(...rows.map((l) => l.startedAt.getTime())));
      const end = new Date(Math.max(...rows.map((l) => (l.finishedAt ?? l.startedAt).getTime())));
      return { rows, start, end };
    })
    .filter((s) => s.rows.length > 0);
  const pg = paginate(sessions, Number(sp.page ?? 1), PER_PAGE);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Sync History" description="Every API sync run — automatic cron, the Sync button, or npm run sync — grouped per session." />

      <div className="no-print flex flex-col gap-2">
        <FilterRow
          label="Trigger"
          options={[undefined, ...(Object.keys(TRIGGERS) as Trigger[])].map((t) => ({
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

      {sessions.length === 0 && (
        <Section>
          <p className="text-sm text-muted-foreground">No sync runs match this filter yet.</p>
        </Section>
      )}

      {pg.items.map((s) => {
        const status = sessionStatus(s.rows.map((l) => l.status));
        const ok = s.rows.filter((l) => l.status === "success").length;
        const failed = s.rows.filter((l) => l.status === "error").length;
        const rows = s.rows.reduce((n, l) => n + l.rows, 0);
        const months = [...new Set(s.rows.map((l) => l.month))].sort().reverse();
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

      <HistoryPager page={pg.page} pages={pg.pages} path={PATH} params={{ trigger, connector }} />
    </div>
  );
}
