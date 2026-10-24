import { Section } from "@/components/blocks";
import { PublishingLogTable, type LogColumn } from "@/components/PublishingLogTable";
import { fmtNum } from "@/modules/shared/lib/format";
import type { SocialLogs } from "../types/social-log";

// kategori sosmed = pilar konten (khusus channel ini), tetap nilai Publishing Log
const COLUMNS: LogColumn[] = [
  { key: "format", label: "Format", badge: "format" },
  { key: "category", label: "Category", badge: "outline" },
  { key: "platform", label: "Platform", badge: "outline", multi: true },
  { key: "designer", label: "Designer" },
];

export function SocialLogsContent({ logs }: { logs: SocialLogs }) {
  return (
    <Section
      title="All content"
      subtitle={`${fmtNum(logs.rows.length)} items · ${fmtNum(logs.published)} published · ${fmtNum(logs.inReview)} in review · ${fmtNum(logs.withLink)} with link`}
    >
      <PublishingLogTable columns={COLUMNS} rows={logs.rows} thumbnails />
    </Section>
  );
}
