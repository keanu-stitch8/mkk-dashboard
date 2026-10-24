import { categoryLabel, newsFormat } from "@/lib/taxonomy";
import type { NewsArticleEntry } from "../../shared/types/news";
import type { NewsLogs } from "../types/news-log";

/** Artikel → baris Publishing Log; thumbnail = og:image halaman artikel. Tanggal tayang, atau tanggal submit jika belum tayang. */
export function buildNewsLogs(articles: NewsArticleEntry[], thumbs: Map<string, string | null>): NewsLogs {
  const count = (s: string) => articles.filter((a) => a.status === s).length;
  return {
    rows: articles.map((a) => ({
      date: a.date ?? a.submittedDate,
      title: a.title,
      url: a.url,
      status: a.status,
      fields: { reporter: a.reporter, category: categoryLabel(a.category), type: newsFormat(a.type) },
      thumb: a.url ? (thumbs.get(a.url) ?? null) : null,
    })),
    published: count("publish"),
    inReview: count("review"),
  };
}
