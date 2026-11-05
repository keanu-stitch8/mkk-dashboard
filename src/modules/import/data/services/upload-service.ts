import "server-only";
import { prisma } from "@/lib/db";
import { commitDataset } from "@/modules/import/ingest/commit";
import { isMonth } from "@/modules/shared/lib/month";
import { parseFiles, suggestedMonth, type InputFile, type SourceGroup } from "@/modules/import/parsers";
import { DATASETS } from "@/modules/shared/lib/sources";
import { buildUploadPreview } from "../lib/upload-preview";
import { findMonthImports, findUploadMonthLock } from "../repositories/upload-repository";
import { instagramUploadOptions, prepareInstagramUpload } from "../lib/instagram-upload";
import { dateIn, WIB } from "@/modules/shared/lib/tz";

/** Parse file upload; bulan = pilihan pengguna, atau bulan terbanyak di data. */
async function parseUpload(files: InputFile[], group: SourceGroup, monthRaw: string, mode: string, observedOn: string) {
  const raw = parseFiles(files, group);
  const month = isMonth(monthRaw) ? monthRaw : suggestedMonth(raw);
  const options = instagramUploadOptions(mode, observedOn, dateIn(Date.now(), WIB));
  const [existing, lock] = month ? await Promise.all([findMonthImports(month), findUploadMonthLock(month)]) : [[], null];
  return { parsed: prepareInstagramUpload(raw, month, existing, !!lock, options), month, existing };
}

export async function previewUpload(files: InputFile[], group: SourceGroup, monthRaw: string, mode = "auto", observedOn = "") {
  try {
    const { parsed, month, existing } = await parseUpload(files, group, monthRaw, mode, observedOn);
    return { month, suggestedMonth: suggestedMonth(parsed), datasets: buildUploadPreview(parsed, month, existing), skipped: parsed.skipped, errors: parsed.errors };
  } catch (error) { return { error: (error as Error).message }; }
}

/** Simpan dataset terpilih (kosong = semua) lewat pipeline ingest; import bulan & sumber yang sama diganti. */
export async function commitUpload(files: InputFile[], group: SourceGroup, monthRaw: string, keys: string[], mode = "auto", observedOn = "") {
  let upload;
  try { upload = await parseUpload(files, group, monthRaw, mode, observedOn); }
  catch (error) { return { error: (error as Error).message } as const; }
  const { parsed, month } = upload;
  if (!month) return { error: "Select a month (YYYY-MM)." } as const;
  const selected = parsed.datasets.filter((d) => !keys.length || keys.includes(d.key));
  if (!selected.length) return { error: "No datasets to save." } as const;
  const results = [];
  for (const ds of selected) results.push({ ...(await commitDataset(prisma, ds, month)), label: DATASETS[ds.key].label });
  return { month, results };
}
