import { PLATFORM_LABEL } from "@/modules/shared/lib/sources";
import { monthLabel } from "@/modules/shared/lib/month";
import { MonthHeaderSection } from "@/modules/shared/sections/month-header-section";
import { getSocialOverview } from "../queries/social-overview-query";

/** Deskripsi menyebut platform bulan itu, jadi header ikut menunggu query halaman (di-cache, tidak dobel). */
export function SocialOverviewHeaderSection({ monthParam }: { monthParam: string | undefined }) {
  const describe = async (month: string) => {
    const { summary: s } = await getSocialOverview(month);
    if (!s.hasData) return undefined;
    return `Posts published in ${monthLabel(month)} · ${s.platforms.map((x) => PLATFORM_LABEL[x] ?? x).join(" + ") || "—"}`;
  };
  return <MonthHeaderSection title="Social Media" monthParam={monthParam} description={describe} />;
}
