// Sync otomatis saat server Next jalan (SYNC_CRON=1): bulan lalu, tiap tanggal 3 jam 07:00 WIB.
// Tanpa dependensi: timer mengecek tiap 10 menit apakah slot terakhir sudah dijalankan (SyncLog trigger "cron").
// Jika server mati saat jadwal, sync dikejar begitu server menyala lagi; tiap slot hanya dijalankan sekali.
import { prevMonth } from "../month";

const SYNC_DAY = 3;
const SYNC_HOUR_WIB = 7;
const CHECK_EVERY_MS = 10 * 60_000;
const WIB_MS = 7 * 3600_000;

/** Slot jadwal terakhir yang ≤ now, dan bulan yang di-sync di slot itu (bulan sebelum slot). */
export function cronSlot(now = new Date()): { slot: Date; month: string } {
  const wib = new Date(now.getTime() + WIB_MS);
  let y = wib.getUTCFullYear();
  let m = wib.getUTCMonth();
  const at = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, SYNC_DAY, SYNC_HOUR_WIB) - WIB_MS);
  if (at(y, m) > now) {
    m -= 1;
    if (m < 0) [y, m] = [y - 1, 11];
  }
  const slot = at(y, m);
  return { slot, month: prevMonth(`${y}-${String(m + 1).padStart(2, "0")}`) };
}

const state = globalThis as unknown as { __mkkSyncCron?: { timer: NodeJS.Timeout; running: boolean } };

async function tick() {
  const s = state.__mkkSyncCron;
  if (!s || s.running) return;
  s.running = true;
  try {
    const { prisma } = await import("../db");
    const { configuredConnectors, syncMany } = await import("./index");
    const { slot, month } = cronSlot();
    const done = await prisma.syncLog.findFirst({ where: { trigger: "cron", month, startedAt: { gte: slot } } });
    if (done) return;
    const ids = await configuredConnectors();
    if (!ids.length) return;
    console.log(`[sync-cron] Sync ${ids.join(", ")} untuk ${month} …`);
    const results = await syncMany(ids, [month], "cron");
    for (const r of results) console.log(`[sync-cron] ${r.ok ? "✓" : "✗"} ${r.connector} · ${month}${r.ok ? ` — ${r.rows} baris` : ` — ${r.error}`}`);
  } catch (e) {
    console.error("[sync-cron] gagal:", e instanceof Error ? e.message : e);
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
  console.log(`[sync-cron] aktif — jadwal tiap tanggal ${SYNC_DAY} jam 0${SYNC_HOUR_WIB}.00 WIB (slot terakhir ${slot.toISOString()} → ${month}).`);
}
