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

/** Kumpulkan file per folder: file dalam satu folder di-parse bersama (mis. Table data + Totals YouTube). */
function walkDirs(dir: string, out = new Map<string, string[]>()): Map<string, string[]> {
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkDirs(p, out);
    else out.set(dir, [...(out.get(dir) ?? []), p]);
  }
  return out;
}

/** Bulan dari nama folder "YYYY-MM" terdekat (mis. data-samples/2026-09/…). */
function folderMonth(relDir: string): string | null {
  const m = relDir.split(/[\\/]/).reverse().find((part) => /^\d{4}-(0[1-9]|1[0-2])$/.test(part));
  return m ?? null;
}

/**
 * Bulan tujuan. Jika file ada di folder "YYYY-MM", folder itu yang menentukan (baris bulan lain dibuang),
 * supaya baris tepi bulan (mis. 31 Agustus di export September) tidak menimpa data bulan lain.
 * Tanpa folder bulan, dataset bertanggal disimpan ke setiap bulan yang ada di barisnya.
 */
function targetMonths(ds: Dataset, forced: string | null): string[] {
  if (forced) return [forced];
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

  const groups = walkDirs(root);
  const total = [...groups.values()].reduce((n, g) => n + g.length, 0);
  console.log(`Membaca ${total} file dari ${root}/ (${groups.size} folder) …`);

  // Satu folder = satu kelompok parse, supaya dataset sejenis dari bulan berbeda (folder berbeda) tidak saling menimpa.
  for (const [dir, paths] of groups) {
    const files = paths.map((p) => ({ name: relative(root, p), data: new Uint8Array(readFileSync(p)) }));
    const result = parseFiles(files, "auto");
    const forced = folderMonth(relative(root, dir));
    console.log(`\n[${relative(root, dir) || "."}]${forced ? ` → ${monthLabel(forced)}` : ""}`);
    for (const ds of result.datasets) {
      const months = targetMonths(ds, forced);
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
    for (const s of result.skipped) if (s.actionable) console.log(`  ⚠ ${s.file}: ${s.reason}`);
    const pdf = result.errors.filter((e) => e.includes("PDF")).length;
    if (pdf) console.log(`  · ${pdf} file PDF dilewati (pakai CSV)`);
    for (const e of result.errors.filter((e) => !e.includes("PDF"))) console.log(`  ✗ ${e}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
