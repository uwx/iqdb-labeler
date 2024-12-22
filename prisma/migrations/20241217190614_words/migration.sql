-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Tag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "words" TEXT,
    "isDeprecated" BOOLEAN,
    "updatedAt" DATETIME,
    "createdAt" DATETIME,
    "category" INTEGER,
    "postCount" INTEGER
);
INSERT INTO "new_Tag" ("category", "createdAt", "id", "isDeprecated", "name", "postCount", "updatedAt", "words") SELECT "category", "createdAt", "id", "isDeprecated", "name", "postCount", "updatedAt", "words" FROM "Tag";
DROP TABLE "Tag";
ALTER TABLE "new_Tag" RENAME TO "Tag";
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");
CREATE INDEX "Tag_name_idx" ON "Tag"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
