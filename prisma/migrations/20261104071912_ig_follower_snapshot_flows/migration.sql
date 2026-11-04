-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_IgFollowerSnapshot" (
    "date" TEXT NOT NULL PRIMARY KEY,
    "followers" REAL NOT NULL,
    "monthFollows" REAL,
    "monthUnfollows" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_IgFollowerSnapshot" ("createdAt", "date", "followers") SELECT "createdAt", "date", "followers" FROM "IgFollowerSnapshot";
DROP TABLE "IgFollowerSnapshot";
ALTER TABLE "new_IgFollowerSnapshot" RENAME TO "IgFollowerSnapshot";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
