import { ConnectorSettingsView } from "./views/connector-settings-view";

/** `connected` / `oauthError` = pesan dari redirect OAuth (?connected= / ?error=). */
export default function ConnectorSettingsModule({ connected, oauthError }: { connected: string | null; oauthError: string | null }) {
  return <ConnectorSettingsView connected={connected} oauthError={oauthError} />;
}
