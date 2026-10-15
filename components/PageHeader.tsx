import type { ReactNode } from "react";
import { MonthSelect } from "./MonthSelect";
import { monthLabel } from "@/lib/month";

export function PageHeader({ title, month, months, actions, description }: { title: string; month: string; months: string[]; actions?: ReactNode; description?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Laporan bulanan · {monthLabel(month)}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="no-print flex flex-wrap items-center gap-2">
        <MonthSelect month={month} months={months} />
        {actions}
      </div>
    </header>
  );
}
