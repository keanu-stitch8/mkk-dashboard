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

const fmtTime = (d: Date | null | undefined) => (d ? d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }) : "—");

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
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Pengaturan</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Connectors API</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tarik data langsung dari API tanpa upload CSV. Hasilnya disimpan ke tabel yang sama dengan import CSV; import CSV tetap bisa dipakai sebagai fallback.
          Kredensial diisi di <code>.env.local</code> — lihat README → Setup Connector.
        </p>
      </header>

      {connected && (
        <Alert className="border-success/30 bg-success-soft">
          <CircleCheck className="text-success" />
          <AlertDescription>{connected} Klik “Test koneksi” untuk memastikan akses ke data.</AlertDescription>
        </Alert>
      )}
      {oauthError && (
        <Alert variant="destructive">
          <CircleX />
          <AlertDescription>{oauthError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
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
                      <CircleCheck /> Terkonfigurasi
                    </Badge>
                  )}
                  {state === "missing" && (
                    <Badge variant="outline" className="border-transparent bg-warning-soft text-warning">
                      <CircleDashed /> Belum dikonfigurasi
                    </Badge>
                  )}
                  {state === "soon" && (
                    <Badge variant="secondary">
                      <Clock /> Tahap berikutnya
                    </Badge>
                  )}
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-xs text-muted-foreground">Mengisi: {info.fills}</p>
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
                      <p className="text-xs text-muted-foreground">Service account sedang dipakai (didahulukan). Kosongkan GOOGLE_APPLICATION_CREDENTIALS untuk memakai akun Google.</p>
                    ) : (
                      <GoogleConnectButton connector={info.id} connected={st.oauth.connected} account={st.oauth.account} available={!!st.oauth.available} />
                    )}
                  </div>
                )}
                <div className="flex flex-wrap items-start justify-between gap-2 border-t pt-3">
                  {connector ? <TestConnectionButton connector={info.id} disabled={!st?.configured} /> : <span />}
                  <div className="text-right text-xs text-muted-foreground">
                    Terakhir sync:{" "}
                    {last ? (
                      <>
                        {fmtTime(last.finishedAt ?? last.startedAt)} · {monthLabel(last.month)}{" "}
                        <span className={last.status === "success" ? "text-success" : "text-danger"}>{last.status === "success" ? "berhasil" : "gagal"}</span>
                      </>
                    ) : (
                      "belum pernah"
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Section title="Sync data" subtitle="Ambil data dari semua connector yang sudah dikonfigurasi">
        <SyncControls currentMonth={currentMonth()} defaultMonth={lastFullMonth()} configured={configured} />
      </Section>

      <Section
        title="Kunci bulan"
        subtitle="Bulan terkunci tidak di-sync ulang oleh GA4, GSC, YouTube & Meta, supaya angka laporan tidak berubah (metrik lifetime per post terus bertambah). Publishing Log tetap bisa di-sync. Cron mengunci bulan lalu otomatis setelah sync tanggal 3."
      >
        <Table>
          <TableBody>
            {lockMonths.map((m) => {
              const lock = locks.find((l) => l.month === m);
              return (
                <TableRow key={m}>
                  <TableCell className="whitespace-nowrap">{monthLabel(m)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {lock ? `🔒 Dikunci ${fmtTime(lock.lockedAt)}${lock.note ? ` · ${lock.note}` : ""}` : m >= currentMonth() ? "Bulan berjalan" : "Belum dikunci"}
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

      <Section title="Riwayat sync" subtitle="50 sync terakhir">
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada sync.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Connector</TableHead>
                <TableHead>Bulan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Baris</TableHead>
                <TableHead>Keterangan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{fmtTime(l.startedAt)}</TableCell>
                  <TableCell className="whitespace-nowrap">{connectorLabel(l.connector)}</TableCell>
                  <TableCell className="whitespace-nowrap">{monthLabel(l.month)}</TableCell>
                  <TableCell>
                    {l.status === "success" && <Badge className="border-transparent bg-success-soft text-success" variant="outline">Berhasil</Badge>}
                    {l.status === "error" && <Badge className="border-transparent bg-danger-soft text-danger" variant="outline">Gagal</Badge>}
                    {l.status === "running" && <Badge variant="secondary">Berjalan</Badge>}
                    {l.trigger !== "manual" && <span className="ml-1 text-xs text-muted-foreground">({l.trigger})</span>}
                  </TableCell>
                  <TableCell className="num text-right">{l.rows.toLocaleString("id-ID")}</TableCell>
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
