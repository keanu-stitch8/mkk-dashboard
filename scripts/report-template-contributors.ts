// npx tsx --conditions=react-server scripts/report-template-contributors.ts --from=<current YouTube master ID>
// Makes a new master. The reference and contributor source tracker are read only.
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const from = process.argv.find((a) => a.startsWith("--from="))?.slice(7);
  if (!from) throw new Error("--from=<current YouTube master ID> is required");
  const { reportClients, copyFile, readGrids } = await import("../src/modules/report/pipeline/engine/sheets");
  const { contributorTemplatePlan } = await import("../src/modules/report/pipeline/engine/contributor-template");
  const { planFill } = await import("../src/modules/report/pipeline/engine/tokens");
  const { buildContributorReport } = await import("../src/modules/report/pipeline/channels/contributors");
  const c = await reportClients();
  const source = await c.sheets.spreadsheets.get({ spreadsheetId: from, fields: "sheets(properties,charts(chartId))" });
  const plan = contributorTemplatePlan(source.data.sheets ?? []);
  const file = await copyFile(c, from, "TEMPLATE – MKK Local Contributor Monthly Performance Report");
  console.log(`Created ${file.url}`);
  await c.sheets.spreadsheets.batchUpdate({ spreadsheetId: file.id, requestBody: { requests: plan.requests } });
  await c.sheets.spreadsheets.values.batchUpdate({ spreadsheetId: file.id, requestBody: { valueInputOption: "RAW", data: plan.data } });
  await c.sheets.spreadsheets.batchUpdate({ spreadsheetId: file.id, requestBody: { requests: plan.formats } });
  const month = process.argv.find((a) => a.startsWith("--check-month="))?.slice(14);
  if (month) {
    const fill = planFill(await readGrids(c, file.id), await buildContributorReport(month));
    if (fill.warnings.length) throw new Error(fill.warnings.join("\n"));
  }
  console.log(`REPORT_TEMPLATE_CONTRIBUTORS=${file.id}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
