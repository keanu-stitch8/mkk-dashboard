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
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Import data"
        description="Upload export bulanan. Import ulang untuk bulan & sumber yang sama akan menggantikan data lama."
        month={month}
        months={months}
      />

      <Section
        title="Sync dari API"
        subtitle="Tarik data langsung dari GA4 / Search Console / YouTube / Meta tanpa upload file"
        action={
          <a href="/settings/connectors" className="text-xs font-medium text-primary hover:underline">
            Pengaturan connector →
          </a>
        }
      >
        <SyncControls currentMonth={currentMonth()} defaultMonth={month} configured={configured} />
      </Section>

      <Section title="Upload file" subtitle="Pilih bulan dan jenis sumber, upload, cek preview, lalu simpan.">
        <ImportForm defaultMonth={month} />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={`Input manual · ${monthLabel(month)}`} subtitle="Fallback jika file export tidak tersedia">
          <ManualForm month={month} values={manual} />
        </Section>
        <Section title="Kuota bulanan" subtitle="Dipakai untuk achievement & rekomendasi">
          <QuotaForm month={month} rows={quotaRows} />
        </Section>
      </div>

      <Section title="Riwayat import" subtitle={`${imports.length} dataset tersimpan`}>
        {imports.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada data. Upload file di atas atau jalankan `npm run seed`.</p>
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
                          <TableCell className="num text-right text-xs text-muted-foreground">{i.rowCount.toLocaleString("id-ID")} baris</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{i.createdAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</TableCell>
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
