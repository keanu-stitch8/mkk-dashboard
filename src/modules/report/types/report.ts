import type { MonthBundle } from "@/modules/channels/types/month-bundle";
import type { OverviewComparison, OverviewKpis } from "@/modules/overview/lib/overview-kpis";
import type { QuotaPair } from "@/modules/overview/types/overview";
import type { SocialComparable } from "@/modules/social/overview/lib/social-compare";
import type { Recommendation } from "@/modules/recommendations/lib/recommendations";

/** Satu baris tombol "Generate Google Sheets report" per channel + laporan terakhir bulan ini. */
export interface ReportRow {
  channel: string;
  title: string;
  configured: boolean;
  /** link edit master template (null = belum dikonfigurasi) */
  templateUrl: string | null;
  latest: { url: string | null; pdfUrl: string | null; status: string; createdAt: string; error: string | null; warnings: string | null } | null;
}

export interface ReportPage {
  month: string;
  months: string[];
  cur: MonthBundle;
  prev: MonthBundle;
  kpi: OverviewKpis;
  cmp: OverviewComparison;
  quotas: { news: QuotaPair; social: QuotaPair; youtube: QuotaPair };
  socialComparable: SocialComparable | null;
  recommendations: Recommendation[];
  /** bulan dikunci → laporan memakai angka beku */
  locked: boolean;
  reportRows: ReportRow[];
}
