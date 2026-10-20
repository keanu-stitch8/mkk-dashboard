"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { StatusBadge } from "@/components/blocks";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate } from "@/lib/format";

/** Satu baris log konten. Kolom tambahan (reporter, kategori, format, …) dibaca dari `fields`. */
export interface LogRow {
  date: string | null;
  title: string;
  url: string | null;
  status: string;
  fields: Record<string, string | null>;
}

/** Kolom tambahan di antara Judul dan Status. `badges` = nilai (huruf kecil) → class warna; ada `badges` berarti tampil sebagai Badge. */
export interface LogColumn {
  key: string;
  label: string;
  badges?: Record<string, string>;
}

type SortDir = "asc" | "desc";

const STATUS_TONE = { publish: "good", review: "warn", draft: "neutral" } as const;

const valueOf = (r: LogRow, key: string) => (key === "date" || key === "title" || key === "status" ? r[key] : r.fields[key]);
const collator = new Intl.Collator("id", { sensitivity: "base", numeric: true });

/** Tabel Publishing Log: klik header untuk sort A-Z / Z-A, default per tanggal. Nilai kosong selalu di bawah. */
export function PublishingLogTable({ rows, columns }: { rows: LogRow[]; columns: LogColumn[] }) {
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({ key: "date", dir: "asc" });
  const headers = [{ key: "date", label: "Tanggal" }, { key: "title", label: "Judul" }, ...columns, { key: "status", label: "Status" }];

  const sorted = useMemo(() => {
    const sign = sort.dir === "asc" ? 1 : -1;
    // tie-break per tanggal lalu judul supaya urutan stabil
    return [...rows].sort((a, b) => {
      const va = valueOf(a, sort.key);
      const vb = valueOf(b, sort.key);
      if (!va || !vb) return va === vb ? 0 : va ? -1 : 1;
      return sign * collator.compare(va, vb) || collator.compare(a.date ?? "", b.date ?? "") || collator.compare(a.title, b.title);
    });
  }, [rows, sort]);

  const toggle = (key: string) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          {headers.map((c) => {
            const active = sort.key === c.key;
            const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
            return (
              <TableHead key={c.key} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                <button type="button" onClick={() => toggle(c.key)} className="inline-flex items-center gap-1 hover:text-foreground">
                  {c.label}
                  <Icon className={active ? "size-3.5" : "size-3.5 text-muted-foreground/50"} />
                </button>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((r, i) => (
          <TableRow key={`${r.url ?? r.title}-${i}`}>
            <TableCell className="align-top text-muted-foreground">{i + 1}</TableCell>
            <TableCell className="align-top whitespace-nowrap">{fmtDate(r.date)}</TableCell>
            <TableCell className="align-top whitespace-normal">
              {r.url ? (
                <a href={r.url} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">
                  {r.title}
                </a>
              ) : (
                r.title
              )}
            </TableCell>
            {columns.map((c) => {
              const v = r.fields[c.key];
              const cls = v && c.badges ? c.badges[v.toLowerCase()] : undefined;
              return (
                <TableCell key={c.key} className="align-top whitespace-normal">
                  {!v ? (
                    "—"
                  ) : c.badges ? (
                    <Badge variant={cls ? "outline" : "secondary"} className={cls}>
                      {v}
                    </Badge>
                  ) : (
                    v
                  )}
                </TableCell>
              );
            })}
            <TableCell className="align-top">
              <StatusBadge tone={STATUS_TONE[r.status as keyof typeof STATUS_TONE] ?? "neutral"}>{r.status}</StatusBadge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
