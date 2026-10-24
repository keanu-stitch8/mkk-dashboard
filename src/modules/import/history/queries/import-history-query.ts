import "server-only";
import { cache } from "react";
import { getImportHistory } from "../services/import-history-service";

export const getImportHistoryPage = cache((page: number) => getImportHistory(page));
