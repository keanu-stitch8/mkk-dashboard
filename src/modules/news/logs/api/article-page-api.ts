import "server-only";

const TIMEOUT_MS = 8000;

/** HTML halaman artikel + URL akhir setelah redirect. Error HTTP/jaringan dilempar. */
export async function fetchArticleHtml(url: string): Promise<{ html: string; finalUrl: string }> {
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "user-agent": "MKK-Dashboard/1.0 (og:image)" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { html: await res.text(), finalUrl: res.url };
}
