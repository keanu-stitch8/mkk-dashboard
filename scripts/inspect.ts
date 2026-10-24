// Debug: npx tsx scripts/inspect.ts <file...>  → ringkasan hasil parsing
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseFiles, rowCount } from "../src/lib/parsers";

const files = process.argv.slice(2).map((p) => ({ name: p.includes("Content 20") ? p.split("/").slice(-2).join("/") : basename(p), data: new Uint8Array(readFileSync(p)) }));
const res = parseFiles(files);
for (const d of res.datasets) {
  console.log(`\n[${d.key}] ${d.file}${d.sheet ? " · " + d.sheet : ""} month=${d.month} rows=${rowCount(d)}`);
  console.log("  cols:", d.columns.map((c) => `${c.field}←${c.header}`).join(" | "));
  if (d.unmatched.length) console.log("  unmatched:", d.unmatched.join(" | "));
  if (d.metrics.length) console.log("  metrics:", d.metrics.map((m) => `${m.key}=${m.value}`).join(", "));
  if (d.rows[0]) console.log("  row0:", JSON.stringify(d.rows[0]).slice(0, 400));
  if (d.breakdowns[0]) console.log("  bd0:", JSON.stringify(d.breakdowns[0]));
  d.warnings.forEach((w) => console.log("  ⚠", w));
}
res.skipped.forEach((s) => console.log(`skip: ${s.file} ${s.sheet ?? ""} — ${s.reason}`));
res.errors.forEach((e) => console.log("ERR:", e));
