// Enkripsi AES-256-GCM untuk kredensial connector yang disimpan di DB (mis. refresh token YouTube).
// ENCRYPTION_KEY: 32 byte dalam base64 atau hex. Buat dengan: openssl rand -base64 32
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("ENCRYPTION_KEY belum diisi di .env.local (buat dengan: openssl rand -base64 32).");
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("ENCRYPTION_KEY harus 32 byte (base64 44 karakter atau hex 64 karakter).");
  return buf;
}

/** Hasil: "v1.<iv>.<authTag>.<ciphertext>" (base64url). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function decrypt(payload: string): string {
  const [v, iv, tag, data] = payload.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Format kredensial terenkripsi tidak dikenali.");
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  try {
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Kredensial tidak bisa didekripsi — ENCRYPTION_KEY berubah? Hubungkan ulang connector.");
  }
}
