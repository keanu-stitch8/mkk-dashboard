"use client";

import { useState } from "react";
import { CircleCheck, CircleX, Loader2, PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TestConnectionButton({ connector, disabled }: { connector: string; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const run = async () => {
    setBusy(true);
    setResult(null);
    const res = await fetch("/api/connectors/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ connector }) });
    setResult((await res.json()) as { ok: boolean; message: string });
    setBusy(false);
  };

  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" onClick={run} disabled={busy || disabled}>
        {busy ? <Loader2 className="animate-spin" /> : <PlugZap />} Test connection
      </Button>
      {result && (
        <p className={`flex gap-1.5 text-xs ${result.ok ? "text-success" : "text-danger"}`}>
          {result.ok ? <CircleCheck className="mt-0.5 size-3.5 shrink-0" /> : <CircleX className="mt-0.5 size-3.5 shrink-0" />}
          {result.message}
        </p>
      )}
    </div>
  );
}
