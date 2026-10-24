import { OverviewView } from "./views/overview-view";

export default function OverviewModule({ monthParam }: { monthParam: string | undefined }) {
  return <OverviewView monthParam={monthParam} />;
}
