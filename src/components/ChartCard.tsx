"use client";

import { useState, type ReactNode } from "react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TrendChart, type SeriesDef, type ValueFormat } from "@/components/charts";
import { LAUNCH_MONTH, monthLabel } from "@/modules/shared/lib/month";
import { cn } from "@/lib/utils";

/**
 * Kartu grafik gaya shadcnstore template (chart-area-interactive): judul + deskripsi, pemilih rentang di pojok
 * (toggle di kartu lebar, select di kartu sempit), area chart 250px.
 * granularity "month" = tren bulanan (semua / 3 bulan terakhir), "day" = harian dalam sebulan (semua / 14 / 7 hari).
 */
export function ChartCard({
  title,
  description,
  data,
  series,
  format,
  granularity = "month",
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  data: Record<string, string | number | null>[];
  series: SeriesDef[];
  format?: ValueFormat;
  granularity?: "month" | "day";
  className?: string;
}) {
  const options =
    granularity === "day"
      ? [
          { value: "all", label: "Full month" },
          { value: "14", label: "Last 14 days" },
          { value: "7", label: "Last 7 days" },
        ]
      : [
          {
            value: "all",
            // tren dipotong di bulan launching (getTrend) → sebut "Sejak …" supaya tidak terbaca "N bulan terakhir"
            label: String(data[0]?.month ?? "") <= LAUNCH_MONTH ? `Since ${monthLabel(LAUNCH_MONTH)}` : `Last ${data.length} months`,
          },
          // tidak perlu opsi 3 bulan kalau datanya memang ≤ 3 bulan
          ...(data.length > 3 ? [{ value: "3", label: "Last 3 months" }] : []),
        ];
  const [range, setRange] = useState("all");
  const shown = range === "all" ? data : data.slice(-Number(range));

  return (
    <Card className={cn("@container/card avoid-break min-w-0", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        <CardAction className="no-print">
          <ToggleGroup
            type="single"
            spacing={0}
            value={range}
            onValueChange={(v) => v && setRange(v)}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            {options.map((o) => (
              <ToggleGroupItem key={o.value} value={o.value}>
                {o.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden" size="sm" aria-label="Select range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectGroup>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="rounded-lg">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <TrendChart data={shown} series={series} format={format} />
      </CardContent>
    </Card>
  );
}
