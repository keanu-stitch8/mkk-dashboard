import { describe, expect, it } from "vitest";
import { categoryLabel, isKnownCategory, newsFormat, platformLabels, socialFormatKey, socialFormatLabel, youtubeFormat } from "../src/lib/taxonomy";

describe("kategori", () => {
  it("semua kategori News (Indonesia) di data → label EN taksonomi", () => {
    const map = {
      Akomodasi: "Accommodation",
      Arena: "Arena",
      Atlet: "Profile",
      Atraksi: "Attraction",
      Kegiatan: "Event",
      Kesehatan: "Health",
      Komunitas: "Community & Club",
      Kuliner: "Culinary",
      Olahraga: "Sports",
      Pelatih: "Profile",
      Perlengkapan: "Sport Gears",
      Profil: "Profile",
      "Tentang Kudus": "About Kudus",
      UMKM: "UMKM",
    };
    for (const [raw, label] of Object.entries(map)) expect(categoryLabel(raw)).toBe(label);
  });

  it("kategori YouTube: Venue = Arena, Club & Community = Community & Club, Hero bukan kategori", () => {
    expect(categoryLabel("Venue")).toBe("Arena");
    expect(categoryLabel("Club")).toBe("Community & Club");
    expect(categoryLabel("Community")).toBe("Community & Club");
    expect(categoryLabel("Sport Gears")).toBe("Sport Gears");
    expect(categoryLabel("Hero")).toBeNull();
  });

  it("kosong → null; tak dikenal → apa adanya (tetap terlihat)", () => {
    expect(categoryLabel("  ")).toBeNull();
    expect(categoryLabel(null)).toBeNull();
    expect(categoryLabel(" Baru ")).toBe("Baru");
    expect(isKnownCategory("Baru")).toBe(false);
    expect(isKnownCategory("Culinary")).toBe(true);
  });
});

describe("format", () => {
  it("News", () => {
    expect(newsFormat("hard news")).toBe("Hard News");
    expect(newsFormat("Features")).toBe("Features");
    expect(newsFormat(null)).toBeNull();
  });

  it("YouTube: recap → Event Recap, Teaser / kategori Hero → Hero Video, sisanya Editorial Feature Video", () => {
    expect(youtubeFormat("Recap", "Event", true)).toBe("Event Recap");
    expect(youtubeFormat("Teaser", "Hero", false)).toBe("Hero Video");
    expect(youtubeFormat(null, "Hero", false)).toBe("Hero Video");
    expect(youtubeFormat("Editorial Feature Video", "Profile", false)).toBe("Editorial Feature Video");
  });

  it("sosmed: label singular, carousel & foto = Feed", () => {
    expect(["feeds", "carousel", "photo", "reels", "story", "video"].map(socialFormatLabel)).toEqual(["Feed", "Feed", "Feed", "Reel", "Story", "Video"]);
    expect(socialFormatKey("carousel")).toBe("feeds");
    expect(socialFormatKey("Reels")).toBe("reels");
  });
});

describe("platform", () => {
  it("urutan tetap & label", () => {
    expect(platformLabels("instagram,tiktok,facebook,youtube,threads")).toEqual(["Instagram", "Facebook", "TikTok", "Threads", "YouTube"]);
    expect(platformLabels("")).toEqual([]);
  });
});
