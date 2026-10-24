import ImportModule from "@/modules/import/data";
import { firstParam } from "@/modules/shared/lib/month-param";

export const dynamic = "force-dynamic";

export default async function ImportPage({ searchParams }: PageProps<"/import">) {
  return <ImportModule monthParam={firstParam((await searchParams).m)} />;
}
