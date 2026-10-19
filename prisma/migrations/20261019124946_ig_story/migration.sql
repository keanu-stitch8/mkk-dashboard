-- CreateTable
CREATE TABLE "IgStory" (
    "storyId" TEXT NOT NULL PRIMARY KEY,
    "month" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "publishedAt" TEXT NOT NULL,
    "permalink" TEXT,
    "durationSec" REAL,
    "views" REAL,
    "reach" REAL,
    "linkClicks" REAL,
    "source" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "IgStory_month_idx" ON "IgStory"("month");
