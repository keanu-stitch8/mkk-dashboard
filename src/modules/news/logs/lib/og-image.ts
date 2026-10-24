// og:image dari HTML halaman artikel (thumbnail Publishing Log News). Murni, tanpa jaringan.

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
