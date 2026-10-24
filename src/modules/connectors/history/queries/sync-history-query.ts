import "server-only";
import { cache } from "react";
import { getSyncHistory } from "../services/sync-history-service";

export const getSyncHistoryPage = cache((trigger: string | undefined, connector: string | undefined, page: number) => getSyncHistory({ trigger, connector, page }));
