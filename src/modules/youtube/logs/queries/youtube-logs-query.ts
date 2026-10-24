import "server-only";
import { cache } from "react";
import { getYoutubeLogs } from "../services/youtube-log-service";

export const getYoutubeLogsPage = cache((month: string) => getYoutubeLogs(month));
