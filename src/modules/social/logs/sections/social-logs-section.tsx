import { monthLabel } from "@/lib/month";
import { EmptyState } from "@/components/blocks";
import { resolveMonth } from "@/modules/shared/queries/month-query";
import { SocialLogsContent } from "../components/social-logs-content";
import { getSocialLogsPage } from "../queries/social-logs-query";

export async function SocialLogsSection({ monthParam }: { monthParam: string | undefined }) {
  const { month } = await resolveMonth(monthParam);
  const logs = await getSocialLogsPage(month);
  if (!logs.rows.length) return <EmptyState channel="Social Media" month={month} source="MKK Kudus Social Media - Publishing Log" />;
  return <SocialLogsContent logs={logs} />;
}

/** Deskripsi header hanya saat ada data — bulan kosong memakai deskripsi bawaan PageHeader (sama dengan sebelum refactor). */
export async function describeSocialLogsHeader(month: string) {
  return (await getSocialLogsPage(month)).rows.length > 0 ? `All Social Media content in the ${monthLabel(month)} publishing log. Titles are clickable when the post matches an Instagram post (stories can't be matched).` : undefined;
}
