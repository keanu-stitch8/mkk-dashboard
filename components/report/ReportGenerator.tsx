"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileSpreadsheet, FileText, Loader2, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ReportRow {
  channel: string;
  title: string;
  configured: boolean;
  /** link edit master template (null = belum dikonfigurasi) */
  templateUrl: string | null;
  latest: { url: string | null; pdfUrl: string | null; status: string; createdAt: string; error: string | null; warnings: string | null } | null;
}

const fmtTime = (iso: string) => new Date(iso).toLocaleString("en-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

/** Tombol "Generate Google Sheets report" per channel + link laporan terakhir bulan ini. */
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
      <p className="text-xs text-muted-foreground">
        Reports & PDFs are snapshots taken when generated. After editing the master template, click &quot;Generate report&quot; again to pick up the changes.
      </p>
      {!locked && <p className="text-xs text-warning">This month isn&apos;t locked yet — report numbers can still change if the data is re-synced.</p>}
      {rows.map((r) => (
        <div key={r.channel} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
          <div>
            <p className="font-medium">{r.title} report</p>
            <p className={`text-xs ${r.latest?.status === "error" ? "text-danger" : "text-muted-foreground"}`}>
              {!r.configured
                ? "Master template not configured yet."
                : !r.latest
                  ? "Not generated for this month yet."
                  : r.latest.status === "success"
                    ? `Last generated ${fmtTime(r.latest.createdAt)}${r.latest.warnings ? " · has placeholder warnings" : ""}`
                    : `Failed (${fmtTime(r.latest.createdAt)}): ${r.latest.error}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {r.templateUrl && (
              <Button variant="ghost" size="sm" asChild>
                <a href={r.templateUrl} target="_blank" rel="noreferrer" title="Open the master template in Google Sheets">
                  <PencilLine /> Edit template
                </a>
              </Button>
            )}
            {r.latest?.status === "success" && r.latest.url && (
              <Button variant="ghost" size="sm" asChild>
                <a href={r.latest.url} target="_blank" rel="noreferrer">
                  <ExternalLink /> Open
                </a>
              </Button>
            )}
            {r.latest?.status === "success" && r.latest.pdfUrl && (
              <Button variant="ghost" size="sm" asChild>
                <a href={r.latest.pdfUrl} target="_blank" rel="noreferrer">
                  <FileText /> PDF
                </a>
              </Button>
            )}
            <Button size="sm" variant="outline" disabled={!r.configured || busy != null} onClick={() => run(r.channel)}>
              {busy === r.channel ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} Generate Google Sheets report
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
