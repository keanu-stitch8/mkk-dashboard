// Generate laporan: salin master template → isi → catat. Laporan lama (buatan app) diberi akhiran "(lama …)";
// salinan yang gagal diisi diberi akhiran "(GAGAL …)" supaya tidak tertukar dengan laporan jadi.
import { prisma } from "../../db";
import { reportChannel } from "../channels";
import { enMonth } from "../month";
import { planFill } from "./tokens";
import { exportPdf, uploadPdf } from "./pdf";
import { applyPlan, copyFile, gcall, readGrids, renameFile, ReportError, reportClients } from "./sheets";

export const reportName = (title: string, month: string) => `MKK ${title} Monthly Performance Report – ${enMonth(month)}`;
const today = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

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
    if (!ch) throw new ReportError(`Laporan "${channelId}" belum tersedia.`);
    const tpl = templateId(ch.id);
    if (!tpl) throw new ReportError(`${ch.templateEnv} belum diisi di .env.local (ID file master template).`);
    const c = await reportClients();
    const data = await ch.build(month);
    const previous = await prisma.generatedReport.findMany({ where: { channel: ch.id, month, status: "success", fileId: { not: null } } });
    const file = await copyFile(c, tpl, reportName(ch.title, month), process.env.REPORT_FOLDER_ID?.trim() || undefined);
    fileId = file.id;
    url = file.url;
    const grids = await readGrids(c, file.id);
    const plan = planFill(grids, data);
    await applyPlan(c, file.id, plan, grids);
    // satu PDF berisi semua sheet (A4 landscape), disimpan di folder yang sama dengan laporan
    const parents = (await gcall(() => c.drive.files.get({ fileId: file.id, fields: "parents" }))).data.parents ?? undefined;
    const pdf = await uploadPdf(c, `${reportName(ch.title, month)}.pdf`, await exportPdf(c, file.id, grids), parents);
    for (const p of previous) {
      await renameFile(c, p.fileId!, `${reportName(ch.title, month)} (lama ${today()})`).catch(() => undefined);
      if (p.pdfFileId) await renameFile(c, p.pdfFileId, `${reportName(ch.title, month)} (lama ${today()}).pdf`).catch(() => undefined);
    }
    return prisma.generatedReport.create({
      data: { channel: ch.id, month, fileId, url, pdfFileId: pdf.id, pdfUrl: pdf.url, status: "success", trigger, warnings: plan.warnings.length ? plan.warnings.join("\n") : null },
    });
  } catch (e) {
    const error = e instanceof ReportError ? e.message : `Gagal membuat laporan: ${(e as Error)?.message ?? e}`;
    if (fileId && ch) await reportClients().then((c) => renameFile(c, fileId!, `${reportName(ch.title, month)} (GAGAL ${today()})`)).catch(() => undefined);
    return prisma.generatedReport.create({ data: { channel: channelId, month, fileId, url, status: "error", trigger, error } });
  }
}
