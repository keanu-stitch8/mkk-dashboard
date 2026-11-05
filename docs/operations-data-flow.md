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
| `POST /api/import` (preview / commit) | `import/data/services/upload-service.ts` → `modules/import/parsers` + `modules/import/ingest/commit` (ingest); preview shape from `lib/upload-preview.ts` |
| `DELETE /api/imports?id=` | `import/history/services/import-history-service.ts` `removeImport` |
| `POST /api/manual` | `shared/services/manual-metric-service.ts` `saveManualMetrics` |
| `POST /api/quota` | `shared/services/quota-service.ts` `saveQuotas` |
| `POST /api/team/matches/[id]` | `team/shared/services/match-decision-service.ts` |
| `POST /api/connectors/sync`, `/lock`, `/test`, `/api/reports/generate` | ingest / report pipeline (`modules/connectors/sources`, `modules/report/pipeline`) |

Routes only parse and validate HTTP input. `shared/lib/overrides.ts` decides which submitted keys are saved or
cleared (unknown keys ignored; empty / invalid = clear; quotas also reject negatives and never clear "default").

## Instagram CSV follows supplement

Preview and commit share `import/data/lib/instagram-upload.ts`: an Instagram CSV uploaded to an API-backed
or locked month defaults to `meta_ig_follows`. The explicit full-replacement mode is rejected for locked
Instagram months. Other unlocked CSV-only months retain the legacy full-import behavior. The preview warns
only about replacing a previous **supplement**, never the API dataset. Null follows are excluded, zero is
retained, rows are filtered by publish month and conflicting duplicate IDs fail before any write.

`commitDataset` writes the supplement as long-format `Breakdown` rows (`channel=social`,
`dimension=instagram_post`, `label=Post ID`, `metric=follows`) under its own `Import` source. No SocialPost,
account metric, month lock or historical snapshot is changed. API syncs write `meta_instagram` and therefore
cannot remove the separate supplement. The import owns the rows, so deleting it also removes the overlay.

Optional export dates are validated and recorded in the readable Import.note line
`Instagram follows CSV export date: YYYY-MM-DD.`. Unknown dates are stored as `unknown`, separately from
Import.createdAt. The Social mapper returns canonical `{postId,follows,observedOn,importedOn}` values.
Reports show the actual export date when supplied, otherwise the upload date with an explicit unknown-export
note. The publish-date range in a file name never becomes the measurement date.
