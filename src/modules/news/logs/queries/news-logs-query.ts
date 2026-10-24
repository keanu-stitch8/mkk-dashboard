import "server-only";
import { cache } from "react";
import { getNewsLogs } from "../services/news-log-service";

export const getNewsLogsPage = cache((month: string) => getNewsLogs(month));
