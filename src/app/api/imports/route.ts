// DELETE /api/imports?id=... — hapus satu import beserta datanya.
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id wajib diisi" }, { status: 400 });
  await prisma.import.delete({ where: { id } }).catch(() => null);
  return Response.json({ ok: true });
}
