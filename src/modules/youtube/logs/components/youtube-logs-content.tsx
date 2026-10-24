import { Section } from "@/components/blocks";
import { PublishingLogTable, type LogColumn } from "@/components/PublishingLogTable";
import { fmtNum } from "@/lib/format";
import type { YoutubeLogs } from "../types/youtube-log";

const COLUMNS: LogColumn[] = [
  { key: "format", label: "Format", badge: "format" },
  { key: "category", label: "Category", badge: "outline" },
  { key: "editor", label: "Video Editor" },
];

export function YoutubeLogsContent({ logs }: { logs: YoutubeLogs }) {
  return (
    <Section title="All videos" subtitle={`${fmtNum(logs.rows.length)} videos · ${fmtNum(logs.published)} published · ${fmtNum(logs.inReview)} in review`}>
      <PublishingLogTable columns={COLUMNS} rows={logs.rows} thumbnails />
    </Section>
  );
}
