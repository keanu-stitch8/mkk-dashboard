// POST /api/quota — { month: "default" | "YYYY-MM", values: { key: number | null } }; null = hapus override bulan.
import { isMonth } from "@/lib/month";
import { saveQuotas } from "@/modules/shared/services/quota-service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { month, values } = (await req.json()) as { month?: string; values?: Record<string, number | null> };
  if (!(month === "default" || isMonth(month)) || !values) return Response.json({ error: "Invalid data." }, { status: 400 });
  await saveQuotas(month, values);
  return Response.json({ ok: true });
}
