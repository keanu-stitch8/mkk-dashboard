import "server-only";
import { cache } from "react";
import { getRecap } from "../services/recap-service";

export const getRecapPage = cache((year: string) => getRecap(year));
