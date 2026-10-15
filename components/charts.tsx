"use client";

import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { fmtCompact, fmtDuration, fmtNum, fmtPct } from "@/lib/format";

export type ValueFormat = "num" | "pct" | "hours" | "dur" | "dec";

/** Palet kategorikal tervalidasi, dipakai berurutan (tidak pernah diacak). */
const SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

export function formatValue(v: number | null | undefined, f: ValueFormat): string {
  if (f === "pct") return fmtPct(v);
  if (f === "hours") return `${fmtNum(v, 1)} jam`;
  if (f === "dur") return fmtDuration(v);
  if (f === "dec") return fmtNum(v, 1);
  return fmtNum(v);
}

function tick(v: number, f: ValueFormat): string {
  if (f === "pct") return fmtPct(v, 0);
  if (f === "dur") return fmtDuration(v);
  if (f === "hours") return fmtNum(v, v < 10 ? 1 : 0);
  return fmtCompact(v);
}

export interface SeriesDef {
  key: string;
  name: string;
  /** garis target/referensi (mis. kuota): putus-putus tanpa titik */
  reference?: boolean;
}

function buildConfig(series: SeriesDef[]): ChartConfig {
  return Object.fromEntries(series.map((s, i) => [s.key, { label: s.name, color: SERIES_COLORS[i % SERIES_COLORS.length] }]));
}

/** Tooltip id-ID: titik warna + nama + nilai terformat. */
function tooltip(format: ValueFormat, config: ChartConfig) {
  return (
    <ChartTooltip
      cursor={{ fill: "var(--muted)", stroke: "var(--border)" }}
      content={
        <ChartTooltipContent
          indicator="dot"
          formatter={(value, name, item) => (
            <div className="flex w-full items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: item.color ?? item.payload?.fill }} />
              <span className="text-muted-foreground">{config[String(name)]?.label ?? name}</span>
              <span className="num ml-auto pl-3 font-medium text-foreground">{formatValue(value as number, format)}</span>
            </div>
          )}
        />
      }
    />
  );
}

/** Grafik tren (garis atau kolom). Satu sumbu Y; ≥2 series → legend. */
export function TrendChart({
  data,
  series,
  format = "num",
  type = "line",
  height = 220,
}: {
  data: Record<string, string | number | null>[];
  series: SeriesDef[];
  format?: ValueFormat;
  type?: "line" | "bar";
  height?: number;
}) {
  const config = buildConfig(series);
  const hasValue = data.some((d) => series.some((s) => d[s.key] != null));
  if (!hasValue) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-muted/40 text-xs text-muted-foreground" style={{ height }}>
        Belum ada data di rentang ini.
      </div>
    );
  }
  const axes = (
    <>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={8} />
      <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => tick(v, format)} />
      {tooltip(format, config)}
      {series.length > 1 && <ChartLegend content={<ChartLegendContent />} itemSorter={(item) => series.findIndex((s) => s.key === item.dataKey)} />}
    </>
  );

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      {type === "bar" ? (
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
          {axes}
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} fill={`var(--color-${s.key})`} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          ))}
        </BarChart>
      ) : (
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          {axes}
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={`var(--color-${s.key})`}
              strokeWidth={s.reference ? 1.5 : 2}
              strokeDasharray={s.reference ? "6 4" : undefined}
              dot={s.reference ? false : { r: 4, strokeWidth: 2, stroke: "var(--card)", fill: `var(--color-${s.key})` }}
              activeDot={s.reference ? false : { r: 5, strokeWidth: 2, stroke: "var(--card)" }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      )}
    </ChartContainer>
  );
}

/** Bar horizontal untuk breakdown (sumber traffic, kategori, format). */
export function BreakdownBars({ data, format = "num", name = "Nilai" }: { data: { label: string; value: number | null }[]; format?: ValueFormat; name?: string }) {
  if (!data.length) return <p className="py-4 text-sm text-muted-foreground">Tidak ada data.</p>;
  const config: ChartConfig = { value: { label: name, color: "var(--chart-1)" } };
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: Math.max(120, data.length * 34 + 8) }}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }}>
        <XAxis type="number" dataKey="value" hide />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={156}
          interval={0}
          tickFormatter={(v: string) => (v.length > 22 ? v.slice(0, 21) + "…" : v)}
        />
        {tooltip(format, config)}
        <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
          <LabelList dataKey="value" position="right" offset={8} className="fill-muted-foreground" fontSize={11} formatter={(v: unknown) => formatValue(v as number, format)} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
