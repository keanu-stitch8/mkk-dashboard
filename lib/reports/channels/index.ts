import type { ReportChannel, ReportChannelId } from "../types";
import { website } from "./website";

/** Channel laporan yang sudah tersedia (tahap 1: Website). */
export const REPORT_CHANNELS: ReportChannel[] = [website];
export const reportChannel = (id: string): ReportChannel | undefined => REPORT_CHANNELS.find((c) => c.id === (id as ReportChannelId));
