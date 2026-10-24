import { YoutubeLogsView } from "./views/youtube-logs-view";

export default function YoutubeLogsModule({ monthParam }: { monthParam: string | undefined }) {
  return <YoutubeLogsView monthParam={monthParam} />;
}
