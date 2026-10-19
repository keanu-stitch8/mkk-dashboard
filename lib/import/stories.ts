// Simpan Story IG (tabel IgStory) dari import CSV maupun API. Upsert per ID media, bukan replace per bulan:
// export Business Suite memakai Pacific Time, jadi Story di tepi bulan bisa ada di file bulan sebelah.
import type { PrismaClient } from "@prisma/client";

export interface IgStoryRow {
  storyId: string;
  date: string;
  publishedAt: string;
  permalink: string | null;
  durationSec: number | null;
  views: number | null;
  reach: number | null;
  linkClicks: number | null;
  source: "api" | "csv";
}

/** Nilai kosong tidak menimpa nilai yang sudah ada (mis. link clicks dari CSV tidak hilang saat API mengisi ulang). */
export async function upsertIgStories(prisma: Pick<PrismaClient, "igStory">, rows: IgStoryRow[]): Promise<number> {
  for (const r of rows) {
    const data = { ...r, month: r.date.slice(0, 7) };
    const update = Object.fromEntries(Object.entries(data).filter(([, v]) => v != null));
    await prisma.igStory.upsert({ where: { storyId: r.storyId }, create: data, update });
  }
  return rows.length;
}
