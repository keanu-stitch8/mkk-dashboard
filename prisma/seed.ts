// npm run seed → import semua file di ./data-samples (atau folder lain: npm run seed -- ./folder)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { PrismaClient } from "@prisma/client";
import { parseFiles, type Dataset } from "../lib/parsers";
import { commitDataset } from "../lib/import/commit";
import { toMonth } from "../lib/parsers/values";
import { DATASETS, QUOTA_DEFAULTS } from "../lib/sources";
import { monthLabel } from "../lib/month";

const prisma = new PrismaClient();
const root = process.argv[2] ?? "data-samples";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name.startsWith(".")) return [];
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Dataset bertanggal bisa berisi beberapa bulan → simpan per bulan. */
function targetMonths(ds: Dataset): string[] {
  if (ds.rowDated) {
    const months = [...new Set(ds.rows.map((r) => toMonth(r._date ?? null)).filter((m): m is string => !!m))];
    if (months.length) return months.sort();
  }
  return ds.month ? [ds.month] : [];
}

async function main() {
  for (const q of QUOTA_DEFAULTS) {
    await prisma.quota.upsert({
      where: { month_key: { month: "default", key: q.key } },
      update: {},
      create: { month: "default", key: q.key, value: q.value },
    });
  }

  const paths = walk(root);
  const files = paths.map((p) => ({ name: relative(root, p), data: new Uint8Array(readFileSync(p)) }));
  console.log(`Membaca ${files.length} file dari ${root}/ …`);
  const result = parseFiles(files, "auto");

  for (const ds of result.datasets) {
    const months = targetMonths(ds);
    if (!months.length) {
      console.warn(`  ⚠ ${DATASETS[ds.key].label} (${ds.file}): bulan tidak terdeteksi — dilewati.`);
      continue;
    }
    for (const month of months) {
      const res = await commitDataset(prisma, ds, month);
      if (res.skipped) console.log(`  · ${monthLabel(month)} · ${DATASETS[ds.key].label}: 0 baris setelah filter bulan — tidak disimpan`);
      else console.log(`  ✓ ${monthLabel(month)} · ${DATASETS[ds.key].label}: ${res.rows} baris${res.replaced ? " (replace)" : ""}`);
    }
  }
  for (const s of result.skipped) console.log(`  · dilewati: ${s.file}${s.sheet ? ` [${s.sheet}]` : ""} — ${s.reason}`);
  for (const e of result.errors) console.log(`  ${e.includes("PDF") ? "·" : "✗"} ${e}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
