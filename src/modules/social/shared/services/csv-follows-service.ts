import "server-only";
import { findCsvPostFollows } from "../repositories/social-repository";
import { toCsvPostFollows } from "../mappers/csv-follows-mapper";
import type { CsvPostFollows } from "../types/csv-follows";

export async function getCsvPostFollows(months: string[]): Promise<CsvPostFollows[]> {
  return (await findCsvPostFollows(months)).map(toCsvPostFollows);
}
