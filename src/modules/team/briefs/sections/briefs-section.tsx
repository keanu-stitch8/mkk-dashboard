import { BriefsContent } from "../components/briefs-content";
import { getBriefsPage } from "../queries/briefs-query";

/** Header ikut section: pilihan bulan berasal dari data tim. */
export async function BriefsSection({ monthParam, showParam }: { monthParam: string | undefined; showParam: string | undefined }) {
  return <BriefsContent data={await getBriefsPage(monthParam)} showParam={showParam} />;
}
