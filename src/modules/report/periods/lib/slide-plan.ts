import type { slides_v1 } from "googleapis";
import { fmtNum, fmtPct } from "@/modules/shared/lib/format";
import { monthLabel } from "@/modules/shared/lib/month";
import { completeTotal } from "./period-data";
import { PERIOD_REPORT_TITLE, periodDate } from "./period";
import type { PeriodReportData, PeriodReportOptions } from "../types/period-report";

export interface SlideTextExpectation { objectId: string; row?: number; col?: number; text: string }
export interface PeriodSlidePlan { requests: slides_v1.Schema$Request[]; texts: SlideTextExpectation[]; warnings: string[] }
export const PERIOD_SLIDE_COUNT = 14;

export const PERIOD_CHARTS = [
  { objectId: "chart_101303", title: "Followers at month end", kind: "followers" },
  { objectId: "chart_vtypes", title: "Views by content type per month", kind: "types" },
  { objectId: "chart_voutput", title: "Posts published vs quota", kind: "output" },
] as const;

const num = (n: number | null | undefined, digits = 0) => n == null ? "n/a" : fmtNum(n, digits);
const pct = (n: number | null | undefined, digits = 1) => n == null ? "n/a" : fmtPct(n, digits);
const plain = (s: string) => s.replace(/[\u2013\u2014]|--/g, ", ").replace(/;/g, ".").replace(/:/g, ",").replace(/[ \t]+/g, " ").trim();
const short = (s: string, length: number) => s.length <= length ? s : `${s.slice(0, length - 1).trimEnd()}…`;
const textOf = (text: slides_v1.Schema$TextContent | undefined) => (text?.textElements ?? []).map((e) => e.textRun?.content ?? "").join("");

export function slideElements(presentation: slides_v1.Schema$Presentation): Map<string, slides_v1.Schema$PageElement> {
  const elements = new Map<string, slides_v1.Schema$PageElement>();
  const walk = (rows: slides_v1.Schema$PageElement[]) => {
    for (const e of rows) { if (e.objectId) elements.set(e.objectId, e); walk(e.elementGroup?.children ?? []); }
  };
  for (const slide of presentation.slides ?? []) walk(slide.pageElements ?? []);
  return elements;
}

/** The approved year-end goal applies to Period 1. Later periods need their own target. */
export function periodFollowerGoal(d: PeriodReportData, options: PeriodReportOptions = {}) {
  const target = options.followerTarget ?? (d.period.number === 1 ? 3000 : null);
  const date = options.targetDate ?? (d.period.number === 1 ? "2026-12-31" : null);
  const days = date ? Math.round((Date.parse(date) - Date.parse(d.period.endDate)) / 864e5) : null;
  const remaining = target == null || d.closingFollowers == null ? null : Math.max(0, target - d.closingFollowers);
  return { target, date, days, remaining, daily: remaining != null && days != null && days > 0 ? remaining / days : null };
}

