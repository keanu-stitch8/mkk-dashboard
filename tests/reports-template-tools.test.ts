import { describe, expect, it } from "vitest";
import { estimateRowPx } from "../src/modules/report/pipeline/engine/template-tools";

describe("estimateRowPx", () => {
  it("satu baris untuk teks pendek", () => {
    expect(estimateRowPx([{ text: "Kudus", widthPx: 200, fontPt: 10 }])).toBe(17);
  });
  it("URL panjang di kolom sempit dibungkus di / dan -", () => {
    const url = "https://mainkekudus.com/news/lapangan-tenis-indoor-disulap-jadi-tempat-nobar-fifa-asean-cup";
    const px = estimateRowPx([{ text: url, widthPx: 230, fontPt: 10 }]);
    expect(px).toBeGreaterThanOrEqual(3 * 15);
  });
  it("sel tertinggi menentukan", () => {
    const one = estimateRowPx([{ text: "a b", widthPx: 300, fontPt: 10 }]);
    const two = estimateRowPx([{ text: "a b", widthPx: 300, fontPt: 10 }, { text: "x ".repeat(60), widthPx: 300, fontPt: 10 }]);
    expect(two).toBeGreaterThan(one);
  });
});
