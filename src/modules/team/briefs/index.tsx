import { BriefsView } from "./views/briefs-view";

export default function BriefsModule(props: { monthParam: string | undefined; showParam: string | undefined }) {
  return <BriefsView {...props} />;
}
