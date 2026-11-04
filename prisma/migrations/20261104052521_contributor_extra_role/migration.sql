-- AlterTable
ALTER TABLE "Contributor" ADD COLUMN "role" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ContributorTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tab" TEXT NOT NULL,
    "no" INTEGER NOT NULL,
    "planned" TEXT,
    "guideFile" TEXT,
    "n" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT,
    "articleBy" TEXT,
    "articleAt" TEXT,
    "landscape" TEXT,
    "landscapeBy" TEXT,
    "landscapeAt" TEXT,
    "portrait" TEXT,
    "portraitBy" TEXT,
    "portraitAt" TEXT,
    "video" TEXT,
    "videoBy" TEXT,
    "videoAt" TEXT,
    "interview" TEXT,
    "interviewBy" TEXT,
    "interviewAt" TEXT,
    "storyCode" TEXT,
    "extra" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ContributorTask" ("articleAt", "articleBy", "guideFile", "id", "interview", "interviewAt", "interviewBy", "landscape", "landscapeAt", "landscapeBy", "n", "no", "planned", "portrait", "portraitAt", "portraitBy", "status", "storyCode", "tab", "title", "updatedAt", "video", "videoAt", "videoBy") SELECT "articleAt", "articleBy", "guideFile", "id", "interview", "interviewAt", "interviewBy", "landscape", "landscapeAt", "landscapeBy", "n", "no", "planned", "portrait", "portraitAt", "portraitBy", "status", "storyCode", "tab", "title", "updatedAt", "video", "videoAt", "videoBy" FROM "ContributorTask";
DROP TABLE "ContributorTask";
ALTER TABLE "new_ContributorTask" RENAME TO "ContributorTask";
CREATE INDEX "ContributorTask_tab_idx" ON "ContributorTask"("tab");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
