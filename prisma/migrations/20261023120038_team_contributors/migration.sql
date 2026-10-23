-- CreateTable
CREATE TABLE "ContributorTask" (
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Contributor" (
    "alias" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "ContributorTask_tab_idx" ON "ContributorTask"("tab");
