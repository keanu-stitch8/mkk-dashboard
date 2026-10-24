import type { Brief, BriefTask, Story, TeamMatch } from "@prisma/client";
import type { BriefEntry, BriefTaskEntry, StoryEntry, TeamMatchEntry } from "../types/team";

export const toStoryEntry = (s: Story): StoryEntry => ({ code: s.code, date: s.date, month: s.month, n: s.n, title: s.title, angle: s.angle, fileId: s.fileId, fileName: s.fileName });

export const toBriefEntry = (b: Brief): BriefEntry => ({
  fileId: b.fileId,
  fileName: b.fileName,
  date: b.date,
  month: b.month,
  type: b.type,
  topic: b.topic,
  headline: b.headline,
  outline: b.outline,
  webViewLink: b.webViewLink,
  modifiedTime: b.modifiedTime,
});

export const toBriefTaskEntry = (t: BriefTask): BriefTaskEntry => ({
  briefKey: t.briefKey,
  briefName: t.briefName,
  tab: t.tab,
  planned: t.planned,
  article: t.article,
  format: t.format,
  status: t.status,
  assignee: t.assignee,
  submitted: t.submitted,
  published: t.published,
  igUrl: t.igUrl,
  note: t.note,
});

export const toTeamMatchEntry = (m: TeamMatch): TeamMatchEntry => ({
  id: m.id,
  fromType: m.fromType,
  fromKey: m.fromKey,
  toType: m.toType,
  toKey: m.toKey,
  toTitle: m.toTitle,
  toDate: m.toDate,
  toFormat: m.toFormat,
  toUrl: m.toUrl,
  score: m.score,
  status: m.status,
  decidedBy: m.decidedBy,
  decidedAt: m.decidedAt,
});
