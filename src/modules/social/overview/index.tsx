import { SocialOverviewView } from "./views/social-overview-view";

export default function SocialOverviewModule({ monthParam }: { monthParam: string | undefined }) {
  return <SocialOverviewView monthParam={monthParam} />;
}
