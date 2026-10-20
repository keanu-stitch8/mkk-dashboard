import type { ReportChannel, ReportChannelId } from "../types";
import { news } from "./news";
import { website } from "./website";
import { youtube } from "./youtube";

/** Channel laporan yang sudah tersedia. */
export const REPORT_CHANNELS: ReportChannel[] = [website, news, youtube];
export const reportChannel = (id: string): ReportChannel | undefined => REPORT_CHANNELS.find((c) => c.id === (id as ReportChannelId));