/** Fill the approved native objects in a copy. No source-template writes or layout reconstruction. */
export function planPeriodSlides(presentation: slides_v1.Schema$Presentation, d: PeriodReportData, options: PeriodReportOptions = {}): PeriodSlidePlan {
  if (presentation.slides?.length !== PERIOD_SLIDE_COUNT) throw new Error("The period template must contain the approved 14 slides.");
  const order = presentation.slides.map((s) => s.objectId);
  if (order.includes("t_cat") || order.indexOf("period_growth") < 0 || order.indexOf("period_growth") !== order.indexOf("ge3bf6cbf14_0_216") + 1 || order.indexOf("period_conclusion") !== order.indexOf("period_growth") + 1)
    throw new Error("The period template must place Growth Outlook after Recommendations, immediately before Conclusion, and omit the category slide.");
  const elements = slideElements(presentation);
  for (const chart of PERIOD_CHARTS) if (!elements.get(chart.objectId)?.sheetsChart) throw new Error(`The template is missing its ${chart.kind} chart.`);
  const structural: slides_v1.Schema$Request[] = [];
  const requests: slides_v1.Schema$Request[] = [];
  const texts: SlideTextExpectation[] = [];
  const warnings: string[] = [];
  const fill = (objectId: string, value: string, row?: number, col?: number) => {
    const e = elements.get(objectId);
    if (!e) throw new Error(`The period template needs updating. Missing object ${objectId}.`);
    const old = row == null ? textOf(e.shape?.text) : textOf(e.table?.tableRows?.[row]?.tableCells?.[col!]?.text);
    const body = old.endsWith("\n") ? old.slice(0, -1) : old;
    const valueText = plain(value);
    const cellLocation = row == null ? undefined : { rowIndex: row, columnIndex: col! };
    if (valueText) requests.push({ insertText: { objectId, cellLocation, insertionIndex: 0, text: valueText } });
    if (body) requests.push({ deleteText: { objectId, cellLocation, textRange: { type: "FIXED_RANGE", startIndex: valueText.length, endIndex: valueText.length + body.length } } });
    texts.push({ objectId, row, col, text: valueText });
  };
  const table = (id: string, title: string, rows: string[][], headers = 2) => {
    const t = elements.get(id)?.table;
    if (!t) throw new Error(`The period template is missing table ${id}.`);
    const have = t.rows ?? t.tableRows?.length ?? 0;
    const want = headers + rows.length;
    if (want > have) structural.push({ insertTableRows: { tableObjectId: id, cellLocation: { rowIndex: have - 1 }, insertBelow: true, number: want - have } });
    for (let r = have - 1; r >= want; r--) structural.push({ deleteTableRow: { tableObjectId: id, cellLocation: { rowIndex: r } } });
    fill(id, title, 0, 0);
    rows.forEach((values, r) => values.forEach((v, c) => fill(id, v, r + headers, c)));
  };
  const p = d.period;
  const snapshotDate = d.postSnapshotDate;
  const first = d.months[0], last = d.months.at(-1)!;
  const casePost = d.caseStudy;
  const closingNote = d.followersEstimated ? "At period end (est.)" : "At period end";
  fill("gaa3fb9f80e_0_3814", PERIOD_REPORT_TITLE.replaceAll(" ", "\v"));
  // The approved master owns cover geometry, typography and title line spacing.
  fill("gaa3fb9f80e_0_3810", `Main ke Kudus · Period ${p.number} (${p.shortRangeLabel})${options.organic ? " · 100% organic" : ""}`);
  fill("ge442786401_0_1256", `Executive Summary · Period ${p.number} (${p.shortRangeLabel})`);
  fill("ge442786401_0_1299", `${num(d.closingFollowers)}\v${closingNote}`);
  fill("ge442786401_0_1301", `${num(d.views)}\v${pct(d.nonFollowerViewShare, 0)} from non-followers`);
  fill("ge442786401_0_1300", `${num(d.netFollows)}\vAbout ${num(d.followsPerDay, 1)} net follows a day`);
  fill("ge442786401_0_1302", `${num(d.profileVisits)}\v${num(d.linkTaps)} bio link taps`);

  fill("ge442786401_0_1343", `${num(first.followers.followers)}\vEnd ${monthLabel(first.month).split(" ")[0].slice(0, 3)}${first.followers.basis === "estimate" ? " (est.)" : ""}`);
  fill("ge442786401_0_1344", `${num(d.closingFollowers)}\vEnd ${monthLabel(last.month).split(" ")[0].slice(0, 3)}${d.followersEstimated ? " (est.)" : ""}`);
  fill("ge442786401_0_1345", `${num(d.netFollows)}\vNet follows, Period ${p.number}`);
  fill("ge2ed559f88_0_1184", `Monthly follower totals use the dashboard's recorded or reconstructed balances. The period opened with ${num(d.openingFollowers)} followers.`);
  table("ge442786401_0_1803", "Views and reach beyond the existing follower base", d.months.map((m) => [
    monthLabel(m.month, true), num(m.views), num(m.reach), pct(m.nonFollowerViews != null && m.splitViews ? m.nonFollowerViews / m.splitViews : null), pct(m.nonFollowerReachShare),
  ]));

  for (const [id, key, label] of [["SLIDES_API620330423_2", "carousel", "Carousel"], ["SLIDES_API620330423_5", "reels", "Reels"], ["SLIDES_API620330423_8", "story", "Story"]] as const) {
    const views = completeTotal(d.months.map((m) => m.viewsByType[key]));
    const total = completeTotal(d.months.flatMap((m) => Object.values(m.viewsByType)));
    fill(id, `${num(views)}\v${label} · ${pct(views != null && total ? views / total : null)}`);
  }
  fill("SLIDES_API620330423_18", `Monthly account views include older posts. Period ${p.number} recorded ${num(d.views)} views.`);
  fill("SLIDES_API620330423_24", `${num(d.published)}\vPublished · quota ${num(d.quota)}`);
  fill("SLIDES_API620330423_27", `${num(d.stories)}\vStories`);
  fill("SLIDES_API620330423_30", `${num(d.feedAndReels)}\vFeed + Reels + video`);
  const quotaNote = d.quota == null ? "Output follows the Publishing Log." : `Output ${d.published >= d.quota ? "met" : "was below"} the period quota.`;
  fill("SLIDES_API620330423_40", `${quotaNote} Stories made up ${num(d.stories)} of ${num(d.published)} published posts.\v${last.label} had ${num(last.published)} published posts and ${num(last.inReview)} in review.`);

  fill("SLIDES_API620330423_48", `${d.topPosts.length ? `Top ${d.topPosts.length} Content` : "Top Content · n/a"} · Period ${p.number}`);
  table("SLIDES_API620330423_49", `Top posts by views at ${periodDate(snapshotDate, true)}`, d.topPosts.length ? d.topPosts.map((r, i) => [String(i + 1), `${short(r.title, 76)} (${periodDate(r.date, true)})`, r.format === "carousel" ? "Carousel" : r.format === "reels" ? "Reel" : "Post", num(r.views), `${num(r.follows)}${r.followsCsv ? "*" : ""}`]) : [["n/a", "Month-end views unavailable", "n/a", "n/a", "n/a"]]);

  const followsSources = (posts: typeof d.posts, brief = true) => [...new Set(posts.filter((post) => post.followsCsv).map((post) => {
    const csv = post.followsCsv!;
    return csv.observedOn ? `exported ${periodDate(csv.observedOn, brief)}` : `uploaded ${periodDate(csv.importedOn, brief)}, export date unknown`;
  }))];
  const topSources = followsSources(d.topPosts);
  const topNote = !d.topPosts.length ? `No post views captured on ${periodDate(snapshotDate, true)}. Ranking is unavailable. Earlier and later snapshots are not substituted.` : `${snapshotDate !== p.endDate ? `Views snapshot ${periodDate(snapshotDate, true)}, after period end. ` : ""}${topSources.length ? `* Follows are lifetime CSV counts ${topSources.join("; ")}.` : `Views and follows use the ${periodDate(snapshotDate, true)} records.`}`;
  const topSlide = presentation.slides!.find((slide) => slide.pageElements?.some((element) => element.objectId === "SLIDES_API620330423_49"))!;
  const noteId = "period_follows_note";
  if (elements.has(noteId)) fill(noteId, topNote);
  else {
    structural.push({ createShape: { objectId: noteId, shapeType: "TEXT_BOX", elementProperties: { pageObjectId: topSlide.objectId!, size: { width: { magnitude: 3000000, unit: "EMU" }, height: { magnitude: 3000000, unit: "EMU" } }, transform: { scaleX: 2.666667, scaleY: 0.216667, translateX: 572000, translateY: 4480000, unit: "EMU" } } } });
    const text = plain(topNote);
    requests.push({ insertText: { objectId: noteId, insertionIndex: 0, text } }, { updateTextStyle: { objectId: noteId, textRange: { type: "ALL" }, style: { fontFamily: "Roboto", fontSize: { magnitude: 10, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: { red: 0.3, green: 0.3, blue: 0.3 } } } }, fields: "fontFamily,fontSize,foregroundColor" } });
    texts.push({ objectId: noteId, text });
  }
  requests.push({ updatePageElementTransform: { objectId: noteId, applyMode: "ABSOLUTE", transform: { scaleX: 2.666667, scaleY: 0.216667, translateX: 572000, translateY: 4480000, unit: "EMU" } } });

  const caseTitle = casePost ? short(casePost.title, 44) : "n/a";
  if (casePost && caseTitle !== casePost.title) warnings.push("The case study heading is shortened to fit. The complete title is available in the dashboard preview.");
  fill("ge2ed559f88_0_117", `Case study · ${caseTitle}`);
  fill("ge2ed559f88_0_114", casePost ? short(casePost.title, 48) : "No eligible post");
  fill("ge2ed559f88_0_88", num(casePost?.views));
  fill("ge2ed559f88_0_84", num(casePost?.reach));
  fill("ge2ed559f88_0_83", "Reach");
  const rank = d.topPosts.findIndex((r) => r.postId === casePost?.postId);
  fill("ge2ed559f88_0_86", casePost ? `Published ${periodDate(casePost.date)}${rank < 0 ? "" : ` · #${rank + 1} by views`}` : "Month-end views unavailable");
  fill("ge2ed559f88_0_82", casePost?.capturedOn ? `Snapshot\v${periodDate(casePost.capturedOn)}` : "Snapshot unavailable");
  fill("ge2ed559f88_0_92", num(casePost?.profileVisits));
  fill("ge2ed559f88_0_91", "Profile visits");
  fill("ge2ed559f88_0_80", num(casePost?.follows));
  fill("ge2ed559f88_0_79", "Follows");
  fill("ge2ed559f88_0_90", `Likes ${num(casePost?.likes)} · Comments ${num(casePost?.comments)}`);
  fill("ge2ed559f88_0_110", `Shares ${num(casePost?.shares)} · Saves ${num(casePost?.saves)}`);
  const caseSources = followsSources(casePost ? [casePost] : []);
  fill("entok_note", casePost ? `Main metrics captured ${casePost.capturedOn ? periodDate(casePost.capturedOn, true) : "on an unavailable date"}.${snapshotDate !== p.endDate ? " Includes activity after period end." : ""}${caseSources.length ? ` Follows from CSV ${caseSources.join(", ")}.` : ""} Missing metrics stay n/a.` : `No post views captured on ${periodDate(snapshotDate, true)}. Case study metrics stay n/a.`);

  const funnelRows = d.months.map((m) => [monthLabel(m.month, true), num(m.profileVisits), num(m.linkTaps), pct(m.linkTaps != null && m.profileVisits ? m.linkTaps / m.profileVisits : null), num(m.socialSessions)]);
  funnelRows.push(["Total", num(d.profileVisits), num(d.linkTaps), pct(d.linkTapRate), num(d.socialSessions)]);
  table("SLIDES_API620330423_53", "Profile visits, bio link taps and website sessions", funnelRows);

  fill("ge4430a8c27_0_1046", "Strengths and areas to improve");
  fill("ge4430a8c27_0_843", options.organic ? "Organic growth" : "Audience growth");
  fill("ge4430a8c27_0_844", `${num(d.openingFollowers)} to ${num(d.closingFollowers)} followers during the period`);
  fill("ge4430a8c27_0_849", `Feed + Reels + video went from ${num(first.feedAndReels)} to ${num(last.feedAndReels)} posts a month`);
  const recordedFollows = d.posts.filter((r) => r.follows != null).sort((a, b) => b.follows! - a.follows!)[0];
  fill("ge4430a8c27_0_854", recordedFollows ? `The highest recorded post follow count was ${num(recordedFollows.follows)}${recordedFollows.followsCsv ? " (CSV lifetime)" : ""}` : "Post follows were not available within this period");
  fill("ge4430a8c27_0_859", `Engagement rate went from ${pct(first.engagementRate)} to ${pct(last.engagementRate)}`);
  const shares = d.months.map((m) => m.nonFollowerViews != null && m.splitViews ? m.nonFollowerViews / m.splitViews : null).filter((x): x is number => x != null);
  fill("ge4430a8c27_0_864", shares.length ? `Non-followers accounted for ${pct(Math.min(...shares), 0)} to ${pct(Math.max(...shares), 0)} of monthly views` : "The follower split is unavailable for this period");
  fill("ge4430a8c27_0_869", `${pct(d.linkTapRate)} tap rate. Social sessions went from ${num(first.socialSessions)} to ${num(last.socialSessions)}.`);

  fill("ge3bf6cbf14_0_217", "Recommendations & Next Steps");
  fill("ge3bf6cbf14_0_364", "Track the target");
  fill("ge3bf6cbf14_0_365", "Review net follower growth against the next goal.");
  const goal = periodFollowerGoal(d, options);
  fill("period_growth_title", "Growth Outlook");
  fill("period_growth_followers_label", "Followers");
  fill("period_growth_followers_value", `${num(d.closingFollowers)}\v${periodDate(p.endDate)}${d.followersEstimated ? " (est.)" : ""}`);
  fill("period_growth_target_label", "Target");
  fill("period_growth_target_value", `${num(goal.target)}\v${goal.date ? `By ${periodDate(goal.date)}` : "Agree the next target date"}`);
  fill("period_growth_gap_label", "Gap to target");
  fill("period_growth_gap_value", `${num(goal.remaining)}\v${goal.remaining === 0 ? "Target reached" : "More net followers needed"}`);
  fill("period_growth_daily_label", "Daily pace");
  fill("period_growth_daily_value", `${num(goal.daily, 1)}\v${goal.days != null && goal.days > 0 ? `Net follows a day (${goal.days} days)` : "Set a target and deadline"}`);
  fill("period_conclusion_title", "Conclusion");
  fill("period_conclusion_body", [
    `Main ke Kudus closed Period ${p.number} with ${d.followersEstimated ? "an estimated " : ""}${num(d.closingFollowers)} followers, up ${num(d.netFollows)} during ${p.rangeLabel}. Account insights recorded ${num(d.views)} views and ${num(d.profileVisits)} profile visits over the four months.`,
    `Publishing output reached ${num(d.published)} posts${d.quota == null ? "" : ` against a period quota of ${num(d.quota)}`}. Stories accounted for ${num(d.stories)} posts, while Feed, Reels and video content totalled ${num(d.feedAndReels)}. Monthly Feed, Reels and video output ${last.feedAndReels < first.feedAndReels ? "fell" : last.feedAndReels > first.feedAndReels ? "rose" : "was unchanged"} from ${num(first.feedAndReels)} to ${num(last.feedAndReels)}.`,
    `The next steps are to maintain useful editorial content, strengthen publishing consistency and improve the path from Instagram to the website.${goal.target != null && goal.date && goal.remaining != null ? ` The ${num(goal.target)}-follower goal for ${periodDate(goal.date)} requires ${num(goal.remaining)} more net followers from the closing balance.` : " Agree the next follower target and deadline using this period's results."}`,
  ].join("\n\n"));
  // The reusable recommendations are editorial actions. They do not assert new performance facts.
  fill("ge3bf6cbf14_0_408", "Develop more food and destination lists");
  fill("ge3bf6cbf14_0_329", "Keep sport central, with food, tourism & human interest.");
  fill("ge3bf6cbf14_0_341", "Add links, Story stickers & UTM tags");
  fill("m_body", [
    `Monthly account insights from the Instagram Graph API cover ${p.rangeLabel}. Output comes from the Publishing Log and website sessions from GA4.`,
    "Follower totals use recorded or reconstructed balances. Estimated figures are marked on the audience slide.",
    "Reach counts unique accounts each month. Monthly reach cannot be added together. Months with 31 days cover the first 30.",
    `Post metrics use the ${periodDate(snapshotDate)} snapshot${snapshotDate !== p.endDate ? `, not ${periodDate(p.endDate)}. They may include activity after the reporting period.` : ", the period's final day."} Account totals retain the four calendar months. Other snapshot dates are not substituted. Missing metrics are shown as n/a.${casePost ? "" : " The case study is unavailable without recorded post views."}`,
    `Per-post follows may be supplemented with lifetime CSV counts, including activity after the period. ${followsSources(d.posts, false).length ? `CSV ${followsSources(d.posts, false).join(", ")}. ` : ""}The Instagram API does not provide Reel follows or profile visits.`,
    "Organic Social sessions include other social platforms and Story link stickers.",
  ].join("\n"));
  return { requests: [...structural, ...requests], texts, warnings };
}

export function verifyPeriodSlideText(presentation: slides_v1.Schema$Presentation, expected: SlideTextExpectation[]): void {
  const elements = slideElements(presentation);
  for (const x of expected) {
    const e = elements.get(x.objectId);
    const actual = x.row == null ? textOf(e?.shape?.text) : textOf(e?.table?.tableRows?.[x.row]?.tableCells?.[x.col!]?.text);
    if (actual.replace(/\n$/, "") !== x.text) throw new Error("The generated deck failed its text verification. No successful report was recorded.");
  }
}
