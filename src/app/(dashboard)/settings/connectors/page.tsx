import ConnectorSettingsModule from "@/modules/connectors/settings";

export const dynamic = "force-dynamic";

export default async function ConnectorsPage({ searchParams }: PageProps<"/settings/connectors">) {
  const sp = await searchParams;
  return <ConnectorSettingsModule connected={typeof sp.connected === "string" ? sp.connected : null} oauthError={typeof sp.error === "string" ? sp.error : null} />;
}
