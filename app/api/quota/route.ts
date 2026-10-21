// POST /api/quota — { month: "default" | "YYYY-MM", values: { key: number | null } }; null = hapus override bulan.
import { prisma } from "@/lib/db";
import { isMonth } from "@/lib/month";
import { QUOTA_DEFAULTS } from "@/lib/sources";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { month, values } = (await req.json()) as { month?: string; values?: Record<string, number | null> };
  if (!(month === "default" || isMonth(month)) || !values) return Response.json({ error: "Invalid data." }, { status: 400 });
  const allowed = new Set(QUOTA_DEFAULTS.map((q) => q.key));
  for (const [key, value] of Object.entries(values)) {
    if (!allowed.has(key)) continue;
    if (value == null || !Number.isFinite(value) || value < 0) {
      if (month !== "default") await prisma.quota.deleteMany({ where: { month, key } });
      continue;
    }
    await prisma.quota.upsert({ where: { month_key: { month, key } }, update: { value }, create: { month, key, value } });
  }
  return Response.json({ ok: true });
}
