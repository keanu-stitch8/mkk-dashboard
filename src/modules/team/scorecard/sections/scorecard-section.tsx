import { ScorecardContent } from "../components/scorecard-content";
import { getScorecardPage } from "../queries/scorecard-query";

/** Header ikut section: pilihan bulan berasal dari data tim. */
export async function ScorecardSection({ monthParam }: { monthParam: string | undefined }) {
  return <ScorecardContent data={await getScorecardPage(monthParam)} />;
}
