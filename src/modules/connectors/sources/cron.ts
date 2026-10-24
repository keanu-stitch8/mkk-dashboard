// Sync otomatis saat server Next jalan (SYNC_CRON=1): bulan lalu, tiap tanggal potong (CUTOFF_DAY = 5) jam 07:00 WIB.
// Tanpa dependensi: timer mengecek tiap 10 menit apakah slot terakhir sudah dijalankan (SyncLog trigger "cron").
// Jika server mati saat jadwal, sync dikejar begitu server menyala lagi; tiap slot hanya dijalankan sekali.
import { fmtDate } from "@/modules/shared/lib/format";
import { CUTOFF_DAY, cutoffDate, prevMonth } from "@/modules/shared/lib/month";
import { WIB, dateIn, zonedInstant } from "@/modules/shared/lib/tz";

const SYNC_DAY = CUTOFF_DAY;
const SYNC_HOUR_WIB = 7;
const CHECK_EVERY_MS = 10 * 60_000;

/** Slot jadwal terakhir yang ≤ now, dan bulan yang di-sync di slot itu (bulan sebelum slot). */
export function cronSlot(now = new Date()): { slot: Date; month: string } {
  const [wy, wm] = dateIn(now, WIB).split("-").map(Number);
  let y = wy;
  let m = wm - 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const at = (yy: number, mm: number) => new Date(zonedInstant(`${yy}-${pad(mm + 1)}-${pad(SYNC_DAY)}`, `${pad(SYNC_HOUR_WIB)}:00`, WIB));
  if (at(y, m) > now) {
    m -= 1;
    if (m < 0) [y, m] = [y - 1, 11];
  }
  const slot = at(y, m);
  return { slot, month: prevMonth(`${y}-${pad(m + 1)}`) };
}

/** Story IG hanya tersedia di API selama 24 jam → kumpulkan tiap 6 jam (hanya info, bukan KPI). */
const STORY_EVERY_MS = 6 * 3600_000;

const state = globalThis as unknown as { __mkkSyncCron?: { timer: NodeJS.Timeout; running: boolean; storiesAt?: number } };

/** Snapshot harian metrik post IG (dasar "views bulan ini" per post); fungsi sendiri mengecek 1x per hari. */
async function snapshotDaily() {
  try {
    const { snapshotIgDaily } = await import("./meta");
    const warnings = await snapshotIgDaily();
    if (warnings) console.log(`[sync-cron] Daily IG post snapshot saved${warnings.length ? ` — ${warnings.join(" ")}` : ""}`);
  } catch (e) {
    console.error("[sync-cron] IG post snapshot failed:", e instanceof Error ? e.message : e);
  }
}

async function collectStories(s: NonNullable<(typeof state)["__mkkSyncCron"]>) {
  if (s.storiesAt && Date.now() - s.storiesAt < STORY_EVERY_MS) return;
  s.storiesAt = Date.now();
  try {
    const { syncIgStories } = await import("./meta");
    const n = await syncIgStories();
    if (n != null) console.log(`[sync-cron] Story IG aktif: ${n} disimpan`);
  } catch (e) {
    console.error("[sync-cron] IG Stories failed:", e instanceof Error ? e.message : e);
  }
}

async function tick() {
  const s = state.__mkkSyncCron;
  if (!s || s.running) return;
  s.running = true;
  await collectStories(s);
  await snapshotDaily();
  try {
    const { prisma } = await import("@/lib/db");
    const { configuredConnectors, syncMany } = await import("./index");
    const { isLockable, isMonthLocked, setMonthLock } = await import("./lock");
    const { slot, month } = cronSlot();
    const done = await prisma.syncLog.findFirst({ where: { trigger: "cron", month, startedAt: { gte: slot } } });
    if (done) return;
    // bulan yang sudah dikunci: hanya Publishing Log (sheets) yang ditarik
    const locked = await isMonthLocked(month);
    const ids = (await configuredConnectors()).filter((id) => !locked || !isLockable(id));
    if (!ids.length) return;
    console.log(`[sync-cron] Syncing ${ids.join(", ")} for ${month} …`);
    const results = await syncMany(ids, [month], "cron");
    for (const r of results) console.log(`[sync-cron] ${r.ok ? "✓" : "✗"} ${r.connector} · ${month}${r.ok ? ` — ${r.rows} rows` : ` — ${r.error}`}`);
    // semua connector metrik berhasil → bulan final, kunci supaya angka laporan tidak berubah lagi
    const metricResults = results.filter((r) => isLockable(r.connector));
    if (!locked && metricResults.length && metricResults.every((r) => r.ok)) {
      await setMonthLock(month, true, `Locked automatically · cut-off ${fmtDate(cutoffDate(month))}`);
      console.log(`[sync-cron] 🔒 ${month} dikunci`);
      // bulan final → buat laporan Google Sheets untuk channel yang master template-nya sudah ada
      const { REPORT_CHANNELS } = await import("@/modules/report/pipeline/channels");
      const { generateReport, templateId } = await import("@/modules/report/pipeline/engine/generate");
      for (const ch of REPORT_CHANNELS.filter((c) => templateId(c.id))) {
        const r = await generateReport(ch.id, month, "cron");
        console.log(`[sync-cron] ${ch.title} report ${month}: ${r.status === "success" ? r.url : r.error}`);
      }
    }
  } catch (e) {
    console.error("[sync-cron] failed:", e instanceof Error ? e.message : e);
  } finally {
    s.running = false;
  }
}

/** Dipanggil sekali dari instrumentation.ts. Aman dipanggil ulang (HMR dev) — timer lama dipakai. */
export function startSyncCron() {
  if (state.__mkkSyncCron) return;
  const timer = setInterval(() => void tick(), CHECK_EVERY_MS);
  timer.unref();
  state.__mkkSyncCron = { timer, running: false };
  // cek pertama setelah server siap
  setTimeout(() => void tick(), 30_000).unref();
  const { slot, month } = cronSlot();
  console.log(`[sync-cron] active — runs on day ${SYNC_DAY} at 0${SYNC_HOUR_WIB}:00 WIB (last slot ${slot.toISOString()} → ${month}); daily IG post snapshot; IG Stories every 6 hours.`);
}
