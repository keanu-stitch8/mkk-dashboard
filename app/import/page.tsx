import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/blocks";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { ImportForm } from "@/components/import/ImportForm";
import { ManualForm } from "@/components/import/ManualForm";
import { QuotaForm } from "@/components/import/QuotaForm";
import { DeleteImportButton } from "@/components/import/DeleteImportButton";
import { prisma } from "@/lib/db";
import { resolveMonth } from "@/lib/data/summary";
import { getQuotas } from "@/lib/data/quota";
import { CHANNEL_LABEL, DATASETS, QUOTA_DEFAULTS } from "@/lib/sources";
import { currentMonth, monthLabel } from "@/lib/month";
import { SyncControls } from "@/components/connectors/SyncControls";
import { configuredConnectors } from "@/lib/connectors";
import type { DatasetKey } from "@/lib/parsers/types";

export const dynamic = "force-dynamic";

export default async function ImportPage({ searchParams }: PageProps<"/import">) {
  const { month, months } = await resolveMonth((await searchParams).m);
  const [imports, manualRows, quotas, defaults, configured] = await Promise.all([
    prisma.import.findMany({ orderBy: [{ month: "desc" }, { source: "asc" }] }),
    prisma.manualMetric.findMany({ where: { month } }),
    getQuotas(month),
    prisma.quota.findMany({ where: { month: "default" } }),
    configuredConnectors(),
  ]);

  const manual: Record<string, Record<string, number>> = {};
  for (const r of manualRows) (manual[r.channel] ??= {})[r.key] = r.value;

  const quotaRows = QUOTA_DEFAULTS.map((q) => ({
    key: q.key,
    label: q.label,
    defaultValue: defaults.find((d) => d.key === q.key)?.value ?? q.value,
    monthValue: quotas[q.key].override ? quotas[q.key].value : null,
  }));

  const byMonth = new Map<string, typeof imports>();
  for (const i of imports) byMonth.set(i.month, [...(byMonth.get(i.month) ?? []), i]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Import data"
        description="Upload monthly exports. Re-importing the same month & source replaces the existing data."
        month={month}
        months={months}
      />

      <Section
        title="Sync from APIs"
        subtitle="Pull data straight from GA4 / Search Console / YouTube / Meta without uploading files"
        action={
          <a href="/settings/connectors" className="text-xs font-medium text-primary hover:underline">
            Connector settings →
          </a>
        }
      >
        <SyncControls currentMonth={currentMonth()} defaultMonth={month} configured={configured} />
      </Section>

      <Section title="Upload files" subtitle="Pick the month and source type, upload, check the preview, then save.">
        <ImportForm defaultMonth={month} />
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={`Manual input · ${monthLabel(month)}`} subtitle="Fallback when export files aren't available">
          <ManualForm month={month} values={manual} />
        </Section>
        <Section title="Monthly quotas" subtitle="Used for achievement & recommendations">
          <QuotaForm month={month} rows={quotaRows} />
        </Section>
      </div>

      <Section title="Import history" subtitle={`${imports.length} dataset(s) stored`}>
        {imports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet. Upload files above or run `npm run seed`.</p>
        ) : (
          <div className="space-y-4">
            {[...byMonth.entries()].map(([m, list]) => (
              <div key={m}>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{monthLabel(m)}</h3>
                <Table>
                  <TableBody>
                    {list.map((i) => {
                      const meta = DATASETS[i.source as DatasetKey];
                      return (
                        <TableRow key={i.id}>
                          <TableCell className="w-28">
                            <Badge variant="outline">{meta ? CHANNEL_LABEL[meta.channel] : "?"}</Badge>
                          </TableCell>
                          <TableCell>{meta?.label ?? i.source}</TableCell>
                          <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={i.fileName}>
                            {i.fileName}
                          </TableCell>
                          <TableCell className="num text-right text-xs text-muted-foreground">{i.rowCount.toLocaleString("en-ID")} rows</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{i.createdAt.toLocaleString("en-ID", { dateStyle: "medium", timeStyle: "short" })}</TableCell>
                          <TableCell className="text-right">
                            <DeleteImportButton id={i.id} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
