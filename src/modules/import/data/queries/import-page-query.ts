import "server-only";
import { cache } from "react";
import { getImportPage } from "../services/import-page-service";

export const getImportPageData = cache((month: string) => getImportPage(month));
