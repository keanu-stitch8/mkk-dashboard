import { NewsOverviewView } from "./views/news-overview-view";

export default function NewsOverviewModule({ monthParam }: { monthParam: string | undefined }) {
  return <NewsOverviewView monthParam={monthParam} />;
}
