import "server-only";
import { cache } from "react";
import { getSourceLogs } from "../services/source-log-service";

export const getSourceLogsPage = cache((month: string) => getSourceLogs(month));
