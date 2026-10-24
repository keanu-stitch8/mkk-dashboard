"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleX, History, Loader2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { connectorLabel } from "@/modules/connectors/sources/catalog";
import { monthLabel } from "@/modules/shared/lib/month";

interface Result {
  connector: string;
  month: string;
  ok: boolean;
  rows: number;
  detail: string[];
  error?: string;
}

/** Tombol sync dari API: bulan berjalan, bulan tertentu, dan backfill 6 bulan. */
export function SyncControls({ currentMonth, defaultMonth, configured }: { currentMonth: string; defaultMonth: string; configured: string[] }) {
  const router = useRouter();
  const [month, setMonth] = useState(defaultMonth);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (label: string, body: Record<string, unknown>) => {
    setBusy(label);
    setError(null);
    setResults(null);
    try {
      const res = await fetch("/api/connectors/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json()) as { results?: Result[]; error?: string };
      if (json.error) throw new Error(json.error);
      setResults(json.results ?? []);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!configured.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No API connectors configured yet. Add credentials to <code>.env.local</code>, then check{" "}
        <a href="/settings/connectors" className="font-medium text-primary hover:underline">
          Settings → Connectors
        </a>
        .
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Active connectors: {configured.map(connectorLabel).join(", ")}. A sync replaces data for the same month & source (including CSV imports).</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => run("now", { month: currentMonth })} disabled={!!busy}>
          {busy === "now" ? <Loader2 className="animate-spin" /> : <RefreshCw />} Sync this month ({monthLabel(currentMonth)})
        </Button>
        <div className="flex items-center gap-1">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" aria-label="Month to re-sync" />
          <Button variant="outline" onClick={() => run("month", { month })} disabled={!!busy || !month}>
            {busy === "month" ? <Loader2 className="animate-spin" /> : <RefreshCw />} Sync ulang
          </Button>
        </div>
        <Button variant="outline" onClick={() => run("backfill", { backfill: 6 })} disabled={!!busy}>
          {busy === "backfill" ? <Loader2 className="animate-spin" /> : <History />} Backfill 6 months
        </Button>
      </div>
      {busy && <p className="text-xs text-muted-foreground">Fetching data from the APIs… (can take 10–60 seconds per month)</p>}
      {error && (
        <Alert variant="destructive">
          <CircleX />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {results && (
        <ul className="space-y-2 text-sm">
          {results.map((r, i) => (
            <li key={i} className="rounded-lg border p-2.5">
              <div className="flex items-center gap-2 font-medium">
                {r.ok ? <CircleCheck className="size-4 text-success" /> : <CircleX className="size-4 text-danger" />}
                {connectorLabel(r.connector)} · {monthLabel(r.month)}
                {r.ok && <span className="num font-normal text-muted-foreground">— {r.rows.toLocaleString("en-ID")} rows</span>}
              </div>
              {r.error && <p className="mt-1 text-xs text-danger">{r.error}</p>}
              {r.detail.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{r.detail.join(" · ")}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Tombol ringkas untuk header Overview: sync bulan yang sedang dilihat. */
export function SyncMonthButton({ month, disabled }: { month: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/connectors/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ month }) });
    const json = (await res.json()) as { results?: Result[]; error?: string };
    setBusy(false);
    if (json.error) setMsg(json.error);
    else {
      const failed = (json.results ?? []).filter((r) => !r.ok);
      setMsg(failed.length ? `${failed.length} connector(s) failed — see Settings → Connectors` : "Sync complete");
      router.refresh();
    }
  };
  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      <Button variant="outline" onClick={run} disabled={busy || disabled} title={disabled ? "No API connectors configured yet" : undefined}>
        {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Sync {monthLabel(month)}
      </Button>
    </div>
  );
}
