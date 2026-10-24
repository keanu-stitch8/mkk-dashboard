import "server-only";
import { buildSourceLogs, LOG_SOURCES, sourceLogHistory } from "../lib/source-logs";
import { findSourceLogImports } from "../repositories/source-log-repository";
import type { SourceLogs } from "../types/source-logs";

export async function getSourceLogs(month: string): Promise<SourceLogs> {
  return buildSourceLogs(month, await findSourceLogImports(sourceLogHistory(month), LOG_SOURCES.map((s) => s.key)));
}
