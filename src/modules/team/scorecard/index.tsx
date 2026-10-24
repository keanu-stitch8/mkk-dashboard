import { ScorecardView } from "./views/scorecard-view";

export default function ScorecardModule(props: { monthParam: string | undefined }) {
  return <ScorecardView {...props} />;
}
