-- CreateTable
CREATE TABLE "Story" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "n" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "angle" TEXT,
    "fileId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Brief" (
    "fileId" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "headline" TEXT,
    "outline" TEXT,
    "webViewLink" TEXT,
    "modifiedTime" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TeamMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromType" TEXT NOT NULL,
    "fromKey" TEXT NOT NULL,
    "toType" TEXT NOT NULL,
    "toKey" TEXT NOT NULL,
    "toTitle" TEXT NOT NULL,
    "toDate" TEXT,
    "toFormat" TEXT,
    "toUrl" TEXT,
    "score" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Story_month_idx" ON "Story"("month");

-- CreateIndex
CREATE INDEX "Brief_month_idx" ON "Brief"("month");

-- CreateIndex
CREATE INDEX "TeamMatch_fromType_fromKey_idx" ON "TeamMatch"("fromType", "fromKey");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMatch_fromType_fromKey_toType_toKey_key" ON "TeamMatch"("fromType", "fromKey", "toType", "toKey");
