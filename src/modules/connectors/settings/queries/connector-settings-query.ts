import "server-only";
import { cache } from "react";
import { getConnectorSettings } from "../services/connector-settings-service";

export const getConnectorSettingsPage = cache(() => getConnectorSettings());
