-- CreateTable
CREATE TABLE "Ga4City" (
    "month" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "activeUsers" REAL NOT NULL,
    "newUsers" REAL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("month", "city", "country")
);

-- CreateIndex
CREATE INDEX "Ga4City_month_idx" ON "Ga4City"("month");
