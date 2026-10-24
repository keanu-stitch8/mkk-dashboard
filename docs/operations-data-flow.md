# Operations data flow

Import, Import History, Connectors API, Sync History, Source Logs, and the mutations behind them. Follows the
[global data flow](./architecture/data-flow.md).

## Pages

| Page | Module | Data |
| --- | --- | --- |
| `/import` | `import/data` | manual input per channel, quota form rows (`buildQuotaRows`), configured connectors |
| `/import/history` | `import/history` | all `Import` rows → sessions (`shared/lib/history.ts`), page from `?page` |
| `/settings/connectors` | `connectors/settings` | `ConnectorCard` per connector: env vars filled, OAuth account, service-account precedence, last finished sync; month-lock rows |
| `/settings/connectors/history` | `connectors/history` | `SyncLog` → sessions built across connectors first, then filtered (`?trigger`, `?connector`, `?page`; unknown values = all) |
| `/logs` | `source-logs` | Google Sheets log imports for the last 6 months |

Client widgets live with their module: `import/data/components/{import-form,manual-form,quota-form}.tsx`,
`import/history/components/delete-import-button.tsx`, `connectors/settings/components/*-button.tsx`, and the shared
`connectors/shared/components/sync-controls.tsx` (Import page + Connectors page).

`process.env` is read only in `connector-settings-service.ts` (and the connectors themselves), never in a component.

## Mutations (API routes → services)

| Route | Service |
| --- | --- |
| `POST /api/import` (preview / commit) | `import/data/services/upload-service.ts` → `lib/parsers` + `lib/import/commit` (ingest); preview shape from `lib/upload-preview.ts` |
| `DELETE /api/imports?id=` | `import/history/services/import-history-service.ts` `removeImport` |
| `POST /api/manual` | `shared/services/manual-metric-service.ts` `saveManualMetrics` |
| `POST /api/quota` | `shared/services/quota-service.ts` `saveQuotas` |
| `POST /api/team/matches/[id]` | `team/shared/services/match-decision-service.ts` |
| `POST /api/connectors/sync`, `/lock`, `/test`, `/api/reports/generate` | ingest / report pipeline (`lib/connectors`, `lib/reports`) |

Routes only parse and validate HTTP input. `shared/lib/overrides.ts` decides which submitted keys are saved or
cleared (unknown keys ignored; empty / invalid = clear; quotas also reject negatives and never clear "default").
