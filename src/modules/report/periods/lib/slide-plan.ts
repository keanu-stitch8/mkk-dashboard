import type { slides_v1 } from "googleapis";
import { fmtNum, fmtPct } from "@/modules/shared/lib/format";
import { monthLabel } from "@/modules/shared/lib/month";
import { completeTotal } from "./period-data";
import { PERIOD_REPORT_TITLE, periodDate } from "./period";
import type { PeriodCategory, PeriodReportData, PeriodReportOptions } from "../types/period-report";

export interface SlideTextExpectation { objectId: string; row?: number; col?: number; text: string }
export interface PeriodSlidePlan { requests: slides_v1.Schema$Request[]; texts: SlideTextExpectation[]; warnings: string[] }

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

function displayCategories(categories: PeriodCategory[]): PeriodCategory[] {
  if (categories.length <= 6) return categories;
  const rest = categories.slice(5);
  const posts = rest.reduce((n, r) => n + r.posts, 0);
  const recordedPosts = rest.reduce((n, r) => n + r.recordedPosts, 0);
  const views = completeTotal(rest.filter((r) => r.recordedPosts > 0).map((r) => r.views));
  return [...categories.slice(0, 5), { label: "Other categories", posts, recordedPosts, views, avgViews: views == null ? null : views / recordedPosts }];
}

/** Fill the approved native objects in a copy. No source-template writes or layout reconstruction. */
export function planPeriodSlides(presentation: slides_v1.Schema$Presentation, d: PeriodReportData, options: PeriodReportOptions = {}): PeriodSlidePlan {
  if (presentation.slides?.length !== 13) throw new Error("The period template must contain the approved 13 slides.");
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

  const cats = displayCategories(d.categories);
  if (d.categories.length > 6) warnings.push("The category table combines categories after the top five into Other categories.");
  table("SLIDES_API620330423_45", "Recorded views by publishing category", (cats.length ? cats : [{ label: "No matched categories", posts: 0, recordedPosts: 0, views: null, avgViews: null }]).map((r) => [r.label, `${num(r.recordedPosts)}/${num(r.posts)}`, num(r.views), num(r.avgViews)]));
  fill("SLIDES_API620330423_45", "Posts*", 1, 1);
  const categoryNote = `* Posts with views / total posts. Views and averages cover recorded posts only. Snapshot ${periodDate(snapshotDate, true)}.`;
  const categoryNoteId = "period_category_note";
  if (elements.has(categoryNoteId)) fill(categoryNoteId, categoryNote);
  else {
    const categorySlide = presentation.slides!.find((slide) => slide.pageElements?.some((element) => element.objectId === "SLIDES_API620330423_45"))!;
    structural.push({ createShape: { objectId: categoryNoteId, shapeType: "TEXT_BOX", elementProperties: { pageObjectId: categorySlide.objectId!, size: { width: { magnitude: 3000000, unit: "EMU" }, height: { magnitude: 3000000, unit: "EMU" } }, transform: { scaleX: 2.666667, scaleY: 0.216667, translateX: 572000, translateY: 4480000, unit: "EMU" } } } });
    const text = plain(categoryNote);
    requests.push({ insertText: { objectId: categoryNoteId, insertionIndex: 0, text } }, { updateTextStyle: { objectId: categoryNoteId, textRange: { type: "ALL" }, style: { fontFamily: "Roboto", fontSize: { magnitude: 10, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: { red: 0.3, green: 0.3, blue: 0.3 } } } }, fields: "fontFamily,fontSize,foregroundColor" } });
    texts.push({ objectId: categoryNoteId, text });
  }
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

  let goalTitle = "Set the next follower goal";
  let goalBody = "Agree the target and deadline after reviewing this period.";
  if (options.followerTarget != null && options.targetDate) {
    const days = Math.round((Date.parse(options.targetDate) - Date.parse(p.endDate)) / 864e5);
    const needed = d.closingFollowers == null ? null : Math.max(0, options.followerTarget - d.closingFollowers);
    goalTitle = `${num(options.followerTarget)} followers\vby ${periodDate(options.targetDate, true)}`;
    goalBody = needed == null ? "The closing follower count is unavailable." : needed === 0 ? "Target reached. Agree a new follower goal." : `${num(needed)} more needed, about ${num(needed / days, 1)} a day.`;
  }
  fill("ge3bf6cbf14_0_364", goalTitle);
  fill("ge3bf6cbf14_0_365", goalBody);
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
