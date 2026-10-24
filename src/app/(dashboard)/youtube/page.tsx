import YoutubeOverviewModule from "@/modules/youtube/overview";
import { firstParam } from "@/modules/shared/lib/month-param";

export const dynamic = "force-dynamic";

export default async function YoutubePage({ searchParams }: PageProps<"/youtube">) {
  return <YoutubeOverviewModule monthParam={firstParam((await searchParams).m)} />;
}
