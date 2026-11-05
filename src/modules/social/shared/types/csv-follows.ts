/** A per-media CSV count, stored separately from the API's account and post metrics. */
export interface CsvPostFollows {
  postId: string;
  follows: number;
  observedOn: string | null;
  importedOn: string;
}
