import "server-only";

export const periodReportConfig = () => ({
  slidesTemplateId: process.env.REPORT_TEMPLATE_PERIOD_SLIDES?.trim() || "1JlHy6-mH95Jmaw71-pp5LctqxkPDypJAbOMvYWcuw9c",
  chartsTemplateId: process.env.REPORT_TEMPLATE_PERIOD_CHARTS?.trim() || "1qBnu0U7N85RR0iT_xttidsXWXIm2BAEgI7GA3W_Lms4",
  folderId: process.env.REPORT_FOLDER_ID?.trim() || undefined,
});
