-- CreateTable
CREATE TABLE "BriefTask" (
    "briefKey" TEXT NOT NULL PRIMARY KEY,
    "briefName" TEXT NOT NULL,
    "tab" TEXT NOT NULL,
    "planned" TEXT,
    "article" TEXT,
    "format" TEXT NOT NULL,
    "status" TEXT,
    "assignee" TEXT,
    "submitted" TEXT,
    "published" TEXT,
    "igUrl" TEXT,
    "note" TEXT,
    "updatedAt" DATETIME NOT NULL
);
