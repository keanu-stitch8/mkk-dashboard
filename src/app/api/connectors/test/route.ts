// POST /api/connectors/test — { connector } → { ok, message }
import { getConnector } from "@/modules/connectors/sources";
import { ConnectorError } from "@/modules/connectors/sources/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { connector } = (await req.json().catch(() => ({}))) as { connector?: string };
  try {
    const c = getConnector(connector ?? "");
    const status = await c.status();
    if (!status.configured) {
      return Response.json({ ok: false, message: status.missing.length ? `Missing in .env.local: ${status.missing.join(", ")}.` : (status.account ?? "Credentials are incomplete.") });
    }
    return Response.json(await c.testConnection());
  } catch (e) {
    return Response.json({ ok: false, message: e instanceof ConnectorError ? e.message : String(e) });
  }
}
