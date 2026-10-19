// POST /api/reports/generate — { channel: "website", month: "YYYY-MM" } → buat laporan Google Sheets baru.
import { generateReport } from "@/lib/reports/engine/generate";
import { isMonth } from "@/lib/month";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { channel?: string; month?: string };
  if (!body.channel || !body.month || !isMonth(body.month)) return Response.json({ error: "channel & month (YYYY-MM) wajib." }, { status: 400 });
  const r = await generateReport(body.channel, body.month, "manual");
  return Response.json(r, { status: r.status === "success" ? 200 : 500 });
}
