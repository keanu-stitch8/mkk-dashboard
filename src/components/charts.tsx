"use client";

import { useId } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { fmtDuration, fmtNum, fmtPct } from "@/modules/shared/lib/format";

export type ValueFormat = "num" | "pct" | "hours" | "dur" | "dec";

/** Seri pertama = primary (seperti template); seri berikutnya dari gradasi chart preset Orange, diberi jarak supaya beda. */
const SERIES_COLORS = ["var(--primary)", "var(--chart-4)", "var(--chart-2)", "var(--chart-5)"];

export function formatValue(v: number | null | undefined, f: ValueFormat): string {
  if (f === "pct") return fmtPct(v);
  if (f === "hours") return `${fmtNum(v, 1)} hrs`;
  if (f === "dur") return fmtDuration(v);
  if (f === "dec") return fmtNum(v, 1);
  return fmtNum(v);
}

export interface SeriesDef {
  key: string;
  name: string;
  /** garis target/referensi (mis. kuota): putus-putus tanpa titik */
  reference?: boolean;
}

function buildConfig(series: SeriesDef[]): ChartConfig {
  // garis referensi (kuota/target) memakai warna netral dan tidak memakan slot warna kategorikal
  let slot = 0;
  return Object.fromEntries(
    series.map((s) => [s.key, { label: s.name, color: s.reference ? "var(--muted-foreground)" : SERIES_COLORS[slot++ % SERIES_COLORS.length] }]),
  );
}

/** Tooltip id-ID: titik warna + nama + nilai terformat. */
function tooltip(format: ValueFormat, config: ChartConfig) {
  return (
    <ChartTooltip
      cursor={false}
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

/**
 * Grafik tren gaya shadcnstore template (chart-area-interactive): area "natural" dengan gradien,
 * grid horizontal, tanpa sumbu Y, tooltip dot. Garis referensi (kuota) = putus-putus tanpa isi.
 */
export function TrendChart({
  data,
  series,
  format = "num",
  type = "line",
  height = 250,
}: {
  data: Record<string, string | number | null>[];
  series: SeriesDef[];
  format?: ValueFormat;
  type?: "line" | "bar";
  height?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const config = buildConfig(series);
  const hasValue = data.some((d) => series.some((s) => d[s.key] != null));
  if (!hasValue) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-muted/40 text-xs text-muted-foreground" style={{ height }}>
        No data in this range yet.
      </div>
    );
  }
  const axes = (
    <>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
      {tooltip(format, config)}
    </>
  );

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      {type === "bar" ? (
        <BarChart data={data} barGap={2}>
          {axes}
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} fill={`var(--color-${s.key})`} radius={4} isAnimationActive={false} />
          ))}
        </BarChart>
      ) : (
        <AreaChart data={data}>
          <defs>
            {series
              .filter((s) => !s.reference)
              .map((s, i) => (
                <linearGradient key={s.key} id={`fill-${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={`var(--color-${s.key})`} stopOpacity={i === 0 ? 1.0 : 0.8} />
                  <stop offset="95%" stopColor={`var(--color-${s.key})`} stopOpacity={0.1} />
                </linearGradient>
              ))}
          </defs>
          {axes}
          {series.map((s) => (
            <Area
              key={s.key}
              dataKey={s.key}
              // template memakai "natural"; "monotone" sama halusnya tapi tidak melewati nilai data (tidak turun di bawah 0)
              type="monotone"
              fill={s.reference ? "none" : `url(#fill-${uid}-${s.key})`}
              stroke={`var(--color-${s.key})`}
              strokeDasharray={s.reference ? "6 4" : undefined}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      )}
    </ChartContainer>
  );
}

/** Bar horizontal untuk breakdown (sumber traffic, kategori, format). */
export function BreakdownBars({ data, format = "num", name = "Value" }: { data: { label: string; value: number | null }[]; format?: ValueFormat; name?: string }) {
  if (!data.length) return <p className="py-4 text-sm text-muted-foreground">No data.</p>;
  const config: ChartConfig = { value: { label: name, color: "var(--primary)" } };
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
