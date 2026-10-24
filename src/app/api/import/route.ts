// POST /api/import — multipart: files[], group, month, action=preview|commit, keys (opsional, dipisah koma)
import { prisma } from "@/lib/db";
import { applyMonth, parseFiles, rowCount, suggestedMonth, type InputFile, type SourceGroup } from "@/lib/parsers";
import { commitDataset } from "@/lib/import/commit";
import { DATASETS } from "@/lib/sources";
import { isMonth } from "@/lib/month";

export const dynamic = "force-dynamic";

const GROUPS: SourceGroup[] = ["auto", "ga4", "gsc", "youtube", "meta", "news", "social_log"];

function preview(v: unknown): unknown {
  return typeof v === "string" && v.length > 80 ? v.slice(0, 79) + "…" : v;
}

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

  const parsed = parseFiles(files, group);
  const month = isMonth(monthRaw) ? monthRaw : suggestedMonth(parsed);

  if (action === "commit") {
    if (!month) return Response.json({ error: "Select a month (YYYY-MM)." }, { status: 400 });
    const keys = String(form.get("keys") ?? "")
      .split(",")
      .filter(Boolean);
    const selected = parsed.datasets.filter((d) => !keys.length || keys.includes(d.key));
    if (!selected.length) return Response.json({ error: "No datasets to save." }, { status: 400 });
    const results = [];
    for (const ds of selected) results.push({ ...(await commitDataset(prisma, ds, month)), label: DATASETS[ds.key].label });
    return Response.json({ month, results });
  }

  const existing = month ? await prisma.import.findMany({ where: { month }, select: { source: true, fileName: true, createdAt: true } }) : [];
  return Response.json({
    month,
    suggestedMonth: suggestedMonth(parsed),
    datasets: parsed.datasets.map((raw) => {
      const ds = month ? applyMonth(raw, month) : raw;
      const old = existing.find((e) => e.source === ds.key);
      return {
        key: ds.key,
        label: DATASETS[ds.key].label,
        file: ds.file,
        sheet: ds.sheet ?? null,
        detectedMonth: raw.month,
        rowCount: rowCount(ds),
        totalRows: rowCount(raw),
        columns: ds.columns,
        unmatched: ds.unmatched,
        warnings: ds.warnings,
        metrics: ds.metrics,
        sample: ds.rows.slice(0, 5).map((r) => {
          const { _date, ...rest } = r;
          void _date;
          return Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, preview(v)]));
        }),
        replaces: old ? { fileName: old.fileName, createdAt: old.createdAt } : null,
      };
    }),
    skipped: parsed.skipped,
    errors: parsed.errors,
  });
}
