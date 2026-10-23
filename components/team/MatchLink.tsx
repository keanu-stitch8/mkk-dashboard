"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleHelp, ExternalLink, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BADGE } from "@/components/log-badges";
import type { Linked, LinkView } from "@/lib/data/team";

const fmtDate = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-ID", { day: "numeric", month: "short" }) : "");

function Target({ v }: { v: LinkView }) {
  const label = [v.format, fmtDate(v.date)].filter(Boolean).join(" · ");
  return (
    <span className="min-w-0">
      {v.url ? (
        <a href={v.url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
          {v.title}
          <ExternalLink className="ml-1 inline size-3 text-muted-foreground" />
        </a>
      ) : (
        v.title
      )}
      {label && <span className="ml-1.5 text-xs text-muted-foreground">{label}</span>}
    </span>
  );
}

/**
 * Pasangan satu tahap: cocok (auto / dikonfirmasi), saran yang menunggu keputusan, atau belum ada.
 * Saran tidak pernah ditampilkan sebagai "cocok" — tim memutuskan lewat tombol Confirm / Not this.
 */
export function MatchLink({ linked, empty }: { linked: Linked; empty: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (id: string, decision: "confirmed" | "rejected") => {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/team/matches/${encodeURIComponent(id)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision }) });
    if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't save. Try again.");
    setBusy(null);
    router.refresh();
  };

  if (linked.match) {
    const m = linked.match;
    return (
      <div className="flex flex-col items-start gap-1 text-sm">
        <Badge variant="secondary" className={BADGE.green} title={m.state === "auto" ? "Matched automatically (strong title match)" : "Confirmed by the team"}>
          <Check /> {m.state === "auto" ? "Matched · auto" : "Confirmed"}
        </Badge>
        <Target v={m} />
      </div>
    );
  }
  if (!linked.suggestions.length) return <span className="text-sm text-muted-foreground">{empty}</span>;
  return (
    <div className="flex flex-col items-start gap-2 text-sm">
      <Badge variant="secondary" className={BADGE.blue}>
        <CircleHelp /> Needs confirmation
      </Badge>
      {linked.suggestions.slice(0, 2).map((s) => (
        <div key={s.id} className="flex flex-col items-start gap-1">
          <Target v={s} />
          <div className="flex gap-1">
            <Button size="xs" variant="outline" disabled={!!busy} onClick={() => decide(s.id, "confirmed")}>
              <Check /> {busy === s.id ? "…" : "Confirm"}
            </Button>
            <Button size="xs" variant="ghost" disabled={!!busy} onClick={() => decide(s.id, "rejected")}>
              <X /> Not this
            </Button>
          </div>
        </div>
      ))}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
