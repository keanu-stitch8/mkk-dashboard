// Komponen dashboard yang dibangun di atas shadcn/ui.
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowRight, ArrowUp, Info, TriangleAlert, Upload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { delta, fmtDeltaPct, fmtDeltaPp, fmtNum, fmtPct, DASH } from "@/lib/format";
import type { QuotaSummary } from "@/lib/data/summary";
import { monthLabel, prevMonth } from "@/lib/month";

/** Card dengan judul + deskripsi (wrapper Card shadcn). */
export function Section({ title, subtitle, action, children, className }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn("avoid-break min-w-0", className)}>
      {(title || action) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {subtitle && <CardDescription>{subtitle}</CardDescription>}
          {action && <CardAction>{action}</CardAction>}
        </CardHeader>
      )}
      <CardContent className="min-w-0">{children}</CardContent>
    </Card>
  );
}

export type DeltaKind = "count" | "rate";

/** neutral: arah tidak dinilai baik/buruk (mis. artikel in review) → selalu abu-abu */
function deltaTone(cur: number, prev: number, goodWhenUp: boolean, neutral = false) {
  const d = delta(cur, prev)!;
  const flat = d.abs === 0 || (d.pct != null && Math.abs(d.pct) < 0.0005);
  const good = flat || neutral ? null : d.abs > 0 === goodWhenUp;
  return { d, flat, up: d.abs > 0, good };
}

/** Badge MoM: panah + teks + warna (warna tidak pernah jadi satu-satunya penanda). */
export function DeltaBadge({ cur, prev, kind = "count", goodWhenUp = true, neutral = false, partial = false, emptyText = "Belum ada data bulan lalu" }: { cur: number | null | undefined; prev: number | null | undefined; kind?: DeltaKind; goodWhenUp?: boolean; neutral?: boolean; partial?: boolean; emptyText?: string }) {
  if (cur == null || prev == null || !delta(cur, prev)) return <span className="text-xs text-muted-foreground">{emptyText}</span>;
  const { d, flat, up, good } = deltaTone(cur, prev, goodWhenUp, neutral);
  const Icon = flat ? ArrowRight : up ? ArrowUp : ArrowDown;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <Badge
        variant="outline"
        className={cn("num gap-0.5 border-transparent", good == null ? "bg-muted text-muted-foreground" : good ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}
      >
        <Icon aria-hidden />
        {kind === "rate" ? fmtDeltaPp(cur, prev) : fmtDeltaPct(d)}
      </Badge>
      <span className="text-muted-foreground">vs bulan lalu{partial ? "*" : ""}</span>
    </span>
  );
}

export function KpiCard({
  label,
  value,
  cur,
  prev,
  kind = "count",
  goodWhenUp = true,
  neutral,
  note,
  hint,
  partial,
  emptyText,
}: {
  label: string;
  value: string;
  cur?: number | null;
  prev?: number | null;
  kind?: DeltaKind;
  goodWhenUp?: boolean;
  neutral?: boolean;
  note?: ReactNode;
  hint?: string;
  partial?: boolean;
  emptyText?: string;
}) {
  return (
    <Card size="sm" className="avoid-break">
      <CardHeader>
        <CardDescription className="flex items-center gap-1 text-xs font-medium">
          {label}
          {hint && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground/70 hover:text-foreground" aria-label={`Definisi ${label}`}>
                  <Info className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">{hint}</TooltipContent>
            </Tooltip>
          )}
        </CardDescription>
        <CardTitle className="num text-2xl font-semibold tracking-tight">{value}</CardTitle>
      </CardHeader>
      {(cur !== undefined || note) && (
        <CardContent className="flex flex-col gap-1.5">
          {cur !== undefined && <DeltaBadge cur={cur} prev={prev} kind={kind} goodWhenUp={goodWhenUp} neutral={neutral} partial={partial} emptyText={emptyText} />}
          {note && <div className="text-xs text-muted-foreground">{note}</div>}
        </CardContent>
      )}
    </Card>
  );
}

export function KpiGrid({ children, cols = 6 }: { children: ReactNode; cols?: 4 | 6 }) {
  // cols=4 → 2 baris x 4 kartu (halaman channel), cols=6 → 1 baris (overview)
  return <div className={cn("grid grid-cols-2 gap-3", cols === 6 ? "md:grid-cols-3 xl:grid-cols-6" : "lg:grid-cols-4")}>{children}</div>;
}

