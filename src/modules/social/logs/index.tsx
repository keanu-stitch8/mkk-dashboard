import { SocialLogsView } from "./views/social-logs-view";

export default function SocialLogsModule({ monthParam }: { monthParam: string | undefined }) {
  return <SocialLogsView monthParam={monthParam} />;
}
