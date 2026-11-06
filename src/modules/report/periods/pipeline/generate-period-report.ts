import "server-only";
import { randomUUID } from "node:crypto";
import { google } from "googleapis";
import { PDFDocument } from "pdf-lib";
import { createGeneratedReport } from "@/modules/report/repositories/report-repository";
import { copyFile, gcall, renameFile, reportClients, setIndonesianLocale } from "@/modules/report/pipeline/engine/sheets";
import { uploadPdf } from "@/modules/report/pipeline/engine/pdf";
import { periodReportName } from "../lib/period";
import { PERIOD_CHARTS, PERIOD_SLIDE_COUNT, planPeriodSlides, slideElements, verifyPeriodSlideText } from "../lib/slide-plan";
import { planPeriodCharts } from "../lib/chart-plan";
import { parsePeriodRequest } from "../lib/options";
import { getPeriodReportData } from "../services/period-data-service";
import { periodReportConfig } from "../services/period-report-config";
import { PERIOD_REPORT_CHANNEL } from "../repositories/period-report-repository";
import type { PeriodReportJob, PeriodReportOptions } from "../types/period-report";

const running = new Set<number>();
const PRESENTATION_FIELDS = "presentationId,pageSize,slides(objectId,pageElements(objectId,size,transform,shape,table,elementGroup,sheetsChart))";

export class PeriodGenerationBusy extends Error {}
export class PeriodGenerationInvalid extends Error {}

function friendlyError(error: unknown): string {
  const text = (error as Error)?.message ?? String(error);
  if (/slides.*(?:disabled|has not been used)|accessNotConfigured/i.test(text)) return "Enable Google Slides API in the dashboard's Google Cloud project, then generate again.";
  if (/insufficient.*(?:scope|permission)|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(text)) return "Reconnect Google Sheets in Settings, grant every requested permission, then generate again.";
  return text;
}

