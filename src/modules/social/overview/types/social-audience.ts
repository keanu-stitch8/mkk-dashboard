/** Snapshot total followers IG (tabel IgFollowerSnapshot) — follow/unfollow sejak tanggal 1 diambil bersamaan. */
export type FollowerSnapshotEntry = {
  date: string;
  followers: number;
  monthFollows: number | null;
  monthUnfollows: number | null;
};

/** Follow baru & unfollow akun IG selama satu bulan (insight akun connector Meta). */
export type FollowFlow = { month: string; follows: number; unfollows: number };

/** Satu baris IgAccountMonth (segment: all | follower | non_follower | unknown). */
export type IgAccountMonthEntry = { metric: string; segment: string; value: number };

/**
 * Followers per akhir bulan.
 *  • measured = snapshot di hari terakhir bulan / tanggal 1 bulan berikutnya, atau "per tanggal" untuk bulan berjalan
 *  • estimate = dihitung mundur dari bulan sesudahnya dengan follow − unfollow (definisi Meta ≠ angka app Insights)
 */
export type FollowerPoint = {
  month: string;
  label: string;
  followers: number | null;
  basis: "measured" | "estimate" | null;
  /** bulan berjalan: tanggal snapshot terakhir */
  asOf: string | null;
  /** follow − unfollow selama bulan itu (bulan berjalan: s/d snapshot terakhir) */
  net: number | null;
};

export type FollowSplit = { follower: number; nonFollower: number; unknown: number; nonFollowerShare: number | null };

/** Insight akun selama bulan itu di luar KPI lama (IgAccountMonth). */
export type SocialDiscovery = {
  profileVisits: number | null;
  linkTaps: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  reposts: number | null;
  /** follow baru per 1.000 views akun (views = total views per follow_type) */
  followsPer1kViews: number | null;
  views: FollowSplit | null;
  /** reach unik — 30 hari pertama saja untuk bulan 31 hari (sama dengan KPI reach) */
  reach: FollowSplit | null;
};

export type SocialAudience = {
  followers: FollowerPoint;
  prevFollowers: FollowerPoint | null;
  /** bulan-bulan tren (sama dengan grafik lain di halaman Social) */
  series: FollowerPoint[];
  discovery: SocialDiscovery | null;
  prevDiscovery: SocialDiscovery | null;
};
