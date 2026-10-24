import type { ReactNode } from "react";
import { MonthSelect } from "./MonthSelect";
import { monthLabel } from "@/lib/month";

type Props = { title: string; actions?: ReactNode } & (
  | { month: string; months: string[]; description?: ReactNode }
  // halaman tanpa pilihan bulan (mis. riwayat) wajib memberi deskripsi sendiri
  | { month?: undefined; months?: undefined; description: ReactNode }
);

/** Judul halaman gaya shadcnstore template: h1 2xl bold + deskripsi, kontrol (bulan + aksi) di kanan. */
export function PageHeader({ title, month, months, actions, description }: Props) {
  return (
    <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center md:gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description ?? `Monthly report · ${monthLabel(month!)}`}</p>
      </div>
      {(month || actions) && (
        <div className="no-print flex flex-wrap items-center gap-2">
          {month && <MonthSelect month={month} months={months ?? []} />}
          {actions}
        </div>
      )}
    </header>
  );
}
