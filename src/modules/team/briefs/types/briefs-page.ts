import type { BriefRow, BriefState } from "../../shared/types/team";

export interface BriefsPage {
  month: string;
  months: string[];
  briefs: BriefRow[];
  groups: Record<BriefState, BriefRow[]>;
  /** median hari brief → tayang */
  lag: number | null;
  /** "3 carousel", "2 reel", … */
  byType: string[];
  /** brief yang ada di Task Progress */
  tracked: number;
}
