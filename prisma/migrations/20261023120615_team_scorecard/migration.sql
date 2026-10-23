-- CreateTable
CREATE TABLE "TeamScore" (
    "month" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" REAL,
    "n" INTEGER,
    "base" INTEGER,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("month", "key")
);
