import { Lightbulb } from "lucide-react";
import type { Recommendation } from "@/lib/recommendations";
import { CHANNEL_LABEL } from "@/lib/sources";
import { Badge } from "@/components/ui/badge";
import { Section, StatusBadge } from "./blocks";

const TONE = { tinggi: "bad", sedang: "warn", rendah: "neutral" } as const;
const PRIORITY = { tinggi: "High", sedang: "Medium", rendah: "Low" } as const;

export function Recommendations({ items, title = "Recommendations", showChannel = true, note }: { items: Recommendation[]; title?: string; showChannel?: boolean; note?: string }) {
  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <Lightbulb className="size-4 text-muted-foreground" />
          {title}
        </span>
      }
      subtitle={note ?? "Generated automatically from the rules in lib/recommendations.ts"}
      action={items.length > 0 ? <Badge variant="secondary">{items.length}</Badge> : undefined}
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recommendations for this month&apos;s data.</p>
      ) : (
        <ul className="divide-y">
          {items.map((r) => (
            <li key={r.id} className="avoid-break py-3 first:pt-0 last:pb-0">
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <StatusBadge tone={TONE[r.priority]}>{PRIORITY[r.priority]} priority</StatusBadge>
                {showChannel && <Badge variant="outline">{CHANNEL_LABEL[r.channel]}</Badge>}
                <span className="text-sm font-medium">{r.title}</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{r.text}</p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
