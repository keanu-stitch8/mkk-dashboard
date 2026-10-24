// Generate laporan: salin master template → isi → catat. Laporan lama (buatan app) diberi akhiran "(lama …)";
// salinan yang gagal diisi diberi akhiran "(GAGAL …)" supaya tidak tertukar dengan laporan jadi.
import { createGeneratedReport, findPreviousReports } from "@/modules/report/repositories/report-repository";
import { reportChannel } from "../channels";
import { enMonth } from "../month";
import { planFill } from "./tokens";
import { exportPdf, uploadPdf } from "./pdf";
import { applyPlan, copyFile, gcall, readGrids, renameFile, ReportError, reportClients, setIndonesianLocale } from "./sheets";
import { WIB, dateIn } from "@/modules/shared/lib/tz";

export const reportName = (title: string, month: string) => `MKK ${title} Monthly Performance Report – ${enMonth(month)}`;
const today = () => dateIn(Date.now(), WIB);

/** ID master template channel (env), null jika belum dikonfigurasi. */
export function templateId(channelId: string): string | null {
  const ch = reportChannel(channelId);
  return (ch && process.env[ch.templateEnv]?.trim()) || null;
}

export async function generateReport(channelId: string, month: string, trigger: "manual" | "cron" = "manual") {
  const ch = reportChannel(channelId);
  let fileId: string | null = null;
  let url: string | null = null;
  try {
    if (!ch) throw new ReportError(`The "${channelId}" report isn't available yet.`);
    const tpl = templateId(ch.id);
    if (!tpl) throw new ReportError(`${ch.templateEnv} isn't set in .env.local (master template file ID).`);
    const c = await reportClients();
    const data = await ch.build(month);
    const previous = await findPreviousReports(ch.id, month);
    const file = await copyFile(c, tpl, reportName(ch.title, month), process.env.REPORT_FOLDER_ID?.trim() || undefined);
    fileId = file.id;
    url = file.url;
    await setIndonesianLocale(c, file.id);
    const grids = await readGrids(c, file.id);
    const plan = planFill(grids, data);
    plan.warnings.push(...(data.warnings ?? []));
    await applyPlan(c, file.id, plan, grids);
    // satu PDF berisi semua sheet yang tampil (A4 landscape), disimpan di folder yang sama dengan laporan
    const parents = (await gcall(() => c.drive.files.get({ fileId: file.id, fields: "parents" }))).data.parents ?? undefined;
    const pdf = await uploadPdf(c, `${reportName(ch.title, month)}.pdf`, await exportPdf(c, file.id, grids.filter((g) => !g.hidden), [], plan.pageBreaks), parents);
    for (const p of previous) {
      await renameFile(c, p.fileId!, `${reportName(ch.title, month)} (lama ${today()})`).catch(() => undefined);
      if (p.pdfFileId) await renameFile(c, p.pdfFileId, `${reportName(ch.title, month)} (lama ${today()}).pdf`).catch(() => undefined);
    }
    return createGeneratedReport({ channel: ch.id, month, fileId, url, pdfFileId: pdf.id, pdfUrl: pdf.url, status: "success", trigger, warnings: plan.warnings.length ? plan.warnings.join("\n") : null });
  } catch (e) {
    const error = e instanceof ReportError ? e.message : `Failed to generate the report: ${(e as Error)?.message ?? e}`;
    if (fileId && ch) await reportClients().then((c) => renameFile(c, fileId!, `${reportName(ch.title, month)} (FAILED ${today()})`)).catch(() => undefined);
    return createGeneratedReport({ channel: channelId, month, fileId, url, status: "error", trigger, error });
  }
}
