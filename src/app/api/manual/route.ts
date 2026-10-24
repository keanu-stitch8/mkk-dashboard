// POST /api/manual — { month, channel, values: { key: number | null } }; null = hapus override.
import { isMonth } from "@/lib/month";
import { MANUAL_FIELDS } from "@/lib/sources";
import type { Channel } from "@/lib/parsers/types";
import { saveManualMetrics } from "@/modules/shared/services/manual-metric-service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as { month?: string; channel?: Channel; values?: Record<string, number | null> };
  const { month, channel, values } = body;
  if (!isMonth(month) || !channel || !(channel in MANUAL_FIELDS) || !values) {
    return Response.json({ error: "Invalid data." }, { status: 400 });
  }
  await saveManualMetrics(month, channel, values);
  return Response.json({ ok: true });
}
