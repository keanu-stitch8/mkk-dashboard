// Simpan dataset hasil parsing ke DB. Import ulang (month, source) yang sama = replace.
import type { PrismaClient } from "@prisma/client";
import type { Dataset, DatasetKey } from "../parsers/types";
import { applyMonth, rowCount } from "../parsers";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

/** Model Prisma tujuan untuk baris tiap dataset. */
const ROW_MODEL: Partial<Record<DatasetKey, keyof Tx>> = {
  ga4_traffic: "ga4Channel",
  ga4_pages: "ga4Page",
  ga4_landing: "ga4Landing",
  gsc_queries: "gscQuery",
  gsc_pages: "gscPage",
  gsc_dates: "gscDaily",
  yt_table: "ytVideo",
  yt_daily: "ytDaily",
  yt_log: "ytLog",
  meta_instagram: "socialPost",
  meta_facebook: "socialPost",
  news_log: "newsArticle",
  news_views: "newsView",
  social_log: "socialLog",
};

export interface CommitSummary {
  source: DatasetKey;
  month: string;
  rows: number;
  replaced: boolean;
  /** true jika dataset kosong setelah filter bulan → tidak disimpan & data lama tidak disentuh */
  skipped?: boolean;
  warnings: string[];
}

export async function commitDataset(prisma: PrismaClient, raw: Dataset, month: string): Promise<CommitSummary> {
  const ds = applyMonth(raw, month);
  const rows = ds.rows.map((r) => {
    const { _date, ...rest } = r;
    void _date;
    return { ...rest, month };
  });
  const fileName = [ds.file, ds.sheet].filter(Boolean).join(" · ");
  // Jangan pernah menggantikan data lama dengan dataset kosong (mis. file bulan lain).
  if (rowCount(ds) === 0) return { source: ds.key, month, rows: 0, replaced: false, skipped: true, warnings: ds.warnings };

  return prisma.$transaction(async (tx) => {
    const existing = await tx.import.findUnique({ where: { month_source: { month, source: ds.key } } });
    if (existing) await tx.import.delete({ where: { id: existing.id } }); // cascade ke semua child

    const imp = await tx.import.create({
      data: {
        month,
        source: ds.key,
        fileName,
        rowCount: rowCount(ds),
        note: ds.warnings.length ? ds.warnings.join("\n") : null,
      },
    });
    const model = ROW_MODEL[ds.key];
    if (model && rows.length) {
      const delegate = tx[model] as unknown as { createMany: (a: { data: unknown[] }) => Promise<unknown> };
      // createMany per chunk supaya aman untuk batas parameter SQLite
      for (let i = 0; i < rows.length; i += 200) {
        await delegate.createMany({ data: rows.slice(i, i + 200).map((r) => ({ ...r, importId: imp.id })) });
      }
    }
    if (ds.metrics.length) {
      await tx.metric.createMany({ data: ds.metrics.map((m) => ({ ...m, month, importId: imp.id })) });
    }
    if (ds.breakdowns.length) {
      await tx.breakdown.createMany({ data: ds.breakdowns.map((b) => ({ ...b, month, importId: imp.id })) });
    }
    return { source: ds.key, month, rows: rowCount(ds), replaced: !!existing, warnings: ds.warnings };
  });
}
