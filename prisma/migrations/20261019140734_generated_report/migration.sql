-- CreateTable
CREATE TABLE "GeneratedReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channel" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "fileId" TEXT,
    "url" TEXT,
    "status" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "warnings" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "GeneratedReport_channel_month_idx" ON "GeneratedReport"("channel", "month");
