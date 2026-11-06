# Team data flow

Stories, Briefs, Content Pipeline, Contributors, Team Scorecard, Recap. Follows the
[global data flow](./architecture/data-flow.md).

## Ingest (`src/modules/team/ingest`)

Google Drive connector → `syncTeamDocs` (Story, Brief) → `syncBriefTracker` (BriefTask) → `syncContributors`
(ContributorTask, Contributor) → `rebuildMatches` (TeamMatch). Machine statuses (`GENERATED_MATCH_STATUSES` in
`modules/team/ingest/match.ts`) are deleted and rebuilt; `confirmed` / `rejected` are never overwritten.

## Read side

```text
team/shared
  repositories/team-repository.ts   Story, Brief, BriefTask, TeamMatch reads
  mappers/team-mapper.ts            → StoryEntry, BriefEntry, BriefTaskEntry, TeamMatchEntry
  lib/team-links.ts                 COUNTED, linked(), buildStoryRows, buildBriefRows, taskStage, dayDiff, median
  services/story-service.ts         getStories(month)
  services/brief-service.ts         loadBriefs(where) / getBriefs(month)
  services/team-month-service.ts    months with a Story or Brief
  queries/team-month-query.ts       resolveTeamMonth(?m) — default = latest month with team data
  services/match-decision-service.ts  Confirm / Not this (POST /api/team/matches/[id])
  components/match-link.tsx         client: shows a match or suggestions + decision buttons
team/pipeline   services/derivatives-service.ts (briefs & IG derivatives per article — also used by Scorecard),
                services/pipeline-service.ts, lib/pipeline.ts (stages, stuck days, repurpose lag)
team/contributors  repositories + mapper (asset states) + lib/contributors.ts (per-item assets, per-person totals)
                  Credit rules mirror the tracker's "Master Report" tab: 1 content = 1 Submitted article (incl. "<Month> Extra
                  Posts" tabs, row id "<tab>#X<No>"), co-authors split equally, Ref Role "Footage"-only people excluded from
                  the split and counted by footage (stories with ≥1 asset in their name). `syncContributors` compares with the
                  Master Report and warns on differences. Articles → Website = News Content Logs (status publish) whose
                  Reporter maps to an alias / Ref "News Name"; Ref "Active" = No hides people with no activity. IG numbers on
                  the cards = Social report (Socmed log live + Task Progress in review). buildContributorRecap = all months.
team/scorecard  lib/scorecard.ts (SCORE_DEFS, buildScores, onTarget, SCORECARD_FROM),
                services/scorecard-service.ts (compute / snapshot / clear / history)
team/recap      lib/recap.ts (yearly totals), services/recap-service.ts (trend, audience, scorecard per month)
```

Only counted links (confirmed > coded > tracker > auto) form a match or a pipeline stage; `suggested` is shown as
"Needs confirmation" and never counted.

## Pages

Each page is one section (the header's month list comes from team data): `page.tsx` passes `?m`, `?show`
(or `?y` for Recap) → module → view (Suspense + skeleton) → section → `get<Page>Page` query → content component.
Page-level counts (done / check / missing, groups, stage counts, medians) come from `lib/<page>-page.ts`; the
`?show=` filter is applied in the component.

Contributors defaults to the latest contributor tab (not the latest Story/Brief month).

The Local Contributor monthly report (`report/pipeline/channels/contributors.ts`) reads the existing
`getContributors` and `getContributorRecap` services, then derives report data in `contributors-data.ts`.
Delivery follows the Master Report and includes Extra Posts. The team target is
60 per month. Report media KPIs count stories with available portrait photos, portrait video, or interview
video. A completely blank media group is untracked, not zero. The delivery log shows story titles,
planned/submission dates, submission status, and portrait/interview availability. It contains no names,
assignees, individual contribution breakdown, asset total, or landscape-photo note.
Recap rows stop at the selected month. Missing tracker data blocks generation before a report is copied.
The `contributors` report uses `REPORT_TEMPLATE_CONTRIBUTORS` and the shared Sheets/PDF generator and cron.

## Scorecard snapshots

`modules/connectors/sources/lock.ts` (ingest) calls `snapshotScorecard` when a month is locked and `clearScorecard` when it is
unlocked. Months before `SCORECARD_FROM` (July 2026) show a notice; before the refactor they returned HTTP 500.

Asset completion is untracked (`value: null`) if an entire required asset group is blank across every
contributor story that month. The groups are photo (landscape or portrait), portrait video, and interview
video. An explicit missing/unavailable state counts as recorded. This prevents an unrecorded group
from becoming a misleading 0% completion score, as in July 2026.

## Verification

Old vs new service output (stories, briefs, pipeline, contributors, scorecard live + snapshot + history, recap)
was identical for Jun–Oct 2026 apart from the dropped `updatedAt` column.
