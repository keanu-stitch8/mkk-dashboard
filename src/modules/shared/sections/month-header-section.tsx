import type { ReactNode } from "react";
import { PageHeader } from "@/components/PageHeader";
import { resolveMonth } from "../queries/month-query";

/** Judul halaman + pilihan bulan; deskripsi boleh bergantung pada bulan yang terpilih. */
export async function MonthHeaderSection({ title, monthParam, description }: { title: string; monthParam: string | undefined; description?: (month: string) => ReactNode }) {
  const { month, months } = await resolveMonth(monthParam);
  return <PageHeader title={title} month={month} months={months} description={description?.(month)} />;
}
