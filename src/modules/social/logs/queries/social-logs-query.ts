import "server-only";
import { cache } from "react";
import { getSocialLogs } from "../services/social-log-service";

export const getSocialLogsPage = cache((month: string) => getSocialLogs(month));
