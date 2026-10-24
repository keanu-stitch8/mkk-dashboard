import { Section } from "@/components/blocks";
import { monthLabel } from "@/lib/month";
import { SyncControls } from "@/modules/connectors/shared/components/sync-controls";
import type { ImportPage } from "../types/import-page";
import { ImportForm } from "./import-form";
import { ManualForm } from "./manual-form";
import { QuotaForm } from "./quota-form";

export function ImportPageContent({ data }: { data: ImportPage }) {
  const { month, manual, quotaRows, configured, currentMonth } = data;
  return (
    <>
      <Section
        title="Sync from APIs"
        subtitle="Pull data straight from GA4 / Search Console / YouTube / Meta without uploading files"
        action={
          <a href="/settings/connectors" className="text-xs font-medium text-primary hover:underline">
            Connector settings →
          </a>
        }
      >
        <SyncControls currentMonth={currentMonth} defaultMonth={month} configured={configured} />
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
    </>
  );
}
