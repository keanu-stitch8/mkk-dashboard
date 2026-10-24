import "server-only";
import { prisma } from "@/lib/db";
import { commitDataset } from "@/modules/import/ingest/commit";
import { isMonth } from "@/modules/shared/lib/month";
import { parseFiles, suggestedMonth, type InputFile, type SourceGroup } from "@/modules/import/parsers";
import { DATASETS } from "@/modules/shared/lib/sources";
import { buildUploadPreview } from "../lib/upload-preview";
import { findMonthImports } from "../repositories/upload-repository";

/** Parse file upload; bulan = pilihan pengguna, atau bulan terbanyak di data. */
function parseUpload(files: InputFile[], group: SourceGroup, monthRaw: string) {
  const parsed = parseFiles(files, group);
  return { parsed, month: isMonth(monthRaw) ? monthRaw : suggestedMonth(parsed) };
}

export async function previewUpload(files: InputFile[], group: SourceGroup, monthRaw: string) {
  const { parsed, month } = parseUpload(files, group, monthRaw);
  const existing = month ? await findMonthImports(month) : [];
  return { month, suggestedMonth: suggestedMonth(parsed), datasets: buildUploadPreview(parsed, month, existing), skipped: parsed.skipped, errors: parsed.errors };
}

/** Simpan dataset terpilih (kosong = semua) lewat pipeline ingest; import bulan & sumber yang sama diganti. */
export async function commitUpload(files: InputFile[], group: SourceGroup, monthRaw: string, keys: string[]) {
  const { parsed, month } = parseUpload(files, group, monthRaw);
  if (!month) return { error: "Select a month (YYYY-MM)." } as const;
  const selected = parsed.datasets.filter((d) => !keys.length || keys.includes(d.key));
  if (!selected.length) return { error: "No datasets to save." } as const;
  const results = [];
  for (const ds of selected) results.push({ ...(await commitDataset(prisma, ds, month)), label: DATASETS[ds.key].label });
  return { month, results };
}
