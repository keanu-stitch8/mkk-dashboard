// Dipanggil sekali saat server Next start. Hanya untuk sync otomatis connector (opsional, SYNC_CRON=1).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.SYNC_CRON !== "1") return;
  const { startSyncCron } = await import("./lib/connectors/cron");
  startSyncCron();
}
