import { CircleCheck, CircleDashed, CircleX, Clock } from "lucide-react";
import { Section } from "@/components/blocks";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { monthLabel } from "@/lib/month";
import { SyncControls } from "../../shared/components/sync-controls";
import type { ConnectorSettings } from "../types/connector-settings";
import { GoogleConnectButton } from "./google-connect-button";
import { MonthLockButton } from "./month-lock-button";
import { TestConnectionButton } from "./test-connection-button";

const fmtTime = (d: Date | null | undefined) => (d ? d.toLocaleString("en-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }) : "—");

/** Judul halaman (statis) — tampil segera sebagai bagian view. */
export function ConnectorSettingsHeader() {
  return (
    <header>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Settings</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Connectors API</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pull data straight from the APIs without uploading CSVs. Results are stored in the same tables as CSV imports; CSV imports still work as a fallback.
        Credentials go in <code>.env.local</code> — see README → Connector Setup.
      </p>
    </header>
  );
}

export function ConnectorSettingsContent({ settings, connected, oauthError }: { settings: ConnectorSettings; connected: string | null; oauthError: string | null }) {
  const { cards, configured, lockRows, currentMonth, defaultSyncMonth } = settings;

  return (
    <>
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
        {cards.map((info) => {
          const { state } = info;
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
                {info.implemented && (
                  <ul className="space-y-1 text-xs">
                    {info.env.map((v) => {
                      const { filled } = v;
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
                {info.account && <p className="text-xs text-muted-foreground">{info.account}</p>}
                {info.oauth && (
                  <div className="rounded-md border border-dashed p-2.5">
                    {info.serviceAccountActive ? (
                      <p className="text-xs text-muted-foreground">A service account is in use (takes precedence). Clear GOOGLE_APPLICATION_CREDENTIALS to use a Google account.</p>
                    ) : (
                      <GoogleConnectButton connector={info.id} connected={info.oauth.connected} account={info.oauth.account ?? undefined} available={info.oauth.available} />
                    )}
                  </div>
                )}
                <div className="flex flex-wrap items-start justify-between gap-2 border-t pt-3">
                  {info.implemented ? <TestConnectionButton connector={info.id} disabled={!info.configured} /> : <span />}
                  <div className="text-right text-xs text-muted-foreground">
                    Last sync:{" "}
                    {info.lastSync ? (
                      <>
                        {fmtTime(info.lastSync.at)} · {monthLabel(info.lastSync.month)}{" "}
                        <span className={info.lastSync.ok ? "text-success" : "text-danger"}>{info.lastSync.ok ? "succeeded" : "failed"}</span>
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
        <SyncControls currentMonth={currentMonth} defaultMonth={defaultSyncMonth} configured={configured} />
      </Section>

      <Section
        title="Month locks"
        subtitle="Locked months aren't re-synced by GA4, GSC, YouTube & Meta, so report numbers don't change (lifetime per-post metrics keep growing). Publishing Logs can still be synced. Cut-off: the cron job syncs and locks last month on the 5th (07:00 WIB); Instagram per-post metrics are taken as of the 5th even if the sync runs later."
      >
        <Table>
          <TableBody>
            {lockRows.map(({ month: m, lock, current }) => {
              return (
                <TableRow key={m}>
                  <TableCell className="whitespace-nowrap">{monthLabel(m)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {lock ? `🔒 Locked ${fmtTime(lock.lockedAt)}${lock.note ? ` · ${lock.note}` : ""}` : current ? "Current month" : "Not locked"}
                  </TableCell>
                  <TableCell className="text-right">
                    <MonthLockButton month={m} locked={!!lock} disabled={!lock && current} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Section>
    </>
  );
}
