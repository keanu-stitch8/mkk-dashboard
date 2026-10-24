// POST /api/connectors/sync — { connectors?: ConnectorId[], month?: "YYYY-MM", backfill?: number, force?: boolean }
// Bulan terkunci (MonthLock) dilewati untuk connector metrik kecuali force.
// Tanpa `connectors` → semua connector yang sudah dikonfigurasi. Tanpa `month` → bulan berjalan.
import { backfillMonths, configuredConnectors, syncMany } from "@/modules/connectors/sources";
import { CONNECTORS, type ConnectorId } from "@/modules/connectors/sources/catalog";
import { currentMonth, isMonth } from "@/modules/shared/lib/month";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { connectors?: string[]; month?: string; backfill?: number; force?: boolean };
  const known = new Set(CONNECTORS.map((c) => c.id));
  const configured = await configuredConnectors();
  const ids = (body.connectors?.length ? body.connectors.filter((c): c is ConnectorId => known.has(c as ConnectorId)) : configured).filter((c) => configured.includes(c));
  if (!ids.length) {
    return Response.json({ error: "No connectors configured yet. Add credentials to .env.local, then check Settings → Connectors." }, { status: 400 });
  }
  if (body.month && !isMonth(body.month)) return Response.json({ error: "Month must be in YYYY-MM format." }, { status: 400 });
  const backfill = Math.min(Math.max(Number(body.backfill) || 0, 0), 24);
  const months = backfill ? backfillMonths(backfill) : [body.month ?? currentMonth()];
  const results = await syncMany(ids, months, "manual", body.force === true);
  return Response.json({ results });
}
