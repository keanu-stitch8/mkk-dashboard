import { StoriesContent } from "../components/stories-content";
import { getStoriesPage } from "../queries/stories-query";

/** Header ikut section: pilihan bulan berasal dari data tim. */
export async function StoriesSection({ monthParam, showParam }: { monthParam: string | undefined; showParam: string | undefined }) {
  return <StoriesContent data={await getStoriesPage(monthParam)} showParam={showParam} />;
}
