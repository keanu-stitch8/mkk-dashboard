/**
 * Warna Badge kolom Publishing Log — palet halaman Users template (Badge secondary + text-X bg-X/10).
 * Dipakai server page, jadi tidak boleh di file "use client".
 */
export const BADGE = {
  green: "text-success bg-success/10",
  blue: "text-info bg-info/10",
  red: "text-destructive bg-destructive/10",
  orange: "text-attention bg-attention/10",
  violet: "text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20",
  gray: "text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20",
};

/**
 * Warna per format (label taksonomi, huruf kecil) — satu peta untuk semua channel: format utama biru, format
 * pendukung ungu/oranye/merah. Kategori & platform memakai badge netral (abu).
 */
export const FORMAT_BADGES: Record<string, string> = {
  // News
  features: BADGE.blue,
  "hard news": BADGE.red,
  editorial: BADGE.orange,
  // YouTube
  "editorial feature video": BADGE.blue,
  "event recap": BADGE.violet,
  "hero video": BADGE.orange,
  // Social
  feed: BADGE.blue,
  reel: BADGE.violet,
  story: BADGE.orange,
  video: BADGE.red,
};
