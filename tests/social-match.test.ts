import { describe, expect, it } from "vitest";
import { matchLogsToPosts, reconcileSocial } from "../lib/data/summary";

const post = (id: string, permalink: string, format = "reels", caption = "") => ({ id, date: "2026-07-18", platform: "instagram", format, caption, permalink });
const log = (id: string, url: string | null, format = "reels", title: string | null = url) => ({
  id,
  date: "2026-07-18",
  platform: "instagram,facebook",
  format,
  status: "publish",
  title,
  url,
  category: null,
});

describe("matchLogsToPosts", () => {
  it("mencocokkan URL log /p/ dengan permalink Reels /reel/ lewat shortcode", () => {
    const posts = [post("a", "https://www.instagram.com/reel/Da7IBtxtREZ/", "reels", "Mimpi Itu Terus Bertumbuh"), post("b", "https://www.instagram.com/reel/Da76_c9M0tr/", "reels", "Eks Stasiun Wergu")];
    const m = matchLogsToPosts(posts, [log("L1", "https://www.instagram.com/p/Da76_c9M0tr/")]);
    expect(m.get("b")?.id).toBe("L1");
    expect(m.has("a")).toBe(false);
  });

  it("mengabaikan newline dan ?img_index di URL log", () => {
    const m = matchLogsToPosts([post("a", "https://www.instagram.com/p/Da72E21FLsg/", "carousel")], [log("L1", "https://www.instagram.com/p/Da72E21FLsg/\n?img_index=1", "feeds")]);
    expect(m.get("a")?.id).toBe("L1");
  });

  it("memaksimalkan jumlah pasangan: satu kata sama tidak boleh membuat dua pasangan lain hilang", () => {
    const p09 = { ...post("p09", "https://www.instagram.com/reel/A1/", "reels", "Banyak yang datang sebagai pendukung"), date: "2026-07-09" };
    const p12 = { ...post("p12", "https://www.instagram.com/reel/B2/", "reels", "Di sela jadwal pertandingan, para atlet membuat kenangan di museum"), date: "2026-07-12" };
    const l09 = { ...log("L09", null, "reels", "Ketika Olahraga Membuat Jatuh Cinta"), date: "2026-07-09" };
    const l12 = { ...log("L12", null, "reels", "Wisata Kudus"), date: "2026-07-12" };
    const m = matchLogsToPosts([p09, p12], [l09, l12]);
    expect(m.get("p09")?.id).toBe("L09");
    expect(m.get("p12")?.id).toBe("L12");
  });

  it("shortcode peka huruf besar/kecil", () => {
    const m = matchLogsToPosts([post("a", "https://www.instagram.com/reel/AbCd/")], [log("L1", "https://www.instagram.com/p/abcd/", "reels", "lain")]);
    expect(m.size).toBe(1); // tetap cocok lewat tanggal sama, bukan lewat URL
    const m2 = matchLogsToPosts([post("a", "https://www.instagram.com/reel/AbCd/"), post("b", "https://www.instagram.com/reel/abcd/")], [log("L1", "https://www.instagram.com/p/abcd/", "reels", "lain")]);
    expect(m2.get("b")?.id).toBe("L1");
  });
});

describe("reconcileSocial", () => {
  it("mendeteksi format salah di log, kembar, konten non-IG & Video yang tayang sebagai Reels", () => {
    const posts = [
      post("reel", "https://www.instagram.com/reel/R1/", "reels", "Mimpi Itu Terus Bertumbuh. Setiap atlet"),
      post("vid", "https://www.instagram.com/reel/V1/", "reels", "Recap turnamen"),
      { ...post("extra", "https://www.instagram.com/p/X1/", "carousel", "Tidak ada di log"), date: "2026-07-25" },
    ];
    const logs = [
      log("Lfeeds", null, "feeds", "Mimpi Itu Terus Bertumbuh"),
      log("Lvid", "https://www.instagram.com/p/V1/", "video", "SMC Recap"),
      { ...log("Ltt1", null, "reels", "Highlight Day 5"), platform: "tiktok" },
      { ...log("Ltt2", null, "reels", "Highlight Day 5"), platform: "tiktok" },
      { ...log("Lgone", null, "feeds", "Sudah dihapus"), date: "2026-07-10" },
      { ...log("Lstory", null, "story", "Story"), platform: "instagram" },
    ];
    const r = reconcileSocial(posts, logs, matchLogsToPosts(posts, logs));
    expect(r.formatMismatch.map((x) => [x.log.id, x.post.id])).toEqual([["Lfeeds", "reel"]]);
    expect(r.videoAsReels.map((x) => x.log.id)).toEqual(["Lvid"]);
    expect(r.notInLog.map((p) => p.id)).toEqual(["extra"]);
    expect(r.logNotOnIg.map((l) => l.id)).toEqual(["Lgone"]);
    expect(r.offInstagram.map((l) => l.id)).toEqual(["Ltt1", "Ltt2"]);
    expect(r.duplicates.map((g) => g.length)).toEqual([2]);
    expect(r.byFormat).toEqual([
      { format: "reels", log: 1, api: 2, diff: 1, detail: [{ format: "video", count: 1 }] },
      { format: "feeds", log: 2, api: 1, diff: -1, detail: [{ format: "feeds", count: 2 }] },
    ]);
  });
});
