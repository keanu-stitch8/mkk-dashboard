// Connector YouTube — OAuth akun pemilik channel.
//  • Data API v3: channel + playlist uploads → video yang dipublish di bulan laporan (tanpa Shorts)
//  • Analytics API v2 (reports.query): views, watch time, avg view duration, subscribers, likes, comments, shares
//  • Reporting API v1 (laporan "Reach" channel_reach_basic_a1): impressions & CTR thumbnail.
//    Metrik ini tidak ada di Analytics API. Laporan Reach hanya tersedia 60 hari (+30 hari histori saat job dibuat),
//    jadi setiap laporan harian disimpan permanen di tabel YtReachDaily.
import { google, type youtube_v3, type youtubeAnalytics_v2, type youtubereporting_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { prisma } from "../../db";
import { daysInMonth } from "../../month";
import type { Connector, ConnectorStatus, TestResult } from "../types";
import { ConnectorError } from "../types";
import { monthRange, withRetry } from "../common";
import { PACIFIC, addDays, dateIn } from "../../tz";
import { googleErrorMessage, isRetryableGoogleError } from "../google-errors";
import { GOOGLE_SCOPES, oauthAccount, oauthClientConfigured } from "../google-oauth";
import { resolveGoogleAuth, type AuthInfo } from "../google-auth";
import { aggregateReach, isoDuration, keepUniqueViewers, mapYoutubeMonth, parseReachCsv, wibDate, type VideoMeta } from "./map";

const REACH_REPORT_TYPE = "channel_reach_basic_a1";
/** Durasi maksimum YouTube Shorts (detik). Video lebih panjang pasti bukan Shorts. */
const SHORTS_MAX_SEC = 180;

interface Clients {
  auth: OAuth2Client;
  yt: youtube_v3.Youtube;
  analytics: youtubeAnalytics_v2.Youtubeanalytics;
  reporting: youtubereporting_v1.Youtubereporting;
  info: AuthInfo;
}

async function clients(): Promise<Clients> {
  const { auth, info } = await resolveGoogleAuth("youtube", GOOGLE_SCOPES.youtube, "YouTube");
  const a = auth as OAuth2Client;
  return {
    auth: a,
    yt: google.youtube({ version: "v3", auth: a }),
    analytics: google.youtubeAnalytics({ version: "v2", auth: a }),
    reporting: google.youtubereporting({ version: "v1", auth: a }),
    info,
  };
}

const retry = <T>(fn: () => Promise<T>) => withRetry(fn, isRetryableGoogleError);

function translate(e: unknown, info?: AuthInfo): ConnectorError {
  if (e instanceof ConnectorError) return e;
  return new ConnectorError(googleErrorMessage(e, { api: "youtube", authMode: info?.mode, account: info?.account }), String((e as Error)?.message ?? e));
}

async function myChannel(c: Clients): Promise<{ id: string; title: string; uploads: string; subscribers: number }> {
  const { data } = await retry(() => c.yt.channels.list({ mine: true, part: ["id", "snippet", "contentDetails", "statistics"] }));
  const ch = data.items?.[0];
  if (!ch?.id || !ch.contentDetails?.relatedPlaylists?.uploads) {
    throw new ConnectorError(`Akun Google ${c.info.account ? `${c.info.account} ` : ""}tidak punya channel YouTube. Hubungkan ulang dan pilih akun / Brand Account channel Main ke Kudus di layar pilih akun Google.`);
  }
  return { id: ch.id, title: ch.snippet?.title ?? ch.id, uploads: ch.contentDetails.relatedPlaylists.uploads, subscribers: Number(ch.statistics?.subscriberCount ?? 0) };
}

/** Video yang dipublish di bulan ini (tanggal WIB), dari playlist uploads (urut terbaru). */
async function monthUploads(c: Clients, uploads: string, month: string): Promise<VideoMeta[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 40; page++) {
    const { data } = await retry(() => c.yt.playlistItems.list({ playlistId: uploads, part: ["contentDetails"], maxResults: 50, pageToken }));
    let older = false;
    for (const it of data.items ?? []) {
      const at = it.contentDetails?.videoPublishedAt;
      if (!at || !it.contentDetails?.videoId) continue;
      const d = wibDate(at);
      if (d.startsWith(month)) ids.push(it.contentDetails.videoId);
      else if (d < `${month}-01`) older = true;
    }
    pageToken = data.nextPageToken ?? undefined;
    if (!pageToken || older) break;
  }
  const out: VideoMeta[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const { data } = await retry(() => c.yt.videos.list({ id: ids.slice(i, i + 50), part: ["snippet", "contentDetails"], maxResults: 50 }));
    for (const v of data.items ?? []) {
      if (!v.id || !v.snippet?.publishedAt) continue;
      out.push({ id: v.id, title: v.snippet.title ?? v.id, publishedAt: v.snippet.publishedAt, durationSec: isoDuration(v.contentDetails?.duration) });
    }
  }
  return out;
}

