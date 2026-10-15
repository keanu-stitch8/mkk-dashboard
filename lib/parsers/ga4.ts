// Parser export CSV GA4 (Traffic acquisition, Pages and screens, Landing page,
// Demographic details: City, dan report overview multi-blok seperti Generate leads / User acquisition).
import { findHeader, getCell, type HeaderMatch } from "./headers";
import { dataRows, isTotalLabel, makeDataset, monthFromRange, sum } from "./common";
import type { Dataset, RawTable } from "./types";
import { normalizePath, parseCount, parseDuration, parseRate, str } from "./values";

export const GA4_FIELDS = {
  channel: [
    "Session primary channel group (Default Channel Group)",
    "Session default channel group",
    "Session primary channel group",
    "Default channel group",
    "Grup saluran utama sesi (Grup Saluran Default)",
    "Grup saluran utama sesi",
    "Grup saluran default sesi",
    "Grup saluran default",
  ],
  firstChannel: [
    "First user primary channel group (Default Channel Group)",
    "First user default channel group",
    "First user primary channel group",
    "Grup saluran utama pengguna pertama (Grup Saluran Default)",
    "Grup saluran utama pengguna pertama",
    "Grup saluran default pengguna pertama",
  ],
  pagePath: [
    "Page path and screen class",
    "Page path + query string and screen class",
    "Page path + query string",
    "Page path",
    "Jalur halaman dan kelas layar",
    "Jalur halaman + string kueri dan kelas layar",
    "Jalur halaman + string kueri",
    "Jalur halaman",
  ],
  pageTitle: ["Page title and screen class", "Page title and screen name", "Page title", "Judul halaman dan kelas layar", "Judul halaman dan nama layar", "Judul halaman"],
  landing: ["Landing page", "Landing page + query string", "Halaman landing", "Halaman landing + string kueri", "Halaman tujuan", "Laman landing"],
  city: ["City", "Kota"],
  audience: ["Audience name", "Nama audiens"],
  nthDay: ["Nth day", "Hari ke-n", "Hari ke n"],
  sessions: ["Sessions", "Sesi"],
  engagedSessions: ["Engaged sessions", "Sesi engaged", "Sesi dengan interaksi", "Sesi yang berinteraksi", "Sesi interaksi"],
  engagementRate: ["Engagement rate", "Rasio engagement", "Rasio interaksi", "Tingkat engagement", "Tingkat interaksi"],
  avgEngagementSession: [
    "Average engagement time per session",
    "Rata-rata waktu engagement per sesi",
    "Rata-rata waktu interaksi per sesi",
  ],
  avgEngagementUser: [
    "Average engagement time per active user",
    "Average engagement time",
    "Rata-rata waktu engagement per pengguna aktif",
    "Rata-rata waktu interaksi per pengguna aktif",
    "Rata-rata waktu engagement",
    "Rata-rata waktu interaksi",
  ],
  eventCount: ["Event count", "Jumlah peristiwa", "Jumlah event"],
  views: ["Views", "Screen page views", "Tampilan", "Penayangan", "Dilihat", "Jumlah tampilan"],
  users: ["Total users", "Users", "Total pengguna", "Pengguna"],
  activeUsers: ["Active users", "Pengguna aktif"],
  newUsers: ["New users", "Pengguna baru"],
  returningUsers: ["Returning users", "Pengguna yang kembali", "Pengguna kembali"],
} as const;

type F = keyof typeof GA4_FIELDS;
// semua field numerik yang dibaca lewat n() adalah hitungan
const n = (row: unknown[], m: HeaderMatch<F>, f: F) => parseCount(getCell(row as never, m, f));

function find(table: RawTable, required: F[]) {
  return findHeader<F>(table.rows, GA4_FIELDS, required, 5);
}

