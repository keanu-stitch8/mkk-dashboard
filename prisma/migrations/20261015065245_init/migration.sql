-- CreateTable
CREATE TABLE "Import" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "month" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Metric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" REAL NOT NULL,
    CONSTRAINT "Metric_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManualMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "month" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Quota" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "month" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "Breakdown" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" REAL NOT NULL,
    CONSTRAINT "Breakdown_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ga4Channel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "sessions" REAL NOT NULL,
    "engagedSessions" REAL,
    "engagementRate" REAL,
    "avgEngagementTime" REAL,
    "eventCount" REAL,
    "users" REAL,
    "newUsers" REAL,
    CONSTRAINT "Ga4Channel_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ga4Page" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT,
    "views" REAL NOT NULL,
    "activeUsers" REAL,
    "avgEngagementTime" REAL,
    "eventCount" REAL,
    CONSTRAINT "Ga4Page_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ga4Landing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "sessions" REAL NOT NULL,
    "activeUsers" REAL,
    "newUsers" REAL,
    "avgEngagementTime" REAL,
    CONSTRAINT "Ga4Landing_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GscQuery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "clicks" REAL NOT NULL,
    "impressions" REAL NOT NULL,
    "ctr" REAL NOT NULL,
    "position" REAL NOT NULL,
    CONSTRAINT "GscQuery_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GscPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "clicks" REAL NOT NULL,
    "impressions" REAL NOT NULL,
    "ctr" REAL NOT NULL,
    "position" REAL NOT NULL,
    CONSTRAINT "GscPage_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GscDaily" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "clicks" REAL NOT NULL,
    "impressions" REAL NOT NULL,
    "ctr" REAL NOT NULL,
    "position" REAL NOT NULL,
    CONSTRAINT "GscDaily_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "YtVideo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publishedDate" TEXT,
    "durationSec" REAL,
    "views" REAL NOT NULL,
    "watchHours" REAL,
    "avgViewDurationSec" REAL,
    "impressions" REAL,
    "ctr" REAL,
    "uniqueViewers" REAL,
    "subsGained" REAL,
    "subsLost" REAL,
    CONSTRAINT "YtVideo_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "YtDaily" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "watchHours" REAL,
    "views" REAL,
    CONSTRAINT "YtDaily_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "YtLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "date" TEXT,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "videoId" TEXT,
    "format" TEXT,
    "category" TEXT,
    "status" TEXT NOT NULL,
    CONSTRAINT "YtLog_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "publishedAt" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "rawType" TEXT,
    "caption" TEXT,
    "permalink" TEXT,
    "views" REAL,
    "reach" REAL,
    "likes" REAL,
    "comments" REAL,
    "shares" REAL,
    "saves" REAL,
    "follows" REAL,
    "interactions" REAL,
    "durationSec" REAL,
    CONSTRAINT "SocialPost_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SocialLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "date" TEXT,
    "platform" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "category" TEXT,
    "admin" TEXT,
    "designer" TEXT,
    "status" TEXT NOT NULL,
    "title" TEXT,
    "url" TEXT,
    CONSTRAINT "SocialLog_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NewsArticle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "date" TEXT,
    "submittedDate" TEXT,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "path" TEXT,
    "category" TEXT,
    "reporter" TEXT,
    "status" TEXT NOT NULL,
    "type" TEXT,
    "method" TEXT,
    CONSTRAINT "NewsArticle_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NewsView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "views" REAL NOT NULL,
    "activeUsers" REAL,
    "avgEngagementTime" REAL,
    CONSTRAINT "NewsView_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Import_month_idx" ON "Import"("month");

-- CreateIndex
CREATE UNIQUE INDEX "Import_month_source_key" ON "Import"("month", "source");

-- CreateIndex
CREATE INDEX "Metric_month_channel_idx" ON "Metric"("month", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "ManualMetric_month_channel_key_key" ON "ManualMetric"("month", "channel", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Quota_month_key_key" ON "Quota"("month", "key");

-- CreateIndex
CREATE INDEX "Breakdown_month_channel_dimension_idx" ON "Breakdown"("month", "channel", "dimension");

-- CreateIndex
CREATE INDEX "Ga4Channel_month_idx" ON "Ga4Channel"("month");

-- CreateIndex
CREATE INDEX "Ga4Page_month_path_idx" ON "Ga4Page"("month", "path");

-- CreateIndex
CREATE INDEX "Ga4Landing_month_idx" ON "Ga4Landing"("month");

-- CreateIndex
CREATE INDEX "GscQuery_month_idx" ON "GscQuery"("month");

-- CreateIndex
CREATE INDEX "GscPage_month_idx" ON "GscPage"("month");

-- CreateIndex
CREATE INDEX "GscDaily_month_idx" ON "GscDaily"("month");

-- CreateIndex
CREATE INDEX "YtVideo_month_idx" ON "YtVideo"("month");

-- CreateIndex
CREATE INDEX "YtDaily_month_idx" ON "YtDaily"("month");

-- CreateIndex
CREATE INDEX "YtLog_month_idx" ON "YtLog"("month");

-- CreateIndex
CREATE INDEX "SocialPost_month_platform_idx" ON "SocialPost"("month", "platform");

-- CreateIndex
CREATE INDEX "SocialLog_month_idx" ON "SocialLog"("month");

-- CreateIndex
CREATE INDEX "NewsArticle_month_idx" ON "NewsArticle"("month");

-- CreateIndex
CREATE INDEX "NewsView_month_idx" ON "NewsView"("month");
