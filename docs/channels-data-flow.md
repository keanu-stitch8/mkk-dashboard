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
| Social | `SocialPost` (active platforms only), `SocialLog`, IG account `Metric`s, `IgAccountByType`, `IgAccountMonth`, `IgFollowerSnapshot`, `IgMediaSnapshot`, `IgStory`, Task Progress `Breakdown` | Log ↔ post matching and the IG consistency check live in `social/shared/lib/social-match.ts` (pure). Month-end post views require `IgMediaSnapshot` dated on the final calendar day (WIB); missing dates stay unavailable, without earlier/later substitution. Closed-month Top posts rank by these views and show lifetime values separately. **Audience & discovery** (`social/overview/{services/social-audience-service.ts,lib/social-audience.ts}`): `IgAccountMonth` (profile visits, bio link taps, account likes/comments/shares/saves/reposts, views/reach per `follow_type`; locked months are filled once, never overwritten) + `IgFollowerSnapshot` (daily follower total with follows/unfollows since the 1st taken at the same moment). Month-end followers: snapshot on the last day / the 1st of the next month = measured; first snapshot of the next month − its month-to-date net = estimate; earlier months counted back with complete-month `ig_account_follows − ig_account_unfollows` (estimate); broken chain = null. The Overview "Instagram followers" card uses the same series (`getIgFollowers`), falling back to the old `ig_account_followersNow` metric only when there is no snapshot. Per post `profileVisits`/`reposts` (Meta rejects `follows` & `profile_visits` for Reels). |

Every summary has `hasData`; the channel page shows `EmptyState` when it is false.

Social post follows may additionally use the independently stored `meta_ig_follows` CSV supplement. The
shared Social repository selects its Breakdown rows with import provenance; the mapper/service returns
canonical `CsvPostFollows` values. The summary overlays exact Instagram Post IDs only, retains the original
count in `followsRecorded`, and exposes `followsCsv` for date labels. Its main `postsAsOf` continues to come
from `meta_instagram`, never the supplement. Account follows and all other metrics keep the original path.

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

## Four-month Instagram period reports (`/report/periods`)

`report/periods`: thin route (`?p`) → module → view → section → cached query. The data service reuses
`getSocialSummary`, `getSocialAudience` and `getWebsiteSummary` for the four explicit calendar months.
Its repository selects canonical snapshot fields from `IgMediaSnapshot`, month locks and report history.
The shared `social/shared/lib/post-snapshot-date.ts` selects the lock cut-off from `cutoffDate(month)`
(the 4th of the following month). `periodPostSnapshotDate` uses the closing month's cut-off. The stored
sync captured on that date takes precedence over an earlier daily snapshot on the same date; otherwise
the exact-date snapshot supplies the complete metric group. This date flows through canonical `postSnapshotDate`,
dashboard notice, Top posts table, case study and methodology. Account months and follower balances remain
July–October; post metrics may include activity after October. No other snapshot date is substituted.
Missing values stay null. Categories, Top 5 and the case study use that same post set. Categories show
`recordedPosts/posts`; their views and averages use only recorded posts, with explicit coverage and source
date in the slide note. Stories follow the dashboard quota definition; monthly unique reach is never summed.
Case-study candidates are the ten highest-viewed posts in that same period. Both UI and server use this
canonical list; there is no fallback to another period and an out-of-list ID is rejected.
Missing period-end post views produce a warning, not a generation block. A completed period with all
four account months can still be generated: Top posts has an explicit unavailable row and the case-study
slide has `n/a` metrics, with the missing snapshot date explained. Both slides keep their template slots
and clear the previous report's example data. Incomplete periods and missing account months remain blocked.

The user's 5 November exception supplements **missing follows only** after choosing historical metrics.
An available follow count from the selected snapshot wins; CSV fills a null count and carries its own date/source. CSV
follows can be lifetime counts after the period, so slide 8 marks them and shows a separate source note.
Case-study primary metrics retain the selected snapshot; unknown profile visits stay null. Its four primary slots are
Views, Reach, Profile visits and Follows; likes/comments and shares/saves appear as secondary details.

The POST endpoint normalizes options and delegates to `pipeline/generate-period-report.ts`. This outbound
pipeline checks template bindings, copies both Slides and chart workbook, fills only those copies, recreates
the linked charts against the new workbook, verifies the filled text and links, exports a 13-page PDF, and
records success through the existing report repository. History uses `GeneratedReport.channel = social_period`
and `month = closing month`. No new migration is needed. Every run keeps earlier reports and master files.
The existing Google Sheets OAuth connection supplies `drive.file`; the Cloud project must enable Slides API.

Generation is blocked before period end or when account insights are unavailable. Missing post snapshots
produce warnings and `n/a` sections instead of blocking the entire report.
Unlocked months and incomplete optional metrics are warnings. Period calendar, snapshot/null handling and
template/chart plans have colocated tests. See the [period guide](./superpowers/MKK-PERIOD-REPORT-GUIDE.md).

## States

- Empty month: `EmptyState` + default header description ("Monthly report · …"), as before the refactor.
- Overview and Report always render; channel badges say "not imported yet".
- Failure: route error boundary.
