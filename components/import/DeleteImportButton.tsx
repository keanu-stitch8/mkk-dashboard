"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Hapus satu import. Klik pertama minta konfirmasi (tanpa dialog browser). */
export function DeleteImportButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!confirm) {
      setConfirm(true);
      setTimeout(() => setConfirm(false), 4000);
      return;
    }
    setBusy(true);
    await fetch(`/api/imports?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <Button variant={confirm ? "destructive" : "ghost"} size="xs" onClick={run} disabled={busy}>
      <Trash2 />
      {busy ? "…" : confirm ? "Yakin hapus?" : "Hapus"}
    </Button>
  );
}
