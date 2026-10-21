"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleX, FileSpreadsheet, Loader2, TriangleAlert } from "lucide-react";
import { SOURCE_GROUPS } from "@/lib/sources";
import { monthLabel } from "@/lib/month";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PreviewDataset {
  key: string;
  label: string;
  file: string;
  sheet: string | null;
  detectedMonth: string | null;
  rowCount: number;
  totalRows: number;
  columns: { field: string; header: string }[];
  unmatched: string[];
  warnings: string[];
  metrics: { key: string; value: number }[];
  sample: Record<string, unknown>[];
  replaces: { fileName: string; createdAt: string } | null;
}

interface PreviewResponse {
  month: string | null;
  suggestedMonth: string | null;
  datasets: PreviewDataset[];
  skipped: { file: string; sheet?: string; reason: string; actionable?: boolean }[];
  errors: string[];
  error?: string;
}

interface CommitResponse {
  month: string;
  results: { label: string; rows: number; replaced: boolean; skipped?: boolean }[];
  error?: string;
}

const fmt = (n: number) => n.toLocaleString("en-ID", { maximumFractionDigits: 4 });

export function ImportForm({ defaultMonth }: { defaultMonth: string }) {
  const router = useRouter();
  const [month, setMonth] = useState(defaultMonth);
  const [monthTouched, setMonthTouched] = useState(false);
  const [group, setGroup] = useState("auto");
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<CommitResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  const buildForm = (fs: File[], g: string, action: string, m: string | null) => {
    const fd = new FormData();
    fs.forEach((f) => fd.append("files", f, f.name));
    fd.set("group", g);
    fd.set("action", action);
    if (m) fd.set("month", m);
    return fd;
  };

  // Preview dijalankan setiap file / sumber / bulan berubah; respons lama diabaikan.
  const runPreview = (fs: File[], g: string, m: string, touched: boolean) => {
    const id = ++requestId.current;
    setDone(null);
    setError(null);
    if (!fs.length) {
      setPreview(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch("/api/import", { method: "POST", body: buildForm(fs, g, "preview", touched ? m : null) })
      .then((r) => r.json() as Promise<PreviewResponse>)
      .then((res) => {
        if (id !== requestId.current) return;
        if (res.error) throw new Error(res.error);
        setPreview(res);
        setSelected(new Set(res.datasets.filter((d) => d.rowCount > 0).map((d) => d.key)));
        if (!touched && res.month) setMonth(res.month);
      })
      .catch((e: Error) => id === requestId.current && setError(e.message))
      .finally(() => id === requestId.current && setLoading(false));
  };

  const commit = async () => {
    setSaving(true);
    setError(null);
    try {
      const fd = buildForm(files, group, "commit", month);
      fd.set("keys", [...selected].join(","));
      const res = (await (await fetch("/api/import", { method: "POST", body: fd })).json()) as CommitResponse;
      if (res.error) throw new Error(res.error);
      setDone(res);
      setPreview(null);
      setFiles([]);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const groupHint = SOURCE_GROUPS.find((g) => g.value === group)?.hint;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="import-month">Data month</Label>
          <Input
            id="import-month"
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setMonthTouched(true);
              runPreview(files, group, e.target.value, true);
            }}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Source type</Label>
          <Select
            value={group}
            onValueChange={(v) => {
              setGroup(v);
              runPreview(files, v, month, monthTouched);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_GROUPS.map((g) => (
                <SelectItem key={g.value} value={g.value}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="import-files">Files (.csv, .xlsx, .zip — multiple allowed)</Label>
          <Input
            id="import-files"
            ref={inputRef}
            type="file"
            multiple
            accept=".csv,.tsv,.txt,.xlsx,.xls,.zip"
            onChange={(e) => {
              const fs = Array.from(e.target.files ?? []);
              setFiles(fs);
              runPreview(fs, group, month, monthTouched);
            }}
          />
        </div>
      </div>
      {groupHint && <p className="text-xs text-muted-foreground">{groupHint}</p>}

      {loading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Reading files…
        </p>
      )}
      {error && (
        <Alert variant="destructive">
          <CircleX />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {done && (
        <Alert className="border-success/30 bg-success-soft">
          <CircleCheck className="text-success" />
          <AlertTitle>Saved for {monthLabel(done.month)}</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {done.results.map((r) => (
                <li key={r.label}>
                  {r.label}: {r.skipped ? "skipped (0 rows for this month — existing data unchanged)" : `${fmt(r.rows)} rows${r.replaced ? " (replaced existing data)" : ""}`}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {preview && !loading && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">
              Preview · {preview.datasets.length} dataset(s) detected
              {preview.suggestedMonth && preview.suggestedMonth !== month && <span className="ml-2 font-normal text-warning">(files detected for {monthLabel(preview.suggestedMonth)})</span>}
            </h3>
            <Button onClick={commit} disabled={saving || selected.size === 0 || !month}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Saving…" : `Save ${selected.size} dataset(s) to ${month ? monthLabel(month) : "…"}`}
            </Button>
          </div>

          {preview.datasets.map((d) => (
            <div key={d.key} className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id={`ds-${d.key}`}
                  className="mt-0.5"
                  checked={selected.has(d.key)}
                  onCheckedChange={(v) => {
                    const next = new Set(selected);
                    if (v === true) next.add(d.key);
                    else next.delete(d.key);
                    setSelected(next);
                  }}
                />
                <div className="min-w-0 flex-1">
                  <Label htmlFor={`ds-${d.key}`} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{d.label}</span>
                    <Badge variant={d.rowCount === 0 ? "destructive" : "secondary"} className="num">
                      {fmt(d.rowCount)} rows
                      {d.totalRows !== d.rowCount && ` of ${fmt(d.totalRows)}`}
                    </Badge>
                    {d.detectedMonth && <span className="text-xs font-normal text-muted-foreground">file: {monthLabel(d.detectedMonth)}</span>}
                  </Label>
                  <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <FileSpreadsheet className="size-3 shrink-0" />
                    {d.file}
                    {d.sheet ? ` · ${d.sheet}` : ""}
                  </div>
                  {d.replaces && (
                    <div className="mt-1 text-xs text-warning">
                      Will replace the previous import ({d.replaces.fileName}, {new Date(d.replaces.createdAt).toLocaleDateString("en-ID")}).
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1 pl-7">
                {d.columns.map((c) => (
                  <Badge key={c.field} variant="outline" className="border-transparent bg-success-soft font-normal text-success" title={`Column "${c.header}" → ${c.field}`}>
                    {c.header}
                  </Badge>
                ))}
                {d.unmatched.map((c) => (
                  <Badge key={c} variant="outline" className="font-normal text-muted-foreground line-through decoration-muted-foreground/40" title="Column not used">
                    {c}
                  </Badge>
                ))}
              </div>
              {d.metrics.length > 0 && <div className="mt-2 pl-7 text-xs text-muted-foreground">Total: {d.metrics.map((m) => `${m.key} = ${fmt(m.value)}`).join(" · ")}</div>}
              {d.warnings.length > 0 && (
                <ul className="mt-2 space-y-0.5 pl-7 text-xs text-warning">
                  {d.warnings.map((w) => (
                    <li key={w} className="flex gap-1.5">
                      <TriangleAlert className="mt-0.5 size-3 shrink-0" />
                      {w}
                    </li>
                  ))}
                </ul>
              )}
              {d.sample.length > 0 && (
                <Collapsible className="mt-2 pl-7">
                  <CollapsibleTrigger asChild>
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                      Show sample rows
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 rounded-md border bg-background">
                    <Table className="text-[11px]">
                      <TableHeader>
                        <TableRow>
                          {Object.keys(d.sample[0]).map((k) => (
                            <TableHead key={k} className="h-8">
                              {k}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {d.sample.map((row, i) => (
                          <TableRow key={i}>
                            {Object.values(row).map((v, j) => (
                              <TableCell key={j} className="py-1.5">
                                {v == null ? "—" : String(v)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          ))}

          {preview.skipped.some((s) => s.actionable) && (
            <Alert className="border-warning/30 bg-warning-soft">
              <TriangleAlert className="text-warning" />
              <AlertTitle>Some files were recognized but can&apos;t be used</AlertTitle>
              <AlertDescription>
                <ul className="list-disc space-y-1 pl-4">
                  {[...new Map(preview.skipped.filter((s) => s.actionable).map((s) => [s.reason, s])).values()].map((s) => (
                    <li key={s.reason}>
                      <span className="font-medium text-foreground">{s.file.split("/").pop()}</span> — {s.reason}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {(preview.skipped.length > 0 || preview.errors.length > 0) && (
            <Collapsible defaultOpen={preview.datasets.length === 0} className="rounded-lg border p-3 text-xs">
              <CollapsibleTrigger asChild>
                <Button variant="link" size="sm" className="h-auto p-0 text-xs text-muted-foreground">
                  {preview.errors.length} error · {preview.skipped.length} table(s)/sheet(s) skipped
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="mt-2 space-y-0.5">
                  {preview.errors.map((e) => (
                    <li key={e} className="text-danger">
                      ✗ {e}
                    </li>
                  ))}
                  {preview.skipped.map((s, i) => (
                    <li key={i} className="text-muted-foreground">
                      · {s.file}
                      {s.sheet ? ` [${s.sheet}]` : ""} — {s.reason}
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}
    </div>
  );
}
