"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ImageOff } from "lucide-react";
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
  /** URL gambar thumbnail 16:9 (kolom Thumbnail tampil jika tabel diberi `thumbnails`) */
  thumb?: string | null;
  /** rasio kotak thumbnail (default 16:9) */
  thumbRatio?: ThumbRatio;
}

export type ThumbRatio = "16:9" | "4:5";
/** Ukuran kotak per rasio: 16:9 (YouTube/News) lebar 96px; 4:5 (Instagram) tinggi 96px. */
const RATIO_CLASS: Record<ThumbRatio, string> = { "16:9": "aspect-video w-24", "4:5": "aspect-[4/5] h-24" };

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
export function PublishingLogTable({ rows, columns, thumbnails = false }: { rows: LogRow[]; columns: LogColumn[]; thumbnails?: boolean }) {
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
          {thumbnails && <TableHead>Thumbnail</TableHead>}
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
            {thumbnails && (
              <TableCell className="align-top">
                {r.thumb ? (
                  <a href={r.url ?? r.thumb} target="_blank" rel="noreferrer" className="block w-fit">
                    {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail eksternal kecil, tanpa optimasi next/image */}
                    <img src={r.thumb} alt="" loading="lazy" className={`${RATIO_CLASS[r.thumbRatio ?? "16:9"]} rounded-md bg-muted object-cover`} />
                  </a>
                ) : (
                  <div className={`flex ${RATIO_CLASS[r.thumbRatio ?? "16:9"]} items-center justify-center rounded-md bg-muted text-muted-foreground/60`} title="Belum ada thumbnail">
                    <ImageOff className="size-6" aria-hidden />
                  </div>
                )}
              </TableCell>
            )}
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