export function EmptyState({ channel, month, source }: { channel: string; month: string; source?: string }) {
  return (
    <Card className="border-dashed shadow-none ring-0 outline-1 outline-border outline-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <Upload className="size-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">
            Belum ada data {channel} untuk {monthLabel(month)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Import file {source ?? channel} untuk bulan ini supaya metriknya muncul.</p>
        </div>
        <Button asChild>
          <Link href={`/import?m=${month}`}>Import di sini</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  return (
    <Alert className={tone === "warn" ? "border-warning/30 bg-warning-soft" : "bg-info-soft"}>
      {tone === "warn" ? <TriangleAlert className="text-warning" /> : <Info />}
      <AlertDescription className="text-foreground/85">{children}</AlertDescription>
    </Alert>
  );
}

/** Progress kuota: hijau ≥90%, kuning ≥70%, merah di bawahnya (angka selalu ditampilkan di sebelahnya). */
export function QuotaProgress({ value, label }: { value: number | null; label?: string }) {
  const tone = value == null ? "*:data-[slot=progress-indicator]:bg-muted-foreground" : value >= 0.9 ? "*:data-[slot=progress-indicator]:bg-success" : value >= 0.7 ? "*:data-[slot=progress-indicator]:bg-warning" : "*:data-[slot=progress-indicator]:bg-danger";
  return <Progress value={Math.max(0, Math.min(100, (value ?? 0) * 100))} aria-label={label} className={cn("h-2", tone)} />;
}

export interface CompareRow {
  label: string;
  cur: number | null | undefined;
  prev: number | null | undefined;
  fmt: (v: number | null | undefined) => string;
  kind?: DeltaKind;
  goodWhenUp?: boolean;
  neutral?: boolean;
}

function DeltaInline({ cur, prev, kind = "count", goodWhenUp = true, neutral = false }: { cur: number; prev: number; kind?: DeltaKind; goodWhenUp?: boolean; neutral?: boolean }) {
  const { d, flat, up, good } = deltaTone(cur, prev, goodWhenUp, neutral);
  const Icon = flat ? ArrowRight : up ? ArrowUp : ArrowDown;
  return (
    <span className={cn("num inline-flex items-center gap-0.5 text-xs font-medium", good == null ? "text-muted-foreground" : good ? "text-success" : "text-danger")}>
      <Icon className="size-3" aria-hidden />
      {kind === "rate" ? fmtDeltaPp(cur, prev) : fmtDeltaPct(d)}
    </span>
  );
}

/** Tabel perbandingan bulan ini vs bulan lalu. */
export function CompareTable({ month, rows, hasPrev, footnote }: { month: string; rows: CompareRow[]; hasPrev: boolean; footnote?: ReactNode }) {
  return (
    <Section title="Bulan ini vs bulan lalu" subtitle={`${monthLabel(month)} dibandingkan ${monthLabel(prevMonth(month))}`}>
      {!hasPrev && <p className="mb-3 text-xs text-muted-foreground">Belum ada data {monthLabel(prevMonth(month))} — kolom bulan lalu kosong.</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Metrik</TableHead>
            <TableHead className="text-right">{monthLabel(month, true)}</TableHead>
            <TableHead className="text-right">{monthLabel(prevMonth(month), true)}</TableHead>
            <TableHead className="text-right">Perubahan</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.label}>
              <TableCell className="text-muted-foreground">{r.label}</TableCell>
              <TableCell className="num text-right font-medium">{r.fmt(r.cur)}</TableCell>
              <TableCell className="num text-right text-muted-foreground">{r.fmt(r.prev)}</TableCell>
              <TableCell className="text-right">
                {r.cur != null && r.prev != null ? <DeltaInline cur={r.cur} prev={r.prev} kind={r.kind} goodWhenUp={r.goodWhenUp} neutral={r.neutral} /> : <span className="text-muted-foreground">{DASH}</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {footnote && <p className="mt-2 text-xs text-muted-foreground">{footnote}</p>}
    </Section>
  );
}

export interface Column<T> {
  header: string;
  cell: (row: T, i: number) => ReactNode;
  align?: "left" | "right";
  className?: string;
}

export function DataTable<T>({ rows, columns, empty = "Tidak ada data.", maxRows }: { rows: T[]; columns: Column<T>[]; empty?: string; maxRows?: number }) {
  const shown = maxRows ? rows.slice(0, maxRows) : rows;
  if (!rows.length) return <p className="py-4 text-sm text-muted-foreground">{empty}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((c, i) => (
            <TableHead key={i} className={cn(c.align === "right" && "text-right")}>
              {c.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {shown.map((row, ri) => (
          <TableRow key={ri}>
            {columns.map((c, ci) => (
              <TableCell key={ci} className={cn("align-top whitespace-normal", c.align === "right" && "num text-right whitespace-nowrap", c.className)}>
                {c.cell(row, ri)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "bad" | "warn" }) {
  const cls = {
    neutral: "",
    good: "border-transparent bg-success-soft text-success",
    bad: "border-transparent bg-danger-soft text-danger",
    warn: "border-transparent bg-warning-soft text-warning",
  }[tone];
  return (
    <Badge variant={tone === "neutral" ? "secondary" : "outline"} className={cls}>
      {children}
    </Badge>
  );
}

// ───────────────────────────── Kuota ─────────────────────────────


/**
 * Bar kuota. Tanpa segmen: satu bar berwarna status (hijau ≥90%, kuning ≥70%, merah).
 * Dengan segmen (News: Published + In review): bar bertumpuk, panjang relatif terhadap kuota,
 * dipisah celah 2px; angka & legend selalu ditampilkan di sebelahnya.
 */
export function QuotaBar({ q }: { q: QuotaSummary }) {
  if (!q.segments.length || !q.available) return <QuotaProgress value={q.available ? q.rate : null} label={`Kuota ${q.label}`} />;
  const scale = Math.max(q.target, q.achieved) || 1;
  return (
    <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={q.segments.map((s) => `${s.label} ${s.count}`).join(", ") + ` dari kuota ${q.target}`}>
      {q.segments
        .filter((s) => s.count > 0)
        .map((s) => (
          <div key={s.label} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(s.count / scale) * 100}%`, background: s.color }} title={`${s.label}: ${s.count}`} />
        ))}
    </div>
  );
}

function SegmentLegend({ q }: { q: QuotaSummary }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {q.segments.map((s) => (
        <span key={s.label} className="inline-flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2.5 rounded-[2px]" style={{ background: s.color }} aria-hidden />
          {s.label}
          <span className="num font-medium text-foreground">{fmtNum(s.count)}</span>
          <span className="num">· {fmtPct(q.target ? s.count / q.target : null)}</span>
        </span>
      ))}
    </div>
  );
}

/** Widget utama halaman konten: kuota tercapai (x / kuota). */
export function QuotaHero({ q, prev, month, className }: { q: QuotaSummary; prev: QuotaSummary | null; month: string; className?: string }) {
  const remaining = Math.max(0, q.target - q.achieved);
  return (
    <Card className={cn("avoid-break", className)}>
      <CardHeader>
        <CardDescription className="text-xs font-medium">Kuota tercapai · {monthLabel(month)}</CardDescription>
        <CardTitle className="num text-4xl font-semibold tracking-tight">{q.available ? fmtPct(q.rate) : DASH}</CardTitle>
        <CardAction>
          <DeltaBadge cur={q.available ? q.rate : null} prev={prev?.available ? prev.rate : null} kind="rate" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">{q.achievedLabel}</span>
            <span className="num font-medium">
              {q.available ? fmtNum(q.achieved) : DASH} / {fmtNum(q.target)} {q.unit}
            </span>
          </div>
          <QuotaBar q={q} />
          {q.segments.length > 0 && q.available && <SegmentLegend q={q} />}
          <p className="mt-1.5 text-xs text-muted-foreground">
            {!q.available ? "Belum ada data untuk dinilai." : remaining > 0 ? `Kurang ${fmtNum(remaining)} ${q.unit} untuk mencapai kuota.` : "Kuota tercapai."}
          </p>
        </div>
        {q.breakdown.length > 0 && (
          <div className="flex flex-col gap-2 border-t pt-3">
            {q.breakdown.map((b) =>
              b.target == null ? (
                // tanpa target per item: tampilkan jumlah + porsi dari total published
                <div key={b.label}>
                  <div className="mb-1 flex justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">{b.label}</span>
                    <span className="num font-medium">
                      {fmtNum(b.count)} {q.unit} · {fmtPct(q.achieved ? b.count / q.achieved : null)}
                    </span>
                  </div>
                  <Progress value={q.achieved ? (b.count / q.achieved) * 100 : 0} aria-label={b.label} className="h-1.5 *:data-[slot=progress-indicator]:bg-chart-1" />
                </div>
              ) : (
                <div key={b.label}>
                  <div className="mb-1 flex justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">{b.label}</span>
                    <span className="num font-medium">
                      {b.rate == null ? DASH : fmtNum(b.count)} / {fmtNum(b.target)} · {fmtPct(b.rate)}
                    </span>
                  </div>
                  <QuotaProgress value={b.rate} label={b.label} />
                </div>
              ),
            )}
          </div>
        )}
        {(q.note || q.source) && (
          <div className="space-y-0.5 border-t pt-3 text-xs text-muted-foreground">
            {q.note && <p>{q.note}</p>}
            {q.source && <p>{q.source}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Versi ringkas untuk Overview. */
export function QuotaMini({ q, prev, href }: { q: QuotaSummary; prev: QuotaSummary | null; href: string }) {
  return (
    <Card size="sm" className="avoid-break">
      <CardHeader>
        <CardDescription className="text-xs font-medium">
          <Link href={href} className="hover:text-foreground hover:underline">
            Kuota {q.label}
          </Link>
        </CardDescription>
        <CardTitle className="num text-2xl font-semibold tracking-tight">
          {q.available ? `${fmtNum(q.achieved)}/${fmtNum(q.target)}` : DASH}
          <span className="ml-2 text-sm font-normal text-muted-foreground">{q.available ? fmtPct(q.rate) : ""}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <QuotaBar q={q} />
        <DeltaBadge cur={q.available ? q.rate : null} prev={prev?.available ? prev.rate : null} kind="rate" />
      </CardContent>
    </Card>
  );
}
