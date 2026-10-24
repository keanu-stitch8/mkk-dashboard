// POST /api/import — multipart: files[], group, month, action=preview|commit, keys (opsional, dipisah koma)
import type { InputFile, SourceGroup } from "@/modules/import/parsers";
import { commitUpload, previewUpload } from "@/modules/import/data/services/upload-service";

export const dynamic = "force-dynamic";

const GROUPS: SourceGroup[] = ["auto", "ga4", "gsc", "youtube", "meta", "news", "social_log"];

export async function POST(req: Request) {
  const form = await req.formData();
  const action = String(form.get("action") ?? "preview");
  const groupRaw = String(form.get("group") ?? "auto") as SourceGroup;
  const group = GROUPS.includes(groupRaw) ? groupRaw : "auto";
  const monthRaw = String(form.get("month") ?? "");

  const files: InputFile[] = [];
  for (const entry of form.getAll("files")) {
    if (typeof entry === "string") continue;
    files.push({ name: entry.name, data: new Uint8Array(await entry.arrayBuffer()) });
  }
  if (!files.length) return Response.json({ error: "Select at least one file." }, { status: 400 });

  if (action === "commit") {
    const keys = String(form.get("keys") ?? "")
      .split(",")
      .filter(Boolean);
    const res = await commitUpload(files, group, monthRaw, keys);
    return "error" in res ? Response.json({ error: res.error }, { status: 400 }) : Response.json(res);
  }
  return Response.json(await previewUpload(files, group, monthRaw));
}
