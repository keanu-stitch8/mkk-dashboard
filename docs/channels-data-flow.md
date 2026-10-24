# Channels data flow

Website, News, Social, the cross-channel Overview and Report, and what the monthly report pipeline reads.
Follows the [global data flow](./architecture/data-flow.md). YouTube has [its own document](./youtube-data-flow.md).

## Channel summaries (one per channel per month)

```text
services/<ch>-summary-service.ts   repositories (Prisma, explicit where/select) + getQuotas + getManualMetrics
  -> mappers (drop id/importId/month; Social posts/logs and News articles keep `id` as row identity)
  -> lib/<ch>-summary.ts            buildWebsiteSummary / buildNewsSummary / buildSocialSummary (pure)
  -> types/<ch>-summary.ts          WebsiteSummary / NewsSummary / SocialSummary (explicit interfaces)
```

| Channel | Tables | Notes |
| --- | --- | --- |
| Website | `Ga4Channel`, `Ga4Page`, `Ga4Landing`, `GscDaily`, `GscQuery`, `GscPage`, `Metric`/`Breakdown` (website) | Manual input overrides every total. GSC totals from the API metric when present, otherwise summed from daily rows. |
| News | `NewsArticle`, `Ga4Page` (views), `NewsView` (report views, fallback) | Articles published ≤1 day before the last GA4 Pages sync are "pending", not "unmatched". |
| Social | `SocialPost` (active platforms only), `SocialLog`, IG account `Metric`s, `IgAccountByType`, `IgMediaSnapshot`, `IgStory`, Task Progress `Breakdown` | Log ↔ post matching and the IG consistency check live in `social/shared/lib/social-match.ts` (pure). Month-end snapshot = first `IgMediaSnapshot` within 7 days after the month. |

Every summary has `hasData`; the channel page shows `EmptyState` when it is false.

## Channel pages

```text
page.tsx (?m → firstParam) -> modules/<ch>/overview -> view
  -> MonthHeaderSection (description async: only when the month has data)
  -> <Ch>OverviewSection -> get<Ch>Overview(month)   cache(); one summary per month for
                                                       channelPageMonths = 6-month trend ∪ {month, prev}
  -> lib/<ch>-overview.ts  trend points (<ch>-trend.ts fields + label), quotas, KPI comparisons,
                           channelRecommendations(channel, { cur: { month, [ch] }, prev: { month, [ch] } })
  -> components/<ch>-overview-content.tsx
```

Before the refactor each channel page loaded the full four-channel bundle for two months plus a six-month,
four-channel trend. A channel page now loads only its own channel. `channel-recommendations.test.ts` checks that
the result equals `generateRecommendations` on the full bundle filtered to that channel, and that no rule fails.

Social extras: `socialKpiSources` / `socialComparable` (`lib/social-compare.ts`) only compare platforms present in
both months and metrics with the same definition; `mixedPlatforms` switches the views chart to per-platform.

## Publishing Logs (`/news/logs`, `/social/logs`)

- News: `findNewsArticles` → `buildNewsLogs` + og:image thumbnails. `services/og-image-service.ts` reads the
  `PageMeta` cache, fetches missing pages through `api/article-page-api.ts`, parses with `lib/og-image.ts`.
- Social: the summary service (log ↔ post matching gives the link) → `buildSocialLogs` + IG thumbnails from
  `social/shared/services/ig-thumb-service.ts` (Graph API adapter `api/ig-media-api.ts`, file store
  `repositories/ig-thumb-store.ts`). `/api/thumbs/ig/[id]` serves the stored file through the same service.

## Cross-channel (`modules/channels`, `/`, `/report`)

- `channels/services/month-bundle-service.ts`: `MonthBundle` = the four summaries; `getMonthAndPrev`.
- `channels/lib/trend.ts`: `TrendPoint` = each channel's trend fields (`website-trend.ts`, `news-trend.ts`,
  `youtube-trend.ts`, `social-trend.ts`) — one definition shared by channel pages, Overview and Recap.
- `channels/lib/content-quota.ts`: dispatches to `newsQuota` / `socialQuota` / `youtubeQuota`.
- Overview (`modules/overview`): one bundle per month for trend ∪ prev (the old page loaded the current month
  twice), audience (`services/audience-service.ts` + pure `lib/audience.ts` back-calculation), KPIs and fair MoM
  comparisons (`lib/overview-kpis.ts`), all recommendations.
- Report (`modules/report`): one section (the toolbar holds the month select); Google Sheets job rows from
  `GeneratedReport` + template env (`services/report-jobs-service.ts`).

## Monthly report pipeline (`src/modules/report/pipeline`)

Builders call the channel services for the KPI blocks (`getXSummary(month)` and the previous month — no longer
the full bundle) and module repositories for detail rows (`website/shared/repositories/website-report-repository.ts`,
`findPublishedYoutubeLogTitles`). `engine/generate.ts` records runs through `modules/report/repositories`.
Output was verified byte-identical to the pre-refactor builders for Jul–Oct 2026.

## States

- Empty month: `EmptyState` + default header description ("Monthly report · …"), as before the refactor.
- Overview and Report always render; channel badges say "not imported yet".
- Failure: route error boundary.
