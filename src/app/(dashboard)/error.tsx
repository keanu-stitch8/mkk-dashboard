"use client";

import { useEffect } from "react";
import { CircleX } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Status "gagal" (DB / derivasi error) — beda dari "kosong" (EmptyState, belum ada import) dan tidak pernah
 * diubah jadi data kosong. Lihat docs/architecture/data-flow.md → Missing, empty, and failed data.
 */
export default function DashboardError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = typeof error === "object" && error && "digest" in error ? String((error as { digest?: unknown }).digest ?? "") : "";
  return (
    <div className="flex flex-col gap-4">
      <Alert variant="destructive">
        <CircleX />
        <AlertTitle>This page couldn&apos;t be loaded</AlertTitle>
        <AlertDescription>
          The data is still in the database — this is a read or calculation error, not missing data. Try again; if it keeps happening, check the server log
          {digest ? ` (error ${digest})` : ""}.
        </AlertDescription>
      </Alert>
      <div>
        <Button variant="outline" onClick={() => retry()}>
          Try again
        </Button>
      </div>
    </div>
  );
}
