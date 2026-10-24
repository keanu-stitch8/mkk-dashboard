import type { NewsArticle } from "@prisma/client";
import type { NewsArticleEntry } from "../types/news";

export const toNewsArticleEntry = (a: NewsArticle): NewsArticleEntry => ({
  id: a.id,
  date: a.date,
  submittedDate: a.submittedDate,
  title: a.title,
  url: a.url,
  path: a.path,
  category: a.category,
  reporter: a.reporter,
  status: a.status,
  type: a.type,
  method: a.method,
  story: a.story,
});
