import { CircleCheck, CircleDashed, CircleX, Clock } from "lucide-react";
import { Section } from "@/components/blocks";
import { SyncControls } from "@/components/connectors/SyncControls";
import { TestConnectionButton } from "@/components/connectors/TestConnectionButton";
import { MonthLockButton } from "@/components/connectors/MonthLockButton";
import { GoogleConnectButton } from "@/components/connectors/GoogleConnectButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { REGISTRY, lastFullMonth } from "@/lib/connectors";
import { CONNECTORS, connectorLabel } from "@/lib/connectors/catalog";
import { OAUTH_ONLY } from "@/lib/connectors/google-oauth";
import { currentMonth, lastMonths, monthLabel } from "@/lib/month";

export const dynamic = "force-dynamic";

const fmtTime = (d: Date | null | undefined) => (d ? d.toLocaleString("en-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }) : "—");

export default async function ConnectorsPage({ searchParams }: PageProps<"/settings/connectors">) {
  const sp = await searchParams;
  const connected = typeof sp.connected === "string" ? sp.connected : null;
  const oauthError = typeof sp.error === "string" ? sp.error : null;
  const [logs, lastPerConnector, locks] = await Promise.all([
    prisma.syncLog.findMany({ orderBy: { startedAt: "desc" }, take: 50 }),
    Promise.all(CONNECTORS.map((c) => prisma.syncLog.findFirst({ where: { connector: c.id, status: { not: "running" } }, orderBy: { startedAt: "desc" } }))),
    prisma.monthLock.findMany(),
  ]);
  const lockMonths = [...new Set([...lastMonths(currentMonth(), 6), ...locks.map((l) => l.month)])].sort().reverse();
  const statuses = await Promise.all(CONNECTORS.map((c) => REGISTRY[c.id]?.status() ?? Promise.resolve(null)));
  const configured = CONNECTORS.filter((_, i) => statuses[i]?.configured).map((c) => c.id);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Settings</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Connectors API</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pull data straight from the APIs without uploading CSVs. Results are stored in the same tables as CSV imports; CSV imports still work as a fallback.
          Credentials go in <code>.env.local</code> — see README → Connector Setup.
        </p>
      </header>

      {connected && (
        <Alert className="border-success/30 bg-success-soft">
          <CircleCheck className="text-success" />
          <AlertDescription>{connected} Click “Test connection” to confirm data access.</AlertDescription>
        </Alert>
      )}
      {oauthError && (
        <Alert variant="destructive">
          <CircleX />
          <AlertDescription>{oauthError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {CONNECTORS.map((info, i) => {
          const st = statuses[i];
          const connector = REGISTRY[info.id];
          const last = lastPerConnector[i];
          const state = !info.available || !connector ? "soon" : st?.configured ? "ready" : "missing";
          return (
            <Card key={info.id}>
              <CardHeader>
                <CardTitle>{info.label}</CardTitle>
                <CardDescription>{info.description}</CardDescription>
                <CardAction>
                  {state === "ready" && (
                    <Badge variant="outline" className="border-transparent bg-success-soft text-success">
                      <CircleCheck /> Configured
                    </Badge>
                  )}
                  {state === "missing" && (
                    <Badge variant="outline" className="border-transparent bg-warning-soft text-warning">
                      <CircleDashed /> Not configured
                    </Badge>
                  )}
                  {state === "soon" && (
                    <Badge variant="secondary">
                      <Clock /> Coming next
                    </Badge>
                  )}
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-xs text-muted-foreground">Provides: {info.fills}</p>
                {connector && (
                  <ul className="space-y-1 text-xs">
                    {connector.env.map((v) => {
                      const filled = !!process.env[v.name]?.trim();
                      return (
                        <li key={v.name} className="flex gap-1.5">
                          {filled ? <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-success" /> : <CircleX className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
                          <span>
                            <code className="font-medium">{v.name}</code> <span className="text-muted-foreground">— {v.hint}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {st?.account && <p className="text-xs text-muted-foreground">{st.account}</p>}
                {st?.oauth && (
                  <div className="rounded-md border border-dashed p-2.5">
                    {process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() && !OAUTH_ONLY.includes(info.id as never) ? (
                      <p className="text-xs text-muted-foreground">A service account is in use (takes precedence). Clear GOOGLE_APPLICATION_CREDENTIALS to use a Google account.</p>
                    ) : (
                      <GoogleConnectButton connector={info.id} connected={st.oauth.connected} account={st.oauth.account} available={!!st.oauth.available} />
                    )}
                  </div>
                )}
                <div className="flex flex-wrap items-start justify-between gap-2 border-t pt-3">
                  {connector ? <TestConnectionButton connector={info.id} disabled={!st?.configured} /> : <span />}
                  <div className="text-right text-xs text-muted-foreground">
                    Last sync:{" "}
                    {last ? (
                      <>
                        {fmtTime(last.finishedAt ?? last.startedAt)} · {monthLabel(last.month)}{" "}
                        <span className={last.status === "success" ? "text-success" : "text-danger"}>{last.status === "success" ? "succeeded" : "failed"}</span>
                      </>
                    ) : (
                      "never"
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Section title="Sync data" subtitle="Fetch data from every configured connector">
        <SyncControls currentMonth={currentMonth()} defaultMonth={lastFullMonth()} configured={configured} />
      </Section>

      <Section
        title="Month locks"
        subtitle="Locked months aren't re-synced by GA4, GSC, YouTube & Meta, so report numbers don't change (lifetime per-post metrics keep growing). Publishing Logs can still be synced. The cron job locks last month automatically after the sync on the 3rd."
      >
        <Table>
          <TableBody>
            {lockMonths.map((m) => {
              const lock = locks.find((l) => l.month === m);
              return (
                <TableRow key={m}>
                  <TableCell className="whitespace-nowrap">{monthLabel(m)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {lock ? `🔒 Locked ${fmtTime(lock.lockedAt)}${lock.note ? ` · ${lock.note}` : ""}` : m >= currentMonth() ? "Current month" : "Not locked"}
                  </TableCell>
                  <TableCell className="text-right">
                    <MonthLockButton month={m} locked={!!lock} disabled={!lock && m >= currentMonth()} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Section>

      <Section title="Sync history" subtitle="Last 50 syncs">
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No syncs yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Connector</TableHead>
                <TableHead>Month</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Rows</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{fmtTime(l.startedAt)}</TableCell>
                  <TableCell className="whitespace-nowrap">{connectorLabel(l.connector)}</TableCell>
                  <TableCell className="whitespace-nowrap">{monthLabel(l.month)}</TableCell>
                  <TableCell>
                    {l.status === "success" && <Badge className="border-transparent bg-success-soft text-success" variant="outline">Succeeded</Badge>}
                    {l.status === "error" && <Badge className="border-transparent bg-danger-soft text-danger" variant="outline">Failed</Badge>}
                    {l.status === "running" && <Badge variant="secondary">Running</Badge>}
                    {l.trigger !== "manual" && <span className="ml-1 text-xs text-muted-foreground">({l.trigger})</span>}
                  </TableCell>
                  <TableCell className="num text-right">{l.rows.toLocaleString("en-ID")}</TableCell>
                  <TableCell className="max-w-md text-xs whitespace-normal">
                    {l.error ? <span className="text-danger">{l.error}</span> : <span className="text-muted-foreground">{l.detail?.split("\n").join(" · ")}</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}
