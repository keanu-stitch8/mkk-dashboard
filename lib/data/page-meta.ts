// og:image halaman artikel (thumbnail Publishing Log News), di-cache per URL di tabel PageMeta supaya
// website tidak diambil ulang tiap kali halaman dibuka. Hanya URL yang belum pernah dicek yang di-fetch.
import { prisma } from "../db";

/** Halaman tanpa og:image dicek ulang setelah 7 hari (mungkin gambar baru ditambahkan). */
const RECHECK_MISSING_MS = 7 * 86400_000;
const CONCURRENCY = 6;
const TIMEOUT_MS = 8000;

/** og:image dari HTML (fallback og:image:url / twitter:image), dijadikan URL absolut terhadap `base`. */
export function extractOgImage(html: string, base: string): string | null {
  const metas = html.match(/<meta\b[^>]*>/gi) ?? [];
  const find = (key: string) => {
    const keyRe = new RegExp(`\\b(?:property|name)\\s*=\\s*["']${key}["']`, "i");
    for (const m of metas) {
      if (!keyRe.test(m)) continue;
      const content = m.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1]?.trim();
      if (content) return content;
    }
    return null;
  };
  const raw = find("og:image") ?? find("og:image:url") ?? find("twitter:image");
  if (!raw) return null;
  try {
    return new URL(raw.replace(/&amp;/g, "&"), base).toString();
  } catch {
    return null;
  }
}

async function fetchOgImage(url: string): Promise<string | null> {
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "user-agent": "MKK-Dashboard/1.0 (og:image)" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return extractOgImage(await res.text(), res.url);
}

/**
 * og:image per URL. Dari cache PageMeta; URL baru (atau tanpa og:image >7 hari) diambil dari web lalu disimpan.
 * Gagal jaringan/HTTP tidak disimpan → dicoba lagi saat halaman dibuka berikutnya.
 */
export async function ogImages(urls: string[]): Promise<Map<string, string | null>> {
  const unique = [...new Set(urls)];
  const cached = new Map((await prisma.pageMeta.findMany({ where: { url: { in: unique } } })).map((c) => [c.url, c]));
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
          ogImage = await fetchOgImage(url);
        } catch {
          return;
        }
        out.set(url, ogImage);
        await prisma.pageMeta.upsert({ where: { url }, create: { url, ogImage }, update: { ogImage, fetchedAt: new Date() } });
      }),
    );
  }
  return out;
}
