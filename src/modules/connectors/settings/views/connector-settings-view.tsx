import { Suspense } from "react";
import { ChannelOverviewSkeleton } from "@/modules/shared/components/skeletons/channel-overview-skeleton";
import { ConnectorSettingsHeader } from "../components/connector-settings-content";
import { ConnectorSettingsSection } from "../sections/connector-settings-section";

export function ConnectorSettingsView({ connected, oauthError }: { connected: string | null; oauthError: string | null }) {
  return (
    <div className="flex flex-col gap-6">
      <ConnectorSettingsHeader />
      <Suspense fallback={<ChannelOverviewSkeleton />}>
        <ConnectorSettingsSection connected={connected} oauthError={oauthError} />
      </Suspense>
    </div>
  );
}
