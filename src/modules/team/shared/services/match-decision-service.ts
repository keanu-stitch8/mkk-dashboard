import "server-only";
import { GENERATED_MATCH_STATUSES } from "@/lib/team/match";
import { deleteOtherGeneratedMatches, setMatchDecision } from "../repositories/match-decision-repository";

/** Keputusan tim atas satu pasangan. Konfirmasi menyingkirkan saran lain untuk item yang sama. */
export async function decideMatch(id: string, decision: "confirmed" | "rejected", by: string | null = null): Promise<void> {
  const m = await setMatchDecision(id, decision, by);
  if (decision === "confirmed") await deleteOtherGeneratedMatches(m, GENERATED_MATCH_STATUSES);
}
