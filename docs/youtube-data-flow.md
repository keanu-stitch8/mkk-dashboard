# YouTube data flow

Concrete pipeline for the YouTube pages. Follows the [global data flow](./architecture/data-flow.md).

## Sources (ingest)

| Table | Written by | Content |
| --- | --- | --- |
| `YtVideo`, `YtDaily`, `Metric` (channel `youtube`) | `youtube` connector / YouTube Studio export | Per-video metrics, daily watch time, channel totals |
| `YtLog` | `sheets` connector (Youtube Calendar Timeline → Summary, editor from the Tracker tab) | Publishing log |
| `Breakdown` dimension `yt_in_review`, import `yt_review` | `sheets` connector (Gantt) | Videos Review/Approved at month end |
| *(rule)* | `youtube` connector, `splitByPrivacy` | Only **public** videos are stored. A re-upload leaves the old video private/unlisted (or deleted), which would otherwise count twice; skipped videos are listed as a Sync History warning. Their views are not in the totals. |
| `ManualMetric` (channel `youtube`) | Import page → manual input | Overrides for any summary number |
| `Quota` | Import page → quotas | Monthly video quota |

## Overview page (`/youtube`)

```text
src/app/(dashboard)/youtube/page.tsx          ?m= → firstParam → monthParam
  -> modules/youtube/overview/index.tsx
  -> views/youtube-overview-view.tsx           2 Suspense boundaries
       -> shared/sections/month-header-section  resolveMonth (cache)
       -> sections/youtube-overview-section     resolveMonth (same cache entry) → getYoutubeOverview
  -> queries/youtube-overview-query.ts         cache(); one getYoutubeSummary per month, in parallel
       months = channelPageMonths: trend (last 6, from LAUNCH_MONTH) ∪ {month, prev month}
  -> services/youtube-summary-service.ts       repositories + getQuotas + manual metrics → mappers → buildYoutubeSummary
  -> shared/repositories/youtube-repository.ts Prisma reads
```

Return path: `shared/mappers/youtube-mapper.ts` (drops `id`/`importId`/`month`) →
`lib/youtube-summary.ts` (`buildYoutubeSummary`) → `lib/youtube-overview.ts` (trend points, quotas,
recommendations) → `components/youtube-overview-content.tsx`.

Number precedence in `buildYoutubeSummary`: manual input → imported channel total → sum over videos
(→ sum over days for watch time). `published` comes from the log when it has rows, otherwise from
video publish dates. `delivered = published + in review`.

Recommendations use `channelRecommendations("youtube", { cur: { month, youtube }, prev })`. The page
loads at most seven YouTube summaries and nothing else; `modules/channels/lib/channel-recommendations.test.ts`
guards that the result equals the full-bundle recommendations filtered to YouTube.

States: **empty** (`summary.hasData === false`, i.e. no `yt*` import and no manual input) →
`EmptyState` and the default header description. **Failed** → route error boundary.

## Publishing Log (`/youtube/logs`)

```text
page.tsx → modules/youtube/logs/index.tsx → views/youtube-logs-view.tsx
  -> sections/youtube-logs-section.tsx → queries/youtube-logs-query.ts (cache)
  -> services/youtube-log-service.ts → findYoutubeLogs + findYoutubeReviewItems → toYoutubeLogEntry
  -> lib/youtube-log-rows.ts (buildYoutubeLogs) → components/youtube-logs-content.tsx
```

Gantt in-review titles already in the Summary are marked `review` (unless published); the rest are
appended without a date. Empty = no rows after that merge.

## Other consumers of `getYoutubeSummary`

`modules/channels` (bundle, trend, `contentQuota` → `youtubeQuota`), so Overview, Report, Team Scorecard and Recap
read the same canonical `YoutubeSummary`. The monthly YouTube report (`lib/reports/channels/youtube.ts`) calls
`getYoutubeSummary` for the month and the previous month, and `findPublishedYoutubeLogTitles` for series progress.

## Exceptions

- No persistent cache (global exception, see the contract).
- One content section instead of one per block: the empty state replaces everything below the header, and every
  block depends on the same query result. The header description awaits the same query (empty month → default
  description).
