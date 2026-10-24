// POST /api/team/matches/{id} { decision: "confirmed" | "rejected" } — keputusan tim atas satu pasangan Story/Brief.
import { currentUser } from "@/lib/session";
import { decideMatch } from "@/modules/team/shared/services/match-decision-service";

export async function POST(req: Request, ctx: RouteContext<"/api/team/matches/[id]">) {
  const { id } = await ctx.params;
  const { decision } = (await req.json().catch(() => ({}))) as { decision?: string };
  if (decision !== "confirmed" && decision !== "rejected") return Response.json({ error: "decision must be “confirmed” or “rejected”." }, { status: 400 });
  try {
    await decideMatch(id, decision, (await currentUser())?.name ?? null);
  } catch {
    return Response.json({ error: "Match not found — it may have been recalculated. Reload the page." }, { status: 404 });
  }
  return Response.json({ ok: true });
}
