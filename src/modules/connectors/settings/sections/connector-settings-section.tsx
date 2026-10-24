import { ConnectorSettingsContent } from "../components/connector-settings-content";
import { getConnectorSettingsPage } from "../queries/connector-settings-query";

export async function ConnectorSettingsSection({ connected, oauthError }: { connected: string | null; oauthError: string | null }) {
  return <ConnectorSettingsContent settings={await getConnectorSettingsPage()} connected={connected} oauthError={oauthError} />;
}
