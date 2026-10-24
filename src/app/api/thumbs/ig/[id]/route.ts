// GET /api/thumbs/ig/{mediaId} — thumbnail post Instagram yang sudah diunduh (modules/social/shared/services/ig-thumb-service.ts).
import { readFile } from "node:fs/promises";
import { findIgThumb } from "@/modules/social/shared/services/ig-thumb-service";

export async function GET(_req: Request, ctx: RouteContext<"/api/thumbs/ig/[id]">) {
  const { id } = await ctx.params;
  const thumb = await findIgThumb(id);
  if (!thumb) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(await readFile(thumb.file)), {
    // file per media tidak berubah setelah diunduh
    headers: { "content-type": thumb.contentType, "cache-control": "private, max-age=604800, immutable" },
  });
}
