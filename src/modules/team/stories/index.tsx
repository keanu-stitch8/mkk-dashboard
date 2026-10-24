import { StoriesView } from "./views/stories-view";

export default function StoriesModule(props: { monthParam: string | undefined; showParam: string | undefined }) {
  return <StoriesView {...props} />;
}
