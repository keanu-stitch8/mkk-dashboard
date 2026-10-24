import type { SocialLog, SocialPost } from "@prisma/client";
import type { SocialLogEntry, SocialPostEntry } from "../types/social";

export const toSocialPostEntry = (p: SocialPost): SocialPostEntry => ({
  id: p.id,
  platform: p.platform,
  account: p.account,
  postId: p.postId,
  date: p.date,
  publishedAt: p.publishedAt,
  format: p.format,
  rawType: p.rawType,
  caption: p.caption,
  permalink: p.permalink,
  views: p.views,
  reach: p.reach,
  likes: p.likes,
  comments: p.comments,
  shares: p.shares,
  saves: p.saves,
  follows: p.follows,
  interactions: p.interactions,
  durationSec: p.durationSec,
});

export const toSocialLogEntry = (l: SocialLog): SocialLogEntry => ({
  id: l.id,
  date: l.date,
  platform: l.platform,
  format: l.format,
  category: l.category,
  admin: l.admin,
  designer: l.designer,
  status: l.status,
  title: l.title,
  url: l.url,
  story: l.story,
});
