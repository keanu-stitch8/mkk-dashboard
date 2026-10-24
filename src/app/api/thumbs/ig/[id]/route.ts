// GET /api/thumbs/ig/{mediaId} — thumbnail post Instagram yang sudah diunduh (lib/data/ig-thumbs.ts).
import { readFile } from "node:fs/promises";
import { findIgThumb } from "@/lib/data/ig-thumbs";

export async function GET(_req: Request, ctx: RouteContext<"/api/thumbs/ig/[id]">) {
  const { id } = await ctx.params;
  const thumb = await findIgThumb(id);
  if (!thumb) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(await readFile(thumb.file)), {
    // file per media tidak berubah setelah diunduh
    headers: { "content-type": thumb.contentType, "cache-control": "private, max-age=604800, immutable" },
  });
}