export async function generatePeriodReport(number: number, options: PeriodReportOptions = {}): Promise<{ run: PeriodReportJob; chartDataUrl: string | null }> {
  try { options = parsePeriodRequest({ period: number, ...options }).options; }
  catch (error) { throw new PeriodGenerationInvalid((error as Error).message); }
  if (running.has(number)) throw new PeriodGenerationBusy("A report for this period is already being generated.");
  running.add(number);
  let client: Awaited<ReturnType<typeof reportClients>> | null = null;
  const created: { id: string; url: string; name: string }[] = [];
  let reportId: string | null = null;
  let reportUrl: string | null = null;
  let chartDataUrl: string | null = null;
  let endMonth = "";
  try {
    const data = await getPeriodReportData(number, options);
    endMonth = data.period.endMonth;
    if (data.blockedReasons.length) throw new PeriodGenerationInvalid(data.blockedReasons.join(" "));
    const config = periodReportConfig();
    const c = client = await reportClients();
    const slides = google.slides({ version: "v1", auth: c.auth as never });
    const [master, chartMaster] = await Promise.all([
      gcall(() => slides.presentations.get({ presentationId: config.slidesTemplateId, fields: PRESENTATION_FIELDS })),
      gcall(() => c.sheets.spreadsheets.get({ spreadsheetId: config.chartsTemplateId, fields: "spreadsheetId,sheets(properties,charts)" })),
    ]);
    // Fail on stale template bindings before creating anything in Drive.
    planPeriodSlides(master.data, data, options);
    planPeriodCharts(chartMaster.data, data);
    const name = periodReportName(data.period);
    const sheet = await copyFile(c, config.chartsTemplateId, `${name}, Chart Data`, config.folderId);
    if (sheet.id === config.chartsTemplateId || sheet.id === config.slidesTemplateId) throw new Error("Report generation must use a new chart workbook.");
    created.push({ ...sheet, name: `${name}, Chart Data` });
    chartDataUrl = sheet.url;
    const deck = await copyFile(c, config.slidesTemplateId, name, config.folderId);
    if (deck.id === config.slidesTemplateId || deck.id === config.chartsTemplateId) throw new Error("Report generation must use a new presentation.");
    created.push({ ...deck, name });
    reportId = deck.id;
    reportUrl = deck.url;
    await setIndonesianLocale(c, sheet.id);
    const [workbook, presentation] = await Promise.all([
      gcall(() => c.sheets.spreadsheets.get({ spreadsheetId: sheet.id, fields: "spreadsheetId,sheets(properties,charts)" })),
      gcall(() => slides.presentations.get({ presentationId: deck.id, fields: PRESENTATION_FIELDS })),
    ]);
    const charts = planPeriodCharts(workbook.data, data);
    await gcall(() => c.sheets.spreadsheets.values.batchClear({ spreadsheetId: sheet.id, requestBody: { ranges: charts.clearRanges } }));
    await gcall(() => c.sheets.spreadsheets.values.batchUpdate({ spreadsheetId: sheet.id, requestBody: { valueInputOption: "RAW", data: charts.values } }));
    await gcall(() => c.sheets.spreadsheets.batchUpdate({ spreadsheetId: sheet.id, requestBody: { requests: charts.requests } }));
    const plan = planPeriodSlides(presentation.data, data, options);
    const elements = slideElements(presentation.data);
    const expectedCharts: { id: string; chartId: number }[] = [];
    for (const role of PERIOD_CHARTS) {
      const element = elements.get(role.objectId)!;
      const pageId = presentation.data.slides!.find((page) => page.pageElements?.some((e) => e.objectId === role.objectId))?.objectId;
      if (!pageId || !element.size || !element.transform) throw new Error("The chart placement in the period template needs updating.");
      const id = `period_chart_${randomUUID().replace(/-/g, "")}`;
      plan.requests.push({ deleteObject: { objectId: role.objectId } }, { createSheetsChart: {
        objectId: id, spreadsheetId: sheet.id, chartId: charts.chartIds[role.kind], linkingMode: "LINKED",
        elementProperties: { pageObjectId: pageId, size: element.size, transform: element.transform },
      } });
      expectedCharts.push({ id, chartId: charts.chartIds[role.kind] });
    }
    for (let i = 0; i < plan.requests.length; i += 200) await gcall(() => slides.presentations.batchUpdate({ presentationId: deck.id, requestBody: { requests: plan.requests.slice(i, i + 200) } }));
    const filled = await gcall(() => slides.presentations.get({ presentationId: deck.id, fields: PRESENTATION_FIELDS }));
    verifyPeriodSlideText(filled.data, plan.texts);
    const filledElements = slideElements(filled.data);
    for (const chart of expectedCharts) {
      const linked = filledElements.get(chart.id)?.sheetsChart;
      if (linked?.spreadsheetId !== sheet.id || linked.chartId !== chart.chartId) throw new Error("A report chart still points to the wrong workbook.");
    }
    if (filled.data.slides?.length !== PERIOD_SLIDE_COUNT) throw new Error("The generated report must contain 14 slides.");
    const exported = await gcall(() => c.drive.files.export({ fileId: deck.id, mimeType: "application/pdf" }, { responseType: "arraybuffer" }));
    const pdf = Buffer.from(exported.data as unknown as ArrayBuffer);
    if ((await PDFDocument.load(pdf)).getPageCount() !== PERIOD_SLIDE_COUNT) throw new Error("The exported PDF must contain all 14 slides.");
    const parents = (await gcall(() => c.drive.files.get({ fileId: deck.id, fields: "parents" }))).data.parents ?? undefined;
    const pdfFile = await uploadPdf(c, `${name}.pdf`, pdf, parents);
    created.push({ ...pdfFile, name: `${name}.pdf` });
    const warnings = [...data.warnings, ...plan.warnings];
    const row = await createGeneratedReport({ channel: PERIOD_REPORT_CHANNEL, month: endMonth, fileId: deck.id, url: deck.url, pdfFileId: pdfFile.id, pdfUrl: pdfFile.url, status: "success", trigger: "manual", warnings: warnings.length ? warnings.join("\n") : null });
    return { run: { url: row.url, pdfUrl: row.pdfUrl, status: row.status, createdAt: row.createdAt.toISOString(), warnings: row.warnings, error: row.error }, chartDataUrl };
  } catch (error) {
    if (error instanceof PeriodGenerationInvalid) throw error;
    const message = friendlyError(error);
    // Only files made by this invocation may be labelled as failed. Existing reports are untouched.
    if (client) for (const file of created) await renameFile(client, file.id, `${file.name} (FAILED)`).catch(() => undefined);
    if (!endMonth) throw new PeriodGenerationInvalid(message);
    const row = await createGeneratedReport({ channel: PERIOD_REPORT_CHANNEL, month: endMonth, fileId: reportId, url: reportUrl, status: "error", trigger: "manual", error: message });
    return { run: { url: row.url, pdfUrl: row.pdfUrl, status: row.status, createdAt: row.createdAt.toISOString(), warnings: row.warnings, error: row.error }, chartDataUrl };
  } finally { running.delete(number); }
}
