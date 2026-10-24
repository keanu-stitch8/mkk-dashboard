import type { StoryRow } from "../../shared/types/team";

export interface StoriesPage {
  month: string;
  months: string[];
  stories: StoryRow[];
  /** artikelnya sudah tayang (pasangan yang dihitung) */
  done: StoryRow[];
  /** ada saran artikel, menunggu konfirmasi */
  check: StoryRow[];
  missing: StoryRow[];
  /** median hari panduan → artikel tayang */
  lag: number | null;
}
