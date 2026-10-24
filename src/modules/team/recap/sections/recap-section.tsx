import { RecapContent } from "../components/recap-content";
import { getRecapPage } from "../queries/recap-query";

/** Header ikut section: pilihan bulan berasal dari data tim. */
export async function RecapSection({ year }: { year: string }) {
  return <RecapContent data={await getRecapPage(year)} />;
}
