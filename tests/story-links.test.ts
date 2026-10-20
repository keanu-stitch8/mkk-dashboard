import { describe, expect, it } from "vitest";
import { matchStoryArticle } from "../lib/data/story-links";

const arts = [
  { title: "Roda Pembinaan Tinju di Kudus Tak Pernah Libur, Demi Terus Mendulang Prestasi", date: "2026-09-25" },
  { title: "Anak Kuli Angkut dan Buruh Pabrik Rokok Sabet Emas Tinju Antar Pelajar Daerah", date: "2026-09-20" },
  { title: "Ruang Publik di Kudus Disulap Bernuansa Sepak Bola Selama Berlangsung Caffino Srikandi Merdeka Cup", date: "2026-08-14" },
  { title: "Warisan Caffino Srikandi Merdeka Cup untuk Kudus dan Sepak Bola Putri Indonesia", date: "2026-08-14" },
];

describe("matchStoryArticle", () => {
  it("judul story dipendekkan/parafrase → artikel yang benar", () => {
    expect(matchStoryArticle({ title: "Pembinaan Tinju di Kudus Terus Dulang Prestasi", date: "2026-10-02" }, arts)?.title).toBe(arts[0].title);
    expect(matchStoryArticle({ title: "Anak Kuli Angkut & Buruh Pabrik Rokok Sabet Emas Tinju", date: "2026-10-02" }, arts)?.title).toBe(arts[1].title);
  });

  it("skor seri antar artikel → tidak di-link", () => {
    expect(matchStoryArticle({ title: "Srikandi Merdeka Cup 2026 1", date: "2026-08-17" }, arts)).toBeNull();
  });

  it("kata cocok terlalu sedikit, atau artikel di luar jendela 60 hari → tidak di-link", () => {
    expect(matchStoryArticle({ title: "Tinju Kudus", date: "2026-10-02" }, arts)).toBeNull();
    expect(matchStoryArticle({ title: "Pembinaan Tinju di Kudus Terus Dulang Prestasi", date: "2026-12-30" }, arts)).toBeNull();
  });
});
