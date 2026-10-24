import PipelineModule from "@/modules/team/pipeline";
import { firstParam } from "@/modules/shared/lib/month-param";

export const dynamic = "force-dynamic";

export default async function PipelinePage({ searchParams }: PageProps<"/team/pipeline">) {
  const sp = await searchParams;
  return <PipelineModule monthParam={firstParam(sp.m)} showParam={firstParam(sp.show)} />;
}
