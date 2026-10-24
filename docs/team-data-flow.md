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

## Scorecard snapshots

`modules/connectors/sources/lock.ts` (ingest) calls `snapshotScorecard` when a month is locked and `clearScorecard` when it is
unlocked. Months before `SCORECARD_FROM` (July 2026) show a notice; before the refactor they returned HTTP 500.

## Verification

Old vs new service output (stories, briefs, pipeline, contributors, scorecard live + snapshot + history, recap)
was identical for Jun–Oct 2026 apart from the dropped `updatedAt` column.
