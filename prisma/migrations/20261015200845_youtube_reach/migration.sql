-- AlterTable
ALTER TABLE "YtVideo" ADD COLUMN "comments" REAL;
ALTER TABLE "YtVideo" ADD COLUMN "likes" REAL;
ALTER TABLE "YtVideo" ADD COLUMN "shares" REAL;

-- CreateTable
CREATE TABLE "YtReachDaily" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "impressions" REAL NOT NULL,
    "ctr" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "YtReachReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "YtReachDaily_date_idx" ON "YtReachDaily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "YtReachDaily_date_videoId_key" ON "YtReachDaily"("date", "videoId");
