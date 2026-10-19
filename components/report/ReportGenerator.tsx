"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ReportRow {
  channel: string;
  title: string;
  configured: boolean;
  latest: { url: string | null; status: string; createdAt: string; error: string | null; warnings: string | null } | null;
}

const fmtTime = (iso: string) => new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

/** Tombol "Buat laporan Google Sheets" per channel + link laporan terakhir bulan ini. */
export function ReportGenerator({ month, locked, rows }: { month: string; locked: boolean; rows: ReportRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (channel: string) => {
    setBusy(channel);
    await fetch("/api/reports/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ channel, month }) });
    setBusy(null);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-2">
      {!locked && <p className="text-xs text-warning">Bulan ini belum dikunci — angka di laporan masih bisa berubah jika data di-sync ulang.</p>}
      {rows.map((r) => (
        <div key={r.channel} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
          <div>
            <p className="font-medium">Laporan {r.title}</p>
            <p className={`text-xs ${r.latest?.status === "error" ? "text-danger" : "text-muted-foreground"}`}>
              {!r.configured
                ? "Master template belum dikonfigurasi."
                : !r.latest
                  ? "Belum pernah dibuat untuk bulan ini."
                  : r.latest.status === "success"
                    ? `Terakhir dibuat ${fmtTime(r.latest.createdAt)}${r.latest.warnings ? " · ada peringatan penanda" : ""}`
                    : `Gagal (${fmtTime(r.latest.createdAt)}): ${r.latest.error}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {r.latest?.status === "success" && r.latest.url && (
              <Button variant="ghost" size="sm" asChild>
                <a href={r.latest.url} target="_blank" rel="noreferrer">
                  <ExternalLink /> Buka
                </a>
              </Button>
            )}
            <Button size="sm" variant="outline" disabled={!r.configured || busy != null} onClick={() => run(r.channel)}>
              {busy === r.channel ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} Buat laporan Google Sheets
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
