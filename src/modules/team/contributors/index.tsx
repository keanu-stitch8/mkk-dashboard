import { ContributorsView } from "./views/contributors-view";

export default function ContributorsModule(props: { monthParam: string | undefined; showParam: string | undefined }) {
  return <ContributorsView {...props} />;
}
