// DELETE /api/imports?id=... — hapus satu import beserta datanya.
import { removeImport } from "@/modules/import/history/services/import-history-service";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id wajib diisi" }, { status: 400 });
  await removeImport(id);
  return Response.json({ ok: true });
}
