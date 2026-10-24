import type { NewsSummary } from "../types/news-summary";

export type NewsTrendFields = {
  newsPublished: number | null;
  newsQuota: number;
  newsDelivered: number | null;
  newsViews: number | null;
};

export const newsTrendFields = (n: NewsSummary): NewsTrendFields => ({
  newsPublished: n.hasData ? n.published : null,
  newsQuota: n.quota.value,
  newsDelivered: n.hasData ? n.delivered : null,
  newsViews: n.hasData ? n.totalViews : null,
});
