// Komponen dashboard yang dibangun di atas shadcn/ui.
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowRight, ArrowUp, CircleCheckBig, CircleX, Info, Loader, Minus, TrendingDown, TrendingUp, TriangleAlert, Upload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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

/** Warna badge tren gaya template (halaman Users): hijau = baik, merah = buruk, netral = outline biasa. */
function toneBadge(good: boolean | null) {
  return good == null ? "" : good ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive";
}

/** Badge MoM: ikon tren + teks + warna (warna tidak pernah jadi satu-satunya penanda). */
export function DeltaBadge({ cur, prev, kind = "count", goodWhenUp = true, neutral = false, partial = false, emptyText = "No data for last month yet" }: { cur: number | null | undefined; prev: number | null | undefined; kind?: DeltaKind; goodWhenUp?: boolean; neutral?: boolean; partial?: boolean; emptyText?: string }) {
  if (cur == null || prev == null || !delta(cur, prev)) return <span className="text-xs text-muted-foreground">{emptyText}</span>;
  const { d, flat, up, good } = deltaTone(cur, prev, goodWhenUp, neutral);
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <Badge variant="outline" className={cn("num", toneBadge(good))}>
        <Icon aria-hidden />
        {kind === "rate" ? fmtDeltaPp(cur, prev) : fmtDeltaPct(d)}
      </Badge>
      <span className="text-muted-foreground">vs last month{partial ? "*" : ""}</span>
    </span>
  );
}

/** Kartu KPI gaya shadcnstore template (section-cards): label, angka, badge tren di pojok, footer tren + catatan. */
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
  emptyText = "No data for last month yet",
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
  const t = cur != null && prev != null && delta(cur, prev) ? deltaTone(cur, prev, goodWhenUp, neutral) : null;
  const Trend = !t || t.flat ? Minus : t.up ? TrendingUp : TrendingDown;
  const change = t ? (kind === "rate" ? fmtDeltaPp(cur, prev) : fmtDeltaPct(t.d)) : null;
  const headline = !t ? emptyText : t.flat ? "Flat vs last month" : `${t.up ? "Up" : "Down"} ${change?.replace(/^[+−-]/, "")} vs last month`;
  return (
    // naik (dan memang baik) → gradien hijau menggantikan gradien primary dari KpiGrid
    <Card className={cn("avoid-break", t?.up && t.good && "from-success/10!")}>
      <CardHeader>
        <CardDescription className="flex items-center gap-1">
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
        {/* ukuran seperti metrics-overview template dashboard-2: tanpa @container, angka tetap text-2xl */}
        <CardTitle className="text-2xl font-semibold tabular-nums">{value}</CardTitle>
        {change && (
          <CardAction>
            <Badge variant="outline" className={toneBadge(t ? t.good : null)}>
              <Trend className="size-4" />
              {change}
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      {(cur !== undefined || note) && (
        <CardFooter className="flex-col items-start gap-1.5 border-t-0 bg-transparent pt-0 text-sm">
          {cur !== undefined && (
            <div className="line-clamp-1 flex gap-2 font-medium">
              {headline}
              {t && partial ? "*" : ""} {t && <Trend className="size-4" />}
            </div>
          )}
          {note && <div className="text-muted-foreground">{note}</div>}
        </CardFooter>
      )}
    </Card>
  );
}

export function KpiGrid({ children, cols = 6 }: { children: ReactNode; cols?: 4 | 6 }) {
  // gradien kartu dari template section-cards; cols=6 → 3 kolom (overview), cols=4 → 4 kolom
  return (
    <div
      className={cn(
        "grid gap-6 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs sm:grid-cols-2 dark:*:data-[slot=card]:bg-card",
        cols === 6 ? "xl:grid-cols-3" : "xl:grid-cols-4",
      )}
    >
      {children}
    </div>
  );
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
            No {channel} data for {monthLabel(month)} yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Import the {source ?? channel} files for this month to see its metrics.</p>
        </div>
        <Button asChild>
          <Link href={`/import?m=${month}`}>Import here</Link>
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
    <Section title="This month vs last month" subtitle={`${monthLabel(month)} compared with ${monthLabel(prevMonth(month))}`}>
      {!hasPrev && <p className="mb-3 text-xs text-muted-foreground">No data for {monthLabel(prevMonth(month))} yet — the last-month column is empty.</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Metric</TableHead>
            <TableHead className="text-right">{monthLabel(month, true)}</TableHead>
            <TableHead className="text-right">{monthLabel(prevMonth(month), true)}</TableHead>
            <TableHead className="text-right">Change</TableHead>
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

export function DataTable<T>({ rows, columns, empty = "No data.", maxRows }: { rows: T[]; columns: Column<T>[]; empty?: string; maxRows?: number }) {
  const shown = maxRows ? rows.slice(0, maxRows) : rows;
  if (!rows.length) return <p className="py-4 text-sm text-muted-foreground">{empty}</p>;
  // gaya tabel shadcnstore template: border bersudut, header bg-muted
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-muted">
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
    </div>
  );
}

/** Badge status gaya template (kolom Status data-table): outline abu + ikon (centang hijau / loader / silang). */
export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "bad" | "warn" }) {
  return (
    <Badge variant="outline" className="px-1.5 text-muted-foreground">
      {tone === "good" ? <CircleCheckBig className="text-success" /> : tone === "warn" ? <Loader /> : tone === "bad" ? <CircleX className="text-destructive" /> : null}
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
  if (!q.segments.length || !q.available) return <QuotaProgress value={q.available ? q.rate : null} label={`${q.label} quota`} />;
  const scale = Math.max(q.target, q.achieved) || 1;
  return (
    <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={q.segments.map((s) => `${s.label} ${s.count}`).join(", ") + ` of ${q.target} quota`}>
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
        <CardDescription className="text-xs font-medium">Quota achieved · {monthLabel(month)}</CardDescription>
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
            {!q.available ? "No data to evaluate yet." : remaining > 0 ? `${fmtNum(remaining)} more ${q.unit} needed to hit the quota.` : "Quota achieved."}
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
    // ukuran seperti section-cards template dashboard: @container → angka text-3xl di kartu ≥ 250px
    <Card className="@container/card avoid-break">
      <CardHeader>
        <CardDescription>
          <Link href={href} className="hover:text-foreground hover:underline">
            {q.label} quota
          </Link>
        </CardDescription>
        <CardTitle className="num text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
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
