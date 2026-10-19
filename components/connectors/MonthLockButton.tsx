"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MonthLockButton({ month, locked, disabled }: { month: string; locked: boolean; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/connectors/lock", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ month, locked: !locked }) });
    if (!res.ok) setError(((await res.json()) as { error?: string }).error ?? "Gagal");
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" onClick={toggle} disabled={busy || disabled}>
        {busy ? <Loader2 className="animate-spin" /> : locked ? <LockOpen /> : <Lock />} {locked ? "Buka kunci" : "Kunci"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
