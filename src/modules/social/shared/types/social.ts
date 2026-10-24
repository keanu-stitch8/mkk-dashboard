/** Post Meta (Instagram/Facebook) dari connector / export. `id` = identitas baris (pencocokan ke log). */
export interface SocialPostEntry {
  id: string;
  platform: string;
  /** username akun pemilik post (post kolaborasi bisa milik akun lain) */
  account: string | null;
  postId: string;
  date: string;
  /** "YYYY-MM-DD HH:mm" */
  publishedAt: string;
  /** reels | carousel | feeds | video | photo | story | lainnya */
  format: string;
  rawType: string | null;
  caption: string | null;
  permalink: string | null;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  follows: number | null;
  interactions: number | null;
  durationSec: number | null;
}

/** Satu baris Socmed Content Logs (Publishing Log). */
export interface SocialLogEntry {
  id: string;
  date: string | null;
  /** satu atau beberapa platform, dipisah koma */
  platform: string;
  format: string;
  category: string | null;
  admin: string | null;
  designer: string | null;
  status: string;
  title: string | null;
  url: string | null;
  /** kode liputan (kolom Story, opsional) */
  story: string | null;
}
