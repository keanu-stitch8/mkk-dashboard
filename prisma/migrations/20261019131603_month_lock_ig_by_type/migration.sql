-- CreateTable
CREATE TABLE "MonthLock" (
    "month" TEXT NOT NULL PRIMARY KEY,
    "lockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT
);

-- CreateTable
CREATE TABLE "IgAccountByType" (
    "month" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("month", "metric", "type")
);
