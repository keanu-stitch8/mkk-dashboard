import type { ReactNode } from "react";
import { MonthSelect } from "./MonthSelect";
import { monthLabel } from "@/lib/month";

/** Judul halaman gaya shadcnstore template: h1 2xl bold + deskripsi, kontrol (bulan + aksi) di kanan. */
export function PageHeader({ title, month, months, actions, description }: { title: string; month: string; months: string[]; actions?: ReactNode; description?: ReactNode }) {
  return (
    <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center md:gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description ?? `Monthly report · ${monthLabel(month)}`}</p>
      </div>
      <div className="no-print flex flex-wrap items-center gap-2">
        <MonthSelect month={month} months={months} />
        {actions}
      </div>
    </header>
  );
}
