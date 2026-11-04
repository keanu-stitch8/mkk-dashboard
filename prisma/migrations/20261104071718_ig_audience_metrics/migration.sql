-- AlterTable
ALTER TABLE "IgMediaSnapshot" ADD COLUMN "follows" REAL;
ALTER TABLE "IgMediaSnapshot" ADD COLUMN "profileVisits" REAL;
ALTER TABLE "IgMediaSnapshot" ADD COLUMN "reposts" REAL;

-- AlterTable
ALTER TABLE "SocialPost" ADD COLUMN "profileVisits" REAL;
ALTER TABLE "SocialPost" ADD COLUMN "reposts" REAL;

-- CreateTable
CREATE TABLE "IgAccountMonth" (
    "month" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("month", "metric", "segment")
);

-- CreateTable
CREATE TABLE "IgFollowerSnapshot" (
    "date" TEXT NOT NULL PRIMARY KEY,
    "followers" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
