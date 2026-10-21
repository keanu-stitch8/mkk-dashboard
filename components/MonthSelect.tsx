"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addMonths, monthLabel } from "@/lib/month";

/** Selector bulan: daftar bulan yang punya data + 1 bulan setelah yang terakhir. */
export function MonthSelect({ month, months }: { month: string; months: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const last = months.at(-1) ?? month;
  const options = [...new Set([...months, month, addMonths(last, 1)])].sort().reverse();
  const go = (m: string) => router.push(`${pathname}?m=${m}`);

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" onClick={() => go(addMonths(month, -1))} aria-label="Previous month">
        <ChevronLeft />
      </Button>
      <Select value={month} onValueChange={go}>
        <SelectTrigger className="w-44" aria-label="Select month">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((m) => (
            <SelectItem key={m} value={m}>
              {monthLabel(m)}
              {!months.includes(m) && <span className="text-muted-foreground"> · empty</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="icon" onClick={() => go(addMonths(month, 1))} disabled={options[0] === month} aria-label="Next month">
        <ChevronRight />
      </Button>
    </div>
  );
}
