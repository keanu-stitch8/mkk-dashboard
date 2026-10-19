// Sync data dari API connector.
//   npm run sync                          → bulan lalu (bulan penuh terakhir), semua connector terkonfigurasi
//   npm run sync -- --month=2026-09       → bulan tertentu
//   npm run sync -- --backfill=6          → 6 bulan terakhir (termasuk bulan ini)
//   npm run sync -- --connector=ga4,gsc   → connector tertentu
// Exit code 1 jika ada sync yang gagal (berguna untuk cron / Task Scheduler).
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { backfillMonths, configuredConnectors, lastFullMonth, syncMany } = await import("../lib/connectors");
  const { CONNECTORS } = await import("../lib/connectors/catalog");
  const { isMonth, monthLabel } = await import("../lib/month");
  const { prisma } = await import("../lib/db");

  const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const month = arg("month");
  const backfill = Number(arg("backfill") ?? 0);
  if (month && !isMonth(month)) throw new Error(`--month harus YYYY-MM, bukan "${month}"`);

  const configured = await configuredConnectors();
  const wanted = arg("connector")?.split(",").map((s) => s.trim()) ?? configured;
  const ids = configured.filter((c) => wanted.includes(c));
  for (const w of wanted.filter((w) => !configured.includes(w as never))) {
    const known = CONNECTORS.some((c) => c.id === w);
    console.warn(`⚠ ${w}: ${known ? "belum dikonfigurasi / belum tersedia — dilewati" : "connector tidak dikenal"}`);
  }
  if (!ids.length) {
    console.error("Tidak ada connector yang siap. Isi kredensial di .env.local (lihat README → Setup Connector).");
    process.exit(1);
  }

  const months = backfill > 0 ? backfillMonths(Math.min(backfill, 24)) : [month ?? lastFullMonth()];
  console.log(`Sync ${ids.join(", ")} untuk ${months.map((m) => monthLabel(m)).join(", ")} …`);
  const results = await syncMany(ids, months, process.env.SYNC_TRIGGER === "cron" ? "cron" : "script");
  for (const r of results) {
    console.log(`${r.ok ? "✓" : "✗"} ${r.connector} · ${monthLabel(r.month)}${r.ok ? ` — ${r.rows.toLocaleString("id-ID")} baris` : ` — ${r.error}`}`);
    for (const d of r.detail) console.log(`    ${d}`);
  }
  await prisma.$disconnect();
  if (results.some((r) => !r.ok)) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
