import type { ReportChannel, ReportChannelId } from "../types";
import { news } from "./news";
import { social } from "./social";
import { website } from "./website";
import { youtube } from "./youtube";
import { contributors } from "./contributors";

/** Channel laporan yang sudah tersedia. */
export const REPORT_CHANNELS: ReportChannel[] = [website, news, social, youtube, contributors];
export const reportChannel = (id: string): ReportChannel | undefined => REPORT_CHANNELS.find((c) => c.id === (id as ReportChannelId));