export function detectGa4(table: RawTable): Dataset[] | null {
  // GA4 selalu punya komentar "#" di atas tabel; tabel tanpa komentar hanya diterima jika header-nya khas GA4
  const multiBlock = table.blockCount > 1;
  const warnings: string[] = [];

  // Landing page (cek sebelum traffic karena sama-sama punya Sessions)
  let m = find(table, ["landing", "sessions"]);
  if (m) {
    const month = monthFromRange(table, warnings);
    const rows = dataRows(table, m)
      .filter((r) => !isTotalLabel(getCell(r, m!, "landing")))
      .map((r) => ({
        path: normalizePath(str(getCell(r, m!, "landing"))) ?? str(getCell(r, m!, "landing")),
        sessions: n(r, m!, "sessions") ?? 0,
        activeUsers: n(r, m!, "activeUsers"),
        newUsers: n(r, m!, "newUsers"),
        avgEngagementTime: parseDuration(getCell(r, m!, "avgEngagementSession") ?? getCell(r, m!, "avgEngagementUser")),
      }));
    return [
      makeDataset("ga4_landing", table, m, {
        month,
        rows,
        warnings,
        metrics: [
          { channel: "website", key: "landing_sessions", value: sum(rows.map((r) => r.sessions)) },
          ...(m.columns.newUsers !== undefined
            ? [{ channel: "website" as const, key: "newUsers_est", value: sum(rows.map((r) => r.newUsers)) }]
            : []),
        ],
      }),
    ];
  }

  // Traffic acquisition per channel
  m = find(table, ["channel", "sessions"]);
  if (m) {
    const month = monthFromRange(table, warnings);
    const rows = dataRows(table, m)
      .filter((r) => !isTotalLabel(getCell(r, m!, "channel")))
      .map((r) => {
        const sessions = n(r, m!, "sessions") ?? 0;
        const engaged = n(r, m!, "engagedSessions");
        const rate = parseRate(getCell(r, m!, "engagementRate"), "fraction");
        return {
          channel: str(getCell(r, m!, "channel")) || "(not set)",
          sessions,
          engagedSessions: engaged ?? (rate !== null ? Math.round(rate * sessions) : null),
          engagementRate: rate ?? (engaged !== null && sessions ? engaged / sessions : null),
          avgEngagementTime: parseDuration(getCell(r, m!, "avgEngagementSession")),
          eventCount: n(r, m!, "eventCount"),
          users: n(r, m!, "users") ?? n(r, m!, "activeUsers"),
          newUsers: n(r, m!, "newUsers"),
        };
      });
    return [makeDataset("ga4_traffic", table, m, { month, rows, warnings })];
  }

  // Overview multi-blok: ambil angka total users / new users
  if (multiBlock) {
    const metrics: Dataset["metrics"] = [];
    const breakdowns: Dataset["breakdowns"] = [];
    m = find(table, ["audience", "activeUsers"]);
    if (m) {
      const all = dataRows(table, m).find((r) => /^(all users|semua pengguna)$/i.test(str(getCell(r, m!, "audience"))));
      const v = all ? n(all, m, "activeUsers") : null;
      if (v !== null) metrics.push({ channel: "website", key: "users", value: v });
    }
    m = find(table, ["firstChannel", "newUsers"]);
    if (m) {
      const rows = dataRows(table, m);
      for (const r of rows) {
        const v = n(r, m, "newUsers");
        if (v !== null) breakdowns.push({ channel: "website", dimension: "first_channel", label: str(getCell(r, m, "firstChannel")), metric: "newUsers", value: v });
      }
      metrics.push({ channel: "website", key: "newUsers", value: sum(breakdowns.map((b) => b.value)) });
    }
    if (!metrics.length) {
      m = find(table, ["nthDay", "newUsers"]);
      if (m) {
        metrics.push({ channel: "website", key: "newUsers_daily", value: sum(dataRows(table, m).map((r) => n(r, m!, "newUsers"))) });
      }
    }
    if (metrics.length || breakdowns.length) {
      const month = monthFromRange(table, warnings);
      return [makeDataset("ga4_overview", table, m, { month, metrics, breakdowns, warnings, priority: 1 })];
    }
    // blok overview lain (retensi, platform, dst) dilewati tanpa error
    return [];
  }

  // Pages and screens
  m = find(table, ["pagePath", "views"]) ?? find(table, ["pageTitle", "views"]);
  if (m) {
    const month = monthFromRange(table, warnings);
    const byPath = m.columns.pagePath !== undefined;
    const rows = dataRows(table, m)
      .filter((r) => !isTotalLabel(getCell(r, m!, byPath ? "pagePath" : "pageTitle")))
      .map((r) => {
        const raw = str(getCell(r, m!, byPath ? "pagePath" : "pageTitle"));
        return {
          path: byPath ? normalizePath(raw) ?? raw : raw,
          title: m!.columns.pageTitle !== undefined ? str(getCell(r, m!, "pageTitle")) : null,
          views: n(r, m!, "views") ?? 0,
          activeUsers: n(r, m!, "activeUsers") ?? n(r, m!, "users"),
          avgEngagementTime: parseDuration(getCell(r, m!, "avgEngagementUser")),
          eventCount: n(r, m!, "eventCount"),
        };
      });
    if (!byPath) warnings.push("Export per judul halaman (bukan path) — views tidak bisa dicocokkan ke URL artikel News.");
    return [makeDataset("ga4_pages", table, m, { month, rows, warnings })];
  }

  // Demographic details: City
  m = find(table, ["city", "activeUsers"]);
  if (m) {
    const month = monthFromRange(table, warnings);
    const rows = dataRows(table, m).filter((r) => !isTotalLabel(getCell(r, m!, "city")));
    const breakdowns = rows.map((r) => ({
      channel: "website" as const,
      dimension: "city",
      label: str(getCell(r, m!, "city")) || "(not set)",
      metric: "activeUsers",
      value: n(r, m!, "activeUsers") ?? 0,
    }));
    const metrics: Dataset["metrics"] = [{ channel: "website", key: "users_est", value: sum(breakdowns.map((b) => b.value)) }];
    if (m.columns.newUsers !== undefined) metrics.push({ channel: "website", key: "newUsers_est", value: sum(rows.map((r) => n(r, m!, "newUsers"))) });
    return [makeDataset("ga4_city", table, m, { month, breakdowns, metrics, warnings })];
  }

  return null;
}
