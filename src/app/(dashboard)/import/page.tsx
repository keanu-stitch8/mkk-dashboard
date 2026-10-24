import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/blocks";
import { ImportForm } from "@/components/import/ImportForm";
import { ManualForm } from "@/components/import/ManualForm";
import { QuotaForm } from "@/components/import/QuotaForm";
import { prisma } from "@/lib/db";
import { firstParam } from "@/modules/shared/lib/month-param";
import { resolveMonth } from "@/modules/shared/queries/month-query";
import { getQuotas } from "@/lib/data/quota";
import { QUOTA_DEFAULTS } from "@/lib/sources";
import { currentMonth, monthLabel } from "@/lib/month";
import { SyncControls } from "@/components/connectors/SyncControls";
import { configuredConnectors } from "@/lib/connectors";

export const dynamic = "force-dynamic";

export default async function ImportPage({ searchParams }: PageProps<"/import">) {
  const { month, months } = await resolveMonth(firstParam((await searchParams).m));
  const [manualRows, quotas, defaults, configured] = await Promise.all([
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
    </div>
  );
}