/**
 * Shorts = mirror Reels, tidak masuk laporan YouTube (sama dengan filter "Long-form Videos" di Studio).
 * API tidak punya penanda Shorts; dicek lewat youtube.com/shorts/{id} (200 = Shorts, redirect = video biasa).
 */
async function isShort(v: VideoMeta): Promise<boolean> {
  if (v.durationSec == null || v.durationSec > SHORTS_MAX_SEC) return false;
  try {
    const res = await fetch(`https://www.youtube.com/shorts/${v.id}`, { method: "HEAD", redirect: "manual" });
    return res.status === 200;
  } catch {
    return v.durationSec <= 60;
  }
}

/** Pastikan reporting job Reach ada; buat jika belum. */
async function ensureReachJob(c: Clients): Promise<{ id: string; created: boolean; createTime?: string }> {
  const { data } = await retry(() => c.reporting.jobs.list());
  const job = data.jobs?.find((j) => j.reportTypeId === REACH_REPORT_TYPE);
  if (job?.id) return { id: job.id, created: false, createTime: job.createTime ?? undefined };
  const res = await retry(() => c.reporting.jobs.create({ requestBody: { reportTypeId: REACH_REPORT_TYPE, name: "MKK Dashboard — Reach" } }));
  return { id: res.data.id!, created: true, createTime: res.data.createTime ?? undefined };
}

/** Unduh laporan Reach yang belum tersimpan → YtReachDaily. Mengembalikan jumlah laporan baru. */
async function ingestReachReports(c: Clients, jobId: string): Promise<number> {
  const known = new Set((await prisma.ytReachReport.findMany({ select: { id: true } })).map((r) => r.id));
  const pending: youtubereporting_v1.Schema$Report[] = [];
  let pageToken: string | undefined;
  do {
    const { data } = await retry(() => c.reporting.jobs.reports.list({ jobId, pageToken }));
    pending.push(...(data.reports ?? []).filter((r) => r.id && r.downloadUrl && !known.has(r.id)));
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);
  // urut createTime: laporan ulang (restatement) untuk hari yang sama diproses belakangan dan menggantikan versi lama
  pending.sort((a, b) => (a.createTime ?? "").localeCompare(b.createTime ?? ""));
  for (const rep of pending) {
    const res = await retry(() => c.auth.request<string>({ url: rep.downloadUrl!, responseType: "text" }));
    const rows = parseReachCsv(typeof res.data === "string" ? res.data : String(res.data));
    // tanggal dari isi CSV; laporan kosong → startTime (00:00 Pacific, PDT/PST) dikonversi lewat zona IANA
    const dates = [...new Set(rows.map((r) => r.date))];
    const date = dates[0] ?? (rep.startTime ? dateIn(rep.startTime, PACIFIC) : "");
    await prisma.$transaction(async (tx) => {
      // laporan ulang untuk hari yang sama menggantikan data hari itu
      if (dates.length || date) await tx.ytReachDaily.deleteMany({ where: { date: { in: dates.length ? dates : [date] } } });
      for (let i = 0; i < rows.length; i += 200) await tx.ytReachDaily.createMany({ data: rows.slice(i, i + 200) });
      await tx.ytReachReport.create({ data: { id: rep.id!, date } });
    });
  }
  return pending.length;
}

