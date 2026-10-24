import type { ReportRow } from "../types/report";

type Generated = { channel: string; url: string | null; pdfUrl: string | null; status: string; createdAt: Date; error: string | null; warnings: string | null };

/** Satu baris per channel laporan: template terkonfigurasi? + laporan terbaru bulan ini (generated urut terbaru). */
export function buildReportRows(channels: { id: string; title: string }[], templateOf: (id: string) => string | null, generated: Generated[]): ReportRow[] {
  return channels.map((ch) => {
    const latest = generated.find((g) => g.channel === ch.id);
    const template = templateOf(ch.id);
    return {
      channel: ch.id,
      title: ch.title,
      configured: !!template,
      templateUrl: template ? `https://docs.google.com/spreadsheets/d/${template}/edit` : null,
      latest: latest ? { url: latest.url, pdfUrl: latest.pdfUrl, status: latest.status, createdAt: latest.createdAt.toISOString(), error: latest.error, warnings: latest.warnings } : null,
    };
  });
}
