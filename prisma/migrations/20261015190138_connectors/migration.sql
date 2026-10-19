-- CreateTable
CREATE TABLE "ConnectorCredential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connector" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "account" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connector" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rows" INTEGER NOT NULL DEFAULT 0,
    "detail" TEXT,
    "error" TEXT,
    "rawError" TEXT,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorCredential_connector_key" ON "ConnectorCredential"("connector");

-- CreateIndex
CREATE INDEX "SyncLog_connector_month_idx" ON "SyncLog"("connector", "month");

-- CreateIndex
CREATE INDEX "SyncLog_startedAt_idx" ON "SyncLog"("startedAt");