export const youtube: Connector = {
  id: "youtube",
  env: [
    { name: "GOOGLE_OAUTH_CLIENT_ID", required: true, hint: "OAuth client (sama dengan GA4/GSC)." },
    { name: "GOOGLE_OAUTH_CLIENT_SECRET", required: true, hint: "Secret OAuth client." },
  ],

  async status(): Promise<ConnectorStatus> {
    const missing = this.env.filter((v) => v.required && !process.env[v.name]?.trim()).map((v) => v.name);
    const oauth = { ...(await oauthAccount("youtube")), available: oauthClientConfigured() };
    if (oauth.connected) return { configured: !missing.length, missing, account: `Akun Google ${oauth.account ?? ""}`.trim(), oauth };
    return { configured: false, missing, account: "Klik “Hubungkan akun Google” dan pilih akun / Brand Account pemilik channel Main ke Kudus.", oauth };
  },

  async testConnection(): Promise<TestResult> {
    let info: AuthInfo | undefined;
    try {
      const c = await clients();
      info = c.info;
      const ch = await myChannel(c);
      // hari YouTube Analytics = Pacific Time; 2 hari terakhir belum lengkap
      const end = addDays(dateIn(new Date(), PACIFIC), -2);
      const start = addDays(end, -6);
      const { data } = await retry(() => c.analytics.reports.query({ ids: "channel==MINE", startDate: start, endDate: end, metrics: "views,estimatedMinutesWatched" }));
      const views = Number(data.rows?.[0]?.[0] ?? 0);
      let reach = "";
      try {
        const job = await ensureReachJob(c);
        reach = job.created
          ? " Job laporan Reach (impressions & CTR) baru dibuat — laporan pertama tersedia ±2 hari lagi, berisi 30 hari ke belakang."
          : " Laporan Reach (impressions & CTR) aktif.";
      } catch (e) {
        reach = ` ⚠ Impressions & CTR belum bisa: ${translate(e, info).message}`;
      }
      return { ok: true, message: `Terhubung ke channel “${ch.title}” (${ch.subscribers.toLocaleString("id-ID")} subscriber). Views 7 hari (${start} s/d ${end}): ${views.toLocaleString("id-ID")}.${reach}` };
    } catch (e) {
      return { ok: false, message: translate(e, info).message };
    }
  },

  async fetchMonth(month: string) {
    const c = await clients();
    try {
      // hari YouTube Analytics & Reporting API = Pacific Time (dokumentasi dimensi day; terverifikasi pada laporan Reach)
      const { start, end, partial } = monthRange(month, new Date(), PACIFIC);
      const ch = await myChannel(c);
      const all = await monthUploads(c, ch.uploads, month);
      const shorts = new Set<string>();
      for (const v of all) if (await isShort(v)) shorts.add(v.id);
      const videos = all.filter((v) => !shorts.has(v.id));
      const warnings: string[] = [];
      if (shorts.size) warnings.push(`${shorts.size} YouTube Shorts tidak dihitung (mirror Reels; laporan hanya video long-form).`);
      if (!videos.length) warnings.push(`Tidak ada video long-form yang dipublish ${month} di channel “${ch.title}”.`);

      const filters = videos.length ? `video==${videos.map((v) => v.id).join(",")}` : undefined;
      const empty = { columnHeaders: [], rows: [] };
      const [perVideo, daily, totals] = filters
        ? await Promise.all([
            retry(() =>
              c.analytics.reports.query({
                ids: "channel==MINE",
                startDate: start,
                endDate: end,
                dimensions: "video",
                filters,
                metrics: "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost,likes,comments,shares",
                sort: "-views",
                maxResults: 200,
              }),
            ).then((r) => r.data),
            retry(() => c.analytics.reports.query({ ids: "channel==MINE", startDate: start, endDate: end, dimensions: "day", filters, metrics: "views,estimatedMinutesWatched", sort: "day" })).then(
              (r) => r.data,
            ),
            // total kohort (tanpa dimensi) = baris "Total" YouTube Studio
            retry(() => c.analytics.reports.query({ ids: "channel==MINE", startDate: start, endDate: end, filters, metrics: "views,estimatedMinutesWatched,averageViewDuration" })).then((r) => r.data),
          ])
        : [empty, empty, undefined];

      // Impressions & CTR dari laporan Reach yang tersimpan
      let reach: Map<string, { impressions: number; ctr: number | null }> | null = null;
      try {
        const job = await ensureReachJob(c);
        await ingestReachReports(c, job.id);
        const days = daysInMonth(month).filter((d) => d <= end);
        const covered = new Set((await prisma.ytReachReport.findMany({ where: { date: { gte: days[0], lte: days.at(-1) } }, select: { date: true } })).map((r) => r.date));
        if (covered.size === days.length) {
          const rows = await prisma.ytReachDaily.findMany({ where: { date: { gte: days[0], lte: days.at(-1) }, videoId: { in: videos.map((v) => v.id) } } });
          reach = aggregateReach(rows);
        } else {
          warnings.push(
            covered.size
              ? `Impressions & CTR dari API baru mencakup ${covered.size} dari ${days.length} hari (laporan Reach hanya 30 hari histori sejak job dibuat).`
              : `Impressions & CTR belum tersedia dari API untuk bulan ini${job.created ? " (job laporan Reach baru dibuat; laporan pertama ±2 hari lagi)" : ""}.`,
          );
        }
      } catch (e) {
        warnings.push(`Impressions & CTR tidak bisa diambil: ${translate(e, c.info).message}`);
      }

      // Data yang tidak ada di API (atau belum tersedia) diambil dari import sebelumnya (CSV Studio) supaya tidak tertimpa kosong.
      const prevVideos = await prisma.ytVideo.findMany({ where: { month }, select: { videoId: true, impressions: true, ctr: true, uniqueViewers: true } });
      if (!reach) {
        const prev = prevVideos.filter((p) => p.impressions != null);
        if (prev.length) {
          reach = new Map(prev.map((p) => [p.videoId, { impressions: p.impressions ?? 0, ctr: p.ctr }]));
          warnings.push("Impressions & CTR memakai data import sebelumnya (export YouTube Studio).");
        }
      }
      // Unique viewers tidak tersedia di YouTube Analytics API.
      const prevTotal = await prisma.metric.findFirst({ where: { month, channel: "youtube", key: "uniqueViewers", import: { source: "yt_table" } } });
      const uniqueViewers = keepUniqueViewers(
        videos.map((v) => v.id),
        prevVideos,
        prevTotal?.value ?? null,
      );
      if (uniqueViewers.perVideo.size) {
        warnings.push(
          uniqueViewers.total != null
            ? "Unique viewers memakai data import sebelumnya (tidak tersedia di API YouTube)."
            : "Unique viewers per video memakai data import sebelumnya; total tidak dipakai karena daftar video berbeda dari import itu (unique viewers tidak bisa dijumlah).",
        );
      }

      const datasets = mapYoutubeMonth({ videos, perVideo, daily, reach, totals, uniqueViewers }, month, `API YouTube · ${ch.title} · ${start} s/d ${end}`);
      if (partial) warnings.push(`Bulan berjalan — data sampai ${end} (Pacific Time).`);
      for (const d of datasets) d.warnings.push(...warnings);
      return datasets;
    } catch (e) {
      throw translate(e, c.info);
    }
  },
};
