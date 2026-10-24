"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Loader2, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Hubungkan / putuskan akun Google (OAuth) untuk satu connector. */
export function GoogleConnectButton({ connector, connected, account, available }: { connector: string; connected: boolean; account?: string; available: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!available) {
    return <p className="text-xs text-muted-foreground">Google sign-in: set GOOGLE_OAUTH_CLIENT_ID & GOOGLE_OAUTH_CLIENT_SECRET in .env.local.</p>;
  }
  if (!connected) {
    return (
      <Button size="sm" asChild>
        <a href={`/api/auth/google?connector=${connector}`}>
          <LogIn /> Connect Google account
        </a>
      </Button>
    );
  }
  const disconnect = async () => {
    setBusy(true);
    await fetch("/api/auth/google/disconnect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ connector }) });
    setBusy(false);
    router.refresh();
  };
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">
        Connected as <span className="font-medium text-foreground">{account ?? "Google account"}</span>
      </span>
      <Button size="xs" variant="ghost" onClick={disconnect} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Unplug />} Putuskan
      </Button>
      <Button size="xs" variant="ghost" asChild>
        <a href={`/api/auth/google?connector=${connector}`}>Switch account</a>
      </Button>
    </div>
  );
}
