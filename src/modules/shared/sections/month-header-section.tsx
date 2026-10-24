import type { ReactNode } from "react";
import { PageHeader } from "@/components/PageHeader";
import { resolveMonth } from "../queries/month-query";

/**
 * Judul halaman + pilihan bulan. Deskripsi boleh bergantung pada bulan, atau async bila butuh data halaman
 * (memakai query yang sama dengan section konten — `cache()` mencegah query ganda).
 */
export async function MonthHeaderSection({
  title,
  monthParam,
  description,
}: {
  title: string;
  monthParam: string | undefined;
  description?: (month: string) => ReactNode | Promise<ReactNode>;
}) {
  const { month, months } = await resolveMonth(monthParam);
  return <PageHeader title={title} month={month} months={months} description={await description?.(month)} />;
}
