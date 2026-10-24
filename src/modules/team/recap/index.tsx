import { RecapView } from "./views/recap-view";

export default function RecapModule(props: { year: string }) {
  return <RecapView {...props} />;
}
