import "server-only";
import type { AssetState } from "@/modules/team/ingest/contributors";
import { lastMonths } from "@/modules/shared/lib/month";
import { articleKey } from "@/modules/team/ingest/store";
import { contentQuota } from "@/modules/channels/lib/content-quota";
import { getMonthBundle } from "@/modules/channels/services/month-bundle-service";
import { derivativesByArticle } from "../../pipeline/services/derivatives-service";
import { loadBriefs } from "../../shared/services/brief-service";
import { backlogSince, buildScores, SCORECARD_FROM, scorecardEnd, snapshotScores } from "../lib/scorecard";
import { deleteScoreSnapshot, findContributorAssetStates, findPublishedArticles, findScoreSnapshot, replaceScoreSnapshot } from "../repositories/scorecard-repository";
import type { Score, Scorecard, ScorecardMonth } from "../types/scorecard";

// Bulan yang dikunci disimpan sebagai snapshot (TeamScore) supaya tidak berubah lagi; bulan lain dihitung live.

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

/** Hitung keenam ukuran untuk satu bulan dari data saat ini. */
export async function computeScorecard(month: string): Promise<Score[]> {
  const end = scorecardEnd(month, today());
  const articles = await findPublishedArticles(month);
  const articleDates = new Map(articles.map((a) => [articleKey(a), a.date!]));
  const derivs = await derivativesByArticle(articleDates);
  const since = backlogSince(end);
  const briefs = (await loadBriefs({})).filter((b) => b.date <= end && b.date >= since);
  const tasks = await findContributorAssetStates(month);
  const bundle = await getMonthBundle(month);
  return buildScores({
    month,
    end,
    articleCount: articles.length,
    articleDates,
    derivs,
    briefs,
    assetStates: tasks.map((t) => ({ landscape: t.landscape as AssetState, portrait: t.portrait as AssetState, video: t.video as AssetState, interview: t.interview as AssetState })),
    quotas: (["news", "social", "youtube"] as const).map((ch) => contentQuota(bundle, ch)),
  });
}

/** Snapshot (bulan terkunci) atau hitungan live. */
export async function getScorecard(month: string): Promise<Scorecard> {
  const snap = await findScoreSnapshot(month);
  if (snap.length) return { scores: snapshotScores(snap), frozenAt: snap[0].createdAt };
  return { scores: await computeScorecard(month), frozenAt: null };
}

/** Riwayat beberapa bulan terakhir (sejak data tim tersedia). */
export async function scorecardHistory(month: string, n = 6, from = SCORECARD_FROM): Promise<ScorecardMonth[]> {
  const months = lastMonths(month, n).filter((m) => m >= from);
  return Promise.all(months.map(async (m) => ({ month: m, ...(await getScorecard(m)) })));
}

/** Dipanggil saat bulan dikunci: simpan angka saat itu. Buka kunci → hapus, kembali live. */
export async function snapshotScorecard(month: string): Promise<void> {
  await replaceScoreSnapshot(month, await computeScorecard(month));
}

export async function clearScorecard(month: string): Promise<void> {
  await deleteScoreSnapshot(month);
}
