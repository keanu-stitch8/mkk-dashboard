import { describe, expect, it } from "vitest";
import { extractOgImage } from "../src/lib/data/page-meta";

describe("extractOgImage", () => {
  const base = "https://mainkekudus.com/news/x";
  it("og:image (property atau name, urutan atribut bebas)", () => {
    expect(extractOgImage('<meta property="og:image" content="https://cdn.x/a-1024x576.jpg"/>', base)).toBe("https://cdn.x/a-1024x576.jpg");
    expect(extractOgImage("<meta content='https://cdn.x/b.jpg' name='og:image'>", base)).toBe("https://cdn.x/b.jpg");
  });
  it("fallback twitter:image, URL relatif dijadikan absolut, &amp; di-decode", () => {
    expect(extractOgImage('<meta name="twitter:image" content="/img/c.jpg?a=1&amp;b=2">', base)).toBe("https://mainkekudus.com/img/c.jpg?a=1&b=2");
  });
  it("tanpa og:image → null", () => {
    expect(extractOgImage('<meta property="og:title" content="Judul">', base)).toBeNull();
  });
});
