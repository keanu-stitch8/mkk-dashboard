import "server-only";

export const periodReportConfig = () => ({
  slidesTemplateId: process.env.REPORT_TEMPLATE_PERIOD_SLIDES?.trim() || "1unxVW_vYhscmcZJ-52f2r7CRVHThbTqbcGV92Ym-iM8",
  chartsTemplateId: process.env.REPORT_TEMPLATE_PERIOD_CHARTS?.trim() || "1CfOyCYaP_dwGtQ0qtBeCBq_mo69K-2zvvAgI06BMLwI",
  folderId: process.env.REPORT_FOLDER_ID?.trim() || undefined,
});
