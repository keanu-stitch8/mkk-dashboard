import { ContributorsContent } from "../components/contributors-content";
import { getContributorsPage } from "../queries/contributors-query";

/** Header ikut section: pilihan bulan berasal dari data tim. */
export async function ContributorsSection({ monthParam, showParam }: { monthParam: string | undefined; showParam: string | undefined }) {
  return <ContributorsContent data={await getContributorsPage(monthParam)} showParam={showParam} />;
}
