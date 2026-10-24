# Data-flow audit

Compliance with the [global data flow](./data-flow.md). Last review: 2026-10-24.

## Done

- [x] Application code under `src/`; `server-only` on every query, service and repository; Vitest and tsx
      (`--conditions=react-server`) set up for it.
- [x] Every page route is a thin entry (8–10 lines) that forwards normalized params to a module.
- [x] No Prisma import in `src/app`, `src/components` or `src/modules/report/pipeline`; API routes call services.
- [x] `src/lib/data` removed: channel summaries, bundle, trend, audience, quotas, Team read side, history,
      og:image and IG thumbnails live in modules with explicit canonical types.
- [x] Channel pages load only their channel; Overview loads each month once.
- [x] Route error boundary `src/app/(dashboard)/error.tsx` (failed ≠ empty).
- [x] Domain documents: [Channels](../channels-data-flow.md), [YouTube](../youtube-data-flow.md),
      [Team](../team-data-flow.md), [Operations](../operations-data-flow.md).
- [x] `src/lib` emptied into modules (2026-10-24): ingest → `connectors/sources`, `import/{parsers,ingest}`,
      `team/ingest`; report pipeline → `report/pipeline`; rule engine → `recommendations/lib`; helpers →
      `shared/lib`; login → `auth/`. Only `lib/db.ts`, `lib/utils.ts` and `hooks/use-mobile.ts` stay (Prisma
      client and shadcn aliases). `Channel`/`DatasetKey`/`SourceGroup` moved to `shared/types/dataset.ts` so
      `shared/` still imports no feature module. Verified: 25 rendered pages identical to the previous build.
- [x] Verified against the pre-refactor commit: service output (all channels, bundle, trend, audience, Team),
      monthly report data (byte-identical), 78 rendered pages, and the non-mutating API responses.

## Open (small, deliberate)

| Area | Current state | Why it is acceptable for now / target |
| --- | --- | --- |
| `getQuotas` per summary | Each channel summary loads quotas for its month, so a bundle runs the same quota query four times. | Correct, cheap on SQLite. Target: pass quotas into the services from the bundle/query. |
| Team `?show=` filters | Validated and applied inside the content components. | Pure UI selection over already-loaded rows; the filter keys and labels live together. |
| `channelRecommendations` cast | The rule engine is typed over `MonthBundle`; channel contexts are cast. | Guarded by `channel-recommendations.test.ts` (equality with the full bundle, no failing rule). Target: per-channel rule typing. |
| Tests in `tests/` | Ingest, parser, report-pipeline and Team-ingest tests stay in the root folder. | They test the ingest / outbound pipelines (`connectors/sources`, `import/*`, `team/ingest`, `report/pipeline`) through relative paths. Target: move next to the files when touched. New module tests live next to the file. |
| Ingest writes | `connectors/sources`, `import/ingest`, `team/ingest` use the Prisma client directly. | Bulk write transactions, recorded as an exception in the contract. Target: write repositories if ingest grows. |
| Report pipeline builders | `src/modules/report/pipeline/channels/*` still shape report rows themselves. | Outbound pipeline; reads go through module services/repositories. |
