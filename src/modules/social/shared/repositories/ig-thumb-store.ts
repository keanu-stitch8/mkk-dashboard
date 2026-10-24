import "server-only";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/** Thumbnail IG tersimpan di storage/ig-thumbs/{mediaId}.jpg; `.none` = media tanpa gambar (dicek ulang nanti). */
export const IG_THUMB_DIR = path.join(process.cwd(), "storage", "ig-thumbs");

const exists = (file: string) => stat(file).then((s) => s, () => null);

export const thumbFile = (id: string) => path.join(IG_THUMB_DIR, `${id}.jpg`);

export const ensureThumbDir = () => mkdir(IG_THUMB_DIR, { recursive: true });

export const thumbExists = async (id: string) => !!(await exists(thumbFile(id)));

/** waktu penanda "tanpa gambar" (ms), atau null */
export const missingMarkerTime = async (id: string) => (await exists(path.join(IG_THUMB_DIR, `${id}.none`)))?.mtimeMs ?? null;

export const saveThumb = (id: string, jpeg: Buffer) => writeFile(thumbFile(id), jpeg);

export const markMissing = (id: string) => writeFile(path.join(IG_THUMB_DIR, `${id}.none`), "");
