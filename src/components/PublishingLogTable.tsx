"use client";

import { Fragment, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Circle, CircleCheck, CircleX, Clock, ImageOff, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BADGE, FORMAT_BADGES } from "@/components/log-badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate } from "@/modules/shared/lib/format";
import { cn } from "@/lib/utils";

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
/**
 * Ukuran kotak per rasio: 16:9 (YouTube/News) lebar 96px; 4:5 (Instagram) tinggi 96px (lebar 76.8px).
 * shrink-0 + min-w: lebar tetap walau kolom Judul mengambil 90% tabel.
 */
const RATIO_CLASS: Record<ThumbRatio, string> = { "16:9": "aspect-video w-24 min-w-24 shrink-0", "4:5": "aspect-[4/5] h-24 min-w-[4.8rem] shrink-0" };

/**
 * Kolom tambahan di antara Tanggal dan Status. Urutan seragam di semua channel: Format → Kategori → kolom khas
 * channel (mis. Platform) → kreator (Reporter / Designer / Video Editor).
 * `badge`: "format" = Badge berwarna tanpa garis (FORMAT_BADGES), "outline" = Badge bergaris seperti kolom Category
 * template Tasks (kategori, platform). Tinggi keduanya sama: Badge tanpa garis tetap ber-border transparan.
 * `multi`: nilai "A, B" tampil sebagai beberapa Badge (platform).
 */
export interface LogColumn {
  key: string;
  label: string;
  badge?: "format" | "outline";
  multi?: boolean;
}

type SortDir = "asc" | "desc";

/** Status gaya kolom Status template Tasks (ikon + teks, bukan badge); ikon diwarnai sesuai status. */
const STATUS: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  publish: { label: "Published", icon: CircleCheck, className: "text-success" },
  // menunggu approval → amber (warna pending)
  review: { label: "In review", icon: Clock, className: "text-warning" },
  draft: { label: "Draft", icon: Circle, className: "text-muted-foreground" },
  canceled: { label: "Canceled", icon: CircleX, className: "text-destructive" },
};
const NO_STATUS = { label: "No status", icon: Circle, className: "text-muted-foreground/60" };

const valueOf = (r: LogRow, key: string) => (key === "date" || key === "title" || key === "status" ? r[key] : r.fields[key]);
const collator = new Intl.Collator("en-ID", { sensitivity: "base", numeric: true });

/** Tabel Publishing Log: klik header untuk sort A-Z / Z-A, default per tanggal. Nilai kosong selalu di bawah. */
/** Thumbnail baris log; gambar yang gagal dimuat (mis. video YouTube lama yang sudah private/dihapus setelah re-upload) → placeholder. */
function LogThumb({ row }: { row: LogRow }) {
  const [failed, setFailed] = useState(false);
  const box = RATIO_CLASS[row.thumbRatio ?? "16:9"];
  if (!row.thumb || failed) {
    return (
      <div
        className={`flex ${box} items-center justify-center rounded-md bg-muted text-muted-foreground/60`}
        title={failed ? "Thumbnail unavailable — the linked video may be private or deleted. Check the link in the log." : "No thumbnail yet"}
      >
        <ImageOff className="size-6" aria-hidden />
      </div>
    );
  }
  return (
    <a href={row.url ?? row.thumb} target="_blank" rel="noreferrer" className="block w-fit">
      {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail eksternal kecil, tanpa optimasi next/image */}
      <img src={row.thumb} alt="" loading="lazy" onError={() => setFailed(true)} className={`${box} rounded-md bg-muted object-cover`} />
    </a>
  );
}

export function PublishingLogTable({ rows, columns, thumbnails = false }: { rows: LogRow[]; columns: LogColumn[]; thumbnails?: boolean }) {
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({ key: "date", dir: "asc" });
  const headers = [{ key: "date", label: "Date" }, { key: "title", label: "Title" }, ...columns, { key: "status", label: "Status" }];

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
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-muted">
          <TableRow>
            {/* lebar tetap: tanpa ini sisa lebar di luar Judul ikut dibagi ke kolom # dan beda tiap halaman */}
            <TableHead className="w-12 min-w-12 pl-4">#</TableHead>
            {headers.map((c) => {
              const active = sort.key === c.key;
              const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
              return (
                <Fragment key={c.key}>
                  {/* Judul mengambil sisa lebar (90%), kolom lain selebar isinya (nowrap) supaya rapat kanan-kiri */}
                  <TableHead className={c.key === "title" ? "w-[90%] min-w-64" : undefined} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                    <button type="button" onClick={() => toggle(c.key)} className="inline-flex items-center gap-1 hover:text-foreground">
                      {c.label}
                      <Icon className={active ? "size-3.5" : "size-3.5 text-muted-foreground/50"} />
                    </button>
                  </TableHead>
                  {/* urutan: # · Tanggal · Thumbnail · Judul · … */}
                  {c.key === "date" && thumbnails && <TableHead>Thumbnail</TableHead>}
                </Fragment>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((r, i) => (
            <TableRow key={`${r.url ?? r.title}-${i}`}>
              <TableCell className="pl-4 align-top text-muted-foreground tabular-nums">{i + 1}</TableCell>
              <TableCell className="align-top whitespace-nowrap">{fmtDate(r.date)}</TableCell>
              {thumbnails && (
                <TableCell className="align-top">
                  <LogThumb row={r} />
                </TableCell>
              )}
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
                return (
                  <TableCell key={c.key} className="align-top whitespace-nowrap">
                    {!v ? (
                      "—"
                    ) : c.badge ? (
                      // multi (platform): mengalir ±3 badge per baris; tanpa batas lebar tiap badge turun satu baris
                      <div className={cn("flex gap-1", c.multi && "w-52 flex-wrap")}>
                        {(c.multi ? v.split(", ") : [v]).map((x) => (
                          <Badge
                            key={x}
                            variant={c.badge === "outline" ? "outline" : "secondary"}
                            className={c.badge === "outline" ? undefined : cn("border-transparent", FORMAT_BADGES[x.toLowerCase()] ?? BADGE.gray)}
                          >
                            {x}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      v
                    )}
                  </TableCell>
                );
              })}
              <TableCell className="align-top">
                <StatusCell status={r.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function StatusCell({ status }: { status: string }) {
  const s = STATUS[status] ?? (status === "unknown" ? NO_STATUS : { ...NO_STATUS, label: status });
  return (
    <div className="flex items-center whitespace-nowrap">
      <s.icon className={cn("mr-2 size-4 shrink-0", s.className)} aria-hidden />
      <span className="text-sm">{s.label}</span>
    </div>
  );
}
