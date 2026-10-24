import { Section } from "@/components/blocks";
import { PublishingLogTable, type LogColumn } from "@/components/PublishingLogTable";
import { fmtNum } from "@/modules/shared/lib/format";
import type { NewsLogs } from "../types/news-log";

const COLUMNS: LogColumn[] = [
  { key: "type", label: "Format", badge: "format" },
  { key: "category", label: "Category", badge: "outline" },
  { key: "reporter", label: "Reporter" },
];

export function NewsLogsContent({ logs }: { logs: NewsLogs }) {
  return (
    <Section title="All articles" subtitle={`${fmtNum(logs.rows.length)} articles · ${fmtNum(logs.published)} published · ${fmtNum(logs.inReview)} in review`}>
      <PublishingLogTable columns={COLUMNS} rows={logs.rows} thumbnails />
    </Section>
  );
}
