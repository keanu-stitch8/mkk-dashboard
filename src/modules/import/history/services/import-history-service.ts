import "server-only";
import { buildImportHistory } from "../lib/import-history";
import { deleteImport, findAllImports } from "../repositories/import-history-repository";
import type { ImportHistory } from "../types/import-history";

export async function getImportHistory(page: number): Promise<ImportHistory> {
  return buildImportHistory(await findAllImports(), page);
}

export async function removeImport(id: string): Promise<void> {
  await deleteImport(id);
}
