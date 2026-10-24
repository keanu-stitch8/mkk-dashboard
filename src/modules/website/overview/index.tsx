import { WebsiteOverviewView } from "./views/website-overview-view";

export default function WebsiteOverviewModule({ monthParam }: { monthParam: string | undefined }) {
  return <WebsiteOverviewView monthParam={monthParam} />;
}
