// POST /api/connectors/sync — { connectors?: ConnectorId[], month?: "YYYY-MM", backfill?: number }
// Tanpa `connectors` → semua connector yang sudah dikonfigurasi. Tanpa `month` → bulan berjalan.
import { backfillMonths, configuredConnectors, syncMany } from "@/lib/connectors";
import { CONNECTORS, type ConnectorId } from "@/lib/connectors/catalog";
import { currentMonth, isMonth } from "@/lib/month";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { connectors?: string[]; month?: string; backfill?: number };
  const known = new Set(CONNECTORS.map((c) => c.id));
  const configured = await configuredConnectors();
  const ids = (body.connectors?.length ? body.connectors.filter((c): c is ConnectorId => known.has(c as ConnectorId)) : configured).filter((c) => configured.includes(c));
  if (!ids.length) {
    return Response.json({ error: "Belum ada connector yang dikonfigurasi. Isi kredensial di .env.local lalu cek di Pengaturan → Connectors." }, { status: 400 });
  }
  if (body.month && !isMonth(body.month)) return Response.json({ error: "Format bulan harus YYYY-MM." }, { status: 400 });
  const backfill = Math.min(Math.max(Number(body.backfill) || 0, 0), 24);
  const months = backfill ? backfillMonths(backfill) : [body.month ?? currentMonth()];
  const results = await syncMany(ids, months, "manual");
  return Response.json({ results });
}
