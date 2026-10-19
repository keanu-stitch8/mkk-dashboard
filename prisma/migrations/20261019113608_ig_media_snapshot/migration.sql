-- CreateTable
CREATE TABLE "IgMediaSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "publishedDate" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "views" REAL,
    "reach" REAL,
    "likes" REAL,
    "comments" REAL,
    "shares" REAL,
    "saves" REAL,
    "interactions" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "IgMediaSnapshot_date_idx" ON "IgMediaSnapshot"("date");

-- CreateIndex
CREATE UNIQUE INDEX "IgMediaSnapshot_date_mediaId_key" ON "IgMediaSnapshot"("date", "mediaId");
