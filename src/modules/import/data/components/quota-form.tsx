"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { monthLabel } from "@/lib/month";
import { parseNumber } from "@/lib/parsers/values";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Row {
  key: string;
  label: string;
  defaultValue: number;
  monthValue: number | null;
}

/** Kuota bulanan: default semua bulan + override khusus bulan terpilih. */
export function QuotaForm({ month, rows }: { month: string; rows: Row[] }) {
  const router = useRouter();
  const [def, setDef] = useState<Record<string, string>>(Object.fromEntries(rows.map((r) => [r.key, String(r.defaultValue)])));
  const [own, setOwn] = useState<Record<string, string>>(Object.fromEntries(rows.map((r) => [r.key, r.monthValue == null ? "" : String(r.monthValue)])));
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const toVals = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.trim() === "" ? null : parseNumber(v, "id")]));
    const post = (m: string, values: Record<string, number | null>) =>
      fetch("/api/quota", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ month: m, values }) });
    setSaving(true);
    const [a, b] = await Promise.all([post("default", toVals(def)), post(month, toVals(own))]);
    setSaving(false);
    setStatus(a.ok && b.ok ? "Saved." : "Failed to save.");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quota</TableHead>
            <TableHead>Default</TableHead>
            <TableHead>Khusus {monthLabel(month, true)}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key}>
              <TableCell className="whitespace-normal text-muted-foreground">{r.label}</TableCell>
              <TableCell>
                <Input aria-label={`Default ${r.label}`} inputMode="numeric" value={def[r.key]} onChange={(e) => setDef({ ...def, [r.key]: e.target.value })} className="num h-8 w-20" />
              </TableCell>
              <TableCell>
                <Input
                  aria-label={`${r.label} khusus ${monthLabel(month)}`}
                  inputMode="numeric"
                  value={own[r.key]}
                  placeholder="default"
                  onChange={(e) => setOwn({ ...own, [r.key]: e.target.value })}
                  className="num h-8 w-24"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          Save quotas
        </Button>
        {status && <span className="text-xs text-muted-foreground">{status}</span>}
      </div>
    </div>
  );
}
