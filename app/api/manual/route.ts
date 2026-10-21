// POST /api/manual — { month, channel, values: { key: number | null } }; null = hapus override.
import { prisma } from "@/lib/db";
import { isMonth } from "@/lib/month";
import { MANUAL_FIELDS } from "@/lib/sources";
import type { Channel } from "@/lib/parsers/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as { month?: string; channel?: Channel; values?: Record<string, number | null> };
  const { month, channel, values } = body;
  if (!isMonth(month) || !channel || !(channel in MANUAL_FIELDS) || !values) {
    return Response.json({ error: "Invalid data." }, { status: 400 });
  }
  const allowed = new Set(MANUAL_FIELDS[channel].map((f) => f.key));
  for (const [key, value] of Object.entries(values)) {
    if (!allowed.has(key)) continue;
    if (value == null || !Number.isFinite(value)) {
      await prisma.manualMetric.deleteMany({ where: { month, channel, key } });
    } else {
      await prisma.manualMetric.upsert({
        where: { month_channel_key: { month, channel, key } },
        update: { value },
        create: { month, channel, key, value },
      });
    }
  }
  return Response.json({ ok: true });
}
