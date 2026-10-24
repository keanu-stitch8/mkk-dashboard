import { ImportPageView } from "./views/import-page-view";

export default function ImportModule({ monthParam }: { monthParam: string | undefined }) {
  return <ImportPageView monthParam={monthParam} />;
}
