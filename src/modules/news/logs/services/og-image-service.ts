import "server-only";
import { fetchArticleHtml } from "../api/article-page-api";
import { extractOgImage } from "../lib/og-image";
import { findPageMeta, savePageMeta } from "../repositories/page-meta-repository";

/** Halaman tanpa og:image dicek ulang setelah 7 hari (mungkin gambar baru ditambahkan). */
const RECHECK_MISSING_MS = 7 * 86400_000;
const CONCURRENCY = 6;

/**
 * og:image per URL artikel, di-cache di tabel PageMeta supaya website tidak diambil ulang tiap kali halaman dibuka.
 * URL baru (atau tanpa og:image >7 hari) diambil dari web lalu disimpan; gagal jaringan/HTTP tidak disimpan →
 * dicoba lagi saat halaman dibuka berikutnya.
 */
export async function ogImages(urls: string[]): Promise<Map<string, string | null>> {
  const unique = [...new Set(urls)];
  const cached = new Map((await findPageMeta(unique)).map((c) => [c.url, c]));
  const out = new Map<string, string | null>([...cached].map(([u, c]) => [u, c.ogImage]));
  const todo = unique.filter((u) => {
    const c = cached.get(u);
    return !c || (!c.ogImage && Date.now() - c.fetchedAt.getTime() > RECHECK_MISSING_MS);
  });
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    await Promise.all(
      todo.slice(i, i + CONCURRENCY).map(async (url) => {
        let ogImage: string | null;
        try {
          const page = await fetchArticleHtml(url);
          ogImage = extractOgImage(page.html, page.finalUrl);
        } catch {
          return;
        }
        out.set(url, ogImage);
        await savePageMeta(url, ogImage);
      }),
    );
  }
  return out;
}
