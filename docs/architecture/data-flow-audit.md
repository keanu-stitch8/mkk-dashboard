# Data-flow audit

Migration debt against the [global data flow](./data-flow.md). Tick an item when its domain moves
to `src/modules/` and gets a domain document. Last review: 2026-10-24.

## Done

- [x] Code moved under `src/`; `server-only` + Vitest/tsx setup.
- [x] `modules/shared`: month resolution (`resolveMonth` with `cache()`), manual metrics, `QuotaSummary`, `groupStats`.
- [x] YouTube overview + Publishing Log — [YouTube data flow](../youtube-data-flow.md).

## Open

| Area | Current violation | Target |
| --- | --- | --- |
| `src/lib/data/summary.ts` (Website, News, Social, bundle, trend, audience) | Prisma reads, derivation, and `Awaited<ReturnType<…>>` types in one 900-line file; storage rows (`logs`, posts) escape to pages | One service + `lib` builder + explicit types per channel under `modules/<channel>/overview`, like YouTube |
| `/` Overview, `/website`, `/news`, `/social`, `/report` pages | Route does fetching and derivation; loads the full `MonthBundle` (+ six-month four-channel trend) | Module per page; channel pages load only their channel (`channelRecommendations`) |
| `/news/logs`, `/social/logs`, `/logs` | Prisma in the route | Same shape as `modules/youtube/logs` |
| `src/lib/data/quota.ts` | Prisma read + defaults in one function | `shared/repositories` + `shared/services` |
| Team pages (`/team/*`), `src/lib/data/{team,pipeline,contributors,scorecard,recap}.ts`, `src/lib/team/store.ts` | Prisma + derivation mixed; types inferred from DB functions | `modules/team/<feature>` |
| `/import`, `/import/history`, `/settings/connectors*` | Prisma in routes | Modules; API routes keep calling services |
| `src/app/api/**` | Some routes call Prisma directly | Parse input → service |
| `src/lib/reports/channels/*` | Read `MonthBundle` via `getMonthAndPrev` (loads all channels for one channel's report) | Call the channel service directly |
| Error boundaries | No `error.tsx` in `(dashboard)` | Add a route error state so "failed" is distinct from "empty" |
| `tests/` | Old tests import through `src/lib/data/summary.ts` | Move next to the migrated `lib/` files |
