# Global data flow

This document is the repository-wide source of truth for application data flow and folder
ownership under `src/`. It ports the contract from `srikandi-merdeka-cup/docs/architecture/data-flow.md`
to this dashboard. Domain documents describe concrete pipelines, but they must follow this contract
unless they record a deliberate exception and its reason.

The rules apply to new and modified code. Code that has not been migrated yet is migration debt, not
an alternative precedent; it is tracked in [the data-flow audit](./data-flow-audit.md).

## How this dashboard differs from srikandi

srikandi reads external APIs while rendering. This dashboard does not: every external source (GA4,
Search Console, Meta, YouTube, Google Sheets/Drive, CSV exports) is written into SQLite by an
**ingest pipeline**, and pages only read the database. So the render pipeline treats the database
as its "external API", and ingest has a pipeline of its own.

| srikandi | dashboard | Why |
| --- | --- | --- |
| `api/` (external endpoint adapter) | `repositories/` (Prisma reads) | The transport at render time is Prisma, not HTTP. |
| Service validates an untrusted envelope | Service combines rows, manual overrides and quotas | Rows were validated by ingest and are typed by the Prisma schema. |
| `'use cache'` + `cacheLife()` in services | No persistent cache; `cache()` only | Numbers must change right after a sync/import. See [Cache ownership](#cache-ownership). |
| `src/app/[lang]/…` | `src/app/(dashboard)/…` | No locales; the route group carries the authenticated layout. |

## Canonical dependency direction

For server-rendered feature data, dependencies point inward from route composition to the database:

```text
App route
  -> module entry
  -> view (page composition + Suspense)
  -> section (async server boundary)
  -> query (request orchestration/deduplication)
  -> service (use case: combine rows, overrides, quotas)
  -> repository (Prisma reads only)
  -> SQLite
```

Data returns through a trust boundary before it reaches rendering code:

```text
Prisma row
  -> mapper (storage row -> canonical type)
  -> service (combine canonical inputs)
  -> lib (pure filtering/grouping/derivation)
  -> section view/component (typed rendering only)
```

For browser-side mutations or refreshes, a client component calls an internal application endpoint.
That endpoint normalizes HTTP input and rejoins the same service/query pipeline used by server
rendering:

```text
Client component
  -> internal app API route
  -> shared query or service
  -> repository
  -> SQLite
```

Ingest writes the database and never renders:

```text
Trigger (cron in instrumentation, API route, `npm run sync`, CSV upload)
  -> connector / parser (transport + raw parsing)
  -> map (raw upstream shape -> storage rows)
  -> commit (replace the month's rows for that source)
  -> SQLite
```

Do not bypass a layer to save a short import. In particular:

- Components do not import Prisma or call external APIs.
- Internal app API routes do not duplicate domain or service logic.
- Repositories do not create UI models.
- Prisma rows (with `id`, `importId`, storage columns) do not escape into views or components.
- Lower layers do not import from higher rendering or routing layers (`src/components`, `src/app`).
- The render pipeline never calls a connector; ingest never imports a module's views or sections.

## Folder contracts

| Folder/file | Owns | Rules |
| --- | --- | --- |
| `src/app/(dashboard)/**/page.tsx` | Next.js route entry and route config (`dynamic`) | Keep thin. Read `params`/`searchParams`, normalize them to plain values, forward to a feature module. No data access. |
| `src/app/api/**/route.ts` | Browser-facing HTTP boundary | Parse and normalize HTTP values, call a shared query or service, serialize its result. Do not duplicate service or domain logic. |
| `src/modules/<domain>/<feature>/index.tsx` | Public feature-module boundary | Accept route-owned inputs and delegate to a view. No fetching, validation, or mapping. |
| `views/` | Page composition and Suspense topology | Compose sections and fallbacks. No data access or normalization. |
| `sections/` | Independently streamable async server boundaries | Call queries, select empty states, pass canonical data to a component. |
| `queries/` | Server-only use-case orchestration | Wrap in React `cache()`, fetch independent service calls in parallel, call pure builders from `lib/`. |
| `services/` | Server-only data-access use cases | Call repositories, invoke mappers, combine shared inputs (manual overrides, quotas), call pure builders, return canonical types. |
| `repositories/` | Prisma reads | Declare `where`/`select`/`orderBy` only. Use the shared client from `@/lib/db`. Return Prisma rows. |
| `mappers/` | Storage-to-canonical trust boundary | Drop storage columns, normalize primitives, build canonical types. No rendering or database access. |
| `lib/` | Pure domain logic | Filtering, grouping, sorting, labels, derived models. No Prisma, cache, React, or browser APIs. Testable in Vitest without a database. |
| `types/` | Canonical internal contracts | Define query, service, and UI models explicitly — not `Awaited<ReturnType<…>>` of a function that reads the database. |
| `components/` | Typed rendering and local interaction | Render canonical models. Add `'use client'` only when browser state or browser APIs are required. |
| `components/skeletons/`, `sections/*-skeleton.tsx` | Streaming fallbacks | Mirror the layout of the matching section; no data access. |
| `src/modules/shared/` | Cross-domain pieces | Month resolution, manual metrics, quotas, pure helpers (`by-month`, `history`, `math`), skeletons, `MonthHeaderSection`. MUST NOT import from any feature module. |
| `src/modules/channels/` | Cross-channel composition | `MonthBundle`, trend, `contentQuota`. Depends on the four channel modules; channel modules never import it. |

Modules (one folder per domain, one sub-folder per page; `shared/` inside a domain = used by several of its pages):

| Module | Pages | Domain document |
| --- | --- | --- |
| `website/overview` | `/website` | [Channels](../channels-data-flow.md) |
| `news/{overview,logs}` | `/news`, `/news/logs` | [Channels](../channels-data-flow.md) |
| `social/{overview,logs}` | `/social`, `/social/logs` | [Channels](../channels-data-flow.md) |
| `youtube/{overview,logs}` | `/youtube`, `/youtube/logs` | [YouTube](../youtube-data-flow.md) |
| `overview`, `report`, `channels` | `/`, `/report` | [Channels](../channels-data-flow.md) |
| `team/{stories,briefs,pipeline,contributors,scorecard,recap}` | `/team/*` | [Team](../team-data-flow.md) |
| `import/{data,history}`, `connectors/{settings,history}`, `source-logs` | `/import*`, `/settings/connectors*`, `/logs` | [Operations](../operations-data-flow.md) |

Non-page modules (pipelines and cross-cutting pieces; they have no `index.tsx`/views):

| Folder | Owns |
| --- | --- |
| `src/modules/connectors/sources/`, `src/modules/import/parsers/`, `src/modules/import/ingest/`, `src/modules/team/ingest/` | Ingest pipeline (API/Sheets/Drive sync, CSV parsing, commit, Team matching rebuild). **Deliberate exception:** ingest writes use the Prisma client directly instead of `repositories/` — they are bulk write transactions, not page reads. |
| `src/modules/report/pipeline/` | Outbound pipeline: monthly report generation (Google Sheets + PDF). Reads channel summaries through module services and detail rows through module repositories; writes `GeneratedReport` through `modules/report/repositories`. No Prisma import. |
| `src/modules/recommendations/lib/` | Pure rule engine over `MonthBundle`. Its own module (not `channels/`) because channel pages call `channelRecommendations(channel, { cur: { month, [channel]: … }, prev })`; every rule may read only its own channel and `month`. |
| `src/modules/auth/` | Login (Stage 0): signed session cookie (`auth.ts`), server-side session read (`session.ts`), AES-256-GCM for stored tokens (`crypto.ts`). Used by `src/proxy.ts` and the auth API routes. |
| `src/modules/shared/lib/`, `src/modules/shared/types/dataset.ts` | Pure helpers shared by every layer (`format`, `month`, `tz`, `taxonomy`, `sources`) and the channel/dataset keys (`Channel`, `DatasetKey`, `SourceGroup`; re-exported by `import/parsers/types`). |

Repository-wide folders outside `modules/` (only what tooling pins in place):

| Folder | Owns |
| --- | --- |
| `src/components/` | Design-system building blocks (`ui/` from shadcn — extend, never edit), shared dashboard blocks (`blocks.tsx`, `ChartCard`, `PageHeader`). Rendering only. |
| `src/lib/db.ts` | The shared Prisma client (`@/lib/db`). |
| `src/lib/utils.ts`, `src/hooks/use-mobile.ts` | shadcn helpers, pinned by the `utils`/`hooks` aliases in `components.json` and imported by `components/ui/*`. Do not move. |

## Runtime boundaries

### Server and client

Query, service, and repository modules MUST `import "server-only"`. Client components may import
serializable types and pure client-safe helpers, but must not import server-only modules.

Scripts outside Next (`npm run sync`, `seed`, `inspect`) run under `tsx --conditions=react-server`,
so ingest code that reaches a service (for example scorecard snapshots on month lock) still loads.
Vitest aliases `server-only` to its empty module; tests target `lib/` and `mappers/`.

When a client interaction needs fresh server data, expose an internal app API route and reuse the
existing query or service. Do not create a second browser-specific pipeline.

### Storage rows and canonical data

The database is written only by ingest, which validates and maps upstream responses before
committing. At render time the ownership split is:

1. The repository performs the Prisma read only.
2. The mapper converts storage rows into canonical models (drops `id`, `importId`, `month` and other
   storage columns; turns metric rows into key/value maps).
3. The service combines canonical inputs with manual overrides and quotas.
4. Pure domain functions derive display-ready structures from canonical models.
5. Components render those structures without knowledge of the Prisma schema.

### Headers that depend on data

A page header normally streams on its own (`MonthHeaderSection`, which only needs the month list). When its
description depends on the page data (for example "Posts published in October 2026 · Instagram", or the default
"Monthly report · …" when the month is empty), the description is an async function exported from the page's
section file; it awaits the same `cache()`-wrapped query as the content section, so the data is loaded once.
Pages whose header carries counts (Import History, Sync History, Team) render the header inside their single
section instead.

### Cache ownership

- React `cache()` deduplicates identical orchestration during one request (for example, the month
  list used by the header section and the content section).
- **Deliberate exception:** services do not use `'use cache'`/`cacheLife()`. The database is the
  single freshness authority, it is local (SQLite), and every sync, import, manual edit or match
  decision must show up on the next request. Pages keep `export const dynamic = "force-dynamic"` and
  `cacheComponents` stays off in `next.config.ts`.
- Repositories do not invent cache policy.

Keep query inputs explicit (a plain `month` string, not a `searchParams` object) so `cache()` keys
cannot cross months.

### Missing, empty, and failed data

- **Missing:** an invalid or absent `?m=` falls back to the latest month with data (current product
  contract; the dashboard has no per-resource 404s yet).
- **Empty:** the month exists but a channel has no imports; render `EmptyState`.
- **Failed:** a database or derivation failure propagates to the route error boundary
  (`src/app/(dashboard)/error.tsx`). Because pages stream, the HTTP status is already 200 when a section fails;
  the boundary is what tells the user it failed. Do not convert failures into empty success payloads.

Ingest has its own failure contract: a failed connector sync is recorded in Sync History and leaves
the previous rows in place.

## Allowed simplification

A small feature may omit unnecessary layers, but it must not reverse dependency direction or merge
trust boundaries into rendering code. Examples:

- A static page can stop at the view/component layer.
- A query can call one service directly; it does not need artificial fan-out.
- A section may render one large component when the whole page depends on one query result (for
  example the channel pages, where the empty state replaces everything below the header, or the Team pages,
  whose header month list comes from the same data).

When a feature needs an exception, document it beside that feature's concrete data flow, including
why the global rule is insufficient and which boundary remains responsible.

## Change checklist

Before changing a data flow:

1. Identify the source tables, canonical type, and every downstream consumer (pages, reports,
   recommendations, scorecard, recap).
2. Decide whether the change belongs to ingest, repository, mapping, service, domain derivation, or
   rendering; edit that layer rather than compensating elsewhere.
3. Preserve the shared query/service path between server rendering and internal endpoints.
4. Verify missing, empty, and failure behavior separately.
5. Add or update focused tests at the changed boundary (`lib/` and `mappers/` tests live next to the
   file as `*.test.ts`).
6. Update this global contract only for repository-wide rules; update a domain document for
   feature-specific behavior, and tick the item in the audit.

## Verifying a data-flow change

Refactors of an existing flow are verified against the previous commit, not only by unit tests:

1. Dump the old and new service output for every month in `dev.db` (plus one empty month) and compare after
   dropping storage-only fields (`id`, `importId`, `updatedAt`).
2. For pages, build the old commit in a worktree (`git worktree add`, `cp -cR node_modules`, absolute
   `DATABASE_URL`) and the new tree, run both with a temporary `DASHBOARD_PASSWORD`, and compare the text of every
   page per month. Word order may differ because of streaming; the word multiset must not.

## Domain data-flow documents

| Domain | Document | Scope |
| --- | --- | --- |
| Channels | [Channels data flow](../channels-data-flow.md) | Website, News, Social pages and logs, Overview, Report, `MonthBundle`, trend, quotas, recommendations, report pipeline reads. |
| YouTube | [YouTube data flow](../youtube-data-flow.md) | Overview page, Publishing Log, non-public videos at ingest. |
| Team | [Team data flow](../team-data-flow.md) | Stories, Briefs, Pipeline, Contributors, Scorecard, Recap, match decisions. |
| Operations | [Operations data flow](../operations-data-flow.md) | Import, Import History, Connectors, Sync History, Source Logs, manual input & quota mutations. |
