import { NewsLogsView } from "./views/news-logs-view";

export default function NewsLogsModule({ monthParam }: { monthParam: string | undefined }) {
  return <NewsLogsView monthParam={monthParam} />;
}
