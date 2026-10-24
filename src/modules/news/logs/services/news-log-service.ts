import "server-only";
import { toNewsArticleEntry } from "../../shared/mappers/news-mapper";
import { findNewsArticles } from "../../shared/repositories/news-repository";
import { buildNewsLogs } from "../lib/news-log-rows";
import type { NewsLogs } from "../types/news-log";
import { ogImages } from "./og-image-service";

export async function getNewsLogs(month: string): Promise<NewsLogs> {
  const articles = (await findNewsArticles(month)).map(toNewsArticleEntry);
  // thumbnail = og:image halaman artikel (1024×576 di mainkekudus.com), di-cache per URL
  const thumbs = articles.length ? await ogImages(articles.flatMap((a) => (a.url ? [a.url] : []))) : new Map<string, string | null>();
  return buildNewsLogs(articles, thumbs);
}
