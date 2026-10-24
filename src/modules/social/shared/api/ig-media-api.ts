import "server-only";
import { graphGet } from "@/modules/connectors/sources/meta/graph";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** URL gambar satu media IG (null = media tanpa gambar, mis. carousel diawali video). */
export async function fetchIgMediaImageUrl(id: string, token: string): Promise<string | null> {
  const m = await graphGet<{ media_type?: string; media_url?: string; thumbnail_url?: string }>(`/${id}`, token, { fields: "media_type,media_url,thumbnail_url" });
  // video/reels: media_url = file video → pakai thumbnail_url; foto/carousel: media_url = gambar
  return (m.media_type === "VIDEO" ? m.thumbnail_url : (m.thumbnail_url ?? m.media_url)) ?? null;
}

/** Unduh gambar CDN Instagram (URL kedaluwarsa dalam hitungan hari). null = bukan gambar. Error HTTP dilempar. */
export async function downloadImage(src: string): Promise<Buffer | null> {
  const res = await fetch(src, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!IMAGE_TYPES.has((res.headers.get("content-type") ?? "").split(";")[0].trim())) return null;
  return Buffer.from(await res.arrayBuffer());
}
