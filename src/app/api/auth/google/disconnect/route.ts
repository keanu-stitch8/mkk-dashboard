// POST /api/auth/google/disconnect — { connector } → hapus token OAuth (dicabut di Google hanya jika akunnya tidak dipakai connector lain).
import { disconnect, isGoogleOAuthConnector } from "@/lib/connectors/google-oauth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { connector } = (await req.json().catch(() => ({}))) as { connector?: string };
  if (!connector || !isGoogleOAuthConnector(connector)) return Response.json({ error: "Unknown connector." }, { status: 400 });
  const res = await disconnect(connector);
  return Response.json({ ok: true, ...res });
}
