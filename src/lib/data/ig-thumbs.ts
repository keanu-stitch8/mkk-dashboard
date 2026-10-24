// Thumbnail post Instagram untuk Publishing Log Sosmed. URL gambar CDN Instagram (media_url / thumbnail_url)
// kedaluwarsa dalam hitungan hari, jadi gambar diunduh sekali lewat Graph API, disimpan di
// storage/ig-thumbs/{mediaId}.jpg (diperkecil ke lebar 320px, rasio asli), lalu disajikan lewat /api/thumbs/ig/{mediaId}.
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { graphGet } from "../connectors/meta/graph";

export const IG_THUMB_DIR = path.join(process.cwd(), "storage", "ig-thumbs");
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
/** Lebar simpan: ±3× lebar tampil (w-24 = 96px) supaya tajam di layar retina, ukuran file ±20–40 KB. */
const THUMB_WIDTH = 320;
/** Media tanpa gambar (mis. carousel diawali video) ditandai `.none` dan dicek ulang setelah 7 hari. */
const RECHECK_MISSING_MS = 7 * 86400_000;
const CONCURRENCY = 4;

/** ID media IG = angka; juga mencegah path traversal di route. */
export const isMediaId = (id: string) => /^\d{5,30}$/.test(id);

const exists = (file: string) => stat(file).then((s) => s, () => null);

const thumbFile = (id: string) => path.join(IG_THUMB_DIR, `${id}.jpg`);

/** File thumbnail tersimpan untuk satu media, atau null. */
export async function findIgThumb(id: string): Promise<{ file: string; contentType: string } | null> {
  if (!isMediaId(id)) return null;
  const file = thumbFile(id);
  return (await exists(file)) ? { file, contentType: "image/jpeg" } : null;
}

/** Perkecil ke lebar THUMB_WIDTH (rasio asli, tidak diperbesar) → JPEG. */
export const shrinkThumb = (input: Buffer) =>
  sharp(input).rotate().resize({ width: THUMB_WIDTH, withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();

/** Unduh gambar satu media. true = tersimpan, false = media tidak punya gambar. Error jaringan/API dilempar. */
async function download(id: string, token: string): Promise<boolean> {
  const m = await graphGet<{ media_type?: string; media_url?: string; thumbnail_url?: string }>(`/${id}`, token, { fields: "media_type,media_url,thumbnail_url" });
  // video/reels: media_url = file video → pakai thumbnail_url; foto/carousel: media_url = gambar
  const src = m.media_type === "VIDEO" ? m.thumbnail_url : (m.thumbnail_url ?? m.media_url);
  if (!src) return false;
  const res = await fetch(src, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!IMAGE_TYPES.has((res.headers.get("content-type") ?? "").split(";")[0].trim())) return false;
  await writeFile(thumbFile(id), await shrinkThumb(Buffer.from(await res.arrayBuffer())));
  return true;
}

/**
 * URL thumbnail (/api/thumbs/ig/{id}) per media IG. Yang belum tersimpan diunduh via Graph API (token Meta dari env);
 * gagal jaringan/API tidak ditandai → dicoba lagi saat halaman dibuka berikutnya.
 */
export async function igThumbs(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const url = (id: string) => `/api/thumbs/ig/${id}`;
  await mkdir(IG_THUMB_DIR, { recursive: true });
  const todo: string[] = [];
  for (const id of new Set(ids.filter(isMediaId))) {
    if (await findIgThumb(id)) out.set(id, url(id));
    else {
      const none = await exists(path.join(IG_THUMB_DIR, `${id}.none`));
      if (!none || Date.now() - none.mtimeMs > RECHECK_MISSING_MS) todo.push(id);
    }
  }
  const token = process.env.META_ACCESS_TOKEN?.trim();
  if (!token) return out;
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    await Promise.all(
      todo.slice(i, i + CONCURRENCY).map(async (id) => {
        try {
          if (await download(id, token)) out.set(id, url(id));
          else await writeFile(path.join(IG_THUMB_DIR, `${id}.none`), "");
        } catch {
          // dicoba lagi lain kali
        }
      }),
    );
  }
  return out;
}
