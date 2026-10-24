import { Lock } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard, KpiGrid, Notice, Section, StatusBadge } from "@/components/blocks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { monthLabel } from "@/lib/month";
import { onTarget, SCORE_DEFS, SCORECARD_FROM } from "../lib/scorecard";
import type { ScoreDef, ScorecardMonth } from "../types/scorecard";

const fmt = (def: ScoreDef, v: number | null) =>
  v == null ? "—" : def.unit === "%" ? `${Number.isInteger(v) ? v : v.toFixed(1)}%` : def.unit === "days" ? `${v} day${v === 1 ? "" : "s"}` : String(v);
const fmtTarget = (def: ScoreDef) => `${def.better === "higher" ? "≥" : "≤"} ${def.unit === "%" ? `${def.target}%` : `${def.target} ${def.unit}`}`;
const asDelta = (def: ScoreDef, v: number | null) => (v == null ? null : def.unit === "%" ? v / 100 : v);
const fmtDay = (d: Date) => d.toLocaleDateString("en-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

export function ScorecardContent({ data }: { data: { month: string; months: string[]; history: ScorecardMonth[] } }) {
  const { month, months, history } = data;
  const cur = history.at(-1);
  const prev = history.at(-2) ?? null;
  const valueOf = (h: (typeof history)[number] | null, key: string) => h?.scores.find((s) => s.key === key)?.value ?? null;

  const header = (
    <PageHeader
      title="Team Scorecard"
      month={month}
      months={months.length ? months : [month]}
      description="Six measures of how the content team turns field reports into articles and Instagram posts."
    />
  );
  // bulan sebelum data tim ada (dulu halaman ini error 500)
  if (!cur) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Notice>The team scorecard starts in {monthLabel(SCORECARD_FROM)} — there are no coverage guides, briefs, or Task Progress data for {monthLabel(month)}.</Notice>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {header}

      <Notice>
        {cur.frozenAt ? (
          <>
            <Lock className="mr-1 inline size-3.5" /> Final — saved when {monthLabel(month)} was locked ({fmtDay(cur.frozenAt)}). Later confirmations don&apos;t change it.
          </>
        ) : (
          <>Live — counts only confirmed or strong matches, so numbers rise as the team confirms suggestions. They are saved for good when the month is locked. Targets are a first proposal to discuss.</>
        )}
      </Notice>

      <KpiGrid cols={6}>
        {SCORE_DEFS.map((def) => {
          const s = cur.scores.find((x) => x.key === def.key);
          const ok = onTarget(def, s?.value ?? null);
          return (
            <KpiCard
              key={def.key}
              label={def.label}
              value={fmt(def, s?.value ?? null)}
              // kind "rate" mengharapkan pecahan 0–1 (selisih ditulis dalam pp)
              cur={asDelta(def, s?.value ?? null)}
              prev={asDelta(def, valueOf(prev, def.key))}
              kind={def.unit === "%" ? "rate" : "count"}
              goodWhenUp={def.better === "higher"}
              hint={def.description}
              emptyText="No previous month"
              note={
                <div className="flex flex-col items-start gap-1">
                  <StatusBadge tone={ok == null ? "neutral" : ok ? "good" : "bad"}>
                    Target {fmtTarget(def)}
                  </StatusBadge>
                  <span>{s?.detail}</span>
                </div>
              }
            />
          );
        })}
      </KpiGrid>

      <Section title="History" subtitle="Green = on target, red = off target. A lock icon means the month is final.">
        <Table className="min-w-[720px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-48">Measure</TableHead>
              <TableHead className="w-28">Target</TableHead>
              {history.map((h) => (
                <TableHead key={h.month} className="text-right">
                  {h.frozenAt && <Lock className="mr-1 inline size-3 text-muted-foreground" />}
                  {monthLabel(h.month, true)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {SCORE_DEFS.map((def) => (
              <TableRow key={def.key}>
                <TableCell className="font-medium">{def.label}</TableCell>
                <TableCell className="text-muted-foreground">{fmtTarget(def)}</TableCell>
                {history.map((h) => {
                  const v = valueOf(h, def.key);
                  const ok = onTarget(def, v);
                  return (
                    <TableCell key={h.month} className={`num text-right ${ok == null ? "text-muted-foreground" : ok ? "text-success" : "text-destructive"}`}>
                      {fmt(def, v)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    </div>
  );
}
