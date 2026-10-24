import "server-only";
import { REGISTRY, lastFullMonth } from "@/modules/connectors/sources";
import { CONNECTORS } from "@/modules/connectors/sources/catalog";
import { OAUTH_ONLY } from "@/modules/connectors/sources/google-oauth";
import { currentMonth } from "@/modules/shared/lib/month";
import { buildConnectorCard, buildLockRows } from "../lib/connector-settings";
import { findLastFinishedSync, findMonthLocks } from "../repositories/connector-settings-repository";
import type { ConnectorSettings } from "../types/connector-settings";

/** Status tiap connector (kredensial dari env, akun OAuth), sync terakhir, dan kunci bulan. */
export async function getConnectorSettings(): Promise<ConnectorSettings> {
  const [lastPerConnector, locks, statuses] = await Promise.all([
    Promise.all(CONNECTORS.map((c) => findLastFinishedSync(c.id))),
    findMonthLocks(),
    Promise.all(CONNECTORS.map((c) => REGISTRY[c.id]?.status() ?? Promise.resolve(null))),
  ]);
  const isSet = (name: string) => !!process.env[name]?.trim();
  const serviceAccount = isSet("GOOGLE_APPLICATION_CREDENTIALS");
  const cards = CONNECTORS.map((info, i) =>
    buildConnectorCard(info, REGISTRY[info.id], statuses[i], lastPerConnector[i], { isSet, serviceAccount, oauthOnly: OAUTH_ONLY.includes(info.id as never) }),
  );
  const current = currentMonth();
  return { cards, configured: cards.filter((c) => c.configured).map((c) => c.id), lockRows: buildLockRows(current, locks), currentMonth: current, defaultSyncMonth: lastFullMonth() };
}
