import { YoutubeOverviewView } from "./views/youtube-overview-view";

export default function YoutubeOverviewModule({ monthParam }: { monthParam: string | undefined }) {
  return <YoutubeOverviewView monthParam={monthParam} />;
}
