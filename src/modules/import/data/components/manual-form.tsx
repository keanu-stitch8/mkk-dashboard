"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CHANNEL_LABEL, MANUAL_FIELDS } from "@/modules/shared/lib/sources";
import { parseNumber } from "@/modules/import/parsers/values";
import type { Channel } from "@/modules/import/parsers/types";
import { monthLabel } from "@/modules/shared/lib/month";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CHANNELS = Object.keys(MANUAL_FIELDS) as Channel[];

function toInput(v: number | undefined, unit?: string): string {
  if (v == null) return "";
  const n = unit === "percent" ? v * 100 : v;
  return n.toLocaleString("en-ID", { maximumFractionDigits: 2, useGrouping: false });
}

/** Form input manual total bulanan (fallback / override hasil import). */
export function ManualForm({ month, values }: { month: string; values: Record<string, Record<string, number>> }) {
  const router = useRouter();
  const [channel, setChannel] = useState<Channel>("website");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fields = MANUAL_FIELDS[channel];
  const current = values[channel] ?? {};

  const valueOf = (key: string, unit?: string) => draft[`${channel}.${key}`] ?? toInput(current[key], unit);

  const save = async () => {
    const payload: Record<string, number | null> = {};
    for (const f of fields) {
      const raw = draft[`${channel}.${f.key}`];
      if (raw === undefined) continue;
      const n = raw.trim() === "" ? null : parseNumber(raw, "id");
      payload[f.key] = n == null ? null : f.unit === "percent" ? n / 100 : n;
    }
    setSaving(true);
    const res = await fetch("/api/manual", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ month, channel, values: payload }) });
    setSaving(false);
    setStatus(res.ok ? "Saved." : "Failed to save.");
    setDraft({});
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <Tabs value={channel} onValueChange={(v) => setChannel(v as Channel)}>
        <TabsList className="flex-wrap">
          {CHANNELS.map((c) => (
            <TabsTrigger key={c} value={c}>
              {CHANNEL_LABEL[c]}
              {Object.keys(values[c] ?? {}).length > 0 && <span className="size-1.5 rounded-full bg-primary" aria-label="has manual values" />}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <p className="text-xs text-muted-foreground">
        Values here override the imported data for {monthLabel(month)}. Leave blank to fall back to the imported data. Indonesian number format: 1.353 or 88,3.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key} className="grid gap-1.5">
            <Label htmlFor={`manual-${f.key}`} className="text-xs font-normal text-muted-foreground">
              {f.label}
            </Label>
            <Input
              id={`manual-${f.key}`}
              inputMode="decimal"
              value={valueOf(f.key, f.unit)}
              onChange={(e) => setDraft({ ...draft, [`${channel}.${f.key}`]: e.target.value })}
              placeholder="from import"
              className="num"
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          Save manual values
        </Button>
        {status && <span className="text-xs text-muted-foreground">{status}</span>}
      </div>
    </div>
  );
}
