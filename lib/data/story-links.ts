// Story IG tidak punya caption, jadi tidak bisa dipasangkan ke story IG tertentu. Story "Featured News" = repost
// artikel News dengan judul dipendekkan/diparafrase → dicocokkan ke artikel lewat aturan kata yang ketat.

const STOPWORDS = new Set(["yang", "dari", "dengan", "untuk", "dalam", "pada", "juga", "lebih", "para", "atau", "akan", "antar", "demi", "tidak", "bisa", "jadi", "kudus"]);
/** Jendela: artikel tayang paling lama 60 hari sebelum story (toleransi 1 hari setelahnya). */
const MAX_DAYS_BEFORE = 60;

const words = (s: string) => [
  ...new Set(
    s
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w)),
  ),
];
/** Kata sama, atau satu memuat yang lain dengan panjang ≥5 (mis. "dulang" ⊂ "mendulang", "runner" ⊂ "runners"). */
const sameWord = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 5 && (a.includes(b) || b.includes(a)));
const daysBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 86400_000;

/**
 * Artikel untuk satu story: ≥60% kata judul story ada di judul artikel DAN (≥3 kata cocok, atau 100% dari ≥2 kata),
 * artikel tayang ≤60 hari sebelum story, dan kandidat terbaik harus tunggal (skor seri → tidak di-link).
 */
export function matchStoryArticle<A extends { title: string; date: string | null }>(story: { title: string | null; date: string | null }, articles: A[]): A | null {
  if (!story.title || !story.date) return null;
  const sw = words(story.title);
  if (sw.length < 2) return null;
  const scored = articles
    .filter((a) => a.date && daysBetween(a.date, story.date!) >= -1 && daysBetween(a.date, story.date!) <= MAX_DAYS_BEFORE)
    .map((a) => {
      const aw = words(a.title);
      const n = sw.filter((w) => aw.some((x) => sameWord(w, x))).length;
      return { a, n, score: n / sw.length };
    })
    .sort((x, y) => y.score - x.score || y.n - x.n);
  const [best, second] = scored;
  if (!best || best.score < 0.6 || !(best.n >= 3 || best.score === 1)) return null;
  if (second && second.score === best.score) return null;
  return best.a;
}
