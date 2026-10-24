// POST /api/connectors/lock — { month: "YYYY-MM", locked: boolean } → kunci / buka kunci bulan final.
import { setMonthLock } from "@/lib/connectors/lock";
import { currentMonth, isMonth } from "@/lib/month";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { month?: string; locked?: boolean };
  if (!body.month || !isMonth(body.month)) return Response.json({ error: "Month must be in YYYY-MM format." }, { status: 400 });
  if (body.locked && body.month >= currentMonth()) return Response.json({ error: "The current month can't be locked yet." }, { status: 400 });
  await setMonthLock(body.month, !!body.locked, body.locked ? "Locked manually" : undefined);
  return Response.json({ ok: true });
}
