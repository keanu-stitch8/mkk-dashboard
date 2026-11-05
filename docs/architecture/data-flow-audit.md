# Data-flow audit

Compliance with the [global data flow](./data-flow.md). Architecture review: 2026-10-24;
Instagram audience and asset-score additions reviewed: 2026-11-04.
Period report generator verified: 2026-11-05.

## Done

- [x] Final lock-cut-off alignment (2026-11-05): Social Top posts and period reports share
      `socialPostSnapshotDate` → `cutoffDate`, prefer the stored cut-off sync, and display the actual date.
      Category slides disclose measured/total coverage and average only measured posts. Source data,
      runtime equality, 246 tests, production build and HTTP rendering verified. Latest deck/PDF aligned.
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
- [x] Instagram audience and discovery (2026-11-04): connector-owned account metrics and daily follower
      snapshots flow through the Social repository, canonical types, service and pure derivation. Overview
      reuses the same follower series. Missing monthly asset groups produce an untracked score rather
      than zero. Focused tests live next to the pure functions; domain behavior is documented.

- [x] Four-month Instagram reports (`report/periods`): canonical period types, shared channel services,
      repository-owned snapshot/history reads, pure period/template/chart plans, thin route and POST endpoint.
      Outbound Google writes operate on new deck/workbook copies and use the existing report repository.
      Live generation verified 13 slides/PDF pages, 131 text slots and three independent chart bindings;
      native previews checked. The full suite passes 225 tests.
- [x] Instagram CSV follows (2026-11-05): preview/commit share safe mode selection, a separate import owns
      per-media long-format rows and provenance, Social uses an exact-ID overlay, period reports only fill
      missing follows after historical snapshot selection. Case studies are validated against the period's
      top ten. Live import verified API imports, SocialPost rows, account metrics, snapshots and locks unchanged.
- [x] Missing period-end post snapshots (2026-11-05): period aggregation warns instead of blocking a
      completed report with all account months. UI and template plans render unavailable Top posts and
      case-study metrics as `n/a`, without inventing candidates or substituting adjacent dates. Verified
      by contract tests, real-data template planning and production HTTP; incomplete periods still block.
- [x] Explicit Period 1 snapshot exception: the user's selected 2 November date is centralized in
      `periodPostSnapshotDate`, read by the data service and carried through canonical `postSnapshotDate`.
      Dashboard and slide notes distinguish it from the July–October account window. Exact-date selection,
      unchanged account totals, template dates and production rendering verified; 245 tests pass.

## Open (small, deliberate)

| Area | Current state | Why it is acceptable for now / target |
| --- | --- | --- |
| `getQuotas` per summary | Each channel summary loads quotas for its month, so a bundle runs the same quota query four times. | Correct, cheap on SQLite. Target: pass quotas into the services from the bundle/query. |
| Team `?show=` filters | Validated and applied inside the content components. | Pure UI selection over already-loaded rows; the filter keys and labels live together. |
| `channelRecommendations` cast | The rule engine is typed over `MonthBundle`; channel contexts are cast. | Guarded by `channel-recommendations.test.ts` (equality with the full bundle, no failing rule). Target: per-channel rule typing. |
| Tests in `tests/` | Ingest, parser, report-pipeline and Team-ingest tests stay in the root folder. | They test the ingest / outbound pipelines (`connectors/sources`, `import/*`, `team/ingest`, `report/pipeline`) through relative paths. Target: move next to the files when touched. New module tests live next to the file. |
| Ingest writes | `connectors/sources`, `import/ingest`, `team/ingest` use the Prisma client directly. | Bulk write transactions, recorded as an exception in the contract. Target: write repositories if ingest grows. |
| Report pipeline builders | `src/modules/report/pipeline/channels/*` still shape report rows themselves. | Outbound pipeline; reads go through module services/repositories. |
