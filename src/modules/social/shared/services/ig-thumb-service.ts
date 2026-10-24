import "server-only";
import sharp from "sharp";
import { downloadImage, fetchIgMediaImageUrl } from "../api/ig-media-api";
import { isMediaId } from "../lib/ig-media-id";
import { ensureThumbDir, markMissing, missingMarkerTime, saveThumb, thumbExists, thumbFile } from "../repositories/ig-thumb-store";

/** Lebar simpan: ±3× lebar tampil (w-24 = 96px) supaya tajam di layar retina, ukuran file ±20–40 KB. */
const THUMB_WIDTH = 320;
/** Media tanpa gambar ditandai `.none` dan dicek ulang setelah 7 hari. */
const RECHECK_MISSING_MS = 7 * 86400_000;
const CONCURRENCY = 4;

/** Perkecil ke lebar THUMB_WIDTH (rasio asli, tidak diperbesar) → JPEG. */
export const shrinkThumb = (input: Buffer) =>
  sharp(input).rotate().resize({ width: THUMB_WIDTH, withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();

/** File thumbnail tersimpan untuk satu media, atau null (route /api/thumbs/ig/{id}). */
export async function findIgThumb(id: string): Promise<{ file: string; contentType: string } | null> {
  if (!isMediaId(id)) return null;
  return (await thumbExists(id)) ? { file: thumbFile(id), contentType: "image/jpeg" } : null;
}

/** true = tersimpan, false = media tidak punya gambar. Error jaringan/API dilempar. */
async function download(id: string, token: string): Promise<boolean> {
  const src = await fetchIgMediaImageUrl(id, token);
  if (!src) return false;
  const image = await downloadImage(src);
  if (!image) return false;
  await saveThumb(id, await shrinkThumb(image));
  return true;
}

/**
 * URL thumbnail (/api/thumbs/ig/{id}) per media IG. URL gambar CDN Instagram kedaluwarsa dalam hitungan hari, jadi
 * gambar diunduh sekali lewat Graph API (token Meta dari env) dan disimpan lokal; gagal jaringan/API tidak ditandai →
 * dicoba lagi saat halaman dibuka berikutnya.
 */
export async function igThumbs(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const url = (id: string) => `/api/thumbs/ig/${id}`;
  await ensureThumbDir();
  const todo: string[] = [];
  for (const id of new Set(ids.filter(isMediaId))) {
    if (await thumbExists(id)) out.set(id, url(id));
    else {
      const none = await missingMarkerTime(id);
      if (none == null || Date.now() - none > RECHECK_MISSING_MS) todo.push(id);
    }
  }
  const token = process.env.META_ACCESS_TOKEN?.trim();
  if (!token) return out;
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    await Promise.all(
      todo.slice(i, i + CONCURRENCY).map(async (id) => {
        try {
          if (await download(id, token)) out.set(id, url(id));
          else await markMissing(id);
        } catch {
          // dicoba lagi lain kali
        }
      }),
    );
  }
  return out;
}
