-- CreateTable
CREATE TABLE "PageMeta" (
    "url" TEXT NOT NULL PRIMARY KEY,
    "ogImage" TEXT,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
